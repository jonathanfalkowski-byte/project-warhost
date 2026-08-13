**Source visual truth**

- `C:\Users\Admin\AppData\Local\Temp\codex-clipboard-cc8a5c69-17de-4d2e-92a8-5ffeb8301376.png`
- The source establishes the existing industrial command-map language and identifies the Twin Seizure route-crossing problem.

**Implementation evidence**

- `C:\Users\Admin\Documents\Project-Warhost\implementation-twin-seizure.png`
- Local URL: `http://127.0.0.1:4173/`
- Browser viewport: 1280 x 720 CSS pixels at device scale 1.
- Source pixels: 1978 x 1413. Implementation pixels: 1280 x 720. The images are different browser crops, so the comparison was normalized around the battlefield route region rather than pixel-perfect outer chrome.
- State: Dead Circuit planning, Twin Seizure selected, no formations assigned.

**Full-view comparison evidence**

- The implementation preserves the source's isometric industrial battlefield, cobalt player routes, orange objective markers, right-side mission rail, and compact bottom staffing dock.
- Twin Seizure now reads as two coherent wings: the west group stays west, the east group stays east, and both converge only after their initial objective work before continuing through the reactor and extraction.
- Planning shows four contact forecast markers and zero exact enemy route segments. The player route layer contains 27 segments, confirming that the full authored paths remain visible.

**Focused region comparison evidence**

- The battlefield center was inspected at the same planning state. Action stops remain numbered and labeled, convergence points are visibly downstream of objective responsibilities, and extraction remains the shared destination.
- A more detailed crop was unnecessary because this change targets route topology and information disclosure rather than typography or asset fidelity.

**Required fidelity surfaces**

- Fonts and typography: existing Barlow and Barlow Condensed hierarchy is unchanged and remains legible at the inspected viewport.
- Spacing and layout rhythm: the compact dock still leaves the primary battlefield visible; the route preview banner overlaps some dense map labels at 1280 x 720, but this is pre-existing P3 density rather than a regression in the changed region.
- Colors and visual tokens: existing cobalt, furnace-orange, green extraction, and dark gunmetal tokens are preserved. Forecast contacts use the established enemy orange with a dashed, reduced-confidence treatment.
- Image quality and asset fidelity: existing formation and battlefield assets are reused without stretching or substitution.
- Copy and content: forecasts explicitly distinguish known, uncertain, and unknown contacts; exact enemy movement is not disclosed during planning.

**Findings**

- No actionable P0, P1, or P2 mismatches remain for the requested route and enemy-intel change.
- [P3] Route preview label density can still become busy at smaller desktop viewports. A later map-readability pass could suppress secondary labels until the relevant route is focused.

**Comparison history**

- Initial source issue: Twin Seizure routes crossed before completing their objective responsibilities and exact enemy routes were visible before commitment.
- Fix: separated west and east action lanes, moved their convergence after objective work, continued all viable branches through the reactor to extraction, and replaced planning enemy routes with contact forecasts.
- Post-fix evidence: local browser inspection reports 27 player route segments, 4 contact forecasts, 0 enemy route segments, all five Twin Seizure action stops, and a visible extraction objective.
- Follow-up source issue: the extraction element appeared to reach the gantry and then reverse toward a vaguely named recovery loop, while the five complete journeys were not explicit enough.
- Follow-up fix: every responsibility now carries a visible forward destination summary; the extraction marker names routes 01–05; both recovery choices progress from recovery position through the Reactor to extraction; the rescue choice visits the actual rescue landmark before the Reactor and never reverses from extraction.
- Live readback confirms `ALL 5 ROUTES END HERE`, shows each route's continuation text, and contains no `RECOVERY LOOP` label.

**Implementation checklist**

- [x] Coherent Twin Seizure west/east wings.
- [x] Full player routes to extraction.
- [x] Enemy contact forecasts during planning.
- [x] Exact enemy routes revealed only after commitment.
- [x] Five forward route summaries visible in Twin Seizure setup.
- [x] Recovery branch cannot reach extraction and then reverse.
- [x] Automated tests and production build.

