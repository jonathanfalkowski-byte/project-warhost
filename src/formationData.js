import {
  Anchor,
  Fire,
  Hammer,
  Shield,
  Truck,
} from "@phosphor-icons/react";

export const FORMATIONS = [
  {
    id: "harpoon",
    number: "1",
    name: "RECON TANK",
    role: "DISPLACE",
    movementProfile: "light-tracked",
    endurance: { armor: 3, cohesion: 3, mobility: 5 },
    capabilities: ["CONTROL", "MOBILITY"],
    refits: [
      { id: "winch", name: "GRAVITIC WINCH", summary: "Control package built for forced movement.", capabilities: ["CONTROL", "MOBILITY"], creates: "DISPLACED" },
      { id: "magnet", name: "BREACH MAGNET", summary: "Trades transit speed for armor-shearing force.", capabilities: ["CONTROL", "BREACH"], creates: "FRACTURED ARMOR" },
    ],
    purpose: "Scouts the advance, controls enemy movement, and forces blockers out of position.",
    creates: "DISPLACED",
    uses: ["SCREENED", "SUPPLIED", "FORWARD HOLD"],
    asset: "/assets/harpoon-rig.png",
    icon: Anchor,
    defaultNode: "alphaApproach",
  },
  {
    id: "furnace",
    number: "2",
    name: "FLAME SUPPORT VEHICLE",
    role: "DENY",
    movementProfile: "tracked",
    endurance: { armor: 2, cohesion: 4, mobility: 3 },
    capabilities: ["DENIAL", "AREA"],
    refits: [
      { id: "jets", name: "SMELTER JETS", summary: "Wide thermal denial across exposed lanes.", capabilities: ["DENIAL", "AREA"], creates: "OVERHEATED" },
      { id: "crucible", name: "ASH CRUCIBLE", summary: "Trades area pressure for a moving smoke screen.", capabilities: ["DENIAL", "COVER"], creates: "SCREENED" },
    ],
    purpose: "Uses heavy flame weapons to deny ground and seal exposed approach lanes.",
    creates: "OVERHEATED",
    uses: ["DISPLACED", "SCREENED", "SUPPLIED", "FORWARD HOLD"],
    asset: "/assets/furnace-crew.png",
    icon: Fire,
    defaultNode: "fireLine",
  },
  {
    id: "breaker",
    number: "3",
    name: "ASSAULT WALKER",
    role: "BREACH",
    movementProfile: "walker",
    endurance: { armor: 5, cohesion: 3, mobility: 2 },
    capabilities: ["BREACH", "SHOCK"],
    refits: [
      { id: "ram", name: "RAM FRAME", summary: "Direct shock package for rupturing a fixed target.", capabilities: ["BREACH", "SHOCK"], creates: "BREACHED" },
      { id: "charge", name: "FRACTURE CHARGE", summary: "Trades shock control for a wider armor break.", capabilities: ["BREACH", "AREA"], creates: "FRACTURED ARMOR" },
    ],
    purpose: "Assaults fortified positions and drives defenders off objectives.",
    creates: "BREACHED",
    uses: ["DISPLACED", "OVERHEATED", "SCREENED", "SUPPLIED", "KILL ZONE", "SEALED LANE"],
    asset: "/assets/breaker-exo.png",
    icon: Hammer,
    defaultNode: "breachLine",
  },
  {
    id: "railjack",
    number: "4",
    name: "MAIN BATTLE TANK",
    role: "HOLD",
    movementProfile: "heavy-tracked",
    endurance: { armor: 4, cohesion: 5, mobility: 2 },
    capabilities: ["HOLD", "COVER"],
    refits: [
      { id: "plates", name: "BASTION PLATES", summary: "Armored screen for holding captured ground.", capabilities: ["HOLD", "COVER"], creates: "SCREENED" },
      { id: "sled", name: "SUPPLY SLED", summary: "Trades frontal cover for forward sustainment.", capabilities: ["HOLD", "SUPPORT"], creates: "SUPPLIED" },
    ],
    purpose: "Provides armored firepower, holds objectives, and screens nearby formations.",
    creates: "SCREENED",
    uses: ["DISPLACED", "OVERHEATED", "BREACHED", "SUPPLIED", "OPEN CORE", "FRACTURED ARMOR"],
    asset: "/assets/railjack.png",
    icon: Shield,
    defaultNode: "anchorLine",
  },
  {
    id: "hauler",
    number: "5",
    name: "ARMOURED RECOVERY VEHICLE",
    role: "EXTRACT",
    movementProfile: "support-tracked",
    endurance: { armor: 3, cohesion: 4, mobility: 4 },
    capabilities: ["RECOVERY", "SUPPORT"],
    refits: [
      { id: "crane", name: "RECOVERY CRANE", summary: "Sustainment rig for damaged formations and crew.", capabilities: ["RECOVERY", "SUPPORT"], creates: "SUPPLIED" },
      { id: "shield", name: "EVAC SHIELD", summary: "Trades repair throughput for protected movement.", capabilities: ["RECOVERY", "COVER"], creates: "SCREENED" },
    ],
    purpose: "Recovers personnel and keeps damaged vehicles moving toward extraction.",
    creates: "SUPPLIED",
    uses: ["OVERHEATED", "BREACHED", "SCREENED", "OPEN CORE", "SECURED BREACH", "SECURED CORRIDOR"],
    asset: "/assets/salvage-hauler.png",
    icon: Truck,
    defaultNode: "recoveryLine",
  },
];

export const TACTICAL_TERM_LABELS = Object.freeze({
  DISPLACE: "FORCE MOVE",
  DISPLACED: "OUT OF POSITION",
});

export const tacticalTerm = (value) => TACTICAL_TERM_LABELS[value] ?? value;
export const tacticalText = (value) => typeof value === "string"
  ? value.replace(/\bDISPLACED\b/g, TACTICAL_TERM_LABELS.DISPLACED).replace(/\bDISPLACE\b/g, TACTICAL_TERM_LABELS.DISPLACE)
  : value;

export const defaultRefits = () => Object.fromEntries(
  FORMATIONS.map((formation) => [formation.id, formation.refits[0].id]),
);

export const resolveFormations = (selections) => FORMATIONS.map((formation) => {
  const activeRefit = formation.refits.find((refit) => refit.id === selections[formation.id]) ?? formation.refits[0];
  return {
    ...formation,
    capabilities: activeRefit.capabilities,
    creates: activeRefit.creates,
    activeRefit,
  };
});

export const NODES = {
  alphaApproach: { left: 20, top: 63, label: "Alpha approach" },
  fireLine: { left: 31, top: 72, label: "Thermal firing line" },
  breachLine: { left: 44, top: 66, label: "Breach route" },
  anchorLine: { left: 36, top: 82, label: "Anchor line" },
  recoveryLine: { left: 53, top: 80, label: "Recovery route" },
  highWalk: { left: 47, top: 34, label: "Elevated transit" },
  betaLane: { left: 66, top: 28, label: "Beta transit lane" },
  rescuePen: { left: 69, top: 72, label: "Salvage enclosure" },
};

export const STAGING_NODES = {
  harpoon: { left: 32, top: 10.5, label: "Formation staging" },
  furnace: { left: 43, top: 10.5, label: "Formation staging" },
  breaker: { left: 54, top: 10.5, label: "Formation staging" },
  railjack: { left: 65, top: 10.5, label: "Formation staging" },
  hauler: { left: 76, top: 10.5, label: "Formation staging" },
};
