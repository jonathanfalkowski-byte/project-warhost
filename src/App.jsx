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
import { resolveAshenCollision } from "./enemyCollision.js";
import { battlefieldConsequencesAt, formationStatusDisplay } from "./battleConsequences.js";
import { resolveExtractionOutcome } from "./extractionResolution.js";
import { resolveDispositionMatchup } from "./missionDisposition.js";
import { claimStaffExercise, planningResultRevealed } from "./planningIntel.js";
import { adjacentFormationIdsFor, capabilityMatchesFor, formationInteractionsFor, interactionDirectionFor, neighboringInteractionHints } from "./formationInteractions.js";
import {
  BLIND_PREDICTIONS,
  blindPredictionResult,
  strategyTrialFor,
  strategyTrialResult,
  strategyTrialsForPlaybook,
} from "./strategyExperiment.js";
import {
  applyCampaignConditions,
  applyWorkshopAction,
  campaignOutcomeFor,
  ensureCostlyContinuationConditions,
  formationFatesFor,
  integrityLossFor,
  mergeCampaignConditions,
  seriousConditionsFromConsequences,
} from "./campaignPersistence.js";
import {
  buildBattlePlayback,
  playbackIndexAfterStep,
  playbackTimeForIndex,
} from "./battlePlayback.js";
import {
  buildAuthoredFormationRoutes,
  pointAlongRoute as pointAlongFieldRoute,
  positionAlongAuthoredRoute,
} from "./fieldRoutes.js";
import { PLAYBOOK_DOCTRINES, resolvePlaybookDoctrine } from "./playbookDoctrine.js";
import { resolveTacticalEngagement } from "./tacticalResolution.js";
import { strategyCausalityFor } from "./strategyCausality.js";

