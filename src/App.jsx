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
    capabilities: ["CONTROL", "MOBILITY"],
    refits: [
      { id: "winch", name: "GRAVITIC WINCH", summary: "Control package built for forced movement.", capabilities: ["CONTROL", "MOBILITY"], creates: "DISPLACED" },
      { id: "magnet", name: "BREACH MAGNET", summary: "Trades transit speed for armor-shearing force.", capabilities: ["CONTROL", "BREACH"], creates: "FRACTURED ARMOR" },
    ],
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
    capabilities: ["DENIAL", "AREA"],
    refits: [
      { id: "jets", name: "SMELTER JETS", summary: "Wide thermal denial across exposed lanes.", capabilities: ["DENIAL", "AREA"], creates: "OVERHEATED" },
      { id: "crucible", name: "ASH CRUCIBLE", summary: "Trades area pressure for a moving smoke screen.", capabilities: ["DENIAL", "COVER"], creates: "SCREENED" },
    ],
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
    capabilities: ["BREACH", "SHOCK"],
    refits: [
      { id: "ram", name: "RAM FRAME", summary: "Direct shock package for rupturing a fixed target.", capabilities: ["BREACH", "SHOCK"], creates: "BREACHED" },
      { id: "charge", name: "FRACTURE CHARGE", summary: "Trades shock control for a wider armor break.", capabilities: ["BREACH", "AREA"], creates: "FRACTURED ARMOR" },
    ],
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
    capabilities: ["HOLD", "COVER"],
    refits: [
      { id: "plates", name: "BASTION PLATES", summary: "Armored screen for holding captured ground.", capabilities: ["HOLD", "COVER"], creates: "SCREENED" },
      { id: "sled", name: "SUPPLY SLED", summary: "Trades frontal cover for forward sustainment.", capabilities: ["HOLD", "SUPPORT"], creates: "SUPPLIED" },
    ],
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
    capabilities: ["RECOVERY", "SUPPORT"],
    refits: [
      { id: "crane", name: "RECOVERY CRANE", summary: "Sustainment rig for damaged formations and crew.", capabilities: ["RECOVERY", "SUPPORT"], creates: "SUPPLIED" },
      { id: "shield", name: "EVAC SHIELD", summary: "Trades repair throughput for protected movement.", capabilities: ["RECOVERY", "COVER"], creates: "SCREENED" },
    ],
    purpose: "Recover the crew and damaged formations.",
    creates: "SUPPLIED",
    uses: ["OVERHEATED", "BREACHED", "SCREENED", "OPEN CORE", "SECURED BREACH", "SECURED CORRIDOR"],
    asset: "/assets/salvage-hauler.png",
    icon: Truck,
    defaultNode: "recoveryLine",
  },
];

const defaultRefits = () => Object.fromEntries(
  FORMATIONS.map((formation) => [formation.id, formation.refits[0].id]),
);

const resolveFormations = (selections) => FORMATIONS.map((formation) => {
  const activeRefit = formation.refits.find((refit) => refit.id === selections[formation.id]) ?? formation.refits[0];
  return {
    ...formation,
    capabilities: activeRefit.capabilities,
    creates: activeRefit.creates,
    activeRefit,
  };
});

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
      { id: "pull", label: "PULL / DISPLACER", brief: "Draw Alpha into the kill zone.", node: "alphaApproach", demands: ["CONTROL", "SHOCK"] },
      { id: "burn", label: "BURN / DENIER", brief: "Seal the hostile response lane.", node: "fireLine", demands: ["DENIAL", "COVER"] },
      { id: "break", label: "BREAK / BREACHER", brief: "Exploit the opened route.", node: "breachLine", demands: ["BREACH", "CONTROL"] },
      { id: "anchor", label: "ANCHOR", brief: "Hold the captured control node.", node: "anchorLine", demands: ["HOLD", "DENIAL"] },
      { id: "recover", label: "RECOVERY", brief: "Preserve extraction capacity.", node: "recoveryLine", demands: ["RECOVERY", "SUPPORT"] },
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
      { id: "screen", label: "SCREEN", brief: "Take first contact at Alpha.", node: "alphaApproach", demands: ["COVER", "SHOCK"] },
      { id: "point", label: "POINT", brief: "Mark the narrow transit lane.", node: "highWalk", demands: ["MOBILITY", "SHOCK"] },
      { id: "punch", label: "PUNCH / BREACHER", brief: "Crack Beta and the reactor shell.", node: "breachLine", demands: ["BREACH", "CONTROL"] },
      { id: "suppress", label: "SUPPRESSION", brief: "Deny flanking reinforcements.", node: "fireLine", demands: ["DENIAL", "COVER"] },
      { id: "recover", label: "RECOVERY", brief: "Follow the armored corridor.", node: "recoveryLine", demands: ["RECOVERY", "SUPPORT"] },
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
      { id: "alpha", label: "ALPHA PIN", brief: "Hold the known defenders in place.", node: "alphaApproach", demands: ["HOLD", "CONTROL"] },
      { id: "beta", label: "BETA RAID", brief: "Pressure the uncertain control node.", node: "betaLane", demands: ["MOBILITY", "SHOCK"] },
      { id: "deny", label: "LANE DENIAL", brief: "Prevent either defense from reinforcing.", node: "fireLine", demands: ["DENIAL", "COVER"] },
      { id: "reactor", label: "REACTOR TEAM", brief: "Converge through the opening and sabotage.", node: "breachLine", demands: ["BREACH", "CONTROL"] },
      { id: "recover", label: "EXTRACTION", brief: "Collect the split force at the gantry.", node: "recoveryLine", demands: ["RECOVERY", "HOLD"] },
    ],
  },
];

const MISSION_CONDITIONS = [
  {
    id: "clear",
    name: "CLEAR LANES",
    brief: "Foundry access is intact.",
    effect: "Authored task profiles are unchanged.",
    roleOverrides: {},
  },
  {
    id: "blackout",
    name: "SENSOR BLACKOUT",
    brief: "Smoke severs visual contact across the approach.",
    effect: "STOP 01 demands COVER / SHOCK. STOP 04 demands CONTROL / DENIAL.",
    roleOverrides: {
      0: ["COVER", "SHOCK"],
      3: ["CONTROL", "DENIAL"],
    },
  },
  {
    id: "surge",
    name: "REACTOR SURGE",
    brief: "Core venting scrambles the center lane.",
    effect: "STOP 02 demands BREACH / CONTROL. STOP 03 demands DENIAL / COVER.",
    roleOverrides: {
      1: ["BREACH", "CONTROL"],
      2: ["DENIAL", "COVER"],
    },
  },
];

const OPERATIONS = [
  {
    id: "dead-circuit",
    name: "OPERATION DEAD CIRCUIT",
    shortName: "Dead Circuit",
    type: "SABOTAGE & EXTRACT",
    conditionId: "clear",
    conditionLocked: false,
    requiredExtraction: 3,
    orders: ["SEIZE BOTH NODES", "SABOTAGE REACTOR", "EXTRACT 3+ FORMATIONS"],
    victory: "Sabotage Reactor Spine and extract at least 3 formations.",
    primaryTitle: "REACTOR SPINE",
    primaryDescription: "Primary sabotage target",
    primaryDone: "SABOTAGED",
    primaryProgress: "Reactor",
    primaryResult: "Reactor sabotaged",
    extractionTitle: "EXTRACTION GANTRY",
    primaryEvent: "Reactor Spine sabotaged. Extraction route open.",
    primaryApproachEvent: "Reactor Spine exposed. Breach force advancing.",
    firstDecisionEvent: "Helioch fire closes the Beta transit lane. Breakpoint order required.",
    secondDecisionEvent: "Salvage crew located below the reactor deck.",
    controlTitles: ["CONTROL NODE ALPHA", "CONTROL NODE BETA"],
    controlProgress: ["Alpha", "Beta"],
    entryPlanTitle: "FORMATION STAGING",
    entryBattleTitle: "ENTRY / BREACH",
    optionalTitle: "RESCUE SALVAGE CREW",
    optionalDescription: "Optional · field repair reward",
    battlefieldAlt: "Isometric industrial foundry battlefield",
  },
  {
    id: "ashen-passage",
    name: "OPERATION ASHEN PASSAGE",
    shortName: "Ashen Passage",
    type: "HOLD & EVACUATE",
    conditionId: "blackout",
    conditionLocked: true,
    requiredExtraction: 4,
    orders: ["OPEN BOTH EMBER GATES", "HOLD SIGNAL FURNACE", "EXTRACT 4+ FORMATIONS"],
    victory: "Hold the Signal Furnace relay and extract at least 4 formations.",
    primaryTitle: "SIGNAL FURNACE",
    primaryDescription: "Maintain the evacuation uplink",
    primaryDone: "RELAY HELD",
    primaryProgress: "Signal Furnace",
    primaryResult: "Signal Furnace held",
    extractionTitle: "VOID LIFT GANTRY",
    primaryEvent: "Signal Furnace relay held. Void Lift corridor open.",
    primaryApproachEvent: "Signal Furnace contact restored. Relay guard advancing.",
    firstDecisionEvent: "Black Litany ash closes Ember Gate East. Breakpoint order required.",
    secondDecisionEvent: "Relay crew broadcasts from the lower furnace deck.",
    controlTitles: ["EMBER GATE WEST", "EMBER GATE EAST"],
    controlProgress: ["Ember Gate West", "Ember Gate East"],
    entryPlanTitle: "ASH DROP STAGING",
    entryBattleTitle: "SOUTHERN ASH DROP",
    optionalTitle: "RECOVER RELAY CREW",
    optionalDescription: "Optional · preserve furnace intelligence",
    battlefieldAlt: "Smoke-obscured void furnace evacuation battlefield",
  },
];