**Follow-up polish**

- Reduce secondary battlefield label density during route-preview mode at 1280 x 720.

final result: passed

## Disposition mission / objective strategy QA — 2026-08-12

**Reference basis**

- The DISRUPTION versus SAFEGUARD disposition matchup now creates one fixed `BREAK THE CIRCUIT` mission: seize Alpha and Beta, sabotage the Reactor Spine, then extract at least three formations.
- Total-army plays operate inside that mission shell. They no longer invent alternate objectives or read as five equivalent colored paths.

**Implementation evidence**

- `ROLLING SABOTAGE` is a sequential objective sweep: Alpha -> Beta -> Reactor -> extraction.
- `DECISIVE ASSAULT` screens Alpha while massing on Beta, then concentrates at the Reactor and extracts.
- `TWIN SEIZURE` assigns coherent west and east wings to Alpha and Beta, converges at the Reactor, then extracts.
- Objective phase cards state the order, action, and participating route numbers on the battlefield.
- Wide named operation corridors express the army-level maneuver; individual formation segments are subordinate and emphasized only when they terminate at an objective.
- Every route that claims an objective terminates at that objective, and every surviving route ends at extraction.

**Validation**

- [x] 98 game tests.
- [x] 6 objective-topology and route-geometry tests.
- [x] Production build and Sites preparation.
- [x] Browser readback of all three objective sequences and corridor sets.
- [x] No browser console errors.

final result: passed

## Non-crossing maneuver geometry QA - 2026-08-12

**Implemented doctrine shapes**

- Rolling Sabotage is a staggered column: later elements join the same forward axis in sequence, then the force proceeds through the Reactor to extraction.
- Decisive Assault is a protected wedge: the screen and guards concentrate into one assault corridor before the Reactor, then reform at extraction.
- Twin Seizure is two separated wings: each wing advances on its own objective side, the wings converge once, and the combined force continues through the Reactor to extraction.

**Geometry invariants**

- Every authored route advances toward extraction without decreasing its battlefield x-coordinate.
- Separate lanes cannot properly intersect; route contact is limited to named shared waypoints and intentionally merged segments.
- Every route terminates at the extraction gantry.

**Validation**

- [x] 7 route-geometry and Twin Seizure topology tests.
- [x] 98 game tests.
- [x] Production build.
- [x] Browser inspection of Rolling Sabotage, Decisive Assault, and Twin Seizure.

final result: passed

## Battlefield doctrine translation QA — 2026-08-12

**Reference basis**

- Official Warhammer 40,000 mission and movement guidance was translated into original-IP mechanics: objective control, screening, terrain lanes, reserves, concentrated pressure, consolidation, and extraction.
- The implementation intentionally borrows battlefield logic rather than protected faction names, unit names, text, or rules wording.

**Implementation evidence**

- Local URL: `http://127.0.0.1:4173/`
- Browser viewport: 1280 x 720 CSS pixels.
- State inspected: Dead Circuit planning with Twin Seizure selected.
- The visible battle sequence reads `DIVIDE -> CAPTURE & INTERDICT -> CONVERGE -> EXTRACT`.
- Planning exposes WEST CONTACT, EAST CONTACT, and CONVERGENCE FIGHT forecasts while keeping exact enemy routes sealed.

**Findings**

- Twin Seizure now expresses a total-army play instead of five unrelated lines: two wings take separate objectives, an interdiction element protects the gap, the wings converge once, and all surviving formations proceed to extraction.
- The battlefield sequence and contact forecasts remain visible during formation assignment, so unit responsibilities can be judged against the army plan before secondary combinations.
- Doctrine effects are inherent to the selected play; rendezvous combinations remain optional bonuses.
- No browser console errors or failed rendering states were observed.
- [P3] At 1280 x 720 the upper battlefield remains information-dense. A future readability pass should progressively reveal secondary labels when the relevant phase or route is focused.

**Validation**

- [x] Production build.
- [x] 98 game tests.
- [x] 5 Sites checks.
- [x] Twin Seizure browser replay and route-sequence readback.

final result: passed
