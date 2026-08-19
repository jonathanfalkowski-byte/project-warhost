// The nine plans: three strategies for each of the three dispositions.
//
// A strategy is a PLAN WITH PATHS, the way the operation model's plays were — a route per
// deployment slot, written against named ground, ending on the objective that slot is
// meant to take. It is not five objective assignments. Five assignments have no shape:
// you cannot look at them and see a pincer, a refused flank, or a screen holding the gate
// the column has to pass through. A path you can draw on the board before committing, and
// then watch the army follow.
//
// The paths also make the choice honest. A flank route is genuinely longer and genuinely
// misses the fight in the centre — that cost is real, measured by the sweep, and it is
// what makes picking between three plans a decision rather than a preference.
//
// A plan is LANES, not slots.
//
// It used to be five routes, one per deployment slot, west flank to east flank. That is the
// same thing as long as an army is always five formations — and it is the reason a bigger
// army made the game shallower rather than deeper. Measured before changing anything: grow
// the armies to twelve and cycle the extra hulls onto the five authored routes, and the gap
// between the best list and an average one falls from 9 victory points to 1. Everything
// clumps, nothing is distinguishable, and what you brought stops mattering. Give the same
// twelve hulls plans that actually spread them and the gap is 9 to 17. The problem was
// never the number of formations. It was writing a plan as a list of slots.
//
// So a plan says WHERE ITS WEIGHT GOES: a handful of lanes, each a route to named ground,
// each with a share of whatever army is walking it. Five formations down a plan with lanes
// 1/1/1/2 is exactly the five routes that used to be written out by hand — every plan here
// converts with no change to any battle, which is what the tests hold — and eleven
// formations down the same plan is the same doctrine, wider.
//
// Route convention: lanes are written west flank to east flank, and the LAST landmark of a
// route is the objective that formation is holding for scoring.

import { resolveRoute } from "./battleTerrain.js";

// `share` is a weight rather than a count: a lane with twice the share takes twice the
// army, whatever size the army is.
const lane = (share, ...route) => ({ share, route });

const plan = (id, name, summary, shape, lanes) => ({
  id, name, summary, shape, lanes,
  // What this plan is at the size it was written for, which is what everything that reads
  // `routes` still expects to see.
  get routes() { return fillLanes(lanes, laneTotal(lanes)); },
});

// THE FILL. How an army of any size distributes itself down a plan's lanes: proportional to
// the shares, largest remainder first, and never fewer than one formation in a lane the plan
// still contains. An army smaller than the plan has lanes keeps the heaviest of them — a
// three-hull force walking a four-lane plan gives up its lightest lane rather than
// spreading itself thinner than the doctrine ever intended.
export const laneTotal = (lanes = []) => lanes.reduce((sum, entry) => sum + entry.share, 0);

export const laneFillFor = (lanes = [], size = 0) => {
  const wanted = Math.max(1, Math.round(size));
  if (lanes.length === 0) return [];
  if (wanted <= lanes.length) {
    return lanes
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => right.entry.share - left.entry.share || left.index - right.index)
      .slice(0, wanted)
      .sort((left, right) => left.index - right.index)
      .map(({ entry }) => ({ ...entry, count: 1 }));
  }
  const total = laneTotal(lanes);
  const exact = lanes.map((entry) => (entry.share / total) * wanted);
  const counts = exact.map((value) => Math.max(1, Math.floor(value)));
  const spent = () => counts.reduce((sum, value) => sum + value, 0);
  // Whatever the floors left over goes to the lanes with most of a formation owed to them.
  const owed = exact
    .map((value, index) => ({ index, part: value - Math.floor(value) }))
    .sort((left, right) => right.part - left.part || left.index - right.index);
  for (let i = 0; spent() < wanted; i = (i + 1) % owed.length) counts[owed[i].index] += 1;
  // And a floor of one can overshoot on a plan with one very heavy lane and several light
  // ones, so the heaviest gives back what it has to.
  while (spent() > wanted) {
    const heaviest = counts.reduce((best, value, index) => (value > counts[best] ? index : best), 0);
    if (counts[heaviest] <= 1) break;
    counts[heaviest] -= 1;
  }
  return lanes.map((entry, index) => ({ ...entry, count: counts[index] }));
};

// The lanes expanded into one route per formation, in board order west to east — which is
// the order the deployment slots are in, so a formation still walks the lane nearest where
// it is standing.
export const fillLanes = (lanes = [], size = 0) => laneFillFor(lanes, size)
  .flatMap((entry) => Array.from({ length: entry.count }, () => entry.route));

