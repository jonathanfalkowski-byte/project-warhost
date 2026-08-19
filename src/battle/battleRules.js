// The battle round: move, shoot, fight, score. Five rounds, most victory points wins.
//
// This is the second resolution model, built alongside the operation pipeline rather than
// replacing it. The operation model resolves a timeline of capability matches against an
// authored enemy script, and playtesting kept returning the same verdict — "is it a race
// to the objectives? why is the enemy coming from one corner? i just find this weird and
// awkward". The answer was that the model had no shared shape with the tabletop game it
// is meant to evoke: no facing armies, no rounds, no shooting, no objectives scored while
// held.
//
// So this model is the tabletop shape, exactly:
//
//   Deployment  two armies face each other across the board, objectives between them
//   Round 1-5   MOVE toward your assigned objective
//               SHOOT the nearest enemy in range
//               FIGHT anything you are in contact with
//               SCORE every objective you control at the end of the round
//   Result      most victory points after five rounds
//
// It stays an autobattler: the player's decisions are the list, the deployment, and the
// stratagems. Nothing is steered once the battle starts.
//
// Deterministic, with no dice. That is a deliberate carry-over from the operation model:
// it means the whole decision space can be swept exhaustively for balance rather than
// sampled, which is how every balance claim in this project is checked. Hit and save
// values are thresholds on a fixed scale rather than rolls.

import { MELEE_RANGE, OBJECTIVE_CONTROL_RANGE, SHIELD_SOAK } from "./battleProfiles.js";
import { coverScaleAt, moveScaleBetween, sightBlocked } from "./battleTerrain.js";
import { STRATAGEMS, enemyPlaysAt } from "./stratagems.js";
import { damagePointsFor, dispositionFor, scoreRound } from "./doctrine.js";
import { profileWithRefit } from "./refits.js";
import { activeSynergies, packedScaleFor, synergyBonusFor } from "./synergies.js";

export const BATTLE_ROUNDS = 5;
export const COMMAND_RANGE = 24;
// A shield absorbs fire aimed at anything it is standing near.
export const SHIELD_RANGE = 14;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const alive = (units) => units.filter((unit) => unit.wounds > 0);

// Damage is deterministic: shots that beat the target's save get through, and a better
// hit value converts more of them. No rolls, so the whole space stays sweepable.
export const damageFor = ({ attacker, target, hitBonus = 0 }) => {
  const effectiveHit = Math.max(1, attacker.hit - hitBonus);
  // hit 2 lands 5/6 of its shots, hit 3 lands 4/6, and so on.
  const landed = attacker.shots * Math.max(0, 7 - effectiveHit) / 6;
  // A save of 5 stops most of what a light gun throws; nothing stops everything.
  const stopped = Math.min(0.75, target.save * 0.15);
  return Math.max(0, landed * (1 - stopped));
};

const nearestEnemy = (unit, enemies) => alive(enemies)
  .map((enemy) => ({ enemy, range: distance(unit, enemy) }))
  .sort((left, right) => left.range - right.range)[0] ?? null;

// What a stratagem can change, and what it is when nobody spent one. Every field is a
// number or a flag so a round's effects are a flat object rather than a rules engine —
// the player has to be able to predict the consequence of spending, or it is noise.
export const NO_EFFECTS = Object.freeze({
  extraShootingPhase: false,
  incomingDamageScale: 1,
  extraMove: false,
  focusFire: false,
  controlScale: 1,
  meleeScale: 1,
  meleeFirst: false,
  // The detachment's standing rule, in force every round rather than spent.
  shootingHitBonus: 0,
});

