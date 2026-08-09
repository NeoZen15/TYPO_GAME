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
// concern call sites spread across the JSX, an import, or a module-level
// declaration, are marked WHOLE FILE where they sit, numbered, and there are
// EIGHTEEN of them: the count is the number of scans of the whole source, which is
// `grep -c "WHOLE FILE ("` expanded by the ranges those markers carry. Claiming an
// enumeration is complete without counting it is what the re-review caught here. The pure part of that machinery self-tests on synthetic lines
// before a single rule runs.
//
// This script is standalone: it guards features/game/components/GameScreen.tsx,
// plus the route files the paths in that client resolve to.

import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";

// The type eraser is flagged experimental by Node and prints a warning on first
// use. This guard is step 18 of the quality gate, and a gate that prints noise
// teaches people to skim its output, so the one warning it causes is dropped and
// nothing else is touched.
const emitWarning = process.emit.bind(process);
process.emit = (name, data, ...rest) => {
  if (
    name === "warning" &&
    data &&
    data.name === "ExperimentalWarning" &&
    /stripTypeScriptTypes/.test(String(data.message))
  ) {
    return false;
  }
  return emitWarning(name, data, ...rest);
};

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

// TypeScript erased by TypeScript's own eraser, never by regular expressions.
// The previous version used six substitutions, and one of them deleted a runtime
// object PROPERTY (`{ a: { b: 1 }, c: 0 }` became `{ a, c: 0 }`) because it could
// not tell a property from a type annotation. The extracted fragment then behaved
// differently from the application: the guard measured one identifier where the
// app produced two, and reported success on broken code. That was the only way
// this architecture could fail SILENTLY, so it is closed at the root.
const stripTypes = (source) => {
  if (typeof stripTypeScriptTypes !== "function") {
    throw new Error(
      "node:module stripTypeScriptTypes is unavailable, and this guard will not erase types by hand: a regular expression that deletes a runtime object property makes the measurement lie"
    );
  }
  return stripTypeScriptTypes(source, { mode: "strip" });
};

