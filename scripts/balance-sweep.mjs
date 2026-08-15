// Exhaustive balance sweep for Operation Dead Circuit.
//
// The outcome pipeline is deterministic, so the entire decision space can be
// resolved rather than sampled: every formation permutation, against every
// total-army play, under every disclosed mission pressure, for every combination of
// authored breakpoint responses. Roughly four thousand outcomes in about a second.
//
//   npm run analyse:balance
//
// Use it after any change to formation capabilities, playbook timing, mission
// pressure, or enemy plans, to check the design claims in AGENTS.md still hold:
// that placement changes outcomes, that no placement is universally dominant, that
// the plays genuinely differ, and that every disclosed pressure is winnable.

import { pathToFileURL } from "node:url";

import { FORMATIONS, defaultRefits, resolveFormations } from "../src/formationData.js";
import { PLAYBOOKS, playbookForOperation } from "../src/playbookData.js";
import { OPERATIONS, breakpointsFor } from "../src/operationData.js";
import { missionPressureFor, missionPressuresForOperation } from "../src/missionPressure.js";
import {
  calculateOperationProfile,
  calculatePlacementReadiness,
  calculateRefitProtocols,
  evaluateTacticalSequence,
} from "../src/operationResolution.js";

const permutations = (items) => (items.length <= 1 ? [items] : items.flatMap(
  (item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)])
    .map((rest) => [item, ...rest]),
));

// The roster is larger than the number of action stops, so a plan is two decisions:
// which formations to field, then in what order. `combinations` enumerates the list
// decision; `permutations` enumerates the ordering of a chosen list.
const combinations = (items, size) => (size === 0 ? [[]] : items.flatMap(
  (item, index) => combinations(items.slice(index + 1), size - 1).map((rest) => [item, ...rest]),
));

// Every ordered way to fill `size` stops from the roster.
const arrangements = (items, size) => combinations(items, size).flatMap(permutations);

// Every combination of installed refit packages. Refits change a formation's
// capabilities, and capabilities decide how well it answers a stop's demands, so this
// is a full dimension of the decision space rather than a cosmetic choice.
// Varies only the formations actually being fielded. Enumerating the whole roster
// would be 2^9 loadouts for a five-slot plan, most of them differing only in units
// that never deploy.
export const refitCombinations = (roster = null) => FORMATIONS
  .filter((formation) => !roster || roster.includes(formation.id))
  .reduce(
    (acc, formation) => acc.flatMap((partial) => formation.refits.map((refit) => ({ ...partial, [formation.id]: refit.id }))),
    [{}],
  );

// `roster` narrows which formations may be fielded. Sweeping the whole roster answers
// the list question (which five) and the ordering question together, which is 544,320
// outcomes; pinning the roster to exactly five answers the ordering question alone in
// 4,320. Tests use whichever axis they are actually asserting about.
export const sweepOperation = (operation = OPERATIONS[0], { refits = defaultRefits(), roster = null } = {}) => {
  const formations = resolveFormations(refits);
  const formationIds = (roster ?? FORMATIONS.map((formation) => formation.id));
  const branchSets = breakpointsFor(operation).reduce((acc, breakpoint) => acc.flatMap(
    (partial) => breakpoint.options.map((option) => ({ ...partial, [breakpoint.id]: option.id })),
  ), [{}]);

  const rows = [];
  for (const pressure of missionPressuresForOperation(operation.id)) {
    const condition = missionPressureFor(pressure.id, operation.id);
    for (const basePlaybook of PLAYBOOKS) {
      const playbook = playbookForOperation(basePlaybook, operation);
      for (const order of arrangements(formationIds, playbook.roles.length)) {
        const assignments = Object.fromEntries(playbook.roles.map((role, index) => [role.id, order[index]]));
        const sequence = evaluateTacticalSequence(playbook, assignments, formations);
        const readiness = calculatePlacementReadiness(playbook, assignments, sequence.handoffs, condition, formations);
        const protocols = calculateRefitProtocols(playbook, assignments, formations, operation);
        for (const branches of branchSets) {
          const profile = calculateOperationProfile(
            sequence.handoffs, branches, readiness, condition, operation, protocols, playbook,
          );
          rows.push({
            refits: Object.values(refits).join("+"),
            // The list decision, independent of the order it is slotted in.
            list: [...order].sort().join("+"),
            pressure: pressure.id,
            playbook: basePlaybook.id,
            order: order.join(">"),
            branches: Object.values(branches).join("+"),
            extracted: profile.extractedCount,
            won: profile.extractedCount >= operation.requiredExtraction,
            overrun: profile.overrun,
            combos: sequence.handoffs.filter((handoff) => handoff.maneuver).length,
          });
        }
      }
    }
  }
  return rows;
};