export const effectsOf = (stratagems = []) => stratagems.reduce((acc, stratagem) => {
  const effect = stratagem?.effect;
  if (!effect) return acc;
  return {
    ...acc,
    extraShootingPhase: acc.extraShootingPhase || Boolean(effect.extraShootingPhase),
    extraMove: acc.extraMove || Boolean(effect.extraMove),
    focusFire: acc.focusFire || Boolean(effect.focusFire),
    meleeFirst: acc.meleeFirst || Boolean(effect.meleeFirst),
    shootingHitBonus: acc.shootingHitBonus + (effect.shootingHitBonus ?? 0),
    // Two stratagems that scale the same number multiply, so stacking is worth what it
    // costs and never silently drops one of the two you paid for.
    incomingDamageScale: acc.incomingDamageScale * (effect.incomingDamageScale ?? 1),
    controlScale: acc.controlScale * (effect.controlScale ?? 1),
    meleeScale: acc.meleeScale * (effect.meleeScale ?? 1),
  };
}, { ...NO_EFFECTS });

// FOCUS FIRE needs an unambiguous "most dangerous", and the player has to be able to look
// at the board and know which one it will pick. Guns first, then fists, then ground held.
export const threatOf = (unit) => (
  unit.shots * Math.max(0, 7 - unit.hit) + unit.melee * 3 + unit.control
);

// The most dangerous thing SOMEONE CAN ACTUALLY SHOOT. Picking the biggest threat on the
// board regardless of range made a two-point stratagem do literally nothing against an
// enemy that keeps a heavy hull back — the whole army held fire in every round of every
// battle, because the target it had been ordered onto was never once reachable. The stated
// cost is that formations out of range of the chosen target do not fire; that is a cost
// paid by stragglers, not a way for the spend to evaporate. Only visible once the enemy
// started walking a plan instead of beelining into the middle.
const focusTarget = (defenders, attackers = [], missionId = null) => {
  const reachable = alive(defenders)
    .filter((enemy) => alive(attackers).some((unit) => distance(unit, enemy) <= unit.range
      && !(missionId && sightBlocked(unit, enemy, missionId))));
  return reachable
    .slice()
    .sort((left, right) => threatOf(right) - threatOf(left) || (left.id < right.id ? -1 : 1))[0] ?? null;
};

// A unit walks its authored route, one waypoint at a time, spending whatever movement is
// left over on the next leg rather than stopping short at every corner. This is what makes
// a plan a plan: a flanking route is genuinely longer than the road up the middle, and the
// formation walking it genuinely is not in the centre when the shooting starts.
// The ground a step is about to cross, priced before it is taken. Broken ground does not
// cost a formation for STANDING in it — a rule like that is free to anything fast enough to
// clear the whole field in one move, which is exactly what should be paying — it costs for
// crossing, so the short road through the slag is genuinely the slow one.
const stepScale = (from, gap, toward, budget, missionId) => {
  if (!missionId || gap <= 0) return 1;
  const reach = Math.min(budget, gap);
  const tentative = {
    x: from.x + ((toward.x - from.x) / gap) * reach,
    y: from.y + ((toward.y - from.y) / gap) * reach,
  };
  return moveScaleBetween(from, tentative, missionId);
};

const walk = (unit, path, missionId = null) => {
  if (!Array.isArray(path) || path.length === 0) return unit;
  let { x, y } = unit;
  let index = Math.min(unit.waypoint ?? 0, path.length);
  let budget = unit.move;
  while (budget > 1e-9 && index < path.length) {
    const target = path[index];
    const gap = Math.hypot(target.x - x, target.y - y);
    if (gap <= 0.5) { index += 1; continue; }
    const scale = stepScale({ x, y }, gap, target, budget, missionId);
    const step = Math.min(budget * scale, gap);
    x += ((target.x - x) / gap) * step;
    y += ((target.y - y) / gap) * step;
    budget -= step / scale;
    if (step >= gap - 1e-9) index += 1;
  }
  return { ...unit, x, y, waypoint: index };
};

