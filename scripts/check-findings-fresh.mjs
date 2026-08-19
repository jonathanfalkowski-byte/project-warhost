// docs/balance.md has to say what the sweep currently says.
//
// It drifted three commits once — the sweep closed the declaration gap in 4cc5b36 and the
// findings kept reporting the open one, because regenerating is a separate manual step and
// nothing failed when it was skipped. The stale number was then read as current and an
// entire review was written on it. That is the whole failure mode: the doc is the only
// place a retired number still exists, and it reads exactly like a live one.
//
// So: if the sweep changed more recently than the findings did, the findings are stale.
// Compared by COMMIT TIME rather than file mtime, because a clone has no useful mtimes —
// every file arrives at checkout time. Needs full history; a shallow clone is not an error,
// it is just a check that cannot run, and it says so rather than failing.

import { execFileSync } from "node:child_process";

const SWEEP = "scripts/battle-sweep.mjs";
const FINDINGS = "docs/balance.md";

const lastCommitTime = (path) => {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--", path], { encoding: "utf8" }).trim();
    return out ? Number(out) : null;
  } catch {
    return null;
  }
};

const sweep = lastCommitTime(SWEEP);
const findings = lastCommitTime(FINDINGS);

if (sweep === null || findings === null) {
  console.log(`findings freshness: SKIPPED — no commit history for ${sweep === null ? SWEEP : FINDINGS}`);
  process.exit(0);
}

if (sweep > findings) {
  console.error(`findings freshness: STALE`);
  console.error(`  ${SWEEP} last changed ${new Date(sweep * 1000).toISOString()}`);
  console.error(`  ${FINDINGS} last changed ${new Date(findings * 1000).toISOString()}`);
  console.error(``);
  console.error(`  The sweep changed after the findings were written, so docs/balance.md is`);
  console.error(`  reporting numbers the current sweep no longer produces. Regenerate it:`);
  console.error(``);
  console.error(`      npm run analyse > /tmp/sweep.txt`);
  console.error(`      then rewrite docs/balance.md around that output`);
  process.exit(1);
}

console.log(`findings freshness: OK — ${FINDINGS} is at or ahead of ${SWEEP}`);
