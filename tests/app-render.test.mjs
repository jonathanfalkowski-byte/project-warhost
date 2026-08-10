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
    assert.match(markup, /PROJECT WARHOST/);
  } finally {
    await server.close();
  }
});
