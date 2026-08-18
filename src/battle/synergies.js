// Synergies: what the rules never told you.
//
// Everything this game has called a "combo" so far is STATED ON THE CARD THAT GRANTS IT.
// SHIELD soaks, COMMAND improves what is near it, REPAIR patches, and every refit says in
// its own text which of those it hands over. That is legibility, which this project has
// spent most of its life earning — and it means nothing is ever DISCOVERED. A player who
// reads the cards knows the whole game before the first battle.
//
// A synergy is the other half. It is a named pairing that fires when two formations with
// the right pair of keywords stand CLOSE TOGETHER, it is written on nothing, and the first
// time it happens the game says its name out loud and the run writes it down. From then on
// it is knowledge the player carries into the next deployment. That is the loop the
// Bazaar-shaped brief asked for: buy, stand things next to each other, find out.
//
// Three rules keep this from being noise:
//
//   1. It is keyed on KEYWORDS, never on formation ids. Nine formations would be thirty-six
//      authored pairings that a wiki flattens in an afternoon. Keywords mean the REFIT
//      MARKET is the discovery engine — a FLAME SUPPORT VEHICLE that bought an ASH CRUCIBLE
//      has SHIELD now, and can anchor on a heavy hull it could never anchor on before.
//   2. Both armies get them. This is a rule of the board, not a player power, and the enemy
//      is drawn from the same roster.
//   3. Nothing here is random. A synergy is a function of position, so the sweep still
//      resolves the space exhaustively.

// What standing that close COSTS, and it is charged PER NEIGHBOUR rather than as a flat
// toll on being paired.
//
// A flat toll got the sign right and the shape wrong: it taxed a deliberate two-hull
// pairing exactly as hard as a five-hull knot, so the layer made lists worse off about
// twice as often as better and the lesson a player would learn from it is "do not stand
// together" — which is the opposite of the point. Per-neighbour, a clean pair pays almost
// nothing and a mass pays a lot, which is also the honest reading of the fiction: a knot of
// vehicles is a target.
//
// It applies to ANY formation standing shoulder to shoulder, paired or not. Otherwise a
// massed list that happens to form no pairing pays nothing for massing, and the tax reads
// as a punishment for synergy rather than a rule of the board.
export const PACKED_DAMAGE_STEP = 0.06;

// Tighter than SHIELD (14) and much tighter than COMMAND (24), because the whole idea is
// standing TOGETHER — close enough that it is a deployment decision rather than a
// side effect of both being on the same board.
export const SYNERGY_RANGE = 10;

// Each pairing names two keywords and what standing together does. THE FORMATION WITH THE
// FIRST KEYWORD CARRIES THE EFFECT and the second one enables it — so a pairing of a
// keyword with itself, like WOLF PAIR, hands it to both of them for free. Effects are the
// same blunt handful the stratagems use, because a bonus the player cannot predict the
// consequence of is noise.
export const SYNERGIES = {
  "locked-shields": {
    id: "locked-shields", name: "LOCKED SHIELDS", pair: ["SHIELD", "HEAVY"],
    reveal: "The screen anchors on the heavy hull and stops giving ground.",
    effect: { soak: 0.42 },
  },
  "ranging-pair": {
    id: "ranging-pair", name: "RANGING PAIR", pair: ["ARTILLERY", "SCOUT"],
    reveal: "Someone forward is calling the fall of shot.",
    effect: { damageScale: 1.35 },
  },
  "burn-and-break": {
    id: "burn-and-break", name: "BURN AND BREAK", pair: ["ASSAULT", "AREA"],
    reveal: "Nothing that backs off the walker gets out of the burn.",
    effect: { meleeScale: 1.4 },
  },
  "dug-in": {
    id: "dug-in", name: "DUG IN", pair: ["OBJECTIVE", "SUPPORT"],
    reveal: "Kept fed and kept standing, it holds far more ground than it should.",
    effect: { controlScale: 1.5 },
  },
  "wolf-pair": {
    id: "wolf-pair", name: "WOLF PAIR", pair: ["FAST", "FAST"],
    reveal: "Two fast hulls hunting as one, and neither of them alone.",
    effect: { damageScale: 1.25 },
  },
  "field-hospital": {
    id: "field-hospital", name: "FIELD HOSPITAL", pair: ["REPAIR", "COMMAND"],
    reveal: "Coordinated recovery: the patch goes where it is needed and goes further.",
    effect: { repairBonus: 1 },
  },
};

