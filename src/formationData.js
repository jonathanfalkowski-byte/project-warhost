// The shared roster. Both resolution models were built on these nine formations, and the
// battle model still is — src/battle/battleProfiles.js gives each one wargame stats
// authored from the identity described here rather than derived by formula.
//
// The icons and the `defaultNode` field went with the operation screen: nothing renders an
// icon any more, and importing the icon set for data nobody draws was most of the bundle.
// The refits and capabilities are kept — weapon options are a very 40k shape and the
// battle model has not used them yet.

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
  },
  {
    id: "skimmer",
    number: "6",
    name: "SCOUT SKIMMER",
    role: "DISPLACE",
    movementProfile: "light-hover",
    endurance: { armor: 2, cohesion: 3, mobility: 5 },
    capabilities: ["MOBILITY", "SHOCK"],
    refits: [
      { id: "lance", name: "SHOCK LANCE", summary: "Fast strike package for hitting a lane before it closes.", capabilities: ["MOBILITY", "SHOCK"], creates: "DISPLACED" },
      { id: "netgun", name: "SNARE PROJECTOR", summary: "Trades strike power for holding a lane shut.", capabilities: ["MOBILITY", "DENIAL"], creates: "SEALED LANE" },
    ],
    purpose: "Outruns the enemy timetable and hits an exposed lane before it can be reinforced.",
    creates: "DISPLACED",
    uses: ["SCREENED", "SUPPLIED", "OPEN CORE"],
    // Placeholder art: reuses the recon portrait until a skimmer asset exists.
    asset: "/assets/harpoon-rig.png",
  },
  {
    id: "carriage",
    number: "7",
    name: "SIEGE GUN CARRIAGE",
    role: "DENY",
    movementProfile: "heavy-tracked",
    endurance: { armor: 4, cohesion: 4, mobility: 2 },
    capabilities: ["AREA", "HOLD"],
    refits: [
      { id: "barrage", name: "SATURATION BARRAGE", summary: "Blankets an approach and holds the ground behind it.", capabilities: ["AREA", "HOLD"], creates: "KILL ZONE" },
      { id: "spotter", name: "SPOTTER MAST", summary: "Trades weight of fire for directing the advance.", capabilities: ["AREA", "CONTROL"], creates: "DISPLACED" },
    ],
    purpose: "Saturates an approach lane and holds the ground it has just swept.",
    creates: "KILL ZONE",
    uses: ["DISPLACED", "SCREENED", "BREACHED", "FORWARD HOLD"],
    // Placeholder art: reuses the flame support portrait until a carriage asset exists.
    asset: "/assets/furnace-crew.png",
  },
  {
    id: "command",
    number: "8",
    name: "COMMAND VEHICLE",
    role: "HOLD",
    movementProfile: "tracked",
    endurance: { armor: 3, cohesion: 5, mobility: 3 },
    capabilities: ["CONTROL", "SUPPORT"],
    refits: [
      { id: "relay", name: "FIELD RELAY", summary: "Keeps the advance coordinated and resupplied.", capabilities: ["CONTROL", "SUPPORT"], creates: "SUPPLIED" },
      { id: "bastion", name: "BASTION UPLINK", summary: "Trades resupply for holding a seized objective.", capabilities: ["CONTROL", "HOLD"], creates: "FORWARD HOLD" },
    ],
    purpose: "Coordinates the advance from the objective it has taken, keeping the column supplied.",
    creates: "SUPPLIED",
    uses: ["DISPLACED", "OVERHEATED", "BREACHED", "SECURED BREACH"],
    // Placeholder art: reuses the battle tank portrait until a command asset exists.
    asset: "/assets/railjack.png",
  },
  {
    id: "bastion",
    number: "9",
    name: "SHIELD WALKER",
    role: "BREACH",
    movementProfile: "walker",
    endurance: { armor: 5, cohesion: 4, mobility: 3 },
    capabilities: ["COVER", "DENIAL"],
    refits: [
      { id: "wall", name: "SHIELD WALL", summary: "Screens the lane it is standing in.", capabilities: ["COVER", "DENIAL"], creates: "SCREENED" },
      { id: "breachram", name: "BREACH RAM", summary: "Trades the screen for opening a sealed approach.", capabilities: ["COVER", "BREACH"], creates: "BREACHED" },
    ],
    purpose: "Walks into the open lane and screens it while the rest of the army moves through.",
    creates: "SCREENED",
    uses: ["DISPLACED", "OVERHEATED", "KILL ZONE", "SUPPLIED"],
    // Placeholder art: reuses the assault walker portrait until a shield walker asset exists.
    asset: "/assets/breaker-exo.png",
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

// One staging position per formation in the roster. The roster is larger than the
// number of action stops, so several of these hold formations left in reserve.
//
// The row used to sit at 10.5%, directly on top of the battle-sequence band, so hovering
// a reserve formation put its marker over the mission chrome the player was reading. It
// now sits in the gap between that band and the first objective markers.
const STAGING_TOP = 20.5;
export const STAGING_NODES = {
  harpoon: { left: 23, top: STAGING_TOP, label: "Formation staging" },
  furnace: { left: 27.5, top: STAGING_TOP, label: "Formation staging" },
  breaker: { left: 32, top: STAGING_TOP, label: "Formation staging" },
  railjack: { left: 36.5, top: STAGING_TOP, label: "Formation staging" },
  hauler: { left: 41, top: STAGING_TOP, label: "Formation staging" },
  skimmer: { left: 45.5, top: STAGING_TOP, label: "Formation staging" },
  carriage: { left: 50, top: STAGING_TOP, label: "Formation staging" },
  command: { left: 54.5, top: STAGING_TOP, label: "Formation staging" },
  bastion: { left: 59, top: STAGING_TOP, label: "Formation staging" },
};

// Any formation added without a staging position still renders rather than crashing.
export const stagingNodeFor = (formationId) => STAGING_NODES[formationId]
  ?? { left: 41, top: STAGING_TOP, label: "Formation staging" };
