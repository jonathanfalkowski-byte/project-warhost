export const DEAD_CIRCUIT_FIELD_LANDMARKS = {
  alpha: { x: 27, y: 58 },
  beta: { x: 70, y: 43 },
  reactor: { x: 82, y: 54 },
  extraction: { x: 94, y: 22 },
  eastGantry: { x: 94, y: 22 },
  northLift: { x: 94, y: 8 },
  southMotorPool: { x: 96, y: 94 },
  rescue: { x: 82, y: 76 },

  westGate: { x: 20, y: 72 },
  alphaExit: { x: 33, y: 60 },
  southArcWest: { x: 35, y: 73 },
  southArcEast: { x: 59, y: 73 },
  centralGateSouth: { x: 60, y: 66 },
  centralGateNorth: { x: 59, y: 31 },
  betaApproach: { x: 64, y: 46 },
  betaExit: { x: 75, y: 43 },
  reactorApproach: { x: 77, y: 51 },
  reactorExit: { x: 81, y: 35 },
  gantryApproach: { x: 90, y: 34 },
  gantrySouthEast: { x: 90, y: 72 },
  recoverySouthGate: { x: 76, y: 82 },
  recoveryAisle: { x: 86, y: 82 },

  westNorthGate: { x: 28, y: 23 },
  northCrossing: { x: 60, y: 18 },
  betaNorth: { x: 84, y: 18 },
  reactorNorth: { x: 78, y: 24 },
  reactorExitEast: { x: 88, y: 54 },
  reactorNorthWest: { x: 82, y: 34 },
  northExitEast: { x: 94, y: 24 },
  eastServiceNorth: { x: 92, y: 18 },
  reactorSouth: { x: 79, y: 68 },
  eastServiceSouth: { x: 90, y: 71 },
  southExit: { x: 94, y: 86 },
  southBypassWest: { x: 64, y: 82 },
  reactorLowerGate: { x: 81, y: 82 },
  reactorSouthEast: { x: 81, y: 68 },
  eastOuterNorth: { x: 92, y: 30 },

  // Only walkers may use the ruined assembly hall. Tracked vehicles remain on
  // the perimeter streets and arrive by a longer, but safer, approach.
  walkerRuinSouthEntry: { x: 48, y: 70 },
  walkerRuinCore: { x: 48, y: 48 },
  walkerRuinExit: { x: 58, y: 46 },

  alphaTransfer: { x: 36, y: 64 },
  sabotageLane: { x: 62, y: 55 },
  screenedConcentration: { x: 36, y: 64 },
  assaultLaunch: { x: 62, y: 51 },
  eastInterdiction: { x: 62, y: 52 },
  primaryConvergence: { x: 75, y: 51 },
};

export const DEAD_CIRCUIT_BLOCKED_TERRAIN = [
  { id: "west-foundry", label: "West Foundry", left: 34, right: 41, top: 31, bottom: 64, walkerTraversable: false },
  { id: "central-foundry", label: "Ruined Assembly Hall", left: 41, right: 56, top: 22, bottom: 67, walkerTraversable: true },
  { id: "reactor-works", label: "Reactor Works", left: 67, right: 79, top: 58, bottom: 78, walkerTraversable: false },
  { id: "gantry-wall", label: "Gantry Wall", left: 83, right: 89, top: 38, bottom: 67, walkerTraversable: false },
];

export const DEAD_CIRCUIT_MISSION = Object.freeze({
  playerDisposition: "DISRUPTION",
  enemyDisposition: "SAFEGUARD",
  title: "BREAK THE CIRCUIT",
  objectives: Object.freeze([
    { id: "alpha", order: 1, label: "CONTROL ALPHA", instruction: "SEIZE & HOLD" },
    { id: "beta", order: 1, label: "CONTROL BETA", instruction: "SEIZE & HOLD" },
    { id: "reactor", order: 2, label: "REACTOR SPINE", instruction: "SABOTAGE" },
    { id: "extraction", order: 3, label: "EXTRACTION ZONE", instruction: "EXTRACT 3+" },
  ]),
});

const objectivePhases = (...phases) => phases.map((phase, index) => ({
  id: `phase-${index + 1}`,
  number: index + 1,
  ...phase,
}));

