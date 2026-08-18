// Stratagems: what a Command Point buys, and when.
//
// This replaces the Command Seal, which fired at an authored breakpoint on a timeline and
// changed a branch choice made before the battle — "the command seals come in a weird
// time too, i have no idea what they are doing or helping with". A stratagem is spent at a
// named point in the round sequence and does one legible thing to the board.
//
// It is also where the battle's uncertainty comes from. The player picks their own
// stratagems, so those are not a surprise; the enemy holds a HIDDEN HAND drawn from a pool
// the player can see. You know what the Helioch Oath might do and never what it will —
// which is tension you can plan against, unlike a bad roll. A hand drawn from a finite
// pool is still enumerable, so the balance sweep keeps working.

// The four moments in a round a stratagem can fire, in the order they occur.
export const TRIGGERS = Object.freeze({
  beforeMove: "BEFORE MOVE",
  beforeShoot: "BEFORE SHOOTING",
  beforeFight: "BEFORE THE FIGHT",
  beforeScore: "BEFORE SCORING",
});

// Effects are deliberately few and blunt. A stratagem the player cannot predict the
// consequence of is noise, not a decision.
export const STRATAGEMS = {
  overwatch: {
    id: "overwatch", name: "OVERWATCH", cost: 1, trigger: "beforeMove",
    text: "Your formations fire before either army advances.",
    effect: { extraShootingPhase: true },
  },
  brace: {
    id: "brace", name: "BRACE", cost: 1, trigger: "beforeShoot",
    text: "Incoming fire against your army is halved this round.",
    effect: { incomingDamageScale: 0.5 },
  },
  surge: {
    id: "surge", name: "SURGE FORWARD", cost: 1, trigger: "beforeMove",
    text: "Every formation moves a second time this round. The opening advance already counts as one.",
    effect: { extraMove: true },
  },
  "focus-fire": {
    id: "focus-fire", name: "FOCUS FIRE", cost: 2, trigger: "beforeShoot",
    text: "Your whole army fires at the single most dangerous target.",
    effect: { focusFire: true },
  },
  "hold-fast": {
    id: "hold-fast", name: "HOLD FAST", cost: 1, trigger: "beforeScore",
    text: "Your formations count double for holding objectives this round.",
    effect: { controlScale: 2 },
  },
  "execution-order": {
    id: "execution-order", name: "EXECUTION ORDER", cost: 2, trigger: "beforeFight",
    text: "Your formations strike first and strike twice in melee.",
    effect: { meleeScale: 2, meleeFirst: true },
  },
};

export const stratagemFor = (id) => STRATAGEMS[id] ?? null;
export const stratagemList = () => Object.values(STRATAGEMS);

// A detachment is two things: the stratagems it may spend, and the dispositions it may
// declare. The second is what makes it a real list-building choice rather than a label —
// it gates how you are allowed to win before the battle starts. See doctrine.js.
export const DETACHMENTS = {
  voidbreaker: {
    id: "voidbreaker", name: "VOIDBREAKER GUILD",
    summary: "Scrapborn line detachment. Absorbs a beating and holds what it takes.",
    commandPoints: 3,
    // The army's character, in force every round of every battle. This is what a
    // detachment is for: it is the flavour of the army, not a menu of gates.
    rule: { name: "SCRAPBORN PLATE", text: "Every formation takes a tenth less from everything.", effect: { incomingDamageScale: 0.9 } },
    pool: ["brace", "hold-fast", "overwatch", "surge"],
    // What it may declare. A guild line detachment can take and hold, or refuse to give
    // anything up — it has no way to be told to go and kill something.
    dispositions: ["dominion", "safeguard"],
  },
  ordoPraesidium: {
    id: "ordo-praesidium", name: "ORDO PRAESIDIUM",
    summary: "Helioch siege detachment. Punishes anything that stands still in front of it.",
    commandPoints: 3,
    rule: { name: "RANGING OATH", text: "Every formation shoots as if a command vehicle were beside it.", effect: { shootingHitBonus: 1 } },
    pool: ["focus-fire", "execution-order", "brace", "overwatch"],
    // The mirror: it can take ground or break an army, and has no doctrine for holding
    // what it already owns.
    dispositions: ["dominion", "eradication"],
  },
  hollowjaw: {
    id: "hollowjaw", name: "HOLLOWJAW PACK",
    summary: "Close-quarters detachment. Nothing it reaches survives being reached.",
    commandPoints: 3,
    rule: { name: "JAWS FIRST", text: "Every formation fights at half again in melee.", effect: { meleeScale: 1.5 } },
    pool: ["surge", "execution-order", "overwatch", "hold-fast"],
    // It can take ground or break an army, and has no doctrine for standing still.
    dispositions: ["dominion", "eradication"],
  },
};

export const detachmentFor = (id) => DETACHMENTS[id] ?? DETACHMENTS.voidbreaker;
export const detachmentList = () => Object.values(DETACHMENTS);

// The enemy's hidden hand. Drawn deterministically from a seed so a battle is repeatable
// and sweepable, but unknown to the player until each card is spent.
// A small integer hash. Not cryptography — it only has to spread a handful of seeds over
// a handful of pool positions.
const shuffleKey = (seed, index) => ((Math.abs(Math.floor(seed)) + 1) * 2654435761 + (index + 1) * 40503) % 100003;

export const drawEnemyHand = ({ detachment = DETACHMENTS.ordoPraesidium, seed = 0, size = 2 } = {}) => {
  const pool = (detachment?.pool ?? []).filter((id) => STRATAGEMS[id]);
  // Rank the whole pool by the seeded key and take the top of it. Ranking rather than
  // repeatedly drawing means the hand can never contain the same card twice and the draw
  // always terminates — a stride-based walk lands on the same index forever whenever the
  // stride and the pool size share a factor, which is a hang, not a bad hand.
  return pool
    .map((id, index) => ({ id, key: shuffleKey(seed, index) }))
    .sort((left, right) => left.key - right.key || (left.id < right.id ? -1 : 1))
    .slice(0, Math.max(0, Math.min(size, pool.length)))
    .map((entry) => entry.id);
};

// When the enemy spends. Authored rather than adaptive, so the same battle always plays
// out the same way — the player's uncertainty is that they cannot see the hand, not that
// the opponent is random.
export const enemyPlaysAt = ({ hand = [], round = 1 } = {}) => {
  // It commits its first card as the armies come into range, and its second when the
  // fighting starts. Holding everything to the last round would never be readable.
  if (round === 2 && hand[0]) return hand[0];
  if (round === 4 && hand[1]) return hand[1];
  return null;
};

// What the player is allowed to know before committing: the pool, never the hand.
export const scoutedPool = (detachment) => detachment.pool.map((id) => {
  const stratagem = STRATAGEMS[id];
  return { id, name: stratagem.name, cost: stratagem.cost, trigger: TRIGGERS[stratagem.trigger], text: stratagem.text };
});

// Spending is bounded by the point budget, so a hand is a choice rather than a checklist.
export const affordable = ({ chosen = [], detachment }) => {
  const spent = chosen.reduce((sum, id) => sum + (STRATAGEMS[id]?.cost ?? 0), 0);
  return { spent, remaining: detachment.commandPoints - spent };
};
