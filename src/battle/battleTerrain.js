// Named ground, per board.
//
// Authored plans need somewhere to point at. The operation model had exactly this — a
// dictionary of landmarks that routes were written against by name, so a plan reads as
// "west gate, west approach, the works" rather than as a list of coordinates nobody can
// check.
//
// The names are ROLES, not places: every board has a home objective, a west objective, a
// centre, an east objective and one deep in the enemy half, plus the lanes that reach
// them. That is what lets one authored plan be played on more than one board — TRAPLINE
// means the same thing on both, and the mission supplies the ground it means it on. It is
// also the only real test of whether the nine plans are doctrine or were overfitted to the
// first board they were written for.
//
// Every table is mirrored about y = 50, so a plan written for the player has a mirror that
// works for the enemy and no lane quietly favours one edge.

// BREAK THE CIRCUIT — a wide cross. Long lanes, a two-point centre, and enough distance
// that a flank route genuinely costs you the fight in the middle.
export const CIRCUIT_LANDMARKS = {
  homeWest: { x: 18, y: 88 }, homeCentre: { x: 50, y: 88 }, homeEast: { x: 82, y: 88 },
  southRelay: { x: 50, y: 82 },
  southWest: { x: 32, y: 78 }, southEast: { x: 68, y: 78 },

  westGate: { x: 16, y: 70 }, eastGate: { x: 84, y: 70 },
  westApproach: { x: 20, y: 60 }, eastApproach: { x: 80, y: 60 },
  westWorks: { x: 22, y: 50 }, eastGantry: { x: 78, y: 50 },
  westNorth: { x: 24, y: 34 }, eastNorth: { x: 76, y: 34 },

  centreSouth: { x: 50, y: 66 },
  reactor: { x: 50, y: 50 },
  centreNorth: { x: 50, y: 34 },

  northWest: { x: 34, y: 22 }, northEast: { x: 66, y: 22 },
  northRelay: { x: 50, y: 18 },
};

// THE NARROWS — the same roles, squeezed. Every objective sits within a third of the board
// of the centre line, so the armies are in contact almost at once and there is nowhere to
// hide. A plan that only works because it had four rounds of walking to set up will not
// work here, which is the point of having a second board at all.
export const NARROWS_LANDMARKS = {
  homeWest: { x: 20, y: 90 }, homeCentre: { x: 50, y: 90 }, homeEast: { x: 80, y: 90 },
  southRelay: { x: 50, y: 68 },
  southWest: { x: 36, y: 76 }, southEast: { x: 64, y: 76 },

  westGate: { x: 22, y: 80 }, eastGate: { x: 78, y: 80 },
  westApproach: { x: 26, y: 62 }, eastApproach: { x: 74, y: 62 },
  westWorks: { x: 30, y: 50 }, eastGantry: { x: 70, y: 50 },
  westNorth: { x: 26, y: 38 }, eastNorth: { x: 74, y: 38 },

  centreSouth: { x: 50, y: 60 },
  reactor: { x: 50, y: 50 },
  centreNorth: { x: 50, y: 40 },

  northWest: { x: 36, y: 24 }, northEast: { x: 64, y: 24 },
  northRelay: { x: 50, y: 32 },
};

export const LANDMARK_TABLES = {
  "circuit-clash": CIRCUIT_LANDMARKS,
  narrows: NARROWS_LANDMARKS,
};

export const landmarksFor = (missionId) => LANDMARK_TABLES[missionId] ?? CIRCUIT_LANDMARKS;
export const landmark = (name, missionId) => landmarksFor(missionId)[name] ?? null;

// A route is a list of landmark names. Resolving it here rather than storing coordinates
// means a plan is checkable by reading it, and a typo is a missing point rather than a
// formation quietly walking to (0, 0).
//
// MIRRORED resolves the same route from the other edge, by reflecting every point about
// y = 50. The landmark names are written from the southern edge — "home", "south relay",
// "the north relay deep in their half" — so there is no northern name for most of them and
// a name-level mirror would need a second, hand-kept table that could silently drift out
// of step with this one. Reflecting the coordinates cannot drift: TRAPLINE walked from the
// north edge is exactly TRAPLINE, and no lane can quietly favour one side.
export const mirrorPoint = (point) => ({ ...point, y: 100 - point.y });

