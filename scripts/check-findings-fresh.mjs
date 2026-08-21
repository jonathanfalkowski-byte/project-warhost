// docs/balance.md has to say what the sweep currently says.
//
// It drifted three commits once — the sweep closed the declaration gap in 4cc5b36 and the
// findings kept reporting the open one, because regenerating is a separate manual step and
// nothing failed when it was skipped. The stale number was then read as current and an
// entire review was written on it. That is the whole failure mode: the doc is the only
// place a retired number still exists, and it reads exactly like a live one.
//
// THIS USED TO COMPARE COMMIT TIMES, and that was wrong in a way that took a day to show.
// It watched scripts/battle-sweep.mjs and src/battle, and failed when either was newer than
// the findings. But a change under src/battle that does not move the sweep's OUTPUT — moving
// display logic into a pure function, say — makes that check fail forever: regenerating
// produces a byte-identical file, so there is nothing to commit, so the findings' commit
// time never advances, so it fails again. A false positive with no way out is worse than
// the staleness it was written to catch.
//
// So it asks the real question instead. Run the sweep, render the document it implies, and
// compare. No timestamps, no proxies: either the file says what the sweep says or it does
// not. The sweep is deterministic and byte-identical across runs, which is what makes this
// possible at all.
//
// It checks the verdicts from the same run, because it has them in hand and a second run
// would cost another hundred seconds to learn something already on screen.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SWEEP = path.join(ROOT, "scripts", "battle-sweep.mjs");
const FINDINGS = path.join(ROOT, "docs", "balance.md");
const FINDINGS_LABEL = "docs/balance.md";

// The document is a pure function of the sweep, written in ONE place so the file and the
// check can never disagree about its shape. The npm preamble the old file carried is gone:
// two lines describing how the output was obtained are not findings, and they made the
// document depend on which command produced it rather than on what it measured.
const documentFor = (sweep) => `# Balance findings

Regenerate with \`npm run check:findings -- --write\`.

\`\`\`
${sweep.replace(/\s*$/, "")}
\`\`\`
`;

const runSweep = () => execFileSync(process.execPath, [SWEEP], {
  cwd: ROOT,
  encoding: "utf8",
  shell: false,
  // The sweep prints every axis in full; the default buffer is not enough for it.
  maxBuffer: 64 * 1024 * 1024,
});

const write = process.argv.includes("--write");

let sweep;
try {
  sweep = runSweep();
} catch (error) {
  console.error("findings freshness: the sweep did not complete, so nothing can be checked");
  console.error(String(error?.stderr || error?.message || error).slice(0, 2000));
  process.exit(1);
}

const expected = documentFor(sweep);

if (write) {
  writeFileSync(FINDINGS, expected, { encoding: "utf8" });
  console.log(`findings: wrote ${FINDINGS_LABEL} from the current sweep`);
  process.exit(0);
}

let actual;
try {
  actual = readFileSync(FINDINGS, { encoding: "utf8" });
} catch {
  console.error(`findings freshness: ${FINDINGS_LABEL} is missing. Write it with:`);
  console.error("      npm run check:findings -- --write");
  process.exit(1);
}

if (actual !== expected) {
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const at = expectedLines.findIndex((line, index) => line !== actualLines[index]);
  console.error("findings freshness: STALE");
  console.error(`  ${FINDINGS_LABEL} does not match what the sweep currently prints.`);
  if (at >= 0) {
    console.error(`  first difference at line ${at + 1}:`);
    console.error(`    committed: ${JSON.stringify(actualLines[at] ?? "(end of file)")}`);
    console.error(`    swept:     ${JSON.stringify(expectedLines[at] ?? "(end of file)")}`);
  } else {
    console.error(`  the files differ in length: committed ${actualLines.length} lines, swept ${expectedLines.length}`);
  }
  console.error("");
  console.error("  Regenerate it:");
  console.error("      npm run check:findings -- --write");
  process.exit(1);
}

// Same run, second question. A FAIL is a balance claim that has stopped being true, and it
// should stop a merge exactly like a failing test.
const failures = sweep.split("\n").filter((line) => /^\s+FAIL/.test(line));
if (failures.length > 0) {
  console.error(`findings: the sweep reported ${failures.length} FAIL verdict(s)`);
  for (const line of failures) console.error(line);
  process.exit(1);
}

console.log(`findings: ${FINDINGS_LABEL} matches the current sweep, and no verdict FAILs`);
