# Formation Staging and Combo Window Design QA

**Source visual truth**

- `C:\Users\Admin\AppData\Local\Temp\codex-clipboard-d213f893-f8c9-4aa2-99d5-9247dc595b7a.png`
- User-reported empty Trapline planning state where the board obscures the unassigned formation portraits and the handoff section does not explain timing or behavior.

**Implementation evidence**

- Matched empty planning state: `C:\Users\Admin\AppData\Local\Temp\project-warhost-combo-windows\final-visible-staging-empty-2167x1821-ready.png`
- Compact empty planning state: `C:\Users\Admin\AppData\Local\Temp\project-warhost-combo-windows\final-visible-staging-1280x720-ready.png`
- Staffed combo-window state: `C:\Users\Admin\AppData\Local\Temp\project-warhost-combo-windows\revealed-combo-windows-1280x720.png`
- Live automatic combo state: `C:\Users\Admin\AppData\Local\Temp\project-warhost-combo-windows\live-combo-window-1280x720.png`
- Full-view comparison: `C:\Users\Admin\AppData\Local\Temp\project-warhost-combo-windows\source-vs-final-full-ready-4334x1821.png`
- Focused board comparison: `C:\Users\Admin\AppData\Local\Temp\project-warhost-combo-windows\source-vs-final-focus-ready-3200x1100.png`

**Capture conditions**

- Matched source and implementation viewport: 2167 x 1821 CSS pixels.
- Source pixels: 2167 x 1821.
- Implementation pixels: 2167 x 1821.
- Device pixel ratio: 1.0; no density normalization required.
- Additional compact verification viewport: 1280 x 720 CSS pixels at device pixel ratio 1.0.
- State: Trapline selected with all five formation roles empty for the matched comparison. Staffed and battle captures intentionally verify the revealed and live states that the source could not show.

**Findings**

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: Barlow and Barlow Condensed remain unchanged. `COMBO WINDOWS`, timing labels, trigger-response verbs, and the live `NOW` banner preserve the established hierarchy. The smallest consequence copy remains legible at the 1280 x 720 floor.
- Spacing and layout rhythm: all five 94-pixel formation portraits now occupy a dedicated row above the board. The board no longer intersects their drag targets, and the complete combo-window strip remains above the fixed footer at 1280 x 720.
- Colors and visual tokens: cobalt still identifies player formations and placement; green identifies an armed or live automatic combo; orange remains reserved for mission and enemy pressure. No new visual language conflicts with the source.
- Image quality and asset fidelity: the original formation portraits and battlefield art remain unchanged, fully loaded, and correctly cropped. No placeholders, approximate art, or new raster assets were introduced.
- Copy and content: player-facing `handoff` terminology is replaced by `combo window`. Every revealed window states its T+ time, the earlier formation and condition it creates, the later formation and named reaction, the resulting condition, and the mission consequence. Empty windows explain that nothing is activated manually.

**Interaction verification**

- All five unassigned formation portraits are visible and remain draggable/clickable before placement.
- Filling the standard sequence reveals four scheduled windows: T+00:45, T+02:30, T+03:45, and T+05:30.
- Each revealed window presents `source creates condition -> receiver reacts -> result and consequence` without recommending a placement before the player commits it.
- Committing the plan produces a live battlefield banner at the first automatic window: `HARPOON RIG creates DISPLACED -> FURNACE CREW reacts: FURNACE DRAGNET`, with the result and mission impact.
- The two formations involved in the live window receive distinct source and receiver pulses, while the battle panel marks the window `NOW` and keeps later windows as countdowns.
- Click assignment, Ghost Drill, Commit Playbook, live combo timing, breakpoint resolution, and Abort & Reset were exercised.
- Clean browser session console errors checked: none.

**Comparison history**

- Pass 1 source finding [P1]: the board covered the only physical formation portraits on the battlefield, weakening drag-and-drop discoverability.
- Pass 1 source finding [P1]: `TACTICAL HANDOFFS`, condition transformations, and green cards did not communicate when an event occurred or what the player would see during combat.
- Fixes: moved the hard-coded formation staging row above the board; moved and compacted the board so its complete content fits at 1280 x 720; replaced player-facing handoff language with timed combo windows; added explicit creates/reacts/result/consequence anatomy; added upcoming/live/resolved battle states, a live battlefield banner, and formation pulses.
- Post-fix evidence: matched full and focused comparisons show the visible staging row and unobstructed board; the staffed and live captures show the complete trigger-response loop.

**Follow-up polish**

- P3: the four detailed combo cards are intentionally dense at 1280 x 720. A future unit-inspection pass could add keyboard focus or hover expansion without changing the current information hierarchy.

**Implementation checklist**

- [x] Keep every unassigned formation visible above the planning board.
- [x] Explain combo timing before placement without revealing an answer.
- [x] Reveal source, trigger, receiver, reaction, result, and consequence after placement.
- [x] Show the automatic combo during battle with a live banner and portrait feedback.
- [x] Verify matched, compact, staffed, and battle states.
- [x] Check browser console, production build, and Sites packaging tests.

final result: passed
