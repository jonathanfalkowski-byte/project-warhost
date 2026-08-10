import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBattlePlayback,
  buildDoctrineSignatureBeats,
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
  formations: [{ id: "harpoon", name: "GRAV-SNARE TANK" }, { id: "railjack", name: "BASTION BATTLE TANK" }],
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

test("formation losses become authored playback beats before operation resolution", () => {
  const input = fixture();
  input.formationFates = [
    { formationId: "harpoon", formation: input.formations[0], orderIndex: 0, fate: "missing", battleLabel: "CUT OFF", at: 108, detail: "The route was severed.", history: [{ label: "DAMAGED", state: "damaged", source: "collision", at: 45, cause: "VEIL SCREEN" }, { label: "CUT OFF", state: "cut-off", source: "extraction", at: 108 }] },
    { formationId: "railjack", formation: input.formations[1], orderIndex: 1, fate: "destroyed", battleLabel: "DESTROYED", at: 115, detail: "Lost under pursuit." },
    { formationId: "reserve", formation: { id: "reserve", name: "RESERVE" }, orderIndex: 2, fate: "extracted", battleLabel: "EXTRACTED", at: 120, detail: "Clear." },
  ];
  const beats = buildBattlePlayback(input);
  const fateBeats = beats.filter((beat) => beat.kind === "fate");
  assert.deepEqual(fateBeats.map((beat) => beat.playerFormationIds), [["harpoon"], ["railjack"]]);
  assert.deepEqual(fateBeats.map((beat) => beat.at), [108, 115]);
  assert.match(fateBeats[0].title, /cut off/i);
  assert.match(fateBeats[1].title, /destroyed/i);
  assert.equal(beats.at(-1).kind, "complete");
  const collisionResult = beats.find((beat) => beat.id === "enemy-result-veil");
  assert.deepEqual(collisionResult.statusChanges.map(({ formationName, label }) => [formationName, label]), [["GRAV-SNARE TANK", "DAMAGED"]]);
});

test("late enemy survivors visibly approach, intercept, pursue, and cut off a formation", () => {
  const input = fixture();
  input.profile.completeAt = 398;
  input.profile.extractedCount = 2;
  input.profile.overrun = 38;
  input.profile.enemyClashes.push({
    id: "sever", actionAt: 330, label: "GANTRY SEVER", creates: "CUT OFF", pressure: { type: "PURSUIT" }, disrupted: false,
    resultText: "THE PURSUIT BREAKS THROUGH", eventText: "Gantry Sever reaches extraction.", routeState: "passed",
  });
  input.events.push({ at: 360, text: "HELIOCH RELIEF reaches extraction." });
  input.reinforcementWave = { name: "HELIOCH RELIEF", arrivalAt: 360, approachDuration: 45 };
  input.formationFates = [{
    formationId: "hauler", formation: { id: "hauler", name: "ARMOURED RECOVERY CARRIER" }, orderIndex: 4, fate: "missing", battleLabel: "CUT OFF", at: 388,
    detail: "Last contact during GANTRY SEVER.", history: [{ label: "CUT OFF", state: "cut-off", source: "extraction", at: 388, cause: "Extraction route severed" }],
  }];

  const beats = buildBattlePlayback(input);
  const ids = beats.map((beat) => beat.id);
  assert.ok(ids.indexOf("reinforcement-approach") < ids.indexOf("extraction-intercept"));
  assert.ok(ids.indexOf("extraction-intercept") < ids.indexOf("formation-fate-hauler"));
  assert.ok(ids.indexOf("formation-fate-hauler") < ids.indexOf("operation-resolved"));
  assert.equal(beats.find((beat) => beat.id === "extraction-intercept").reinforcementFocus, true);
  const pursuit = beats.find((beat) => beat.id === "formation-fate-hauler");
  assert.equal(pursuit.enemyFormationIndex, 1);
  assert.deepEqual(pursuit.statusChanges.map(({ formationName, label }) => [formationName, label]), [["ARMOURED RECOVERY CARRIER", "CUT OFF"]]);
});

test("an early extraction does not invent an enemy intercept", () => {
  const input = fixture();
  input.profile.overrun = 0;
  input.reinforcementWave = { name: "HELIOCH RELIEF", arrivalAt: 90, approachDuration: 45 };
  const ids = buildBattlePlayback(input).map((beat) => beat.id);
  assert.equal(ids.includes("reinforcement-approach"), false);
  assert.equal(ids.includes("extraction-intercept"), false);
});

const doctrineFixture = (playbookId, triggered = true) => ({
  playbookId,
  profile: { doctrine: { triggered, result: triggered ? "ADVANTAGE ACTIVE" : "EXPOSURE ACTIVE" } },
  handoffs: [
    { sourceId: "third", receiverId: "first" },
    { sourceId: "first", receiverId: "fourth" },
    { sourceId: "fourth", receiverId: "second" },
  ],
  formations: [
    { id: "first", name: "FIRST" },
    { id: "second", name: "SECOND" },
    { id: "third", name: "THIRD" },
    { id: "fourth", name: "FOURTH" },
  ],
});

test("each doctrine shows player play, field change, enemy counter, then outcome", () => {
  for (const playbookId of ["trapline", "spear", "pressure"]) {
    const beats = buildDoctrineSignatureBeats(doctrineFixture(playbookId));
    assert.deepEqual(beats.map((beat) => beat.doctrinePhase), ["player-play", "field-change", "enemy-counter", "outcome"]);
    assert.deepEqual(beats.map((beat) => beat.at), [5, 10, 15, 20]);
    assert.equal(beats[0].enemyFormationIndices, undefined);
    assert.ok(beats[2].enemyFormationIndices.length >= 1);
  }
});

test("doctrine signatures preserve staffed slot order and expose different enemy responses", () => {
  const trapline = buildDoctrineSignatureBeats(doctrineFixture("trapline"));
  const spear = buildDoctrineSignatureBeats(doctrineFixture("spear"));
  const pressure = buildDoctrineSignatureBeats(doctrineFixture("pressure", false));

  assert.deepEqual(trapline[0].playerFormationIds, ["third", "first"]);
  assert.deepEqual(spear[2].enemyFormationIndices, [0, 1]);
  assert.match(spear[3].title, /rear guard/i);
  assert.match(pressure[3].title, /fail to regroup/i);
  assert.notEqual(trapline[2].title, pressure[2].title);
});

test("unknown doctrines do not invent a signature sequence", () => {
  assert.deepEqual(buildDoctrineSignatureBeats(doctrineFixture("unknown")), []);
  assert.deepEqual(buildDoctrineSignatureBeats({ playbookId: "trapline", profile: null }), []);
});
