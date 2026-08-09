const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const boundedNumber = (value, fallback, minimum, maximum) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, minimum, maximum) : fallback;
};

const stringList = (value) => Array.isArray(value)
  ? [...new Set(value.filter((item) => typeof item === "string" && item.length > 0))]
  : [];

const ENDURANCE_AXES = Object.freeze(["armor", "cohesion", "mobility"]);

const enduranceFor = (actor, axis) => boundedNumber(actor?.endurance?.[axis], 1, 1, 9);

export const resolveFormationImpact = ({ actor = {}, actorIndex = 0, enemyOrder = {}, impactScale = 0 } = {}) => {
  const requestedAxis = enemyOrder?.pressure?.target;
  const target = ENDURANCE_AXES.includes(requestedAxis) ? requestedAxis : "cohesion";
  const pressureType = typeof enemyOrder?.pressure?.type === "string" ? enemyOrder.pressure.type : "CONTACT";
  const strength = boundedNumber(enemyOrder?.pressure?.strength, 2, 0, 9);
  const starting = enduranceFor(actor, target);
  const safeScale = boundedNumber(impactScale, 0, 0, 2);
  const secondaryScale = Number(actorIndex) > 0 ? 0.75 : 1;
  const rawDamage = safeScale > 0 ? Math.max(1, Math.ceil(strength * safeScale * secondaryScale)) : 0;
  const handoffProtection = rawDamage > 0 && (actor?.inboundReaction || actor?.outboundLink) ? 1 : 0;
  const damage = Math.max(0, rawDamage - handoffProtection);
  const remaining = Math.max(0, starting - damage);
  const seriousHit = damage >= Math.max(2, Math.ceil(starting * 0.5));
  const state = damage <= 0
    ? "momentum"
    : remaining <= 0 && target === "mobility"
      ? "cut-off"
      : target === "armor" && seriousHit
        ? "damaged"
        : target === "cohesion" && seriousHit
          ? "pinned"
          : "delayed";

  return {
    formationId: typeof actor?.formationId === "string" ? actor.formationId : null,
    target,
    pressureType,
    strength,
    starting,
    damage,
    remaining,
    handoffProtection,
    state,
  };
};

const OUTCOMES = Object.freeze({
  decisive: Object.freeze({ label: "DECISIVE", impactScale: 0, routeState: "countered", verdict: "Enemy order broken before it can alter the mission." }),
  checked: Object.freeze({ label: "CHECKED", impactScale: 0.5, routeState: "diverted", verdict: "Enemy order lands only partially; its consequence is halved." }),
  costly: Object.freeze({ label: "COSTLY", impactScale: 1, routeState: "passed", verdict: "The Warhost holds its route, but absorbs the full enemy consequence." }),
  overrun: Object.freeze({ label: "OVERRUN", impactScale: 1.5, routeState: "passed", verdict: "The enemy gains leverage and magnifies its consequence." }),
});

export const resolveTacticalEngagement = ({
  actors = [],
  maneuver = null,
  protocol = null,
  enemyOrder = {},
} = {}) => {
  const validActors = Array.isArray(actors) ? actors.filter(Boolean) : [];
  const requiredCapabilities = stringList(enemyOrder.counterCapabilities);
  const namedCounters = stringList(enemyOrder.counteredBy);
  const actorCapabilities = new Set(validActors.flatMap((actor) => stringList(actor.capabilities)));
  const matchedCapabilities = requiredCapabilities.filter((capability) => actorCapabilities.has(capability));
  const missingCapabilities = requiredCapabilities.filter((capability) => !actorCapabilities.has(capability));
  const readinessScores = validActors.map((actor) => boundedNumber(actor.score, 0, 0, 100));
  const averageReadiness = readinessScores.length > 0
    ? Math.round(readinessScores.reduce((sum, score) => sum + score, 0) / readinessScores.length)
    : 0;
  const counterActorName = [maneuver?.name, protocol?.name].find((name) => namedCounters.includes(name)) ?? null;

  const baseScore = validActors.length > 0 ? 1 : 0;
  const capabilityScore = matchedCapabilities.length * 2;
  const readinessScore = averageReadiness >= 95 ? 2 : averageReadiness >= 80 ? 1 : 0;
  const coordinationScore = validActors.length >= 2 ? 1 : 0;
  const handoffScore = maneuver?.name ? 1 : 0;
  const protocolScore = protocol?.name ? 1 : 0;
  const hardCounterScore = counterActorName ? 2 : 0;
  const playerScore = baseScore + capabilityScore + readinessScore + coordinationScore + handoffScore + protocolScore + hardCounterScore;
  const enemyScore = boundedNumber(enemyOrder.resistance, 8, 1, 20);
  const margin = playerScore - enemyScore;
  const outcome = margin >= 2 ? "decisive" : margin >= 0 ? "checked" : margin >= -2 ? "costly" : "overrun";
  const outcomeMeta = OUTCOMES[outcome];
  const actorImpacts = validActors.map((actor, actorIndex) => resolveFormationImpact({
    actor,
    actorIndex,
    enemyOrder,
    impactScale: outcomeMeta.impactScale,
  }));

  const factors = [
    { id: "capability", label: `CAPABILITY ${matchedCapabilities.length}/${requiredCapabilities.length}`, score: capabilityScore },
    { id: "readiness", label: `READINESS ${averageReadiness}%`, score: readinessScore },
    { id: "coordination", label: validActors.length >= 2 ? "COORDINATED PAIR" : "SINGLE FORMATION", score: coordinationScore },
    { id: "handoff", label: maneuver?.name ? `HANDOFF · ${maneuver.name}` : "NO HANDOFF", score: handoffScore },
    { id: "protocol", label: protocol?.name ? `REFIT · ${protocol.name}` : "NO FIELD REFIT", score: protocolScore },
    { id: "counter", label: counterActorName ? `HARD COUNTER · ${counterActorName}` : "NO HARD COUNTER", score: hardCounterScore },
  ];

  return {
    outcome,
    ...outcomeMeta,
    playerScore,
    enemyScore,
    margin,
    averageReadiness,
    matchedCapabilities,
    missingCapabilities,
    counterActorName,
    factors,
    actorIds: validActors.map((actor) => actor.formationId).filter(Boolean),
    actorImpacts,
  };
};
