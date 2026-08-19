// Building the enemy the way the player builds.
//
// The enemy used to be furniture. Two armies, five hand-authored routes and five
// hand-authored targets each, fielded as `units.slice(0, strength)` — so difficulty scaled
// by bolting one more vehicle onto the same army, every run faced the identical five
// configurations in the identical order whatever the seed, and both of them declared
// DOMINION forever. The player has three victory conditions and never once met an opponent
// using a different one.
//
// That mattered most the moment the warband grew past its five deployment slots. Picking
// five of nine against a CONSTANT is not a counter-pick, it is a lookup — solved once and
// then it is arithmetic. The pairing layer never firing for either authored army was a
// symptom of the same thing, not a separate bug.
//
// So the enemy is built here, out of the same parts the player builds from: a detachment,
// a disposition that detachment is allowed to declare, a plan from that disposition, and a
// list of hulls chosen to walk it. Deterministic from the run's seed, so a battle is still
// repeatable and the whole space is still sweepable. Not an AI — it never reacts, and the
// player is still told its detachment, its disposition and its intent before committing.
// What stays hidden is only the hand, exactly as before.
//
// This is also the PvP groundwork. "Enemy" stops being a category and becomes a warband.

import { BATTLE_PROFILES, battleProfileFor } from "./battleProfiles.js";
import { planFor, routeDestinationFor, routePointsFor } from "./battlePlans.js";
import { deployUnit, resolveBattle } from "./battleRules.js";
import { routeCost } from "./battleTerrain.js";
import { FORMATIONS } from "../formationData.js";

const shuffleKey = (seed, index) => ((Math.abs(Math.floor(seed)) + 1) * 2654435761 + (index + 1) * 40503) % 100003;

// What a deployment slot is being asked to do, read off the plan rather than declared.
// A plan is a set of routes; a route says how far a formation has to walk and what it is
// standing on when it stops. That is the whole brief for the hull that fills the slot.
// `index` is which of the ARMY this slot is, west to east, and `size` is how big that army
// is — the plan is lanes, and which lane a slot walks depends on how many are walking.
// Left out they fall back to the slot's own index, which is what they were when a plan was
// five routes and an army was always five formations.
export const slotRoleFor = ({ mission, plan, slotIndex, index = slotIndex, size = null }) => {
  const start = mission.enemyDeployment[slotIndex];
  const points = plan ? routePointsFor(plan, index, mission.id, true, size) : [];
  // Priced in MOVEMENT, not in distance — a route across the slag is longer than it looks,
  // and the whole reason this number exists is to work out how fast the hull filling the
  // slot has to be. Reading plain distance would put the slowest hull on the rubble lane.
  const walk = routeCost(start, points, mission.id);
  const destination = plan ? routeDestinationFor(plan, index, mission.objectives, mission.id, true, size) : null;
  const objective = mission.objectives.find((entry) => entry.id === destination) ?? null;
  return {
    slotIndex,
    walk,
    // The opening advance is a double one, so a formation has rounds + 1 moves to arrive.
    // Below this it is still walking when the battle ends, which is a wasted slot.
    needsMove: walk / (mission.rounds + 1),
    holds: objective?.points ?? 0,
    // Ground on the centre line is what both armies are sent at, so whatever stands there
    // is going to be fought over rather than left alone.
    contested: objective ? Math.abs(objective.y - 50) < 1 : false,
  };
};

// How well a hull suits a slot. Deliberately a short, readable formula rather than a tuned
// one: it is standing in for a person looking at a route and saying "that is a long walk,
// put something fast on it".
//
// It has to know the DISPOSITION, not just the plan. Building for ground under a
// disposition that scores none of it is how the enemy ended up conceding games it had
// declared it would win by killing: it fielded control hulls, walked an ERADICATION plan
// into the player's half, gave up all five markers and had nothing to show for it. The
// player's run win rate against an eradicating enemy was roughly double what it was against
// a dominion one, which is not a hard opponent making a choice — it is a list built for the
// wrong scoreboard.
export const fitFor = (profile, role, { scoresGround = true } = {}) => {
  // A formation that cannot finish the walk is worthless in that slot whatever else it is,
  // and the least bad of them is the fastest.
  if (profile.move < role.needsMove) return profile.move - 100;
  // ERADICATION scores nothing that is standing anywhere, so the questions are only how
  // much a hull can put out and whether it can get to where the shooting is. Weighting
  // WOUNDS here — reading "this ground is contested, send something that survives" — is
  // what filled its lists with slow brawlers that never arrived: an eradicating enemy
  // scored 1 to 4 victory points against a dominion one's 13, which is not a hard choice
  // with a downside, it is a disposition nobody could ever declare.
  if (!scoresGround) {
    return (profile.shots * 1.4) + (profile.melee * 0.5) + (profile.range * 0.06) + (spareSpeed(profile, role) * 3);
  }
  return (role.holds * profile.control * 2)
    + (role.contested ? (profile.wounds * 0.6) + (profile.melee * 0.4) : 0)
    + (profile.shots * 0.5)
    + spareSpeed(profile, role);
};

