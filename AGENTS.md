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
- Player-facing formation names must identify a familiar battlefield archetype before introducing setting flavor. Use clear generic types such as `RECON TANK`, `FLAME SUPPORT VEHICLE`, `ASSAULT WALKER`, `MAIN BATTLE TANK`, and `ARMOURED RECOVERY VEHICLE`; descriptions must state the unit's battlefield job in one plain-language sentence and remain short enough to display without truncation.
- When an optional rescue succeeds but its ARMOURED RECOVERY VEHICLE is later cut off, the debrief must state both events in their causal order so the successful objective and the formation's fate do not appear contradictory.
- Preserve the selected Objective Weave mock's cinematic industrial battlefield, gunmetal/furnace-orange/cobalt palette, dense command typography, and physical formation imagery.
- The primary planning interaction is a tactical playbook: choose a maneuver, assign formations to compatible roles, and author breakpoint responses before contact. Never require freehand path drawing or continuous unit micro.
- Executing an authored breakpoint costs nothing. Breaking the playbook after contact costs one Command Seal, making foresight the core skill.
- Retreat, if added, should be an authored contingency with an explicit objective and opportunity cost. Do not add a universal panic/retreat button or persistent damage until campaign recovery has a proven design purpose.
- A playbook defines battlefield jobs, but every role begins empty and the player decides which formation fills it. Never prefill roles or reveal a recommended answer in the chooser. Reveal output and combo-link feedback only after placement, allow adjacency to change that feedback, and keep the underlying scoring formula hidden so discovery remains part of play.
- The battlefield routes and objectives are the primary planning surface. Keep formation staffing in a compact bottom dock with clearly interactive empty roles; never let the dock obscure most of the authored route geometry or make the panel feel more important than battlefield placement.
- Staffing a formation never moves, bends, or replaces authored route geometry. The formation portrait and its numbered action stop must use the same fixed battlefield coordinate before and after assignment.
- Formation keyword compatibility is not enough to create a combo. A combo may arm only at an explicitly authored, named rendezvous where the participating routes physically meet; routes that remain separated must be presented as separated even when their formations could otherwise react to each other.
- A playbook is an authored tactical route, not something the player draws or builds. Show its fixed route continuing through ordered action stops; the player staffs those stops with formations.
- Every playbook must expose its authored geometry directly on the battlefield with numbered action positions and directional route lines. Switching playbooks redraws the whole formation diagram; changing a breakpoint order redraws only the affected leg.
- When a live breakpoint occurs, compare the authored path with the override path before the player spends a Command Seal. Do not make the player infer the spatial consequence from prose alone.
- Formation assignment must support drag-and-drop from the roster and battlefield, with a semantic click-and-choose fallback. The roster and chooser must always distinguish `AVAILABLE` formations from formations already assigned to an exact numbered stop.
- In the planning roster, available formations remain full-color and carry a cyan `AVAILABLE` status. Assigned formations are visibly muted and carry `ASSIGNED · STOP NN`, but remain draggable so the player can revise the plan.
- Player-facing vocabulary uses `FORCE MOVE` for the internal `DISPLACE` role and `OUT OF POSITION` for the internal `DISPLACED` condition. Internal resolution keys may remain unchanged.
- Once formations are assigned, the click-and-choose staffing dialog must list assigned formations in authored stop order rather than their original roster order; unassigned formations follow afterward.
- Give neutral capability and task-purpose information before placement, but do not recommend a formation, rank candidates, label suitability, or reveal a resolved tactical handoff before the player commits a choice.
- Keep a selected-formation dossier visible during planning with neutral purpose and condition vocabulary. Show the assigned route order and battlefield method without grading the player's choice.
- Every formation may carry every authored route responsibility. Never impose a binary `FIT` / `MISMATCH` grade, generic improvised-assignment delay, or composition restriction; formation capabilities, equipment, endurance, route exposure, enemy contact, and real rendezvous combos determine how the order resolves.
- Formation combos are directional tactical handoffs, not passive proximity auras or generic stat bonuses. A formation creates a named battlefield condition, and the next staffed action stop may consume or transform it into a named maneuver. Reveal the result only after placement, keep no-handoff arrangements valid, and never identify an optimal chain for the player.
- Player handoffs may cascade through several staffed stops: a transformed condition becomes the input offered to the next formation, so moving one formation can rewire every downstream result.
- Combo feedback must be unmistakable after placement: animate affected downstream stops in order and immediately show the before/after handoff count plus the updated mission forecast. This feedback explains the player's completed move; it must never recommend the move beforehand.
- Use `combo window` rather than unexplained `handoff` language in player-facing UI. Show exactly when the automatic reaction occurs, which earlier formation creates the condition, which later formation reacts, the named maneuver produced, and its visible mission consequence.
- Player-facing battle beats and debriefs must never say `handoff` or `hands off`. Use `COMBO CHAIN`, then explicitly name the creating formation, the condition it creates, the reacting formation, and the resulting maneuver or condition. Internal variables may retain handoff terminology.
- Battle confirmations must remain readable for at least 2.5 real seconds in the accelerated prototype. Label resolved combos explicitly so their green confirmation cannot be mistaken for an objective-complete alert; objective state remains visible on the battlefield marker and mission-state rail.
- During a focused collision beat, strongly suppress unrelated routes, labels, formations, objectives, and persistent ledgers. Keep only the involved formations, relevant player routes, enemy intercepts, and current result bright; restore the overall plan automatically on the next overview beat.
- Keep unassigned battlefield formation portraits fully visible above the planning board; the assignment surface must never obscure the units the player is deciding where to place.
- Enemy formations must visibly move and execute battlefield actions, but faction AI, personality, and final enemy-plan design are deferred until the player-side formation puzzle is proven.
- Enemy playbook stages must pass named conditions into later enemy stages rather than resolve as independent penalties. A player combo may trap, divert, or pass an enemy formation; reveal that collision only after the relevant player stops are staffed, then visibly redraw the enemy route and downstream orders without recommending a placement.
- `Reinforcements` always means an enemy wave; player-side additions are `Reserves`. Reinforcement forecasts must say whether the enemy wave or extraction happens first, never use an ambiguous signed time.
- An enemy reinforcement wave is a pre-authored moving formation with a visible entry route and interception point. It creates a timing/placement contingency inside the chosen playbook; it never adds a player assignment slot or asks the player to redraw paths during battle.
- State the mission's victory formula before commitment and use unambiguous result language (`VICTORY`, `DEFEAT`, or a specifically defined partial result) in the debrief.
- Fighting Withdrawal belongs to a later mission designed around force preservation; do not present it as an approach to Operation Dead Circuit.
- Formation refits are pre-deployment physical or doctrine packages, never a hand of cards or random loot revealed during a mission. Exactly one disclosed package is installed on each formation and locks when the playbook is committed.
- Refit choices must make legible tradeoffs by changing capabilities or named condition vocabulary, allowing readiness and directional combo windows to change. Do not reduce refits to generic stat bonuses, rank packages, recommend a build, or identify an optimal package for a stop.
- The first prototype run contains two operations: Dead Circuit followed by Ashen Passage. Installed formation refits persist between them; role placements reset because the next mission supplies a new authored battlefield problem.
- The intermission Salvage Workshop permits at most one deterministic package replacement across the entire detachment. The player may undo or skip it before launch; do not add random offers, rerolls, currencies, or a card-shop presentation.
- Ashen Passage assigns Sensor Blackout before deployment and requires the Signal Furnace relay to be held plus at least four formations extracted. Its stricter preservation threshold must allow a clear `DEFEAT`, not silently reuse Dead Circuit's three-formation victory rule.
- Alternate refits may activate hidden Ashen field protocols at specific authored stops. Reveal the protocol and its mission consequence only after placement; dormant feedback must never disclose the compatible stop, rank alternatives, or recommend a solution.
- Every operation must present its own authored field geometry, objective positions, enemy playbook, and reinforcement approach. Reusing the same tactical map with only renamed objectives is not a distinct mission.
- A disclosed mission pressure must alter at least two strategic levers among role demands, authored route geometry, playbook timing, and enemy-wave timing. Briefings state the changed battlefield facts without naming the best playbook or formation order, so a previously successful setup remains understandable but not universally dominant.
- Hovering or focusing a total-army play before selection previews its authored route geometry under the current mission pressure. The preview may show emphasis and sequence, but never forecast the result, rank suitability, recommend a play, or reveal a formation order.
- Use `TRANSFER` rather than `HAND OFF` in player-facing playbook stages and summaries. Internal implementation terminology may remain unchanged.
- A route preview must temporarily clear the central formation-placement board so the authored battlefield geometry is actually visible; moving away or advancing keyboard focus restores placement.
- The debrief must connect the player's named formation assignments and combo chains to the enemy orders they failed to stop, then to the resulting timing and extraction cost. Summary totals alone are insufficient.
- Route responsibility is the primary placement decision; rendezvous combo chains are secondary bonuses. Explain the battlefield pressure at each responsibility, but do not imply that one unit type is the hidden correct answer. The same role may be executed differently by an unusual formation or a themed force containing repeated archetypes.
- During staffing, identify the formation's assigned route order and battlefield method without grading the choice. The after-action debrief must explain which enemy orders that equipment package could or could not answer.
- Hover and focus may highlight another formation only when both staffed authored routes visibly share a named rendezvous. Keyword compatibility without a shared route event must not create colored partner highlights, connecting lines, or potential-combo cards.
- Hovering any formation - in the roster, on the battlefield, or in a staffed stop - shows a readable card with its archetype, movement profile, endurance, capabilities, installed refit, what it creates, what it can react to, and its assignment or reserve status. This is a stat-combo game, so those numbers are the decision and must never require a click. The card states neutral facts only: it shows the stop's demands alongside the formation's capabilities but never grades the fit, ranks candidates, or reveals a sealed combo result.
- Combo-window exercises stay optional and sealed before commitment, but the combo strip must be legible at a glance - it carries the vocabulary the whole game runs on. Superseded the earlier rule that kept it collapsed and small; playtesting on 15 Aug 2026 found it unreadable.
- The formation board needs a persistent, player-controlled route-map view. Do not make route visibility depend only on hover or force the player to see the authored paths through an opaque placement panel.
- Label the completion surface explicitly as the AFTER-ACTION DEBRIEF and lead with route assignments, then enemy exploitation, then mission cost before secondary combo totals or the full operation log.
- Command Seals are reserved for varied, mission-specific dilemmas at consequential moments. Do not reuse the same binary interruption structure at every breakpoint; defer redesign until the authored decision set is ready.
- Twin Seizure uses coherent west and east wings. Its routes may converge only after their objective responsibilities, then continue through the primary objective and extraction; do not cross friendly routes merely to create visual complexity.
- Planning shows the complete player journey from deployment through action stops, convergence, primary objective, and extraction. Enemy contacts may be forecast as known, uncertain, or unknown markers, but their exact authored movement routes remain hidden until commitment and reveal progressively during execution.
- The disposition matchup defines the fixed mission topology: deployment edge, objective locations, ordered mission requirements, battlefield pressure, and extraction. A total-army strategy may change allocation and the order or manner in which those objectives are secured, but every route must stop at each objective or action it claims, every surviving route must end at extraction, and each strategy must present a distinct objective-corridor signature.
- While a route preview is drawn on the battlefield, secondary map chrome steps back: route key, strategy read, battle sequence, rendezvous markers, contact forecasts, corridor captions, and non-previewed route segments. Objectives, numbered action stops, and the preview label stay at full strength. Suppress by opacity only, never by removing elements from the DOM, so the accessible reading order is unchanged; suppression is stronger below 1440 px.
- Audit and design-QA screenshots live in `docs/audit/`, referenced by repo-relative path. Do not commit review screenshots to the repository root or cite absolute local machine paths in tracked documents.
- Static mission, formation, playbook, enemy-plan, and tactical-reaction data lives in dedicated `src/*Data.js` modules. `App.jsx` holds components and state; do not reintroduce large authored data tables into it.
- Any battlefield state conveyed only by drawn geometry must also be announced in words through a persistent polite live region that exists in the initial DOM and clears when the state ends. Mark the visual label `aria-hidden` so the same content is not read twice. The route preview is the reference implementation.
- Small supporting text must clear WCAG 1.4.3 AA (4.5:1) against the panel it sits on. `tests/accessibility.test.mjs` recomputes these ratios from `src/styles.css`; add new surfaces to its table rather than weakening it.
- The prototype targets desktop and does not meet WCAG 1.4.10 reflow below 1024 px. This is a recorded design decision, not a bug: narrowing the layout would break the spatial relationship between battlefield, intel rail, and staffing dock. Revisit deliberately if small screens ever become a target.
- Only one Vite server may exist across the test suite. Tests needing rendered markup belong in `tests/app-render.test.mjs` beside its shared render; a second `createServer` makes esbuild cancel a build mid-run and the suite goes intermittently red.
- Any overlay using `role="dialog" aria-modal="true"` must use `useModalFocus`. That attribute tells assistive technology the rest of the page does not exist, so a dialog that does not trap focus sends the keyboard somewhere the screen reader will not read. Pass `onEscape` only where dismissal is legitimate; dialogs that require a choice must ignore Escape.
- Manual screen-reader passes follow `docs/screen-reader-test.md`. Update its expected announcements whenever an accessible name or live region changes, and keep them captured from the running prototype rather than written from memory.
- The outcome pipeline lives in `src/operationResolution.js` and must stay pure and free of React so the whole decision space can be swept. Do not move resolution logic back into `App.jsx`.
- Run `npm run analyse:balance` after any change to formation capabilities, refits, playbook timing, mission pressure, breakpoint impacts, or enemy plans. Findings and open problems are recorded in `docs/balance.md`.
- A total-army play's advantage must reach the win condition, not just an intermediate clock. `spear` granted `reactor: 30` while extraction time was bound by its own base term, so its upside never applied and its `missionDelay` penalty always did, making it a 1.2% trap. Check any new doctrine impact against `calculateOperationProfile` before assuming it does anything.
- A mission pressure states its cost to the player. `early-relief` also silently slowed two of three plays on top of its disclosed wave shift, which made it unwinnable. Keep the disclosed fact the whole cost.
- Placement must reach the outcome. `calculatePlacementReadiness` scores how many of a stop's demands the staffed formation can answer, and each unmet demand adds `UNMET_DEMAND_SECONDS` to the operation. This is a graded cost, never a FIT / MISMATCH gate: every formation still carries every responsibility, it just takes longer when it is the wrong tool. Do not stub this back to zero — it is the mechanism that makes placement the deciding lever and makes mission pressures change the right answer rather than only the difficulty.
- Placement must outweigh the choice of total-army play. Keep per-pressure `playbookTiming` overrides small (±5-10s): at ±15-30s they become a full wave-loss step and turn the mission into rock-paper-scissors, where the player looks up the correct play instead of solving the placement.
- Every (mission pressure x total-army play) matchup must be winnable with the right placement. Some matchups may be much harder than others, but none may be a dead end. `tests/balance.test.mjs` enforces this.
- A doctrine advantage expressed as an objective clock (`alpha`, `beta`, `reactor`) does not reach the win condition: `extractionAt` is bound by its own base term, not by `reactorAt + 30`. All three total-army plays shipped with this bug. Any doctrine that is meant to help must grant `extraction` as well, or it is a pure penalty. Check every new doctrine against `calculateOperationProfile`.
- Balance analysis must sweep the refit dimension, not only default loadouts: `npm run analyse:balance -- --refits` covers all 32 loadouts (138,240 outcomes). Refits change capabilities, and capabilities decide how well a formation answers a stop, so a default-refit-only sweep can miss a loadout that decides the mission before deployment.
- Lever order, verified 15 Aug 2026 and enforced by `tests/balance.test.mjs`: placement (2.86 extraction swing) must outweigh the choice of play (0.82) and the refit loadout (0.61). Every (pressure x play) matchup must be winnable with the right placement, and the best-to-worst play ratio inside a pressure should stay under about 4x, or the mission becomes a lookup rather than a puzzle.
- The after-action debrief must state what placement cost, per stop: which of the stop's demands went unanswered and the seconds conceded, then the total and how many extractions it cost. Placement decides the mission, so a loss the player cannot read back is an unexplained loss. Count unanswered demands rather than mismatched formations — most stops ask for two capabilities no single formation carries, so counting formations reads as total failure even for a good plan. This is completion-only; nothing about placement quality may appear before the playbook is committed.
- Contact must be visible on the battlefield, not only announced. When an enemy order resolves, draw the impact at the map coordinate where it lands and make the caught formations react. A banner alone leaves the battle unreadable and strips the Command Seal decision of its visible cause. Keep it restrained: rings and a short label, no particle system - this is a tactical read, not a fight sim, and `prefers-reduced-motion` must be honoured.
- `battleTime` must ease across each playback beat rather than snap to the beat's timestamp. Formations are drawn by interpolating their route against it, and beats are unevenly spaced in game time (5s apart early, 60s later) while every beat lasts the same real duration, so snapping makes formations lurch and teleport.
- The roster is deliberately larger than the number of action stops: nine formations for five stops. Choosing which five to field is the player's first decision and the game's list-building act, so never require every formation to be deployed - a plan is complete when every stop is staffed. Formations left out are in reserve, and campaign attrition thins that bench rather than leaving a hole in the plan.
- A new formation must open a capability pair or combo chain the existing roster cannot already answer, or it is a reskin. Check with `npm run analyse:balance` that it appears in some competitive list and that no list becomes dominant or dead.
- Formation endurance values stay on the 1-5 scale the dossier meter renders.
- The planning screen must show the enemy's plan as a counter-board, not only as a name. Every authored enemy order already carries the capabilities that break it; before 15 Aug 2026 that data reached the player only in the debrief, as an explanation of a result they could no longer affect, which is what made Command Seals feel arbitrary. `src/enemyCounterIntel.js` discloses, per order: the enemy's mission objective, the order's identity, its clock, its cost, the capabilities that break it, and whether the formations currently placed in its response window hold them. It must never report a resolution — capability coverage only. Concealment before commitment is preserved by the authored intelligence tier, not by hiding the whole plan.
- The intelligence tiers each withhold a different thing and must stay that way: `KNOWN` discloses identity, clock, cost and counter; `UNCERTAIN` discloses identity and counter but withholds timing and cost; `UNKNOWN` discloses nothing and is the order a Command Seal exists to answer. A dark order must stay dark no matter how the player places, or the seal becomes decorative again.
- `ENEMY_RESPONSE_WINDOWS` in `src/enemyPlanData.js` is the single source for which action stops answer which enemy order. The counter-board advises against it and `calculateEnemyClashes` scores against it; if they ever diverge the board would tell the player to fix a stop with no bearing on the order it is advising about. `tests/enemy-counter-intel.test.mjs` asserts they agree.
- Draw one enemy route at a time. The field previously drew all three enemy routes plus the reinforcement lane permanently from the first frame — a picture of everything that will ever happen, with no time ordering, which reads as noise rather than as a plan. `src/enemyRouteVisibility.js` gives each order a lead-in window: it holds on its staging edge with a clock, covers its route during the window, then collapses to a result marker at its endpoint. Authored order clocks must stay at least `ENEMY_ROUTE_LEAD_SECONDS` apart or the guarantee breaks; `tests/enemy-route-visibility.test.mjs` enforces both.
- Enemy route progress is measured across the lead-in window, never across the whole battle. Scaling against the battle leaves every enemy drifting from the first frame and makes the icon jump the moment its line appears.
- The debrief must attribute the result to individual formations, not only to the mission. `src/formationEffectiveness.js` scores each staffed stop on the three things a placement can contribute — its own stop's demands (40), the enemy orders aimed at it (40), and its combo windows (20) — and names the single highest-leverage change. Combos are the bonus layer and must never be weighted above fit or counter, or the readout would tell the player a badly placed list was fine. Every number is derived from resolved state; do not add a component that cannot be traced to the pipeline.
- Score a stop's combo contribution against the windows it actually has. The lead and recovery elements sit at the ends of the plan and have one window each; scoring them out of two penalises them for their position.
- A hover surface is anchored to the element being hovered, never to the pointer and never to a fixed corner. The formation hover card has now been wrong in both directions: following the pointer read a stale hovered id and missed the first hover, and parking it in the left rail fixed the occlusion but left it answering from nowhere near the row being asked about. `src/hoverCardPlacement.js` measures the hovered element in the same event that sets the hover, places the card beside it, clamps it into the band between header and footer so it can never ride up over the mission chrome, flips sides when there is no room, and keeps a notch pointing at the row after clamping. Reserve staging markers had the same occlusion fault at 10.5%, sitting on the battle-sequence band.
- Lane colour means "which action stop", everywhere on the map, including during a route preview. The preview originally forced a single gold over the lane's own `--route-color`, so hovering any stop previewed identically and the colour mapping broke at the exact moment the player was asking "where does stop 4 go?". Signal the preview state with cues that do not collide with hue — weight, full opacity while other chrome is suppressed, a hard dark rim, and the PREVIEW ONLY label. Every lane colour must clear WCAG AA on the preview label; `tests/accessibility.test.mjs` checks all five rather than whichever was current when a change was made.
- Extraction is a fact about the formations actually fielded. `formationFatesFor` takes `deployedIds` and scores only those; formations left in reserve get a `reserve` fate and are neither extracted nor lost. Allocating fates across the whole roster meant a nine-formation roster fielding five computed seven unaccounted, and reserves — which carry no battlefield consequences and therefore sort safest — absorbed the extracted slots while every formation the player fielded and watched reach the gantry was reported MISSING. Any count shown to the player (the outlook forecast, lost counts, the debrief) divides by the fielded force, never the roster.
- A formation that did not clear extraction must not be drawn arriving at extraction. Every authored route terminates at the gantry by construction and fate times land between `extractionAt` and `completeAt` — 96-99% of the way along — so a cut-off force looked like a force that made it, and the result read as arbitrary. `haltedStageTimeFor` halts it at the last action stop it actually reached.
- Name every term that removed a formation, with its cause. The debrief's extraction ledger states FIELDED, WAVE, ROUTE and EXTRACTED separately: the wave term was previously derived from placement delay rather than overrun (different quantities that only coincide with no time buffer), and the route term — usually the larger — was never explained at all, so a player could lose three formations and see one accounted for.
- The battle advances in discrete turns. `src/battleStaging.js` quantises drawing onto the mission's own milestones: every formation covers ground in a fixed short burst and then holds while contact resolves. The advance is a fixed duration rather than a share of the interval, because the milestones are unevenly spaced and a proportional move made long gaps crawl. This is presentation only and must stay that way — the resolution pipeline never reads a drawn position.
- Draw a player route only as far as its formation has travelled. Planning shows all five journeys end to end, which is the decision; execution drawing them all put five full-length lines on the board for the whole battle. Reserve formations are not drawn on the battlefield during execution at all.
- An action stop is authored on the ground it describes, never on the deployment line. Every stop used to sit at y≈88-95 in a row, which made a stop a starting position rather than an objective: the player could not tell what a position was for, and because the approach was then 1-4% of the route while being allotted all the time up to the formation's action milestone, formations crawled through the opening of the battle and rushed the rest. Stops now sit where their role's brief says they act, and every role carries a one-word `objective` (SEIZE / HOLD / STRIKE / SCREEN / SECURE / DENY / RECOVER) rendered on its map marker. `tests/field-plan-geometry.test.mjs` enforces the placement, the spread, the approach share, and the objective tag.
- A route reaches its action stop partway along, so `actionStopIndex` — resolved from where the role's position index landed in the finished polyline — is the split point. Do not reintroduce the `points.slice(0, 2)` assumption in `splitAuthoredRouteAtActionStop`, `positionAlongAuthoredRoute` or `authoredRouteHeadFor`; it was only ever correct while stops were on the deployment line.
- Mission-pressure `positionOffsets` shift stops by up to (+10, -5). With stops on real ground a shifted stop can land inside a building footprint or drag a route across another, so check both when re-authoring: `tests/field-plan-geometry.test.mjs` asserts no route enters blocked terrain and no two routes cross outside an authored meeting point.
- Playback muting de-emphasises, it never hides. Non-focused formations and routes were drawn at 4% opacity during execution, which meant the player could not see their own army: the battle read as an empty map with one lit unit and the reported symptom was "i just dont see how things are reacting or why they arent all moving". Emphasis is carried by the focused element's scale and glow; muted elements stay legible (0.3 for routes, 0.5 for formations and stops).
- Route-origin markers fade once the operation is under way. At full strength they read as the army still sitting on the deployment line while its markers moved off somewhere else.
- A failed or missed outcome must never render in the colour of a success. Every icon in the debrief's after-action grid was hard-coded green, so "Crew left behind" shipped a green warning triangle. Outcome cards carry an explicit `outcome-failed` / `outcome-missed` state.
- FOCUS is the default planning view and the screen is kept to the decision. Playtesting on 15 Aug 2026 found the planning screen carrying roughly twenty distinct information regions for a decision that is five assignments — every prior round of feedback had answered a real complaint by adding a surface, and collectively they stopped being readable ("I really dont know what everything is doing and im making the game"). FOCUS shows the play, the roster, the map with its objectives and action stops, the assignment board, the mission pressure and the enemy counter-board. FULL DETAIL restores the rest for auditing a result. A panel may only be demoted if it is duplicated elsewhere on screen, sealed until commitment, or prototype tooling — never if it is part of the five assignments. Before adding a new planning surface, check whether an existing one should be demoted to pay for it.

