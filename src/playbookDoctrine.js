const EMPTY_IMPACT = Object.freeze({
  alpha: 0,
  beta: 0,
  reactor: 0,
  extraction: 0,
  missionDelay: 0,
  protects: 0,
});

export const PLAYBOOK_DOCTRINES = Object.freeze({
  trapline: Object.freeze({
    name: "OVERLAPPING FIRES",
    strength: "An armed opening combo catches the enemy between formations and preserves one recovery slot.",
    exposure: "Without that opening combo, the force waits on a trap that never closes and loses 00:15.",
  }),
  spear: Object.freeze({
    name: "DECISIVE THRUST",
    strength: "The concentrated column reaches the primary objective 00:30 sooner.",
    exposure: "The exposed rear guard adds 00:15 to extraction.",
  }),
  pressure: Object.freeze({
    name: "TWO-AXIS ASSAULT",
    strength: "Split pressure resolves Alpha and Beta 00:15 sooner each.",
    exposure: "Fewer than two automatic combos leave the force separated and add 00:15 to regroup.",
  }),
});

const NEUTRAL_DOCTRINE = Object.freeze({
  name: "NO DOCTRINE",
  strength: "No playbook advantage is active.",
  exposure: "No playbook exposure is active.",
});

export const resolvePlaybookDoctrine = (playbookId, handoffs = []) => {
  const doctrine = PLAYBOOK_DOCTRINES[playbookId] ?? NEUTRAL_DOCTRINE;
  const comboCount = handoffs.filter((handoff) => Boolean(handoff?.maneuver)).length;

  if (playbookId === "trapline") {
    const triggered = Boolean(handoffs[0]?.maneuver);
    return {
      ...doctrine,
      triggered,
      impact: { ...EMPTY_IMPACT, missionDelay: triggered ? 0 : 15, protects: triggered ? 1 : 0 },
      result: triggered
        ? "OPENING COMBO ARMED · ONE RECOVERY SLOT PRESERVED"
        : "TRAP NEVER CLOSED · +00:15 MISSION DELAY",
    };
  }

  if (playbookId === "spear") {
    return {
      ...doctrine,
      triggered: true,
      impact: { ...EMPTY_IMPACT, reactor: 30, missionDelay: 15 },
      result: "REACTOR -00:30 · EXTRACTION +00:15",
    };
  }

  if (playbookId === "pressure") {
    const triggered = comboCount >= 2;
    return {
      ...doctrine,
      triggered,
      impact: { ...EMPTY_IMPACT, alpha: 15, beta: 15, missionDelay: triggered ? 0 : 15 },
      result: triggered
        ? "BOTH AXES LINKED · ALPHA / BETA -00:15"
        : "AXES SEPARATED · ALPHA / BETA -00:15 · REGROUP +00:15",
    };
  }

  return {
    ...doctrine,
    triggered: false,
    impact: { ...EMPTY_IMPACT },
    result: "NO PLAYBOOK MODIFIER",
  };
};
