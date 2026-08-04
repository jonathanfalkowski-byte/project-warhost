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
- Operation Dead Circuit is the first playable slice: seize Alpha and Beta, sabotage the Reactor Spine, and extract at least three formations before the enemy wave arrives.
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
- Once formations are assigned, the click-and-choose staffing dialog must list assigned formations in authored stop order rather than their original roster order; unassigned formations follow afterward.
- Give neutral capability and task-purpose information before placement, but do not recommend a formation, rank candidates, label suitability, or reveal a resolved tactical handoff before the player commits a choice.
- Keep a selected-formation dossier visible during planning with neutral purpose and condition vocabulary. Dynamic readiness may appear only after assignment; it should recalculate from task alignment and neighboring combo links so experimentation teaches the player without revealing an answer in advance.
- Readiness must affect resolution rather than act as a decorative score. Each improvised task assignment adds a visible 15-second extraction delay; directional combo maneuvers keep their own named effects and must not be counted a second time through readiness.
- Formation combos are directional tactical handoffs, not passive proximity auras or generic stat bonuses. A formation creates a named battlefield condition, and the next staffed action stop may consume or transform it into a named maneuver. Reveal the result only after placement, keep no-handoff arrangements valid, and never identify an optimal chain for the player.
- Player handoffs may cascade through several staffed stops: a transformed condition becomes the input offered to the next formation, so moving one formation can rewire every downstream result.
- Combo feedback must be unmistakable after placement: animate affected downstream stops in order and immediately show the before/after handoff count plus the updated mission forecast. This feedback explains the player's completed move; it must never recommend the move beforehand.
- Use `combo window` rather than unexplained `handoff` language in player-facing UI. Show exactly when the automatic reaction occurs, which earlier formation creates the condition, which later formation reacts, the named maneuver produced, and its visible mission consequence.
- Battle confirmations must remain readable for at least 2.5 real seconds in the accelerated prototype. Label resolved combos explicitly so their green confirmation cannot be mistaken for an objective-complete alert; objective state remains visible on the battlefield marker and mission-state rail.
- Keep unassigned battlefield formation portraits fully visible above the planning board; the assignment surface must never obscure the units the player is deciding where to place.
- Enemy formations must visibly move and execute battlefield actions, but faction AI, personality, and final enemy-plan design are deferred until the player-side formation puzzle is proven.
- `Reinforcements` always means an enemy wave; player-side additions are `Reserves`. Reinforcement forecasts must say whether the enemy wave or extraction happens first, never use an ambiguous signed time.
- An enemy reinforcement wave is a pre-authored moving formation with a visible entry route and interception point. It creates a timing/placement contingency inside the chosen playbook; it never adds a player assignment slot or asks the player to redraw paths during battle.
- State the mission's victory formula before commitment and use unambiguous result language (`VICTORY`, `DEFEAT`, or a specifically defined partial result) in the debrief.
- Fighting Withdrawal belongs to a later mission designed around force preservation; do not present it as an approach to Operation Dead Circuit.
- Formation refits are pre-deployment physical or doctrine packages, never a hand of cards or random loot revealed during a mission. Exactly one disclosed package is installed on each formation and locks when the playbook is committed.
- Refit choices must make legible tradeoffs by changing capabilities or named condition vocabulary, allowing readiness and directional combo windows to change. Do not reduce refits to generic stat bonuses, rank packages, recommend a build, or identify an optimal package for a stop.
- The first prototype run contains two operations: Dead Circuit followed by Ashen Passage. Installed formation refits persist between them; role placements reset because the next mission supplies a new authored battlefield problem.
- The intermission Salvage Workshop permits at most one deterministic package replacement across the entire detachment. The player may undo or skip it before launch; do not add random offers, rerolls, currencies, or a card-shop presentation.
- Ashen Passage assigns Sensor Blackout before deployment and requires the Signal Furnace relay to be held plus at least four formations extracted. Its stricter preservation threshold must allow a clear `DEFEAT`, not silently reuse Dead Circuit's three-formation victory rule.
- Every operation must present its own authored field geometry, objective positions, enemy playbook, and reinforcement approach. Reusing the same tactical map with only renamed objectives is not a distinct mission.
