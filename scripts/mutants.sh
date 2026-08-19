#!/bin/bash
# Deliberately break the thing each new guard protects, and confirm the guard fails.
# A test that passes against a broken implementation is not a guard.
#
# This lived in /tmp for most of the project's life and was rebuilt from scratch every time
# a session ended. 149 mutants is too much measurement to keep re-deriving, so it is in the
# repo now. Run it from anywhere: `bash scripts/mutants.sh`.
cd "$(dirname "$0")/.." || exit 1
pass=0; fail=0; skipped=0; skips=""

# An interrupted run used to leave a mutated source file on disk — a killed script skips
# its restore, and the next sweep then measures a deliberately broken build. Restore every
# outstanding backup on any exit, including SIGINT and SIGTERM.
restore_all () {
  for backup in $(find src tests scripts -name '*.bak' 2>/dev/null); do
    mv "$backup" "${backup%.bak}"
    echo "restored ${backup%.bak}"
  done
}
trap restore_all EXIT INT TERM

mutate () {
  local label="$1" file="$2" from="$3" to="$4" tests="$5"
  cp "$file" "$file.bak"
  python3 - "$file" "$from" "$to" <<'PY'
import sys
path, frm, to = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path).read()
if s.count(frm) != 1:
    print(f"SKIP-PATTERN({s.count(frm)})"); sys.exit(3)
open(path, "w").write(s.replace(frm, to))
PY
  if [ $? -eq 3 ]; then
    mv "$file.bak" "$file"
    echo "?? $label — pattern not unique"
    skipped=$((skipped+1)); skips="$skips\n    $label"
    return
  fi
  if node --test $tests >/dev/null 2>&1; then
    echo "!! SURVIVED: $label — the guard does not catch this"; fail=$((fail+1))
  else
    echo "   killed:   $label"; pass=$((pass+1))
  fi
  mv "$file.bak" "$file"
}

echo "=== stratagems ==="
mutate "a stratagem fires in every round rather than the one it was committed to" src/battle/battleRules.js \
      '.filter((entry) => entry?.round === round)' \
      '.filter((entry) => Boolean(entry?.round))' \
      "tests/battle-stratagems.test.mjs"
mutate "BRACE stops reducing incoming fire" src/battle/battleRules.js \
      'const dealt = damageFor({ attacker: unit, target: chosen.enemy, hitBonus: commandBonusFor(unit, attackers) + hitBonus }) * damageScale;' \
      'const dealt = damageFor({ attacker: unit, target: chosen.enemy, hitBonus: commandBonusFor(unit, attackers) + hitBonus });' \
      "tests/battle-stratagems.test.mjs"
mutate "stacked effects overwrite each other instead of multiplying" src/battle/battleRules.js \
      '    incomingDamageScale: acc.incomingDamageScale * (effect.incomingDamageScale ?? 1),' \
      '    incomingDamageScale: effect.incomingDamageScale ?? acc.incomingDamageScale,' \
      "tests/battle-stratagems.test.mjs"
mutate "FOCUS FIRE drifts back onto the nearest target" src/battle/battleRules.js \
      '  const focus = focusFire ? focusTarget(defenders) : null;' \
      '  const focus = null;' \
      "tests/battle-stratagems.test.mjs"
mutate "FOCUS FIRE picks the nearest rather than the most dangerous" src/battle/battleRules.js \
      '  unit.shots * Math.max(0, 7 - unit.hit) + unit.melee * 3 + unit.control' \
      '  -unit.y' \
      "tests/battle-stratagems.test.mjs"
mutate "HOLD FAST stops doubling control" src/battle/battleRules.js \
      '    .reduce((sum, unit) => sum + unit.control, 0) * scale;' \
      '    .reduce((sum, unit) => sum + unit.control, 0);' \
      "tests/battle-stratagems.test.mjs"
mutate "OVERWATCH fires after the advance like any other shooting" src/battle/battleRules.js \
      '    if (playerEffects.extraShootingPhase) {' \
      '    if (false) {' \
      "tests/battle-stratagems.test.mjs"
mutate "EXECUTION ORDER stops striking first" src/battle/battleRules.js \
      '    const answers = !playerEffects.meleeFirst || (struckBack?.wounds ?? 0) > 0;' \
      '    const answers = true;' \
      "tests/battle-stratagems.test.mjs"
mutate "the enemy hand ignores the seed and is always the top of the pool" src/battle/stratagems.js \
      '    .sort((left, right) => left.key - right.key || (left.id < right.id ? -1 : 1))' \
      '    .sort((left, right) => (left.id < right.id ? -1 : 1))' \
      "tests/battle-stratagems.test.mjs"
mutate "the hand can contain the same card twice" src/battle/stratagems.js \
      '  return pool
    .map((id, index) => ({ id, key: shuffleKey(seed, index) }))' \
      '  return [...pool, ...pool]
    .map((id, index) => ({ id, key: shuffleKey(seed, index % pool.length) }))' \
      "tests/battle-stratagems.test.mjs"
mutate "the enemy draws from every stratagem rather than its own pool" src/battle/stratagems.js \
      '  const pool = (detachment?.pool ?? []).filter((id) => STRATAGEMS[id]);' \
      '  const pool = Object.keys(STRATAGEMS);' \
      "tests/battle-stratagems.test.mjs"
mutate "the enemy spends silently, off the log" src/battle/battleRules.js \
      '      log.push({ phase: "stratagem", side: spend.side, actor: spend.name, target: spend.text, amount: `${spend.cost} CP` });' \
      '      if (spend.side === "player") log.push({ phase: "stratagem", side: spend.side, actor: spend.name, target: spend.text, amount: `${spend.cost} CP` });' \
      "tests/battle-stratagems.test.mjs"
mutate "the scouting report leaks which cards are actually held" src/battle/stratagems.js \
      '  return { id, name: stratagem.name, cost: stratagem.cost, trigger: TRIGGERS[stratagem.trigger], text: stratagem.text };' \
      '  return { id, name: stratagem.name, cost: stratagem.cost, trigger: TRIGGERS[stratagem.trigger], text: stratagem.text, hand: true };' \
      "tests/battle-stratagems.test.mjs"
mutate "the opening double advance is removed and half the battle is walking" src/battle/battleRules.js \
      '    const moves = (extra) => Math.max(round === 1 ? 2 : 1, extra ? 2 : 1);' \
      '    const moves = (extra) => 1;' \
      "tests/battle-rules.test.mjs"
mutate "SURGE FORWARD stacks with the opening advance again" src/battle/battleRules.js \
      '    const moves = (extra) => Math.max(round === 1 ? 2 : 1, extra ? 2 : 1);' \
      '    const moves = (extra) => (round === 1 ? 2 : 1) + (extra ? 1 : 0);' \
      "tests/battle-stratagems.test.mjs"

