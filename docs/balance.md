# Balance findings — Operation Dead Circuit

Findings 14 August 2026; findings 1 and 2 were resolved the same day. Regenerate with
`npm run analyse:balance`, which resolves the **entire**
decision space rather than sampling it: 120 formation permutations × 3 total-army
plays × 3 mission pressures × 4 authored branch combinations = **4,320 deterministic
outcomes**, in about a second.

`AGENTS.md` defers enemy AI and faction personality "until the player-side formation
puzzle is proven". This is the first attempt to prove it. Most of the puzzle held up.
Three things did not: two were bugs and are fixed, one is an open design question.

All figures below are post-fix unless a before/after is shown.

## What holds

**Placement genuinely decides the outcome.** Extraction counts span the full range
0–4, and win rate by formation order ranges from 2.8% to 75.0% — a 27× spread. The
puzzle is not decorative.

**No order is a universal answer.** Of 120 orders, **zero** always win and **zero**
never win. This is the strongest result in the sweep: it means no player can be handed
"the solution", which is exactly what the design asks for.

**Structure is learnable without being a rule.** Measured before the fixes: the
ARMOURED RECOVERY VEHICLE at the final stop wins 31.5% against 7.1% at the first — a real, discoverable signal. The
ASSAULT WALKER peaks at stop 3 (20.0%). Every other formation sits in a flat
9–16% band across all positions, so only two of the five carry strong positional
pressure. There is a pattern to find, but it does not collapse into a formula.

**Combo chains reward without being mandatory.** Win rate climbs 10.2% → 20.4% → 27.8%
with 0, 1 and 2 chains. Crucially, plans with **no** chain at all still win, so chains
behave as the intended secondary bonus rather than a hidden requirement.

**Authored foresight matters.** Branch combinations range 28.1% (`tempo+clock`) down to
9.3% (`protect+recover`) — a 3× spread, which supports the claim that reading the
breakpoints ahead of contact is the core skill.

## Resolved

### 1 and 2 had a single root cause

Both bugs traced to one line. `spear`'s doctrine granted `reactor: 30` — reaching the
primary objective thirty seconds sooner — and charged `missionDelay: 15` for its
exposed rear guard. But extraction time is computed as:

```js
extractionAt = max(reactorAt + 30, BASE.extractionAt - savings + delays)
```

With `reactorAt` at 300 and `BASE.extractionAt` at 345, `reactorAt + 30` is 330 — so
the second term always binds. **`spear`'s entire upside never reached the win
condition, while its penalty always did.** It was strictly worse than the alternatives
by construction, which is why it won 1.2% against 21.1% and 18.1%.

That also explains `early-relief`. With the wave arriving 45 seconds early, only a
genuinely fast play can finish in time — and the one play designed to be fast was the
one that was broken. No play could beat it, so the pressure read as unwinnable.

**Fix:** `spear`'s concentration now converts into extraction time it can actually
spend — `{ reactor: 30, extraction: 30, missionDelay: 15 }`, a net 15 seconds faster
to extraction while keeping the rear-guard exposure intact.

Separately, `early-relief` was applying a double penalty: it moved the wave 45 seconds
earlier *and* added 15 seconds to two of the three plays. The disclosed fact the player
is shown is the wave time, so the hidden slowdown was doing unadvertised work. Its
`playbookTiming` is now `{ trapline: 0, spear: -15, pressure: 0 }`.

### Result

| | Before | After |
|---|---|---|
| Overall win rate | 13.4% | 21.5% |
| `trapline` | 21.1% | 21.5% |
| `spear` | **1.2%** | **24.9%** |
| `pressure` | 18.1% | 18.1% |
| `early-relief` | **0.0% (unwinnable)** | **5.8%** |
| Best extraction, `spear` | 3 | 4 |

Every play is now viable and can exceed the requirement; every pressure is winnable.
The invariants that already held were preserved: still zero orders that always win and
zero that never win, placement still spans 0–4 extractions, chains still help
monotonically (10.2% / 20.4% / 27.8%) without being mandatory, and branch choices still
diverge threefold.

### An unplanned improvement

Fixing `spear` made each pressure favour a **different** play:

```
fractured-transit   trapline 55.0%   spear 17.7%   pressure  6.0%
reactor-window      pressure 48.1%   spear 40.6%   trapline  8.3%
early-relief        spear    16.5%   trapline 1.0%  pressure 0.0%
```

That is a partial answer to finding 3 below: pressures now reshape *which play to
bring*, even though they still do not change the best formation order within a play.

## The placement puzzle did not exist (15 Aug 2026)

Fixing findings 1 and 2 left the mission as rock-paper-scissors: each pressure had one
correct play, and the *same* formation order was optimal in all nine (pressure × play)
matchups. Investigating why exposed the real problem.

`calculatePlacementReadiness` computed `matchedCapabilities` — which formation
capabilities answer each stop's demands — and then discarded it. `taskDelay` and the
summary's `delay` were both hardcoded to `0`, while `calculateOperationProfile` added
`readinessSummary.delay` to extraction time. The channel was wired and permanently zero.

