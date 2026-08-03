#!/usr/bin/env node

// Client attempt-contract guard. No build, no database, no network, no browser.
//
// THE RULE IT PROTECTS. One attempt equals one identifier, minted and persisted
// BEFORE the call, not on the response. A reload while the first call is in
// flight aborts the request: no cookie is processed and nothing is stored on the
// client, but the server has already finished its write. The database can only
// converge on an identifier the client actually resends, so this contract is the
// half of the fix no SQL can enforce.
//
// AND THE VERSION OF THAT IDENTIFIER IS NOT A DETAIL. The server validates it
// against ATTEMPT_ID_PATTERN (lib/game/training/contracts.ts), which demands a
// version nibble in 1 to 5 and a variant nibble in 8 to b. A client that minted
// a uuidv7, or any other shape, would see every identifier refused IN SILENCE:
// the server mints its own, the response stays valid, no error is raised
// anywhere, and a reload opens a second session again.
//
// WHAT THE FIRST VERSION OF THIS GUARD GOT WRONG, since that is what shaped this
// one. An independent review ran 27 mutations against it and 17 stayed green,
// five of them restoring the plan's bug outright: a persist made conditional by
// one added word, a persist of a value different from the one sent, a payload
// sending an alias minted on the spot, a store returning a constant or a
// String(Date.now()), and an inverted fresh flag. They all survived for the same
// reason: the guard checked that CALLS existed and that tokens appeared in the
// right ORDER, never that the VALUE sent was the value stored, nor that a failure
// branch actually stopped anything. So this version follows the value through
// named symbols, from the generator to the request payload, and tests structure
// (a failure short-circuits, a release sits in a finally) instead of presence.
// Two of its rules were also false positives on legitimate refactors, both fixed.
//
// HOW IT READS THE SOURCE. Comments are blanked first, both forms, strings and
// template literals left alone, because GameScreen.tsx NAMES the end path in a
// comment and a whole-file substring test would be green on an empty
// implementation. Every rule that can be scoped is then scoped to the function
// that really does the work, located by brace matching rather than by name, so a
// rename is not a false positive. The rules that cannot be scoped, because they
// concern call sites spread across the JSX or an import, are marked WHOLE FILE
// where they sit. The pure part of that machinery self-tests on synthetic lines
// before a single rule runs.
//
// This script is standalone: it guards features/game/components/GameScreen.tsx,
// plus the route files the paths in that client resolve to.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCREEN = "features/game/components/GameScreen.tsx";
const CONTRACTS = "lib/game/training/contracts.ts";

const failures = [];
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

// ---------------------------------------------------------------- pure helpers

// Blanks comments and keeps every other byte at its own offset, so an index into
// the result is still an index into the file. Both forms are handled, the line
// form and the block form, the second being the one a previous guard in this plan
// forgot. String and template literals are walked through, so a "//" inside a
// path literal, or a "/*" inside a message, is not read as the start of a
// comment. Regex literals are recognised by what precedes them, which is what
// stops /https:\/\// from eating the rest of a line.
//
// Known limit, stated rather than hidden: JSX text is not string-quoted, so a
// literal "//" written as page content would be blanked. No such text exists on
// this screen, and the alternative is a JSX parser this repo has no need of.
const stripComments = (source) => {
  const out = [];
  const REGEX_ALLOWED_BEFORE = /[(,=:[!&|?{};+\-*%~^]$|\b(?:return|typeof|case|in|of|do|else|void|await|yield|new)$/;
  let i = 0;
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) out.push(source[k] === "\n" ? "\n" : " ");
  };
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === "/" && next === "/") {
      let end = i;
      while (end < source.length && source[end] !== "\n") end += 1;
      blank(i, end);
      i = end;
      continue;
    }
    if (ch === "/" && next === "*") {
      let end = i + 2;
      while (end < source.length && !(source[end] === "*" && source[end + 1] === "/")) end += 1;
      end = Math.min(source.length, end + 2);
      blank(i, end);
      i = end;
      continue;
    }
    if (ch === '"' || ch === "'") {
      out.push(ch);
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          out.push(source[i], source[i + 1] ?? "");
          i += 2;
          continue;
        }
        out.push(source[i]);
        if (source[i] === ch || source[i] === "\n") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === "`") {
      let depth = 0;
      out.push(ch);
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          out.push(source[i], source[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (source[i] === "`" && depth === 0) {
          out.push(source[i]);
          i += 1;
          break;
        }
        if (source[i] === "$" && source[i + 1] === "{") {
          depth += 1;
          out.push("$", "{");
          i += 2;
          continue;
        }
        if (source[i] === "}" && depth > 0) depth -= 1;
        out.push(source[i]);
        i += 1;
      }
      continue;
    }
    if (ch === "/") {
      const before = out.join("").replace(/\s+$/, "");
      if (REGEX_ALLOWED_BEFORE.test(before)) {
        out.push(ch);
        i += 1;
        let inClass = false;
        while (i < source.length) {
          if (source[i] === "\\") {
            out.push(source[i], source[i + 1] ?? "");
            i += 2;
            continue;
          }
          if (source[i] === "[") inClass = true;
          else if (source[i] === "]") inClass = false;
          out.push(source[i]);
          if (source[i] === "\n") {
            i += 1;
            break;
          }
          if (source[i] === "/" && !inClass) {
            i += 1;
            break;
          }
          i += 1;
        }
        continue;
      }
    }
    out.push(ch);
    i += 1;
  }
  return out.join("");
};

// Every brace pair of a comment-free source, skipping braces inside a string or a
// template literal. Template expressions are re-entered as code, so `${ { a: 1 } }`
// neither unbalances the count nor hides a block.
const scanBraces = (source) => {
  const pairs = [];
  const open = [];
  const frames = [{ mode: "code", depthAtEntry: 0 }];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const frame = frames[frames.length - 1];

    if (frame.mode === "template") {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") {
        frames.pop();
        i += 1;
        continue;
      }
      if (ch === "$" && source[i + 1] === "{") {
        frames.push({ mode: "code", depthAtEntry: open.length });
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === quote || source[i] === "\n") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === "`") {
      frames.push({ mode: "template", depthAtEntry: open.length });
      i += 1;
      continue;
    }
    if (ch === "{") {
      open.push(i);
      i += 1;
      continue;
    }
    if (ch === "}") {
      if (frames.length > 1 && open.length === frame.depthAtEntry) {
        frames.pop();
        i += 1;
        continue;
      }
      const start = open.pop();
      if (start !== undefined) pairs.push({ open: start, close: i });
      i += 1;
      continue;
    }
    i += 1;
  }
  return pairs;
};

// A block is a function body when what precedes it is an arrow or a function
// signature, with or without a TypeScript return annotation. `try {`,
// `if (...) {` and an object literal are not, which is what makes this return the
// function that does the work rather than the try block inside it or the
// component body around it. The annotation was missing in the first version, so
// `function mint(): string {` broke the slicing and the guard went red on an
// ordinary declaration, with a message that named the wrong cause.
const FUNCTION_HEAD = /(?:=>|\bfunction\b[^(){}]*\([^()]*\)(?:\s*:\s*[^(){};=]*)?)\s*$/;

const enclosingFunction = (source, pairs, index) => {
  const containing = pairs
    .filter((pair) => pair.open < index && index < pair.close)
    .sort((a, b) => b.open - a.open);
  for (const pair of containing) {
    if (FUNCTION_HEAD.test(source.slice(Math.max(0, pair.open - 300), pair.open))) {
      return pair;
    }
  }
  return null;
};

