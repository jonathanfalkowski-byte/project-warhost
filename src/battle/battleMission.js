// The battle mission: two armies facing each other across objectives.
//
// "Why is the enemy coming from one corner" was a fair question — in the operation model
// the enemy entered from the east edge because its authored routes started there, which
// is a scripted incursion, not a battle. Here both armies deploy along opposite edges,
// the objectives sit between them, and neither side starts closer to more of them.

import { deployUnit } from "./battleRules.js";
import { planFor, routeDestinationFor, routePointsFor } from "./battlePlans.js";
import { buildArmyList } from "./enemyArmy.js";
import { resolveRoute } from "./battleTerrain.js";

// Five objectives: one in each army's own half, and three contested down the middle.
// The two "home" objectives are what make deployment a decision — leave them and you
// hand over free points, garrison them and you are outnumbered in the centre.
export const CIRCUIT_CLASH = {
  id: "circuit-clash",
  name: "BREAK THE CIRCUIT",
  brief: "Five objectives. Hold more of them than the Helioch Oath across five battle rounds.",
  rounds: 5,
  objectives: [
    { id: "south-relay", name: "SOUTH RELAY", x: 50, y: 82, points: 1 },
    { id: "west-works", name: "WEST WORKS", x: 22, y: 50, points: 1 },
    { id: "reactor", name: "REACTOR SPINE", x: 50, y: 50, points: 2 },
    { id: "east-gantry", name: "EAST GANTRY", x: 78, y: 50, points: 1 },
    { id: "north-relay", name: "NORTH RELAY", x: 50, y: 18, points: 1 },
  ],
  // Five slots along your own edge. Which formation goes in which slot is the
  // deployment decision — a slow unit on the far flank never reaches the fight.
  playerDeployment: [
    { id: "p1", name: "WEST FLANK", x: 18, y: 92 },
    { id: "p2", name: "WEST CENTRE", x: 34, y: 94 },
    { id: "p3", name: "CENTRE", x: 50, y: 95 },
    { id: "p4", name: "EAST CENTRE", x: 66, y: 94 },
    { id: "p5", name: "EAST FLANK", x: 82, y: 92 },
  ],
  enemyDeployment: [
    { id: "e1", name: "WEST FLANK", x: 18, y: 8 },
    { id: "e2", name: "WEST CENTRE", x: 34, y: 6 },
    { id: "e3", name: "CENTRE", x: 50, y: 5 },
    { id: "e4", name: "EAST CENTRE", x: 66, y: 6 },
    { id: "e5", name: "EAST FLANK", x: 82, y: 8 },
  ],
};

// The enemy army, and the objective each of its formations is ordered to take. Authored
// rather than reactive, so the player can be told what it intends before committing —
// the same disclosure principle the counter-board established.
// THE NARROWS — the same five roles and the same six victory points, squeezed toward the
// centre line. The values are deliberately identical to BREAK THE CIRCUIT so the only
// variable is the geometry: contact on round two, no long flank lane, and no time to set
// anything up. A plan that only worked because it had four rounds of walking will not work
// here, which is exactly what a second board is for.
export const THE_NARROWS = {
  id: "narrows",
  name: "THE NARROWS",
  brief: "The same ground, folded in half. Contact on round two and nowhere to hide from it.",
  rounds: 5,
  objectives: [
    { id: "south-yard", name: "SOUTH YARD", x: 50, y: 68, points: 1 },
    { id: "west-stack", name: "WEST STACK", x: 30, y: 50, points: 1 },
    { id: "the-span", name: "THE SPAN", x: 50, y: 50, points: 2 },
    { id: "east-stack", name: "EAST STACK", x: 70, y: 50, points: 1 },
    { id: "north-yard", name: "NORTH YARD", x: 50, y: 32, points: 1 },
  ],
  playerDeployment: [
    { id: "p1", name: "WEST FLANK", x: 20, y: 92 },
    { id: "p2", name: "WEST CENTRE", x: 35, y: 94 },
    { id: "p3", name: "CENTRE", x: 50, y: 95 },
    { id: "p4", name: "EAST CENTRE", x: 65, y: 94 },
    { id: "p5", name: "EAST FLANK", x: 80, y: 92 },
  ],
  enemyDeployment: [
    { id: "e1", name: "WEST FLANK", x: 20, y: 8 },
    { id: "e2", name: "WEST CENTRE", x: 35, y: 6 },
    { id: "e3", name: "CENTRE", x: 50, y: 5 },
    { id: "e4", name: "EAST CENTRE", x: 65, y: 6 },
    { id: "e5", name: "EAST FLANK", x: 80, y: 8 },
  ],
};

export const MISSIONS = { "circuit-clash": CIRCUIT_CLASH, narrows: THE_NARROWS };
export const missionFor = (id) => MISSIONS[id] ?? CIRCUIT_CLASH;
export const missionList = () => Object.values(MISSIONS);