**Which unit went to which stop had no effect on the outcome, except through combo
adjacency.** The `roleOverrides` each mission pressure defines were computed, shown to
the player, and thrown away. That is why one placement was optimal everywhere: it was
simply the arrangement that maximised combo chains, invariant to everything else.

### The fix

Three changes, in order of importance:

1. **Placement now resolves.** Each demand a staffed formation cannot answer adds
   `UNMET_DEMAND_SECONDS` (8s) to the operation. This is deliberately not a
   FIT / MISMATCH gate — every formation still executes every responsibility, it just
   takes longer when it is the wrong tool. With two demands across five stops the
   graded cost ranges from about 32s to 80s, which outweighs any single doctrine or
   pressure modifier.
2. **The mission clock has headroom.** The wave now arrives 60s later (07:00 rather
   than 06:00). Without this, adding placement cost simply made everything unwinnable
   — the previous clock was so tight that only combo count could move it.
3. **Play-versus-pressure timing softened to a tilt.** The per-pressure `playbookTiming`
   overrides were ±15–30s — a full wave-loss step — which *was* the rock-paper-scissors
   mechanism, encoded directly. They are now ±5–10s: enough to colour the choice, not
   enough to decide it. This measurably helps two of the three pressures (best/worst
   play ratio 5.3× → 3.6× and 2.6× → 1.6×).

### Result against the design rules

| Rule | Before | After |
|---|---|---|
| Every fight winnable with the right placement | 1 dead matchup of 9 | **0 dead of 9** |
| Placement decides more than play choice | 1.61 vs 1.18 swing (1.4×) | **2.75 vs 1.02 (2.7×)** |
| Best placement varies by situation | **1 answer everywhere** | **6 distinct answers across 9 matchups** |
| Overall win rate | 21.5% | 26.6% |

Placement is now the deciding lever, and the right answer moves with the mission
pressure and the play — because pressures change what each stop demands, and that
finally reaches the outcome.

14 of 120 formation orders now cannot win under any configuration. That is intended:
placement is supposed to be able to lose the mission. None win everywhere, and the
win-rate distribution across orders is a smooth gradient rather than a cliff.

## The refit dimension (15 Aug 2026)

The sweep above fixes every formation to its default refit, so it covers 4,320 of the
**138,240** real configurations — one thirty-second of the space. That was a harmless
simplification while capabilities decided nothing. Once placement began resolving
through capabilities, and refits are exactly what change a formation's capabilities, it
stopped being harmless: a loadout could have been quietly deciding the mission.

`npm run analyse:balance -- --refits` now sweeps all 32 loadouts (~3 seconds).

**The headline results survived.** Overall win rate 24.8% against 26.6% at default
refits, and every conclusion holds:

| | Default refits | All 32 loadouts |
|---|---|---|
| Dead matchups | 0 of 9 | **0 of 9** |
| Placement swing | 2.75 | **2.72** |
| Play swing | 1.02 | 1.21 |
| Loadout swing | not measured | **0.44** |

Refits are the **weakest** of the three levers — they tune, they do not decide. No
loadout always wins and none never wins; best against worst is 1.8×
(`magnet+crucible+ram+plates+shield` 32.5%, `winch+jets+charge+sled+crane` 18.2%).
The pre-deployment choice therefore cannot settle the mission before it starts, which
is what `AGENTS.md` asks of it.

**But refits barely reshape the puzzle.** Across 288 (loadout × pressure × play)
situations there are only 13 distinct optimal placements, and in three of the nine
matchups the loadout never changes the best answer at all. Swapping the RECON TANK's
Gravitic Winch (`CONTROL / MOBILITY`) for a Breach Magnet (`CONTROL / BREACH`) — half
its capability profile — does not move it off stop 1.

`AGENTS.md` wants refits to "make legible tradeoffs by changing capabilities or named
condition vocabulary, allowing readiness and directional combo windows to change".
They are currently a difficulty dial with a small reshaping effect, rather than a
choice that changes where a formation belongs. That is the open design question, and
it is a design decision rather than a bug: the mechanism works, it is just quiet.

## Making the mechanic legible (15 Aug 2026)

Placement became the deciding lever, but the cost was invisible: the planning board
shows a sealed `?` by design, and the debrief said only "5 / 5 orders staffed". A
player could concede 80 seconds to mismatched placement and never learn why — worse
than the old behaviour, where placement at least did nothing consistently.

The debrief now opens with a `PLACEMENT COST` readback: per stop, what the role
demanded, which demands went unanswered, and the seconds conceded; then the total and
how many extractions it cost. Verified by playing two operations to completion in a
browser — a deliberately mismatched plan reports `01:20 conceded · 10 of 10 stop
demands went unanswered ... costing 2 formations at the wave`, a well-matched one
`00:48 conceded · 6 of 10`. Evidence: `docs/audit/audit-42-placement-cost-debrief.png`.

