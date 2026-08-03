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
// anywhere, and a reload opens a second session again. That silence is why this
// guard pins the generator instead of trusting the shape to stay right.
//
// HOW IT READS THE SOURCE, and why it does it the hard way. Three guards earlier
// in this plan shipped vacuous for two reasons that both apply here: matching a
// substring against the whole file, and stripping comments badly. GameScreen.tsx
// carries long comments that NAME the very things asserted below, including the
// end path, so a bare substring test would be green on an empty implementation.
// So: comments are blanked first (both forms, strings and template literals left
// alone), and every rule is then scoped to the function that actually does the
// work, located by brace matching rather than by name, so a rename is not a
// false positive. The pure part of that machinery self-tests below on synthetic
// lines before a single rule runs.
//
// This script is standalone on purpose: it guards
// features/game/components/GameScreen.tsx, plus the existence of the route that
// file now calls, and is coupled to no other module's lifecycle.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCREEN = "features/game/components/GameScreen.tsx";
const END_ROUTE = "app/api/training/session/end/route.ts";
const CONTRACTS = "lib/game/training/contracts.ts";

const failures = [];
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

// ---------------------------------------------------------------- pure helpers

// Blanks comments and keeps every other byte at its own offset, so an index into
// the result is still an index into the file. Both forms are handled, the line
// form and the block form, the second being the one a previous guard in this plan
// forgot. String and template literals are walked through, so a "//" inside a
// path literal, or a "/*" inside a message, is not read as the start of a
// comment. Regex literals are recognised by what precedes them, which is the
// usual heuristic and is what stops /https:\/\// from eating the rest of a line.
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
      // Template literals may nest, so depth is tracked rather than assumed.
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
      // Division or a regex literal. Only a regex can contain "//" or "/*"
      // without meaning a comment, and only the previous token tells them apart.
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

// Every brace pair of a comment-free source, skipping braces that live inside a
// string or a template literal. Template expressions are re-entered as code, so
// `${ { a: 1 } }` neither unbalances the count nor hides a block.
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
// signature. `try {`, `if (...) {` and an object literal are not, which is what
// makes this return the function that does the work rather than the try block
// inside it or the component body around it.
const FUNCTION_HEAD = /(?:=>|\bfunction\b[^(){}]*\([^()]*\))\s*$/;

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

