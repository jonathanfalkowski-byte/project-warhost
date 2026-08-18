// Detachment -> disposition -> strategy.
//
// The three-layer shape the design asked for, in the order the decisions are actually
// made: "detachments like in the 40k game determine the type of dispositions you can
// have... and that leads to 3 types of strategies within their dispositions".
//
//   DETACHMENT   which stratagems you may spend, and which dispositions you may declare
//   DISPOSITION  how your army scores. Not flavour — it replaces the victory condition
//   STRATEGY     three authored plans per disposition, each a ROUTE PER DEPLOYMENT SLOT
//
// The point of putting the scoring rule on the disposition is that it makes the layers
// bite. A detachment that only handed out stratagems would be a cosmetic label; one that
// gates how you are allowed to win is a real list-building decision, and it makes the
// same board winnable in three different ways.
//
// Both armies declare a disposition and both are shown it before the battle. What stays
// hidden is only the stratagem hand — you always know what your enemy is trying to do,
// never exactly what they are holding to do it with.

const heldPoints = (objectives, side) => objectives
  .filter((objective) => objective.holder === side)
  .reduce((sum, objective) => sum + objective.points, 0);

// Your own half is the one you deployed in; the player enters from the south (high y).
// Objectives sitting exactly on the centre line belong to neither army, so SAFEGUARD
// cannot cash them either — "your own ground" has to mean the ground behind you, or the
// rule quietly becomes DOMINION with a bonus attached and beats it every time.
const inOwnHalf = (objective, side) => (side === "player" ? objective.y > 50 : objective.y < 50);

// A disposition does two things, and the second one is why declaring it is a commitment:
//
//   1. it decides HOW you score
//   2. it decides WHICH OBJECTIVES ARE LIVE FOR YOU AT ALL
//
// The second is what makes it a mission type rather than a scoring modifier. Declare
// ERADICATION and every objective marker on the board goes dark for you — there is no
// ground worth anything, only the army in front of you. Declare SAFEGUARD and everything
// past your own half goes dark, and what is left is worth double. The board visibly
// changes when you declare, which is the clearest possible statement of what you are now
// playing for.
//
// `sites` returns the objectives that pay this side, already re-valued. Both armies read
// their own, so the same marker can be worth two points to one of them and nothing to the
// other at the same moment.
export const DISPOSITIONS = {
  dominion: {
    id: "dominion",
    name: "DOMINION",
    summary: "Capture and hold decisive ground.",
    scoring: "Every objective on the board is live, and pays its full victory points.",
    board: "All markers live.",
    sites: (objectives) => objectives,
    score: ({ objectives, side }) => heldPoints(objectives, side),
  },
  eradication: {
    id: "eradication",
    name: "ERADICATION",
    summary: "Break the enemy army rather than the ground it stands on.",
    // Written from the numbers rather than beside them: the rate said 4 while the rule paid
    // 1 in 3, because the sentence was typed once and the divisor was tuned later. A screen
    // that states the wrong rule is worse than one that states none.
    get scoring() {
      return `1 VP for every ${DISPOSITIONS.eradication.damagePerPoint} wounds you inflict, and ${DISPOSITIONS.eradication.wreckBounty} VP for every formation destroyed.`;
    },
    board: "Every marker dark. No ground scores at all.",
    // Paid on damage, not just kills. A five-round battle destroys half a formation on
    // average — the sweep measured it — so a rule that only counted wrecks would top out
    // at 8 VP against an enemy that reliably scores 13, and nobody would ever declare it.
    //
    // The damage total is CUMULATIVE and the points already paid for it are subtracted,
    // rather than each round being floored on its own. Rounding per round quietly punished
    // spreading your fire: PINCER dealt 21.5 wounds to HEADHUNT's 22.8 and scored 5 to its
    // 14, almost all of the gap being remainders thrown away four times over.
    // Written ONCE. The divisor used to be a literal 4 in `score` and a `damagePerPoint: 4`
    // beside it, and only the second one was read when working out what the damage you TOOK
    // costs you. Raising the field alone made ERADICATION stronger (73.7% from 65.4%),
    // because it cut the penalty and left the reward untouched — a tuning knob wired to
    // half the thing it names.
    damagePerPoint: 3,
    // Named for the same reason the divisor is: a number that appears in `score` and
    // nowhere else is a number nobody can tune without reading the function.
    wreckBounty: 3,
    sites: () => [],
    score: ({ destroyed, damage, damagePaid }) => (Math.floor(damage / DISPOSITIONS.eradication.damagePerPoint) - damagePaid) + (DISPOSITIONS.eradication.wreckBounty * destroyed),
  },
  safeguard: {
    id: "safeguard",
    name: "SAFEGUARD",
    summary: "Give up nothing. Hold your own ground and bring the army home.",
    scoring: "Only your own half is live, and it pays double. Holding it and losing nobody pays 1 VP more.",
    board: "Everything past your own half goes dark.",
    // The narrowest of the three: one or two markers, worth double, and the rest of its
    // score has to come from rounds where nothing dies. It should be the answer for a list
    // that cannot survive a push, never the answer for a list that can.
    sites: (objectives, side) => objectives
      .filter((objective) => inOwnHalf(objective, side))
      .map((objective) => ({ ...objective, points: objective.points * 2 })),
    // The clean-round point requires actually holding your ground, not merely avoiding
    // contact. Paying it for a quiet round rewarded hiding, and across a five-battle run
    // that compounded into 3.24 battles won against 1.44 for the other two dispositions —
    // "give up nothing" has to mean holding something.
    score: ({ objectives, side, lost }) => {
      const held = heldPoints(objectives, side);
      return held + (lost === 0 && held > 0 ? 1 : 0);
    },
  },
};

