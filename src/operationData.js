import { DEAD_CIRCUIT_FIELD_LANDMARKS, DEAD_CIRCUIT_FIELD_PLANS } from "./fieldPlanData.js";
import { roleDemandsForPressure, waveArrivalForPressure } from "./missionPressure.js";

export const OPERATIONS = [
  {
    id: "dead-circuit",
    name: "OPERATION DEAD CIRCUIT",
    shortName: "Dead Circuit",
    type: "SABOTAGE & EXTRACT",
    conditionId: "fractured-transit",
    conditionLocked: false,
    requiredExtraction: 3,
    matchup: {
      playerDisposition: "disruption",
      enemyDisposition: "safeguard",
      title: "BREAK THE CIRCUIT",
      playerObjective: "Seize both control nodes, sabotage the Reactor Spine, and extract the Warhost.",
      enemyObjective: "Protect the Reactor Spine, reinforce threatened controls, and sever the extraction gantry.",
    },
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
    matchup: {
      playerDisposition: "safeguard",
      enemyDisposition: "dominion",
      title: "HOLD THE LAST ROUTE",
      playerObjective: "Open both Ember Gates, hold the Signal Furnace, and evacuate through the Void Lift.",
      enemyObjective: "Occupy the Ember Gates, silence the relay, and claim the Void Lift approach.",
    },
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

export const roleDemandsFor = roleDemandsForPressure;

export const DEAD_CIRCUIT_BREAKPOINTS = [
  {
    id: "beta",
    title: "Beta lane is collapsing",
    description: "Helioch fire has the planned transit lane ranged. Your authored response is ready for execution.",
    trigger: "IF Beta lane is ranged",
    options: [
      { id: "tempo", label: "CROSS NOW", effect: "No delay. The eastern group crosses exposed, joins the army at assembly, then advances through the Reactor to extraction.", routeLabel: "DIRECT TO ASSEMBLY", path: ["BETA", "ASSEMBLY", "REACTOR", "EXTRACTION"] },
      { id: "protect", label: "COVER THE BREACHER", effect: "+00:15 delay. The eastern group takes a covered arc, joins the army at assembly, then advances through the Reactor to extraction.", routeLabel: "COVERED TO ASSEMBLY", path: ["BETA", "COVERED ARC", "ASSEMBLY", "REACTOR", "EXTRACTION"] },
    ],
    defaultOption: "tempo",
  },
  {
    id: "rescue",
    title: "Salvage crew is cut off",
    description: "The optional rescue now conflicts with the reactor timetable. Your playbook already contains a response.",
    trigger: "IF salvage crew is located",
    options: [
      { id: "clock", label: "LEAVE THE CREW", effect: "No delay. The recovery element joins the Reactor assault and continues forward to extraction; the crew is abandoned.", routeLabel: "CONTINUE TO REACTOR", path: ["RECOVERY POSITION", "REACTOR", "EXTRACTION"] },
      { id: "recover", label: "DIVERT TO RESCUE", effect: "+00:15 delay. The recovery element rescues the crew before joining the Reactor assault and continuing to extraction.", routeLabel: "RESCUE BEFORE REACTOR", path: ["RECOVERY POSITION", "SALVAGE CREW", "REACTOR", "EXTRACTION"] },
    ],
    defaultOption: "clock",
  },
];

export const ASHEN_PASSAGE_BREAKPOINTS = [
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

export const BREAKPOINTS_BY_OPERATION = {
  "dead-circuit": DEAD_CIRCUIT_BREAKPOINTS,
  "ashen-passage": ASHEN_PASSAGE_BREAKPOINTS,
};

export const breakpointsFor = (operation) => BREAKPOINTS_BY_OPERATION[operation?.id] ?? DEAD_CIRCUIT_BREAKPOINTS;

export const DEAD_CIRCUIT_BREAKPOINT_IMPACTS = {
  beta: {
    tempo: { text: "No delay · Breacher remains exposed" },
    protect: { reactorDelay: 15, missionDelay: 15, protects: 1, text: "+00:15 · one formation protected" },
  },
  rescue: {
    clock: { text: "No delay · salvage crew left behind" },
    recover: { missionDelay: 15, protects: 1, rescue: true, text: "+00:15 · crew rescued · one formation protected" },
  },
};

export const ASHEN_PASSAGE_BREAKPOINT_IMPACTS = {
  beta: {
    tempo: { text: "No delay · relay guard crosses blind" },
    protect: { reactorDelay: 15, missionDelay: 15, protects: 1, text: "+00:15 · one formation protected" },
  },
  rescue: {
    clock: { text: "No delay · relay crew left below" },
    recover: { missionDelay: 15, protects: 1, rescue: true, text: "+00:15 · crew recovered · one formation protected" },
  },
};

export const BREAKPOINT_IMPACTS_BY_OPERATION = {
  "dead-circuit": DEAD_CIRCUIT_BREAKPOINT_IMPACTS,
  "ashen-passage": ASHEN_PASSAGE_BREAKPOINT_IMPACTS,
};

export const breakpointImpactsFor = (operation) => BREAKPOINT_IMPACTS_BY_OPERATION[operation?.id] ?? DEAD_CIRCUIT_BREAKPOINT_IMPACTS;

export const FIELD_PLANS = DEAD_CIRCUIT_FIELD_PLANS;

export const FIELD_LANDMARKS = DEAD_CIRCUIT_FIELD_LANDMARKS;

export const ASHEN_PASSAGE_FIELD_PLANS = {
  trapline: {
    positions: [
      { x: 29, y: 42 },
      { x: 43, y: 49 },
      { x: 57, y: 40 },
      { x: 68, y: 31 },
      { x: 79, y: 24 },
    ],
    routes: [
      { role: 0, start: { x: 15, y: 73 }, points: [0, "alpha", "alphaTransfer", "sabotageLane", "beta", "reactor", "extraction"] },
      { role: 1, start: { x: 24, y: 79 }, points: [1, "alphaTransfer", "sabotageLane", "beta", "reactor", "extraction"] },
      { role: 2, start: { x: 34, y: 75 }, points: [2], breakpoint: "beta" },
      { role: 3, start: { x: 44, y: 81 }, points: [3, "reactor", "extraction"] },
      { role: 4, start: { x: 54, y: 77 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 2, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [2, "sabotageLane", "beta", "reactor", "extraction"],
        protect: [2, { x: 59, y: 27 }, { x: 68, y: 22 }, "reactor", "extraction"],
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
      { role: 0, start: { x: 15, y: 73 }, points: [0, "screenedConcentration", "assaultLaunch", "reactor", "extraction"] },
      { role: 1, start: { x: 24, y: 79 }, points: [1, "screenedConcentration", "assaultLaunch", "reactor", "extraction"] },
      { role: 2, start: { x: 34, y: 75 }, points: [2], breakpoint: "beta" },
      { role: 3, start: { x: 44, y: 81 }, points: [3, "reactor", "extraction"] },
      { role: 4, start: { x: 54, y: 77 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 2, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [2, "assaultLaunch", "reactor", "extraction"],
        protect: [2, "beta", { x: 67, y: 23 }, "reactor", "extraction"],
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
      { role: 0, start: { x: 15, y: 73 }, points: [0, "alpha", "primaryConvergence", "reactor", "extraction"] },
      { role: 1, start: { x: 24, y: 79 }, points: [1, "eastInterdiction", "beta", "primaryConvergence", "reactor", "extraction"] },
      { role: 2, start: { x: 34, y: 75 }, points: [2, "eastInterdiction", "primaryConvergence", "reactor", "extraction"] },
      { role: 3, start: { x: 44, y: 81 }, points: [3], breakpoint: "beta" },
      { role: 4, start: { x: 54, y: 77 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 3, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [3, "primaryConvergence", "reactor", "extraction"],
        protect: [3, "beta", { x: 68, y: 22 }, "reactor", "extraction"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
};

export const ASHEN_PASSAGE_LANDMARKS = {
  alpha: { x: 29, y: 32 },
  beta: { x: 61, y: 21 },
  reactor: { x: 72, y: 40 },
  extraction: { x: 91, y: 13 },
  rescue: { x: 84, y: 68 },
  alphaTransfer: { x: 39, y: 37 },
  sabotageLane: { x: 51, y: 43 },
  screenedConcentration: { x: 37, y: 39 },
  assaultLaunch: { x: 50, y: 37 },
  eastInterdiction: { x: 49, y: 35 },
  primaryConvergence: { x: 61, y: 42 },
};

export const OPERATION_FIELDS = {
  "dead-circuit": { plans: FIELD_PLANS, landmarks: FIELD_LANDMARKS },
  "ashen-passage": { plans: ASHEN_PASSAGE_FIELD_PLANS, landmarks: ASHEN_PASSAGE_LANDMARKS },
};

export const operationFieldFor = (operation) => OPERATION_FIELDS[operation?.id] ?? OPERATION_FIELDS["dead-circuit"];

export const BASE_OPERATION = {
  alphaAt: 60,
  betaAt: 150,
  reactorAt: 300,
  extractionAt: 345,
  completeAt: 360,
};

export const PLAYBACK_BEAT_MS = 2600;
export const DEAD_CIRCUIT_REINFORCEMENT_WAVE = {
  number: "E4",
  name: "HELIOCH RELIEF COLUMN",
  order: "GANTRY INTERCEPT",
  approach: "EAST ENTRY → GANTRY INTERCEPT",
  arrivalAt: BASE_OPERATION.completeAt,
  approachDuration: 45,
  start: { x: 97, y: 26 },
  intercept: { x: 86, y: 29 },
};

export const ASHEN_PASSAGE_REINFORCEMENT_WAVE = {
  number: "E4",
  name: "CENSER RESERVE",
  order: "VOID LIFT OCCUPATION",
  approach: "NORTH SHAFT → VOID LIFT",
  arrivalAt: BASE_OPERATION.completeAt,
  approachDuration: 45,
  start: { x: 91, y: 1 },
  intercept: { x: 88, y: 14 },
};

export const REINFORCEMENT_WAVES = {
  "dead-circuit": DEAD_CIRCUIT_REINFORCEMENT_WAVE,
  "ashen-passage": ASHEN_PASSAGE_REINFORCEMENT_WAVE,
};

export const reinforcementWaveFor = (operation, condition) => {
  const wave = REINFORCEMENT_WAVES[operation?.id] ?? DEAD_CIRCUIT_REINFORCEMENT_WAVE;
  const arrivalAt = waveArrivalForPressure(wave.arrivalAt, condition);
  return arrivalAt === wave.arrivalAt ? wave : { ...wave, arrivalAt };
};