// A unit walks toward the objective it was ordered to take, and stops when it is on it.
// Still here for a battle resolved from bare orders rather than an authored plan.
const advance = (unit, objective, missionId = null) => {
  if (!objective) return unit;
  const gap = distance(unit, objective);
  if (gap <= 1) return unit;
  const step = Math.min(unit.move * stepScale(unit, gap, objective, unit.move, missionId), gap);
  return {
    ...unit,
    x: unit.x + ((objective.x - unit.x) / gap) * step,
    y: unit.y + ((objective.y - unit.y) / gap) * step,
  };
};

const commandBonusFor = (unit, friends) => (
  alive(friends).some((friend) => friend.id !== unit.id
    && friend.keywords.includes("COMMAND")
    && distance(unit, friend) <= COMMAND_RANGE)
    ? 1 : 0
);

// A SHIELD formation soaks a share of the damage aimed at anything close to it. This is
// what makes a defensive unit worth a slot without giving it a gun.
// `pairings` is how the sweep measures what the pairing layer is actually worth: the same
// battle resolved with it and without it. Passing an empty friends list is what turns a
// synergy off, because a pairing is by definition something two formations do together.
//
// The PACKING COST is applied by the caller, not here, so that the number written to the
// log is the number the hull actually loses. Applied here it was invisible twice over: the
// log understated every shot into a crowd, the fire drawing is weighted by that number, and
// ERADICATION is scored off the log — so a disposition paid on damage was being paid on
// damage that had not happened.
const applyDamage = (units, targetId, amount, pairings = true) => {
  const target = units.find((unit) => unit.id === targetId);
  if (!target || amount <= 0) return units;
  const shield = alive(units).find((unit) => unit.id !== targetId
    && unit.keywords.includes("SHIELD")
    && distance(unit, target) <= SHIELD_RANGE);
  // A shield anchored on a heavy hull soaks harder — that is LOCKED SHIELDS, and it is
  // read from the board rather than from anything either card says.
  const soaked = shield ? amount * Math.max(SHIELD_SOAK, synergyBonusFor(shield, units).soak) : 0;
  return units.map((unit) => {
    if (unit.id === targetId) return { ...unit, wounds: unit.wounds - (amount - soaked) };
    if (shield && unit.id === shield.id) return { ...unit, wounds: unit.wounds - soaked };
    return unit;
  });
};

const shootingPhase = (attackers, defenders, log, side, { focusFire = false, damageScale = 1, hitBonus = 0, phase = "shoot", pairings = true, missionId = null } = {}) => {
  let targets = defenders;
  // FOCUS FIRE is chosen once, from the board as it stands before anyone fires, so the
  // whole army genuinely concentrates instead of drifting onto whatever died last.
  const focus = focusFire ? focusTarget(defenders, attackers, missionId) : null;
  for (const unit of alive(attackers)) {
    // Under FOCUS FIRE a formation with the chosen target out of range simply does not
    // fire. That is the cost of the stratagem, and it is visible in the log.
    // Nothing is shot through a stack. Filtered before the nearest target is picked rather
    // than after, or a formation stares at the thing behind the wall all battle and never
    // fires at the one beside it.
    const visible = missionId
      ? alive(targets).filter((enemy) => !sightBlocked(unit, enemy, missionId))
      : alive(targets);
    const chosen = focus
      ? (visible.some((enemy) => enemy.id === focus.id)
        ? { enemy: visible.find((enemy) => enemy.id === focus.id), range: distance(unit, focus) } : null)
      : nearestEnemy(unit, visible);
    if (!chosen || chosen.range > unit.range) continue;
    const paired = synergyBonusFor(unit, pairings ? attackers : []);
    const dealt = damageFor({ attacker: unit, target: chosen.enemy, hitBonus: commandBonusFor(unit, attackers) + hitBonus })
      * damageScale * paired.damageScale
      // A formation standing shoulder to shoulder with its own is an easier thing to hit.
      // This is what stops a pairing being a free reward for massing.
      * packedScaleFor(chosen.enemy, pairings ? alive(targets) : [])
      // Fire into cover is cut, read off where the TARGET is standing.
      * (missionId ? coverScaleAt(chosen.enemy, missionId) : 1);
    if (dealt <= 0) continue;
    targets = applyDamage(targets, chosen.enemy.id, dealt, pairings);
    log.push({ phase, side, actor: unit.name, target: chosen.enemy.name, amount: Number(dealt.toFixed(2)) });
  }
  return targets;
};

