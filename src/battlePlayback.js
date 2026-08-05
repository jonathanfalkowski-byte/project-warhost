const BEAT_PRIORITY = {
  brief: 0,
  "enemy-intent": 1,
  contact: 2,
  response: 3,
  result: 4,
  mission: 5,
  complete: 6,
};

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

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
  profile,
  handoffs,
  formations,
  events,
  comboTimes,
}) => {
  const beats = [];
  const addBeat = (beat) => beats.push({
    enemyFormationIndex: null,
    playerFormationIds: [],
    routeState: null,
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

  const enemyEventTexts = new Set(profile.enemyClashes.map((clash) => clash.eventText));
  events
    .filter((event) => !enemyEventTexts.has(event.text) && event.at < profile.completeAt)
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
    addBeat({
      id: `enemy-intent-${clash.id}`,
      at: Math.max(5, clash.actionAt - 15),
      kind: "enemy-intent",
      eyebrow: `ENEMY INTENT · E${enemyFormationIndex + 1}`,
      title: clash.label,
      detail: `${clash.uses ? `Uses ${clash.uses}. ` : ""}Attempts to create ${clash.creates}.`,
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
      playerFormationIds: enemyFormationIndex === 0
        ? [profile.enemyCollision?.sourceId, profile.enemyCollision?.receiverId].filter(Boolean)
        : [],
      routeState: clash.routeState,
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
