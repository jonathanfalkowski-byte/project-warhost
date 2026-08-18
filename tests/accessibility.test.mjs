import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Static accessibility guards for the battle screen. They read the stylesheet directly, so
// they need no browser and no Vite server and cannot contend with the SSR render in
// app-render.test.mjs — the structural guards live there, beside the single render.
//
// Carried over from the operation screen when it was retired rather than dropped with it.
// None of this replaces hands-on assistive-technology testing; it locks in what a browser
// audit confirmed, and it has already earned its place: pointing it at the battle palette
// immediately found three labels dimmed with `opacity` down to a 1.6:1 ratio.

const css = readFileSync(new URL("../src/battle/battle.css", import.meta.url), "utf8");

const relativeLuminance = (hex) => {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (foreground, background) => {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)]
    .sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

// Compositing a colour over a background at some alpha, which is what `opacity` does to
// text. This is the calculation that catches a label faded into its own background.
const flatten = (foreground, background, alpha) => {
  const parse = (hex) => [0, 2, 4].map((offset) => parseInt(hex.replace("#", "").slice(offset, offset + 2), 16));
  const [fr, fg, fb] = parse(foreground);
  const [br, bg, bb] = parse(background);
  return `#${[[fr, br], [fg, bg], [fb, bb]]
    .map(([f, b]) => Math.round(b + (f - b) * alpha).toString(16).padStart(2, "0")).join("")}`;
};

test("the contrast helper matches the WCAG reference values", () => {
  // Black on white is 21:1 and a colour on itself is 1:1. If the helper is wrong every
  // assertion below is worthless, so it is checked against known values first.
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  // #777 on white is the canonical borderline value: 4.48, just under the AA floor.
  assert.equal(contrastRatio("#777777", "#ffffff").toFixed(2), "4.48");
  assert.equal(contrastRatio("#123456", "#123456"), 1);
});