// uuid v4 out of raw bytes, the exact algorithm the client's documented fallback
// has to implement: version nibble forced to 4, variant nibble forced into 8 to
// b. Used below to check the server's pattern really accepts that shape.
const v4FromBytes = (bytes) => {
  const copy = Uint8Array.from(bytes);
  copy[6] = (copy[6] & 0x0f) | 0x40;
  copy[8] = (copy[8] & 0x3f) | 0x80;
  const hex = Array.from(copy, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

// -------------------------------------------------------------------- selftest
// The rules below are only as good as the two functions above, so those two are
// exercised on synthetic lines first. A guard whose slicer silently returned the
// whole file would certify anything, which is precisely how earlier guards in
// this plan shipped vacuous.
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

  // Slicing: the marker sits in a try block, inside an arrow, inside an object,
  // and the enclosing FUNCTION is the arrow, not the try and not the outer body.
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
    expect(
      "selftest slice is not the whole file",
      body.length < sample.length,
      true
    );
  }
  // A brace inside a string must not shift the pairing.
  expect(
    "string braces ignored by the scanner",
    scanBraces('const a = "{"; const b = { c: 1 };').length,
    1
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

// ------------------------------------------------------------------- the rules

const screenRaw = read(SCREEN);
const screen = stripComments(screenRaw);
const pairs = scanBraces(screen);
const closeOf = new Map(pairs.map((pair) => [pair.open, pair.close]));

// What the request really carries, so a rule can assert on the payload instead
// of on the whole function. Both shapes are resolved: the object literal written
// inline in JSON.stringify, and a named object built just before the fetch, which
// is a legitimate refactor and must not read as a missing field.
const stringifyBodyAfter = (from, limit) => {
  const marker = "JSON.stringify(";
  const at = screen.indexOf(marker, from);
  if (at === -1 || at > limit) return null;
  const rest = screen.slice(at + marker.length);

  const inline = /^\s*\{/.exec(rest);
  if (inline) {
    const brace = at + marker.length + inline[0].length - 1;
    return closeOf.has(brace) ? screen.slice(brace, closeOf.get(brace) + 1) : null;
  }

  const named = /^\s*([A-Za-z_$][\w$]*)\s*\)/.exec(rest);
  if (!named) return null;
  const declaration = new RegExp(
    `(?:const|let|var)\\s+${named[1]}\\s*(?::[^=;]*)?=\\s*\\{`
  ).exec(screen);
  if (!declaration) return null;
  const brace = screen.indexOf("{", declaration.index);
  return closeOf.has(brace) ? screen.slice(brace, closeOf.get(brace) + 1) : null;
};

// ---------------------------------------------------- 1. the route it now calls
// The client ships a 404 into history if this lands without its callee. Green in
// the working tree, where the file exists untracked, and red from a clean
// extraction of HEAD, which is the run that counts. Existence alone is not the
// rule: an empty file, or one exporting another verb, answers 405 to the same
// caller, which is a 404 with better manners.
if (!fs.existsSync(path.join(ROOT, END_ROUTE))) {
  failures.push(
    `${END_ROUTE} does not exist, but ${SCREEN} calls it. Commit the route in the same commit as its caller.`
  );
} else {
  const endRoute = stripComments(read(END_ROUTE));
  if (!/export\s+(?:async\s+)?function\s+POST|export\s+const\s+POST\s*=/.test(endRoute)) {
    failures.push(
      `${END_ROUTE} exports no POST handler, and ${SCREEN} posts to it. The close would answer 405 and every session would stay open.`
    );
  }
  if (!/endTrainingSession/.test(endRoute)) {
    failures.push(
      `${END_ROUTE} never calls endTrainingSession, so nothing closes the session row. The screen would announce a close the database never saw.`
    );
  }
}

// ------------------------------------- 2. client generator against server rules
// Cross-file, and executed rather than eyeballed: the pattern is lifted out of
// contracts.ts and run against real crypto.randomUUID output and against the
// documented byte fallback. If someone narrows the pattern (to version 7, say),
// or widens it in a way that no longer accepts what the client mints, this fails
// here instead of failing in silence on a page load.
let serverPattern = null;
try {
  const contracts = stripComments(read(CONTRACTS));
  const literal = contracts.match(
    /ATTEMPT_ID_PATTERN\s*(?::[^=]*)?=\s*(\/(?:[^/\\\n]|\\.)+\/[a-z]*)/
  );
  if (!literal) {
    failures.push(
      `${CONTRACTS}: no ATTEMPT_ID_PATTERN regex literal found. That pattern is the only thing that decides whether the identifier this client mints is usable, and a client identifier it rejects is dropped without any error.`
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

// -------------------------------------------------- 3. one storage key, three uses
// Read, write and release must name the SAME constant. A write to a key the read
// never looks at loses the identifier on every reload while looking perfectly
// correct, and a release on another key never lets a closed session go.
const getItemKey = screen.match(/sessionStorage\.getItem\(\s*([A-Za-z_$][\w$]*)\s*\)/);
const setItemKey = screen.match(/sessionStorage\.setItem\(\s*([A-Za-z_$][\w$]*)\s*,/);
const removeItemKey = screen.match(/sessionStorage\.removeItem\(\s*([A-Za-z_$][\w$]*)\s*\)/);

if (!getItemKey || !setItemKey) {
  failures.push(
    `${SCREEN}: the attempt identifier is not read from and written to sessionStorage under a named key. Minting it on the response loses it whenever a reload aborts the call in flight, and a literal key repeated at each call site drifts.`
  );
} else if (getItemKey[1] !== setItemKey[1]) {
  failures.push(
    `${SCREEN}: sessionStorage is read under ${getItemKey[1]} and written under ${setItemKey[1]}. The reload would never find what the first load stored, and every load would look like a new attempt.`
  );
}
if (!removeItemKey) {
  failures.push(
    `${SCREEN}: nothing ever releases the stored attempt identifier. A closed session must let its identifier go, or the next start replays an identifier whose session is already closed.`
  );
} else if (setItemKey && removeItemKey[1] !== setItemKey[1]) {
  failures.push(
    `${SCREEN}: sessionStorage is written under ${setItemKey[1]} and cleared under ${removeItemKey[1]}. The identifier of a closed session would survive for ever.`
  );
}

// ---------------------------------------------------------- 4. the generator
// Located by its fallback, so the rule holds under any name. crypto.randomUUID
// is pinned because it emits version 4, the only family the server accepts, and
// the fallback exists because randomUUID is undefined outside a secure context,
// so a phone on the dev server over a local IP would throw on the first render.
const randomValuesAt = screen.indexOf("getRandomValues");
let mintName = null;
if (randomValuesAt === -1) {
  failures.push(
    `${SCREEN}: no getRandomValues fallback for the identifier. crypto.randomUUID is undefined outside a secure context, so testing on a device over a local IP throws on the very first render.`
  );
} else {
  const mintBlock = enclosingFunction(screen, pairs, randomValuesAt);
  if (!mintBlock) {
    failures.push(`${SCREEN}: getRandomValues is not inside a function this guard can slice.`);
  } else {
    mintName = declaredName(screen, mintBlock.open);
    const mintBody = screen.slice(mintBlock.open, mintBlock.close);

    if (!/crypto\.randomUUID\s*\(/.test(mintBody)) {
      failures.push(
        `${SCREEN}: the identifier is no longer minted by crypto.randomUUID. The server pattern accepts versions 1 to 5 only, so another generator (a uuidv7, or anything home made) is refused in silence: the server mints its own, nothing is logged, and the reload opens a second session again.`
      );
    }
    if (/\bDate\.now\s*\(|\buuidv?7\b/i.test(mintBody)) {
      failures.push(
        `${SCREEN}: the identifier looks time ordered (a uuidv7 marker). Its version nibble would be 7, which the server pattern refuses in silence.`
      );
    }

    // EXECUTED, not eyeballed. Every rule above recognises a shape someone
    // thought of; running the generator proves what it actually emits, whatever
    // it looks like. It is extracted from this file, so it also proves the
    // generator stays plain: no import, no module-level dependency, nothing this
    // guard cannot run, which is the same constraint check-day-keys.mjs puts on
    // lib/profile/day-keys.ts and for the same reason.
    if (serverPattern && mintName) {
      const declarationAt = screen.lastIndexOf(`const ${mintName}`, mintBlock.open);
      const source = screen.slice(
        declarationAt === -1 ? mintBlock.open : declarationAt,
        mintBlock.close + 1
      );
      // Just enough TypeScript removed to run it: the return annotation of an
      // arrow, casts, and annotations on simple locals.
      const asJs = source
        .replace(/\)\s*:\s*[^={;]*=>/g, ") =>")
        .replace(/\bas\s+(?:const|[A-Za-z_$][\w$<>[\].|\s]*)/g, "")
        .replace(/:\s*(?:string|number|boolean|Uint8Array)\b(?!\s*\()/g, "");

      let factory = null;
      try {
        // `crypto` as a parameter shadows the global inside the extracted
        // function, which is what lets the fallback branch be exercised.
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
            scope: {
              getRandomValues: (bytes) => globalThis.crypto.getRandomValues(bytes),
            },
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
            for (let draw = 0; draw < 200 && !rejected && !repeated; draw += 1) {
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

    const versionAssign = /\[\s*6\s*\]\s*=([^;\n]*)/.exec(mintBody);
    const variantAssign = /\[\s*8\s*\]\s*=([^;\n]*)/.exec(mintBody);
    if (!versionAssign || !/0x4/i.test(versionAssign[1])) {
      failures.push(
        `${SCREEN}: the fallback does not force the version nibble to 4 (byte 6 combined with 0x40). A well formed random uuid of another version passes every client-side test and is still refused in silence by the server.`
      );
    }
    if (versionAssign && /0x[1357]0\b/i.test(versionAssign[1]) && !/0x40/i.test(versionAssign[1])) {
      failures.push(
        `${SCREEN}: the fallback forces a version nibble other than 4 on byte 6.`
      );
    }
    if (!variantAssign || !/0x8/i.test(variantAssign[1])) {
      failures.push(
        `${SCREEN}: the fallback does not force the variant nibble into 8 to b (byte 8 combined with 0x80). The server pattern refuses any other variant, in silence.`
      );
    }
  }
}

if (/from\s*["']uuid["']|require\(\s*["']uuid["']\s*\)/.test(screen)) {
  failures.push(
    `${SCREEN}: imports a uuid library. The generator is pinned to crypto.randomUUID because it emits version 4, the only family the server pattern accepts, and a library default may not.`
  );
}

// ------------------------------------------- 5. minted and persisted together
// The function that writes the identifier has to be the one that mints it, and
// it has to read before it writes. An unconditional write turns every retry into
// a new attempt, and a write that happens anywhere else than at mint time is a
// write that can be skipped.
let storeName = null;
if (setItemKey) {
  const setItemAt = screen.indexOf("sessionStorage.setItem");
  const storeBlock = enclosingFunction(screen, pairs, setItemAt);
  if (!storeBlock) {
    failures.push(`${SCREEN}: sessionStorage.setItem is not inside a function this guard can slice.`);
  } else {
    storeName = declaredName(screen, storeBlock.open);
    const storeBody = screen.slice(storeBlock.open, storeBlock.close);
    const getAt = storeBody.indexOf("sessionStorage.getItem");
    const setAt = storeBody.indexOf("sessionStorage.setItem");

    if (getAt === -1) {
      failures.push(
        `${SCREEN}: ${storeName ?? "the storing function"} writes the identifier without reading the stored one first. The write must be conditional, or a retry overwrites the identifier of the attempt it is retrying and the server sees a brand new attempt.`
      );
    } else if (getAt > setAt) {
      failures.push(
        `${SCREEN}: ${storeName ?? "the storing function"} writes the identifier before reading the stored one, so the stored value can never be replayed.`
      );
    } else {
      // Reading is not replaying. A read whose value is never returned leaves the
      // write unconditional in practice, so every load mints again and the bug is
      // back with a guard that saw a getItem call and was happy.
      const readInto = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*)?=[^;]*sessionStorage\.getItem/.exec(
        storeBody
      );
      const returnedDirectly = /return[^;]*sessionStorage\.getItem/.test(storeBody.slice(0, setAt));
      if (!readInto && !returnedDirectly) {
        failures.push(
          `${SCREEN}: ${storeName ?? "the storing function"} reads sessionStorage without keeping the value. The stored identifier has to be the value returned, otherwise the read is decoration and every load mints a new attempt.`
        );
      } else if (readInto) {
        const replay = new RegExp(`return\\s+${readInto[1]}\\b`).exec(storeBody);
        if (!replay) {
          failures.push(
            `${SCREEN}: ${storeName ?? "the storing function"} reads the stored identifier into ${readInto[1]} and never returns it. A retry, and a reload, would mint a new attempt while looking as if they replayed one.`
          );
        } else if (replay.index > setAt) {
          failures.push(
            `${SCREEN}: ${storeName ?? "the storing function"} returns the stored identifier only after having overwritten it. The stored value is lost before it can be replayed.`
          );
        }
      }
    }
    if (mintName && !new RegExp(`\\b${mintName}\\s*\\(`).test(storeBody)) {
      failures.push(
        `${SCREEN}: the identifier is persisted somewhere other than where it is minted. Persisting at mint time is the whole point: a reload that aborts the request in flight must still be able to resend the same identifier.`
      );
    }
  }
}

// --------------------------------------------------------- 6. the start request
const startFetch = /fetch\(\s*["'`]\/api\/training\/session\/start/.exec(screen);
let startName = null;
if (!startFetch) {
  failures.push(`${SCREEN}: no call to /api/training/session/start.`);
} else {
  const fetchAt = startFetch.index;
  const startBlock = enclosingFunction(screen, pairs, fetchAt);
  if (!startBlock) {
    failures.push(`${SCREEN}: the start request is not inside a function this guard can slice.`);
  } else {
    startName = declaredName(screen, startBlock.open);
    const label = startName ?? "the start function";
    const beforeFetch = screen.slice(startBlock.open, fetchAt);
    const wholeStart = screen.slice(startBlock.open, startBlock.close);
    const signature = screen.slice(Math.max(0, startBlock.open - 300), startBlock.open);

    // 6a. the identifier exists before the request leaves.
    if (!/\battemptId\b/.test(beforeFetch)) {
      failures.push(
        `${SCREEN}: ${label} names no attemptId before the request leaves. Minting it on the response loses it in exactly the case that creates the duplicate: a reload aborts the call, nothing is stored here, and the server has already written its row.`
      );
    }
    if (storeName && !new RegExp(`\\b${storeName}\\s*\\(`).test(beforeFetch)) {
      failures.push(
        `${SCREEN}: ${label} does not obtain the identifier from ${storeName} before the request. Whatever it sends is then not the value that survives a reload.`
      );
    }

    // 6b. it is actually sent. Minted, persisted and never transmitted is the
    // exact failure this plan is closing, and it is invisible from the client.
    const sentBody = stringifyBodyAfter(fetchAt, startBlock.close);
    if (!sentBody) {
      failures.push(`${SCREEN}: the start request has no JSON.stringify payload this guard can read.`);
    } else if (!/\battemptId\b/.test(sentBody)) {
      failures.push(
        `${SCREEN}: the start request payload carries no attemptId. The server then mints its own and every reload opens a new session, which is the bug this contract closes.`
      );
    } else {
      // And it has to be the persisted value, not a value computed on the spot.
      // `attemptId: crypto.randomUUID()` sends a well formed identifier that
      // changes at every call, which is the original bug wearing the right name.
      const entry = /\battemptId\b\s*(?::\s*([^,}\n]*))?/.exec(sentBody);
      const value = entry && entry[1] ? entry[1].trim() : null;
      if (value && /\(/.test(value)) {
        failures.push(
          `${SCREEN}: the start payload computes its attemptId inline (${value}). It must send the value that was read from or written to storage, or every call sends a different identifier and the server opens a session for each.`
        );
      }
      if (value && mintName && new RegExp(`\\b${mintName}\\b`).test(value)) {
        failures.push(
          `${SCREEN}: the start payload mints its attemptId in place. The identifier has to be persisted before the request, or a reload that aborts the call cannot resend it.`
        );
      }
    }

    // 6c. the re-entrance guard, synchronous and before the request. The ref is
    // found by its use, so renaming it is not a false positive.
    const earlyReturn = /if\s*\(\s*([A-Za-z_$][\w$]*)\.current\s*\)\s*(?:\{\s*)?return/.exec(
      beforeFetch
    );
    if (!earlyReturn) {
      failures.push(
        `${SCREEN}: ${label} has no synchronous re-entrance guard reading a ref before the request. disabled={isLoading} only becomes true on the next render, so a fast double click, or a mount effect that runs twice, fires two starts.`
      );
    } else {
      const refName = earlyReturn[1];
      const setTrue = new RegExp(`${refName}\\.current\\s*=\\s*true`).exec(beforeFetch);
      if (!setTrue) {
        failures.push(
          `${SCREEN}: ${refName} is tested before the start request but never set before it. A guard that closes after the await guards nothing.`
        );
      } else if (/\bawait\b/.test(beforeFetch.slice(0, setTrue.index))) {
        failures.push(
          `${SCREEN}: ${refName} is only closed after an await, so the test and the closing are no longer one synchronous step. Two callers can both pass the test before either one closes it, which is the very race this ref exists to stop.`
        );
      }
      if (!new RegExp(`${refName}\\.current\\s*=\\s*false`).test(wholeStart)) {
        failures.push(
          `${SCREEN}: ${refName} is never released inside ${label}. The first call would latch the guard for ever and Retry session would be dead.`
        );
      }
      if (!new RegExp(`const\\s+${refName}\\s*=\\s*useRef`).test(screen)) {
        failures.push(
          `${SCREEN}: ${refName} is not a useRef. A value that lives in state is only readable on the next render, which is exactly what lets the second call through.`
        );
      }
    }

    // 6d. a retry replays, a new attempt mints. Same function, opposite jobs, so
    // it takes a parameter and the two callers must not be identical.
    if (!/\bfresh\b/.test(signature)) {
      failures.push(
        `${SCREEN}: ${label} takes no fresh parameter. A retry is the same attempt and must replay its identifier, while Play again is a new attempt and must mint one, so the two callers cannot share an argument-less function.`
      );
    }
    if (storeName) {
      const handOver = new RegExp(`${storeName}\\(\\s*\\{([^}]*)\\}`).exec(beforeFetch);
      if (!handOver || !/\bfresh\b/.test(handOver[1])) {
        failures.push(
          `${SCREEN}: the fresh flag is not what decides whether the identifier is replayed or minted. It has to reach ${storeName}, or Play again silently continues the previous attempt.`
        );
      } else if (/\bfresh\s*:\s*(?:true|false)\b/.test(handOver[1])) {
        failures.push(
          `${SCREEN}: the call to ${storeName} hard-wires fresh to a literal (${handOver[1].trim()}), so the parameter no longer decides anything. Wired to false, Play again rejoins the session the player just closed; wired to true, every reload opens a new one, which is the bug itself.`
        );
      }
    }
    if (startName) {
      const freshCall = new RegExp(`${startName}\\(\\s*\\{\\s*fresh\\s*:\\s*true`).test(screen);
      const plainCall = new RegExp(`${startName}\\(\\s*\\)`).test(screen);
      if (!freshCall) {
        failures.push(
          `${SCREEN}: no caller asks ${startName} for a fresh attempt. Play again must mint a new identifier, otherwise it rejoins the session the player just closed.`
        );
      }
      if (!plainCall) {
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
  }
}

// ------------------------------------------------- 7. out of every dependency
// Anchored on the shape of a hook call, `}, [ ... ]`, NOT on any bracket pair
// containing the substring. The loose form /\[[^\]]*attemptId[^\]]*\]/ matches a
// destructuring like `const [attemptId, setAttemptId]` and any array literal
// mentioning attemptIdRef, so it would fire on correct code.
if (/\}\s*,\s*\[[^\]]*attemptId/.test(screen)) {
  failures.push(
    `${SCREEN}: attemptId entered a React dependency array. The mount effect would re-run on every answer and restart the session.`
  );
}
// Second form of the same rule, for a hook whose handler is not an inline arrow:
// `useEffect(handler, [attemptId])` has no closing brace before the comma. The
// word boundary keeps wrongAttemptIds and attemptIdRef out of it.
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

// ----------------------------------------------------------- 8. the end request
// A real call, not a mention. This file NAMES the end path in the comment that
// explains the completion branch, so a bare /api\/training\/session\/end test
// would be green on an implementation that closes nothing. Comments are blanked
// above, and the rule is scoped to the function that carries the fetch.
const endFetch = /fetch\(\s*["'`]\/api\/training\/session\/end/.exec(screen);
if (!endFetch) {
  failures.push(
    `${SCREEN}: nothing closes the session. A training session has no round cap any more, so it stays active for ever unless the client actually calls the end path, not merely mentions it in a comment.`
  );
} else {
  const endAt = endFetch.index;
  const endBlock = enclosingFunction(screen, pairs, endAt);
  if (!endBlock) {
    failures.push(`${SCREEN}: the end request is not inside a function this guard can slice.`);
  } else {
    const endBody = screen.slice(endBlock.open, endBlock.close);
    const rel = (needle, from = 0) => {
      const at = endBody.indexOf(needle, from);
      return at;
    };
    const fetchRel = endAt - endBlock.open;
    const sentBody = stringifyBodyAfter(endAt, endBlock.close);

    if (!sentBody || !/\bsessionId\b/.test(sentBody)) {
      failures.push(
        `${SCREEN}: the end request carries no sessionId. That is the only thing the route needs from the body.`
      );
    }
    if (sentBody && /\buserId\b/.test(sentBody)) {
      failures.push(
        `${SCREEN}: the end request declares a userId. Identity comes from the httpOnly guest cookie, and the route refuses a body that disagrees with it, so sending one can only turn a working close into a 403.`
      );
    }

    const okAt = /\.ok\b/.exec(endBody);
    const completeAt = rel("setIsComplete(true)");
    if (completeAt === -1) {
      failures.push(
        `${SCREEN}: setIsComplete(true) is not called by the function that closes the session, so the "Session complete" branch and the "Play again" block stay unreachable.`
      );
    } else if (completeAt < fetchRel) {
      failures.push(
        `${SCREEN}: setIsComplete(true) runs before the end request. The screen would announce a closed session the server may have refused.`
      );
    }
    if (!okAt || okAt.index < fetchRel) {
      failures.push(
        `${SCREEN}: the end request result is never checked. A refused close would be treated as a success, the identifier would be dropped, and the next load would open a second session next to one still open.`
      );
    }
    if (removeItemKey) {
      const dropAt = screen.indexOf("sessionStorage.removeItem");
      const dropBlock = enclosingFunction(screen, pairs, dropAt);
      const dropName = dropBlock ? declaredName(screen, dropBlock.open) : null;
      const callRel = dropName
        ? endBody.search(new RegExp(`\\b${dropName}\\s*\\(`))
        : rel("sessionStorage.removeItem");
      if (callRel === -1) {
        failures.push(
          `${SCREEN}: the closing function never releases the stored identifier. The next start would replay the identifier of a session that is already closed.`
        );
      } else if (okAt && callRel < okAt.index) {
        failures.push(
          `${SCREEN}: the stored identifier is released before the close is known to have succeeded. A failed close would then leave a session open and the next load would open a second one beside it.`
        );
      }
    }
  }
}
if (!/setIsComplete\(true\)/.test(screen)) {
  failures.push(
    `${SCREEN}: setIsComplete(true) is called nowhere, so the "Session complete" branch and the "Play again" block are unreachable.`
  );
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
  "check:client-attempt-contract OK : the identifier is a version 4 uuid the server pattern " +
    "really accepts, minted and persisted under one key before the request, sent in it, kept out " +
    "of every dependency array and out of React state, guarded against re-entrance by a ref set " +
    "synchronously, replayed on retry, renewed on Play again, released only after a close the " +
    "server confirmed, and the end route it calls exists."
);
