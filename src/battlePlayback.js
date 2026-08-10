const BEAT_PRIORITY = {
  brief: 0,
  doctrine: 1,
  "enemy-intent": 2,
  contact: 3,
  response: 4,
  result: 5,
  mission: 6,
  reinforcement: 7,
  intercept: 8,
  fate: 9,
  complete: 10,
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const orderedFormationIds = (handoffs, formations) => {
  const ids = [];
  const remember = (id) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  handoffs.forEach((handoff) => {
    remember(handoff?.sourceId);
    remember(handoff?.receiverId);
  });
  formations.forEach((formation) => remember(formation?.id));
  return ids;
};

const formationName = (formations, id, fallback) => formations.find((formation) => formation.id === id)?.name ?? fallback;

export const buildDoctrineSignatureBeats = ({ playbookId, profile, handoffs = [], formations = [] }) => {
  if (!profile?.doctrine || !["trapline", "spear", "pressure"].includes(playbookId)) return [];

  const ids = orderedFormationIds(handoffs, formations);
  const first = formationName(formations, ids[0], "Lead formation");
  const second = formationName(formations, ids[1], "Support formation");
  const outcome = profile.doctrine.result;
  const shared = {
    kind: "doctrine",
    routeState: profile.doctrine.triggered ? "doctrine-active" : "doctrine-exposed",
  };

  if (playbookId === "trapline") {
    const playerFormationIds = ids.slice(0, 2);
    return [
      { ...shared, id: "doctrine-trigger", at: 5, doctrinePhase: "player-play", eyebrow: "PLAYER PLAY · TRIGGER", title: "OVERLAPPING FIRES opens two separated lanes.", detail: "The play deliberately leaves a crossing that appears vulnerable.", playerFormationIds },
      { ...shared, id: "doctrine-field-change", at: 10, doctrinePhase: "field-change", eyebrow: "BATTLEFIELD CHANGE", title: `${first} and ${second} close the kill box.`, detail: "Both authored routes now threaten the same contact window.", playerFormationIds },
      { ...shared, id: "doctrine-counter", at: 15, doctrinePhase: "enemy-counter", eyebrow: "OPPOSING FORCE · INTERCEPTION", title: "E1 cuts between the paired routes.", detail: "The enemy draws a counter-line through the apparent opening.", playerFormationIds, enemyFormationIndex: 0, enemyFormationIndices: [0] },
      { ...shared, id: "doctrine-outcome", at: 20, doctrinePhase: "outcome", eyebrow: "PLAN COLLISION · RESULT", title: profile.doctrine.triggered ? "The counter-route enters the trap and collapses." : "The enemy crosses before the trap closes.", detail: outcome, playerFormationIds, enemyFormationIndex: 0, enemyFormationIndices: [0] },
    ];
  }

  if (playbookId === "spear") {
    const playerFormationIds = ids.slice(0, 4);
    return [
      { ...shared, id: "doctrine-trigger", at: 5, doctrinePhase: "player-play", eyebrow: "PLAYER PLAY · TRIGGER", title: "DECISIVE THRUST locks the force into one armored column.", detail: "Four routes compress around the lead formation.", playerFormationIds },
      { ...shared, id: "doctrine-field-change", at: 10, doctrinePhase: "field-change", eyebrow: "BATTLEFIELD CHANGE", title: "The column punches a direct lane to the primary objective.", detail: "Protection concentrates at the front; the recovery lane is left behind.", playerFormationIds },
      { ...shared, id: "doctrine-counter", at: 15, doctrinePhase: "enemy-counter", eyebrow: "OPPOSING FORCE · INTERCEPTION", title: "E1 blocks the thrust while E2 turns onto the exposed rear.", detail: "Two enemy counter-lines appear: one to stop the spearhead, one to sever extraction.", playerFormationIds, enemyFormationIndex: 0, enemyFormationIndices: [0, 1] },
      { ...shared, id: "doctrine-outcome", at: 20, doctrinePhase: "outcome", eyebrow: "PLAN COLLISION · BENEFIT / COST", title: "The spearhead breaks through; the rear guard must recover under pursuit.", detail: outcome, playerFormationIds, enemyFormationIndex: 1, enemyFormationIndices: [0, 1] },
    ];
  }

  const playerFormationIds = ids.slice(0, 4);
  return [
    { ...shared, id: "doctrine-trigger", at: 5, doctrinePhase: "player-play", eyebrow: "PLAYER PLAY · TRIGGER", title: "TWO-AXIS ASSAULT splits the force at deployment.", detail: "One wing commits to Alpha while the other drives on Beta.", playerFormationIds },
    { ...shared, id: "doctrine-field-change", at: 10, doctrinePhase: "field-change", eyebrow: "BATTLEFIELD CHANGE", title: "Both control nodes are threatened at the same time.", detail: "The enemy must answer two advancing routes before they converge.", playerFormationIds },
    { ...shared, id: "doctrine-counter", at: 15, doctrinePhase: "enemy-counter", eyebrow: "OPPOSING FORCE · INTERCEPTION", title: "E1 screens Alpha while E2 drives between the split wings.", detail: "The opposing plan tries to prevent the rendezvous rather than defend one node.", playerFormationIds, enemyFormationIndex: 1, enemyFormationIndices: [0, 1] },
    { ...shared, id: "doctrine-outcome", at: 20, doctrinePhase: "outcome", eyebrow: "PLAN COLLISION · RESULT", title: profile.doctrine.triggered ? "The two wings link and collapse onto the center." : "The wings take ground but fail to regroup cleanly.", detail: outcome, playerFormationIds, enemyFormationIndex: 1, enemyFormationIndices: [0, 1] },
  ];
};

export const playbackIndexAfterStep = (current, delta, length) => {
  if (length <= 0) return 0;
  return clamp(current + delta, 0, length - 1);
};

export const playbackTimeForIndex = (beats, index) => {
  if (beats.length === 0) return 0;
  return beats[clamp(index, 0, beats.length - 1)].at;
};

export const buildBattlePlayback = ({
  operation,
  playbookId,
  profile,
  handoffs,
  formations,
  events,
  comboTimes,
  formationFates = [],
  reinforcementWave = null,
}) => {
  const beats = [];
  const addBeat = (beat) => beats.push({
    enemyFormationIndex: null,
    enemyFormationIndices: [],
    playerFormationIds: [],
    routeState: null,
    doctrinePhase: null,
    reinforcementFocus: false,
    resolution: null,
    ...beat,
  });

  addBeat({
    id: "plans-locked",
    at: 0,
    kind: "brief",
    eyebrow: "BATTLE PLANS LOCKED",
    title: `${operation.shortName}: both commands are in motion.`,
    detail: "No direct orders remain. Watch the authored routes meet, react, and change.",
  });

  buildDoctrineSignatureBeats({ playbookId, profile, handoffs, formations }).forEach(addBeat);

  const enemyEventTexts = new Set(profile.enemyClashes.map((clash) => clash.eventText));
  events
    .filter((event) => !enemyEventTexts.has(event.text)
      && event.at < profile.completeAt
      && !(profile.overrun > 0 && reinforcementWave && event.at === reinforcementWave.arrivalAt && event.text.includes(reinforcementWave.name)))
    .forEach((event, index) => {
      addBeat({
        id: `mission-${event.at}-${index}`,
        at: event.at,
        kind: "mission",
        eyebrow: "WARHOST ADVANCE",
        title: event.text,
        detail: "The player playbook advances to its next authored action.",
      });
    });

  handoffs.forEach((handoff) => {
    if (!handoff.maneuver) return;
    const source = formations.find((formation) => formation.id === handoff.sourceId);
    const receiver = formations.find((formation) => formation.id === handoff.receiverId);
    addBeat({
      id: `response-${handoff.id}`,
      at: comboTimes[handoff.from] ?? 0,
      kind: "response",
      eyebrow: "AUTOMATIC RESPONSE",
      title: `${source?.name ?? "Formation"} hands off to ${receiver?.name ?? "formation"}.`,
      detail: `${handoff.maneuver.passes} triggers ${handoff.maneuver.name}: ${handoff.maneuver.result}.`,
      playerFormationIds: [handoff.sourceId, handoff.receiverId].filter(Boolean),
      routeState: "response",
    });
  });

  profile.enemyClashes.forEach((clash, enemyFormationIndex) => {
    const statusChanges = formationFates.flatMap((formationFate) => (formationFate.history ?? [])
      .filter((historyItem) => historyItem.source === "collision" && historyItem.at === clash.actionAt)
      .map((historyItem) => ({
        formationId: formationFate.formationId,
        formationName: formationFate.formation?.name ?? formationFate.formationId,
        ...historyItem,
      })));
    addBeat({
      id: `enemy-intent-${clash.id}`,
      at: Math.max(5, clash.actionAt - 15),
      kind: "enemy-intent",
      eyebrow: `ENEMY INTENT · E${enemyFormationIndex + 1}`,
      title: clash.label,
      detail: `${clash.uses ? `Uses ${clash.uses}. ` : ""}Attempts to create ${clash.creates}. Resistance ${clash.resistance}; answer with ${(clash.counterCapabilities ?? []).join(" / ")}.`,
      enemyFormationIndex,
      routeState: "intent",
    });

    if (enemyFormationIndex === 0 && profile.enemyCollision?.revealed) {
      addBeat({
        id: "first-plan-contact",
        at: Math.max(5, clash.actionAt - 5),
        kind: "contact",
        eyebrow: "PLANS COLLIDE · STOP 01/02",
        title: profile.enemyCollision.title,
        detail: profile.enemyCollision.actorName
          ? `${profile.enemyCollision.actorName} meets the enemy order inside the contact window.`
          : "The enemy order crosses the contact window before an automatic response can fire.",
        enemyFormationIndex,
        playerFormationIds: [profile.enemyCollision.sourceId, profile.enemyCollision.receiverId].filter(Boolean),
        routeState: profile.enemyCollision.outcome,
      });
    }

    addBeat({
      id: `enemy-result-${clash.id}`,
      at: clash.actionAt,
      kind: "result",
      eyebrow: `COLLISION RESULT · E${enemyFormationIndex + 1}`,
      title: clash.resultText,
      detail: clash.eventText,
      enemyFormationIndex,
      playerFormationIds: clash.resolution?.actorIds?.length > 0
        ? clash.resolution.actorIds
        : enemyFormationIndex === 0
          ? [profile.enemyCollision?.sourceId, profile.enemyCollision?.receiverId].filter(Boolean)
          : [],
      routeState: clash.routeState,
      resolution: clash.resolution ?? null,
      statusChanges,
    });
  });

  if (profile.overrun > 0 && reinforcementWave?.name && Number.isFinite(reinforcementWave.arrivalAt)) {
    const exposedFates = formationFates.filter((formationFate) => formationFate?.fate && formationFate.fate !== "extracted");
    const exposedIds = exposedFates.map((formationFate) => formationFate.formationId).filter(Boolean);
    const exposedNames = exposedFates.map((formationFate) => formationFate.formation?.name).filter(Boolean);
    const pursuitIndex = profile.enemyClashes.findIndex((clash) => !clash.disrupted && (clash.creates === "CUT OFF" || clash.pressure?.type === "PURSUIT"));
    const approachLead = Math.max(8, Math.min(20, Math.floor((reinforcementWave.approachDuration ?? 30) / 2)));

    addBeat({
      id: "reinforcement-approach",
      at: Math.max(0, reinforcementWave.arrivalAt - approachLead),
      kind: "reinforcement",
      eyebrow: "LATE ENEMY WAVE · EXTRACTION THREAT",
      title: `${reinforcementWave.name} is still moving on extraction.`,
      detail: "The main objective is won, but the opposing force is not destroyed. A surviving relief column is closing on the withdrawal route.",
      playerFormationIds: exposedIds,
      enemyFormationIndex: pursuitIndex >= 0 ? pursuitIndex : null,
      enemyFormationIndices: pursuitIndex >= 0 ? [pursuitIndex] : [],
      reinforcementFocus: true,
      routeState: "wave-approach",
    });

    addBeat({
      id: "extraction-intercept",
      at: reinforcementWave.arrivalAt,
      kind: "intercept",
      eyebrow: "EXTRACTION INTERCEPT · ENEMY SURVIVORS",
      title: `${reinforcementWave.name} reaches the gantry before the Warhost clears.`,
      detail: `${profile.overrun} seconds remain in the intercept window${exposedNames.length > 0 ? `; ${exposedNames.join(", ")} are still exposed` : ""}.`,
      playerFormationIds: exposedIds,
      enemyFormationIndex: pursuitIndex >= 0 ? pursuitIndex : null,
      enemyFormationIndices: pursuitIndex >= 0 ? [pursuitIndex] : [],
      reinforcementFocus: true,
      routeState: "intercept",
    });
  }

  formationFates
    .filter((formationFate) => formationFate?.fate && formationFate.fate !== "extracted")
    .forEach((formationFate) => {
      const name = formationFate.formation?.name ?? "Formation";
      const extractionHistory = (formationFate.history ?? []).find((historyItem) => historyItem.source === "extraction");
      const namedEnemyIndex = extractionHistory
        ? profile.enemyClashes.findIndex((clash) => extractionHistory.cause?.toUpperCase().includes(clash.label?.toUpperCase()))
        : -1;
      const pursuitEnemyIndex = profile.enemyClashes.findIndex((clash) => !clash.disrupted && (clash.creates === "CUT OFF" || clash.pressure?.type === "PURSUIT"));
      const responsibleEnemyIndex = namedEnemyIndex >= 0 ? namedEnemyIndex : pursuitEnemyIndex;
      const responsibleEnemyLabel = profile.enemyClashes[responsibleEnemyIndex]?.label ?? extractionHistory?.cause;
      const titles = {
        damaged: `${name} takes lasting damage.`,
        missing: `${name} is cut off from the Warhost.`,
        destroyed: `${name} is destroyed before extraction.`,
      };
      addBeat({
        id: `formation-fate-${formationFate.formationId}`,
        at: formationFate.at,
        kind: "fate",
        eyebrow: extractionHistory
          ? `PURSUIT RESULT · ${responsibleEnemyLabel}`
          : `FORMATION FATE · SLOT ${String(formationFate.orderIndex + 1).padStart(2, "0")}`,
        title: titles[formationFate.fate] ?? `${name}: ${formationFate.battleLabel}.`,
        detail: formationFate.detail,
        playerFormationIds: [formationFate.formationId],
        enemyFormationIndex: responsibleEnemyIndex >= 0 ? responsibleEnemyIndex : null,
        enemyFormationIndices: responsibleEnemyIndex >= 0 ? [responsibleEnemyIndex] : [],
        reinforcementFocus: Boolean(extractionHistory),
        routeState: `fate-${formationFate.fate}`,
        formationFate,
        statusChanges: extractionHistory ? [{
          formationId: formationFate.formationId,
          formationName: name,
          ...extractionHistory,
        }] : [],
      });
    });

  addBeat({
    id: "operation-resolved",
    at: profile.completeAt,
    kind: "complete",
    eyebrow: "OPERATION RESOLVED",
    title: `${profile.extractedCount} formations clear the operation.`,
    detail: "The complete plan remains on the field for inspection and replay.",
  });

  return beats
    .map((beat, insertionOrder) => ({ ...beat, insertionOrder }))
    .sort((left, right) => left.at - right.at
      || BEAT_PRIORITY[left.kind] - BEAT_PRIORITY[right.kind]
      || left.insertionOrder - right.insertionOrder)
    .map(({ insertionOrder, ...beat }) => beat);
};
