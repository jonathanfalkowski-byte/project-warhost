import {
  Anchor,
  Crosshair,
  Factory,
  Hammer,
  Shield,
  Target,
  Truck,
} from "@phosphor-icons/react";

export const PLAYBOOKS = [
  {
    id: "trapline",
    name: "ROLLING SABOTAGE",
    summary: "Seize, transfer, sabotage, withdraw.",
    intent: "Advance the whole Warhost through both control nodes, transfer security behind the lead, sabotage the primary asset, and reform for extraction.",
    icon: Anchor,
    stages: [
      { label: "SEIZE", detail: "Open first objective.", icon: Anchor },
      { label: "TRANSFER", detail: "Pass secured ground.", icon: Shield },
      { label: "SABOTAGE", detail: "Disable primary asset.", icon: Hammer, warm: true },
      { label: "WITHDRAW", detail: "Reform at extraction.", icon: Truck },
    ],
    comboWindows: [
      { from: 0, to: 1, label: "ALPHA TRANSFER", rendezvous: "alphaTransfer" },
      { from: 1, to: 2, label: "OPENED SABOTAGE LANE", rendezvous: "sabotageLane" },
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
    comboWindows: [
      { from: 0, to: 1, label: "SCREENED CONCENTRATION", rendezvous: "screenedConcentration" },
      { from: 1, to: 2, label: "ASSAULT LAUNCH", rendezvous: "assaultLaunch" },
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
    comboWindows: [
      { from: 1, to: 2, label: "EAST INTERDICTION", rendezvous: "eastInterdiction" },
      { from: 2, to: 3, label: "PRIMARY CONVERGENCE", rendezvous: "primaryConvergence" },
    ],
    roles: [
      { id: "alpha", label: "WEST OBJECTIVE GROUP", brief: "Seize and maintain the western control objective.", node: "alphaApproach", demands: ["HOLD", "CONTROL"] },
      { id: "beta", label: "EAST OBJECTIVE GROUP", brief: "Seize the eastern control objective in parallel.", node: "betaLane", demands: ["MOBILITY", "SHOCK"] },
      { id: "deny", label: "INTERDICTION ELEMENT", brief: "Prevent enemy movement between the two objective fights.", node: "fireLine", demands: ["DENIAL", "COVER"] },
      { id: "reactor", label: "CONVERGENCE ELEMENT", brief: "Unite both groups at the primary objective.", node: "breachLine", demands: ["BREACH", "CONTROL"] },
      { id: "recover", label: "EXTRACTION GUARD", brief: "Hold the extraction corridor, recover stragglers, and leave last.", node: "recoveryLine", demands: ["RECOVERY", "HOLD"] },
    ],
  },
];

export const ASHEN_PASSAGE_PLAYBOOK_COPY = {
  trapline: {
    name: "ROLLING EVACUATION",
    summary: "Open, transfer, hold, evacuate.",
    intent: "Advance the whole Warhost through both Ember Gates, transfer security behind the lead, hold the relay, and reform at the Void Lift.",
    stageLabels: ["OPEN", "TRANSFER", "HOLD", "EVACUATE"],
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

export const playbookForOperation = (playbook, operation) => {
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

export const PLAYBOOK_BATTLEFIELD_READ = {
  trapline: {
    winsBy: "Sweeping from Alpha through the Reactor, then reforming at extraction.",
    commits: "The army follows one connected objective-to-objective column.",
    risks: "A stalled lead element delays every formation behind it.",
  },
  spear: {
    winsBy: "Screening Alpha while the assault mass drives straight into the Reactor.",
    commits: "Four formations collapse into one decisive corridor before extraction.",
    risks: "The screening element and extraction corridor receive less protection.",
  },
  pressure: {
    winsBy: "Taking Alpha and Beta in parallel, then converging at the Reactor.",
    commits: "Two separated wings must reunite before the final extraction push.",
    risks: "Either wing can be isolated before the convergence.",
  },
};
