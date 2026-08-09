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

export const formationFatesFor = ({
  formations = [],
  formationOrderIds = [],
  extractedCount = 0,
  consequences = {},
  campaignDestroyed = false,
  extractionAt = 0,
  completeAt = extractionAt,
} = {}) => {
  const validFormations = Array.isArray(formations)
    ? formations.filter((formation) => formation && typeof formation.id === "string")
    : [];
  const byId = new Map(validFormations.map((formation) => [formation.id, formation]));
  const orderedIds = [...new Set([
    ...(Array.isArray(formationOrderIds) ? formationOrderIds : []),
    ...validFormations.map((formation) => formation.id),
  ])].filter((formationId) => byId.has(formationId));
  const ordered = orderedIds.map((formationId, orderIndex) => ({
    formation: byId.get(formationId),
    orderIndex,
    consequence: consequences?.[formationId] ?? null,
  }));
  const safeExtractedCount = Math.max(0, Math.min(ordered.length, Math.floor(Number(extractedCount) || 0)));
  const unaccountedCount = ordered.length - safeExtractedCount;
  const exposedFirst = [...ordered].sort((left, right) => {
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

  return ordered.map(({ formation, orderIndex, consequence }) => {
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
