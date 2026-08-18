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
// Route convention: five routes, west flank to east flank, matching the deployment slots.
// The LAST landmark of a route is the objective that formation is holding for scoring.

import { resolveRoute } from "./battleTerrain.js";

const plan = (id, name, summary, shape, routes) => ({ id, name, summary, shape, routes });

export const BATTLE_PLANS = {
  dominion: [
    plan(
      "trapline", "TRAPLINE",
      "Take three cheap objectives instead of one expensive one, and screen the ground between them.",
      "Wide. Nothing is ever massed, and nothing is ever alone either.",
      [
        ["westGate", "westApproach", "westWorks"],
        ["southWest", "southRelay"],
        ["centreSouth", "reactor"],
        ["southEast", "eastApproach", "eastGantry"],
        ["eastGate", "eastApproach", "eastGantry"],
      ],
    ),
    plan(
      "spear", "SPEAR",
      "One road, the short one. Everything down the centre onto the two-point Reactor Spine.",
      "A column. It arrives together or not at all.",
      [
        ["southWest", "southRelay"],
        ["centreSouth", "reactor"],
        ["centreSouth", "reactor"],
        ["centreSouth", "reactor"],
        ["southEast", "eastApproach", "eastGantry"],
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
        ["westGate", "westApproach", "westWorks"],
        ["westGate", "westApproach", "westWorks"],
        ["southRelay"],
        ["eastGate", "eastApproach", "eastGantry"],
        ["eastGate", "eastApproach", "eastGantry"],
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
        ["southWest", "westApproach", "westWorks"],
        ["centreSouth", "reactor"],
        ["centreSouth", "reactor"],
        ["centreSouth", "reactor"],
        ["southEast", "eastApproach", "eastGantry"],
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
        ["southWest", "centreSouth", "reactor"],
        ["centreSouth", "reactor"],
        ["centreSouth", "reactor", "centreNorth"],
        ["centreSouth", "reactor", "centreNorth"],
        ["southEast", "centreSouth", "reactor"],
      ],
    ),
    plan(
      "crossfire", "CROSSFIRE",
      "Put one formation on the Reactor Spine as bait and set the rest around it, inside range of whatever comes.",
      "A pocket. It gives them one target and shoots them from three sides for taking it.",
      [
        ["southWest", "centreSouth"],
        ["centreSouth", "reactor"],
        ["centreSouth", "reactor"],
        ["southEast", "centreSouth"],
        ["southEast", "eastApproach", "eastGantry"],
      ],
    ),
  ],
  safeguard: [
    plan(
      "home-line", "HOME LINE",
      "Your own half, held across its whole width. They can have the rest of the board.",
      "A line. It never contests anything it cannot already reach.",
      [
        ["westGate", "westApproach", "westWorks"],
        ["southWest", "southRelay"],
        ["southRelay"],
        ["southEast", "eastApproach", "eastGantry"],
        ["eastGate", "eastApproach", "eastGantry"],
      ],
    ),
    plan(
      "tight-shell", "TIGHT SHELL",
      "Everything on the two objectives you start nearest, close enough that nothing is ever caught alone.",
      "A block. Overwhelming where it stands and absent everywhere else.",
      [
        ["southWest", "southRelay"],
        ["southWest", "southRelay"],
        ["southRelay"],
        ["centreSouth", "reactor"],
        ["southEast", "centreSouth", "reactor"],
      ],
    ),
    plan(
      "counterweight", "COUNTERWEIGHT",
      "Two hold the home relay; the other three stand on the ground the enemy needs, and score nothing for it.",
      "A denial. It wins on their total rather than yours — under SAFEGUARD that ground pays you nothing at all.",
      [
        ["westGate", "westApproach", "westWorks"],
        ["southWest", "southRelay"],
        ["southRelay"],
        ["centreSouth", "reactor"],
        ["eastGate", "eastApproach", "eastGantry"],
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
export const routePointsFor = (battlePlan, slotIndex, missionId, mirrored = false) => (
  resolveRoute(battlePlan?.routes?.[slotIndex] ?? [], missionId, { mirrored })
);

// Where a route ends is the ground that formation is holding, which is what the scoring
// rule reads. Derived from the path rather than declared separately, so a plan can never
// claim to take an objective its own route never reaches.
export const routeDestinationFor = (battlePlan, slotIndex, objectives = [], missionId, mirrored = false) => {
  const points = routePointsFor(battlePlan, slotIndex, missionId, mirrored);
  const end = points.at(-1);
  if (!end) return null;
  return objectives.find((objective) => Math.hypot(objective.x - end.x, objective.y - end.y) < 1)?.id ?? null;
};