const rate = (rows) => (rows.length ? rows.filter((row) => row.won).length / rows.length : 0);
const percent = (value) => `${(100 * value).toFixed(1)}%`;
const groupBy = (rows, key) => rows.reduce((acc, row) => { (acc[key(row)] ||= []).push(row); return acc; }, {});

export const balanceReport = (rows, operation) => {
  const lines = [];
  const say = (text = "") => lines.push(text);

  say(`BALANCE SWEEP — ${operation.name}`);
  say(`${rows.length} deterministic outcomes; requires ${operation.requiredExtraction} extractions to win`);
  say(`overall win rate ${percent(rate(rows))}`);
  say();

  say("PLACEMENT SPREAD  (flat outcomes would mean placement does not matter)");
  const byExtracted = groupBy(rows, (row) => row.extracted);
  for (const key of Object.keys(byExtracted).sort()) {
    say(`  extracted ${key}: ${String(byExtracted[key].length).padStart(5)}  ${percent(byExtracted[key].length / rows.length)}`);
  }
  say();

  const byOrder = groupBy(rows, (row) => row.order);
  const ranked = Object.entries(byOrder)
    .map(([order, group]) => ({ order, win: rate(group) }))
    .sort((a, b) => b.win - a.win);
  say("FORMATION ORDER   (a universally dominant order would break discovery)");
  say(`  best  ${percent(ranked[0].win).padStart(6)}  ${ranked[0].order}`);
  say(`  worst ${percent(ranked.at(-1).win).padStart(6)}  ${ranked.at(-1).order}`);
  say(`  orders that always win: ${ranked.filter((r) => r.win === 1).length}   never win: ${ranked.filter((r) => r.win === 0).length}`);
  say();

  say("TOTAL-ARMY PLAYS  (each should be viable, not a trap)");
  for (const [play, group] of Object.entries(groupBy(rows, (row) => row.playbook))) {
    say(`  ${play.padEnd(10)} win ${percent(rate(group)).padStart(6)}   best extraction ${Math.max(...group.map((r) => r.extracted))}`);
  }
  say();

  say("MISSION PRESSURES (every disclosed pressure must be winnable)");
  for (const [pressure, group] of Object.entries(groupBy(rows, (row) => row.pressure))) {
    const best = Math.max(...group.map((r) => r.extracted));
    const flag = group.some((r) => r.won) ? "" : "   <-- UNWINNABLE";
    say(`  ${pressure.padEnd(20)} win ${percent(rate(group)).padStart(6)}   best extraction ${best}${flag}`);
  }
  say();

  say("  best order per pressure (identical rows mean pressure changes difficulty, not strategy)");
  for (const [pressure, group] of Object.entries(groupBy(rows, (row) => row.pressure))) {
    const top = Object.entries(groupBy(group, (row) => row.order))
      .map(([order, rowsForOrder]) => ({
        order,
        win: rate(rowsForOrder),
        extracted: rowsForOrder.reduce((sum, row) => sum + row.extracted, 0) / rowsForOrder.length,
      }))
      .sort((a, b) => b.win - a.win || b.extracted - a.extracted)[0];
    say(`    ${pressure.padEnd(20)} ${percent(top.win).padStart(6)}  avg ${top.extracted.toFixed(2)}  ${top.order}`);
  }
  say();

  say("AUTHORED BRANCHES (foresight is meant to be the core skill)");
  for (const [branches, group] of Object.entries(groupBy(rows, (row) => row.branches))) {
    say(`  ${branches.padEnd(16)} win ${percent(rate(group)).padStart(6)}`);
  }
  say();

  say("COMBO CHAINS      (a secondary bonus: helpful, never mandatory)");
  for (const [combos, group] of Object.entries(groupBy(rows, (row) => row.combos)).sort()) {
    say(`  ${combos} chain(s): win ${percent(rate(group)).padStart(6)}   n=${group.length}`);
  }
  return lines.join("\n");
};

// Sweeps every refit loadout as well as every placement. Far larger, so it is opt-in.
// Refits multiply the space by 32, so this pins the roster to a fixed five: it asks
// whether a loadout can decide the mission, not which five to bring.
export const REFIT_SWEEP_ROSTER = ["harpoon", "furnace", "breaker", "railjack", "hauler"];
export const sweepRefitSpace = (operation = OPERATIONS[0]) => refitCombinations(REFIT_SWEEP_ROSTER)
  .flatMap((refits) => sweepOperation(operation, { refits, roster: REFIT_SWEEP_ROSTER }));

// Only print when run directly, so tests can import the sweep without side effects.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const operation = OPERATIONS[0];
  const deep = process.argv.includes("--refits");
  const rows = deep ? sweepRefitSpace(operation) : sweepOperation(operation);
  console.log(balanceReport(rows, operation));
  if (deep) console.log(`\n(swept ${refitCombinations().length} refit loadouts)`);
}