// The state setters a block writes, and the ones it writes from inside its first
// catch. Both are needed: the failure state of the start path is the one the close
// must never touch, and the close must be read WHOLE, since a reviewer put the
// forbidden setter in the `!response.ok` branch, before the catch the previous
// rule read.
const settersOf = (source, from, to) => [
  ...new Set(
    [...source.slice(from, to).matchAll(/\b(set[A-Z][\w$]*)\s*\(/g)].map((match) => match[1])
  ),
];

const catchSettersOf = (source, closeOf, block) => {
  const region = source.slice(block.open, block.close);
  const found = new Set();
  for (const match of region.matchAll(/catch\s*(?:\([^)]*\))?\s*\{/g)) {
    const brace = block.open + match.index + match[0].length - 1;
    if (!closeOf.has(brace)) continue;
    for (const setter of settersOf(source, brace, closeOf.get(brace))) found.add(setter);
  }
  return [...found];
};

// The parameter list of the function whose body opens at blockOpen, arrow or
// declaration, with or without a return annotation. Needed to EVALUATE what a
// call with no argument resolves to, rather than to recognise a default's
// spelling: `{ fresh = true }` is one word away from `{ fresh = false }` and no
// pattern about the presence of the word `fresh` can tell them apart.
const parameterListBefore = (source, blockOpen) => {
  let i = blockOpen - 1;
  const skipBack = () => {
    while (i >= 0 && /\s/.test(source[i])) i -= 1;
  };
  skipBack();
  if (source[i] === ">" && source[i - 1] === "=") {
    i -= 2;
    skipBack();
  }
  if (source[i] !== ")") {
    const close = source.lastIndexOf(")", i);
    if (close === -1) return null;
    i = close;
  }
  let depth = 0;
  for (let k = i; k >= 0; k -= 1) {
    if (source[k] === ")") depth += 1;
    else if (source[k] === "(") {
      depth -= 1;
      if (depth === 0) return { open: k, close: i, text: source.slice(k + 1, i) };
    }
  }
  return null;
};

// Every RENDER GATE of the file: a condition one of whose branches is JSX. Found
// by looking at what the branches START with, `(` or `<`, never at the operator or
// at a spelling. Two earlier versions of this rule were beaten precisely there:
// one greped `!closeError` and missed `closeError === null && ...`, the next looked
// only at the consequent and missed `closeError === null ? null : (`. A slice
// containing a brace or a semicolon is not a condition, it is a piece of something
// else, and is skipped.
const renderGates = (source, pairs) => {
  const gates = [];
  const firstNonSpace = (from, limit) => {
    let i = from;
    while (i < limit && /\s/.test(source[i])) i += 1;
    return i < limit ? source[i] : "";
  };
  const colonAfter = (from, limit) => {
    let depth = 0;
    for (let i = from; i < limit; i += 1) {
      const ch = source[i];
      if ("([{".includes(ch)) depth += 1;
      else if (")]}".includes(ch)) depth -= 1;
      else if (ch === ":" && depth === 0) return i + 1;
    }
    return -1;
  };
  for (const match of source.matchAll(/\?|&&/g)) {
    const at = match.index;
    if (
      source[at] === "?" &&
      (source[at + 1] === "?" || source[at + 1] === "." || source[at - 1] === "?")
    ) {
      continue;
    }
    const container = pairs
      .filter((pair) => pair.open < at && at < pair.close)
      .sort((a, b) => b.open - a.open)[0];
    if (!container) continue;
    const condition = source.slice(container.open + 1, at);
    if (condition.trim() === "" || condition.length > 400) continue;
    if (/[;{}]/.test(condition)) continue;

    const width = source[at] === "?" ? 1 : 2;
    const branches = [firstNonSpace(at + width, container.close)];
    if (source[at] === "?") {
      const alternate = colonAfter(at + 1, container.close);
      if (alternate !== -1) branches.push(firstNonSpace(alternate, container.close));
    }
    if (!branches.some((start) => start === "(" || start === "<")) continue;
    gates.push({ condition, at });
  }
  return gates;
};

const RESERVED = new Set([
  "null",
  "true",
  "false",
  "undefined",
  "typeof",
  "void",
  "return",
  "new",
  "in",
  "of",
  "Boolean",
  "String",
  "Number",
]);

// Identifiers a condition really depends on: property names after a dot do not
// count, literals and operators do not count.
const identifiersOf = (expression) =>
  new Set(
    [...expression.matchAll(/(\.?)([A-Za-z_$][\w$]*)/g)]
      .filter((match) => match[1] === "" && !RESERVED.has(match[2]))
      .map((match) => match[2])
  );

// The body of a `finally` clause, so a rule can require a release to live there
// rather than merely somewhere in the function.
const finallyBodyOf = (source, closeOf, from, to) => {
  const at = source.indexOf("finally", from);
  if (at === -1 || at > to) return null;
  const brace = source.indexOf("{", at);
  if (brace === -1 || !closeOf.has(brace)) return null;
  return { open: brace, close: closeOf.get(brace) };
};

// Does a `.ok` failure branch after the fetch actually STOP, by throwing or
// returning, and where does that branch end. Presence of a `.ok` test proves
// nothing: a reviewer replaced the throw with a console.error and everything
// downstream ran anyway. Shared by both request paths, because the previous
// version guarded the optional close and left the mandatory start without a rule.
const shortCircuitAfter = (source, closeOf, block, fetchAt, delegates = []) => {
  const body = source.slice(block.open, block.close);
  const fetchRel = fetchAt - block.open;
  let shortCircuits = false;
  let checkedAt = fetchRel;
  // A check factored into a helper that throws is the same check, and refusing it
  // made the guard demand duplicated code. The helper is identified by what it
  // does, `!something.ok` plus a throw, so its name is free.
  for (const name of delegates) {
    const call = new RegExp(`\\b${name}\\s*\\(`).exec(body.slice(fetchRel));
    if (!call) continue;
    shortCircuits = true;
    const args = parenRegionAfter(body, fetchRel + call.index);
    checkedAt = Math.max(checkedAt, args ? args.close + 1 : fetchRel + call.index);
  }
  for (const match of body.matchAll(/\bif\s*\(/g)) {
    const condition = parenRegionAfter(body, match.index);
    if (!condition || condition.open < fetchRel) continue;
    if (!/!\s*[A-Za-z_$][\w$]*\.ok\b|\.ok\s*===\s*false/.test(condition.text)) continue;
    // A condition carrying a boolean literal is a condition that decides nothing:
    // `if (!response.ok && false)` satisfied the old rule with a dead branch.
    if (/\b(?:true|false)\b/.test(condition.text)) {
      shortCircuits = false;
      break;
    }
    const tail = body.slice(condition.close + 1);
    let branch = tail.slice(0, Math.max(0, tail.indexOf(";") + 1));
    let branchEnd = condition.close + 1 + Math.max(0, tail.indexOf(";") + 1);
    if (/^\s*\{/.test(tail)) {
      const brace = block.open + condition.close + 1 + tail.indexOf("{");
      if (closeOf.has(brace)) {
        branch = source.slice(brace, closeOf.get(brace));
        branchEnd = closeOf.get(brace) - block.open;
      } else {
        branch = tail.slice(0, 200);
      }
    }
    if (/\b(?:throw|return)\b/.test(branch)) {
      shortCircuits = true;
      checkedAt = Math.max(checkedAt, branchEnd);
    }
  }
  return { shortCircuits, checkedAt };
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

  // The type eraser is TypeScript's own, so it is not re-tested here. What IS
  // tested is that it leaves runtime object properties alone, the exact failure of
  // the six regexes it replaces.
  expect(
    "a runtime object property survives type erasure",
    stripTypes("const p = { a: { b: 1 }, c: 0 };").includes("a: { b: 1 }"),
    true
  );
  expect(
    "a parameter annotation is erased",
    stripTypes("const t = ({ fresh }: { fresh: boolean }): string => fresh ? \"a\" : \"b\";").includes(
      "boolean"
    ),
    false
  );

  // parameterListBefore, on both function shapes.
  const arrowSample = "const f = async ({ fresh = false }: { x?: 1 } = {}) => {\n};";
  expect(
    "parameter list of an arrow found",
    parameterListBefore(arrowSample, arrowSample.indexOf("=> {") + 3)?.text,
    "{ fresh = false }: { x?: 1 } = {}"
  );
  const declSample = "function f({ fresh = false } = {}): string {\n}";
  expect(
    "parameter list of an annotated declaration found",
    parameterListBefore(declSample, declSample.indexOf("string {") + 7)?.text,
    "{ fresh = false } = {}"
  );

  // Gate conditions and their identifier sets: the rule that has to see a gate
  // whatever operator it is written with.
  const jsxSample = [
    "return (",
    "  <div>",
    "    {closeError === null && !error && ready ? (",
    "      <Question />",
    "    ) : null}",
    "    {closeError ? (<p>{closeError}</p>) : null}",
    '    {list.map((x) => (<i key={x} />))}',
    '    <p data-state={feedback?.kind ?? "idle"}>{feedback?.text ?? "x"}</p>',
    "  </div>",
    ");",
  ].join("\n");
  const jsxGates = renderGates(jsxSample, scanBraces(jsxSample)).map((gate) =>
    gate.condition.trim()
  );
  expect("compound gate found whatever its operator", jsxGates.includes("closeError === null && !error && ready"), true);
  expect(
    "an inverted gate whose JSX is in the alternate is still a gate",
    renderGates("<i>{a === null ? null : (<b />)}</i>", scanBraces("<i>{a === null ? null : (<b />)}</i>")).map(
      (gate) => gate.condition.trim()
    ),
    ["a === null"]
  );
  expect("bare gate found too", jsxGates.includes("closeError"), true);
  expect("optional chaining and nullish are not gates", jsxGates.some((c) => c.includes("??")), false);
  expect("a map callback is not a gate", jsxGates.some((c) => c.includes("list.map")), false);

  expect(
    "identifier set ignores property names and literals",
    [...identifiersOf("closeError === null && !error && progress.poolSize")].sort(),
    ["closeError", "error", "progress"]
  );
  expect(
    "identifier set of a bare truthiness test",
    [...identifiersOf("closeError ")],
    ["closeError"]
  );

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
  // WHOLE FILE (1 of 18): a payload object declared under a name is looked up in
  // the file, since the declaration can sit anywhere before the call.
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
// WHOLE FILE (2 of 18): every fetch of this file is enumerated, so each one can be
// resolved to the route file it implies.
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

// COUNT, do not take the first, and no new scan: both counts read the fetch
// enumeration above. A decoy POST to the
// start path, declared anywhere in this file and called from anywhere, adds a
// session row per page load, which is literally the bug this plan is named after,
// and every rule below would have evaluated the real function and passed. Reading
// only the first match also aimed nine messages at a decoy declared BEFORE the
// real one, sending the reader to fix the wrong function.
const startPathCalls = fetchedPaths.filter(
  (entry) => entry.url === "/api/training/session/start"
);
const endPathCalls = fetchedPaths.filter((entry) => entry.url === "/api/training/session/end");
if (startPathCalls.length > 1) {
  failures.push(
    `${SCREEN}: ${startPathCalls.length} calls to /api/training/session/start in this file. One page load must open one session, so exactly one place may start one. A second start writes a second session row per load, and if it sends no identifier the server mints its own and the convergence hardened by tasks 3 to 6 never runs.`
  );
}
if (endPathCalls.length > 1) {
  failures.push(
    `${SCREEN}: ${endPathCalls.length} calls to /api/training/session/end in this file. Exactly one place may close the session.`
  );
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

// WHOLE FILE (3, 4 and 5 of 18): the three storage access scans, reading ALL
// occurrences and not the first of each, which is what the first version did.
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

// A rule over the three scans above, deliberately whole file: it is about every
// storage access in the
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
// The one key, when there is exactly one, is what the executed layer reads back.
const keyName = new Set(namedKeys).size === 1 ? namedKeys[0] : null;

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

// Functions that exist to reject a bad response: `!something.ok` plus a throw.
// A path may delegate its short-circuit to one of these instead of writing it out.
const okDelegates = [...new Set(
  pairs
    .filter((pair) => {
      const body = screen.slice(pair.open, pair.close);
      return /!\s*[A-Za-z_$][\w$]*\.ok\b/.test(body) && /\bthrow\b/.test(body);
    })
    .map((pair) => declaredName(screen, pair.open))
    .filter((name) => name)
)];

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
        `${SCREEN}: [executed] the identifier generator can no longer be executed by this guard (${error.message}). It has to stay a self-contained function with no import and no module-level dependency, because running it is the only way to prove the shape the server will accept: a refused identifier raises nothing anywhere.`
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
            `${SCREEN}: [executed] the identifier generator could not be built ${run.label}: ${error.message}`
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
            `${SCREEN}: [executed] the identifier generator throws ${run.label}: ${error.message}. crypto.randomUUID is undefined outside a secure context, so this is what a phone on the dev server over a local IP would hit on the first render.`
          );
          continue;
        }
        if (rejected !== null) {
          failures.push(
            `${SCREEN}: [executed] the identifier generator emits ${JSON.stringify(rejected)} ${run.label}, which ATTEMPT_ID_PATTERN refuses. The server would drop it without a word, mint its own, and the reload would open a second session again.`
          );
        }
        if (repeated !== null) {
          failures.push(
            `${SCREEN}: [executed] the identifier generator repeats itself (${repeated}) ${run.label}. Two players, or two attempts, would land on one session row.`
          );
        }
      }
    }
  }
}

