# UX Audit — Mission Goal, Role Assignment, and Result

## Audit scope

Operation Dead Circuit's planning-to-result flow, grounded in the user-provided completion screenshot and the updated local prototype at 1440 × 1024.

## User goal

Understand how to win, freely decide which formation performs each tactical role, and know whether the resulting mission succeeded.

## Evidence

1. `audit-06-role-slots-obscured.png` — previous planning state, where the central Trapline panel was passive and the only assignment controls resembled status rows in the right rail.
2. `audit-07-visible-formation-board.png` — corrected empty state with five large assignment slots in the central formation board.
3. `audit-08-board-placement-feedback.png` — first placement showing post-placement output without revealing a preferred answer beforehand.
4. `audit-09-complete-formation-board.png` — complete player-staffed formation sequence with output and neighbor links.
5. `design-qa-role-board-comparison.png` — equal-viewport before-and-after comparison.
6. `audit-03-explicit-victory.png` — completed mission result.
7. `audit-11-board-before-route-model.png` — prior board that incorrectly framed staffing as building the play.
8. `audit-12-authored-route-empty.png` — corrected fixed route with five connected action stops.
9. `audit-13-route-placement-and-status.png` — two staffed stops showing revealed output, a linked route leg, and exact roster assignments.
10. `audit-14-unit-information-picker.png` — neutral unit capability and task-purpose information with explicit assigned and available states.
11. `design-qa-authored-route-comparison.png` — equal 1440 × 1024 before-and-after route-model comparison.
12. `audit-15-before-field-plan.png` — planning state before battlefield geometry was exposed.
13. `audit-22-final-authored-field-plan.png` — Trapline drawn as a numbered directional route across the battlefield.
14. `audit-25-final-route-change-preview.png` — covered-diversion and recovery-loop legs visible after alternate breakpoint selections.
15. `audit-26-final-divided-pressure-plan.png` — playbook switch redrawing the opening as a split formation.
16. `audit-20-breakpoint-route-comparison.png` — live event comparing the authored path with the paid override path.
17. `design-qa-field-plan-comparison.png` — equal 1280 × 720 before-and-after field-plan comparison.

## Findings and resolution

### 1. Mission planning — healthy after revision

- Previous risk: objective markers existed, but the actual win formula was distributed across the interface.
- Resolution: `VICTORY ORDERS` now states that the player must sabotage the Reactor Spine and extract at least three formations. Rescue remains explicitly optional.
- Accessibility: the goal is represented as live text in reading order, not only by color or map position.

### 2. Formation assignment — healthy after revision

- Previous risk: after prefilling was removed, the only assignment controls lived in the narrow intelligence rail and looked like passive status rows. The central Trapline panel displayed role names but was not interactive, so the player reasonably concluded that no slots existed.
- Resolution: all five roles begin as large, dashed action stops inside the central authored-route board. Each stop has an explicit plus symbol, drag target, and click fallback. Clicking a stop opens the same unranked five-formation chooser, and choosing an occupied formation swaps it into the selected stop.
- Player agency: no recommendation or suitability hint appears before selection. Output percentage and linked-neighbor count appear only after placement, then recalculate when an adjacent assignment changes.
- Accessibility: each slot and formation is a semantic button with a complete accessible label. Keyboard traversal and focus indicators still require hands-on assistive-technology testing.

### 2a. Authored play versus player placement — healthy after revision

- Previous risk: `BUILD THE PLAY` implied that the player was creating the maneuver, even though the intended decision was which formation should execute each already-authored action.
- Resolution: the board now presents a continuous route from `ENTRY` to `OBJECTIVE`, interrupted by five fixed, numbered action stops. The player drags a formation into a stop or uses the click picker; they do not draw, edit, or redirect the route.
- Availability: assigned formations identify their exact stop in both roster and chooser. Unused formations remain explicitly `AVAILABLE`, so the remaining decision space is visible without offering recommendations.
- Decision support: the chooser exposes each formation's broad capability and task purpose. Fit percentages and adjacency links remain hidden until placement, preserving experimentation.

### 2b. Battlefield plan comprehension — healthy after revision

- Previous risk: the staffing board established sequence but did not reveal where the maneuver traveled across the actual battlefield. Players could not compare Trapline, Armored Spear, or Divided Pressure spatially.
- Resolution: every playbook now draws a directional field plan from `DEPLOY` through five numbered action positions. Switching playbooks redraws the entire formation geometry; Divided Pressure visibly forks before converging.
- Breakpoint consequence: selecting an alternate order redraws only its affected leg and labels the new diversion. At contact, the decision screen compares the authored path and override path before a Command Seal can be spent.
- Accessibility: position names, route summaries, and live route comparisons are present as text in addition to color and geometry. Exact spatial relationships still require visual perception; a full screen-reader route narration remains a future test area.

### 3. Mission result — healthy after revision

- Previous risk: `MISSION COMPLETE` and “Dead Circuit is dark” described events but did not answer “Did I win?”
- Resolution: the result now says `OPERATION SUCCESS`, `VICTORY`, and `You won Operation Dead Circuit.` It explains that 4 formations escaped against a requirement of 3.
- Accessibility: success is communicated through words and numbers in addition to green color and check icons.

## Evidence limits

The visual and interaction checks cover the implemented desktop prototype. They do not establish full screen-reader behavior, zoom reflow, or campaign balance.
