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
// SIXTEEN of them: the count is the number of scans of the whole source, which is
// `grep -c "WHOLE FILE ("` expanded by the ranges those markers carry. Claiming an
// enumeration is complete without counting it is what the re-review caught here. The pure part of that machinery self-tests on synthetic lines
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

// Just enough TypeScript removed for a fragment of this file to be executed:
// return annotations on an arrow and on a declaration, object type literals and
// simple named types in a parameter position, casts, and annotations on simple
// locals. Self-tested below on the five forms this file actually uses. Anything
// it cannot handle makes the evaluation throw, which is reported as a failure
// with its cause, never silently skipped.
const stripTypes = (source) =>
  source
    .replace(/\)\s*:\s*[^={;]*=>/g, ") =>")
    .replace(/\)\s*:\s*[A-Za-z_$][\w$<>[\].|\s]*\{/g, ") {")
    .replace(/:\s*\{[^{}]*\}(?=\s*(?:=>|\)|,|=))/g, "")
    .replace(/:\s*(?:string|number|boolean|Uint8Array|[A-Z][\w$]*(?:<[^<>]*>)?)(?=\s*[,)=])/g, "")
    .replace(/\bas\s+(?:const|[A-Za-z_$][\w$<>[\].|\s]*)/g, "")
    .replace(/:\s*(?:string|number|boolean|Uint8Array)\b(?!\s*\()/g, "");

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
const shortCircuitAfter = (source, closeOf, block, fetchAt) => {
  const body = source.slice(block.open, block.close);
  const fetchRel = fetchAt - block.open;
  let shortCircuits = false;
  let checkedAt = fetchRel;
  for (const match of body.matchAll(/\bif\s*\(/g)) {
    const condition = parenRegionAfter(body, match.index);
    if (!condition || condition.open < fetchRel) continue;
    if (!/!\s*[A-Za-z_$][\w$]*\.ok\b|\.ok\s*===\s*false/.test(condition.text)) continue;
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

  // stripTypes, on the five forms this file uses. If any of these regressed, the
  // executed layer below would report a syntax error instead of a real defect.
  expect("arrow return annotation removed", stripTypes("const m = (): string => {"), "const m = () => {");
  expect(
    "object type in a parameter position removed",
    stripTypes("const t = ({ fresh }: { fresh: boolean }): string => {"),
    "const t = ({ fresh }) => {"
  );
  expect(
    "default plus object type plus default argument removed",
    stripTypes("async ({ fresh = false }: { fresh?: boolean } = {}) => {"),
    "async ({ fresh = false } = {}) => {"
  );
  expect(
    "simple named type in a parameter position removed",
    stripTypes("const a = (serverSessionId: string) => {"),
    "const a = (serverSessionId) => {"
  );
  expect(
    "declaration return annotation removed",
    stripTypes("function m(): string {"),
    "function m() {"
  );
  expect(
    "a regex literal is left alone",
    stripTypes("const S = /^[0-9a-f]{8}-[1-5][0-9a-f]{3}$/i;"),
    "const S = /^[0-9a-f]{8}-[1-5][0-9a-f]{3}$/i;"
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
  // WHOLE FILE (1 of 16): a payload object declared under a name is looked up in
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
// WHOLE FILE (2 of 16): every fetch of this file is enumerated, so each one can be
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

// WHOLE FILE (3, 4 and 5 of 16): the three storage access scans, reading ALL
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

// WHOLE FILE (6 of 16): an import can only be judged against the whole module.
if (/from\s*["']uuid["']|require\(\s*["']uuid["']\s*\)/.test(screen)) {
  failures.push(
    `${SCREEN}: imports a uuid library. The generator is pinned to crypto.randomUUID because it emits version 4, the only family the server pattern accepts, and a library default may not.`
  );
}

// ------------------------- 5. the value chain, EXECUTED against a fake storage
// This is the section four attackers broke. Each earlier round pinned the exact
// mutations it had been shown, and the next attacker moved one axis over: a
// conditional persist, a persist of another value, an alias minted on the spot, a
// default flipped in a signature, a try block removed. That loop does not
// converge. The one layer nobody has defeated, across four attackers, is the one
// that EXECUTES the code instead of recognising its shape. So the storage helpers
// are extracted from this file, run against a fake sessionStorage, and asserted
// on BEHAVIOUR. The static rules these assertions replace are deleted rather than
// kept beside them: a smaller guard that measures behaviour beats a larger one
// that recognises shapes.
//
// The constraint this pins, stated here and repeated in the failure message: the
// storage helpers must stay executable in isolation, with no import and no
// dependency outside their own span in this file. That is the same constraint
// check-day-keys.mjs puts on lib/profile/day-keys.ts, and for the same reason.
let executedTheHelpers = false;
if (mintName && storeName && adoptName && dropName && keyName && startBlock) {
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
  // WHOLE FILE (7 of 16): the key constant is declared at module level.
  const keyDeclaration = new RegExp(`(?:const|let|var)\\s+${keyName}\\s*=`).exec(screen);
  if (keyDeclaration) spanStarts.push(keyDeclaration.index);

  const helpersSource = stripTypes(screen.slice(Math.min(...spanStarts), Math.max(...spanEnds)));
  const paramList = parameterListBefore(screen, startBlock.open);
  const storeCallRegion = screen.slice(
    startBlock.open,
    startEntry ? startEntry.index : startBlock.close
  );
  const storeCall = new RegExp(`\\b${storeName}\\s*\\(`).exec(storeCallRegion);
  const handOver = storeCall ? parenRegionAfter(storeCallRegion, storeCall.index) : null;

  // Both `window.sessionStorage` and the bare `sessionStorage` are correct code, so
  // the stub is bound under both names. Requiring the prefix would have turned a
  // legitimate refactor red, which it briefly did.
  const build = (win) =>
    new Function(
      "window",
      "sessionStorage",
      "crypto",
      `${helpersSource}\nreturn { key: ${keyName}, mint: ${mintName}, take: ${storeName}, adopt: ${adoptName}, drop: ${dropName} };`
    )(win, win.sessionStorage, globalThis.crypto);

  const fakeWindow = ({ throwing = false } = {}) => {
    const data = new Map();
    const bar = () => {
      if (throwing) throw new Error("storage blocked by the browser");
    };
    return {
      data,
      win: {
        sessionStorage: {
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
        },
      },
    };
  };

  let api = null;
  let resolveFresh = null;

  try {
    api = build(fakeWindow().win);
  } catch (error) {
    failures.push(
      `${SCREEN}: [executed] the storage helpers can no longer be executed by this guard (${error.message}). ${storeName}, ${adoptName} and ${dropName} must stay self-contained, with no import and no dependency outside their own span in this file, because running them is the only way to prove the property the contract needs: two plain starts replay one identifier. A rule about shapes cannot see a default flipped in a signature, or a try block removed.`
    );
  }

  if (api && paramList && handOver) {
    try {
      // The argument a plain call resolves to, DEFAULT INCLUDED. `{ fresh = true }`
      // is one word away from `{ fresh = false }`, and no rule about the presence
      // of the word `fresh` can tell them apart, so it is evaluated instead.
      resolveFresh = new Function(
        `return ((${stripTypes(paramList.text)}) => (${handOver.text}));`
      )();
    } catch (error) {
      failures.push(
        `${SCREEN}: [executed] the argument ${startName} hands to ${storeName} could not be evaluated (${error.message}). It has to stay a plain expression of the parameter, because the guard resolves it, with the signature's own default, to prove that an argument-less start asks for a REPLAY and not for a new attempt.`
      );
    }
  } else if (api) {
    failures.push(
      `${SCREEN}: [executed] could not read ${startName}'s parameter list and the argument it hands to ${storeName}. Both are needed to resolve what an argument-less start actually asks for.`
    );
  }

  if (api && resolveFresh) {
    executedTheHelpers = true;
    // Every message this layer produces carries the [executed] marker, so a reader,
    // and the mutation matrix, can tell a measurement from a pattern match.
    const assert = (condition, message) => {
      if (!condition) failures.push(`${SCREEN}: [executed] ${message}`);
    };
    let plainArg = null;
    let freshArg = null;
    try {
      plainArg = resolveFresh();
      freshArg = resolveFresh({ fresh: true });
    } catch (error) {
      failures.push(`${SCREEN}: [executed] resolving the fresh flag threw (${error.message}).`);
    }

    if (plainArg !== null && freshArg !== null) {
      const shown = JSON.stringify(plainArg);

      // A1. THE PROPERTY THE WHOLE PLAN EXISTS FOR. Two plain starts, which is
      // what the mount effect and Retry session both do, must replay ONE
      // identifier. This single assertion covers the signature's default, the
      // read, the persist and the return at once, whatever their spelling.
      try {
        const { data, win } = fakeWindow();
        const scoped = build(win);
        const first = scoped.take(plainArg);
        const second = scoped.take(plainArg);
        assert(
          first === second,
          `two plain starts do not replay one identifier: ${startName}() resolves to ${shown} and ${storeName} returned ${first} then ${second}. Every page load would open a new session and no reload would ever rejoin its own, which is the bug this whole plan exists to close.`
        );
        assert(
          data.get(scoped.key) === first,
          `the identifier ${storeName} returned (${first}) is not what it left in storage (${data.get(scoped.key)}), measured immediately after the call. A persist that is conditional, deferred in a timer, or of another value, loses the reload.`
        );
        assert(
          typeof first === "string" && (!serverPattern || serverPattern.test(first)),
          `${storeName} returns ${JSON.stringify(first)}, which the server pattern refuses. It would be dropped in silence and the server would mint its own.`
        );
      } catch (error) {
        assert(
          false,
          `${storeName} threw on a plain start against a working storage: ${error.message}`
        );
      }

      // A2. A stored identifier is replayed BYTE FOR BYTE, under the key it also
      // writes. Kills any transform of the read, and any key drift.
      try {
        const seed = crypto.randomUUID();
        const { data, win } = fakeWindow();
        const scoped = build(win);
        data.set(scoped.key, seed);
        const replayed = scoped.take(plainArg);
        assert(
          replayed === seed,
          `a stored identifier is not replayed as it stands: storage held ${seed} and ${storeName} returned ${replayed}. It must read the key it writes and hand back exactly what it found, or the reload sends a value the server never saw.`
        );
      } catch (error) {
        assert(false, `${storeName} threw while replaying a stored identifier: ${error.message}`);
      }

      // A3. A new attempt really is new, and it is persisted.
      try {
        const seed = crypto.randomUUID();
        const { data, win } = fakeWindow();
        const scoped = build(win);
        data.set(scoped.key, seed);
        const minted = scoped.take(freshArg);
        assert(
          minted !== seed,
          `asking for a fresh attempt replays the stored identifier instead of minting one: Play again would rejoin the session the player just closed. The argument resolved for a fresh call was ${JSON.stringify(freshArg)}.`
        );
        assert(
          data.get(scoped.key) === minted,
          `a fresh attempt is not persisted: ${storeName} returned ${minted} and storage holds ${data.get(scoped.key)}.`
        );
      } catch (error) {
        assert(false, `${storeName} threw on a fresh attempt: ${error.message}`);
      }

      // A4. Uniqueness, so a constant cannot pass A1 by being equal to itself.
      try {
        const { win } = fakeWindow();
        const scoped = build(win);
        const seen = new Set();
        let repeat = null;
        for (let draw = 0; draw < 50 && repeat === null; draw += 1) {
          const value = scoped.take(freshArg);
          if (seen.has(value)) repeat = value;
          seen.add(value);
        }
        assert(
          repeat === null,
          `${storeName} hands out the same identifier twice (${repeat}) for two fresh attempts. Two players, or two attempts, would land on one session row.`
        );
      } catch (error) {
        assert(false, `${storeName} threw while minting fresh attempts: ${error.message}`);
      }

      // A5. A browser that refuses storage must degrade, never throw. Private
      // mode, a locked webview and "block all cookies" throw on getItem, and this
      // call sits inside the start path: an escaping throw leaves the screen on
      // the start error for ever, against the invariant this file states.
      try {
        const { win } = fakeWindow({ throwing: true });
        const scoped = build(win);
        const value = scoped.take(plainArg);
        assert(
          typeof value === "string" && (!serverPattern || serverPattern.test(value)),
          `with storage blocked, ${storeName} returned ${JSON.stringify(value)} instead of a usable identifier.`
        );
        scoped.adopt(crypto.randomUUID());
        scoped.drop();
      } catch (error) {
        assert(
          false,
          `the storage helpers throw when sessionStorage is blocked (${error.message}). In private mode, in a locked webview or with all cookies blocked, that throw escapes into the start path and the screen stays on "Unable to start the training session." for ever, against the invariant this file states: a page load must never throw over storage.`
        );
      }

      // A6. Adoption stores the server's value, exactly, and refuses anything that
      // is not an identifier, so a refused start answering JSON cannot poison the
      // key with the text "undefined".
      try {
        const server = crypto.randomUUID();
        const { data, win } = fakeWindow();
        const scoped = build(win);
        data.set(scoped.key, crypto.randomUUID());
        scoped.adopt(server);
        assert(
          data.get(scoped.key) === server,
          `${adoptName} left ${data.get(scoped.key)} in storage when handed ${server}. It must store the server's value byte for byte, or this tab keeps replaying something the server cannot rejoin.`
        );
        assert(data.size === 1, `${adoptName} wrote ${data.size} keys instead of one.`);
        scoped.adopt(server);
        assert(
          data.get(scoped.key) === server && data.size === 1,
          `${adoptName} is not idempotent: adopting the identifier already stored changed storage.`
        );
        for (const junk of [undefined, null, "undefined", server.slice(0, 8), "", 42]) {
          scoped.adopt(junk);
          assert(
            data.get(scoped.key) === server,
            `${adoptName} accepted ${JSON.stringify(String(junk))}, which is not an identifier, and storage now holds ${data.get(scoped.key)}. A refused start answers JSON with no session, so that is the value every later load would send, burning a session row each time.`
          );
        }
      } catch (error) {
        assert(false, `${adoptName} threw: ${error.message}`);
      }

      // A7. The release really empties the key it reads.
      try {
        const { data, win } = fakeWindow();
        const scoped = build(win);
        data.set(scoped.key, crypto.randomUUID());
        scoped.drop();
        assert(
          !data.has(scoped.key),
          `${dropName} left ${data.get(scoped.key)} in storage. A closed session must let its identifier go, or the next start replays an identifier whose session is already closed.`
        );
      } catch (error) {
        assert(false, `${dropName} threw: ${error.message}`);
      }
    }
  }
}

if (!executedTheHelpers && mintName && setItemSites.length > 0) {
  failures.push(
    `${SCREEN}: [executed] the behaviour of the storage helpers could not be measured at all, so nothing here proves that two plain starts replay one identifier. That measurement is this guard's only defence that does not rest on recognising a shape, and it must not be allowed to disappear quietly.`
  );
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
    // No rule here on HOW the fresh flag is passed. Section 5 resolves the
    // argument for real, with the signature's default, and measures what comes
    // back: an inversion, a constant fold and a flipped default all fail there,
    // while a harmless wrapper passes. That is strictly better than the previous
    // rule, which demanded the bare parameter and so refused Boolean(fresh).
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
      // WHOLE FILE (8 of 16): the ref is declared in the component body, above.
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
  const startCheck = shortCircuitAfter(screen, closeOf, startBlock, fetchAt);
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
      // Exactly a `<something>.sessionId` path. A value derived from it, or our
      // own identifier handed back, poisons storage or does nothing, and both
      // reopen the bug this function exists to close.
      if (!/^[A-Za-z_$][\w$]*\.sessionId$/.test(handed)) {
        failures.push(
          `${SCREEN}: ${adoptName} is handed ${handed || "nothing"} instead of the payload's sessionId path itself. A derived value (a slice, a rewrite) is stored and refused in silence at every later start, and handing back the identifier we just sent is a no-op: both leave this tab opening a new session on every reload.`
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

// WHOLE FILE (9 and 10 of 16), and it has to be: these are call sites spread
// through the JSX, the twin-button rule included.
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
// WHOLE FILE (11, 12 and 13 of 16) by nature: a dependency array, and a useState
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
  const endCheck = shortCircuitAfter(screen, closeOf, endBlock, endAt);
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
    // WHOLE FILE (14 of 16): finding a stray release IS the point of this rule.
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
  // A gate is judged by the SET of identifiers it depends on, never by an
  // operator. The previous version greped `!closeError`, so the same gate written
  // `closeError === null && !error && ...` walked straight through: a refused close
  // destroyed the question view again, and silently this time, since the message
  // paragraph lives inside the very block that gate closes.
  const closeStates = endSetters
    .map((setter) => `${setter.slice(3, 4).toLowerCase()}${setter.slice(4)}`)
    .filter((stateName) => new RegExp(`\\b${stateName}\\b`).test(screen));
  if (closeStates.length > 0) {
    // WHOLE FILE (15 and 16 of 16): the close state is looked up in the file, and a
    // render gate can sit in any JSX expression of it.
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
  "check:client-attempt-contract OK : MEASURED BY EXECUTION, the generator emits an " +
    "identifier the server pattern accepts, in both crypto branches, and never twice the " +
    "same; two argument-less starts return ONE identifier and it is the one left in storage; " +
    "a stored identifier comes back byte for byte; a fresh attempt differs and is persisted; " +
    "blocked storage degrades instead of throwing; the adopting function stores the value " +
    "handed to it, exactly, is idempotent, and refuses anything that is not an identifier; " +
    "the release empties the key. CHECKED STATICALLY, the payload sends the symbol the " +
    "storing function returned, the adopting function is handed the payload's sessionId path " +
    "after a refused response has been short-circuited on both paths, re-entrance is tested " +
    "then closed synchronously and released in a finally on both paths, the release of the " +
    "identifier happens only in the close and only after its check, the identifier is in no " +
    "dependency array and in no React state, the close writes a state the start path does " +
    "not and that state appears in no compound render gate, and every training path fetched " +
    "here resolves to a route file that exists."
);
