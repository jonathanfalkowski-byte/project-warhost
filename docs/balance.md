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

## Residual, and still open

- **`early-relief` is effectively a spear mission** — 16.5% for `spear`, 1.0% for
  `trapline`, 0.0% for `pressure`. Winnable, and arguably a legitimate identity for a
  pressure that punishes slowness, but worth a deliberate decision rather than being
  left as a side effect. It is also much harder than the other two (5.8% against 26.3%
  and 32.4%).
- **Finding 3 is unchanged** — see below. The best formation *order* is still identical
  under all three pressures.

## Still open

### Mission pressures change difficulty, not strategy (finding 3)

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
