import test from "node:test";
import assert from "node:assert/strict";

import { HOVER_CARD_GAP, hoverCardBoundsFor, hoverCardPlacementFor } from "../src/hoverCardPlacement.js";

const VIEWPORT = { width: 1600, height: 950 };
const BOUNDS = { top: 92, bottom: 846 };
const rowAt = (top, height = 58, left = 5, right = 255) => ({ top, bottom: top + height, left, right });

const place = (anchor, cardHeight = 385, cardWidth = 268) => hoverCardPlacementFor({
  anchor, cardHeight, cardWidth, viewport: VIEWPORT, bounds: BOUNDS,
});

test("the card sits beside the hovered row, aligned to it", () => {
  const anchor = rowAt(400);
  const placement = place(anchor);
  assert.equal(placement.left, anchor.right + HOVER_CARD_GAP, "the card is not beside the row");
  assert.equal(placement.top, anchor.top, "the card is not aligned to the row");
});

test("it follows the row rather than staying put", () => {
  // The regression that prompted this: a card parked in a corner answered the same way
  // no matter which formation was hovered.
  // Kept inside the band (bottom 846 less a 385-tall card leaves 461 as the lowest
  // unclamped row) so this asserts tracking, not clamping — clamping has its own test.
  const tops = [200, 300, 400, 461].map((top) => place(rowAt(top)).top);
  assert.deepEqual(tops, [200, 300, 400, 461]);
  // And distinct rows must never resolve to the same place.
  assert.equal(new Set(tops).size, tops.length);
});

test("it never rides up over the mission chrome above the band", () => {
  // A row scrolled to the very top of the rail must not push the card over the header
  // and the top-of-map chrome — the original complaint.
  for (const top of [-200, 0, 40, 91]) {
    assert.equal(place(rowAt(top)).top, BOUNDS.top, `a row at ${top} escaped the band`);
  }
});

test("it never runs off the bottom past the footer", () => {
  for (const top of [700, 800, 900, 1400]) {
    const placement = place(rowAt(top));
    assert.ok(placement.top + 385 <= BOUNDS.bottom, `a row at ${top} overflowed the band`);
    assert.equal(placement.top, BOUNDS.bottom - 385);
  }
});

test("a card taller than the band pins to the top and scrolls rather than inverting", () => {
  const placement = place(rowAt(600), 2000);
  assert.equal(placement.top, BOUNDS.top);
  assert.ok(placement.top >= BOUNDS.top, "the card inverted out of the band");
});

test("it flips to the other side when there is no room to the right", () => {
  // A formation marker near the eastern edge of the battlefield.
  const anchor = { top: 400, bottom: 440, left: 1500, right: 1560 };
  const placement = place(anchor);
  assert.ok(placement.left + 268 <= VIEWPORT.width, "the card overflowed the viewport");
  assert.equal(placement.left, anchor.left - 268 - HOVER_CARD_GAP);
});

test("it stays on screen even when neither side fits", () => {
  const anchor = { top: 400, bottom: 440, left: 20, right: 1580 };
  const placement = place(anchor);
  assert.ok(placement.left >= HOVER_CARD_GAP);
  assert.ok(placement.left + 268 <= VIEWPORT.width);
});

test("the notch keeps pointing at the row after the card clamps away from it", () => {
  // Clamped to the top of the band, but the row is far below: the notch has to travel
  // down the card's edge or it points at nothing.
  const low = place(rowAt(-300));
  assert.equal(low.top, BOUNDS.top);
  assert.ok(low.notchTop >= 14 && low.notchTop <= 385 - 14);

  // Unclamped, the notch sits level with the middle of the row.
  const anchor = rowAt(400);
  const centred = place(anchor);
  assert.equal(centred.notchTop, Math.round((anchor.top + anchor.bottom) / 2 - centred.top));
});

test("the band is derived from the real header and footer", () => {
  const bounds = hoverCardBoundsFor({ headerBottom: 84, footerTop: 856, viewportHeight: 950 });
  assert.equal(bounds.top, 84 + HOVER_CARD_GAP);
  assert.equal(bounds.bottom, 856 - HOVER_CARD_GAP);
  // Missing chrome falls back to the viewport rather than to zero height.
  const fallback = hoverCardBoundsFor({ viewportHeight: 950 });
  assert.equal(fallback.top, HOVER_CARD_GAP);
  assert.equal(fallback.bottom, 950 - HOVER_CARD_GAP);
});

test("malformed input yields no placement rather than a card at 0,0", () => {
  assert.equal(hoverCardPlacementFor({}), null);
  assert.equal(hoverCardPlacementFor({ anchor: rowAt(400) }), null);
  assert.equal(hoverCardPlacementFor({ anchor: null, viewport: VIEWPORT, bounds: BOUNDS }), null);
  // A card not yet measured still lands inside the band.
  const unmeasured = hoverCardPlacementFor({ anchor: rowAt(400), viewport: VIEWPORT, bounds: BOUNDS });
  assert.ok(unmeasured.top >= BOUNDS.top);
});
