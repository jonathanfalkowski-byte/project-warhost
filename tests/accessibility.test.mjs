import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

// Static accessibility guards. These read the stylesheet directly and need no
// browser and no Vite server, so this file stays fast and cannot contend with the
// SSR render in app-render.test.mjs. The SSR-dependent structural guards
// (accessible names, tabindex, the live region) live in that file, beside the
// single render they share.
//
// None of this replaces hands-on assistive-technology testing. It locks in what a
// browser audit confirmed on 14 Aug 2026.

test("the visually hidden class stays readable by assistive technology", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const rule = css.slice(css.indexOf(".sr-only {"), css.indexOf("}", css.indexOf(".sr-only {")));
  assert.ok(rule.length > 0, "expected an .sr-only rule");
  // display:none and visibility:hidden both remove the node from the accessibility
  // tree, which would silence the live region while still hiding it visually.
  assert.doesNotMatch(rule, /display:\s*none/);
  assert.doesNotMatch(rule, /visibility:\s*hidden/);
  assert.match(rule, /position:\s*absolute/);
});

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

test("the contrast helper matches the WCAG reference values", () => {
  assert.equal(Number(contrastRatio("#ffffff", "#000000").toFixed(2)), 21);
  assert.equal(Number(contrastRatio("#000000", "#000000").toFixed(2)), 1);
});

// Each of these small-text colours failed WCAG 1.4.3 AA in a browser audit on
// 14 Aug 2026. The background is the panel each one is rendered on, captured from
// the same audit. Reverting any colour re-breaks contrast, and this test says so.
const CONTRAST_SURFACES = [
  { selector: ".disposition-versus small", background: "#10242d" },
  { selector: ".playbook-row small", background: "#102331" },
  { selector: ".strategy-test-panel header small", background: "#101814" },
  { selector: ".strategy-trial-list button small", background: "#121a17" },
  { selector: ".condition-options small", background: "#10252d" },
  { selector: ".prototype-note", background: "#0d1414" },
  { selector: ".enemy-step-copy em", background: "#17110e" },
];

