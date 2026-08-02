# Design QA — Operation Dead Circuit

## Test contract

- Source mock: `C:\Users\Admin\.codex\generated_images\019fc35b-373e-7772-a4af-a34982441a1e\exec-af96fe19-fadb-4634-9f68-b72bdb07a876.png`
- Implementation capture: `C:\Users\Admin\Documents\Project-Warhost\implementation-playbook-1440.png`
- Current playbook comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-playbook-comparison.png`
- Current clarity comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-clarity-comparison.png`
- Goal and role capture: `C:\Users\Admin\Documents\Project-Warhost\audit-01-goal-and-roles.png`
- Formation picker capture: `C:\Users\Admin\Documents\Project-Warhost\audit-02-formation-picker.png`
- Explicit victory capture: `C:\Users\Admin\Documents\Project-Warhost\audit-03-explicit-victory.png`
- Empty playbook capture: `C:\Users\Admin\Documents\Project-Warhost\audit-04-empty-playbook.png`
- Discovered combo capture: `C:\Users\Admin\Documents\Project-Warhost\audit-05-discovered-combo-output.png`
- Discovery comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-discovery-comparison.png`
- Obscured-slot capture: `C:\Users\Admin\Documents\Project-Warhost\audit-06-role-slots-obscured.png`
- Visible formation-board capture: `C:\Users\Admin\Documents\Project-Warhost\audit-07-visible-formation-board.png`
- Placement-feedback capture: `C:\Users\Admin\Documents\Project-Warhost\audit-08-board-placement-feedback.png`
- Complete formation-board capture: `C:\Users\Admin\Documents\Project-Warhost\audit-09-complete-formation-board.png`
- Compact formation-board capture: `C:\Users\Admin\Documents\Project-Warhost\audit-10-visible-board-1440.png`
- Pre-route formation-board capture: `C:\Users\Admin\Documents\Project-Warhost\audit-11-board-before-route-model.png`
- Authored-route empty-state capture: `C:\Users\Admin\Documents\Project-Warhost\audit-12-authored-route-empty.png`
- Route placement and availability capture: `C:\Users\Admin\Documents\Project-Warhost\audit-13-route-placement-and-status.png`
- Unit-information picker capture: `C:\Users\Admin\Documents\Project-Warhost\audit-14-unit-information-picker.png`
- Authored-route comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-authored-route-comparison.png`
- Pre-field-plan capture: `C:\Users\Admin\Documents\Project-Warhost\audit-15-before-field-plan.png`
- Final authored field-plan capture: `C:\Users\Admin\Documents\Project-Warhost\audit-22-final-authored-field-plan.png`
- Final breakpoint route-change capture: `C:\Users\Admin\Documents\Project-Warhost\audit-25-final-route-change-preview.png`
- Final alternate-playbook capture: `C:\Users\Admin\Documents\Project-Warhost\audit-26-final-divided-pressure-plan.png`
- Live breakpoint comparison capture: `C:\Users\Admin\Documents\Project-Warhost\audit-20-breakpoint-route-comparison.png`
- Field-plan comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-field-plan-comparison.png`
- Role-board comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-role-board-comparison.png`
- Full comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-full-comparison.png`
- Battlefield comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-battlefield-comparison.png`
- Viewport: 1440 × 1024 CSS pixels at device scale 1
- Targeted assignment-board viewport: 1694 × 1465 CSS pixels at device scale 1
- Targeted comparison dimensions: two equal 1694 × 1465 captures combined into one 3388 × 1465 image with no scaling or density conversion
- Field-plan viewport: 1280 × 720 CSS pixels at device scale 1
- Field-plan comparison dimensions: two equal 1280 × 720 captures combined into one 2560 × 720 image with no scaling or density conversion
- Source normalization: original 1536 × 1024 mock center-cropped by 48 pixels on each horizontal edge
- Captured state: initial planning board with five empty action stops, followed by a player-staffed Trapline whose output percentages and combo links are visible only after placement
- Full-view comparison evidence: `design-qa-role-board-comparison.png` shows the obscured right-rail controls beside the corrected central formation board at the same viewport and state.
- Focused-region evidence: a separate crop was unnecessary because all five slot labels, plus actions, assignment count, and nearby objectives remain legible in the full-resolution comparison; `audit-10-visible-board-1440.png` separately confirms the board clears mission markers at the compact desktop viewport.
- Field-plan state: empty Trapline planning state with default breakpoint orders, plus alternate breakpoint, Divided Pressure, and live decision states.
- Field-plan full-view evidence: `design-qa-field-plan-comparison.png` shows the same 1280 × 720 planning state before and after the numbered battlefield geometry was added.
- Field-plan focused evidence: separate crops were unnecessary because the five position labels and route changes remain readable in the full captures; `audit-25-final-route-change-preview.png`, `audit-26-final-divided-pressure-plan.png`, and `audit-20-breakpoint-route-comparison.png` provide the focused interaction states.

## Visual review