## Second resolution model — battle rounds (added 15 Aug 2026)

- `src/battle/` holds a second, independent resolution model, built alongside the operation pipeline rather than replacing it. Playtesting returned the same verdict repeatedly — "is it a race to the objectives? why is the enemy coming from one corner? i just find this weird and awkward" — and the diagnosis was that the operation model shares no structure with the tabletop game it evokes: no facing armies, no rounds, no shooting, no objectives scored while held. The battle model is that shape exactly: both armies deploy on opposite edges, five rounds of MOVE / SHOOT / FIGHT / SCORE, most victory points wins.
- It stays an autobattler. The player's decisions are the list, the deployment slot for each formation, and the objective each is ordered to advance on. Nothing is steered once the battle starts.
- Deterministic, no dice — carried over deliberately from the operation model so the whole decision space stays sweepable. `npm run analyse:battle` resolves 15,120 list-and-deployment outcomes and 3,125 order assignments exhaustively. It must keep showing: no list wins from every deployment, most lists playable, and orders swinging the result by several victory points.
- Both models share the nine-formation roster. `src/battle/battleProfiles.js` gives each formation wargame stats authored from its existing identity rather than derived by formula, because a formula makes the SHIELD WALKER and the SIEGE GUN CARRIAGE interchangeable once the labels are stripped.
- Neither model is deleted until the comparison has actually been played. `src/main.jsx` switches between them.
- Shooting inside a round is simultaneous: both sides fire from a snapshot taken before either takes losses, so a formation destroyed this round still got its shots off. A formation that began a round dead never acts in it. `tests/battle-rules.test.mjs` asserts both.
- Mission fairness is mirror symmetry, not equidistance. Each army has a home objective it starts closer to — that is what makes deployment a decision, since garrisoning it costs a body in the centre. What must hold is that the objective layout mirrors about the centre line with equal points per half.
- The battle plays itself. It is an autobattler: committing the army starts the rounds resolving on a timer, and doing nothing must still show the whole battle. Pause, step and replay exist for reading a round back, never for driving it. Do not reintroduce a next-round button as the only way to advance.

