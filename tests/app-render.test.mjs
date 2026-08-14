import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

// One Vite server, one render, shared by every test in this file. Starting a second
// Vite server anywhere else in the suite makes esbuild cancel a build mid-run, so
// tests that need rendered markup belong here rather than in their own file.
let markupPromise = null;
const planningScreen = () => {
  markupPromise ??= (async () => {
    const server = await createServer({
      appType: "custom",
      logLevel: "silent",
      server: { middlewareMode: true },
      // SSR loading resolves modules directly and never needs the browser dependency
      // optimiser. Leaving it on makes esbuild cancel a background build when the
      // server closes, which intermittently killed this file mid-run.
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    try {
      const { App } = await server.ssrLoadModule("/src/App.jsx");
      return renderToString(React.createElement(App));
    } finally {
      await server.close();
    }
  })();
  return markupPromise;
};

test("the planning screen renders without an undefined runtime binding", async () => {
  const markup = await planningScreen();
  assert.match(markup, /PLACE THE FORMATIONS/);
  assert.match(markup, /VIEW ROUTE MAP/);
  assert.match(markup, /RENDEZVOUS/);
  assert.match(markup, /COMBO DETAILS · OPTIONAL BONUS/);
  assert.match(markup, /STAFF BOTH ROUTES/);
  assert.match(markup, /PRIMARY DECISION/);
  assert.match(markup, /ROUTE RESPONSIBILITY/);
  assert.match(markup, /SECONDARY BONUS/);
  assert.match(markup, /PROJECT WARHOST/);
  assert.match(markup, /dead-circuit-command-map\.png/);
  assert.match(markup, /dead-circuit-foundry\.png/);
  assert.match(markup, /TOP-DOWN PLANNING/);
  assert.match(markup, /FORCE MOVE/);
  assert.match(markup, /OUT OF POSITION/);
  assert.match(markup, /CONTACT/);
  assert.doesNotMatch(markup, /enemy-plan-segment/);
  assert.match(markup, /Seize, transfer, sabotage, withdraw\./);
  assert.doesNotMatch(markup, /hand off/i);
  assert.match(markup, /AVAILABLE · DRAG TO STOP/);
  assert.doesNotMatch(markup, />DISPLACE</);
});

// Structural accessibility guards. A browser audit on 14 Aug 2026 confirmed correct
// focus order, visible focus rings, and keyboard parity with hover on the action
// stops. These assertions keep the parts of that result that survive in markup.
// Colour and stylesheet guards live in accessibility.test.mjs.

test("every control on the planning screen exposes an accessible name", async () => {
  const markup = await planningScreen();
  const buttons = markup.match(/<button\b[^>]*>/g) ?? [];
  assert.ok(buttons.length > 20, `expected a populated planning screen, found ${buttons.length} buttons`);
  const unnamed = buttons.filter((tag) => {
    if (/aria-label="[^"]+"/.test(tag)) return false;
    if (/aria-labelledby="[^"]+"/.test(tag)) return false;
    // Without an aria-label a button must carry its own visible text.
    const index = markup.indexOf(tag);
    const body = markup.slice(index + tag.length, markup.indexOf("</button>", index));
    return body.replace(/<[^>]*>/g, "").trim().length === 0;
  });
  assert.deepEqual(unnamed, [], `buttons without an accessible name: ${unnamed.join(" | ")}`);
});

test("the planning screen never overrides document focus order", async () => {
  const markup = await planningScreen();
  const positive = (markup.match(/tabindex="(\d+)"/gi) ?? []).filter((match) => Number(match.match(/\d+/)[0]) > 0);
  assert.deepEqual(positive, [], `positive tabindex values break focus order: ${positive.join(", ")}`);
});

test("a polite live region is present and empty before any route preview exists", async () => {
  const markup = await planningScreen();
  // The region must be in the initial DOM. A live region inserted at the same moment
  // its text appears is unreliably announced by screen readers.
  const region = markup.match(/<div class="sr-only field-route-preview-announcement"[^>]*>/);
  assert.ok(region, "the route-preview live region is missing from the initial render");
  assert.match(region[0], /aria-live="polite"/);
  assert.match(region[0], /role="status"/);
  assert.match(markup, /class="sr-only field-route-preview-announcement"[^>]*><\/div>/);
});
