import test from "node:test";
import assert from "node:assert/strict";
import { resolveAshenCollision } from "../src/enemyCollision.js";

const veilCounterNames = ["FURNACE DRAGNET", "VEIL FRACTURE", "FURNACE FEED"];

test("keeps the collision unread until both action stops are staffed", () => {
  assert.deepEqual(resolveAshenCollision({
    firstWindowStaffed: false,
    firstManeuverName: "FURNACE DRAGNET",
    veilCounterNames,
  }), { outcome: "unread", actorName: null });
});

test("traps the Veil when the first combo counters it", () => {
  assert.deepEqual(resolveAshenCollision({
    firstWindowStaffed: true,
    firstManeuverName: "FURNACE DRAGNET",
    veilCounterNames,
  }), { outcome: "trapped", actorName: "FURNACE DRAGNET" });
});

test("lets an active first-two-stop refit protocol trap the Veil", () => {
  assert.deepEqual(resolveAshenCollision({
    firstWindowStaffed: true,
    firstManeuverName: null,
    activeProtocolNames: ["VEIL FRACTURE"],
    veilCounterNames,
  }), { outcome: "trapped", actorName: "VEIL FRACTURE" });
});

test("diverts the Veil when a non-countering combo fires", () => {
  assert.deepEqual(resolveAshenCollision({
    firstWindowStaffed: true,
    firstManeuverName: "TOWED BASTION",
    veilCounterNames,
  }), { outcome: "diverted", actorName: "TOWED BASTION" });
});

test("passes the Veil onward when no automatic reaction fires", () => {
  assert.deepEqual(resolveAshenCollision({
    firstWindowStaffed: true,
    firstManeuverName: null,
    veilCounterNames,
  }), { outcome: "passed", actorName: null });
});

test("a named counter cannot trap the Veil when the assigned formations are overrun", () => {
  assert.deepEqual(resolveAshenCollision({
    firstWindowStaffed: true,
    firstManeuverName: "FURNACE DRAGNET",
    veilCounterNames,
    resolutionOutcome: "overrun",
  }), { outcome: "passed", actorName: null });
});

test("a checked formation pair can still spring the authored trap", () => {
  assert.deepEqual(resolveAshenCollision({
    firstWindowStaffed: true,
    firstManeuverName: "FURNACE DRAGNET",
    veilCounterNames,
    resolutionOutcome: "checked",
  }), { outcome: "trapped", actorName: "FURNACE DRAGNET" });
});
