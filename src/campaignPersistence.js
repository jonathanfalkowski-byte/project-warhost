import { battlefieldConsequencesAt } from "./battleConsequences.js";

const CAMPAIGN_STATES = Object.freeze({
  damaged: Object.freeze({ label: "DAMAGED", severity: 1 }),
  missing: Object.freeze({ label: "MISSING", severity: 2 }),
});

const copyConditions = (conditions = {}) => Object.fromEntries(
  Object.entries(conditions)
    .filter(([formationId, condition]) => typeof formationId === "string" && CAMPAIGN_STATES[condition?.state])
    .map(([formationId, condition]) => [formationId, { ...condition, ...CAMPAIGN_STATES[condition.state] }]),
);

export const integrityLossFor = ({ operationWon = false, extractedCount = 0 } = {}) => {
  if (operationWon) return 0;
  const safeExtractedCount = Math.max(0, Math.floor(Number(extractedCount) || 0));
  if (safeExtractedCount <= 0) return 3;
  if (safeExtractedCount === 1) return 2;
  return 1;
};

export const campaignOutcomeFor = ({ hasNextOperation = false, operationWon = false, integrityRemaining = 0 } = {}) => {
  const safeIntegrity = Math.max(0, Math.floor(Number(integrityRemaining) || 0));
  if (safeIntegrity <= 0) return "destroyed";
  if (hasNextOperation) return "continue";
  return operationWon ? "terminal" : "destroyed";
};

const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const joinCosts = (costs) => costs.length <= 1
  ? costs[0] ?? ""
  : `${costs.slice(0, -1).join(", ")} and ${costs.at(-1)}`;

export const victoryGradeFor = ({
  won = false,
  extractedCount = 0,
  requiredExtraction = 0,
  totalFormations = 0,
  formationFates = [],
} = {}) => {
  if (!won) return null;

  const extracted = Math.max(0, Math.floor(Number(extractedCount) || 0));
  const required = Math.max(0, Math.floor(Number(requiredExtraction) || 0));
  const total = Math.max(0, Math.floor(Number(totalFormations) || 0));
  const fates = Array.isArray(formationFates) ? formationFates : [];
  const destroyed = fates.filter(({ fate }) => fate === "destroyed").length;
  const missing = fates.filter(({ fate }) => fate === "missing").length;
  const damaged = fates.filter(({ fate }) => fate === "damaged").length;
  const unaccounted = destroyed + missing;
  const everyFormationReady = total > 0 && extracted >= total && unaccounted === 0 && damaged === 0;

  if (everyFormationReady) {
    return {
      id: "decisive",
      label: "DECISIVE VICTORY",
      eyebrow: "OPERATION SUCCESS · FORCE INTACT",
      tone: "decisive",
      summary: "Objective secured and every formation returned combat-ready.",
    };
  }

  const costs = [];
  if (destroyed > 0) costs.push(`${countLabel(destroyed, "formation")} destroyed`);
  if (missing > 0) costs.push(`${countLabel(missing, "formation")} missing`);
  if (damaged > 0) costs.push(`${countLabel(damaged, "formation")} escaped damaged`);
  const costly = extracted <= required || unaccounted >= 2 || destroyed > 0;

  if (costly) {
    return {
      id: "costly",
      label: "COSTLY VICTORY",
      eyebrow: "OPERATION SUCCESS · HIGH COST",
      tone: "costly",
      summary: costs.length > 0
        ? `Objective secured, but ${joinCosts(costs)}.`
        : "Objective secured at the minimum extraction threshold.",
    };
  }

  return {
    id: "victory",
    label: "VICTORY",
    eyebrow: "OPERATION SUCCESS",
    tone: "victory",
    summary: costs.length > 0
      ? `Objective secured with ${joinCosts(costs)}.`
      : "Objective secured with the surviving force ready to continue.",
  };
};

