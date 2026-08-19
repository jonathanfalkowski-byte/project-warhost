import React from "react";
import { createRoot } from "react-dom/client";
import BattleApp from "./battle/BattleApp.jsx";
import "./battle/battle.css";

// One game.
//
// Two resolution models ran side by side while the second was proven out. The OPERATION
// model resolved an authored route plan as a timeline of capability matches against a
// scripted enemy; the BATTLE model is the tabletop shape — two armies facing each other
// across objectives, five rounds of move / shoot / fight, ground scored while held.
//
// The comparison has been made and the battle model won it. Playtesting returned the same
// verdict on the operation model every time it was put in front of anyone — "is it a race
// to the objectives? why is the enemy coming from one corner? i just find this weird and
// awkward" — and the diagnosis never changed: it shared no structure with the game it was
// meant to evoke. Keeping both alive meant every new rule had to be built twice or built
// nowhere, so the operation model has been retired.
//
// What was worth keeping came with it. The per-formation after-action readout is in
// src/battle/afterAction.js, and the disclosure principle the counter-board proved — tell
// the player the enemy's intent, never its hand — is what the scouted stratagem pool does.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BattleApp />
  </React.StrictMode>,
);
