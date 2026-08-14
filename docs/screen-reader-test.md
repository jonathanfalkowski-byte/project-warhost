# Screen reader test script — Operation Dead Circuit planning flow

Every expected announcement below was captured from the running prototype on
14 August 2026, not written from assumption. Wording may differ slightly between
screen readers — NVDA and JAWS phrase roles and states differently, and both
abbreviate under fast speech. **Judge each step on whether the information arrives,
not on exact wording.**

Automated checks (axe-core, plus the suite in `tests/accessibility.test.mjs` and
`tests/app-render.test.mjs`) already cover contrast, accessible names, focus order,
live-region structure, and modal wiring. This script exists for what automation
cannot establish: whether a real screen reader actually speaks the right thing at the
right moment, and whether a blind player could form and commit a plan.

## Setup

1. **NVDA** (free, Windows): download from nvaccess.org, install, launch. The NVDA
   modifier key is Insert (or Caps Lock if configured).
   **JAWS** (Windows, commercial) is the useful second pass — its dialog and
   live-region handling differs enough to catch different bugs.
2. Build and serve the prototype:
   ```powershell
   npm.cmd run build
   npm.cmd run preview
   ```
   Open `http://localhost:4173/` in Chrome or Edge at a desktop window size
   (1280×720 or larger — the prototype does not reflow below 1024 px).
3. Turn on NVDA's speech viewer (**NVDA menu → Tools → Speech Viewer**) so you can
   read back exactly what was spoken. Screenshot it for anything that fails.
4. Put your hands away from the mouse. **The entire script is keyboard only.** If you
   need the mouse at any point, that is itself a finding.

Useful keys: `Tab` / `Shift+Tab` move between controls. `Enter` or `Space` activates.
`Escape` dismisses. `NVDA+Tab` re-reads the focused control. `NVDA+Down` reads
continuously from the cursor.

---

## 1. Orientation

| # | Action | Expected |
|---|---|---|
| 1.1 | Load the page | The page title and app land are announced. You can tell this is Project Warhost, Operation Dead Circuit. |
| 1.2 | `NVDA+Down` to read the page | The victory condition is reachable as text: sabotage the Reactor Spine and extract at least three formations, with the rescue described as optional. |

**Pass:** you know what winning requires before touching a control.
**This is the key question for step 1** — the win condition is stated visually in a
`VICTORY ORDERS` panel, and it must survive as reading-order text.

## 2. Choosing a total-army play

| # | Action | Expected |
|---|---|---|
| 2.1 | `Tab` once from the top | First control is the playbook: *"ROLLING SABOTAGE Seize, transfer, sabotage, withdraw. SEIZE → TRANSFER → SABOTAGE → WITHDRAW"*, announced as a button, with its selected state. |
| 2.2 | `Tab` twice more | `DECISIVE ASSAULT` then `TWIN SEIZURE`, each with its own summary. |
| 2.3 | `Enter` on `TWIN SEIZURE` | Selection is conveyed — pressed/selected state changes. |

**Known weakness — report what you hear.** Selecting a play redraws the whole
battlefield, but that redraw is geometry. Confirm whether you can tell *anything*
changed beyond the button's own state. If not, note it: the map caption is a live
region and may or may not carry enough.

## 3. Mission pressure

| # | Action | Expected |
|---|---|---|
| 3.1 | `Tab` to the condition controls | *"FRACTURED TRANSIT Collapsed transit decks permit only one secure advance at a time…"* |
| 3.2 | `Enter` to change it | Selected state changes. |

**Known gap — confirm and record.** Changing mission pressure alters role demands,
playbook timing and enemy-wave arrival. In the 14 Aug walkthrough **no live region
fired on this change.** Expect the state change to be announced but the consequences
not to be. Note precisely what you hear; this is a candidate fix.

## 4. The roster

| # | Action | Expected |
|---|---|---|
| 4.1 | `Tab` to the formations | *"RECON TANK. Available. Drag to an action stop."* — a button. |
| 4.2 | `Tab` through all five | Each names a battlefield archetype: RECON TANK, FLAME SUPPORT VEHICLE, ASSAULT WALKER, MAIN BATTLE TANK, ARMOURED RECOVERY VEHICLE. |
| 4.3 | `Enter` to select one | Pressed state is announced. |

**Pass:** every formation is distinguishable by name and availability without sight.
Note that "Drag to an action stop" describes a mouse action — check whether that
misleads you into thinking a drag is required. It is not; step 5 is the keyboard path.

## 5. Route preview — the newest surface

This is the highest-value part of the script. The preview is drawn purely as map
geometry and was silent to screen readers until 14 Aug 2026.

| # | Action | Expected |
|---|---|---|
| 5.1 | `Tab` to action stop 1 | *"Action stop 1, LEAD ELEMENT. Currently empty"* |
| 5.2 | Stay focused, wait ~1s | A polite announcement follows: *"Route preview only, not assigned. RECON TANK would take the vehicle route, avoiding blocked terrain, to action stop 1, LEAD ELEMENT."* |
| 5.3 | `Tab` to stop 2, then 3 | The announcement repeats with the new stop number and role name each time. |
| 5.4 | Select ASSAULT WALKER in the roster, return to a stop | The route type changes to *"walker route, cutting through ruins"*. |
| 5.5 | `Shift+Tab` away from all stops | The announcement stops. No stale preview is left speaking. |

**Pass:** you can tell, without sight, which route a formation would take and that
nothing has been assigned yet.
**Fail:** silence at 5.2, the word "preview" missing (you might think it is already
assigned), or the same text repeating when you have moved away.

## 6. Assigning a formation — modal dialog

