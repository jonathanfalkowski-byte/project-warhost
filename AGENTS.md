# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Project Warhost Decisions

- Project Warhost is a separate original-IP prototype. Do not add Warhammer 40,000 names, logos, unit silhouettes, lore, art, or public licensed-product claims.
- The game is mission-driven autonomous tactics, not a kill-all autobattler and not a collectible-card presentation.
- Placement, terrain, support arcs, doctrine, and authored contingencies create combination play. Moving a formation must be able to strengthen or break a plan.
- Missions are won through objectives and extraction. Enemy annihilation is never the default victory condition.
- Exactly two scarce Command Seals allow high-stakes order changes after contact; do not add a cooldown ability bar or click-heavy combat.
- Operation Dead Circuit is the first playable slice: seize Alpha and Beta, sabotage the Reactor Spine, and extract at least three formations before reinforcements arrive.
- The initial playable faction is the Scrapborn Freeholds, original voidbreakers who weaponize derelict starship machinery. Factions must change strategic values and mission solutions, not merely statistics.
- Preserve the selected Objective Weave mock's cinematic industrial battlefield, gunmetal/furnace-orange/cobalt palette, dense command typography, and physical formation imagery.
- The primary planning interaction is a tactical playbook: choose a maneuver, assign formations to compatible roles, and author breakpoint responses before contact. Never require freehand path drawing or continuous unit micro.
- Executing an authored breakpoint costs nothing. Breaking the playbook after contact costs one Command Seal, making foresight the core skill.
- Retreat, if added, should be an authored contingency with an explicit objective and opportunity cost. Do not add a universal panic/retreat button or persistent damage until campaign recovery has a proven design purpose.
- A playbook defines battlefield jobs, but every role begins empty and the player decides which formation fills it. Never prefill roles or reveal a recommended answer in the chooser. Reveal output and combo-link feedback only after placement, allow adjacency to change that feedback, and keep the underlying scoring formula hidden so discovery remains part of play.
- The central battlefield playbook panel is the primary assignment surface. Empty roles must look like large interactive slots with explicit assignment actions; do not hide the only formation controls in the narrow intelligence rail or make them resemble passive status rows.
- A playbook is an authored tactical route, not something the player draws or builds. Show its fixed route continuing through ordered action stops; the player staffs those stops with formations.
- Every playbook must expose its authored geometry directly on the battlefield with numbered action positions and directional route lines. Switching playbooks redraws the whole formation diagram; changing a breakpoint order redraws only the affected leg.
- When a live breakpoint occurs, compare the authored path with the override path before the player spends a Command Seal. Do not make the player infer the spatial consequence from prose alone.
- Formation assignment must support drag-and-drop from the roster and battlefield, with a semantic click-and-choose fallback. The roster and chooser must always distinguish `AVAILABLE` formations from formations already assigned to an exact numbered stop.
- Give neutral capability and task-purpose information before placement, but do not recommend a formation, rank candidates, label suitability, or reveal a resolved tactical handoff before the player commits a choice.
- Formation combos are directional tactical handoffs, not passive proximity auras or generic stat bonuses. A formation creates a named battlefield condition, and the next staffed action stop may consume or transform it into a named maneuver. Reveal the result only after placement, keep no-handoff arrangements valid, and never identify an optimal chain for the player.
- State the mission's victory formula before commitment and use unambiguous result language (`VICTORY`, `DEFEAT`, or a specifically defined partial result) in the debrief.
- Fighting Withdrawal belongs to a later mission designed around force preservation; do not present it as an approach to Operation Dead Circuit.