const route = (role, start, points, afterLabel, movementRoutes = {}) => ({
  role,
  start,
  points,
  movementRoutes,
  afterLabel,
});

const eastExitBranches = {
  beta: {
    tempo: ["betaApproach", "beta", "betaExit", "reactorApproach", "reactor", "reactorSouthEast", "eastServiceSouth", "gantrySouthEast"],
    protect: ["betaApproach", "beta", "reactorApproach", "reactor", "reactorSouthEast", "eastServiceSouth", "gantrySouthEast"],
  },
  rescue: {
    clock: ["recoverySouthGate", "recoveryAisle", "gantrySouthEast"],
    recover: ["recoverySouthGate", "rescue", "recoveryAisle", "gantrySouthEast"],
  },
};

export const ROLLING_SABOTAGE_FIELD_PLAN = {
  strategy: "SEQUENTIAL OBJECTIVE SWEEP",
  extractionLandmark: "eastGantry",
  extractionLabel: "EAST GANTRY",
  terrainRule: "Tracked formations follow the connected streets; walkers may cut through the ruined assembly hall after Alpha.",
  objectiveCorridors: [
    { id: "alpha-beta", from: "alpha", to: "beta", label: "TRANSFER", roles: [0, 1, 2] },
    { id: "beta-reactor", from: "beta", to: "reactor", label: "SABOTAGE", roles: [0, 1, 2, 3] },
    { id: "reactor-extraction", from: "reactor", to: "eastGantry", label: "WITHDRAW EAST", roles: [0, 1, 2, 3, 4] },
  ],
  // Action stops sit on the ground each role is ordered to take or hold, not on the
  // deployment line. LEAD seizes Control Alpha; RELAY GUARD holds the southern arc the
  // lead has just cleared; SABOTAGE ELEMENT works the opened lane into the Reactor;
  // CORRIDOR SECURITY holds the central gate every route passes through; RECOVERY works
  // the southern recovery gate.
  positions: [{ x: 27, y: 58 }, { x: 35, y: 73 }, { x: 62, y: 55 }, { x: 58, y: 66 }, { x: 76, y: 82 }],
  objectivePhases: objectivePhases(
    { label: "SEIZE ALPHA", target: "alpha", roles: [0, 1], from: "deployment" },
    { label: "SWEEP TO BETA", target: "beta", roles: [0, 1, 2], from: "alpha" },
    { label: "SABOTAGE REACTOR", target: "reactor", roles: [0, 1, 2, 3], from: "beta" },
    { label: "WITHDRAW EAST", target: "eastGantry", objectiveId: "extraction", roles: [0, 1, 2, 3, 4], from: "reactor" },
  ),
  routes: [
    route(0, { x: 18, y: 91 }, ["westGate", 0, "alphaExit", "southArcWest", "southArcEast", "centralGateSouth", "betaApproach", "beta", "betaExit", "reactorApproach", "reactor", "reactorSouthEast", "eastServiceSouth", "gantrySouthEast"], "SEIZE CONTROL ALPHA, THEN LEAD THE SWEEP EAST", { walker: ["westGate", 0, "southArcWest", "walkerRuinSouthEntry", "walkerRuinCore", "walkerRuinExit", "beta", "reactorApproach", "reactor", "reactorSouthEast", "eastServiceSouth", "gantrySouthEast"] }),
    route(1, { x: 30, y: 91 }, ["westGate", "alpha", 1, "southArcEast", "centralGateSouth", "beta", "reactorApproach", "reactor", "reactorSouthEast", "eastServiceSouth", "gantrySouthEast"], "HOLD THE SOUTHERN ARC BEHIND THE LEAD", { walker: ["alpha", 1, "walkerRuinSouthEntry", "walkerRuinCore", "walkerRuinExit", "beta", "reactor", "reactorSouthEast", "eastServiceSouth", "gantrySouthEast"] }),
    { ...route(2, { x: 42, y: 91 }, ["southArcEast", "centralGateSouth", 2], "WORK THE OPENED LANE INTO THE REACTOR", { walker: ["walkerRuinSouthEntry", "walkerRuinCore", "walkerRuinExit", 2] }), breakpoint: "beta" },
    route(3, { x: 56, y: 91 }, ["southArcEast", 3, "betaApproach", "beta", "reactorApproach", "reactor", "reactorSouthEast", "eastServiceSouth", "gantrySouthEast"], "HOLD THE CENTRAL GATE THE COLUMN PASSES THROUGH"),
    { ...route(4, { x: 70, y: 91 }, [4], "WORK THE SOUTHERN RECOVERY GATE, THEN WITHDRAW EAST"), breakpoint: "rescue" },
  ],
  breakpointRoles: { beta: 2, rescue: 4 },
  branchRoutes: eastExitBranches,
};

