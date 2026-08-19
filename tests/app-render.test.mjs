import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

// One Vite server, one render, shared by every test in this file. Starting a second Vite
// server anywhere else in the suite makes esbuild cancel a build mid-run, so tests that
// need rendered markup belong here rather than in their own file.
//
// These are the structural accessibility guards — accessible names, the live region, and
// what the screen says before anything has been decided. The palette guards that need no
// render are in accessibility.test.mjs.
let markupPromise = null;
const deploymentScreen = () => {
  markupPromise ??= (async () => {
    const server = await createServer({
      appType: "custom",
      logLevel: "silent",
      server: { middlewareMode: true },
      // SSR loading resolves modules directly and never needs the browser dependency
      // optimiser. Leaving it on makes esbuild cancel a background build when the server
      // closes, which intermittently killed this file mid-run.
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const module = await server.ssrLoadModule("/src/battle/BattleApp.jsx");
      return renderToString(React.createElement(module.default));
    } finally {
      await server.close();
    }
  })();
  return markupPromise;
};

test("the screen renders before anything has been chosen", async () => {
  // The entry point is now MUSTER: a run has to be started before there is a battlefield,
  // an enemy or an army to deploy, because all three come from the ladder.
  const markup = await deploymentScreen();
  assert.match(markup, /MUSTER/);
  assert.match(markup, /BEGIN THE RUN/);
  // Every detachment is offered with the thing that distinguishes it, so the choice that
  // governs the whole run is made with the information in front of you.
  for (const name of ["VOIDBREAKER GUILD", "ORDO PRAESIDIUM", "HOLLOWJAW PACK"]) {
    assert.ok(markup.includes(name), `${name} is not offered at muster`);
  }
  assert.match(markup, /SCRAPBORN PLATE/);
  assert.match(markup, /DECLARES/);
  // And it says plainly that the choice is for the whole run.
  assert.match(markup, /cannot be changed once the run starts/);
});

test("every control has an accessible name", async () => {
  const markup = await deploymentScreen();
  // A select is named either by its own aria-label or by the <label> wrapping it. Both are
  // valid, so both are accepted — a guard that only accepted one would push the screen
  // towards redundant markup rather than towards being readable.
  // The label's OWN text, not the text of the control inside it. Counting the whole
  // element made a label with an empty <span> look named, because the option list of the
  // select it wraps reads as text — and option text is not an accessible name.
  const labelText = (inner) => inner
    .replace(/<select[\s\S]*?<\/select>/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
  const wrapped = [...markup.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/g)]
    .filter((match) => /<select/.test(match[1]) && labelText(match[1]).length > 2)
    .length;
  const selects = [...markup.matchAll(/<select[^>]*>/g)].map((match) => match[0]);
  const selfNamed = selects.filter((select) => /aria-label="/.test(select)).length;
  assert.equal(
    selfNamed + wrapped, selects.length,
    `${selects.length - selfNamed - wrapped} select(s) have no accessible name, by label or aria-label`,
  );
  // Buttons say what they do rather than relying on an icon or a colour.
  const buttons = [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) => match[1]);
  assert.ok(buttons.length >= 4, `only found ${buttons.length} buttons; the muster screen changed shape`);
  for (const label of buttons) {
    const text = label.replace(/<[^>]*>/g, "").replace(/&[a-z#0-9]+;/g, "").trim();
    assert.ok(text.length >= 2, `a button renders no readable label: "${label}"`);
  }
});

test("the score is announced as it changes", async () => {
  const markup = await deploymentScreen();
  // The battle plays itself, so a player who cannot see the board has to be told the score
  // as it moves rather than having to go looking for it.
  assert.match(markup, /aria-live="polite"/);
  const liveAt = markup.indexOf('aria-live="polite"');
  const region = markup.slice(liveAt, liveAt + 400);
  assert.match(region, /WARHOST/);
  assert.match(region, /HELIOCH/);
});

test("decoration is hidden from assistive technology", async () => {
  const markup = await deploymentScreen();
  // The control rings and the wound bars carry no information that is not also written
  // down, so they are hidden rather than read out as empty nodes. (The drawn plan only
  // exists once a run has started, so it is checked in the browser rather than here.)
  assert.ok(markup.includes('aria-hidden="true"'), "a decorative element is exposed to assistive technology");
});

test("the board and the rail are landmarks a reader can jump between", async () => {
  const markup = await deploymentScreen();
  assert.match(markup, /<main/);
  assert.match(markup, /aria-label="Battlefield"/);
  assert.match(markup, /<aside/);
  assert.match(markup, /<header/);
});

test("the screen fights on the ground it draws", () => {
  // Read from the source for the same reason the contrast guard reads the stylesheet: the
  // failure being guarded against is the app DRAWING terrain and RESOLVING without it, and
  // there is no way to see that from the outside — the board would look exactly right and
  // every shot would be wrong.
  const source = readFileSync(new URL("../src/battle/BattleApp.jsx", import.meta.url), "utf8");
  assert.match(source, /missionId:\s*mission\.id/, "the app resolves its battles on a flat plain");
  assert.match(source, /terrainFor\(mission\.id\)/, "the app draws terrain from somewhere other than the mission");
});

test("the deploy screen says when a slot is walking to ground you do not score", () => {
  // Every SAFEGUARD plan sends two or three of its five slots to markers that disposition
  // scores nothing on. Holding them denies the enemy the point, which is why the plans do
  // it — but that is a thing to be told before committing, and the only place it was said
  // was the debrief afterwards.
  const source = readFileSync(new URL("../src/battle/BattleApp.jsx", import.meta.url), "utf8");
  assert.match(source, /battle-assignment-unpaid/, "the deploy screen never flags unpaid ground");
  assert.match(source, /live\.has\(objective\.id\)/, "the flag is not read from the live sites");
});

test("the enemy's profile can be read off the board, and its hand cannot", () => {
  // "I should be able to see the enemy units if I hover over them — at least what they can
  // do, as in stats, not their combo." A profile is public in any wargame: the army list is
  // on the table. Hiding it only meant guessing whether the thing walking at you outranges
  // you. The hand stays hidden, because that is the only uncertainty this game has.
  const source = readFileSync(new URL("../src/battle/BattleApp.jsx", import.meta.url), "utf8");
  const at = source.indexOf("{markers.map(");
  assert.notEqual(at, -1, "the board no longer draws markers");
  assert.ok(source.includes('className="battle-unit-card"'), "markers carry no profile card");
  const card = source.slice(at, source.indexOf("battle-pairing", at));
  assert.ok(card.includes('className="battle-unit-card"'), "the card is not on the marker");
  assert.ok(card.includes("statLineFor(profile)"), "the card writes its own stat line instead of the one the shelf shows");
  // Read from the forces, so the card shows what a hull can do THROUGH its refit rather
  // than the factory numbers — the same failure the deploy list had.
  assert.match(source, /profiles = new Map\(/);
  assert.match(source, /player\.units\.map\(\(unit\) => \[`player:\$\{unit\.id\}`/);
  assert.match(source, /enemy\.units\.map\(\(unit\) => \[`enemy:\$\{unit\.id\}`/);
  // And the card says nothing about the hand or the pairings.
  for (const leak of ["enemyHand", "stratagem", "synergies", "leadsFor", "mechanics"]) {
    assert.ok(!card.includes(leak), `the marker card leaks ${leak}, which is the hidden information`);
  }
  // Hover alone is information only some players have.
  assert.ok(card.includes("tabIndex={0}"), "the marker cannot be reached by keyboard");
  assert.ok(card.includes("aria-label"), "the marker has no accessible name carrying the profile");
  const css = readFileSync(new URL("../src/battle/battle.css", import.meta.url), "utf8");
  assert.match(css, /\.battle-unit:focus > \.battle-unit-card/, "the card only opens under a pointer");
});

test("a repair is bought against a formation the player names", () => {
  // Two of the same hull in the warband makes "which one do I patch" a real question, and
  // a shelf button that healed the worst-off formation was answering it for them.
  const source = readFileSync(new URL("../src/battle/BattleApp.jsx", import.meta.url), "utf8");
  assert.match(source, /buy\(\{ run, offerId, targetId \}\)/, "the screen never names a target");
  assert.match(source, /mends\.map\(\(service\)/, "the repairs are not offered on the roster rows");
  assert.match(source, /const shelf = offers\.filter/, "the mends are still on the shelf as well, so they can be bought blind");
});

test("damage comes home to the formation that took it", () => {
  // The campaign matches the roster on INSTANCE ids — it has to, or one of two railjacks
  // dying strikes off both — and the screen was handing it formation ids. They never
  // matched, so nothing was ever damaged, nothing was ever lost, the repairs in the market
  // could not be bought because nothing needed them, and a run could not be lost. A whole
  // economy sat there looking implemented.
  const source = readFileSync(new URL("../src/battle/BattleApp.jsx", import.meta.url), "utf8");
  const at = source.indexOf("const pressOn");
  assert.notEqual(at, -1, "the screen no longer ends an engagement");
  const pressOn = source.slice(at, at + 1800);
  assert.match(pressOn, /deployedIds = Object\.values\(planned\)\.map\(\(entry\) => entry\?\.id\)/,
    "the battle result is applied to formations rather than to the hulls that fought");
  assert.ok(!/deployedIds[\s\S]{0,120}formationId/.test(pressOn), "the deployed list is still keyed on the formation");
  // And what a slot carries INTO the battle is read off the same instance, so two of the
  // same hull do not both fight carrying the first one's damage.
  assert.match(source, /run\?\.roster\.find\(\(item\) => item\.id === entry\.id\)/,
    "the wounds a slot deploys with are read off the formation rather than the hull");
  // And what was fielded goes home with it, because the next enemy is built by replaying
  // this engagement. Passing nothing leaves the enemy permanently blind and the whole
  // counter-play layer silently off.
  assert.match(pressOn, /fielded: mission\.playerDeployment\.map\(\(slot\) => planned\[slot\.id\]\?\.formationId/,
    "the engagement is not recorded, so the enemy never has anything to read");
  assert.match(pressOn, /planId: strategyId/, "the enemy cannot replay the plan the player walked");
});
