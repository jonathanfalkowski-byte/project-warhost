// The run.
//
// "a combo of an autobattler and rogue lite" — the autobattler half has been the whole
// project so far and the roguelite half did not exist. Every battle started from a clean
// slate against a known army, so nothing you did in one battle meant anything in the next.
//
// The central decision here is that THE DIFFICULTY CURVE IS YOUR OWN ATTRITION. The enemy
// does not inflate: the same authored armies fight you at full strength every time. What
// changes is that your formations carry their wounds forward and the destroyed ones do not
// come back. Battle one is the fairest fight of the run and battle five is the hardest,
// entirely because of what happened in between.
//
// That is also what finally gives SAFEGUARD a reason to exist. The sweep had it as the
// weakest disposition and preferred by only 16 of 126 lists, because preserving your army
// bought nothing when the battle ended and everyone reset. In a run it buys the next
// battle.
//
// A run is deterministic given its seed and the choices made in it, so a run can be
// replayed exactly — but the space of runs is far too large to resolve exhaustively the
// way a single battle is. `npm run analyse` sweeps runs under fixed reward policies across
// a set of seeds: exhaustive over policies, sampled over seeds. That is a real change of
// method from every other number in this project and it is labelled as one.

import { FORMATIONS } from "../formationData.js";
import { DETACHMENTS, detachmentFor, drawEnemyHand } from "./stratagems.js";
import { CIRCUIT_CLASH, THE_NARROWS, armyFor, buildEnemyForce, missionFor } from "./battleMission.js";
import { plansFor } from "./battlePlans.js";
import { mechanicsOf, synergyFor } from "./synergies.js";
import { profileWithRefit } from "./refits.js";
import { FIELD_REPAIR_WOUNDS, SERVICES, costOf, marketFor, shelfRefitsFor, shelfUnitsFor } from "./market.js";

export const RUN_LENGTH = 5;
// Below this you cannot field a force at all and the run is over. Five slots, so the last
// two battles of a bad run are fought a formation or two short — which is the pressure,
// not a failure of the rules.
export const MINIMUM_FORCE = 4;
// Field repair between battles. The single most important number in the run: too much and
// losing formations stops mattering, too little and one bad battle ends everything.
// A warband starts at exactly the five deployment slots and is bought wider from there.
// Starting at four looked like the right roguelite shape — begin small, grow — but it made
// the run shorter than the ladder rather than harder: two casualties and you are under the
// minimum, so warbands ended the run SMALLER than they started, at 3.78 of 4.
export const STARTING_ROSTER = 6;
// Command points come back for free, but only from the army you actually fielded: one for
// taking the engagement, and one for every COMMAND formation still standing at the end,
// capped so it cannot run away. Buying them with victory points is the fallback, not the
// only tap — and tying the tap to a keyword makes the COMMAND VEHICLE and the SPOTTER MAST
// refit into an economy rather than a stat line.
export const COMMAND_REGEN_CAP = 2;
// NOTHING IS FIXED FOR FREE. Repair between engagements is DOMINION's supply and nothing
// else — `repairAmountFor` is FREE_REPAIR plus the ground you held — so the only army that
// gets patched up for nothing is the one that took and kept ground, and every other army
// buys it out of the same purse it wants to widen with.
//
// It used to be a flat four wounds for everyone, which was the right call when the market
// was thin: cutting it to two once killed formations faster than the shelf could replace
// them and warbands ended runs smaller than they started. The throughput change made the
// shelf five wide at two to five points a hull, and against an enemy that is now built
// rather than authored a flat free repair meant damage never accumulated across a run:
// every disposition lasted the same number of engagements whatever it did to its own
// formations, which is the one thing a roguelite cannot afford.
export const FREE_REPAIR = 0;
export const REPAIR_BETWEEN_BATTLES = FREE_REPAIR;

