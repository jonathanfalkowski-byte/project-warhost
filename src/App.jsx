import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import {
  Anchor,
  ArrowCounterClockwise,
  ArrowRight,
  CheckCircle,
  Crosshair,
  Factory,
  Fire,
  Flag,
  Hammer,
  Lightning,
  MapPin,
  Pause,
  Play,
  Plus,
  Radio,
  Seal,
  Shield,
  Target,
  Truck,
  Warning,
  Wrench,
} from "@phosphor-icons/react";

const FORMATIONS = [
  {
    id: "harpoon",
    number: "1",
    name: "HARPOON RIG",
    role: "DISPLACE",
    purpose: "Pull the Alpha blocker into the kill zone.",
    creates: "DISPLACED",
    uses: ["SCREENED", "SUPPLIED", "FORWARD HOLD"],
    asset: "/assets/harpoon-rig.png",
    icon: Anchor,
    defaultNode: "alphaApproach",
  },
  {
    id: "furnace",
    number: "2",
    name: "FURNACE CREW",
    role: "DENY",
    purpose: "Seal the reinforcement lane with heat.",
    creates: "OVERHEATED",
    uses: ["DISPLACED", "SCREENED", "SUPPLIED", "FORWARD HOLD"],
    asset: "/assets/furnace-crew.png",
    icon: Fire,
    defaultNode: "fireLine",
  },
  {
    id: "breaker",
    number: "3",
    name: "BREAKER EXO",
    role: "BREACH",
    purpose: "Crack the Reactor Spine after Beta falls.",
    creates: "BREACHED",
    uses: ["DISPLACED", "OVERHEATED", "SCREENED", "SUPPLIED", "KILL ZONE", "SEALED LANE"],
    asset: "/assets/breaker-exo.png",
    icon: Hammer,
    defaultNode: "breachLine",
  },
  {
    id: "railjack",
    number: "4",
    name: "RAILJACK",
    role: "HOLD",
    purpose: "Anchor the captured Alpha control node.",
    creates: "SCREENED",
    uses: ["DISPLACED", "OVERHEATED", "BREACHED", "SUPPLIED", "OPEN CORE", "FRACTURED ARMOR"],
    asset: "/assets/railjack.png",
    icon: Shield,
    defaultNode: "anchorLine",
  },
  {
    id: "hauler",
    number: "5",
    name: "SALVAGE HAULER",
    role: "EXTRACT",
    purpose: "Recover the crew and damaged formations.",
    creates: "SUPPLIED",
    uses: ["OVERHEATED", "BREACHED", "SCREENED", "OPEN CORE", "SECURED BREACH", "SECURED CORRIDOR"],
    asset: "/assets/salvage-hauler.png",
    icon: Truck,
    defaultNode: "recoveryLine",
  },
];

const NODES = {
  alphaApproach: { left: 20, top: 63, label: "Alpha approach" },
  fireLine: { left: 31, top: 72, label: "Thermal firing line" },
  breachLine: { left: 44, top: 66, label: "Breach route" },
  anchorLine: { left: 36, top: 82, label: "Anchor line" },
  recoveryLine: { left: 53, top: 80, label: "Recovery route" },
  highWalk: { left: 47, top: 34, label: "Elevated transit" },
  betaLane: { left: 66, top: 28, label: "Beta transit lane" },
  rescuePen: { left: 69, top: 72, label: "Salvage enclosure" },
};

const STAGING_NODES = {
  harpoon: { left: 32, top: 10.5, label: "Formation staging" },
  furnace: { left: 43, top: 10.5, label: "Formation staging" },
  breaker: { left: 54, top: 10.5, label: "Formation staging" },
  railjack: { left: 65, top: 10.5, label: "Formation staging" },
  hauler: { left: 76, top: 10.5, label: "Formation staging" },
};

const PLAYBOOKS = [
  {
    id: "trapline",
    name: "TRAPLINE",
    summary: "Displace, deny, then breach.",
    intent: "Open Alpha by forcing the defender through overlapping fires.",
    icon: Anchor,
    stages: [
      { label: "PULL", detail: "Displace blocker.", icon: Anchor },
      { label: "BURN", detail: "Deny response.", icon: Fire, warm: true },
      { label: "BREAK", detail: "Collapse hold.", icon: Hammer },
    ],
    roles: [
      { id: "pull", label: "PULL / DISPLACER", brief: "Draw Alpha into the kill zone.", node: "alphaApproach", accepts: ["harpoon", "breaker"] },
      { id: "burn", label: "BURN / DENIER", brief: "Seal the hostile response lane.", node: "fireLine", accepts: ["furnace", "railjack"] },
      { id: "break", label: "BREAK / BREACHER", brief: "Exploit the opened route.", node: "breachLine", accepts: ["breaker", "harpoon"] },
      { id: "anchor", label: "ANCHOR", brief: "Hold the captured control node.", node: "anchorLine", accepts: ["railjack", "furnace"] },
      { id: "recover", label: "RECOVERY", brief: "Preserve extraction capacity.", node: "recoveryLine", accepts: ["hauler"] },
    ],
  },
  {
    id: "spear",
    name: "ARMORED SPEAR",
    summary: "Screen, punch through, exploit.",
    intent: "Concentrate protection around one decisive reactor thrust.",
    icon: Shield,
    stages: [
      { label: "SCREEN", detail: "Absorb contact.", icon: Shield },
      { label: "PUNCH", detail: "Rupture Beta.", icon: Hammer, warm: true },
      { label: "EXPLOIT", detail: "Drive on reactor.", icon: Lightning },
    ],
    roles: [
      { id: "screen", label: "SCREEN", brief: "Take first contact at Alpha.", node: "alphaApproach", accepts: ["railjack", "breaker"] },
      { id: "point", label: "POINT", brief: "Mark the narrow transit lane.", node: "highWalk", accepts: ["harpoon", "breaker"] },
      { id: "punch", label: "PUNCH / BREACHER", brief: "Crack Beta and the reactor shell.", node: "breachLine", accepts: ["breaker", "harpoon"] },
      { id: "suppress", label: "SUPPRESSION", brief: "Deny flanking reinforcements.", node: "fireLine", accepts: ["furnace", "railjack"] },
      { id: "recover", label: "RECOVERY", brief: "Follow the armored corridor.", node: "recoveryLine", accepts: ["hauler"] },
    ],
  },
  {
    id: "pressure",
    name: "DIVIDED PRESSURE",
    summary: "Pin both nodes, converge on reactor.",
    intent: "Split the defense at Alpha and Beta, then reunite for the sabotage.",
    icon: Crosshair,
    stages: [
      { label: "PIN", detail: "Fix both guards.", icon: Target },
      { label: "SPLIT", detail: "Open two lanes.", icon: Crosshair, warm: true },
      { label: "CONVERGE", detail: "Collapse on reactor.", icon: Factory },
    ],
    roles: [
      { id: "alpha", label: "ALPHA PIN", brief: "Hold the known defenders in place.", node: "alphaApproach", accepts: ["railjack", "harpoon"] },
      { id: "beta", label: "BETA RAID", brief: "Pressure the uncertain control node.", node: "betaLane", accepts: ["harpoon", "breaker"] },
      { id: "deny", label: "LANE DENIAL", brief: "Prevent either defense from reinforcing.", node: "fireLine", accepts: ["furnace", "railjack"] },
      { id: "reactor", label: "REACTOR TEAM", brief: "Converge through the opening and sabotage.", node: "breachLine", accepts: ["breaker", "harpoon"] },
      { id: "recover", label: "EXTRACTION", brief: "Collect the split force at the gantry.", node: "recoveryLine", accepts: ["hauler", "railjack"] },
    ],
  },
];

const BREAKPOINTS = [
  {
    id: "beta",
    trigger: "IF Beta lane is ranged",
    options: [
      { id: "tempo", label: "PRESERVE TEMPO", effect: "Cross exposed; keep reactor timing.", routeLabel: "DIRECT CROSSING", path: ["BETA LANE", "REACTOR"] },
      { id: "protect", label: "PROTECT BREACHER", effect: "Lay smoke and divert the thrust.", routeLabel: "COVERED DIVERSION", path: ["SMOKE LINE", "COVERED ARC", "REACTOR"] },
    ],
    defaultOption: "tempo",
  },
  {
    id: "rescue",
    trigger: "IF salvage crew is located",
    options: [
      { id: "clock", label: "PRESERVE CLOCK", effect: "Leave the crew; secure extraction.", routeLabel: "BYPASS SALVAGE", path: ["REACTOR", "EXTRACTION"] },
      { id: "recover", label: "RECOVER CREW", effect: "Divert the Hauler before sabotage.", routeLabel: "RECOVERY LOOP", path: ["REACTOR", "SALVAGE PEN", "EXTRACTION"] },
    ],
    defaultOption: "clock",
  },
];

const BREAKPOINT_IMPACTS = {
  beta: {
    tempo: { text: "No delay · Breacher remains exposed" },
    protect: { reactorDelay: 15, missionDelay: 15, protects: 1, text: "+00:15 · one formation protected" },
  },
  rescue: {
    clock: { text: "No delay · salvage crew left behind" },
    recover: { missionDelay: 15, protects: 1, rescue: true, text: "+00:15 · crew rescued · one formation protected" },
  },
};

const ENEMY_PLAN = {
  name: "IRON PROCESSION",
  intent: "Screen Beta, counter the breach, then sever the gantry.",
  formations: [
    { id: "aegis", number: "E1", name: "AEGIS COHORT", start: { x: 94, y: 5 }, end: { x: 76, y: 18 }, actionAt: 90 },
    { id: "cinder", number: "E2", name: "CINDER LANCE", start: { x: 96, y: 36 }, end: { x: 76, y: 48 }, actionAt: 225 },
    { id: "pursuit", number: "E3", name: "OATH PURSUIT", start: { x: 94, y: 61 }, end: { x: 88, y: 23 }, actionAt: 330 },
  ],
  stages: [
    {
      id: "screen",
      formationId: "aegis",
      label: "BETA SCREEN",
      creates: "FORTIFIED LANE",
      intelligence: "KNOWN",
      counteredBy: ["FURNACE DRAGNET", "ASHEN CORDON"],
      impact: { reactorDelay: 15 },
      consequence: "Reactor thrust delayed +00:15",
    },
    {
      id: "counter",
      formationId: "cinder",
      label: "OATH COUNTER",
      uses: "FORTIFIED LANE",
      creates: "COUNTERFIRE",
      intelligence: "UNCERTAIN",
      counteredBy: ["EXECUTION BREACH", "THERMAL BREACH", "FORCED ENTRY", "FIELD REARM", "COVERED ADVANCE", "LOCKED BREACH"],
      impact: { missionDelay: 15 },
      consequence: "Extraction timetable delayed +00:15",
    },
    {
      id: "sever",
      formationId: "pursuit",
      label: "GANTRY SEVER",
      uses: "COUNTERFIRE",
      creates: "CUT OFF",
      intelligence: "UNKNOWN",
      counteredBy: ["ARMORED EVAC", "HOT RECOVERY", "BREACH RECOVERY", "LOCKSTEP HOLD"],
      impact: { recoveryLoss: 1 },
      consequence: "One formation cut off from extraction",
    },
  ],
};

