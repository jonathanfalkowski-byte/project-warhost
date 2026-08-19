// Battle profiles: the same nine formations, given stats for a stand-up fight.
//
// The existing game resolves an operation as a timeline of capability matches. This model
// resolves a battle the way a tabletop game does: two armies deploy facing each other,
// move, shoot, fight, and score objectives each round. So every formation needs the four
// numbers a wargame unit actually needs — how far it moves, how far it shoots, how hard
// it hits, and how much it can take.
//
// These are authored from each formation's existing identity rather than derived by
// formula, because a formula would make the SHIELD WALKER and the SIEGE GUN CARRIAGE
// interchangeable once you strip the labels. `endurance.armor` seeds WOUNDS,
// `endurance.mobility` seeds MOVE, and capabilities decide the shape of the gun.

// Board is 100x100 to match the existing field coordinate space.
export const MELEE_RANGE = 6;
// The share of a hit a SHIELD formation takes off anything it is screening. Named here
// rather than sitting as a literal in the damage code, because the pairing that raises it
// has to be able to say what it raises it FROM without keeping a second copy of the number.
export const SHIELD_SOAK = 0.28;
export const OBJECTIVE_CONTROL_RANGE = 12;

export const BATTLE_PROFILES = {
  // Fast, fragile, and built to grab ground rather than hold it.
  harpoon: {
    move: 18, range: 28, shots: 2, hit: 3, wounds: 6, save: 2, melee: 2,
    control: 2, keywords: ["FAST", "OBJECTIVE"],
    note: "Outruns the line to contest early, but folds if it is caught.",
  },
  // Short-ranged area denial: brutal up close, useless across the board.
  furnace: {
    move: 12, range: 14, shots: 4, hit: 3, wounds: 7, save: 2, melee: 3,
    control: 2, keywords: ["AREA"],
    note: "Burns anything that closes, and cannot reach anything that does not.",
  },
  // The hammer. Slow, no gun worth the name, devastating in contact.
  breaker: {
    move: 10, range: 10, shots: 1, hit: 4, wounds: 10, save: 4, melee: 8,
    control: 2, keywords: ["ASSAULT"],
    note: "Wants to be in melee by round two and is close to worthless before it is.",
  },
  // The anvil. Hard to shift, holds what it stands on.
  railjack: {
    move: 8, range: 30, shots: 3, hit: 3, wounds: 12, save: 4, melee: 3,
    control: 4, keywords: ["HEAVY", "OBJECTIVE"],
    note: "Slow to arrive, extremely hard to remove once it has.",
  },
  // Keeps others alive; contributes little damage of its own.
  hauler: {
    move: 14, range: 16, shots: 1, hit: 4, wounds: 8, save: 3, melee: 2,
    control: 3, keywords: ["SUPPORT", "REPAIR"],
    note: "Repairs one damaged formation each round instead of shooting hard.",
  },
  // The fastest thing on the board, and the flimsiest.
  skimmer: {
    move: 22, range: 18, shots: 2, hit: 3, wounds: 5, save: 2, melee: 3,
    control: 2, keywords: ["FAST", "SCOUT"],
    note: "Reaches a far objective on round one; dies to a stiff breeze.",
  },
  // Artillery. Longest reach on the board, cannot defend itself.
  carriage: {
    move: 6, range: 46, shots: 3, hit: 3, wounds: 9, save: 3, melee: 1,
    control: 3, keywords: ["HEAVY", "ARTILLERY"],
    note: "Hits anything on the board from where it deployed. Do not let it get charged.",
  },
  // Force multiplier: makes the units around it hit harder.
  command: {
    move: 12, range: 24, shots: 2, hit: 3, wounds: 9, save: 3, melee: 2,
    control: 4, keywords: ["COMMAND", "OBJECTIVE"],
    note: "Every friendly formation within range hits harder. Kill it first.",
  },
  // A wall. Almost no offence, protects everything behind it.
  bastion: {
    move: 10, range: 12, shots: 1, hit: 4, wounds: 14, save: 5, melee: 4,
    control: 3, keywords: ["SHIELD"],
    note: "Absorbs fire aimed at nearby formations. Wins ground by refusing to lose it.",
  },
};

export const battleProfileFor = (formationId) => BATTLE_PROFILES[formationId] ?? {
  move: 10, range: 18, shots: 2, hit: 4, wounds: 8, save: 3, melee: 2, control: 2, keywords: [], note: "",
};

// THE STAT LINE, written once. It is shown in three places — the deploy list, the shelf,
// and the card under a marker on the board — and three copies of the same template is how
// the shelf ends up advertising a profile the board does not have.
export const statLineFor = (profile) => [
  `MOVE ${profile.move}`,
  `RANGE ${profile.range}`,
  `${profile.shots} SHOT${profile.shots === 1 ? "" : "S"}`,
  `${profile.wounds} WOUNDS`,
  `CONTROL ${profile.control}`,
].join(" \u00b7 ");
