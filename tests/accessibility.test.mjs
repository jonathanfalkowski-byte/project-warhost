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