// Melee is simultaneous: both sides swing, so charging a bigger unit is a real risk.
// EXECUTION ORDER buys out of that for one round — the side that spent it strikes first,
// and anything it kills never swings back.
const fightPhase = (playerUnits, enemyUnits, log, playerEffects = NO_EFFECTS, enemyEffects = NO_EFFECTS, pairings = true) => {
  let players = playerUnits;
  let enemies = enemyUnits;
  for (const unit of alive(playerUnits)) {
    const nearest = nearestEnemy(unit, enemies);
    if (!nearest || nearest.range > MELEE_RANGE) continue;
    const outgoing = unit.melee * 0.5 * playerEffects.meleeScale * enemyEffects.incomingDamageScale
      * synergyBonusFor(unit, pairings ? playerUnits : []).meleeScale
      * packedScaleFor(nearest.enemy, pairings ? alive(enemies) : []);
    enemies = applyDamage(enemies, nearest.enemy.id, outgoing, pairings);
    const struckBack = enemies.find((enemy) => enemy.id === nearest.enemy.id);
    // If the player struck first and the target is down, there is nothing to swing back.
    const answers = !playerEffects.meleeFirst || (struckBack?.wounds ?? 0) > 0;
    if (answers) {
      const incoming = nearest.enemy.melee * 0.5 * enemyEffects.meleeScale * playerEffects.incomingDamageScale
        * synergyBonusFor(nearest.enemy, pairings ? enemyUnits : []).meleeScale
        * packedScaleFor(unit, pairings ? alive(players) : []);
      players = applyDamage(players, unit.id, incoming, pairings);
      // THE ENEMY'S HALF OF THE EXCHANGE, logged as the enemy's. Melee is simultaneous and
      // the whole exchange used to be written down as one line on the player's side — so
      // every blow the enemy struck in close combat was recorded as damage the PLAYER
      // dealt. It reached the wounds correctly and it reached the scoreboard backwards:
      // ERADICATION is paid off this log, and the board's fire drawing is drawn from it, so
      // the enemy was never once shown fighting back.
      log.push({ phase: "fight", side: "enemy", actor: nearest.enemy.name, target: unit.name, amount: Number(incoming.toFixed(2)) });
    }
    log.push({ phase: "fight", side: "player", actor: unit.name, target: nearest.enemy.name, amount: Number(outgoing.toFixed(2)) });
  }
  return { players, enemies };
};

// An objective is held by whichever side has more control value within range of it.
export const scoreObjectives = ({
  objectives, playerUnits, enemyUnits, playerControlScale = 1, enemyControlScale = 1, pairings = true,
}) => objectives.map((objective) => {
  // Control is summed PER FORMATION so a pairing can lift one hull's grip on the ground
  // without lifting the whole army's — DUG IN is a formation being kept standing, not a
  // doctrine. The army-wide scale (HOLD FAST) multiplies the total on top.
  const held = (units, scale) => alive(units)
    .filter((unit) => distance(unit, objective) <= OBJECTIVE_CONTROL_RANGE)
    .reduce((sum, unit) => sum + unit.control * synergyBonusFor(unit, pairings ? units : []).controlScale, 0) * scale;
  const player = held(playerUnits, playerControlScale);
  const enemy = held(enemyUnits, enemyControlScale);
  return {
    objectiveId: objective.id,
    name: objective.name,
    player,
    enemy,
    holder: player > enemy ? "player" : enemy > player ? "enemy" : "contested",
    points: objective.points ?? 1,
  };
});