const FIELD_PLANS = {
  trapline: {
    positions: [
      { x: 35, y: 32 },
      { x: 49, y: 38 },
      { x: 62, y: 32 },
      { x: 70, y: 25 },
      { x: 73, y: 47 },
    ],
    routes: [
      { role: 0, start: { x: 17, y: 76 }, points: [0, "alpha", { x: 48, y: 25 }] },
      { role: 1, start: { x: 26, y: 80 }, points: [1, { x: 57, y: 39 }, { x: 67, y: 46 }] },
      { role: 2, start: { x: 35, y: 76 }, points: [2], breakpoint: "beta" },
      { role: 3, start: { x: 44, y: 80 }, points: [3, "beta"] },
      { role: 4, start: { x: 53, y: 76 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 2, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [2, "reactor"],
        protect: [2, { x: 67, y: 20 }, { x: 72, y: 34 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
  spear: {
    positions: [
      { x: 34, y: 36 },
      { x: 49, y: 27 },
      { x: 61, y: 36 },
      { x: 54, y: 43 },
      { x: 73, y: 48 },
    ],
    routes: [
      { role: 0, start: { x: 17, y: 76 }, points: [0, "alpha"] },
      { role: 1, start: { x: 26, y: 80 }, points: [1, "beta"] },
      { role: 2, start: { x: 35, y: 76 }, points: [2], breakpoint: "beta" },
      { role: 3, start: { x: 44, y: 80 }, points: [3, { x: 66, y: 43 }] },
      { role: 4, start: { x: 53, y: 76 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 2, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [2, "reactor"],
        protect: [2, { x: 65, y: 23 }, { x: 72, y: 34 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
  pressure: {
    positions: [
      { x: 34, y: 32 },
      { x: 60, y: 18 },
      { x: 48, y: 40 },
      { x: 64, y: 38 },
      { x: 73, y: 48 },
    ],
    routes: [
      { role: 0, start: { x: 17, y: 76 }, points: [0, "alpha"] },
      { role: 1, start: { x: 26, y: 80 }, points: [1, "beta"] },
      { role: 2, start: { x: 35, y: 76 }, points: [2, { x: 56, y: 33 }] },
      { role: 3, start: { x: 44, y: 80 }, points: [3], breakpoint: "beta" },
      { role: 4, start: { x: 53, y: 76 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 3, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [3, "reactor"],
        protect: [3, { x: 68, y: 25 }, { x: 73, y: 35 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
};

const FIELD_LANDMARKS = {
  alpha: { x: 35, y: 24 },
  beta: { x: 76, y: 12 },
  reactor: { x: 76, y: 46 },
  extraction: { x: 91, y: 18 },
  rescue: { x: 83, y: 75 },
};

const BASE_OPERATION = {
  alphaAt: 60,
  betaAt: 150,
  reactorAt: 300,
  extractionAt: 345,
  completeAt: 360,
};

const emptyAssignments = (playbook) => Object.fromEntries(
  playbook.roles.map((role) => [role.id, null]),
);

const TACTICAL_REACTIONS = {
  "DISPLACED:furnace": { name: "FURNACE DRAGNET", result: "KILL ZONE", impact: { alpha: 15, phase: "alpha", text: "Alpha secured 15 seconds earlier" } },
  "SCREENED:furnace": { name: "ASHEN CORDON", result: "SEALED LANE", impact: { beta: 15, phase: "beta", text: "Beta secured 15 seconds earlier" } },
  "SUPPLIED:furnace": { name: "STOKED ADVANCE", result: "OVERHEATED", impact: { beta: 15, phase: "beta", text: "Beta pressure arrives 15 seconds earlier" } },
  "FORWARD HOLD:furnace": { name: "BASTION PYRE", result: "KILL ZONE", impact: { alpha: 15, phase: "alpha", text: "The forward hold becomes a prepared kill zone" } },
  "DISPLACED:breaker": { name: "FORCED ENTRY", result: "EXPOSED CORE", impact: { reactor: 15, phase: "reactor", text: "Reactor assault starts 15 seconds earlier" } },
  "OVERHEATED:breaker": { name: "THERMAL BREACH", result: "FRACTURED ARMOR", impact: { reactor: 30, phase: "reactor", text: "Reactor opens 30 seconds earlier" } },
  "SCREENED:breaker": { name: "COVERED ADVANCE", result: "SAFE BREACH", impact: { reactor: 15, phase: "reactor", text: "Reactor approach gains 15 seconds" } },
  "SUPPLIED:breaker": { name: "FIELD REARM", result: "OVERCHARGED BREACH", impact: { reactor: 30, phase: "reactor", text: "Reactor strike gains 30 seconds" } },
  "KILL ZONE:breaker": { name: "EXECUTION BREACH", result: "OPEN CORE", impact: { reactor: 30, phase: "reactor", text: "The trapped defense exposes the Reactor core" } },
  "SEALED LANE:breaker": { name: "LOCKED BREACH", result: "OPEN CORE", impact: { reactor: 15, phase: "reactor", text: "The sealed lane becomes an uncontested Reactor breach" } },
  "DISPLACED:railjack": { name: "TOWED BASTION", result: "FORWARD HOLD", impact: { protects: 1, phase: "extraction", text: "One additional formation survives extraction" } },
  "OVERHEATED:railjack": { name: "ASHEN CORDON", result: "SEALED LANE", impact: { beta: 15, phase: "beta", text: "Beta secured 15 seconds earlier" } },
  "BREACHED:railjack": { name: "WEDGE & WALL", result: "SECURED BREACH", impact: { protects: 1, phase: "extraction", text: "One additional formation survives extraction" } },
  "SUPPLIED:railjack": { name: "MOBILE RESUPPLY", result: "FORTIFIED HOLD", impact: { protects: 1, phase: "extraction", text: "One additional formation survives extraction" } },
  "OPEN CORE:railjack": { name: "LOCKSTEP HOLD", result: "SECURED CORRIDOR", impact: { protects: 1, phase: "extraction", text: "The open core becomes a protected extraction corridor" } },
  "FRACTURED ARMOR:railjack": { name: "WEDGE & WALL", result: "SECURED CORRIDOR", impact: { protects: 1, phase: "extraction", text: "The breach is converted into a protected corridor" } },
  "OVERHEATED:hauler": { name: "HOT RECOVERY", result: "CLEAR EXTRACTION", impact: { extraction: 15, phase: "extraction", text: "Extraction begins 15 seconds earlier" } },
  "BREACHED:hauler": { name: "BREACH RECOVERY", result: "OPEN EXTRACTION", impact: { extraction: 30, phase: "extraction", text: "Extraction begins 30 seconds earlier" } },
  "SCREENED:hauler": { name: "ARMORED EVAC", result: "PROTECTED RECOVERY", impact: { extraction: 15, protects: 1, phase: "extraction", text: "Extraction starts early and one more formation survives" } },
  "OPEN CORE:hauler": { name: "BREACH RECOVERY", result: "OPEN EXTRACTION", impact: { extraction: 30, phase: "extraction", text: "The open core becomes a direct extraction lane" } },
  "SECURED BREACH:hauler": { name: "ARMORED EVAC", result: "PROTECTED RECOVERY", impact: { extraction: 15, protects: 1, phase: "extraction", text: "The secured breach becomes a protected recovery lane" } },
  "SECURED CORRIDOR:hauler": { name: "ARMORED EVAC", result: "PROTECTED RECOVERY", impact: { extraction: 15, protects: 1, phase: "extraction", text: "The corridor carries every formation toward extraction" } },
  "SCREENED:harpoon": { name: "COVERED DRAG", result: "DISPLACED", impact: { alpha: 15, phase: "alpha", text: "The screened rig displaces the Alpha blocker early" } },
  "SUPPLIED:harpoon": { name: "POWER WINCH", result: "DISPLACED", impact: { alpha: 15, phase: "alpha", text: "The resupplied rig displaces the Alpha blocker early" } },
  "FORWARD HOLD:harpoon": { name: "ANCHOR DRAG", result: "DISPLACED", impact: { alpha: 15, phase: "alpha", text: "The forward hold anchors a forced displacement" } },
};

const evaluateTacticalSequence = (playbook, assignments) => {
  const outputs = {};
  const handoffs = [];
  let previousRole = null;
  let previousFormation = null;
  let carriedCondition = null;

  playbook.roles.forEach((role, index) => {
    const formation = FORMATIONS.find((item) => item.id === assignments[role.id]);
    if (!formation) {
      outputs[role.id] = null;
      if (previousRole) {
        handoffs.push({
          id: `${previousRole.id}:${role.id}`,
          from: index - 1,
          to: index,
          sourceId: previousFormation?.id ?? null,
          receiverId: null,
          incomingCondition: carriedCondition,
          maneuver: null,
        });
      }
      previousRole = role;
      previousFormation = null;
      carriedCondition = null;
      return;
    }

    const reaction = previousFormation && carriedCondition
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

const calculateEnemyClashes = (maneuvers) => ENEMY_PLAN.stages.map((stage) => {
  const counterManeuver = maneuvers.find((maneuver) => stage.counteredBy.includes(maneuver.name));
  const formation = ENEMY_PLAN.formations.find((item) => item.id === stage.formationId);
  return {
    ...stage,
    actionAt: formation.actionAt,
    disrupted: Boolean(counterManeuver),
    counterManeuver,
  };
});

const calculateOperationProfile = (handoffs, branchChoices) => {
  const maneuvers = handoffs.filter((handoff) => handoff.maneuver).map((handoff) => handoff.maneuver);
  const total = (key) => maneuvers.reduce((sum, maneuver) => sum + (maneuver.impact[key] ?? 0), 0);
  const enemyClashes = calculateEnemyClashes(maneuvers);
  const enemyTotal = (key) => enemyClashes.reduce((sum, clash) => sum + (clash.disrupted ? 0 : clash.impact[key] ?? 0), 0);
  const branchEffects = BREAKPOINTS.map((breakpoint) => {
    const optionId = branchChoices[breakpoint.id] ?? breakpoint.defaultOption;
    return {
      id: breakpoint.id,
      option: breakpoint.options.find((item) => item.id === optionId),
      impact: BREAKPOINT_IMPACTS[breakpoint.id][optionId],
    };
  });
  const branchTotal = (key) => branchEffects.reduce((sum, branch) => sum + (branch.impact[key] ?? 0), 0);
  const alphaAt = Math.max(30, BASE_OPERATION.alphaAt - total("alpha"));
  const betaAt = Math.max(alphaAt + 45, BASE_OPERATION.betaAt - total("beta"));
  const betaDecisionAt = Math.max(alphaAt + 15, betaAt - 45);
  const reactorAt = Math.max(betaAt + 60, BASE_OPERATION.reactorAt - total("reactor") + branchTotal("reactorDelay") + enemyTotal("reactorDelay"));
  const reactorExposeAt = Math.max(betaAt + 30, reactorAt - 45);
  const rescueDecisionAt = Math.max(betaAt + 30, Math.min(210, reactorExposeAt - 15));
  const extractionAt = Math.max(reactorAt + 30, BASE_OPERATION.extractionAt - total("extraction")) + branchTotal("missionDelay") + enemyTotal("missionDelay");
  const completeAt = extractionAt + 15;
  const overrun = Math.max(0, completeAt - BASE_OPERATION.completeAt);
  const reinforcementLoss = Math.ceil(overrun / 15);
  const protectedCount = total("protects") + branchTotal("protects");
  const enemyRecoveryLoss = enemyTotal("recoveryLoss");
  const extractedCount = Math.max(3, Math.min(FORMATIONS.length, 3 + protectedCount) - reinforcementLoss - enemyRecoveryLoss);

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
    timeSaved: Math.max(0, BASE_OPERATION.completeAt - completeAt),
    overrun,
    reinforcementLoss,
    enemyRecoveryLoss,
    enemyClashes,
    branchEffects,
    effects: maneuvers,
  };
};

const comboWindowTimes = (profile) => [
  profile.alphaAt,
  profile.betaAt,
  profile.reactorExposeAt,
  profile.extractionAt,
];

const buildOperationEvents = (profile) => {
  const maneuverFor = (phase) => profile.effects.find((maneuver) => maneuver.impact.phase === phase)?.name;
  const alphaManeuver = maneuverFor("alpha");
  const betaManeuver = maneuverFor("beta");
  const reactorManeuver = maneuverFor("reactor");
  const extractionManeuver = profile.effects.find((maneuver) => maneuver.impact.extraction)?.name ?? maneuverFor("extraction");

  const events = [
    { at: 30, text: "Forward role has contact. Playbook in motion." },
    { at: profile.alphaAt, text: alphaManeuver ? `${alphaManeuver} secures Control Node Alpha.` : "Control Node Alpha seized under direct pressure." },
    { at: profile.betaDecisionAt, text: "Helioch fire closes the Beta transit lane. Breakpoint order required." },
    { at: profile.betaAt, text: betaManeuver ? `${betaManeuver} seals Control Node Beta.` : "Control Node Beta seized under pressure." },
    { at: profile.rescueDecisionAt, text: "Salvage crew located below the reactor deck." },
    { at: profile.reactorExposeAt, text: reactorManeuver ? `${reactorManeuver} exposes the Reactor Spine.` : "Reactor Spine exposed. Breach force advancing." },
    { at: profile.reactorAt, text: "Reactor Spine sabotaged. Extraction route open." },
    { at: profile.extractionAt, text: extractionManeuver ? `${extractionManeuver}: ${profile.extractedCount} formations crossing the gantry.` : `${profile.extractedCount} formations crossing the Extraction Gantry.` },
  ];
  profile.enemyClashes.forEach((clash) => {
    events.push({
      at: clash.actionAt,
      text: clash.disrupted
        ? `${clash.counterManeuver.name} breaks the Helioch ${clash.label}.`
        : `${clash.label} lands. ${clash.consequence}.`,
    });
  });
  if (profile.overrun > 0) events.push({ at: BASE_OPERATION.completeAt, text: `Helioch reinforcements enter the foundry. ${profile.reinforcementLoss} formation recovery lost.` });
  return events.sort((left, right) => left.at - right.at);
};

const defaultBranches = () => Object.fromEntries(
  BREAKPOINTS.map((breakpoint) => [breakpoint.id, breakpoint.defaultOption]),
);

const fmtClock = (seconds) => {
  const remaining = Math.max(0, 360 - seconds);
  return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(
    remaining % 60,
  ).padStart(2, "0")}`;
};

const fmtDuration = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
  seconds % 60,
).padStart(2, "0")}`;

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Hammer weight="duotone" />
    </div>
  );
}

function FormationPortrait({ formation, compact = false }) {
  return (
    <img
      className={compact ? "formation-image compact" : "formation-image"}
      src={formation.asset}
      alt={`${formation.name} formation`}
    />
  );
}

function AppHeader({ phase, battleTime, profile }) {
  const reinforcementsEngaged = phase === "battle" && battleTime >= BASE_OPERATION.completeAt;
  return (
    <header className="app-header">
      <div className="brand-block">
        <BrandMark />
        <div>
          <p className="eyebrow">PROJECT WARHOST</p>
          <h1>OBJECTIVE WEAVE</h1>
        </div>
      </div>
      <div className="faction-matchup" aria-label="Scrapborn Freeholds versus Helioch Oath">
        <div className="faction faction-player">
          <span className="faction-sigil"><Wrench weight="duotone" /></span>
          <div><b>SCRAPBORN FREEHOLDS</b><small>VOIDBREAKER GUILD</small></div>
        </div>
        <span className="versus">VS</span>
        <div className="faction faction-enemy">
          <div><b>HELIOCH OATH</b><small>ORDO PRAESIDIUM</small></div>
          <span className="faction-sigil"><Target weight="duotone" /></span>
        </div>
      </div>
      <div className="operation-block">
        <div>
          <p className="operation-title">OPERATION DEAD CIRCUIT</p>
          <p className="operation-type">SABOTAGE &amp; EXTRACT</p>
        </div>
        <div className="reinforcement-clock" aria-live="polite">
          <span>{reinforcementsEngaged ? "REINFORCEMENTS ENGAGED" : phase === "battle" ? "MISSION WINDOW" : phase === "complete" ? "MISSION COMPLETE" : "REINFORCEMENTS IN"}</span>
          <strong>{phase === "battle" || phase === "complete" ? fmtClock(battleTime) : "06:00"}</strong>
          <small>{reinforcementsEngaged ? `CONTACT +${fmtDuration(battleTime - BASE_OPERATION.completeAt)}` : phase === "complete" && profile.overrun > 0 ? `${fmtDuration(profile.overrun)} OVER WINDOW` : phase === "complete" ? "EXTRACTION CONFIRMED" : "UNKNOWN FORCE SIZE"}</small>
        </div>
      </div>
    </header>
  );
}

function FormationRoster({ selected, onSelect, assignments, playbook, onPlaybook, phase, onFormationDragStart }) {
  const roleByFormation = Object.fromEntries(
    playbook.roles.filter((role) => assignments[role.id]).map((role) => [assignments[role.id], role]),
  );
  return (
    <section className="left-rail" aria-label="Tactical playbooks and Warhost formations">
      <div className="doctrine-heading"><span>TACTICAL PLAYBOOK</span><Radio weight="duotone" /></div>
      <div className="playbook-list">
        {PLAYBOOKS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`playbook-row ${playbook.id === item.id ? "selected" : ""}`}
              onClick={() => onPlaybook(item.id)}
              disabled={phase !== "plan"}
              aria-pressed={playbook.id === item.id}
            >
              <Icon weight="duotone" />
              <span><b>{item.name}</b><small>{item.summary}</small></span>
            </button>
          );
        })}
      </div>
      <div className="rail-heading">
        <span>SELECT FORMATION</span>
        <span>VIEW ON FIELD</span>
      </div>
      <div className="formation-list">
        {FORMATIONS.map((formation) => {
          const Icon = formation.icon;
          const active = selected === formation.id;
          const assignedRole = roleByFormation[formation.id];
          const assignedIndex = assignedRole ? playbook.roles.findIndex((role) => role.id === assignedRole.id) : -1;
          return (
            <button
              key={formation.id}
              className={`formation-row ${active ? "selected" : ""} ${assignedRole ? "assigned" : "available"}`}
              onClick={() => onSelect(formation.id)}
              draggable={phase === "plan"}
              onDragStart={(event) => onFormationDragStart(event, formation.id)}
              disabled={phase !== "plan" && phase !== "drill"}
              aria-pressed={active}
              aria-label={`${formation.name}. ${assignedRole ? `Assigned to action stop ${assignedIndex + 1}, ${assignedRole.label}` : "Available. Drag to an action stop"}.`}
              title={phase === "plan" ? "Drag to an action stop or click to inspect on the field" : undefined}
            >
              <span className="formation-number">{formation.number}</span>
              <FormationPortrait formation={formation} compact />
              <span className="formation-copy">
                <b>{formation.name}</b>
                <small><Icon weight="duotone" /> {formation.role}</small>
                <em>{assignedRole ? `STOP ${String(assignedIndex + 1).padStart(2, "0")} · ${assignedRole.label}` : "AVAILABLE · DRAG TO STOP"}</em>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MissionRoute({ phase, battleTime, profile }) {
  const steps = [
    { n: 1, label: "SEIZE BOTH NODES", done: battleTime >= profile.betaAt },
    { n: 2, label: "SABOTAGE REACTOR", done: battleTime >= profile.reactorAt },
    { n: 3, label: "EXTRACT 3+ FORMATIONS", done: phase === "complete" },
  ];
  return (
    <div className="mission-route panel-surface">
      <span className="panel-label">VICTORY ORDERS</span>
      <div className="victory-rule"><b>WIN THE MISSION</b><small>Sabotage Reactor Spine + extract 3 formations.</small></div>
      {steps.map((step) => (
        <div className={`route-step route-${step.n} ${step.done ? "done" : ""}`} key={step.n}>
          <span>{step.done ? <CheckCircle weight="fill" /> : step.n}</span>
          <b>{step.label}</b>
        </div>
      ))}
    </div>
  );
}

function ObjectiveMarker({ className, number, title, description, state = "active", icon: Icon = MapPin }) {
  return (
    <div className={`objective-marker ${className} ${state}`}>
      <span className="objective-pin"><Icon weight="fill" /></span>
      <div><b>{title}</b><small>{description}</small></div>
      {number && <span className="objective-number">{number}</span>}
    </div>
  );
}

const resolveFieldPoint = (plan, reference) => {
  if (typeof reference === "number") return plan.positions[reference];
  if (typeof reference === "string") return FIELD_LANDMARKS[reference];
  return reference;
};

const fieldSegmentStyle = (start, end, size) => {
  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);
  const dx = ((end.x - start.x) / 100) * width;
  const dy = ((end.y - start.y) / 100) * height;
  return {
    left: `${start.x}%`,
    top: `${start.y}%`,
    width: `${Math.hypot(dx, dy)}px`,
    transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`,
  };
};

function TacticalFieldPlan({ assignments, branches, phase, playbook }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });
  const plan = FIELD_PLANS[playbook.id];

  useEffect(() => {
    if (!layerRef.current || phase === "battle" || phase === "complete") return undefined;
    const element = layerRef.current;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setLayerSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [phase, playbook.id]);

  if (!plan || phase === "battle" || phase === "complete") return null;

  const routes = plan.routes.map((route) => {
    const roleIndex = route.role;
    const role = playbook.roles[roleIndex];
    const formation = FORMATIONS.find((item) => item.id === assignments[role.id]);
    const staging = formation ? STAGING_NODES[formation.id] : null;
    const start = staging ? { x: staging.left, y: staging.top - 3 } : route.start;
    return { ...route, roleIndex, role, formation, start };
  });
  const baseSegments = routes.flatMap((route) => {
    const points = [route.start, ...route.points].map((point) => resolveFieldPoint(plan, point));
    return points.slice(0, -1).map((point, index) => ({
      id: `route-${route.roleIndex}-${index}`,
      start: point,
      end: points[index + 1],
      className: `base lane-${route.roleIndex + 1} ${route.formation ? "staffed" : ""}`,
    }));
  });
  const branchSegments = BREAKPOINTS.flatMap((breakpoint, breakpointIndex) => {
    const selectedOptionId = branches[breakpoint.id];
    const roleIndex = plan.breakpointRoles[breakpoint.id];
    const role = playbook.roles[roleIndex];
    const staffed = Boolean(assignments[role.id]);
    const orderedOptions = [
      ...breakpoint.options.filter((option) => option.id !== selectedOptionId),
      ...breakpoint.options.filter((option) => option.id === selectedOptionId),
    ];
    return orderedOptions.flatMap((option) => {
      const route = plan.branchRoutes[breakpoint.id][option.id];
      const selectedRoute = option.id === selectedOptionId;
      const changed = selectedRoute && option.id !== breakpoint.defaultOption;
      return route.slice(0, -1).map((point, index) => ({
        id: `${breakpoint.id}-${option.id}-${index}`,
        start: resolveFieldPoint(plan, point),
        end: resolveFieldPoint(plan, route[index + 1]),
        className: `branch breakpoint-${breakpointIndex + 1} lane-${roleIndex + 1} ${selectedRoute ? "selected-route" : "alternative-route"} ${staffed ? "staffed" : ""} ${changed ? "changed" : ""}`,
      }));
    });
  });
  const branchTurns = BREAKPOINTS.flatMap((breakpoint, breakpointIndex) => {
    const selectedOptionId = branches[breakpoint.id];
    return breakpoint.options.flatMap((option) => {
      const selectedRoute = option.id === selectedOptionId;
      return plan.branchRoutes[breakpoint.id][option.id]
        .filter((point) => typeof point === "object" || point === "rescue")
        .slice(0, 1)
        .map((point, index) => ({
          id: `${breakpoint.id}-${option.id}-turn-${index}`,
          point: resolveFieldPoint(plan, point),
          label: `${selectedRoute ? "" : "ALT · "}${option.routeLabel}`,
          className: `breakpoint-${breakpointIndex + 1} ${selectedRoute ? "selected-route" : "alternative-route"}`,
        }));
    });
  });

  return (
    <div className="field-plan-layer" ref={layerRef} aria-label={`${playbook.name} authored battlefield plan`}>
      <div className="field-plan-caption panel-surface" aria-live="polite">
        <div><span>5 FORMATION ROUTES</span><b>{playbook.name}</b></div>
        <div className="field-plan-branch-state">
          {BREAKPOINTS.map((breakpoint, index) => {
            const option = breakpoint.options.find((item) => item.id === branches[breakpoint.id]);
            const changed = branches[breakpoint.id] !== breakpoint.defaultOption;
            return <span className={changed ? "changed" : ""} key={breakpoint.id}>BP{index + 1} · {option.routeLabel}</span>;
          })}
        </div>
      </div>
      {[...baseSegments, ...branchSegments].map((segment) => (
        <div className={`field-plan-segment ${segment.className}`} style={fieldSegmentStyle(segment.start, segment.end, layerSize)} key={segment.id}>
          <ArrowRight weight="bold" />
        </div>
      ))}
      {branchTurns.map((turn) => (
        <div className={`field-plan-turn ${turn.className}`} style={{ left: `${turn.point.x}%`, top: `${turn.point.y}%` }} key={turn.id}>
          <MapPin weight="fill" /><span>{turn.label}</span>
        </div>
      ))}
      {routes.map((route) => (
        <div className={`field-plan-entry lane-${route.roleIndex + 1} ${route.formation ? "staffed" : ""}`} style={{ left: `${route.start.x}%`, top: `${route.start.y}%` }} key={`origin-${route.roleIndex}`}>
          <Flag weight="fill" />
          <span>{route.formation ? route.formation.number : String(route.roleIndex + 1).padStart(2, "0")}</span>
          <small>{route.formation ? route.formation.name : `ROUTE ${String(route.roleIndex + 1).padStart(2, "0")}`}</small>
        </div>
      ))}
      {plan.positions.map((position, index) => {
        const role = playbook.roles[index];
        const formation = FORMATIONS.find((item) => item.id === assignments[role.id]);
        return (
          <div className={`field-plan-position lane-${index + 1} ${formation ? "staffed" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} key={role.id}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{role.label.split(" / ")[0]}</span>
            {formation && <em>{formation.name}</em>}
          </div>
        );
      })}
    </div>
  );
}

function EnemyFieldPlan({ battleTime, phase, clashes }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    if (!layerRef.current) return undefined;
    const element = layerRef.current;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setLayerSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="enemy-plan-layer" ref={layerRef} aria-label={`${ENEMY_PLAN.name} enemy battlefield plan`}>
      {ENEMY_PLAN.formations.map((formation, index) => {
        const clash = clashes[index];
        const inBattle = phase === "battle" || phase === "complete";
        const progress = inBattle ? Math.min(1, battleTime / formation.actionAt) : 0;
        const position = {
          x: formation.start.x + (formation.end.x - formation.start.x) * progress,
          y: formation.start.y + (formation.end.y - formation.start.y) * progress,
        };
        const resolved = inBattle && battleTime >= formation.actionAt;
        return (
          <Fragment key={formation.id}>
            <div className={`enemy-plan-segment enemy-lane-${index + 1} ${clash.disrupted ? "countered" : "threat"}`} style={fieldSegmentStyle(formation.start, formation.end, layerSize)}>
              <ArrowRight weight="bold" />
            </div>
            <div className={`enemy-plan-stop enemy-lane-${index + 1} ${clash.disrupted ? "countered" : "threat"}`} style={{ left: `${formation.end.x}%`, top: `${formation.end.y}%` }}>
              <b>{formation.number}</b><span>{clash.label}</span>
            </div>
            <div className={`enemy-plan-formation ${resolved ? clash.disrupted ? "disrupted" : "landed" : "advancing"}`} style={{ left: `${position.x}%`, top: `${position.y}%` }}>
              <img src="/assets/helioch-sentinels.png" alt={`${formation.name} executing ${clash.label}`} />
              <span>{formation.number}</span>
              <small>{resolved ? clash.disrupted ? "DISRUPTED" : clash.label : formation.name}</small>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

function TacticalHandoffBoard({ feedback, handoffs, profile }) {
  const discovered = handoffs.filter((handoff) => handoff.maneuver);
  const fullyStaffed = handoffs.every((handoff) => handoff.sourceId && handoff.receiverId);
  const longestCascade = handoffs.reduce((state, handoff) => {
    const current = handoff.maneuver ? state.current + 1 : 0;
    return { current, longest: Math.max(state.longest, current) };
  }, { current: 0, longest: 0 }).longest;
  const cascadeLabel = longestCascade === discovered.length
    ? `${longestCascade} COMBO CHAIN`
    : `${discovered.length} SEPARATE COMBOS`;
  const FeedbackIcon = feedback?.tone === "weakened" ? Warning : Lightning;
  const timing = comboWindowTimes(profile);

  return (
    <div className="handoff-board" aria-live="polite">
      <div className="handoff-heading">
        <span>COMBO WINDOWS</span>
        <small>Automatic: one formation creates an opening; the next reacts before it closes.</small>
      </div>
      {feedback ? (
        <div className={`cascade-readout placement-impact ${feedback.tone}`} key={feedback.revision} role="status">
          <span><FeedbackIcon weight="fill" /> {feedback.title}</span>
          <b>{feedback.formationName} → STOP {String(feedback.targetIndex + 1).padStart(2, "0")} · later combo windows recalculated</b>
          <div className="placement-impact-metrics">
            <strong>{feedback.beforeLinks} → {feedback.afterLinks}<small>COMBOS</small></strong>
            <strong>{feedback.forecast}<small>UPDATED MISSION OUTLOOK</small></strong>
          </div>
        </div>
      ) : (
        <div className={`cascade-readout ${discovered.length > 0 ? "active" : fullyStaffed ? "broken" : "unresolved"}`}>
          <span><Lightning weight="fill" /> {discovered.length > 0 ? cascadeLabel : fullyStaffed ? "NO COMBOS ARMED" : "COMBO WINDOWS UNKNOWN"}</span>
          <b>{discovered.length > 0 ? "These reactions fire automatically during the mission." : fullyStaffed ? "The current formations act independently." : "Staff two neighboring stops to reveal their trigger and response."}</b>
          <small>{discovered.length > 0 ? "Move any formation to change the later windows." : "Nothing activates manually during combat."}</small>
        </div>
      )}
      <div className="handoff-grid">
        {handoffs.map((handoff) => {
          const staffed = handoff.sourceId && handoff.receiverId;
          const changed = Boolean(feedback && staffed && handoff.from >= feedback.affectedFrom);
          const source = FORMATIONS.find((formation) => formation.id === handoff.sourceId);
          const receiver = FORMATIONS.find((formation) => formation.id === handoff.receiverId);
          const windowAt = timing[handoff.from];
          return (
            <div
              className={`handoff-card ${handoff.maneuver ? "discovered" : staffed ? "independent" : "unresolved"} ${changed ? handoff.maneuver ? "cascade-powered" : "cascade-broken" : ""}`}
              key={`${handoff.id}-${changed ? feedback.revision : "static"}`}
              style={changed ? { "--cascade-delay": `${(handoff.from - feedback.affectedFrom + 1) * 110}ms` } : undefined}
            >
              <span className="combo-window-time">T+{fmtDuration(windowAt)} · AFTER {String(handoff.from + 1).padStart(2, "0")} / BEFORE {String(handoff.to + 1).padStart(2, "0")}</span>
              {handoff.maneuver ? (
                <>
                  <div className="combo-window-flow">
                    <span><b>{source.name}</b><small>CREATES {handoff.maneuver.passes}</small></span>
                    <ArrowRight weight="bold" />
                    <span><b>{receiver.name}</b><small>REACTS: {handoff.maneuver.name}</small></span>
                  </div>
                  <p><Target weight="fill" /> RESULT: {handoff.maneuver.result} · {handoff.maneuver.impact.text}</p>
                </>
              ) : (
                <>
                  <b>{staffed ? "NO REACTION IN THIS WINDOW" : "WINDOW NOT REVEALED"}</b>
                  <small>{staffed ? `${source.name} creates ${handoff.incomingCondition}; ${receiver.name} cannot use it.` : "Staff both stops. The combo check happens automatically at this time."}</small>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaybookBoard({ active, assignments, battleTime, drillStep, feedback, handoffs, onChooseRole, onAssignFormation, outputs, phase, playbook, profile }) {
  const [dropTargetRoleId, setDropTargetRoleId] = useState(null);
  const discoveredHandoffs = handoffs.filter((handoff) => handoff.maneuver);
  const timing = comboWindowTimes(profile);

  if (phase === "battle" || phase === "complete") {
    return (
      <div className={`combo-panel panel-surface ${active ? "ready" : "broken"}`}>
        <span className="panel-label">{playbook.name}: {playbook.stages.map((stage) => stage.label).join(" → ")}</span>
        <p>{active ? playbook.intent : "One or more tactical roles are unresolved."}</p>
        <div className="combo-steps">
          {playbook.stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <Fragment key={stage.label}>
                <div className={drillStep >= index + 1 ? `lit ${stage.warm ? "warm" : ""}` : ""}><Icon weight="duotone" /><b>{stage.label}</b><small>{stage.detail}</small></div>
                {index < playbook.stages.length - 1 && <ArrowRight />}
              </Fragment>
            );
          })}
        </div>
        <div className="battle-handoffs">
          <span>AUTOMATIC COMBO WINDOWS</span>
          {discoveredHandoffs.length > 0 ? discoveredHandoffs.map((handoff) => {
            const source = FORMATIONS.find((formation) => formation.id === handoff.sourceId);
            const receiver = FORMATIONS.find((formation) => formation.id === handoff.receiverId);
            const windowAt = timing[handoff.from];
            const state = phase === "complete" || battleTime >= windowAt + 15
              ? "resolved"
              : battleTime >= windowAt
                ? "live"
                : "upcoming";
            const timingLabel = state === "live"
              ? "NOW"
              : state === "resolved"
                ? "RESOLVED"
                : `IN ${fmtDuration(windowAt - battleTime)}`;
            return (
              <div className={state} key={handoff.id} title={`${source.name} creates ${handoff.maneuver.passes}; ${receiver.name} responds with ${handoff.maneuver.name}`}>
                <Lightning weight="fill" />
                <b>{timingLabel} · {handoff.maneuver.name}</b>
                <small>{source.name} creates {handoff.maneuver.passes} → {receiver.name} turns it into {handoff.maneuver.result}</small>
              </div>
            );
          }) : <p>No combo windows are armed; formations execute independently.</p>}
        </div>
      </div>
    );
  }

  const assignedCount = Object.values(assignments).filter(Boolean).length;
  return (
    <div className={`playbook-board panel-surface ${active ? "ready" : "incomplete"}`}>
      <div className="playbook-board-heading">
        <div>
          <span className="panel-label">{playbook.name} · AUTHORED TACTICAL ROUTE</span>
          <b>PLACE THE FORMATIONS</b>
        </div>
        <strong>{assignedCount} / {playbook.roles.length} PLACED</strong>
      </div>
      <p>Drag a visible formation from staging into a stop. Neighboring stops are checked in order for an automatic trigger → response combo.</p>
      <div className="route-terminals" aria-hidden="true"><span>FORMATION LANES</span><span>COMBO ORDER</span></div>
      <div className="playbook-route">
        {playbook.roles.map((role, index) => {
          const formation = FORMATIONS.find((item) => item.id === assignments[role.id]);
          const output = outputs[role.id];
          const nextRole = playbook.roles[index + 1];
          const nextFormation = nextRole ? FORMATIONS.find((item) => item.id === assignments[nextRole.id]) : null;
          const handoff = handoffs[index];
          const linked = Boolean(handoff?.maneuver);
          const changed = Boolean(feedback?.changedIndices.includes(index));
          const downstream = Boolean(feedback && index >= feedback.affectedFrom && formation);
          const cascadeState = changed ? "cascade-moved" : downstream ? output?.incoming ? "cascade-powered" : "cascade-broken" : "";
          const cascadeDelay = feedback && downstream ? { "--cascade-delay": `${(index - feedback.affectedFrom) * 110}ms` } : undefined;
          const changedLeg = Boolean(feedback && index >= feedback.affectedFrom && formation && nextFormation);
          return (
            <Fragment key={`${role.id}-${downstream ? feedback.revision : "static"}`}>
              <button
                className={`playbook-slot ${formation ? "filled" : "empty"} ${dropTargetRoleId === role.id ? "drop-target" : ""} ${cascadeState}`}
                style={cascadeDelay}
                onClick={() => onChooseRole(role.id)}
                onDragEnter={(event) => { event.preventDefault(); setDropTargetRoleId(role.id); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetRoleId(null); }}
                onDrop={(event) => {
                  event.preventDefault();
                  const formationId = event.dataTransfer.getData("application/x-warhost-formation") || event.dataTransfer.getData("text/plain");
                  setDropTargetRoleId(null);
                  onAssignFormation(role.id, formationId);
                }}
                disabled={phase !== "plan"}
                aria-label={`Action stop ${index + 1}, ${role.label}. Currently ${formation?.name ?? "empty"}`}
              >
                <span className="slot-number">STOP {String(index + 1).padStart(2, "0")}</span>
                <span className="slot-role">{role.label}</span>
                <span className="slot-task">{role.brief}</span>
                {formation ? (
                  <>
                    <span className="slot-formation"><img src={formation.asset} alt="" /><b>{formation.name}</b></span>
                    <span className={`slot-result ${output.incoming ? "transformed" : ""}`}><b>{output.result}</b><small>{output.incoming ? "HANDOFF RESULT" : "CREATES"}</small></span>
                  </>
                ) : (
                  <span className="slot-empty"><Plus weight="bold" /><b>DROP UNIT</b><small>OR CLICK</small></span>
                )}
              </button>
              {nextRole && <span className={`route-leg ${formation && nextFormation ? "occupied" : ""} ${linked ? "linked" : ""} ${changedLeg ? linked ? "cascade-powered" : "cascade-broken" : ""}`} style={changedLeg ? { "--cascade-delay": `${(index - feedback.affectedFrom + 1) * 110}ms` } : undefined} aria-hidden="true" title={linked ? `${handoff.maneuver.name}: ${handoff.maneuver.passes} becomes ${handoff.maneuver.result}` : formation && nextFormation ? "No automatic reaction in this combo window" : "Staff both stops to reveal this combo window"}><Lightning weight="fill" /></span>}
            </Fragment>
          );
        })}
      </div>
      <TacticalHandoffBoard feedback={feedback} handoffs={handoffs} profile={profile} />
    </div>
  );
}

function Battlefield({ selected, onSelect, deployments, phase, battleTime, drillStep, placementFeedback, planReady, playbook, drillSteps, assignments, branches, handoffs, outputs, profile, events, onChooseRole, onAssignFormation, onFormationDragStart }) {
  const activeFormations = phase === "complete" ? FORMATIONS.slice(0, profile.extractedCount).map((formation) => formation.id) : FORMATIONS.map((formation) => formation.id);
  const alphaState = battleTime >= profile.alphaAt ? "secured" : "active";
  const betaState = battleTime >= profile.betaAt ? "secured" : "threat";
  const reactorState = battleTime >= profile.reactorAt ? "secured" : "threat";
  const extractionState = phase === "complete" ? "secured" : "future";
  const timing = comboWindowTimes(profile);
  const activeBattleHandoff = phase === "battle"
    ? handoffs.find((handoff) => handoff.maneuver && battleTime >= timing[handoff.from] && battleTime < timing[handoff.from] + 15)
    : null;
  const activeComboSource = FORMATIONS.find((formation) => formation.id === activeBattleHandoff?.sourceId);
  const activeComboReceiver = FORMATIONS.find((formation) => formation.id === activeBattleHandoff?.receiverId);

  return (
    <section className={`battlefield phase-${phase}`} aria-label="Operation Dead Circuit mission map">
      <img className="battlefield-art" src="/assets/dead-circuit-foundry.png" alt="Isometric industrial foundry battlefield" />
      <div className="battlefield-wash" />
      <EnemyFieldPlan battleTime={battleTime} phase={phase} clashes={profile.enemyClashes} />
      <TacticalFieldPlan assignments={assignments} branches={branches} phase={phase} playbook={playbook} />
      <MissionRoute phase={phase} battleTime={battleTime} profile={profile} />
      <div className="map-sector entry-sector"><span>{phase === "plan" || phase === "drill" ? "FORMATION STAGING" : "ENTRY / BREACH"}</span><small>{phase === "plan" || phase === "drill" ? "Visible formations · drag into a stop" : "Player deployment edge"}</small></div>
      <ObjectiveMarker className="alpha-objective" number="1" title="CONTROL NODE ALPHA" description={alphaState === "secured" ? "SECURED · Railjack anchoring" : "Seize and hold"} state={alphaState} />
      <ObjectiveMarker className="beta-objective" number="1" title="CONTROL NODE BETA" description={betaState === "secured" ? "SECURED · Transit lane open" : "Seize and hold"} state={betaState} />
      <ObjectiveMarker className="reactor-objective" number="2" title="REACTOR SPINE" description={reactorState === "secured" ? "SABOTAGED" : "Primary target"} state={reactorState} icon={Factory} />
      <ObjectiveMarker className="extraction-objective" number="3" title="EXTRACTION GANTRY" description="Extract 3+ formations" state={extractionState} icon={Flag} />
      <ObjectiveMarker className="rescue-objective" title="RESCUE SALVAGE CREW" description="Optional · field repair reward" state="optional" icon={Wrench} />

      <div className="mission-path path-one" aria-hidden="true" />
      <div className="mission-path path-two" aria-hidden="true" />
      <div className="mission-path path-three" aria-hidden="true" />
      <div className={`combo-path combo-pull ${planReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-burn ${planReady ? "active warm" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-break ${planReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`kill-zone ${planReady ? "active" : ""}`}><span>DECISION AREA</span></div>
      {activeBattleHandoff && (
        <div className="battlefield-combo-beat" role="status">
          <span><Lightning weight="fill" /> COMBO WINDOW · NOW</span>
          <b>{activeComboSource.name} creates {activeBattleHandoff.maneuver.passes}</b>
          <ArrowRight weight="bold" />
          <b>{activeComboReceiver.name} reacts: {activeBattleHandoff.maneuver.name}</b>
          <small>{activeBattleHandoff.maneuver.result} · {activeBattleHandoff.maneuver.impact.text}</small>
        </div>
      )}

      {FORMATIONS.filter((formation) => activeFormations.includes(formation.id)).map((formation) => {
        const assignedNode = deployments[formation.id] ? NODES[deployments[formation.id]] : null;
        const node = assignedNode ?? STAGING_NODES[formation.id];
        const active = selected === formation.id;
        const progressShift = phase === "battle" || phase === "complete"
          ? Math.min(22, Math.floor(battleTime / 30) * 2.2)
          : 0;
        return (
          <button
            key={formation.id}
            className={`map-formation ${active ? "selected" : ""} ${phase === "battle" ? "in-motion" : ""} ${!assignedNode && (phase === "plan" || phase === "drill") ? "staged" : ""} ${activeBattleHandoff?.sourceId === formation.id ? "combo-source" : ""} ${activeBattleHandoff?.receiverId === formation.id ? "combo-receiver" : ""}`}
            style={{ left: `${node.left + progressShift}%`, top: `${node.top - progressShift * 0.45}%` }}
            onClick={() => onSelect(formation.id)}
            draggable={phase === "plan"}
            onDragStart={(event) => onFormationDragStart(event, formation.id)}
            aria-label={`${formation.name}, ${assignedNode ? formation.role : "unassigned"}, at ${node.label}`}
          >
            <FormationPortrait formation={formation} />
            <span className="map-formation-number">{formation.number}</span>
            <span className="map-formation-label">{formation.name}</span>
          </button>
        );
      })}

      <PlaybookBoard active={planReady} assignments={assignments} battleTime={battleTime} drillStep={drillStep} feedback={placementFeedback} handoffs={handoffs} onChooseRole={onChooseRole} onAssignFormation={onAssignFormation} outputs={outputs} phase={phase} playbook={playbook} profile={profile} />
      {phase === "drill" && (
        <div className="drill-status" role="status">
          <Play weight="fill" />
          <div><span>GHOST DRILL {Math.min(drillStep + 1, drillSteps.length)} / {drillSteps.length}</span><b>{drillSteps[Math.min(drillStep, drillSteps.length - 1)]}</b></div>
        </div>
      )}
      {(phase === "battle" || phase === "complete") && <BattlePulse battleTime={battleTime} events={events} />}
    </section>
  );
}

function BattlePulse({ battleTime, events }) {
  const current = [...events].reverse().find((event) => battleTime >= event.at) ?? { text: "Warhost advancing from the breach line." };
  return (
    <div className="battle-pulse" role="status" aria-live="polite">
      <Radio weight="duotone" />
      <div><span>LIVE OPERATIONS</span><b>{current.text}</b></div>
    </div>
  );
}

function EnemyPlanIntel({ battleTime, phase, planReady, clashes }) {
  return (
    <div className="intel-block enemy-plan-intel">
      <span className="panel-label">ENEMY PLAYBOOK · EXECUTES IN PARALLEL</span>
      <div className="enemy-doctrine-title"><Target weight="duotone" /><span><b>{ENEMY_PLAN.name}</b><small>{ENEMY_PLAN.intent}</small></span></div>
      <div className="enemy-chain">
        {clashes.map((clash, index) => {
          const resolved = (phase === "battle" || phase === "complete") && battleTime >= clash.actionAt;
          const state = !planReady ? "unread" : clash.disrupted ? "countered" : "threat";
          return (
            <Fragment key={clash.id}>
              <div className={`enemy-chain-step ${state} ${resolved ? "resolved" : ""}`}>
                <span className="enemy-step-number">E{index + 1}</span>
                <span className="enemy-step-copy">
                  <em>{clash.intelligence}</em>
                  <b>{clash.label}</b>
                  <small>{clash.uses ? `${clash.uses} → ` : "CREATES "}{clash.creates}</small>
                </span>
                <span className="enemy-step-result">
                  {!planReady
                    ? "OUTCOME UNREAD"
                    : clash.disrupted
                      ? `${clash.counterManeuver.name} BREAKS IT`
                      : `LANDS · ${clash.consequence}`}
                </span>
              </div>
              {index < clashes.length - 1 && <ArrowRight className="enemy-chain-arrow" weight="bold" />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function IntelRail({ phase, battleTime, planReady, rescueComplete, playbook, assignedCount, profile }) {
  const forecast = profile.overrun > 0
    ? `${profile.extractedCount} / 5 EXTRACT · +${fmtDuration(profile.overrun)} REINFORCEMENTS`
    : `${profile.extractedCount} / 5 EXTRACT · ${fmtClock(profile.completeAt)} RESERVE`;
  return (
    <section className="right-rail" aria-label="Mission outlook and enemy intelligence">
      <div className="intel-block">
        <span className="panel-label">MISSION OUTLOOK</span>
        <strong className={planReady ? profile.overrun > 0 ? "at-risk" : "viable" : "at-risk"}>{planReady ? forecast : `${assignedCount} / 5 ASSIGNED`}</strong>
        <p><b>{playbook.name}:</b> {playbook.intent}</p>
        {!planReady && phase === "plan" && <p className="assignment-pointer"><ArrowRight weight="bold" /> Place formations on the authored tactical route.</p>}
      </div>
      <EnemyPlanIntel battleTime={battleTime} phase={phase} planReady={planReady} clashes={profile.enemyClashes} />
      <div className="intel-block victory-block">
        <span className="panel-label">VICTORY CONDITION</span>
        <Factory weight="duotone" />
        <p>Sabotage Reactor Spine and extract at least 3 formations.</p>
        <small>Annihilating the enemy is not required.</small>
      </div>
      <div className="intel-block objective-progress">
        <span className="panel-label">MISSION STATE</span>
        <ProgressRow label="Alpha" done={battleTime >= profile.alphaAt} />
        <ProgressRow label="Beta" done={battleTime >= profile.betaAt} />
        <ProgressRow label="Reactor" done={battleTime >= profile.reactorAt} />
        <ProgressRow label="Salvage crew" done={rescueComplete} optional />
        <ProgressRow label="Extraction" done={phase === "complete"} />
      </div>
    </section>
  );
}

function ProgressRow({ label, done, optional = false }) {
  return (
    <div className={`progress-row ${done ? "done" : ""}`}>
      {done ? <CheckCircle weight="fill" /> : <MapPin weight="duotone" />}
      <span>{label}{optional ? " · optional" : ""}</span>
    </div>
  );
}

function FooterControls({ phase, seals, drillComplete, onDrill, onCommit, onReset, planReady, branches, onBranch }) {
  return (
    <footer className="mission-footer">
      <div className="contingency-block">
        <span className="panel-label">AUTHORED BREAKPOINTS · OVERRIDE COSTS 1 COMMAND SEAL</span>
        <div className="contingencies">
          {BREAKPOINTS.map((breakpoint, index) => {
            const selectedOption = breakpoint.options.find((option) => option.id === branches[breakpoint.id]);
            const impact = BREAKPOINT_IMPACTS[breakpoint.id][selectedOption.id];
            return (
            <div className="breakpoint" key={breakpoint.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p>{breakpoint.trigger}</p>
                <div className="branch-options">
                  {breakpoint.options.map((option) => (
                    <button
                      key={option.id}
                      className={branches[breakpoint.id] === option.id ? "selected" : ""}
                      onClick={() => onBranch(breakpoint.id, option.id)}
                      disabled={phase !== "plan"}
                      aria-pressed={branches[breakpoint.id] === option.id}
                      title={`${option.routeLabel}: ${option.effect}`}
                    >{option.label}</button>
                  ))}
                </div>
                <small className="branch-impact"><b>{selectedOption.routeLabel}</b> · {impact.text}</small>
              </div>
            </div>
            );
          })}
        </div>
      </div>
      <div className="seals-block">
        <span className="panel-label">COMMAND SEALS</span>
        <div className="seals-visual">
          <strong>{seals}</strong>
          <div>{[0, 1].map((index) => <Seal key={index} weight={index < seals ? "duotone" : "thin"} />)}</div>
        </div>
        <small>Override one order when contact changes the mission.</small>
      </div>
      <div className="primary-controls">
        {phase === "plan" || phase === "drill" ? (
          <>
            <button className={`ghost-button ${drillComplete ? "complete" : ""}`} onClick={onDrill} disabled={phase === "drill" || !planReady}>
              {phase === "drill" ? <Pause weight="fill" /> : drillComplete ? <CheckCircle weight="fill" /> : <Play weight="fill" />}
              <span><b>{phase === "drill" ? "RUNNING GHOST DRILL" : drillComplete ? "DRILL VERIFIED" : "RUN GHOST DRILL"}</b><small>Preview routes, triggers, and timing.</small></span>
            </button>
            <button className="commit-button" onClick={onCommit} disabled={!planReady}>
              <span><b>COMMIT PLAYBOOK</b><small>{planReady ? "Execute roles and authored branches." : "Resolve every required role first."}</small></span>
              <ArrowRight weight="bold" />
            </button>
          </>
        ) : (
          <button className="reset-button" onClick={onReset}>
            <ArrowCounterClockwise weight="bold" />
            <span><b>{phase === "complete" ? "RUN MISSION AGAIN" : "ABORT & RESET"}</b><small>Return to deployment planning.</small></span>
          </button>
        )}
      </div>
    </footer>
  );
}

function DecisionOverlay({ decision, seals, branches, onResolve }) {
  if (!decision) return null;
  const isBeta = decision === "beta";
  const breakpoint = BREAKPOINTS.find((item) => item.id === decision);
  const authored = breakpoint.options.find((option) => option.id === branches[decision]);
  const alternative = breakpoint.options.find((option) => option.id !== branches[decision]);
  return (
    <div className="decision-backdrop" role="dialog" aria-modal="true" aria-labelledby="decision-title">
      <div className="decision-panel">
        <div className="decision-icon"><Radio weight="duotone" /></div>
        <p className="eyebrow">PLAYBOOK BREAKPOINT</p>
        <h2 id="decision-title">{isBeta ? "Beta lane is collapsing" : "Salvage crew is cut off"}</h2>
        <p>{isBeta ? "Helioch fire has the planned transit lane ranged. Your authored response is ready for execution." : "The optional rescue now conflicts with the reactor timetable. Your playbook already contains a response."}</p>
        <div className="authored-order"><span>AUTHORED ORDER</span><b>{authored.label}</b><small>{authored.effect}</small></div>
        <div className="decision-route-compare">
          <span className="panel-label">HOW THE PLAN CHANGES</span>
          {breakpoint.options.map((option) => {
            const isAuthored = option.id === branches[decision];
            const impact = BREAKPOINT_IMPACTS[decision][option.id];
            return (
              <div className={isAuthored ? "authored" : "alternate"} key={option.id}>
                <strong>{isAuthored ? "AUTHORED PATH" : "IF OVERRIDDEN"}</strong>
                <b>{option.routeLabel}</b>
                <span>{option.path.map((step, index) => <Fragment key={step}>{index > 0 && <ArrowRight weight="bold" />}<em>{step}</em></Fragment>)}</span>
                <small className="decision-impact">{impact.text}</small>
              </div>
            );
          })}
        </div>
        <div className="decision-actions">
          <button onClick={() => onResolve("plan")}><Play weight="duotone" /><span><b>EXECUTE PLAYBOOK</b><small>{authored.label} · spend no seal.</small></span></button>
          <button className="spend-seal" onClick={() => onResolve("override")} disabled={seals <= 0}><Seal weight="duotone" /><span><b>BREAK PLAYBOOK</b><small>{alternative.label} · spend 1 seal.</small></span></button>
        </div>
      </div>
    </div>
  );
}

function FormationPicker({ role, playbook, assignments, onChoose, onClose }) {
  if (!role) return null;
  const assignedFormationId = assignments[role.id];
  return (
    <div className="decision-backdrop formation-picker-backdrop" role="dialog" aria-modal="true" aria-labelledby="formation-picker-title">
      <div className="decision-panel formation-picker-panel">
        <p className="eyebrow">STAFF ACTION STOP</p>
        <h2 id="formation-picker-title">Who executes {role.label}?</h2>
        <p>{role.brief} The route and timing are already authored. Choose the formation; its created condition and any adjacent tactical handoff are revealed after placement.</p>
        <div className="formation-picker-list">
          {FORMATIONS.map((formation) => {
            const currentRole = playbook.roles.find((item) => assignments[item.id] === formation.id);
            const currentRoleIndex = currentRole ? playbook.roles.findIndex((item) => item.id === currentRole.id) : -1;
            const current = assignedFormationId === formation.id;
            return (
              <button key={formation.id} className={current ? "current" : ""} onClick={() => onChoose(formation.id)}>
                <FormationPortrait formation={formation} compact />
                <span className="picker-formation-copy">
                  <b>{formation.name}</b>
                  <small>{formation.role} · {formation.purpose}</small>
                  <span className="tactic-vocabulary"><em>CREATES {formation.creates}</em><em>USES {formation.uses.join(" · ")}</em></span>
                  <em className={currentRole ? "assigned" : "available"}>{currentRole ? `ASSIGNED · STOP ${String(currentRoleIndex + 1).padStart(2, "0")} ${currentRole.label}` : "AVAILABLE"}</em>
                </span>
                {current ? <CheckCircle weight="fill" /> : <ArrowRight weight="bold" />}
              </button>
            );
          })}
        </div>
        <button className="picker-cancel" onClick={onClose}>{assignedFormationId ? "KEEP CURRENT PLACEMENT" : "LEAVE STOP EMPTY"}</button>
      </div>
    </div>
  );
}

function CompletionOverlay({ rescued, usedSeals, playbook, profile, onClose }) {
  const lostCount = FORMATIONS.length - profile.extractedCount;
  const disruptedEnemyOrders = profile.enemyClashes.filter((clash) => clash.disrupted).length;
  const timingResult = profile.overrun > 0
    ? `Extraction completed ${profile.overrun} seconds after Helioch reinforcements arrived.`
    : profile.timeSaved > 0
    ? `${profile.timeSaved} seconds remained in the mission window.`
    : "The Warhost cleared the gantry at the limit of the mission window.";
  return (
    <div className="decision-backdrop completion-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-title">
      <div className="decision-panel completion-panel">
        <CheckCircle className="completion-icon" weight="duotone" />
        <p className="eyebrow">OPERATION SUCCESS</p>
        <div className="victory-banner">VICTORY</div>
        <h2 id="complete-title">You won Operation Dead Circuit.</h2>
        <p>The Reactor Spine was sabotaged and {profile.extractedCount} formations escaped. Victory required the primary objective plus at least 3 extracted formations.</p>
        <div className="after-action-grid">
          <div><span>PRIMARY · COMPLETE</span><b>Reactor sabotaged</b><CheckCircle weight="fill" /></div>
          <div><span>EXTRACTION · PASSED</span><b>{profile.extractedCount} extracted · 3 required</b><CheckCircle weight="fill" /></div>
          <div><span>OPTIONAL</span><b>{rescued ? "Crew rescued" : "Crew left behind"}</b>{rescued ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}</div>
          <div><span>PLAN VS PLAN</span><b>{profile.effects.length} handoffs · {disruptedEnemyOrders} / 3 enemy orders broken</b><Seal weight="duotone" /></div>
        </div>
        <p className="completion-note">{timingResult} {lostCount === 0 ? "Every formation was recovered." : `${lostCount} ${lostCount === 1 ? "formation did" : "formations did"} not clear extraction.`} {usedSeals === 0 ? "Both authored breakpoints held under contact." : `${usedSeals} authored ${usedSeals === 1 ? "order was" : "orders were"} overridden after contact.`}</p>
        <button className="commit-button debrief-button" onClick={onClose}><span><b>RETURN TO BATTLEFIELD</b><small>Inspect the completed mission state.</small></span><ArrowRight /></button>
      </div>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState("plan");
  const [selected, setSelected] = useState("harpoon");
  const [playbookId, setPlaybookId] = useState("trapline");
  const [assignments, setAssignments] = useState(() => emptyAssignments(PLAYBOOKS[0]));
  const [branches, setBranches] = useState(defaultBranches);
  const [battleBranches, setBattleBranches] = useState(defaultBranches);
  const [drillStep, setDrillStep] = useState(-1);
  const [drillComplete, setDrillComplete] = useState(false);
  const [battleTime, setBattleTime] = useState(0);
  const [seals, setSeals] = useState(2);
  const [decision, setDecision] = useState(null);
  const [resolvedDecisions, setResolvedDecisions] = useState([]);
  const [rescueComplete, setRescueComplete] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [pickerRoleId, setPickerRoleId] = useState(null);
  const [placementFeedback, setPlacementFeedback] = useState(null);
  const timerRef = useRef(null);
  const placementRevisionRef = useRef(0);

  const playbook = useMemo(
    () => PLAYBOOKS.find((item) => item.id === playbookId) ?? PLAYBOOKS[0],
    [playbookId],
  );

  const deployments = useMemo(
    () => Object.fromEntries(playbook.roles.filter((role) => assignments[role.id]).map((role) => [assignments[role.id], role.node])),
    [assignments, playbook],
  );

  const assignedCount = useMemo(
    () => Object.values(assignments).filter(Boolean).length,
    [assignments],
  );

  const planReady = useMemo(
    () => playbook.roles.every((role) => Boolean(assignments[role.id]))
      && new Set(Object.values(assignments).filter(Boolean)).size === FORMATIONS.length,
    [assignments, playbook],
  );

  const tacticalSequence = useMemo(
    () => evaluateTacticalSequence(playbook, assignments),
    [assignments, playbook],
  );
  const tacticalHandoffs = tacticalSequence.handoffs;
  const roleOutputs = tacticalSequence.outputs;

  const activeBranches = phase === "plan" || phase === "drill" ? branches : battleBranches;

  const operationProfile = useMemo(
    () => calculateOperationProfile(tacticalHandoffs, activeBranches),
    [activeBranches, tacticalHandoffs],
  );

  const operationEvents = useMemo(
    () => buildOperationEvents(operationProfile),
    [operationProfile],
  );

  const drillSteps = useMemo(
    () => [
      `Loading ${playbook.name} geometry`,
      ...playbook.stages.map((stage) => `${stage.label} timing and support arcs confirmed`),
      ...(tacticalHandoffs.some((handoff) => handoff.maneuver)
        ? tacticalHandoffs.filter((handoff) => handoff.maneuver).map((handoff) => `${handoff.maneuver.name}: ${handoff.maneuver.passes} becomes ${handoff.maneuver.result}. ${handoff.maneuver.impact.text}`)
        : [`All ${assignedCount} formations act independently; no condition handoffs discovered`]),
      ...operationProfile.enemyClashes.map((clash) => clash.disrupted
        ? `${clash.counterManeuver.name} disrupts enemy ${clash.label}`
        : `Enemy ${clash.label} lands: ${clash.consequence}`),
      ...operationProfile.branchEffects.map((branch) => `${branch.option.label}: ${branch.impact.text}`),
      operationProfile.overrun > 0
        ? `${operationProfile.extractedCount} formations forecast to extract ${operationProfile.overrun} seconds after reinforcements arrive`
        : `${operationProfile.extractedCount} formations forecast to extract with ${operationProfile.timeSaved} seconds remaining`,
    ],
    [assignedCount, operationProfile, playbook, tacticalHandoffs],
  );

  useEffect(() => {
    if (phase !== "drill") return undefined;
    setDrillStep(0);
    const interval = window.setInterval(() => {
      setDrillStep((current) => {
        if (current >= drillSteps.length - 1) {
          window.clearInterval(interval);
          setDrillComplete(true);
          setPhase("plan");
          return current;
        }
        return current + 1;
      });
    }, 720);
    return () => window.clearInterval(interval);
  }, [phase, drillSteps.length]);

  useEffect(() => {
    if (phase !== "battle" || decision) return undefined;
    timerRef.current = window.setInterval(() => {
      setBattleTime((current) => Math.min(operationProfile.completeAt, current + 15));
    }, 620);
    return () => window.clearInterval(timerRef.current);
  }, [phase, decision, operationProfile.completeAt]);

  useEffect(() => {
    if (phase !== "battle") return;
    if (battleTime >= operationProfile.betaDecisionAt && !resolvedDecisions.includes("beta") && !decision) {
      setDecision("beta");
      return;
    }
    if (battleTime >= operationProfile.rescueDecisionAt && !resolvedDecisions.includes("rescue") && !decision) {
      setDecision("rescue");
      return;
    }
    if (battleTime >= operationProfile.completeAt) {
      setPhase("complete");
      setShowCompletion(true);
    }
  }, [battleTime, phase, decision, resolvedDecisions, operationProfile]);

  const changePlaybook = (nextId) => {
    if (phase !== "plan") return;
    const next = PLAYBOOKS.find((item) => item.id === nextId);
    if (!next) return;
    setPlaybookId(next.id);
    setAssignments(emptyAssignments(next));
    setBranches(defaultBranches());
    setBattleBranches(defaultBranches());
    setSelected("harpoon");
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillStep(-1);
    setDrillComplete(false);
  };

  const assignFormationToRole = (roleId, formationId) => {
    if (phase !== "plan" || !FORMATIONS.some((formation) => formation.id === formationId)) return;
    const targetRole = playbook.roles.find((role) => role.id === roleId);
    const sourceRole = playbook.roles.find((role) => assignments[role.id] === formationId);
    if (!targetRole) return;
    if (targetRole.id === sourceRole?.id) {
      setPickerRoleId(null);
      return;
    }
    const nextAssignments = {
      ...assignments,
      ...(sourceRole ? { [sourceRole.id]: assignments[targetRole.id] ?? null } : {}),
      [targetRole.id]: formationId,
    };
    const previousSequence = evaluateTacticalSequence(playbook, assignments);
    const nextSequence = evaluateTacticalSequence(playbook, nextAssignments);
    const previousProfile = calculateOperationProfile(previousSequence.handoffs, activeBranches);
    const nextProfile = calculateOperationProfile(nextSequence.handoffs, activeBranches);
    const previousLinks = previousSequence.handoffs.filter((handoff) => handoff.maneuver).length;
    const nextLinks = nextSequence.handoffs.filter((handoff) => handoff.maneuver).length;
    const targetIndex = playbook.roles.findIndex((role) => role.id === targetRole.id);
    const sourceIndex = sourceRole ? playbook.roles.findIndex((role) => role.id === sourceRole.id) : targetIndex;
    const previousReady = playbook.roles.every((role) => Boolean(assignments[role.id]));
    const nextReady = playbook.roles.every((role) => Boolean(nextAssignments[role.id]));
    const previousWindow = previousProfile.timeSaved - previousProfile.overrun;
    const nextWindow = nextProfile.timeSaved - nextProfile.overrun;
    const improved = nextLinks > previousLinks || nextProfile.extractedCount > previousProfile.extractedCount || nextWindow > previousWindow;
    const weakened = nextLinks < previousLinks || nextProfile.extractedCount < previousProfile.extractedCount || nextWindow < previousWindow;
    const tone = nextReady && !previousReady ? "strengthened" : weakened ? "weakened" : improved ? "strengthened" : "rewired";
    const title = nextReady && !previousReady ? "PLAN ONLINE" : tone === "weakened" ? "CHAIN BROKEN" : tone === "strengthened" ? "CHAIN STRENGTHENED" : "CHAIN REWIRED";
    const forecast = nextReady
      ? nextProfile.overrun > 0
        ? `${nextProfile.extractedCount} / 5 EXTRACT · +${fmtDuration(nextProfile.overrun)} REINFORCEMENTS`
        : `${nextProfile.extractedCount} / 5 EXTRACT · ${fmtClock(nextProfile.completeAt)} RESERVE`
      : `${Object.values(nextAssignments).filter(Boolean).length} / 5 FORMATIONS PLACED`;

    placementRevisionRef.current += 1;
    setPlacementFeedback({
      revision: placementRevisionRef.current,
      affectedFrom: Math.min(targetIndex, sourceIndex),
      changedIndices: [...new Set([targetIndex, sourceIndex])],
      targetIndex,
      formationName: FORMATIONS.find((formation) => formation.id === formationId).name,
      beforeLinks: previousLinks,
      afterLinks: nextLinks,
      forecast,
      title,
      tone,
    });
    setAssignments(nextAssignments);
    setSelected(formationId);
    setPickerRoleId(null);
    setDrillComplete(false);
  };

  const chooseFormationForRole = (formationId) => {
    if (!pickerRoleId) return;
    assignFormationToRole(pickerRoleId, formationId);
  };

  const beginFormationDrag = (event, formationId) => {
    if (phase !== "plan" || !FORMATIONS.some((formation) => formation.id === formationId)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-warhost-formation", formationId);
    event.dataTransfer.setData("text/plain", formationId);
    setSelected(formationId);
  };

  const chooseBranch = (breakpointId, optionId) => {
    if (phase !== "plan") return;
    const breakpoint = BREAKPOINTS.find((item) => item.id === breakpointId);
    if (!breakpoint?.options.some((option) => option.id === optionId)) return;
    setBranches((current) => ({ ...current, [breakpointId]: optionId }));
    setDrillComplete(false);
  };

  const resolveDecision = (choice) => {
    if (choice === "override" && seals <= 0) return;
    const breakpoint = BREAKPOINTS.find((item) => item.id === decision);
    const plannedOption = branches[decision];
    const chosenOption = choice === "override"
      ? breakpoint.options.find((option) => option.id !== plannedOption)?.id
      : plannedOption;
    if (choice === "override" && seals > 0) {
      setSeals((current) => current - 1);
    }
    setBattleBranches((current) => ({ ...current, [decision]: chosenOption }));
    if (decision === "rescue") setRescueComplete(Boolean(BREAKPOINT_IMPACTS[decision][chosenOption].rescue));
    setResolvedDecisions((current) => [...current, decision]);
    setDecision(null);
  };

  const commitMission = () => {
    if (!planReady) return;
    setPhase("battle");
    setBattleBranches({ ...branches });
    setBattleTime(0);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setSeals(2);
    setShowCompletion(false);
  };

  const resetMission = () => {
    setPhase("plan");
    setBattleTime(0);
    setPlaybookId("trapline");
    setAssignments(emptyAssignments(PLAYBOOKS[0]));
    setBranches(defaultBranches());
    setBattleBranches(defaultBranches());
    setSelected("harpoon");
    setDrillStep(-1);
    setDrillComplete(false);
    setSeals(2);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setPickerRoleId(null);
    setPlacementFeedback(null);
  };

  return (
    <main className={`warhost-app ${phase}`}>
      <AppHeader phase={phase} battleTime={battleTime} profile={operationProfile} />
      <div className="mission-shell">
        <FormationRoster selected={selected} onSelect={setSelected} assignments={assignments} playbook={playbook} onPlaybook={changePlaybook} phase={phase} onFormationDragStart={beginFormationDrag} />
        <Battlefield selected={selected} onSelect={setSelected} deployments={deployments} phase={phase} battleTime={battleTime} drillStep={drillStep} placementFeedback={placementFeedback} planReady={planReady} playbook={playbook} drillSteps={drillSteps} assignments={assignments} branches={activeBranches} handoffs={tacticalHandoffs} outputs={roleOutputs} profile={operationProfile} events={operationEvents} onChooseRole={setPickerRoleId} onAssignFormation={assignFormationToRole} onFormationDragStart={beginFormationDrag} />
        <IntelRail phase={phase} battleTime={battleTime} planReady={planReady} rescueComplete={rescueComplete} playbook={playbook} assignedCount={assignedCount} profile={operationProfile} />
      </div>
      <FooterControls phase={phase} seals={seals} drillComplete={drillComplete} onDrill={() => setPhase("drill")} onCommit={commitMission} onReset={resetMission} planReady={planReady} branches={activeBranches} onBranch={chooseBranch} />
      <DecisionOverlay decision={decision} seals={seals} branches={branches} onResolve={resolveDecision} />
      <FormationPicker role={playbook.roles.find((role) => role.id === pickerRoleId)} playbook={playbook} assignments={assignments} onChoose={chooseFormationForRole} onClose={() => setPickerRoleId(null)} />
      {showCompletion && <CompletionOverlay rescued={rescueComplete} usedSeals={2 - seals} playbook={playbook} profile={operationProfile} onClose={() => setShowCompletion(false)} />}
    </main>
  );
}
