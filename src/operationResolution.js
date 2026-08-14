import { resolveAshenCollision } from "./enemyCollision.js";
import { enemyPlanFor } from "./enemyPlanData.js";
import { resolveExtractionOutcome } from "./extractionResolution.js";
import { playbookTimingForPressure } from "./missionPressure.js";
import {
  BASE_OPERATION,
  breakpointImpactsFor,
  breakpointsFor,
  reinforcementWaveFor,
  roleDemandsFor,
} from "./operationData.js";
import { PLAYBOOKS } from "./playbookData.js";
import { resolvePlaybookDoctrine } from "./playbookDoctrine.js";
import { ASHEN_REFIT_PROTOCOLS, TACTICAL_REACTIONS } from "./tacticalReactionData.js";
import { resolveTacticalEngagement } from "./tacticalResolution.js";

// The deterministic outcome pipeline: given a playbook, a set of formation
// placements, refits, authored branch choices and a mission pressure, this decides
// what actually happens in the operation. It is pure and free of React so the whole
// outcome space can be swept in tests rather than only played by hand.

// Seconds added to the operation for each demand a staffed formation cannot answer.
// This is the main lever that makes placement matter: with two demands per stop across
// five stops, a badly matched plan can concede far more time than any playbook doctrine
// or mission pressure grants, so the placement puzzle outweighs the choice of play.
const UNMET_DEMAND_SECONDS = 8;

export const evaluateTacticalSequence = (playbook, assignments, formations) => {
  const outputs = {};
  const handoffs = [];
  let previousRole = null;
  let previousFormation = null;
  let carriedCondition = null;

  playbook.roles.forEach((role, index) => {
    const formation = formations.find((item) => item.id === assignments[role.id]);
    if (!formation) {
      outputs[role.id] = null;
      if (previousRole) {
        const routeConnection = playbook.comboWindows?.find((window) => window.from === index - 1 && window.to === index) ?? null;
        handoffs.push({
          id: `${previousRole.id}:${role.id}`,
          from: index - 1,
          to: index,
          sourceId: previousFormation?.id ?? null,
          receiverId: null,
          incomingCondition: carriedCondition,
          routeConnected: Boolean(routeConnection),
          routeConnectionLabel: routeConnection?.label ?? null,
          maneuver: null,
        });
      }
      previousRole = role;
      previousFormation = null;
      carriedCondition = null;
      return;
    }

    const routeConnection = playbook.comboWindows?.find((window) => window.from === index - 1 && window.to === index) ?? null;
    const reaction = routeConnection && previousFormation && carriedCondition && formation.uses.includes(carriedCondition)
      ? TACTICAL_REACTIONS[`${carriedCondition}:${formation.id}`] ?? null
      : null;
    const maneuver = reaction ? { ...reaction, passes: carriedCondition } : null;

    if (previousRole) {
      handoffs.push({
        id: `${previousRole.id}:${role.id}`,
        from: index - 1,
        to: index,
        sourceId: previousFormation?.id ?? null,
        receiverId: formation.id,
        incomingCondition: carriedCondition,
        routeConnected: Boolean(routeConnection),
        routeConnectionLabel: routeConnection?.label ?? null,
        maneuver,
      });
    }

    carriedCondition = maneuver?.result ?? formation.creates;
    outputs[role.id] = {
      creates: formation.creates,
      result: carriedCondition,
      incoming: maneuver,
    };
    previousRole = role;
    previousFormation = formation;
  });

  return { handoffs, outputs };
};

