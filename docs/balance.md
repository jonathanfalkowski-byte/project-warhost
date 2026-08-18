# Balance findings

Regenerate with `npm run analyse`.

```

> project-warhost@0.0.0 analyse
> node scripts/battle-sweep.mjs

BATTLE SWEEP — BREAK THE CIRCUIT vs IRON PROCESSION
5 battle rounds, 5 objectives

LIST + DEPLOYMENT — 15120 outcomes, win rate 29.0%
  lists that win from every deployment: 0   never win: 22
  best   95.0%  bastion+command+furnace+harpoon+hauler
  worst   0.0%  bastion+breaker+carriage+railjack+skimmer
  lists where deployment decides it: 104 of 126   settled by the list alone: 22
  most deployment-sensitive: 50.0% of its 120 orderings win  bastion+breaker+harpoon+hauler+skimmer

ORDERS — 3125 assignments for breaker+furnace+hauler+railjack+skimmer
  win rate 0.3%
  margin range -16 to 4 victory points
  best    4  west-works>reactor>north-relay>south-relay>east-gantry
  worst -16  north-relay>north-relay>reactor>north-relay>north-relay

VERDICT
  PASS  no list wins from every deployment (0 do)
  PASS  most lists are playable (22 of 126 never win)
  PASS  orders decide the battle (20 VP between best and worst)
  PASS  deployment decides it for a real share of lists (104 of 126)

STRATAGEMS — 1512 battles for 6 lists — three knife-edge, three across the ranking (12 enemy hands x 21 player choices each)
  breaker+hauler+carriage+command+bastion
  breaker+hauler+skimmer+carriage+bastion
  breaker+hauler+skimmer+carriage+command
  bastion+furnace+harpoon+hauler+railjack
  breaker+furnace+hauler+railjack+skimmer
  breaker+carriage+command+railjack+skimmer
  spending nothing: win rate 50.0%, margin -10 to 2 across enemy hands
  best    1.81 avg VP  SURGE FORWARD R2
  worst  -1.03 avg VP  SURGE FORWARD R5
  timing swing 2.83 VP   card swing 2.51 VP   enemy-hand swing 12 VP

STRATAGEM VERDICT
  PASS  what the enemy holds changes the result (12 VP between its best and worst hand)
  PASS  when you spend matters at least as much as what you spend (2.83 v 2.51 VP)
  PASS  no single stratagem play wins every battle (best wins 79.2%)
  NOTE  best answer per enemy hand: 2 distinct across 12 hands

DISPOSITIONS + STRATEGIES — 4536 battles across 2 missions
  BREAK THE CIRCUIT  win  45.1%   vs IRON PROCESSION
  THE NARROWS        win  33.0%   vs SALT COVENANT
  dominion     win  39.7%   best strategy trapline 62.3%   worst spear 7.0%
  safeguard    win  52.6%   best strategy home-line 84.1%   worst tight-shell 14.3%
  eradication  win  31.3%   best strategy decapitate 50.6%   worst headhunt 20.6%
  voidbreaker      SCRAPBORN PLATE  win  45.9%
  ordo-praesidium  RANGING OATH     win  33.5%
  hollowjaw        JAWS FIRST       win  37.8%
  best disposition by list: eradication 71, dominion 19, safeguard 36

DOCTRINE VERDICT
  PASS  every strategy wins for some army (none dead)
  PASS  every disposition is the best answer for some army (none missing)
  PASS  no disposition always wins and none never wins (52.6% to 31.3%)
  PASS  dispositions are within 50 points of each other (21.4% apart)
  PASS  no strategy is an auto-win (best is safeguard/home-line at 84.1%)
  PASS  no detachment rule dominates (voidbreaker 45.9%, hollowjaw 37.8%, ordo-praesidium 33.5%)
  PASS  every plan travels between boards (none board-locked)
  PASS  the two boards are comparably winnable (circuit-clash 45.1%, narrows 33.0%)
  PASS  detachments gate different dispositions (voidbreaker: dominion/safeguard  ordo-praesidium: dominion/eradication  hollowjaw: dominion/eradication)

RUNS — 1080 runs (12 seeds x every detachment, disposition, plan and spending rule)
  NOTE: exhaustive over policies, sampled over seeds. Every other axis above resolves its space in full.
  NOTE: fought against the CONTROL enemy, so what changes is only what the player chose.
  battles won 0..5: 0:308  1:228  2:177  3:181  4:87  5:99
  armies broken before the ladder ended: 89 (8.2%)
  dominion     won 1.66 of 4.91 fought   win rate 33.5%
  safeguard    won 2.53 of 4.97 fought   win rate 50.9%
  eradication  won 1.72 of 4.74 fought   win rate 35.6%
  victory points earned per run: 53.0   spent: 41.8
  warband size at the end: 6.80 (started 6)
  formations carrying a refit at the end: 4.38
  widen        won 2.02 of 4.99 fought   win rate 40.4%
  patch        won 2.23 of 4.68 fought   win rate 46.6%
  refit        won 1.51 of 4.90 fought   win rate 30.3%
  cheapest     won 1.56 of 4.82 fought   win rate 31.7%
  dearest      won 1.79 of 4.93 fought   win rate 36.5%

RUN VERDICT
  PASS  a run is a spread rather than pass-or-fail (6 of 6 outcomes reached)
  PASS  both endings happen (8.2% of armies break)
  PASS  which disposition you run matters, without deciding it (17.4% apart on win rate)
  PASS  how long an army lasts depends on how it fights (dominion 0.44, safeguard 0.33, eradication 0.64 lost per engagement)
  PASS  the reward you take changes the run (16.4% apart on win rate)
  PASS  formations get refitted rather than only replaced (77.5% of runs ended carrying at least one)
  PASS  what you score turns into an army, wider or deeper (11.18 formations-plus-refits from 6, 77.3% of runs ended ahead)
  PASS  the purse is spent rather than hoarded (0.0% of runs left 7+ points unspent at the last shelf)
  PASS  preserving the army pays across a run (SAFEGUARD lasts 4.97 battles v 4.84 for the rest)

PAIRINGS — 15120 list-and-deployment pairs, each resolved with the layer and without it
  deployments that formed at least one pairing: 8076 of 15120
  deployments the layer changed: 3016   better off 2759   worse off 257
  LOCKED SHIELDS  formed by  2220 deployments   win 11.0%   better off in 373
  RANGING PAIR    formed by   335 deployments   win 9.3%   better off in 26
  BURN AND BREAK  formed by  1470 deployments   win 13.9%   better off in 79
  DUG IN          formed by  3660 deployments   win 60.0%   better off in 2313
  WOLF PAIR       formed by  1260 deployments   win 24.7%   better off in 186
  FIELD HOSPITAL  formed by  1260 deployments   win 93.3%   better off in 1030

PAIRING VERDICT
  PASS  every pairing is reachable (6 of 6 fired for some deployment)
  PASS  the layer changes battles rather than decorating them (3016 deployments resolved differently)
  PASS  standing together is a trade, not a bonus (257 deployments did worse for it)
  PASS  no pairing wins on its own (none always wins)
  PASS  a pairing is something you have to build for (7044 formed none)

THE ENEMY — the same 1080 policies against the control enemy and against the one the game ships
  battles won per run: control 1.82   varied 2.55
  runs the enemy changed: 883 of 1080
  faced eradication   2545 engagements   player won 75.2%
  faced dominion      2537 engagements   player won 33.0%

ENEMY VERDICT
  PASS  which enemy you drew changes the run (883 of 1080 ran differently)
  PASS  the enemy declares more than one way to win (eradication, dominion)
  PASS  no enemy declaration is a free win (best is 75.2%)
  PASS  no enemy declaration is an unloseable wall (worst is 33.0%)

THE GROUND — 756 list-and-plan pairs, each fought on the Circuit and on a flat plain
  results the ground changed: 674   outcomes it flipped: 123
  trapline       on the ground  86.5%   on a flat plain  88.9%
  spear          on the ground   5.6%   on a flat plain  17.5%
  pressure       on the ground  78.6%   on a flat plain  52.4%
  home-line      on the ground  72.2%   on a flat plain  71.4%
  tight-shell    on the ground   0.0%   on a flat plain   0.0%
  counterweight  on the ground  69.0%   on a flat plain  44.4%

GROUND VERDICT
  PASS  the ground changes the battle (674 of 756 resolved differently)
  PASS  and changes who wins it, not only by how much (123 outcomes flipped)
  PASS  every kind of ground is actually on the board (broken, cover, blocking)
  PASS  the ground reorders the plans (5 of 6 moved)
  PASS  it does not decide the whole game on its own (4 plans work on both)
```
