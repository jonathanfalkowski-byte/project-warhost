import assert from "node:assert/strict";
import test from "node:test";

import { OPERATIONAL_DISPOSITIONS, resolveDispositionMatchup } from "../src/missionDisposition.js";

test("a disposition pairing generates an asymmetric mission", () => {
  const matchup = resolveDispositionMatchup({ playerDisposition: "disruption", enemyDisposition: "safeguard" });
  assert.equal(matchup.id, "disruption-vs-safeguard");
  assert.equal(matchup.title, "BREACH THE CORDON");
  assert.equal(matchup.player.name, "DISRUPTION");
  assert.equal(matchup.enemy.name, "SAFEGUARD");
});

test("an operation can give a disposition pairing its specific battlefield objective", () => {
  const matchup = resolveDispositionMatchup({
    playerDisposition: "safeguard",
    enemyDisposition: "dominion",
    mission: { title: "ASHEN PASSAGE", playerObjective: "Hold the relay.", enemyObjective: "Occupy the lift." },
  });
  assert.equal(matchup.title, "ASHEN PASSAGE");
  assert.equal(matchup.playerObjective, "Hold the relay.");
  assert.equal(matchup.enemyObjective, "Occupy the lift.");
});

test("the five dispositions produce twenty-five stable matchup ids", () => {
  const ids = Object.keys(OPERATIONAL_DISPOSITIONS).flatMap((playerDisposition) =>
    Object.keys(OPERATIONAL_DISPOSITIONS).map((enemyDisposition) =>
      resolveDispositionMatchup({ playerDisposition, enemyDisposition }).id));
  assert.equal(ids.length, 25);
  assert.equal(new Set(ids).size, 25);
});

test("unknown dispositions do not invent a mission", () => {
  assert.equal(resolveDispositionMatchup({ playerDisposition: "unknown", enemyDisposition: "safeguard" }), null);
  assert.equal(resolveDispositionMatchup({ playerDisposition: "disruption", enemyDisposition: "unknown" }), null);
});