// WHOLE FILE (6 of 18): an import can only be judged against the whole module.
if (/from\s*["']uuid["']|require\(\s*["']uuid["']\s*\)/.test(screen)) {
  failures.push(
    `${SCREEN}: imports a uuid library. The generator is pinned to crypto.randomUUID because it emits version 4, the only family the server pattern accepts, and a library default may not.`
  );
}

// ------------- 5. EXECUTED, and now the CALL PATH and not only the helpers
// Five attackers, and the same lesson each time: a rule that recognises a shape
// gets walked around one axis over. Round 2 answered that by measuring the
// storage helpers instead of matching them, and the eleven rules it deleted were
// all verified covered. But the fifth attacker moved the axis to the CALL SITE,
// which a fragment run in isolation cannot see: a `.slice(0, 8)` on the result of
// the helper, a re-mint after the bind, a spread that overrides the payload key,
// a decoy call, a mount effect asking for a fresh attempt. Fifteen survivors, all
// passing lint and tsc, four of them restoring the plan's headline bug.
//
// So this section stops testing the pieces and tests the machine: the storage
// helpers AND the start and close functions are extracted together, given a fake
// fetch and a fake sessionStorage, and driven. What is asserted is what the client
// actually sends, and what it leaves in storage, across TWO successive module
// loads sharing one store, which is the only way to observe a reload at all.
//
// Types are erased by TypeScript's own eraser (node:module stripTypeScriptTypes),
// never by regular expressions. That closes the one silent failure mode of the
// previous version: six regexes deleted a runtime object property, so the guard
// measured a fragment that returned ONE identifier while the app returned TWO,
// and reported success on broken code.
let executedTheCallPath = false;

const helpersMissing = !mintName || !storeName || !adoptName || !dropName || !keyName;
// WHOLE FILE (7 of 18): an import statement can sit anywhere in the header.
if (helpersMissing && /^\s*import\s/m.test(screen)) {
  failures.push(
    `${SCREEN}: the attempt identifier helpers are not all in this file (found mint=${mintName ?? "none"}, store=${storeName ?? "none"}, adopt=${adoptName ?? "none"}, release=${dropName ?? "none"}, key=${keyName ?? "none"}). This guard EXECUTES them, extracted from this file and run in isolation against a fake storage, because that is the only way to measure what the client really sends. Moving them into another module is legitimate code and this guard cannot follow it: either keep them here, or teach this guard the module. Nothing below denies that your code exists, it means this guard could not run it.`
  );
}

if (!helpersMissing && startBlock && startName) {
  // ------------------------------------------------------------ extraction
  const spanStarts = [];
  const spanEnds = [];
  for (const [name, block] of [
    [mintName, mintBlock],
    [storeName, storeBlock],
    [adoptName, adoptBlock],
    [dropName, dropBlock],
  ]) {
    if (!name || !block) continue;
    spanStarts.push(declarationStart(screen, block.open, name));
    spanEnds.push(block.close + 1);
  }
  // WHOLE FILE (8 of 18): the key constant is declared at module level.
  const keyDeclaration = new RegExp(`(?:const|let|var)\\s+${keyName}\\s*=`).exec(screen);
  if (keyDeclaration) spanStarts.push(keyDeclaration.index);
  const helpersSource = screen.slice(Math.min(...spanStarts), Math.max(...spanEnds));

  // Both function shapes: an arrow, which is assigned a name, and a declaration,
  // which is emitted as it stands. Refusing the declaration made the guard red on
  // an ordinary refactor and blamed the type eraser for it.
  const functionTextOf = (block) => {
    const params = parameterListBefore(screen, block.open);
    if (!params) return null;
    let from = params.open;
    const before = screen.slice(Math.max(0, from - 60), from);
    const declaration = /(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*$/.exec(before);
    if (declaration) {
      return { text: screen.slice(from - (before.length - declaration.index), block.close + 1), declaration: true };
    }
    const asyncAt = before.lastIndexOf("async");
    if (asyncAt !== -1 && /^\s*$/.test(before.slice(asyncAt + 5))) {
      from -= before.length - asyncAt;
    }
    return { text: screen.slice(from, block.close + 1), declaration: false };
  };

  const startText = functionTextOf(startBlock);
  const endText = endBlock ? functionTextOf(endBlock) : null;
  const endName = endBlock ? declaredName(screen, endBlock.open) ?? "endSession" : null;

  // Assembled as a script, so TypeScript's own eraser can take the types out.
  // Helpers the extracted paths delegate to, pulled in as well: a response check
  // factored into a helper is a legitimate refactor, and stubbing it into a no-op
  // made the driven close look as though it ignored a refusal.
  const extraDeclarations = [];
  for (const name of okDelegates) {
    const block = pairs.find(
      (pair) =>
        declaredName(screen, pair.open) === name &&
        FUNCTION_HEAD.test(screen.slice(Math.max(0, pair.open - 300), pair.open)) &&
        pair.close - pair.open < 600
    );
    if (!block) continue;
    if (block.open >= Math.min(...spanStarts) && block.close <= Math.max(...spanEnds)) continue;
    extraDeclarations.push(`${screen.slice(declarationStart(screen, block.open, name), block.close + 1)};`);
  }

  const assemble = () => {
    const lines = [helpersSource, ...extraDeclarations];
    lines.push(startText.declaration ? startText.text : `const ${startName} = ${startText.text};`);
    if (endText && endName) {
      lines.push(endText.declaration ? endText.text : `const ${endName} = ${endText.text};`);
    }
    lines.push(
      `__out.api = { key: ${keyName}, mint: ${mintName}, take: ${storeName}, adopt: ${adoptName}, drop: ${dropName}, start: ${startName}${
        endText && endName ? `, end: ${endName}` : ""
      } };`
    );
    return lines.join("\n");
  };

  let script = null;
  if (!startText) {
    failures.push(
      `${SCREEN}: could not read the source of ${startName} to execute it. The guard drives that function against a fake fetch, which is what measures the value the client really sends.`
    );
  } else {
    try {
      script = stripTypes(assemble());
    } catch (error) {
      failures.push(
        `${SCREEN}: TypeScript could not be erased from the extracted code (${error.message}). The extracted region has to stay plain enough for node:module to strip it, because running it is what proves the value sent is the value stored.`
      );
    }
  }

  // ------------------------------------------------------------- the fakes
  const fakeStorage = (data, { throwing = false } = {}) => {
    const bar = () => {
      if (throwing) throw new Error("storage blocked by the browser");
    };
    return {
      getItem: (k) => {
        bar();
        return data.has(k) ? data.get(k) : null;
      },
      // String(), exactly like the real one. This is why an undefined reaching
      // the adopting function would store the text "undefined".
      setItem: (k, v) => {
        bar();
        data.set(k, String(v));
      },
      removeItem: (k) => {
        bar();
        data.delete(k);
      },
    };
  };

  // One record of every call made to a stubbed identifier, so an assertion can
  // ask which state setter a path really wrote.
  const makeStub = (name, log) => {
    const stub = (...args) => {
      log.push({ name, args });
      return stub;
    };
    stub.current = false;
    return new Proxy(stub, {
      get(target, property) {
        if (property in target) return target[property];
        return stub;
      },
      set(target, property, value) {
        target[property] = value;
        return true;
      },
    });
  };

  // `answer` decides what the fake network replies, per url.
  // The clock is injected, so two loads can be placed at different instants
  // without waiting: a storage key namespaced with Date.now() is stable inside one
  // millisecond, so two builds in the same tick would agree by luck.
  const clockOf = (now) =>
    new Proxy(Date, {
      get(target, property) {
        if (property === "now") return () => now;
        return Reflect.get(target, property);
      },
    });

  const instantiate = ({ data, answer, throwing = false, stubNames, now = 1_700_000_000_000 }) => {
    const log = [];
    const posts = [];
    const stubs = new Map(stubNames.map((name) => [name, makeStub(name, log)]));
    const storage = fakeStorage(data, { throwing });
    const win = { sessionStorage: storage, localStorage: fakeStorage(new Map()) };
    const doc = { documentElement: { lang: "fr" } };
    const fetchStub = async (url, init) => {
      let body = {};
      try {
        body = init && init.body ? JSON.parse(init.body) : {};
      } catch {
        body = {};
      }
      posts.push({ url: String(url), body });
      return answer(String(url), body);
    };
    const quiet = { error: () => {}, warn: () => {}, log: () => {} };
    const out = {};
    const fixed = ["window", "sessionStorage", "crypto", "document", "fetch", "console", "Date"];
    const values = [win, storage, globalThis.crypto, doc, fetchStub, quiet, clockOf(now)];
    const factory = new Function(...fixed, ...stubs.keys(), "__out", script);
    factory(...values, ...stubs.values(), out);
    return { api: out.api, log, posts, data };
  };

  // The free identifiers of the extracted region are discovered by running it and
  // reading back the ReferenceErrors, so a rename of any React state setter costs
  // nothing here. Bounded, and any other error is reported rather than swallowed.
  const okAnswer = (url, body) => ({
    ok: true,
    status: 200,
    json: async () => ({
      sessionId: body.attemptId ?? "00000000-0000-4000-8000-000000000000",
      userId: "00000000-0000-4000-8000-000000000002",
      question: { id: "q", token: "t", fontFace: null, options: [] },
      progress: { resolvedCount: 0 },
    }),
  });

  // The free identifiers of the extracted region, found lexically: every token
  // that is neither declared inside the region, nor a real global, nor one of the
  // fixed parameters. Reading them back from thrown ReferenceErrors is NOT enough,
  // and that mistake cost a debugging round: the start function catches its own
  // errors, so a missing `readOnboarding` never escapes, it lands in the catch and
  // the run looks like a failed start. Membership in globalThis is the exact test
  // for "this is a real global", so no allow-list of globals has to be maintained.
  const freeIdentifiers = () => {
    const declared = new Set(
      [...script.matchAll(/(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1])
    );
    const reserved = new Set([
      "window",
      "sessionStorage",
      "crypto",
      "document",
      "fetch",
      "console",
      "__out",
      "true",
      "false",
      "null",
      "undefined",
      "this",
      "typeof",
      "instanceof",
      "new",
      "return",
      "await",
      "async",
      "const",
      "let",
      "var",
      "function",
      "if",
      "else",
      "try",
      "catch",
      "finally",
      "throw",
      "for",
      "while",
      "of",
      "in",
      "void",
      "delete",
      "class",
      "extends",
      "case",
      "switch",
      "default",
      "break",
      "continue",
      "do",
      "yield",
    ]);
    const names = [];
    for (const match of script.matchAll(/(\.?)([A-Za-z_$][\w$]*)\s*(:?)/g)) {
      const [, dot, name, colon] = match;
      if (dot === ".") continue;
      if (colon === ":") continue;
      if (declared.has(name) || reserved.has(name)) continue;
      if (name in globalThis) continue;
      if (names.includes(name)) continue;
      names.push(name);
    }
    return names;
  };

  const discover = async () => {
    const names = freeIdentifiers();
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const data = new Map();
      try {
        const run = instantiate({ data, answer: okAnswer, stubNames: names });
        await run.api.start();
        if (run.api.end) await run.api.end();
        // A start that reached the network is a start that found every identifier
        // it needs. Anything less means a name is still missing, silently caught.
        if (run.posts.length === 0) {
          throw new Error(
            `the extracted start function never reached the fake network, so a free identifier is still missing or the request is not made (setters observed: ${run.log
              .map((entry) => entry.name)
              .join(", ")})`
          );
        }
        return names;
      } catch (error) {
        const missing = /(\w+) is not defined/.exec(error.message);
        if (!missing || names.includes(missing[1])) throw error;
        names.push(missing[1]);
      }
    }
    throw new Error("too many undefined identifiers in the extracted region");
  };

  let stubNames = null;
  if (script) {
    try {
      stubNames = await discover();
    } catch (error) {
      failures.push(
        `${SCREEN}: the extracted client code could not be executed (${error.message}). ${startName}, the storage helpers and the closing function are run here against a fake fetch and a fake sessionStorage: that measurement is what proves the identifier the client SENDS is the identifier it STORED, which no rule about shapes can prove. They have to stay in this file and stay free of imports.`
      );
    }
  }

  if (stubNames) {
    executedTheCallPath = true;
    const assert = (condition, message) => {
      if (!condition) failures.push(`${SCREEN}: [executed] ${message}`);
    };
    const startPath = startEntry.url;
    const endPath = endEntry ? endEntry.url : null;
    const startsOf = (posts) => posts.filter((post) => post.url.endsWith(startPath));
    const build = (data, options = {}) =>
      instantiate({
        data,
        answer: options.answer ?? okAnswer,
        throwing: options.throwing,
        now: options.now,
        stubNames,
      });

    // --------------------------------------------------- T1. the reload itself
    // TWO module loads around ONE store, which is what a reload is. The previous
    // version rebuilt the module for every assertion and so could never compare
    // two loads: a storage key namespaced with Date.now() went unnoticed.
    try {
      const data = new Map();
      const first = build(data, { now: 1_700_000_000_000 });
      await first.api.start();
      const second = build(data, { now: 1_700_000_907_000 });
      await second.api.start();

      // The storage KEY has to be the same for two loads, and that is asserted
      // directly rather than left to the identifiers to reveal: a key namespaced
      // with Date.now() is stable inside one millisecond, so two builds in the
      // same tick would agree by luck and the defect would show up as a wrong
      // diagnosis somewhere else.
      assert(
        first.api.key === second.api.key,
        `two module loads compute different storage keys (${first.api.key} then ${second.api.key}). A key that is not stable across loads means no reload ever finds what the last one stored, so every load opens a new session.`
      );
      const firstPosts = startsOf(first.posts);
      const secondPosts = startsOf(second.posts);
      assert(
        firstPosts.length === 1 && secondPosts.length === 1,
        `a single mount issues ${firstPosts.length} then ${secondPosts.length} start requests instead of one each. One load must open one session.`
      );
      const sentFirst = firstPosts[0] ? firstPosts[0].body.attemptId : undefined;
      const sentSecond = secondPosts[0] ? secondPosts[0].body.attemptId : undefined;
      assert(
        typeof sentFirst === "string" && (!serverPattern || serverPattern.test(sentFirst)),
        `the first load sends ${JSON.stringify(sentFirst)} as its attemptId, which the server pattern refuses: it would be dropped in silence and the server would open a session of its own.`
      );
      assert(
        sentFirst === sentSecond,
        `two successive loads sharing one storage send DIFFERENT identifiers (${sentFirst} then ${sentSecond}). A reload must replay its own attempt: this is the property the whole plan exists to establish, and it is measured here on what the client really puts on the wire, whatever the call site does with it.`
      );
      assert(
        data.get(first.api.key) === sentFirst,
        `the identifier the client SENDS (${sentFirst}) is not the identifier it left in STORAGE (${data.get(first.api.key)}). Anything between the storage helper and the request body, a slice, a re-mint, a spread that overrides the key, breaks the reload while every rule about the helper stays satisfied.`
      );
    } catch (error) {
      assert(false, `driving two successive loads threw: ${error.message}`);
    }

    // ------------------------------------- T2. a plain call replays, fresh mints
    try {
      const data = new Map();
      const run = build(data);
      await run.api.start();
      const replayed = startsOf(run.posts)[0]?.body.attemptId;
      await run.api.start();
      const again = startsOf(run.posts)[1]?.body.attemptId;
      assert(
        replayed === again,
        `two argument-less starts in one load send two identifiers (${replayed} then ${again}). The mount effect and Retry session are both the same attempt.`
      );
      await run.api.start({ fresh: true });
      const minted = startsOf(run.posts)[2]?.body.attemptId;
      assert(
        typeof minted === "string" && minted !== replayed,
        `asking for a fresh attempt sends ${JSON.stringify(minted)}, the same identifier as before: Play again would rejoin the session the player just closed.`
      );
      assert(
        data.get(run.api.key) === minted,
        `a fresh attempt sends ${minted} but storage holds ${data.get(run.api.key)}.`
      );
    } catch (error) {
      assert(false, `driving a replay and a fresh attempt threw: ${error.message}`);
    }

    // ------------------------------------------- T3. one start per mount, raced
    try {
      const data = new Map();
      const run = build(data);
      await Promise.all([run.api.start(), run.api.start()]);
      assert(
        startsOf(run.posts).length === 1,
        `two starts fired in the same tick produced ${startsOf(run.posts).length} requests. The re-entrance guard has to be closed synchronously, before the first await, or a mount effect that runs twice opens two sessions.`
      );
    } catch (error) {
      assert(false, `racing two starts threw: ${error.message}`);
    }

    // ---------------------------------------------- T4. the divergent response
    // The server could not rejoin ours, so it minted its own. The client has to
    // adopt that value, or this tab replays an identifier the server can never
    // rejoin and every later reload opens a new session.
    try {
      const server = crypto.randomUUID();
      const data = new Map();
      const first = build(data, {
        answer: (url, body) => okAnswer(url, { ...body, attemptId: server }),
      });
      await first.api.start();
      assert(
        data.get(first.api.key) === server,
        `after a response carrying a different sessionId (${server}), storage holds ${data.get(first.api.key)}. The identifier the server settled on has to be adopted, byte for byte.`
      );
      const second = build(data);
      await second.api.start();
      assert(
        startsOf(second.posts)[0]?.body.attemptId === server,
        `the load after a divergent response sends ${startsOf(second.posts)[0]?.body.attemptId} instead of the identifier the server settled on (${server}).`
      );
    } catch (error) {
      assert(false, `driving a divergent response threw: ${error.message}`);
    }

    // ------------------------------------------------- T5. a refused start
    try {
      const seeded = crypto.randomUUID();
      const data = new Map([[null, null]]);
      data.clear();
      const probe = build(data);
      await probe.api.start();
      const kept = data.get(probe.api.key);
      const refused = build(data, {
        answer: () => ({ ok: false, status: 500, json: async () => ({ error: "boom" }) }),
      });
      await refused.api.start();
      assert(
        data.get(refused.api.key) === kept,
        `a refused start changed storage from ${kept} to ${data.get(refused.api.key)}. A refused start must keep the identifier untouched: the server may already have written its row, and a response that carries no session must never be adopted.`
      );
      void seeded;
    } catch (error) {
      assert(false, `driving a refused start threw: ${error.message}`);
    }

    // ------------------------------------------------ T6. the close, both ways
    if (endPath) {
      const startErrorSetters = startBlock ? catchSettersOf(screen, closeOf, startBlock) : [];
      try {
        const data = new Map();
        const run = build(data, {
          answer: (url, body) =>
            url.endsWith(endPath)
              ? { ok: false, status: 500, json: async () => ({ error: "boom" }) }
              : okAnswer(url, body),
        });
        await run.api.start();
        const held = data.get(run.api.key);
        // Only what the CLOSE writes counts, and only a write that carries a
        // value: every path resets these states to null on entry, which is not a
        // failure report.
        const before = run.log.length;
        await run.api.end();
        const duringClose = run.log.slice(before);
        assert(
          data.get(run.api.key) === held,
          `a refused close released the identifier (${held} became ${data.get(run.api.key)}). The session is still open, so the next load would open a second one beside it.`
        );
        for (const setter of startErrorSetters) {
          const wrote = duringClose.find(
            (entry) => entry.name === setter && entry.args[0] !== null && entry.args[0] !== undefined
          );
          assert(
            !wrote,
            `a refused close wrote ${setter}(${JSON.stringify(wrote ? wrote.args[0] : "")}), the state the start path writes on failure. The render gates the question, the options and the progress line on that state, so a 500 on an optional gesture would destroy the question in progress. Wherever that call sits, in the catch or in the branch before it, the effect is the same.`
          );
        }
        assert(
          !duringClose.some((entry) => entry.name === "setIsComplete" && entry.args[0] === true),
          `a refused close announced completion. The screen would show a closed session the server refused.`
        );
      } catch (error) {
        assert(false, `driving a refused close threw: ${error.message}`);
      }

      try {
        const data = new Map();
        const run = build(data);
        await run.api.start();
        await run.api.end();
        assert(
          !data.has(run.api.key),
          `an accepted close left ${data.get(run.api.key)} in storage. A closed session must let its identifier go, or the next start replays an identifier whose session is already closed.`
        );
        assert(
          run.log.some((entry) => entry.name === "setIsComplete" && entry.args[0] === true),
          `an accepted close never announced completion, so the "Session complete" branch and the "Play again" block stay unreachable.`
        );
      } catch (error) {
        assert(false, `driving an accepted close threw: ${error.message}`);
      }
    }

    // ------------------------------- T7. the helpers themselves, still measured
    // Cheaper to diagnose than the end to end cases, and they cover the branches
    // a driven start does not reach: blocked storage, and junk handed to adopt.
    try {
      const data = new Map();
      const run = build(data, { throwing: true });
      const value = await run.api.start();
      void value;
      const kept = data.size;
      assert(
        kept === 0,
        `a blocked storage still received ${kept} writes.`
      );
      assert(
        startsOf(run.posts).length === 1,
        `with storage blocked the client issued ${startsOf(run.posts).length} start requests instead of one. Private mode, a locked webview and "block all cookies" all throw on getItem: an escaping throw leaves the screen on the start error for ever, against the invariant this file states.`
      );
      const sent = startsOf(run.posts)[0]?.body.attemptId;
      assert(
        typeof sent === "string" && (!serverPattern || serverPattern.test(sent)),
        `with storage blocked the client sent ${JSON.stringify(sent)} instead of a usable identifier.`
      );
    } catch (error) {
      assert(
        false,
        `the client throws when sessionStorage is blocked (${error.message}). It has to degrade instead: the identifier simply does not survive the reload, and the game stays playable.`
      );
    }

    try {
      const server = crypto.randomUUID();
      const data = new Map();
      const run = build(data);
      run.api.adopt(server);
      assert(
        data.get(run.api.key) === server && data.size === 1,
        `the adopting function left ${data.get(run.api.key)} in storage when handed ${server}, under ${data.size} keys.`
      );
      run.api.adopt(server);
      assert(
        data.get(run.api.key) === server && data.size === 1,
        `the adopting function is not idempotent: adopting the identifier already stored changed storage.`
      );
      for (const junk of [undefined, null, "undefined", server.slice(0, 8), "", 42]) {
        run.api.adopt(junk);
        assert(
          data.get(run.api.key) === server,
          `the adopting function accepted ${JSON.stringify(String(junk))}, which is not an identifier, and storage now holds ${data.get(run.api.key)}. A refused start answers JSON with no session, so that is the value every later load would send, burning a session row each time.`
        );
      }
      const seen = new Set();
      let repeat = null;
      for (let draw = 0; draw < 50 && repeat === null; draw += 1) {
        const value = run.api.take({ fresh: true });
        if (seen.has(value)) repeat = value;
        seen.add(value);
      }
      assert(
        repeat === null,
        `the storage helper hands out the same identifier twice (${repeat}) for two fresh attempts. Two players, or two attempts, would land on one session row.`
      );
    } catch (error) {
      assert(false, `driving the adopting function threw: ${error.message}`);
    }
  }
}

if (!executedTheCallPath && !helpersMissing) {
  failures.push(
    `${SCREEN}: the behaviour of the client could not be measured at all, so nothing here proves that two successive loads send one identifier. That measurement is this guard's only defence that does not rest on recognising a shape, and it must not be allowed to disappear quietly.`
  );
}


// ------------------------------------------------------------ 6. the start path
if (startBlock && startName && startEntry) {
  const fetchAt = startEntry.index;
  const beforeFetch = screen.slice(startBlock.open, fetchAt);
  const wholeStart = screen.slice(startBlock.open, startBlock.close);
  const signature = screen.slice(Math.max(0, startBlock.open - 300), startBlock.open);
  const fetchParen = parenRegionAfter(screen, fetchAt);
  const afterFetch = fetchParen ? screen.slice(fetchParen.close, startBlock.close) : "";

  // 6a and 6b, DELETED. "The identifier is bound from the storing function before
  // the request" and "the payload carries that symbol" were both static, and both
  // were walked around at the call site: a `.slice(0, 8)` on the bind, a re-mint
  // after it, a spread that overrides the key afterwards. Section 5 now measures
  // the value that reaches the fake network and compares it with the value left in
  // storage, which is the property those two rules were trying to approximate.

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
      // WHOLE FILE (9 of 18): the ref is declared in the component body, above.
    if (!new RegExp(`const\\s+${refName}\\s*=\\s*useRef`).test(screen)) {
      failures.push(
        `${SCREEN}: ${refName} is not a useRef. A value that lives in state is only readable on the next render, which is exactly what lets the second call through.`
      );
    }
  }

  // 6d. reconciliation, and the short-circuit that has to precede it. When the
  // server could not rejoin what we sent (session swept for inactivity, closed,
  // or owned by another player) it mints its own and answers with a new session.
  // Keeping ours would leave this tab sending, for ever, an identifier the server
  // can never rejoin, so every later reload would open a new session.
  //
  // NO RULE ON THE COMPARISON. Writing the same string back to the same key is a
  // no-op, so an unconditional adopt is exactly equivalent and simpler, and the
  // previous version turned that legitimate simplification red while accusing it
  // of a defect it did not have. What is required is that an adopt happens, that
  // it is handed the server's sessionId PATH and nothing derived from it, and that
  // it happens after the response was accepted.
  const startCheck = shortCircuitAfter(screen, closeOf, startBlock, fetchAt, okDelegates);
  if (!startCheck.shortCircuits) {
    failures.push(
      `${SCREEN}: a refused start is not short-circuited in ${startName}. The start route answers JSON even on a 500, so response.json() succeeds, payload.sessionId is undefined, and everything downstream runs on a payload that carries no session. This is the mandatory path, not an optional gesture: it needs the check the close already has.`
    );
  }
  if (!adoptName) {
    failures.push(
      `${SCREEN}: nothing adopts the sessionId the server returned. Without it, a tab whose session was swept sends an identifier the server can never rejoin, and every reload from then on opens a new session, permanently.`
    );
  } else {
    const adopted = new RegExp(`\\b${adoptName}\\s*\\(`).exec(afterFetch);
    if (!adopted) {
      failures.push(
        `${SCREEN}: ${adoptName} is never called after the start response, so the identifier the server settled on is never stored. A tab whose session was swept then opens a new session on every reload, permanently.`
      );
    } else {
      const args = parenRegionAfter(afterFetch, adopted.index);
      const handed = args ? args.text.trim() : "";
      // A `<something>.sessionId` path, or a local name that IS one: destructuring
      // the response is the most ordinary refactor in this file, and the previous
      // version turned it red while accusing it of corrupting storage. What stays
      // refused is a DERIVED value, a slice or a rewrite, and our own identifier
      // handed back, because both leave this tab opening a new session per reload.
      const aliasOf = (name) => {
        const direct = new RegExp(
          `(?:const|let|var)\\s+${name}\\s*(?::[^=;]*)?=\\s*([A-Za-z_$][\\w$]*)\\.sessionId\\s*;`
        ).test(wholeStart);
        const destructured = new RegExp(
          `\\{[^{}]*\\bsessionId\\s*:\\s*${name}\\b[^{}]*\\}\\s*=\\s*[A-Za-z_$][\\w$]*\\s*;`
        ).test(wholeStart);
        return direct || destructured;
      };
      const isPath = /^[A-Za-z_$][\w$]*\.sessionId$/.test(handed);
      const isAlias = /^[A-Za-z_$][\w$]*$/.test(handed) && aliasOf(handed);
      if (!isPath && !isAlias) {
        failures.push(
          `${SCREEN}: ${adoptName} is handed ${handed || "nothing"} instead of the sessionId the server returned, either as a path or as a local name destructured from the response. A derived value (a slice, a rewrite) is stored and refused in silence at every later start, and handing back the identifier we just sent is a no-op: both leave this tab opening a new session on every reload.`
        );
      }
      const adoptedAt = (fetchParen ? fetchParen.close : fetchAt) + adopted.index;
      if (adoptedAt < startBlock.open + startCheck.checkedAt) {
        failures.push(
          `${SCREEN}: the server identifier is adopted before the refused-start branch in ${startName}. On a refused start there is no session in the payload, so what would be adopted is not an identifier at all.`
        );
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

// WHOLE FILE (10 and 11 of 18), and it has to be: these are call sites spread
// through the JSX, the twin-button rule included.
if (startName) {
  const callSites = [...screen.matchAll(new RegExp(`\\b${startName}\\s*\\(`, "g"))].map(
    (match) => match.index
  );
  let sawPlain = false;
  let sawFresh = false;
  const freshSites = [];
  for (const at of callSites) {
    const args = parenRegionAfter(screen, at);
    if (!args) continue;
    if (args.text.trim() === "") {
      sawPlain = true;
      continue;
    }
    const entry = entriesOf(args.text).find((candidate) => candidate.key === "fresh");
    // Any value but the literal false asks for a new attempt. An expression is
    // legitimate here: this call site decides, it does not forward a decision.
    if (entry && entry.value !== "false") {
      sawFresh = true;
      freshSites.push(at);
    }
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
  // NAMING THE CALLER, not just counting flavours. "There exists a plain caller"
  // and "there exists a fresh caller" were both satisfied while the MOUNT EFFECT
  // asked for a fresh attempt, which makes every page load open a new session: the
  // plan's own bug, restored by one token, with the two flags still green. Exactly
  // one caller may ask for a new attempt, and no caller inside a hook may.
  if (freshSites.length > 1) {
    failures.push(
      `${SCREEN}: ${freshSites.length} callers ask ${startName} for a fresh attempt. Only Play again opens a new attempt; a retry, and the mount, replay the identifier already stored, or a failed start is followed by a second session beside the row the server may already have written.`
    );
  }
  for (const at of freshSites) {
    const hook = pairs.find(
      (pair) =>
        pair.open < at &&
        at < pair.close &&
        /use(?:Effect|LayoutEffect|Memo)\s*\(\s*\(\s*\)\s*=>\s*$/.test(
          screen.slice(Math.max(0, pair.open - 40), pair.open)
        )
    );
    if (hook) {
      failures.push(
        `${SCREEN}: a hook body asks ${startName} for a fresh attempt. The mount effect is the load, and a load must REPLAY the stored identifier: asking for a new one there means no reload ever rejoins its own session, which is exactly the bug this plan closes.`
      );
    }
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
// WHOLE FILE (12, 13 and 14 of 18) by nature: a dependency array, and a useState
// declaration, can sit anywhere in the component.
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

  // 8a. a refused close must STOP. Presence of a .ok test proves nothing: a
  // reviewer replaced the throw with a console.error and everything downstream ran
  // anyway, which is word for word what this message used to claim to forbid. Same
  // helper as the start path now, so neither can lose the rule without the other.
  const endCheck = shortCircuitAfter(screen, closeOf, endBlock, endAt, okDelegates);
  const shortCircuits = endCheck.shortCircuits;
  const checkedAt = endCheck.checkedAt;
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
    // WHOLE FILE (15 of 18): finding a stray release IS the point of this rule.
    const dropCalls = [...screen.matchAll(new RegExp(`\\b${dropName}\\s*\\(`, "g"))].map(
      (match) => match.index
    );
    const insideEnd = dropCalls.filter((at) => at > endBlock.open && at < endBlock.close);
    if (insideEnd.length === 0) {
      failures.push(
        `${SCREEN}: ${endName} never releases the stored identifier. The next start would replay the identifier of a session that is already closed.`
      );
    }
    // EVERY release inside the close, not just the first: a second one added to the
    // `finally` runs on the refused path too, so a session that is still open loses
    // its identifier and the next load opens a second one beside it.
    const endFinallyBody = finallyBodyOf(screen, closeOf, endBlock.open, endBlock.close);
    for (const at of insideEnd) {
      if (endFinallyBody && at > endFinallyBody.open && at < endFinallyBody.close) {
        failures.push(
          `${SCREEN}: ${dropName} is called in the finally of ${endName}, so it runs on the refused path as well. A refused close must keep the identifier: the session is still open, and releasing it makes the next load open a second one beside it.`
        );
      } else if (at - endBlock.open < checkedAt) {
        failures.push(
          `${SCREEN}: ${dropName} is called before the refused-close branch in ${endName}. A refused close would then let the identifier go while the session stays open.`
        );
      }
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
  // The WHOLE close is read, not only its first catch: a reviewer put the start's
  // error setter in the `!response.ok` branch, one line before the throw, and the
  // rule that read the catch saw nothing while a refused close destroyed the game
  // view exactly as before. The comparison is against the start's CATCH setters,
  // since those are the ones the render gates on.
  const endSetters = settersOf(screen, endBlock.open, endBlock.close);
  const startSetters = startBlock ? catchSettersOf(screen, closeOf, startBlock) : [];
  if (catchSettersOf(screen, closeOf, endBlock).length === 0) {
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
  // A gate is judged by the SET of identifiers it depends on, never by an
  // operator. The previous version greped `!closeError`, so the same gate written
  // `closeError === null && !error && ...` walked straight through: a refused close
  // destroyed the question view again, and silently this time, since the message
  // paragraph lives inside the very block that gate closes.
  // Derived from what the close writes ON FAILURE, not from every setter it calls:
  // the position rule below is about the failure state, and `isRoundLocked` or
  // `isComplete` are ordinary game state that the render legitimately gates on.
  const closeStates = catchSettersOf(screen, closeOf, endBlock)
    .map((setter) => `${setter.slice(3, 4).toLowerCase()}${setter.slice(4)}`)
    .filter((stateName) => new RegExp(`\\b${stateName}\\b`).test(screen));
  // WHOLE FILE (16 and 17 of 18). THE POSITION RULE, restored and stronger than the grep
  // round 2 deleted. That grep caught `!closeError`; its replacement, an identifier
  // set per render gate, was walked around three ways: the gate extracted into a
  // named boolean that reads `!closeError`, an alias `closeError !== null` read by
  // the gate, and the condition wrapped in an inline object literal that the gate
  // finder skips. All three restore a refused close destroying the question view,
  // and the third one exploits a hole this guard had DISCLOSED. So the state is
  // pinned at the source instead: it may appear in a declaration, in a list, as a
  // JSX child, and as its own bare gate, and nowhere else. No operator can be
  // applied to it anywhere in this file, so no alias can carry it into a gate.
  for (const stateName of closeStates) {
    for (const match of screen.matchAll(new RegExp(`\\b${stateName}\\b`, "g"))) {
      const at = match.index;
      let before = at - 1;
      while (before >= 0 && /\s/.test(screen[before])) before -= 1;
      let after = at + stateName.length;
      while (after < screen.length && /\s/.test(screen[after])) after += 1;
      const prev = screen[before] ?? "";
      const next = screen[after] ?? "";
      const declaration = (prev === "[" || prev === ",") && (next === "," || next === "]");
      const listed = (prev === "," || prev === "[" || prev === "{") && (next === "," || next === "]");
      const jsxChild = prev === "{" && next === "}";
      const ownGate = prev === "{" && next === "?";
      if (declaration || listed || jsxChild || ownGate) continue;
      failures.push(
        `${SCREEN}: ${stateName} is read in an expression (${screen.slice(Math.max(0, at - 40), at + stateName.length + 20).trim().replace(/\s+/g, " ")}). The state a refused close writes may only be declared, listed in a dependency array, rendered as a child, or tested bare in its own gate. Any operator on it, anywhere, can carry it into a render gate through an alias and hide the question the player is answering.`
      );
    }
  }

  if (closeStates.length > 0) {
    // WHOLE FILE (18 of 18): a render gate can sit in any JSX expression of the file.
    const gates = renderGates(screen, pairs);
    for (const stateName of closeStates) {
      const touching = gates.filter((gate) => identifiersOf(gate.condition).has(stateName));
      for (const gate of touching) {
        const used = identifiersOf(gate.condition);
        if (used.size > 1) {
          failures.push(
            `${SCREEN}: ${stateName}, the state a refused close writes, appears in a render gate together with ${[...used].filter((name) => name !== stateName).join(", ")} (condition: ${gate.condition.trim().slice(0, 120)}). Closing is optional: its failure must gate nothing but its own message, or a 500 on that button destroys the question in progress. Which operator is used makes no difference here, this rule reads the identifiers the gate depends on.`
          );
        } else if (gate.condition.trim() !== stateName) {
          failures.push(
            `${SCREEN}: the only gate allowed to read ${stateName} is a bare truthiness test on it, and this one is ${gate.condition.trim().slice(0, 120)}. A comparison can be inverted (${stateName} === null ? theQuestion : null) and then a refused close hides the game again.`
          );
        }
      }
      if (touching.length > 1) {
        failures.push(
          `${SCREEN}: ${stateName} is read in ${touching.length} render gates. One, rendering its own message, is the whole budget for a state that must gate nothing.`
        );
      }
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
  "check:client-attempt-contract OK. DRIVEN END TO END, the extracted client running against a " +
    "fake fetch and a fake sessionStorage: two successive module loads sharing one store each " +
    "issue one start request and send the SAME identifier, byte for byte the value left in the " +
    "store; two argument-less starts in one load send one identifier and an explicit fresh one " +
    "sends another; two starts in the same tick issue one request; a response carrying a " +
    "different sessionId is adopted and replayed by the next load; a refused start leaves the " +
    "store untouched; a refused close keeps the identifier, writes no state the start path " +
    "writes on failure, and announces no completion, while an accepted close releases the " +
    "identifier and announces completion; blocked storage still sends one usable identifier " +
    "without throwing; the adopting function is exact, idempotent, and refuses a non " +
    "identifier. MEASURED ON THE GENERATOR, its output is accepted by the server's own pattern " +
    "in both crypto branches and never repeats. CHECKED STATICALLY, and only this: one call to " +
    "each training path in the file, each resolving to a route file that exists; one caller " +
    "asks for a fresh attempt and no hook body does; re-entrance is tested then closed with no " +
    "await between, and released in a finally, on both paths; a refused response is " +
    "short-circuited on both paths by a condition carrying no boolean literal, inline or " +
    "delegated to a helper that throws; the identifier is released only inside the close, never " +
    "in its finally, and only after that check; the sessionId handed to the adopting function " +
    "is the response path or a name destructured from it; the identifier is in no dependency " +
    "array and in no React state; and the state a refused close writes is never read under an " +
    "operator anywhere in the file."
);
