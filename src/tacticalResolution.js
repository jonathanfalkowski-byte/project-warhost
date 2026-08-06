const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const boundedNumber = (value, fallback, minimum, maximum) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, minimum, maximum) : fallback;
};

const stringList = (value) => Array.isArray(value)
  ? [...new Set(value.filter((item) => typeof item === "string" && item.length > 0))]
  : [];

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
  };
};

