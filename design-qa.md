# Enemy Reinforcement Wave Design QA

**Source visual truth**

- Existing Trapline planning composition: `C:\Users\Admin\Documents\Project-Warhost\audit-22-final-authored-field-plan.png`
- User-selected combo-window reference: `C:\Users\Admin\AppData\Local\Temp\codex-clipboard-95bc90f2-87b8-42cd-8e59-21c09920ec56.png`
- Product rule under test: reinforcements are an enemy moving plan, not a player assignment slot or RTS command surface.

**Implementation evidence**

- Final empty planning state: `C:\Users\Admin\Documents\Project-Warhost\audit-35-enemy-wave-final-empty-visible.png`
- Fully staffed safe forecast: `C:\Users\Admin\Documents\Project-Warhost\audit-28-enemy-wave-plan-safe.png`
- Fully staffed threatened forecast: `C:\Users\Admin\Documents\Project-Warhost\audit-29-enemy-wave-plan-threat.png`
- Enemy wave contact state: `C:\Users\Admin\Documents\Project-Warhost\audit-32-enemy-wave-contact-visible.png`
- Full-view comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-enemy-wave-full-comparison.png`
- Focused header, battlefield, and intelligence comparison: `C:\Users\Admin\Documents\Project-Warhost\design-qa-enemy-wave-focus-comparison.png`

**Capture conditions**

- Source and implementation pixels: 1280 x 720.
- Browser CSS viewport: 1280 x 720.
- Device pixel ratio: 1.0; no density normalization required.
- States: Trapline empty planning, five-formation safe planning, five-formation threatened planning, and completed enemy contact.

**Findings**

- No actionable P0, P1, or P2 findings remain.
- Fonts and typography: Barlow and Barlow Condensed remain unchanged. `ENEMY WAVE`, `HELIOCH RELIEF COLUMN`, E4 timing, and forecast language follow the established condensed command hierarchy without introducing a new type style.
- Spacing and layout rhythm: the enemy-wave addition does not change the three-rail shell, footer, planning board, or staging row. At the 1280 x 720 floor, the E4 order remains reachable in the scrollable intelligence rail and the compact queued E4 formation stays outside the planning board's assignment surface.
- Colors and visual tokens: furnace orange identifies the enemy wave and threatened interception; green identifies a player plan that clears before contact. Cobalt player formation language remains unchanged.
- Image quality and asset fidelity: the E4 wave reuses the existing Helioch formation asset and the existing industrial battlefield art. No placeholder art, remote media, custom SVG, or approximate CSS illustration was introduced.
- Copy and content: `Reinforcements` is replaced with explicit `ENEMY WAVE` language. The header identifies the Helioch Relief Column, the right rail states its T+06:00 east-entry order, and forecasts say whether the wave or extraction happens first. No player-facing outcome is revealed before all roles are staffed.

**Interaction verification**

- Empty planning shows `ENEMY WAVE IN 06:00`, the E4 relief-column order, and `CONTINGENCY UNREAD` without adding another player slot.
- The strong Harpoon Rig → Furnace Crew → Breaker Exo → Railjack → Salvage Hauler chain forecasts `5 / 5 EXTRACT · CLEAR 00:15 BEFORE ENEMY WAVE`; the field collision changes to `WARHOST CLEARS FIRST`.
- Swapping Railjack into stop 02 and Furnace Crew into stop 04 reduces the chain to two combos and forecasts `3 / 5 EXTRACT · WAVE ARRIVES 00:15 BEFORE CLEAR`; E4 changes to a threatened gantry intercept.
- During battle the header counts down to enemy arrival. The E4 Relief Column advances during its final 45-second approach and reaches the visible gantry-intercept marker at T+06:00.
- The live operation event and debrief identify the Helioch Relief Column, its gantry arrival, the recovery consequence, and the final victory result.
- Click assignment, automatic swap, both authored breakpoints, mission completion, return-to-battlefield, and mission reset were exercised.
- Browser console errors checked after the final render: none.

**Comparison history**

- Pass 1 [P2]: the initial E4 start point overlapped the existing E1 formation and the extraction objective, making the new formation difficult to distinguish.
- Pass 1 [P2]: the battlefield intercept label showed a calculated 00:15 outcome before the player had completed formation placement.
- Fixes: moved E4 to a distinct east-entry approach, offset the gantry interception point below the extraction label, reduced the queued marker footprint, and gated the field outcome behind a fully staffed plan.
- Post-fix evidence: the full and focused comparisons preserve the established composition; the empty state shows only authored arrival information, while the safe, threatened, and contact captures show the calculated response after placement.

**Follow-up polish**

- P3: on a 1280 x 720 viewport, the E4 intelligence result requires right-rail scrolling to read in full. This is acceptable because the persistent header and battlefield marker retain the essential timing and threat state.

**Implementation checklist**

- [x] Make enemy ownership explicit.
- [x] Show a real E4 moving formation and authored route.
- [x] Make the gantry interception point visible.
- [x] Update the contingency automatically from formation placement.
- [x] Keep player formation slots unchanged.
- [x] Use unambiguous safe/threat timing in planning, battle, and debrief.
- [x] Verify interactions, console, production build, and Sites packaging.

final result: passed
