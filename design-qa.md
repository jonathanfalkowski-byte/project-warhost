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
- Role-board comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-role-board-comparison.png`
- Full comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-full-comparison.png`
- Battlefield comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-battlefield-comparison.png`
- Viewport: 1440 × 1024 CSS pixels at device scale 1
- Targeted assignment-board viewport: 1694 × 1465 CSS pixels at device scale 1
- Targeted comparison dimensions: two equal 1694 × 1465 captures combined into one 3388 × 1465 image with no scaling or density conversion
- Source normalization: original 1536 × 1024 mock center-cropped by 48 pixels on each horizontal edge
- Captured state: initial planning board with five empty role slots, followed by a player-authored Trapline whose output percentages and combo links are visible only after placement
- Full-view comparison evidence: `design-qa-role-board-comparison.png` shows the obscured right-rail controls beside the corrected central formation board at the same viewport and state.
- Focused-region evidence: a separate crop was unnecessary because all five slot labels, plus actions, assignment count, and nearby objectives remain legible in the full-resolution comparison; `audit-10-visible-board-1440.png` separately confirms the board clears mission markers at the compact desktop viewport.

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
| Assignment agency | Pass | Each role begins as a large dashed slot with a plus symbol and `ASSIGN UNIT`. Every slot opens the same unranked chooser; output appears only after a choice and changes with neighboring combo links. |

## Interaction review

- Formation selection works from both the roster and battlefield.
- Playbook selection swaps the complete maneuver, role grammar, and battlefield disposition.
- Direct role assignment opens an explicit, unranked formation picker and swaps the chosen formation with the role's prior occupant.
- The central formation board is now the assignment surface; the right rail only reports mission intelligence and points the player toward the board.
- Every assignment remains legal. Post-placement output and combo-link counts recalculate immediately without exposing the hidden scoring formula.
- Breakpoint responses are authored before the mission and remain visible in the command footer.
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

## Residual variance

- P3: The source mock uses freely cut-out miniature silhouettes. Generated source images do not contain reliable transparency, so the implementation uses round tactical plaques. This keeps the interaction legible and supports the explicit goal of avoiding a card-game presentation.
- P3: Output percentages are deterministic prototype feedback, not final combat balance. The hidden values need playtesting against real mission consequences before they should affect campaign progression.
- P3: The central board intentionally covers a small area of non-interactive battlefield texture during planning. It compacts back to the smaller execution panel once battle begins.

final result: passed
