// The battle-round game, as a screen.
//
// Deliberately plain: five deployment slots, a target for each, commit, then watch the
// five rounds. The operation screen grew to twenty information regions and became
// unreadable; this one shows the board, the army, and the score, and nothing else until
// there is something to say.

import { useEffect, useMemo, useState } from "react";

import { FORMATIONS } from "../formationData.js";
import { BATTLE_PROFILES, OBJECTIVE_CONTROL_RANGE, statLineFor } from "./battleProfiles.js";
import { armyFor, buildEnemyForce, buildPlayerForce, missionFor, missionList } from "./battleMission.js";
import { TERRAIN_KINDS, terrainFor } from "./battleTerrain.js";

// Enough to tell a warband's worth of the same hull apart. Roman rather than "2", because
// "MAIN BATTLE TANK 2" reads as a mark number and these are two of the same mark.
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
import { resolveBattle } from "./battleRules.js";
import { DETACHMENTS, RESERVE_PREMIUM, detachmentFor, detachmentList, scoutedPool, stratagemFor } from "./stratagems.js";
import { dispositionFor, dispositionsFor, liveSitesFor } from "./doctrine.js";
import { afterActionFor, headlineFor, pairingLinksFor, roundPanelFor, supportLinksFor } from "./afterAction.js";
import { profileWithRefit, refitFor } from "./refits.js";
import { SYNERGY_COUNT, leadsFor } from "./synergies.js";
import { MENDS } from "./market.js";
import {
  MINIMUM_FORCE, advance as advanceRun, applyBattle, buy, engagementFor, fieldableFrom,
  honourFor, offersFor, repair, retire, runSummary, startRun, takeRoute,
} from "./campaign.js";
import { planFor, plansFor, routeDestinationFor, routePointsFor } from "./battlePlans.js";

// Long enough to read the round's shooting and see the markers move, short enough that a
// whole battle plays out in well under a minute.
const ROUND_DURATION_MS = 2600;