// Which markers are live for a side, already re-valued. The UI draws dark markers from
// the difference between this and the mission's full set.
export const liveSitesFor = ({ disposition, side = "player", objectives = [] } = {}) => {
  const rule = typeof disposition === "string" ? dispositionFor(disposition) : (disposition ?? DISPOSITIONS.dominion);
  return rule.sites(objectives, side);
};

export const dispositionFor = (id) => DISPOSITIONS[id] ?? DISPOSITIONS.dominion;

// The three strategies for each disposition are authored plans with paths, and they live
// in battlePlans.js — a strategy is a route per deployment slot, not a list of objective
// assignments. Re-exported here so the doctrine layers read in one place.
export { BATTLE_PLANS as STRATEGIES, plansFor as strategiesFor, planFor as strategyFor } from "./battlePlans.js";

// What a detachment is allowed to declare. A detachment that could take everything would
// not be a decision, so each one is missing something another one has.
export const dispositionsFor = (detachment) => (detachment?.dispositions ?? [])
  .map((id) => DISPOSITIONS[id])
  .filter(Boolean);

// How many points a side has been paid for damage so far, which the next round has to
// subtract. Zero for a disposition that is not paid on damage at all.
export const damagePointsFor = (disposition, damage = 0) => {
  const rule = typeof disposition === "string" ? dispositionFor(disposition) : (disposition ?? DISPOSITIONS.dominion);
  return rule.damagePerPoint ? Math.floor(Math.max(0, damage) / rule.damagePerPoint) : 0;
};

// One round's victory points under a disposition. Kept out of the rules module so a new
// way to win is a data change rather than a change to how a battle resolves.
export const scoreRound = ({ disposition, side, objectives = [], destroyed = 0, lost = 0, damage = 0, damagePaid = 0 }) => {
  const rule = typeof disposition === "string" ? dispositionFor(disposition) : (disposition ?? DISPOSITIONS.dominion);
  // The rule only ever sees the markers that are live for this side, already re-valued.
  // Filtering here rather than inside each rule is what keeps "which objectives exist"
  // and "what holding one is worth" as one decision instead of two that can disagree.
  const live = rule.sites(objectives, side);
  return Math.max(0, rule.score({ objectives: live, side, destroyed, lost, damage, damagePaid }));
};