export const calculatePlacementReadiness = (playbook, assignments, handoffs, condition, formations) => Object.fromEntries(
  playbook.roles.map((role, index) => {
    const formationId = assignments[role.id];
    if (!formationId) return [role.id, null];

    const formation = formations.find((item) => item.id === formationId);
    const demands = roleDemandsFor(role, index, condition);
    const matchedCapabilities = demands.filter((demand) => formation.capabilities.includes(demand));
    const inboundReaction = index > 0 && Boolean(handoffs[index - 1]?.maneuver);
    const outboundLink = index < handoffs.length && Boolean(handoffs[index]?.maneuver);
    // Every formation can carry every authored responsibility, so this is never a gate:
    // an unmatched formation still executes the stop, it just takes longer to do it.
    // The cost is graded by how many of the stop's demands go unmet, not a binary
    // FIT / MISMATCH grade and not a flat improvised-assignment penalty.
    const unmetDemands = Math.max(0, demands.length - matchedCapabilities.length);
    const taskDelay = unmetDemands * UNMET_DEMAND_SECONDS;
    const matchRatio = demands.length > 0 ? matchedCapabilities.length / demands.length : 1;
    const score = Math.min(100, Math.round(60 + 20 * matchRatio + (inboundReaction ? 10 : 0) + (outboundLink ? 10 : 0)));
    const label = score >= 95 ? "COORDINATED" : score >= 80 ? "SUPPORTED" : "ASSIGNED";

    return [role.id, {
      formationId: formation.id,
      formationName: formation.name,
      refitName: formation.activeRefit.name,
      capabilities: formation.capabilities,
      endurance: formation.endurance,
      score,
      label,
      taskAligned: unmetDemands === 0,
      taskDelay,
      demands,
      matchedCapabilities,
      roleLabel: role.label,
      stopNumber: index + 1,
      inboundReaction,
      outboundLink,
    }];
  }),
);

export const summarizePlacementReadiness = (readiness) => {
  const staffed = Object.values(readiness).filter(Boolean);
  const totalScore = staffed.reduce((sum, item) => sum + item.score, 0);
  return {
    staffedCount: staffed.length,
    alignedCount: staffed.filter((item) => item.taskAligned).length,
    improvisedCount: staffed.filter((item) => !item.taskAligned).length,
    average: staffed.length > 0 ? Math.round(totalScore / staffed.length) : 0,
    delay: staffed.reduce((sum, item) => sum + (item.taskDelay ?? 0), 0),
    placements: staffed.map(({ formationName, roleLabel, stopNumber, taskAligned, demands, matchedCapabilities, taskDelay }) => ({
      formationName,
      roleLabel,
      stopNumber,
      taskAligned,
      demands,
      matchedCapabilities,
      // Carried so the debrief can state, per stop, which demands went unanswered and
      // what that cost. Placement decides the mission, so the player has to be able to
      // read back why afterwards, even though it stays sealed before commitment.
      taskDelay,
      unansweredDemands: demands.filter((demand) => !matchedCapabilities.includes(demand)),
    })),
  };
};

export const calculateRefitProtocols = (playbook, assignments, formations, operation) => Object.fromEntries(
  playbook.roles.map((role, index) => {
    const formation = formations.find((item) => item.id === assignments[role.id]);
    const protocol = operation?.id === "ashen-passage" && formation
      ? ASHEN_REFIT_PROTOCOLS[formation.activeRefit.id]
      : null;
    return [role.id, protocol ? {
      ...protocol,
      formationId: formation.id,
      formationName: formation.name,
      refitName: formation.activeRefit.name,
      active: protocol.stopIndex === index,
    } : null];
  }),
);