echo "=== detachment -> disposition -> strategy ==="
mutate "detachments stop gating dispositions" src/battle/doctrine.js \
      'export const dispositionsFor = (detachment) => (detachment?.dispositions ?? [])' \
      'export const dispositionsFor = (detachment) => Object.keys(DISPOSITIONS)' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "DOMINION starts paying for kills as well as ground" src/battle/doctrine.js \
      '    score: ({ objectives, side }) => heldPoints(objectives, side),' \
      '    score: ({ objectives, side, destroyed }) => heldPoints(objectives, side) + destroyed,' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "SAFEGUARD starts cashing ground in the enemy half" src/battle/doctrine.js \
      '    sites: (objectives, side) => objectives
      .filter((objective) => inOwnHalf(objective, side))' \
      '    sites: (objectives, side) => objectives
      .filter((objective) => !inOwnHalf(objective, side))' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "the halves stop being mirrored, so the enemy scores by the player's map" src/battle/doctrine.js \
      'const inOwnHalf = (objective, side) => (side === "player" ? objective.y > 50 : objective.y < 50);' \
      'const inOwnHalf = (objective) => objective.y > 50;' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "a wreck is paid for again every remaining round" src/battle/battleRules.js \
      '    const playerLost = players.filter((unit) => unit.wounds <= 0).length - playersLostSoFar;' \
      '    const playerLost = players.filter((unit) => unit.wounds <= 0).length;' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "both armies score under the player's disposition" src/battle/battleRules.js \
      'const enemyGained = scoreRound({ disposition: enemyDisposition, side: "enemy",' \
      'const enemyGained = scoreRound({ disposition: playerDisposition, side: "enemy",' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "an unknown disposition throws instead of falling back" src/battle/doctrine.js \
      'export const dispositionFor = (id) => DISPOSITIONS[id] ?? DISPOSITIONS.dominion;' \
      'export const dispositionFor = (id) => DISPOSITIONS[id];' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "two strategies inside a disposition become the same plan" src/battle/battlePlans.js \
      '        ["southWest", "southRelay"],
        ["centreSouth", "reactor"],
        ["centreSouth", "reactor"],
        ["southEast", "eastApproach", "eastGantry"],
        ["eastGate", "eastApproach", "eastGantry", "eastNorth"],' \
      '        ["westGate", "westApproach", "westWorks"],
        ["southWest", "southRelay"],
        ["centreSouth", "reactor"],
        ["southEast", "eastApproach", "eastGantry"],
        ["eastGate", "eastApproach", "eastGantry"],' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "the enemy declares a disposition its detachment forbids" src/battle/battleMission.js \
      '  detachment: "ordoPraesidium",
  disposition: "dominion",' \
      '  detachment: "ordoPraesidium",
  disposition: "safeguard",' \
      "tests/battle-missions.test.mjs"

echo "=== plans with paths ==="
mutate "a formation beelines instead of walking its route" src/battle/battleRules.js \
      '      return Array.isArray(path) && path.length > 0 ? walk(unit, path) : advance(unit, objectiveById.get(orders[unit.id]));' \
      '      return advance(unit, objectiveById.get(orders[unit.id]));' \
      "tests/battle-plans.test.mjs"
mutate "movement stops dead at every waypoint instead of carrying over" src/battle/battleRules.js \
      '    if (step >= gap - 1e-9) index += 1;' \
      '    if (step >= gap - 1e-9) index += 1;
    budget = 0;' \
      "tests/battle-plans.test.mjs"
mutate "a formation keeps drifting after its route ends" src/battle/battleRules.js \
      '  let index = Math.min(unit.waypoint ?? 0, path.length);' \
      '  let index = 0;' \
      "tests/battle-plans.test.mjs"
mutate "unknown ground resolves to the origin instead of being dropped" src/battle/battleTerrain.js \
      '  .map((name) => landmark(name, missionId))
  .filter(Boolean)' \
      '  .map((name) => landmark(name, missionId) ?? { x: 0, y: 0 })' \
      "tests/battle-plans.test.mjs"
mutate "resolved routes share the map, so a walking unit can move a landmark" src/battle/battleTerrain.js \
      '  .map((point) => ({ ...point }));' \
      '  ;' \
      "tests/battle-plans.test.mjs"
mutate "a plan declares ground its own route never reaches" src/battle/battlePlans.js \
      '  return objectives.find((objective) => Math.hypot(objective.x - end.x, objective.y - end.y) < 1)?.id ?? null;' \
      '  return objectives[2]?.id ?? null;' \
      "tests/battle-plans.test.mjs"
mutate "the plan's route is not given to the formation walking it" src/battle/battleMission.js \
      '    if (route.length > 0) paths[formation.id] = route;' \
      '    if (route.length > 100) paths[formation.id] = route;' \
      "tests/battle-plans.test.mjs"
mutate "an explicit override stops beating the plan" src/battle/battleMission.js \
      '    orders[formation.id] = entry.objectiveId' \
      '    orders[formation.id] = undefined' \
      "tests/battle-plans.test.mjs"
mutate "the enemy goes back to beelining as a flat rank" src/battle/battleMission.js \
      '    .map((entry) => [`enemy-${entry.formationId}`, resolveRoute(entry.route ?? [], mission.id)])' \
      '    .map((entry) => [`enemy-${entry.formationId}`, []])' \
      "tests/battle-plans.test.mjs"
mutate "the detachment rule stops applying" src/battle/battleRules.js \
      '    const playerEffects = effectsOf([playerDetachmentRule, ...playerCards]);' \
      '    const playerEffects = effectsOf([...playerCards]);' \
      "tests/battle-plans.test.mjs"
mutate "the ranged detachment rule stops improving its shooting" src/battle/battleRules.js \
      '    shootingHitBonus: acc.shootingHitBonus + (effect.shootingHitBonus ?? 0),' \
      '    shootingHitBonus: acc.shootingHitBonus,' \
      "tests/battle-plans.test.mjs"
mutate "two detachments become the same army" src/battle/stratagems.js \
      'rule: { name: "JAWS FIRST", text: "Every formation fights at half again in melee.", effect: { meleeScale: 1.5 } },' \
      'rule: { name: "JAWS FIRST", text: "Every formation fights at half again in melee.", effect: { incomingDamageScale: 0.9 } },' \
      "tests/battle-plans.test.mjs"
mutate "a strategy stops being a plan and becomes one hop to an objective" src/battle/battlePlans.js \
      '        ["westGate", "westApproach", "westWorks"],
        ["southWest", "southRelay"],
        ["centreSouth", "reactor"],
        ["southEast", "eastApproach", "eastGantry"],
        ["eastGate", "eastApproach", "eastGantry"],
      ],
    ),
    plan(
      "spear", "SPEAR",' \
      '        ["westWorks"],
        ["southRelay"],
        ["reactor"],
        ["eastGantry"],
        ["eastGantry"],
      ],
    ),
    plan(
      "spear", "SPEAR",' \
      "tests/battle-doctrine-layers.test.mjs"

echo "=== missions and live objectives ==="
mutate "ERADICATION leaves the markers live and scores ground too" src/battle/doctrine.js \
      '    sites: () => [],' \
      '    sites: (objectives) => objectives,' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "SAFEGUARD lights the whole board again" src/battle/doctrine.js \
      '    sites: (objectives, side) => objectives
      .filter((objective) => inOwnHalf(objective, side))' \
      '    sites: (objectives, side) => objectives
      .filter(() => true)' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "SAFEGUARD stops paying double for the little it can score" src/battle/doctrine.js \
      '      .map((objective) => ({ ...objective, points: objective.points * 2 })),' \
      '      .map((objective) => ({ ...objective })),' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "re-valuing a live site scribbles on the mission" src/battle/doctrine.js \
      '      .map((objective) => ({ ...objective, points: objective.points * 2 })),' \
      '      .map((objective) => Object.assign(objective, { points: objective.points * 2 })),' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "the scoring rule reads every marker instead of the live ones" src/battle/doctrine.js \
      '  const live = rule.sites(objectives, side);' \
      '  const live = objectives;' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "every board resolves against the first board's ground" src/battle/battleTerrain.js \
      'export const landmarksFor = (missionId) => LANDMARK_TABLES[missionId] ?? CIRCUIT_LANDMARKS;' \
      'export const landmarksFor = () => CIRCUIT_LANDMARKS;' \
      "tests/battle-missions.test.mjs"
mutate "the second board is the first one with new labels" src/battle/battleMission.js \
      'export const ARMIES = { "circuit-clash": IRON_PROCESSION, narrows: SALT_COVENANT };' \
      'export const ARMIES = { "circuit-clash": IRON_PROCESSION, narrows: IRON_PROCESSION };' \
      "tests/battle-missions.test.mjs"
mutate "the second board becomes lopsided" src/battle/battleMission.js \
      '{ id: "north-yard", name: "NORTH YARD", x: 50, y: 32, points: 1 },' \
      '{ id: "north-yard", name: "NORTH YARD", x: 50, y: 32, points: 2 },' \
      "tests/battle-missions.test.mjs"
mutate "the tight board stops being tight" src/battle/battleMission.js \
      '{ id: "south-yard", name: "SOUTH YARD", x: 50, y: 68, points: 1 },' \
      '{ id: "south-yard", name: "SOUTH YARD", x: 50, y: 90, points: 1 },' \
      "tests/battle-missions.test.mjs"
mutate "the enemy army routes across ground the board does not name" src/battle/battleMission.js \
      '{ formationId: "skimmer", name: "SHORE LANCE", slot: "e4", target: "north-yard", route: ["northRelay"] },' \
      '{ formationId: "skimmer", name: "SHORE LANCE", slot: "e4", target: "north-yard", route: ["northRelay", "saltPier"] },' \
      "tests/battle-missions.test.mjs"


echo "=== after-action readout ==="
mutate "the readout measures ground even when no ground scores" src/battle/afterAction.js \
      '  const measure = sites.length === 0 ? "damage" : "ground";' \
      '  const measure = "ground";' \
      "tests/battle-after-action.test.mjs"
mutate "a formation is credited for standing on ground the enemy held" src/battle/afterAction.js \
      '  && round.objectives.find((entry) => entry.objectiveId === site.id)?.holder === "player"' \
      '  && true' \
      "tests/battle-after-action.test.mjs"
mutate "a wreck is credited for holding ground after it died" src/battle/afterAction.js \
      '  unit.wounds > 0
  && distance(unit, site) <= OBJECTIVE_CONTROL_RANGE' \
      '  distance(unit, site) <= OBJECTIVE_CONTROL_RANGE' \
      "tests/battle-after-action.test.mjs"
mutate "the round a formation was lost keeps being overwritten" src/battle/afterAction.js \
      '      if (unit.wounds <= 0 && record.lostInRound === null) {' \
      '      if (unit.wounds <= 0) {' \
      "tests/battle-after-action.test.mjs"
mutate "contributions stop being a share of the whole" src/battle/afterAction.js \
      'const percent = (part, whole) => (whole > 0 ? Math.round((100 * part) / whole) : 0);' \
      'const percent = (part) => Math.round(part);' \
      "tests/battle-after-action.test.mjs"
mutate "the readout is not ordered by contribution" src/battle/afterAction.js \
      '      .sort((left, right) => right.contribution - left.contribution || left.name.localeCompare(right.name)),' \
      '      .sort((left, right) => left.name.localeCompare(right.name)),' \
      "tests/battle-after-action.test.mjs"

echo "=== accessibility ==="
mutate "a label is dimmed with opacity instead of colour" src/battle/battle.css \
      '.battle-objective.dark b { border-style: dashed; border-color: #34464b; color: #8b9aa0; }' \
      '.battle-objective.dark { opacity: .38; }
.battle-objective.dark b { border-style: dashed; border-color: #34464b; color: #6d7c81; }' \
      "tests/accessibility.test.mjs"
mutate "a text colour drops under the contrast floor" src/battle/battle.css \
      '.battle-hint { margin: 0; color: #93a8a2;' \
      '.battle-hint { margin: 0; color: #3a4a47;' \
      "tests/accessibility.test.mjs"
mutate "motion can no longer be turned off" src/battle/battle.css \
      '@media (prefers-reduced-motion: reduce) { .battle-unit { transition: none; } }' \
      '@media (prefers-reduced-motion: reduce) { .battle-unit { outline: none; } }' \
      "tests/accessibility.test.mjs"
mutate "the drawn plan starts swallowing clicks meant for the board" src/battle/battle.css \
      '.battle-routes { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; }' \
      '.battle-routes { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; }' \
      "tests/accessibility.test.mjs"
mutate "the score stops being announced" src/battle/BattleApp.jsx \
      '<div className="battle-score" aria-live="polite">' \
      '<div className="battle-score">' \
      "tests/app-render.test.mjs"
mutate "a select loses its accessible name" src/battle/BattleApp.jsx \
      '              <label className="battle-seed">
                <span>WARBAND</span>' \
      '              <label className="battle-seed">
                <span></span>' \
      "tests/app-render.test.mjs"


echo "=== the run ==="
mutate "one lost battle ends the run again" src/battle/campaign.js \
      '  if (fieldableFrom(next).length < MINIMUM_FORCE) return { ...next, status: "broken" };' \
      '  if (!won) return { ...next, status: "broken" };
  if (fieldableFrom(next).length < MINIMUM_FORCE) return { ...next, status: "broken" };' \
      "tests/battle-campaign.test.mjs"
mutate "an army too small to field fights on forever" src/battle/campaign.js \
      '  if (fieldableFrom(next).length < MINIMUM_FORCE) return { ...next, status: "broken" };' \
      '  if (fieldableFrom(next).length < 0) return { ...next, status: "broken" };' \
      "tests/battle-campaign.test.mjs"
mutate "wounds stop carrying between battles" src/battle/campaign.js \
      '    roster.push({ ...entry, wounds: Number(remaining.toFixed(2)) });' \
      '    roster.push({ ...entry, wounds: null });' \
      "tests/battle-campaign.test.mjs"
mutate "wrecks come back for the next engagement" src/battle/campaign.js \
      '    if (!Number.isFinite(remaining) || remaining <= 0) { lost.push(entry); continue; }' \
      '    if (false) { lost.push(entry); continue; }' \
      "tests/battle-campaign.test.mjs"
mutate "formations left on the bench take damage anyway" src/battle/campaign.js \
      '    if (!deployedIds.includes(entry.formationId)) { roster.push(entry); continue; }' \
      '    if (false) { roster.push(entry); continue; }' \
      "tests/battle-campaign.test.mjs"
mutate "a fully repaired formation keeps reading as damaged" src/battle/campaign.js \
      '    const healed = Math.min(entry.wounds + repairAmountFor(run), fullStrength(entry));
    return healed >= fullStrength(entry) ? { ...entry, wounds: null } : { ...entry, wounds: Number(healed.toFixed(2)) };' \
      '    const healed = Math.min(entry.wounds + repairAmountFor(run), fullStrength(entry));
    return { ...entry, wounds: Number(healed.toFixed(2)) };' \
      "tests/battle-campaign.test.mjs"
mutate "ERADICATION stops thinning the next engagement" src/battle/campaign.js \
      '    attrition: disposition === "eradication" ? Math.min(2, (run.attrition ?? 0) + broke) : 0,' \
      '    attrition: 0,' \
      "tests/battle-campaign.test.mjs"
mutate "attrition empties the enemy board entirely" src/battle/campaign.js \
      '  const strength = Math.max(3, (rung.enemyCount ?? army.units.length) - (run.attrition ?? 0));' \
      '  const strength = Math.max(0, (rung.enemyCount ?? army.units.length) - (run.attrition ?? 0));' \
      "tests/battle-campaign.test.mjs"
mutate "DOMINION stops turning held ground into repair" src/battle/campaign.js \
      '    supply: disposition === "dominion" ? heldGround : 0,' \
      '    supply: 0,' \
      "tests/battle-campaign.test.mjs"
mutate "the opening ramp is removed and battle one is the full army" src/battle/campaign.js \
      '{ mission: CIRCUIT_CLASH.id, enemyCount: 3, handSize: 1, name: "FIRST CONTACT", brief: "A screening force. The rest of them is behind it." },' \
      '{ mission: CIRCUIT_CLASH.id, enemyCount: 5, handSize: 1, name: "FIRST CONTACT", brief: "A screening force. The rest of them is behind it." },' \
      "tests/battle-campaign.test.mjs"
mutate "the run reports only battles won, hiding how many it fought" src/battle/campaign.js \
      '  fought: run.history.length,' \
      '  fought: RUN_LADDER.length,' \
      "tests/battle-campaign.test.mjs"
mutate "a run always faces the same board" src/battle/campaign.js \
      '  { mission: THE_NARROWS.id, enemyCount: 4, handSize: 1, name: "THE SQUEEZE", brief: "Close ground, and more of them than last time." },' \
      '  { mission: CIRCUIT_CLASH.id, enemyCount: 4, handSize: 1, name: "THE SQUEEZE", brief: "Close ground, and more of them than last time." },' \
      "tests/battle-campaign.test.mjs"
mutate "income is the margin rather than what you scored" src/battle/campaign.js \
      '    purse: run.purse + (result?.playerScore ?? 0),' \
      '    purse: run.purse + Math.max(0, (result?.playerScore ?? 0) - (result?.enemyScore ?? 0)),' \
      "tests/battle-campaign.test.mjs"
mutate "the purse is not spent when something is bought" src/battle/campaign.js \
      '  const paid = { ...run, purse: run.purse - offer.cost, spent: run.spent + offer.cost };' \
      '  const paid = { ...run, purse: run.purse, spent: run.spent + offer.cost };' \
      "tests/battle-campaign.test.mjs"
mutate "anything can be bought regardless of the purse" src/battle/campaign.js \
      '  if (!offer || offer.cost > run.purse) return run;' \
      '  if (!offer) return run;' \
      "tests/battle-campaign.test.mjs"
mutate "a purchase arrives already damaged" src/battle/campaign.js \
      '      roster: [...paid.roster, { formationId: offer.id, name: offer.name, wounds: null, refit: null }],' \
      '      roster: [...paid.roster, { formationId: offer.id, name: offer.name, wounds: 1, refit: null }],' \
      "tests/battle-campaign.test.mjs"
mutate "the shelf offers formations the warband already holds" src/battle/market.js \
      '    .filter((formation) => !held.has(formation.id))' \
      '    .filter(() => true)' \
      "tests/battle-campaign.test.mjs"
mutate "the shelf offers repairs to an army with nothing to repair" src/battle/market.js \
      '    .filter((service) => (service.id === "requisition" ? true : damaged))' \
      '    .filter(() => true)' \
      "tests/battle-campaign.test.mjs"
mutate "every formation costs the same" src/battle/market.js \
      'export const costOf = (formationId) => UNIT_COSTS[formationId] ?? 5;' \
      'export const costOf = () => 5;' \
      "tests/battle-campaign.test.mjs"
mutate "the shelf never changes across a run" src/battle/market.js \
      '    .map((formation, index) => ({ formation, key: shuffleKey(seed * 31 + battle, index) }))' \
      '    .map((formation, index) => ({ formation, key: index }))' \
      "tests/battle-campaign.test.mjs"
mutate "affordability is reported without looking at the purse" src/battle/market.js \
      '      affordable: costOf(formation.id) <= purse,' \
      '      affordable: true,' \
      "tests/battle-campaign.test.mjs"
mutate "a finished run can be advanced again" src/battle/campaign.js \
      'export const advance = (run) => (run.status === "active" ? { ...run, battle: run.battle + 1 } : run);' \
      'export const advance = (run) => ({ ...run, battle: run.battle + 1 });' \
      "tests/battle-campaign.test.mjs"

mutate "buying re-rolls the rest of the shelf" src/battle/campaign.js \
      '  seed: run.seed, battle: run.battle, roster: run.roster, purse: run.purse,
  shelf: run.shelf, refitShelf: run.refitShelf,' \
      '  seed: run.seed, battle: run.battle, roster: run.roster, purse: run.purse,
  refitShelf: run.refitShelf,' \
      "tests/battle-campaign.test.mjs"
mutate "a bought formation stays on the shelf" src/battle/market.js \
      '    .filter((id) => !held.has(id))' \
      '    .filter(() => true)' \
      "tests/battle-campaign.test.mjs"

echo "=== refits and the headline ==="
mutate "a refit becomes a straight upgrade" src/battle/refits.js \
      '    apply: (profile) => shift(profile, { melee: 4, wounds: -2 }),' \
      '    apply: (profile) => shift(profile, { melee: 4, wounds: 2 }),' \
      "tests/battle-refits.test.mjs"
mutate "refits stop granting keywords the rules already care about" src/battle/refits.js \
      'const withKeyword = (profile, keyword) => (profile.keywords.includes(keyword)
  ? profile : { ...profile, keywords: [...profile.keywords, keyword] });' \
      'const withKeyword = (profile) => profile;' \
      "tests/battle-refits.test.mjs"
mutate "no refit gives a keyword up" src/battle/refits.js \
      'const withoutKeyword = (profile, keyword) => ({
  ...profile, keywords: profile.keywords.filter((entry) => entry !== keyword),
});' \
      'const withoutKeyword = (profile) => profile;' \
      "tests/battle-refits.test.mjs"