// The colour a selector actually sets, read out of the stylesheet. Hardcoding the
// foreground made the whole test decorative: changing a colour in the CSS could drop it
// under the floor and every assertion still passed against the old value.
const colourOf = (selector) => {
  const at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `no rule found for ${selector}; the stylesheet changed shape`);
  const block = css.slice(at, css.indexOf("}", at));
  const declared = [...block.matchAll(/(?:^|[;{]|\s)color:\s*(#[0-9a-fA-F]{6})/g)].at(-1);
  assert.ok(declared, `${selector} declares no colour`);
  return declared[1];
};

test("every text colour on the battle screen clears WCAG AA", () => {
  // Selectors are listed explicitly rather than discovered: a parser that silently matches
  // nothing passes, and a guard that can pass by finding nothing is not a guard. Adding
  // text to the screen means adding its selector here. The colour itself is read from the
  // stylesheet, so changing it in the CSS is what this test is watching for.
  const pairs = [
    [".battle-header .eyebrow", "#0b1416"],
    [".battle-hint", "#0a1113"],
    [".battle-note", "#0a1113"],
    [".battle-profile", "#0e181b"],
    [".battle-scoring", "#1a1426"],
    [".battle-rule", "#1a1426"],
    [".battle-board-note", "#1a1426"],
    [".battle-shape", "#1a1426"],
    [".battle-doctrine h3", "#1a1426"],
    [".battle-doctrine label > span", "#1a1426"],
    [".battle-scouting > span", "#221a0c"],
    [".battle-scouting p", "#221a0c"],
    [".battle-objective small", "#081012"],
    [".battle-objective.dark small", "#081012"],
    [".battle-objective.dark b", "#081012"],
    [".battle-unit.destroyed b", "#080e10"],
    [".battle-unit-player b", "#0e242e"],
    [".battle-unit-enemy b", "#28120e"],
    [".battle-strat-cost", "#0a1215"],
    [".battle-spend-player b", "#102832"],
    [".battle-spend-enemy b", "#301410"],
    [".battle-debrief h3", "#0c1c24"],
    [".battle-contribution small", "#0c1c24"],
    [".battle-contribution b", "#0c1c24"],
    [".battle-reveal", "#0a1113"],
    [".battle-warband-row small", "#0a1113"],
    [".battle-warband-row .battle-warband-refit", "#0a1113"],
    [".battle-notes-head span", "#120e05"],
    [".battle-notes-head em", "#120e05"],
    [".battle-note-row b", "#120e05"],
    [".battle-note-row em", "#120e05"],
    [".battle-note-row small", "#120e05"],
    [".battle-notes-empty", "#120e05"],
    [".battle-pairing", "#2e2208"],
    [".battle-terrain-broken span", "#1d1710"],
    [".battle-terrain-cover span", "#0d1c18"],
    [".battle-terrain-blocking span", "#131a1e"],
  ];
  for (const [selector, background] of pairs) {
    const foreground = colourOf(selector);
    const ratio = contrastRatio(foreground, background);
    assert.ok(ratio >= 4.5, `${selector}: ${foreground} on ${background} is ${ratio.toFixed(2)}:1, under the 4.5:1 floor`);
  }
  assert.ok(pairs.length >= 20, "the palette shrank; check whether a colour stopped being covered");
});

test("no text on the screen is dimmed with opacity", () => {
  // `opacity` composites a label into its own background: the dark objective marker was
  // #6d7c81 at .38, which is #2e373a in practice — a 1.6:1 ratio. Anything that carries
  // information is dimmed by colour instead, so that its contrast can actually be checked.
  assert.ok(contrastRatio(flatten("#6d7c81", "#070d0f", 0.38), "#070d0f") < 2, "the flattening helper is wrong");

  const rules = css.split("}").map((block) => block.trim()).filter(Boolean);
  const offenders = [];
  for (const block of rules) {
    const opacity = block.match(/opacity:\s*([\d.]+)/);
    if (!opacity || Number(opacity[1]) >= 0.85) continue;
    const selector = block.split("{")[0].trim();
    // Inactive controls are exempt from the contrast requirement, and a stroke is not
    // text — the drawn plan and the drawn fire are both lines on the board.
    if (/:disabled/.test(selector) || /battle-route|battle-shot|battle-support/.test(selector)) continue;
    // A rule that only fades a wound bar or a ring is fading a graphic, not a label.
    if (/\bi\b|\bem\b/.test(selector.split(/[\s>]/).at(-1) ?? "")) continue;
    offenders.push(`${selector} { opacity: ${opacity[1]} }`);
  }
  assert.deepEqual(offenders, [], `text dimmed with opacity instead of colour:\n  ${offenders.join("\n  ")}`);
});

test("motion can be turned off", () => {
  // Markers slide between their positions each round. Anyone who has asked their system
  // not to animate has to get the same battle without the movement.
  const blocks = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\}\s*\}/g)]
    .map((match) => match[0]);
  assert.ok(blocks.length > 0, "there is no reduced-motion block at all");
  const guarded = blocks.join("\n");
  assert.match(guarded, /transition:\s*none/);
  // And the thing that actually moves is the thing that is guarded.
  assert.match(guarded, /battle-unit/);
  assert.match(css, /\.battle-unit\s*\{[^}]*transition:/, "the marker no longer animates, so the guard is pointed at nothing");
});

test("the board is drawn in the same coordinate space as the markers", () => {
  // The route overlay and the unit markers both position in board percentages. If the SVG
  // ever gained an aspect ratio the two would drift apart and every drawn plan would be a
  // lie about where the army is going.
  const overlay = css.slice(css.indexOf(".battle-routes {"), css.indexOf("}", css.indexOf(".battle-routes {")));
  assert.match(overlay, /position:\s*absolute/);
  assert.match(overlay, /inset:\s*0/);
  assert.match(overlay, /pointer-events:\s*none/, "the drawn plan intercepts clicks meant for the board");
});