export const IRON_PROCESSION = {
  name: "IRON PROCESSION",
  intent: "Garrison the north relay, mass on the Reactor Spine, and contest the east gantry.",
  // Declared, and shown to the player before they commit. You always know what the enemy
  // is trying to do; what stays hidden is only which stratagems it is holding to do it
  // with. Its detachment is what allows it to declare this in the first place.
  detachment: "ordoPraesidium",
  // The CONTROL setting: what this doctrine fields when nothing asks it for anything else.
  // Every axis of the balance sweep measures the player against exactly this, and it never
  // varies — see CONTROL_ARMY. The run varies all three.
  disposition: "dominion",
  plan: "spear",
  // Names attach to HULLS, not to slots. A Helioch railjack is AEGIS COHORT in every
  // engagement of every run, so what the player learns about it is knowledge that
  // transfers — which is the whole point of the enemy having a face at all once its list
  // stops being fixed.
  names: {
    railjack: "AEGIS COHORT",
    carriage: "CINDER LANCE",
    breaker: "OATH PURSUIT",
    command: "PROCESSION CHOIR",
    bastion: "GANTRY WARD",
    harpoon: "VOTIVE HARROW",
    furnace: "CENSER GUARD",
    hauler: "MERCY ENGINE",
    skimmer: "PSALM RUNNER",
  },
};

// The Helioch army for THE NARROWS. Different ground wants a different list: nothing here
// has time to set up at range, so it fields more that wants to be in contact.
export const SALT_COVENANT = {
  name: "SALT COVENANT",
  intent: "Take the span on round two and refuse to be moved off it.",
  detachment: "hollowjaw",
  disposition: "dominion",
  plan: "spear",
  names: {
    bastion: "SALT WARD",
    breaker: "COVENANT JAW",
    command: "TIDE CHOIR",
    skimmer: "SHORE LANCE",
    railjack: "BREAKWATER",
    carriage: "DEEP TOLL",
    furnace: "BRINE KILN",
    harpoon: "GAFF HOOK",
    hauler: "SALVAGE TENDER",
  },
};

export const ARMIES = { "circuit-clash": IRON_PROCESSION, narrows: SALT_COVENANT };
export const armyFor = (missionId) => ARMIES[missionId] ?? IRON_PROCESSION;

// The enemy force for an engagement: a detachment, a disposition it is allowed to declare,
// a plan from that disposition, and a list of hulls chosen to walk it. Called with nothing
// but a mission it produces the CONTROL army — the doctrine's own declared disposition and
// plan at full strength on seed zero, which is what the balance sweep measures against and
// what must never drift.
export const buildEnemyForce = (mission = CIRCUIT_CLASH, army = armyFor(mission.id), {
  disposition = army.disposition,
  planId = army.plan,
  strength = mission.enemyDeployment.length,
  seed = 0,
} = {}) => {
  const plan = planFor(disposition, planId);
  const roster = buildArmyList({ mission, plan, disposition, strength, seed });
  const units = [];
  const orders = {};
  const paths = {};
  for (const { slotIndex, formationId } of roster) {
    const slot = mission.enemyDeployment[slotIndex];
    const id = `enemy-${formationId}`;
    const name = army.names?.[formationId] ?? formationId.toUpperCase();
    units.push({ ...deployUnit({ formationId, name, position: slot }), id });
    // The plan is walked MIRRORED — the same doctrine, from the other edge. Its landmark
    // names are written from the southern edge, so reflecting the resolved points is what
    // makes one authored plan mean the same thing to both armies.
    const route = plan ? routePointsFor(plan, slotIndex, mission.id, true) : [];
    if (route.length > 0) paths[id] = route;
    orders[id] = (plan ? routeDestinationFor(plan, slotIndex, mission.objectives, mission.id, true) : null)
      ?? mission.objectives[Math.min(slotIndex, mission.objectives.length - 1)]?.id;
  }
  return { units, orders, paths, plan, disposition, army };
};

export const buildPlayerForce = ({
  mission = CIRCUIT_CLASH, deployment = {}, formations = [], battlePlan = null,
} = {}) => {
  const byId = new Map(formations.map((formation) => [formation.id, formation]));
  const units = [];
  const orders = {};
  const paths = {};
  mission.playerDeployment.forEach((slot, index) => {
    const entry = deployment[slot.id];
    if (!entry?.formationId) return;
    const formation = byId.get(entry.formationId);
    if (!formation) return;
    units.push(deployUnit({
      formationId: formation.id, name: formation.name, position: slot, wounds: entry.wounds, refit: entry.refit,
    }));
    // The plan's route decides both where the formation walks and, from where that walk
    // ends, the ground it is holding. Deriving the second from the first means a plan can
    // never claim an objective its own path does not reach.
    const route = battlePlan ? routePointsFor(battlePlan, index, mission.id) : [];
    if (route.length > 0) paths[formation.id] = route;
    orders[formation.id] = entry.objectiveId
      ?? (battlePlan ? routeDestinationFor(battlePlan, index, mission.objectives, mission.id) : null)
      ?? mission.objectives[2].id;
  });
  return { units, orders, paths };
};