mutate "a refit is applied to whatever formation is carrying it" src/battle/refits.js \
      '  if (!refit || refit.formationId !== profile.id) return profile;' \
      '  if (!refit) return profile;' \
      "tests/battle-refits.test.mjs"
mutate "the refit never reaches the deployed formation" src/battle/battleRules.js \
      '  const profile = refit ? applyRefit({ ...base, id: formationId }, refit) : base;' \
      '  const profile = base;' \
      "tests/battle-refits.test.mjs"
mutate "a refit that adds wounds leaves the formation reading as damaged" src/battle/battleRules.js \
      '    maxWounds: profile.wounds,' \
      '    maxWounds: battleProfileFor(formationId).wounds,' \
      "tests/battle-refits.test.mjs"
mutate "the round headline reports a wreck every round after it happened" src/battle/afterAction.js \
      '  const lostThisRound = round.players.filter((unit) => unit.wounds <= 0 && (wasAlive.get(unit.id) ?? true));' \
      '  const lostThisRound = round.players.filter((unit) => unit.wounds <= 0);' \
      "tests/battle-refits.test.mjs"
mutate "the headline leads with a spend rather than a casualty" src/battle/afterAction.js \
      '  if (lostThisRound.length > 0) {' \
      '  if (false) {' \
      "tests/battle-refits.test.mjs"
