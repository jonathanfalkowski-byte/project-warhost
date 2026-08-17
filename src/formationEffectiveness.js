// Per-formation effectiveness: what each unit actually did, in the position and role it
// was given.
//
// The debrief already explained the mission — which orders landed, what placement cost,
// how many formations extracted. What it never did was attribute any of that to a
// formation. In a game whose whole decision is which units to field and where to put
// them, "the mission went badly" is not feedback; "STOP 04 answered neither demand and
// held no counter for the order aimed at it" is.
//
// Every number here is derived from resolved state, never invented. The three components
// are the three things a placement can contribute:
//
//   STOP FIT   — did it answer the demands its own action stop made of it
//   COMBO      — did it feed or receive a chain
//   COUNTER    — did it hold the capabilities that break the enemy orders aimed at it
//
// Weighted 40/20/40: fit and counter are the decisions the player makes, combos are the
// bonus layer and are deliberately never worth more than either.

import { ENEMY_RESPONSE_WINDOWS } from "./enemyPlanData.js";

const WEIGHTS = Object.freeze({ fit: 0.4, combo: 0.2, counter: 0.4 });

const ratio = (part, whole) => (whole > 0 ? part / whole : 1);
const percent = (value) => Math.round(100 * value);

const gradeFor = (effectiveness) => (
  effectiveness >= 85 ? "DECISIVE"
    : effectiveness >= 65 ? "EFFECTIVE"
      : effectiveness >= 40 ? "PARTIAL"
        : "INEFFECTIVE"
);

// The enemy orders this stop was in position to answer.
const ordersFacingStop = (stopIndex) => ENEMY_RESPONSE_WINDOWS
  .map((window, stageIndex) => (window.includes(stopIndex) ? stageIndex : -1))
  .filter((stageIndex) => stageIndex >= 0);

const counterReadingFor = ({ stopIndex, capabilities, formationId, clashes }) => {
  const held = new Set(capabilities);
  const orders = ordersFacingStop(stopIndex).map((stageIndex) => {
    const clash = clashes[stageIndex];
    if (!clash) return null;
    const required = Array.isArray(clash.counterCapabilities) ? clash.counterCapabilities : [];
    const carried = required.filter((capability) => held.has(capability));
    return {
      number: `E${stageIndex + 1}`,
      label: clash.label,
      required,
      carried,
      // Whether the order broke is a property of the whole response window, not of this
      // formation alone — so it is reported next to the formation's own contribution
      // rather than folded into its score.
      broken: Boolean(clash.disrupted),
      outcome: clash.resolution?.outcome ?? null,
      engaged: Array.isArray(clash.resolution?.actorIds) && clash.resolution.actorIds.includes(formationId),
    };
  }).filter(Boolean);

  const required = orders.reduce((sum, order) => sum + order.required.length, 0);
  const carried = orders.reduce((sum, order) => sum + order.carried.length, 0);
  return { orders, required, carried, share: ratio(carried, required) };
};

export const formationEffectivenessFor = ({ readiness = {}, clashes = [], handoffs = [], playbook } = {}) => {
  if (!playbook?.roles) return [];
  return playbook.roles.map((role, stopIndex) => {
    const placement = readiness[role.id];
    if (!placement) {
      return {
        stopNumber: stopIndex + 1,
        roleLabel: role.label,
        formationId: null,
        formationName: null,
        staffed: false,
        effectiveness: 0,
        grade: "UNSTAFFED",
        worked: "Nothing was placed here.",
        change: `Staff ${role.label} — an empty stop answers no demand and no enemy order.`,
      };
    }

    const demanded = placement.demands.length;
    const matched = placement.matchedCapabilities.length;
    const fitShare = ratio(matched, demanded);

    const inboundName = handoffs[stopIndex - 1]?.maneuver?.name ?? null;
    const outboundName = handoffs[stopIndex]?.maneuver?.name ?? null;
    const comboNames = [inboundName, outboundName].filter(Boolean);
    // A stop at either end of the plan has only one window available to it, so scoring
    // against two would penalise the lead and recovery elements for their position.
    const comboWindows = (stopIndex > 0 ? 1 : 0) + (stopIndex < playbook.roles.length - 1 ? 1 : 0);
    const comboShare = ratio(comboNames.length, comboWindows);

    const counter = counterReadingFor({
      stopIndex,
      capabilities: placement.capabilities,
      formationId: placement.formationId,
      clashes,
    });

    const effectiveness = Math.max(0, Math.min(100, Math.round(percent(
      WEIGHTS.fit * fitShare + WEIGHTS.combo * comboShare + WEIGHTS.counter * counter.share,
    ))));

    const unanswered = placement.demands.filter((demand) => !placement.matchedCapabilities.includes(demand));
    const missedCounters = counter.orders.flatMap((order) => order.required.filter((capability) => !order.carried.includes(capability)));
    const brokenOrders = counter.orders.filter((order) => order.broken);

    // The strongest true statement about what this unit contributed, and the single
    // highest-leverage change. Both name capabilities and stops, so they are actionable
    // on the next attempt rather than merely descriptive.
    const worked = [
      matched > 0 ? `answered ${placement.matchedCapabilities.join(" / ")} at ${role.label}` : null,
      counter.carried > 0 ? `held ${[...new Set(counter.orders.flatMap((order) => order.carried))].join(" / ")} against ${counter.orders.map((order) => order.number).join(" and ")}` : null,
      comboNames.length > 0 ? `ran ${comboNames.join(" and ")}` : null,
    ].filter(Boolean);

    const change = unanswered.length > 0 && missedCounters.length > 0
      ? `Missed ${unanswered.join(" / ")} at its own stop and ${[...new Set(missedCounters)].join(" / ")} against ${counter.orders.map((order) => order.number).join(" and ")}. A formation carrying either would change this stop.`
      : unanswered.length > 0
        ? `Missed ${unanswered.join(" / ")} at its own stop, conceding ${placement.taskDelay}s. A refit or a different formation here recovers that.`
        : missedCounters.length > 0
          ? `Answered its stop fully but held no ${[...new Set(missedCounters)].join(" / ")} for ${counter.orders.map((order) => order.number).join(" and ")}.`
          : comboNames.length < comboWindows
            ? "Fully matched. The only gain left here is an unused combo window."
            : "Nothing to change — matched its stop, held its counters, and ran every combo window available to it.";

    return {
      stopNumber: stopIndex + 1,
      roleLabel: role.label,
      formationId: placement.formationId,
      formationName: placement.formationName,
      refitName: placement.refitName,
      staffed: true,
      effectiveness,
      grade: gradeFor(effectiveness),
      fit: { matched, demanded, percent: percent(fitShare), unanswered },
      combo: { names: comboNames, windows: comboWindows, percent: percent(comboShare) },
      counter: { ...counter, percent: percent(counter.share), brokenCount: brokenOrders.length },
      secondsConceded: placement.taskDelay ?? 0,
      worked: worked.length > 0 ? `It ${worked.join(", ")}.` : "It executed its stop but answered nothing it was placed against.",
      change,
    };
  });
};

// The one-line verdict for the whole list, so the player can tell at a glance whether the
// mission was decided by the units they picked or by where they put them.
export const effectivenessSummary = (rows) => {
  const staffed = rows.filter((row) => row.staffed);
  if (staffed.length === 0) return { average: 0, best: null, worst: null };
  const average = Math.round(staffed.reduce((sum, row) => sum + row.effectiveness, 0) / staffed.length);
  const ranked = [...staffed].sort((a, b) => b.effectiveness - a.effectiveness);
  return { average, best: ranked[0], worst: ranked.at(-1) };
};