## Stratagems and the hidden hand (added 18 Aug 2026)

- The uncertainty in a battle is a **hidden enemy hand**, not dice. The player sees the enemy detachment's whole stratagem *pool* before committing and never learns which cards it actually holds until each one is spent. This was chosen over randomising the resolution because you lose to a decision rather than a bad roll — you can watch what they spent and plan for it next time — and because a hand drawn from a finite pool is still enumerable, so the exhaustive sweep keeps working. Nothing in `resolveBattle` may become random.
- `src/battle/stratagems.js` holds the cards, the triggers, the detachment pools and the draw. `STRATAGEMS` is keyed by `id` — a card whose key and `id` disagree is silently unspendable, which is exactly the bug that shipped in the first draft of this module.
- The player's decision is **when**, not just what. A stratagem is committed to a round before the battle (`playerStratagems: [{ id, round }]`); the same card in a different round is a different battle. The sweep measures this: timing swing must stay at least as large as card swing, or the timing choice is decoration.
- `drawEnemyHand` ranks the whole pool by a seeded hash and slices it. It must not walk the pool with a stride — a stride sharing a factor with the pool size lands on the same index forever, which is a hang rather than a bad hand. `tests/battle-stratagems.test.mjs` sweeps every pool size and 24 seeds against this.
- Every spend, both sides, appears in the round's `spends` and in the log before anything it caused. A battle must never be lost to something the player was not shown happening. The UI renders spends once, as a banner above the objectives, and filters them back out of the log — the same line twice is what made the operation screen unreadable.
- Effects that scale a number **multiply** when stacked rather than the last one winning, so paying for two of something is worth what it cost.
- Both armies get a **double advance on round one**. Without it three of five rounds were two armies walking at each other with nothing to watch. It is symmetrical, so it costs neither side anything.
- SURGE FORWARD does **not** stack with that opening advance. Letting it add a third move made a one-point card worth +6.6 average victory points and take a 0%-win list to 83% — the sweep caught it before it was ever played. `moves()` takes the max, not the sum.
- `npm run analyse:battle` now has a third axis: 12 enemy hands x 21 player choices. Its verdict must keep showing that the enemy's hand changes the result, that timing matters at least as much as card choice, and that no single stratagem play wins every battle.

## Detachment -> disposition -> strategy (added 18 Aug 2026)

- Three layers, each narrowing the next: **detachment** gates which dispositions you may declare and which stratagems you may spend; **disposition** replaces the victory condition; **strategy** is one of three authored plans for scoring that way. `src/battle/doctrine.js`.
- Putting the *scoring rule* on the disposition is what makes the layers bite. A detachment that only handed out stratagems would be a cosmetic label; one that gates how you are allowed to win is a real list-building decision, and it makes the same board winnable three ways.
- Both armies declare a disposition and both are disclosed before the battle. **What stays hidden is only the stratagem hand.** You always know what your enemy is trying to do, never exactly what they are holding to do it with. Do not start hiding intent — that is the line the whole disclosure design sits on.
- Every detachment must allow at least two dispositions and fewer than all of them, and at least one must be reachable from both, or the detachments are separate games. The sweep asserts they disagree.
- A strategy presets every deployment slot's objective; a slot the player explicitly changes keeps its override. Declaring a new disposition or adopting a new strategy clears every override, because both were answers to a question that just changed. Orders swing the battle by 20 VP, so overriding must stay possible.
- Losses are counted from the top of each round, not from the start of the battle. Get this wrong and a wreck pays ERADICATION 4 VP every remaining round, and SAFEGUARD never sees another clean round.
- **ERADICATION is paid on damage, not on kills.** A five-round battle destroys 0.48 formations on average — measured, not guessed — so a pure body count topped out at 8 VP against an enemy that reliably scores 13 and nobody would ever have declared it.
- Scoring is razor-sensitive: one victory point per round is decisive, so a x2 to x3 change on a single objective moved a disposition from a 1.3% to a 79.9% win rate. Tune against `npm run analyse:battle` axis D, never by eye. Current: dominion 7.1%, eradication 26.7%, safeguard 25.4%, preferred by 14 / 75 / 37 of the 126 lists.
- The mutation script is `scripts/mutants.sh` (149 mutants, 0 surviving). It lived in `/tmp` for most of this project and was re-derived from scratch every session; it is in the repo now. It restores every `.bak` on EXIT, INT and TERM. An interrupted run previously left a mutated source file on disk, and the next sweep measured a deliberately broken build — the SURGE non-stacking fix silently reverted this way and was only caught because the sweep number moved.