mutate "a quiet round invents something to say" src/battle/afterAction.js \
      '  return { tone: "quiet", text: "Nothing in range. Both armies are still closing." };' \
      '  return { tone: "player", text: "The advance continues." };' \
      "tests/battle-refits.test.mjs"
mutate "the shelf offers a refit to a hull already carrying one" src/battle/market.js \
      '      && !roster.find((entry) => entry.formationId === refit.formationId)?.refit)' \
      '      )' \
      "tests/battle-campaign.test.mjs"
mutate "the shelf offers refits for formations the warband does not own" src/battle/market.js \
      '  .filter((entry) => !entry.refit)' \
      '  .filter(() => true)' \
      "tests/battle-campaign.test.mjs"

echo "=== the playtest fixes ==="
mutate "command points refill between engagements again" src/battle/campaign.js \
      '    commandPoints: Math.max(0, run.commandPoints - Math.max(0, commandSpent)) + regained,' \
      '    commandPoints: run.commandPoints + regained,' \
      "tests/battle-campaign.test.mjs"
mutate "command points can go negative" src/battle/campaign.js \
      '    commandPoints: Math.max(0, run.commandPoints - Math.max(0, commandSpent)) + regained,' \
      '    commandPoints: run.commandPoints - commandSpent + regained,' \
      "tests/battle-campaign.test.mjs"