const ASHEN_PASSAGE_PLAYBOOK_COPY = {
  trapline: {
    intent: "Open Ember Gate West by forcing veil units through overlapping fires.",
    briefs: ["Draw the western screen into the lit kill zone.", "Seal the hostile ash lane.", "Exploit the opened relay route.", "Hold the Signal Furnace uplink.", "Preserve Void Lift capacity."],
  },
  spear: {
    intent: "Concentrate protection around one decisive drive to the Signal Furnace.",
    briefs: ["Take first contact at Ember Gate West.", "Mark the smoke-obscured transit lane.", "Crack the eastern gate and relay guard.", "Deny the north-shaft reserve.", "Follow the protected route to Void Lift."],
  },
  pressure: {
    intent: "Split the veil at both Ember Gates, then reunite around the relay.",
    briefs: ["Hold the western gate screen in place.", "Pressure the uncertain eastern gate.", "Prevent either screen from reinforcing.", "Converge through the smoke and hold the relay.", "Collect the split force at Void Lift."],
  },
};

const playbookForOperation = (playbook, operation) => {
  if (operation?.id !== "ashen-passage") return playbook;
  const copy = ASHEN_PASSAGE_PLAYBOOK_COPY[playbook.id];
  if (!copy) return playbook;
  return {
    ...playbook,
    intent: copy.intent,
    roles: playbook.roles.map((role, index) => ({ ...role, brief: copy.briefs[index] ?? role.brief })),
  };
};

const roleDemandsFor = (role, index, condition) => condition.roleOverrides[index] ?? role.demands;

const DEAD_CIRCUIT_BREAKPOINTS = [
  {
    id: "beta",
    title: "Beta lane is collapsing",
    description: "Helioch fire has the planned transit lane ranged. Your authored response is ready for execution.",
    trigger: "IF Beta lane is ranged",
    options: [
      { id: "tempo", label: "PRESERVE TEMPO", effect: "Cross exposed; keep reactor timing.", routeLabel: "DIRECT CROSSING", path: ["BETA LANE", "REACTOR"] },
      { id: "protect", label: "PROTECT BREACHER", effect: "Lay smoke and divert the thrust.", routeLabel: "COVERED DIVERSION", path: ["SMOKE LINE", "COVERED ARC", "REACTOR"] },
    ],
    defaultOption: "tempo",
  },
  {
    id: "rescue",
    title: "Salvage crew is cut off",
    description: "The optional rescue now conflicts with the reactor timetable. Your playbook already contains a response.",
    trigger: "IF salvage crew is located",
    options: [
      { id: "clock", label: "PRESERVE CLOCK", effect: "Leave the crew; secure extraction.", routeLabel: "BYPASS SALVAGE", path: ["REACTOR", "EXTRACTION"] },
      { id: "recover", label: "RECOVER CREW", effect: "Divert the Hauler before sabotage.", routeLabel: "RECOVERY LOOP", path: ["REACTOR", "SALVAGE PEN", "EXTRACTION"] },
    ],
    defaultOption: "clock",
  },
];

const ASHEN_PASSAGE_BREAKPOINTS = [
  {
    id: "beta",
    title: "Ash veil closes Ember Gate East",
    description: "The Black Litany has drowned the eastern route in furnace smoke. Your authored crossing order is ready.",
    trigger: "IF Ember Gate East is obscured",
    options: [
      { id: "tempo", label: "CROSS ON INSTRUMENTS", effect: "Trust the route marks; preserve relay timing.", routeLabel: "BLIND CROSSING", path: ["EMBER GATE EAST", "SIGNAL FURNACE"] },
      { id: "protect", label: "LIGHT BEACON ROUTE", effect: "Mark a longer protected approach through the ash.", routeLabel: "BEACON DIVERSION", path: ["EMBER GATE EAST", "BEACON ARC", "SIGNAL FURNACE"] },
    ],
    defaultOption: "tempo",
  },
  {
    id: "rescue",
    title: "Relay crew is broadcasting",
    description: "The stranded furnace crew can be recovered, but the Void Lift window is already closing.",
    trigger: "IF relay crew broadcasts",
    options: [
      { id: "clock", label: "HOLD LIFT WINDOW", effect: "Leave the crew below; secure the evacuation corridor.", routeLabel: "BYPASS CREW", path: ["SIGNAL FURNACE", "VOID LIFT"] },
      { id: "recover", label: "RECOVER RELAY CREW", effect: "Divert the Hauler through the lower furnace deck.", routeLabel: "RELAY RECOVERY", path: ["SIGNAL FURNACE", "RELAY DECK", "VOID LIFT"] },
    ],
    defaultOption: "clock",
  },
];

const BREAKPOINTS_BY_OPERATION = {
  "dead-circuit": DEAD_CIRCUIT_BREAKPOINTS,
  "ashen-passage": ASHEN_PASSAGE_BREAKPOINTS,
};

const breakpointsFor = (operation) => BREAKPOINTS_BY_OPERATION[operation?.id] ?? DEAD_CIRCUIT_BREAKPOINTS;

const DEAD_CIRCUIT_BREAKPOINT_IMPACTS = {
  beta: {
    tempo: { text: "No delay · Breacher remains exposed" },
    protect: { reactorDelay: 15, missionDelay: 15, protects: 1, text: "+00:15 · one formation protected" },
  },
  rescue: {
    clock: { text: "No delay · salvage crew left behind" },
    recover: { missionDelay: 15, protects: 1, rescue: true, text: "+00:15 · crew rescued · one formation protected" },
  },
};

const ASHEN_PASSAGE_BREAKPOINT_IMPACTS = {
  beta: {
    tempo: { text: "No delay · relay guard crosses blind" },
    protect: { reactorDelay: 15, missionDelay: 15, protects: 1, text: "+00:15 · one formation protected" },
  },
  rescue: {
    clock: { text: "No delay · relay crew left below" },
    recover: { missionDelay: 15, protects: 1, rescue: true, text: "+00:15 · crew recovered · one formation protected" },
  },
};

const BREAKPOINT_IMPACTS_BY_OPERATION = {
  "dead-circuit": DEAD_CIRCUIT_BREAKPOINT_IMPACTS,
  "ashen-passage": ASHEN_PASSAGE_BREAKPOINT_IMPACTS,
};

const breakpointImpactsFor = (operation) => BREAKPOINT_IMPACTS_BY_OPERATION[operation?.id] ?? DEAD_CIRCUIT_BREAKPOINT_IMPACTS;