| Surface | Result | Evidence |
| --- | --- | --- |
| Information architecture | Pass | Header, formation roster, objective battlefield, command rail, and mission footer retain the selected mock's hierarchy. |
| Composition and spacing | Pass | Three-column command layout and dense objective staging match the reference at the test viewport without clipping or overlap. |
| Typography | Pass | Local Barlow and Barlow Condensed faces reproduce the narrow military-command character while remaining readable at 1440 pixels. |
| Palette and contrast | Pass | Gunmetal, cobalt, furnace orange, and extraction green are consistently applied with readable controls and state indicators. |
| Imagery | Pass | Every battlefield, formation, and hostile-force visual is an original generated raster asset; no placeholders or CSS-drawn substitutes remain. |
| Product character | Pass | Round tactical formation plaques replace collectible-card silhouettes and keep the battlefield readable and selectable. |
| Playbook planning | Pass | Three maneuvers, five unmistakable central assignment slots, and two authored breakpoint responses are visible without adding freehand paths, card hands, or RTS controls. |
| Goal clarity | Pass | The planning map now states the exact victory formula before commitment; the debrief states `VICTORY` and repeats the achieved threshold. |
| Assignment agency | Pass | Each action stop begins as a large dashed drop target with a plus symbol and explicit click fallback. Every stop opens the same unranked chooser; output appears only after a choice and changes with neighboring combo links. |
| Authored-route clarity | Pass | The board now shows one fixed route from `ENTRY` to `OBJECTIVE`, with visible continuation lines through five numbered action stops. Copy consistently says the player places formations instead of building the play. |
| Placement state | Pass | The roster and chooser identify each used formation by exact stop number and role, while unused formations remain explicitly `AVAILABLE`; no recommended slot or candidate ranking is exposed. |
| Battlefield plan geometry | Pass | Each playbook now draws a distinct directional formation diagram across the map, with `DEPLOY` and five numbered action positions that correspond to the staffing board below. |
| Breakpoint consequence | Pass | Selecting an alternate breakpoint redraws only its affected leg, labels the diversion on the field, and updates the field-plan summary. The live event compares both path sequences before the player confirms or spends a seal. |

## Interaction review

- Formation selection works from both the roster and battlefield.
- Playbook selection swaps the complete maneuver, role grammar, and battlefield disposition.
- Direct role assignment opens an explicit, unranked formation picker and swaps the chosen formation with the role's prior occupant.
- Formations are draggable from the roster or battlefield to any fixed action stop; the same placement and swap rules are retained through the click-and-choose fallback.
- The central authored-route board is now the assignment surface; the right rail only reports mission intelligence and points the player toward it.
- Every assignment remains legal. Post-placement output and combo-link counts recalculate immediately without exposing the hidden scoring formula.
- Breakpoint responses are authored before the mission and remain visible in the command footer.
- Switching Trapline, Armored Spear, and Divided Pressure redraws their complete field geometry; Divided Pressure visibly forks the opening before convergence.
- Selecting `PROTECT BREACHER` creates a labeled covered diversion and selecting `RECOVER CREW` creates a labeled recovery loop without altering unit assignments.
- Ghost Drill runs a deterministic five-step simulation and reaches `DRILL VERIFIED`.
- Mission commit is gated only by assigning all five formations exactly once.
- Autonomous execution reaches both timed contingency decisions.
- Executing an authored response spends no seal; breaking the playbook spends one of exactly two Command Seals.
- Reactor sabotage and extraction complete with a mission debrief.
- Mission reset returns to a clean planning state.
- Browser console errors and warnings: none.
- Keyboard focus indicators and reduced-motion behavior are present.

## Comparison history

1. Initial pass exposed three P2 issues: terrain was too dark, the combo panel overlapped formation art, and hostile presence was too abstract.
2. The battlefield exposure was lifted, the combo panel moved to a protected upper-left zone, and an original Helioch Sentinel asset was added.
3. An intermediate blend treatment created square black unit fields. It was replaced with circular tactical plaques that preserve the source's physical-unit emphasis while clearly signaling interactivity.
4. The original free-placement layer risked teaching RTS behavior. It was replaced with three playbooks, formation-to-role assignment, and pre-authored breakpoints while preserving the approved composition.
5. User testing exposed an unclear result and undiscoverable role assignment. Victory orders, explicit formation pickers, unrestricted assignments, and an unmistakable victory debrief replaced those ambiguous states.
6. Further testing showed that prefilling roles and labeling fit removed the placement puzzle. Playbooks now begin empty, the chooser is unranked, and performance feedback is revealed only after the player experiments.
7. A player screenshot then exposed a P1 discoverability failure: empty-role controls were visually buried in the intelligence rail while the central Trapline panel was passive. The panel became a five-slot `BUILD THE PLAY` formation board, with equal-viewport evidence in `design-qa-role-board-comparison.png`; the revised state makes all five actions visible without changing the hidden-solution rule.
8. Player feedback clarified that the play itself is authored and only its performers are chosen. The central board became a connected `AUTHORED TACTICAL ROUTE` with fixed action stops, drag-and-drop placement, exact assigned-stop labels, neutral unit-purpose information, and a click fallback. Equal-viewport evidence is in `design-qa-authored-route-comparison.png`.
9. The staffing board still did not expose where the authored maneuver traveled on the battlefield. The planning map now draws the selected playbook as a football-style formation diagram, redraws breakpoint legs when orders change, and compares authored versus override paths during contact. Equal-viewport evidence is in `design-qa-field-plan-comparison.png`; alternate states are captured in audits 20, 25, and 26.

## Residual variance

- P3: The source mock uses freely cut-out miniature silhouettes. Generated source images do not contain reliable transparency, so the implementation uses round tactical plaques. This keeps the interaction legible and supports the explicit goal of avoiding a card-game presentation.
- P3: Output percentages are deterministic prototype feedback, not final combat balance. The hidden values need playtesting against real mission consequences before they should affect campaign progression.
- P3: The central board intentionally covers a small area of non-interactive battlefield texture during planning. It compacts back to the smaller execution panel once battle begins.
- P3: Route lines intentionally cross hostile formation art and objective space because they represent the planned engagement. Numbered positions and route-change labels retain the higher visual emphasis needed for planning.

final result: passed
