// What each formation actually did.
//
// "if im doing combos and strategy and units i kind of need to know what worked... maybe a
// percentage how effective the unit was in their position and role". The operation model
// answered that and the battle model did not, so this is the answer carried across rather
// than lost when the old screen was retired.
//
// The measure adapts to what you declared, because measuring a formation against a job it
// was never given is worse than not measuring it. Under a disposition paid on damage, a
// formation's share is its share of the damage. Under one paid on ground, it is its share
// of the objective-rounds the army held. Contribution is always a share of what the army
// was actually scoring for.

import { OBJECTIVE_CONTROL_RANGE } from "./battleProfiles.js";
import { COMMAND_RANGE, SHIELD_RANGE } from "./battleRules.js";
import { sightBlocked } from "./battleTerrain.js";
import { dispositionFor, liveSitesFor } from "./doctrine.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const percent = (part, whole) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

// A formation holds an objective in a round if it is alive, on it, and its side ended the
// round holding it. Standing on ground you did not take is not holding it.
const heldThisRound = ({ unit, round, sites }) => sites.filter((site) => (
  unit.wounds > 0
  && distance(unit, site) <= OBJECTIVE_CONTROL_RANGE
  && round.objectives.find((entry) => entry.objectiveId === site.id)?.holder === "player"
)).length;

// Ground held that this disposition does not pay for — which is not nothing. Every marker
// you are standing on is a marker THEY are not scoring, and denying a point is worth what
// taking one is.
//
// Under SAFEGUARD exactly one marker on the board is live, and every safeguard plan sends
// two or three of its five slots to the flank markers. Measured against scoring ground
// alone, most of a safeguard army came back reading "Held no scoring ground at any point" —
// the debrief telling the player that half of what they fielded did nothing, in the run
// where it was doing the most. HOME-LINE is that disposition's best line BECAUSE of this
// work.
const deniedThisRound = ({ unit, round, objectives, sites }) => {
  const scoring = new Set(sites.map((site) => site.id));
  return objectives.filter((objective) => (
    !scoring.has(objective.id)
    && unit.wounds > 0
    && distance(unit, objective) <= OBJECTIVE_CONTROL_RANGE
    && round.objectives.find((entry) => entry.objectiveId === objective.id)?.holder === "player"
  )).length;
};

// Which formations are working together, right now, on the board.
//
// The combos have been in the rules since the wargame profiles were written — a SHIELD
// soaks fire aimed at anything near it, a COMMAND makes everything near it shoot better,
// a REPAIR patches one friend a round — and the screen has never once shown them. A combo
// nobody can see is a combo nobody has, which is most of the answer to why buying a second
// SHIELD never felt like it did anything.
//
// Derived from position rather than tracked through the resolution, because that is all it
// is: standing near the right formation.
export const SUPPORT_RANGES = { SHIELD: SHIELD_RANGE, COMMAND: COMMAND_RANGE };

export const supportLinksFor = ({ players = [] } = {}) => {
  const standing = players.filter((unit) => unit.wounds > 0);
  const links = [];
  for (const source of standing) {
    for (const keyword of ["SHIELD", "COMMAND"]) {
      if (!source.keywords?.includes(keyword)) continue;
      for (const friend of standing) {
        if (friend.id === source.id) continue;
        if (Math.hypot(source.x - friend.x, source.y - friend.y) > SUPPORT_RANGES[keyword]) continue;
        links.push({ kind: keyword.toLowerCase(), from: source.name, to: friend.name });
      }
    }
  }
  return links;
};

// The pairings firing in a round, as lines between exactly the two hulls that formed each
// one. Derived from what the round RECORDED rather than recomputed from positions, so what
// is drawn and what was resolved cannot drift apart.
export const pairingLinksFor = ({ round } = {}) => (round?.synergies?.player ?? [])
  .map((found) => ({ kind: "pairing", from: found.holder, to: found.partner, name: found.name }));