export const BATTLE_PLANS = {
  dominion: [
    plan(
      "trapline", "TRAPLINE",
      "Take three cheap objectives instead of one expensive one, and screen the ground between them.",
      "Wide. Nothing is ever massed, and nothing is ever alone either.",
      [
        lane(1, "westGate", "westApproach", "westWorks"),
        lane(1, "southWest", "southRelay"),
        lane(1, "centreSouth", "reactor"),
        lane(1, "southEast", "eastApproach", "eastGantry"),
        lane(1, "eastGate", "eastApproach", "eastGantry"),
      ],
    ),
    plan(
      "spear", "SPEAR",
      "One road, the short one. Everything down the centre onto the two-point Reactor Spine.",
      "A column. It arrives together or not at all.",
      [
        lane(1, "southWest", "southRelay"),
        // THREE SHARES down the one road, which is what makes this a column rather than a
        // line: whatever the army is, three fifths of it is on the Spine.
        lane(3, "centreSouth", "reactor"),
        lane(1, "southEast", "eastApproach", "eastGantry"),
      ],
    ),
    plan(
      "pressure", "PRESSURE",
      "Refuse the Spine entirely. Take the cheap ground on both flanks and your own relay, and let them have the middle.",
      "Wide and shallow. Three markers to their two, and nothing of yours is ever in the middle.",
      // The fifth slot used to walk PAST the gantry to the eastern approach into their
      // half, which is ground that scores nothing under a disposition that scores only
      // ground — a fifth of the army standing somewhere DOMINION does not pay for. It won
      // 1.6% of the battles it was declared in, and it read as a plan nobody should take
      // rather than as the bug it was. The old enemy was weak enough to hide it.
      // Both eastern slots go round the OUTSIDE, through the gate rather than across the
      // shoulder. Cutting the corner walks straight through the slag, and a plan that puts
      // three formations down one flank cannot afford to have all three of them crawling —
      // it was dead on the Circuit at 6% once there was ground in the way. Routing a plan
      // around the terrain is the whole point of there being terrain.
      // It used to give up one whole flank and overload the other, which is a losing
      // arithmetic under a disposition that pays for markers: it won 4% before there was
      // terrain and 0% after. This is the alternative sum instead — three cheap markers
      // against their one expensive one — and it is the only dominion line that does not
      // want the Spine at all. Both flanks go round the OUTSIDE through the gates, because
      // cutting the corner walks through the slag.
      [
        lane(2, "westGate", "westApproach", "westWorks"),
        lane(1, "southRelay"),
        lane(2, "eastGate", "eastApproach", "eastGantry"),
      ],
    ),
  ],
  eradication: [
    plan(
      "headhunt", "HEADHUNT",
      "Straight at where their army will be — all of it. Three onto the Reactor Spine, and one after each of their flankers.",
      // It was five formations onto the Reactor Spine, and it won 90% of every battle it
      // was declared in — the only line in the game close to an auto-win, and it had been
      // sitting a tenth of a point under the threshold for a while. The pairing layer
      // rewards standing together, so a plan that stands EVERYTHING together collected all
      // of it at once and tipped over. Two of the five hunt wide now: it kills as much and
      // it stops being a knot.
      "A rake. Nothing walks away, and nothing stands close enough to be shelled together.",
      [
        lane(1, "southWest", "westApproach", "westWorks"),
        lane(3, "centreSouth", "reactor"),
        lane(1, "southEast", "eastApproach", "eastGantry"),
      ],
    ),
    // MEASURED AND REVERSED. Both of these have slots that end on ground no board scores,
    // and the reasoning for fixing that was sound on paper: ERADICATION scores no markers,
    // but standing on one still CONTESTS it, and denying the other army a point is worth
    // exactly what taking one is — so a plan whose slots end on nothing should be handing
    // the board over for free.
    //
    // Rewritten so all five slots ended on markers, ERADICATION fell from 40.1% to 13.2%
    // and CROSSFIRE to zero. The theory was wrong in a way worth writing down: a formation
    // standing still on a marker it does not score is a formation BEING SHOT, and
    // ERADICATION is paid for shooting. Under a disposition that scores no ground, holding
    // ground is not a cheap denial, it is a free target. Pushing past the marker at what is
    // behind it is the plan.
    plan(
      "decapitate", "DECAPITATE",
      "Three hold the centre in contact while two push straight through it at the guns behind.",
      "A spike. It needs fast formations in the middle two slots — anything slow never gets past the Reactor.",
      [
        lane(1, "southWest", "centreSouth", "reactor"),
        lane(1, "centreSouth", "reactor"),
        // The two that do not stop on the Spine but push through it. Two shares, so a
        // bigger army sends more of itself past the marker rather than more of itself
        // standing on it — which is the whole plan.
        lane(2, "centreSouth", "reactor", "centreNorth"),
        lane(1, "southEast", "centreSouth", "reactor"),
      ],
    ),
    plan(
      "crossfire", "CROSSFIRE",
      "Put one formation on the Reactor Spine as bait and set the rest around it, inside range of whatever comes.",
      "A pocket. It gives them one target and shoots them from three sides for taking it.",
      [
        lane(1, "southWest", "centreSouth"),
        lane(2, "centreSouth", "reactor"),
        lane(1, "southEast", "centreSouth"),
        lane(1, "southEast", "eastApproach", "eastGantry"),
      ],
    ),
  ],
  safeguard: [
    plan(
      "home-line", "HOME LINE",
      "Your own half, held across its whole width. They can have the rest of the board.",
      "A line. It never contests anything it cannot already reach.",
      [
        lane(1, "westGate", "westApproach", "westWorks"),
        lane(1, "southWest", "southRelay"),
        lane(1, "southRelay"),
        lane(1, "southEast", "eastApproach", "eastGantry"),
        lane(1, "eastGate", "eastApproach", "eastGantry"),
      ],
    ),
    plan(
      "tight-shell", "TIGHT SHELL",
      "Everything on the two objectives you start nearest, close enough that nothing is ever caught alone.",
      "A block. Overwhelming where it stands and absent everywhere else.",
      [
        lane(2, "southWest", "southRelay"),
        lane(1, "southRelay"),
        lane(1, "centreSouth", "reactor"),
        lane(1, "southEast", "centreSouth", "reactor"),
      ],
    ),
    plan(
      "counterweight", "COUNTERWEIGHT",
      "Two hold the home relay; the other three stand on the ground the enemy needs, and score nothing for it.",
      "A denial. It wins on their total rather than yours — under SAFEGUARD that ground pays you nothing at all.",
      [
        lane(1, "westGate", "westApproach", "westWorks"),
        lane(1, "southWest", "southRelay"),
        lane(1, "southRelay"),
        lane(1, "centreSouth", "reactor"),
        lane(1, "eastGate", "eastApproach", "eastGantry"),
      ],
    ),
  ],
};