// The ladder. Boards alternate so no plan can be optimised for one of them across a whole
// run. The curve is built from both ends: the first two engagements are fought against a
// detachment of the enemy army rather than all of it, and the last three are the whole
// thing holding more cards — while your own side is going the other way.
//
// THE ENEMY NO LONGER RAMPS BY SIZE. It used to field `units.slice(0, enemyCount)` — the
// front three of a fixed list, then four, then five — so "harder" meant the same army with
// one more vehicle bolted on, and the first engagement was a five-against-three that the
// player won 96% of the time. The enemy is built per engagement now: five formations
// chosen for the plan it declared. What escalates across the ladder is how much it is
// holding, which is a real escalation and not a handicap being removed.
export const RUN_LADDER = [
  { mission: CIRCUIT_CLASH.id, handSize: 1, name: "FIRST CONTACT", brief: "The whole procession, and one card in hand." },
  { mission: THE_NARROWS.id, handSize: 1, name: "THE SQUEEZE", brief: "Close ground, and nowhere to avoid what they brought." },
  { mission: CIRCUIT_CLASH.id, handSize: 2, name: "OPEN GROUND", brief: "In the open, with two cards in hand." },
  { mission: THE_NARROWS.id, handSize: 2, name: "NO ROOM LEFT", brief: "The narrows again, and they have learned it." },
  { mission: CIRCUIT_CLASH.id, handSize: 3, name: "THE LAST CIRCUIT", brief: "Everything they have, holding everything they can spend." },
];

const shuffleKey = (seed, index) => ((Math.abs(Math.floor(seed)) + 1) * 2654435761 + (index + 1) * 40503) % 100003;

// The formations a run starts with, drawn from the roster by seed. Ranked rather than
// repeatedly drawn, for the same reason the enemy's hand is: a stride-based walk can land
// on the same index forever.
export const startingRoster = ({ seed = 0, size = STARTING_ROSTER } = {}) => FORMATIONS
  .map((formation, index) => ({ formation, key: shuffleKey(seed, index) }))
  .sort((left, right) => left.key - right.key || left.formation.id.localeCompare(right.formation.id))
  .slice(0, Math.min(size, FORMATIONS.length))
  .map(({ formation }, index) => rosterEntry(formation.id, formation.name, index));

// A roster entry is an INSTANCE of a formation, not the formation itself. Two railjacks are
// two entries with two ids and two damage tracks, which is the whole of what makes them two
// railjacks rather than one counted twice.
let instanceCounter = 0;
export const rosterEntry = (formationId, name, seedIndex = null) => {
  instanceCounter += 1;
  return {
    // Deterministic where it can be — a run replays from its seed — and unique regardless.
    id: `${formationId}#${seedIndex === null ? instanceCounter : seedIndex}`,
    formationId,
    name,
    wounds: null,
    refit: null,
  };
};

export const startRun = ({ detachmentId = "voidbreaker", seed = 0, enemyPolicy = "varied" } = {}) => ({
  seed,
  detachmentId,
  battle: 1,
  commandPoints: detachmentFor(detachmentId).commandPoints,
  roster: startingRoster({ seed }),
  // What the last battle earned that outlives it. Every disposition gets one of these, or
  // the only one with a run-level payoff is SAFEGUARD — which is exactly what happened
  // when it was the only one: 3.24 battles won against 1.28 for the other two, a two
  // battle gap on a five battle ladder.
  attrition: 0,   // ERADICATION: formations you broke stay broken
  supply: 0,      // DOMINION: ground held keeps the yard running
  // The purse. Victory points are the currency, so how you score and what you can afford
  // are the same decision.
  purse: 0,
  spent: 0,
  shelf: null,
  refitShelf: null,
  // Pairings the run has SEEN happen. They are written on no card, so the only way one can
  // become knowledge is by having formed once — and then it stays known for the rest of the
  // run and changes how the next five are picked. This is the only thing in the game the
  // player learns by playing rather than by reading.
  // Whether the enemy varies. A run plays "varied" — a different declaration, plan and list
  // every engagement, which is the whole point of the enemy being built rather than
  // authored. The balance sweep also plays runs "control", where the enemy declares its
  // doctrine's own disposition and plan on seed zero every time, for the same reason axes A
  // to D fight a fixed opponent: an effect cannot be attributed to the player's choices
  // while the thing they are being measured against changes underneath them.
  enemyPolicy,
  discovered: [],
  history: [],
  status: "active",
});

