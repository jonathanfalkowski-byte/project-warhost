// WHAT A FORMATION LOOKS LIKE ON THE BOARD, at the size a marker actually is.
//
// Every formation already carries an `asset` in formationData.js — an isometric render, and
// a good one. None of them is a marker. The vehicle is one element in a lit scene with crew
// and barricades, so there is no silhouette to read at thirty pixels; each file is around
// three megabytes; and they are gunmetal on near-black, against a near-black battlefield.
// Worse, nine formations share five images: harpoon-rig.png is the art for both the RECON
// TANK and the SCOUT SKIMMER, and it depicts a tracked salvage crane, which is neither. Four
// pairs would have been indistinguishable on the board. A marker that cannot be told apart
// from another marker is not a marker.
//
// So the board gets silhouettes and the renders keep the places where there is room for
// them. Side profile rather than top-down, because a top-down tank and a top-down recovery
// vehicle are the same oblong; a 32x24 box, because that is the space beside a name.
//
// THE PROPERTY THAT MATTERS IS THAT THEY DIFFER. That is what the art failed at, so it is a
// test rather than an intention: no two formations may share a glyph.
export const GLYPH_BOX = Object.freeze({ width: 32, height: 24 });

export const FORMATION_GLYPHS = Object.freeze({
  // Light hull, long mast. Fast, sees a long way, folds if it is caught.
  harpoon: Object.freeze([
    "M6 12h16l3 3H6z", "M10 9h7v3h-7z", "M4 15h24v3H4z", "M21 4h1.6v6H21z", "M22 10h8v1.6h-8z",
  ]),
  // A wedge riding its own skirt. The only hull on the board with no tracks under it.
  skimmer: Object.freeze([
    "M3 13 24 7l5 4-4 4H5z", "M6 18h18v1.6H6z", "M9 20.6h12V22H9z",
  ]),
  // Drum and a wide nozzle: everything about it is short-ranged and unpleasant.
  furnace: Object.freeze([
    "M5 12h15l2 3H4z", "M8 7h8v5H8z", "M20 9h6v3h-6z", "M26 8.2c3 1 3 3.6 0 4.6z", "M3 15h21v3H3z",
  ]),
  // The barrel is the silhouette. Outriggers say it has to stop to use it.
  carriage: Object.freeze([
    "M5 14h16l2 3H3z", "M12 12.5 30 4l1 2.2-18 8.5z", "M9 10h7v4H9z", "M4 17l-2 4h5z", "M20 17l2 4h-5z",
  ]),
  // Legs, and something on the front to hit you with.
  breaker: Object.freeze([
    "M10 5h12v7H10z", "M11 12 6 21h3l4-7z", "M21 12l5 9h-3l-4-7z", "M22 7h7v2h-7z", "M28 5l3 3-3 3z",
  ]),
  // The same legs carrying a slab. Read it as the walker that stands still.
  bastion: Object.freeze([
    "M8 5h11v7H8z", "M9 12 4 21h3l4-7z", "M18 12l5 9h-3l-4-7z", "M23 3h4v18h-4z", "M27 5l3 7-3 7z",
  ]),
  // Heaviest hull, longest gun, lowest to the ground.
  railjack: Object.freeze([
    "M4 11h20l3 4H4z", "M9 6h11v5H9z", "M19 7.5h11v2H19z", "M2 15h27v4H2z",
  ]),
  // A dish where the turret would be. It is an economy, not a weapon.
  command: Object.freeze([
    "M7 13h16l2 3H5z", "M10 9h9v4h-9z", "M21 3.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z",
    "M20.4 1.8h1.2v2h-1.2z", "M4 16h24v3H4z",
  ]),
  // The crane is the whole point of it, and the only hook on the board.
  hauler: Object.freeze([
    "M4 13h16l2 3H3z", "M7 9h9v4H7z", "M16 11 29 5l1 2-13 6z", "M26.8 7.4h1.6v4.2h-1.6z",
    "M26.4 11.2h4v1.4h-4z", "M2 16h22v3H2z",
  ]),
});

// A hull with no glyph is drawn as a plain hull rather than as nothing, because a marker
// that vanishes is worse than a marker that is vague. Nothing reaches this today — the test
// asserts every formation is covered — and it exists so a hull added tomorrow still appears.
export const FALLBACK_GLYPH = Object.freeze(["M5 12h18l3 3H4z", "M9 8h10v4H9z", "M3 15h25v3H3z"]);

export const glyphFor = (formationId) => FORMATION_GLYPHS[formationId] ?? FALLBACK_GLYPH;
