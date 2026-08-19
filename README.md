# Project Warhost

An original-IP autobattler roguelite. You muster one army, declare how you intend to win,
choose a plan, and watch five rounds resolve themselves — then take what is left of that
army into the next engagement. Nothing is steered once a battle starts, and nothing you
lose comes back.

## Play locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173/`.

## The run

Five engagements, fought by one army. **The difficulty curve is your own attrition** — the
enemy never inflates, but your formations carry their wounds forward and your wrecks do not
come back. The first engagement is the fairest fight of the run and the last is the hardest
entirely because of what happened in between. A run ends when the ladder is finished or
when you can no longer field three formations, and what it is worth is how many of the five
you actually took.

**Victory points are the currency.** What you score in a battle is what you have to spend
between them, so how you score and what you can afford are the same decision — and a
disposition is an economic strategy as much as a way to win. ERADICATION farms a body count
into a wider warband; DOMINION buys off the ground it takes; SAFEGUARD earns less and keeps
what it buys. A battle you lost still pays for what you took while you were losing it.

The market offers five formations you do not already have, at authored prices from 2 to 5
points, three **refits** for formations you do own, plus repairs and an extra command point.

**A warband may hold two of any one formation**, and no more. Duplicates are what open
list-building up without a single new hull being authored — nine formations choose five is
126 lists, with repeats it is 882 — and the cap is what stops that opening onto three of the
best one. Two of the same hull are two formations: two ids, two damage tracks, two orders,
and they are told apart on screen as I and II. Stacking one buys consistency and spends
deployment decision, which is a trade you are allowed to make.

Prices are low on purpose. A warband is meant to grow past its five deployment slots over a
run, so that **the warband is the collection and the deployment is the counter-pick** — which
five you field against this particular enemy is the decision, and it does not exist until
there are more than five to choose from. Priced higher, a whole run bought about two changes
and nothing was ever discovered because nothing was ever tried.

## What nothing tells you

Six named **pairings** fire when two formations with the right pair of keywords stand within
ten units of each other. They are printed on no card, in no rules panel and in no tooltip.
The first time one forms, the round says its name out loud and the run writes it into FIELD
NOTES, where it stays.

Everything else the game calls a combination is stated on the thing that grants it — SHIELD
soaks, COMMAND improves what is near it, REPAIR patches, and every refit names which of
those it hands over. That is legible, and it means a player who reads the cards knows the
whole game before the first battle. A pairing is the one thing you can only find by standing
two hulls together and seeing what happens.

FIELD NOTES lists every pairing from the first muster by name and by the two keywords it
wants, so there is something to hunt for — what it *does* is what you find out by standing
them together, and once found it is recorded with its mechanics, both hulls and the board.

They are keyed on keywords rather than on formations, which makes the refit market the
discovery engine: a FLAME SUPPORT VEHICLE that bought an ASH CRUCIBLE has SHIELD, and can
anchor on a heavy hull it could not anchor on the battle before. Both armies get them,
because it is a rule of the board and not a player power. And standing that close is a
trade — a formation shoulder to shoulder with its own is an easier thing to hit, charged per
neighbour, so a clean pair pays almost nothing and a five-hull knot pays a lot.

A refit changes what a formation *is*, and is always a trade rather than an upgrade. Several
of them grant a keyword the rules already care about — SHIELD soaks fire aimed at anything
nearby, COMMAND makes neighbours shoot better, REPAIR patches a friend each round — so a
refit is an existing rule arriving on a hull that could not carry it before. A FLAME SUPPORT
VEHICLE with an ASH CRUCIBLE is a screen. A SIEGE GUN CARRIAGE with a SPOTTER MAST is a
second command vehicle that outranges the board. That is where buying a formation becomes
the start of a build rather than the end of a transaction. The shelf is drawn once and held: buying
something takes it off, and nothing slides in behind it. Free field repair covers a
scratch; anything worse has to be bought, so every point spent patching the army you have
is a point not spent widening it.

Each disposition leaves something behind that outlives the battle. ERADICATION means the
formations you broke stay broken and they field fewer next time. DOMINION turns held ground
into repair. SAFEGUARD needs no rule for it — its payoff is the casualties that did not
happen, which is the reason it exists.

## The loop

Four decisions, each narrowing the next, all made before a shot is fired.

1. **BATTLEFIELD** — set by the ladder, alternating between the two boards so no plan can
   be optimised for one of them across a whole run. BREAK THE CIRCUIT is a wide cross with
   long flank lanes; THE NARROWS is the same five objectives and the same six victory
   points folded toward the centre line, so the armies are in contact by round two.
2. **DETACHMENT** — what kind of army. Chosen at muster and fixed for the whole run. Each has a rule in force every round (SCRAPBORN
   PLATE takes a tenth less from everything; RANGING OATH shoots as if a command vehicle
   were beside every formation; JAWS FIRST fights at half again in melee), its own
   stratagem pool, and its own list of dispositions it is allowed to declare.
