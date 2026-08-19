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

// EVERY INPUT, not just the sweep. The first version of this watched scripts/battle-sweep.mjs
// alone, which misses the commoner way the findings go stale: the sweep is unchanged and the
// GAME changed underneath it. Gating the FULL REBUILD offer moved what every reward policy
// buys, so the run axis reported different numbers from an identical script.
const INPUTS = ["scripts/battle-sweep.mjs", "src/battle"];
const FINDINGS = "docs/balance.md";

const lastCommitTime = (path) => {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%ct", "--", path], { encoding: "utf8" }).trim();
    return out ? Number(out) : null;
  } catch {
    return null;
  }
};

const stamps = INPUTS.map((path) => ({ path, at: lastCommitTime(path) }));
const findings = lastCommitTime(FINDINGS);
const newest = stamps.filter((entry) => entry.at !== null)
  .reduce((best, entry) => (best === null || entry.at > best.at ? entry : best), null);

if (newest === null || findings === null) {
  console.log(`findings freshness: SKIPPED — no commit history for ${newest === null ? INPUTS.join(" or ") : FINDINGS}`);
  process.exit(0);
}

const sweep = newest.at;

if (sweep > findings) {
  console.error(`findings freshness: STALE`);
  console.error(`  ${newest.path} last changed ${new Date(sweep * 1000).toISOString()}`);
  console.error(`  ${FINDINGS} last changed ${new Date(findings * 1000).toISOString()}`);
  console.error(``);
  console.error(`  A sweep input changed after the findings were written, so docs/balance.md is`);
  console.error(`  reporting numbers the current sweep no longer produces. Regenerate it:`);
  console.error(``);
  console.error(`      npm run analyse > /tmp/sweep.txt`);
  console.error(`      then rewrite docs/balance.md around that output`);
  process.exit(1);
}

console.log(`findings freshness: OK — ${FINDINGS} is at or ahead of ${newest.path}`);
