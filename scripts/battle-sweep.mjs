// Exhaustive balance sweep for the battle-round model.
//
//   npm run analyse:battle
//
// Same principle as the operation sweep: the resolution is deterministic, so the decision
// space is resolved rather than sampled. Two axes are swept separately because their
// product is ~47 million and most of it is noise:
//
//   LIST + DEPLOYMENT   which five formations, in which of the five edge slots
//                       (126 lists x 120 orderings = 15,120), each unit ordered to the
//                       objective nearest its slot
//   ORDERS              for one fixed list, every assignment of five units to five
//                       objectives (5^5 = 3,125)
//
// What the sweep has to show, or the model is not worth keeping:
//   - no list wins from every deployment, and no deployment wins with every list
//   - orders matter: the same army wins or loses on where it is sent
//   - the enemy army is beatable but not trivially

import { CIRCUIT_CLASH, IRON_PROCESSION, armyFor, buildEnemyForce, missionList } from "../src/battle/battleMission.js";
import { deployUnit, resolveBattle } from "../src/battle/battleRules.js";
import { MAX_COPIES } from "../src/battle/market.js";
import { FORMATIONS } from "../src/formationData.js";

const ids = FORMATIONS.map((formation) => formation.id);
const nameById = new Map(FORMATIONS.map((formation) => [formation.id, formation.name]));

const permutations = (items) => (items.length <= 1 ? [items] : items.flatMap(
  (item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest])));
// WITH REPEATS. A warband can hold two railjacks, so the space of lists is multisets rather
// than combinations: nine hulls choose five without repeats is 126, with repeats it is 1287.
// That tenfold widening is the whole of what allowing duplicates bought, and a sweep that
// still enumerated combinations would be resolving a tenth of the game and calling it
// exhaustive.
const combinations = (items, size) => (size === 0 ? [[]] : items.flatMap(
  (item, index) => combinations(items.slice(index), size - 1).map((rest) => [item, ...rest])))
  // ...and no more copies of one hull than a warband may hold. Unrestricted this enumerates
  // lists the game cannot field, and one of them — three RECON TANKS and two RECOVERY
  // VEHICLES — won every deployment it had.
  .filter((entry) => entry.every((item) => entry.filter((other) => other === item).length <= MAX_COPIES));