mutate "the record stops saying who came back" src/battle/campaign.js \
      '      survivors: roster.filter((entry) => deployedIds.includes(entry.formationId)).map((entry) => entry.name),' \
      '      survivors: roster.map((entry) => entry.name),' \
      "tests/battle-campaign.test.mjs"
mutate "retiring pays back the full price" src/battle/campaign.js \
      '    purse: run.purse + Math.floor(costOf(formationId) * RETIRE_REFUND),' \
      '    purse: run.purse + costOf(formationId),' \
      "tests/battle-campaign.test.mjs"
mutate "a warband can be sold below the minimum force" src/battle/campaign.js \
      '  if (!entry || fieldableFrom(run).length <= MINIMUM_FORCE) return run;' \
      '  if (!entry) return run;' \
      "tests/battle-campaign.test.mjs"
mutate "a spend stops reporting what it did" src/battle/battleRules.js \
      '      spends: measured,' \
      '      spends,' \
      "tests/battle-stratagems.test.mjs"
mutate "BRACE reports a number that is not the damage it took" src/battle/battleRules.js \
      '          return { ...spend, outcome: `${damageIn(mine ? "enemy" : "player").toFixed(1)} taken this round, halved` };' \
      '          return { ...spend, outcome: `${damageIn(mine ? "player" : "enemy").toFixed(1)} taken this round, halved` };' \
      "tests/battle-stratagems.test.mjs"
mutate "a stratagem that accomplished nothing claims it worked" src/battle/battleRules.js \
      '          return { ...spend, outcome: melee > 0 ? `${melee.toFixed(1)} in melee, striking first` : "nothing was in contact" };' \
      '          return { ...spend, outcome: `${melee.toFixed(1)} in melee, striking first` };' \
      "tests/battle-stratagems.test.mjs"
mutate "command points never come back for free" src/battle/campaign.js \
      '  const regained = Math.min(COMMAND_REGEN_CAP, (won ? 1 : 0) + commanders);' \
      '  const regained = 0;' \
      "tests/battle-campaign.test.mjs"
mutate "a warband of command vehicles prints command points" src/battle/campaign.js \
      '  const regained = Math.min(COMMAND_REGEN_CAP, (won ? 1 : 0) + commanders);' \
      '  const regained = (won ? 1 : 0) + commanders;' \
      "tests/battle-campaign.test.mjs"
mutate "a wrecked commander still pays a command point" src/battle/campaign.js \
      '    .filter((unit) => unit.wounds > 0 && unit.keywords?.includes("COMMAND")).length;' \
      '    .filter((unit) => unit.keywords?.includes("COMMAND")).length;' \
      "tests/battle-campaign.test.mjs"
mutate "the headline stops saying whose formation it was" src/battle/afterAction.js \
      '    return { tone: "loss", text: `You lost ${lostThisRound.map((unit) => unit.name).join(" and ")}.` };' \
      '    return { tone: "loss", text: `${lostThisRound.map((unit) => unit.name).join(" and ")} destroyed.` };' \
      "tests/battle-refits.test.mjs"
mutate "support between formations stops being drawn" src/battle/afterAction.js \
      '        links.push({ kind: keyword.toLowerCase(), from: source.name, to: friend.name });' \
      '        continue;' \
      "tests/battle-support.test.mjs"
mutate "a shield is drawn as supporting the whole board" src/battle/afterAction.js \
      '        if (Math.hypot(source.x - friend.x, source.y - friend.y) > SUPPORT_RANGES[keyword]) continue;' \
      '        if (false) continue;' \
      "tests/battle-support.test.mjs"
mutate "a wreck is drawn as still supporting" src/battle/afterAction.js \
      '  const standing = players.filter((unit) => unit.wounds > 0);' \
      '  const standing = players;' \
      "tests/battle-support.test.mjs"

# The stat line a screen prints has to be the one the board resolves. Both fixes below
# only started mattering when refits got cheap enough to be on most hulls.
mutate "the deploy screen prints the factory stat line for a refitted hull" src/battle/refits.js \
      '  applyRefit({ ...battleProfileFor(formationId), id: formationId }, refitId)' \
      '  ({ ...battleProfileFor(formationId), id: formationId })' \
      "tests/battle-refits.test.mjs"
mutate "repair measures a reinforced hull against its factory maximum" src/battle/campaign.js \
      'const fullStrength = (entry) => profileWithRefit(entry.formationId, entry.refit).wounds;' \
      'const fullStrength = (entry) => profileWithRefit(entry.formationId).wounds;' \
      "tests/battle-campaign.test.mjs"


# === pairings: the one layer written on no card ===
mutate "a pairing fires across the whole board instead of up close" src/battle/synergies.js \
      'const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= SYNERGY_RANGE;' \
      'const near = () => true;' \
      "tests/battle-synergies.test.mjs"
mutate "a wreck still forms a pairing" src/battle/synergies.js \
      '  const standing = friends.filter((friend) => friend.id !== unit.id && friend.wounds > 0 && near(unit, friend));' \
      '  const standing = friends.filter((friend) => friend.id !== unit.id && near(unit, friend));' \
      "tests/battle-synergies.test.mjs"
mutate "a formation pairs with itself" src/battle/synergies.js \
      '  const standing = friends.filter((friend) => friend.id !== unit.id && friend.wounds > 0 && near(unit, friend));' \
      '  const standing = friends.filter((friend) => friend.wounds > 0 && near(unit, friend));' \
      "tests/battle-synergies.test.mjs"
mutate "standing close costs nothing" src/battle/synergies.js \
      '  return 1 + PACKED_DAMAGE_STEP * crowd;' \
      '  return 1;' \
      "tests/battle-synergies.test.mjs"
mutate "the packing cost is a flat toll rather than per neighbour" src/battle/synergies.js \
      '  return 1 + PACKED_DAMAGE_STEP * crowd;' \
      '  return crowd > 0 ? 1 + PACKED_DAMAGE_STEP : 1;' \
      "tests/battle-synergies.test.mjs"