export const plansFor = (dispositionId) => BATTLE_PLANS[dispositionId] ?? [];
export const planFor = (dispositionId, planId) => plansFor(dispositionId)
  .find((entry) => entry.id === planId) ?? plansFor(dispositionId)[0] ?? null;

// The route each deployment slot walks, as points on the board being fought over. The
// same plan resolves to different ground on a different mission, because the landmark
// names are roles rather than places — which is the only real test of whether these nine
// are doctrine or were overfitted to the board they were written on.
// `mirrored` walks the same plan from the northern edge, which is how the enemy gets to
// use the same doctrine the player does rather than five hand-authored routes per army.
// `size` is HOW MANY FORMATIONS ARE WALKING THIS PLAN, and `index` is which of them —
// counted across the army west to east, not across the deployment slots. They are the same
// number while an army is always five; they stop being the same the moment it is not, and
// the whole point of lanes is that the plan redistributes rather than leaving its later
// lanes unstaffed. Left out, it resolves at the size the plan was authored for.
export const routePointsFor = (battlePlan, index, missionId, mirrored = false, size = null) => {
  const routes = battlePlan?.lanes
    ? fillLanes(battlePlan.lanes, size ?? laneTotal(battlePlan.lanes))
    : (battlePlan?.routes ?? []);
  return resolveRoute(routes[index] ?? [], missionId, { mirrored });
};

// Where a route ends is the ground that formation is holding, which is what the scoring
// rule reads. Derived from the path rather than declared separately, so a plan can never
// claim to take an objective its own route never reaches.
export const routeDestinationFor = (battlePlan, index, objectives = [], missionId, mirrored = false, size = null) => {
  const points = routePointsFor(battlePlan, index, missionId, mirrored, size);
  const end = points.at(-1);
  if (!end) return null;
  return objectives.find((objective) => Math.hypot(objective.x - end.x, objective.y - end.y) < 1)?.id ?? null;
};
