# Balance findings

Regenerate with `npm run analyse`.

```

> project-warhost@0.0.0 analyse
> node scripts/battle-sweep.mjs

BATTLE SWEEP — BREAK THE CIRCUIT vs IRON PROCESSION
5 battle rounds, 5 objectives

LIST + DEPLOYMENT — 52920 outcomes, win rate 28.1%
  lists that win from every deployment: 36   never win: 321
  of those, lists of five different hulls: 0   lists holding a repeat: 36
  stacking a hull trades deployment for consistency: 126 lists have all 120 deployments, 756 have fewer
  best  100.0%  furnace+harpoon+harpoon+hauler+hauler
  worst   0.0%  bastion+bastion+carriage+carriage+command
  lists where deployment decides it: 525 of 882   settled by the list alone: 357
  most deployment-sensitive: 50.0% of its 120 orderings win  furnace+furnace+harpoon+harpoon+hauler

ORDERS — 3125 assignments for carriage+command+furnace+harpoon+skimmer
  win rate 0.9%
  margin range -16 to 5 victory points
  best    5  south-relay>reactor>north-relay>reactor>east-gantry
  worst -16  north-relay>north-relay>east-gantry>north-relay>north-relay

VERDICT
  PASS  no list with a full deployment decision wins from every one of them (0 of 126; 36 stacked lists are deployment-proof)
  PASS  most lists are playable (321 of 882 never win)
  PASS  orders decide the battle (21 VP between best and worst)
  PASS  deployment decides it for a real share of lists (525 of 882)

STRATAGEMS — 1512 battles for 6 lists — three knife-edge, three across the ranking (12 enemy hands x 21 player choices each)
  breaker+hauler+skimmer+skimmer+bastion
  harpoon+harpoon+furnace+furnace+hauler
  railjack+hauler+skimmer+skimmer+bastion
  breaker+command+furnace+harpoon+skimmer
  carriage+command+furnace+harpoon+skimmer
  breaker+carriage+harpoon+skimmer+skimmer
  spending nothing: win rate 25.0%, margin -8 to 5 across enemy hands
  best    1.21 avg VP  HOLD FAST R3
  worst  -0.79 avg VP  SURGE FORWARD R5
  timing swing 1.94 VP   card swing 1.17 VP   enemy-hand swing 13 VP

STRATAGEM VERDICT
  PASS  what the enemy holds changes the result (13 VP between its best and worst hand)
  PASS  when you spend matters at least as much as what you spend (1.94 v 1.17 VP)
  PASS  no single stratagem play wins every battle (best wins 75.0%)
  NOTE  best answer per enemy hand: 3 distinct across 12 hands

DISPOSITIONS + STRATEGIES — 31752 battles across 2 missions
  BREAK THE CIRCUIT  win  53.6%   vs IRON PROCESSION
  THE NARROWS        win  45.5%   vs SALT COVENANT
  dominion     win  37.7%   best strategy trapline 54.4%   worst spear 13.4%
  safeguard    win  55.3%   best strategy home-line 84.5%   worst tight-shell 21.0%
  eradication  win  64.4%   best strategy decapitate 78.1%   worst crossfire 56.4%
  voidbreaker      SCRAPBORN PLATE  win  46.3%
  ordo-praesidium  RANGING OATH     win  48.2%
  hollowjaw        JAWS FIRST       win  54.1%
  best disposition by list: eradication 855, safeguard 26, dominion 1

DOCTRINE VERDICT
  PASS  every strategy wins for some army (none dead)
  PASS  every disposition is the best answer for some army (none missing)
  PASS  no disposition always wins and none never wins (64.4% to 37.7%)
  PASS  dispositions are within 50 points of each other (26.7% apart)
  PASS  no strategy is an auto-win (best is safeguard/home-line at 84.5%)
  PASS  no detachment rule dominates (hollowjaw 54.1%, ordo-praesidium 48.2%, voidbreaker 46.3%)
  PASS  every plan travels between boards (none board-locked)
  PASS  the two boards are comparably winnable (circuit-clash 53.6%, narrows 45.5%)
  PASS  detachments gate different dispositions (voidbreaker: dominion/safeguard  ordo-praesidium: dominion/eradication  hollowjaw: dominion/eradication)

RUNS — 1080 runs (12 seeds x every detachment, disposition, plan and spending rule)
  NOTE: exhaustive over policies, sampled over seeds. Every other axis above resolves its space in full.
  NOTE: fought against the CONTROL enemy, so what changes is only what the player chose.
  battles won 0..5: 0:268  1:200  2:159  3:250  4:82  5:121
  armies broken before the ladder ended: 48 (4.4%)
  dominion     won 1.72 of 4.91 fought   win rate 34.9%
  safeguard    won 2.66 of 5.00 fought   win rate 53.1%
  eradication  won 2.20 of 4.83 fought   win rate 44.7%
  victory points earned per run: 56.1   spent: 44.9
  warband size at the end: 9.93 (started 6)
  formations carrying a refit at the end: 3.75
  widen        won 2.11 of 5.00 fought   win rate 42.2%
  patch        won 2.37 of 4.75 fought   win rate 49.4%
  refit        won 1.89 of 4.85 fought   win rate 37.8%
  cheapest     won 1.75 of 4.89 fought   win rate 35.2%
  dearest      won 2.07 of 5.00 fought   win rate 41.4%

RUN VERDICT
  PASS  a run is a spread rather than pass-or-fail (6 of 6 outcomes reached)
  PASS  both endings happen (4.4% of armies break)
  PASS  which disposition you run matters, without deciding it (18.2% apart on win rate)
  PASS  how long an army lasts depends on how it fights (dominion 0.42, safeguard 0.34, eradication 0.50 lost per engagement)
  PASS  the reward you take changes the run (14.2% apart on win rate)
  PASS  formations get refitted rather than only replaced (69.8% of runs ended carrying at least one)
  PASS  what you score turns into an army, wider or deeper (13.68 formations-plus-refits from 6, 88.5% of runs ended ahead)
  PASS  the purse is spent rather than hoarded (0.0% of runs left 7+ points unspent at the last shelf)
  PASS  preserving the army pays across a run (SAFEGUARD lasts 5.00 battles v 4.88 for the rest)

PAIRINGS — 52920 list-and-deployment pairs, each resolved with the layer and without it
  deployments that formed at least one pairing: 26164 of 52920
  deployments the layer changed: 6805   better off 5798   worse off 1007
  LOCKED SHIELDS  formed by  6394 deployments   win 6.0%   better off in 850
  RANGING PAIR    formed by   939 deployments   win 10.8%   better off in 47
  BURN AND BREAK  formed by  4200 deployments   win 12.9%   better off in 224
  DUG IN          formed by 10594 deployments   win 54.6%   better off in 4310
  WOLF PAIR       formed by  6300 deployments   win 25.0%   better off in 693
  FIELD HOSPITAL  formed by  3654 deployments   win 88.0%   better off in 1769

PAIRING VERDICT
  PASS  every pairing is reachable (6 of 6 fired for some deployment)
  PASS  the layer changes battles rather than decorating them (6805 deployments resolved differently)
  PASS  standing together is a trade, not a bonus (1007 deployments did worse for it)
  PASS  no pairing wins on its own (none always wins)
  PASS  a pairing is something you have to build for (26756 formed none)

THE ENEMY — the same 1080 policies against the control enemy and against the one the game ships
  battles won per run: control 2.04   varied 1.95
  runs the enemy changed: 792 of 1080
  faced eradication   2556 engagements   player won 54.3%
  faced dominion      2564 engagements   player won 27.9%
  battles won 0..5 against the shipping enemy: 0:150  1:250  2:335  3:218  4:105  5:22
  runs that took four or more: 11.8%   all five: 2.0%

ENEMY VERDICT
  PASS  which enemy you drew changes the run (792 of 1080 ran differently)
  PASS  the enemy declares more than one way to win (eradication, dominion)
  PASS  no enemy declaration is a free win (best is 54.3%)
  PASS  no enemy declaration is an unloseable wall (worst is 27.9%)
  PASS  clearing the ladder is a result rather than the default (2.0% of runs took all five)
  PASS  and it is reachable (11.8% took four or more)
  PASS  the enemy's declaration does not decide the engagement on its own (26.4% between its best and worst, ceiling 30.0%)

THE GROUND — 5292 list-and-plan pairs, each fought on the Circuit and on a flat plain
  results the ground changed: 4686   outcomes it flipped: 918
  trapline       on the ground  79.8%   on a flat plain  75.7%
  spear          on the ground   7.7%   on a flat plain  22.1%
  pressure       on the ground  73.9%   on a flat plain  49.5%
  home-line      on the ground  64.3%   on a flat plain  55.4%
  tight-shell    on the ground   0.0%   on a flat plain   0.0%
  counterweight  on the ground  64.1%   on a flat plain  41.4%

GROUND VERDICT
  PASS  the ground changes the battle (4686 of 5292 resolved differently)
  PASS  and changes who wins it, not only by how much (918 outcomes flipped)
  PASS  every kind of ground is actually on the board (broken, cover, blocking)
  PASS  the ground reorders the plans (5 of 6 moved)
  PASS  it does not decide the whole game on its own (4 plans work on both)

SOLVABILITY — 378 answers against 6 enemies, each played twice: against an enemy that has never seen it, and against the enemy built by replaying it
  NOTE: reduced, and the only axis that is. One seed per enemy, one arrangement per list — every "read" enemy is itself built out of trial battles.
  answers that beat every enemy that has NOT read them: 13 of 378
  answers that beat every enemy that HAS read them:     0 of 378
  win rate   unread 57.5%   read 32.3%
  dominion/trapline        best answer   2 VP   median  -6   headroom   8   answers that beat it 25
  dominion/spear           best answer   2 VP   median  -2   headroom   4   answers that beat it 41
  dominion/pressure        best answer   6 VP   median  -1   headroom   7   answers that beat it 125
  eradication/headhunt     best answer   9 VP   median  -5   headroom  14   answers that beat it 130
  eradication/decapitate   best answer  11 VP   median   1   headroom  10   answers that beat it 226
  eradication/crossfire    best answer  10 VP   median   0   headroom  10   answers that beat it 185

SOLVABILITY VERDICT
  PASS  no list keeps winning once it has been read (0 answers beat every enemy that had seen them)
  PASS  bringing the same list again is punished (57.5% unread against 32.3% read)
  PASS  every enemy has an answer (6 of 6 can be beaten)
  PASS  reading the enemy pays (6 of 6 reward the best answer by 3+ VP over the median)

THE MAP — 216 runs, three ways of choosing which road to take into every engagement
  standing   battles won 1.97   victory points  51.0   warband 3.99   armies broken 56.9%
  rich       battles won 1.50   victory points  65.1   warband 4.35   armies broken 41.7%
  safe       battles won 2.26   victory points  46.5   warband 4.56   armies broken 37.5%

MAP VERDICT
  PASS  the hard road pays for itself (65.1 against 51.0 victory points)
  PASS  and costs something (1.50 battles won against 2.26)
  PASS  which road you take changes the run (0.76 battles won between the policies)
  PASS  every road is reachable (4 of 4 offered across 24 runs)

THE SKILLED RUN — 180 runs played by choosing the plan, the five and the order at every engagement
  NOTE: greedy over three stages, not exhaustive. A lower bound on skilled play, not a ceiling.
  NOTE: 6 seeds, five taken from the healthiest 7, against the SHIPPING enemy.
  NOTE: chooses by resolving each candidate, so it sees the enemy hand. A ceiling, not a player.
  battles resolved to make the choices: 243941
  battles won 0..5   skilled: 0:0  1:2  2:0  3:6  4:40  5:132
  battles won 0..5   fixed:   0:44  1:121  2:163  3:126  4:68  5:18
  battles won per run   skilled 4.67   fixed 2.20
  cleared the ladder    skilled 73.3%   fixed 3.3%
  armies broken         skilled 1.1%   fixed 14.8%
  faced eradication  skilled 99.7%   fixed 64.9%
  faced dominion     skilled 90.1%   fixed 34.3%
  declaration gap       skilled 9.6%   fixed 30.6%

SKILLED RUN VERDICT
  PASS  playing well beats playing a fixed plan (4.67 battles won against 2.20)
  PASS  and reaches the end of the ladder more often (73.3% against 3.3%)
  PASS  without making the ladder a formality (73.3% cleared it, ceiling 90.0%)
  NOTE  4 of 6 outcomes reached, but the commonest holds 73.3% of runs
  NOTE  attrition barely reaches a skilled run: 1.1% of armies broke against 14.8% under a fixed plan
  PASS  the enemy's declaration does not decide the run against a player who answers it (9.6%, ceiling 30.0%)
```
