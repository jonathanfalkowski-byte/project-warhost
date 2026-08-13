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
    strength: "Leapfrog security keeps the objective column moving and preserves one recovery slot.",
    exposure: "The connected column can lose time if its lead formation is stopped.",
  }),
  spear: Object.freeze({
    name: "DECISIVE THRUST",
    strength: "The concentrated column reaches the primary objective 00:30 sooner.",
    exposure: "The exposed rear guard adds 00:15 to extraction.",
  }),
  pressure: Object.freeze({
    name: "TWO-AXIS ASSAULT",
    strength: "Split pressure resolves Alpha and Beta 00:15 sooner each.",
    exposure: "The separated wings require 00:15 to regroup before extraction.",
  }),
});

const NEUTRAL_DOCTRINE = Object.freeze({
  name: "NO DOCTRINE",
  strength: "No playbook advantage is active.",
  exposure: "No playbook exposure is active.",
});

export const resolvePlaybookDoctrine = (playbookId, handoffs = []) => {
  const doctrine = PLAYBOOK_DOCTRINES[playbookId] ?? NEUTRAL_DOCTRINE;

  if (playbookId === "trapline") {
    return {
      ...doctrine,
      triggered: true,
      impact: { ...EMPTY_IMPACT, alpha: 15, protects: 1 },
      result: "LEAPFROG ADVANCE · ALPHA -00:15 · ONE RECOVERY SLOT PRESERVED",
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
    return {
      ...doctrine,
      triggered: true,
      impact: { ...EMPTY_IMPACT, alpha: 15, beta: 15, missionDelay: 15 },
      result: "PARALLEL CAPTURE · ALPHA / BETA -00:15 · CONVERGENCE +00:15",
    };
  }

  return {
    ...doctrine,
    triggered: false,
    impact: { ...EMPTY_IMPACT },
    result: "NO PLAYBOOK MODIFIER",
  };
};