const DEAD_CIRCUIT_ENEMY_PLAN = {
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

const ASHEN_PASSAGE_ENEMY_PLAN = {
  name: "BLACK LITANY",
  intent: "Blind the Ember Gates, silence the relay, then occupy the Void Lift.",
  formations: [
    { id: "veil", number: "E1", name: "VEIL ENGINES", start: { x: 95, y: 67 }, end: { x: 61, y: 23 }, actionAt: 90 },
    { id: "ward", number: "E2", name: "OATH WARD", start: { x: 97, y: 45 }, end: { x: 72, y: 39 }, actionAt: 225 },
    { id: "ascendant", number: "E3", name: "ASCENDANT GUARD", start: { x: 82, y: 3 }, end: { x: 89, y: 15 }, actionAt: 330 },
  ],
  stages: [
    {
      id: "veil",
      formationId: "veil",
      label: "ASH VEIL",
      creates: "BLINDED CORRIDOR",
      intelligence: "KNOWN",
      counteredBy: ["COVERED DRAG", "POWER WINCH", "FURNACE DRAGNET", "ASHEN CORDON"],
      impact: { reactorDelay: 15 },
      consequence: "Signal relay delayed +00:15",
    },
    {
      id: "silence",
      formationId: "ward",
      label: "FURNACE SILENCE",
      uses: "BLINDED CORRIDOR",
      creates: "RELAY LOCK",
      intelligence: "UNCERTAIN",
      counteredBy: ["THERMAL BREACH", "COVERED ADVANCE", "LOCKED BREACH", "WEDGE & WALL", "LOCKSTEP HOLD"],
      impact: { missionDelay: 15 },
      consequence: "Void Lift opening delayed +00:15",
    },
    {
      id: "occupy",
      formationId: "ascendant",
      label: "LIFT OCCUPATION",
      uses: "RELAY LOCK",
      creates: "LIFT SEALED",
      intelligence: "UNKNOWN",
      counteredBy: ["ARMORED EVAC", "HOT RECOVERY", "BREACH RECOVERY", "MOBILE RESUPPLY"],
      impact: { recoveryLoss: 1 },
      consequence: "One formation sealed below the Void Lift",
    },
  ],
};

const ENEMY_PLANS = {
  "dead-circuit": DEAD_CIRCUIT_ENEMY_PLAN,
  "ashen-passage": ASHEN_PASSAGE_ENEMY_PLAN,
};

const enemyPlanFor = (operation) => ENEMY_PLANS[operation?.id] ?? DEAD_CIRCUIT_ENEMY_PLAN;

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

const ASHEN_PASSAGE_FIELD_PLANS = {
  trapline: {
    positions: [
      { x: 29, y: 42 },
      { x: 43, y: 49 },
      { x: 57, y: 40 },
      { x: 68, y: 31 },
      { x: 79, y: 24 },
    ],
    routes: [
      { role: 0, start: { x: 15, y: 73 }, points: [0, "alpha", { x: 45, y: 31 }] },
      { role: 1, start: { x: 24, y: 79 }, points: [1, { x: 51, y: 46 }, "beta"] },
      { role: 2, start: { x: 34, y: 75 }, points: [2], breakpoint: "beta" },
      { role: 3, start: { x: 44, y: 81 }, points: [3, "reactor"] },
      { role: 4, start: { x: 54, y: 77 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 2, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [2, "reactor"],
        protect: [2, { x: 59, y: 27 }, { x: 68, y: 22 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
  spear: {
    positions: [
      { x: 28, y: 46 },
      { x: 42, y: 35 },
      { x: 56, y: 43 },
      { x: 65, y: 51 },
      { x: 79, y: 25 },
    ],
    routes: [
      { role: 0, start: { x: 15, y: 73 }, points: [0, "alpha"] },
      { role: 1, start: { x: 24, y: 79 }, points: [1, "beta"] },
      { role: 2, start: { x: 34, y: 75 }, points: [2], breakpoint: "beta" },
      { role: 3, start: { x: 44, y: 81 }, points: [3, "reactor"] },
      { role: 4, start: { x: 54, y: 77 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 2, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [2, "reactor"],
        protect: [2, { x: 58, y: 30 }, { x: 67, y: 23 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
  pressure: {
    positions: [
      { x: 28, y: 40 },
      { x: 55, y: 27 },
      { x: 43, y: 51 },
      { x: 66, y: 41 },
      { x: 79, y: 25 },
    ],
    routes: [
      { role: 0, start: { x: 15, y: 73 }, points: [0, "alpha"] },
      { role: 1, start: { x: 24, y: 79 }, points: [1, "beta"] },
      { role: 2, start: { x: 34, y: 75 }, points: [2, { x: 52, y: 45 }] },
      { role: 3, start: { x: 44, y: 81 }, points: [3], breakpoint: "beta" },
      { role: 4, start: { x: 54, y: 77 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 3, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [3, "reactor"],
        protect: [3, { x: 60, y: 28 }, { x: 68, y: 22 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
};

const ASHEN_PASSAGE_LANDMARKS = {
  alpha: { x: 29, y: 32 },
  beta: { x: 61, y: 21 },
  reactor: { x: 72, y: 40 },
  extraction: { x: 91, y: 13 },
  rescue: { x: 84, y: 68 },
};

const OPERATION_FIELDS = {
  "dead-circuit": { plans: FIELD_PLANS, landmarks: FIELD_LANDMARKS },
  "ashen-passage": { plans: ASHEN_PASSAGE_FIELD_PLANS, landmarks: ASHEN_PASSAGE_LANDMARKS },
};

const operationFieldFor = (operation) => OPERATION_FIELDS[operation?.id] ?? OPERATION_FIELDS["dead-circuit"];

const BASE_OPERATION = {
  alphaAt: 60,
  betaAt: 150,
  reactorAt: 300,
  extractionAt: 345,
  completeAt: 360,
};

const COMBO_CONFIRMATION_MS = 2600;
const IMPROVISED_TASK_DELAY = 15;

const DEAD_CIRCUIT_REINFORCEMENT_WAVE = {
  number: "E4",
  name: "HELIOCH RELIEF COLUMN",
  order: "GANTRY INTERCEPT",
  approach: "EAST ENTRY → GANTRY INTERCEPT",
  arrivalAt: BASE_OPERATION.completeAt,
  approachDuration: 45,
  start: { x: 97, y: 26 },
  intercept: { x: 86, y: 29 },
};

const ASHEN_PASSAGE_REINFORCEMENT_WAVE = {
  number: "E4",
  name: "CENSER RESERVE",
  order: "VOID LIFT OCCUPATION",
  approach: "NORTH SHAFT → VOID LIFT",
  arrivalAt: BASE_OPERATION.completeAt,
  approachDuration: 45,
  start: { x: 91, y: 1 },
  intercept: { x: 88, y: 14 },
};

const REINFORCEMENT_WAVES = {
  "dead-circuit": DEAD_CIRCUIT_REINFORCEMENT_WAVE,
  "ashen-passage": ASHEN_PASSAGE_REINFORCEMENT_WAVE,
};

const reinforcementWaveFor = (operation) => REINFORCEMENT_WAVES[operation?.id] ?? DEAD_CIRCUIT_REINFORCEMENT_WAVE;

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

const evaluateTacticalSequence = (playbook, assignments, formations) => {
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

    const reaction = previousFormation && carriedCondition && formation.uses.includes(carriedCondition)
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

const calculatePlacementReadiness = (playbook, assignments, handoffs, condition, formations) => Object.fromEntries(
  playbook.roles.map((role, index) => {
    const formationId = assignments[role.id];
    if (!formationId) return [role.id, null];

    const formation = formations.find((item) => item.id === formationId);
    const demands = roleDemandsFor(role, index, condition);
    const matchedCapabilities = demands.filter((demand) => formation.capabilities.includes(demand));
    const taskAligned = matchedCapabilities.length > 0;
    const inboundReaction = index > 0 && Boolean(handoffs[index - 1]?.maneuver);
    const outboundLink = index < handoffs.length && Boolean(handoffs[index]?.maneuver);
    const score = Math.min(100, 52 + (taskAligned ? 20 : 0) + (inboundReaction ? 14 : 0) + (outboundLink ? 14 : 0));
    const label = score >= 95 ? "SYNCHRONIZED" : score >= 80 ? "READY" : score >= 65 ? "CAPABLE" : "STRAINED";

    return [role.id, {
      score,
      label,
      taskAligned,
      taskDelay: taskAligned ? 0 : IMPROVISED_TASK_DELAY,
      demands,
      matchedCapabilities,
      inboundReaction,
      outboundLink,
    }];
  }),
);

const summarizePlacementReadiness = (readiness) => {
  const staffed = Object.values(readiness).filter(Boolean);
  const alignedCount = staffed.filter((item) => item.taskAligned).length;
  const improvisedCount = staffed.length - alignedCount;
  const totalScore = staffed.reduce((sum, item) => sum + item.score, 0);
  return {
    staffedCount: staffed.length,
    alignedCount,
    improvisedCount,
    average: staffed.length > 0 ? Math.round(totalScore / staffed.length) : 0,
    delay: improvisedCount * IMPROVISED_TASK_DELAY,
  };
};

const calculateEnemyClashes = (maneuvers, operation) => {
  const enemyPlan = enemyPlanFor(operation);
  return enemyPlan.stages.map((stage) => {
  const counterManeuver = maneuvers.find((maneuver) => stage.counteredBy.includes(maneuver.name));
  const formation = enemyPlan.formations.find((item) => item.id === stage.formationId);
  return {
    ...stage,
    actionAt: formation.actionAt,
    disrupted: Boolean(counterManeuver),
    counterManeuver,
  };
  });
};

const calculateOperationProfile = (handoffs, branchChoices, readiness, condition, operation) => {
  const maneuvers = handoffs.filter((handoff) => handoff.maneuver).map((handoff) => handoff.maneuver);
  const readinessSummary = summarizePlacementReadiness(readiness);
  const total = (key) => maneuvers.reduce((sum, maneuver) => sum + (maneuver.impact[key] ?? 0), 0);
  const enemyClashes = calculateEnemyClashes(maneuvers, operation);
  const enemyTotal = (key) => enemyClashes.reduce((sum, clash) => sum + (clash.disrupted ? 0 : clash.impact[key] ?? 0), 0);
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
  const alphaAt = Math.max(30, BASE_OPERATION.alphaAt - total("alpha"));
  const betaAt = Math.max(alphaAt + 45, BASE_OPERATION.betaAt - total("beta"));
  const betaDecisionAt = Math.max(alphaAt + 15, betaAt - 45);
  const reactorAt = Math.max(betaAt + 60, BASE_OPERATION.reactorAt - total("reactor") + branchTotal("reactorDelay") + enemyTotal("reactorDelay"));
  const reactorExposeAt = Math.max(betaAt + 30, reactorAt - 45);
  const rescueDecisionAt = Math.max(betaAt + 30, Math.min(210, reactorExposeAt - 15));
  const extractionAt = Math.max(reactorAt + 30, BASE_OPERATION.extractionAt - total("extraction")) + branchTotal("missionDelay") + enemyTotal("missionDelay") + readinessSummary.delay;
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
    readiness: readinessSummary,
    condition,
    effects: maneuvers,
  };
};

const comboWindowTimes = (profile) => [
  profile.alphaAt,
  profile.betaAt,
  profile.reactorExposeAt,
  profile.extractionAt,
];

const buildOperationEvents = (profile, operation) => {
  const reinforcementWave = reinforcementWaveFor(operation);
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
      text: clash.disrupted
        ? `${clash.counterManeuver.name} breaks the Helioch ${clash.label}.`
        : `${clash.label} lands. ${clash.consequence}.`,
    });
  });
  if (profile.overrun > 0) events.push({ at: reinforcementWave.arrivalAt, text: `${reinforcementWave.name} reaches the ${operation.extractionTitle}. ${profile.reinforcementLoss} formation recovery lost.` });
  return events.sort((left, right) => left.at - right.at);
};

const defaultBranches = (operation = OPERATIONS[0]) => Object.fromEntries(
  breakpointsFor(operation).map((breakpoint) => [breakpoint.id, breakpoint.defaultOption]),
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

const reinforcementForecast = (profile) => profile.overrun > 0
  ? `WAVE ARRIVES ${fmtDuration(profile.overrun)} BEFORE CLEAR`
  : `CLEAR ${fmtDuration(profile.timeSaved)} BEFORE ENEMY WAVE`;

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

function AppHeader({ phase, battleTime, operation, operationIndex, profile }) {
  const reinforcementWave = reinforcementWaveFor(operation);
  const reinforcementsEngaged = (phase === "battle" || phase === "complete") && battleTime >= reinforcementWave.arrivalAt;
  const clock = phase === "plan" || phase === "drill"
    ? { label: "ENEMY WAVE IN", value: fmtDuration(reinforcementWave.arrivalAt), detail: reinforcementWave.name }
    : phase === "complete"
      ? profile.overrun > 0
        ? { label: "ENEMY WAVE CONTACT", value: fmtDuration(profile.overrun), detail: "BEFORE EXTRACTION CLEAR" }
        : { label: "EXTRACTION CLEAR", value: fmtDuration(profile.timeSaved), detail: "BEFORE ENEMY WAVE" }
      : reinforcementsEngaged
        ? { label: "ENEMY WAVE ENGAGED", value: `+${fmtDuration(battleTime - reinforcementWave.arrivalAt)}`, detail: reinforcementWave.order }
        : { label: "ENEMY WAVE IN", value: fmtClock(battleTime), detail: reinforcementWave.approach };
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
          <p className="operation-title">{operation.name}</p>
          <p className="operation-type">{operation.type} · RUN {operationIndex + 1} / {OPERATIONS.length}</p>
        </div>
        <div className="reinforcement-clock" aria-live="polite">
          <span>{clock.label}</span>
          <strong>{clock.value}</strong>
          <small>{clock.detail}</small>
        </div>
      </div>
    </header>
  );
}

function FormationDossier({ formation, assignedRole, assignedIndex, readiness, phase, refitsLocked, onRefit }) {
  if (!formation) return null;
  const Icon = formation.icon;
  const observations = readiness ? [
    readiness.taskAligned ? "TASK ALIGNED" : `IMPROVISED / +${fmtDuration(readiness.taskDelay)}`,
    readiness.inboundReaction ? "INBOUND REACTION" : "NO INBOUND REACTION",
    readiness.outboundLink ? "FEEDS NEXT STOP" : "NO OUTBOUND REACTION",
  ] : [];

  return (
    <aside className="formation-dossier panel-surface" aria-label={`${formation.name} formation dossier`}>
      <div className="dossier-heading"><span>FORMATION DOSSIER</span><em>NEUTRAL INTEL</em></div>
      <div className="dossier-identity">
        <FormationPortrait formation={formation} compact />
        <div><span>FORMATION {formation.number}</span><b>{formation.name}</b><small><Icon weight="duotone" /> {formation.role}</small></div>
      </div>
      <p>{formation.purpose}</p>
      <div className="dossier-refits">
        <span>REFIT BAY · {refitsLocked ? "LOCKED FOR OPERATION" : "ONE PACKAGE INSTALLED"}</span>
        <div>
          {formation.refits.map((refit) => (
            <button
              key={refit.id}
              className={formation.activeRefit.id === refit.id ? "selected" : ""}
              onClick={() => onRefit(formation.id, refit.id)}
              disabled={refitsLocked || phase !== "plan"}
              aria-pressed={formation.activeRefit.id === refit.id}
            >
              <b>{refit.name}</b>
              <small>{refit.summary}</small>
              <em>{refit.capabilities.join(" / ")} · CREATES {refit.creates}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="dossier-reactions">
        <span>CAPABILITIES</span>
        <div>{formation.capabilities.map((capability) => <em key={capability}>{capability}</em>)}</div>
      </div>
      <div className="dossier-condition">
        <span>CREATES</span>
        <b>{formation.creates}</b>
      </div>
      <div className="dossier-reactions">
        <span>CAN REACT TO</span>
        <div>{formation.uses.map((condition) => <em key={condition}>{condition}</em>)}</div>
      </div>
      {assignedRole && readiness ? (
        <div className="dossier-placement">
          <div><span>OBSERVED AT STOP {String(assignedIndex + 1).padStart(2, "0")}</span><b>{readiness.score}% <em>{readiness.label}</em></b><small>{assignedRole.label}</small></div>
          <div className="dossier-observations">{observations.map((observation) => <em key={observation}>{observation}</em>)}</div>
        </div>
      ) : (
        <div className="dossier-unplaced"><b>PLACE TO MEASURE READINESS</b><small>Task fit and neighboring reactions are revealed only after assignment.</small></div>
      )}
    </aside>
  );
}

function FormationRoster({ formations, selected, onSelect, assignments, playbook, onPlaybook, phase, onFormationDragStart, readiness, refitsLocked, onRefit }) {
  const roleByFormation = Object.fromEntries(
    playbook.roles.filter((role) => assignments[role.id]).map((role) => [assignments[role.id], role]),
  );
  const selectedFormation = formations.find((formation) => formation.id === selected);
  const selectedRole = roleByFormation[selected];
  const selectedRoleIndex = selectedRole ? playbook.roles.findIndex((role) => role.id === selectedRole.id) : -1;
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
        {formations.map((formation) => {
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
      <FormationDossier formation={selectedFormation} assignedRole={selectedRole} assignedIndex={selectedRoleIndex} readiness={selectedRole ? readiness[selectedRole.id] : null} phase={phase} refitsLocked={refitsLocked} onRefit={onRefit} />
    </section>
  );
}

function MissionRoute({ phase, battleTime, operation, profile }) {
  const steps = [
    { n: 1, label: operation.orders[0], done: battleTime >= profile.betaAt },
    { n: 2, label: operation.orders[1], done: battleTime >= profile.reactorAt },
    { n: 3, label: operation.orders[2], done: phase === "complete" },
  ];
  return (
    <div className="mission-route panel-surface">
      <span className="panel-label">VICTORY ORDERS</span>
      <div className="victory-rule"><b>WIN THE MISSION</b><small>{operation.victory}</small></div>
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

const resolveFieldPoint = (plan, landmarks, reference) => {
  if (typeof reference === "number") return plan.positions[reference];
  if (typeof reference === "string") return landmarks[reference];
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

function TacticalFieldPlan({ assignments, branches, formations, operation, phase, playbook }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });
  const operationField = operationFieldFor(operation);
  const plan = operationField.plans[playbook.id];
  const breakpoints = breakpointsFor(operation);

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
    const formation = formations.find((item) => item.id === assignments[role.id]);
    const staging = formation ? STAGING_NODES[formation.id] : null;
    const start = staging ? { x: staging.left, y: staging.top - 3 } : route.start;
    return { ...route, roleIndex, role, formation, start };
  });
  const baseSegments = routes.flatMap((route) => {
    const points = [route.start, ...route.points].map((point) => resolveFieldPoint(plan, operationField.landmarks, point));
    return points.slice(0, -1).map((point, index) => ({
      id: `route-${route.roleIndex}-${index}`,
      start: point,
      end: points[index + 1],
      className: `base lane-${route.roleIndex + 1} ${route.formation ? "staffed" : ""}`,
    }));
  });
  const branchSegments = breakpoints.flatMap((breakpoint, breakpointIndex) => {
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
        start: resolveFieldPoint(plan, operationField.landmarks, point),
        end: resolveFieldPoint(plan, operationField.landmarks, route[index + 1]),
        className: `branch breakpoint-${breakpointIndex + 1} lane-${roleIndex + 1} ${selectedRoute ? "selected-route" : "alternative-route"} ${staffed ? "staffed" : ""} ${changed ? "changed" : ""}`,
      }));
    });
  });
  const branchTurns = breakpoints.flatMap((breakpoint, breakpointIndex) => {
    const selectedOptionId = branches[breakpoint.id];
    return breakpoint.options.flatMap((option) => {
      const selectedRoute = option.id === selectedOptionId;
      return plan.branchRoutes[breakpoint.id][option.id]
        .filter((point) => typeof point === "object" || point === "rescue")
        .slice(0, 1)
        .map((point, index) => ({
          id: `${breakpoint.id}-${option.id}-turn-${index}`,
          point: resolveFieldPoint(plan, operationField.landmarks, point),
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
          {breakpoints.map((breakpoint, index) => {
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
        const formation = formations.find((item) => item.id === assignments[role.id]);
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

function EnemyFieldPlan({ battleTime, operation, phase, clashes, profile, planReady }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });
  const enemyPlan = enemyPlanFor(operation);
  const reinforcementWave = reinforcementWaveFor(operation);

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

  const waveApproachAt = reinforcementWave.arrivalAt - reinforcementWave.approachDuration;
  const waveProgress = phase === "battle" || phase === "complete"
    ? Math.max(0, Math.min(1, (battleTime - waveApproachAt) / reinforcementWave.approachDuration))
    : 0;
  const wavePosition = {
    x: reinforcementWave.start.x + (reinforcementWave.intercept.x - reinforcementWave.start.x) * waveProgress,
    y: reinforcementWave.start.y + (reinforcementWave.intercept.y - reinforcementWave.start.y) * waveProgress,
  };
  const waveArrived = (phase === "battle" || phase === "complete") && battleTime >= reinforcementWave.arrivalAt;
  const clearsBeforeWave = planReady && profile.overrun === 0;

  return (
    <div className="enemy-plan-layer" ref={layerRef} aria-label={`${enemyPlan.name} enemy battlefield plan`}>
      {enemyPlan.formations.map((formation, index) => {
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
      <div className={`reinforcement-route ${clearsBeforeWave ? "avoided" : "threat"}`} style={fieldSegmentStyle(reinforcementWave.start, reinforcementWave.intercept, layerSize)}>
        <ArrowRight weight="bold" />
      </div>
      <div className={`reinforcement-intercept ${clearsBeforeWave ? "avoided" : "threat"}`} style={{ left: `${reinforcementWave.intercept.x}%`, top: `${reinforcementWave.intercept.y}%` }}>
        <Crosshair weight="duotone" />
        <span>{!planReady ? `ENEMY WAVE · T+${fmtDuration(reinforcementWave.arrivalAt)}` : clearsBeforeWave ? "WARHOST CLEARS FIRST" : `${fmtDuration(profile.overrun)} INTERCEPT WINDOW`}</span>
      </div>
      <div className={`enemy-plan-formation reinforcement-wave ${waveArrived ? "landed" : waveProgress > 0 ? "advancing" : "queued"} ${clearsBeforeWave ? "avoided" : ""}`} style={{ left: `${wavePosition.x}%`, top: `${wavePosition.y}%` }}>
        <img src="/assets/helioch-sentinels.png" alt={`${reinforcementWave.name} approaching ${operation.extractionTitle}`} />
        <span>{reinforcementWave.number}</span>
        <small>{waveArrived ? reinforcementWave.order : `WAVE · T+${fmtDuration(reinforcementWave.arrivalAt)}`}</small>
      </div>
    </div>
  );
}

function TacticalHandoffBoard({ feedback, formations, handoffs, profile }) {
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
          const source = formations.find((formation) => formation.id === handoff.sourceId);
          const receiver = formations.find((formation) => formation.id === handoff.receiverId);
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

function PlaybookBoard({ active, assignments, battleTime, condition, drillStep, feedback, formations, handoffs, onChooseRole, onAssignFormation, outputs, phase, playbook, profile, readiness }) {
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
            const source = formations.find((formation) => formation.id === handoff.sourceId);
            const receiver = formations.find((formation) => formation.id === handoff.receiverId);
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
          const roleDemands = roleDemandsFor(role, index, condition);
          const formation = formations.find((item) => item.id === assignments[role.id]);
          const output = outputs[role.id];
          const nextRole = playbook.roles[index + 1];
          const nextFormation = nextRole ? formations.find((item) => item.id === assignments[nextRole.id]) : null;
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
                <span className="slot-task">{role.brief}<small className="slot-demand">DEMANDS {roleDemands.join(" / ")}</small></span>
                {formation ? (
                  <>
                    <span className="slot-formation"><img src={formation.asset} alt="" /><span><b>{formation.name}</b><small>{formation.activeRefit.name}</small></span></span>
                    <span className={`slot-result ${output.incoming ? "transformed" : ""}`}>
                      <span className="slot-output"><b>{output.result}</b><small>{output.incoming ? "COMBO RESULT" : "CREATES"}</small></span>
                      <span className={`slot-readiness readiness-${readiness[role.id].label.toLowerCase()}`} title="Observed after placement; task fit and neighboring combo links affect readiness."><b>{readiness[role.id].score}%</b><small>{readiness[role.id].label}</small></span>
                    </span>
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
      <TacticalHandoffBoard feedback={feedback} formations={formations} handoffs={handoffs} profile={profile} />
    </div>
  );
}

function Battlefield({ formations, selected, onSelect, deployments, phase, battleTime, condition, drillStep, placementFeedback, planReady, playbook, drillSteps, assignments, branches, handoffs, operation, outputs, profile, events, onChooseRole, onAssignFormation, onFormationDragStart, readiness }) {
  const [confirmedCombo, setConfirmedCombo] = useState(null);
  const confirmedComboIdRef = useRef(null);
  const confirmedComboTimerRef = useRef(null);
  const activeFormations = phase === "complete" ? formations.slice(0, profile.extractedCount).map((formation) => formation.id) : formations.map((formation) => formation.id);
  const alphaState = battleTime >= profile.alphaAt ? "secured" : "active";
  const betaState = battleTime >= profile.betaAt ? "secured" : "threat";
  const reactorState = battleTime >= profile.reactorAt ? "secured" : "threat";
  const extractionState = phase === "complete" ? "secured" : "future";
  const timing = comboWindowTimes(profile);
  const confirmedComboSource = formations.find((formation) => formation.id === confirmedCombo?.sourceId);
  const confirmedComboReceiver = formations.find((formation) => formation.id === confirmedCombo?.receiverId);

  useEffect(() => {
    if (phase !== "battle") {
      if (confirmedComboTimerRef.current) window.clearTimeout(confirmedComboTimerRef.current);
      confirmedComboTimerRef.current = null;
      confirmedComboIdRef.current = null;
      setConfirmedCombo(null);
      return;
    }

    const triggeredCombo = handoffs.find((handoff) => (
      handoff.maneuver
      && battleTime >= timing[handoff.from]
      && battleTime < timing[handoff.from] + 15
    ));
    if (!triggeredCombo || confirmedComboIdRef.current === triggeredCombo.id) return;

    confirmedComboIdRef.current = triggeredCombo.id;
    setConfirmedCombo(triggeredCombo);
    if (confirmedComboTimerRef.current) window.clearTimeout(confirmedComboTimerRef.current);
    confirmedComboTimerRef.current = window.setTimeout(() => {
      setConfirmedCombo(null);
      confirmedComboTimerRef.current = null;
    }, COMBO_CONFIRMATION_MS);
  }, [battleTime, handoffs, phase, timing]);

  useEffect(() => () => {
    if (confirmedComboTimerRef.current) window.clearTimeout(confirmedComboTimerRef.current);
  }, []);

  return (
    <section className={`battlefield phase-${phase} operation-${operation.id}`} aria-label={`${operation.name} mission map`}>
      <img className="battlefield-art" src="/assets/dead-circuit-foundry.png" alt={operation.battlefieldAlt} />
      <div className="battlefield-wash" />
      <div className="battlefield-operation-veil" aria-hidden="true" />
      <EnemyFieldPlan battleTime={battleTime} operation={operation} phase={phase} clashes={profile.enemyClashes} profile={profile} planReady={planReady} />
      <TacticalFieldPlan assignments={assignments} branches={branches} formations={formations} operation={operation} phase={phase} playbook={playbook} />
      <MissionRoute phase={phase} battleTime={battleTime} operation={operation} profile={profile} />
      <div className="map-sector entry-sector"><span>{phase === "plan" || phase === "drill" ? operation.entryPlanTitle : operation.entryBattleTitle}</span><small>{phase === "plan" || phase === "drill" ? "Visible formations · drag into a stop" : "Player deployment edge"}</small></div>
      <ObjectiveMarker className="alpha-objective" number="1" title={operation.controlTitles[0]} description={alphaState === "secured" ? "SECURED · western route open" : "Seize and hold"} state={alphaState} />
      <ObjectiveMarker className="beta-objective" number="1" title={operation.controlTitles[1]} description={betaState === "secured" ? "SECURED · transit lane open" : "Seize and hold"} state={betaState} />
      <ObjectiveMarker className="reactor-objective" number="2" title={operation.primaryTitle} description={reactorState === "secured" ? operation.primaryDone : operation.primaryDescription} state={reactorState} icon={Factory} />
      <ObjectiveMarker className="extraction-objective" number="3" title={operation.extractionTitle} description={`Extract ${operation.requiredExtraction}+ formations`} state={extractionState} icon={Flag} />
      <ObjectiveMarker className="rescue-objective" title={operation.optionalTitle} description={operation.optionalDescription} state="optional" icon={Wrench} />

      <div className="mission-path path-one" aria-hidden="true" />
      <div className="mission-path path-two" aria-hidden="true" />
      <div className="mission-path path-three" aria-hidden="true" />
      <div className={`combo-path combo-pull ${planReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-burn ${planReady ? "active warm" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-break ${planReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`kill-zone ${planReady ? "active" : ""}`}><span>DECISION AREA</span></div>
      {confirmedCombo && (
        <div className="battlefield-combo-beat" role="status">
          <span><Lightning weight="fill" /> AUTOMATIC COMBO · RESOLVED</span>
          <b>{confirmedComboSource.name} creates {confirmedCombo.maneuver.passes}</b>
          <ArrowRight weight="bold" />
          <b>{confirmedComboReceiver.name} reacts: {confirmedCombo.maneuver.name}</b>
          <small>RESULT: {confirmedCombo.maneuver.result} · {confirmedCombo.maneuver.impact.text}</small>
        </div>
      )}

      {formations.filter((formation) => activeFormations.includes(formation.id)).map((formation) => {
        const assignedNode = deployments[formation.id] ? NODES[deployments[formation.id]] : null;
        const node = assignedNode ?? STAGING_NODES[formation.id];
        const active = selected === formation.id;
        const progressShift = phase === "battle" || phase === "complete"
          ? Math.min(22, Math.floor(battleTime / 30) * 2.2)
          : 0;
        return (
          <button
            key={formation.id}
            className={`map-formation ${active ? "selected" : ""} ${phase === "battle" ? "in-motion" : ""} ${!assignedNode && (phase === "plan" || phase === "drill") ? "staged" : ""} ${confirmedCombo?.sourceId === formation.id ? "combo-source" : ""} ${confirmedCombo?.receiverId === formation.id ? "combo-receiver" : ""}`}
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

      <PlaybookBoard active={planReady} assignments={assignments} battleTime={battleTime} condition={condition} drillStep={drillStep} feedback={placementFeedback} formations={formations} handoffs={handoffs} onChooseRole={onChooseRole} onAssignFormation={onAssignFormation} outputs={outputs} phase={phase} playbook={playbook} profile={profile} readiness={readiness} />
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

function EnemyPlanIntel({ battleTime, operation, phase, planReady, clashes, profile }) {
  const enemyPlan = enemyPlanFor(operation);
  const reinforcementWave = reinforcementWaveFor(operation);
  return (
    <div className="intel-block enemy-plan-intel">
      <span className="panel-label">ENEMY PLAYBOOK · EXECUTES IN PARALLEL</span>
      <div className="enemy-doctrine-title"><Target weight="duotone" /><span><b>{enemyPlan.name}</b><small>{enemyPlan.intent}</small></span></div>
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
      <div className={`reinforcement-order ${planReady && profile.overrun === 0 ? "avoided" : "threat"}`}>
        <span className="enemy-step-number">{reinforcementWave.number}</span>
        <span className="enemy-step-copy">
          <em>ARRIVES T+{fmtDuration(reinforcementWave.arrivalAt)}</em>
          <b>{reinforcementWave.name}</b>
          <small>{reinforcementWave.approach}</small>
        </span>
        <span className="enemy-step-result">
          {!planReady ? "CONTINGENCY UNREAD" : profile.overrun > 0 ? `${reinforcementForecast(profile)} · ${profile.reinforcementLoss} RECOVERY LOST` : `${reinforcementForecast(profile)} · CONTACT AVOIDED`}
        </span>
      </div>
    </div>
  );
}

function MissionConditionSelector({ condition, locked, phase, onCondition }) {
  const visibleConditions = locked ? [condition] : MISSION_CONDITIONS;
  return (
    <div className="intel-block condition-intel">
      <span className="panel-label">MISSION CONDITION · {locked ? "ASSIGNED BY OPERATION" : "DISCLOSED BEFORE DEPLOYMENT"}</span>
      <div className="condition-options" role="group" aria-label="Prototype mission condition">
        {visibleConditions.map((item) => (
          <button
            key={item.id}
            className={condition.id === item.id ? "selected" : ""}
            onClick={() => onCondition(item.id)}
            disabled={locked || phase !== "plan"}
            aria-pressed={condition.id === item.id}
          >
            <b>{item.name}</b>
            <small>{item.brief}</small>
          </button>
        ))}
      </div>
      <p className="condition-effect"><Warning weight="duotone" /><span><b>{condition.name}</b>{condition.effect}</span></p>
      <small className="prototype-note">{locked ? "FIXED FOR THIS OPERATION · ADAPT PLACEMENT AND REFITS TO THE FIELD." : "PROTOTYPE SWITCH · LATER OPERATIONS ASSIGN THEIR CONDITION BEFORE DEPLOYMENT."}</small>
    </div>
  );
}

function IntelRail({ phase, battleTime, condition, onCondition, operation, planReady, rescueComplete, playbook, assignedCount, profile }) {
  const forecast = profile.overrun > 0
    ? `${profile.extractedCount} / 5 EXTRACT · WAVE ${fmtDuration(profile.overrun)} EARLY`
    : `${profile.extractedCount} / 5 EXTRACT · ${fmtDuration(profile.timeSaved)} CLEAR`;
  return (
    <section className="right-rail" aria-label="Mission outlook and enemy intelligence">
      <MissionConditionSelector condition={condition} locked={operation.conditionLocked} phase={phase} onCondition={onCondition} />
      <div className="intel-block">
        <span className="panel-label">MISSION OUTLOOK</span>
        <strong className={planReady ? profile.overrun > 0 ? "at-risk" : "viable" : "at-risk"}>{planReady ? forecast : `${assignedCount} / 5 ASSIGNED`}</strong>
        <p><b>{playbook.name}:</b> {playbook.intent}</p>
        {profile.readiness.staffedCount > 0 && (
          <div className={`readiness-impact ${profile.readiness.delay > 0 ? "penalty" : "aligned"}`}>
            <span>FORMATION READINESS</span>
            <b>{profile.readiness.average}% · {profile.readiness.delay > 0 ? `+${fmtDuration(profile.readiness.delay)} EXECUTION DELAY` : "NO TASK-FIT DELAY"}</b>
            <small>{profile.readiness.alignedCount} / {profile.readiness.staffedCount} STAFFED FORMATIONS TASK-ALIGNED · COMBO EFFECTS RESOLVE SEPARATELY</small>
          </div>
        )}
        {!planReady && phase === "plan" && <p className="assignment-pointer"><ArrowRight weight="bold" /> Place formations on the authored tactical route.</p>}
      </div>
      <EnemyPlanIntel battleTime={battleTime} operation={operation} phase={phase} planReady={planReady} clashes={profile.enemyClashes} profile={profile} />
      <div className="intel-block victory-block">
        <span className="panel-label">VICTORY CONDITION</span>
        <Factory weight="duotone" />
        <p>{operation.victory}</p>
        <small>Annihilating the enemy is not required.</small>
      </div>
      <div className="intel-block objective-progress">
        <span className="panel-label">MISSION STATE</span>
        <ProgressRow label={operation.controlProgress[0]} done={battleTime >= profile.alphaAt} />
        <ProgressRow label={operation.controlProgress[1]} done={battleTime >= profile.betaAt} />
        <ProgressRow label={operation.primaryProgress} done={battleTime >= profile.reactorAt} />
        <ProgressRow label={operation.optionalTitle.replace("RECOVER ", "")} done={rescueComplete} optional />
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

function FooterControls({ phase, seals, drillComplete, onDrill, onCommit, onReset, operation, planReady, branches, onBranch }) {
  const breakpoints = breakpointsFor(operation);
  const breakpointImpacts = breakpointImpactsFor(operation);
  return (
    <footer className="mission-footer">
      <div className="contingency-block">
        <span className="panel-label">AUTHORED BREAKPOINTS · OVERRIDE COSTS 1 COMMAND SEAL</span>
        <div className="contingencies">
          {breakpoints.map((breakpoint, index) => {
            const selectedOption = breakpoint.options.find((option) => option.id === branches[breakpoint.id]);
            const impact = breakpointImpacts[breakpoint.id][selectedOption.id];
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

function DecisionOverlay({ decision, seals, branches, operation, onResolve }) {
  if (!decision) return null;
  const breakpoint = breakpointsFor(operation).find((item) => item.id === decision);
  const breakpointImpacts = breakpointImpactsFor(operation);
  const authored = breakpoint.options.find((option) => option.id === branches[decision]);
  const alternative = breakpoint.options.find((option) => option.id !== branches[decision]);
  return (
    <div className="decision-backdrop" role="dialog" aria-modal="true" aria-labelledby="decision-title">
      <div className="decision-panel">
        <div className="decision-icon"><Radio weight="duotone" /></div>
        <p className="eyebrow">PLAYBOOK BREAKPOINT</p>
        <h2 id="decision-title">{breakpoint.title}</h2>
        <p>{breakpoint.description}</p>
        <div className="authored-order"><span>AUTHORED ORDER</span><b>{authored.label}</b><small>{authored.effect}</small></div>
        <div className="decision-route-compare">
          <span className="panel-label">HOW THE PLAN CHANGES</span>
          {breakpoint.options.map((option) => {
            const isAuthored = option.id === branches[decision];
            const impact = breakpointImpacts[decision][option.id];
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

function FormationPicker({ role, playbook, condition, formations, assignments, onChoose, onClose }) {
  if (!role) return null;
  const assignedFormationId = assignments[role.id];
  const roleIndex = playbook.roles.findIndex((item) => item.id === role.id);
  const roleDemands = roleDemandsFor(role, roleIndex, condition);
  const formationStartOrder = new Map(formations.map((formation, index) => [formation.id, index]));
  const formationSlotOrder = new Map(
    playbook.roles
      .map((assignedRole, index) => [assignments[assignedRole.id], index])
      .filter(([formationId]) => Boolean(formationId)),
  );
  const orderedFormations = [...formations].sort((left, right) => {
    const leftSlot = formationSlotOrder.get(left.id);
    const rightSlot = formationSlotOrder.get(right.id);
    if (leftSlot !== undefined && rightSlot !== undefined) return leftSlot - rightSlot;
    if (leftSlot !== undefined) return -1;
    if (rightSlot !== undefined) return 1;
    return formationStartOrder.get(left.id) - formationStartOrder.get(right.id);
  });
  return (
    <div className="decision-backdrop formation-picker-backdrop" role="dialog" aria-modal="true" aria-labelledby="formation-picker-title">
      <div className="decision-panel formation-picker-panel">
        <p className="eyebrow">STAFF ACTION STOP</p>
        <h2 id="formation-picker-title">Who executes {role.label}?</h2>
        <p>{role.brief} This condition demands <b>{roleDemands.join(" / ")}</b>. Choose the formation; readiness and any adjacent tactical handoff are revealed after placement.</p>
        <div className="formation-picker-list">
          {orderedFormations.map((formation) => {
            const currentRole = playbook.roles.find((item) => assignments[item.id] === formation.id);
            const currentRoleIndex = currentRole ? playbook.roles.findIndex((item) => item.id === currentRole.id) : -1;
            const current = assignedFormationId === formation.id;
            return (
              <button key={formation.id} className={current ? "current" : ""} onClick={() => onChoose(formation.id)}>
                <FormationPortrait formation={formation} compact />
                <span className="picker-formation-copy">
                  <b>{formation.name}</b>
                  <span className="formation-refit-line">REFIT {formation.activeRefit.name}</span>
                  <span className="formation-capability-line">CAPABILITIES {formation.capabilities.join(" / ")}</span>
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

function SalvageWorkshop({ baselineRefits, choice, formations, nextOperation, onChoose, onLaunch }) {
  const incomingCondition = MISSION_CONDITIONS.find((condition) => condition.id === nextOperation.conditionId);
  return (
    <div className="decision-backdrop workshop-backdrop" role="dialog" aria-modal="true" aria-labelledby="workshop-title">
      <div className="decision-panel workshop-panel">
        <div className="workshop-heading">
          <div>
            <p className="eyebrow">INTERMISSION · SCRAPBORN SALVAGE BAY</p>
            <h2 id="workshop-title">Carry the detachment forward.</h2>
            <p>Every installed refit survived Dead Circuit. Replace at most one package before the next operation, or keep the Warhost unchanged.</p>
          </div>
          <div className={`salvage-token ${choice ? "spent" : "available"}`}>
            <Wrench weight="duotone" />
            <span><b>{choice ? "0 / 1" : "1 / 1"}</b><small>REFIT REPLACEMENT REMAINING</small></span>
          </div>
        </div>
        <div className="incoming-operation">
          <span>INCOMING OPERATION</span>
          <b>{nextOperation.name}</b>
          <small>{nextOperation.victory}</small>
          <em>{incomingCondition.name} · {incomingCondition.effect}</em>
        </div>
        <div className="workshop-formations">
          {formations.map((formation) => {
            const baseFormation = FORMATIONS.find((item) => item.id === formation.id);
            const carriedRefit = baseFormation.refits.find((refit) => refit.id === baselineRefits[formation.id]);
            const lockedByOtherChoice = Boolean(choice && choice.formationId !== formation.id);
            return (
              <div className={`workshop-formation ${choice?.formationId === formation.id ? "changed" : ""}`} key={formation.id}>
                <FormationPortrait formation={formation} compact />
                <div className="workshop-formation-copy"><b>{formation.name}</b><small>CARRIES {carriedRefit.name}</small></div>
                <div className="workshop-refit-options">
                  {baseFormation.refits.map((refit) => (
                    <button
                      key={refit.id}
                      className={formation.activeRefit.id === refit.id ? "selected" : ""}
                      onClick={() => onChoose(formation.id, refit.id)}
                      disabled={lockedByOtherChoice}
                      aria-pressed={formation.activeRefit.id === refit.id}
                    >
                      <b>{refit.name}</b>
                      <small>{refit.capabilities.join(" / ")} · CREATES {refit.creates}</small>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="workshop-footer">
          <span>{choice ? `${FORMATIONS.find((formation) => formation.id === choice.formationId).name} will enter Ashen Passage with a replacement package.` : "No replacement selected. Skipping the refit is allowed."}</span>
          <button className="commit-button" onClick={onLaunch}><span><b>LAUNCH ASHEN PASSAGE</b><small>Lock refits and return to tactical planning.</small></span><ArrowRight weight="bold" /></button>
        </div>
      </div>
    </div>
  );
}

function CompletionOverlay({ formations, hasNextOperation, operation, rescued, usedSeals, playbook, profile, won, onAction }) {
  const lostCount = FORMATIONS.length - profile.extractedCount;
  const disruptedEnemyOrders = profile.enemyClashes.filter((clash) => clash.disrupted).length;
  const reinforcementWave = reinforcementWaveFor(operation);
  const timingResult = profile.overrun > 0
    ? `The ${reinforcementWave.name} reached ${operation.extractionTitle} ${profile.overrun} seconds before extraction cleared.`
    : profile.timeSaved > 0
    ? `The Warhost cleared extraction ${profile.timeSaved} seconds before the enemy wave arrived.`
    : "The Warhost cleared the gantry as the enemy wave arrived.";
  const readinessResult = profile.readiness.delay > 0
    ? `${profile.readiness.improvisedCount} improvised ${profile.readiness.improvisedCount === 1 ? "assignment added" : "assignments added"} ${profile.readiness.delay} seconds of execution delay.`
    : `All ${profile.readiness.staffedCount} formations were task-aligned with no readiness delay.`;
  return (
    <div className="decision-backdrop completion-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-title">
      <div className={`decision-panel completion-panel ${won ? "victory" : "defeat"}`}>
        {won ? <CheckCircle className="completion-icon" weight="duotone" /> : <Warning className="completion-icon" weight="duotone" />}
        <p className="eyebrow">{won ? "OPERATION SUCCESS" : "OPERATION FAILED"}</p>
        <div className="victory-banner">{won ? "VICTORY" : "DEFEAT"}</div>
        <h2 id="complete-title">{won ? `${operation.shortName} is secured.` : `${operation.shortName} was lost.`}</h2>
        <p>{operation.primaryResult} and {profile.extractedCount} formations escaped. Victory required the primary objective plus at least {operation.requiredExtraction} extracted formations.</p>
        <div className="after-action-grid">
          <div><span>PRIMARY · COMPLETE</span><b>{operation.primaryResult}</b><CheckCircle weight="fill" /></div>
          <div><span>EXTRACTION · {won ? "PASSED" : "FAILED"}</span><b>{profile.extractedCount} extracted · {operation.requiredExtraction} required</b>{won ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}</div>
          <div><span>OPTIONAL</span><b>{rescued ? "Crew rescued" : "Crew left behind"}</b>{rescued ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}</div>
          <div><span>PLAN VS PLAN</span><b>{profile.effects.length} combos · {disruptedEnemyOrders} / {profile.enemyClashes.length} enemy orders broken</b><Seal weight="duotone" /></div>
        </div>
        <p className="completion-note">Mission condition: {profile.condition.name}. Installed refits: {formations.map((formation) => formation.activeRefit.name).join(", ")}. {timingResult} {readinessResult} {lostCount === 0 ? "Every formation was recovered." : `${lostCount} ${lostCount === 1 ? "formation did" : "formations did"} not clear extraction.`} {usedSeals === 0 ? "Both authored breakpoints held under contact." : `${usedSeals} authored ${usedSeals === 1 ? "order was" : "orders were"} overridden after contact.`}</p>
        <button className="commit-button debrief-button" onClick={onAction}><span><b>{won && hasNextOperation ? "ENTER SALVAGE WORKSHOP" : "RETURN TO BATTLEFIELD"}</b><small>{won && hasNextOperation ? "Carry this detachment into the next operation." : "Inspect the completed operation state."}</small></span><ArrowRight /></button>
      </div>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState("plan");
  const [operationIndex, setOperationIndex] = useState(0);
  const [selected, setSelected] = useState("harpoon");
  const [playbookId, setPlaybookId] = useState("trapline");
  const [conditionId, setConditionId] = useState("clear");
  const [refits, setRefits] = useState(defaultRefits);
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
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [workshopBaseline, setWorkshopBaseline] = useState(null);
  const [salvageChoice, setSalvageChoice] = useState(null);
  const [pickerRoleId, setPickerRoleId] = useState(null);
  const [placementFeedback, setPlacementFeedback] = useState(null);
  const timerRef = useRef(null);
  const placementRevisionRef = useRef(0);

  const operation = OPERATIONS[operationIndex] ?? OPERATIONS[0];
  const playbook = useMemo(
    () => playbookForOperation(PLAYBOOKS.find((item) => item.id === playbookId) ?? PLAYBOOKS[0], operation),
    [operation, playbookId],
  );
  const condition = useMemo(
    () => MISSION_CONDITIONS.find((item) => item.id === conditionId) ?? MISSION_CONDITIONS[0],
    [conditionId],
  );
  const formations = useMemo(
    () => resolveFormations(refits),
    [refits],
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
    () => evaluateTacticalSequence(playbook, assignments, formations),
    [assignments, formations, playbook],
  );
  const tacticalHandoffs = tacticalSequence.handoffs;
  const roleOutputs = tacticalSequence.outputs;
  const placementReadiness = useMemo(
    () => calculatePlacementReadiness(playbook, assignments, tacticalHandoffs, condition, formations),
    [assignments, condition, formations, playbook, tacticalHandoffs],
  );

  const activeBranches = phase === "plan" || phase === "drill" ? branches : battleBranches;

  const operationProfile = useMemo(
    () => calculateOperationProfile(tacticalHandoffs, activeBranches, placementReadiness, condition, operation),
    [activeBranches, condition, operation, placementReadiness, tacticalHandoffs],
  );

  const operationEvents = useMemo(
    () => buildOperationEvents(operationProfile, operation),
    [operation, operationProfile],
  );
  const operationWon = operationProfile.extractedCount >= operation.requiredExtraction;

  const drillSteps = useMemo(
    () => [
      `Condition ${condition.name}: ${condition.effect}`,
      `${formations.length} installed refits locked; no loadout changes after commitment`,
      `Loading ${playbook.name} geometry`,
      ...playbook.stages.map((stage) => `${stage.label} timing and support arcs confirmed`),
      operationProfile.readiness.delay > 0
        ? `${operationProfile.readiness.improvisedCount} improvised assignments add ${operationProfile.readiness.delay} seconds to extraction timing`
        : `All ${operationProfile.readiness.staffedCount} formations are task-aligned; no readiness delay`,
      ...(tacticalHandoffs.some((handoff) => handoff.maneuver)
        ? tacticalHandoffs.filter((handoff) => handoff.maneuver).map((handoff) => `${handoff.maneuver.name}: ${handoff.maneuver.passes} becomes ${handoff.maneuver.result}. ${handoff.maneuver.impact.text}`)
        : [`All ${assignedCount} formations act independently; no automatic combo windows discovered`]),
      ...operationProfile.enemyClashes.map((clash) => clash.disrupted
        ? `${clash.counterManeuver.name} disrupts enemy ${clash.label}`
        : `Enemy ${clash.label} lands: ${clash.consequence}`),
      ...operationProfile.branchEffects.map((branch) => `${branch.option.label}: ${branch.impact.text}`),
      operationProfile.overrun > 0
        ? `${operationProfile.extractedCount} formations forecast to extract ${operationProfile.overrun} seconds after the enemy wave reaches ${operation.extractionTitle}`
        : `${operationProfile.extractedCount} formations forecast to clear ${operationProfile.timeSaved} seconds before the enemy wave`,
    ],
    [assignedCount, condition, formations.length, operation, operationProfile, playbook, tacticalHandoffs],
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
    setBranches(defaultBranches(operation));
    setBattleBranches(defaultBranches(operation));
    setSelected("harpoon");
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillStep(-1);
    setDrillComplete(false);
  };

  const changeCondition = (nextId) => {
    if (phase !== "plan" || operation.conditionLocked || !MISSION_CONDITIONS.some((item) => item.id === nextId)) return;
    setConditionId(nextId);
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillStep(-1);
    setDrillComplete(false);
  };

  const changeRefit = (formationId, refitId) => {
    if (phase !== "plan" || operationIndex > 0) return;
    const baseFormation = FORMATIONS.find((formation) => formation.id === formationId);
    const nextRefit = baseFormation?.refits.find((refit) => refit.id === refitId);
    if (!baseFormation || !nextRefit || refits[formationId] === refitId) return;

    const nextSelections = { ...refits, [formationId]: refitId };
    const nextFormations = resolveFormations(nextSelections);
    const assignedRole = playbook.roles.find((role) => assignments[role.id] === formationId);

    if (assignedRole) {
      const previousSequence = evaluateTacticalSequence(playbook, assignments, formations);
      const nextSequence = evaluateTacticalSequence(playbook, assignments, nextFormations);
      const previousReadiness = calculatePlacementReadiness(playbook, assignments, previousSequence.handoffs, condition, formations);
      const nextReadiness = calculatePlacementReadiness(playbook, assignments, nextSequence.handoffs, condition, nextFormations);
      const previousProfile = calculateOperationProfile(previousSequence.handoffs, activeBranches, previousReadiness, condition, operation);
      const nextProfile = calculateOperationProfile(nextSequence.handoffs, activeBranches, nextReadiness, condition, operation);
      const previousLinks = previousSequence.handoffs.filter((handoff) => handoff.maneuver).length;
      const nextLinks = nextSequence.handoffs.filter((handoff) => handoff.maneuver).length;
      const previousWindow = previousProfile.timeSaved - previousProfile.overrun;
      const nextWindow = nextProfile.timeSaved - nextProfile.overrun;
      const targetIndex = playbook.roles.findIndex((role) => role.id === assignedRole.id);
      const improved = nextLinks > previousLinks || nextProfile.extractedCount > previousProfile.extractedCount || nextWindow > previousWindow;
      const weakened = nextLinks < previousLinks || nextProfile.extractedCount < previousProfile.extractedCount || nextWindow < previousWindow;

      placementRevisionRef.current += 1;
      setPlacementFeedback({
        revision: placementRevisionRef.current,
        affectedFrom: targetIndex,
        changedIndices: [targetIndex],
        targetIndex,
        formationName: `${baseFormation.name} · ${nextRefit.name}`,
        beforeLinks: previousLinks,
        afterLinks: nextLinks,
        forecast: `${nextProfile.extractedCount} / 5 EXTRACT · ${reinforcementForecast(nextProfile)}`,
        title: weakened ? "REFIT BREAKS CHAIN" : improved ? "REFIT STRENGTHENS CHAIN" : "REFIT REWIRES CHAIN",
        tone: weakened ? "weakened" : improved ? "strengthened" : "rewired",
      });
    } else {
      setPlacementFeedback(null);
    }

    setRefits(nextSelections);
    setSelected(formationId);
    setPickerRoleId(null);
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
    const previousSequence = evaluateTacticalSequence(playbook, assignments, formations);
    const nextSequence = evaluateTacticalSequence(playbook, nextAssignments, formations);
    const previousReadiness = calculatePlacementReadiness(playbook, assignments, previousSequence.handoffs, condition, formations);
    const nextReadiness = calculatePlacementReadiness(playbook, nextAssignments, nextSequence.handoffs, condition, formations);
    const previousProfile = calculateOperationProfile(previousSequence.handoffs, activeBranches, previousReadiness, condition, operation);
    const nextProfile = calculateOperationProfile(nextSequence.handoffs, activeBranches, nextReadiness, condition, operation);
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
      ? `${nextProfile.extractedCount} / 5 EXTRACT · ${reinforcementForecast(nextProfile)}`
      : `${Object.values(nextAssignments).filter(Boolean).length} / 5 FORMATIONS PLACED`;

    placementRevisionRef.current += 1;
    setPlacementFeedback({
      revision: placementRevisionRef.current,
      affectedFrom: Math.min(targetIndex, sourceIndex),
      changedIndices: [...new Set([targetIndex, sourceIndex])],
      targetIndex,
      formationName: formations.find((formation) => formation.id === formationId).name,
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
    const breakpoint = breakpointsFor(operation).find((item) => item.id === breakpointId);
    if (!breakpoint?.options.some((option) => option.id === optionId)) return;
    setBranches((current) => ({ ...current, [breakpointId]: optionId }));
    setDrillComplete(false);
  };

  const resolveDecision = (choice) => {
    if (choice === "override" && seals <= 0) return;
    const breakpoint = breakpointsFor(operation).find((item) => item.id === decision);
    const breakpointImpacts = breakpointImpactsFor(operation);
    const plannedOption = branches[decision];
    const chosenOption = choice === "override"
      ? breakpoint.options.find((option) => option.id !== plannedOption)?.id
      : plannedOption;
    if (choice === "override" && seals > 0) {
      setSeals((current) => current - 1);
    }
    setBattleBranches((current) => ({ ...current, [decision]: chosenOption }));
    if (decision === "rescue") setRescueComplete(Boolean(breakpointImpacts[decision][chosenOption].rescue));
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

  const handleCompletionAction = () => {
    const hasNextOperation = operationIndex < OPERATIONS.length - 1;
    if (operationWon && hasNextOperation) {
      setWorkshopBaseline({ ...refits });
      setSalvageChoice(null);
      setShowCompletion(false);
      setShowWorkshop(true);
      return;
    }
    setShowCompletion(false);
  };

  const chooseWorkshopRefit = (formationId, refitId) => {
    if (!showWorkshop || !workshopBaseline) return;
    const formation = FORMATIONS.find((item) => item.id === formationId);
    if (!formation?.refits.some((refit) => refit.id === refitId)) return;
    if (salvageChoice && salvageChoice.formationId !== formationId) return;

    const carriedRefitId = workshopBaseline[formationId];
    if (refitId === carriedRefitId) {
      setRefits({ ...workshopBaseline });
      setSalvageChoice(null);
      return;
    }

    setRefits({ ...workshopBaseline, [formationId]: refitId });
    setSalvageChoice({ formationId, refitId });
  };

  const launchNextOperation = () => {
    const nextIndex = operationIndex + 1;
    const nextOperation = OPERATIONS[nextIndex];
    if (!showWorkshop || !nextOperation) return;
    setOperationIndex(nextIndex);
    setConditionId(nextOperation.conditionId);
    setAssignments(emptyAssignments(playbook));
    setBranches(defaultBranches(nextOperation));
    setBattleBranches(defaultBranches(nextOperation));
    setPhase("plan");
    setBattleTime(0);
    setSelected("harpoon");
    setDrillStep(-1);
    setDrillComplete(false);
    setSeals(2);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setShowWorkshop(false);
    setWorkshopBaseline(null);
    setSalvageChoice(null);
    setPickerRoleId(null);
    setPlacementFeedback(null);
  };

  const resetMission = () => {
    setPhase("plan");
    setBattleTime(0);
    setOperationIndex(0);
    setPlaybookId("trapline");
    setConditionId("clear");
    setRefits(defaultRefits());
    setAssignments(emptyAssignments(PLAYBOOKS[0]));
    setBranches(defaultBranches(OPERATIONS[0]));
    setBattleBranches(defaultBranches(OPERATIONS[0]));
    setSelected("harpoon");
    setDrillStep(-1);
    setDrillComplete(false);
    setSeals(2);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setShowWorkshop(false);
    setWorkshopBaseline(null);
    setSalvageChoice(null);
    setPickerRoleId(null);
    setPlacementFeedback(null);
  };

  return (
    <main className={`warhost-app ${phase}`}>
      <AppHeader phase={phase} battleTime={battleTime} operation={operation} operationIndex={operationIndex} profile={operationProfile} />
      <div className="mission-shell">
        <FormationRoster formations={formations} selected={selected} onSelect={setSelected} assignments={assignments} playbook={playbook} onPlaybook={changePlaybook} phase={phase} onFormationDragStart={beginFormationDrag} readiness={placementReadiness} refitsLocked={operationIndex > 0} onRefit={changeRefit} />
        <Battlefield formations={formations} selected={selected} onSelect={setSelected} deployments={deployments} phase={phase} battleTime={battleTime} condition={condition} drillStep={drillStep} placementFeedback={placementFeedback} planReady={planReady} playbook={playbook} drillSteps={drillSteps} assignments={assignments} branches={activeBranches} handoffs={tacticalHandoffs} operation={operation} outputs={roleOutputs} profile={operationProfile} events={operationEvents} onChooseRole={setPickerRoleId} onAssignFormation={assignFormationToRole} onFormationDragStart={beginFormationDrag} readiness={placementReadiness} />
        <IntelRail phase={phase} battleTime={battleTime} condition={condition} onCondition={changeCondition} operation={operation} planReady={planReady} rescueComplete={rescueComplete} playbook={playbook} assignedCount={assignedCount} profile={operationProfile} />
      </div>
      <FooterControls phase={phase} seals={seals} drillComplete={drillComplete} onDrill={() => setPhase("drill")} onCommit={commitMission} onReset={resetMission} operation={operation} planReady={planReady} branches={activeBranches} onBranch={chooseBranch} />
      <DecisionOverlay decision={decision} seals={seals} branches={branches} operation={operation} onResolve={resolveDecision} />
      <FormationPicker role={playbook.roles.find((role) => role.id === pickerRoleId)} playbook={playbook} condition={condition} formations={formations} assignments={assignments} onChoose={chooseFormationForRole} onClose={() => setPickerRoleId(null)} />
      {showCompletion && <CompletionOverlay formations={formations} hasNextOperation={operationIndex < OPERATIONS.length - 1} operation={operation} rescued={rescueComplete} usedSeals={2 - seals} playbook={playbook} profile={operationProfile} won={operationWon} onAction={handleCompletionAction} />}
      {showWorkshop && workshopBaseline && <SalvageWorkshop baselineRefits={workshopBaseline} choice={salvageChoice} formations={formations} nextOperation={OPERATIONS[operationIndex + 1]} onChoose={chooseWorkshopRefit} onLaunch={launchNextOperation} />}
    </main>
  );
}