mutate "the packing cost lands on wrecks and on the far side of the board" src/battle/synergies.js \
      '  const crowd = friends.filter((friend) => friend.id !== unit.id && friend.wounds > 0 && near(unit, friend)).length;' \
      '  const crowd = friends.filter((friend) => friend.id !== unit.id).length;' \
      "tests/battle-synergies.test.mjs"
mutate "a same-keyword pairing is reported from both ends" src/battle/synergies.js \
      '        if (first === second && found.some((entry) => entry.id === synergy.id' \
      '        if (false && found.some((entry) => entry.id === synergy.id' \
      "tests/battle-synergies.test.mjs"
mutate "the round record drops the keywords the screen draws from" src/battle/battleRules.js \
      'maxWounds: unit.maxWounds, keywords: unit.keywords ?? [] })),
      enemies:' \
      'maxWounds: unit.maxWounds })),
      enemies:' \
      "tests/battle-synergies.test.mjs"
mutate "the pairing layer cannot be switched off" src/battle/battleRules.js \
      '      * packedScaleFor(chosen.enemy, pairings ? alive(targets) : []);' \
      '      * packedScaleFor(chosen.enemy, alive(targets));' \
      "tests/battle-synergies.test.mjs"
mutate "the log understates a shot into a crowd" src/battle/battleRules.js \
      '      * packedScaleFor(chosen.enemy, pairings ? alive(targets) : []);' \
      '      * 1;' \
      "tests/battle-synergies.test.mjs"
mutate "a pairing announces itself every round rather than once" src/battle/afterAction.js \
      '  const seen = new Set(known);' \
      '  const seen = new Set();' \
      "tests/battle-synergies.test.mjs"
mutate "a pairing found twice is written down twice" src/battle/campaign.js \
      '      if (known.has(found.id)) continue;' \
      '      if (false) continue;' \
      "tests/battle-synergies.test.mjs"
mutate "the run forgets what earlier engagements found" src/battle/campaign.js \
      '  return [...(run.discovered ?? []), ...fresh];' \
      '  return fresh;' \
      "tests/battle-synergies.test.mjs"


# === the enemy, built rather than authored ===
mutate "the enemy walks the plan without mirroring it" src/battle/battleTerrain.js \
      '  .map((point) => (mirrored ? mirrorPoint(point) : { ...point }));' \
      '  .map((point) => ({ ...point }));' \
      "tests/battle-plans.test.mjs"
mutate "the mirror reflects about the wrong line" src/battle/battleTerrain.js \
      'export const mirrorPoint = (point) => ({ ...point, y: 100 - point.y });' \
      'export const mirrorPoint = (point) => ({ ...point, x: 100 - point.x });' \
      "tests/battle-plans.test.mjs"
mutate "the enemy fields the same army every seed" src/battle/campaign.js \
      '    : detachment.dispositions[shuffleKey(seed, 11) % detachment.dispositions.length];' \
      '    : detachment.dispositions[0];' \
      "tests/battle-campaign.test.mjs"
mutate "the control enemy drifts with the seed" src/battle/campaign.js \
      '  const foe = buildEnemyForce(mission, doctrine, { disposition, planId, strength, seed: control ? 0 : seed });' \
      '  const foe = buildEnemyForce(mission, doctrine, { disposition, planId, strength, seed });' \
      "tests/battle-campaign.test.mjs"
mutate "the enemy fields a hull that cannot finish the walk" src/battle/enemyArmy.js \
      '  if (profile.move < role.needsMove) return profile.move - 100;' \
      '  if (false) return profile.move - 100;' \
      "tests/battle-synergies.test.mjs"
mutate "the enemy builds for ground under a disposition that scores none" src/battle/enemyArmy.js \
      '  if (!scoresGround) {' \
      '  if (false) {' \
      "tests/battle-synergies.test.mjs"
mutate "the enemy fields the same hull twice" src/battle/enemyArmy.js \
      '      .filter((formation) => !taken.has(formation.id) && BATTLE_PROFILES[formation.id])' \
      '      .filter((formation) => BATTLE_PROFILES[formation.id])' \
      "tests/battle-campaign.test.mjs"
mutate "only the player's army repairs itself" src/battle/battleRules.js \
      '    enemies = repairPhase(enemies, "enemy");' \
      '    enemies = enemies;' \
      "tests/battle-synergies.test.mjs"
mutate "the enemy's half of a melee exchange goes unlogged" src/battle/battleRules.js \
      '      log.push({ phase: "fight", side: "enemy", actor: nearest.enemy.name, target: unit.name, amount: Number(incoming.toFixed(2)) });' \
      '      log.push({ phase: "fight", side: "player", actor: unit.name, target: nearest.enemy.name, amount: Number(incoming.toFixed(2)) });' \
      "tests/battle-synergies.test.mjs"
mutate "patching a friend counts as damage dealt" src/battle/battleRules.js \
      '      .filter((entry) => entry.side === who && entry.phase !== "stratagem" && entry.phase !== "repair")' \
      '      .filter((entry) => entry.side === who && entry.phase !== "stratagem")' \
      "tests/battle-synergies.test.mjs"
mutate "focus fire orders the army onto something nobody can reach" src/battle/battleRules.js \
      '    .filter((enemy) => alive(attackers).some((unit) => distance(unit, enemy) <= unit.range));' \
      '    .filter(() => true);' \
      "tests/battle-stratagems.test.mjs"


# === the ground ===
mutate "the board is not a mirror of itself" src/battle/battleTerrain.js \
      '    { ...entry, ...mirrorPoint(entry), id: `${entry.kind}-${entry.x}-${100 - entry.y}` },' \
      '    { ...entry, id: `${entry.kind}-${entry.x}-${100 - entry.y}` },' \
      "tests/battle-terrain.test.mjs"
mutate "broken ground costs nothing to cross" src/battle/battleTerrain.js \
      '  crossesTerrain(from, to, missionId, "broken") ? TERRAIN_KINDS.broken.moveScale : 1' \
      '  1' \
      "tests/battle-terrain.test.mjs"
mutate "broken ground is charged for standing in it rather than crossing it" src/battle/battleTerrain.js \
      '  crossesTerrain(from, to, missionId, "broken") ? TERRAIN_KINDS.broken.moveScale : 1' \
      '  terrainAt(from, missionId).some((entry) => entry.kind === "broken") ? TERRAIN_KINDS.broken.moveScale : 1' \
      "tests/battle-terrain.test.mjs"
mutate "a route through the slag is priced as open ground" src/battle/battleTerrain.js \
      '  return sum + (span / moveScaleBetween(previous, point, missionId));' \
      '  return sum + span;' \
      "tests/battle-terrain.test.mjs"
mutate "cover shelters the shooter rather than the target" src/battle/battleTerrain.js \
      'export const coverScaleAt = (point, missionId) => (terrainAt(point, missionId)' \
      'export const coverScaleAt = (point, missionId) => (terrainAt({ x: 0, y: 0 }, missionId)' \
      "tests/battle-terrain.test.mjs"
mutate "a stack can be shot through one way" src/battle/battleTerrain.js \
      'export const sightBlocked = (from, to, missionId) => crossesTerrain(from, to, missionId, "blocking");' \
      'export const sightBlocked = (from, to, missionId) => from.y > to.y && crossesTerrain(from, to, missionId, "blocking");' \
      "tests/battle-terrain.test.mjs"