// SPARE speed, not raw speed, and it is worth real weight. The gate above only asks whether
// a hull can finish the walk by the last round — so it read a formation arriving on round
// five, which fires once, as equal to one arriving on round two, which fires four times.
// That is most of why a built enemy dealt about a third of the damage the player dealt from
// the mirror image of the same plan: it kept putting its best holder on its longest route
// and its fastest hull on its shortest.
const spareSpeed = (profile, role) => Math.max(0, profile.move - role.needsMove) * 0.15;

// How many of the best-fitting hulls a slot will actually consider. One would make every
// enemy identical for a given plan; the whole roster would make the list noise. Two means
// the army is always sensible and never the same twice.
export const SHORTLIST = 2;
// How many a slot considers when the enemy has something to answer. Wider, because the
// counter is choosing between hulls that can all do the job rather than adding to their
// fit: three candidates is a real choice, and every one of them still walks the route.
export const COUNTER_SHORTLIST = 4;
// How many times it goes back over the list. Swapping one slot changes what the others
// should be, so a single pass answers the early slots against a list the enemy no longer
// has; it stops early as soon as a pass changes nothing.
export const COUNTER_PASSES = 3;

// THE REHEARSAL — how the enemy answers what the player brought.
//
// The first attempt scored hulls against the player's list by fighting them one against one
// on bare ground and taking the best matchup. It made the enemy WORSE: the number of player
// lists that beat every enemy went UP from 32 to 282. A duel says a breaker eats everything
// and this is not a game of duels — it is five hulls, five routes and five markers, and the
// enemy's own best lists turn out to be full of cheap fast objective hulls that would lose
// every duel on the board.
//
// So the enemy does not consult a table of counters. It REPLAYS THE LAST ENGAGEMENT: the
// same five formations the player fielded, in the same slots, walking the same plan, and
// tries its own alternatives against them one slot at a time. What it keeps is what actually
// scored better against that army on this ground. It is one ply deep and it is honest — the
// thing being optimised is the thing being played.
//
// The information is fair: it is what the player themselves put on the board last time, and
// the brief says plainly which hulls were changed because of it.
const rehearsalForce = (mission, counter) => {
  const plan = planFor(counter.disposition, counter.planId);
  const units = [];
  const orders = {};
  const paths = {};
  const walking = counter.order.filter((formationId) => formationId && BATTLE_PROFILES[formationId]).length;
  let walked = 0;
  counter.order.forEach((formationId, slotIndex) => {
    if (!formationId || !BATTLE_PROFILES[formationId] || !mission.playerDeployment[slotIndex]) return;
    const id = `rehearsal-${formationId}#${slotIndex}`;
    const index = walked;
    walked += 1;
    units.push(deployUnit({ formationId, name: formationId.toUpperCase(), position: mission.playerDeployment[slotIndex], id }));
    const route = plan ? routePointsFor(plan, index, mission.id, false, walking) : [];
    if (route.length > 0) paths[id] = route;
    orders[id] = (plan ? routeDestinationFor(plan, index, mission.objectives, mission.id, false, walking) : null)
      ?? mission.objectives[Math.min(slotIndex, mission.objectives.length - 1)]?.id;
  });
  return { units, orders, paths };
};

// One trial: this list, walking this plan, against the army the player last fielded. Scored
// from the ENEMY's side, because that is who is choosing.
const rehearse = ({ mission, plan, disposition, chosen, fielded, rehearsal, counter }) => {
  const units = [];
  const orders = {};
  const paths = {};
  fielded.forEach((role, index) => {
    const formationId = chosen.get(role.slotIndex);
    if (!formationId) return;
    const id = `trial-${formationId}#${role.slotIndex}`;
    units.push(deployUnit({ formationId, name: formationId.toUpperCase(), position: mission.enemyDeployment[role.slotIndex], id }));
    const route = plan ? routePointsFor(plan, index, mission.id, true, fielded.length) : [];
    if (route.length > 0) paths[id] = route;
    orders[id] = (plan ? routeDestinationFor(plan, index, mission.objectives, mission.id, true, fielded.length) : null)
      ?? mission.objectives[Math.min(role.slotIndex, mission.objectives.length - 1)]?.id;
  });
  const result = resolveBattle({
    playerUnits: rehearsal.units, enemyUnits: units, objectives: mission.objectives,
    playerOrders: rehearsal.orders, enemyOrders: orders,
    playerPaths: rehearsal.paths, enemyPaths: paths,
    playerDisposition: counter.disposition, enemyDisposition: disposition,
    rounds: mission.rounds, missionId: mission.id,
  });
  return result.enemyScore - result.playerScore;
};