// What the next battle is: which board, which enemy, and how much it is holding. The hand
// is drawn from the run's seed and the battle number, so the same run always faces the
// same cards in the same order and a replay is a replay.
export const engagementFor = (run) => {
  const rung = RUN_LADDER[Math.min(run.battle, RUN_LADDER.length) - 1];
  const mission = missionFor(rung.mission);
  const doctrine = armyFor(rung.mission);
  const detachment = detachmentFor(doctrine.detachment);
  // Early engagements field part of the enemy army, not all of it.
  // ERADICATION's run-level payoff: what you destroyed does not come back next time. It
  // never drops the enemy below three, so breaking their army buys a real advantage
  // without ever emptying the board.
  const strength = Math.max(3, (rung.enemyCount ?? mission.enemyDeployment.length) - (run.attrition ?? 0));
  // WHAT THE ENEMY DECLARES, drawn from the same seed as its hand.
  //
  // It used to be DOMINION, always, on both boards, in every run. The player has three
  // victory conditions and never once met an opponent using a different one — so the whole
  // question of "they have stopped contesting the ground and come to kill, now what" simply
  // did not exist. Its detachment gates this exactly as the player's gates theirs.
  const seed = run.seed * 100 + run.battle;
  const control = run.enemyPolicy === "control";
  const disposition = control
    ? doctrine.disposition
    : detachment.dispositions[shuffleKey(seed, 11) % detachment.dispositions.length];
  const plans = plansFor(disposition);
  const planId = control
    ? doctrine.plan
    : (plans[shuffleKey(seed, 23) % Math.max(1, plans.length)] ?? {}).id ?? doctrine.plan;
  // WHAT THEY LEARNED LAST TIME. The control enemy never reads — it is the measuring
  // instrument for everything the player chooses, and an opponent that changes in response
  // to the player is the one thing a control cannot do. The first engagement of a run has
  // nothing to read either.
  const counter = control ? null : (run.history.at(-1)?.fielded ?? null);
  const foe = buildEnemyForce(mission, doctrine, { disposition, planId, strength, seed: control ? 0 : seed, counter });
  return {
    ...rung,
    number: run.battle,
    of: RUN_LADDER.length,
    mission,
    foe,
    // What the player is shown before committing: who they are, what they have brought,
    // how they intend to win and which doctrine they are walking. Everything except the
    // hand, which is the only thing that was ever hidden.
    army: {
      ...doctrine,
      disposition,
      plan: planId,
      planName: foe.plan?.name ?? null,
      units: foe.units.map((unit) => ({ formationId: unit.id.replace(/^enemy-/, ""), name: unit.name })),
    },
    // What they were built against, and what they would have brought without it. The
    // difference between the two lists is the whole of what reading the player did, and
    // the screen says so rather than leaving the player to notice.
    read: counter,
    blind: counter
      ? buildEnemyForce(mission, doctrine, { disposition, planId, strength, seed })
        .units.map((unit) => unit.id.replace(/^enemy-/, ""))
      : null,
    enemyHand: drawEnemyHand({ detachment, seed, size: rung.handSize }),
  };
};

export const fieldableFrom = (run) => run.roster.filter((entry) => entry.wounds === null || entry.wounds > 0);

// What a battle did to the army. Deployed formations carry whatever they have left;
// destroyed ones are struck off. Anything held in reserve is untouched — which is a real
// decision when the roster is bigger than the five slots.
// Pairings this battle showed the player, added to what the run already knew. Recorded with
// the two formations that formed it and the engagement it happened in, because "LOCKED
// SHIELDS" on its own is a name and "the bastion standing with the railjack, battle two" is
// a thing you can do again.
const withDiscoveries = (run, result) => {
  const known = new Set((run.discovered ?? []).map((entry) => entry.id));
  const fresh = [];
  for (const round of result?.rounds ?? []) {
    for (const found of round.synergies?.player ?? []) {
      if (known.has(found.id)) continue;
      known.add(found.id);
      fresh.push({
        id: found.id,
        name: found.name,
        reveal: found.reveal,
        holder: found.holder,
        partner: found.partner,
        battle: run.battle,
        // WHERE and WHAT. The record used to be a name, two hulls and a flavour line, which
        // says a pairing happened and not one thing about what it was worth or where to go
        // looking for it again.
        board: missionFor(RUN_LADDER[Math.min(run.battle, RUN_LADDER.length) - 1].mission)?.name ?? null,
        pair: synergyFor(found.id)?.pair ?? [],
        mechanics: mechanicsOf(synergyFor(found.id)),
      });
    }
  }
  return [...(run.discovered ?? []), ...fresh];
};

