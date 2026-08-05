import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBattlePlayback,
  playbackIndexAfterStep,
  playbackTimeForIndex,
} from "../src/battlePlayback.js";

const fixture = () => ({
  operation: { shortName: "Ashen Passage" },
  profile: {
    completeAt: 120,
    extractedCount: 4,
    enemyCollision: {
      revealed: true,
      title: "VEIL TRAPPED AT THE GATE",
      actorName: "GRAVITIC SNARE",
      sourceId: "harpoon",
      receiverId: "railjack",
      outcome: "trapped",
    },
    enemyClashes: [{
      id: "veil",
      actionAt: 45,
      label: "VEIL SCREEN",
      uses: null,
      creates: "BLINDED CORRIDOR",
      resultText: "GRAVITIC SNARE TRAPS IT",
      eventText: "The Veil Engines are trapped.",
      routeState: "trapped",
    }],
  },
  handoffs: [{
    id: "01-02",
    from: 0,
    sourceId: "harpoon",
    receiverId: "railjack",
    maneuver: { name: "GRAVITIC SNARE", passes: "DISPLACED", result: "FORWARD HOLD" },
  }],
  formations: [{ id: "harpoon", name: "HARPOON RIG" }, { id: "railjack", name: "RAILJACK" }],
  events: [{ at: 30, text: "Forward role has contact." }, { at: 45, text: "The Veil Engines are trapped." }],
  comboTimes: [35],
});

test("playback orders enemy intent, contact, response, and result by authored time", () => {
  const beats = buildBattlePlayback(fixture());
  assert.deepEqual(beats.map((beat) => beat.at), [0, 30, 30, 35, 40, 45, 120]);
  assert.deepEqual(beats.slice(1, 6).map((beat) => beat.kind), ["enemy-intent", "mission", "response", "contact", "result"]);
});

test("contact beat carries both plans and the collision outcome", () => {
  const contact = buildBattlePlayback(fixture()).find((beat) => beat.kind === "contact");
  assert.equal(contact.enemyFormationIndex, 0);
  assert.deepEqual(contact.playerFormationIds, ["harpoon", "railjack"]);
  assert.equal(contact.routeState, "trapped");
});

test("playback stepping and time lookup stay inside the authored sequence", () => {
  const beats = buildBattlePlayback(fixture());
  assert.equal(playbackIndexAfterStep(0, -1, beats.length), 0);
  assert.equal(playbackIndexAfterStep(beats.length - 1, 1, beats.length), beats.length - 1);
  assert.equal(playbackTimeForIndex(beats, 999), 120);
  assert.equal(playbackTimeForIndex([], 2), 0);
});