// `deployedIds` is the list of formations actually staffed onto action stops. It matters
// because the roster is larger than the plan: a nine-formation roster fielding five left
// four in reserve, and those four were previously handed fates as if they had fought.
// Reserves carry no battlefield consequences, so they sorted last in `exposedFirst` and
// absorbed the "extracted" slots, while every formation the player actually fielded and
// watched reach the gantry was reported MISSING. Extraction is a fact about the units on
// the field; formations that never deployed are neither extracted nor lost.
export const formationFatesFor = ({
  formations = [],
  formationOrderIds = [],
  deployedIds = null,
  extractedCount = 0,
  consequences = {},
  campaignDestroyed = false,
  extractionAt = 0,
  completeAt = extractionAt,
  protectedFormationIds = [],
} = {}) => {
  const validFormations = Array.isArray(formations)
    ? formations.filter((formation) => formation && typeof formation.id === "string")
    : [];
  const byId = new Map(validFormations.map((formation) => [formation.id, formation]));
  const orderedIds = [...new Set([
    ...(Array.isArray(formationOrderIds) ? formationOrderIds : []),
    ...validFormations.map((formation) => formation.id),
  ])].filter((formationId) => byId.has(formationId));
  // Omitting `deployedIds` keeps the old whole-roster behaviour, so a caller that has no
  // plan to describe (a campaign summary, a test fixture) still gets fates for everyone.
  const deployedSet = Array.isArray(deployedIds) && deployedIds.length > 0
    ? new Set(deployedIds.filter((formationId) => byId.has(formationId)))
    : null;
  const wasDeployed = (formationId) => !deployedSet || deployedSet.has(formationId);
  const ordered = orderedIds.map((formationId, orderIndex) => ({
    formation: byId.get(formationId),
    orderIndex,
    consequence: consequences?.[formationId] ?? null,
    deployed: wasDeployed(formationId),
  }));
  // Every count below is over the fielded force only.
  const fielded = ordered.filter((item) => item.deployed);
  const safeExtractedCount = Math.max(0, Math.min(fielded.length, Math.floor(Number(extractedCount) || 0)));
  const unaccountedCount = fielded.length - safeExtractedCount;
  const protectedIds = new Set(Array.isArray(protectedFormationIds) ? protectedFormationIds : []);
  const exposedFirst = [...fielded].sort((left, right) => {
    if (safeExtractedCount > 0) {
      const protectionDifference = Number(protectedIds.has(left.formation.id)) - Number(protectedIds.has(right.formation.id));
      if (protectionDifference) return protectionDifference;
    }
    const combatRisk = (item) => {
      const combat = item.consequence?.combat;
      if (!combat) return 0;
      return (Number(combat.damage) || 0) * 10 + (Number(combat.remaining) <= 0 ? 50 : 0);
    };
    const combatDifference = combatRisk(right) - combatRisk(left);
    if (combatDifference) return combatDifference;
    const severityDifference = Number(right.consequence?.severity ?? 0) - Number(left.consequence?.severity ?? 0);
    return severityDifference || right.orderIndex - left.orderIndex;
  });
  const unaccountedIds = new Set(exposedFirst.slice(0, unaccountedCount).map(({ formation }) => formation.id));
  const destroyedId = campaignDestroyed && safeExtractedCount === 0
    ? exposedFirst[0]?.formation.id ?? null
    : null;
  const safeExtractionAt = Math.max(0, Math.floor(Number(extractionAt) || 0));
  const safeCompleteAt = Math.max(safeExtractionAt, Math.floor(Number(completeAt) || safeExtractionAt));
  const unaccountedSequence = [
    ...exposedFirst.slice(0, unaccountedCount).filter(({ formation }) => formation.id !== destroyedId),
    ...exposedFirst.slice(0, unaccountedCount).filter(({ formation }) => formation.id === destroyedId),
  ];
  const unaccountedTimes = new Map(unaccountedSequence.map(({ formation }, index) => [
    formation.id,
    Math.round(safeExtractionAt + ((index + 1) / (unaccountedSequence.length + 1)) * (safeCompleteAt - safeExtractionAt)),
  ]));

  return ordered.map(({ formation, orderIndex, consequence, deployed }) => {
    // A formation left in reserve did not take part. It is not extracted (it never had to
    // clear anything) and it is certainly not missing, so it gets its own fate rather
    // than being scored against an operation it sat out.
    if (!deployed) {
      return {
        formation,
        formationId: formation.id,
        orderIndex,
        consequence: null,
        fate: "reserve",
        label: "IN RESERVE",
        battleLabel: "IN RESERVE",
        at: safeCompleteAt,
        history: [],
        detail: "Held in reserve; not committed to this operation.",
      };
    }
    const consequenceAt = Math.max(0, Math.min(safeCompleteAt, Math.floor(Number(consequence?.at) || safeExtractionAt)));
    const consequenceLabel = typeof consequence?.label === "string"
      ? consequence.label
      : typeof consequence?.state === "string"
        ? consequence.state.replaceAll("-", " ").toUpperCase()
        : null;
    const initialHistory = consequenceLabel ? [{
      label: consequenceLabel,
      state: consequence.state,
      at: consequenceAt,
      source: "collision",
      cause: consequence.cause ?? "Battlefield contact",
    }] : [];
    const appendHistory = (history, event) => history.at(-1)?.label === event.label ? history : [...history, event];
    const withHistory = (events) => events.reduce(appendHistory, initialHistory);
    const shared = { formation, formationId: formation.id, orderIndex, consequence };
    if (formation.id === destroyedId) {
      const fateAt = unaccountedTimes.get(formation.id) ?? safeCompleteAt;
      const cutOffAt = Math.max(safeExtractionAt, fateAt - 1);
      const history = withHistory([
        { label: "CUT OFF", state: "cut-off", at: cutOffAt, source: "extraction", cause: "Extraction route severed" },
        { label: "DESTROYED", state: "destroyed", at: fateAt, source: "extraction", cause: consequence?.cause ?? "Final collapse" },
      ]);
      return { ...shared, fate: "destroyed", label: "DESTROYED", battleLabel: "DESTROYED", at: fateAt, history, detail: consequence?.cause ? `Lost during ${consequence.cause}.` : "Lost during the final collapse." };
    }
    if (unaccountedIds.has(formation.id)) {
      const fateAt = unaccountedTimes.get(formation.id) ?? safeCompleteAt;
      const history = withHistory([
        { label: "CUT OFF", state: "cut-off", at: fateAt, source: "extraction", cause: "Extraction route severed" },
        { label: "MISSING", state: "missing", at: safeCompleteAt, source: "operation", cause: "Failed to report after extraction" },
      ]);
      return { ...shared, fate: "missing", label: "MISSING", battleLabel: "CUT OFF", at: fateAt, history, detail: consequence?.cause ? `Last contact during ${consequence.cause}.` : "Did not clear extraction; status unconfirmed." };
    }
    if (Number(consequence?.severity ?? 0) >= 3) {
      const history = withHistory([
        { label: "DAMAGED", state: "damaged", at: Math.max(consequenceAt, safeExtractionAt - 1), source: "battlefield", cause: consequence?.cause ?? "Battlefield damage" },
        { label: "EXTRACTED", state: "extracted", at: safeCompleteAt, source: "operation", cause: "Cleared extraction while damaged" },
      ]);
      return { ...shared, fate: "damaged", label: "DAMAGED", battleLabel: "DAMAGED", at: consequenceAt, history, detail: consequence?.cause ? `Extracted after ${consequence.cause}.` : "Extracted but no longer combat-ready." };
    }
    const history = withHistory([{ label: "EXTRACTED", state: "extracted", at: safeCompleteAt, source: "operation", cause: "Cleared extraction" }]);
    return { ...shared, fate: "extracted", label: "EXTRACTED", battleLabel: "EXTRACTED", at: safeCompleteAt, history, detail: "Cleared the operation and remains available." };
  });
};

