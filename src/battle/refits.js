// Refits: the same formation, changed.
//
// Nine formations whose stat lines never move is a game you can read once and then have
// read. Nothing is discovered, because everything is stated — and this project has spent
// most of its life making things legible, which is the right fix for confusion and the
// wrong one for interest.
//
// A refit is a TRADE, never an upgrade. Every one of them gives up something the formation
// was good at. The names and the intent come from the roster, which has carried two weapon
// options per formation since the beginning and never used them for anything.
//
// The important half is that several refits GRANT A KEYWORD THE RULES ALREADY CARE ABOUT —
// SHIELD soaks fire aimed at anything nearby, COMMAND makes neighbours shoot better,
// REPAIR patches a friend each round. Those are not new rules; they are existing ones
// arriving somewhere they could not before, which is where a discovered combination comes
// from. A FLAME SUPPORT VEHICLE with an ASH CRUCIBLE is a screen. A SIEGE GUN CARRIAGE
// with a SPOTTER MAST is a second command vehicle that outranges the board.

import { battleProfileFor } from "./battleProfiles.js";

const withKeyword = (profile, keyword) => (profile.keywords.includes(keyword)
  ? profile : { ...profile, keywords: [...profile.keywords, keyword] });

const withoutKeyword = (profile, keyword) => ({
  ...profile, keywords: profile.keywords.filter((entry) => entry !== keyword),
});

const shift = (profile, changes) => ({
  ...profile,
  ...Object.fromEntries(Object.entries(changes).map(([key, delta]) => [key, Math.max(0, profile[key] + delta)])),
});