// `fielded` is what the player put on the board and how: the formation in each deployment
// slot, the plan they walked and what they declared. It is kept because the ENEMY READS IT
// — the next engagement's list is built by replaying this one. Nothing else uses it, and
// nothing about it is hidden from the player: it is their own last engagement.
export const applyBattle = ({
  run, result, deployedIds = [], won, disposition = "dominion", commandSpent = 0,
  fielded = null, planId = null,
}) => {
  const survivors = new Map((result?.rounds?.at(-1)?.players ?? []).map((unit) => [unit.id, unit.wounds]));
  const roster = [];
  const lost = [];
  for (const entry of run.roster) {
    // Matched on the INSTANCE. Keyed on the formation, a warband holding two railjacks
    // struck both off when one died and carried one's damage onto the other.
    if (!deployedIds.includes(entry.id)) { roster.push(entry); continue; }
    const remaining = survivors.get(entry.id);
    if (!Number.isFinite(remaining) || remaining <= 0) { lost.push(entry); continue; }
    roster.push({ ...entry, wounds: Number(remaining.toFixed(2)) });
  }
  const record = {
    battle: run.battle,
    won: Boolean(won),
    playerScore: result?.playerScore ?? 0,
    enemyScore: result?.enemyScore ?? 0,
    lost: lost.map((entry) => entry.name),
  };
  const finalRound = result?.rounds?.at(-1);
  // Free command points: one for winning, one for each COMMAND formation that came back.
  const commanders = (finalRound?.players ?? [])
    .filter((unit) => unit.wounds > 0 && unit.keywords?.includes("COMMAND")).length;
  const regained = Math.min(COMMAND_REGEN_CAP, (won ? 1 : 0) + commanders);
  // ERADICATION carries the enemy's dead forward; DOMINION converts held ground into
  // repair. SAFEGUARD's payoff needs no code — it is the casualties that did not happen.
  const broke = (finalRound?.enemies ?? []).filter((unit) => unit.wounds <= 0).length;
  const heldGround = (finalRound?.objectives ?? []).filter((entry) => entry.holder === "player").length;
  const next = {
    ...run,
    roster,
    // Command points do NOT refill between engagements. They used to, which made the
    // decision the same every battle — you always had three, so you always spent three
    // the same way. Now they are a run resource: what you spend is gone, what you do not
    // spend carries, and REQUISITION in the market is the only way to get one back.
    commandPoints: Math.max(0, run.commandPoints - Math.max(0, commandSpent)) + regained,
    // Income is what you SCORED, not the margin. A battle you lost still paid for what you
    // took while you were losing it, which is the same reason a lost battle does not end
    // the run: it has to cost you something without ending everything.
    purse: run.purse + (result?.playerScore ?? 0),
    attrition: disposition === "eradication" ? Math.min(2, (run.attrition ?? 0) + broke) : 0,
    supply: disposition === "dominion" ? heldGround : 0,
    history: [...run.history, {
      ...record, broke, heldGround, earned: result?.playerScore ?? 0, commandSpent, regained, commanders,
      // What was standing at the end and what did not come back, so the run's ledger can
      // answer "which of mine survived" without anyone having to reconstruct it.
      survivors: roster.filter((entry) => deployedIds.includes(entry.id)).map((entry) => entry.name),
      // The engagement as the enemy will remember it.
      fielded: Array.isArray(fielded) && fielded.some(Boolean)
        ? { order: fielded, planId, disposition }
        : null,
    }],
    // The shelf is drawn once, here, against the roster as it stands after the battle —
    // so a purchase takes one thing off it rather than re-rolling the other two.
    discovered: withDiscoveries(run, result),
    shelf: shelfUnitsFor({ seed: run.seed, battle: run.battle, roster, lost: lost.map((entry) => entry.formationId) }),
    refitShelf: shelfRefitsFor({ seed: run.seed, battle: run.battle, roster }),
  };
  // A lost battle does NOT end the run. A single battle is close to a coin flip against a
  // competent army, and ending the run on one made 46% of runs die at the first fight and
  // 0.1% finish the ladder — the sweep said so before anyone played it. What a loss costs
  // you is the casualties and the reward, and those compound.
  //
  // The run ends when the army can no longer take the field, or when the ladder is done.
  if (fieldableFrom(next).length < MINIMUM_FORCE) return { ...next, status: "broken" };
  if (run.battle >= RUN_LADDER.length) return { ...next, status: "complete" };
  return next;
};

