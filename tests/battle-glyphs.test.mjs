import test from "node:test";
import assert from "node:assert/strict";

import { FALLBACK_GLYPH, FORMATION_GLYPHS, GLYPH_BOX, glyphFor } from "../src/battle/formationGlyphs.js";
import { FORMATIONS } from "../src/formationData.js";

// The board used to name every formation and draw none of them. The renders in
// public/assets are not markers - three megabytes each, no silhouette at marker size, and
// nine formations sharing five images - so the board gets glyphs instead.

test("every formation the game can field has a shape", () => {
  for (const formation of FORMATIONS) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(FORMATION_GLYPHS, formation.id),
      `${formation.name} (${formation.id}) has no glyph, so it would draw as the fallback`,
    );
  }
});

test("no two formations share a shape", () => {
  // THE PROPERTY THE ART FAILED. harpoon-rig.png is the asset for both the RECON TANK and
  // the SCOUT SKIMMER; four pairs of formations share one picture between them. Two markers
  // that cannot be told apart are one marker drawn twice, so this is a test rather than an
  // intention.
  const seen = new Map();
  for (const [id, paths] of Object.entries(FORMATION_GLYPHS)) {
    const key = paths.join("|");
    assert.ok(!seen.has(key), `${id} draws exactly the same shape as ${seen.get(key)}`);
    seen.set(key, id);
  }
  assert.equal(seen.size, Object.keys(FORMATION_GLYPHS).length);
});

test("a glyph is more than one mark, so the shapes can differ by more than size", () => {
  for (const [id, paths] of Object.entries(FORMATION_GLYPHS)) {
    assert.ok(Array.isArray(paths), `${id} is not a list of paths`);
    assert.ok(paths.length >= 3, `${id} is ${paths.length} path(s) - too plain to tell from another`);
    for (const d of paths) {
      assert.equal(typeof d, "string");
      assert.match(d, /^[Mm]/, `${id} has a path that does not start with a move`);
    }
  }
});

test("every mark stays inside the box it is drawn in", () => {
  // A path that runs outside the viewBox is clipped, and a clipped silhouette is a different
  // silhouette at every size it is drawn.
  const limit = Math.max(GLYPH_BOX.width, GLYPH_BOX.height);
  for (const [id, paths] of Object.entries(FORMATION_GLYPHS)) {
    for (const d of paths) {
      for (const value of d.match(/-?\d+(\.\d+)?/g) ?? []) {
        assert.ok(
          Math.abs(Number(value)) <= limit + 0.001,
          `${id} draws at ${value}, outside a ${GLYPH_BOX.width}x${GLYPH_BOX.height} box`,
        );
      }
    }
  }
});

test("an unknown hull draws something rather than nothing", () => {
  // Nothing reaches this today; the first test above is what keeps it that way. It exists so
  // a hull added tomorrow appears on the board while its own shape is being drawn.
  assert.deepEqual(glyphFor("a-hull-that-does-not-exist"), FALLBACK_GLYPH);
  assert.deepEqual(glyphFor(undefined), FALLBACK_GLYPH);
  assert.ok(FALLBACK_GLYPH.length > 0);
});

test("a known hull draws its own shape, not the fallback", () => {
  for (const formation of FORMATIONS) {
    assert.deepEqual(glyphFor(formation.id), FORMATION_GLYPHS[formation.id]);
    assert.notDeepEqual(glyphFor(formation.id), FALLBACK_GLYPH, `${formation.id} is drawn as the fallback`);
  }
});

test("the glyphs are frozen, so a screen cannot edit the shape it is drawing", () => {
  assert.ok(Object.isFrozen(FORMATION_GLYPHS));
  assert.ok(Object.isFrozen(GLYPH_BOX));
  for (const paths of Object.values(FORMATION_GLYPHS)) assert.ok(Object.isFrozen(paths));
});