test("small planning text meets WCAG AA contrast on its own panel", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const failures = [];
  for (const { selector, background } of CONTRAST_SURFACES) {
    const start = css.indexOf(`${selector} {`);
    assert.notEqual(start, -1, `selector ${selector} is missing from styles.css`);
    const rule = css.slice(start, css.indexOf("}", start));
    const colour = rule.match(/color:\s*(#[0-9a-fA-F]{6})/);
    assert.ok(colour, `${selector} no longer declares an explicit colour`);
    const ratio = contrastRatio(colour[1], background);
    if (ratio < 4.5) failures.push(`${selector}: ${colour[1]} on ${background} = ${ratio.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, [], `contrast below the 4.5:1 AA threshold:\n${failures.join("\n")}`);
});

// Every overlay in App.jsx declares role="dialog" aria-modal="true". That attribute
// tells assistive technology the rest of the page does not exist, so a dialog that
// does not also trap focus strands the user on controls their screen reader refuses
// to read. A browser walkthrough on 14 Aug 2026 confirmed all four dialogs now move
// focus in, trap it, restore it on close, and mark their siblings inert. Focus
// behaviour itself needs a real browser; this guards the wiring, so a fifth dialog
// cannot be added without it.
test("every modal dialog is wired to the focus trap", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const dialogs = app.match(/<div[^>]*aria-modal="true"[^>]*>/g) ?? [];
  assert.ok(dialogs.length >= 4, `expected the known overlays, found ${dialogs.length}`);
  const unmanaged = dialogs.filter((tag) => !/ref=\{dialogRef\}/.test(tag));
  assert.deepEqual(unmanaged, [], `aria-modal dialogs without a focus trap:\n${unmanaged.join("\n")}`);
  // Each dialog must also name itself, or a screen reader announces only "dialog".
  const unlabelled = dialogs.filter((tag) => !/aria-labelledby="[^"]+"/.test(tag));
  assert.deepEqual(unlabelled, [], `aria-modal dialogs without an accessible name:\n${unlabelled.join("\n")}`);
});

test("the focus trap seals the background and restores it on close", () => {
  const hook = readFileSync(new URL("../src/useModalFocus.js", import.meta.url), "utf8");
  // Sealing the background is what makes aria-modal honest.
  assert.match(hook, /setAttribute\("inert", ""\)/);
  // Failing to remove inert would leave the whole app permanently unusable.
  assert.match(hook, /removeAttribute\("inert"\)/);
  // Focus must return to whatever opened the dialog, or the user is dropped at the
  // top of the document with no idea what happened.
  assert.match(hook, /returnFocusRef/);
  assert.match(hook, /event\.key !== "Tab"/);
  assert.match(hook, /event\.key === "Escape"/);
});

test("contact is drawn on the map, not only announced in a banner", () => {
  // Playtest finding, 15 Aug 2026: the battle read as a map animation because the two
  // plans never visibly met — enemy orders resolved in a text banner while the map went
  // on unchanged. That left the Command Seal decision with no visible cause. The strike
  // marks the moment at the coordinate where the enemy order resolves.
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(app, /className=\{`field-strike/, "contact strikes are not rendered");
  assert.match(app, /struckIds\.includes\(formation\?\.id\)/, "player formations do not react to being hit");
  // It must key off beats where plans actually meet, not beats that merely describe intent.
  assert.match(app, /\["contact", "result", "intercept"\]/);
  assert.match(css, /\.field-strike/);
  assert.match(css, /@keyframes strikeRing/);
  // Motion is decoration here; it must not be forced on people who have opted out.
  // Every reduced-motion block is searched, not just the last one: inspecting only the
  // final block meant appending an unrelated one silently disarmed this guard.
  const reduced = css.split("@media (prefers-reduced-motion: reduce)").slice(1).join("\n");
  assert.match(reduced, /field-strike/);
  assert.match(reduced, /struck/);
});

test("battle time eases across a beat rather than snapping to it", () => {
  // Formations are positioned by interpolating their route against battleTime. Snapping
  // it to each beat's timestamp made them lurch, because early beats are 5 game-seconds
  // apart and later ones 60, while every beat lasts the same real 2.6s.
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /requestAnimationFrame\(tick\)/, "battleTime no longer eases across the beat");
  assert.match(app, /cancelAnimationFrame\(frame\)/, "the animation frame must be cancelled on cleanup");
});

test("the counter-board announces coverage changes and never leaks a result", () => {
  // The board updates as the player places formations. A sighted player sees the colour
  // change; a screen reader user needs it announced, or the surface is sighted-only.
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const board = app.slice(app.indexOf("function EnemyCounterBoard"), app.indexOf("function EnemyPlanIntel"));
  assert.match(board, /role="status"/, "coverage changes are not announced");
  assert.match(board, /aria-live="polite"/);
  // Planning-phase copy must never carry an outcome; concealment before commitment is
  // the whole reason the board reports capability coverage rather than resolution.
  for (const leak of ["playerScore", "resolution", "disrupted", "extractedCount"]) {
    assert.equal(board.includes(leak), false, `counter-board renders ${leak}`);
  }
});

test("effectiveness is legible without relying on colour alone", () => {
  // Grade is carried by a class that only changes hue, so the number and the grade word
  // both have to be in the text or the readout is unusable to a colour-blind player.
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const section = app.slice(app.indexOf('className="formation-effectiveness"'), app.indexOf("strategy-outcome-story"));
  assert.match(section, /\{row\.effectiveness\}%/, "the score is not stated numerically");
  assert.match(section, /<em>\{row\.grade\}<\/em>/, "the grade word is not stated");
  assert.match(section, /aria-label="How effective each formation was/);
  // The bar duplicates the number, so it must not be announced twice.
  assert.match(section, /className="effectiveness-bar" aria-hidden="true"/);
  assert.match(css, /\.formation-effectiveness li\.grade-ineffective/);
});

test("the formation hover card is positioned, not parked", () => {
  // Playtest findings, 15 Aug 2026, in both directions. First it was anchored at the
  // map's top-left and hid the objective markers. Then it was parked in the left rail,
  // where it stopped occluding anything but answered from nowhere near the row being
  // hovered. It is now anchored to the hovered element itself.
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const card = css.slice(css.indexOf(".formation-hover-card {"), css.indexOf(".formation-hover-card header"));

  // No hard-coded corner: position comes from the measured anchor.
  assert.equal(/\n\s*(left|top):\s*-?\d/.test(card), false, "the card still hard-codes a corner position");
  assert.match(card, /position: fixed/);
  assert.match(app, /hoverCardPlacementFor\(/, "the card is not placed against its anchor");
  // Both hover sources must report the element, or the card cannot find the row.
  assert.equal(
    (app.match(/onInspect\(formation\.id, event\.currentTarget\)/g) ?? []).length,
    4,
    "a hover source does not report the element it is anchored to",
  );
  // It must stay scrollable rather than running off a short viewport.
  assert.match(card, /max-height/);
  assert.match(card, /overflow:\s*auto/);
  // The notch is what makes "beside this unit" legible rather than merely nearby.
  assert.match(css, /\.formation-hover-card::before/);
  assert.match(css, /var\(--notch-top/);
});

test("every lane colour is legible as the route-preview accent", () => {
  // The preview label's accent is now the previewed stop's own lane colour rather than a
  // single hard-coded gold, so all five have to clear AA on the label panel — not just
  // whichever one happened to be checked when the change was made.
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const background = "#0a1213"; // .field-route-preview-label, rgba(10, 18, 19, .96) over the map
  const lanes = [...css.matchAll(/\.lane-(\d) \{ --route-color: (#[0-9a-fA-F]{6})/g)];
  assert.equal(lanes.length, 5, "the lane palette changed size");
  const failures = lanes
    .map(([, lane, colour]) => ({ lane, colour, ratio: contrastRatio(colour, background) }))
    .filter(({ ratio }) => ratio < 4.5)
    .map(({ lane, colour, ratio }) => `lane-${lane}: ${colour} = ${ratio.toFixed(2)}:1`);
  assert.deepEqual(failures, [], `lane colours below 4.5:1 on the preview label:\n${failures.join("\n")}`);
});

test("the route preview reads as a preview without relying on its hue", () => {
  // Colour identifies which action stop, everywhere on the map. The preview used to
  // override it with one gold, so hovering any stop previewed identically. Preview is
  // now carried by weight, opacity, rim and label — cues that survive the hue change.
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const rule = css.slice(
    css.indexOf(".field-plan-layer.planning .field-plan-segment.route-preview {"),
    css.indexOf(".field-plan-layer.planning .field-plan-segment.route-preview::before"),
  );
  assert.equal(/--route-color:\s*#/.test(rule), false, "the preview still overrides the lane colour");
  assert.match(rule, /background: var\(--route-color/);
  // The preview segment and its label must both carry the previewed stop's lane.
  assert.match(app, /route-preview lane-\$\{previewRoleIndex \+ 1\}/);
  assert.match(app, /field-route-preview-label lane-\$\{previewRoleIndex \+ 1\}/);
  // Non-hue preview cues, so the state is still unmistakable.
  assert.match(rule, /height: 7px/);
  assert.match(rule, /opacity: 1/);
  assert.match(rule, /box-shadow: 0 0 8px #071013/);
  assert.match(app, /PREVIEW ONLY/);
});