// Between battles: field repair, then the choice. Repair happens first so a reward that
// heals is measured against what repair already did rather than double-counting it.
// A formation repaired back to its profile maximum stops carrying damage at all, so
// `wounds: null` means "as it came out of the yard" everywhere in the run.
// Measured THROUGH the refit. Four refits move a hull's wounds, so reading the base
// profile here let a reinforced hull repair to its old maximum, get marked "full", and
// then fight at the higher number — a free heal for anyone who bought armour.
const fullStrength = (entry) => profileWithRefit(entry.formationId, entry.refit).wounds;

export const repairAmountFor = (run) => REPAIR_BETWEEN_BATTLES + (run.supply ?? 0);

export const repair = (run) => ({
  ...run,
  roster: run.roster.map((entry) => {
    if (entry.wounds === null) return entry;
    const healed = Math.min(entry.wounds + repairAmountFor(run), fullStrength(entry));
    return healed >= fullStrength(entry) ? { ...entry, wounds: null } : { ...entry, wounds: Number(healed.toFixed(2)) };
  }),
});

// What is on the shelf between two engagements. The market lives in market.js; this is
// only the run's view of it.
export const offersFor = (run) => marketFor({
  seed: run.seed, battle: run.battle, roster: run.roster, purse: run.purse,
  shelf: run.shelf, refitShelf: run.refitShelf,
});

// Buying. Anything you cannot afford is refused rather than silently discounted, and every
// purchase is a pure function of the run so a run replays from its seed and its choices.
// `targetId` names WHICH hull a repair goes to. Everything else ignores it.
export const buy = ({ run, offerId, targetId = null }) => {
  const offer = offersFor(run).find((entry) => entry.id === offerId);
  if (!offer || offer.cost > run.purse) return run;
  const paid = { ...run, purse: run.purse - offer.cost, spent: run.spent + offer.cost };

  if (offer.kind === "refit") {
    // A formation carries one refit, and the market is where that is enforced: a hull
    // already carrying one is never offered another, so it can never be bought. The check
    // lives there rather than being repeated here, where it would be unreachable and
    // therefore untestable.
    // Fitted to the first hull of that kind that is not already carrying one. Which of two
    // identical railjacks gets it is not a decision worth asking about — they differ only in
    // how shot they are — and asking would be a modal dialog nobody wants.
    const target = paid.roster.find((entry) => entry.formationId === offer.formationId && !entry.refit);
    if (!target) return run;
    return {
      ...paid,
      roster: paid.roster.map((entry) => (entry === target ? { ...entry, refit: offer.id } : entry)),
    };
  }

  if (offer.kind === "unit") {
    // Taken off the shelf by hand, because owning one no longer means you cannot buy another
    // and the shelf can therefore no longer be filtered by what the warband holds.
    const shelf = [...(paid.shelf ?? [])];
    const at = shelf.indexOf(offer.id);
    if (at >= 0) shelf.splice(at, 1);
    return {
      ...paid,
      shelf,
      roster: [...paid.roster, rosterEntry(offer.id, offer.name)],
    };
  }

  const worst = paid.roster
    .filter((entry) => Number.isFinite(entry.wounds))
    .sort((left, right) => left.wounds - right.wounds)[0];

  // WHICH hull gets the work. It used to always be the worst-off one, which is a sensible
  // default and a poor decision: with two of the same formation in the warband and a dozen
  // hulls in it, "patch the railjack I am deploying next or rebuild the skimmer I am not"
  // is the question the money is actually asking. Naming a formation that is not damaged,
  // or is not in the warband at all, refuses the purchase rather than quietly doing the
  // work somewhere else and charging for it.
  const named = targetId === null ? null
    : paid.roster.find((entry) => entry.id === targetId && Number.isFinite(entry.wounds));
  if (targetId !== null && !named) return run;
  // Nobody named one: the worst-off formation, exactly as before. The sweep buys this way,
  // which is what keeps the measured value of a repair the value of the cheapest sensible
  // policy rather than the value of playing it well.
  const target = named ?? worst;

  switch (offer.id) {
    case "field-repair": {
      if (!target) return paid;
      const healed = Math.min(target.wounds + FIELD_REPAIR_WOUNDS, fullStrength(target));
      return {
        ...paid,
        roster: paid.roster.map((entry) => (entry === target
          ? { ...entry, wounds: healed >= fullStrength(entry) ? null : Number(healed.toFixed(2)) }
          : entry)),
      };
    }
    case "rebuild":
      if (!target) return paid;
      return { ...paid, roster: paid.roster.map((entry) => (entry === target ? { ...entry, wounds: null } : entry)) };
    case "requisition":
      return { ...paid, commandPoints: paid.commandPoints + 1 };
    default:
      return run;
  }
};