All four overlays declare `aria-modal="true"`, which tells your screen reader the rest
of the page does not exist. Until 14 Aug 2026 focus was *not* trapped, so `Tab` walked
into a background your screen reader refused to read. Verify the fix held.

| # | Action | Expected |
|---|---|---|
| 6.1 | `Enter` on action stop 1 | A dialog is announced, named *"Who executes LEAD ELEMENT?"* |
| 6.2 | Listen without pressing anything | Focus is **already inside** the dialog, on the first option: *"RECON TANK REFIT GRAVITIC WINCH CAPABILITIES CONTROL / MOBILITY…"* |
| 6.3 | `Tab` about eight times | Focus **cycles within the dialog**: five formations, then `LEAVE STOP EMPTY`, then back to the first. You must never hear a background control (a playbook, a condition, another stop). |
| 6.4 | `Shift+Tab` from the first option | Wraps to the **last** control in the dialog, not out to the page. |
| 6.5 | `Escape` | Dialog closes and focus returns to *"Action stop 1, LEAD ELEMENT. Currently empty"* — the stop you opened it from. |
| 6.6 | `Enter` again, then `Enter` on RECON TANK | Dialog closes; focus returns to the stop, now announced as *"Action stop 1, LEAD ELEMENT. Currently RECON TANK"* |

**Pass:** 6.3 never escapes the dialog, and 6.6 announces the assignment through the
returned focus.
**Fail — stop and report immediately:** hearing any background control at 6.3, silence
after 6.6, or focus landing at the top of the document.

## 7. Reading the plan back

| # | Action | Expected |
|---|---|---|
| 7.1 | `Tab` through all five stops | Assigned stops read *"Currently <FORMATION>"*, empty ones *"Currently empty"*. |
| 7.2 | `Tab` to the roster | An assigned formation now reads *"RECON TANK. Assigned to action stop 1, LEAD ELEMENT."* |
| 7.3 | Staff all five stops | Each assignment is confirmed via returned focus. |

**Pass:** you can audit the whole plan by tabbing, with no ambiguity about which
formation sits at which stop.

## 8. Combo details (optional, collapsed)

| # | Action | Expected |
|---|---|---|
| 8.1 | `Tab` to *"COMBO DETAILS · OPTIONAL BONUS"* | Announced as a collapsed expander. |
| 8.2 | `Enter` | Expands; content becomes readable. |

**Known limitation — confirm.** Assignment feedback (`ASSIGNMENT RECORDED …`) lives
inside this collapsed region. Collapsed content is outside the accessibility tree, so
that feedback never reaches you while it is closed. Sighted players do not see it
either, so this is parity rather than a regression — but confirm the expander itself
is discoverable, since it is your only route to that information.

## 9. Committing

| # | Action | Expected |
|---|---|---|
| 9.1 | `Tab` to the breakpoint controls | Each authored response is announced with its trigger, e.g. *"IF Beta lane is ranged"*, `CROSS NOW` / `COVER THE BREACHER`. |
| 9.2 | `Tab` to `RUN GHOST DRILL` | Announced with its purpose. |
| 9.3 | `Enter` | Confirm whether drill progress is announced or silent — **record what you hear**. |
| 9.4 | `Tab` to `COMMIT PLAYBOOK` | *"COMMIT PLAYBOOK Execute staffed roles and authored branches."* |

## 10. Battle and the Command Seal decision

The Command Seal decision is the game's signature mechanic and appears mid-battle
under time pressure. It is a modal dialog with the same trap, but it is **not
dismissible** — Escape must do nothing, because the player has to choose.

| # | Action | Expected |
|---|---|---|
| 10.1 | Commit and let the battle run | Confirm whether battle progress reaches you at all. Autonomous execution is largely visual — **record honestly**. |
| 10.2 | When the decision appears | A dialog is announced and focus moves into it automatically. |
| 10.3 | `Tab` repeatedly | Focus stays inside the dialog. |
| 10.4 | `Escape` | **Nothing happens** — the dialog stays open. This is correct. |
| 10.5 | Choose an option | The dialog closes and the outcome is conveyed. |

## 11. After-action debrief

| # | Action | Expected |
|---|---|---|
| 11.1 | On completion | A dialog is announced with focus moved into it. |
| 11.2 | Read through | The result is unambiguous in words — `VICTORY` or `DEFEAT` plus the formation count against the requirement — never by colour alone. |
| 11.3 | `Tab` | Focus stays inside; the continue control is reachable. |

---

## Recording results

For each step: **pass**, **fail**, or **partial**, with the speech-viewer text for
anything not a clean pass. A finding needs three things to be actionable:

1. The step number and what you did.
2. What was actually spoken (paste from the speech viewer).
3. What you expected instead.

Add confirmed failures to `ux-audit.md` under the accessibility section, with the
screen reader and version, since behaviour differs between them.

## Priorities if time is short

1. **Section 6** — modal focus trapping. This was genuinely broken and is the
   difference between a usable and an unusable planning flow.
2. **Section 5** — route preview announcements, the newest surface.
3. **Section 10** — the Command Seal decision, because it is time-pressured and
   non-dismissible.

Sections 1–4 are largely covered by the automated suite; 7–9 and 11 are worth a pass
but are lower risk.

## Already known before you start

Recording these so they are not re-reported as new:

- **Mission-pressure changes are not announced** beyond the button's own state (§3).
- **Assignment feedback is inside a collapsed expander** and unreachable while closed
  (§8). Sighted parity, but worth a decision.
- **Reflow fails below 1024 px** — the prototype is desktop-only by design. Do not
  test at phone widths; see `ux-audit.md` for the rationale.
- **Autonomous battle execution is largely visual** (§10.1). How much of it should be
  narrated is an open design question, not a defect with an agreed answer.