export const calculateEnemyClashes = (operation, handoffs, activeProtocols = [], readiness = {}) => {
  const enemyPlan = enemyPlanFor(operation);
  const staffedRoles = Object.values(readiness);
  const actorWindows = [[0, 1], [2, 3], [4]];
  const handoffWindows = [[0], [1, 2], [3]];
  const resolutionForStage = (stage, stageIndex) => {
    const actorIndices = actorWindows[stageIndex] ?? [];
    const actors = actorIndices.map((index) => staffedRoles[index]).filter(Boolean);
    const maneuver = (handoffWindows[stageIndex] ?? [])
      .map((index) => handoffs[index]?.maneuver)
      .find(Boolean) ?? null;
    const protocol = activeProtocols.find((item) => actorIndices.includes(item.stopIndex)) ?? null;
    return resolveTacticalEngagement({ actors, maneuver, protocol, enemyOrder: stage });
  };
  const starvedResolution = (stage, cause) => ({
    outcome: "starved",
    label: "STARVED",
    impactScale: 0,
    routeState: "starved",
    verdict: cause,
    playerScore: null,
    enemyScore: stage.resistance,
    margin: null,
    factors: [],
    matchedCapabilities: [],
    missingCapabilities: stage.counterCapabilities,
    actorIds: [],
  });
  const baseClash = (stage, overrides = {}) => {
    const stageIndex = enemyPlan.stages.findIndex((item) => item.id === stage.id);
    const resolution = resolutionForStage(stage, stageIndex);
    const counterManeuver = resolution.counterActorName
      ? [...handoffs.map((handoff) => handoff?.maneuver), ...activeProtocols].find((actor) => actor?.name === resolution.counterActorName)
      : null;
    const formation = enemyPlan.formations.find((item) => item.id === stage.formationId);
    const disrupted = resolution.outcome === "decisive";
    const resultText = resolution.outcome === "decisive"
      ? `${counterManeuver?.name ?? "WARHOST PACKAGE"} BREAKS IT · ${resolution.playerScore} / ${resolution.enemyScore}`
      : resolution.outcome === "checked"
        ? `CHECKED · ${resolution.playerScore} / ${resolution.enemyScore} · CONSEQUENCE HALVED`
        : resolution.outcome === "overrun"
          ? `OVERRUN · ${resolution.playerScore} / ${resolution.enemyScore} · CONSEQUENCE MAGNIFIED`
          : `LANDS · ${resolution.playerScore} / ${resolution.enemyScore} · ${stage.consequence}`;
    return {
      ...stage,
      actionAt: formation.actionAt,
      disrupted,
      counterManeuver,
      appliesImpact: resolution.impactScale > 0,
      impactScale: resolution.impactScale,
      routeState: resolution.routeState,
      resolution,
      resultText,
      eventText: disrupted
        ? `${counterManeuver?.name ?? "The assigned Warhost formations"} breaks the Helioch ${stage.label}.`
        : `${stage.label} ${resolution.outcome === "checked" ? "is checked but still alters the route" : "lands"}. ${resolution.verdict}`,
      ...overrides,
    };
  };

  if (operation?.id !== "ashen-passage") return enemyPlan.stages.map((stage) => baseClash(stage));

  const [veilStage, wardStage, liftStage] = enemyPlan.stages;
  const firstHandoff = handoffs[0];
  const firstWindowStaffed = Boolean(firstHandoff?.sourceId && firstHandoff?.receiverId);
  const firstWindowActors = [
    firstHandoff?.maneuver,
    ...activeProtocols.filter((protocol) => protocol.stopIndex <= 1),
  ].filter(Boolean);
  const resolvedCollision = resolveAshenCollision({
    firstWindowStaffed,
    firstManeuverName: firstHandoff?.maneuver?.name ?? null,
    activeProtocolNames: firstWindowActors.filter((actor) => actor !== firstHandoff?.maneuver).map((actor) => actor.name),
    veilCounterNames: veilStage.counteredBy,
    resolutionOutcome: resolutionForStage(veilStage, 0).outcome,
  });
  const collisionOutcome = resolvedCollision.outcome;
  const trapActor = firstWindowActors.find((actor) => actor.name === resolvedCollision.actorName);
  const collision = {
    revealed: firstWindowStaffed,
    outcome: collisionOutcome,
    actorName: resolvedCollision.actorName,
    sourceId: firstHandoff?.sourceId ?? null,
    receiverId: firstHandoff?.receiverId ?? null,
    title: collisionOutcome === "trapped"
      ? "VEIL TRAPPED AT THE GATE"
      : collisionOutcome === "diverted"
        ? "VEIL DIVERTED TO THE RELAY"
        : collisionOutcome === "passed"
          ? "VEIL PASSES THE CONTACT WINDOW"
          : "COLLISION WINDOW UNRESOLVED",
    summary: collisionOutcome === "trapped"
      ? "The first player combo catches the Veil Engines. Their created condition never reaches the Oath Ward."
      : collisionOutcome === "diverted"
        ? "The first player combo cannot stop the Veil Engines, but forces them and the Oath Ward toward the Signal Furnace."
        : collisionOutcome === "passed"
          ? "No reaction fires between Stop 01 and Stop 02. BLINDED CORRIDOR feeds the Oath Ward's next order."
          : "Staff Stop 01 and Stop 02 to reveal how the two plans collide.",
  };

  let veilClash;
  let wardClash;
  let liftClash;

  if (collisionOutcome === "trapped") {
    veilClash = baseClash(veilStage, {
      disrupted: true,
      counterManeuver: trapActor,
      appliesImpact: false,
      routeState: "trapped",
      creates: "VEIL TRAPPED",
      resultText: `${trapActor.name} TRAPS IT AT CONTACT`,
      eventText: `${trapActor.name} traps the Veil Engines at the first gate. The enemy chain is starved.`,
      collision,
    });
    wardClash = baseClash(wardStage, {
      disrupted: true,
      counterManeuver: { name: "VEIL TRAPPED" },
      appliesImpact: false,
      routeState: "starved",
      uses: "NO INCOMING CONDITION",
      creates: "WARD STALLED",
      resultText: "STARVED · NO BLINDED CORRIDOR",
      eventText: "The Oath Ward stalls without a blinded corridor to exploit.",
      resolution: starvedResolution(wardStage, "The upstream enemy condition never arrived."),
    });
    liftClash = baseClash(liftStage, {
      disrupted: true,
      counterManeuver: { name: "ENEMY CHAIN STARVED" },
      appliesImpact: false,
      routeState: "starved",
      uses: "NO RELAY LOCK",
      creates: "LIFT OPEN",
      resultText: "STARVED · NO RELAY LOCK",
      eventText: "Lift Occupation never forms; the upstream enemy chain was broken.",
      resolution: starvedResolution(liftStage, "The upstream enemy chain was broken."),
    });
  } else if (collisionOutcome === "diverted") {
    veilClash = baseClash(veilStage, {
      disrupted: false,
      counterManeuver: null,
      appliesImpact: true,
      routeState: "diverted",
      label: "VEIL DIVERSION",
      creates: "DIVERTED VEIL",
      consequence: "Signal Furnace pressured +00:15",
      resultText: `${firstHandoff.maneuver.name} DIVERTS IT TO RELAY`,
      eventText: `${firstHandoff.maneuver.name} diverts the Veil Engines toward the Signal Furnace.`,
      collision,
    });
    const redirectedWard = {
      ...wardStage,
      label: "RELAY PURSUIT",
      uses: "DIVERTED VEIL",
      creates: "ASH PRESSURE",
      impact: { reactorDelay: 15 },
      consequence: "Signal Furnace hold delayed +00:15",
    };
    wardClash = baseClash(redirectedWard);
    wardClash = {
      ...wardClash,
      routeState: wardClash.disrupted ? "countered" : "redirected",
      resultText: wardClash.disrupted ? `${wardClash.counterManeuver.name} BREAKS THE PURSUIT` : "REROUTES · PRESSURES SIGNAL FURNACE",
      eventText: wardClash.disrupted
        ? `${wardClash.counterManeuver.name} breaks the Oath Ward's relay pursuit.`
        : "The Oath Ward abandons its furnace-silence route and pursues the diverted Veil toward the relay.",
    };
    liftClash = baseClash(liftStage, {
      disrupted: true,
      counterManeuver: { name: "RELAY LOCK NEVER CREATED" },
      appliesImpact: false,
      routeState: "starved",
      uses: "NO RELAY LOCK",
      creates: "LIFT OPEN",
      resultText: "STARVED · ENEMY ROUTE LEFT THE LIFT",
      eventText: "Lift Occupation is abandoned while the enemy play converges on the Signal Furnace.",
      resolution: starvedResolution(liftStage, "The opposing route abandoned this collision window."),
    });
  } else {
    veilClash = baseClash(veilStage, {
      disrupted: false,
      counterManeuver: null,
      appliesImpact: true,
      routeState: "passed",
      resultText: collisionOutcome === "unread" ? "OUTCOME UNREAD" : "PASSES · CREATES BLINDED CORRIDOR",
      eventText: "The Veil Engines pass the first contact window and blind the eastern corridor.",
      collision,
    });
    wardClash = baseClash(wardStage);
    liftClash = wardClash.disrupted
      ? baseClash(liftStage, {
        disrupted: true,
        counterManeuver: { name: "RELAY LOCK BROKEN UPSTREAM" },
        appliesImpact: false,
        routeState: "starved",
        uses: "NO RELAY LOCK",
        creates: "LIFT OPEN",
        resultText: "STARVED · RELAY LOCK BROKEN",
        eventText: "Lift Occupation cannot form after the Oath Ward's relay lock is broken.",
        resolution: starvedResolution(liftStage, "The required RELAY LOCK was broken upstream."),
      })
      : baseClash(liftStage);
  }

  return [veilClash, wardClash, liftClash];
};