// `id` is the INSTANCE, not the formation. Everything in the resolution keys on it —
// orders, routes, who took the damage, who came back — and it used to be the formation id
// itself, which made two of the same hull the same unit: they shared an order, walked one
// route, and every wound landed on whichever the lookup found first. A warband that can
// hold two railjacks needs to be able to tell them apart, and this is where that starts.
export const deployUnit = ({ formationId, name, position, wounds, refit = null, id = null }) => {
  // The refit changes the profile before anything else reads it, so every rule on the
  // board — SHIELD soaking, COMMAND bonuses, the REPAIR phase — sees the formation as it
  // actually is rather than as the roster says it should be.
  const profile = profileWithRefit(formationId, refit);
  return {
    // The profile is spread FIRST and the identity written over it. `profileWithRefit`
    // carries an `id` of its own — the formation it is a profile OF — and spreading it last
    // silently overwrote the instance id with the formation id, which is precisely the
    // collision this whole change exists to remove.
    ...profile,
    id: id ?? formationId,
    formationId,
    name,
    x: position.x,
    y: position.y,
    // A formation carries its damage into the next battle of a run. maxWounds stays what
    // the profile says, so a battered formation reads as battered rather than as a
    // smaller one — half a tank is still a tank that has been shot.
    wounds: Number.isFinite(wounds) ? Math.min(wounds, profile.wounds) : profile.wounds,
    maxWounds: profile.wounds,
  };
};

