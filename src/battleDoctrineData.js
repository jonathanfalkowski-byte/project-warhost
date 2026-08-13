export const BATTLEFIELD_DOCTRINES = Object.freeze({
  trapline: Object.freeze({
    pattern: "LEAPFROG COLUMN",
    phases: Object.freeze([
      { label: "SCREEN & SEIZE", detail: "Lead takes Alpha; support blocks the counterattack.", roles: "01 + 02" },
      { label: "RELIEVE & ADVANCE", detail: "Support assumes Alpha while the assault group moves through.", roles: "01 + 02 + 03" },
      { label: "BREACH PRIMARY", detail: "Assault and security elements open the Reactor Spine.", roles: "03 + 04" },
      { label: "REFORM & EXTRACT", detail: "Recovery guard receives every surviving formation.", roles: "ALL" },
    ]),
    contacts: Object.freeze([
      { x: 58, y: 46, label: "LIKELY COUNTERATTACK", detail: "Enemy reserve contests the transfer lane." },
      { x: 74, y: 50, label: "PRIMARY DEFENCE", detail: "Breach resistance expected at the Reactor." },
    ]),
  }),
  spear: Object.freeze({
    pattern: "CONCENTRATED THRUST",
    phases: Object.freeze([
      { label: "SCREEN", detail: "A covering element masks the assault mass.", roles: "01" },
      { label: "CONCENTRATE", detail: "Advance and assault groups occupy one protected corridor.", roles: "01 + 02 + 03" },
      { label: "STRIKE", detail: "The mass breaches the Reactor while flank security blocks relief.", roles: "03 + 04" },
      { label: "SECURE & EXTRACT", detail: "Rear guard holds the corridor until the force clears.", roles: "ALL" },
    ]),
    contacts: Object.freeze([
      { x: 54, y: 49, label: "DECISIVE CONTACT", detail: "Enemy screen must be fixed before the strike." },
      { x: 73, y: 55, label: "OBJECTIVE DEFENCE", detail: "Main resistance is concentrated at the Reactor." },
    ]),
  }),
  pressure: Object.freeze({
    pattern: "TWO-AXIS ATTACK",
    phases: Object.freeze([
      { label: "DIVIDE", detail: "Two wings take separate, non-crossing approaches.", roles: "01 + 02" },
      { label: "CAPTURE & INTERDICT", detail: "Each wing takes a control while the centre denies reinforcement.", roles: "01 + 02 + 03" },
      { label: "CONVERGE", detail: "Both wings meet once at the Reactor approach.", roles: "01 + 02 + 03 + 04" },
      { label: "EXTRACT", detail: "Extraction guard receives the force and leaves last.", roles: "ALL" },
    ]),
    contacts: Object.freeze([
      { x: 42, y: 49, label: "WEST CONTACT", detail: "Alpha defence can delay the western wing." },
      { x: 67, y: 34, label: "EAST CONTACT", detail: "Beta defence can isolate the eastern wing." },
      { x: 70, y: 53, label: "CONVERGENCE FIGHT", detail: "Enemy reserve threatens the reunited force." },
    ]),
  }),
});

export const battlefieldDoctrineFor = (playbookId) => BATTLEFIELD_DOCTRINES[playbookId] ?? null;