export const calculateOperationProfile = (handoffs, branchChoices, readiness, condition, operation, refitProtocols = {}, playbook = PLAYBOOKS[0]) => {
  const maneuvers = handoffs.filter((handoff) => handoff.maneuver).map((handoff) => handoff.maneuver);
  const activeProtocols = Object.values(refitProtocols).filter((protocol) => protocol?.active);
  const doctrine = resolvePlaybookDoctrine(playbook.id, handoffs);
  const baseReadinessSummary = summarizePlacementReadiness(readiness);
  const total = (key) => maneuvers.reduce((sum, maneuver) => sum + (maneuver.impact[key] ?? 0), 0);
  const protocolTotal = (key) => activeProtocols.reduce((sum, protocol) => sum + (protocol.impact[key] ?? 0), 0);
  const protocolDelayReduction = Math.min(baseReadinessSummary.delay, protocolTotal("delayReduction"));
  const readinessSummary = {
    ...baseReadinessSummary,
    rawDelay: baseReadinessSummary.delay,
    protocolDelayReduction,
    delay: Math.max(0, baseReadinessSummary.delay - protocolDelayReduction),
  };
  const enemyClashes = calculateEnemyClashes(operation, handoffs, activeProtocols, readiness);
  const enemyTotal = (key) => Math.round(enemyClashes.reduce((sum, clash) => sum + (clash.appliesImpact ? (clash.impact[key] ?? 0) * (clash.impactScale ?? 1) : 0), 0));
  const breakpoints = breakpointsFor(operation);
  const breakpointImpacts = breakpointImpactsFor(operation);
  const branchEffects = breakpoints.map((breakpoint) => {
    const optionId = branchChoices[breakpoint.id] ?? breakpoint.defaultOption;
    return {
      id: breakpoint.id,
      option: breakpoint.options.find((item) => item.id === optionId),
      impact: breakpointImpacts[breakpoint.id][optionId],
    };
  });
  const branchTotal = (key) => branchEffects.reduce((sum, branch) => sum + (branch.impact[key] ?? 0), 0);
  const pressureTiming = playbookTimingForPressure(condition, playbook.id);
  const reinforcementWave = reinforcementWaveFor(operation, condition);
  const alphaAt = Math.max(30, BASE_OPERATION.alphaAt - total("alpha") - protocolTotal("alpha") - doctrine.impact.alpha);
  const betaAt = Math.max(alphaAt + 45, BASE_OPERATION.betaAt - total("beta") - protocolTotal("beta") - doctrine.impact.beta);
  const betaDecisionAt = Math.max(alphaAt + 15, betaAt - 45);
  const reactorAt = Math.max(betaAt + 60, BASE_OPERATION.reactorAt - total("reactor") - protocolTotal("reactor") - doctrine.impact.reactor + branchTotal("reactorDelay") + enemyTotal("reactorDelay"));
  const reactorExposeAt = Math.max(betaAt + 30, reactorAt - 45);
  const rescueDecisionAt = Math.max(betaAt + 30, Math.min(210, reactorExposeAt - 15));
  const extractionAt = Math.max(
    reactorAt + 30,
    BASE_OPERATION.extractionAt - total("extraction") - protocolTotal("extraction") - doctrine.impact.extraction
      + branchTotal("missionDelay") + enemyTotal("missionDelay") + readinessSummary.delay + doctrine.impact.missionDelay + pressureTiming,
  );
  const completeAt = extractionAt + 15;
  const overrun = Math.max(0, completeAt - reinforcementWave.arrivalAt);
  const protectedCount = total("protects") + protocolTotal("protects") + branchTotal("protects") + doctrine.impact.protects;
  const rawEnemyRecoveryLoss = Math.ceil(enemyTotal("recoveryLoss"));
  const recoveryRoleProtection = Object.values(readiness).find((placement) => (
    placement?.demands.includes("RECOVERY") && placement.capabilities.includes("RECOVERY")
  )) ?? null;
  const recoveryLossPrevented = recoveryRoleProtection && rawEnemyRecoveryLoss > 0 ? 1 : 0;
  const enemyRecoveryLoss = Math.max(0, rawEnemyRecoveryLoss - recoveryLossPrevented);
  const deployedCount = readinessSummary.staffedCount;
  const extraction = resolveExtractionOutcome({
    deployedCount,
    requiredExtraction: operation?.requiredExtraction,
    protectedCount,
    overrun,
    recoveryLoss: enemyRecoveryLoss,
  });
  const { extractedCount, reserveCapacity, waveLoss: reinforcementLoss } = extraction;

  return {
    alphaAt,
    betaAt,
    betaDecisionAt,
    rescueDecisionAt,
    reactorExposeAt,
    reactorAt,
    extractionAt,
    completeAt,
    extractedCount,
    reserveCapacity,
    timeSaved: Math.max(0, reinforcementWave.arrivalAt - completeAt),
    overrun,
    pressureTiming,
    reinforcementLoss,
    rawEnemyRecoveryLoss,
    enemyRecoveryLoss,
    recoveryLossPrevented,
    recoveryRoleProtection,
    enemyClashes,
    enemyCollision: enemyClashes[0]?.collision ?? null,
    branchEffects,
    readiness: readinessSummary,
    condition,
    effects: maneuvers,
    protocols: activeProtocols,
    doctrine,
  };
};

