// The market: victory points are the currency.
//
// The run used to hand you one of three rewards after each engagement, which made the
// score a scoreboard and nothing else. Here the victory points you take in a battle are
// the victory points you spend between them, so how you score and what you can afford are
// the same decision — and a disposition is an economic strategy as much as a way to win.
// ERADICATION farms a body count into a bigger warband. SAFEGUARD earns less but keeps
// what it buys. DOMINION takes the ground and buys off it.
//
// Costs are AUTHORED, not derived from the stat line. A formula makes the SHIELD WALKER
// and the SIEGE GUN CARRIAGE interchangeable once the labels are stripped — the same
// reason the wargame profiles are authored — and it also makes the cheapest efficient unit
// mathematically the right answer every time. The sweep checks that no formation is
// strictly the best buy per point.

import { FORMATIONS } from "../formationData.js";
import { battleProfileFor, statLineFor } from "./battleProfiles.js";
import { REFITS, REFIT_COST, refitsFor } from "./refits.js";

// What a formation costs to bring into the warband, in victory points.
// Prices are low on purpose. At 3-to-7 against roughly eleven points an engagement you
// could make TWO changes across a whole run, and two changes is not a build loop — it is
// why nothing was ever discovered. The warband is meant to grow well past the five
// deployment slots so that WHICH FIVE, against this particular enemy, becomes the decision
// you make every engagement. That is the Bazaar motion: the collection is the build, the
// deployment is the counter-pick.
export const UNIT_COSTS = {
  skimmer: 2,   // reaches anything, dies to a stiff breeze
  harpoon: 3,   // outruns the line to contest early
  furnace: 3,   // volume of fire at short range, nothing at long
  breaker: 4,   // the melee answer, worthless before it arrives
  hauler: 4,    // keeps the rest of the warband standing
  railjack: 5,  // slow, and extremely hard to remove once it is somewhere
  command: 5,   // makes everything near it shoot better
  bastion: 5,   // soaks fire aimed at whatever it is standing beside
  carriage: 5,  // reaches across the board and cannot run
};

export const costOf = (formationId) => UNIT_COSTS[formationId] ?? 5;

// Services cost points too, so the purse is a real choice rather than a shopping list:
// every point spent patching the army you have is a point not spent widening it.
// How much a field repair puts back. Named here rather than left as a 4 in the buying
// code, because the shelf has to be able to say what it sells without keeping a second
// copy of the number and being wrong about it.
export const FIELD_REPAIR_WOUNDS = 4;

// `short` is the label on the button beside a damaged formation, where the row already
// says which hull it is and the long name would only repeat the column above it.
export const SERVICES = {
  "field-repair": {
    id: "field-repair", name: "FIELD REPAIR", short: `PATCH +${FIELD_REPAIR_WOUNDS}`, cost: 2,
    text: `A damaged formation of your choosing recovers ${FIELD_REPAIR_WOUNDS} wounds.`,
  },
  rebuild: {
    id: "rebuild", name: "FULL REBUILD", short: "REBUILD", cost: 4,
    text: "A damaged formation of your choosing is returned to full strength.",
  },
  requisition: {
    id: "requisition", name: "REQUISITION", short: "REQUISITION", cost: 5,
    text: "One more command point, for the rest of the run.",
  },
};

// The two that need a hull named before they do anything. The market lists them; the
// warband is where they are bought, one row at a time.
export const MENDS = ["field-repair", "rebuild"];

// How wide the shelf is. Three offers against a nine-formation roster meant most of what
// you might want was simply never for sale.
export const SHELF_UNITS = 5;
export const SHELF_REFITS = 3;

// AT MOST TWO OF ANY ONE FORMATION. Allowing duplicates at all is what opens list-building
// up — nine hulls choose five is 126 lists, with repeats it is 1287 — but unrestricted it
// opens straight onto a degenerate answer: three RECON TANKS and two RECOVERY VEHICLES won
// 100% of its 120 deployments, because three OBJECTIVE hulls each holding at 1.5× control
// under DUG IN, kept standing by two REPAIR hulls, is not a list, it is an exploit. Ninety
// five lists won from every single deployment. Capped at two, that space is 882 lists and
// none of them do.
//
// It is also the ordinary rule in the wargames this is built out of, and it reads as one:
// you can bring a second of something, not an army of it.
export const MAX_COPIES = 2;

const shuffleKey = (seed, index) => ((Math.abs(Math.floor(seed)) + 1) * 2654435761 + (index + 1) * 40503) % 100003;