## Strategies are plans with paths (added 18 Aug 2026)

- A strategy is a **route per deployment slot**, written against named ground in `src/battleTerrain.js`, not five objective assignments. Five assignments have no shape: you cannot look at them and see a pincer, a refused flank, or a screen holding the gate the column passes through. The routes are drawn on the board during deployment, so a plan is chosen by looking at it. `src/battle/battlePlans.js` owns all nine; `doctrine.js` re-exports them.
- **Do not let a plan collapse back into assignments.** At least three of a plan's five slots must route through intermediate ground, and `tests/battle-doctrine-layers.test.mjs` asserts it.
- A plan's destination is **derived from where its route ends**, never declared separately, so a plan can never claim ground its own path does not reach.
- Leftover movement carries into the next leg. A formation that stopped at every corner would make a plan slower in proportion to how many corners it has, which is an accident, not a design.
- **No route may be longer than a move-11 formation can walk in five rounds (66 units).** Just above the middle of the roster, so a plan may demand speed but never demand the impossible. The first drafts of PINCER and PRESSURE had 74- and 91-unit routes: a whole deployment slot spent on a formation still walking when the battle ended.
- Coordinates from the operation model's plays cannot be lifted. That map is a one-sided incursion through a city; this one is two armies facing each other. Same idea, re-surveyed.
- **A detachment is the character of the army**, not just a gate: each one has a standing `rule` in force every round — SCRAPBORN PLATE (takes a tenth less), RANGING OATH (+1 to hit shooting), JAWS FIRST (melee at half again). Three detachments, all within 10 points of each other on win rate, all reachable to DOMINION and each missing something the others have.
- The enemy walks an authored route too. It beelined before, which arrived as a flat rank; a route gives it a shape the player can read off the board and counter.
- ERADICATION scores on **cumulative** damage with what has already been paid subtracted. Flooring each round separately punished spreading fire: PINCER dealt 21.5 wounds to HEADHUNT's 22.8 and scored 5 to its 14, almost all of the gap being remainders thrown away four times over.
- Concentration kills and dispersal does not — total damage being equal, massed fire produces wrecks and spread fire produces none. That is why ERADICATION's three plans are all ways of concentrating, and why a flanking plan under it was dead content until it was re-aimed.

## A disposition changes the board, and there is a second one (added 18 Aug 2026)

- A disposition decides **which objectives are live for you at all**, not just what holding one pays. `sites(objectives, side)` on each disposition returns the markers that pay that side, already re-valued; `scoreRound` only ever hands the rule its own live set. That is what makes declaring one a commitment rather than a modifier — **the board visibly changes when you choose.** ERADICATION darkens every marker; SAFEGUARD darkens everything past your own half and doubles what is left.
- Each side reads its own live set, so the same marker can be worth two points to one army and nothing to the other in the same round.
- Re-valuing must copy. A `sites` implementation that mutates the mission's objectives corrupts every later battle; there is a mutant for it.
- **Landmark names are roles, not places.** Every board names the same ground — `westApproach`, `reactor`, `northRelay` — at different coordinates, which is how one authored plan is playable on any mission. It is also the only real test of whether the nine plans are doctrine or were overfitted to the board they were written on. The sweep asserts no plan is board-locked.
- **THE NARROWS** is the second board: the same five roles and the same six victory points, squeezed toward the centre line. The values are deliberately identical to BREAK THE CIRCUIT so the only variable is geometry — contact on round two, no long flank lane, no time to set anything up. Its enemy is the SALT COVENANT, a different roster under a different detachment.
- Adding it immediately killed four plans that had looked fine: all three SAFEGUARD plans plus TRAPLINE went to a 0% win rate on the tighter board. Two were fixed by levelling the board (a 3-point centre was doing it), and SCREEN AND HOLD had to be replaced outright — it was strictly dominated by HOME LINE there, scoring the same and conceding more. **One board hides dominated content; two boards expose it.**
- Every route has to be walkable on every board. The reachability bound is per-mission (`11 * (rounds + 1)`).

## The operation model was retired (18 Aug 2026)

- One game now. `src/main.jsx` renders `BattleApp` directly; the mode switch, `src/App.jsx`, `src/styles.css`, 28 operation-model modules, 23 of their test files and the operation balance sweep are gone — 54 files, 812 KB. The comparison had been made and the battle model won it; keeping both alive meant every new rule had to be built twice or built nowhere.
- **What was worth keeping came across rather than going with it.** The per-formation after-action readout is `src/battle/afterAction.js` — "i kind of need to know what worked... maybe a percentage how effective the unit was". It measures against what the declared disposition actually pays for: share of damage under ERADICATION, share of objective-rounds held under the others. Measuring a formation against a job it was never given is worse than not measuring it.
- A wreck holds nothing, and standing on ground the enemy holds is not holding it. Both have mutants; the misleading-debrief failure mode ("apparently i left crew behind and it is a green triangle") is the one this readout exists to avoid.
- The static accessibility guards and the SSR structural guards were **re-pointed at the battle screen, not deleted**. Doing so immediately found three labels dimmed with `opacity` — the dark objective marker was at a 1.6:1 contrast ratio. **Never dim text with `opacity`**; composite it into the background by hand and it is unmeasurable. Anything carrying information is dimmed by colour so its contrast can be checked. Inactive controls and strokes are exempt.
- The contrast test **reads colours out of the stylesheet** rather than hardcoding them. Hardcoding made it decorative: a colour could be changed in the CSS and every assertion still passed against the old value. A guard that can pass by finding nothing is not a guard.
- `@phosphor-icons/react` went with the icons in `formationData.js` — nothing renders them and importing the set was most of the bundle. 500 KB+ down to 239 KB (75 KB gzipped), and the chunk-size warning is gone.
- The test count dropped from 282 to 83 because the code those tests covered no longer exists, not because coverage regressed. Every remaining module is still mutation-tested: 59 mutants, none surviving.
- `npm run analyse:balance` is gone; `npm run analyse:battle` is now just `npm run analyse`.

## A sweep metric that was lying (18 Aug 2026)

- `LIST + DEPLOYMENT` printed **"deployment swing inside the best list"** and reported the spread between the best and worst *list*, which is a different question. It looked plausible only because the worst list sits at 0%, so `max - min` returned the best list's own rate and the two numbers agreed by coincidence.
- Every (list, ordering) pair is a single deterministic battle, so a "swing inside a list" is not a percentage at all. The honest measure is **how many lists contain both a winning and a losing deployment** — the same five formations, arranged differently, being a different outcome. Currently 121 of 126, with five settled by the list alone (the five that never win from anywhere).
- The lesson is the general one: a number printed beside a label nobody re-derives will be believed for as long as it is printed. Every line in the sweep that makes a claim should be a PASS/FAIL verdict, because a verdict states its own threshold and can be wrong out loud. This one now is.

## The run (added 18 Aug 2026)

- `src/battle/campaign.js`. The roguelite half of the pitch, which did not exist: every battle used to start from a clean slate, so nothing you did in one meant anything in the next.
- **The difficulty curve is your own attrition.** The enemy does not inflate — the same authored armies fight you at full strength. What changes is that your formations carry wounds forward and wrecks do not come back. Do not "fix" a hard run by scaling enemy stats; that is the thing this design is instead of.
- **A lost battle does not end a run.** A single battle is close to a coin flip against a competent army: ending the run on one killed 46% of runs at the first fight and let 0.1% finish the ladder. A loss costs you the casualties and the reward, and those compound. The run ends when the army cannot field `MINIMUM_FORCE`, or when the ladder is done.
- **The ladder ramps at both ends.** Early engagements field part of the enemy army (3, then 4, then 5) with a smaller hand. Without the opening ramp the first fight is the whole army and the run is decided before it starts.
- **Every disposition needs a run-level payoff, not just SAFEGUARD.** When SAFEGUARD was the only one with a consequence that outlived the battle it was simply the right answer. ERADICATION now carries the enemy's dead forward (capped, and never below three fielded); DOMINION converts held ground into repair; SAFEGUARD's payoff is the casualties that did not happen.
- **Battles won and battles fought are different questions.** Reporting only the first conflates surviving with winning — a run that breaks after two fights can win at most two, so anything that keeps the army alive looks like it also wins more. It was worth 3.24 "battles won" to SAFEGUARD against 1.44 for the others on that reading; on win rate the same runs are 64.9% against ~35%. The run verdicts are judged on rate, with survival measured separately. This is the second metric in this project to have been quietly wrong in exactly this way — see the deployment-swing entry above.
- SAFEGUARD's clean-round point requires **holding your own ground**, not merely avoiding contact. Paying it for a quiet round rewarded hiding, and a run compounds that.
- The run axis of the sweep is **exhaustive over policies and sampled over seeds** — the only place in this project that samples. It says so in its own output, and it must keep saying so.
- Known soft spot: SAFEGUARD still wins 64.9% of run battles against roughly 35% for the other two. It passes the verdict threshold and its sample is confounded — it is only available to VOIDBREAKER, the tankiest detachment — but it is the first thing to look at next.

## Victory points are the currency (added 18 Aug 2026)

- `src/battle/market.js`. The score used to be a scoreboard and nothing else; now what you take in a battle is what you spend between them, so how you score and what you can afford are one decision. A disposition is an economic strategy as much as a way to win.
- **Income is what you SCORED, not the margin.** A battle you lost still pays for what you took while you were losing it — the same reason a lost battle does not end the run: it has to cost you something without ending everything.
- **Unit costs are authored, not derived from the stat line.** A formula makes the SHIELD WALKER and the SIEGE GUN CARRIAGE interchangeable once the labels are stripped, and it makes the most efficient unit per point the right answer every time. Same reason the wargame profiles are authored.
- **The shelf is drawn once, when the market opens, and then held.** Deriving it from the roster on every read meant buying one formation silently re-rolled the other two, so you could churn the shelf by spending. Caught by playing a run in the browser, not by a test — the tests came after.
- Free field repair covers a scratch; anything worse is bought. But cutting free repair to a token two wounds killed formations faster than the market could replace them and warbands ended runs *smaller* than they started (3.78 from 4). It is 4 now, and the paid services top it up.
- A warband starts at exactly the five deployment slots. Starting at four looked like the right roguelite shape — begin small, grow — but two casualties then put you under the minimum, so it made runs shorter rather than harder.
- Growth is earned, not automatic: warbands average 4.60 from 5, and 42% of runs end bigger than they started. Attrition and acquisition are deliberately close to balanced.
- The sweep's spending policies are the two honest extremes and the two obvious middles — widen, patch, cheapest, dearest — and the verdicts require that which one you follow changes the run.
- The purse at the very end always looks hoarded, because the final engagement's score arrives with nothing left to buy. Measure `unspent` (the purse minus the last battle's income), not `purse`, or you are measuring where the run stops.