// A run rebuilds the same enemy on every render. Fifteen trial battles is nothing on its
// own and everything when it happens sixty times a second.
const REHEARSED = new Map();
const REHEARSAL_CACHE_LIMIT = 512;

// The list. Slots are filled in order of how demanding they are rather than left to right,
// so the hardest brief gets first pick of the roster — which is what anyone does when they
// build a list, and what stops the long flank route being handed whatever is left.
export const buildArmyList = ({ mission, plan, disposition = "dominion", strength = 5, seed = 0, pool = FORMATIONS, counter = null }) => {
  const reading = counter?.order?.some(Boolean) ? counter : null;
  const cacheKey = reading
    ? [mission.id, plan?.id, disposition, strength, seed, reading.disposition, reading.planId, reading.order.join("+")].join("|")
    : null;
  if (cacheKey && REHEARSED.has(cacheKey)) return REHEARSED.get(cacheKey);

  const scoresGround = disposition !== "eradication";
  // WHICH SLOTS STAND, before what they are being asked to do — because what a slot is being
  // asked to do now depends on how many of them there are. Contiguous, centre-out: a
  // screening force of three is the middle three slots, not the two flanks and one wing,
  // which would leave a gap the player walks through.
  const centre = (mission.enemyDeployment.length - 1) / 2;
  const standing = mission.enemyDeployment
    .map((unused, slotIndex) => slotIndex)
    .sort((left, right) => Math.abs(left - centre) - Math.abs(right - centre))
    .slice(0, Math.max(1, Math.min(strength, mission.enemyDeployment.length)))
    .sort((left, right) => left - right);
  const fielded = standing.map((slotIndex, index) => slotRoleFor({
    mission, plan, slotIndex, index, size: standing.length,
  }));

  const order = [...fielded].sort((left, right) => right.needsMove - left.needsMove);
  const taken = new Set();
  const chosen = new Map();
  const shortlists = new Map();
  for (const role of order) {
    const ranked = pool
      .filter((formation) => !taken.has(formation.id) && BATTLE_PROFILES[formation.id])
      .map((formation) => ({ formation, fit: fitFor(battleProfileFor(formation.id), role, { scoresGround }) }))
      .sort((left, right) => right.fit - left.fit || left.formation.id.localeCompare(right.formation.id));
    if (ranked.length === 0) continue;
    const shortlist = ranked.slice(0, Math.min(reading ? COUNTER_SHORTLIST : SHORTLIST, ranked.length));
    shortlists.set(role.slotIndex, shortlist.map((entry) => entry.formation.id));
    const pick = shortlist[shuffleKey(seed, role.slotIndex) % shortlist.length].formation;
    taken.add(pick.id);
    chosen.set(role.slotIndex, pick.id);
  }

  // Having read them: keep the seeded list as the opening bid and try each slot's other
  // candidates against the army the player last fielded, keeping whatever scored best. One
  // slot at a time, in the same order the slots were filled, so the hardest brief is
  // answered first. Never outside the shortlist — every candidate can still walk the route.
  if (reading) {
    const rehearsal = rehearsalForce(mission, reading);
    if (rehearsal.units.length > 0) {
      let best = rehearse({ mission, plan, disposition, chosen, fielded, rehearsal, counter: reading });
      // Passes, not one sweep. Swapping the hardest slot changes what the easy ones should
      // be doing, and a single pass leaves the first slots answered against a list the
      // enemy no longer has. It stops as soon as a whole pass changes nothing.
      for (let pass = 0; pass < COUNTER_PASSES; pass += 1) {
        let moved = false;
        for (const role of order) {
          for (const candidate of shortlists.get(role.slotIndex) ?? []) {
            const current = chosen.get(role.slotIndex);
            if (candidate === current || taken.has(candidate)) continue;
            chosen.set(role.slotIndex, candidate);
            const margin = rehearse({ mission, plan, disposition, chosen, fielded, rehearsal, counter: reading });
            if (margin > best) {
              best = margin;
              taken.delete(current);
              taken.add(candidate);
              moved = true;
            } else {
              chosen.set(role.slotIndex, current);
            }
          }
        }
        if (!moved) break;
      }
    }
  }

  const list = fielded
    .map((role) => ({ slotIndex: role.slotIndex, formationId: chosen.get(role.slotIndex) }))
    .filter((entry) => entry.formationId);
  if (cacheKey) {
    if (REHEARSED.size > REHEARSAL_CACHE_LIMIT) REHEARSED.clear();
    REHEARSED.set(cacheKey, list);
  }
  return list;
};