export const resolveRoute = (names = [], missionId, { mirrored = false } = {}) => names
  .map((name) => landmark(name, missionId))
  .filter(Boolean)
  .map((point) => (mirrored ? mirrorPoint(point) : { ...point }));

// TERRAIN.
//
// The board was a flat plain with markers painted on it: every lane cost the same, every
// gun could see the whole table, and the only thing distinguishing one route from another
// was its length. That made a plan a distance calculation. Terrain is what turns it into a
// choice — the short road is the slow one, the safe lane is the long one, and there is
// ground you cannot be shot on and ground you cannot shoot from.
//
// Three kinds, each doing exactly ONE blunt thing, for the same reason the stratagems are
// few and blunt: terrain you cannot predict the consequence of is noise on the board rather
// than a decision about it.
//
//   BROKEN GROUND  crossing it halves the advance
//   COVER          fire coming into it is cut
//   BLOCKING       nothing shoots through it, either way
//
// Melee is untouched. Two formations in contact are in contact, and a rule that let a wall
// stop a fight already happening would be a rule about the wall rather than the fight.
export const TERRAIN_KINDS = Object.freeze({
  broken: {
    id: "broken", name: "BROKEN GROUND", moveScale: 0.5,
    text: "Crossing it halves the advance.",
  },
  cover: {
    id: "cover", name: "COVER", damageScale: 0.6,
    text: "Fire coming into it is cut by two fifths.",
  },
  blocking: {
    id: "blocking", name: "BLOCKING", blocksSight: true,
    text: "Nothing shoots through it, in either direction.",
  },
});

export const terrainKind = (id) => TERRAIN_KINDS[id] ?? null;

// Authored in the SOUTHERN half and reflected, so the board is fair by construction rather
// than by inspection. A feature sitting on the centre line is its own mirror and is placed
// once — which is what the `y === 50` case below is, not an edge case anyone has to
// remember.
const feature = (kind, name, x, y, radius) => ({ kind, name, x, y, radius });

const CIRCUIT_TERRAIN = [
  // BROKEN GROUND ON THE FLANK LANES, not across the centre. Across the centre it slowed
  // every advance and left the one disposition that does not advance untouched: SAFEGUARD
  // came out at 70% against ERADICATION's 15%, because rubble in front of both armies is a
  // rule that only charges the one that moves. On the flanks it is the price of the wide
  // road, and the wide road is the one that ends in cover.
  feature("broken", "WEST SLAG", 30, 70, 7),
  feature("broken", "EAST SLAG", 70, 70, 7),
  // COVER SITS ON THE CONTESTED MARKERS, not on either army's own approaches. In each
  // half it was cover a defender sat in and an attacker walked out of, which is a purely
  // defensive rule however symmetrically it is placed: SAFEGUARD went to 70% against
  // ERADICATION's 15%. On the flank markers it rewards taking and holding ground instead —
  // and SAFEGUARD scores nothing on the centre line, so it is the one disposition the
  // screens do not pay.
  feature("cover", "THE WORKS", 22, 50, 6),
  // The Spine is screened too, or the two-point marker is the only ground on the board you
  // cannot hold — the flanks pay you less and protect you more, and every plan that wants
  // the middle dies. SPEAR fell under 2% on this board without it.
  feature("cover", "SPINE WRACK", 50, 50, 6),
  feature("cover", "THE GANTRY", 78, 50, 6),
  // Stacks in each half rather than on the centre line. On the line they sat squarely
  // between the Reactor and each flank marker, so whatever held a flank could not be shot
  // from the middle at all: SAFEGUARD's home line went to 94% and the three dispositions
  // came out 67 points apart. Off the line they break the long diagonals — the shot from
  // one army's deployment into the other army's flank — and leave the board's own lanes
  // alone.
  feature("blocking", "WEST STACK", 34, 62, 5),
  feature("blocking", "EAST STACK", 66, 62, 5),
];