// The name a block was declared under, so rules can be chained between functions
// without hard-coding any name: the guard follows the code's own wiring.
const declaredName = (source, blockOpen) => {
  const matches = [
    ...source.slice(0, blockOpen).matchAll(/(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g),
  ];
  return matches.length > 0 ? matches[matches.length - 1][1] : null;
};

// Where the declaration of a named function starts, so it can be extracted whole
// and executed. Covers `const name = ...` and `function name(...)` alike.
const declarationStart = (source, blockOpen, name) => {
  const candidates = [
    source.lastIndexOf(`const ${name}`, blockOpen),
    source.lastIndexOf(`let ${name}`, blockOpen),
    source.lastIndexOf(`var ${name}`, blockOpen),
    source.lastIndexOf(`function ${name}`, blockOpen),
  ].filter((at) => at !== -1);
  return candidates.length > 0 ? Math.max(...candidates) : blockOpen;
};

// How many brace pairs enclose an index. Two statements at the same depth in one
// function body are on the same unconditional path; a statement one level deeper
// sits in a branch, a callback or a timer.
const depthAt = (pairs, index) =>
  pairs.filter((pair) => pair.open < index && index < pair.close).length;

// The statement an index belongs to, bounded by the nearest statement break.
// `if (fresh) storage.setItem(...)` comes back whole, starting with `if`, which is
// how a persist made conditional by one added word is caught even though it adds
// no brace and so does not change the depth.
const statementAround = (source, index) => {
  let start = index;
  while (start > 0 && !";{}".includes(source[start - 1])) start -= 1;
  let end = index;
  while (end < source.length && source[end] !== ";") end += 1;
  return source.slice(start, end).trim();
};

// The parenthesised argument list of the call that follows `from`.
const parenRegionAfter = (source, from) => {
  const open = source.indexOf("(", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return { open, close: i, text: source.slice(open + 1, i) };
    }
  }
  return null;
};

// Depth-aware split on commas, so nested calls and objects stay in one piece.
const splitTopLevel = (text) => {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      current += ch;
      i += 1;
      while (i < text.length && text[i] !== quote) {
        if (text[i] === "\\") {
          current += text[i];
          i += 1;
        }
        current += text[i];
        i += 1;
      }
      current += text[i] ?? "";
      continue;
    }
    if ("([{".includes(ch)) depth += 1;
    if (")]}".includes(ch)) depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
};

// Entries of an object literal, shorthand kept as a null value so a rule can tell
// `{ attemptId }` from `{ attemptId: somethingElse }`.
const entriesOf = (objectText) => {
  const inner = objectText.trim().replace(/^\{/, "").replace(/\}$/, "");
  return splitTopLevel(inner).map((part) => {
    let depth = 0;
    let colon = -1;
    for (let i = 0; i < part.length && colon === -1; i += 1) {
      if ("([{".includes(part[i])) depth += 1;
      if (")]}".includes(part[i])) depth -= 1;
      if (part[i] === ":" && depth === 0) colon = i;
    }
    if (colon === -1) return { key: part.trim(), value: null };
    return { key: part.slice(0, colon).trim(), value: part.slice(colon + 1).trim() };
  });
};