const northExitBranches = {
  beta: {
    tempo: ["beta", "reactorApproach", "reactor", "reactorNorthWest", "northExitEast"],
    protect: ["beta", "reactorApproach", "reactor", "reactorNorthWest", "northExitEast"],
  },
  rescue: {
    clock: ["recoverySouthGate", "recoveryAisle", "eastServiceSouth", "gantrySouthEast", "gantryApproach", "eastOuterNorth", "northExitEast"],
    recover: ["rescue", "recoveryAisle", "eastServiceSouth", "gantrySouthEast", "gantryApproach", "eastOuterNorth", "northExitEast"],
  },
};

export const DECISIVE_ASSAULT_FIELD_PLAN = {
  strategy: "CONCENTRATED OBJECTIVE THRUST",
  extractionLandmark: "northLift",
  extractionLabel: "NORTH LIFT",
  terrainRule: "The assault mass uses one northern corridor. Walkers can breach the central ruins; tracked armor must use the northern perimeter gate.",
  objectiveCorridors: [
    { id: "alpha-mass", from: "alpha", to: "beta", label: "SCREEN RELEASE", roles: [0] },
    { id: "mass-reactor", from: "beta", to: "reactor", label: "MAIN THRUST", roles: [1, 2, 3] },
    { id: "reactor-north", from: "reactor", to: "northLift", label: "EXTRACT NORTH", roles: [0, 1, 2, 3, 4] },
  ],
  // SCREENING holds Control Alpha while the army masses; ADVANCE GUARD secures the narrow
  // northern crossing; ASSAULT works the launch point onto the Reactor; FLANK SECURITY
  // holds the Beta approach against reinforcement; REAR works the recovery gate.
  positions: [{ x: 27, y: 58 }, { x: 64, y: 16 }, { x: 64, y: 56 }, { x: 64, y: 46 }, { x: 76, y: 82 }],
  objectivePhases: objectivePhases(
    { label: "SCREEN ALPHA", target: "alpha", roles: [0], from: "deployment" },
    { label: "MASS ON BETA", target: "beta", roles: [1, 2, 3], from: "deployment" },
    { label: "STRIKE REACTOR", target: "reactor", roles: [0, 1, 2, 3], from: "beta" },
    { label: "SECURE NORTH LIFT", target: "northLift", objectiveId: "extraction", roles: [0, 1, 2, 3, 4], from: "reactor" },
  ),
  routes: [
    route(0, { x: 20, y: 91 }, ["westGate", 0, "westNorthGate", "northCrossing", "beta", "reactorApproach", "reactor", "reactorNorthWest", "northExitEast"], "SCREEN CONTROL ALPHA WHILE THE ARMY MASSES", { walker: ["westGate", 0, "southArcWest", "walkerRuinSouthEntry", "walkerRuinCore", "walkerRuinExit", "beta", "reactorApproach", "reactor", "reactorNorthWest", "northExitEast"] }),
    route(1, { x: 38, y: 91 }, ["southArcWest", "westGate", "westNorthGate", 1, "beta", "reactorApproach", "reactor", "reactorNorthWest", "northExitEast"], "SECURE THE NARROW NORTHERN CROSSING"),
    { ...route(2, { x: 47, y: 91 }, ["southArcEast", "centralGateSouth", 2], "LAUNCH THE ASSAULT ONTO THE REACTOR", { walker: ["walkerRuinSouthEntry", "walkerRuinCore", "walkerRuinExit", 2] }), breakpoint: "beta" },
    route(3, { x: 56, y: 91 }, ["southArcEast", "centralGateSouth", 3, "beta", "reactorApproach", "reactor", "reactorNorthWest", "northExitEast"], "HOLD THE BETA APPROACH AGAINST REINFORCEMENT"),
    { ...route(4, { x: 68, y: 91 }, [4], "WORK THE RECOVERY GATE, THEN LIFT NORTH"), breakpoint: "rescue" },
  ],
  breakpointRoles: { beta: 2, rescue: 4 },
  branchRoutes: northExitBranches,
};

