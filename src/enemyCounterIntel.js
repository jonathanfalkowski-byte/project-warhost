// The counter-board: what the player is allowed to know about the enemy's plan
// while they are still allowed to change theirs.
//
// The enemy plan has always carried the answer to "how do I stop this" — every order
// authors the capabilities that break it — but that data only ever reached the player
// after the fight, as an explanation of a result they could no longer affect. Command
// Seals were the visible symptom: a button spent against a situation the player had
// never been shown.
//
// This module turns that authored data into a pre-commitment read, gated by the
// intelligence tier already on each order. It answers "what is coming, when, what does
// it cost me, what breaks it, and does my current plan hold that" — and nothing else.
// It never reports an outcome. Resolution scores stay sealed until execution, so the
// board sharpens the decision rather than making it.

import { ENEMY_RESPONSE_WINDOWS, enemyPlanFor } from "./enemyPlanData.js";
import { roleDemandsFor } from "./operationData.js";

// Each tier trades certainty for surprise. KNOWN is a plan you can rehearse against;
// UNCERTAIN tells you what breaks it but not when it lands, so you cover it and accept
// the timing risk; UNKNOWN is the order a Command Seal exists to answer.
export const DISCLOSURE_TIERS = {
  KNOWN: { tier: "KNOWN", label: "CONFIRMED", identity: true, clock: true, counters: true, cost: true },
  UNCERTAIN: { tier: "UNCERTAIN", label: "PARTIAL", identity: true, clock: false, counters: true, cost: false },
  UNKNOWN: { tier: "UNKNOWN", label: "DARK", identity: false, clock: false, counters: false, cost: false },
};

export const disclosureFor = (intelligence) => DISCLOSURE_TIERS[intelligence] ?? DISCLOSURE_TIERS.UNKNOWN;

const stopLabel = (index) => `STOP ${String(index + 1).padStart(2, "0")}`;

const textList = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0) : []);

// A responder is a stop inside this order's response window, and whatever formation is
// standing there on the current plan. An empty stop is still reported: "nobody is in
// position" is exactly the read the player needs before committing.
const respondersFor = ({ window, playbook, assignments, formations, condition, counters }) => window.map((stopIndex) => {
  const role = playbook.roles[stopIndex];
  if (!role) return null;
  const formation = formations.find((item) => item.id === assignments[role.id]) ?? null;
  const capabilities = new Set(textList(formation?.capabilities));
  return {
    stopIndex,
    stopLabel: stopLabel(stopIndex),
    roleLabel: role.label,
    formationId: formation?.id ?? null,
    formationName: formation?.name ?? null,
    // What this stop is already being asked to do by the player's own play, so the
    // player can see when answering the enemy would cost them their own objective.
    stopDemands: roleDemandsFor(role, stopIndex, condition),
    answers: counters.filter((capability) => capabilities.has(capability)),
  };
}).filter(Boolean);

const guidanceFor = ({ disclosure, coverage, missing, answeredAt, label }) => {
  if (!disclosure.counters) {
    return "No counter identified. Hold a Command Seal to answer this order when it reveals itself.";
  }
  if (coverage === "unstaffed") {
    return `No formation is in position to answer ${label}. Staff the responding stops.`;
  }
  if (coverage === "answered") {
    return `${answeredAt.join(" and ")} can break this order.`;
  }
  if (coverage === "partial") {
    return `${answeredAt.join(" and ")} covers part of it. ${missing.join(" / ")} is still unanswered — refit or re-place a responder.`;
  }
  return `Nothing in the response window holds ${missing.join(" or ")}. Counter coverage remains open.`;
};

// The board for one enemy order, from the player's side of the table.
export const counterReadingFor = ({ stage, stageIndex, formation, playbook, assignments, formations, condition }) => {
  const disclosure = disclosureFor(stage.intelligence);
  const counters = disclosure.counters ? textList(stage.counterCapabilities) : [];
  const window = ENEMY_RESPONSE_WINDOWS[stageIndex] ?? [];
  const responders = respondersFor({ window, playbook, assignments, formations, condition, counters });
  const staffed = responders.filter((responder) => responder.formationId);
  const answeredCapabilities = [...new Set(responders.flatMap((responder) => responder.answers))];
  const missing = counters.filter((capability) => !answeredCapabilities.includes(capability));
  const answeredAt = responders.filter((responder) => responder.answers.length > 0).map((responder) => responder.stopLabel);

  const coverage = !disclosure.counters
    ? "dark"
    : staffed.length === 0
      ? "unstaffed"
      : missing.length === 0
        ? "answered"
        : answeredCapabilities.length > 0
          ? "partial"
          : "open";

  return {
    id: stage.id,
    number: `E${stageIndex + 1}`,
    intelligence: stage.intelligence,
    disclosure,
    // Identity, timing and price are each withheld independently, so a partial read is
    // genuinely partial rather than all-or-nothing.
    label: disclosure.identity ? stage.label : "UNIDENTIFIED ORDER",
    enemyName: disclosure.identity ? formation?.name ?? null : null,
    clock: disclosure.clock ? formation?.actionAt ?? null : null,
    cost: disclosure.cost ? stage.consequence : null,
    counters: disclosure.counters ? counters : null,
    responders,
    respondingStops: window.map(stopLabel),
    answeredCapabilities,
    missing,
    coverage,
    guidance: guidanceFor({ disclosure, coverage, missing, answeredAt, label: disclosure.identity ? stage.label : "this order" }),
  };
};

// The whole enemy plan as a counter-board, ordered the way it will execute.
export const enemyCounterBoardFor = ({ operation, playbook, assignments = {}, formations = [], condition } = {}) => {
  const enemyPlan = enemyPlanFor(operation);
  if (!playbook?.roles) return { name: enemyPlan.name, intent: enemyPlan.intent, objective: null, orders: [] };
  return {
    name: enemyPlan.name,
    intent: enemyPlan.intent,
    // The enemy's mission objective, not just its next three moves. Authored on the
    // operation and never previously shown next to the orders that serve it.
    objective: operation?.matchup?.enemyObjective ?? null,
    orders: enemyPlan.stages.map((stage, stageIndex) => counterReadingFor({
      stage,
      stageIndex,
      formation: enemyPlan.formations.find((item) => item.id === stage.formationId) ?? null,
      playbook,
      assignments,
      formations,
      condition,
    })),
  };
};

// One line for the whole board, for the rail header and the screen reader.
export const counterBoardSummary = (board) => {
  const readable = board.orders.filter((order) => order.disclosure.counters);
  if (readable.length === 0) return "NO ENEMY ORDER SCOUTED";
  const answered = readable.filter((order) => order.coverage === "answered").length;
  const dark = board.orders.length - readable.length;
  return `${answered} OF ${readable.length} SCOUTED ORDERS ANSWERED${dark > 0 ? ` · ${dark} DARK` : ""}`;
};