export const comboWindowTimes = (profile) => [
  profile.alphaAt,
  profile.betaAt,
  profile.reactorExposeAt,
  profile.extractionAt,
];

export const buildOperationEvents = (profile, operation) => {
  const reinforcementWave = reinforcementWaveFor(operation, profile.condition);
  const maneuverFor = (phase) => profile.effects.find((maneuver) => maneuver.impact.phase === phase)?.name;
  const alphaManeuver = maneuverFor("alpha");
  const betaManeuver = maneuverFor("beta");
  const reactorManeuver = maneuverFor("reactor");
  const extractionManeuver = profile.effects.find((maneuver) => maneuver.impact.extraction)?.name ?? maneuverFor("extraction");

  const events = [
    { at: 30, text: "Forward role has contact. Playbook in motion." },
    { at: profile.alphaAt, text: alphaManeuver ? `${alphaManeuver} secures Control Node Alpha.` : "Control Node Alpha seized under direct pressure." },
    { at: profile.betaDecisionAt, text: operation.firstDecisionEvent },
    { at: profile.betaAt, text: betaManeuver ? `${betaManeuver} seals Control Node Beta.` : "Control Node Beta seized under pressure." },
    { at: profile.rescueDecisionAt, text: operation.secondDecisionEvent },
    { at: profile.reactorExposeAt, text: reactorManeuver ? `${reactorManeuver} opens the approach to ${operation.primaryTitle}.` : operation.primaryApproachEvent },
    { at: profile.reactorAt, text: operation.primaryEvent },
    { at: profile.extractionAt, text: extractionManeuver ? `${extractionManeuver}: ${profile.extractedCount} formations crossing the gantry.` : `${profile.extractedCount} formations crossing the ${operation.extractionTitle}.` },
  ];
  profile.enemyClashes.forEach((clash) => {
    events.push({
      at: clash.actionAt,
      text: clash.eventText,
    });
  });
  if (profile.overrun > 0) events.push({ at: reinforcementWave.arrivalAt, text: `${reinforcementWave.name} reaches the ${operation.extractionTitle}. ${profile.reinforcementLoss} formation recovery lost.` });
  return events.sort((left, right) => left.at - right.at);
};