const southExitBranches = {
  beta: {
    tempo: ["beta", "reactorApproach", "reactor", "reactorSouthEast", "reactorLowerGate", "southExit"],
    protect: ["beta", "betaExit", "reactorApproach", "reactor", "reactorSouthEast", "reactorLowerGate", "southExit"],
  },
  rescue: {
    clock: ["southExit"],
    recover: ["rescue", "reactorLowerGate", "southExit"],
  },
};

export const TWIN_SEIZURE_FIELD_PLAN = {
  strategy: "PARALLEL OBJECTIVE WINGS",
  extractionLandmark: "southMotorPool",
  extractionLabel: "SOUTH MOTOR POOL",
  terrainRule: "Two non-crossing wings seize Alpha and Beta, converge at the Reactor, then withdraw together along the southern service road.",
  objectiveCorridors: [
    { id: "west-wing", from: "alpha", to: "reactor", label: "WEST WING", roles: [0, 2] },
    { id: "east-wing", from: "beta", to: "reactor", label: "EAST WING", roles: [1, 3] },
    { id: "reactor-south", from: "reactor", to: "southMotorPool", label: "CONVERGE SOUTH", roles: [0, 1, 2, 3, 4] },
  ],
  // Read against this plan's own role briefs: WEST and EAST OBJECTIVE GROUPS take Alpha
  // and Beta, INTERDICTION holds the northern crossing that links the two fights,
  // CONVERGENCE forms on the reactor approach where both wings meet, and EXTRACTION
  // GUARD works the southern withdrawal road.
  positions: [{ x: 27, y: 58 }, { x: 70, y: 43 }, { x: 60, y: 18 }, { x: 72, y: 50 }, { x: 81, y: 82 }],
  objectivePhases: objectivePhases(
    { label: "WEST WING: ALPHA", target: "alpha", roles: [0, 2], from: "deployment" },
    { label: "EAST WING: BETA", target: "beta", roles: [1, 3], from: "deployment" },
    { label: "CONVERGE ON REACTOR", target: "reactor", roles: [0, 1, 2, 3], from: "both controls" },
    { label: "WITHDRAW SOUTH", target: "southMotorPool", objectiveId: "extraction", roles: [0, 1, 2, 3, 4], from: "reactor" },
  ),
  routes: [
    route(0, { x: 16, y: 91 }, ["westGate", 0, "westNorthGate", "northCrossing", "reactorNorth", "reactor", "reactorSouthEast", "reactorLowerGate", "southExit"], "SEIZE AND HOLD CONTROL ALPHA"),
    { ...route(1, { x: 48, y: 91 }, ["southArcEast", "centralGateSouth", "betaApproach", 1], "SEIZE AND HOLD CONTROL BETA"), breakpoint: "beta" },
    route(2, { x: 27, y: 91 }, ["alpha", "westNorthGate", 2, "reactorNorth", "reactor", "reactorSouthEast", "reactorLowerGate", "southExit"], "HOLD THE NORTHERN CROSSING BETWEEN THE TWO FIGHTS", { walker: ["alpha", "southArcWest", "walkerRuinSouthEntry", "walkerRuinCore", "walkerRuinExit", "centralGateNorth", 2, "reactorNorth", "reactor", "reactorSouthEast", "reactorLowerGate", "southExit"] }),
    route(3, { x: 58, y: 91 }, ["southArcEast", "centralGateSouth", "betaApproach", "beta", 3, "reactor", "reactorSouthEast", "reactorLowerGate", "southExit"], "UNITE BOTH WINGS ON THE REACTOR APPROACH"),
    { ...route(4, { x: 92, y: 72 }, [4], "GUARD THE SOUTHERN WITHDRAWAL ROAD"), breakpoint: "rescue" },
  ],
  breakpointRoles: { beta: 1, rescue: 4 },
  branchRoutes: southExitBranches,
};

export const DEAD_CIRCUIT_FIELD_PLANS = {
  trapline: ROLLING_SABOTAGE_FIELD_PLAN,
  spear: DECISIVE_ASSAULT_FIELD_PLAN,
  pressure: TWIN_SEIZURE_FIELD_PLAN,
};