export const synergyFor = (id) => SYNERGIES[id] ?? null;
export const synergyList = () => Object.values(SYNERGIES);
export const SYNERGY_COUNT = Object.keys(SYNERGIES).length;

const has = (unit, keyword) => Boolean(unit?.keywords?.includes(keyword));
const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= SYNERGY_RANGE;

// Which pairings a formation is currently part of. A wreck neither grants nor receives —
// the pairing is two hulls standing together, and one of them is not standing.
export const synergiesFor = (unit, friends = []) => {
  if (!unit || unit.wounds <= 0) return [];
  const standing = friends.filter((friend) => friend.id !== unit.id && friend.wounds > 0 && near(unit, friend));
  const active = [];
  for (const synergy of Object.values(SYNERGIES)) {
    const [first, second] = synergy.pair;
    if (has(unit, first) && standing.some((friend) => has(friend, second))) active.push(synergy.id);
  }
  return active;
};

// Everything currently firing, as pairs, for the drawing and the debrief. Each entry names
// the formation carrying the effect and the one enabling it, so a link can be drawn between
// exactly those two hulls rather than between everything in the neighbourhood.
export const activeSynergies = (units = []) => {
  const found = [];
  for (const unit of units) {
    if (unit.wounds <= 0) continue;
    for (const synergy of Object.values(SYNERGIES)) {
      const [first, second] = synergy.pair;
      if (!has(unit, first)) continue;
      for (const friend of units) {
        if (friend.id === unit.id || friend.wounds <= 0 || !has(friend, second) || !near(unit, friend)) continue;
        // A same-keyword pairing would otherwise be reported twice, once from each end.
        if (first === second && found.some((entry) => entry.id === synergy.id
          && entry.holder === friend.name && entry.partner === unit.name)) continue;
        found.push({ id: synergy.id, name: synergy.name, holder: unit.name, partner: friend.name, reveal: synergy.reveal });
        break;
      }
    }
  }
  return found;
};

// The numbers, gathered. Multiplied rather than added so two pairings on one hull compound
// the way two stratagems do, and so a formation in none of them comes back untouched.
const NONE = Object.freeze({ damageScale: 1, meleeScale: 1, controlScale: 1, soak: 0, repairBonus: 0 });

// The packing cost. Read separately from the bonuses because it lands on everyone standing
// close, including formations in no pairing at all.
export const packedScaleFor = (unit, friends = []) => {
  if (!unit || unit.wounds <= 0) return 1;
  const crowd = friends.filter((friend) => friend.id !== unit.id && friend.wounds > 0 && near(unit, friend)).length;
  return 1 + PACKED_DAMAGE_STEP * crowd;
};

export const synergyBonusFor = (unit, friends = []) => {
  const active = synergiesFor(unit, friends);
  if (active.length === 0) return NONE;
  return active.reduce((acc, id) => {
    const effect = SYNERGIES[id].effect;
    return {
      damageScale: acc.damageScale * (effect.damageScale ?? 1),
      meleeScale: acc.meleeScale * (effect.meleeScale ?? 1),
      controlScale: acc.controlScale * (effect.controlScale ?? 1),
      soak: Math.max(acc.soak, effect.soak ?? 0),
      repairBonus: acc.repairBonus + (effect.repairBonus ?? 0),
    };
  }, NONE);
};
