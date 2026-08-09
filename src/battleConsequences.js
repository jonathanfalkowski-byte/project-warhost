const PLAYER_STATES = Object.freeze({
  momentum: Object.freeze({ label: "MOMENTUM", severity: 1 }),
  delayed: Object.freeze({ label: "DELAYED", severity: 2 }),
  pinned: Object.freeze({ label: "PINNED", severity: 3 }),
  damaged: Object.freeze({ label: "DAMAGED", severity: 4 }),
  "cut-off": Object.freeze({ label: "CUT OFF", severity: 5 }),
});

const ENEMY_STATES = Object.freeze({
  decisive: Object.freeze({ state: "broken", label: "BROKEN" }),
  checked: Object.freeze({ state: "diverted", label: "DIVERTED" }),
  costly: Object.freeze({ state: "pressing", label: "PRESSING" }),
  overrun: Object.freeze({ state: "breakthrough", label: "BREAKTHROUGH" }),
  starved: Object.freeze({ state: "starved", label: "STARVED" }),
});

const boundedDisplayNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(9, Math.max(0, Math.round(numeric))) : 0;
};

const compactDisplayText = (value, fallback) => typeof value === "string" && value.trim().length > 0
  ? value.trim().toUpperCase().slice(0, 32)
  : fallback;

export const formationStatusDisplay = ({ consequence = null, formationFate = null } = {}) => {
  const label = formationFate?.battleLabel ?? consequence?.label ?? null;
  if (typeof label !== "string" || label.length === 0) return null;
  const combat = consequence?.combat ?? formationFate?.consequence?.combat ?? null;
  if (combat) {
    const pressure = compactDisplayText(combat.pressureType, "CONTACT");
    const target = compactDisplayText(combat.target, "ENDURANCE");
    const starting = boundedDisplayNumber(combat.starting);
    const remaining = boundedDisplayNumber(combat.remaining);
    return {
      label: compactDisplayText(label, "FIELD STATE"),
      detail: `${pressure} · ${target} ${starting}→${remaining}`,
    };
  }
  return {
    label: compactDisplayText(label, "FIELD STATE"),
    detail: compactDisplayText(formationFate?.detail ?? consequence?.cause, "BATTLEFIELD CONDITION"),
  };
};

const playerStateFor = (outcome, actorIndex) => {
  if (outcome === "decisive") return "momentum";
  if (outcome === "checked") return "delayed";
  if (outcome === "costly") return actorIndex === 0 ? "damaged" : "pinned";
  if (outcome === "overrun") return "cut-off";
  return null;
};

const applyPlayerState = (player, formationId, state, cause, at, outcome, combat = null) => {
  if (typeof formationId !== "string" || !PLAYER_STATES[state]) return;
  const next = { state, ...PLAYER_STATES[state], cause, at, outcome, combat };
  const current = player[formationId];
  if (!current || next.severity >= current.severity) player[formationId] = next;
};

export const battlefieldConsequencesAt = ({ clashes = [], battleTime = 0 } = {}) => {
  const player = {};
  const enemy = {};
  const safeTime = Number.isFinite(Number(battleTime)) ? Number(battleTime) : 0;

  if (!Array.isArray(clashes)) return { player, enemy, active: [] };

  clashes.forEach((clash, enemyIndex) => {
    const actionAt = Number(clash?.actionAt);
    const outcome = clash?.resolution?.outcome;
    if (!Number.isFinite(actionAt) || actionAt > safeTime || !ENEMY_STATES[outcome]) return;

    const cause = typeof clash.label === "string" ? clash.label : `ENEMY ORDER E${enemyIndex + 1}`;
    enemy[enemyIndex] = { ...ENEMY_STATES[outcome], cause, at: actionAt, outcome };
    const actorImpacts = Array.isArray(clash?.resolution?.actorImpacts) ? clash.resolution.actorImpacts : [];
    if (actorImpacts.length > 0) {
      actorImpacts.forEach((impact) => {
        const axis = typeof impact?.target === "string" ? impact.target.toUpperCase() : "ENDURANCE";
        const pressure = typeof impact?.pressureType === "string" ? impact.pressureType : "CONTACT";
        const detail = `${cause} · ${pressure} ${axis} ${impact.starting}→${impact.remaining}`;
        applyPlayerState(player, impact?.formationId, impact?.state, detail, actionAt, outcome, impact);
      });
      return;
    }
    const actorIds = Array.isArray(clash?.resolution?.actorIds) ? clash.resolution.actorIds : [];
    actorIds.forEach((formationId, actorIndex) => {
      applyPlayerState(player, formationId, playerStateFor(outcome, actorIndex), cause, actionAt, outcome);
    });
  });

  return {
    player,
    enemy,
    active: Object.entries(player).map(([formationId, consequence]) => ({ formationId, ...consequence })),
  };
};