export const seriousConditionsFromConsequences = ({ clashes = [], battleTime = 0 } = {}) => {
  const consequences = battlefieldConsequencesAt({ clashes, battleTime });
  const conditions = {};
  let missingAssigned = false;

  [...consequences.active]
    .sort((left, right) => right.severity - left.severity || left.formationId.localeCompare(right.formationId))
    .forEach((consequence) => {
      if (consequence.state !== "damaged" && consequence.state !== "cut-off") return;
      const becomesMissing = consequence.state === "cut-off" && !missingAssigned;
      const state = becomesMissing ? "missing" : "damaged";
      if (becomesMissing) missingAssigned = true;
      conditions[consequence.formationId] = {
        state,
        ...CAMPAIGN_STATES[state],
        cause: consequence.cause,
      };
    });

  return conditions;
};

export const mergeCampaignConditions = (existing = {}, incoming = {}) => {
  const merged = copyConditions(existing);
  Object.entries(copyConditions(incoming)).forEach(([formationId, condition]) => {
    const current = merged[formationId];
    if (!current || condition.severity >= current.severity) merged[formationId] = condition;
  });
  return merged;
};

export const ensureCostlyContinuationConditions = (conditions = {}, formationIds = []) => {
  const validIds = [...new Set(formationIds.filter((formationId) => typeof formationId === "string" && formationId.length > 0))];
  const validIdSet = new Set(validIds);
  const nextConditions = copyConditions(Object.fromEntries(
    Object.entries(conditions).filter(([formationId]) => validIdSet.has(formationId)),
  ));
  if (validIds.length === 0) return nextConditions;

  if (!Object.values(nextConditions).some((condition) => condition.state === "missing")) {
    const promotedId = [...validIds].reverse().find((formationId) => nextConditions[formationId]?.state === "damaged")
      ?? validIds.at(-1);
    nextConditions[promotedId] = {
      state: "missing",
      ...CAMPAIGN_STATES.missing,
      cause: "COSTLY WITHDRAWAL",
    };
  }

  if (!Object.values(nextConditions).some((condition) => condition.state === "damaged")) {
    const damagedId = [...validIds].reverse().find((formationId) => nextConditions[formationId]?.state !== "missing");
    if (damagedId) {
      nextConditions[damagedId] = {
        state: "damaged",
        ...CAMPAIGN_STATES.damaged,
        cause: "COSTLY WITHDRAWAL",
      };
    }
  }

  return nextConditions;
};