export { SERVICES, costOf, FIELD_REPAIR_WOUNDS };

// Selling a formation back. The run used to be one army that only ever shrank; a market
// you can only buy into is a shopping list, not a build. Retiring pays back half of what
// the formation cost, so churning the warband is possible and lossy rather than free.
export const RETIRE_REFUND = 0.5;

// Retiring ONE of them. Keyed on the formation it sold every railjack in the warband at
// once and paid for a single one.
export const retire = ({ run, id }) => {
  const entry = run.roster.find((item) => item.id === id);
  // Never below the minimum force: a warband you cannot field is the end of the run, and
  // ending it by selling your own army is not a decision anyone means to make.
  if (!entry || fieldableFrom(run).length <= MINIMUM_FORCE) return run;
  return {
    ...run,
    purse: run.purse + Math.floor(costOf(entry.formationId) * RETIRE_REFUND),
    roster: run.roster.filter((item) => item.id !== id),
  };
};

export const advance = (run) => (run.status === "active" ? { ...run, battle: run.battle + 1 } : run);

// A run is not pass or fail. It ends either because the ladder is finished or because the
// army is gone, and what it is worth is how many of the five you actually took.
// How the run reads at a glance: how far it got, and what it cost.
export const runSummary = (run) => ({
  status: run.status,
  reached: run.history.length,
  of: RUN_LADDER.length,
  won: run.history.filter((entry) => entry.won).length,
  // Battles won and battles fought are different questions, and reporting only the first
  // conflates surviving with winning: a run that breaks after two fights can win at most
  // two, so anything that keeps the army alive looks like it also wins more. It was worth
  // 3.24 "battles won" to SAFEGUARD against 1.44 for the others on that reading, almost
  // all of it survival rather than victory.
  fought: run.history.length,
  winRate: run.history.length > 0
    ? Number((run.history.filter((entry) => entry.won).length / run.history.length).toFixed(4)) : 0,
  lostFormations: run.history.flatMap((entry) => entry.lost),
  standing: fieldableFrom(run).length,
  commandPoints: run.commandPoints,
  purse: run.purse,
  spent: run.spent,
  rosterSize: run.roster.length,
  refitted: run.roster.filter((entry) => entry.refit).length,
  // What was left over at the last point it could have been spent. The purse at the very
  // end always looks hoarded because the final engagement's score arrives with nothing
  // left to buy — measuring that would be measuring an artifact of when the run stops.
  unspent: run.purse - (run.history.at(-1)?.earned ?? 0),
  earned: run.history.reduce((sum, entry) => sum + (entry.earned ?? 0), 0),
});