export const REFITS = {
  "harpoon:winch": {
    id: "harpoon:winch", formationId: "harpoon", name: "GRAVITIC WINCH",
    text: "Drags ground with it. More control and more speed, and nothing left for a fight.",
    apply: (profile) => shift(profile, { control: 2, move: 2, melee: -2 }),
  },
  "harpoon:magnet": {
    id: "harpoon:magnet", formationId: "harpoon", name: "BREACH MAGNET",
    text: "Trades transit speed for armour-shearing force.",
    apply: (profile) => shift(profile, { melee: 4, move: -6 }),
  },
  "furnace:jets": {
    id: "furnace:jets", formationId: "furnace", name: "SMELTER JETS",
    text: "Wider thermal denial, at a range that barely reaches past its own hull.",
    apply: (profile) => shift(profile, { shots: 2, range: -4 }),
  },
  "furnace:crucible": {
    id: "furnace:crucible", formationId: "furnace", name: "ASH CRUCIBLE",
    text: "Trades weight of fire for a moving smoke screen. Gains SHIELD.",
    apply: (profile) => withKeyword(shift(profile, { shots: -1 }), "SHIELD"),
  },
  "breaker:ram": {
    id: "breaker:ram", formationId: "breaker", name: "RAM FRAME",
    text: "Direct shock package. Hits far harder and has less left to soak with.",
    apply: (profile) => shift(profile, { melee: 4, wounds: -2 }),
  },
  "breaker:charge": {
    id: "breaker:charge", formationId: "breaker", name: "FRACTURE CHARGE",
    text: "Trades shock control for a gun that reaches something before contact.",
    apply: (profile) => shift(profile, { shots: 2, range: 8, melee: -3 }),
  },
  "railjack:plates": {
    id: "railjack:plates", formationId: "railjack", name: "BASTION PLATES",
    text: "An armoured screen for the ground it holds, bought with its reach. Gains SHIELD.",
    apply: (profile) => withKeyword(shift(profile, { range: -8 }), "SHIELD"),
  },
  "railjack:sled": {
    id: "railjack:sled", formationId: "railjack", name: "SUPPLY SLED",
    text: "Trades a gun for forward sustainment. Gains REPAIR.",
    apply: (profile) => withKeyword(shift(profile, { shots: -1 }), "REPAIR"),
  },
  "hauler:crane": {
    id: "hauler:crane", formationId: "hauler", name: "RECOVERY CRANE",
    text: "A sustainment rig. Holds more ground and more punishment, and moves like a barge.",
    apply: (profile) => shift(profile, { control: 2, wounds: 3, move: -4 }),
  },
  "hauler:shield": {
    id: "hauler:shield", formationId: "hauler", name: "EVAC SHIELD",
    text: "Trades repair throughput for protected movement. Gains SHIELD, loses REPAIR.",
    apply: (profile) => withKeyword(withoutKeyword(profile, "REPAIR"), "SHIELD"),
  },
  "skimmer:lance": {
    id: "skimmer:lance", formationId: "skimmer", name: "SHOCK LANCE",
    text: "Hits a lane before it closes. Nothing survives the second hit, including this.",
    apply: (profile) => shift(profile, { melee: 5, wounds: -1 }),
  },
  "skimmer:netgun": {
    id: "skimmer:netgun", formationId: "skimmer", name: "SNARE PROJECTOR",
    text: "Trades strike power for holding a lane shut from further away.",
    apply: (profile) => shift(profile, { control: 2, range: 6, melee: -2 }),
  },
  "carriage:barrage": {
    id: "carriage:barrage", formationId: "carriage", name: "SATURATION BARRAGE",
    text: "Blankets an approach. Still enormous, no longer able to see across the board.",
    apply: (profile) => shift(profile, { shots: 2, range: -14 }),
  },
  "carriage:spotter": {
    id: "carriage:spotter", formationId: "carriage", name: "SPOTTER MAST",
    text: "Trades weight of fire for directing the advance. Gains COMMAND.",
    apply: (profile) => withKeyword(shift(profile, { shots: -2 }), "COMMAND"),
  },
  "command:relay": {
    id: "command:relay", formationId: "command", name: "FIELD RELAY",
    text: "Keeps the advance resupplied as well as coordinated. Gains REPAIR.",
    apply: (profile) => withKeyword(shift(profile, { shots: -1 }), "REPAIR"),
  },
  "command:bastion": {
    id: "command:bastion", formationId: "command", name: "BASTION UPLINK",
    text: "Trades resupply for holding a seized objective and refusing to leave it.",
    apply: (profile) => shift(profile, { control: 3, move: -4 }),
  },
  "bastion:wall": {
    id: "bastion:wall", formationId: "bastion", name: "SHIELD WALL",
    text: "Screens the lane it is standing in, and will not be standing anywhere else.",
    apply: (profile) => shift(profile, { wounds: 4, move: -3 }),
  },
  "bastion:breachram": {
    id: "bastion:breachram", formationId: "bastion", name: "BREACH RAM",
    text: "Trades the screen for opening a sealed approach. Loses SHIELD.",
    apply: (profile) => withoutKeyword(shift(profile, { melee: 5 }), "SHIELD"),
  },
};

export const REFIT_COST = 2;

export const refitFor = (id) => REFITS[id] ?? null;
export const refitsFor = (formationId) => Object.values(REFITS).filter((refit) => refit.formationId === formationId);

// Applying one. A profile with no refit comes back untouched, so every battle resolved
// before refits existed resolves identically.
export const applyRefit = (profile, refitId) => {
  const refit = refitFor(refitId);
  if (!refit || refit.formationId !== profile.id) return profile;
  return { ...refit.apply(profile), refit: refit.id, refitName: refit.name };
};

// The stat line as it will actually fight. Anywhere that SHOWS a formation rather than
// resolving one has to go through here: reading BATTLE_PROFILES directly prints the
// unrefitted numbers next to the refit's name, which is a lie the player can catch by
// counting shots on the board. Now that refits cost 2 and three are on the shelf, most
// of a late warband carries one.
export const profileWithRefit = (formationId, refitId = null) => (
  applyRefit({ ...battleProfileFor(formationId), id: formationId }, refitId)
);