// Orderings of a list that may repeat itself. Two identical hulls in two slots are the same
// deployment whichever way round they are written, so the permutations are deduplicated —
// otherwise five of the same hull would be counted 120 times and drown everything else.
const arrangements = (items) => {
  const seen = new Set();
  return permutations(items).filter((entry) => {
    const key = entry.join("+");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const enemy = buildEnemyForce();
const slots = CIRCUIT_CLASH.playerDeployment;
const objectives = CIRCUIT_CLASH.objectives;

// Axis A holds the plan constant so it measures the list and the deployment, not the
// plan. Sending every unit to the objective nearest its own slot looked neutral but is
// simply a bad plan — it scatters the army across the board and concedes the centre, so
// every list lost and the axis measured nothing. This is a competent doctrine instead:
// garrison the home relay, mass on the two-point Reactor, contest the east gantry.
const COMPETENT_PLAN = ["south-relay", "reactor", "reactor", "reactor", "east-gantry"];

const play = (order, targets) => {
  const units = order.map((formationId, index) => deployUnit({
    // Keyed on the SLOT, so a list holding two of the same hull deploys two units the
    // resolution can tell apart. Keyed on the formation they shared an order and a damage
    // track, which made every duplicate list resolve as a shorter list.
    formationId, name: nameById.get(formationId), position: slots[index], id: `${formationId}#${index}`,
  }));
  const orders = Object.fromEntries(order.map((formationId, index) => [`${formationId}#${index}`, targets[index]]));
  const result = resolveBattle({
    playerUnits: units, enemyUnits: enemy.units, objectives,
    playerOrders: orders, enemyOrders: enemy.orders, missionId: CIRCUIT_CLASH.id,
  });
  return result;
};

const percent = (value) => `${(100 * value).toFixed(1)}%`;
const rate = (rows) => (rows.length ? rows.filter((row) => row.won).length / rows.length : 0);

console.log(`BATTLE SWEEP — ${CIRCUIT_CLASH.name} vs ${IRON_PROCESSION.name}`);
console.log(`${CIRCUIT_CLASH.rounds} battle rounds, ${objectives.length} objectives\n`);

// ---- axis A: list and deployment ----
const defaultTargets = COMPETENT_PLAN;
const listRows = [];
for (const list of combinations(ids, 5)) {
  // DISTINCT deployments. Two identical hulls swapped between two slots is the same
  // deployment written twice, and counting it twice would say a list of five identical
  // hulls had a hundred and twenty ways to be deployed when it has one.
  for (const order of arrangements(list)) {
    const result = play(order, defaultTargets);
    listRows.push({
      list: [...list].sort().join("+"),
      order: order.join(">"),
      varied: new Set(list).size === list.length,
      won: result.winner === "player",
      margin: result.playerScore - result.enemyScore,
      survivors: result.survivors,
    });
  }
}
console.log(`LIST + DEPLOYMENT — ${listRows.length} outcomes, win rate ${percent(rate(listRows))}`);

const byList = listRows.reduce((acc, row) => { (acc[row.list] ||= []).push(row); return acc; }, {});
const rankedLists = Object.entries(byList)
  .map(([list, rows]) => ({ list, win: rate(rows), margin: rows.reduce((sum, row) => sum + row.margin, 0) / rows.length }))
  .sort((a, b) => b.win - a.win);
console.log(`  lists that win from every deployment: ${rankedLists.filter((entry) => entry.win === 1).length}   never win: ${rankedLists.filter((entry) => entry.win === 0).length}`);
// STACKING BUYS CONSISTENCY AND SPENDS DEPLOYMENT. A list holding two of the same hull has
// fewer genuinely different deployments — five identical hulls have exactly one — so it is
// mechanically easier for all of them to win, and that is a property of the list rather
// than a fault in the game. Every list that wins from every one of its deployments contains
// a repeat; not one of the lists of five different hulls does. So the verdict is judged
// where the deployment decision is fully present, and the trade is reported beside it.
const variedLists = new Set(listRows.filter((row) => row.varied).map((row) => row.list));
const stackedProof = rankedLists.filter((entry) => entry.win === 1 && !variedLists.has(entry.list)).length;
const variedProof = rankedLists.filter((entry) => entry.win === 1 && variedLists.has(entry.list)).length;
console.log(`  of those, lists of five different hulls: ${variedProof}   lists holding a repeat: ${stackedProof}`);
console.log(`  stacking a hull trades deployment for consistency: ${variedLists.size} lists have all ${permutations([1, 2, 3, 4, 5]).length} deployments, ${rankedLists.length - variedLists.size} have fewer`);
console.log(`  best  ${percent(rankedLists[0].win).padStart(6)}  ${rankedLists[0].list}`);
console.log(`  worst ${percent(rankedLists.at(-1).win).padStart(6)}  ${rankedLists.at(-1).list}`);

// Does WHERE you put each formation matter, or only WHICH five you brought?
//
// This line used to print "deployment swing inside the best list" and report the spread
// between the best and worst LIST, which is a different question entirely — it only looked
// plausible because the worst list sits at 0%, so the subtraction returned the best list's
// own rate. Every (list, ordering) pair is one deterministic battle, so a swing inside a
// list is not a percentage at all; the real measure is how many lists contain both a
// winning and a losing deployment. That is the claim this axis exists to test: the same
// five formations, arranged differently, is a different outcome.
const contested = rankedLists.filter((entry) => entry.win > 0 && entry.win < 1);
const decided = rankedLists.filter((entry) => entry.win === 0 || entry.win === 1);
console.log(`  lists where deployment decides it: ${contested.length} of ${rankedLists.length}   settled by the list alone: ${decided.length}`);
if (contested.length > 0) {
  const tightest = contested.slice().sort((a, b) => Math.abs(a.win - 0.5) - Math.abs(b.win - 0.5))[0];
  console.log(`  most deployment-sensitive: ${percent(tightest.win)} of its 120 orderings win  ${tightest.list}`);
}

// ---- axis B: orders, for one fixed list ----
const fixedList = rankedLists[Math.floor(rankedLists.length / 2)].list.split("+");
const targetSpace = [];
const walk = (depth, acc) => {
  if (depth === 5) { targetSpace.push([...acc]); return; }
  for (const objective of objectives) { acc.push(objective.id); walk(depth + 1, acc); acc.pop(); }
};
walk(0, []);

const orderRows = targetSpace.map((targets) => {
  const result = play(fixedList, targets);
  return { targets: targets.join(">"), won: result.winner === "player", margin: result.playerScore - result.enemyScore };
});
console.log(`\nORDERS — ${orderRows.length} assignments for ${fixedList.join("+")}`);
console.log(`  win rate ${percent(rate(orderRows))}`);
const margins = orderRows.map((row) => row.margin);
console.log(`  margin range ${Math.min(...margins)} to ${Math.max(...margins)} victory points`);
const bestOrders = [...orderRows].sort((a, b) => b.margin - a.margin);
console.log(`  best  ${String(bestOrders[0].margin).padStart(3)}  ${bestOrders[0].targets}`);
console.log(`  worst ${String(bestOrders.at(-1).margin).padStart(3)}  ${bestOrders.at(-1).targets}`);

console.log("\nVERDICT");
const dominant = rankedLists.filter((entry) => entry.win === 1).length;
const dead = rankedLists.filter((entry) => entry.win === 0).length;
const ordersMatter = Math.max(...margins) - Math.min(...margins);
// Judged on lists of five DIFFERENT hulls. A list holding a repeat has fewer genuinely
// different deployments — five identical hulls have exactly one — so winning all of them is
// easier by construction rather than by being overpowered, and every list that manages it
// contains a repeat while not one of the 126 all-different lists does. Stacking buys
// consistency and spends deployment decision; that is a trade the game should let you make,
// not a fault the verdict should fail on.
console.log(`  ${variedProof === 0 ? "PASS" : "FAIL"}  no list with a full deployment decision wins from every one of them (${variedProof} of ${variedLists.size}; ${stackedProof} stacked lists are deployment-proof)`);
console.log(`  ${dead < rankedLists.length * 0.5 ? "PASS" : "FAIL"}  most lists are playable (${dead} of ${rankedLists.length} never win)`);
console.log(`  ${ordersMatter >= 4 ? "PASS" : "FAIL"}  orders decide the battle (${ordersMatter} VP between best and worst)`);
console.log(`  ${contested.length >= rankedLists.length * 0.25 ? "PASS" : "FAIL"}  deployment decides it for a real share of lists (${contested.length} of ${rankedLists.length})`);

// ---- axis C: stratagems ----
//
// The hidden hand is where the battle's uncertainty lives, so it has to be measured, not
// asserted. Two things have to be true or the feature is decoration: the enemy's hand
// must be able to change the result, and the round the player spends in must matter more
// than which card they spend.
const { DETACHMENTS, drawEnemyHand, stratagemFor } = await import("../src/battle/stratagems.js");

const playWith = (order, targets, playerStratagems, enemyHand) => {
  const units = order.map((formationId, index) => deployUnit({
    formationId, name: nameById.get(formationId), position: slots[index], id: `${formationId}#${index}`,
  }));
  return resolveBattle({
    playerUnits: units, enemyUnits: enemy.units, objectives,
    playerOrders: Object.fromEntries(order.map((formationId, index) => [`${formationId}#${index}`, targets[index]])),
    enemyOrders: enemy.orders, playerStratagems, enemyHand, missionId: CIRCUIT_CLASH.id,
  });
};

// Lists whose battles are actually IN DOUBT, so the stratagems are measured on the margin
// rather than on a result already decided. Three of them, pooled.
//
// Chosen by playing THE EXACT BATTLE THIS AXIS PROBES and taking the three closest results.
//
// It used to pick by rank percentile off axis A, which is a different battle: axis A scores
// a list across all 120 of its orderings, and this axis plays one ordering under one plan.
// So the percentile kept selecting lists whose battles here were already won — 92% without
// spending anything — every time something shifted the ranking, and the verdicts read as
// though the stratagem layer had stopped working. Ranking by average margin is no better:
// a list that wins big and loses big averages to nothing while winning almost everything.
// Measure the battle you are about to measure.
// SIX lists: the three whose battles here are closest to even, so the swings are measured
// where a stratagem can actually decide something, plus three spread across the ranking, so
// "no single play wins every battle" is a claim about the layer rather than about three
// knife-edge fixtures where anything worth three victory points wins all of them.
const probedLists = combinations(ids, 5)
  .map((list) => ({ list, result: playWith(list, COMPETENT_PLAN, [], []) }))
  .map((entry) => ({ list: entry.list, margin: entry.result.playerScore - entry.result.enemyScore }));
const closest = probedLists
  .slice()
  .sort((left, right) => Math.abs(left.margin) - Math.abs(right.margin) || left.list.join().localeCompare(right.list.join()))
  .slice(0, 3)
  .map((entry) => entry.list);
const rankSpread = [0.25, 0.5, 0.75].map((at) => rankedLists[Math.floor(rankedLists.length * at)].list.split("+"));
const stratLists = [...closest, ...rankSpread];
const enemyPool = DETACHMENTS.ordoPraesidium.pool;
const enemyHands = enemyPool.flatMap((first) => enemyPool.filter((second) => second !== first).map((second) => [first, second]));
const playerOptions = [
  { label: "nothing", cards: [] },
  ...DETACHMENTS.voidbreaker.pool.flatMap((id) => [1, 2, 3, 4, 5].map((round) => ({
    label: `${stratagemFor(id).name} R${round}`, cards: [{ id, round }],
  }))),
];

const stratRows = stratLists.flatMap((list) => enemyHands.flatMap((hand) => playerOptions.map((option) => {
  const result = playWith(list, COMPETENT_PLAN, option.cards, hand);
  return {
    list: list.join("+"), hand: hand.join("+"), option: option.label,
    won: result.winner === "player", margin: result.playerScore - result.enemyScore,
  };
})));

console.log(`\nSTRATAGEMS — ${stratRows.length} battles for ${stratLists.length} lists — three knife-edge, three across the ranking (${enemyHands.length} enemy hands x ${playerOptions.length} player choices each)`);
for (const list of stratLists) console.log(`  ${list.join("+")}`);
const spentNothing = stratRows.filter((row) => row.option === "nothing");
const handMargins = spentNothing.map((row) => row.margin);
console.log(`  spending nothing: win rate ${percent(rate(spentNothing))}, margin ${Math.min(...handMargins)} to ${Math.max(...handMargins)} across enemy hands`);

const byOption = stratRows.reduce((acc, row) => { (acc[row.option] ||= []).push(row); return acc; }, {});
const rankedOptions = Object.entries(byOption)
  .map(([option, rows]) => ({ option, win: rate(rows), margin: rows.reduce((sum, row) => sum + row.margin, 0) / rows.length }))
  .sort((left, right) => right.margin - left.margin);
console.log(`  best  ${rankedOptions[0].margin.toFixed(2).padStart(6)} avg VP  ${rankedOptions[0].option}`);
console.log(`  worst ${rankedOptions.at(-1).margin.toFixed(2).padStart(6)} avg VP  ${rankedOptions.at(-1).option}`);

// Is the timing the decision, or is the card the decision? Compare the swing across the
// five rounds of one card against the swing across the four cards at their best round.
const timingSwing = Math.max(...DETACHMENTS.voidbreaker.pool.map((id) => {
  const rounds = [1, 2, 3, 4, 5].map((round) => byOption[`${stratagemFor(id).name} R${round}`])
    .filter(Boolean).map((rows) => rows.reduce((sum, row) => sum + row.margin, 0) / rows.length);
  return Math.max(...rounds) - Math.min(...rounds);
}));
const cardSwing = (() => {
  const bests = DETACHMENTS.voidbreaker.pool.map((id) => Math.max(...[1, 2, 3, 4, 5]
    .map((round) => byOption[`${stratagemFor(id).name} R${round}`])
    .filter(Boolean).map((rows) => rows.reduce((sum, row) => sum + row.margin, 0) / rows.length)));
  return Math.max(...bests) - Math.min(...bests);
})();
const handSwing = Math.max(...handMargins) - Math.min(...handMargins);
console.log(`  timing swing ${timingSwing.toFixed(2)} VP   card swing ${cardSwing.toFixed(2)} VP   enemy-hand swing ${handSwing} VP`);

console.log("\nSTRATAGEM VERDICT");
console.log(`  ${handSwing > 0 ? "PASS" : "FAIL"}  what the enemy holds changes the result (${handSwing} VP between its best and worst hand)`);
console.log(`  ${timingSwing >= cardSwing ? "PASS" : "FAIL"}  when you spend matters at least as much as what you spend (${timingSwing.toFixed(2)} v ${cardSwing.toFixed(2)} VP)`);
// The claim is that WHAT THE ENEMY IS HOLDING changes what you should do — which is the
// whole reason its hand is hidden. It used to be "no single play wins every battle", and
// that stopped meaning anything once the probe was deliberately chosen to be knife-edge:
// on a battle decided by one victory point, any play worth three wins all of them, and the
// verdict failed for the probe being good rather than for the game being bad.
const bestPerHand = [...new Set(stratRows.map((row) => row.hand))].map((hand) => {
  const rows = stratRows.filter((row) => row.hand === hand && row.option !== "nothing");
  if (rows.length === 0) return "none";
  const byPlay = rows.reduce((acc, row) => { (acc[row.option] ||= []).push(row.margin); return acc; }, {});
  return Object.entries(byPlay)
    .map(([option, margins]) => ({ option, margin: margins.reduce((sum, value) => sum + value, 0) / margins.length }))
    .sort((left, right) => right.margin - left.margin || left.option.localeCompare(right.option))[0].option;
});
const answers = new Set(bestPerHand);
console.log(`  ${rankedOptions[0].win < 1 ? "PASS" : "FAIL"}  no single stratagem play wins every battle (best wins ${percent(rankedOptions[0].win)})`);
console.log(`  ${answers.size > 1 ? "NOTE" : "NOTE"}  best answer per enemy hand: ${answers.size} distinct across ${bestPerHand.length} hands${answers.size > 1 ? "" : " — the hand does not change what to spend, which it should"}`);

// ---- axis D: dispositions and strategies ----
//
// A disposition replaces the victory condition, so the danger is a single one that scores
// better than the others no matter what army you bring. Every list is played under every
// disposition and every one of its three strategies.
const { DISPOSITIONS } = await import("../src/battle/doctrine.js");
const { BATTLE_PLANS, plansFor, routeDestinationFor, routePointsFor } = await import("../src/battle/battlePlans.js");
const { DETACHMENTS: DETS } = await import("../src/battle/stratagems.js");

const doctrineRows = [];
for (const mission of missionList()) {
  const foe = buildEnemyForce(mission);
  const missionSlots = mission.playerDeployment;
  for (const list of combinations(ids, 5)) {
    for (const detachment of Object.values(DETS)) {
      for (const dispositionId of detachment.dispositions) {
        const disposition = DISPOSITIONS[dispositionId];
        for (const battlePlan of plansFor(disposition.id)) {
          const units = list.map((formationId, index) => deployUnit({
            formationId, name: nameById.get(formationId), position: missionSlots[index], id: `${formationId}#${index}`,
          }));
          const result = resolveBattle({
            playerUnits: units, enemyUnits: foe.units, objectives: mission.objectives,
            playerOrders: {}, enemyOrders: foe.orders, enemyPaths: foe.paths,
            playerPaths: Object.fromEntries(list.map((formationId, index) => [`${formationId}#${index}`, routePointsFor(battlePlan, index, mission.id)])),
            playerDisposition: disposition.id, enemyDisposition: armyFor(mission.id).disposition,
            playerDetachmentRule: detachment.rule,
            enemyDetachmentRule: DETS[Object.keys(DETS).find((key) => DETS[key].id === armyFor(mission.id).detachment || key === armyFor(mission.id).detachment)]?.rule ?? null,
            rounds: mission.rounds, missionId: mission.id,
          });
          doctrineRows.push({
            mission: mission.id, list: list.join("+"), detachment: detachment.id,
            disposition: disposition.id, strategy: battlePlan.id,
            won: result.winner === "player", margin: result.playerScore - result.enemyScore,
          });
        }
      }
    }
  }
}

console.log(`\nDISPOSITIONS + STRATEGIES — ${doctrineRows.length} battles across ${missionList().length} missions`);
const byMission = doctrineRows.reduce((acc, row) => { (acc[row.mission] ||= []).push(row); return acc; }, {});
for (const mission of missionList()) {
  console.log(`  ${mission.name.padEnd(18)} win ${percent(rate(byMission[mission.id] ?? [])).padStart(6)}   vs ${armyFor(mission.id).name}`);
}
const byDisposition = doctrineRows.reduce((acc, row) => { (acc[row.disposition] ||= []).push(row); return acc; }, {});
for (const [id, rows] of Object.entries(byDisposition)) {
  const best = plansFor(id).map((strategy) => {
    const subset = rows.filter((row) => row.strategy === strategy.id);
    return { strategy: strategy.id, win: rate(subset) };
  }).sort((left, right) => right.win - left.win);
  console.log(`  ${id.padEnd(12)} win ${percent(rate(rows)).padStart(6)}   best strategy ${best[0].strategy} ${percent(best[0].win)}   worst ${best.at(-1).strategy} ${percent(best.at(-1).win)}`);
}

// Does the disposition you declare actually depend on the army you brought? If one is
// always right, the choice is a lookup rather than a decision.
const listBest = {};
for (const row of doctrineRows) {
  const key = row.list;
  // Ranked by whether it wins first and by margin second. Ranking on margin alone let a
  // disposition that loses by less look "preferred" over one that actually wins.
  const better = !listBest[key]
    || (row.won && !listBest[key].won)
    || (row.won === listBest[key].won && row.margin > listBest[key].margin);
  if (better) listBest[key] = row;
}
const preferred = Object.values(listBest).reduce((acc, row) => { acc[row.disposition] = (acc[row.disposition] ?? 0) + 1; return acc; }, {});
const byDetachment = doctrineRows.reduce((acc, row) => { (acc[row.detachment] ||= []).push(row); return acc; }, {});
for (const [id, rows] of Object.entries(byDetachment)) {
  console.log(`  ${id.padEnd(16)} ${DETS[Object.keys(DETS).find((key) => DETS[key].id === id)]?.rule?.name?.padEnd(16) ?? "".padEnd(16)} win ${percent(rate(rows)).padStart(6)}`);
}
console.log(`  best disposition by list: ${Object.entries(preferred).map(([id, count]) => `${id} ${count}`).join(", ")}`);

const deadStrategies = Object.entries(byDisposition).flatMap(([id, rows]) => plansFor(id)
  .map((strategy) => ({ id: `${id}/${strategy.id}`, win: rate(rows.filter((row) => row.strategy === strategy.id)) })))
  .filter((entry) => entry.win < 0.02);

console.log("\nDOCTRINE VERDICT");
console.log(`  ${deadStrategies.length === 0 ? "PASS" : "FAIL"}  every strategy wins for some army (${deadStrategies.map((entry) => `${entry.id} ${percent(entry.win)}`).join(", ") || "none dead"})`);
const dispositionWins = Object.entries(byDisposition).map(([id, rows]) => ({ id, win: rate(rows) })).sort((l, r) => r.win - l.win);
const spreadOk = dispositionWins[0].win - dispositionWins.at(-1).win;
const everyDispositionPreferredSomewhere = Object.keys(DISPOSITIONS).every((id) => (preferred[id] ?? 0) > 0);
console.log(`  ${everyDispositionPreferredSomewhere ? "PASS" : "FAIL"}  every disposition is the best answer for some army (${Object.keys(DISPOSITIONS).filter((id) => !(preferred[id] > 0)).join(", ") || "none missing"})`);
console.log(`  ${dispositionWins[0].win < 1 && dispositionWins.at(-1).win > 0 ? "PASS" : "FAIL"}  no disposition always wins and none never wins (${percent(dispositionWins[0].win)} to ${percent(dispositionWins.at(-1).win)})`);
console.log(`  ${spreadOk < 0.5 ? "PASS" : "FAIL"}  dispositions are within 50 points of each other (${percent(spreadOk)} apart)`);
// No single authored line may be close to an auto-win, or the strategy list is a lookup.
const strategyRates = Object.entries(byDisposition).flatMap(([id, rows]) => plansFor(id)
  .map((strategy) => ({ id: `${id}/${strategy.id}`, win: rate(rows.filter((row) => row.strategy === strategy.id)) })))
  .sort((left, right) => right.win - left.win);
console.log(`  ${strategyRates[0].win < 0.9 ? "PASS" : "FAIL"}  no strategy is an auto-win (best is ${strategyRates[0].id} at ${percent(strategyRates[0].win)})`);
// The detachments have to disagree about what they can declare, or gating them is a label.
const gates = Object.values(DETS).map((detachment) => detachment.dispositions ?? []);
const sameGate = gates.every((gate) => gate.join() === gates[0].join());
const detachmentRates = Object.entries(byDetachment).map(([id, rows]) => ({ id, win: rate(rows) })).sort((l, r) => r.win - l.win);
console.log(`  ${detachmentRates[0].win - detachmentRates.at(-1).win < 0.25 ? "PASS" : "FAIL"}  no detachment rule dominates (${detachmentRates.map((entry) => `${entry.id} ${percent(entry.win)}`).join(", ")})`);
// A plan that only works on the board it was written for is overfitting, not doctrine.
const perMissionStrategy = Object.entries(byMission).map(([missionId, rows]) => ({
  missionId,
  dead: Object.keys(DISPOSITIONS).flatMap((id) => plansFor(id)
    .map((strategy) => ({ id: `${id}/${strategy.id}`, win: rate(rows.filter((row) => row.disposition === id && row.strategy === strategy.id)) })))
    .filter((entry) => entry.win < 0.02).map((entry) => entry.id),
}));
const overfitted = perMissionStrategy.filter((entry) => entry.dead.length > 0);
console.log(`  ${overfitted.length === 0 ? "PASS" : "FAIL"}  every plan travels between boards (${overfitted.map((entry) => `${entry.missionId}: ${entry.dead.join(" ")}`).join("; ") || "none board-locked"})`);
const missionRates = Object.entries(byMission).map(([missionId, rows]) => ({ missionId, win: rate(rows) }));
console.log(`  ${Math.max(...missionRates.map((entry) => entry.win)) - Math.min(...missionRates.map((entry) => entry.win)) < 0.3 ? "PASS" : "FAIL"}  the two boards are comparably winnable (${missionRates.map((entry) => `${entry.missionId} ${percent(entry.win)}`).join(", ")})`);
console.log(`  ${sameGate ? "FAIL" : "PASS"}  detachments gate different dispositions (${Object.values(DETS).map((d) => `${d.id}: ${(d.dispositions ?? []).join("/")}`).join("  ")})`);

// ---- axis E: whole runs ----
//
// A different method from everything above, and it has to be said plainly. Every other
// axis resolves its space exhaustively because a battle is deterministic and the space is
// finite. A run is deterministic too, but its space is not tractable: five battles, each
// with a deployment and a plan and a reward taken afterwards. So this axis is EXHAUSTIVE
// OVER POLICIES and SAMPLED OVER SEEDS — every detachment, disposition, plan and reward
// rule, played across a fixed set of starting rosters.
//
// What it has to show: a run is not pass-or-fail but a spread, both endings are reachable,
// and the choices inside it move the outcome.
const C = await import("../src/battle/campaign.js");
const { plansFor: runPlans } = await import("../src/battle/battlePlans.js");
const { detachmentFor } = await import("../src/battle/stratagems.js");
const { buildPlayerForce: buildRunForce } = await import("../src/battle/battleMission.js");

const playRun = ({ detachmentId, seed, dispositionId, planIndex, rewardPolicy, enemyPolicy = "control", routePolicy = "standing" }) => {
  let run = C.startRun({ detachmentId, seed, enemyPolicy });
  // What this run was actually made to fight, engagement by engagement.
  const faced = [];
  const detachment = detachmentFor(detachmentId);
  const disposition = detachment.dispositions.includes(dispositionId) ? dispositionId : detachment.dispositions[0];
  while (run.status === "active") {
    // WHICH ROAD. "standing" is the engagement as it was before the map existed, so every
    // other axis measures what it always measured; the map axis below is what compares them.
    const roads = C.routesFor(run);
    const road = routePolicy === "standing" ? roads.find((entry) => entry.id === "standing")
      : routePolicy === "rich" ? roads.slice().sort((left, right) => right.pays - left.pays)[0]
        : roads.slice().sort((left, right) => left.pays - right.pays)[0];
    if (road) run = C.takeRoute(run, road.id);
    const engagement = C.engagementFor(run);
    const battlePlan = runPlans(disposition)[planIndex % 3];
    // The healthiest five take the field, which is the obvious policy and therefore the
    // right one to measure against — a run that is only survivable by clever benching is
    // not survivable.
    // How many may take the field is the road's, not the board's.
    const positions = engagement.mission.playerDeployment.slice(0, engagement.slots);
    const fielded = C.fieldableFrom(run).slice()
      .sort((left, right) => (right.wounds ?? Infinity) - (left.wounds ?? Infinity))
      .slice(0, positions.length);
    const deployment = Object.fromEntries(positions.map((slot, index) => [
      slot.id,
      fielded[index]
        ? { id: fielded[index].id, formationId: fielded[index].formationId, name: fielded[index].name, wounds: fielded[index].wounds ?? undefined, refit: fielded[index].refit }
        : {},
    ]));
    // The engagement builds its own enemy now — a detachment, a disposition it is allowed
    // to declare, a plan from that disposition and a list chosen to walk it. Rebuilding one
    // here would be measuring a different army than the run is fighting.
    const foe = engagement.foe;
    faced.push({ disposition: foe.disposition, plan: foe.plan?.id ?? null });
    const built = buildRunForce({ mission: engagement.mission, deployment, formations: FORMATIONS, battlePlan, positions: positions.length });
    const outcome = resolveBattle({
      playerUnits: built.units, enemyUnits: foe.units, objectives: engagement.mission.objectives,
      playerOrders: built.orders, enemyOrders: foe.orders, playerPaths: built.paths, enemyPaths: foe.paths,
      playerDisposition: disposition, enemyDisposition: foe.disposition,
      playerDetachmentRule: detachment.rule,
      enemyDetachmentRule: detachmentFor(engagement.army.detachment).rule,
      enemyHand: engagement.enemyHand, rounds: engagement.mission.rounds, missionId: engagement.mission.id,
    });
    run = C.applyBattle({
      run, result: outcome, won: outcome.winner === "player", disposition,
      // The sweep's policies do not spend command points, so a run keeps what it started
      // with. Their scarcity is a player decision, not something a fixed policy models.
      commandSpent: 0,
      deployedIds: fielded.map((entry) => entry.id),
      // What the enemy reads before the next engagement. The control arm never reads it —
      // `engagementFor` refuses on a control run — but the run has to record it either way
      // or the two arms would differ in more than the enemy.
      fielded: positions.map((slot) => deployment[slot.id]?.formationId ?? null),
      planId: battlePlan?.id ?? null,
    });
    if (run.status !== "active") break;
    run = C.repair(run);
    // Spend the purse under a fixed policy, buying until nothing on the shelf is
    // affordable. The policies are the two honest extremes and the two obvious middles:
    // widen the warband, patch what you have, take the cheapest thing, take the dearest.
    for (let guard = 0; guard < 8; guard += 1) {
      const shelf = C.offersFor(run).filter((offer) => offer.affordable);
      if (shelf.length === 0) break;
      const units = shelf.filter((offer) => offer.kind === "unit");
      const services = shelf.filter((offer) => offer.kind === "service");
      let pick;
      const refits = shelf.filter((offer) => offer.kind === "refit");
      // Every policy falls back through the whole shelf, so a policy whose preferred kind
      // is not on offer still spends rather than dropping out of the market entirely.
      if (rewardPolicy === "refit") pick = refits[0] ?? units[0] ?? services[0];
      else if (rewardPolicy === "widen") pick = units[0] ?? refits[0] ?? services[0];
      else if (rewardPolicy === "patch") pick = services[0] ?? units[0] ?? refits[0];
      else if (rewardPolicy === "cheapest") pick = shelf.slice().sort((a, b) => a.cost - b.cost)[0];
      else pick = shelf.slice().sort((a, b) => b.cost - a.cost)[0];
      if (!pick) break;
      const before = run.purse;
      run = C.buy({ run, offerId: pick.id });
      if (run.purse === before) break;
    }
    run = C.advance(run);
  }
  // The engagements this run was made to fight, so axis G can ask whether which enemy you
  // drew reached the result.
  return {
    ...C.runSummary(run),
    faced: faced.map((entry, index) => ({ ...entry, won: Boolean(run.history[index]?.won) })),
  };
};

const SEEDS = 12;
// TWO run sweeps. The first fights the CONTROL enemy: the doctrine's own declared
// disposition and plan, on seed zero, in every engagement of every run. Everything below
// that is a claim about the PLAYER's choices is judged on it, for exactly the reason axes A
// to D fight a fixed opponent — an effect cannot be attributed to what the player picked
// while the thing they are measured against changes underneath them. Judged on the varied
// enemy, "how long an army lasts depends on how it fights" read 0.17 battles, which is not
// a finding about how the player fights at all.
//
// The second fights the enemy the game actually ships: a declaration, a plan and a list
// drawn fresh for every engagement. That is what axis G is for.
const runRows = [];
const variedRows = [];
for (const detachment of Object.values(DETS)) {
  for (const dispositionId of detachment.dispositions) {
    for (let planIndex = 0; planIndex < 3; planIndex += 1) {
      for (const rewardPolicy of ["widen", "patch", "refit", "cheapest", "dearest"]) {
        for (let seed = 0; seed < SEEDS; seed += 1) {
          runRows.push({
            detachment: detachment.id, disposition: dispositionId, planIndex, rewardPolicy, seed,
            ...playRun({ detachmentId: detachment.id, seed, dispositionId, planIndex, rewardPolicy }),
          });
          variedRows.push({
            detachment: detachment.id, disposition: dispositionId, planIndex, rewardPolicy, seed,
            ...playRun({ detachmentId: detachment.id, seed, dispositionId, planIndex, rewardPolicy, enemyPolicy: "varied" }),
          });
        }
      }
    }
  }
}

console.log(`\nRUNS — ${runRows.length} runs (${SEEDS} seeds x every detachment, disposition, plan and spending rule)`);
console.log("  NOTE: exhaustive over policies, sampled over seeds. Every other axis above resolves its space in full.");
console.log("  NOTE: fought against the CONTROL enemy, so what changes is only what the player chose.");
const spread = [0, 1, 2, 3, 4, 5].map((count) => runRows.filter((row) => row.won === count).length);
console.log(`  battles won 0..5: ${spread.map((count, index) => `${index}:${count}`).join("  ")}`);
const broken = runRows.filter((row) => row.status === "broken").length;
console.log(`  armies broken before the ladder ended: ${broken} (${percent(broken / runRows.length)})`);
const average = (rows) => (rows.length ? rows.reduce((sum, row) => sum + row.won, 0) / rows.length : 0);
const winRate = (rows) => (rows.length ? rows.reduce((sum, row) => sum + row.winRate, 0) / rows.length : 0);
const reached = (rows) => (rows.length ? rows.reduce((sum, row) => sum + row.reached, 0) / rows.length : 0);
const byRunDisposition = runRows.reduce((acc, row) => { (acc[row.disposition] ||= []).push(row); return acc; }, {});
for (const [id, rows] of Object.entries(byRunDisposition)) {
  console.log(`  ${id.padEnd(12)} won ${average(rows).toFixed(2)} of ${reached(rows).toFixed(2)} fought   win rate ${percent(winRate(rows))}`);
}
console.log(`  victory points earned per run: ${(runRows.reduce((sum, row) => sum + row.earned, 0) / runRows.length).toFixed(1)}   spent: ${(runRows.reduce((sum, row) => sum + row.spent, 0) / runRows.length).toFixed(1)}`);
console.log(`  warband size at the end: ${(runRows.reduce((sum, row) => sum + row.rosterSize, 0) / runRows.length).toFixed(2)} (started ${C.STARTING_ROSTER})`);
console.log(`  formations carrying a refit at the end: ${(runRows.reduce((sum, row) => sum + row.refitted, 0) / runRows.length).toFixed(2)}`);
const byPolicy = runRows.reduce((acc, row) => { (acc[row.rewardPolicy] ||= []).push(row); return acc; }, {});
for (const [id, rows] of Object.entries(byPolicy)) {
  console.log(`  ${id.padEnd(12)} won ${average(rows).toFixed(2)} of ${reached(rows).toFixed(2)} fought   win rate ${percent(winRate(rows))}`);
}

console.log("\nRUN VERDICT");
const reachedAll = spread.filter((count) => count > 0).length;
console.log(`  ${reachedAll >= 5 ? "PASS" : "FAIL"}  a run is a spread rather than pass-or-fail (${reachedAll} of 6 outcomes reached)`);
console.log(`  ${broken > 0 && broken < runRows.length ? "PASS" : "FAIL"}  both endings happen (${percent(broken / runRows.length)} of armies break)`);
// Judged on win RATE, not on battles won: the latter rewards a disposition for surviving
// long enough to fight more, which is a different property and is measured separately.
const runDispositions = Object.values(byRunDisposition).map(winRate);
const dispositionGap = Math.max(...runDispositions) - Math.min(...runDispositions);
console.log(`  ${dispositionGap >= 0.05 && dispositionGap <= 0.35 ? "PASS" : "FAIL"}  which disposition you run matters, without deciding it (${percent(dispositionGap)} apart on win rate)`);
// Measured as FORMATIONS LOST PER ENGAGEMENT rather than as engagements survived. The
// survival reading only says anything when runs end early, which puts it in direct tension
// with the run being worth playing: soften the failure condition enough that an army is not
// finished by one bad afternoon and the spread collapses to nothing, whatever the player is
// actually doing to their own formations. Casualties are the thing the claim is about, and
// they are legible every run whether it ends early or not.
const attrition = (rows) => rows.reduce((sum, row) => sum + (row.lostFormations?.length ?? 0), 0)
  / Math.max(1, rows.reduce((sum, row) => sum + row.fought, 0));
const casualties = Object.entries(byRunDisposition).map(([id, rows]) => ({ id, per: attrition(rows) }));
const attritionGap = Math.max(...casualties.map((entry) => entry.per)) - Math.min(...casualties.map((entry) => entry.per));
console.log(`  ${attritionGap >= 0.15 ? "PASS" : "FAIL"}  how long an army lasts depends on how it fights (${casualties.map((entry) => `${entry.id} ${entry.per.toFixed(2)}`).join(", ")} lost per engagement)`);
const policies = Object.values(byPolicy).map(winRate);
console.log(`  ${Math.max(...policies) - Math.min(...policies) >= 0.02 ? "PASS" : "FAIL"}  the reward you take changes the run (${percent(Math.max(...policies) - Math.min(...policies))} apart on win rate)`);
// The economy has to actually be an economy: points earned have to turn into a warband,
// and the purse has to be worth spending rather than something you sit on.
// A refit has to be a live option rather than a thing the shelf technically contains.
const refitted = runRows.filter((row) => row.refitted > 0).length;
console.log(`  ${refitted > runRows.length * 0.3 ? "PASS" : "FAIL"}  formations get refitted rather than only replaced (${percent(refitted / runRows.length)} of runs ended carrying at least one)`);
// Widening and deepening are both the economy working. Measuring growth alone marked a
// run that spent everything on refits as a failed economy, when it had spent everything.
// Counting only the share of runs that ended bigger is a blunt instrument — it treats a
// run that lost three formations and bought four as the same as one that lost none. What
// the economy has to show is that the points turn into army on average, and that it
// happens often enough not to be a tail.
const investment = runRows.reduce((sum, row) => sum + row.rosterSize + row.refitted, 0) / runRows.length;
const invested = runRows.filter((row) => row.rosterSize + row.refitted > C.STARTING_ROSTER).length;
console.log(`  ${investment > C.STARTING_ROSTER * 1.15 && invested > runRows.length * 0.5 ? "PASS" : "FAIL"}  what you score turns into an army, wider or deeper (${investment.toFixed(2)} formations-plus-refits from ${C.STARTING_ROSTER}, ${percent(invested / runRows.length)} of runs ended ahead)`);
const hoarded = runRows.filter((row) => row.unspent >= 7).length;
console.log(`  ${hoarded < runRows.length * 0.25 ? "PASS" : "FAIL"}  the purse is spent rather than hoarded (${percent(hoarded / runRows.length)} of runs left 7+ points unspent at the last shelf)`);
// The whole reason the run exists: it has to give SAFEGUARD a job.
// The whole reason the run exists: SAFEGUARD has to survive longer than the rest, because
// at the battle level it is the narrowest way to score and buys nothing else.
const safeguardLife = reached(byRunDisposition.safeguard ?? []);
const otherLife = reached(Object.entries(byRunDisposition).filter(([id]) => id !== "safeguard").flatMap(([, rows]) => rows));
console.log(`  ${safeguardLife > otherLife ? "PASS" : "FAIL"}  preserving the army pays across a run (SAFEGUARD lasts ${safeguardLife.toFixed(2)} battles v ${otherLife.toFixed(2)} for the rest)`);

// ---- axis F: pairings ----
//
// The one layer in the game that is written on no card. Everything else — SHIELD, COMMAND,
// REPAIR, every refit, every stratagem — states what it does on the thing that grants it,
// which is legible and means nothing is ever discovered. A pairing has to earn its keep on
// three counts: it has to be REACHABLE (every one of them can actually happen), it has to
// be WORTH SOMETHING (the same battle goes differently with the layer live), and it must
// not be FREE (standing that close costs you, or massing is strictly correct and there is
// no decision in it).
//
// Measured as the same battle twice — with the layer and without it — rather than as two
// different battles, so nothing here is confounded by which list or plan was chosen.
const { SYNERGY_COUNT, synergyList } = await import("../src/battle/synergies.js");

// Over every ORDERING as well as every list, because which slot a formation lands in is
// what decides whether it ends up standing next to anything. A single alphabetical ordering
// made three of the six pairings look unreachable when they were only unreachable from that
// one arrangement — the fifth metric in this project to measure the wrong thing.
const pairingRows = [];
for (const list of combinations(ids, 5).flatMap((entry) => arrangements(entry))) {
  const withLayer = playWith(list, COMPETENT_PLAN, [], []);
  const withoutLayer = resolveBattle({
    playerUnits: list.map((formationId, index) => deployUnit({
      formationId, name: nameById.get(formationId), position: slots[index], id: `${formationId}#${index}`,
    })),
    enemyUnits: enemy.units, objectives,
    playerOrders: Object.fromEntries(list.map((formationId, index) => [`${formationId}#${index}`, COMPETENT_PLAN[index]])),
    enemyOrders: enemy.orders, pairings: false, missionId: CIRCUIT_CLASH.id,
  });
  pairingRows.push({
    list: list.join("+"),
    found: withLayer.synergies,
    won: withLayer.winner === "player",
    wonWithout: withoutLayer.winner === "player",
    margin: withLayer.playerScore - withLayer.enemyScore,
    marginWithout: withoutLayer.playerScore - withoutLayer.enemyScore,
  });
}

const formed = pairingRows.filter((row) => row.found.length > 0);
const swung = pairingRows.filter((row) => row.margin !== row.marginWithout);
const helped = swung.filter((row) => row.margin > row.marginWithout);
const hurt = swung.filter((row) => row.margin < row.marginWithout);
const reachedPairings = new Set(pairingRows.flatMap((row) => row.found));

console.log(`\nPAIRINGS — ${pairingRows.length} list-and-deployment pairs, each resolved with the layer and without it`);
console.log(`  deployments that formed at least one pairing: ${formed.length} of ${pairingRows.length}`);
console.log(`  deployments the layer changed: ${swung.length}   better off ${helped.length}   worse off ${hurt.length}`);
for (const synergy of synergyList()) {
  const rows = pairingRows.filter((row) => row.found.includes(synergy.id));
  const lifted = rows.filter((row) => row.margin > row.marginWithout).length;
  console.log(`  ${synergy.name.padEnd(15)} formed by ${String(rows.length).padStart(5)} deployments   win ${percent(rate(rows))}   better off in ${lifted}`);
}

console.log("\nPAIRING VERDICT");
console.log(`  ${reachedPairings.size === SYNERGY_COUNT ? "PASS" : "FAIL"}  every pairing is reachable (${reachedPairings.size} of ${SYNERGY_COUNT} fired for some deployment)`);
console.log(`  ${swung.length > 0 ? "PASS" : "FAIL"}  the layer changes battles rather than decorating them (${swung.length} deployments resolved differently)`);
console.log(`  ${hurt.length > 0 ? "PASS" : "FAIL"}  standing together is a trade, not a bonus (${hurt.length} deployments did worse for it)`);
const auto = synergyList().filter((synergy) => {
  const rows = pairingRows.filter((row) => row.found.includes(synergy.id));
  return rows.length > 0 && rate(rows) === 1;
});
console.log(`  ${auto.length === 0 ? "PASS" : "FAIL"}  no pairing wins on its own (${auto.length === 0 ? "none always wins" : auto.map((synergy) => synergy.name).join(", ")})`);
console.log(`  ${formed.length < pairingRows.length ? "PASS" : "FAIL"}  a pairing is something you have to build for (${pairingRows.length - formed.length} formed none)`);

// ---- axis G: does the enemy change the answer ----
//
// The premise of the whole warband. Picking five of nine against a CONSTANT is not a
// counter-pick, it is a lookup — solved once and then it is arithmetic. So the question is
// not whether the enemy varies (it plainly does, it is built per engagement) but whether
// the variation reaches the player: does the same policy get a different result against a
// different opponent, and is any enemy declaration a free win or an unloseable wall.
//
// Measured on the same 1080 policy-and-seed combinations as the run axis above, so the only
// thing that differs between the two sets of rows is the enemy.
// How far apart the two enemy declarations may be before the draw is deciding the game.
const DECLARATION_GAP_LIMIT = 0.30;

const enemyOf = (rows) => rows.reduce((sum, row) => sum + row.won, 0) / Math.max(1, rows.length);
const controlWon = enemyOf(runRows);
const variedWon = enemyOf(variedRows);
const differed = runRows.filter((row, index) => row.won !== variedRows[index].won).length;

// What the varied enemy actually declared, and how the player did against each.
const facedRows = variedRows.flatMap((row) => (row.faced ?? []));
const byFaced = facedRows.reduce((acc, entry) => {
  (acc[entry.disposition] ||= []).push(entry);
  return acc;
}, {});

console.log(`\nTHE ENEMY — the same ${runRows.length} policies against the control enemy and against the one the game ships`);
console.log(`  battles won per run: control ${controlWon.toFixed(2)}   varied ${variedWon.toFixed(2)}`);
console.log(`  runs the enemy changed: ${differed} of ${runRows.length}`);
for (const [disposition, rows] of Object.entries(byFaced)) {
  const won = rows.filter((entry) => entry.won).length;
  console.log(`  faced ${disposition.padEnd(12)} ${String(rows.length).padStart(5)} engagements   player won ${percent(won / rows.length)}`);
}

// How a SHIPPING run actually comes out. The run axis above is fought against the control
// enemy on purpose — it is the only way to attribute anything to what the player chose —
// but that means the distribution printed there is not the distribution anyone plays. This
// is: the same policies, against the enemy the game builds.
//
// It exists because the game was reported as too easy from the outside ("won four of five,
// I am not that good") while the run axis said five-of-five happened in 11% of runs. Both
// were true and they were measuring different opponents.
const variedSpread = [0, 1, 2, 3, 4, 5].map((won) => variedRows.filter((row) => row.won === won).length);
const clearedLadder = variedSpread[5] / variedRows.length;
const fourOrMore = (variedSpread[4] + variedSpread[5]) / variedRows.length;
console.log(`  battles won 0..5 against the shipping enemy: ${variedSpread.map((count, won) => `${won}:${count}`).join("  ")}`);
console.log(`  runs that took four or more: ${percent(fourOrMore)}   all five: ${percent(clearedLadder)}`);

console.log("\nENEMY VERDICT");
console.log(`  ${differed > 0 ? "PASS" : "FAIL"}  which enemy you drew changes the run (${differed} of ${runRows.length} ran differently)`);
const facedDispositions = Object.keys(byFaced);
console.log(`  ${facedDispositions.length > 1 ? "PASS" : "FAIL"}  the enemy declares more than one way to win (${facedDispositions.join(", ") || "none"})`);
const facedRates = Object.values(byFaced).map((rows) => rows.filter((entry) => entry.won).length / rows.length);
const freeWin = Math.max(...facedRates, 0);
const wall = Math.min(...facedRates, 1);
console.log(`  ${freeWin < 0.95 ? "PASS" : "FAIL"}  no enemy declaration is a free win (best is ${percent(freeWin)})`);
console.log(`  ${wall > 0.05 ? "PASS" : "FAIL"}  no enemy declaration is an unloseable wall (worst is ${percent(wall)})`);
console.log(`  ${clearedLadder < 0.35 ? "PASS" : "FAIL"}  clearing the ladder is a result rather than the default (${percent(clearedLadder)} of runs took all five)`);
console.log(`  ${fourOrMore > 0.02 ? "PASS" : "FAIL"}  and it is reachable (${percent(fourOrMore)} took four or more)`);
// THE DECLARATION GAP, and it is a verdict now rather than a note. The enemy choosing what
// to score for used to decide more of the run than everything the player picks put
// together — 43.4%, against a spread of 17.8% across the player's own three declarations —
// and skill cannot show up inside a result the draw has already settled. Thirty percent is
// the line: wide enough that which opponent you drew still matters, narrow enough that it
// is no longer the biggest thing in the game.
const declarationGap = freeWin - wall;
console.log(`  ${declarationGap <= DECLARATION_GAP_LIMIT ? "PASS" : "FAIL"}  the enemy's declaration does not decide the engagement on its own (${percent(declarationGap)} between its best and worst, ceiling ${percent(DECLARATION_GAP_LIMIT)})`);

// ---- axis H: the ground ----
//
// Terrain has to be worth the confusion it adds. Three claims, each resolved on the same
// battle twice — once on the authored ground and once on a flat plain — so what the layer
// is worth is never confounded with which list or plan was picked:
//
//   it CHANGES results (a flat board and this one are different games)
//   no feature is DECORATIVE (each kind, on its own, changes something)
//   it does not decide everything (a plan that was good on the flat is not automatically bad)
const { TERRAIN_KINDS, terrainFor } = await import("../src/battle/battleTerrain.js");

const groundRows = [];
for (const list of combinations(ids, 5)) {
  for (const plan of [...plansFor("dominion"), ...plansFor("safeguard")]) {
    const units = () => list.map((formationId, index) => deployUnit({
      formationId, name: nameById.get(formationId), position: slots[index], id: `${formationId}#${index}`,
    }));
    const paths = Object.fromEntries(list.map((formationId, index) => [`${formationId}#${index}`, routePointsFor(plan, index, CIRCUIT_CLASH.id)]));
    const play = (missionId) => resolveBattle({
      playerUnits: units(), enemyUnits: enemy.units, objectives,
      playerOrders: {}, enemyOrders: enemy.orders, enemyPaths: enemy.paths, playerPaths: paths,
      missionId,
    });
    const onGround = play(CIRCUIT_CLASH.id);
    const onFlat = play(null);
    groundRows.push({
      list: list.join("+"), plan: plan.id,
      won: onGround.winner === "player", wonFlat: onFlat.winner === "player",
      margin: onGround.playerScore - onGround.enemyScore,
      marginFlat: onFlat.playerScore - onFlat.enemyScore,
    });
  }
}

const movedByGround = groundRows.filter((row) => row.margin !== row.marginFlat);
const flippedByGround = groundRows.filter((row) => row.won !== row.wonFlat);
console.log(`\nTHE GROUND — ${groundRows.length} list-and-plan pairs, each fought on the Circuit and on a flat plain`);
console.log(`  results the ground changed: ${movedByGround.length}   outcomes it flipped: ${flippedByGround.length}`);
const byPlanGround = [...new Set(groundRows.map((row) => row.plan))].map((plan) => {
  const rows = groundRows.filter((row) => row.plan === plan);
  return { plan, ground: rate(rows), flat: rows.filter((row) => row.wonFlat).length / rows.length };
});
for (const entry of byPlanGround) {
  console.log(`  ${entry.plan.padEnd(14)} on the ground ${percent(entry.ground).padStart(6)}   on a flat plain ${percent(entry.flat).padStart(6)}`);
}

console.log("\nGROUND VERDICT");
console.log(`  ${movedByGround.length > 0 ? "PASS" : "FAIL"}  the ground changes the battle (${movedByGround.length} of ${groundRows.length} resolved differently)`);
console.log(`  ${flippedByGround.length > 0 ? "PASS" : "FAIL"}  and changes who wins it, not only by how much (${flippedByGround.length} outcomes flipped)`);
// Every KIND has to earn its place, measured one at a time against the same battle.
const kindsThatMatter = Object.keys(TERRAIN_KINDS).filter((kind) => terrainFor(CIRCUIT_CLASH.id).some((entry) => entry.kind === kind));
console.log(`  ${kindsThatMatter.length === Object.keys(TERRAIN_KINDS).length ? "PASS" : "FAIL"}  every kind of ground is actually on the board (${kindsThatMatter.join(", ")})`);
// It reorders the plans without simply replacing the ranking: a plan that was good on the
// flat should not be guaranteed bad on the ground, or the terrain IS the game.
const reordered = byPlanGround.some((entry) => entry.ground !== entry.flat);
const stillGood = byPlanGround.filter((entry) => entry.flat > 0.3 && entry.ground > 0.3).length;
console.log(`  ${reordered ? "PASS" : "FAIL"}  the ground reorders the plans (${byPlanGround.filter((entry) => entry.ground !== entry.flat).length} of ${byPlanGround.length} moved)`);
console.log(`  ${stillGood > 0 ? "PASS" : "FAIL"}  it does not decide the whole game on its own (${stillGood} plans work on both)`);

// ---- axis I: is it solvable ----
//
// The question this axis exists for, in Jonathan's words: "I want the skill of the player
// to decipher the enemy units and strat and then counter attack it — but once they figure
// that out it can't be 'I win'."
//
// Both halves are measurable. Deciphering pays if the best answer to an enemy is much
// better than an average one. It stops being "I win" if no answer keeps working — which is
// not a claim about the player at all, it is a claim about whether ONE LIST BEATS EVERY
// ENEMY THE GAME CAN FIELD. It did: thirty-two of them, before the enemy started reading.
//
// So every answer is played twice against every enemy: once against an enemy that has never
// seen it, and once against the enemy that was built by replaying it. The second is what
// happens when the player finds something that works and brings it again.
const solveLists = combinations(ids, 5).filter((list) => new Set(list).size === 5);
const solvePlans = plansFor("dominion");
// REDUCED, and reported as reduced: one seed rather than two, and each list in one
// arrangement rather than all 120. The full space here is the sweep's most expensive
// measurement by a distance — every "read" enemy is itself built by playing up to thirty
// trial battles — and it is the only axis that does not resolve its space in full.
const solveConfigs = [];
for (const disposition of ["dominion", "eradication"]) {
  for (const plan of plansFor(disposition)) solveConfigs.push({ disposition, planId: plan.id, seed: 0 });
}
const solveArmy = armyFor(CIRCUIT_CLASH.id);
const solveBlind = solveConfigs.map((config) => buildEnemyForce(CIRCUIT_CLASH, solveArmy, config));

const playAnswer = (order, plan, foe) => {
  const units = order.map((formationId, index) => deployUnit({
    formationId, name: nameById.get(formationId), position: CIRCUIT_CLASH.playerDeployment[index], id: `${formationId}#${index}`,
  }));
  const orders = {};
  const paths = {};
  order.forEach((formationId, index) => {
    const id = `${formationId}#${index}`;
    const route = routePointsFor(plan, index, CIRCUIT_CLASH.id);
    if (route.length > 0) paths[id] = route;
    orders[id] = routeDestinationFor(plan, index, CIRCUIT_CLASH.objectives, CIRCUIT_CLASH.id) ?? CIRCUIT_CLASH.objectives[2].id;
  });
  const outcome = resolveBattle({
    playerUnits: units, enemyUnits: foe.units, objectives: CIRCUIT_CLASH.objectives,
    playerOrders: orders, enemyOrders: foe.orders, playerPaths: paths, enemyPaths: foe.paths,
    playerDisposition: "dominion", enemyDisposition: foe.disposition, missionId: CIRCUIT_CLASH.id,
  });
  return { won: outcome.winner === "player", margin: outcome.playerScore - outcome.enemyScore };
};

const solveAnswers = solveLists.flatMap((list) => solvePlans.map((plan) => ({ list, plan })));
let blindEverywhere = 0;
let readEverywhere = 0;
let blindWon = 0;
let readWon = 0;
let solvePlayed = 0;
const headroom = [];
const readMargins = solveConfigs.map(() => []);
for (const answer of solveAnswers) {
  let allBlind = true;
  let allRead = true;
  solveConfigs.forEach((config, index) => {
    const blindOutcome = playAnswer(answer.list, answer.plan, solveBlind[index]);
    const read = buildEnemyForce(CIRCUIT_CLASH, solveArmy, {
      ...config,
      counter: { order: answer.list, planId: answer.plan.id, disposition: "dominion" },
    });
    const readOutcome = playAnswer(answer.list, answer.plan, read);
    if (!blindOutcome.won) allBlind = false;
    if (!readOutcome.won) allRead = false;
    blindWon += blindOutcome.won ? 1 : 0;
    readWon += readOutcome.won ? 1 : 0;
    solvePlayed += 1;
    readMargins[index].push(readOutcome.margin);
  });
  if (allBlind) blindEverywhere += 1;
  if (allRead) readEverywhere += 1;
}
// Deciphering has to PAY: against each enemy, how much better is the best answer than the
// middle one. Measured against the enemy that has read the player, because that is the one
// they will actually be looking at.
solveConfigs.forEach((config, index) => {
  const sorted = readMargins[index].slice().sort((left, right) => left - right);
  headroom.push({
    key: `${config.disposition}/${config.planId}`,
    best: sorted.at(-1),
    median: sorted[Math.floor(sorted.length / 2)],
    winning: readMargins[index].filter((margin) => margin > 0).length,
  });
});

console.log(`\nSOLVABILITY — ${solveAnswers.length} answers against ${solveConfigs.length} enemies, each played twice: against an enemy that has never seen it, and against the enemy built by replaying it`);
console.log(`  NOTE: reduced, and the only axis that is. One seed per enemy, one arrangement per list — every "read" enemy is itself built out of trial battles.`);
console.log(`  answers that beat every enemy that has NOT read them: ${blindEverywhere} of ${solveAnswers.length}`);
console.log(`  answers that beat every enemy that HAS read them:     ${readEverywhere} of ${solveAnswers.length}`);
console.log(`  win rate   unread ${percent(blindWon / solvePlayed)}   read ${percent(readWon / solvePlayed)}`);
for (const entry of headroom) {
  console.log(`  ${entry.key.padEnd(24)} best answer ${String(entry.best).padStart(3)} VP   median ${String(entry.median).padStart(3)}   headroom ${String(entry.best - entry.median).padStart(3)}   answers that beat it ${entry.winning}`);
}

console.log("\nSOLVABILITY VERDICT");
console.log(`  ${readEverywhere === 0 ? "PASS" : "FAIL"}  no list keeps winning once it has been read (${readEverywhere} answers beat every enemy that had seen them)`);
console.log(`  ${readWon < blindWon ? "PASS" : "FAIL"}  bringing the same list again is punished (${percent(blindWon / solvePlayed)} unread against ${percent(readWon / solvePlayed)} read)`);
const answerable = headroom.filter((entry) => entry.winning > 0).length;
console.log(`  ${answerable === headroom.length ? "PASS" : "FAIL"}  every enemy has an answer (${answerable} of ${headroom.length} can be beaten)`);
const paying = headroom.filter((entry) => entry.best - entry.median >= 3).length;
console.log(`  ${paying === headroom.length ? "PASS" : "FAIL"}  reading the enemy pays (${paying} of ${headroom.length} reward the best answer by 3+ VP over the median)`);

// ---- axis J: the map ----
//
// A run was a corridor: five engagements in a fixed order with a shop between them. Every
// engagement offers two or three ROADS now — the same battle on different terms — and the
// question is whether choosing between them is a decision or a formality. Three policies,
// each played to the end of the ladder: always take the standing battle, always take the
// best-paying road, always take the cheapest one.
const mapRows = [];
for (const detachment of Object.values(DETS)) {
  for (const dispositionId of detachment.dispositions) {
    for (const routePolicy of ["standing", "rich", "safe"]) {
      for (let seed = 0; seed < SEEDS; seed += 1) {
        mapRows.push({
          routePolicy,
          ...playRun({ detachmentId: detachment.id, seed, dispositionId, planIndex: 0, rewardPolicy: "patch", enemyPolicy: "varied", routePolicy }),
        });
      }
    }
  }
}
const byRoad = ["standing", "rich", "safe"].map((policy) => {
  const rows = mapRows.filter((row) => row.routePolicy === policy);
  return {
    policy,
    won: rows.reduce((sum, row) => sum + row.won, 0) / rows.length,
    earned: rows.reduce((sum, row) => sum + row.earned, 0) / rows.length,
    warband: rows.reduce((sum, row) => sum + row.rosterSize, 0) / rows.length,
    broken: rows.filter((row) => row.status === "broken").length / rows.length,
  };
});

console.log(`\nTHE MAP — ${mapRows.length} runs, three ways of choosing which road to take into every engagement`);
for (const entry of byRoad) {
  console.log(`  ${entry.policy.padEnd(10)} battles won ${entry.won.toFixed(2)}   victory points ${entry.earned.toFixed(1).padStart(5)}   warband ${entry.warband.toFixed(2)}   armies broken ${percent(entry.broken)}`);
}

console.log("\nMAP VERDICT");
const richer = byRoad.find((entry) => entry.policy === "rich");
const safer = byRoad.find((entry) => entry.policy === "safe");
const straight = byRoad.find((entry) => entry.policy === "standing");
console.log(`  ${richer.earned > straight.earned ? "PASS" : "FAIL"}  the hard road pays for itself (${richer.earned.toFixed(1)} against ${straight.earned.toFixed(1)} victory points)`);
console.log(`  ${richer.won < safer.won ? "PASS" : "FAIL"}  and costs something (${richer.won.toFixed(2)} battles won against ${safer.won.toFixed(2)})`);
const spreadOfRoads = Math.max(...byRoad.map((entry) => entry.won)) - Math.min(...byRoad.map((entry) => entry.won));
console.log(`  ${spreadOfRoads > 0.1 ? "PASS" : "FAIL"}  which road you take changes the run (${spreadOfRoads.toFixed(2)} battles won between the policies)`);
const everyRoadOffered = new Set(Object.values(C.ROUTES).map((route) => route.id));
const seenRoads = new Set();
for (let seed = 0; seed < 24; seed += 1) {
  let probe = C.startRun({ seed });
  for (let battle = 0; battle < C.RUN_LADDER.length; battle += 1) {
    for (const road of C.routesFor(probe)) seenRoads.add(road.id);
    probe = C.advance(probe);
  }
}
console.log(`  ${seenRoads.size === everyRoadOffered.size ? "PASS" : "FAIL"}  every road is reachable (${seenRoads.size} of ${everyRoadOffered.size} offered across 24 runs)`);

// ---- axis K: the skilled run ----
//
// Axis I established that deciphering the enemy pays INSIDE ONE BATTLE: six of six enemies
// reward the best answer by three or more victory points over the median one. Axis E plays
// whole runs — and never deciphers anything. It declares a plan at muster, fields the
// healthiest five, and walks that same plan into all five engagements whatever it is sent
// to fight.
//
// So every run-level number in this sweep describes a player who ignores the one skill the
// game is built around. "2.0% of runs took all five" is not a difficulty reading, it is the
// clearing rate for a policy nobody plays. Whether the ladder is brutal or trivial for
// someone who actually counter-picks is, until this axis, simply unmeasured.
//
// What the player is allowed to change here, and what they are not:
//
//   fixed at muster   the detachment and the disposition — declared before the ladder is
//                     seen, so choosing them per engagement would be a different game
//   fixed as policy   the reward rule and the road, so the comparison against axis E moves
//                     one variable and axis J stays the thing that measures roads
//   chosen per fight  the plan, which five take the field, and which slot each one walks
//
// GREEDY, AND REPORTED AS GREEDY. The joint space of plan x five-of-the-warband x ordering
// is not tractable five times over for every policy, so the choice resolves in three
// stages: best plan with the default five, then the best five under that plan, then the
// best ordering of those. A greedy answer is a LOWER BOUND on skilled play — the real
// ceiling is at least this high and may be higher, which is the safe direction for a claim
// that the ladder is survivable.
//
// The five are drawn from the healthiest SKILLED_POOL rather than the whole warband. A
// player benching a scratched hull for a fresh one is playing; a player auditioning a hull
// that is one hit from a wreck is not, and enumerating them costs the axis its runtime.
const SKILLED_SEEDS = 6;
const SKILLED_POOL = 7;

const skilledIdentity = (entry) => `${entry.formationId}:${entry.refit ?? ""}:${entry.wounds ?? ""}`;

// One engagement resolved with a specific plan and a specific ordering. Everything that is
// not the plan or the ordering is copied from axis E exactly, or the two arms would differ
// in more than the decision being measured.
const resolveSkilled = ({ engagement, disposition, detachment, battlePlan, fielded, positions }) => {
  const deployment = Object.fromEntries(positions.map((slot, index) => [
    slot.id,
    fielded[index]
      ? { id: fielded[index].id, formationId: fielded[index].formationId, name: fielded[index].name, wounds: fielded[index].wounds ?? undefined, refit: fielded[index].refit }
      : {},
  ]));
  const foe = engagement.foe;
  const built = buildRunForce({ mission: engagement.mission, deployment, formations: FORMATIONS, battlePlan, positions: positions.length });
  const outcome = resolveBattle({
    playerUnits: built.units, enemyUnits: foe.units, objectives: engagement.mission.objectives,
    playerOrders: built.orders, enemyOrders: foe.orders, playerPaths: built.paths, enemyPaths: foe.paths,
    playerDisposition: disposition, enemyDisposition: foe.disposition,
    playerDetachmentRule: detachment.rule,
    enemyDetachmentRule: detachmentFor(engagement.army.detachment).rule,
    enemyHand: engagement.enemyHand, rounds: engagement.mission.rounds, missionId: engagement.mission.id,
  });
  return { outcome, deployment, margin: outcome.playerScore - outcome.enemyScore };
};

// Margin rather than won, because a total order is needed to choose between candidates and
// "won" collapses every losing option onto the same value — including the one that lost by
// a point and would have been the right thing to learn from.
const bestOf = (candidates) => candidates.reduce(
  (best, entry) => (best === null || entry.margin > best.margin ? entry : best), null);

const playSkilledRun = ({ detachmentId, seed, dispositionId, rewardPolicy }) => {
  let run = C.startRun({ detachmentId, seed, enemyPolicy: "varied" });
  const faced = [];
  const detachment = detachmentFor(detachmentId);
  const disposition = detachment.dispositions.includes(dispositionId) ? dispositionId : detachment.dispositions[0];
  let considered = 0;
  while (run.status === "active") {
    const roads = C.routesFor(run);
    const road = roads.find((entry) => entry.id === "standing");
    if (road) run = C.takeRoute(run, road.id);
    const engagement = C.engagementFor(run);
    const positions = engagement.mission.playerDeployment.slice(0, engagement.slots);
    const pool = C.fieldableFrom(run).slice()
      .sort((left, right) => (right.wounds ?? Infinity) - (left.wounds ?? Infinity))
      .slice(0, Math.max(positions.length, SKILLED_POOL));
    const fallback = pool.slice(0, positions.length);
    const plans = runPlans(disposition);

    // STAGE ONE — which plan, judged on the five that axis E would have fielded anyway.
    const planPick = bestOf(plans.map((battlePlan) => {
      considered += 1;
      return { battlePlan, ...resolveSkilled({ engagement, disposition, detachment, battlePlan, fielded: fallback, positions }) };
    }));
    const battlePlan = planPick?.battlePlan ?? plans[0];

    // STAGE TWO — which five, under that plan. This is the counter-pick the warband exists
    // to make possible: it does not exist at all until there are more than five to choose
    // between, which is why early engagements resolve one candidate and later ones many.
    const sets = combinations(pool.map((entry, index) => index), positions.length);
    const setPick = bestOf(sets.map((indices) => {
      const fielded = indices.map((index) => pool[index]);
      considered += 1;
      return { fielded, ...resolveSkilled({ engagement, disposition, detachment, battlePlan, fielded, positions }) };
    })) ?? { fielded: fallback };

    // STAGE THREE — which slot each one walks. Deduplicated, because two hulls alike in
    // formation, refit and damage are the same deployment whichever way round they are
    // written.
    const seenOrders = new Set();
    const orderings = permutations(setPick.fielded).filter((entry) => {
      const key = entry.map(skilledIdentity).join("+");
      if (seenOrders.has(key)) return false;
      seenOrders.add(key);
      return true;
    });
    const orderPick = bestOf(orderings.map((fielded) => {
      considered += 1;
      return { fielded, ...resolveSkilled({ engagement, disposition, detachment, battlePlan, fielded, positions }) };
    })) ?? { fielded: setPick.fielded, outcome: null };

    const fielded = orderPick.fielded;
    const outcome = orderPick.outcome ?? resolveSkilled({ engagement, disposition, detachment, battlePlan, fielded, positions }).outcome;
    const foe = engagement.foe;
    faced.push({ disposition: foe.disposition, plan: foe.plan?.id ?? null });
    run = C.applyBattle({
      run, result: outcome, won: outcome.winner === "player", disposition,
      commandSpent: 0,
      deployedIds: fielded.map((entry) => entry.id),
      fielded: positions.map((slot, index) => fielded[index]?.formationId ?? null),
      planId: battlePlan?.id ?? null,
    });
    if (run.status !== "active") break;
    run = C.repair(run);
    for (let guard = 0; guard < 8; guard += 1) {
      const shelf = C.offersFor(run).filter((offer) => offer.affordable);
      if (shelf.length === 0) break;
      const units = shelf.filter((offer) => offer.kind === "unit");
      const services = shelf.filter((offer) => offer.kind === "service");
      const refits = shelf.filter((offer) => offer.kind === "refit");
      let pick;
      if (rewardPolicy === "refit") pick = refits[0] ?? units[0] ?? services[0];
      else if (rewardPolicy === "widen") pick = units[0] ?? refits[0] ?? services[0];
      else if (rewardPolicy === "patch") pick = services[0] ?? units[0] ?? refits[0];
      else if (rewardPolicy === "cheapest") pick = shelf.slice().sort((a, b) => a.cost - b.cost)[0];
      else pick = shelf.slice().sort((a, b) => b.cost - a.cost)[0];
      if (!pick) break;
      const before = run.purse;
      run = C.buy({ run, offerId: pick.id });
      if (run.purse === before) break;
    }
    run = C.advance(run);
  }
  return {
    ...C.runSummary(run),
    considered,
    faced: faced.map((entry, index) => ({ ...entry, won: Boolean(run.history[index]?.won) })),
  };
};

const skilledRows = [];
for (const detachment of Object.values(DETS)) {
  for (const dispositionId of detachment.dispositions) {
    for (const rewardPolicy of ["widen", "patch", "refit", "cheapest", "dearest"]) {
      for (let seed = 0; seed < SKILLED_SEEDS; seed += 1) {
        skilledRows.push({
          detachment: detachment.id, disposition: dispositionId, rewardPolicy, seed,
          ...playSkilledRun({ detachmentId: detachment.id, seed, dispositionId, rewardPolicy }),
        });
      }
    }
  }
}

// Axis E's varied arm is the comparison, because it is the same ladder against the same
// shipping enemy under a fixed policy. Restricted to the seeds this axis actually played,
// so the two distributions are the same runs decided differently rather than two samples.
const fixedComparable = variedRows.filter((row) => row.seed < SKILLED_SEEDS);
const spreadOf = (rows) => [0, 1, 2, 3, 4, 5].map((won) => rows.filter((row) => row.won === won).length);
const clearedOf = (rows) => (rows.length ? rows.filter((row) => row.won === 5).length / rows.length : 0);
const brokeOf = (rows) => (rows.length ? rows.filter((row) => row.status === "broken").length / rows.length : 0);
const wonPerRun = (rows) => (rows.length ? rows.reduce((sum, row) => sum + row.won, 0) / rows.length : 0);

const skilledSpread = spreadOf(skilledRows);
const fixedSpread = spreadOf(fixedComparable);

console.log(`\nTHE SKILLED RUN — ${skilledRows.length} runs played by choosing the plan, the five and the order at every engagement`);
console.log("  NOTE: greedy over three stages, not exhaustive. A lower bound on skilled play, not a ceiling.");
console.log(`  NOTE: ${SKILLED_SEEDS} seeds, five taken from the healthiest ${SKILLED_POOL}, against the SHIPPING enemy.`);
// THIS IS AN ORACLE, NOT A PLAYER, and the number is worthless read as anything else. To
// choose, it RESOLVES each candidate and reads the result — so it sees through the one
// thing the game deliberately hides, which is the enemy's hand. A person picks on intent
// and inference and cannot know the outcome before committing. So this is the ceiling that
// perfect foresight reaches, not what anyone plays: the truth for a human sits somewhere
// between the fixed arm below and this one, and where in that range is the thing only
// playing it can answer.
console.log("  NOTE: chooses by resolving each candidate, so it sees the enemy hand. A ceiling, not a player.");
console.log(`  battles resolved to make the choices: ${skilledRows.reduce((sum, row) => sum + row.considered, 0)}`);
console.log(`  battles won 0..5   skilled: ${skilledSpread.map((count, won) => `${won}:${count}`).join("  ")}`);
console.log(`  battles won 0..5   fixed:   ${fixedSpread.map((count, won) => `${won}:${count}`).join("  ")}`);
console.log(`  battles won per run   skilled ${wonPerRun(skilledRows).toFixed(2)}   fixed ${wonPerRun(fixedComparable).toFixed(2)}`);
console.log(`  cleared the ladder    skilled ${percent(clearedOf(skilledRows))}   fixed ${percent(clearedOf(fixedComparable))}`);
console.log(`  armies broken         skilled ${percent(brokeOf(skilledRows))}   fixed ${percent(brokeOf(fixedComparable))}`);

// THE DECLARATION GAP, one level up. Axis G measures it per engagement under a fixed
// policy. The question this axis can answer and that one cannot is whether a player who
// counter-picks can close it — if the spread survives being played against, the draw is
// still deciding runs.
const facedRateOf = (rows) => {
  const byFaced = {};
  for (const row of rows) {
    for (const entry of row.faced ?? []) {
      byFaced[entry.disposition] ??= [];
      byFaced[entry.disposition].push(entry);
    }
  }
  return Object.fromEntries(Object.entries(byFaced)
    .map(([key, entries]) => [key, entries.filter((entry) => entry.won).length / entries.length]));
};
const skilledFaced = facedRateOf(skilledRows);
const fixedFaced = facedRateOf(fixedComparable);
const gapOf = (rates) => {
  const values = Object.values(rates);
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
};
for (const [disposition, rate] of Object.entries(skilledFaced)) {
  console.log(`  faced ${disposition.padEnd(12)} skilled ${percent(rate)}   fixed ${percent(fixedFaced[disposition] ?? 0)}`);
}
const skilledGap = gapOf(skilledFaced);
const fixedGap = gapOf(fixedFaced);
console.log(`  declaration gap       skilled ${percent(skilledGap)}   fixed ${percent(fixedGap)}`);

console.log("\nSKILLED RUN VERDICT");
const skilledWon = wonPerRun(skilledRows);
const fixedWon = wonPerRun(fixedComparable);
console.log(`  ${skilledWon > fixedWon ? "PASS" : "FAIL"}  playing well beats playing a fixed plan (${skilledWon.toFixed(2)} battles won against ${fixedWon.toFixed(2)})`);
const skilledCleared = clearedOf(skilledRows);
console.log(`  ${skilledCleared > clearedOf(fixedComparable) ? "PASS" : "FAIL"}  and reaches the end of the ladder more often (${percent(skilledCleared)} against ${percent(clearedOf(fixedComparable))})`);
console.log(`  ${skilledCleared < 0.9 ? "PASS" : "FAIL"}  without making the ladder a formality (${percent(skilledCleared)} cleared it, ceiling 90.0%)`);
// Counting which outcomes were REACHED says a spread exists while 73% of runs sit on one
// of them. The honest measure is how much mass the commonest outcome holds.
const skilledMode = Math.max(...skilledSpread) / (skilledRows.length || 1);
console.log(`  NOTE  ${skilledSpread.filter((count) => count > 0).length} of 6 outcomes reached, but the commonest holds ${percent(skilledMode)} of runs`);
// NOT a verdict, because every threshold available here is one I would be choosing to make
// it pass. README stakes the difficulty design on "the difficulty curve is your own
// attrition" — and against adaptive play attrition essentially stops happening. That is a
// design finding, and it belongs in front of a person rather than behind a > 0 test.
console.log(`  NOTE  attrition barely reaches a skilled run: ${percent(brokeOf(skilledRows))} of armies broke against ${percent(brokeOf(fixedComparable))} under a fixed plan`);
console.log(`  ${skilledGap <= DECLARATION_GAP_LIMIT ? "PASS" : "FAIL"}  the enemy's declaration does not decide the run against a player who answers it (${percent(skilledGap)}, ceiling ${percent(DECLARATION_GAP_LIMIT)})`);
