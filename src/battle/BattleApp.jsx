// The battle-round game, as a screen.
//
// Deliberately plain: five deployment slots, a target for each, commit, then watch the
// five rounds. The operation screen grew to twenty information regions and became
// unreadable; this one shows the board, the army, and the score, and nothing else until
// there is something to say.

import { useEffect, useMemo, useState } from "react";

import { FORMATIONS } from "../formationData.js";
import { BATTLE_PROFILES, OBJECTIVE_CONTROL_RANGE } from "./battleProfiles.js";
import { armyFor, buildEnemyForce, buildPlayerForce, missionFor, missionList } from "./battleMission.js";
import { TERRAIN_KINDS, terrainFor } from "./battleTerrain.js";
import { resolveBattle } from "./battleRules.js";
import { DETACHMENTS, detachmentFor, detachmentList, scoutedPool, stratagemFor } from "./stratagems.js";
import { dispositionFor, dispositionsFor, liveSitesFor } from "./doctrine.js";
import { afterActionFor, headlineFor, pairingLinksFor, supportLinksFor } from "./afterAction.js";
import { profileWithRefit, refitFor } from "./refits.js";
import { SYNERGY_COUNT } from "./synergies.js";
import {
  MINIMUM_FORCE, advance as advanceRun, applyBattle, buy, engagementFor, fieldableFrom,
  offersFor, repair, retire, runSummary, startRun,
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
    const spent = chosen.reduce((sum, id) => sum + (stratagemFor(id)?.cost ?? 0), 0);
    return { spent, remaining: commandPoints - spent };
  })();
  // The strategy sets every slot's objective; a slot the player has explicitly changed
  // keeps its override. The plan is the opening position of the argument, not the end of
  // it — the sweep says orders swing the battle by 20 victory points, so overriding one
  // has to stay possible.
  const planned = useMemo(() => {
    const next = {};
    mission.playerDeployment.forEach((slot, index) => {
      const entry = deployment[slot.id];
      if (!entry?.formationId) return;
      const carried = run?.roster.find((item) => item.formationId === entry.formationId);
      next[slot.id] = {
        ...entry,
        objectiveId: entry.objectiveId ?? undefined,
        wounds: Number.isFinite(carried?.wounds) ? carried.wounds : undefined,
      };
    });
    return next;
  }, [deployment, mission, run]);
  const player = useMemo(
    () => buildPlayerForce({ mission, deployment: planned, formations: FORMATIONS, battlePlan }),
    [planned, battlePlan, mission],
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

  const placed = Object.values(deployment).filter((entry) => entry?.formationId).length;
  const used = new Set(Object.values(deployment).map((entry) => entry?.formationId).filter(Boolean));
  const view = committed && round > 0 ? result.rounds[round - 1] : null;

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
    const deployedIds = Object.values(planned).map((entry) => entry?.formationId).filter(Boolean);
    const after = applyBattle({
      run, result, deployedIds, won: result.winner === "player", disposition: dispositionId,
      commandSpent: budget.spent,
    });
    setRun(after.status === "active" ? repair(after) : after);
    setPhase(after.status === "active" ? "reward" : "over");
    setCommitted(false);
    setRound(0);
  };

  // Buying does not leave the market — you spend until you are done or out of points, and
  // then move on. A shelf you are thrown off after one purchase is not a market.
  const purchase = (offerId) => setRun(buy({ run, offerId }));

  const marchOn = () => {
    setRun(advanceRun(run));
    setDeployment({});
    setCommitments({});
    setPhase("deploy");
  };

  const beginRun = () => {
    const started = startRun({ detachmentId, seed });
    setRun(started);
    setPhase("deploy");
    setDeployment({});
    setCommitments({});
    setCommitted(false);
    setRound(0);
    setDispositionId(detachmentFor(detachmentId).dispositions[0]);
    setStrategyId(plansFor(detachmentFor(detachmentId).dispositions[0])[0].id);
  };

  const setSlot = (slotId, patch) => setDeployment((current) => ({
    ...current,
    [slotId]: { ...current[slotId], ...patch },
  }));

  // Declaring a disposition throws away the strategy and every per-slot override with it,
  // because both were answers to a question that has just changed.
  const muster = (nextDetachmentId) => {
    const next = detachmentFor(nextDetachmentId);
    setDetachmentId(nextDetachmentId);
    setCommitments({});
    // Everything below the detachment is an answer to a question it just changed.
    const nextDisposition = next.dispositions.includes(dispositionId) ? dispositionId : next.dispositions[0];
    setDispositionId(nextDisposition);
    setStrategyId(plansFor(nextDisposition)[0].id);
    setDeployment((current) => Object.fromEntries(Object.entries(current)
      .map(([slotId, entry]) => [slotId, { formationId: entry?.formationId ?? null }])));
  };
  const declare = (nextDispositionId) => {
    setDispositionId(nextDispositionId);
    setStrategyId(plansFor(nextDispositionId)[0].id);
    setDeployment((current) => Object.fromEntries(Object.entries(current)
      .map(([slotId, entry]) => [slotId, { formationId: entry?.formationId ?? null }])));
  };
  const adopt = (nextStrategyId) => {
    setStrategyId(nextStrategyId);
    setDeployment((current) => Object.fromEntries(Object.entries(current)
      .map(([slotId, entry]) => [slotId, { formationId: entry?.formationId ?? null }])));
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
              {mission.playerDeployment.map((slot, index) => {
                const route = routePointsFor(battlePlan, index, mission.id);
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

          {markers.map((unit) => (
            <div
              key={`${unit.side}-${unit.id}`}
              className={`battle-unit battle-unit-${unit.side} ${unit.wounds <= 0 ? "destroyed" : ""}`}
              style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
            >
              <b>{unit.name}</b>
              <i aria-hidden="true"><em style={{ width: `${Math.max(0, 100 * unit.wounds / unit.maxWounds)}%` }} /></i>
            </div>
          ))}
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
                {run.roster.map((entry) => (
                  <div className="battle-roster-row" key={entry.formationId}>
                    <b>{entry.name}{entry.refit ? ` · ${refitFor(entry.refit)?.name}` : ""}</b>
                    <em>{Number.isFinite(entry.wounds) ? `${entry.wounds} WOUNDS LEFT` : "FULL STRENGTH"}</em>
                    <button
                      type="button"
                      className="battle-retire"
                      disabled={fieldableFrom(run).length <= MINIMUM_FORCE}
                      onClick={() => setRun(retire({ run, formationId: entry.formationId }))}
                    >
                      RETIRE
                    </button>
                  </div>
                ))}
              </div>
              {offersFor(run).map((offer) => (
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
              {offersFor(run).length === 0 && <p className="battle-hint">Nothing left on the shelf.</p>}
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
                  {fieldableFrom(run).map((entry) => {
                    // Through the refit, not around it — a refitted hull that prints its
                    // factory stat line is a lie the player catches by counting shots.
                    const profile = profileWithRefit(entry.formationId, entry.refit);
                    const placed = used.has(entry.formationId);
                    return (
                      <div className={`battle-warband-row ${placed ? "placed" : ""}`} key={entry.formationId}>
                        <b>{entry.name}</b>
                        <em>{placed ? "DEPLOYED" : Number.isFinite(entry.wounds) ? `${entry.wounds} WOUNDS` : "FULL"}</em>
                        <small>
                          MOVE {profile.move} · RANGE {profile.range} · {profile.shots} SHOTS · {profile.wounds} WOUNDS · CONTROL {profile.control}
                        </small>
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
                  {(run.discovered ?? []).map((entry) => (
                    <div className="battle-note-row" key={entry.id}>
                      <b>{entry.name}</b>
                      <em>ENGAGEMENT {entry.battle}</em>
                      <small>{entry.holder} standing with {entry.partner}. {entry.reveal}</small>
                    </div>
                  ))}
                  {(run.discovered ?? []).length === 0 && (
                    <p className="battle-notes-empty">
                      Nothing recorded yet. Some formations do something together that
                      neither of them does alone, and no card says which.
                    </p>
                  )}
                </div>
              )}
              <p className="battle-hint">
                The strategy decides where every slot goes. You decide who walks it — that is the
                whole deployment. Everything resolves once you commit.
              </p>
              {mission.playerDeployment.map((slot) => {
                const entry = deployment[slot.id] ?? {};
                return (
                  <div className="battle-slot" key={slot.id}>
                    <span>{slot.name}</span>
                    <select
                      value={entry.formationId ?? ""}
                      onChange={(event) => setSlot(slot.id, { formationId: event.target.value || null })}
                      aria-label={`Formation for ${slot.name}`}
                    >
                      <option value="">— empty —</option>
                      {(run ? fieldableFrom(run) : FORMATIONS.map((formation) => ({ formationId: formation.id, name: formation.name, wounds: null })))
                        .map((item) => (
                          <option
                            key={item.formationId}
                            value={item.formationId}
                            disabled={used.has(item.formationId) && entry.formationId !== item.formationId}
                          >
                            {item.name}{Number.isFinite(item.wounds) ? ` · ${item.wounds} WOUNDS LEFT` : ""}
                          </option>
                        ))}
                    </select>
                    <small className="battle-assignment">
                      {(() => {
                        const index = mission.playerDeployment.indexOf(slot);
                        const destination = routeDestinationFor(battlePlan, index, mission.objectives, mission.id);
                        const objective = mission.objectives.find((entry) => entry.id === destination);
                        return objective ? `THE PLAN SENDS THIS SLOT TO ${objective.name}` : "THIS SLOT HOLDS NO SCORING GROUND";
                      })()}
                    </small>
                    {entry.formationId && (
                      <small className="battle-profile">
                        {(() => {
                          const held = run?.roster.find((item) => item.formationId === entry.formationId);
                          const profile = profileWithRefit(entry.formationId, held?.refit);
                          return `MOVE ${profile.move} · RANGE ${profile.range} · ${profile.shots} SHOTS · ${profile.wounds} WOUNDS · CONTROL ${profile.control}`;
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
                    </li>
                  ))}
                </ul>
              </div>

              <div className="battle-strat-panel">
                <h3>
                  {detachment.name}
                  <em className={budget.remaining < 0 ? "over" : ""}>{budget.remaining} / {detachment.commandPoints} CP</em>
                </h3>
                <p className="battle-hint">
                  Commit a stratagem to the round you want it to fire in. That timing is the whole
                  decision — the same card in a different round is a different battle.
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
                        value={Number.isFinite(chosen) ? String(chosen) : ""}
                        aria-label={`Round to spend ${stratagem.name}`}
                        disabled={unaffordable}
                        onChange={(event) => commitTo(id, event.target.value ? Number(event.target.value) : null)}
                      >
                        <option value="">— hold —</option>
                        {Array.from({ length: mission.rounds }, (unused, index) => index + 1).map((value) => (
                          <option key={value} value={value}>SPEND IN ROUND {value}</option>
                        ))}
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
                });
                return headline ? <div className={`battle-headline ${headline.tone}`} aria-live="polite">{headline.text}</div> : null;
              })()}
              <div className="battle-gained">
                <span>ROUND {view?.round} PAID</span>
                <b className="player">WARHOST +{view?.playerGained ?? 0}</b>
                <b className="enemy">HELIOCH +{view?.enemyGained ?? 0}</b>
              </div>
              <div className="battle-objective-list">
                {scored?.map((objective) => (
                  <div key={objective.objectiveId} className={`battle-objective-row held-${objective.holder}`}>
                    <b>{objective.name}</b>
                    <span>{objective.player} v {objective.enemy}</span>
                    <em>{objective.holder === "contested" ? "CONTESTED" : `${objective.holder.toUpperCase()} +${objective.points}`}</em>
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