mutate "a mission with no ground gets the Circuit's" src/battle/battleTerrain.js \
      'export const terrainFor = (missionId) => TERRAIN_TABLES[missionId] ?? [];' \
      'export const terrainFor = (missionId) => TERRAIN_TABLES[missionId] ?? TERRAIN_TABLES["circuit-clash"];' \
      "tests/battle-terrain.test.mjs"
mutate "the advance ignores the ground it is crossing" src/battle/battleRules.js \
      '    const scale = stepScale({ x, y }, gap, target, budget, missionId);' \
      '    const scale = 1;' \
      "tests/battle-terrain.test.mjs"
mutate "shooting ignores what is in the way" src/battle/battleRules.js \
      '      ? alive(targets).filter((enemy) => !sightBlocked(unit, enemy, missionId))' \
      '      ? alive(targets)' \
      "tests/battle-terrain.test.mjs"
mutate "cover does nothing to the fire coming into it" src/battle/battleRules.js \
      '      * (missionId ? coverScaleAt(chosen.enemy, missionId) : 1);' \
      '      * 1;' \
      "tests/battle-terrain.test.mjs"
mutate "the app fights on a flat plain while drawing terrain" src/battle/BattleApp.jsx \
      '    missionId: mission.id,' \
      '    missionId: null,' \
      "tests/app-render.test.mjs"


# === leads, and ground that pays nothing ===
mutate "an unfound pairing gives away what it does" src/battle/synergies.js \
      '    pair: synergy.pair,' \
      '    pair: synergy.pair, effect: synergy.effect,' \
      "tests/battle-synergies.test.mjs"
mutate "the notes only list what has already been found" src/battle/synergies.js \
      '  return synergyList().map((synergy) => ({' \
      '  return synergyList().filter((synergy) => known.has(synergy.id)).map((synergy) => ({' \
      "tests/battle-synergies.test.mjs"
mutate "the mechanics sentence stops tracking the effect" src/battle/synergies.js \
      '  .map(([key, value]) => PHRASES[key]?.(value))' \
      '  .map(([key]) => PHRASES[key]?.(1))' \
      "tests/battle-synergies.test.mjs"
mutate "the run records a pairing without saying what it does" src/battle/campaign.js \
      '        mechanics: mechanicsOf(synergyFor(found.id)),' \
      '        mechanics: "",' \
      "tests/battle-synergies.test.mjs"
mutate "the run records a pairing without saying where" src/battle/campaign.js \
      '        board: missionFor(RUN_LADDER[Math.min(run.battle, RUN_LADDER.length) - 1].mission)?.name ?? null,' \
      '        board: null,' \
      "tests/battle-synergies.test.mjs"
mutate "ground held that pays nothing counts as nothing" src/battle/afterAction.js \
      '      record.deniedRounds += deniedThisRound({ unit, round, objectives, sites });' \
      '      record.deniedRounds += 0;' \
      "tests/battle-after-action.test.mjs"
mutate "standing on ground they hold counts as denying it" src/battle/afterAction.js \
      '    && round.objectives.find((entry) => entry.objectiveId === objective.id)?.holder === "player"' \
      '    && round.objectives.find((entry) => entry.objectiveId === objective.id)?.holder !== "none"' \
      "tests/battle-after-action.test.mjs"
mutate "scoring ground is counted twice, as scored and as denied" src/battle/afterAction.js \
      '    !scoring.has(objective.id)' \
      '    true' \
      "tests/battle-after-action.test.mjs"


# === two of the same hull ===
mutate "a unit's id is its formation again, so two of a hull are one" src/battle/battleRules.js \
      '    id: id ?? formationId,' \
      '    id: formationId,' \
      "tests/battle-campaign.test.mjs"
mutate "the profile's id overwrites the instance id" src/battle/battleRules.js \
      '    ...profile,
    id: id ?? formationId,' \
      '    id: id ?? formationId,
    ...profile,' \
      "tests/battle-campaign.test.mjs"
mutate "a wreck strikes off every hull of its kind" src/battle/campaign.js \
      '    if (!deployedIds.includes(entry.id)) { roster.push(entry); continue; }' \
      '    if (!deployedIds.includes(entry.formationId)) { roster.push(entry); continue; }' \
      "tests/battle-campaign.test.mjs"
mutate "retiring one hull sells every hull of that kind" src/battle/campaign.js \
      '    roster: run.roster.filter((item) => item.id !== id),' \
      '    roster: run.roster.filter((item) => item.formationId !== entry.formationId),' \
      "tests/battle-campaign.test.mjs"
mutate "the shelf refuses to sell a hull you already own" src/battle/market.js \
      '    .filter((formation) => !gone.has(formation.id) && copiesOf(roster, formation.id) < MAX_COPIES)' \
      '    .filter((formation) => !gone.has(formation.id) && copiesOf(roster, formation.id) < 1)' \
      "tests/battle-campaign.test.mjs"
mutate "a warband may hold any number of one hull" src/battle/market.js \
      '    .filter((id) => copiesOf(roster, id) < MAX_COPIES)' \
      '    .filter(() => true)' \
      "tests/battle-campaign.test.mjs"
mutate "buying leaves the offer on the shelf" src/battle/campaign.js \
      '    if (at >= 0) shelf.splice(at, 1);' \
      '    if (false) shelf.splice(at, 1);' \
      "tests/battle-campaign.test.mjs"
mutate "a refit fits every hull of its kind at once" src/battle/campaign.js \
      '      roster: paid.roster.map((entry) => (entry === target ? { ...entry, refit: offer.id } : entry)),' \
      '      roster: paid.roster.map((entry) => (entry.formationId === offer.formationId ? { ...entry, refit: offer.id } : entry)),' \
      "tests/battle-refits.test.mjs"


echo "=== repairs, and who they go to ==="
mutate "a repair goes to the worst-off formation whatever the player named" src/battle/campaign.js \
      '  const target = named ?? worst;' \
      '  const target = worst;' \
      "tests/battle-campaign.test.mjs"
mutate "naming a formation that does not need the work still charges for it" src/battle/campaign.js \
      '  if (targetId !== null && !named) return run;' \
      '  if (false) return run;' \
      "tests/battle-campaign.test.mjs"
mutate "a field repair puts back a different amount than the shelf advertises" src/battle/campaign.js \
      'target.wounds + FIELD_REPAIR_WOUNDS' \
      'target.wounds + 1' \
      "tests/battle-campaign.test.mjs"
mutate "the shelf sells repairs blind, as well as the rows selling them named" src/battle/BattleApp.jsx \
      '  const shelf = offers.filter((offer) => !mends.includes(offer));' \
      '  const shelf = offers;' \
      "tests/app-render.test.mjs"

echo "=== the battle comes home ==="
mutate "the battle result is applied to formations rather than to the hulls that fought" src/battle/BattleApp.jsx \
      'const deployedIds = Object.values(planned).map((entry) => entry?.id).filter(Boolean);' \
      'const deployedIds = Object.values(planned).map((entry) => entry?.formationId).filter(Boolean);' \
      "tests/app-render.test.mjs"
mutate "a slot deploys carrying the first instance of its hull's damage" src/battle/BattleApp.jsx \
      'const carried = run?.roster.find((item) => item.id === entry.id);' \
      'const carried = run?.roster.find((item) => item.formationId === entry.formationId);' \
      "tests/app-render.test.mjs"