export const applyCampaignConditions = (formations = [], conditions = {}) => formations.map((formation) => {
  const condition = CAMPAIGN_STATES[conditions[formation.id]?.state]
    ? { ...conditions[formation.id], ...CAMPAIGN_STATES[conditions[formation.id].state] }
    : null;
  if (!condition) return { ...formation, available: true, campaignCondition: null, disabledCapability: null };
  if (condition.state === "missing") {
    return { ...formation, available: false, campaignCondition: condition, disabledCapability: null, capabilities: [] };
  }
  const disabledCapability = formation.capabilities.at(-1) ?? null;
  return {
    ...formation,
    available: true,
    campaignCondition: condition,
    disabledCapability,
    capabilities: disabledCapability ? formation.capabilities.slice(0, -1) : formation.capabilities,
  };
});

export const applyWorkshopAction = ({ refits = {}, conditions = {}, action = null, catalog = [] } = {}) => {
  const nextRefits = { ...refits };
  const nextConditions = copyConditions(conditions);
  if (!action || !["repair", "recover", "refit"].includes(action.type)) {
    return { refits: nextRefits, conditions: nextConditions, applied: false };
  }

  const formation = catalog.find((item) => item.id === action.formationId);
  if (!formation) return { refits: nextRefits, conditions: nextConditions, applied: false };

  if (action.type === "repair" && nextConditions[formation.id]?.state === "damaged") {
    delete nextConditions[formation.id];
    return { refits: nextRefits, conditions: nextConditions, applied: true };
  }
  if (action.type === "recover" && nextConditions[formation.id]?.state === "missing") {
    delete nextConditions[formation.id];
    return { refits: nextRefits, conditions: nextConditions, applied: true };
  }
  if (action.type === "refit" && nextConditions[formation.id]?.state !== "missing") {
    const refit = formation.refits?.find((item) => item.id === action.refitId);
    if (refit && nextRefits[formation.id] !== refit.id) {
      nextRefits[formation.id] = refit.id;
      return { refits: nextRefits, conditions: nextConditions, applied: true };
    }
  }

  return { refits: nextRefits, conditions: nextConditions, applied: false };
};