// One battle. Pure: same inputs always give the same rounds, which is what lets the
// balance sweep resolve the whole decision space instead of sampling it.
export const resolveBattle = ({
  playerUnits = [],
  enemyUnits = [],
  objectives = [],
  playerOrders = {},
  enemyOrders = {},
  // The authored route each formation walks, keyed by unit id. A battle given paths walks
  // them; one given only orders still beelines, which is what the rules tests resolve.
  playerPaths = {},
  enemyPaths = {},
  rounds = BATTLE_ROUNDS,
  // The player's stratagems, each committed to a round before the battle: the "right
  // place and time" decision. Shape: [{ id: "brace", round: 3 }].
  playerStratagems = [],
  // The enemy's hidden hand: a list of stratagem ids drawn from its detachment's pool.
  // The player is shown the pool and never the hand, which is where the uncertainty in
  // the battle comes from — you lose to a decision you could not see, not to a die.
  enemyHand = [],
  // How each army scores. The disposition replaces the victory condition rather than
  // decorating it, which is what makes the detachment that gates it a real decision.
  playerDisposition = "dominion",
  enemyDisposition = "dominion",
  // The detachment rules, which are not spent and apply in every round. A detachment is
  // the character of the army — close quarters, ranged, or hard to kill — and that has to
  // be felt on the board, not just in which stratagems it happens to offer.
  playerDetachmentRule = null,
  enemyDetachmentRule = null,
  // Whether the pairing layer is live. Only the balance sweep ever turns it off, and it
  // does so to answer "what is this layer actually worth" with the same battle rather than
  // with a different one.
  pairings = true,
  // WHICH GROUND THIS IS BEING FOUGHT OVER. Terrain is read from it — broken ground that
  // slows an advance, cover that cuts fire coming into it, stacks nothing shoots through.
  // Left out, the battle is fought on a flat plain, which is what every rules test that is
  // about the rules rather than about the ground wants.
  missionId = null,
} = {}) => {
  let players = playerUnits.map((unit) => ({ ...unit }));
  let enemies = enemyUnits.map((unit) => ({ ...unit }));
  const objectiveById = new Map(objectives.map((objective) => [objective.id, objective]));
  const history = [];
  let playerScore = 0;
  let enemyScore = 0;
  let playersLostSoFar = 0;
  let enemiesLostSoFar = 0;
  // Cumulative damage, so a disposition paid on it is never charged a rounding remainder
  // for spreading its fire across rounds instead of concentrating it in one.
  let playerDamageTotal = 0;
  let enemyDamageTotal = 0;

  for (let round = 1; round <= rounds; round += 1) {
    const log = [];

    // STRATAGEMS — what each side spends this round, resolved before anything moves so
    // the whole round is fought under the effects. The spends are logged first, so the
    // reason a round went badly is the first line the player reads.
    const playerCards = playerStratagems
      .filter((entry) => entry?.round === round)
      .map((entry) => STRATAGEMS[entry.id])
      .filter(Boolean);
    const enemyCardId = enemyPlaysAt({ hand: enemyHand, round });
    const enemyCards = enemyCardId && STRATAGEMS[enemyCardId] ? [STRATAGEMS[enemyCardId]] : [];
    const playerEffects = effectsOf([playerDetachmentRule, ...playerCards]);
    const enemyEffects = effectsOf([enemyDetachmentRule, ...enemyCards]);
    const spends = [
      ...playerCards.map((card) => ({ side: "player", id: card.id, name: card.name, cost: card.cost, text: card.text })),
      ...enemyCards.map((card) => ({ side: "enemy", id: card.id, name: card.name, cost: card.cost, text: card.text })),
    ];
    for (const spend of spends) {
      log.push({ phase: "stratagem", side: spend.side, actor: spend.name, target: spend.text, amount: `${spend.cost} CP` });
    }

    // OVERWATCH fires before either army advances — the whole point of it is catching the
    // enemy at the range they were about to close.
    if (playerEffects.extraShootingPhase) {
      enemies = shootingPhase(players, enemies, log, "player", {
        focusFire: playerEffects.focusFire, damageScale: enemyEffects.incomingDamageScale, hitBonus: playerEffects.shootingHitBonus, phase: "overwatch", pairings, missionId,
      });
    }
    if (enemyEffects.extraShootingPhase) {
      players = shootingPhase(enemies, players, log, "enemy", {
        focusFire: enemyEffects.focusFire, damageScale: playerEffects.incomingDamageScale, hitBonus: enemyEffects.shootingHitBonus, phase: "overwatch", pairings, missionId,
      });
    }

    // MOVE — both sides advance on the objective each unit was ordered to take.
    //
    // Round one is a double advance for both armies. Without it the deployment edges are
    // far enough apart that the first three rounds of a five-round battle are two armies
    // walking at each other with nothing to watch — which is exactly the complaint the
    // operation model earned ("i am moving so slow in some spots"). It is symmetrical, so
    // it costs neither side anything, and it buys back two rounds of actual battle.
    const moveOnce = (units, orders, paths) => units.map((unit) => {
      if (unit.wounds <= 0) return unit;
      const path = paths[unit.id];
      return Array.isArray(path) && path.length > 0
        ? walk(unit, path, missionId)
        : advance(unit, objectiveById.get(orders[unit.id]), missionId);
    });
    // The opening advance and SURGE FORWARD do not stack. An army already running out of
    // deployment cannot run harder, and letting them add made SURGE on round one worth
    // more than six victory points on its own — a one-point card nobody would ever not
    // buy. Spent later it is a real repositioning tool, which is what it should be.
    const moves = (extra) => Math.max(round === 1 ? 2 : 1, extra ? 2 : 1);
    for (let step = 0; step < moves(playerEffects.extraMove); step += 1) players = moveOnce(players, playerOrders, playerPaths);
    for (let step = 0; step < moves(enemyEffects.extraMove); step += 1) enemies = moveOnce(enemies, enemyOrders, enemyPaths);

    // SHOOT — resolved from a snapshot so both sides fire before either takes losses.
    const playersBeforeShooting = players.map((unit) => ({ ...unit }));
    const enemiesBeforeShooting = enemies.map((unit) => ({ ...unit }));
    enemies = shootingPhase(playersBeforeShooting, enemies, log, "player", {
      focusFire: playerEffects.focusFire, damageScale: enemyEffects.incomingDamageScale, hitBonus: playerEffects.shootingHitBonus, pairings, missionId,
    });
    players = shootingPhase(enemiesBeforeShooting, players, log, "enemy", {
      focusFire: enemyEffects.focusFire, damageScale: playerEffects.incomingDamageScale, hitBonus: enemyEffects.shootingHitBonus, pairings, missionId,
    });

    // FIGHT — simultaneous, so a bad charge costs the charger.
    const fought = fightPhase(players, enemies, log, playerEffects, enemyEffects, pairings);
    players = fought.players;
    enemies = fought.enemies;

    // A repair formation patches one damaged friend instead of contributing more fire.
    // BOTH ARMIES. It ran for the player only, so a whole rule of the game applied to one
    // side of the table — the enemy could field a REPAIR hull, and buy the refits that
    // grant REPAIR, and none of it ever did anything.
    const repairPhase = (army, side) => {
      let patched = army;
      for (const medic of alive(patched).filter((unit) => unit.keywords.includes("REPAIR"))) {
        const patient = alive(patched)
          .filter((unit) => unit.id !== medic.id && unit.wounds < unit.maxWounds)
          .sort((left, right) => left.wounds - right.wounds)[0];
        if (!patient) continue;
        // Repairs cannot outpace a determined gun line, or a support formation becomes an
        // answer to every list rather than a way to keep a damaged one in the fight.
        const amount = 1 + synergyBonusFor(medic, pairings ? alive(patched) : []).repairBonus;
        patched = patched.map((unit) => (unit.id === patient.id
          ? { ...unit, wounds: Math.min(unit.maxWounds, unit.wounds + amount) } : unit));
        log.push({ phase: "repair", side, actor: medic.name, target: patient.name, amount });
      }
      return patched;
    };
    players = repairPhase(players, "player");
    enemies = repairPhase(enemies, "enemy");

    // SCORE — every objective held at the end of the round pays out.
    const scored = scoreObjectives({
      objectives, playerUnits: players, enemyUnits: enemies,
      playerControlScale: playerEffects.controlScale, enemyControlScale: enemyEffects.controlScale, pairings,
    });
    // Losses this round, counted from the top of the round rather than from the start of
    // the battle, so ERADICATION pays once per kill and SAFEGUARD reads a clean round.
    const playerLost = players.filter((unit) => unit.wounds <= 0).length - playersLostSoFar;
    const enemyLost = enemies.filter((unit) => unit.wounds <= 0).length - enemiesLostSoFar;
    playersLostSoFar += playerLost;
    enemiesLostSoFar += enemyLost;
    // Damage inflicted this round, which is what ERADICATION is paid on. Stratagem entries
    // carry a cost string rather than a number, so they are filtered out by phase.
    // PATCHING A FRIEND IS NOT DAMAGE DEALT. ERADICATION is paid on this number, so a
    // formation healing its own army was earning victory points for it — and the player was
    // the only side with a repair phase, so the entire inflation landed on one army.
    const dealtBy = (who) => log
      .filter((entry) => entry.side === who && entry.phase !== "stratagem" && entry.phase !== "repair")
      .reduce((sum, entry) => sum + entry.amount, 0);
    playerDamageTotal += dealtBy("player");
    enemyDamageTotal += dealtBy("enemy");
    const withCoordinates = scored.map((objective) => ({ ...objective, y: objectiveById.get(objective.objectiveId)?.y ?? 50 }));
    const playerGained = scoreRound({ disposition: playerDisposition, side: "player", objectives: withCoordinates, destroyed: enemyLost, lost: playerLost,
      damage: playerDamageTotal, damagePaid: damagePointsFor(playerDisposition, playerDamageTotal - dealtBy("player")) });
    const enemyGained = scoreRound({ disposition: enemyDisposition, side: "enemy", objectives: withCoordinates, destroyed: playerLost, lost: enemyLost,
      damage: enemyDamageTotal, damagePaid: damagePointsFor(enemyDisposition, enemyDamageTotal - dealtBy("enemy")) });
    playerScore += playerGained;
    enemyScore += enemyGained;

    // What each spend actually did, measured off the round it was spent in. "I don't know
    // if my command points did anything" is a fair complaint about a banner that states an
    // intention and never reports an outcome.
    const damageIn = (who, phase) => log
      .filter((entry) => entry.side === who && (phase ? entry.phase === phase : entry.phase !== "stratagem"))
      .reduce((sum, entry) => sum + entry.amount, 0);
    const measured = spends.map((spend) => {
      const mine = spend.side === "player";
      const held = scored.filter((objective) => objective.holder === (mine ? "player" : "enemy")).length;
      switch (spend.id) {
        case "overwatch": {
          const early = damageIn(spend.side, "overwatch");
          return { ...spend, outcome: early > 0 ? `${early.toFixed(1)} damage before either army moved` : "nothing was in range yet" };
        }
        case "brace":
          return { ...spend, outcome: `${damageIn(mine ? "enemy" : "player").toFixed(1)} taken this round, halved` };
        case "focus-fire": {
          const targets = [...new Set(log.filter((entry) => entry.side === spend.side && entry.phase === "shoot").map((entry) => entry.target))];
          return { ...spend, outcome: targets.length ? `whole army onto ${targets[0]}` : "nobody was in range of it" };
        }
        case "surge":
          return { ...spend, outcome: "the army advanced a second time" };
        case "hold-fast":
          return { ...spend, outcome: `${held} objective${held === 1 ? "" : "s"} held at double control` };
        case "execution-order": {
          const melee = log.filter((entry) => entry.phase === "fight").reduce((sum, entry) => sum + entry.amount, 0);
          return { ...spend, outcome: melee > 0 ? `${melee.toFixed(1)} in melee, striking first` : "nothing was in contact" };
        }
        default:
          return spend;
      }
    });

    history.push({
      round,
      log,
      spends: measured,
      objectives: scored,
      playerGained,
      enemyGained,
      playerScore,
      enemyScore,
      // Recorded rather than recomputed later: the round record drops keywords, and a
      // screen that guesses which pairings were firing from names alone would guess wrong.
      synergies: pairings
        ? { player: activeSynergies(players), enemy: activeSynergies(enemies) }
        : { player: [], enemy: [] },
      // KEYWORDS ARE RECORDED. They were not, and `supportLinksFor` reads them — so the
      // SHIELD and COMMAND links added for the last playtest drew nothing at all in the
      // app while their test passed, because the test handed the function keyworded units
      // directly and the screen hands it the round record. Anything the screen derives has
      // to be derivable from what the round actually stores.
      players: players.map((unit) => ({ id: unit.id, name: unit.name, x: unit.x, y: unit.y, wounds: Math.max(0, Number(unit.wounds.toFixed(2))), maxWounds: unit.maxWounds, keywords: unit.keywords ?? [] })),
      enemies: enemies.map((unit) => ({ id: unit.id, name: unit.name, x: unit.x, y: unit.y, wounds: Math.max(0, Number(unit.wounds.toFixed(2))), maxWounds: unit.maxWounds, keywords: unit.keywords ?? [] })),
    });
  }

  return {
    rounds: history,
    playerScore,
    enemyScore,
    winner: playerScore > enemyScore ? "player" : enemyScore > playerScore ? "enemy" : "draw",
    // Every pairing the player's army managed to form at any point in the battle. The run
    // writes these down: a synergy is written on no card, so the only way it can become
    // knowledge is by having happened once.
    synergies: [...new Set(history.flatMap((entry) => entry.synergies.player.map((found) => found.id)))],
    survivors: alive(players).length,
    losses: players.length - alive(players).length,
    playerDisposition: dispositionFor(playerDisposition),
    enemyDisposition: dispositionFor(enemyDisposition),
  };
};