echo "=== what a marker says ==="
mutate "the enemy's profile is not readable from the board" src/battle/BattleApp.jsx \
      '<span className="battle-unit-card" aria-hidden="true">' \
      '<span className="battle-unit-hidden" aria-hidden="true">' \
      "tests/app-render.test.mjs"
mutate "the marker card can only be opened with a pointer" src/battle/BattleApp.jsx \
      '                tabIndex={0}' \
      '                data-nothing={0}' \
      "tests/app-render.test.mjs"
mutate "the stat line is written by hand beside the one the shelf shows" src/battle/BattleApp.jsx \
      'const line = profile ? statLineFor(profile) : null;' \
      'const line = profile ? `MOVE ${profile.move}` : null;' \
      "tests/app-render.test.mjs"
mutate "a single-shot profile reads 1 SHOTS" src/battle/battleProfiles.js \
      '`${profile.shots} SHOT${profile.shots === 1 ? "" : "S"}`' \
      '`${profile.shots} SHOTS`' \
      "tests/battle-campaign.test.mjs"
mutate "the profile card is dimmed out of contrast" src/battle/battle.css \
      '.battle-unit-card-note { color: #a8bcb6;' \
      '.battle-unit-card-note { color: #2e3a37;' \
      "tests/accessibility.test.mjs"
mutate "the repair buttons are dimmed out of contrast" src/battle/battle.css \
      '.battle-mend { padding: 0 5px; border: 1px solid #4c6a4f; background: rgba(14,30,18,.7); color: #9fd6a8;' \
      '.battle-mend { padding: 0 5px; border: 1px solid #4c6a4f; background: rgba(14,30,18,.7); color: #33443a;' \
      "tests/accessibility.test.mjs"


echo "=== the enemy reads you ==="
mutate "the enemy ignores what the player last fielded" src/battle/enemyArmy.js \
      '  const reading = counter?.order?.some(Boolean) ? counter : null;' \
      '  const reading = null;' \
      "tests/battle-counterplay.test.mjs"
mutate "the rehearsal is scored from the player's side of the board" src/battle/enemyArmy.js \
      '  return result.enemyScore - result.playerScore;' \
      '  return result.playerScore - result.enemyScore;' \
      "tests/battle-counterplay.test.mjs"
mutate "it goes over the list once, answering early slots against a list it no longer has" src/battle/enemyArmy.js \
      'export const COUNTER_PASSES = 3;' \
      'export const COUNTER_PASSES = 1;' \
      "tests/battle-counterplay.test.mjs"
mutate "a slot considers no more candidates when it has something to answer" src/battle/enemyArmy.js \
      'export const COUNTER_SHORTLIST = 4;' \
      'export const COUNTER_SHORTLIST = 2;' \
      "tests/battle-counterplay.test.mjs"
mutate "the control enemy reads the player too" src/battle/campaign.js \
      '  const counter = control ? null : (run.history.at(-1)?.fielded ?? null);' \
      '  const counter = run.history.at(-1)?.fielded ?? null;' \
      "tests/battle-counterplay.test.mjs"
mutate "the run does not remember what it fielded" src/battle/campaign.js \
      '      fielded: Array.isArray(fielded) && fielded.some(Boolean)' \
      '      fielded: false && Array.isArray(fielded) && fielded.some(Boolean)' \
      "tests/battle-counterplay.test.mjs"
mutate "the screen never says the enemy studied them" src/battle/BattleApp.jsx \
      '                      THEY HAVE STUDIED YOUR LAST ENGAGEMENT.{" "}' \
      '                      {" "}' \
      "tests/battle-counterplay.test.mjs"
mutate "the screen stops passing what was fielded to the run" src/battle/BattleApp.jsx \
      '      fielded: mission.playerDeployment.map((slot) => planned[slot.id]?.formationId ?? null),' \
      '      fielded: null,' \
      "tests/app-render.test.mjs"


echo "=== a plan is lanes ==="
mutate "the lanes are shared out evenly, whatever weight they were given" src/battle/battlePlans.js \
      '  const exact = lanes.map((entry) => (entry.share / total) * wanted);' \
      '  const exact = lanes.map(() => wanted / lanes.length);' \
      "tests/battle-lanes.test.mjs"
mutate "a lane the plan kept can end up with nobody in it" src/battle/battlePlans.js \
      '  const counts = exact.map((value) => Math.max(1, Math.floor(value)));' \
      '  const counts = exact.map((value) => Math.floor(value));' \
      "tests/battle-lanes.test.mjs"
mutate "a small army keeps the plan's lightest lanes and drops its heaviest" src/battle/battlePlans.js \
      '      .sort((left, right) => right.entry.share - left.entry.share || left.index - right.index)' \
      '      .sort((left, right) => left.entry.share - right.entry.share || left.index - right.index)' \
      "tests/battle-lanes.test.mjs"
mutate "the plan is resolved at the size it was authored for whatever army is walking it" src/battle/battlePlans.js \
      '    ? fillLanes(battlePlan.lanes, size ?? laneTotal(battlePlan.lanes))' \
      '    ? fillLanes(battlePlan.lanes, laneTotal(battlePlan.lanes))' \
      "tests/battle-lanes.test.mjs"
mutate "a part-strength enemy takes a slice out of the middle of its doctrine" src/battle/battleMission.js \
      '    const route = plan ? routePointsFor(plan, index, mission.id, true, size) : [];' \
      '    const route = plan ? routePointsFor(plan, slotIndex, mission.id, true, size) : [];' \
      "tests/battle-lanes.test.mjs"
mutate "a part-strength warband takes a slice out of the middle of its plan" src/battle/battleMission.js \
      '    const route = battlePlan ? routePointsFor(battlePlan, index, mission.id, false, size) : [];' \
      '    const route = battlePlan ? routePointsFor(battlePlan, slotIndex, mission.id, false, size) : [];' \
      "tests/battle-lanes.test.mjs"


echo "=== what a declaration pays ==="
mutate "the eradication payout is stated in one place and paid in another" src/battle/doctrine.js \
      'score: ({ destroyed, damage, damagePaid }) => (Math.floor(damage / DISPOSITIONS.eradication.damagePerPoint) - damagePaid) + (DISPOSITIONS.eradication.wreckBounty * destroyed),' \
      'score: ({ destroyed, damage, damagePaid }) => (Math.floor(damage / 3) - damagePaid) + (3 * destroyed),' \
      "tests/battle-doctrine-layers.test.mjs"
mutate "safeguard's own ground is worth what everyone else's is" src/battle/doctrine.js \
      '      .map((objective) => ({ ...objective, points: objective.points * DISPOSITIONS.safeguard.homeMultiplier })),' \
      '      .map((objective) => ({ ...objective })),' \
      "tests/battle-doctrine-layers.test.mjs"

echo
echo "killed $pass mutants, $fail survived, $skipped skipped"
# A SKIPPED MUTANT IS AN UNGUARDED ONE. The pattern it edits no longer appears exactly once
# in the file — usually because the code was refactored — so the guard it was checking has
# quietly stopped being checked. Printed at the end rather than only where it happened,
# because a line in the middle of two hundred is a line nobody reads.
if [ "$skipped" -gt 0 ]; then
  echo
  echo "NOT RUN — these patterns no longer appear exactly once, so what they guarded is unmeasured:"
  printf "$skips\n"
fi
[ "$fail" -eq 0 ]