// THE NARROWS is already tight, so its terrain is about denying the one thing that board
// gives away for free: everything can see everything from the moment it deploys.
const NARROWS_TERRAIN = [
  feature("broken", "THE SILT", 50, 60, 5),
  feature("cover", "WEST HULKS", 30, 50, 5),
  feature("cover", "SPAN WRACK", 50, 50, 5),
  feature("cover", "EAST HULKS", 70, 50, 5),
  feature("blocking", "THE BREAKWATER", 40, 60, 4),
  feature("blocking", "THE LEE", 60, 60, 4),
];

const mirrored = (authored) => authored.flatMap((entry) => (entry.y === 50
  ? [{ ...entry, id: `${entry.kind}-${entry.x}-50` }]
  : [
    { ...entry, id: `${entry.kind}-${entry.x}-${entry.y}` },
    { ...entry, ...mirrorPoint(entry), id: `${entry.kind}-${entry.x}-${100 - entry.y}` },
  ]));

export const TERRAIN_TABLES = {
  "circuit-clash": mirrored(CIRCUIT_TERRAIN),
  narrows: mirrored(NARROWS_TERRAIN),
};

// No mission, no terrain. Deliberately NOT defaulting to a board: a caller that forgets to
// say which ground it is fighting over should get a flat plain, which is obvious the first
// time anyone looks, rather than the Circuit's slag heaps quietly turning up on the Narrows.
export const terrainFor = (missionId) => TERRAIN_TABLES[missionId] ?? [];

const inside = (point, entry) => Math.hypot(point.x - entry.x, point.y - entry.y) <= entry.radius;

// What a formation is standing in. A formation can be in more than one thing at once, which
// is why every reader below folds rather than picking the first hit.
export const terrainAt = (point, missionId) => (point
  ? terrainFor(missionId).filter((entry) => inside(point, entry))
  : []);

// Does the straight line from a to b pass through this feature? Closest approach of the
// segment to the centre, which is the whole of the geometry and needs no library.
const crosses = (from, to, entry) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = (dx * dx) + (dy * dy);
  if (span === 0) return inside(from, entry);
  const along = Math.max(0, Math.min(1, (((entry.x - from.x) * dx) + ((entry.y - from.y) * dy)) / span));
  const nearest = { x: from.x + (along * dx), y: from.y + (along * dy) };
  return inside(nearest, entry);
};

export const crossesTerrain = (from, to, missionId, kind) => terrainFor(missionId)
  .some((entry) => entry.kind === kind && crosses(from, to, entry));

// The advance. Halved for CROSSING broken ground rather than for standing in it: a rule
// that only charged for standing in it would be free to a formation fast enough to hop the
// whole field in one move, which is exactly the formation that should be paying.
export const moveScaleBetween = (from, to, missionId) => (
  crossesTerrain(from, to, missionId, "broken") ? TERRAIN_KINDS.broken.moveScale : 1
);

// Fire into cover is cut. Read off where the TARGET is standing, not the shooter.
export const coverScaleAt = (point, missionId) => (terrainAt(point, missionId)
  .some((entry) => entry.kind === "cover") ? TERRAIN_KINDS.cover.damageScale : 1);

// And nothing shoots through a stack. Symmetrical, so a formation that cannot be shot
// cannot shoot back either — cover you can fire out of is a firing position, not cover.
export const sightBlocked = (from, to, missionId) => crossesTerrain(from, to, missionId, "blocking");

// What a route actually costs to walk, in movement rather than in distance. A plan that
// crosses the slag is longer than it looks, and this is the number every reader of a route
// should be using: the reachability guard on the plans, and the enemy's list builder when
// it works out how fast a hull has to be to fill a slot.
export const routeCost = (start, points = [], missionId) => points.reduce((sum, point, step) => {
  const previous = step === 0 ? start : points[step - 1];
  const span = Math.hypot(point.x - previous.x, point.y - previous.y);
  return sum + (span / moveScaleBetween(previous, point, missionId));
}, 0);
