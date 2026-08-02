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
