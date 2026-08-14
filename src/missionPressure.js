const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const boundedSeconds = (value) => clamp(Math.round(Number(value) || 0), -60, 60);

const pressure = (definition) => Object.freeze({
  roleOverrides: {},
  positionOffsets: {},
  playbookTiming: {},
  waveArrivalShift: 0,
  ...definition,
});

export const DEAD_CIRCUIT_PRESSURES = Object.freeze([
  pressure({
    id: "fractured-transit",
    operationId: "dead-circuit",
    name: "FRACTURED TRANSIT",
    brief: "Collapsed transit decks permit only one secure advance at a time.",
    effect: "STOP 02 demands MOBILITY / CONTROL. Concentrated routes cross the damaged deck more slowly.",
    roleOverrides: { 1: ["MOBILITY", "CONTROL"], 4: ["RECOVERY", "HOLD"] },
    positionOffsets: {
      trapline: [{ x: -2, y: 0 }, { x: -5, y: 7 }, { x: 1, y: 3 }, { x: 2, y: -2 }, { x: 0, y: 0 }],
      spear: [{ x: -2, y: 0 }, { x: -7, y: 8 }, { x: 2, y: 4 }, { x: 4, y: -2 }, { x: 0, y: 0 }],
      pressure: [{ x: -4, y: 1 }, { x: 5, y: 4 }, { x: 0, y: 2 }, { x: 2, y: -1 }, { x: 0, y: 0 }],
    },
    playbookTiming: { trapline: 0, spear: 10, pressure: 5 },
  }),
  pressure({
    id: "reactor-window",
    operationId: "dead-circuit",
    name: "REACTOR SHIELD WINDOW",
    brief: "The Reactor Spine opens only while both control nodes remain occupied.",
    effect: "STOP 01 demands HOLD / CONTROL. The two control groups must sustain simultaneous pressure.",
    roleOverrides: { 0: ["HOLD", "CONTROL"], 1: ["MOBILITY", "SHOCK"] },
    positionOffsets: {
      trapline: [{ x: -7, y: 1 }, { x: 7, y: -2 }, { x: 2, y: 3 }, { x: 1, y: -1 }, { x: 0, y: 0 }],
      spear: [{ x: -8, y: 1 }, { x: 8, y: -2 }, { x: 2, y: 3 }, { x: 1, y: -1 }, { x: 0, y: 0 }],
      pressure: [{ x: -8, y: 0 }, { x: 9, y: 0 }, { x: 1, y: 1 }, { x: 2, y: -2 }, { x: 0, y: 0 }],
    },
    playbookTiming: { trapline: 10, spear: 5, pressure: -5 },
  }),
  pressure({
    id: "early-relief",
    operationId: "dead-circuit",
    name: "EARLY RELIEF COLUMN",
    brief: "Helioch reserves will reach the extraction gantry forty-five seconds early.",
    effect: "STOP 04 demands DENIAL / COVER. The enemy wave arrives at 06:15.",
    roleOverrides: { 3: ["DENIAL", "COVER"], 4: ["RECOVERY", "SUPPORT"] },
    positionOffsets: {
      trapline: [{ x: -1, y: 0 }, { x: 1, y: 2 }, { x: 3, y: 1 }, { x: 8, y: -4 }, { x: 3, y: -2 }],
      spear: [{ x: -1, y: 0 }, { x: 2, y: 2 }, { x: 4, y: 1 }, { x: 10, y: -5 }, { x: 3, y: -2 }],
      pressure: [{ x: -2, y: 0 }, { x: 1, y: 2 }, { x: 4, y: 1 }, { x: 9, y: -4 }, { x: 3, y: -2 }],
    },
    playbookTiming: { trapline: 0, spear: -5, pressure: 0 },
    waveArrivalShift: -45,
  }),
]);

const ASHEN_BLACKOUT = pressure({
  id: "blackout",
  operationId: "ashen-passage",
  name: "SENSOR BLACKOUT",
  brief: "Smoke severs visual contact across the approach.",
  effect: "STOP 01 demands COVER / SHOCK. STOP 04 demands CONTROL / DENIAL.",
  roleOverrides: { 0: ["COVER", "SHOCK"], 3: ["CONTROL", "DENIAL"] },
});

export const MISSION_PRESSURES = Object.freeze([...DEAD_CIRCUIT_PRESSURES, ASHEN_BLACKOUT]);

export const missionPressuresForOperation = (operationId) => {
  const matches = MISSION_PRESSURES.filter((item) => item.operationId === operationId);
  return matches.length ? matches : DEAD_CIRCUIT_PRESSURES;
};

export const missionPressureFor = (id, operationId = "dead-circuit") => {
  const choices = missionPressuresForOperation(operationId);
  return choices.find((item) => item.id === id) ?? choices[0];
};

export const roleDemandsForPressure = (role, index, selectedPressure) => (
  selectedPressure?.roleOverrides?.[index] ?? role.demands
);

export const playbookTimingForPressure = (selectedPressure, playbookId) => (
  boundedSeconds(selectedPressure?.playbookTiming?.[playbookId])
);

export const waveArrivalForPressure = (baseArrival, selectedPressure) => (
  Math.max(60, Math.round(Number(baseArrival) || 0) + boundedSeconds(selectedPressure?.waveArrivalShift))
);

export const fieldPlanForPressure = (plan, selectedPressure, playbookId) => {
  const offsets = selectedPressure?.positionOffsets?.[playbookId] ?? [];
  return {
    ...plan,
    positions: plan.positions.map((position, index) => ({
      x: clamp(position.x + (Number(offsets[index]?.x) || 0), 5, 95),
      y: clamp(position.y + (Number(offsets[index]?.y) || 0), 5, 95),
    })),
  };
};
