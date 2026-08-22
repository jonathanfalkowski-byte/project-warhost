import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync } from "node:fs";

import { THUMB_FORMAT, THUMB_WIDTH, thumbFor } from "../src/battle/formationArt.js";
import { FORMATIONS } from "../src/formationData.js";

// The renders in public/assets are around three megabytes each. They are dossier art, and a
// dossier that appears under a pointer cannot afford them at that size.

const publicPath = (webPath) => new URL(`../public${webPath}`, import.meta.url);

test("every formation's art maps to a derivative that exists", () => {
  for (const formation of FORMATIONS) {
    const thumb = thumbFor(formation.asset);
    assert.ok(thumb, `${formation.name} has an asset the mapping does not recognise: ${formation.asset}`);
    assert.match(thumb, new RegExp(`^/assets/thumbs/[a-zA-Z0-9._-]+\\.${THUMB_FORMAT}$`));
    // Run `npm run thumbs` when the art changes; the derivatives are committed.
    assert.doesNotThrow(
      () => statSync(publicPath(thumb)),
      `${thumb} is missing - run npm run thumbs`,
    );
  }
});

test("a derivative is small enough to hang off a hover", () => {
  // The number that matters. Hovering five formations used to mean fourteen megabytes to
  // draw five thumbnails; anything in this range is a rounding error beside the page.
  for (const formation of FORMATIONS) {
    const thumb = thumbFor(formation.asset);
    const size = statSync(publicPath(thumb)).size;
    assert.ok(size < 120 * 1024, `${thumb} is ${Math.round(size / 1024)} KB, too heavy for a card`);
    assert.ok(size > 0, `${thumb} is empty`);
  }
});

test("a derivative is a fraction of the render it came from", () => {
  const source = statSync(new URL("../public/assets/railjack.png", import.meta.url)).size;
  const derived = statSync(publicPath(thumbFor("/assets/railjack.png"))).size;
  assert.ok(source / derived > 20, `only ${(source / derived).toFixed(1)}x smaller - the resize is not doing its job`);
});

test("the mapping refuses anything that is not one of ours", () => {
  // It is total on purpose: an asset it does not recognise draws no picture, rather than an
  // <img> pointed at a path assembled out of whatever it was handed.
  for (const bad of [
    null, undefined, 42, "", "railjack.png", "/other/railjack.png", "/assets/railjack.svg",
    "/assets/../../etc/passwd.png", "/assets/nested/railjack.png", "/assets/.png",
    "/assets/rail jack.png", "https://elsewhere.example/assets/railjack.png",
  ]) {
    assert.equal(thumbFor(bad), null, `${JSON.stringify(bad)} produced a path`);
  }
});

test("the mapping keeps the name and changes only where and what", () => {
  assert.equal(thumbFor("/assets/railjack.png"), `/assets/thumbs/railjack.${THUMB_FORMAT}`);
  assert.equal(thumbFor("/assets/breaker-exo.png"), `/assets/thumbs/breaker-exo.${THUMB_FORMAT}`);
});

test("every render in the folder has a derivative, not just the ones in use", () => {
  // The script does the whole directory, so a picture added for a screen that does not exist
  // yet is already sized when that screen does.
  const dir = new URL("../public/assets/", import.meta.url);
  const renders = readdirSync(dir).filter((name) => name.toLowerCase().endsWith(".png"));
  assert.ok(renders.length > 0, "there is no render art at all");
  for (const render of renders) {
    const thumb = thumbFor(`/assets/${render}`);
    assert.ok(thumb, `${render} does not map`);
    assert.doesNotThrow(() => statSync(publicPath(thumb)), `${render} has no derivative - run npm run thumbs`);
  }
});

test("the width the script writes is the width the screen asks for", () => {
  // One constant, imported by both, so a card sized for one picture and a file written at
  // another cannot drift apart.
  assert.equal(typeof THUMB_WIDTH, "number");
  assert.ok(THUMB_WIDTH >= 320, "narrower than the card it has to fill on a dense display");
  assert.ok(THUMB_WIDTH <= 1024, "wider than a hover card can ever need");
});