## Refits, and what was wrong with the game (added 18 Aug 2026)

Asked whether it was fun, the honest answer was that it was more interesting than fun, and that the gap was **discovery**. This project spent most of its life making things legible — the counter-board, the scouted pool, plan summaries, dispositions that state exactly what they pay. That was the right fix for "I don't know what anything is doing" and the wrong one for interest: everything is told to you before you commit, and nine formations whose stat lines never move is a game you can read once and then have read.

- `src/battle/refits.js`. Two per formation, eighteen in all, using the names and intent the roster has carried since the beginning and never used for anything.
- **A refit is a TRADE, never an upgrade.** Every one gives up something the formation was good at. There is a test that fails if any of them only gives.
- **The important half is that several grant a keyword the rules already care about** — SHIELD, COMMAND, REPAIR. Those are not new rules; they are existing rules arriving on a hull that could not carry them before, which is where a discovered combination comes from rather than an authored one. One refit takes SHIELD *away*, because losing a keyword is a real trade.
- One hull carries one refit, and **the market is where that is enforced** — a hull already carrying one is never offered another. The check is not repeated in `buy`, where it would be unreachable and therefore untestable. That was a surviving mutant before it was moved.
- The market snapshots its refit shelf like its unit shelf, so buying does not re-roll it. Its filters are tested against `marketFor` directly rather than through a run, because a run's snapshot may or may not contain the case being tested.
- `headlineFor` in `afterAction.js` gives each round the one thing worth saying about it, ranked: a formation you lost, then one you wrecked, then a spend, then the heaviest blow. Five rounds of markers sliding in silence is confirmation, not suspense. A wreck is only news the round it happens.
- Difficulty: the middle rung of the ladder was softened from five enemy formations to four. The median run still wins 2 of 5.
- The growth verdict now measures **investment** (formations plus refits) rather than roster size. Counting only whether the warband ended bigger marked a run that spent everything on refits as a failed economy, when it had spent everything.

Still open on the "is it fun" question: the deployment screen is still five stacked panels before anything happens, and no one has played this as a human rather than through a Playwright script.

## Playtest fixes (added 18 Aug 2026)

Six changes from the first real human playtest. Recorded with the complaint that produced each, because the complaint is the reason and the reason is what gets lost.

- **"I shouldn't get a choice on where they go, that is part of the strategy... I just choose the units."** The per-slot objective override is gone. The strategy decides where every slot walks; the player decides who walks it. This also halved the deployment screen, which was the other standing complaint.
- **"Seeing the enemy's movements before the start gives too much power to the player."** The enemy's routes are no longer drawn. Its deployment is — you can see an army lined up across a table — and its intent is still stated in words. **This is deliberate groundwork for asymmetric PvP: nothing that would not survive a real opponent should be shown.**
- **"How do I know which units survived?"** The roster shrank and nothing ever said why. A battle now records `survivors` as well as `lost`; the debrief names who came back, and the market leads with DID NOT COME BACK.
- **"Command points should not necessarily reset... I found myself just hitting the 3 command point things every time."** They no longer refill. What you spend is gone, what you keep carries, and REQUISITION in the market is the only way back up. This turns a repeated identical decision into a dwindling run resource.
- **"I don't know if my command points did anything."** Every spend now reports a measured outcome from the round it fired in — damage taken while braced, damage dealt before either army moved, which formation the army concentrated on — and says plainly when it accomplished nothing.
- **"I don't know who is firing at whom."** Every shot, overwatch and melee in the round being shown is drawn on the board, weighted by damage. The log said who fired on whom and the board never did; this is the log, on the board.
- **"I didn't want the same army to fight five times — it was more Bazaar-like in that you buy and swap out units."** Formations can be RETIRED from the market for half their cost, so the warband can be churned rather than only reinforced. Never below `MINIMUM_FORCE`: ending a run by selling your own army is not a decision anyone means to make.

The standing verdict from the same playtest, still open: *"The game is interesting but it is not quite fun."*

## Second playtest round (18 Aug 2026)

- **"ASSAULT WALKER destroyed — is that mine or theirs?"** It was his, but red is the enemy's colour everywhere else on the screen and both armies field formations from the same roster. The headline now says whose: **"You lost X"** / **"You wrecked Y"**. Never rely on colour alone to carry ownership here.
- **"Do the recovery vehicle and whatever is below it not fire?"** It was repairing — and the fire drawing explicitly filtered `phase === "repair"` out, so the one formation doing something other than shooting was the one that looked idle. Repair is drawn now, in its own colour.
- **Support links are drawn.** SHIELD soaking for a neighbour and COMMAND improving what is near it have been in the rules since the profiles were written and the screen never showed either. `supportLinksFor` derives them from position; `SUPPORT_RANGES` is asserted equal to the rules' own ranges, because a combo drawn at the wrong distance is worse than one not drawn.
- **Command points come back for free**, from the army you fielded rather than the purse: one for taking the engagement, one for each COMMAND formation still standing, capped at two. This makes the COMMAND VEHICLE — and the SPOTTER MAST refit that grants COMMAND — an economy rather than a stat line, and it is the first real synergy between the market and the battle.
- **The stat line is visible before the choice, not after it.** A dropdown of names tells you nothing about what you are picking, so the deployment screen leads with what the warband has and what each of them does.
- The market's roster block was cramped — a long name, a status and a button crushed onto one line. It is a three-column grid now.

## Throughput, not shape (18 Aug 2026)

*"I didn't want the same army to fight five times — it was more Bazaar-like in that motion where you buy and swap out units and find the best combos."*

RETIRE answered the letter of this and not the substance. The tension was fake and the problem was **throughput, not shape**: at roughly 11 VP a battle with hulls priced 3–7 and refits at 3, a whole run bought you about two changes. Nothing was ever discovered because nothing was ever tried. The fix is not a different run structure — it is making the run afford one.

- Hulls cost **2–5** (were 3–7). Refits cost **2** (was 3). The shelf shows **five** hulls and **three** refits (were three and two).
- The army stays one army across five engagements, and the roster is allowed to grow well past the five deployment slots. **The warband is the collection; the deployment is the counter-pick.** Which five you field against *this* enemy is the per-engagement decision, and it only exists once there are more than five to choose from.
- Measured: a warband ends a run at 5.62 formations with 3.08 of them refitted, from a start of five and none — against 4.60 and 1.86 before. 64.9% of runs end ahead on formations-plus-refits. A browser run that bought everything it could afford went 5 → 7 → 9 hulls by the third engagement.
- The roster caps itself at nine, because there are nine formations and the shelf never offers one you already hold. That is the ceiling of the counter-pick space, not a number to tune.

Two bugs surfaced only because refits stopped being rare, both of which had been wrong since refits shipped:

- **The deploy screen printed factory stat lines beside refit names.** A SHIELD WALL bastion showed the wounds it no longer had. Everything that *displays* a formation now resolves it through `profileWithRefit`, the same call `deployUnit` makes — one function, so a screen and the board cannot disagree.
- **Repair measured a hull against its factory maximum.** Four refits move a hull's wounds, so a reinforced bastion healed to its old 14, was marked "as it came out of the yard", and then fought at 18 — free wounds for anyone who bought armour. `fullStrength` reads through the refit now. Both are guarded by mutants; the repair one survived its first mutant because the test picked a damage level where the two readings happened to agree.

### Where the combos stood before pairings

Real, in the rules, and now visible: SHIELD soaking, COMMAND hit bonus, REPAIR patching, and the eight refits that move those keywords onto hulls that could not carry them. Plus COMMAND generating command points across a run. What is still missing is anything the player *discovers by trying* — every interaction above is stated on the card that grants it. Named, unlisted combinations that only reveal themselves when two specific formations stand together are the next step, and the throughput change above is what makes them reachable: a player who can only afford two purchases a run will never stand the right two hulls next to each other by accident.

## Pairings — the one layer written on no card (18 Aug 2026)

`src/battle/synergies.js`. Six named pairings that fire when two formations with the right pair of keywords stand within **10 units** of each other. They are printed nowhere: not on a card, not in the rules panel, not in a tooltip. The first time one forms, the round banner says its name out loud and the run writes it into FIELD NOTES, where it stays for the rest of the run.

This is the answer to *"what are our thoughts on combos now?"*. Everything the game called a combo before this was **stated on the thing that granted it** — SHIELD soaks, COMMAND improves what is near it, REPAIR patches, and every refit names which of those it hands over. That is legibility, which this project spent most of its life earning, and it meant a player who read the cards knew the whole game before the first battle. Nothing was discovered by anybody.

Three rules keep it from being noise:

1. **Keyed on KEYWORDS, never on formation ids.** Nine formations would be thirty-six authored pairings that a wiki flattens in an afternoon. Keywords mean the **refit market is the discovery engine**: a FLAME SUPPORT VEHICLE that bought an ASH CRUCIBLE has SHIELD, and can anchor on a heavy hull it could not anchor on the battle before.
2. **Both armies get them.** It is a rule of the board, not a player power — which is what makes it survivable in the asymmetric PvP this is being built toward.
3. **Nothing is random.** A pairing is a function of position, so the sweep still resolves the space exhaustively. Axis F resolves every list and every ordering (15,120) **twice** — once with the layer and once without — so what the layer is worth is measured on the same battle rather than on two different ones.

### Standing together is a trade

`PACKED_DAMAGE_STEP = 0.06`, charged **per neighbour**, to **anyone** standing shoulder to shoulder whether they are paired or not.

- A flat toll on being paired got the sign right and the shape wrong: it taxed a deliberate two-hull pairing exactly as hard as a five-hull knot, the layer made lists worse off about twice as often as better, and the lesson a player would learn from it was *do not stand together*.
- Charging it only to paired formations would have made massing without a pairing free, so the cost would read as a punishment for synergy rather than as a rule of the board.
- The cost is applied **by the caller, where the damage is computed**, not inside `applyDamage`. Applied there it was invisible twice: the log understated every shot into a crowd, the fire drawing is weighted by that number, and **ERADICATION is scored off the log** — so a disposition paid on damage was being paid on damage that had not happened.