// An `if` whose condition reads a ref and whose body returns: the synchronous
// re-entrance guard, found by shape so the ref can be renamed, and tolerant of a
// compound condition like `if (!sessionId || ref.current) return;`.
const findReentranceGuard = (source, from, to) => {
  const region = source.slice(from, to);
  for (const match of region.matchAll(/\bif\s*\(/g)) {
    const args = parenRegionAfter(region, match.index);
    if (!args) continue;
    const ref = /\b([A-Za-z_$][\w$]*)\.current\b/.exec(args.text);
    if (!ref) continue;
    const tail = region.slice(args.close + 1, args.close + 140);
    if (!/^\s*(?:\{\s*)?return\b/.test(tail)) continue;
    return { refName: ref[1], index: from + match.index };
  }
  return null;
};

// Does this body return exactly this symbol somewhere, and not merely something
// derived from it. `return minted.slice(0, 8)` contains `return minted` as a
// substring while sending a value that is not the one stored, which is how a
// looser test would be fooled.
const returnsExactly = (body, symbol) =>
  [...body.matchAll(/return\s+([^;]*);/g)].some((match) => match[1].trim() === symbol);

// The body of a `finally` clause, so a rule can require a release to live there
// rather than merely somewhere in the function.
const finallyBodyOf = (source, closeOf, from, to) => {
  const at = source.indexOf("finally", from);
  if (at === -1 || at > to) return null;
  const brace = source.indexOf("{", at);
  if (brace === -1 || !closeOf.has(brace)) return null;
  return { open: brace, close: closeOf.get(brace) };
};

// uuid v4 out of raw bytes, the exact algorithm the client's documented fallback
// has to implement. Used to check the server's pattern accepts that shape.
const v4FromBytes = (bytes) => {
  const copy = Uint8Array.from(bytes);
  copy[6] = (copy[6] & 0x0f) | 0x40;
  copy[8] = (copy[8] & 0x3f) | 0x80;
  const hex = Array.from(copy, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// -------------------------------------------------------------------- selftest
// The rules below are only as good as the helpers above, so those are exercised
// on synthetic lines first. A slicer that silently returned the whole file would
// certify anything, which is how earlier guards in this plan shipped vacuous.
const selfTest = () => {
  const problems = [];
  const expect = (label, actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      problems.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  };

  expect("line comment blanked", stripComments("a; // gone\nb;").includes("gone"), false);
  expect("line comment keeps the newline", stripComments("a; // gone\nb;").split("\n").length, 2);
  expect("block comment blanked", stripComments("a; /* gone */ b;").includes("gone"), false);
  expect(
    "multiline block comment blanked",
    stripComments("a;\n/* gone\n   gone */\nb;").includes("gone"),
    false
  );
  expect("offsets preserved", stripComments("a; // gone\nb;").length, "a; // gone\nb;".length);
  expect(
    "a slash pair inside a string survives",
    stripComments('const u = "https://x/y"; kept;').includes("kept"),
    true
  );
  expect(
    "a block opener inside a string is not a comment",
    stripComments('const s = "/* not a comment"; kept;').includes("kept"),
    true
  );
  expect(
    "a comment marker inside a template survives",
    stripComments("const t = `a // b`; kept;").includes("kept"),
    true
  );
  expect(
    "a regex literal containing slashes is not a comment",
    stripComments("const r = /https:\\/\\//; kept;").includes("kept"),
    true
  );
  expect(
    "division is still division",
    stripComments("const n = a / b; const m = c / d; kept;").includes("kept"),
    true
  );

  const sample = [
    "const outer = () => {",
    "  const decoy = 1;",
    '  const skipped = "{ MARK }";',
    "  const inner = ({ flag = false } = {}) => {",
    "    if (flag) { return 0; }",
    "    try {",
    "      const label = `x ${ { a: 1 }.a } y`;",
    "      MARK(label);",
    "    } catch { return 1; }",
    "    return 2;",
    "  };",
    "  return inner;",
    "};",
  ].join("\n");
  const samplePairs = scanBraces(sample);
  const markAt = sample.lastIndexOf("MARK(");
  const block = enclosingFunction(sample, samplePairs, markAt);
  expect("selftest slicer found a block", block !== null, true);
  if (block) {
    const body = sample.slice(block.open, block.close);
    expect("selftest slice holds the marker", body.includes("MARK(label)"), true);
    expect("selftest slice excludes the outer decoy", body.includes("const decoy"), false);
    expect("selftest slice names the inner function", declaredName(sample, block.open), "inner");
    expect("selftest slice is not the whole file", body.length < sample.length, true);
  }
  expect(
    "string braces ignored by the scanner",
    scanBraces('const a = "{"; const b = { c: 1 };').length,
    1
  );

  // A TypeScript return annotation on a function declaration must still read as a
  // function body. This exact case was a false positive in the first version.
  const declared = "function mintIt(): string {\n  MARK();\n}\n";
  const declaredPairs = scanBraces(declared);
  const declaredBlock = enclosingFunction(declared, declaredPairs, declared.indexOf("MARK"));
  expect("annotated function declaration is a function body", declaredBlock !== null, true);
  if (declaredBlock) {
    expect(
      "annotated function declaration names itself",
      declaredName(declared, declaredBlock.open),
      "mintIt"
    );
    expect(
      "annotated declaration start found",
      declarationStart(declared, declaredBlock.open, "mintIt"),
      0
    );
  }

  // Depth and statement shape, the two rules that catch a conditional or a
  // deferred persist. Both mutations add no call and no reorder, so nothing else
  // would see them.
  const depthSample = "const a = () => {\n  x();\n  if (f) { y(); }\n  t(() => { z(); });\n};";
  const depthPairs = scanBraces(depthSample);
  expect(
    "same path, same depth",
    depthAt(depthPairs, depthSample.indexOf("x()")),
    depthAt(depthPairs, depthSample.indexOf("t(("))
  );
  expect(
    "a branch is deeper",
    depthAt(depthPairs, depthSample.indexOf("y()")) > depthAt(depthPairs, depthSample.indexOf("x()")),
    true
  );
  expect(
    "a callback is deeper",
    depthAt(depthPairs, depthSample.indexOf("z()")) > depthAt(depthPairs, depthSample.indexOf("x()")),
    true
  );
  expect(
    "statement keeps its guard word",
    statementAround("a(); if (f) store.set(k, v); b();", "a(); if (f) store.set".length).startsWith(
      "if"
    ),
    true
  );
  expect(
    "unguarded statement starts with the call",
    statementAround("a(); store.set(k, v); b();", "a(); store.set".length).startsWith("store.set"),
    true
  );

  expect("args split at top level", splitTopLevel("KEY, f(a, b), c"), ["KEY", "f(a, b)", "c"]);
  expect("shorthand entry has a null value", entriesOf("{ attemptId }"), [
    { key: "attemptId", value: null },
  ]);
  expect("valued entry keeps its expression", entriesOf("{ fresh: !fresh }"), [
    { key: "fresh", value: "!fresh" },
  ]);
  expect(
    "nested object entry survives the split",
    entriesOf("{ a: 1, b: { c: 2 }, d: f(1, 2) }").map((entry) => entry.key),
    ["a", "b", "d"]
  );

  const guardSample =
    "const f = () => {\n  if (!x || ref.current) return;\n  ref.current = true;\n};";
  const found = findReentranceGuard(guardSample, 0, guardSample.length);
  expect("re-entrance guard found behind a compound condition", found && found.refName, "ref");

  expect("v4 helper builds a version 4", v4FromBytes(new Uint8Array(16))[14], "4");
  expect(
    "v4 helper builds a variant in 8..b",
    ["8", "9", "a", "b"].includes(v4FromBytes(new Uint8Array(16))[19]),
    true
  );

  return problems;
};

const selfTestProblems = selfTest();
if (selfTestProblems.length > 0) {
  console.error("check:client-attempt-contract FAILED (the guard's own logic is broken)\n");
  for (const problem of selfTestProblems) console.error(`  - ${problem}\n`);
  process.exit(1);
}

// ------------------------------------------------------------------- the source

const screen = stripComments(read(SCREEN));
const pairs = scanBraces(screen);
const closeOf = new Map(pairs.map((pair) => [pair.open, pair.close]));

const payloadObjectAfter = (from, limit) => {
  const marker = "JSON.stringify(";
  const at = screen.indexOf(marker, from);
  if (at === -1 || at > limit) return null;
  const rest = screen.slice(at + marker.length);

  const inline = /^\s*\{/.exec(rest);
  if (inline) {
    const brace = at + marker.length + inline[0].length - 1;
    return closeOf.has(brace) ? screen.slice(brace, closeOf.get(brace) + 1) : null;
  }
  // A payload built as a named object just before the fetch is a legitimate
  // refactor, so the identifier is resolved to its declaration.
  const named = /^\s*([A-Za-z_$][\w$]*)\s*\)/.exec(rest);
  if (!named) return null;
  const declaration = new RegExp(
    `(?:const|let|var)\\s+${named[1]}\\s*(?::[^=;]*)?=\\s*\\{`
  ).exec(screen);
  if (!declaration) return null;
  const brace = screen.indexOf("{", declaration.index);
  return closeOf.has(brace) ? screen.slice(brace, closeOf.get(brace) + 1) : null;
};

// ------------------------------------------- 1. the paths, one source of truth
// The first version tested the URL by PREFIX and the file on a separately
// hardcoded constant, so "/api/training/session/end-v2" stayed green while
// shipping a 404: the two halves of the rule no longer spoke of the same path.
// Now every training path this client fetches is resolved to the route file it
// implies, and that file has to exist.
const fetchedPaths = [...screen.matchAll(/fetch\(\s*(["'`])([^"'`]+)\1/g)].map((match) => ({
  url: match[2],
  index: match.index,
}));

for (const entry of fetchedPaths.filter((candidate) =>
  candidate.url.startsWith("/api/training/")
)) {
  const routeFile = path.join("app", entry.url, "route.ts");
  if (!fs.existsSync(path.join(ROOT, routeFile))) {
    failures.push(
      `${SCREEN}: fetches ${entry.url}, which resolves to ${routeFile}, and that file does not exist. The client would ship a 404 into history. The URL and the route file are one rule here on purpose: testing the URL by prefix and the file against a separate constant let end-v2 pass.`
    );
  }
}

const startEntry = fetchedPaths.find((entry) => entry.url === "/api/training/session/start");
const endEntry = fetchedPaths.find((entry) => entry.url === "/api/training/session/end");

if (!startEntry) {
  failures.push(
    `${SCREEN}: no fetch of exactly "/api/training/session/start". Every rule about minting and sending the identifier hangs off that call.`
  );
}
if (!endEntry) {
  failures.push(
    `${SCREEN}: no fetch of exactly "/api/training/session/end". A training session has no round cap any more, so it stays active for ever unless the client really calls the end path, not merely mentions it in a comment.`
  );
}
if (endEntry) {
  const endRouteFile = path.join("app", endEntry.url, "route.ts");
  if (fs.existsSync(path.join(ROOT, endRouteFile))) {
    const endRoute = stripComments(read(endRouteFile));
    if (!/export\s+(?:async\s+)?function\s+POST|export\s+const\s+POST\s*=/.test(endRoute)) {
      failures.push(
        `${endRouteFile} exports no POST handler, and ${SCREEN} posts to it. The close would answer 405 and every session would stay open.`
      );
    }
    if (!/endTrainingSession/.test(endRoute)) {
      failures.push(
        `${endRouteFile} never calls endTrainingSession, so nothing closes the session row. The screen would announce a close the database never saw.`
      );
    }
  }
}

// ------------------------------------- 2. client generator against server rules
// Cross-file and executed, not eyeballed: the pattern is lifted out of
// contracts.ts and run against real crypto.randomUUID output and against the
// documented byte fallback.
let serverPattern = null;
try {
  const contracts = stripComments(read(CONTRACTS));
  const literal = contracts.match(
    /ATTEMPT_ID_PATTERN\s*(?::[^=]*)?=\s*(\/(?:[^/\\\n]|\\.)+\/[a-z]*)/
  );
  if (!literal) {
    failures.push(
      `${CONTRACTS}: no ATTEMPT_ID_PATTERN regex literal found. That pattern is the only thing that decides whether the identifier this client mints is usable, and an identifier it rejects is dropped without any error.`
    );
  } else {
    const body = literal[1].slice(1, literal[1].lastIndexOf("/"));
    const flags = literal[1].slice(literal[1].lastIndexOf("/") + 1);
    serverPattern = new RegExp(body, flags);
  }
} catch (error) {
  failures.push(`${CONTRACTS}: could not be read to check the identifier shape: ${error.message}`);
}

if (serverPattern) {
  const rejectedRandomUUID = [];
  for (let draw = 0; draw < 64; draw += 1) {
    const candidate = crypto.randomUUID();
    if (!serverPattern.test(candidate)) rejectedRandomUUID.push(candidate);
  }
  if (rejectedRandomUUID.length > 0) {
    failures.push(
      `${CONTRACTS}: ATTEMPT_ID_PATTERN refuses crypto.randomUUID output (for example ${rejectedRandomUUID[0]}), which is what ${SCREEN} mints. A refused identifier is not an error: the server mints its own, the response stays valid, and a reload opens a second session with nothing to say why.`
    );
  }
  const rejectedFallback = [];
  for (let draw = 0; draw < 64; draw += 1) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const candidate = v4FromBytes(bytes);
    if (!serverPattern.test(candidate)) rejectedFallback.push(candidate);
  }
  if (rejectedFallback.length > 0) {
    failures.push(
      `${CONTRACTS}: ATTEMPT_ID_PATTERN refuses the version 4 shape the client's getRandomValues fallback builds (for example ${rejectedFallback[0]}). Outside a secure context that fallback is the only generator the client has.`
    );
  }
}

// -------------------------------------------------------- 3. locate the players
// Every later rule hangs off these, all found by what they DO, never by a name.
const randomValuesAt = screen.indexOf("getRandomValues");
let mintBlock = null;
let mintName = null;
if (randomValuesAt === -1) {
  failures.push(
    `${SCREEN}: no getRandomValues fallback for the identifier. crypto.randomUUID is undefined outside a secure context, so testing on a device over a local IP throws on the very first render.`
  );
} else {
  mintBlock = enclosingFunction(screen, pairs, randomValuesAt);
  if (!mintBlock) {
    failures.push(`${SCREEN}: getRandomValues is not inside a function this guard can slice.`);
  } else {
    mintName = declaredName(screen, mintBlock.open);
  }
}

const setItemSites = [...screen.matchAll(/(?:window\.)?sessionStorage\.setItem\s*\(/g)].map(
  (match) => match.index
);
const getItemSites = [...screen.matchAll(/(?:window\.)?sessionStorage\.getItem\s*\(/g)].map(
  (match) => match.index
);
const removeItemSites = [...screen.matchAll(/(?:window\.)?sessionStorage\.removeItem\s*\(/g)].map(
  (match) => match.index
);

const keyOf = (at) => {
  const args = parenRegionAfter(screen, at);
  if (!args) return null;
  return splitTopLevel(args.text)[0]?.trim() ?? null;
};

// WHOLE FILE, deliberately: this is a rule about every storage access in the
// file, so it cannot be scoped to one function. It reads ALL occurrences, where
// the previous version read only the first one of each.
const allKeys = [...setItemSites, ...getItemSites, ...removeItemSites].map(keyOf);
if (getItemSites.length === 0 || setItemSites.length === 0) {
  failures.push(
    `${SCREEN}: the attempt identifier is not both read from and written to sessionStorage. Minting it on the response loses it whenever a reload aborts the call in flight.`
  );
}
if (removeItemSites.length === 0) {
  failures.push(
    `${SCREEN}: nothing ever releases the stored attempt identifier. A closed session must let its identifier go, or the next start replays an identifier whose session is already closed.`
  );
}
const badKeys = allKeys.filter((key) => !key || !/^[A-Za-z_$][\w$]*$/.test(key));
const namedKeys = allKeys.filter((key) => key && /^[A-Za-z_$][\w$]*$/.test(key));
if (badKeys.length > 0) {
  failures.push(
    `${SCREEN}: a sessionStorage access uses something other than a named key constant (${badKeys.join(", ")}). A literal repeated at each call site drifts, and a drifted key means the reload never finds what the load stored.`
  );
} else if (new Set(namedKeys).size > 1) {
  failures.push(
    `${SCREEN}: sessionStorage is accessed under more than one key (${[...new Set(namedKeys)].join(", ")}). Written under one and read under another, the reload would never find what the first load stored and every load would look like a new attempt.`
  );
}

// The mint path is the storing function that also mints. The other writer is the
// reconciliation, which stores what the SERVER settled on.
const storeSite = setItemSites.find((at) => {
  const block = enclosingFunction(screen, pairs, at);
  if (!block || !mintName) return false;
  return new RegExp(`\\b${mintName}\\s*\\(`).test(screen.slice(block.open, block.close));
});
const storeBlock = storeSite === undefined ? null : enclosingFunction(screen, pairs, storeSite);
const storeName = storeBlock ? declaredName(screen, storeBlock.open) : null;

const adoptSite = setItemSites.find((at) => at !== storeSite);
const adoptBlock = adoptSite === undefined ? null : enclosingFunction(screen, pairs, adoptSite);
const adoptName = adoptBlock ? declaredName(screen, adoptBlock.open) : null;

const dropBlock =
  removeItemSites.length > 0 ? enclosingFunction(screen, pairs, removeItemSites[0]) : null;
const dropName = dropBlock ? declaredName(screen, dropBlock.open) : null;

const startBlock = startEntry ? enclosingFunction(screen, pairs, startEntry.index) : null;
const startName = startBlock ? declaredName(screen, startBlock.open) : null;
const endBlock = endEntry ? enclosingFunction(screen, pairs, endEntry.index) : null;

// ----------------------------------------------------- 4. the generator itself
if (mintBlock && mintName) {
  const mintBody = screen.slice(mintBlock.open, mintBlock.close);

  if (!/crypto\.randomUUID\s*\(/.test(mintBody)) {
    failures.push(
      `${SCREEN}: the identifier is no longer minted by crypto.randomUUID. The server pattern accepts versions 1 to 5 only, so another generator (a uuidv7, or anything home made) is refused in silence: the server mints its own, nothing is logged, and the reload opens a second session again.`
    );
  }
  if (/\bDate\.now\s*\(|\buuidv?7\b/i.test(mintBody)) {
    failures.push(
      `${SCREEN}: ${mintName} looks time ordered (a uuidv7 marker). Its version nibble would be 7, which the server pattern refuses in silence.`
    );
  }

  // EXECUTED, not eyeballed. Every static rule recognises a shape someone thought
  // of; running the generator proves what it emits, whatever it looks like. It is
  // extracted from this file, so it also pins the generator as self-contained,
  // the same constraint check-day-keys.mjs puts on lib/profile/day-keys.ts.
  if (serverPattern) {
    const from = declarationStart(screen, mintBlock.open, mintName);
    const source = screen.slice(from, mintBlock.close + 1);
    const asJs = source
      .replace(/\)\s*:\s*[^={;]*=>/g, ") =>")
      .replace(/\)\s*:\s*[A-Za-z_$][\w$<>[\].|\s]*\{/g, ") {")
      .replace(/\bas\s+(?:const|[A-Za-z_$][\w$<>[\].|\s]*)/g, "")
      .replace(/:\s*(?:string|number|boolean|Uint8Array)\b(?!\s*\()/g, "");

    let factory = null;
    try {
      // `crypto` as a parameter shadows the global inside the extracted function,
      // which is what lets the fallback branch be exercised.
      factory = new Function("crypto", `${asJs}\nreturn ${mintName};`);
    } catch (error) {
      failures.push(
        `${SCREEN}: the identifier generator can no longer be executed by this guard (${error.message}). It has to stay a self-contained function with no import and no module-level dependency, because running it is the only way to prove the shape the server will accept: a refused identifier raises nothing anywhere.`
      );
    }

    if (factory) {
      const runs = [
        { label: "with crypto.randomUUID", scope: globalThis.crypto },
        {
          label: "on the getRandomValues fallback, as in any non secure context",
          scope: { getRandomValues: (bytes) => globalThis.crypto.getRandomValues(bytes) },
        },
      ];
      for (const run of runs) {
        let mint = null;
        try {
          mint = factory(run.scope);
        } catch (error) {
          failures.push(
            `${SCREEN}: the identifier generator could not be built ${run.label}: ${error.message}`
          );
          continue;
        }
        const seen = new Set();
        let rejected = null;
        let repeated = null;
        try {
          for (let draw = 0; draw < 200 && rejected === null && repeated === null; draw += 1) {
            const identifier = mint();
            if (typeof identifier !== "string" || !serverPattern.test(identifier)) {
              rejected = identifier;
            } else if (seen.has(identifier)) {
              repeated = identifier;
            }
            seen.add(identifier);
          }
        } catch (error) {
          failures.push(
            `${SCREEN}: the identifier generator throws ${run.label}: ${error.message}. crypto.randomUUID is undefined outside a secure context, so this is what a phone on the dev server over a local IP would hit on the first render.`
          );
          continue;
        }
        if (rejected !== null) {
          failures.push(
            `${SCREEN}: the identifier generator emits ${JSON.stringify(rejected)} ${run.label}, which ATTEMPT_ID_PATTERN refuses. The server would drop it without a word, mint its own, and the reload would open a second session again.`
          );
        }
        if (repeated !== null) {
          failures.push(
            `${SCREEN}: the identifier generator repeats itself (${repeated}) ${run.label}. Two players, or two attempts, would land on one session row.`
          );
        }
      }
    }
  }
}

// WHOLE FILE: an import can only be judged against the whole module.
if (/from\s*["']uuid["']|require\(\s*["']uuid["']\s*\)/.test(screen)) {
  failures.push(
    `${SCREEN}: imports a uuid library. The generator is pinned to crypto.randomUUID because it emits version 4, the only family the server pattern accepts, and a library default may not.`
  );
}

// ------------------------------- 5. the value chain, mint to storage to payload
// This is the section the review broke six times. It no longer asks whether calls
// exist and appear in the right order: it follows the SYMBOL that carries the
// identifier, from the generator's return to the request body.
let mintSymbol = null;
let freshParam = null;

if (!storeBlock || !storeName) {
  if (mintName && setItemSites.length > 0) {
    failures.push(
      `${SCREEN}: no single function both mints the identifier and persists it. Persisting anywhere else than at mint time is a persist that can be skipped, and the reload then has nothing to replay.`
    );
  }
} else {
  const storeBody = screen.slice(storeBlock.open, storeBlock.close);
  const signature = screen.slice(Math.max(0, storeBlock.open - 300), storeBlock.open);
  const params = /\{([^}]*)\}/.exec(signature);
  freshParam = params ? entriesOf(`{${params[1]}}`)[0]?.key ?? null : null;

  if (/\bDate\.now\s*\(|\buuidv?7\b/i.test(storeBody)) {
    failures.push(
      `${SCREEN}: ${storeName} looks like it builds a time ordered identifier of its own. A String(Date.now()) stored here is refused in silence by the server, and the real generator staying intact next door hides it completely.`
    );
  }

  // 5a. the read decides, and the fresh flag is what it acts on.
  const getAt = getItemSites.find((at) => at > storeBlock.open && at < storeBlock.close);
  if (getAt === undefined) {
    failures.push(
      `${SCREEN}: ${storeName} writes the identifier without reading the stored one. The write must be conditional on what is already there, or a retry overwrites the attempt it is retrying.`
    );
  } else {
    const readStatement = statementAround(screen, getAt);
    const readInto = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(readStatement);
    if (!readInto) {
      failures.push(
        `${SCREEN}: ${storeName} does not keep what it read from sessionStorage. The stored identifier has to become the returned value, otherwise the read is decoration and every load mints a new attempt.`
      );
    } else {
      const replay = new RegExp(`return\\s+${readInto[1]}\\s*;`).exec(storeBody);
      if (!returnsExactly(storeBody, readInto[1])) {
        failures.push(
          `${SCREEN}: ${storeName} never returns ${readInto[1]} itself, the value it read from storage. Returning something derived from it (a slice, a rewrite) sends an identifier the storage does not hold, so the reload replays a value the server never saw.`
        );
      } else if (replay && storeSite !== undefined && replay.index > storeSite - storeBlock.open) {
        failures.push(
          `${SCREEN}: ${storeName} returns the stored identifier only after overwriting it, so the stored value is lost before it can be replayed.`
        );
      }
    }
    if (freshParam && !new RegExp(`\\b${freshParam}\\b`).test(readStatement)) {
      failures.push(
        `${SCREEN}: the read in ${storeName} does not depend on ${freshParam} (statement: ${readStatement}). Only the fresh flag may bypass the stored identifier; a read hard-wired to skip it, or to always take it, makes the flag decorative.`
      );
    }
  }

  // 5b. the persisted value IS the minted value, unconditionally, immediately.
  const mintDecl = mintName
    ? new RegExp(
        `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=;]*)?=\\s*${mintName}\\s*\\(`
      ).exec(storeBody)
    : null;
  if (!mintDecl) {
    failures.push(
      `${SCREEN}: ${storeName} never binds the minted identifier to a name (const x = ${mintName ?? "mint"}()). The guard follows that symbol to prove the value stored is the value sent, and without it a store can persist one identifier and return another.`
    );
  } else {
    mintSymbol = mintDecl[1];
    const setArgs = storeSite === undefined ? null : parenRegionAfter(screen, storeSite);
    const stored = setArgs ? splitTopLevel(setArgs.text)[1]?.trim() ?? null : null;
    if (stored !== mintSymbol) {
      failures.push(
        `${SCREEN}: ${storeName} persists ${stored ?? "nothing recognisable"} while it minted ${mintSymbol}. The value stored must be the very symbol that was minted and returned, or the load sends one identifier and stores another, and the reload opens a second session.`
      );
    }
    if (!returnsExactly(storeBody, mintSymbol)) {
      failures.push(
        `${SCREEN}: ${storeName} does not return ${mintSymbol} itself. Returning something derived from it, a slice or a rewrite, means the caller sends an identifier that is not the one just persisted, and the reload opens a second session.`
      );
    }
    if (storeSite !== undefined) {
      const persistStatement = statementAround(screen, storeSite);
      if (!/^(?:void\s+)?(?:window\.)?sessionStorage\.setItem\b/.test(persistStatement)) {
        failures.push(
          `${SCREEN}: the persist in ${storeName} is not a plain statement (${persistStatement.slice(0, 90)}). Guarded by a condition, or deferred inside a callback or a timer, the identifier does not exist during the in-flight window, which is the only window this contract exists for.`
        );
      }
      if (depthAt(pairs, storeSite) !== depthAt(pairs, storeBlock.open + mintDecl.index)) {
        failures.push(
          `${SCREEN}: the persist in ${storeName} sits at a different nesting level than the mint. It has to be on the same unconditional path, not inside a branch, a callback or a setTimeout.`
        );
      }
    }
  }
}

// The reconciliation writer stores the server's value, so what it persists must be
// its own parameter and never a fresh mint.
if (adoptBlock && adoptName) {
  const adoptBody = screen.slice(adoptBlock.open, adoptBlock.close);
  const adoptSignature = screen.slice(Math.max(0, adoptBlock.open - 200), adoptBlock.open);
  const adoptParams = parenRegionAfter(adoptSignature, 0);
  const adoptParam = adoptParams
    ? /([A-Za-z_$][\w$]*)/.exec(splitTopLevel(adoptParams.text)[0] ?? "")?.[1] ?? null
    : null;
  const args = adoptSite === undefined ? null : parenRegionAfter(screen, adoptSite);
  const written = args ? splitTopLevel(args.text)[1]?.trim() ?? null : null;
  if (adoptParam && written !== adoptParam) {
    failures.push(
      `${SCREEN}: ${adoptName} persists ${written ?? "nothing recognisable"} instead of its parameter ${adoptParam}. Reconciliation exists to store what the SERVER settled on; storing anything else leaves this tab replaying an identifier the server cannot rejoin.`
    );
  }
  if (mintName && new RegExp(`\\b${mintName}\\s*\\(`).test(adoptBody)) {
    failures.push(
      `${SCREEN}: ${adoptName} mints instead of adopting. The point of that function is to keep the identifier the server chose.`
    );
  }
}

// ------------------------------------------------------------ 6. the start path
let sentSymbol = null;
if (startBlock && startName && startEntry) {
  const fetchAt = startEntry.index;
  const beforeFetch = screen.slice(startBlock.open, fetchAt);
  const wholeStart = screen.slice(startBlock.open, startBlock.close);
  const signature = screen.slice(Math.max(0, startBlock.open - 300), startBlock.open);
  const fetchParen = parenRegionAfter(screen, fetchAt);
  const afterFetch = fetchParen ? screen.slice(fetchParen.close, startBlock.close) : "";

  // 6a. the identifier comes from the storing function, before the request.
  const sentDecl = storeName
    ? new RegExp(
        `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=;]*)?=\\s*${storeName}\\s*\\(`
      ).exec(beforeFetch)
    : null;
  if (!sentDecl) {
    failures.push(
      `${SCREEN}: ${startName} does not bind the identifier from ${storeName ?? "the storing function"} before the request leaves. Minting on the response loses it in exactly the case that creates the duplicate: a reload aborts the call, nothing is stored here, and the server has already written its row.`
    );
  } else {
    sentSymbol = sentDecl[1];
    const handOver = parenRegionAfter(beforeFetch, sentDecl.index);
    const freshEntry = handOver
      ? entriesOf(handOver.text).find((entry) => entry.key === "fresh" || entry.key === freshParam)
      : null;
    if (!freshEntry) {
      failures.push(
        `${SCREEN}: the fresh flag never reaches ${storeName}. Without it, Play again silently continues the previous attempt and a retry cannot be told from a new attempt.`
      );
    } else if (freshEntry.value !== null && !/^[A-Za-z_$][\w$]*$/.test(freshEntry.value)) {
      failures.push(
        `${SCREEN}: the call to ${storeName} passes fresh as ${freshEntry.value} instead of the parameter itself. An expression there can invert or constant-fold the meaning (!fresh, fresh && false, a literal) and no static rule can tell a harmless wrapper from an inversion, so the pass-through has to be the parameter.`
      );
    }
  }

  // 6b. and it is that symbol, not another, that the payload carries.
  const sentBody = payloadObjectAfter(fetchAt, startBlock.close);
  if (!sentBody) {
    failures.push(`${SCREEN}: the start request has no JSON.stringify payload this guard can read.`);
  } else {
    const entry = entriesOf(sentBody).find((candidate) => candidate.key === "attemptId");
    if (!entry) {
      failures.push(
        `${SCREEN}: the start request payload carries no attemptId. The server then mints its own and every reload opens a new session, which is the bug this contract closes.`
      );
    } else if (sentSymbol) {
      const carried = entry.value === null ? entry.key : entry.value;
      if (carried !== sentSymbol) {
        failures.push(
          `${SCREEN}: the start payload sends ${carried} while the identifier obtained from ${storeName} is ${sentSymbol}. Sending anything else, an alias minted on the spot for instance, means the value stored is never the value sent and the reload opens a second session.`
        );
      }
    }
  }

  // 6c. the re-entrance guard: tested, THEN closed, both before the request, and
  // released in a finally so a failed start does not latch it for ever.
  const guard = findReentranceGuard(screen, startBlock.open, fetchAt);
  if (!guard) {
    failures.push(
      `${SCREEN}: ${startName} has no synchronous re-entrance guard reading a ref before the request. disabled={isLoading} only becomes true on the next render, so a fast double click, or a mount effect that runs twice, fires two starts.`
    );
  } else {
    const refName = guard.refName;
    const setTrue = new RegExp(`${refName}\\.current\\s*=\\s*true`).exec(beforeFetch);
    if (!setTrue) {
      failures.push(
        `${SCREEN}: ${refName} is tested before the start request but never closed before it. A guard that closes after the await guards nothing.`
      );
    } else {
      const setTrueAt = startBlock.open + setTrue.index;
      if (setTrueAt < guard.index) {
        failures.push(
          `${SCREEN}: ${refName} is closed before it is tested, so the test can never pass and no session would ever start.`
        );
      } else if (/\bawait\b/.test(screen.slice(guard.index, setTrueAt))) {
        failures.push(
          `${SCREEN}: ${refName} is closed only after an await, so the test and the closing are no longer one synchronous step. Two callers can both pass the test before either closes it, which is the race this ref exists to stop.`
        );
      }
    }
    const release = new RegExp(`${refName}\\.current\\s*=\\s*false`).exec(wholeStart);
    if (!release) {
      failures.push(
        `${SCREEN}: ${refName} is never released inside ${startName}. The first call would latch the guard for ever and Retry session would be dead.`
      );
    } else {
      const finallyBody = finallyBodyOf(screen, closeOf, startBlock.open, startBlock.close);
      const releaseAt = startBlock.open + release.index;
      if (!finallyBody || releaseAt < finallyBody.open || releaseAt > finallyBody.close) {
        failures.push(
          `${SCREEN}: ${refName} is released outside the finally of ${startName}. On the success path only, one failed start latches the guard for ever and Retry session is dead; released before the response is read, the re-entrance window reopens.`
        );
      }
    }
    if (!new RegExp(`const\\s+${refName}\\s*=\\s*useRef`).test(screen)) {
      failures.push(
        `${SCREEN}: ${refName} is not a useRef. A value that lives in state is only readable on the next render, which is exactly what lets the second call through.`
      );
    }
  }

  // 6d. reconciliation. The server cannot always rejoin what we sent: it then
  // mints its own and answers with a new session. Keeping ours would leave this
  // tab sending, for ever, an identifier the server can never rejoin, so every
  // reload would open a new session from the first inactivity sweep onwards.
  if (sentSymbol) {
    const compared = new RegExp(
      `(?:\\b${sentSymbol}\\b\\s*!==\\s*[\\w$.]*\\bsessionId\\b|[\\w$.]*\\bsessionId\\b\\s*!==\\s*\\b${sentSymbol}\\b)`
    ).exec(afterFetch);
    if (!compared) {
      failures.push(
        `${SCREEN}: ${startName} never compares the identifier it sent with the sessionId the server returned. When the server could not rejoin ours (session swept for inactivity, closed, or owned by another player) it mints its own, and a client that keeps the old value then sends an identifier the server can never rejoin: every later reload opens a new session, permanently.`
      );
    } else if (!adoptName) {
      failures.push(
        `${SCREEN}: nothing adopts the sessionId the server returned. The comparison is pointless unless the returned identifier is written to storage.`
      );
    } else {
      const adopted = new RegExp(`\\b${adoptName}\\s*\\(`).exec(afterFetch);
      if (!adopted) {
        failures.push(
          `${SCREEN}: ${adoptName} is never called after the start response, so the identifier the server settled on is never stored.`
        );
      } else if (adopted.index < compared.index) {
        failures.push(
          `${SCREEN}: the server identifier is adopted before it is compared with the one that was sent.`
        );
      } else {
        // And it must adopt the SERVER's value. Handing it our own identifier
        // back is a no-op that passes every rule about calls and order.
        const args = parenRegionAfter(afterFetch, adopted.index);
        const handed = args ? args.text.trim() : "";
        if (!/\bsessionId\b/.test(handed) || handed === sentSymbol) {
          failures.push(
            `${SCREEN}: ${adoptName} is handed ${handed || "nothing"} instead of the sessionId the server returned. Adopting our own identifier back is a no-op: this tab would keep sending a value the server cannot rejoin, and every later reload would open a new session.`
          );
        }
      }
    }
  }

  // 6e. releasing the identifier belongs to the close, nowhere else.
  if (dropName && new RegExp(`\\b${dropName}\\s*\\(`).test(wholeStart)) {
    failures.push(
      `${SCREEN}: ${startName} calls ${dropName}. A failed start must KEEP the identifier: the server may already have written its row, so releasing it there makes the next attempt open a second session.`
    );
  }

  // 6f. the parameter that tells a retry from a new attempt.
  if (!/\bfresh\b/.test(signature)) {
    failures.push(
      `${SCREEN}: ${startName} takes no fresh parameter. A retry is the same attempt and must replay its identifier, while Play again is a new attempt and must mint one, so the two callers cannot share an argument-less function.`
    );
  }
}

// WHOLE FILE, and it has to be: these are call sites spread through the JSX.
if (startName) {
  const callSites = [...screen.matchAll(new RegExp(`\\b${startName}\\s*\\(`, "g"))].map(
    (match) => match.index
  );
  let sawPlain = false;
  let sawFresh = false;
  for (const at of callSites) {
    const args = parenRegionAfter(screen, at);
    if (!args) continue;
    if (args.text.trim() === "") {
      sawPlain = true;
      continue;
    }
    const entry = entriesOf(args.text).find((candidate) => candidate.key === "fresh");
    // Any value but the literal false asks for a new attempt. An expression is
    // legitimate here, unlike the pass-through into the storing function: this
    // call site decides, it does not forward a decision already taken.
    if (entry && entry.value !== "false") sawFresh = true;
  }
  if (!sawFresh) {
    failures.push(
      `${SCREEN}: no caller asks ${startName} for a fresh attempt. Play again must mint a new identifier, otherwise it rejoins the session the player just closed.`
    );
  }
  if (!sawPlain) {
    failures.push(
      `${SCREEN}: nothing calls ${startName} without arguments any more. The mount effect and Retry session are both the same attempt and must replay its identifier.`
    );
  }
  const twin = new RegExp(
    `onClick=\\{\\(\\) => void ${startName}\\(\\)\\}[\\s\\S]*onClick=\\{\\(\\) => void ${startName}\\(\\)\\}`
  );
  if (twin.test(screen)) {
    failures.push(
      `${SCREEN}: "Retry session" and "Play again" still call the same argument-less ${startName}. One is a retry on the same attempt, the other is a new attempt.`
    );
  }
}

// ------------------------------------------------- 7. out of every dependency
// WHOLE FILE by nature: a dependency array can sit in any hook of the component.
// Anchored on the shape of a hook call, `}, [ ... ]`, NOT on any bracket pair
// containing the substring: the loose form /\[[^\]]*attemptId[^\]]*\]/ matches a
// destructuring and any array mentioning attemptIdRef, so it would fire on
// correct code.
if (/\}\s*,\s*\[[^\]]*attemptId/.test(screen)) {
  failures.push(
    `${SCREEN}: attemptId entered a React dependency array. The mount effect would re-run on every answer and restart the session.`
  );
}
if (/,\s*\[[^\]]*\battemptId\b[^\]]*\]\s*\)/.test(screen)) {
  failures.push(
    `${SCREEN}: attemptId is the last argument of a hook call, so it is a dependency. Every change of the identifier would re-run that hook, and for the mount effect that means restarting the session.`
  );
}
if (/\[\s*attemptId\s*,\s*set[A-Za-z_$][\w$]*\s*\]\s*=\s*useState/.test(screen)) {
  failures.push(
    `${SCREEN}: the attempt identifier became React state. State dies with the reload that has to replay it, and it drags the mount effect along on every change.`
  );
}

// -------------------------------------------------------------- 8. the close
if (endBlock && endEntry) {
  const endAt = endEntry.index;
  const endBody = screen.slice(endBlock.open, endBlock.close);
  const endName = declaredName(screen, endBlock.open) ?? "the closing function";
  const fetchRel = endAt - endBlock.open;
  const sentBody = payloadObjectAfter(endAt, endBlock.close);

  if (!sentBody || !entriesOf(sentBody).some((entry) => entry.key === "sessionId")) {
    failures.push(
      `${SCREEN}: the end request carries no sessionId. That is the only thing the route needs from the body.`
    );
  }
  if (sentBody && entriesOf(sentBody).some((entry) => entry.key === "userId")) {
    failures.push(
      `${SCREEN}: the end request declares a userId. Identity comes from the httpOnly guest cookie, and the route refuses a body that disagrees with it, so sending one can only turn a working close into a 403.`
    );
  }

  // 8a. a refused close must STOP. Presence of a .ok test proves nothing: the
  // review replaced the throw with a console.error and everything downstream ran
  // anyway, which is word for word what this message used to claim to forbid.
  let shortCircuits = false;
  let checkedAt = fetchRel;
  for (const match of endBody.matchAll(/\bif\s*\(/g)) {
    const condition = parenRegionAfter(endBody, match.index);
    if (!condition || condition.open < fetchRel) continue;
    if (!/!\s*[A-Za-z_$][\w$]*\.ok\b|\.ok\s*===\s*false/.test(condition.text)) continue;
    const tail = endBody.slice(condition.close + 1);
    let branch = tail.slice(0, Math.max(0, tail.indexOf(";") + 1));
    let branchEnd = condition.close + 1 + Math.max(0, tail.indexOf(";") + 1);
    if (/^\s*\{/.test(tail)) {
      const brace = endBlock.open + condition.close + 1 + tail.indexOf("{");
      if (closeOf.has(brace)) {
        branch = screen.slice(brace, closeOf.get(brace));
        branchEnd = closeOf.get(brace) - endBlock.open;
      } else {
        branch = tail.slice(0, 200);
      }
    }
    if (/\b(?:throw|return)\b/.test(branch)) {
      shortCircuits = true;
      // Everything that follows from a confirmed close has to sit AFTER this
      // branch, not merely after the fetch.
      checkedAt = Math.max(checkedAt, branchEnd);
    }
  }
  if (!shortCircuits) {
    failures.push(
      `${SCREEN}: a refused close is not short-circuited in ${endName}. The response has to be tested AND the failure has to throw or return: logging it and carrying on announces a closed session the server refused, and releases the identifier of a session that is still open.`
    );
  }

  const completeAt = endBody.indexOf("setIsComplete(true)");
  if (completeAt === -1) {
    failures.push(
      `${SCREEN}: setIsComplete(true) is not called by ${endName}, so the "Session complete" branch and the "Play again" block stay unreachable.`
    );
  } else if (completeAt < checkedAt) {
    failures.push(
      `${SCREEN}: setIsComplete(true) runs before the refused-close branch in ${endName}. The screen would announce a closed session the server may have refused.`
    );
  }

  // 8b. the identifier is released here, after the request, and only here.
  if (dropName) {
    const dropCalls = [...screen.matchAll(new RegExp(`\\b${dropName}\\s*\\(`, "g"))].map(
      (match) => match.index
    );
    const insideEnd = dropCalls.filter((at) => at > endBlock.open && at < endBlock.close);
    if (insideEnd.length === 0) {
      failures.push(
        `${SCREEN}: ${endName} never releases the stored identifier. The next start would replay the identifier of a session that is already closed.`
      );
    } else if (insideEnd[0] - endBlock.open < checkedAt) {
      failures.push(
        `${SCREEN}: the stored identifier is released before the refused-close branch in ${endName}. Released between the request and the check, a refused close still lets it go: the session stays open and the next load opens a second one beside it.`
      );
    }
    const strays = dropCalls.filter((at) => at < endBlock.open || at > endBlock.close);
    if (strays.length > 0) {
      failures.push(
        `${SCREEN}: ${dropName} is called from ${strays.length} place(s) outside ${endName}. Releasing the identifier anywhere but after a confirmed close reopens the duplicate, since the server may already hold a row for it.`
      );
    }
  }

  // 8c. the close has its own re-entrance guard, released in its own finally.
  const endGuard = findReentranceGuard(screen, endBlock.open, endAt);
  if (!endGuard) {
    failures.push(
      `${SCREEN}: ${endName} has no synchronous re-entrance guard. The route is idempotent, so a double click is survivable, but this guard is part of what the task delivered and nothing should let it disappear silently.`
    );
  } else {
    const refName = endGuard.refName;
    const endSetTrue = new RegExp(`${refName}\\.current\\s*=\\s*true`).exec(
      endBody.slice(0, fetchRel)
    );
    if (!endSetTrue) {
      failures.push(
        `${SCREEN}: ${refName} is tested in ${endName} but never closed before the request.`
      );
    } else if (endBlock.open + endSetTrue.index < endGuard.index) {
      failures.push(
        `${SCREEN}: ${refName} is closed before it is tested in ${endName}, so the test can never pass and the session could never be closed.`
      );
    }
    const endFinally = finallyBodyOf(screen, closeOf, endBlock.open, endBlock.close);
    const endRelease = new RegExp(`${refName}\\.current\\s*=\\s*false`).exec(endBody);
    if (!endRelease) {
      failures.push(
        `${SCREEN}: ${refName} is never released in ${endName}, so the close would be one shot.`
      );
    } else {
      const releaseAt = endBlock.open + endRelease.index;
      if (!endFinally || releaseAt < endFinally.open || releaseAt > endFinally.close) {
        failures.push(
          `${SCREEN}: ${refName} is released outside the finally of ${endName}. A refused close would latch it and the button would stay dead.`
        );
      }
    }
  }

  // 8d. an optional gesture must not be able to take the game down. The render
  // gates the question, the options and the progress line on the start error
  // being null, so writing a refused close into that same state destroys the
  // question in progress. Measured in a browser by the review, not hypothetical.
  const catchSettersIn = (from, to) => {
    const region = screen.slice(from, to);
    const catchAt = /catch\s*(?:\([^)]*\))?\s*\{/.exec(region);
    if (!catchAt) return [];
    const brace = from + catchAt.index + catchAt[0].length - 1;
    if (!closeOf.has(brace)) return [];
    return [
      ...screen.slice(brace, closeOf.get(brace)).matchAll(/\b(set[A-Z][\w$]*)\s*\(/g),
    ].map((match) => match[1]);
  };
  const endSetters = catchSettersIn(endBlock.open, endBlock.close);
  const startSetters = startBlock ? catchSettersIn(startBlock.open, startBlock.close) : [];
  if (endSetters.length === 0) {
    failures.push(
      `${SCREEN}: a refused close reports nothing to the player in ${endName}. A silent failure on a button leaves the session open with no sign of it.`
    );
  }
  const shared = endSetters.filter((setter) => startSetters.includes(setter));
  if (shared.length > 0) {
    failures.push(
      `${SCREEN}: ${endName} writes ${shared.join(", ")}, the same error state the start path writes. The render gates the question, the options and the progress line on that state, so a 500 on an optional gesture would destroy the question in progress. Give the close its own non-blocking state.`
    );
  }
  for (const setter of endSetters) {
    const stateName = `${setter.slice(3, 4).toLowerCase()}${setter.slice(4)}`;
    if (!new RegExp(`\\b${stateName}\\b`).test(screen)) continue;
    if (new RegExp(`!\\s*${stateName}\\b`).test(screen)) {
      failures.push(
        `${SCREEN}: something gates on !${stateName}, the state a refused close writes. Closing is optional, so its failure must gate nothing at all.`
      );
    }
  }
}

// ----------------------------------------------------------------- report
if (failures.length > 0) {
  console.error("check:client-attempt-contract FAILED\n");
  for (const failure of failures) {
    console.error(`  - ${failure}\n`);
  }
  process.exit(1);
}

console.log(
  "check:client-attempt-contract OK : the generator is executed and its output accepted by the " +
    "server pattern in both branches; the minted symbol is the persisted symbol is the sent " +
    "symbol; the persist is unconditional and immediate; the read decides and depends on fresh; " +
    "the identifier the server settles on is adopted when it differs; re-entrance is tested then " +
    "closed synchronously and released in a finally, on both paths; a refused close " +
    "short-circuits, keeps the identifier and reports on its own non-blocking state; and every " +
    "training path fetched here resolves to a route file that exists."
);
