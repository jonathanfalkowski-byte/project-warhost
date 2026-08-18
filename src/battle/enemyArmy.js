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
import { routeDestinationFor, routePointsFor } from "./battlePlans.js";
import { routeCost } from "./battleTerrain.js";
import { FORMATIONS } from "../formationData.js";

const shuffleKey = (seed, index) => ((Math.abs(Math.floor(seed)) + 1) * 2654435761 + (index + 1) * 40503) % 100003;

// What a deployment slot is being asked to do, read off the plan rather than declared.
// A plan is a set of routes; a route says how far a formation has to walk and what it is
// standing on when it stops. That is the whole brief for the hull that fills the slot.
export const slotRoleFor = ({ mission, plan, slotIndex }) => {
  const start = mission.enemyDeployment[slotIndex];
  const points = plan ? routePointsFor(plan, slotIndex, mission.id, true) : [];
  // Priced in MOVEMENT, not in distance — a route across the slag is longer than it looks,
  // and the whole reason this number exists is to work out how fast the hull filling the
  // slot has to be. Reading plain distance would put the slowest hull on the rubble lane.
  const walk = routeCost(start, points, mission.id);
  const destination = plan ? routeDestinationFor(plan, slotIndex, mission.objectives, mission.id, true) : null;
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

// The list. Slots are filled in order of how demanding they are rather than left to right,
// so the hardest brief gets first pick of the roster — which is what anyone does when they
// build a list, and what stops the long flank route being handed whatever is left.
export const buildArmyList = ({ mission, plan, disposition = "dominion", strength = 5, seed = 0, pool = FORMATIONS }) => {
  const scoresGround = disposition !== "eradication";
  const slots = mission.enemyDeployment.map((unused, slotIndex) => slotRoleFor({ mission, plan, slotIndex }));
  // Contiguous, centre-out: a screening force of three is the middle three slots, not the
  // two flanks and one wing, which would leave a gap the player walks through.
  const centre = (mission.enemyDeployment.length - 1) / 2;
  const fielded = [...slots]
    .sort((left, right) => Math.abs(left.slotIndex - centre) - Math.abs(right.slotIndex - centre))
    .slice(0, Math.max(1, Math.min(strength, slots.length)))
    .sort((left, right) => left.slotIndex - right.slotIndex);

  const taken = new Set();
  const chosen = new Map();
  for (const role of [...fielded].sort((left, right) => right.needsMove - left.needsMove)) {
    const ranked = pool
      .filter((formation) => !taken.has(formation.id) && BATTLE_PROFILES[formation.id])
      .map((formation) => ({ formation, fit: fitFor(battleProfileFor(formation.id), role, { scoresGround }) }))
      .sort((left, right) => right.fit - left.fit || left.formation.id.localeCompare(right.formation.id));
    if (ranked.length === 0) continue;
    const shortlist = ranked.slice(0, Math.min(SHORTLIST, ranked.length));
    const pick = shortlist[shuffleKey(seed, role.slotIndex) % shortlist.length].formation;
    taken.add(pick.id);
    chosen.set(role.slotIndex, pick.id);
  }
  return fielded.map((role) => ({ slotIndex: role.slotIndex, formationId: chosen.get(role.slotIndex) })).filter((entry) => entry.formationId);
};