### What it cost to land

- **HEADHUNT was five formations onto the Reactor Spine and won 90.9% of every battle it was declared in.** It had been sitting at 89.7% — a tenth under the auto-win threshold — since before this work, and the pairing layer tipped it, because a plan that stands everything together collects every pairing at once. Two of its five hunt wide now. ERADICATION fell from 67.2% to 49.3%, its best line is DECAPITATE at 76.2%, and the three dispositions are 20.4% apart instead of 38.7%. The layer did not break the balance; it made a pre-existing near-failure impossible to keep ignoring.
- **ERADICATION's divisor was written twice** — a literal `4` in `score` and a `damagePerPoint: 4` beside it, with only the second one read when working out what damage TAKEN costs you. Raising the field alone made ERADICATION stronger, because it cut the penalty and left the reward untouched. It is read from the field now.
- **Neither authored Helioch army ever forms a pairing.** The rule applies to both sides and there is a test that proves it on a constructed force, but each enemy list is authored to five different places and the only pairing its keywords could make is LOCKED SHIELDS between hulls on opposite sides of the board. Ordering the bastion to garrison the relay instead does produce one — and moves HEADHUNT from 89.9% to 93.5%. **The enemy's orders are load-bearing for the whole balance and should be revised deliberately, not to satisfy a layer that arrived after them.** This is the standing gap in the feature.

### The sixth metric that measured the wrong thing

Two in one change, which is a record:

- **The support links added last playtest drew nothing at all in the app.** `supportLinksFor` reads keywords and the round record did not store them; the test passed because it handed the function keyworded units directly and the screen hands it the round record. Anything a screen derives has to be derivable from what the round actually stores. Keywords are recorded now.
- **The stratagem axis probed one mid-table list at a fixed percentile.** When the pairing layer shifted the ranking, the list that landed on that percentile happened to be one where the enemy's hand genuinely cannot change the outcome, and the verdict read as though hidden information had stopped working everywhere. It pools three lists now. A claim about a layer has to be a claim about the layer, not about whichever list the percentile picked.

### On the board

A pairing is drawn as a solid gold line **and a named badge between the two hulls**, because a pairing only forms when they are within ten units of each other — so the two markers are usually on top of one another and the line has no length to see. The badge is the part that reads.

## The enemy, built rather than authored (18 Aug 2026)

`src/battle/enemyArmy.js`. The enemy was furniture, and the pairing gap was a symptom rather than the disease. Measured before touching anything:

```
seed 1 / 7 / 42 — identical, all three
  B1  circuit-clash  railjack, carriage, breaker            dominion
  B2  narrows        bastion, breaker, command, skimmer     dominion
  B3  circuit-clash  + command                              dominion
  B4  narrows        + railjack                             dominion
  B5  circuit-clash  + bastion                              dominion
```

Every run, every seed, every detachment faced those five in that order. Difficulty scaled by `army.units.slice(0, enemyCount)` — a prefix — so "harder" meant *the same army with one more vehicle bolted on*, and the opening engagement was a five-against-three the player won 96% of the time. Six distinct hulls appeared in the whole game. Both armies declared DOMINION, always: the player has three victory conditions and never once faced an opponent using a different one.

That mattered most because of the throughput change. **Picking five of nine against a constant is not a counter-pick, it is a lookup** — solved once, then arithmetic.

So the enemy is built out of the same parts the player builds from:

- **A plan from the same table**, walked MIRRORED. `resolveRoute(..., { mirrored: true })` reflects every point about y = 50, because the landmark names are written from the southern edge and a name-level mirror would need a second hand-kept table that could drift. TRAPLINE walked from the north edge is exactly TRAPLINE. Five hand-authored routes and targets per army is what made its orders load-bearing for the whole balance — every sweep axis measures the player against this army, so those lines *were* the measuring instrument.
- **A disposition its detachment allows**, drawn from the run's seed and disclosed before the player commits.
- **A list chosen to walk it.** `slotRoleFor` reads how far each slot has to walk and what it stands on when it stops; `fitFor` scores hulls against that. Slots are filled hardest-brief-first, from a shortlist of two, so the army is always sensible and never the same twice.

### The control enemy

`buildEnemyForce(mission)` with no options is the CONTROL: the doctrine's own declared disposition and plan, seed zero, full deployment. Every sweep axis that makes a claim about the *player's* choices is judged against it, including the run axis, which now plays every policy twice — once against the control and once against the enemy the game ships. Judged on the varied enemy, "how long an army lasts depends on how it fights" read 0.17 battles, which is not a finding about how the player fights at all.

### Four bugs the rebuild exposed, all of them years-old in project terms

**The board was mirrored and the ledger was not.** Same list, same slot order, same plan mirrored, positions exactly reflected every round — and the player dealt 34.1 damage to the enemy's 8.5, scoring 11 to 4. Three faults in one place:

1. **The repair phase ran for the player only.** A whole rule of the game applied to one side of the table. The enemy could field a REPAIR hull, and buy the refits that grant REPAIR, and none of it ever did anything.
2. **Patching a friend counted as damage dealt.** ERADICATION is scored off the round log and the repair phase writes into it, so an army earned victory points for healing itself — and only one side had a repair phase, so the whole inflation landed on one army.
3. **The enemy's half of a melee exchange was logged as the player's.** Melee is simultaneous and the whole exchange was written down as one line on the player's side. It reached the wounds correctly and the scoreboard backwards, and the board's fire drawing is drawn from that log, so the enemy was never once *shown* fighting back.

With the ledger honest the mirrored fight comes out 22.0 against 22.5.

**FOCUS FIRE was dead.** It picked the highest-threat formation on the board regardless of range, so against an enemy that keeps a heavy hull back the whole army held fire — in every round of every battle. Two command points for nothing. It picks the most dangerous thing *someone can actually reach* now. Only visible once the enemy walked a plan instead of beelining into the middle.

**PRESSURE's fifth slot stood on nothing.** It walked past the gantry into the enemy half, which scores nothing under a disposition that scores only ground. It won 1.6% of the battles it was declared in and read as a plan nobody should take rather than as the bug it was. The old enemy was weak enough to hide it.

### What had to be retuned, and why

- **ERADICATION pays 1 VP per 3 wounds** (was 4). With the ledger fixed, a battle produces 10–35 damage against a holding army's ~13 victory points, and eradication was worth about half of dominion for whoever declared it. Its `scoring` line is now generated from the number rather than typed beside it — it said 4 while the rule paid 3, because the sentence was written once and the divisor was tuned later.
- **The ladder no longer ramps by size.** Every engagement is a full deployment; what escalates is the hand the enemy is holding.
- **Nothing is repaired for free.** `FREE_REPAIR` is 0, so repair between engagements is DOMINION's supply and nothing else. A flat four wounds for everyone meant damage never accumulated across a run: every disposition lasted the same number of engagements whatever it did to its own formations, which is the one thing a roguelite cannot afford. 24.7% of armies now break before the ladder ends.
- **A hull lost does not appear on the very next shelf.** A wreck was replaceable for two or three points the same evening, so preserving the army bought nothing a run could feel.

### The open one

ERADICATION is still the weaker declaration: across 1080 runs against the enemy the game ships, the player wins 36.6% of engagements against a DOMINION enemy and 71.4% against an ERADICATING one. It is a swing, not a free win, and it is verdicted — but it is the next thing to fix, and the evidence says the fix is in what an eradication plan is allowed to stand on, not in the rate it is paid at.

## Eradication and denial — an experiment that failed (18 Aug 2026)

DECAPITATE and CROSSFIRE both had slots ending on ground no board scores, and the reasoning for fixing that was sound on paper: ERADICATION scores no markers, but standing on one still CONTESTS it, and denying the other army a point is worth exactly what taking one is — so a plan whose slots end on nothing should be handing the board over for free.

Rewritten so all five slots ended on markers, **ERADICATION fell from 40.1% to 13.2% and CROSSFIRE to zero.** Reverted, and written into `battlePlans.js` so nobody tries it again. The theory was wrong in a way worth keeping: *a formation standing still on a marker it does not score is a formation being shot, and ERADICATION is paid for shooting.* Under a disposition that scores no ground, holding ground is not a cheap denial — it is a free target.

## The ground (18 Aug 2026)

`src/battle/battleTerrain.js`. The board was a flat plain with markers painted on it: every lane cost the same, every gun saw the whole table, and the only thing separating one route from another was its length. That made a plan a distance calculation.

Three kinds, each doing exactly ONE blunt thing, for the same reason the stratagems are few and blunt:

| | what it does |
|---|---|
| **BROKEN GROUND** | crossing it halves the advance |
| **COVER** | fire coming into it is cut by two fifths |
| **BLOCKING** | nothing shoots through it, in either direction |

Melee is untouched: two formations in contact are in contact, and a rule letting a wall stop a fight already happening would be a rule about the wall.

- **Authored in the southern half and reflected.** Fair by construction rather than by inspection; a feature sitting on the centre line is its own mirror and is placed once. There is a test that every feature has a twin.
- **Broken ground is charged for CROSSING, not for standing in.** A rule that only charged for standing would be free to anything fast enough to clear the field in one move — exactly what ought to be paying.
- **`routeCost` is the number every reader of a route uses**: the reachability guard on the plans, and the enemy's list builder when it works out how fast the hull filling a slot has to be. Reading plain distance put the slowest hull on the rubble lane.
- **`terrainFor(null)` is a flat plain, not a default board.** A caller that forgets which ground it is on gets something obviously wrong rather than the Circuit's slag heaps quietly turning up on the Narrows. `resolveBattle` takes `missionId` and the app passes it — guarded by a source-level test, because the failure mode is the screen DRAWING terrain and RESOLVING without it, which would look exactly right and play exactly wrong.

### Where it took three attempts to place

- **Cover in each army's own half is a purely defensive rule however symmetrically it is placed.** A defender sits in their cover, an attacker walks out of theirs: SAFEGUARD went to 70% against ERADICATION's 15%.
- **Blocking on the centre line put a stack squarely between the Reactor and each flank marker**, so whatever held a flank could not be shot from the middle at all. SAFEGUARD's home line hit 94% and the dispositions came out 67 points apart. Off the line they break the long diagonals instead.
- **Broken ground across the centre only charges the army that moves.** On the flank lanes it is the price of the wide road, and the wide road is the one that ends in cover.
- **PRESSURE had to be re-authored.** "Give up one flank and overload the other" is a losing arithmetic under a disposition that pays for markers — it won 4% before terrain and 0% after. It is the alternative sum now: three cheap markers against their one expensive one, and the only dominion line that does not want the Spine at all. Both flanks go round the outside gates, because cutting the corner walks through the slag.