// The one thing worth saying about a round while you are watching it. Five rounds of
// silent markers sliding around is confirmation, not suspense — there is no moment where
// something HAPPENS. This picks it out: a wreck first, then a stratagem, then the heaviest
// blow, and stays quiet if the round genuinely had nothing in it.
export const headlineFor = ({ round, previous, known = [], disposition = null } = {}) => {
  if (!round) return null;
  // A pairing forming for the FIRST TIME outranks everything, including a casualty. It is
  // the only moment in the game where the player learns a rule that was written nowhere,
  // and it happens once per run per pairing — a wreck can wait one banner.
  // `known` is everything the run already knew plus everything earlier rounds of this
  // battle showed. The caller owns that, because only the caller knows where the round
  // being displayed sits in the run.
  const seen = new Set(known);
  const fresh = (round.synergies?.player ?? []).find((found) => !seen.has(found.id));
  if (fresh) {
    return {
      tone: "found",
      text: `PAIRING FOUND — ${fresh.name}: ${fresh.holder} standing with ${fresh.partner}. ${fresh.reveal}`,
    };
  }
  const wasAlive = new Map((previous?.players ?? []).map((unit) => [unit.id, unit.wounds > 0]));
  const wasAliveEnemy = new Map((previous?.enemies ?? []).map((unit) => [unit.id, unit.wounds > 0]));

  const lostThisRound = round.players.filter((unit) => unit.wounds <= 0 && (wasAlive.get(unit.id) ?? true));
  // Say WHOSE. A red banner reading "ASSAULT WALKER destroyed" is ambiguous when red is
  // also the enemy's colour everywhere else on the screen, and both armies field
  // formations drawn from the same roster.
  if (lostThisRound.length > 0) {
    return { tone: "loss", text: `You lost ${lostThisRound.map((unit) => unit.name).join(" and ")}.` };
  }
  const brokeThisRound = round.enemies.filter((unit) => unit.wounds <= 0 && (wasAliveEnemy.get(unit.id) ?? true));
  if (brokeThisRound.length > 0) {
    // SAY WHAT IT WAS WORTH. Only ERADICATION pays a wreck bounty; DOMINION scores held
    // ground and nothing else, SAFEGUARD the ground in its own half. Announcing a kill the
    // same way under all three told a DOMINION player they had done something scoring while
    // the battle was being decided on objective-rounds they were losing — which is how you
    // reach the end of a fight certain you should have won it.
    const rule = disposition ? dispositionFor(disposition) : null;
    const wrecked = brokeThisRound.map((unit) => unit.name).join(" and ");
    return {
      tone: "kill",
      text: !rule || rule.wreckBounty
        ? `You wrecked ${wrecked}.`
        : `You wrecked ${wrecked} — ${rule.name} pays nothing for it.`,
    };
  }
  const enemySpend = (round.spends ?? []).find((spend) => spend.side === "enemy");
  if (enemySpend) return { tone: "enemy", text: `Helioch spends ${enemySpend.name}.` };
  const ourSpend = (round.spends ?? []).find((spend) => spend.side === "player");
  if (ourSpend) return { tone: "player", text: `${ourSpend.name} fires.` };

  const heaviest = (round.log ?? [])
    .filter((entry) => entry.phase !== "stratagem" && typeof entry.amount === "number")
    .sort((left, right) => right.amount - left.amount)[0];
  if (heaviest) {
    // "Puts 1 into" is wrong for a formation patching a friend, and the repair phase is in
    // the same log as the shooting.
    const verb = heaviest.phase === "repair" ? "patches" : "puts";
    return {
      tone: heaviest.side === "player" ? "player" : "enemy",
      text: heaviest.phase === "repair"
        ? `${heaviest.actor} ${verb} ${heaviest.target} for ${heaviest.amount}.`
        : `${heaviest.actor} ${verb} ${heaviest.amount} into ${heaviest.target}.`,
    };
  }
  return { tone: "quiet", text: "Nothing in range. Both armies are still closing." };
};

// WHAT THE ROUND PANEL SAYS EACH MARKER PAID, which is not what the marker is printed with
// and is not the same question for both armies. `scoreObjectives` reports raw control and
// the printed points, because that is all a control check can know; what the holder is
// actually paid is decided by the holder's OWN declaration. An enemy on ERADICATION darkens
// every marker, so it can stand on your ground for five rounds and score nothing for it.
//
// This lives here rather than inline in the panel because BattleApp is a hook-driven
// component with no props: server-rendering it can only ever produce the screen before
// anything has been chosen, so anything computed inside it is unreachable from the tests
// AND from the mutation harness. The three defects reported from play were all in this
// layer, and all three were invisible to a suite pointed entirely at the engine. A pure
// function is the difference between logic that can be guarded and logic that cannot.
// WHAT THIS FORMATION CAN ACTUALLY SHOOT, from where it is standing.
//
// The rules have always known. `sightBlocked` is consulted when a unit picks a target and
// again when FOCUS FIRE picks one for the army, so a gun with a stack in front of it holds
// fire every round of every battle. None of that reached the screen, which meant "this gun
// has no lane" was something you found out in round three rather than while placing it.
//
// Three states rather than two, because the reasons are different and so are the fixes. A
// shot that cannot reach is a range problem; a shot that reaches and is cut is a placement
// problem, and it is the one worth drawing. Out of range wins the tie: blocking is academic
// on a shot that was never going to arrive.
export const SIGHT_STATES = Object.freeze(["clear", "blocked", "far"]);

export const sightlinesFrom = ({ from, targets = [], missionId = null, range = null } = {}) => {
  if (!from) return [];
  return targets
    // A wreck is not a target. `wounds` is absent on a bare position, and absent is alive.
    .filter((target) => target && (target.wounds === undefined || target.wounds > 0))
    .map((target) => {
      const distance = Math.hypot(target.x - from.x, target.y - from.y);
      const blocked = Boolean(missionId) && sightBlocked(from, target, missionId);
      const far = range !== null && distance > range;
      return {
        id: target.id,
        name: target.name,
        x: target.x,
        y: target.y,
        distance,
        blocked,
        status: far ? "far" : blocked ? "blocked" : "clear",
      };
    });
};