Nothing about placement quality appears before commitment; a regression guard asserts
the readback is absent from the planning render, and all nine new colours clear WCAG AA
(6.9:1 to 15.6:1).

## The doctrine bug had a third instance (15 Aug 2026)

`early-relief × pressure` was winnable by 2 of 120 placements — alive, but a dead end in
practice. The cause turned out to be the same bug found in `spear`, for the third time.

`pressure`'s doctrine grants `alpha: 15, beta: 15` — both control nodes fifteen seconds
sooner — and charges `missionDelay: 15` for the convergence. But `betaAt` at 135 puts
the `reactorAt` floor (`betaAt + 60`) at 195, well under the 300 baseline, so `reactorAt`
never moves and `extractionAt` stays bound by its own 345 term. **The parallel capture
never reached the win condition; the convergence cost always did.**

**Fix:** taking both nodes at once now starts the withdrawal sooner —
`{ alpha: 15, beta: 15, extraction: 30, missionDelay: 15 }`, the same shape as the
`spear` fix. The mission clock was then tightened from +60s to +45s of headroom, because
fixing the third play lifted the overall win rate to 36.8%.

### Result

| | Before | After |
|---|---|---|
| `early-relief × pressure` | **0.4% (2 of 120 placements)** | **5.0% (13 of 120)** |
| Dead matchups | 0 of 9 | 0 of 9 |
| Worst matchup | 0.4% | **2.1%** |
| Placement vs play swing | 2.75 vs 1.02 (2.7×) | **2.83 vs 0.86 (3.3×)** |
| Rock-paper-scissors ratio per pressure | 3.6× / 1.6× / **44×** | **1.1× / 2.3× / 3.9×** |
| Overall win rate | 26.6% | 21.1% |

The rock-paper-scissors reading is gone: the worst play-choice penalty within a pressure
is now 3.9×, against 44× before. Each pressure still favours a different play, but the
gap is a tilt rather than a verdict.

**Refits improved without being touched.** Their swing rose from 0.44 to 0.61 extractions,
putting them on par with the choice of play (0.82) rather than far behind it, while
placement stayed dominant at 2.86. No loadout wins or loses everywhere (1.8× best to
worst). The earlier "refits are too quiet" finding was largely a symptom of the same
doctrine bug, so no refit content was changed.

## Residual, and still open

- **`early-relief` remains the hard pressure** — 2.1% to 8.1% across the three plays,
  against 19-45% elsewhere. Every play can win it, but it demands a well matched plan.
  This now looks like an identity rather than a defect.
- **Softening the play timings is helpful but not load-bearing.** Restoring the
  original ±15–30s values does not break any invariant now that placement dominates —
  the placement fix is what does the work. Verified by mutation.

## Resolved: mission pressures now reshape strategy (finding 3)

The single best formation order is **identical under all three pressures**, and so are
the second and third:

```
fractured-transit   91.7%   harpoon>furnace>breaker>railjack>hauler
reactor-window      91.7%   harpoon>furnace>breaker>railjack>hauler
early-relief        33.3%   harpoon>furnace>breaker>railjack>hauler
```

`AGENTS.md` asks that a disclosed pressure reshape strategy so "a previously successful
setup remains understandable but not universally dominant". Right now a player who
finds the strongest order once can reuse it forever; the pressure only changes whether
it is enough. The lever moved is difficulty, not the answer.

**Suggested direction:** pressures currently modify timing and role demands. To change
*which* placement is best, at least one pressure needs to alter what a stop rewards —
for example making a stop demand a capability only some formations carry, so the best
answer moves rather than merely getting harder.

## Overall difficulty

The overall win rate is now **21.5%**, and this is the first playable mission. Even the
single best order under the most forgiving pressure tops out at 75%. A player
exploring reasonably will lose most attempts on their introduction to the game.

Whether that is correct is a design decision, not a bug — a deliberately punishing
opener is a legitimate choice. Findings 1 and 2 were inflating it; with those
fixed, 21.5% is a deliberate figure rather than an accident.

## Regression guards

`tests/balance.test.mjs` runs the full sweep and asserts the claims that currently hold
— determinism, that placement changes outcomes, that no order is dominant or hopeless,
that chains help without being mandatory, that branches diverge, and that every play
can win at all. They assert the *shape* of the design, not tuned numbers, so ordinary
balance work will not turn them red.

Since findings 1 and 2 were fixed, three further guards are now active and were
verified by reverting each fix: every disclosed mission pressure is winnable, no play
is a trap or a dominant answer (best/worst win rate ratio under 3×), and every play can
exceed the extraction requirement rather than merely scrape it.

## Re-running

```powershell
npm.cmd run analyse:balance
```

Run it after any change to formation capabilities, refits, playbook timing, mission
pressure, breakpoint impacts, or enemy plans. It is the cheapest way to find out
whether a tuning change did what you intended across the whole space instead of in the
one configuration you happened to play.