const FORMATIONS = [
  {
    id: "harpoon",
    number: "1",
    name: "HARPOON RIG",
    role: "DISPLACE",
    endurance: { armor: 3, cohesion: 3, mobility: 5 },
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
    endurance: { armor: 2, cohesion: 4, mobility: 3 },
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
    endurance: { armor: 5, cohesion: 3, mobility: 2 },
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
    endurance: { armor: 4, cohesion: 5, mobility: 2 },
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
    endurance: { armor: 3, cohesion: 4, mobility: 4 },
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
    name: "ROLLING SABOTAGE",
    summary: "Seize, hand off, sabotage, withdraw.",
    intent: "Advance the whole Warhost through both control nodes, transfer security behind the lead, sabotage the primary asset, and reform for extraction.",
    icon: Anchor,
    stages: [
      { label: "SEIZE", detail: "Open first objective.", icon: Anchor },
      { label: "HAND OFF", detail: "Pass secured ground.", icon: Shield },
      { label: "SABOTAGE", detail: "Disable primary asset.", icon: Hammer, warm: true },
      { label: "WITHDRAW", detail: "Reform at extraction.", icon: Truck },
    ],
    roles: [
      { id: "pull", label: "LEAD ELEMENT", brief: "Seize the first control node and open the army route.", node: "alphaApproach", demands: ["CONTROL", "SHOCK"] },
      { id: "burn", label: "RELAY GUARD", brief: "Take responsibility for secured ground as the lead advances.", node: "fireLine", demands: ["DENIAL", "COVER"] },
      { id: "break", label: "SABOTAGE ELEMENT", brief: "Pass through the opened route and disable the primary asset.", node: "breachLine", demands: ["BREACH", "CONTROL"] },
      { id: "anchor", label: "CORRIDOR SECURITY", brief: "Hold the route connecting the army to extraction.", node: "anchorLine", demands: ["HOLD", "DENIAL"] },
      { id: "recover", label: "RECOVERY ELEMENT", brief: "Recover priority personnel and reform the army at extraction.", node: "recoveryLine", demands: ["RECOVERY", "SUPPORT"] },
    ],
  },
  {
    id: "spear",
    name: "DECISIVE ASSAULT",
    summary: "Screen, concentrate, strike, secure.",
    intent: "Screen the advance, mass the Warhost against the decisive objective, destroy its defenses, and secure the withdrawal corridor.",
    icon: Shield,
    stages: [
      { label: "SCREEN", detail: "Protect concentration.", icon: Shield },
      { label: "CONCENTRATE", detail: "Mass at decisive point.", icon: Crosshair },
      { label: "STRIKE", detail: "Destroy objective defense.", icon: Hammer, warm: true },
      { label: "SECURE", detail: "Hold withdrawal route.", icon: Anchor },
    ],
    roles: [
      { id: "screen", label: "SCREENING ELEMENT", brief: "Protect the army while it concentrates for the assault.", node: "alphaApproach", demands: ["COVER", "SHOCK"] },
      { id: "point", label: "ADVANCE GUARD", brief: "Secure the narrow approach to the decisive objective.", node: "highWalk", demands: ["MOBILITY", "SHOCK"] },
      { id: "punch", label: "ASSAULT ELEMENT", brief: "Break the objective defense and strike the primary asset.", node: "breachLine", demands: ["BREACH", "CONTROL"] },
      { id: "suppress", label: "FLANK SECURITY", brief: "Prevent enemy reinforcements from reaching the assault.", node: "fireLine", demands: ["DENIAL", "COVER"] },
      { id: "recover", label: "REAR ELEMENT", brief: "Recover the assault force through the secured corridor.", node: "recoveryLine", demands: ["RECOVERY", "SUPPORT"] },
    ],
  },
  {
    id: "pressure",
    name: "TWIN SEIZURE",
    summary: "Divide, capture, converge, extract.",
    intent: "Divide the Warhost between simultaneous control objectives, prevent mutual support, then converge on the primary asset and extraction.",
    icon: Crosshair,
    stages: [
      { label: "DIVIDE", detail: "Form two objective groups.", icon: Crosshair },
      { label: "CAPTURE", detail: "Seize both controls.", icon: Target },
      { label: "CONVERGE", detail: "Reunite on primary.", icon: Factory, warm: true },
      { label: "EXTRACT", detail: "Recover the split force.", icon: Truck },
    ],
    roles: [
      { id: "alpha", label: "WEST OBJECTIVE GROUP", brief: "Seize and maintain the western control objective.", node: "alphaApproach", demands: ["HOLD", "CONTROL"] },
      { id: "beta", label: "EAST OBJECTIVE GROUP", brief: "Seize the eastern control objective in parallel.", node: "betaLane", demands: ["MOBILITY", "SHOCK"] },
      { id: "deny", label: "INTERDICTION ELEMENT", brief: "Prevent enemy movement between the two objective fights.", node: "fireLine", demands: ["DENIAL", "COVER"] },
      { id: "reactor", label: "CONVERGENCE ELEMENT", brief: "Unite both groups at the primary objective.", node: "breachLine", demands: ["BREACH", "CONTROL"] },
      { id: "recover", label: "EXTRACTION ELEMENT", brief: "Collect the reunited army and clear the battlefield.", node: "recoveryLine", demands: ["RECOVERY", "HOLD"] },
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

const ASHEN_PASSAGE_PLAYBOOK_COPY = {
  trapline: {
    name: "ROLLING EVACUATION",
    summary: "Open, hand off, hold, evacuate.",
    intent: "Advance the whole Warhost through both Ember Gates, transfer security behind the lead, hold the relay, and reform at the Void Lift.",
    stageLabels: ["OPEN", "HAND OFF", "HOLD", "EVACUATE"],
    briefs: ["Open the western gate and establish the army route.", "Take responsibility for the opened gate as the lead advances.", "Secure the Signal Furnace and maintain the evacuation uplink.", "Hold the corridor connecting the army to the Void Lift.", "Recover the relay crew and reform the army for evacuation."],
  },
  spear: {
    name: "FURNACE ASSAULT",
    summary: "Screen, concentrate, secure, escort.",
    intent: "Screen the approach, concentrate at the Signal Furnace, secure the relay, and escort the Warhost through the Void Lift corridor.",
    stageLabels: ["SCREEN", "CONCENTRATE", "SECURE", "ESCORT"],
    briefs: ["Protect the army while it concentrates through the western gate.", "Secure the smoke-obscured approach to the relay.", "Break the eastern gate defense and secure the Signal Furnace.", "Prevent the north-shaft reserve from reaching the relay.", "Escort the assault force through the protected Void Lift corridor."],
  },
  pressure: {
    name: "TWIN GATE",
    summary: "Divide, open, converge, evacuate.",
    intent: "Divide the Warhost between both Ember Gates, prevent mutual support, then converge on the Signal Furnace and Void Lift.",
    stageLabels: ["DIVIDE", "OPEN", "CONVERGE", "EVACUATE"],
    briefs: ["Open and maintain the western Ember Gate.", "Open the eastern Ember Gate in parallel.", "Prevent either gate defense from reinforcing the other.", "Reunite both groups at the Signal Furnace relay.", "Collect the reunited army at the Void Lift."],
  },
};

const ASHEN_REFIT_PROTOCOLS = {
  magnet: {
    name: "MAGNETIC RELAY KEY",
    stopIndex: 2,
    text: "The Breach Magnet locks onto the buried relay spine, opening the objective route and shielding the withdrawal.",
    impact: { reactor: 30, extraction: 15, protects: 1 },
  },
  crucible: {
    name: "VEIL CIPHER",
    stopIndex: 1,
    text: "The Ash Crucible reads the veil current, preserving the Void Lift approach through the smoke.",
    impact: { extraction: 15, protects: 1 },
  },
  charge: {
    name: "VEIL FRACTURE",
    stopIndex: 0,
    text: "The Fracture Charge breaks the first ash front, accelerating the eastern gate and protecting the column.",
    impact: { beta: 30, extraction: 15, protects: 1 },
  },
  sled: {
    name: "FURNACE FEED",
    stopIndex: 1,
    text: "The Supply Sled couples to a furnace conduit, feeding the gate assault, relay hold, and evacuation clock.",
    impact: { beta: 30, reactor: 15, extraction: 15, protects: 1 },
  },
  shield: {
    name: "VOID LIFT BUBBLE",
    stopIndex: 0,
    text: "The Evac Shield catches the full column at deployment, absorbing improvised-task delay and protecting the lift run.",
    impact: { extraction: 30, protects: 1, delayReduction: 45 },
  },
};

const playbookForOperation = (playbook, operation) => {
  if (operation?.id !== "ashen-passage") return playbook;
  const copy = ASHEN_PASSAGE_PLAYBOOK_COPY[playbook.id];
  if (!copy) return playbook;
  return {
    ...playbook,
    name: copy.name ?? playbook.name,
    summary: copy.summary ?? playbook.summary,
    intent: copy.intent,
    stages: playbook.stages.map((stage, index) => ({ ...stage, label: copy.stageLabels?.[index] ?? stage.label })),
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
      counterCapabilities: ["CONTROL", "DENIAL"],
      pressure: { type: "SUPPRESSION", target: "cohesion", strength: 3 },
      resistance: 7,
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
      counterCapabilities: ["BREACH", "SHOCK"],
      pressure: { type: "FIREPOWER", target: "armor", strength: 4 },
      resistance: 8,
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
      counterCapabilities: ["RECOVERY", "HOLD"],
      pressure: { type: "PURSUIT", target: "mobility", strength: 5 },
      resistance: 8,
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
      counterCapabilities: ["CONTROL", "COVER"],
      pressure: { type: "SIGNAL SHOCK", target: "cohesion", strength: 3 },
      resistance: 7,
      counteredBy: ["COVERED DRAG", "POWER WINCH", "FURNACE DRAGNET", "ASHEN CORDON", "MAGNETIC RELAY KEY", "VEIL FRACTURE", "FURNACE FEED"],
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
      counterCapabilities: ["BREACH", "DENIAL"],
      pressure: { type: "FIREPOWER", target: "armor", strength: 4 },
      resistance: 8,
      counteredBy: ["THERMAL BREACH", "COVERED ADVANCE", "LOCKED BREACH", "WEDGE & WALL", "LOCKSTEP HOLD", "FURNACE FEED"],
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
      counterCapabilities: ["RECOVERY", "HOLD"],
      pressure: { type: "OCCUPATION", target: "mobility", strength: 5 },
      resistance: 8,
      counteredBy: ["ARMORED EVAC", "HOT RECOVERY", "BREACH RECOVERY", "MOBILE RESUPPLY", "VOID LIFT BUBBLE"],
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

const PLAYBACK_BEAT_MS = 2600;
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
      formationId: formation.id,
      formationName: formation.name,
      refitName: formation.activeRefit.name,
      capabilities: formation.capabilities,
      endurance: formation.endurance,
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

const calculateRefitProtocols = (playbook, assignments, formations, operation) => Object.fromEntries(
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

const calculateEnemyClashes = (operation, handoffs, activeProtocols = [], readiness = {}) => {
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

const calculateOperationProfile = (handoffs, branchChoices, readiness, condition, operation, refitProtocols = {}, playbook = PLAYBOOKS[0]) => {
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
  const alphaAt = Math.max(30, BASE_OPERATION.alphaAt - total("alpha") - protocolTotal("alpha") - doctrine.impact.alpha);
  const betaAt = Math.max(alphaAt + 45, BASE_OPERATION.betaAt - total("beta") - protocolTotal("beta") - doctrine.impact.beta);
  const betaDecisionAt = Math.max(alphaAt + 15, betaAt - 45);
  const reactorAt = Math.max(betaAt + 60, BASE_OPERATION.reactorAt - total("reactor") - protocolTotal("reactor") - doctrine.impact.reactor + branchTotal("reactorDelay") + enemyTotal("reactorDelay"));
  const reactorExposeAt = Math.max(betaAt + 30, reactorAt - 45);
  const rescueDecisionAt = Math.max(betaAt + 30, Math.min(210, reactorExposeAt - 15));
  const extractionAt = Math.max(reactorAt + 30, BASE_OPERATION.extractionAt - total("extraction") - protocolTotal("extraction") - doctrine.impact.extraction) + branchTotal("missionDelay") + enemyTotal("missionDelay") + readinessSummary.delay + doctrine.impact.missionDelay;
  const completeAt = extractionAt + 15;
  const overrun = Math.max(0, completeAt - BASE_OPERATION.completeAt);
  const protectedCount = total("protects") + protocolTotal("protects") + branchTotal("protects") + doctrine.impact.protects;
  const enemyRecoveryLoss = Math.ceil(enemyTotal("recoveryLoss"));
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
    timeSaved: Math.max(0, BASE_OPERATION.completeAt - completeAt),
    overrun,
    reinforcementLoss,
    enemyRecoveryLoss,
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
      text: clash.eventText,
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

const protocolImpactText = (impact) => [
  impact.alpha ? `FIRST GATE -${fmtDuration(impact.alpha)}` : null,
  impact.beta ? `SECOND GATE -${fmtDuration(impact.beta)}` : null,
  impact.reactor ? `RELAY -${fmtDuration(impact.reactor)}` : null,
  impact.extraction ? `VOID LIFT -${fmtDuration(impact.extraction)}` : null,
  impact.protects ? `+${impact.protects} FORMATION PRESERVED` : null,
  impact.delayReduction ? `ABSORBS ${fmtDuration(impact.delayReduction)} IMPROVISED DELAY` : null,
].filter(Boolean).join(" · ");

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

function FormationDossier({ formation, interactions, assignedRole, assignedIndex, readiness, phase, refitsLocked, onRefit }) {
  if (!formation) return null;
  const Icon = formation.icon;

  return (
    <aside className="formation-dossier panel-surface" aria-label={`${formation.name} formation dossier`}>
      <div className="dossier-heading"><span>FORMATION DOSSIER</span><em>NEUTRAL INTEL</em></div>
      <div className="dossier-identity">
        <FormationPortrait formation={formation} compact />
        <div><span>FORMATION {formation.number}</span><b>{formation.name}</b><small><Icon weight="duotone" /> {formation.role}</small></div>
      </div>
      <p>{formation.purpose}</p>
      <div className="dossier-endurance" aria-label="Formation endurance profile">
        {Object.entries(formation.endurance).map(([axis, value]) => (
          <div key={axis}><span>{axis}</span><b>{value}</b><small>{"■".repeat(value)}{"□".repeat(5 - value)}</small></div>
        ))}
      </div>
      {formation.campaignCondition && (
        <div className={`dossier-campaign-state ${formation.campaignCondition.state}`}>
          <Warning weight="fill" />
          <span><b>{formation.campaignCondition.label}</b><small>{formation.disabledCapability ? `${formation.disabledCapability} OFFLINE THIS OPERATION` : "FORMATION UNAVAILABLE THIS OPERATION"}</small></span>
        </div>
      )}
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
      <div className="dossier-links">
        <span>POTENTIAL FORMATION LINKS</span>
        {interactions.length > 0 ? interactions.map((interaction) => (
          <div key={interaction.partnerId}>
            <b>{interaction.partnerName}</b>
            {interaction.incoming && <small><ArrowRight weight="bold" /> {interaction.incoming.text}</small>}
            {interaction.outgoing && <small><ArrowRight weight="bold" /> {interaction.outgoing.text}</small>}
          </div>
        )) : <p>No direct keyword interaction with the current refits. It may still fit a responsibility.</p>}
        <em>Compatibility shows a possible handoff, not the best placement or a guaranteed result.</em>
      </div>
      {assignedRole && readiness ? (
        <div className="dossier-placement concealed">
          <div><span>ASSIGNED TO STOP {String(assignedIndex + 1).padStart(2, "0")}</span><b>OUTCOME SEALED</b><small>{assignedRole.label}</small></div>
          <div className="dossier-observations"><em>COMPARE CAPABILITIES</em><em>CHECK CREATES</em><em>CHECK REACTIONS</em></div>
        </div>
      ) : (
        <div className="dossier-unplaced"><b>ASSIGN BY DOCTRINE</b><small>Use the responsibility, capabilities, creates, and reactions above. Results reveal under contact.</small></div>
      )}
    </aside>
  );
}

function MissionMatchupBrief({ operation }) {
  const matchup = resolveDispositionMatchup({
    playerDisposition: operation.matchup?.playerDisposition,
    enemyDisposition: operation.matchup?.enemyDisposition,
    mission: operation.matchup,
  });
  if (!matchup) return null;
  return (
    <section className="mission-matchup-brief" aria-label="Disposition mission matchup">
      <span>MISSION GENERATED BY DISPOSITIONS</span>
      <div className="disposition-versus">
        <div><small>YOUR FORCE</small><b>{matchup.player.name}</b></div>
        <em>VS</em>
        <div><small>ENEMY FORCE</small><b>{matchup.enemy.name}</b></div>
      </div>
      <h2>{matchup.title}</h2>
      <p className="player-order"><b>YOUR ORDER</b>{matchup.playerObjective}</p>
      <p className="enemy-order"><b>ENEMY ORDER</b>{matchup.enemyObjective}</p>
    </section>
  );
}

function StrategyTestPanel({ activeTrial, available, blindActive, blindPrediction, onBlindPrediction, onLoad, onStartBlind, playbook }) {
  const templates = strategyTrialsForPlaybook(playbook.id);
  return (
    <section className={`strategy-test-panel ${blindActive ? "blind-active" : ""}`} aria-label={blindActive ? "Blind command test" : "Command assistance"}>
      <header><span>{blindActive ? "BLIND COMMAND TEST" : "COMMAND ASSISTANCE"}</span><small>{blindActive ? "OUTCOME SEALED" : `${playbook.name} · EDITABLE STARTS`}</small></header>
      {blindActive ? (
        <>
          <p>The answer is hidden. Build your own play, place every formation, choose the authored breakpoint orders, then predict the result.</p>
          <div className="blind-prediction-block">
            <span>PREDICT BEFORE COMMITMENT</span>
            <div>
              {BLIND_PREDICTIONS.map((prediction) => (
                <button key={prediction.id} className={blindPrediction === prediction.id ? "selected" : ""} onClick={() => onBlindPrediction(prediction.id)} aria-pressed={blindPrediction === prediction.id}>
                  <b>{prediction.label}</b><small>{prediction.detail}</small>
                </button>
              ))}
            </div>
          </div>
          <small className="blind-test-rule">Exact extraction and reinforcement forecasts remain sealed until execution.</small>
        </>
      ) : (
        <>
          <p>Choose a competent starting posture for <b>{playbook.name}</b>, then edit any formation, refit, or breakpoint. Templates contain deliberate compromises and are never the optimal answer.</p>
          <button className="start-blind-test" onClick={onStartBlind} disabled={!available}><Target weight="duotone" /><span><b>START BLIND COMMAND TEST</b><small>Build your own plan and predict its outcome.</small></span></button>
          <div className="strategy-trial-list">
            {templates.map((trial) => (
              <button
                key={trial.id}
                className={activeTrial?.id === trial.id ? "selected" : ""}
                onClick={() => onLoad(trial.id)}
                disabled={!available}
                aria-pressed={activeTrial?.id === trial.id}
              >
                <strong>{trial.run}</strong>
                <span><b>{trial.name}</b><small>{trial.posture === "aggressive" ? "FAST · EXPOSED" : trial.posture === "cautious" ? "PROTECTED · SLOW" : "FLEXIBLE · GENERAL"}</small></span>
              </button>
            ))}
          </div>
          {activeTrial?.playbookId === playbook.id && <div className="strategy-trial-hypothesis"><b>{activeTrial.name} STARTING PLAN LOADED · EDIT FREELY</b><span>{activeTrial.priority}</span><small>TRADEOFF · {activeTrial.sacrifice}</small></div>}
        </>
      )}
    </section>
  );
}

function FormationRoster({ formations, unavailableFormations = [], inspected, onInspect, selected, onSelect, assignments, playbook, onPlaybook, operation, phase, strategyTrial, blindTestActive, blindPrediction, onBlindPrediction, onLoadStrategyTrial, onStartBlindTest, onFormationDragStart, readiness, refitsLocked, onRefit }) {
  const roleByFormation = Object.fromEntries(
    playbook.roles.filter((role) => assignments[role.id]).map((role) => [assignments[role.id], role]),
  );
  const inspectedFormation = formations.find((formation) => formation.id === inspected);
  const inspectedRole = roleByFormation[inspected];
  const inspectedRoleIndex = inspectedRole ? playbook.roles.findIndex((role) => role.id === inspectedRole.id) : -1;
  const inspectedInteractions = formationInteractionsFor({ formations, formationId: inspected });
  const interactionByFormationId = new Map(inspectedInteractions.map((interaction) => [interaction.partnerId, interaction]));
  const adjacentFormationIds = new Set(adjacentFormationIdsFor({ roles: playbook.roles, assignments, formationId: inspected }));
  return (
    <section className="left-rail" aria-label="Tactical playbooks and Warhost formations">
      {(phase === "plan" || phase === "drill") && <MissionMatchupBrief operation={operation} />}
      <div className="doctrine-heading"><span>CHOOSE TOTAL-ARMY PLAY</span><Radio weight="duotone" /></div>
      <div className="playbook-list">
        {PLAYBOOKS.map((baseItem) => {
          const item = playbookForOperation(baseItem, operation);
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
              <span><b>{item.name}</b><small>{item.summary}</small><em>{item.stages.map((stage) => stage.label).join(" → ")}</em></span>
            </button>
          );
        })}
      </div>
      {phase === "plan" && operation.id === "dead-circuit" && (
        <StrategyTestPanel activeTrial={strategyTrial} available={formations.length === FORMATIONS.length} blindActive={blindTestActive} blindPrediction={blindPrediction} onBlindPrediction={onBlindPrediction} onLoad={onLoadStrategyTrial} onStartBlind={onStartBlindTest} playbook={playbook} />
      )}
      <div className="rail-heading">
        <span>SELECT FORMATION</span>
        <span>VIEW ON FIELD</span>
      </div>
      <div className="formation-list">
        {formations.map((formation) => {
          const Icon = formation.icon;
          const active = selected === formation.id;
          const inspectionSource = inspected === formation.id;
          const interaction = interactionByFormationId.get(formation.id) ?? null;
          const direction = interactionDirectionFor(interaction);
          const activeInteraction = Boolean(interaction && adjacentFormationIds.has(formation.id));
          const assignedRole = roleByFormation[formation.id];
          const assignedIndex = assignedRole ? playbook.roles.findIndex((role) => role.id === assignedRole.id) : -1;
          return (
            <button
              key={formation.id}
              className={`formation-row ${active ? "selected" : ""} ${inspectionSource ? "inspection-source" : ""} ${interaction ? `interaction-${direction} ${activeInteraction ? "interaction-active" : "interaction-potential"}` : ""} ${assignedRole ? "assigned" : "available"}`}
              onClick={() => onSelect(formation.id)}
              onMouseEnter={() => onInspect(formation.id)}
              onMouseLeave={() => onInspect(null)}
              onFocus={() => onInspect(formation.id)}
              onBlur={() => onInspect(null)}
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
                {interaction && <em className={`formation-interaction-hint ${direction} ${activeInteraction ? "active" : "potential"}`}><Radio weight="fill" /> {activeInteraction ? "ACTIVE ADJACENT LINK" : "POTENTIAL IF ADJACENT"}</em>}
                {formation.campaignCondition && <em className="formation-campaign-state">{formation.campaignCondition.label} · {formation.disabledCapability} OFFLINE</em>}
              </span>
            </button>
          );
        })}
        {unavailableFormations.map((formation) => (
          <div className="formation-row formation-unavailable" key={formation.id} aria-label={`${formation.name}. Missing and unavailable for this operation.`}>
            <span className="formation-number">{formation.number}</span>
            <FormationPortrait formation={formation} compact />
            <span className="formation-copy"><b>{formation.name}</b><small>MISSING</small><em>UNAVAILABLE · LEAVES ONE STOP EMPTY</em></span>
          </div>
        ))}
      </div>
      <FormationDossier formation={inspectedFormation} interactions={inspectedInteractions} assignedRole={inspectedRole} assignedIndex={inspectedRoleIndex} readiness={inspectedRole ? readiness[inspectedRole.id] : null} phase={phase} refitsLocked={refitsLocked} onRefit={onRefit} />
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

function TacticalFieldPlan({ assignments, battleTime, branches, consequences, formationFates, formations, operation, phase, playbook, playbackBeat }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });
  const operationField = operationFieldFor(operation);
  const plan = operationField.plans[playbook.id];
  const breakpoints = breakpointsFor(operation);
  const execution = phase === "battle" || phase === "complete";
  const resolvedFates = new Map((execution ? formationFates : [])
    .filter((formationFate) => formationFate.at <= battleTime)
    .map((formationFate) => [formationFate.formationId, formationFate]));
  const focusedPlayerIds = playbackBeat?.playerFormationIds ?? [];
  const hasPlayerFocus = focusedPlayerIds.length > 0;

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
  }, [phase, playbook.id]);

  if (!plan) return null;

  const routes = plan.routes.map((route) => {
    const roleIndex = route.role;
    const role = playbook.roles[roleIndex];
    const formation = formations.find((item) => item.id === assignments[role.id]);
    const staging = formation ? STAGING_NODES[formation.id] : null;
    const start = staging ? { x: staging.left, y: staging.top - 3 } : route.start;
    const playbackClass = execution && hasPlayerFocus
      ? focusedPlayerIds.includes(formation?.id) ? "playback-focused" : "playback-muted"
      : "";
    const consequenceClass = formation && consequences?.[formation.id] ? `state-${consequences[formation.id].state}` : "";
    const fateClass = formation && resolvedFates.has(formation.id) ? `fate-${resolvedFates.get(formation.id).fate}` : "";
    return { ...route, roleIndex, role, formation, start, playbackClass, consequenceClass, fateClass };
  });
  const executionRoutes = buildAuthoredFormationRoutes({
    plan,
    landmarks: operationField.landmarks,
    roles: playbook.roles,
    assignments,
    formationStarts: Object.fromEntries(routes.filter((route) => route.formation).map((route) => [route.formation.id, route.start])),
    branches,
  });
  const baseSegments = (execution ? executionRoutes : routes).flatMap((route) => {
    const points = execution
      ? route.points
      : [route.start, ...route.points].map((point) => resolveFieldPoint(plan, operationField.landmarks, point));
    const routePresentation = routes.find((item) => item.roleIndex === route.roleIndex);
    return points.slice(0, -1).map((point, index) => ({
      id: `route-${route.roleIndex}-${index}`,
      start: point,
      end: points[index + 1],
      className: `base lane-${route.roleIndex + 1} ${routePresentation?.formation ? "staffed" : ""} ${routePresentation?.playbackClass ?? ""} ${routePresentation?.consequenceClass ?? ""} ${routePresentation?.fateClass ?? ""}`,
    }));
  });
  const branchSegments = execution ? [] : breakpoints.flatMap((breakpoint, breakpointIndex) => {
    const selectedOptionId = branches[breakpoint.id];
    const roleIndex = plan.breakpointRoles[breakpoint.id];
    const role = playbook.roles[roleIndex];
    const staffed = Boolean(assignments[role.id]);
    const orderedOptions = execution
      ? breakpoint.options.filter((option) => option.id === selectedOptionId)
      : [
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
        className: `branch breakpoint-${breakpointIndex + 1} lane-${roleIndex + 1} ${selectedRoute ? "selected-route" : "alternative-route"} ${staffed ? "staffed" : ""} ${changed ? "changed" : ""} ${execution && hasPlayerFocus ? focusedPlayerIds.includes(assignments[role.id]) ? "playback-focused" : "playback-muted" : ""}`,
      }));
    });
  });
  const branchTurns = breakpoints.flatMap((breakpoint, breakpointIndex) => {
    const selectedOptionId = branches[breakpoint.id];
    const visibleOptions = execution
      ? breakpoint.options.filter((option) => option.id === selectedOptionId)
      : breakpoint.options;
    return visibleOptions.flatMap((option) => {
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
    <div className={`field-plan-layer ${execution ? "executing" : "planning"}`} ref={layerRef} aria-label={`${playbook.name} authored battlefield plan`}>
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
        <div className={`field-plan-entry lane-${route.roleIndex + 1} ${route.formation ? "staffed" : ""} ${route.playbackClass} ${route.consequenceClass} ${route.fateClass}`} style={{ left: `${route.start.x}%`, top: `${route.start.y}%` }} key={`origin-${route.roleIndex}`}>
          <Flag weight="fill" />
          <span>{route.formation ? route.formation.number : String(route.roleIndex + 1).padStart(2, "0")}</span>
          <small>{route.formation ? route.formation.name : `ROUTE ${String(route.roleIndex + 1).padStart(2, "0")}`}</small>
        </div>
      ))}
      {plan.positions.map((position, index) => {
        const role = playbook.roles[index];
        const formation = formations.find((item) => item.id === assignments[role.id]);
        const consequenceClass = formation && consequences?.[formation.id] ? `state-${consequences[formation.id].state}` : "";
        const fateClass = formation && resolvedFates.has(formation.id) ? `fate-${resolvedFates.get(formation.id).fate}` : "";
        return (
          <div className={`field-plan-position lane-${index + 1} ${formation ? "staffed" : ""} ${consequenceClass} ${fateClass} ${execution && hasPlayerFocus ? focusedPlayerIds.includes(formation?.id) ? "playback-focused" : "playback-muted" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} key={role.id}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{role.label.split(" / ")[0]}</span>
            {formation && <em>{formation.name}</em>}
          </div>
        );
      })}
    </div>
  );
}

function EnemyFieldPlan({ battleTime, operation, phase, clashes, profile, planReady, playbook, playbackBeat }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });
  const enemyPlan = enemyPlanFor(operation);
  const reinforcementWave = reinforcementWaveFor(operation);
  const operationField = operationFieldFor(operation);
  const fieldPlan = operationField.plans[playbook.id];
  const firstPosition = fieldPlan.positions[0];
  const secondPosition = fieldPlan.positions[1];
  const collisionPoint = {
    x: (firstPosition.x + secondPosition.x) / 2,
    y: (firstPosition.y + secondPosition.y) / 2,
  };

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
  const routeForClash = (formation, clash, index) => {
    if (operation.id !== "ashen-passage") return [formation.start, formation.end];
    if (index === 0 && clash.routeState === "trapped") return [formation.start, collisionPoint];
    if (index === 0 && clash.routeState === "diverted") return [formation.start, collisionPoint, operationField.landmarks.reactor];
    if (index === 0) return [formation.start, collisionPoint, formation.end];
    if (clash.routeState === "redirected") return [formation.start, operationField.landmarks.reactor];
    if (clash.routeState === "starved") return [formation.start, {
      x: formation.start.x + (formation.end.x - formation.start.x) * .12,
      y: formation.start.y + (formation.end.y - formation.start.y) * .12,
    }];
    return [formation.start, formation.end];
  };

  const focusedEnemyIndices = playbackBeat?.enemyFormationIndices?.length
    ? playbackBeat.enemyFormationIndices
    : Number.isInteger(playbackBeat?.enemyFormationIndex) ? [playbackBeat.enemyFormationIndex] : [];
  const doctrinePhase = playbackBeat?.doctrinePhase ?? "none";
  const reinforcementPlaybackClass = playbackBeat?.reinforcementFocus ? "playback-focused" : "";

  return (
    <div className={`enemy-plan-layer phase-${phase} doctrine-${doctrinePhase}`} ref={layerRef} aria-label={`${enemyPlan.name} enemy battlefield plan`}>
      {enemyPlan.formations.map((formation, index) => {
        const clash = clashes[index];
        const inBattle = phase === "battle" || phase === "complete";
        const playbackHasEnemyFocus = focusedEnemyIndices.length > 0;
        const playbackFocused = focusedEnemyIndices.includes(index);
        const playbackClass = inBattle
          ? playbackHasEnemyFocus
            ? playbackFocused ? "playback-focused" : "playback-muted"
            : "playback-muted"
          : "";
        const counterRevealClass = playbackFocused && (doctrinePhase === "enemy-counter" || doctrinePhase === "outcome") ? "doctrine-counter-reveal" : "";
        const progress = inBattle ? Math.min(1, battleTime / formation.actionAt) : 0;
        const route = routeForClash(formation, clash, index);
        const position = pointAlongFieldRoute(route, progress);
        const endpoint = route.at(-1);
        const resolved = inBattle && battleTime >= formation.actionAt;
        return (
          <Fragment key={formation.id}>
            {route.slice(0, -1).map((start, segmentIndex) => (
              <div className={`enemy-plan-segment enemy-lane-${index + 1} ${clash.routeState} ${playbackClass} ${counterRevealClass}`} style={fieldSegmentStyle(start, route[segmentIndex + 1], layerSize)} key={`${formation.id}-segment-${segmentIndex}`}>
                <ArrowRight weight="bold" />
              </div>
            ))}
            <div className={`enemy-plan-stop enemy-lane-${index + 1} ${clash.routeState} ${playbackClass} ${counterRevealClass}`} style={{ left: `${endpoint.x}%`, top: `${endpoint.y}%` }}>
              <b>{formation.number}</b><span>{clash.label}</span>
            </div>
            <div className={`enemy-plan-formation ${clash.routeState} ${resolved ? clash.disrupted ? "disrupted" : "landed" : "advancing"} ${playbackClass} ${counterRevealClass}`} style={{ left: `${position.x}%`, top: `${position.y}%` }}>
              <img src="/assets/helioch-sentinels.png" alt={`${formation.name} executing ${clash.label}`} />
              <span>{formation.number}</span>
              <small>{resolved ? clash.routeState === "starved" ? "CHAIN STARVED" : clash.routeState === "diverted" || clash.routeState === "redirected" ? "REROUTED" : clash.disrupted ? "DISRUPTED" : clash.label : formation.name}</small>
            </div>
          </Fragment>
        );
      })}
      {operation.id === "ashen-passage" && (
        <div className={`enemy-collision-marker ${profile.enemyCollision?.outcome ?? "unread"} ${playbackBeat?.kind === "contact" ? "playback-focused" : ""}`} style={{ left: `${collisionPoint.x}%`, top: `${collisionPoint.y}%` }}>
          <Crosshair weight="duotone" />
          <span>{profile.enemyCollision?.revealed ? profile.enemyCollision.title : "STOP 01/02 CONTACT WINDOW"}</span>
        </div>
      )}
      <div className={`reinforcement-route ${clearsBeforeWave ? "avoided" : "threat"} ${reinforcementPlaybackClass}`} style={fieldSegmentStyle(reinforcementWave.start, reinforcementWave.intercept, layerSize)}>
        <ArrowRight weight="bold" />
      </div>
      <div className={`reinforcement-intercept ${clearsBeforeWave ? "avoided" : "threat"} ${reinforcementPlaybackClass}`} style={{ left: `${reinforcementWave.intercept.x}%`, top: `${reinforcementWave.intercept.y}%` }}>
        <Crosshair weight="duotone" />
        <span>{!planReady ? `ENEMY WAVE · T+${fmtDuration(reinforcementWave.arrivalAt)}` : clearsBeforeWave ? "WARHOST CLEARS FIRST" : `${fmtDuration(profile.overrun)} INTERCEPT WINDOW`}</span>
      </div>
      <div className={`enemy-plan-formation reinforcement-wave ${waveArrived ? "landed" : waveProgress > 0 ? "advancing" : "queued"} ${clearsBeforeWave ? "avoided" : ""} ${reinforcementPlaybackClass}`} style={{ left: `${wavePosition.x}%`, top: `${wavePosition.y}%` }}>
        <img src="/assets/helioch-sentinels.png" alt={`${reinforcementWave.name} approaching ${operation.extractionTitle}`} />
        <span>{reinforcementWave.number}</span>
        <small>{waveArrived ? reinforcementWave.order : `WAVE · T+${fmtDuration(reinforcementWave.arrivalAt)}`}</small>
      </div>
    </div>
  );
}

function DoctrineCollisionOverlay({ beat, operation, playbook }) {
  if (!beat?.doctrinePhase) return null;
  const operationField = operationFieldFor(operation);
  const positions = operationField.plans[playbook.id]?.positions ?? [];
  const midpoint = (left, right) => ({
    x: ((left?.x ?? 50) + (right?.x ?? 50)) / 2,
    y: ((left?.y ?? 50) + (right?.y ?? 50)) / 2,
  });
  const point = playbook.id === "spear"
    ? operationField.landmarks.reactor
    : playbook.id === "pressure"
      ? midpoint(operationField.landmarks.alpha, operationField.landmarks.beta)
      : midpoint(positions[0], positions[1]);
  const phaseLabels = {
    "player-play": "YOUR PLAY",
    "field-change": "FIELD CHANGES",
    "enemy-counter": "ENEMY COUNTER-LINES",
    outcome: "COLLISION RESOLVED",
  };

  return (
    <div className={`doctrine-collision-overlay ${playbook.id} ${beat.doctrinePhase} ${beat.routeState ?? ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-hidden="true">
      <span>{phaseLabels[beat.doctrinePhase]}</span>
      <b>{playbook.id === "trapline" ? "KILL BOX" : playbook.id === "spear" ? "THRUST / REAR" : "TWO AXES"}</b>
      {(beat.doctrinePhase === "enemy-counter" || beat.doctrinePhase === "outcome") && <Crosshair weight="duotone" />}
    </div>
  );
}

function TacticalHandoffBoard({ feedback, formations, handoffs, profile, staffExerciseIndex, onStaffExercise }) {
  const discovered = [];
  const fullyStaffed = false;
  const timing = comboWindowTimes(profile);

  return (
    <div className="handoff-board" aria-live="polite">
      <div className="handoff-heading">
        <span>HANDOFF WINDOWS</span>
        <small>Inspect one neighboring pair with a Staff Exercise.</small>
      </div>
      {feedback ? (
        <div className="cascade-readout placement-impact rewired" key={feedback.revision} role="status">
          <span><Radio weight="fill" /> ASSIGNMENT RECORDED</span>
          <b>{feedback.formationName} → STOP {String(feedback.targetIndex + 1).padStart(2, "0")}</b>
          <div className="placement-impact-metrics">
            <strong>SEALED<small>HANDOFF RESULTS</small></strong>
            <strong>COMMIT TO REVEAL<small>MISSION OUTCOME</small></strong>
          </div>
        </div>
      ) : (
        <div className={`cascade-readout ${discovered.length > 0 ? "active" : fullyStaffed ? "broken" : "unresolved"}`}>
          <span><Radio weight="fill" /> COMMAND PLAN SEALED</span>
          <b>Assignments change the battle, but this screen no longer grades them.</b>
          <small>Read each formation's rules, then decide which responsibility it should carry.</small>
        </div>
      )}
      <div className="handoff-grid">
        {handoffs.map((handoff, handoffIndex) => {
          const staffed = handoff.sourceId && handoff.receiverId;
          const source = formations.find((formation) => formation.id === handoff.sourceId);
          const receiver = formations.find((formation) => formation.id === handoff.receiverId);
          const windowAt = timing[handoff.from];
          const revealed = planningResultRevealed({ phase: "plan", handoffIndex, staffExerciseIndex });
          return (
            <div
              className={`handoff-card ${revealed ? handoff.maneuver ? "discovered" : "independent" : "unresolved"}`}
              key={handoff.id}
            >
              <span className="combo-window-time">T+{fmtDuration(windowAt)} · AFTER {String(handoff.from + 1).padStart(2, "0")} / BEFORE {String(handoff.to + 1).padStart(2, "0")}</span>
              {revealed && handoff.maneuver ? (
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
                  <b>{revealed ? staffed ? "NO AUTOMATIC REACTION" : "WINDOW UNSTAFFED" : staffed ? "RESULT SEALED" : "STAFF BOTH STOPS"}</b>
                  <small>{revealed && staffed ? `${source.name} creates ${handoff.incomingCondition}; ${receiver.name} cannot use it.` : staffed ? `${source.name} to ${receiver.name}; result unknown.` : "A handoff requires formations on both sides."}</small>
                  {!revealed && staffed && staffExerciseIndex === null && <button className="staff-exercise-button" onClick={() => onStaffExercise(handoffIndex)}><Radio weight="fill" /> RUN STAFF EXERCISE</button>}
                  {!revealed && staffed && staffExerciseIndex !== null && <em className="staff-exercise-spent">{staffExerciseIndex === -1 ? "EXERCISE SPENT · PLAN CHANGED" : "STAFF EXERCISE SPENT"}</em>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaybookBoard({ active, assignments, battleTime, condition, drillStep, feedback, formations, handoffs, inspected, onChooseRole, onAssignFormation, onClearRole, onFormationDragStart, onInspectFormation, onSelectFormation, onStaffExercise, outputs, phase, playbook, profile, readiness, refitProtocols, staffExerciseIndex }) {
  const [dropTargetRoleId, setDropTargetRoleId] = useState(null);
  const discoveredHandoffs = handoffs.filter((handoff) => handoff.maneuver);
  const timing = comboWindowTimes(profile);
  const doctrine = profile.doctrine;
  const inspectedFormation = formations.find((formation) => formation.id === inspected) ?? null;
  const inspectedInteractions = formationInteractionsFor({ formations, formationId: inspected });
  const interactionByFormationId = new Map(inspectedInteractions.map((interaction) => [interaction.partnerId, interaction]));
  const adjacentFormationIds = new Set(adjacentFormationIdsFor({ roles: playbook.roles, assignments, formationId: inspected }));
  const activeInteractions = inspectedInteractions.filter((interaction) => adjacentFormationIds.has(interaction.partnerId));
  const inspectedAssigned = playbook.roles.some((role) => assignments[role.id] === inspected);
  const inspectingInteractions = (phase === "plan" || phase === "drill") && Boolean(inspectedFormation);

  if (phase === "battle" || phase === "complete") {
    return (
      <div className={`combo-panel panel-surface ${active ? "ready" : "broken"}`}>
        <span className="panel-label">{playbook.name}: {playbook.stages.map((stage) => stage.label).join(" → ")}</span>
        <p>{active ? playbook.intent : "One or more tactical roles are unresolved."}</p>
        <div className={`doctrine-battle-readout ${doctrine.triggered ? "triggered" : "exposed"}`}><span>{doctrine.name}</span><b>{doctrine.result}</b></div>
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
        <strong>
          {assignedCount} / {formations.length} FORMATIONS PLACED
          {formations.length < playbook.roles.length ? ` · ${playbook.roles.length - formations.length} STOP EMPTY` : ""}
        </strong>
      </div>
      <p>Assign each formation a responsibility. Rules stay visible; results remain sealed until commitment.</p>
      <div className="playbook-doctrine concealed">
        <span>PLAYBOOK DOCTRINE · {doctrine.name}</span>
        <b>{doctrine.strength}</b>
        <small>EXPOSURE · {doctrine.exposure}</small>
        <em>DOCTRINE RESULT UNRESOLVED</em>
      </div>
      {inspectingInteractions && (
        <section className="formation-interaction-inspector" aria-live="polite" aria-label={`${inspectedFormation.name} potential formation interactions`}>
          <header>
            <span><Radio weight="fill" /> SELECTED FORMATION</span>
            <b>{inspectedFormation.name}</b>
            <small>CREATES <strong>{inspectedFormation.creates}</strong> · CAN REACT TO <strong>{inspectedFormation.uses.join(" / ")}</strong></small>
            <div className="interaction-legend"><span className="source">CYAN: INSPECTED</span><span className="outgoing">YELLOW: IT FEEDS THEM</span><span className="incoming">PURPLE: THEY FEED IT</span></div>
          </header>
          <div className="formation-interaction-partners">
            {inspectedInteractions.length > 0 ? inspectedInteractions.map((interaction) => (
              <button className={`${adjacentFormationIds.has(interaction.partnerId) ? "active" : "potential"} ${interactionDirectionFor(interaction)}`} key={interaction.partnerId} onClick={() => onSelectFormation(interaction.partnerId)}>
                <b>{interaction.partnerName}<em>{adjacentFormationIds.has(interaction.partnerId) ? "ACTIVE NEIGHBOR" : "POTENTIAL - PLACE BESIDE"}</em></b>
                {interaction.outgoing && <small><ArrowRight weight="bold" /> {inspectedFormation.name} creates <strong>{interaction.outgoing.condition}</strong>; {interaction.partnerName} reacts</small>}
                {interaction.incoming && <small><ArrowRight weight="bold" /> {interaction.partnerName} creates <strong>{interaction.incoming.condition}</strong>; {inspectedFormation.name} reacts</small>}
              </button>
            )) : <p>No direct keyword interaction with the current refits. This formation can still perform a responsibility on its own.</p>}
            {inspectedAssigned && activeInteractions.length === 0 && <p className="independent-state">OPERATING INDEPENDENTLY - no adjacent handoff is armed. This is valid if the responsibility matters more than a combo.</p>}
          </div>
          <em>Color shows direction, not quality. Only neighboring staffed stops form an active handoff; the board does not rank placements.</em>
        </section>
      )}
      <div className="route-terminals" aria-hidden="true"><span>FORMATION LANES</span><span>COMBO ORDER</span></div>
      <div className="playbook-route">
        {playbook.roles.map((role, index) => {
          const roleDemands = roleDemandsFor(role, index, condition);
          const formation = formations.find((item) => item.id === assignments[role.id]);
          const refitProtocol = refitProtocols[role.id];
          const nextRole = playbook.roles[index + 1];
          const nextFormation = nextRole ? formations.find((item) => item.id === assignments[nextRole.id]) : null;
          const interaction = formation ? interactionByFormationId.get(formation.id) : null;
          const interactionDirection = interactionDirectionFor(interaction);
          const activeInteraction = Boolean(interaction && adjacentFormationIds.has(formation.id));
          const interactionClass = !inspectingInteractions || !formation
            ? ""
            : formation.id === inspected
              ? "interaction-selected"
              : activeInteraction
                ? `interaction-active interaction-${interactionDirection}`
                : interaction
                  ? `interaction-potential interaction-${interactionDirection}`
                  : "interaction-muted";
          return (
            <Fragment key={role.id}>
              <div
                className={`playbook-slot-shell ${interactionClass}`}
                onMouseEnter={() => formation && onInspectFormation(formation.id)}
                onMouseLeave={() => onInspectFormation(null)}
              >
              <button
                className={`playbook-slot planning-concealed ${formation ? "filled" : "empty"} ${dropTargetRoleId === role.id ? "drop-target" : ""} ${interactionClass}`}
                onClick={() => onChooseRole(role.id)}
                draggable={phase === "plan" && Boolean(formation)}
                onDragStart={(event) => formation && onFormationDragStart(event, formation.id)}
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
                    {formation.id === inspected && <span className="slot-interaction selected"><Radio weight="fill" /> INSPECTING · CREATES {formation.creates}</span>}
                    {interaction && (
                      <span className={`slot-interaction ${activeInteraction ? "active" : "potential"} ${interactionDirection}`}>
                        <Radio weight="fill" /> {activeInteraction ? "ACTIVE ADJACENT HANDOFF" : "POTENTIAL IF ADJACENT"} · {[interaction.outgoing?.condition, interaction.incoming?.condition].filter(Boolean).join(" / ")}
                      </span>
                    )}
                    {refitProtocol && (
                      <span className="slot-protocol concealed">
                        <b>REFIT INTERFACE UNRESOLVED</b>
                        <small>FIELD INTERACTION REVEALS UNDER CONTACT</small>
                      </span>
                    )}
                    <span className="slot-result concealed">
                      <span className="slot-output"><b>RESULT SEALED</b></span>
                      <span className="slot-readiness"><b>?</b><small>FIT</small></span>
                    </span>
                  </>
                ) : (
                  <span className="slot-empty"><Plus weight="bold" /><b>DROP UNIT</b><small>OR CLICK</small></span>
                )}
              </button>
              {formation && phase === "plan" && <button className="clear-slot-button" onClick={() => onClearRole(role.id)} aria-label={`Clear ${formation.name} from ${role.label}`}>CLEAR</button>}
              </div>
              {nextRole && <span className={`route-leg ${formation && nextFormation ? "occupied" : ""} ${inspectingInteractions && formation && nextFormation && (formation.id === inspected || nextFormation.id === inspected) && interactionByFormationId.has(formation.id === inspected ? nextFormation.id : formation.id) ? "interaction-active" : ""}`} aria-hidden="true"><Radio weight="fill" /></span>}
            </Fragment>
          );
        })}
      </div>
      <TacticalHandoffBoard feedback={feedback} formations={formations} handoffs={handoffs} profile={profile} staffExerciseIndex={staffExerciseIndex} onStaffExercise={onStaffExercise} />
    </div>
  );
}

function BattleStateLegend() {
  return (
    <aside className="battle-state-legend" aria-label="Battlefield status legend">
      <span>BATTLEFIELD READ</span>
      <div><i className="active-contact" /><b>ACTIVE CONTACT</b><small>Blue pulse · fighting now</small></div>
      <div><i className="outside-contact" /><b>OUTSIDE CONTACT</b><small>Dimmed · not in this fight</small></div>
      <div><i className="under-pressure" /><b>UNDER PRESSURE</b><small>Amber · delayed or pinned</small></div>
      <div><i className="serious-state" /><b>SERIOUS STATE</b><small>Red · damaged or cut off</small></div>
    </aside>
  );
}

function Battlefield({ formations, formationFates, inspected, onInspect, selected, onSelect, deployments, phase, battleTime, condition, drillStep, placementFeedback, planReady, playbook, drillSteps, assignments, branches, handoffs, operation, outputs, profile, onChooseRole, onAssignFormation, onClearRole, onFormationDragStart, onStaffExercise, readiness, refitProtocols, staffExerciseIndex, playbackBeat, playbackBeats, playbackIndex, playbackPlaying, onPlaybackToggle, onPlaybackStep, onPlaybackReplay }) {
  const alphaState = battleTime >= profile.alphaAt ? "secured" : "active";
  const betaState = battleTime >= profile.betaAt ? "secured" : "threat";
  const reactorState = battleTime >= profile.reactorAt ? "secured" : "threat";
  const extractionState = phase === "complete" ? "secured" : "future";
  const playbackActive = phase === "battle" || phase === "complete";
  const focusedPlayerIds = playbackBeat?.playerFormationIds ?? [];
  const hasPlayerFocus = focusedPlayerIds.length > 0;
  const consequences = battlefieldConsequencesAt({ clashes: profile.enemyClashes, battleTime });
  const resolvedFormationFates = new Map((playbackActive ? formationFates : [])
    .filter((formationFate) => formationFate.at <= battleTime)
    .map((formationFate) => [formationFate.formationId, formationFate]));
  const operationField = operationFieldFor(operation);
  const authoredRoutes = buildAuthoredFormationRoutes({
    plan: operationField.plans[playbook.id],
    landmarks: operationField.landmarks,
    roles: playbook.roles,
    assignments,
    formationStarts: Object.fromEntries(formations.map((formation) => {
      const staging = STAGING_NODES[formation.id];
      return [formation.id, { x: staging.left, y: staging.top - 3 }];
    })),
    branches,
  });
  const roleActionTimes = [profile.alphaAt, profile.betaAt, profile.reactorExposeAt, profile.reactorAt, profile.extractionAt];
  const inspectedFormation = formations.find((formation) => formation.id === inspected) ?? null;
  const inspectedInteractions = formationInteractionsFor({ formations, formationId: inspected });
  const interactionByFormationId = new Map(inspectedInteractions.map((interaction) => [interaction.partnerId, interaction]));
  const adjacentFormationIds = new Set(adjacentFormationIdsFor({ roles: playbook.roles, assignments, formationId: inspected }));
  const inspectingInteractions = (phase === "plan" || phase === "drill") && Boolean(inspectedFormation);

  return (
    <section className={`battlefield phase-${phase} operation-${operation.id} doctrine-${playbackBeat?.doctrinePhase ?? "none"} ${playbackActive ? "playback-active" : ""} ${inspectingInteractions ? "interaction-inspecting" : ""}`} aria-label={`${operation.name} mission map`}>
      <img className="battlefield-art" src="/assets/dead-circuit-foundry.png" alt={operation.battlefieldAlt} />
      <div className="battlefield-wash" />
      <div className="battlefield-operation-veil" aria-hidden="true" />
      <EnemyFieldPlan battleTime={battleTime} operation={operation} phase={phase} clashes={profile.enemyClashes} profile={profile} planReady={planReady} playbook={playbook} playbackBeat={playbackBeat} />
      <TacticalFieldPlan assignments={assignments} battleTime={battleTime} branches={branches} consequences={consequences.player} formationFates={formationFates} formations={formations} operation={operation} phase={phase} playbook={playbook} playbackBeat={playbackBeat} />
      <DoctrineCollisionOverlay beat={playbackBeat} operation={operation} playbook={playbook} />
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
      {formations.map((formation) => {
        const assignedNode = deployments[formation.id] ? NODES[deployments[formation.id]] : null;
        const node = assignedNode ?? STAGING_NODES[formation.id];
        const active = selected === formation.id;
        const consequence = consequences.player[formation.id] ?? null;
        const formationFate = resolvedFormationFates.get(formation.id) ?? null;
        const statusDisplay = formationStatusDisplay({ consequence, formationFate });
        const authoredRoute = authoredRoutes.find((route) => route.formationId === formation.id);
        const interaction = interactionByFormationId.get(formation.id) ?? null;
        const interactionDirection = interactionDirectionFor(interaction);
        const activeInteraction = Boolean(interaction && adjacentFormationIds.has(formation.id));
        const interactionClass = !inspectingInteractions
          ? ""
          : formation.id === inspected
            ? "interaction-selected"
            : activeInteraction
              ? `interaction-active interaction-${interactionDirection}`
              : interaction
                ? `interaction-potential interaction-${interactionDirection}`
                : "interaction-muted";
        const routePosition = playbackActive && authoredRoute
          ? positionAlongAuthoredRoute({
              points: authoredRoute.points,
              battleTime: formationFate && (formationFate.fate === "missing" || formationFate.fate === "destroyed")
                ? Math.min(battleTime, formationFate.at)
                : battleTime,
              actionAt: roleActionTimes[authoredRoute.roleIndex] ?? profile.extractionAt,
              completeAt: profile.completeAt,
            })
          : { x: node.left, y: node.top };
        return (
          <button
            key={formation.id}
            className={`map-formation ${active ? "selected" : ""} ${interactionClass} ${phase === "battle" && !["missing", "destroyed"].includes(formationFate?.fate) ? "in-motion" : ""} ${consequence ? `state-${consequence.state}` : ""} ${formationFate ? `fate-${formationFate.fate}` : ""} ${!assignedNode && (phase === "plan" || phase === "drill") ? "staged" : ""} ${hasPlayerFocus ? focusedPlayerIds.includes(formation.id) ? "playback-focused" : "playback-muted" : ""}`}
            style={{ left: `${routePosition.x}%`, top: `${routePosition.y}%` }}
            onClick={() => onSelect(formation.id)}
            onMouseEnter={() => onInspect(formation.id)}
            onMouseLeave={() => onInspect(null)}
            onFocus={() => onInspect(formation.id)}
            onBlur={() => onInspect(null)}
            draggable={phase === "plan"}
            onDragStart={(event) => onFormationDragStart(event, formation.id)}
            aria-label={`${formation.name}, ${assignedNode ? formation.role : "unassigned"}, at ${node.label}${formationFate ? `, ${formationFate.battleLabel}` : consequence ? `, ${consequence.label} after ${consequence.cause}` : ""}`}
          >
            <FormationPortrait formation={formation} />
            <span className="map-formation-number">{formation.number}</span>
            <span className="map-formation-label">{formation.name}</span>
            {interaction && <span className={`map-formation-interaction ${activeInteraction ? "active" : "potential"} ${interactionDirection}`}><Radio weight="fill" /> {activeInteraction ? "ACTIVE ADJACENT HANDOFF" : "POTENTIAL IF ADJACENT"}<small>{interactionDirection === "outgoing" ? `${inspectedFormation.name} FEEDS ${formation.name}` : interactionDirection === "incoming" ? `${formation.name} FEEDS ${inspectedFormation.name}` : "TWO-WAY LINK"} · {[interaction.outgoing?.condition, interaction.incoming?.condition].filter(Boolean).join(" / ")}</small></span>}
            {statusDisplay && <span className="map-formation-state"><b>{statusDisplay.label}</b><small>{statusDisplay.detail}</small></span>}
          </button>
        );
      })}

      {playbackActive && consequences.active.length > 0 && (
        <div className={`battle-consequence-ledger ${hasPlayerFocus ? "observing" : "overview"}`} aria-live="polite">
          <span>FIELD CONSEQUENCES · PERSISTENT</span>
          {consequences.active.map((consequence) => {
            const formation = formations.find((item) => item.id === consequence.formationId);
            return (
              <div className={`state-${consequence.state}`} key={consequence.formationId}>
                <b>{formation?.name ?? consequence.formationId}</b>
                <em>{consequence.label}</em>
                <small>{consequence.cause}</small>
              </div>
            );
          })}
        </div>
      )}

      {playbackActive && <BattleStateLegend />}
      <PlaybookBoard active={planReady} assignments={assignments} battleTime={battleTime} condition={condition} drillStep={drillStep} feedback={placementFeedback} formations={formations} handoffs={handoffs} inspected={inspected} onChooseRole={onChooseRole} onAssignFormation={onAssignFormation} onClearRole={onClearRole} onFormationDragStart={onFormationDragStart} onInspectFormation={onInspect} onSelectFormation={onSelect} onStaffExercise={onStaffExercise} outputs={outputs} phase={phase} playbook={playbook} profile={profile} readiness={readiness} refitProtocols={refitProtocols} staffExerciseIndex={staffExerciseIndex} />
      {phase === "drill" && (
        <div className="drill-status" role="status">
          <Play weight="fill" />
          <div><span>GHOST DRILL {Math.min(drillStep + 1, drillSteps.length)} / {drillSteps.length}</span><b>{drillSteps[Math.min(drillStep, drillSteps.length - 1)]}</b></div>
        </div>
      )}
      {playbackActive && (
        <BattlePlaybackDirector
          beat={playbackBeat}
          beats={playbackBeats}
          index={playbackIndex}
          playing={playbackPlaying}
          onToggle={onPlaybackToggle}
          onStep={onPlaybackStep}
          onReplay={onPlaybackReplay}
          phase={phase}
        />
      )}
    </section>
  );
}

function BattlePlaybackDirector({ beat, beats, index, playing, onToggle, onStep, onReplay, phase }) {
  if (!beat) return null;
  const atStart = index === 0;
  const atEnd = index === beats.length - 1;
  return (
    <div className={`battle-playback-director ${beat.kind} route-${beat.routeState ?? "none"}`}>
      <div className="playback-narration" role="status" aria-live="polite" key={beat.id}>
        <div className="playback-heading">
          <span>{beat.eyebrow}</span>
          <em>BEAT {String(index + 1).padStart(2, "0")} / {String(beats.length).padStart(2, "0")}</em>
        </div>
        <b>{beat.title}</b>
        <p>{beat.detail}</p>
        {beat.resolution && (
          <div className={`playback-resolution outcome-${beat.resolution.outcome}`}>
            {Number.isFinite(beat.resolution.playerScore) ? (
              <>
                <span><small>WARHOST</small><b>{beat.resolution.playerScore}</b></span>
                <em>VS</em>
                <span><small>ENEMY ORDER</small><b>{beat.resolution.enemyScore}</b></span>
                <strong>{beat.resolution.label}</strong>
              </>
            ) : <strong>{beat.resolution.label} · UPSTREAM ORDER BROKEN</strong>}
            <p>{beat.resolution.factors.filter((factor) => factor.score > 0).map((factor) => `${factor.label} +${factor.score}`).join(" · ") || beat.resolution.verdict}</p>
            {beat.resolution.missingCapabilities.length > 0 && <small>MISSING ANSWER · {beat.resolution.missingCapabilities.join(" / ")}</small>}
          </div>
        )}
        {beat.statusChanges?.length > 0 && (
          <div className="playback-status-changes" aria-label="Formation status changes">
            <span>FORMATION IMPACT</span>
            {beat.statusChanges.map((statusChange) => (
              <b className={`state-${statusChange.state}`} key={`${statusChange.formationId}-${statusChange.label}`}>
                {statusChange.formationName}<em>{statusChange.label}</em>
              </b>
            ))}
          </div>
        )}
      </div>
      <div className="playback-transport" aria-label="Battle playback controls">
        <button className="playback-previous" onClick={() => onStep(-1)} disabled={atStart} aria-label="Previous battle beat"><ArrowRight weight="bold" /></button>
        <button className="playback-toggle" onClick={onToggle} disabled={phase === "complete" && atEnd} aria-label={playing ? "Pause battle playback" : "Play battle playback"}>
          {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
          <span>{playing ? "PAUSE" : "PLAY"}</span>
        </button>
        <button onClick={() => onStep(1)} disabled={atEnd} aria-label="Next battle beat"><ArrowRight weight="bold" /></button>
        <button className="playback-replay" onClick={onReplay} aria-label="Replay battle from the beginning"><ArrowCounterClockwise weight="bold" /><span>REPLAY</span></button>
      </div>
      <div className="playback-timeline" aria-label="Battle beat timeline">
        {beats.map((item, beatIndex) => (
          <button
            key={item.id}
            className={`${beatIndex === index ? "current" : ""} ${beatIndex < index ? "resolved" : ""} ${item.kind}`}
            onClick={() => onStep(beatIndex - index)}
            aria-label={`Go to beat ${beatIndex + 1}: ${item.title}`}
            aria-current={beatIndex === index ? "step" : undefined}
            title={item.title}
          />
        ))}
      </div>
    </div>
  );
}

function EnemyPlanIntel({ battleTime, operation, phase, planReady, blindTestActive, clashes, profile }) {
  const enemyPlan = enemyPlanFor(operation);
  const reinforcementWave = reinforcementWaveFor(operation);
  const collision = profile.enemyCollision;
  const collisionSource = FORMATIONS.find((formation) => formation.id === collision?.sourceId);
  const collisionReceiver = FORMATIONS.find((formation) => formation.id === collision?.receiverId);
  const planningSealed = phase === "plan" || phase === "drill";
  return (
    <div className="intel-block enemy-plan-intel">
      <span className="panel-label">ENEMY PLAYBOOK · EXECUTES IN PARALLEL</span>
      <div className="enemy-doctrine-title"><Target weight="duotone" /><span><b>{enemyPlan.name}</b><small>{enemyPlan.intent}</small></span></div>
      {operation.id === "ashen-passage" && (
        <div className={`enemy-collision-readout ${collision?.outcome ?? "unread"}`} aria-live="polite">
          <span><Crosshair weight="duotone" /> PLAN COLLISION · STOP 01/02</span>
          <b>{planningSealed ? "COLLISION WINDOW SEALED" : collision?.title ?? "COLLISION WINDOW UNRESOLVED"}</b>
          <small>{planningSealed ? "The opposing plans collide here; the outcome resolves during execution." : collision?.summary ?? "Staff Stop 01 and Stop 02 to reveal how the two plans collide."}</small>
          {!planningSealed && collision?.revealed && <em>{collisionSource?.name} → {collisionReceiver?.name}{collision.actorName ? ` · ${collision.actorName}` : " · NO AUTOMATIC REACTION"}</em>}
        </div>
      )}
      <div className="enemy-chain">
        {clashes.map((clash, index) => {
          const resolved = (phase === "battle" || phase === "complete") && battleTime >= clash.actionAt;
          const revealed = resolved;
          const state = !revealed ? "unread" : clash.routeState === "passed" ? "threat" : clash.routeState;
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
                  {!revealed
                    ? "OUTCOME UNREAD"
                    : clash.resultText}
                </span>
                {revealed && clash.resolution && (
                  <span className={`enemy-resolution-summary outcome-${clash.resolution.outcome}`}>
                    <b>{Number.isFinite(clash.resolution.playerScore) ? `WARHOST ${clash.resolution.playerScore} vs ORDER ${clash.resolution.enemyScore}` : "UPSTREAM CHAIN"}</b>
                    <em>{clash.resolution.label}</em>
                    <small>{clash.resolution.factors.filter((factor) => factor.score > 0).slice(0, 3).map((factor) => factor.label).join(" · ") || clash.resolution.verdict}</small>
                  </span>
                )}
              </div>
              {index < clashes.length - 1 && <ArrowRight className="enemy-chain-arrow" weight="bold" />}
            </Fragment>
          );
        })}
      </div>
      <div className={`reinforcement-order ${!planningSealed && planReady && profile.overrun === 0 ? "avoided" : "threat"}`}>
        <span className="enemy-step-number">{reinforcementWave.number}</span>
        <span className="enemy-step-copy">
          <em>ARRIVES T+{fmtDuration(reinforcementWave.arrivalAt)}</em>
          <b>{reinforcementWave.name}</b>
          <small>{reinforcementWave.approach}</small>
        </span>
        <span className="enemy-step-result">
          {planningSealed ? "FORECAST SEALED" : !planReady ? "CONTINGENCY UNREAD" : profile.overrun > 0 ? `${reinforcementForecast(profile)} · ${profile.reinforcementLoss} RECOVERY LOST` : `${reinforcementForecast(profile)} · CONTACT AVOIDED`}
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

function IntelRail({ phase, battleTime, condition, onCondition, operation, planReady, blindTestActive, rescueComplete, playbook, assignedCount, formationCount, integrity, profile }) {
  const planningSealed = phase === "plan" || phase === "drill";
  const forecast = profile.overrun > 0
    ? `${profile.extractedCount} / ${formationCount} EXTRACT · WAVE ${fmtDuration(profile.overrun)} EARLY`
    : `${profile.extractedCount} / ${formationCount} EXTRACT · ${fmtDuration(profile.timeSaved)} CLEAR`;
  return (
    <section className="right-rail" aria-label="Mission outlook and enemy intelligence">
      <MissionConditionSelector condition={condition} locked={operation.conditionLocked} phase={phase} onCondition={onCondition} />
      <div className="intel-block">
        <span className="panel-label">MISSION OUTLOOK</span>
        <strong className={planningSealed ? "sealed" : planReady ? profile.overrun > 0 ? "at-risk" : "viable" : "at-risk"}>{planningSealed && planReady ? "OUTCOME SEALED · COMMIT TO REVEAL" : planReady ? forecast : `${assignedCount} / ${formationCount} AVAILABLE ASSIGNED`}</strong>
        <div className="campaign-integrity-readout">
          <span>WARHOST INTEGRITY</span>
          <IntegrityMeter value={integrity} />
          <small>DEFEAT WITH 2+ EXTRACTED −1 · ONE EXTRACTED −2 · ZERO EXTRACTED −3 · ZERO ENDS THE RUN</small>
        </div>
        {formationCount < FORMATIONS.length && <p className="campaign-shortfall"><Warning weight="fill" /> {FORMATIONS.length - formationCount} FORMATION MISSING · LEAVE AN AUTHORED STOP EMPTY</p>}
        <p><b>{playbook.name}:</b> {playbook.intent}</p>
        <div className={`doctrine-outlook ${planningSealed ? "sealed" : profile.doctrine.triggered ? "triggered" : "exposed"}`}>
          <span>TACTICAL DOCTRINE · {profile.doctrine.name}</span>
          <b>{planningSealed ? "RESULT UNRESOLVED" : profile.doctrine.result}</b>
          <small>{planningSealed ? "The playbook will be tested against the enemy plan during execution." : profile.doctrine.triggered ? "The selected playbook's advantage is active." : "The selected playbook's exposure remains active."}</small>
        </div>
        {profile.readiness.staffedCount > 0 && (
          <div className={`readiness-impact ${planningSealed ? "sealed" : profile.readiness.delay > 0 ? "penalty" : "aligned"}`}>
            <span>FORMATION READINESS</span>
            <b>{planningSealed ? "TASK FIT UNRESOLVED" : `${profile.readiness.average}% · ${profile.readiness.delay > 0 ? `+${fmtDuration(profile.readiness.delay)} EXECUTION DELAY` : "NO TASK-FIT DELAY"}`}</b>
            <small>{planningSealed ? "INSPECT EACH FORMATION'S CAPABILITIES AGAINST ITS ASSIGNED RESPONSIBILITY." : `${profile.readiness.alignedCount} / ${profile.readiness.staffedCount} STAFFED FORMATIONS TASK-ALIGNED · COMBO EFFECTS RESOLVE SEPARATELY`}</small>
          </div>
        )}
        {planReady && !planningSealed && (
          <div className={`extraction-breakdown ${profile.extractedCount >= operation.requiredExtraction ? "viable" : profile.extractedCount > 0 ? "costly" : "broken"}`}>
            <span>EXTRACTION BREAKDOWN</span>
            <b>{profile.reserveCapacity} CAPACITY − {profile.reinforcementLoss} WAVE − {profile.enemyRecoveryLoss} ROUTE = {profile.extractedCount} CLEAR</b>
            <small>THE ENEMY WAVE REMOVES ONE RECOVERY SLOT PER COMPLETE 30 SECONDS OF CONTACT.</small>
          </div>
        )}
        {!planningSealed && profile.protocols.length > 0 && (
          <div className="refit-protocol-impact">
            <span>ASHEN FIELD PROTOCOL{profile.protocols.length > 1 ? "S" : ""} ONLINE</span>
            {profile.protocols.map((protocol) => <b key={protocol.formationId}>{protocol.name} · {protocol.formationName}</b>)}
            {profile.protocols.map((protocol) => <em key={`${protocol.formationId}-impact`}>{protocolImpactText(protocol.impact)}</em>)}
            <small>THE INSTALLED PACKAGE FOUND A BATTLEFIELD INTERFACE AND ALTERED THE MISSION FORECAST.</small>
          </div>
        )}
        {!planReady && phase === "plan" && <p className="assignment-pointer"><ArrowRight weight="bold" /> Place formations on the authored tactical route.</p>}
      </div>
      <EnemyPlanIntel battleTime={battleTime} operation={operation} phase={phase} planReady={planReady} blindTestActive={blindTestActive} clashes={profile.enemyClashes} profile={profile} />
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

function IntegrityMeter({ value, max = 3 }) {
  const safeValue = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
  return (
    <div className="integrity-meter" aria-label={`${safeValue} of ${max} Warhost Integrity remaining`}>
      <strong>{safeValue} / {max}</strong>
      <span>{Array.from({ length: max }, (_, index) => <Shield key={index} weight={index < safeValue ? "fill" : "thin"} />)}</span>
    </div>
  );
}

function FooterControls({ phase, seals, drillComplete, onDrill, onCommit, onReset, operation, planReady, blindTestActive, blindPrediction, branches, onBranch }) {
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
            <button className={`ghost-button ${drillComplete ? "complete" : ""}`} onClick={onDrill} disabled={blindTestActive || phase === "drill" || !planReady}>
              {phase === "drill" ? <Pause weight="fill" /> : drillComplete ? <CheckCircle weight="fill" /> : <Play weight="fill" />}
              <span><b>{blindTestActive ? "DRILL LOCKED" : phase === "drill" ? "RUNNING GHOST DRILL" : drillComplete ? "DRILL VERIFIED" : "RUN GHOST DRILL"}</b><small>{blindTestActive ? "Blind test keeps the outcome hidden." : "Preview routes, triggers, and timing."}</small></span>
            </button>
            <button className="commit-button" onClick={onCommit} disabled={!planReady || (blindTestActive && !blindPrediction)}>
              <span><b>COMMIT PLAYBOOK</b><small>{!planReady ? "Staff every available formation first." : blindTestActive && !blindPrediction ? "Predict the result before commitment." : "Execute staffed roles and authored branches."}</small></span>
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
  const neighboringFormationIds = [
    playbook.roles[roleIndex - 1] ? assignments[playbook.roles[roleIndex - 1].id] : null,
    playbook.roles[roleIndex + 1] ? assignments[playbook.roles[roleIndex + 1].id] : null,
  ].filter(Boolean);
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
        <p>{role.brief} This condition demands <b>{roleDemands.join(" / ")}</b>. Choose from the rules below; readiness and handoff results stay sealed until execution.</p>
        <div className="formation-picker-list">
          {orderedFormations.map((formation) => {
            const currentRole = playbook.roles.find((item) => assignments[item.id] === formation.id);
            const currentRoleIndex = currentRole ? playbook.roles.findIndex((item) => item.id === currentRole.id) : -1;
            const current = assignedFormationId === formation.id;
            const matchedCapabilities = capabilityMatchesFor({ formation, demands: roleDemands });
            const neighborHints = neighboringInteractionHints({
              formations,
              formationId: formation.id,
              neighborIds: neighboringFormationIds.filter((formationId) => formationId !== formation.id),
            });
            return (
              <button key={formation.id} className={`${current ? "current" : ""} ${matchedCapabilities.length > 0 ? "role-capable" : ""}`} onClick={() => onChoose(formation.id)}>
                <FormationPortrait formation={formation} compact />
                <span className="picker-formation-copy">
                  <b>{formation.name}</b>
                  <span className="formation-refit-line">REFIT {formation.activeRefit.name}</span>
                  <span className="formation-capability-line">CAPABILITIES {formation.capabilities.join(" / ")}</span>
                  <span className={`responsibility-match ${matchedCapabilities.length > 0 ? "matched" : "unmatched"}`}>{matchedCapabilities.length > 0 ? `CAN PERFORM · ${matchedCapabilities.join(" / ")}` : "NO DIRECT RESPONSIBILITY MATCH"}</span>
                  <small>{formation.role} · {formation.purpose}</small>
                  <span className="tactic-vocabulary"><em>CREATES {formation.creates}</em><em>USES {formation.uses.join(" · ")}</em></span>
                  {neighborHints.length > 0 && <span className="neighbor-interaction-hints">{neighborHints.map((hint, index) => <em key={`${hint.direction}-${hint.condition}-${index}`}><Radio weight="fill" /> {hint.text}</em>)}</span>}
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

function SalvageWorkshop({ baseline, choice, formations, integrity, nextOperation, onChoose, onLaunch }) {
  const incomingCondition = MISSION_CONDITIONS.find((condition) => condition.id === nextOperation.conditionId);
  const selectedAction = choice
    ? choice.type === "repair"
      ? `Repair ${FORMATIONS.find((formation) => formation.id === choice.formationId)?.name}.`
      : choice.type === "recover"
        ? `Recover ${FORMATIONS.find((formation) => formation.id === choice.formationId)?.name}.`
        : `Refit ${FORMATIONS.find((formation) => formation.id === choice.formationId)?.name}.`
    : "No salvage action selected. Launching unchanged is allowed.";
  const isSelected = (action) => choice?.type === action.type
    && choice?.formationId === action.formationId
    && (action.type !== "refit" || choice?.refitId === action.refitId);
  return (
    <div className="decision-backdrop workshop-backdrop" role="dialog" aria-modal="true" aria-labelledby="workshop-title">
      <div className="decision-panel workshop-panel">
        <div className="workshop-heading">
          <div>
            <p className="eyebrow">INTERMISSION · SCRAPBORN SALVAGE BAY</p>
            <h2 id="workshop-title">Carry the detachment forward.</h2>
            <p>Serious battlefield consequences persist. Spend one salvage action to repair damage, recover a missing formation, or install one refit. The other consequences carry forward.</p>
          </div>
          <div className={`salvage-token ${choice ? "spent" : "available"}`}>
            <Wrench weight="duotone" />
            <span><b>{choice ? "0 / 1" : "1 / 1"}</b><small>SALVAGE ACTION REMAINING</small></span>
          </div>
        </div>
        <div className="incoming-operation">
          <span>INCOMING OPERATION</span>
          <b>{nextOperation.name}</b>
          <small>{nextOperation.victory}</small>
          <em>{incomingCondition.name} · {incomingCondition.effect}</em>
        </div>
        <div className="workshop-integrity">
          <span><b>WARHOST INTEGRITY CARRIED FORWARD</b><small>Another defeat or rout may end the run before the final operation.</small></span>
          <IntegrityMeter value={integrity} />
        </div>
        <div className="workshop-formations">
          {formations.map((formation) => {
            const baseFormation = FORMATIONS.find((item) => item.id === formation.id);
            const carriedRefit = baseFormation.refits.find((refit) => refit.id === baseline.refits[formation.id]);
            const campaignCondition = formation.campaignCondition;
            return (
              <div className={`workshop-formation ${choice?.formationId === formation.id ? "changed" : ""} ${campaignCondition?.state ?? "ready"}`} key={formation.id}>
                <FormationPortrait formation={formation} compact />
                <div className="workshop-formation-copy">
                  <b>{formation.name}</b>
                  <small>CARRIES {carriedRefit.name}</small>
                  {campaignCondition && <em className={`workshop-condition ${campaignCondition.state}`}>{campaignCondition.label}{formation.disabledCapability ? ` · ${formation.disabledCapability} OFFLINE` : " · UNAVAILABLE"}</em>}
                </div>
                <div className="workshop-actions">
                  {campaignCondition?.state === "damaged" && (
                    <button
                      className={`workshop-recovery-action ${isSelected({ type: "repair", formationId: formation.id }) ? "selected" : ""}`}
                      onClick={() => onChoose({ type: "repair", formationId: formation.id })}
                      aria-pressed={isSelected({ type: "repair", formationId: formation.id })}
                    >
                      <b>REPAIR DAMAGE</b><small>Restore {formation.disabledCapability} for the next operation.</small>
                    </button>
                  )}
                  {campaignCondition?.state === "missing" ? (
                    <button
                      className={`workshop-recovery-action ${isSelected({ type: "recover", formationId: formation.id }) ? "selected" : ""}`}
                      onClick={() => onChoose({ type: "recover", formationId: formation.id })}
                      aria-pressed={isSelected({ type: "recover", formationId: formation.id })}
                    >
                      <b>RECOVER FORMATION</b><small>Return this formation to the next authored plan.</small>
                    </button>
                  ) : baseFormation.refits.map((refit) => {
                    const action = { type: "refit", formationId: formation.id, refitId: refit.id };
                    const carried = refit.id === baseline.refits[formation.id];
                    return (
                      <button
                        key={refit.id}
                        className={`${carried ? "carried" : ""} ${isSelected(action) ? "selected" : ""}`}
                        onClick={() => onChoose(action)}
                        disabled={carried}
                        aria-pressed={isSelected(action)}
                      >
                        <b>{refit.name}</b>
                        <small>{carried ? "INSTALLED" : `${refit.capabilities.join(" / ")} · CREATES ${refit.creates}`}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="workshop-footer">
          <span>{selectedAction} Any missing formation leaves one playbook stop empty.</span>
          <button className="commit-button" onClick={onLaunch}><span><b>LAUNCH ASHEN PASSAGE</b><small>Lock the campaign state and return to tactical planning.</small></span><ArrowRight weight="bold" /></button>
        </div>
      </div>
    </div>
  );
}

function CompletionOverlay({ formations, formationFates, canContinue, campaignDestroyed, integrityBefore, integrityLoss, integrityAfter, operation, rescued, usedSeals, playbook, profile, strategyTrial, blindTestActive, blindPrediction, won, onAction }) {
  const lostCount = formations.length - profile.extractedCount;
  const disruptedEnemyOrders = profile.enemyClashes.filter((clash) => clash.disrupted).length;
  const finalConsequences = battlefieldConsequencesAt({ clashes: profile.enemyClashes, battleTime: profile.completeAt });
  const reinforcementWave = reinforcementWaveFor(operation);
  const timingResult = profile.overrun > 0
    ? `The ${reinforcementWave.name} reached ${operation.extractionTitle} ${profile.overrun} seconds before extraction cleared.`
    : profile.timeSaved > 0
    ? `The Warhost cleared extraction ${profile.timeSaved} seconds before the enemy wave arrived.`
    : "The Warhost cleared the gantry as the enemy wave arrived.";
  const readinessResult = profile.readiness.rawDelay > 0
    ? `${profile.readiness.improvisedCount} improvised ${profile.readiness.improvisedCount === 1 ? "assignment created" : "assignments created"} ${profile.readiness.rawDelay} seconds of execution delay.${profile.readiness.protocolDelayReduction > 0 ? ` The active refit absorbed ${profile.readiness.protocolDelayReduction} seconds, leaving ${profile.readiness.delay}.` : ""}`
    : `All ${profile.readiness.staffedCount} formations were task-aligned with no readiness delay.`;
  const protocolResult = profile.protocols.length > 0
    ? `Active Ashen field protocols: ${profile.protocols.map((protocol) => protocol.name).join(", ")}.`
    : "No installed refit found an Ashen field interface.";
  const engagementResult = `Engagements: ${profile.enemyClashes.map((clash) => `${clash.label} ${clash.resolution?.label ?? "UNRESOLVED"}${Number.isFinite(clash.resolution?.playerScore) ? ` ${clash.resolution.playerScore}-${clash.resolution.enemyScore}` : ""}`).join(", ")}.`;
  const fieldStateResult = finalConsequences.active.length > 0
    ? `Final field states: ${finalConsequences.active.map((consequence) => `${formations.find((formation) => formation.id === consequence.formationId)?.name ?? consequence.formationId} ${consequence.label}`).join(", ")}.`
    : "No formation carried a battlefield consequence into extraction.";
  const outcomeLabel = won ? "OPERATION SUCCESS" : campaignDestroyed ? "CAMPAIGN DEFEAT" : canContinue ? "COSTLY CONTINUATION" : "OPERATION FAILED";
  const outcomeBanner = won ? "VICTORY" : campaignDestroyed ? "WARHOST BROKEN" : canContinue ? "WITHDRAWAL" : "DEFEAT";
  const outcomeTitle = won
    ? `${operation.shortName} is secured.`
    : campaignDestroyed
      ? "Warhost Integrity is exhausted."
      : canContinue
        ? `${operation.shortName} was lost—but the campaign continues.`
        : `${operation.shortName} was lost.`;
  const trialResult = strategyTrialResult(strategyTrial, profile.extractedCount);
  const blindResult = blindPredictionResult({ predictionId: blindPrediction, extractedCount: profile.extractedCount, requiredExtraction: operation.requiredExtraction });
  const strategyCausality = strategyCausalityFor({ profile, requiredExtraction: operation.requiredExtraction });
  const actionLabel = blindTestActive ? "REPEAT BLIND TEST" : strategyTrial ? "RETURN TO STRATEGY TEST" : canContinue ? "ENTER SALVAGE WORKSHOP" : campaignDestroyed ? "BEGIN NEW CAMPAIGN" : "RETURN TO BATTLEFIELD";
  const actionDetail = blindTestActive
    ? "Reset Dead Circuit and author another plan without a forecast."
    : strategyTrial
    ? "Reset Dead Circuit and load the next controlled plan."
    : canContinue
    ? won ? "Carry this detachment into the next operation." : "Withdraw, accept persistent losses, and continue the campaign."
    : campaignDestroyed ? "Warhost Integrity reached zero. This run is over." : "Inspect the completed operation state.";
  const operationResult = won
    ? `${operation.primaryResult} and ${profile.extractedCount} formations escaped.`
    : canContinue
      ? `${operation.primaryResult}, but only ${profile.extractedCount} formations cleared the timed extraction. Scattered survivors regrouped for a costly withdrawal.`
      : `${operation.primaryResult}, but only ${profile.extractedCount} formations escaped before the Warhost lost the ability to continue.`;
  return (
    <div className="decision-backdrop completion-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-title">
      <div className={`decision-panel completion-panel ${won ? "victory" : campaignDestroyed ? "defeat" : canContinue ? "costly" : "defeat"}`}>
        {won ? <CheckCircle className="completion-icon" weight="duotone" /> : <Warning className="completion-icon" weight="duotone" />}
        <p className="eyebrow">{outcomeLabel}</p>
        <div className="victory-banner">{outcomeBanner}</div>
        <h2 id="complete-title">{outcomeTitle}</h2>
        <p>{operationResult} Victory required the primary objective plus at least {operation.requiredExtraction} extracted formations.</p>
        <div className="after-action-grid">
          <div><span>PRIMARY · COMPLETE</span><b>{operation.primaryResult}</b><CheckCircle weight="fill" /></div>
          <div><span>EXTRACTION · {won ? "PASSED" : "FAILED"}</span><b>{profile.extractedCount} extracted · {operation.requiredExtraction} required</b>{won ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}</div>
          <div><span>OPTIONAL</span><b>{rescued ? "Crew rescued" : "Crew left behind"}</b>{rescued ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}</div>
          <div><span>PLAN VS PLAN</span><b>{profile.doctrine.name} · {profile.effects.length} combos · {disruptedEnemyOrders} / {profile.enemyClashes.length} orders broken</b><Seal weight="duotone" /></div>
          <div className={`integrity-after-action ${integrityAfter <= 0 ? "collapsed" : "holding"}`}><span>WARHOST INTEGRITY · −{integrityLoss}</span><b>{integrityBefore} → {integrityAfter} REMAINING</b><Shield weight={integrityAfter > 0 ? "fill" : "thin"} /></div>
        </div>
        <section className="strategy-causality" aria-label="Why this result happened">
          <header>
            <span>WHY THIS RESULT HAPPENED</span>
            <small>REVEALED AFTER COMMITMENT</small>
          </header>
          <div className="strategy-causality-chain">
            {strategyCausality.map((item, index) => (
              <div className={`strategy-cause ${item.tone}`} key={item.id}>
                <span className="strategy-cause-step">{item.step}</span>
                <span className="strategy-cause-label">{item.label}</span>
                <b>{item.value}</b>
                <p>{item.detail}</p>
                {index < strategyCausality.length - 1 && <ArrowRight className="strategy-cause-arrow" weight="bold" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </section>
        {strategyTrial && trialResult && (
          <section className="strategy-trial-result template-result">
            <span>{strategyTrial.name} STARTING PLAN · RESULT REVEALED</span>
            <b>{trialResult.extracted} FORMATIONS EXTRACTED</b>
            <p>{strategyTrial.priority} Tradeoff: {strategyTrial.sacrifice} Templates are editable aids, not predicted outcomes.</p>
          </section>
        )}
        {blindTestActive && blindResult && (
          <section className={`blind-test-result ${blindResult.accurate ? "accurate" : "surprised"}`}>
            <span>BLIND COMMAND RESULT · {blindResult.accurate ? "PREDICTION ACCURATE" : "PREDICTION MISSED"}</span>
            <div><b>PREDICTED {blindResult.prediction.label}</b><ArrowRight weight="bold" /><b>ACTUAL {blindResult.actual.label}</b></div>
            <ul>
              <li><strong>{profile.readiness.alignedCount}/{profile.readiness.staffedCount}</strong> formations matched their responsibility.</li>
              <li><strong>{profile.effects.length}</strong> handoff combinations formed; <strong>{disruptedEnemyOrders}/{profile.enemyClashes.length}</strong> enemy orders were broken.</li>
              <li>{profile.overrun > 0 ? <><strong>{fmtDuration(profile.overrun)}</strong> late to extraction; <strong>{profile.reinforcementLoss + profile.enemyRecoveryLoss}</strong> recovery capacity lost.</> : <><strong>{fmtDuration(profile.timeSaved)}</strong> ahead of the enemy wave.</>}</li>
            </ul>
          </section>
        )}
        <section className="formation-fate-ledger" aria-label="Formation fates">
          <header><span>FORMATION FATES · TACTICAL SLOT ORDER</span><small>{campaignDestroyed ? "The campaign is over; surviving formations cannot continue as a Warhost." : "Named outcomes at operation end."}</small></header>
          <div className="formation-fate-list">
            {formationFates.map(({ formation, fate, label, detail, history }, index) => (
              <div className={`formation-fate ${fate}`} key={formation.id}>
                <span className="formation-fate-slot">{String(index + 1).padStart(2, "0")}</span>
                <img src={formation.asset} alt="" />
                <span className="formation-fate-copy">
                  <b>{formation.name}</b>
                  <span className="formation-fate-history" aria-label={`${formation.name} status history`}>
                    {history.map((historyItem, historyIndex) => (
                      <Fragment key={`${historyItem.label}-${historyItem.at}-${historyIndex}`}>
                        {historyIndex > 0 && <i aria-hidden="true">→</i>}
                        <em className={`state-${historyItem.state}`} title={historyItem.cause}>{historyItem.label}</em>
                      </Fragment>
                    ))}
                  </span>
                  <small>{detail}</small>
                </span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        </section>
        <details className="completion-detail-log">
          <summary>FULL OPERATION LOG</summary>
          <p className="completion-note">Doctrine result: {profile.doctrine.result}. Mission condition: {profile.condition.name}. Installed refits: {formations.map((formation) => formation.activeRefit.name).join(", ")}. {engagementResult} {fieldStateResult} {protocolResult} {timingResult} {readinessResult} {lostCount === 0 ? "Every formation was recovered." : `${lostCount} ${lostCount === 1 ? "formation did" : "formations did"} not clear extraction.`} {usedSeals === 0 ? "Both authored breakpoints held under contact." : `${usedSeals} authored ${usedSeals === 1 ? "order was" : "orders were"} overridden after contact.`}</p>
        </details>
        <button className="commit-button debrief-button" onClick={onAction}><span><b>{actionLabel}</b><small>{actionDetail}</small></span><ArrowRight /></button>
      </div>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState("plan");
  const [operationIndex, setOperationIndex] = useState(0);
  const [selected, setSelected] = useState("harpoon");
  const [hoveredFormationId, setHoveredFormationId] = useState(null);
  const [playbookId, setPlaybookId] = useState("trapline");
  const [conditionId, setConditionId] = useState("clear");
  const [refits, setRefits] = useState(defaultRefits);
  const [campaignConditions, setCampaignConditions] = useState({});
  const [warhostIntegrity, setWarhostIntegrity] = useState(3);
  const [assignments, setAssignments] = useState(() => emptyAssignments(PLAYBOOKS[0]));
  const [branches, setBranches] = useState(defaultBranches);
  const [battleBranches, setBattleBranches] = useState(defaultBranches);
  const [drillStep, setDrillStep] = useState(-1);
  const [drillComplete, setDrillComplete] = useState(false);
  const [battleTime, setBattleTime] = useState(0);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
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
  const [strategyTrialId, setStrategyTrialId] = useState(null);
  const [blindTestActive, setBlindTestActive] = useState(false);
  const [blindPrediction, setBlindPrediction] = useState(null);
  const [staffExerciseIndex, setStaffExerciseIndex] = useState(null);
  const placementRevisionRef = useRef(0);

  const operation = OPERATIONS[operationIndex] ?? OPERATIONS[0];
  const strategyTrial = strategyTrialFor(strategyTrialId);
  const playbook = useMemo(
    () => playbookForOperation(PLAYBOOKS.find((item) => item.id === playbookId) ?? PLAYBOOKS[0], operation),
    [operation, playbookId],
  );
  const condition = useMemo(
    () => MISSION_CONDITIONS.find((item) => item.id === conditionId) ?? MISSION_CONDITIONS[0],
    [conditionId],
  );
  const allFormations = useMemo(
    () => applyCampaignConditions(resolveFormations(refits), campaignConditions),
    [campaignConditions, refits],
  );
  const formations = useMemo(
    () => allFormations.filter((formation) => formation.available),
    [allFormations],
  );
  const inspectedFormationId = hoveredFormationId ?? selected;
  const workshopFormations = useMemo(
    () => workshopBaseline
      ? applyCampaignConditions(resolveFormations(workshopBaseline.refits), workshopBaseline.conditions)
      : [],
    [workshopBaseline],
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
    () => formations.length >= operation.requiredExtraction
      && assignedCount === formations.length
      && new Set(Object.values(assignments).filter(Boolean)).size === formations.length
      && formations.every((formation) => Object.values(assignments).includes(formation.id)),
    [assignedCount, assignments, formations, operation.requiredExtraction],
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
  const refitProtocols = useMemo(
    () => calculateRefitProtocols(playbook, assignments, formations, operation),
    [assignments, formations, operation, playbook],
  );

  const activeBranches = phase === "plan" || phase === "drill" ? branches : battleBranches;

  const operationProfile = useMemo(
    () => calculateOperationProfile(tacticalHandoffs, activeBranches, placementReadiness, condition, operation, refitProtocols, playbook),
    [activeBranches, condition, operation, placementReadiness, playbook, refitProtocols, tacticalHandoffs],
  );

  const operationWon = operationProfile.extractedCount >= operation.requiredExtraction;
  const hasNextOperation = operationIndex < OPERATIONS.length - 1;
  const integrityLoss = integrityLossFor({ operationWon, extractedCount: operationProfile.extractedCount });
  const integrityAfterMission = Math.max(0, warhostIntegrity - integrityLoss);
  const campaignOutcome = campaignOutcomeFor({ hasNextOperation, operationWon, integrityRemaining: integrityAfterMission });
  const campaignDestroyed = campaignOutcome === "destroyed";
  const canContinueCampaign = campaignOutcome === "continue";
  const finalConsequences = useMemo(
    () => battlefieldConsequencesAt({ clashes: operationProfile.enemyClashes, battleTime: operationProfile.completeAt }),
    [operationProfile.completeAt, operationProfile.enemyClashes],
  );
  const formationOrderIds = useMemo(
    () => playbook.roles.map((role) => assignments[role.id]).filter(Boolean),
    [assignments, playbook.roles],
  );
  const operationFormationFates = useMemo(
    () => formationFatesFor({
      formations,
      formationOrderIds,
      extractedCount: operationProfile.extractedCount,
      consequences: finalConsequences.player,
      campaignDestroyed,
      extractionAt: operationProfile.extractionAt,
      completeAt: operationProfile.completeAt,
    }),
    [campaignDestroyed, finalConsequences.player, formationOrderIds, formations, operationProfile.completeAt, operationProfile.extractedCount, operationProfile.extractionAt],
  );
  const operationEvents = useMemo(
    () => buildOperationEvents(operationProfile, operation),
    [operation, operationProfile],
  );
  const playbackBeats = useMemo(
    () => buildBattlePlayback({
      operation,
      playbookId: playbook.id,
      profile: operationProfile,
      handoffs: tacticalHandoffs,
      formations,
      events: operationEvents,
      comboTimes: comboWindowTimes(operationProfile),
      formationFates: operationFormationFates,
      reinforcementWave: reinforcementWaveFor(operation),
    }),
    [formations, operation, operationEvents, operationFormationFates, operationProfile, playbook.id, tacticalHandoffs],
  );
  const currentPlaybackBeat = playbackBeats[Math.min(playbackIndex, playbackBeats.length - 1)] ?? null;

  const drillSteps = useMemo(
    () => [
      `Condition ${condition.name}: ${condition.effect}`,
      `${formations.length} installed refits locked; no loadout changes after commitment`,
      `Loading ${playbook.name} geometry`,
      ...playbook.stages.map((stage) => `${stage.label} responsibility acknowledged`),
      `${assignedCount} formations assigned; derived task fit remains sealed`,
      `${tacticalHandoffs.length} handoff windows registered; automatic reactions remain sealed`,
      `${operationProfile.enemyClashes.length} enemy orders identified; collision outcomes remain sealed`,
      `Command drill complete. Commit the play to reveal the result.`,
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
    if (phase !== "battle" && phase !== "complete") return;
    setBattleTime(playbackTimeForIndex(playbackBeats, playbackIndex));
  }, [phase, playbackBeats, playbackIndex]);

  useEffect(() => {
    if (phase !== "battle" || decision || !playbackPlaying || playbackIndex >= playbackBeats.length - 1) return undefined;
    const timeout = window.setTimeout(() => {
      setPlaybackIndex((current) => playbackIndexAfterStep(current, 1, playbackBeats.length));
    }, PLAYBACK_BEAT_MS);
    return () => window.clearTimeout(timeout);
  }, [decision, phase, playbackBeats.length, playbackIndex, playbackPlaying]);

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
  }, [battleTime, phase, decision, resolvedDecisions, operationProfile]);

  useEffect(() => {
    if (phase !== "battle" || decision || currentPlaybackBeat?.kind !== "complete") return undefined;
    const timeout = window.setTimeout(() => {
      setPhase("complete");
      setPlaybackPlaying(false);
      setShowCompletion(true);
    }, PLAYBACK_BEAT_MS);
    return () => window.clearTimeout(timeout);
  }, [currentPlaybackBeat, decision, phase]);

  const loadStrategyTrial = (trialId) => {
    if (phase !== "plan" || operationIndex !== 0 || formations.length !== FORMATIONS.length) return;
    const trial = strategyTrialFor(trialId);
    const trialPlaybook = PLAYBOOKS.find((item) => item.id === trial?.playbookId);
    const formationIds = new Set(formations.map((formation) => formation.id));
    const assignmentIds = Object.values(trial?.assignments ?? {});
    if (!trial || !trialPlaybook || assignmentIds.length !== formations.length || assignmentIds.some((formationId) => !formationIds.has(formationId))) return;

    setPlaybookId(trial.playbookId);
    setConditionId(trial.conditionId);
    setRefits(defaultRefits());
    setAssignments({ ...trial.assignments });
    setBranches({ ...trial.branches });
    setBattleBranches({ ...trial.branches });
    setSelected(trial.assignments[trialPlaybook.roles[0].id]);
    setPickerRoleId(null);
    setDrillStep(-1);
    setDrillComplete(false);
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(false);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setPlacementFeedback(null);
    setStrategyTrialId(trial.id);
    setBlindTestActive(false);
    setBlindPrediction(null);
    setStaffExerciseIndex(null);
  };

  const startBlindTest = () => {
    if (phase !== "plan" || operationIndex !== 0 || formations.length !== FORMATIONS.length) return;
    setPlaybookId(playbook.id);
    setConditionId("clear");
    setRefits(defaultRefits());
    setAssignments(emptyAssignments(playbook));
    setBranches(defaultBranches(OPERATIONS[0]));
    setBattleBranches(defaultBranches(OPERATIONS[0]));
    setSelected("harpoon");
    setPickerRoleId(null);
    setDrillStep(-1);
    setDrillComplete(false);
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(false);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setPlacementFeedback(null);
    setStrategyTrialId(null);
    setBlindTestActive(true);
    setBlindPrediction(null);
    setStaffExerciseIndex(null);
  };

  const chooseBlindPrediction = (predictionId) => {
    if (!blindTestActive || phase !== "plan" || !BLIND_PREDICTIONS.some((prediction) => prediction.id === predictionId)) return;
    setBlindPrediction(predictionId);
  };

  const runStaffExercise = (handoffIndex) => {
    if (phase !== "plan") return;
    setStaffExerciseIndex((currentIndex) => claimStaffExercise({
      currentIndex,
      requestedIndex: handoffIndex,
      handoffCount: tacticalHandoffs.length,
    }));
  };

  const changePlaybook = (nextId) => {
    if (phase !== "plan") return;
    const next = PLAYBOOKS.find((item) => item.id === nextId);
    if (!next) return;
    setPlaybookId(next.id);
    setAssignments(emptyAssignments(next));
    setBranches(defaultBranches(operation));
    setBattleBranches(defaultBranches(operation));
    setSelected(formations[0]?.id ?? "");
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillStep(-1);
    setDrillComplete(false);
    setStrategyTrialId(null);
    setStaffExerciseIndex(null);
    if (blindTestActive) setBlindPrediction(null);
  };

  const changeCondition = (nextId) => {
    if (phase !== "plan" || operation.conditionLocked || !MISSION_CONDITIONS.some((item) => item.id === nextId)) return;
    setConditionId(nextId);
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillStep(-1);
    setDrillComplete(false);
    if (staffExerciseIndex !== null) setStaffExerciseIndex(-1);
    if (blindTestActive) setBlindPrediction(null);
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
      const previousProtocols = calculateRefitProtocols(playbook, assignments, formations, operation);
      const nextProtocols = calculateRefitProtocols(playbook, assignments, nextFormations, operation);
      const previousProfile = calculateOperationProfile(previousSequence.handoffs, activeBranches, previousReadiness, condition, operation, previousProtocols, playbook);
      const nextProfile = calculateOperationProfile(nextSequence.handoffs, activeBranches, nextReadiness, condition, operation, nextProtocols, playbook);
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
        forecast: blindTestActive ? "FORECAST SEALED · COMMIT TO REVEAL" : `${nextProfile.extractedCount} / ${formations.length} EXTRACT · ${reinforcementForecast(nextProfile)}`,
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
    if (staffExerciseIndex !== null) setStaffExerciseIndex(-1);
    if (blindTestActive) setBlindPrediction(null);
  };

  const assignFormationToRole = (roleId, formationId) => {
    if (phase !== "plan" || !formations.some((formation) => formation.id === formationId)) return;
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
    const previousProtocols = calculateRefitProtocols(playbook, assignments, formations, operation);
    const nextProtocols = calculateRefitProtocols(playbook, nextAssignments, formations, operation);
    const previousProfile = calculateOperationProfile(previousSequence.handoffs, activeBranches, previousReadiness, condition, operation, previousProtocols, playbook);
    const nextProfile = calculateOperationProfile(nextSequence.handoffs, activeBranches, nextReadiness, condition, operation, nextProtocols, playbook);
    const previousLinks = previousSequence.handoffs.filter((handoff) => handoff.maneuver).length;
    const nextLinks = nextSequence.handoffs.filter((handoff) => handoff.maneuver).length;
    const targetIndex = playbook.roles.findIndex((role) => role.id === targetRole.id);
    const sourceIndex = sourceRole ? playbook.roles.findIndex((role) => role.id === sourceRole.id) : targetIndex;
    const previousReady = Object.values(assignments).filter(Boolean).length === formations.length;
    const nextReady = Object.values(nextAssignments).filter(Boolean).length === formations.length;
    const previousWindow = previousProfile.timeSaved - previousProfile.overrun;
    const nextWindow = nextProfile.timeSaved - nextProfile.overrun;
    const improved = nextLinks > previousLinks || nextProfile.extractedCount > previousProfile.extractedCount || nextWindow > previousWindow;
    const weakened = nextLinks < previousLinks || nextProfile.extractedCount < previousProfile.extractedCount || nextWindow < previousWindow;
    const previousProtocolCount = previousProfile.protocols.length;
    const nextProtocolCount = nextProfile.protocols.length;
    const tone = nextProtocolCount > previousProtocolCount ? "strengthened" : nextProtocolCount < previousProtocolCount ? "weakened" : nextReady && !previousReady ? "strengthened" : weakened ? "weakened" : improved ? "strengthened" : "rewired";
    const title = nextProtocolCount > previousProtocolCount ? "REFIT PROTOCOL ONLINE" : nextProtocolCount < previousProtocolCount ? "REFIT PROTOCOL DORMANT" : nextReady && !previousReady ? "PLAN ONLINE" : tone === "weakened" ? "CHAIN BROKEN" : tone === "strengthened" ? "CHAIN STRENGTHENED" : "CHAIN REWIRED";
    const forecast = nextReady
      ? blindTestActive ? "FORECAST SEALED · COMMIT TO REVEAL" : `${nextProfile.extractedCount} / ${formations.length} EXTRACT · ${reinforcementForecast(nextProfile)}`
      : `${Object.values(nextAssignments).filter(Boolean).length} / ${formations.length} FORMATIONS PLACED`;

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
    if (staffExerciseIndex !== null) setStaffExerciseIndex(-1);
    if (blindTestActive) setBlindPrediction(null);
  };

  const chooseFormationForRole = (formationId) => {
    if (!pickerRoleId) return;
    assignFormationToRole(pickerRoleId, formationId);
  };

  const clearRoleAssignment = (roleId) => {
    if (phase !== "plan" || !playbook.roles.some((role) => role.id === roleId)) return;
    const formationId = assignments[roleId];
    if (!formationId) return;
    setAssignments((current) => ({ ...current, [roleId]: null }));
    setSelected(formationId);
    setHoveredFormationId(null);
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillComplete(false);
    if (staffExerciseIndex !== null) setStaffExerciseIndex(-1);
    if (blindTestActive) setBlindPrediction(null);
  };

  const beginFormationDrag = (event, formationId) => {
    if (phase !== "plan" || !formations.some((formation) => formation.id === formationId)) {
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
    if (blindTestActive) setBlindPrediction(null);
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

  const stepPlayback = (delta) => {
    if (phase !== "battle" && phase !== "complete") return;
    const nextIndex = playbackIndexAfterStep(playbackIndex, delta, playbackBeats.length);
    setPlaybackPlaying(false);
    setPlaybackIndex(nextIndex);
    setBattleTime(playbackTimeForIndex(playbackBeats, nextIndex));
    if (phase === "complete" && nextIndex < playbackBeats.length - 1) {
      setShowCompletion(false);
      setPhase("battle");
    }
  };

  const togglePlayback = () => {
    if (phase !== "battle" && phase !== "complete") return;
    if (phase === "complete" && playbackIndex < playbackBeats.length - 1) {
      setShowCompletion(false);
      setPhase("battle");
    }
    setPlaybackPlaying((current) => !current);
  };

  const replayPlayback = () => {
    if (phase !== "battle" && phase !== "complete") return;
    setShowCompletion(false);
    setDecision(null);
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(true);
    setPhase("battle");
  };

  const commitMission = () => {
    if (!planReady || (blindTestActive && !blindPrediction)) return;
    setPhase("battle");
    setBattleBranches({ ...branches });
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(true);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setSeals(2);
    setShowCompletion(false);
  };

  const handleCompletionAction = () => {
    if (canContinueCampaign) {
      const battleConditions = seriousConditionsFromConsequences({
        clashes: operationProfile.enemyClashes,
        battleTime: operationProfile.completeAt,
      });
      const seriousConditions = operationWon
        ? battleConditions
        : ensureCostlyContinuationConditions(battleConditions, FORMATIONS.map((formation) => formation.id));
      setWorkshopBaseline({
        refits: { ...refits },
        conditions: mergeCampaignConditions(campaignConditions, seriousConditions),
      });
      setWarhostIntegrity(integrityAfterMission);
      setSalvageChoice(null);
      setShowCompletion(false);
      setShowWorkshop(true);
      return;
    }
    if (campaignDestroyed) {
      resetMission();
      return;
    }
    setShowCompletion(false);
  };

  const chooseWorkshopAction = (action) => {
    if (!showWorkshop || !workshopBaseline) return;
    const preview = applyWorkshopAction({ ...workshopBaseline, action, catalog: FORMATIONS });
    if (!preview.applied) return;
    const sameChoice = salvageChoice?.type === action.type
      && salvageChoice?.formationId === action.formationId
      && (action.type !== "refit" || salvageChoice?.refitId === action.refitId);
    setSalvageChoice(sameChoice ? null : action);
  };

  const launchNextOperation = () => {
    const nextIndex = operationIndex + 1;
    const nextOperation = OPERATIONS[nextIndex];
    if (!showWorkshop || !workshopBaseline || !nextOperation) return;
    const campaignResult = applyWorkshopAction({
      ...workshopBaseline,
      action: salvageChoice,
      catalog: FORMATIONS,
    });
    const nextFormations = applyCampaignConditions(resolveFormations(campaignResult.refits), campaignResult.conditions)
      .filter((formation) => formation.available);
    if (nextFormations.length < nextOperation.requiredExtraction) return;
    setRefits(campaignResult.refits);
    setCampaignConditions(campaignResult.conditions);
    setOperationIndex(nextIndex);
    setConditionId(nextOperation.conditionId);
    setAssignments(emptyAssignments(playbook));
    setBranches(defaultBranches(nextOperation));
    setBattleBranches(defaultBranches(nextOperation));
    setPhase("plan");
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(false);
    setSelected(nextFormations[0]?.id ?? "");
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
    setStrategyTrialId(null);
    setBlindTestActive(false);
    setBlindPrediction(null);
    setStaffExerciseIndex(null);
  };

  const resetMission = () => {
    setPhase("plan");
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(false);
    setOperationIndex(0);
    setPlaybookId("trapline");
    setConditionId("clear");
    setRefits(defaultRefits());
    setCampaignConditions({});
    setWarhostIntegrity(3);
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
    setStrategyTrialId(null);
    setBlindTestActive(false);
    setBlindPrediction(null);
    setStaffExerciseIndex(null);
  };

  const repeatBlindTest = () => {
    resetMission();
    setBlindTestActive(true);
  };

  return (
    <main className={`warhost-app ${phase}`}>
      <AppHeader phase={phase} battleTime={battleTime} operation={operation} operationIndex={operationIndex} profile={operationProfile} />
      <div className="mission-shell">
        <FormationRoster formations={formations} unavailableFormations={allFormations.filter((formation) => !formation.available)} inspected={inspectedFormationId} onInspect={setHoveredFormationId} selected={selected} onSelect={setSelected} assignments={assignments} playbook={playbook} onPlaybook={changePlaybook} operation={operation} phase={phase} strategyTrial={strategyTrial} blindTestActive={blindTestActive} blindPrediction={blindPrediction} onBlindPrediction={chooseBlindPrediction} onLoadStrategyTrial={loadStrategyTrial} onStartBlindTest={startBlindTest} onFormationDragStart={beginFormationDrag} readiness={placementReadiness} refitsLocked={operationIndex > 0} onRefit={changeRefit} />
        <Battlefield formations={formations} formationFates={operationFormationFates} inspected={inspectedFormationId} onInspect={setHoveredFormationId} selected={selected} onSelect={setSelected} deployments={deployments} phase={phase} battleTime={battleTime} condition={condition} drillStep={drillStep} placementFeedback={placementFeedback} planReady={planReady} playbook={playbook} drillSteps={drillSteps} assignments={assignments} branches={activeBranches} handoffs={tacticalHandoffs} operation={operation} outputs={roleOutputs} profile={operationProfile} onChooseRole={setPickerRoleId} onAssignFormation={assignFormationToRole} onClearRole={clearRoleAssignment} onFormationDragStart={beginFormationDrag} onStaffExercise={runStaffExercise} readiness={placementReadiness} refitProtocols={refitProtocols} staffExerciseIndex={staffExerciseIndex} playbackBeat={currentPlaybackBeat} playbackBeats={playbackBeats} playbackIndex={playbackIndex} playbackPlaying={playbackPlaying} onPlaybackToggle={togglePlayback} onPlaybackStep={stepPlayback} onPlaybackReplay={replayPlayback} />
        <IntelRail phase={phase} battleTime={battleTime} condition={condition} onCondition={changeCondition} operation={operation} planReady={planReady} blindTestActive={blindTestActive} rescueComplete={rescueComplete} playbook={playbook} assignedCount={assignedCount} formationCount={formations.length} integrity={warhostIntegrity} profile={operationProfile} />
      </div>
      <FooterControls phase={phase} seals={seals} drillComplete={drillComplete} onDrill={() => setPhase("drill")} onCommit={commitMission} onReset={resetMission} operation={operation} planReady={planReady} blindTestActive={blindTestActive} blindPrediction={blindPrediction} branches={activeBranches} onBranch={chooseBranch} />
      <DecisionOverlay decision={decision} seals={seals} branches={branches} operation={operation} onResolve={resolveDecision} />
      <FormationPicker role={playbook.roles.find((role) => role.id === pickerRoleId)} playbook={playbook} condition={condition} formations={formations} assignments={assignments} onChoose={chooseFormationForRole} onClose={() => setPickerRoleId(null)} />
      {showCompletion && <CompletionOverlay formations={formations} formationFates={operationFormationFates} canContinue={canContinueCampaign} campaignDestroyed={campaignDestroyed} integrityBefore={warhostIntegrity} integrityLoss={integrityLoss} integrityAfter={integrityAfterMission} operation={operation} rescued={rescueComplete} usedSeals={2 - seals} playbook={playbook} profile={operationProfile} strategyTrial={strategyTrial} blindTestActive={blindTestActive} blindPrediction={blindPrediction} won={operationWon} onAction={blindTestActive ? repeatBlindTest : strategyTrial ? resetMission : handleCompletionAction} />}
      {showWorkshop && workshopBaseline && <SalvageWorkshop baseline={workshopBaseline} choice={salvageChoice} formations={workshopFormations} integrity={warhostIntegrity} nextOperation={OPERATIONS[operationIndex + 1]} onChoose={chooseWorkshopAction} onLaunch={launchNextOperation} />}
    </main>
  );
}