export const roundPanelFor = ({
  round, objectives = [], playerDisposition = "dominion", enemyDisposition = "dominion",
} = {}) => {
  const paysFor = (disposition, side) => new Map(
    liveSitesFor({ disposition, side, objectives })
      // Re-valued by the rule that kept them: SAFEGUARD doubles the little it can score, so
      // reading the marker's face value here understates it exactly as it overstates a dark one.
      .map((objective) => [objective.id, objective.points ?? 1]));
  const playerPays = paysFor(playerDisposition, "player");
  const enemyPays = paysFor(enemyDisposition, "enemy");
  return (round?.objectives ?? []).map((entry) => {
    const paid = entry.holder === "player" ? (playerPays.get(entry.objectiveId) ?? 0)
      : entry.holder === "enemy" ? (enemyPays.get(entry.objectiveId) ?? 0)
        : 0;
    // Held is not the same as paid, and a marker taken for nothing is the interesting row on
    // the panel. Contested is neither - nobody holds it, so nobody is being paid nothing.
    return { ...entry, paid, dark: entry.holder !== "contested" && paid === 0 };
  });
};

export const afterActionFor = ({ result, objectives = [], disposition = "dominion" } = {}) => {
  const rounds = result?.rounds ?? [];
  if (rounds.length === 0) return { formations: [], measure: "ground", basis: 0 };

  const rule = dispositionFor(disposition);
  const sites = liveSitesFor({ disposition, side: "player", objectives });
  // With no live markers there is no ground to be measured against, so the only honest
  // measure left is what the formation broke.
  const measure = sites.length === 0 ? "damage" : "ground";

  const roster = new Map();
  for (const unit of rounds[0].players) {
    roster.set(unit.name, {
      id: unit.id,
      name: unit.name,
      dealt: 0,
      taken: 0,
      objectiveRounds: 0,
      deniedRounds: 0,
      lostInRound: null,
      survived: true,
      maxWounds: unit.maxWounds,
      wounds: unit.wounds,
    });
  }

  rounds.forEach((round, index) => {
    for (const entry of round.log) {
      if (entry.phase === "stratagem") continue;
      if (entry.side === "player" && roster.has(entry.actor)) roster.get(entry.actor).dealt += entry.amount;
      if (entry.side === "enemy" && roster.has(entry.target)) roster.get(entry.target).taken += entry.amount;
    }
    for (const unit of round.players) {
      const record = roster.get(unit.name);
      if (!record) continue;
      record.wounds = unit.wounds;
      record.objectiveRounds += heldThisRound({ unit, round, sites });
      record.deniedRounds += deniedThisRound({ unit, round, objectives, sites });
      if (unit.wounds <= 0 && record.lostInRound === null) {
        record.lostInRound = index + 1;
        record.survived = false;
      }
    }
  });

  const formations = [...roster.values()];
  const basis = measure === "damage"
    ? formations.reduce((sum, entry) => sum + entry.dealt, 0)
    : formations.reduce((sum, entry) => sum + entry.objectiveRounds, 0);

  return {
    measure,
    basis: Number(basis.toFixed(2)),
    scoring: rule.scoring,
    formations: formations
      .map((entry) => {
        // Round before the sentence is written, or the note reads "took 3.4000000000000004".
        const rounded = { ...entry, dealt: Number(entry.dealt.toFixed(2)), taken: Number(entry.taken.toFixed(2)) };
        return {
          ...rounded,
          contribution: percent(measure === "damage" ? rounded.dealt : rounded.objectiveRounds, basis),
          note: noteFor({ entry: rounded, measure }),
        };
      })
      .sort((left, right) => right.contribution - left.contribution || left.name.localeCompare(right.name)),
  };
};

// One line saying what the formation did, in the terms the disposition is scored in. A
// number with no sentence beside it is the thing that made the old debrief unreadable.
const noteFor = ({ entry, measure }) => {
  if (measure === "damage") {
    if (entry.dealt <= 0 && !entry.survived) return `Destroyed in round ${entry.lostInRound} without firing a shot.`;
    if (entry.dealt <= 0) return "Never got into range of anything.";
    if (!entry.survived) return `Dealt ${entry.dealt} before it was destroyed in round ${entry.lostInRound}.`;
    return `Dealt ${entry.dealt} and took ${entry.taken}.`;
  }
  const rounds = (count) => `${count} round${count === 1 ? "" : "s"}`;
  const denial = entry.deniedRounds > 0
    ? ` Denied them ground for ${rounds(entry.deniedRounds)}, which this disposition does not pay you for.`
    : "";
  if (entry.objectiveRounds === 0 && !entry.survived) {
    return `Destroyed in round ${entry.lostInRound} without holding anything.${denial}`;
  }
  if (entry.objectiveRounds === 0) {
    // A formation that denied ground for the whole battle held plenty; what it did not do
    // is hold ground THIS disposition scores, and the sentence has to say which.
    return entry.deniedRounds > 0
      ? `Held no ground you score.${denial}`
      : "Held no scoring ground at any point.";
  }
  if (!entry.survived) return `Held ground for ${rounds(entry.objectiveRounds)} before it was destroyed in round ${entry.lostInRound}.${denial}`;
  return `Held ground for ${rounds(entry.objectiveRounds)}.${denial}`;
};
