# UX Audit — Mission Goal, Role Assignment, and Result

## Audit scope

Operation Dead Circuit's planning-to-result flow, grounded in the user-provided completion screenshot and the updated local prototype at 1440 × 1024.

## User goal

Understand how to win, freely decide which formation performs each tactical role, and know whether the resulting mission succeeded.

## Evidence

1. `docs/audit/audit-06-role-slots-obscured.png` — previous planning state, where the central Trapline panel was passive and the only assignment controls resembled status rows in the right rail.
2. `docs/audit/audit-07-visible-formation-board.png` — corrected empty state with five large assignment slots in the central formation board.
3. `docs/audit/audit-08-board-placement-feedback.png` — first placement showing post-placement output without revealing a preferred answer beforehand.
4. `docs/audit/audit-09-complete-formation-board.png` — complete player-staffed formation sequence with output and neighbor links.
5. `docs/audit/design-qa-role-board-comparison.png` — equal-viewport before-and-after comparison.
6. `docs/audit/audit-03-explicit-victory.png` — completed mission result.
7. `docs/audit/audit-11-board-before-route-model.png` — prior board that incorrectly framed staffing as building the play.
8. `docs/audit/audit-12-authored-route-empty.png` — corrected fixed route with five connected action stops.
9. `docs/audit/audit-13-route-placement-and-status.png` — two staffed stops showing revealed output, a linked route leg, and exact roster assignments.
10. `docs/audit/audit-14-unit-information-picker.png` — neutral unit capability and task-purpose information with explicit assigned and available states.
11. `docs/audit/design-qa-authored-route-comparison.png` — equal 1440 × 1024 before-and-after route-model comparison.
12. `docs/audit/audit-15-before-field-plan.png` — planning state before battlefield geometry was exposed.
13. `docs/audit/audit-22-final-authored-field-plan.png` — Trapline drawn as a numbered directional route across the battlefield.
14. `docs/audit/audit-25-final-route-change-preview.png` — covered-diversion and recovery-loop legs visible after alternate breakpoint selections.
15. `docs/audit/audit-26-final-divided-pressure-plan.png` — playbook switch redrawing the opening as a split formation.
16. `docs/audit/audit-20-breakpoint-route-comparison.png` — live event comparing the authored path with the paid override path.
17. `docs/audit/design-qa-field-plan-comparison.png` — equal 1280 × 720 before-and-after field-plan comparison.

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

## 4. Accessibility audit — 14 August 2026

Previously untested. Audited with axe-core (WCAG 2.0 A/AA, 2.1 A/AA, plus
best-practice rules) driving a real browser at 1920x1080, 1440x900 and 1280x720,
both idle and with a route preview active, plus manual keyboard traversal and
reflow measurement.

### Resolved

**Route preview was invisible to screen readers.** The preview is drawn purely as map
geometry, so a screen-reader user got nothing — even though keyboard focus already
produced the same preview as hover. Resolved with a persistent polite live region
(`role="status"`) that announces, for example: *"Route preview only, not assigned.
ASSAULT WALKER would take the walker route, cutting through ruins, to action stop 3,
SABOTAGE ELEMENT."* The announcement names the formation, distinguishes walker terrain
from vehicle terrain, gives the player-facing stop number, and clears on blur. The
visual label is now `aria-hidden` so the same content is not read twice. The region is
present and empty in the initial DOM, because a live region inserted at the moment its
text appears is unreliably announced.

**Nine WCAG 1.4.3 AA contrast failures.** All small supporting text, measured between
3.76:1 and 4.36:1 against the 4.5:1 threshold — `.disposition-versus small`,
`.playbook-row small`, `.doctrine-row small`, `.strategy-test-panel header small`,
`.strategy-trial-list button small`, `.condition-options small`, `.prototype-note`,
and `.enemy-step-copy em`. Each foreground was lightened along its own hue to land
between 4.61:1 and 4.66:1, preserving the industrial palette. Result: **0 axe
violations at every desktop viewport, idle and with a preview active.**

### Confirmed already correct

- **Focus order** follows visual order: total-army play, then mission condition, then
  roster, then action stops. No positive `tabindex` anywhere.
- **Focus visibility**: a 2px solid cyan outline, backed by 7 `:focus` rules.
- **Keyboard parity with hover**: focusing an action stop produces the identical route
  preview that hovering does, so the feature is not mouse-only.
- **Every control has an accessible name**, including all five action stops and all
  roster formations, each naming its exact assigned stop.

### Still failing — scoped, not fixed

**WCAG 1.4.10 Reflow (AA).** The layout reflows cleanly down to 1024 px, then requires
horizontal scrolling: `.warhost-app` sets `min-width: 1100px`, and content bottoms out
at a 980 px scroll width. Measured: no horizontal scroll at 1280 px or 1024 px;
horizontal scroll at 768 px and 380 px. The criterion asks for 320 px.

This is recorded rather than fixed on purpose. Meeting it means redesigning a
deliberately dense, spatial tactical map — the battlefield, the intel rail, and the
staffing dock are read together, and stacking them into a single narrow column would
change the game's core planning surface, not just its styling. That is a design
decision, not a defect to patch, and it should be taken deliberately if the prototype
ever targets small screens.

### Regression guards

Nine automated tests now protect this result, with no new dependencies:
`tests/accessibility.test.mjs` re-computes real WCAG contrast ratios from
`src/styles.css` for all seven surfaces and asserts `.sr-only` never uses
`display:none` or `visibility:hidden`; `tests/app-render.test.mjs` asserts every button
has an accessible name, that no positive `tabindex` exists, and that the live region is
present and empty on first render; `tests/field-routes.test.mjs` covers the
announcement builder, including that an incomplete preview announces nothing.

Each guard was verified by deliberate mutation — reverting a contrast colour, setting
`display:none`, dropping `aria-live`, weakening the announcement, and adding
`tabindex="3"` were all caught.

## Evidence limits

The visual and interaction checks cover the implemented desktop prototype. Automated
auditing and keyboard traversal are now covered; what remains unverified is behaviour
with real assistive technology (NVDA, JAWS, VoiceOver), where live-region timing and
verbosity differ by screen reader and cannot be established by axe-core or SSR
assertions. Campaign balance also remains untested.