### Two metrics, again

- **The stratagem probe was picking its lists off a different battle.** It ranked by percentile on axis A — which scores a list across all 120 of its orderings — and then played one ordering under one plan. So it kept selecting lists whose battles here were already won (92% without spending anything) every time anything shifted the ranking, and the verdicts read as though the stratagem layer had stopped working. It plays the exact battle it is about to measure now and takes the three closest results, plus three across the ranking so "no single play wins every battle" is a claim about the layer rather than about three knife-edge fixtures.
- **"How long an army lasts" was measured in engagements survived**, which only says anything when runs end early — and that is in direct tension with the run being worth playing. Soften the failure condition enough that one bad afternoon does not finish an army and the spread collapses to nothing whatever the player is doing. It is measured in **casualties per engagement** now: DOMINION 0.44, SAFEGUARD 0.33, ERADICATION 0.64, which is the claim the verdict was always making.

### The failure condition

`MINIMUM_FORCE` is 4 and a warband starts at 6. Five deployment slots and one spare: a run ends when the army can no longer field four, which costs 8.2% of armies. At 5 it was 26% and one bad first engagement finished a run before the market had opened once, which is not a difficulty setting, it is a coin flip.

## Third playtest round (18 Aug 2026)

- **"If it doesn't say anything it will be really hard to remember what the combo is when it happens and where it happened."** Two problems wearing one coat. FIELD NOTES now lists **every** pairing from the first muster by name and by the two keywords it wants, so there is something to hunt for and the refit market has a target; what it DOES stays hidden until it fires. Six blank lines and a count is not a secret, it is a wall. And a found pairing records the **mechanics and the board**, not only a flavour line — "the screen anchors on the heavy hull" says a pairing happened and nothing about what it was worth.
- **The mechanics sentence is DERIVED from the effect**, never typed beside it. Written by hand it would be a second copy of every number in `synergies.js`, and ERADICATION's scoring line already showed how that ends: it read "1 VP per 4 wounds" for as long as the rule paid 1 in 3. `SHIELD_SOAK` moved to `battleProfiles.js` for the same reason — LOCKED SHIELDS has to be able to say what it raises the soak *from*.
- **"Doesn't the walker have scoring ground in the west? The debrief says it didn't hold any."** It held it all battle. The debrief measured objective-rounds against **only the markers the declared disposition scores** — and under SAFEGUARD exactly one marker on the board is live, while every safeguard plan sends two or three of its five slots to the flanks:

```
safeguard/home-line      west-stack(PAYS NOTHING) | south-yard | south-yard | east-stack(PAYS NOTHING) | east-stack(PAYS NOTHING)
```

  So most of a safeguard army came back reading *"Held no scoring ground at any point"* — the debrief telling the player that half of what they fielded did nothing, in the run where it was doing the most. **Every marker you stand on is one they are not scoring**, and denying a point is worth what taking one is; HOME-LINE is that disposition's best line *because* of this work. Denial is counted and reported now. Yet another metric measuring the wrong thing — it credited scoring and was blind to denial.
- **The deploy screen says so before you commit.** A slot walking to ground the declared disposition does not pay for is flagged on the slot itself, as a warning rather than an error, because the plans send formations there on purpose.

Still open, and Jonathan's words: *"the ending is a little lacklustre"*. The last engagement resolves and the run summary states what happened; there is no ending worth the five battles that led to it.

## Two of the same hull (18 Aug 2026)

*"I was thinking you could have multiples of the same unit... I was hoping the further you go in the game the larger the army gets."*

Priced against the alternatives before building anything:

```
today                     126 lists × 120 orderings =    15,120 battles
duplicates, 5 slots     1,287 lists × ≤120         =   154,440   (10×)
12 new hull types, 6 slots  924 × 720              =   665,280   (44×)
duplicates, 6 slots     3,003 × 720                = 2,162,160  (143×)
```

Duplicates at five slots is ten times the list-building space for **no new authored content** — no hulls, no routes — and it is the only one of the three that leaves the sweep able to resolve the space rather than sample it. The thin bench was never about the number of slots; it was that there are nine hulls and a warband owned six of them, so the shelf ran dry. A warband now ends a run at **9.52 formations from a starting 6**.

### Instance identity

A unit's `id` **was its formation id**, which made two of the same hull the same unit: they shared an order, walked one route, and every wound landed on whichever the lookup found first. Roster entries carry their own ids now, and everything that keys on identity follows — orders, routes, damage, survivors, retiring, refits.

The bug that took longest to see: `deployUnit` spread the profile **after** writing the id, and `profileWithRefit` carries an `id` of its own — the formation it is a profile *of*. So the instance id was silently overwritten by the formation id, which is precisely the collision the whole change existed to remove. The profile is spread first now.

### At most two

`MAX_COPIES = 2`. Unrestricted, duplicates opened straight onto a degenerate answer: **three RECON TANKS and two RECOVERY VEHICLES won 100% of its deployments**, and ninety-five lists won from every single one of theirs. Three OBJECTIVE hulls each holding at 1.5× control under DUG IN, kept standing by two REPAIR hulls, is not a list. Capped at two it is 882 lists and none of the all-different ones do it. It is also the ordinary rule in the wargames this is built out of, and it reads as one: you can bring a second of something, not an army of it.

DUG IN came down from 1.5× to 1.25× at the same time — it was already the most-formed pairing on the board by a distance, and OBJECTIVE-plus-SUPPORT is exactly the pair a warband holding two haulers assembles without trying.

### The verdict that had to change, and why it is not a dodge

"No list wins from every deployment" failed at 36 of 882 — and **every one of the 36 held a repeat, while none of the 126 all-different lists did**. A list with duplicates has fewer genuinely different deployments (five identical hulls have exactly one), so winning all of them is easier *by construction* rather than by being overpowered. The verdict assumed every list had 120 distinct deployments to be tested against, and duplicates made that false.

It is judged on lists of five different hulls now, and the trade is reported beside it as the design property it is: **stacking a hull buys consistency and spends deployment decision.** Arrangements are deduplicated too — two identical hulls swapped between two slots is one deployment written twice.

### Not done, and why

Six deployment slots is what would make the *board* fuller, and it is the thing that breaks the sweep: 143× the space, and the exhaustive claim dies with it. If it happens it should be a modest escalation — five slots early, six for the last engagements — with the battle axes pinned at five as the measuring instrument and the run axis covering the growth, the same discipline as the control enemy.

## The army that could not be hurt (19 Aug 2026)

*"In the previous games I had to pick repair or full recovery for units... this run I have [not]"* — and, separately, *"won again 4 out of 5 times... I'm good but not that good."*

Both remarks were the same bug. `applyBattle` matches the roster on **instance** ids — it has to, or one of two railjacks dying strikes off both — and the screen was handing it **formation** ids:

```js
const deployedIds = Object.values(planned).map((entry) => entry?.formationId)  // matched nothing
```

Nothing matched, so nothing was ever damaged, nothing was ever lost, `DID NOT COME BACK` was always empty, the repairs in the market were never on offer because nothing needed them, and a run could not be lost. An entire economy — attrition, repair, the market's whole reason to exist — sat there looking implemented and doing nothing. **The sweep never saw it**: it drives `campaign.js` directly and passed instance ids all along, which is exactly why every measured number stayed sane while the game the player was actually playing had become unloseable.

Two more instance/formation mismatches came out of the same corner:

- `planned` read each slot's wounds with `roster.find((item) => item.formationId === entry.formationId)`, so two of the same hull both deployed carrying the first one's damage.
- Declaring a disposition reset each slot to `{ formationId }` — dropping the id, the name, the damage and the refit — which emptied every slot on screen and deployed hulls the run does not own. It keeps the instance and drops only the per-slot objective override now.

**The lesson is not "check your ids".** It is that this project has no test that plays the game the way a player does; every guard either drives the model directly or reads the rendered markup once. Both were green. The guards added are source-level assertions on the wiring between screen and campaign, which is the seam that was unguarded — and a browser pass over an actual engagement, which is what found it.

### What the difficulty actually is

Measured against the enemy the game ships, over the same 1080 policy-and-seed runs the run axis uses:

```
battles won 0..5:  0:63  1:164  2:255  3:340  4:217  5:41
four or more: 23.9%      all five: 3.8%
```

So four of five is a good run — top quarter — and clearing the ladder is rare. The run axis prints a different distribution (5:121) because it fights the **control** enemy on purpose; that is the right instrument for attributing anything to the player's choices and the wrong one for answering "is it too easy". Both are printed now, from the rows that already existed.

The standing imbalance is unchanged and is now printed as a NOTE beside the verdicts: **the enemy's declaration swings the engagement 42.6%** — 75.4% player wins against ERADICATION against 32.8% against DOMINION — which is wider than any choice the player makes. Nothing the player picks moves a run as much as which opponent it drew.

## What a marker says (19 Aug 2026)

*"Should be able to see the enemy units if I hover over them... at least what they can do, as in stats, not their combo."*

Every marker on the board carries its profile now, on hover **and on focus** — a card only a mouse can open is information only some players have. The card shows the stat line, what is left of the hull and the profile note. It shows nothing about the hand or the pairings: the profile is public in any wargame, the army list is on the table, and the only uncertainty this game has is what the enemy is holding. The enemy brief in the rail carries the same line per formation, because the deployment is decided there and comparing five profiles by pointing at five markers one at a time is not comparing them.

The stat line is written **once**, in `statLineFor`. There were four copies of the template by the time this landed and they had already drifted — the card read `1 SHOT` while the deploy list beside it read `1 SHOTS` for the same hull.

## Repairs are bought on the row (19 Aug 2026)

`buy({ run, offerId, targetId })`. Field repair and full rebuild used to go to whichever formation was worst off, which is a sensible default and not a decision. With a dozen hulls in the warband and two of some of them, *which* one you patch before the next engagement is the question the money is asking — the wreck you are about to deploy is often not the wreck with the fewest wounds left.

They are bought from the warband list, on the row of the hull, where the wounds are already written down; only REQUISITION is left on the shelf. Naming a formation that is not damaged, or is not in the warband, **refuses the purchase** rather than quietly doing the work somewhere else and charging for it. Naming nobody still repairs the worst-off hull, which is what the sweep buys — so the measured value of a repair stays the value of the cheapest sensible policy rather than the value of playing it well.

## The enemy reads you back (19 Aug 2026)

