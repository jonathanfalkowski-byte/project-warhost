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
  BREAK THE CIRCUIT  win  44.0%   vs IRON PROCESSION
  THE NARROWS        win  33.6%   vs SALT COVENANT
  dominion     win  37.7%   best strategy trapline 54.4%   worst spear 13.4%
  safeguard    win  55.3%   best strategy home-line 84.5%   worst tight-shell 21.0%
  eradication  win  32.2%   best strategy decapitate 48.0%   worst headhunt 24.1%
  voidbreaker      SCRAPBORN PLATE  win  46.3%
  ordo-praesidium  RANGING OATH     win  32.5%
  hollowjaw        JAWS FIRST       win  37.6%
  best disposition by list: eradication 507, dominion 101, safeguard 274

DOCTRINE VERDICT
  PASS  every strategy wins for some army (none dead)
  PASS  every disposition is the best answer for some army (none missing)
  PASS  no disposition always wins and none never wins (55.3% to 32.2%)
  PASS  dispositions are within 50 points of each other (23.1% apart)
  PASS  no strategy is an auto-win (best is safeguard/home-line at 84.5%)
  PASS  no detachment rule dominates (voidbreaker 46.3%, hollowjaw 37.6%, ordo-praesidium 32.5%)
  PASS  every plan travels between boards (none board-locked)
  PASS  the two boards are comparably winnable (circuit-clash 44.0%, narrows 33.6%)
  PASS  detachments gate different dispositions (voidbreaker: dominion/safeguard  ordo-praesidium: dominion/eradication  hollowjaw: dominion/eradication)

RUNS — 1080 runs (12 seeds x every detachment, disposition, plan and spending rule)
  NOTE: exhaustive over policies, sampled over seeds. Every other axis above resolves its space in full.
  NOTE: fought against the CONTROL enemy, so what changes is only what the player chose.
  battles won 0..5: 0:305  1:209  2:156  3:222  4:67  5:121
  armies broken before the ladder ended: 73 (6.8%)
  dominion     won 1.73 of 4.90 fought   win rate 35.0%
  safeguard    won 2.64 of 4.99 fought   win rate 52.8%
  eradication  won 1.81 of 4.78 fought   win rate 36.8%
  victory points earned per run: 53.3   spent: 42.4
  warband size at the end: 9.52 (started 6)
  formations carrying a refit at the end: 3.56
  widen        won 1.98 of 4.99 fought   win rate 39.6%
  patch        won 2.20 of 4.68 fought   win rate 45.9%
  refit        won 1.81 of 4.84 fought   win rate 36.3%
  cheapest     won 1.65 of 4.86 fought   win rate 33.1%
  dearest      won 1.89 of 5.00 fought   win rate 37.9%

RUN VERDICT
  PASS  a run is a spread rather than pass-or-fail (6 of 6 outcomes reached)
  PASS  both endings happen (6.8% of armies break)
  PASS  which disposition you run matters, without deciding it (17.8% apart on win rate)
  PASS  how long an army lasts depends on how it fights (dominion 0.42, safeguard 0.34, eradication 0.59 lost per engagement)
  PASS  the reward you take changes the run (12.8% apart on win rate)
  PASS  formations get refitted rather than only replaced (68.6% of runs ended carrying at least one)
  PASS  what you score turns into an army, wider or deeper (13.09 formations-plus-refits from 6, 86.4% of runs ended ahead)
  PASS  the purse is spent rather than hoarded (0.0% of runs left 7+ points unspent at the last shelf)
  PASS  preserving the army pays across a run (SAFEGUARD lasts 4.99 battles v 4.85 for the rest)

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
  battles won per run: control 1.91   varied 2.56
  runs the enemy changed: 892 of 1080
  faced eradication   2560 engagements   player won 75.4%
  faced dominion      2558 engagements   player won 32.8%

ENEMY VERDICT
  PASS  which enemy you drew changes the run (892 of 1080 ran differently)
  PASS  the enemy declares more than one way to win (eradication, dominion)
  PASS  no enemy declaration is a free win (best is 75.4%)
  PASS  no enemy declaration is an unloseable wall (worst is 32.8%)

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
```