// What is on offer between two engagements: the formations you do not already have, plus
// the services that would do something. Drawn from the run's seed and battle number, so a
// run always sees the same market in the same order.
// Which three formations are on the shelf this time. Drawn ONCE, when the market opens,
// and then held: deriving them from the roster on every read meant buying one formation
// silently re-rolled the other two, so you could churn the shelf by spending.
// Which refits are on the shelf. Only for formations already in the warband and not
// already carrying one — a refit is a thing you do to an army you have, which is what
// makes buying a formation the start of a build rather than the end of a transaction.
export const shelfRefitsFor = ({ seed = 0, battle = 1, roster = [] } = {}) => roster
  .filter((entry) => !entry.refit)
  .flatMap((entry) => refitsFor(entry.formationId))
  .map((refit, index) => ({ refit, key: shuffleKey(seed * 17 + battle * 3, index) }))
  .sort((left, right) => left.key - right.key || left.refit.id.localeCompare(right.refit.id))
  .slice(0, SHELF_REFITS)
  .map(({ refit }) => refit.id);

// `lost` is what did not come back from the engagement that just ended, and the shelf will
// not sell it to you this time. A wreck used to be replaceable off the very next shelf for
// two or three points, which is why preserving the army bought nothing a run could feel:
// every disposition ended up lasting the same number of engagements, whatever it did to its
// own formations. A loss now costs you a battle as well as the points.
// A HULL YOU ALREADY OWN IS STILL FOR SALE. It used to filter out everything in the
// warband, so the shelf emptied as the run went on and the market ran out of things to sell
// you — which is most of why a bench never really formed. Two railjacks is a list-building
// decision, and it is the one that opens the space up without a single new formation being
// authored: nine hulls choose-five is 126 lists, nine hulls choose-five WITH REPEATS is
// 1287. What stays filtered is what died this engagement.
export const copiesOf = (roster, formationId) => roster.filter((entry) => entry.formationId === formationId).length;

export const shelfUnitsFor = ({ seed = 0, battle = 1, roster = [], lost = [] } = {}) => {
  const gone = new Set(lost);
  return FORMATIONS
    .filter((formation) => !gone.has(formation.id) && copiesOf(roster, formation.id) < MAX_COPIES)
    .map((formation, index) => ({ formation, key: shuffleKey(seed * 31 + battle, index) }))
    .sort((left, right) => left.key - right.key || left.formation.id.localeCompare(right.formation.id))
    .slice(0, SHELF_UNITS)
    .map(({ formation }) => formation.id);
};

export const marketFor = ({ seed = 0, battle = 1, roster = [], purse = 0, shelf = null, refitShelf = null } = {}) => {
  const damaged = roster.some((entry) => Number.isFinite(entry.wounds));
  const drawn = shelf ?? shelfUnitsFor({ seed, battle, roster });
  // Anything bought is taken off the shelf EXPLICITLY, by `buy` removing it from the run's
  // held shelf. It used to be implicit — the shelf was filtered by what the warband already
  // owned, which is the same thing only as long as owning one meant you could not buy
  // another.
  const units = drawn
    // A hull the warband is already at its limit on comes off the shelf, the same way a
    // bought one does.
    .filter((id) => copiesOf(roster, id) < MAX_COPIES)
    .map((id) => FORMATIONS.find((formation) => formation.id === id))
    .filter(Boolean)
    .map((formation) => ({
      kind: "unit",
      id: formation.id,
      name: formation.name,
      cost: costOf(formation.id),
      text: noteFor(formation.id),
      affordable: costOf(formation.id) <= purse,
    }));
  // A refit needs a HULL OF THAT KIND THAT IS NOT ALREADY CARRYING ONE. With two railjacks
  // in the warband the same refit can be bought twice, once for each; with one railjack that
  // already has one, it is off the shelf. Asking "does the warband carry this refit
  // anywhere" was the same question only while a warband could hold one of each hull.
  const takers = (formationId) => roster.filter((entry) => entry.formationId === formationId && !entry.refit);
  const refits = (refitShelf ?? shelfRefitsFor({ seed, battle, roster }))
    .map((id) => REFITS[id])
    .filter((refit) => refit && takers(refit.formationId).length > 0)
    .map((refit) => ({
      kind: "refit",
      id: refit.id,
      name: refit.name,
      cost: REFIT_COST,
      text: refit.text,
      formationId: refit.formationId,
      affordable: REFIT_COST <= purse,
    }));
  const services = Object.values(SERVICES)
    .filter((service) => (service.id === "requisition" ? true : damaged))
    .map((service) => ({ kind: "service", ...service, affordable: service.cost <= purse }));
  return [...units, ...refits, ...services];
};

// One line on what the money buys, read off the wargame profile so the shelf can never
// disagree with the board.
const noteFor = (formationId) => statLineFor(battleProfileFor(formationId));

export const canAfford = ({ purse, cost }) => Number.isFinite(purse) && purse >= cost;