3. **DISPOSITION** — how you win. This *replaces* the victory condition and changes which
   objectives are live for you at all. DOMINION lights the whole board. ERADICATION
   darkens all of it — no ground is worth anything, only the army in front of you.
   SAFEGUARD darkens everything past your own half and doubles what is left.
4. **STRATEGY** — three authored plans per disposition, each a route per deployment slot,
   drawn on the board before you commit. You pick a plan by looking at it. Any single slot
   can still be overridden.

Then deploy five formations, commit up to three command points of stratagems to the
specific rounds you want them to fire in, and watch.

## The ground

The board is not a plain. Each mission has terrain, authored in one half and reflected so
neither edge is the better one, and it does three things:

- **Broken ground** — crossing it halves the advance. The short road is the slow one.
- **Cover** — fire coming into it is cut by two fifths.
- **Blocking** — nothing shoots through it, in either direction.

Melee is untouched: two formations in contact are in contact.

That is what makes a plan a decision rather than a distance calculation. TRAPLINE goes wide
and slow into cover; SPEAR takes the fast open road up the middle and stands in the open at
the end of it; PRESSURE refuses the centre entirely and goes round the outside gates,
because cutting the corner walks straight through the slag. All of it is drawn on the board
and named — terrain the player cannot see is the game keeping a rule to itself.

## The enemy builds a list too

The Helioch army is not a fixed encounter. Every engagement it picks a **detachment**, a
**disposition that detachment is allowed to declare**, a **plan from that disposition**, and
a **list of hulls chosen to walk it** — the same four decisions the player makes, drawn
deterministically from the run's seed. Its plan is one of the same nine the player can
declare, walked from the other edge: routes are reflected about the centre line, so
TRAPLINE means the same thing to both armies and no lane quietly favours one edge.

It was a fixed list before, fielded as `slice(0, n)` — so every run of every seed faced the
identical five configurations in the identical order, both armies declared DOMINION forever,
and "harder" meant the same army with one more vehicle bolted on. Picking five of nine
against a constant is not a counter-pick, it is a lookup.

Nothing about it reacts. You are still told its detachment, its disposition, its plan and
where every one of its formations is going before you commit; the only thing hidden is still
the hand. That is also the groundwork for asymmetric PvP — "enemy" stops being a category
and becomes a warband.

The balance sweep keeps a **control enemy**: the doctrine's own declared disposition and
plan, on seed zero, in every engagement. Every claim the sweep makes about the *player's*
choices is measured against it, because an effect cannot be attributed to what the player
picked while the thing they are measured against changes underneath them.

## Where the uncertainty comes from

Not dice — the resolution is completely deterministic, which is what lets the whole
decision space be swept exhaustively rather than sampled. The uncertainty is **hidden
information**: the enemy holds two stratagems drawn from a pool you can see in full, and
you find out which two only as it spends them. You always know what the enemy is trying to
do; you never know what it is holding to do it with. Losing to a decision you could not see
is something you can plan against next time. Losing to a roll is not.

## Checks

```powershell
npm.cmd run test:game    # unit, structural and accessibility guards
npm.cmd run test:sites   # the deployment worker
npm.cmd run analyse      # the exhaustive balance sweep
```

`npm run analyse` resolves the decision space rather than sampling it — every list against
every deployment, every order assignment, every enemy stratagem hand, and every
disposition-and-plan pairing on both boards. It prints verdicts, not numbers to interpret:
no list may win from every deployment, no plan may be an auto-win, no plan may be dead
content, every disposition must be the right answer for some army, and no plan may be
locked to the board it was written on. The pairing axis resolves every list and every
ordering **twice**, once with the layer and once without, so what the layer is worth is
measured on the same battle rather than on two different ones. The run axis plays every
policy twice as well — against the control enemy and against the one the game ships — so
what the player chose and which opponent they drew are never confused for each other.

The run axis is the one exception to resolving a space in full, and it labels itself as
one: five battles with a deployment, a plan and a reward each is not tractable, so it is
**exhaustive over policies and sampled over seeds**. Current findings are in
`docs/balance.md`.

## History

An earlier resolution model — an authored route plan resolved as a timeline of capability
matches against a scripted enemy — was built first and ran alongside this one while the
comparison was made. It was retired on 18 August 2026: it shared no structure with the
tabletop game it was meant to evoke, and keeping both alive meant every new rule had to be
built twice or built nowhere. What was worth keeping came across — the per-formation
after-action readout, and the disclosure principle that the player is told the enemy's
intent but never its hand. `docs/audit/` and `ux-audit.md` record the retired screen.

Design decisions and the reasoning behind them are in `AGENTS.md`.