export default function BattleApp({ onExit }) {
  // The run. A campaign is the frame the battles sit in: the board, the enemy and how much
  // it is holding all come from the ladder, and what is left of your army comes from the
  // last fight. `null` is the muster screen, before a run has started.
  const [run, setRun] = useState(null);
  const [phase, setPhase] = useState("muster");
  const [deployment, setDeployment] = useState({});
  const [round, setRound] = useState(0);
  const [committed, setCommitted] = useState(false);
  // It is an autobattler: once the army is committed the battle plays itself. The player
  // can pause to read a round or step back through it, but doing nothing must still show
  // the whole battle.
  const [playing, setPlaying] = useState(true);
  // Which stratagem is committed to which round: { brace: 3 }. Choosing the round is the
  // decision — "the command seal at the right place and time".
  const [commitments, setCommitments] = useState({});
  // The card kept back rather than committed, and the one that was actually spent that way.
  // Held costs a command point more; unspent, it costs nothing at all.
  const [reserve, setReserve] = useState(null);
  const [spentLive, setSpentLive] = useState(null);
  // Detachment -> disposition -> strategy. Declared in that order because each one
  // narrows the next: the detachment says what you may declare, the disposition says how
  // you score, and the strategy is one of three authored plans for scoring that way.
  const [detachmentId, setDetachmentId] = useState("voidbreaker");
  const [seed, setSeed] = useState(1);
  const [dispositionId, setDispositionId] = useState(DETACHMENTS.voidbreaker.dispositions[0]);
  const [strategyId, setStrategyId] = useState(plansFor(DETACHMENTS.voidbreaker.dispositions[0])[0].id);

  // Everything derived from the selections, declared before any hook reads it — the
  // mission decides the board, the board decides the enemy, and the enemy decides which
  // detachment it is fighting under.
  const engagement = run ? engagementFor(run) : null;
  const mission = engagement ? engagement.mission : missionFor("circuit-clash");
  const army = engagement ? engagement.army : armyFor("circuit-clash");
  const ENEMY_DETACHMENT = detachmentFor(army.detachment);
  const detachment = detachmentFor(detachmentId);
  const disposition = dispositionFor(dispositionId);
  const battlePlan = planFor(dispositionId, strategyId);
  const enemyDisposition = dispositionFor(army.disposition);
  // HOW MANY YOU MAY FIELD. Every road into an engagement offers the same board; one of
  // them costs you a deployment position, which is the only way a harder road can be
  // harder while both armies have five. Everything that reads the deployment reads this.
  const slots = mission.playerDeployment.slice(0, engagement?.slots ?? mission.playerDeployment.length);

  useEffect(() => {
    if (!committed || !playing || round >= mission.rounds) return undefined;
    const timer = setTimeout(() => setRound((value) => Math.min(mission.rounds, value + 1)), ROUND_DURATION_MS);
    return () => clearTimeout(timer);
  }, [committed, playing, round, mission]);

  // The engagement builds its own enemy — a detachment, a disposition it declared, a plan
  // from that disposition and a list chosen to walk it. Rebuilding one here would show the
  // player a different army than the one they are about to fight.
  const enemy = useMemo(
    () => engagement?.foe ?? buildEnemyForce(mission, army),
    [engagement, mission, army],
  );
  const playerStratagems = useMemo(() => Object.entries(commitments)
    .filter(([, value]) => Number.isFinite(value))
    .map(([id, value]) => ({ id, round: value })), [commitments]);
  const enemyHand = engagement ? engagement.enemyHand : [];
  const commandPoints = run ? run.commandPoints : detachment.commandPoints;
  const budget = (() => {
    const chosen = Object.keys(commitments).filter((id) => Number.isFinite(commitments[id]));
    const committedCost = chosen.reduce((sum, id) => sum + (stratagemFor(id)?.cost ?? 0), 0);
    // A card in reserve is charged at its price plus the premium the moment it is held, so
    // nobody can hold what they could not afford to spend. Never spent, it is refunded —
    // `commandSpent` is what actually fired.
    const heldCost = reserve ? (stratagemFor(reserve)?.cost ?? 0) + RESERVE_PREMIUM : 0;
    const premium = spentLive ? RESERVE_PREMIUM : 0;
    const spent = committedCost + premium;
    return { spent, held: heldCost, remaining: commandPoints - spent - heldCost };
  })();
  // The strategy sets every slot's objective; a slot the player has explicitly changed
  // keeps its override. The plan is the opening position of the argument, not the end of
  // it — the sweep says orders swing the battle by 20 victory points, so overriding one
  // has to stay possible.
  const planned = useMemo(() => {
    const next = {};
    slots.forEach((slot, index) => {
      const entry = deployment[slot.id];
      if (!entry?.formationId) return;
      // Matched on the INSTANCE. Keyed on the formation, a warband holding two railjacks
      // deployed both of them carrying the first one's damage — the shot-up one and the
      // fresh one fought as two copies of whichever came first in the roster.
      const carried = run?.roster.find((item) => item.id === entry.id);
      next[slot.id] = {
        ...entry,
        objectiveId: entry.objectiveId ?? undefined,
        wounds: Number.isFinite(carried?.wounds) ? carried.wounds : undefined,
        refit: carried?.refit ?? entry.refit ?? null,
      };
    });
    return next;
  }, [deployment, mission, run]);
  const player = useMemo(
    // `slots.length` rather than the board's positions, so a road that costs one is a lane
    // the plan loses rather than a lane it quietly redistributes.
    () => buildPlayerForce({ mission, deployment: planned, formations: FORMATIONS, battlePlan, positions: slots.length }),
    [planned, battlePlan, mission, slots.length],
  );
  const result = useMemo(() => resolveBattle({
    playerUnits: player.units,
    enemyUnits: enemy.units,
    objectives: mission.objectives,
    playerOrders: player.orders,
    enemyOrders: enemy.orders,
    rounds: mission.rounds,
    playerStratagems,
    enemyHand,
    playerPaths: player.paths,
    enemyPaths: enemy.paths,
    playerDisposition: dispositionId,
    enemyDisposition: army.disposition,
    playerDetachmentRule: detachment.rule,
    enemyDetachmentRule: ENEMY_DETACHMENT.rule,
    // The ground. Without it the battle is resolved on a flat plain and the terrain the
    // player can see drawn on the board does nothing, which is the game lying to them.
    missionId: mission.id,
  }), [player, enemy, playerStratagems, enemyHand, dispositionId, detachment, mission, army]);

  // Counted across the slots this engagement actually offers: a road that costs you a
  // deployment position must not be satisfied by a formation standing in a position that
  // is not on the board.
  const placed = slots.filter((slot) => deployment[slot.id]?.formationId).length;
  // The warband as it can be fielded, with two of the same hull told apart. Two markers
  // both reading MAIN BATTLE TANK is unreadable on the board, in the debrief and in the
  // deploy list — and every one of those reads the NAME, not the id.
  const fieldable = useMemo(() => {
    const source = run ? fieldableFrom(run) : FORMATIONS.map((formation, index) => ({
      id: `${formation.id}#${index}`, formationId: formation.id, name: formation.name, wounds: null, refit: null,
    }));
    const counts = source.reduce((acc, entry) => {
      acc[entry.formationId] = (acc[entry.formationId] ?? 0) + 1;
      return acc;
    }, {});
    const seen = {};
    return source.map((entry) => {
      if (counts[entry.formationId] < 2) return entry;
      seen[entry.formationId] = (seen[entry.formationId] ?? 0) + 1;
      return { ...entry, name: `${entry.name} ${NUMERALS[seen[entry.formationId] - 1] ?? seen[entry.formationId]}` };
    });
  }, [run]);

  // Which INSTANCES are already placed. Keyed on the formation, a warband holding two
  // railjacks could only ever field one of them: placing the first greyed out the second.
  const used = new Set(Object.values(deployment).map((entry) => entry?.id).filter(Boolean));
  const view = committed && round > 0 ? result.rounds[round - 1] : null;

  // SPENDING THE RESERVE, mid-battle, into the round after the one on screen. The battle is
  // deterministic and the card fires later than anything already watched, so re-resolving
  // replays the rounds behind you exactly as they were and only the rest of the battle
  // changes. That is the whole trick that lets an autobattler take a decision in flight.
  const spendReserve = () => {
    if (!reserve || round >= mission.rounds) return;
    const card = reserve;
    setSpentLive(card);
    setReserve(null);
    setCommitments((current) => ({ ...current, [card]: round + 1 }));
  };

  const commitTo = (id, value) => setCommitments((current) => {
    const next = { ...current };
    if (!Number.isFinite(value)) delete next[id];
    else next[id] = value;
    return next;
  });

  // The run's turn of the crank: what the battle did to the army, then field repair, then
  // the choice, then the next engagement. Every step is a pure function of the run, so a
  // run can be replayed from its seed and the choices made in it.
  const pressOn = () => {
    // THE INSTANCE, not the formation. `applyBattle` matches the roster on instance ids —
    // it has to, or one of two railjacks dying strikes off both — so handing it formation
    // ids matched nothing: no formation was ever damaged, none was ever lost, and an army
    // that cannot be hurt makes the repairs in the market unbuyable and the run unloseable.
    const deployedIds = Object.values(planned).map((entry) => entry?.id).filter(Boolean);
    const after = applyBattle({
      run, result, deployedIds, won: result.winner === "player", disposition: dispositionId,
      commandSpent: budget.spent,
      // What the enemy will have read by the next engagement: the formation in each slot,
      // and the plan it walked. Ordered by SLOT, because where a hull stood is half of
      // what there is to read.
      fielded: slots.map((slot) => planned[slot.id]?.formationId ?? null),
      planId: strategyId,
    });
    setRun(after.status === "active" ? repair(after) : after);
    setPhase(after.status === "active" ? "reward" : "over");
    setCommitted(false);
    setRound(0);
  };

  // Buying does not leave the market — you spend until you are done or out of points, and
  // then move on. A shelf you are thrown off after one purchase is not a market.
  const purchase = (offerId) => setRun(buy({ run, offerId }));
  // Repairs are bought against a NAMED hull, from the row that hull is already on. A
  // shelf button that patched "the worst-off formation" was making the decision for you,
  // and with a dozen hulls in the warband it is a decision worth making: the wreck you
  // are about to deploy is not always the wreck with the fewest wounds left.
  const mend = (offerId, targetId) => setRun(buy({ run, offerId, targetId }));

  const marchOn = () => {
    setRun(advanceRun(run));
    setDeployment({});
    setCommitments({});
    setReserve(null);
    setSpentLive(null);
    setPhase("deploy");
  };

  const beginRun = () => {
    const started = startRun({ detachmentId, seed });
    setRun(started);
    setPhase("deploy");
    setDeployment({});
    setCommitments({});
    setReserve(null);
    setSpentLive(null);
    setCommitted(false);
    setRound(0);
    setDispositionId(detachmentFor(detachmentId).dispositions[0]);
    setStrategyId(plansFor(detachmentFor(detachmentId).dispositions[0])[0].id);
  };

  const setSlot = (slotId, patch) => setDeployment((current) => ({
    ...current,
    [slotId]: { ...current[slotId], ...patch },
  }));

  // Declaring a disposition throws away the strategy and every per-slot objective override
  // with it, because both were answers to a question that has just changed. What it keeps
  // is WHO is standing in each slot: stripping the entry back to its formation dropped the
  // instance — the id, the name, the damage and the refit — so declaring emptied every slot
  // on screen and deployed hulls the run does not own.
  const muster = (nextDetachmentId) => {
    const next = detachmentFor(nextDetachmentId);
    setDetachmentId(nextDetachmentId);
    setCommitments({});
    setReserve(null);
    // Everything below the detachment is an answer to a question it just changed.
    const nextDisposition = next.dispositions.includes(dispositionId) ? dispositionId : next.dispositions[0];
    setDispositionId(nextDisposition);
    setStrategyId(plansFor(nextDisposition)[0].id);
    setDeployment((current) => Object.fromEntries(Object.entries(current)
      .map(([slotId, entry]) => [slotId, { ...entry, objectiveId: undefined }])));
  };
  const declare = (nextDispositionId) => {
    setDispositionId(nextDispositionId);
    setStrategyId(plansFor(nextDispositionId)[0].id);
    setDeployment((current) => Object.fromEntries(Object.entries(current)
      .map(([slotId, entry]) => [slotId, { ...entry, objectiveId: undefined }])));
  };
  const adopt = (nextStrategyId) => {
    setStrategyId(nextStrategyId);
    setDeployment((current) => Object.fromEntries(Object.entries(current)
      .map(([slotId, entry]) => [slotId, { ...entry, objectiveId: undefined }])));
  };

  // Where every marker sits right now: deployment positions before commit, the round's
  // recorded positions after.
  const markers = view
    ? [
      ...view.players.map((unit) => ({ ...unit, side: "player" })),
      ...view.enemies.map((unit) => ({ ...unit, side: "enemy" })),
    ]
    : [
      ...player.units.map((unit) => ({ ...unit, side: "player", wounds: unit.wounds, maxWounds: unit.maxWounds })),
      ...enemy.units.map((unit) => ({ ...unit, side: "enemy", wounds: unit.wounds, maxWounds: unit.maxWounds })),
    ];
  // The shelf, and the two things on it that need a hull named first. Splitting them is
  // the whole of the change: everything you buy for the warband as a whole stays on the
  // shelf, and everything you buy FOR a formation is bought on that formation's row.
  const offers = run ? offersFor(run) : [];
  const mends = offers.filter((offer) => offer.kind === "service" && MENDS.includes(offer.id));
  const shelf = offers.filter((offer) => !mends.includes(offer));
  // The stat line behind each marker, keyed by side and instance. Read from the FORCES
  // rather than from the round record: the record carries where a unit is and how shot it
  // is, not what it can do, and the player's numbers have to be read through whatever
  // refit that particular hull is carrying.
  const profiles = new Map([
    ...player.units.map((unit) => [`player:${unit.id}`, unit]),
    ...enemy.units.map((unit) => [`enemy:${unit.id}`, unit]),
  ]);
  const scored = view ? view.objectives : null;
  const battleLog = view ? view.log.filter((entry) => entry.phase !== "stratagem") : [];
  // What each formation actually did, measured against what the declared disposition was
  // scoring for. Only worth computing once the battle is over.
  const debrief = committed && round >= mission.rounds
    ? afterActionFor({ result, objectives: mission.objectives, disposition: dispositionId })
    : null;
  // Which markers pay the player at all under the disposition they declared. Declaring is
  // a commitment: ERADICATION darkens every marker on the board, SAFEGUARD darkens
  // everything past your own half and doubles what is left. The board changing when you
  // choose is the clearest statement of what you are now playing for.
  const live = new Map(liveSitesFor({ disposition: dispositionId, side: "player", objectives: mission.objectives })
    .map((objective) => [objective.id, objective]));
  // WHAT A MARKER PAYS THE SIDE STANDING ON IT, which is not its face value and is not the
  // same question for both armies. `scoreObjectives` reports raw control and the marker's
  // printed points, because that is all a control check knows; what the holder is actually
  // paid is decided by the holder's OWN declaration. An enemy on ERADICATION darkens every
  // marker on the board, so it can sit on your ground for five rounds and score nothing for
  // it — and the round panel was crediting it the face value anyway, which reads as losing
  // ground you are not losing. Both sides are resolved here, each through its own rule.
  // Rows for the round panel, already told what each marker paid the side holding it. The
  // derivation lives in afterAction.js so it can be tested and mutated; nothing computed
  // inside this component can be reached by either.
  const panelRows = roundPanelFor({
    round: view,
    objectives: mission.objectives,
    playerDisposition: dispositionId,
    enemyDisposition: army.disposition,
  });

  return (
    <main className="battle-app">
      <header className="battle-header">
        <div>
          <p className="eyebrow">
            WARHOST{run ? ` · ENGAGEMENT ${Math.min(run.battle, engagement?.of ?? 5)} OF ${engagement?.of ?? 5} · ${fieldableFrom(run).length} STANDING · ${run.purse} VP · ${run.commandPoints} CP` : " · MUSTER"}
          </p>
          <h1>{mission.name}</h1>
          <small>{mission.brief}</small>
        </div>
        <div className="battle-score" aria-live="polite">
          <div><span>WARHOST · {disposition.name}</span><b>{view ? view.playerScore : 0}</b></div>
          <em>{view ? `ROUND ${view.round} / ${mission.rounds}` : "DEPLOYMENT"}</em>
          <div><span>HELIOCH · {enemyDisposition.name}</span><b>{view ? view.enemyScore : 0}</b></div>
        </div>
        {onExit && <button type="button" className="battle-exit" onClick={onExit}>OPERATION MODE</button>}
      </header>

      <div className="battle-body">
        <section className="battle-board" aria-label="Battlefield">
          <div className="battle-zone battle-zone-enemy"><span>HELIOCH OATH DEPLOYMENT</span></div>
          <div className="battle-zone battle-zone-player"><span>WARHOST DEPLOYMENT</span></div>

          {/* THE GROUND. Drawn first, under everything, and drawn at all — terrain the player
              cannot see is the game keeping a rule to itself, and this one decides which
              lane is fast, which marker is safe to stand on and what can be shot from where.
              Named on the board rather than only coloured, because three kinds of circle is
              a legend to memorise and a label is not. */}
          {terrainFor(mission.id).map((feature) => (
            <div
              key={feature.id}
              className={`battle-terrain battle-terrain-${feature.kind}`}
              style={{
                left: `${feature.x}%`,
                top: `${feature.y}%`,
                width: `${feature.radius * 2}%`,
                height: `${feature.radius * 2}%`,
              }}
            >
              <span>{feature.name}</span>
            </div>
          ))}

          {/* The plan, drawn — yours only. The enemy's DEPLOYMENT is visible because you can
              see an army lined up across a table; its ROUTES are not, because knowing
              exactly where five formations will walk before committing hands the player
              too much, and none of it survives contact with an asymmetric opponent. You
              are told its intent in words and shown where it starts. */}
          {/* Who is shooting whom. Watching five rounds of markers slide around in silence was
              the single biggest reason the battle read as confirmation rather than as a
              fight — the log said who fired on whom and the board never did. Every shot,
              every overwatch and every melee in the round being shown is drawn from the
              positions that round actually recorded. */}
          {view && (
            <svg className="battle-fire" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {(() => {
                const at = new Map(markers.map((unit) => [unit.name, unit]));
                // Support first, so fire draws over it. A REPAIR formation patching a
                // friend instead of shooting used to draw nothing at all, which read as a
                // formation doing nothing — "do the armoured recovery vehicle and whatever
                // is below it not fire?" It was repairing. Now it says so.
                const support = [...pairingLinksFor({ round: view }), ...supportLinksFor({ players: view.players })].map((link, index) => {
                  const from = at.get(link.from);
                  const to = at.get(link.to);
                  if (!from || !to) return null;
                  return (
                    <line
                      key={`support-${link.kind}-${link.from}-${link.to}-${index}`}
                      className={`battle-support battle-support-${link.kind}`}
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    />
                  );
                });
                return support.concat(view.log
                  .filter((entry) => entry.phase !== "stratagem")
                  .map((entry, index) => {
                    const from = at.get(entry.actor);
                    const to = at.get(entry.target);
                    if (!from || !to) return null;
                    return (
                      <line
                        key={`${entry.actor}-${entry.target}-${index}`}
                        className={`battle-shot battle-shot-${entry.side} ${entry.phase === "fight" ? "melee" : ""} ${entry.phase === "repair" ? "repair" : ""}`}
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        style={{ "--weight": Math.min(4, 0.6 + entry.amount / 3) }}
                      />
                    );
                  }));
              })()}
            </svg>
          )}

          {!committed && (
            <svg className="battle-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {slots.map((slot, index) => {
                // A staffed slot is drawn walking the route the FORCE says it walks — the
                // same object the battle resolves from, so the drawn plan cannot disagree
                // with the fought one now that a plan redistributes by army size. An empty
                // slot is drawn at full strength, as what the plan would ask of it.
                const walking = player.units.find((unit) => unit.x === slot.x && unit.y === slot.y);
                const route = walking && player.paths[walking.id]
                  ? player.paths[walking.id]
                  : routePointsFor(battlePlan, index, mission.id, false, slots.length);
                if (route.length === 0) return null;
                const filled = Boolean(deployment[slot.id]?.formationId);
                return (
                  <polyline
                    key={`player-route-${slot.id}`}
                    className={`battle-route battle-route-player ${filled ? "staffed" : ""}`}
                    points={[slot, ...route].map((point) => `${point.x},${point.y}`).join(" ")}
                  />
                );
              })}
            </svg>
          )}

          {mission.objectives.map((objective) => {
            const held = scored?.find((entry) => entry.objectiveId === objective.id);
            const site = live.get(objective.id);
            return (
              <div
                key={objective.id}
                className={`battle-objective ${held ? `held-${held.holder}` : ""} ${site ? "" : "dark"}`}
                style={{ left: `${objective.x}%`, top: `${objective.y}%`, "--control": `${OBJECTIVE_CONTROL_RANGE * 2}%` }}
              >
                <i aria-hidden="true" />
                <b>{objective.name}</b>
                <small>
                  {site ? `${site.points} VP` : "NO SCORE"}
                  {held ? ` · ${held.holder.toUpperCase()}` : ""}
                </small>
              </div>
            );
          })}

          {markers.map((unit) => {
            const profile = profiles.get(`${unit.side}:${unit.id}`);
            const standing = unit.wounds <= 0
              ? "DESTROYED"
              : unit.wounds >= unit.maxWounds
                ? "FULL STRENGTH"
                : `${Number(unit.wounds.toFixed(1))} OF ${unit.maxWounds} WOUNDS`;
            // A card 208 wide, hung off a marker standing on the touchline, is a card with
            // half of it outside a board that clips what it cannot fit. Near an edge it
            // hangs inwards instead.
            const edge = unit.x > 76 ? "edge-right" : unit.x < 24 ? "edge-left" : "";
            const line = profile ? statLineFor(profile) : null;
            return (
              <div
                key={`${unit.side}-${unit.id}`}
                className={`battle-unit battle-unit-${unit.side} ${unit.wounds <= 0 ? "destroyed" : ""} ${edge}`}
                style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
                /* Reachable by keyboard, not only by pointer: a card that only exists under
                   a mouse is information only some players have. The label carries what the
                   card shows, so a screen reader gets the profile from the marker itself
                   and the card can be hidden from it rather than read out twice. */
                tabIndex={0}
                aria-label={`${unit.name} — ${standing}${line ? `. ${line}` : ""}`}
              >
                <b>{unit.name}</b>
                <i aria-hidden="true"><em style={{ width: `${Math.max(0, 100 * unit.wounds / unit.maxWounds)}%` }} /></i>
                {/* WHAT IT CAN DO, not what it is holding. The profile is public in any
                    wargame — you can read your opponent's army list off the table — and
                    hiding it only meant guessing whether the thing walking at you outranges
                    you. What stays hidden is the hand — what they are holding and when they
                    will spend it — because that is the only uncertainty this game has. */}
                <span className="battle-unit-card" aria-hidden="true">
                  <span className="battle-unit-card-name">{unit.name}</span>
                  {line && <span className="battle-unit-stats">{line}</span>}
                  <span className="battle-unit-card-state">{standing}</span>
                  {profile?.note && <span className="battle-unit-card-note">{profile.note}</span>}
                </span>
              </div>
            );
          })}
          {/* A pairing NAMED on the board, not just drawn. The line between the two hulls is
              close to useless on its own: a pairing only forms when they are within ten
              units of each other, so the two markers are usually on top of one another and
              the line has no length to see. The badge sits between them and says what it is. */}
          {view && pairingLinksFor({ round: view }).map((link, index) => {
            const from = markers.find((unit) => unit.name === link.from);
            const to = markers.find((unit) => unit.name === link.to);
            if (!from || !to) return null;
            return (
              <div
                key={`pairing-${link.name}-${index}`}
                className="battle-pairing"
                style={{ left: `${(from.x + to.x) / 2}%`, top: `${(from.y + to.y) / 2}%` }}
              >
                {link.name}
              </div>
            );
          })}
        </section>

        <aside className="battle-rail">
          {phase === "muster" ? (
            <>
              <h2>MUSTER</h2>
              <p className="battle-hint">
                Five engagements, and the same army fights all of them. What it loses it does not get
                back, and the victory points it scores are what it has to spend on replacing them.
                Choose the detachment you want to spend the whole run as — it cannot be changed once
                the run starts.
              </p>
              {detachmentList().map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className={`battle-muster ${detachmentId === entry.id ? "chosen" : ""}`}
                  onClick={() => setDetachmentId(entry.id)}
                >
                  <b>{entry.name}</b>
                  <em>{entry.rule.name} — {entry.rule.text}</em>
                  <small>{entry.summary}</small>
                  <small className="battle-gates">DECLARES {entry.dispositions.map((id) => dispositionFor(id).name).join(" or ")}</small>
                </button>
              ))}
              <label className="battle-seed">
                <span>WARBAND</span>
                <select value={seed} onChange={(event) => setSeed(Number(event.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                    <option key={value} value={value}>WARBAND {value}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="battle-commit" onClick={beginRun}>BEGIN THE RUN</button>
            </>
          ) : phase === "over" ? (
            <>
              <h2>{run.status === "complete" ? "THE RUN IS OVER" : "THE ARMY IS BROKEN"}</h2>
              {(() => {
                const summary = runSummary(run);
                return (
                  <>
                    <div className={`battle-result ${run.status === "complete" ? "player" : "enemy"}`}>
                      <span>{run.status === "complete" ? "IT REACHED THE END OF THE LADDER" : `IT COULD NOT FIELD ${MINIMUM_FORCE} FORMATIONS`}</span>
                      <b>{summary.won} / {summary.fought}</b>
                      <small>battles won of {summary.fought} fought, out of {summary.of} on the ladder.</small>
                      <small>{summary.earned} victory points earned, {summary.spent} spent. The warband ended {summary.rosterSize} strong.</small>
                    </div>
                    <ol className="battle-run-log">
                      {run.history.map((entry) => (
                        <li key={entry.battle} className={entry.won ? "won" : "lost"}>
                          <b>{entry.won ? "WON" : "LOST"} {entry.playerScore}–{entry.enemyScore}</b>
                          <em>+{entry.earned} VP · {entry.lost.length > 0 ? `lost ${entry.lost.join(", ")}` : "no losses"}</em>
                        </li>
                      ))}
                    </ol>
                    <button type="button" className="battle-commit" onClick={() => { setRun(null); setPhase("muster"); }}>MUSTER AGAIN</button>
                  </>
                );
              })()}
            </>
          ) : phase === "reward" ? (
            <>
              <h2>
                THE MARKET
                <em className="battle-state">{run.purse} VP</em>
              </h2>
              <p className="battle-hint">
                The engagement paid {run.history.at(-1)?.earned ?? 0} victory points
                {run.history.at(-1)?.regained > 0
                  ? ` and ${run.history.at(-1).regained} command point${run.history.at(-1).regained === 1 ? "" : "s"} back${run.history.at(-1).commanders > 0 ? " — a command formation came home" : ""}`
                  : ", and no command points back"}.
                Spend what you like on what you can reach, then march.
              </p>
              {run.history.at(-1)?.lost.length > 0 && (
                <div className="battle-losses">
                  <span>DID NOT COME BACK</span>
                  {run.history.at(-1).lost.map((name) => <b key={name}>{name}</b>)}
                </div>
              )}
              <div className="battle-roster">
                <div className="battle-roster-head">
                  <span>THE WARBAND</span>
                  <em>{run.roster.length} FORMATIONS · {run.commandPoints} CP</em>
                </div>
                {mends.length > 0 && (
                  <p className="battle-hint">
                    Field repair puts wounds back; a rebuild returns a formation to full strength. Buy
                    either on the row of the formation you want it done to.
                  </p>
                )}
                {run.roster.map((entry) => (
                  <div className="battle-roster-row" key={entry.id}>
                    <b>{entry.name}{entry.refit ? ` · ${refitFor(entry.refit)?.name}` : ""}</b>
                    <em>{Number.isFinite(entry.wounds) ? `${entry.wounds} WOUNDS LEFT` : "FULL STRENGTH"}</em>
                    {(entry.honours ?? []).length > 0 && (
                      <small className="battle-honours">
                        {entry.honours.map((honour) => honourFor(honour.id)?.name ?? honour.id).join(" · ")}
                        {entry.battles > 0 ? ` · ${entry.battles} ENGAGEMENT${entry.battles === 1 ? "" : "S"}` : ""}
                      </small>
                    )}
                    <span className="battle-roster-acts">
                      {/* Patch or rebuild THIS hull. Only on the damaged ones, because
                          buying either for a formation at full strength does nothing and
                          an offer that does nothing is a trap. */}
                      {Number.isFinite(entry.wounds) && mends.map((service) => (
                        <button
                          type="button"
                          key={service.id}
                          className="battle-mend"
                          disabled={!service.affordable}
                          aria-label={`${service.name} ${entry.name} for ${service.cost} victory points`}
                          onClick={() => mend(service.id, entry.id)}
                        >
                          {service.short} <span>{service.cost} VP</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="battle-retire"
                        disabled={fieldableFrom(run).length <= MINIMUM_FORCE}
                        onClick={() => setRun(retire({ run, id: entry.id }))}
                      >
                        RETIRE
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              {shelf.map((offer) => (
                <button
                  type="button"
                  className={`battle-offer ${offer.kind} ${offer.affordable ? "" : "unaffordable"}`}
                  key={offer.id}
                  disabled={!offer.affordable}
                  onClick={() => purchase(offer.id)}
                >
                  <b>{offer.name}</b>
                  <span className="battle-price">{offer.cost} VP</span>
                  <small>{offer.text}</small>
                </button>
              ))}
              {shelf.length === 0 && <p className="battle-hint">Nothing left on the shelf.</p>}
              <button type="button" className="battle-commit" onClick={marchOn}>MARCH ON →</button>
            </>
          ) : !committed ? (
            <>
              <div className="battle-doctrine">
                <div className="battle-engagement">
                  <span>ENGAGEMENT {engagement?.number} OF {engagement?.of}</span>
                  <b>{engagement?.name}</b>
                  <small>{engagement?.brief}</small>
                  <small className="battle-note">{mission.name} — {mission.brief}</small>
                </div>
                {/* WHICH ROAD IN. The run used to be a corridor — five engagements in a
                    fixed order with a shop between them — and choosing which fight to take
                    is the half of a roguelite it did not have. A route is not a different
                    battle, it is a different deal on the same one: how much of their army
                    turns up, how much they are holding, how many of yours take the field,
                    and what it pays. Taking one throws the others away. */}
                {run && engagement?.routes?.length > 1 && (
                  <div className="battle-roads">
                    <span>{run.route ? "THE ROAD YOU TOOK" : "CHOOSE YOUR APPROACH"}</span>
                    {engagement.routes.map((offer) => {
                      const taken = engagement.route.id === offer.id;
                      const settled = Boolean(run.route);
                      return (
                        <button
                          type="button"
                          key={offer.id}
                          className={`battle-road ${taken && settled ? "taken" : ""} ${settled && !taken ? "given-up" : ""}`}
                          disabled={settled}
                          onClick={() => setRun(takeRoute(run, offer.id))}
                        >
                          <b>{offer.name}</b>
                          <em>{offer.pays === 1 ? "PAYS THE RATE" : `PAYS ×${offer.pays}`}</em>
                          <small>{offer.brief}</small>
                        </button>
                      );
                    })}
                    {!run.route && <p className="battle-hint">The others are gone once you commit to one.</p>}
                  </div>
                )}
                <label>
                  <span>DETACHMENT — WHAT KIND OF ARMY</span>
                  <select value={detachmentId} onChange={(event) => muster(event.target.value)} disabled={Boolean(run)}>
                    {detachmentList().map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}</option>
                    ))}
                  </select>
                </label>
                <small className="battle-note">{detachment.summary}</small>
                <small className="battle-rule">{detachment.rule.name} — {detachment.rule.text}</small>
                <label>
                  <span>DISPOSITION — HOW YOU WIN</span>
                  <select value={dispositionId} onChange={(event) => declare(event.target.value)}>
                    {dispositionsFor(detachment).map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}</option>
                    ))}
                  </select>
                </label>
                <small className="battle-note">{disposition.summary}</small>
                <small className="battle-scoring">{disposition.scoring}</small>
                <small className="battle-board-note">{disposition.board}</small>
                <label>
                  <span>STRATEGY — HOW YOU DO IT</span>
                  <select value={strategyId} onChange={(event) => adopt(event.target.value)}>
                    {plansFor(dispositionId).map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}</option>
                    ))}
                  </select>
                </label>
                <small className="battle-note">{battlePlan?.summary}</small>
                <small className="battle-shape">{battlePlan?.shape}</small>
              </div>

              <h2>DEPLOY YOUR FIVE</h2>
              {run && (
                <div className="battle-warband">
                  <div className="battle-warband-head">
                    <span>WHAT YOU HAVE</span>
                    <em>{fieldableFrom(run).length} FIELDABLE</em>
                  </div>
                  {/* The stat line has to be readable BEFORE the choice, not after it. A
                      dropdown of names tells you nothing about what you are picking. */}
                  {fieldable.map((entry) => {
                    // Through the refit, not around it — a refitted hull that prints its
                    // factory stat line is a lie the player catches by counting shots.
                    const profile = profileWithRefit(entry.formationId, entry.refit);
                    const placed = used.has(entry.id);
                    return (
                      <div className={`battle-warband-row ${placed ? "placed" : ""}`} key={entry.id}>
                        <b>{entry.name}</b>
                        <em>{placed ? "DEPLOYED" : Number.isFinite(entry.wounds) ? `${entry.wounds} WOUNDS` : "FULL"}</em>
                        <small>{statLineFor(profile)}</small>
                        {/* What it has done, carried under the name. A warband that grows
                            from six hulls to ten and stays anonymous is a list, not an
                            army. */}
                        {(entry.honours ?? []).length > 0 && (
                          <small className="battle-honours">
                            {entry.honours.map((honour) => honourFor(honour.id)?.name ?? honour.id).join(" · ")}
                          </small>
                        )}
                        {/* On its own line and its own colour: most of a late warband carries
                            a refit now, and run together with the stats it read as more stats. */}
                        {entry.refit && <small className="battle-warband-refit">REFIT · {refitFor(entry.refit)?.name}</small>}
                      </div>
                    );
                  })}
                </div>
              )}
              {run && (
                /* FIELD NOTES. The only part of this screen the player wrote themselves.
                   Everything else — every stat, every keyword, every refit — was readable
                   before the first battle; these appeared because two hulls happened to
                   stand together. The count of what is still unrecorded is shown and what
                   it might be is not, because a list of names to go and find is a checklist
                   and the point is that you find them by playing. */
                <div className="battle-notes">
                  <div className="battle-notes-head">
                    <span>FIELD NOTES</span>
                    <em>{(run.discovered ?? []).length} OF {SYNERGY_COUNT} PAIRINGS</em>
                  </div>
                  {/* Every pairing is listed from the first muster, by name and by the two
                      keywords it wants. WHAT IT DOES is the part you find out by standing
                      them together — which keeps the moment of finding one and still gives
                      the market something to aim at. Six blank lines and a count is not a
                      secret, it is a wall: there was no way to go looking, and no way to
                      remember what you had found. */}
                  {leadsFor(run.discovered ?? []).map((lead) => {
                    const record = (run.discovered ?? []).find((entry) => entry.id === lead.id);
                    return (
                      <div className={`battle-note-row ${record ? "found" : ""}`} key={lead.id}>
                        <b>{lead.name}</b>
                        <em>{record ? `ENGAGEMENT ${record.battle}` : "UNRECORDED"}</em>
                        <small>
                          {lead.pair[0]} standing with {lead.pair[1]}
                          {record ? ` — ${record.mechanics}.` : ""}
                        </small>
                        {record && (
                          <small className="battle-note-where">
                            Found on {record.board}: {record.holder} with {record.partner}.
                          </small>
                        )}
                      </div>
                    );
                  })}
                  {(run.discovered ?? []).length === 0 && (
                    <p className="battle-notes-empty">
                      Nothing recorded yet. Each of these does something when the two stand
                      close together, and no card says what.
                    </p>
                  )}
                </div>
              )}
              <p className="battle-hint">
                The strategy decides where every slot goes. You decide who walks it — that is the
                whole deployment. Everything resolves once you commit.
              </p>
              {slots.map((slot) => {
                const entry = deployment[slot.id] ?? {};
                return (
                  <div className="battle-slot" key={slot.id}>
                    <span>{slot.name}</span>
                    <select
                      value={entry.id ?? ""}
                      onChange={(event) => {
                        const picked = fieldable.find((item) => item.id === event.target.value);
                        setSlot(slot.id, picked
                          ? { id: picked.id, formationId: picked.formationId, name: picked.name, wounds: picked.wounds, refit: picked.refit }
                          : { id: null, formationId: null });
                      }}
                      aria-label={`Formation for ${slot.name}`}
                    >
                      <option value="">— empty —</option>
                      {fieldable.map((item) => (
                        <option
                          key={item.id}
                          value={item.id}
                          disabled={used.has(item.id) && entry.id !== item.id}
                        >
                          {item.name}{Number.isFinite(item.wounds) ? ` · ${item.wounds} WOUNDS LEFT` : ""}
                        </option>
                      ))}
                    </select>
                    {/* Where the plan sends it, AND whether the disposition you declared
                        pays for that ground. Under SAFEGUARD only your own half is live and
                        every safeguard plan sends two or three slots to the flanks — so a
                        third of the army was walking to markers that score nothing, and the
                        only place the player found out was the debrief afterwards. Holding
                        it still denies them the point, which is why the plans do it, but
                        that is a thing to be told before committing, not after. */}
                    {(() => {
                      // Read off the force where there is one, for the same reason the
                      // route is: what this slot is walking to depends on how many slots
                      // are filled, and the deploy list saying otherwise is the screen
                      // lying about the battle it is about to resolve.
                      const index = slots.indexOf(slot);
                      const walking = player.units.find((unit) => unit.x === slot.x && unit.y === slot.y);
                      const destination = walking
                        ? player.orders[walking.id]
                        : routeDestinationFor(battlePlan, index, mission.objectives, mission.id, false, slots.length);
                      const objective = mission.objectives.find((entry) => entry.id === destination);
                      if (!objective) return <small className="battle-assignment">THIS SLOT HOLDS NO SCORING GROUND</small>;
                      const pays = live.has(objective.id);
                      return (
                        <>
                          <small className="battle-assignment">THE PLAN SENDS THIS SLOT TO {objective.name}</small>
                          {!pays && (
                            <small className="battle-assignment-unpaid">
                              {disposition.name} SCORES NOTHING THERE — HOLDING IT ONLY DENIES IT TO THEM
                            </small>
                          )}
                        </>
                      );
                    })()}
                    {entry.formationId && (
                      <small className="battle-profile">
                        {(() => {
                          const held = run?.roster.find((item) => item.formationId === entry.formationId);
                          const profile = profileWithRefit(entry.formationId, held?.refit);
                          return statLineFor(profile);
                        })()}
                      </small>
                    )}
                    {entry.formationId && <small className="battle-note">{BATTLE_PROFILES[entry.formationId].note}</small>}
                  </div>
                );
              })}

              {/* What the enemy declared, and what it brought to do it with. All of it is
                  shown before the player commits — the disclosure principle is unchanged;
                  the only thing hidden is still the hand. What is new is that there is
                  something to disclose: it used to declare DOMINION on both boards in every
                  run and field the front N of a fixed list. */}
              <div className="battle-enemy-brief">
                <span>{army.name} · {enemyDisposition.name}</span>
                {/* THEY READ YOU. The list they brought was built by replaying your last
                    engagement — so the screen has to say so, and say what it changed. An
                    opponent that adapts silently is not a mind game, it is difficulty
                    arriving from nowhere. What they read is the player's own last five;
                    what stays hidden is still only the hand. */}
                {engagement?.read && (() => {
                  const now = enemy.units.map((unit) => unit.id.replace(/^enemy-/, ""));
                  const was = engagement.blind ?? [];
                  const added = now.filter((id) => !was.includes(id));
                  const dropped = was.filter((id) => !now.includes(id));
                  const named = (list) => list.map((id) => FORMATIONS.find((formation) => formation.id === id)?.name ?? id.toUpperCase()).join(", ");
                  return (
                    <p className="battle-enemy-read">
                      THEY HAVE STUDIED YOUR LAST ENGAGEMENT.{" "}
                      {added.length > 0
                        ? `Against the five you fielded they have brought ${named(added)} instead of ${named(dropped)}.`
                        : "They found nothing in it worth changing their list for."}
                    </p>
                  );
                })()}
                <p>{ENEMY_DETACHMENT.rule.name} — {ENEMY_DETACHMENT.rule.text}</p>
                <p>{enemy.plan ? `${enemy.plan.name} — ${enemy.plan.summary}` : army.intent}</p>
                <p className="battle-enemy-scoring">THEY SCORE: {enemyDisposition.scoring}</p>
                <ul>
                  {enemy.units.map((unit) => (
                    <li key={unit.id}>
                      <b>{unit.name}</b>
                      <em>
                        advances on {mission.objectives.find((objective) => objective.id === enemy.orders[unit.id])?.name ?? "no scoring ground"}
                      </em>
                      {/* What it can do, beside where it is going. The board says this on
                          hover, but the deployment is decided here, and comparing five
                          profiles by pointing at five markers one at a time is not
                          comparing them. */}
                      <small>{statLineFor(unit)}</small>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="battle-strat-panel">
                <h3>
                  {detachment.name}
                  <em className={budget.remaining < 0 ? "over" : ""}>
                    {budget.remaining} / {detachment.commandPoints} CP{budget.held > 0 ? ` · ${budget.held} HELD` : ""}
                  </em>
                </h3>
                <p className="battle-hint">
                  Commit a stratagem to the round you want it to fire in. That timing is the whole
                  decision — the same card in a different round is a different battle. One card may
                  be held in reserve instead and spent while you watch, for a command point more.
                </p>
                {detachment.pool.map((id) => {
                  const stratagem = stratagemFor(id);
                  const chosen = commitments[id];
                  const unaffordable = !Number.isFinite(chosen) && stratagem.cost > budget.remaining;
                  return (
                    <div className={`battle-strat ${Number.isFinite(chosen) ? "chosen" : ""} ${unaffordable ? "unaffordable" : ""}`} key={id}>
                      <b>{stratagem.name}</b>
                      <span className="battle-strat-cost">{stratagem.cost} CP</span>
                      <small>{stratagem.text}</small>
                      <select
                        value={Number.isFinite(chosen) ? String(chosen) : reserve === id ? "reserve" : ""}
                        aria-label={`When to spend ${stratagem.name}`}
                        disabled={unaffordable}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "reserve") {
                            commitTo(id, null);
                            setReserve(id);
                            return;
                          }
                          if (reserve === id) setReserve(null);
                          commitTo(id, value ? Number(value) : null);
                        }}
                      >
                        <option value="">— not this battle —</option>
                        {Array.from({ length: mission.rounds }, (unused, index) => index + 1).map((value) => (
                          <option key={value} value={value}>SPEND IN ROUND {value}</option>
                        ))}
                        {/* One card, kept back to answer them with rather than to predict
                            them with. It costs a command point more, or holding everything
                            would always beat committing anything. */}
                        <option value="reserve" disabled={Boolean(reserve) && reserve !== id}>
                          HOLD IN RESERVE (+{RESERVE_PREMIUM} CP)
                        </option>
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="battle-scouting">
                <span>SCOUTED · {ENEMY_DETACHMENT.name}</span>
                <p>
                  They hold {enemyHand.length} of these {ENEMY_DETACHMENT.pool.length}. Which two, and when they
                  spend them, you find out on the board.
                </p>
                <ul>
                  {scoutedPool(ENEMY_DETACHMENT).map((entry) => (
                    <li key={entry.id}><b>{entry.name}</b><em>{entry.text}</em></li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                className="battle-commit"
                disabled={placed === 0 || budget.remaining < 0}
                onClick={() => { setCommitted(true); setRound(1); setPlaying(true); }}
              >
                COMMIT · {placed} / 5 DEPLOYED
              </button>
            </>
          ) : (
            <>
              <h2>
                ROUND {view?.round ?? 1}
                <em className="battle-state">{round >= mission.rounds ? "BATTLE OVER" : playing ? "RESOLVING…" : "PAUSED"}</em>
              </h2>
              {/* THE ONE DECISION LEFT IN FLIGHT. Everything else was committed before the
                  first round; this is the card you kept back to answer them with. It fires
                  in the round AFTER the one on screen, which is why the battle can be
                  re-resolved without rewriting anything already watched. */}
              {reserve && round < mission.rounds && (
                <div className="battle-reserve">
                  <span>HELD IN RESERVE</span>
                  <b>{stratagemFor(reserve)?.name}</b>
                  <small>{stratagemFor(reserve)?.text}</small>
                  <button type="button" className="battle-spend-now" onClick={spendReserve}>
                    SPEND IT INTO ROUND {round + 1}
                  </button>
                </div>
              )}
              {spentLive && (
                <p className="battle-hint">
                  {stratagemFor(spentLive)?.name} was spent from reserve, at {RESERVE_PREMIUM} command point over the committed price.
                </p>
              )}
              {view?.spends?.length > 0 && (
                <div className="battle-spends" aria-live="polite">
                  {view.spends.map((spend) => (
                    <div className={`battle-spend battle-spend-${spend.side}`} key={`${spend.side}-${spend.id}`}>
                      <span>{spend.side === "player" ? "WARHOST SPENDS" : "HELIOCH SPENDS"}</span>
                      <b>{spend.name}</b>
                      <small>{spend.text}</small>
                      {spend.outcome && <em className="battle-spend-outcome">{spend.outcome}</em>}
                    </div>
                  ))}
                </div>
              )}
              {(() => {
                // What the run already knew, plus what earlier rounds of THIS battle have
                // already shown — a pairing announces itself once, not every round it holds.
                const alreadyKnown = [
                  ...(run?.discovered ?? []).map((entry) => entry.id),
                  ...result.rounds.slice(0, Math.max(0, round - 1))
                    .flatMap((earlier) => (earlier.synergies?.player ?? []).map((found) => found.id)),
                ];
                const headline = headlineFor({
                  round: view,
                  previous: round > 1 ? result.rounds[round - 2] : null,
                  known: alreadyKnown,
                  disposition: dispositionId,
                });
                return headline ? <div className={`battle-headline ${headline.tone}`} aria-live="polite">{headline.text}</div> : null;
              })()}
              <div className="battle-gained">
                <span>ROUND {view?.round} PAID</span>
                <b className="player">WARHOST +{view?.playerGained ?? 0}</b>
                <b className="enemy">HELIOCH +{view?.enemyGained ?? 0}</b>
              </div>
              <div className="battle-objective-list">
                {panelRows.map((objective) => (
                  <div key={objective.objectiveId} className={`battle-objective-row held-${objective.holder}`}>
                    <b>{objective.name}</b>
                    <span>{objective.player} v {objective.enemy}</span>
                    <em>{objective.holder === "contested" ? "CONTESTED"
                      : objective.dark ? `${objective.holder.toUpperCase()} · PAYS NOTHING`
                        : `${objective.holder.toUpperCase()} +${objective.paid}`}</em>
                  </div>
                ))}
              </div>
              <ol className="battle-log">
                {/* Stratagem spends are already called out above the objectives, in the one
                    place a spend has to be impossible to miss. Repeating them here would be
                    the same line twice in a panel that has to stay readable. */}
                {battleLog.length ? battleLog.map((entry, index) => (
                  <li key={index} className={`log-${entry.side}`}>
                    <b>{entry.actor}</b>
                    {" "}
                    {entry.phase === "repair" ? "repairs" : entry.phase === "fight" ? "fights" : entry.phase === "overwatch" ? "overwatches" : "fires on"}
                    {" "}
                    <b>{entry.target}</b>
                    <em>{entry.amount}</em>
                  </li>
                )) : <li className="log-quiet">No unit was in range this round. Both armies are still closing.</li>}
              </ol>
              <div className="battle-controls">
                <button type="button" onClick={() => { setPlaying(false); setRound((value) => Math.max(1, value - 1)); }} disabled={round <= 1}>← BACK</button>
                {round >= mission.rounds
                  ? <button type="button" onClick={() => { setRound(1); setPlaying(true); }}>↻ REPLAY</button>
                  : <button type="button" className="battle-play" onClick={() => setPlaying((value) => !value)}>{playing ? "❚❚ PAUSE" : "▶ PLAY"}</button>}
                <button type="button" onClick={() => { setPlaying(false); setRound((value) => Math.min(mission.rounds, value + 1)); }} disabled={round >= mission.rounds}>NEXT →</button>
                {round >= mission.rounds
                  ? <button type="button" className="battle-press-on" onClick={pressOn}>PRESS ON →</button>
                  : <button type="button" onClick={() => { setCommitted(false); setRound(0); setPlaying(true); }}>REDEPLOY</button>}
              </div>
              {debrief && (
                <div className="battle-debrief">
                  <h3>WHAT EACH FORMATION DID</h3>
                  <div className="battle-standing">
                    <span>{debrief.formations.filter((entry) => entry.survived).length} CAME BACK</span>
                    <em>{debrief.formations.filter((entry) => !entry.survived).map((entry) => entry.name).join(", ") || "nothing lost"}</em>
                  </div>
                  <p className="battle-hint">
                    Share of {debrief.measure === "damage" ? "the damage your army dealt" : "the objective-rounds your army held"} —
                    measured against what {disposition.name} actually pays for.
                  </p>
                  {debrief.formations.map((entry) => (
                    <div className={`battle-contribution ${entry.survived ? "" : "lost"}`} key={entry.id}>
                      <b>{entry.name}</b>
                      <em>{entry.contribution}%</em>
                      <i style={{ width: `${entry.contribution}%` }} aria-hidden="true" />
                      <small>{entry.note}</small>
                    </div>
                  ))}
                </div>
              )}
              {round >= mission.rounds && (
                <div className={`battle-result ${result.winner}`}>
                  <span>{result.winner === "player" ? "WARHOST HOLDS THE FIELD" : result.winner === "enemy" ? "HELIOCH HOLDS THE FIELD" : "DRAWN"}</span>
                  <b>{result.playerScore} — {result.enemyScore}</b>
                  <small>{result.survivors} of {player.units.length} formations still standing.</small>
                  <small className="battle-reveal">
                    HELIOCH HELD {enemyHand.map((id) => stratagemFor(id)?.name).filter(Boolean).join(" · ") || "NOTHING"}
                  </small>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
