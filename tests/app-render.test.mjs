import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

test("the planning screen renders without an undefined runtime binding", async () => {
  const server = await createServer({
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });

  try {
    const { App } = await server.ssrLoadModule("/src/App.jsx");
    const markup = renderToString(React.createElement(App));
    assert.match(markup, /PLACE THE FORMATIONS/);
    assert.match(markup, /VIEW ROUTE MAP/);
    assert.match(markup, /OPTIONAL COMBO BONUSES/);
    assert.match(markup, /OPTIONAL COMBO WINDOWS/);
    assert.match(markup, /PRIMARY DECISION/);
    assert.match(markup, /ROUTE RESPONSIBILITY/);
    assert.match(markup, /SECONDARY BONUS/);
    assert.match(markup, /PROJECT WARHOST/);
    assert.match(markup, /FORCE MOVE/);
    assert.match(markup, /OUT OF POSITION/);
    assert.match(markup, /Seize, transfer, sabotage, withdraw\./);
    assert.doesNotMatch(markup, /hand off/i);
    assert.match(markup, /AVAILABLE · DRAG TO STOP/);
    assert.doesNotMatch(markup, />DISPLACE</);
  } finally {
    await server.close();
  }
});