*"I want the skill of the player to decipher the enemy units and strat and then counter
attack it — but once they figure that out it can't be 'I win', and I'm not sure how we go
about that to make it a challenge for them each time."*

### It was already solved, and that was measurable

Before designing anything: every enemy the game can field on the Circuit — both
declarations, three plans each, two seeds — against 1,890 player answers (list ×
arrangement × plan). 22,680 battles.

```
distinct best answers across the 12 enemies:   9
answers that beat EVERY enemy:                32 of 1890
  skimmer+carriage+command+harpoon+hauler | TRAPLINE   +70 VP across all twelve
headroom (best answer vs median):              5–10 VP
```

Deciphering paid — the right answer was worth 5–10 VP over an average one — and it did not
matter, because a player who stumbled onto one of thirty-two lists never had to decipher
anything again. **Numbers cannot fix that.** While the player picks their five with full
knowledge, no commitment and no cost, the best generalist list wins by construction.

With no dice, an opponent that responds to you is the only renewable source of a new problem
each time. Everything else is memorised eventually.

### The duel table, and why it made the enemy worse

First attempt: score each hull against the player's list by fighting it one-against-one on
bare ground, and weight that into the slot fit. Two failures, in order.

1. **Weighted into the fit**, it fielded hulls that answered the player's list and could not
   walk the route they were given. Lists that beat every enemy went from 32 to 58.
2. **Choosing inside the shortlist** instead — every candidate can still do the job — was
   worse again: 282.

The measure was wrong, not the wiring. A duel says a breaker eats everything; **this is not
a game of duels.** Asked directly — for a fixed player list, try all 126 enemy lists and
sort — the enemy's own best lists are full of cheap fast objective hulls that would lose
every duel on the board. Five hulls, five routes and five markers is a different game from
one hull against one hull.

Worth recording separately: scoring by how much better a hull does against THIS list than
against the roster at large — the interaction term, the textbook way to strip out "that hull
is just good" — **fields haulers.** A hull that loses to everything loses by no more to a
strong list than to a weak one, so its relative score against a strong list is the best in
the roster. Relative improvement on something that cannot win is not an answer.

### The rehearsal

The enemy does not consult a table of counters. It **replays the last engagement**: the same
five formations the player fielded, in the same slots, walking the same plan, and tries its
own alternatives against them one slot at a time, keeping whatever actually scored better on
this ground. One ply deep, `COUNTER_SHORTLIST = 4` candidates a slot, `COUNTER_PASSES = 3`
sweeps until nothing moves — about thirty trial battles per enemy, cached, and a battle costs
half a millisecond.

The thing being optimised is the thing being played. That is the whole difference between
this and the duel table.

Fairness is structural: what it reads is what the player themselves put on the board last
time, and the brief says which hulls were changed because of it — *"THEY HAVE STUDIED YOUR
LAST ENGAGEMENT. Against the five you fielded they have brought FLAME SUPPORT VEHICLE,
ASSAULT WALKER instead of ARMOURED RECOVERY VEHICLE, SHIELD WALKER."* An opponent that
adapts silently is not a mind game, it is difficulty arriving from nowhere. The only thing
still hidden is the hand.

**The control enemy never reads.** It is the instrument every claim about the player's
choices is measured on, and an opponent that changes in response to the player is the one
thing a control cannot do.

### What it did

```
answers that beat every enemy that has NOT read them:   30 of 378
answers that beat every enemy that HAS read them:        0 of 378
win rate   unread 67.6%   read 38.3%

bring the same list again, against the enemy that read it:  45.5%
the same list against an enemy that has not read it:        75.6%
bring a DIFFERENT list against the enemy that read you:     52.9%
a winning answer existed against the read enemy in 156 of 156 engagements
```

Repeating yourself costs about thirty points of win rate; changing wins most of it back; and
there is always something that beats what they brought. That is the loop the game is made
of. Against the shipping enemy a run now takes four or more 16.7% of the time and all five
2.0% (was 23.9% and 3.8%) — the sweep's policies field the healthiest five every engagement,
which is to say they repeat themselves, which is exactly what this punishes.

### Axis I, and the standing verdicts

`SOLVABILITY` plays every answer twice against every enemy: once against one that has never
seen it, once against the enemy built by replaying it.

- **no list keeps winning once it has been read** — 0, and this is the verdict the whole
  layer exists to hold
- **bringing the same list again is punished** — 67.6% against 38.3%
- **every enemy has an answer** — 6 of 6
- **reading the enemy pays** — best answer beats the median by 3+ VP against all six

It is the only axis that does not resolve its space in full: one seed per enemy, one
arrangement per list. Every "read" enemy is itself built out of trial battles, so the axis
costs more than the rest of the sweep put together at full width. The reduction is printed
where the numbers are.

### Still open

The enemy's declaration still swings an engagement 43.4% — 69.3% player wins against
ERADICATION, 25.8% against DOMINION — which is wider than any choice the player makes. Skill
at reading the enemy can only show up in the part of the result the *draw* did not already
decide, so this gap is now the ceiling on everything above.

## A plan is lanes (19 Aug 2026)

*"I think multiple units on the battlefield is the way to go — start with 5 and increase
every 3 to 5 missions until you hit 12... We could plan the list like Warhammer 40k and have
a certain amount of points per battle. That means the strategies would have to be somewhat
dynamic to fit the list. What do you think?"*

Phase one of that: **the strategies, at the current five.** Nothing else moved, and the
sweep still resolves its space in full — 45 verdicts, and the SOLVABILITY numbers came out
byte-identical afterwards (30 / 0 / 67.6% / 38.3%), which is the whole point of doing this
first.

### Why it is the precondition and not a detail

Measured before designing anything. Grow the armies and cycle the extra hulls onto the five
authored routes — the obvious way — and:

```
hulls      5    6    7    8    9   10   12
headroom   9    7    4    5    5    2    1     ← best list vs median list, in VP
```

At twelve a side the best possible list beat the median by one victory point. Everything
clumps on five routes, nothing is distinguishable, and what you brought stops mattering.
Give the same twelve hulls orders that actually spread them and headroom is 9 to 17 instead.
**The problem was never the number of formations. It was writing a plan as a list of slots.**

### The shape

A plan is a handful of LANES, each a route to named ground with a `share` of whatever army
walks it. The fill is proportional, largest remainder first, never fewer than one formation
in a lane the plan still has; an army smaller than the plan has lanes keeps the heaviest of
them, so one formation walking SPEAR walks the Spine.

Every plan converts with no change to any battle at the size it was written for — the nine
route sets are frozen in `tests/battle-lanes.test.mjs` and compared against the fill, and
that guard is not derived from the source. SPEAR stops being "five routes, three of which
are the same" and becomes what it always meant: **three fifths of whatever you have, on the
Spine.**

`routePointsFor(plan, index, missionId, mirrored, size)` — `index` is which of the ARMY, west
to east, not which deployment slot. They are the same number while an army is always five.

### The bug it fixed on the way

A part-strength enemy — early engagements field three or four — used to take **slots two,
three and four of a plan written for five**: a slice out of the middle of a doctrine rather
than the doctrine at three-fifths strength. Under TRAPLINE that is an army that never goes
near either flank. Both sides now share their plan out among whoever turned up.

### What phase two has to answer

Lanes are necessary and not sufficient. Re-measured with the real lane plans at larger sizes,
headroom still decays past about eight hulls — because with **five markers** on the board, a
massing plan (SPEAR at twelve puts seven on the Spine) beats a spreading one whatever the
lists are, and the list choice drowns. The board has to grow with the army:

```
hulls  markers  rounds   headroom
   5        5        5         11
  12        5        5          9
  12        9        8         17
```

More ground to argue over is where the extra hulls get jobs, and more rounds is what lets a
bigger army arrive at all. So the escalation is not one number but three that move together:
**army size, markers, rounds.**

Points, when they land, are the right way to express the first of those — one budget instead
of a slot count, escalation as a curve instead of a staircase, and "bring something
different" (which the reading enemy now demands every engagement) gains the whole
many-cheap-against-few-expensive axis. Measured on the current costs at a 30-point budget
against a fixed 30-point enemy: seven hulls 58.2%, eight 41.0%, nine 46.2% — a real trade
with no dominant size. Six premium hulls wins 4.5%, so the elite end of the cost table needs
re-deriving before it ships.

And the thing to say out loud: **above about six hulls the sweep stops being exhaustive.**
The five-hull board stays as the instrument that resolves its space in full, the same
discipline as the control enemy, and the big-army claims become sampled with stated sample
sizes.

## What a declaration pays (19 Aug 2026)

The standing imbalance, closed enough to stop being the biggest thing in the game. It was
**43.4%** — the player won 69.3% of engagements against an ERADICATION enemy and 25.8%
against a DOMINION one — against a spread of 17.8% across every choice the player makes.
Nothing you decide can show up inside a result the draw has already settled.

Where it came from, measured rather than guessed: on the same board, against the same
answers, an eradicating army scored **5.9** and a dominion army **11.4**. Declaring
ERADICATION halved your score. It was underpaid, for both armies — the player's own
eradication won 2.6% of its battles against a dominion enemy.

`damagePerPoint` 3 → **2**, `wreckBounty` 3 → **5**. Measured on a reduced copy of the run
axis rather than on a fixture, one candidate per process (the enemy's counter-built lists are
cached and the key says nothing about the scoring rules, so two settings in one process
measure the second against lists built for the first — the first grid run was quietly wrong
in exactly that way).

```
              enemy gap   your dispositions   runs reaching four wins
was (3, 3)       43.4%    35.0/52.8/36.8              16.7%
now (2, 5)       26.5%    34.9/53.0/44.7              11.7%
```

ERADICATION stops being a trap (36.8% → 44.7%) without becoming the answer, and the gap is
down by 39%. It is a **verdict** now rather than a note: the sweep fails if the two
declarations are more than 30 points apart.

**SAFEGUARD was left at double, and that is a measurement.** Cutting `homeMultiplier` to 1.5
made the enemy's declaration matter MORE (32.7% → 34.9%) and halved the runs that reach four
wins, because it takes the top off the player's scoring without touching the enemy's. The
declaration gap was never a SAFEGUARD problem.

### Twenty-nine mutants were not running

`scripts/mutants.sh` reported "killed 161, 0 survived" and quietly skipped **29** more whose
patterns no longer appear exactly once in the file — refactors moved the code out from under
them. A guard that has stopped being checked reports the same as a guard that passes, which
is the single most recurring failure in this project. The summary line counts skips now and
prints every one of them at the end, so the number cannot hide again. They still need
re-pointing at the code as it stands.
