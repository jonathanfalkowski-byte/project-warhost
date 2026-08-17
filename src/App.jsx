import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import {
  ArrowCounterClockwise,
  ArrowRight,
  CheckCircle,
  Crosshair,
  Factory,
  Flag,
  Hammer,
  Lightning,
  MapPin,
  Pause,
  Play,
  Plus,
  Radio,
  Seal,
  Shield,
  Target,
  Warning,
  Wrench,
} from "@phosphor-icons/react";

import { battlefieldConsequencesAt, formationStatusDisplay } from "./battleConsequences.js";
import { enemyContactForecastVisibleFor, enemyExactRoutesVisibleFor } from "./enemyPlanVisibility.js";
import {
  battleStageTimesFor,
  drawnDuringExecution,
  haltedStageTimeFor,
  stagedBattleTimeFor,
} from "./battleStaging.js";
import { counterBoardSummary, enemyCounterBoardFor } from "./enemyCounterIntel.js";
import { effectivenessSummary, formationEffectivenessFor } from "./formationEffectiveness.js";
import { hoverCardBoundsFor, hoverCardPlacementFor } from "./hoverCardPlacement.js";
import {
  enemyRouteLineVisible,
  enemyRoutePhaseFor,
  enemyRouteProgressFor,
  enemyRouteStopVisible,
  reinforcementRouteVisible,
} from "./enemyRouteVisibility.js";
import { battlefieldDoctrineFor } from "./battleDoctrineData.js";
import { DEAD_CIRCUIT_MISSION } from "./fieldPlanData.js";

import { resolveDispositionMatchup } from "./missionDisposition.js";
import { claimStaffExercise, planningResultRevealed } from "./planningIntel.js";
import { adjacentFormationIdsFor, formationInteractionsFor, interactionDirectionFor, neighboringInteractionHints } from "./formationInteractions.js";
import {
  BLIND_PREDICTIONS,
  blindPredictionResult,
  strategyTrialFor,
  strategyTrialResult,
  strategyTrialsForPlaybook,
} from "./strategyExperiment.js";
import {
  applyCampaignConditions,
  applyWorkshopAction,
  campaignOutcomeFor,
  ensureCostlyContinuationConditions,
  formationFatesFor,
  integrityLossFor,
  mergeCampaignConditions,
  seriousConditionsFromConsequences,
  victoryGradeFor,
} from "./campaignPersistence.js";
import {
  buildBattlePlayback,
  playbackIndexAfterStep,
  playbackTimeForIndex,
} from "./battlePlayback.js";
import {
  actionStopBadge,
  actionStopLabel,
  actionStopPairLabel,
  buildAuthoredFormationRoutes,
  pointAlongRoute as pointAlongFieldRoute,
  positionAlongAuthoredRoute,
  routePreviewAnnouncement,
  authoredRouteHeadFor,
  routeSegmentStateFor,
  splitAuthoredRouteAtActionStop,
} from "./fieldRoutes.js";

import { useModalFocus } from "./useModalFocus.js";
import { strategyCausalityFor, strategyOutcomeStoryFor } from "./strategyCausality.js";
import {
  fieldPlanForPressure,
  missionPressureFor,
  missionPressuresForOperation,
} from "./missionPressure.js";

import {
  FORMATIONS,
  stagingNodeFor,
  defaultRefits,
  resolveFormations,
  tacticalTerm,
  tacticalText,
} from "./formationData.js";
import {
  PLAYBOOKS,
  PLAYBOOK_BATTLEFIELD_READ,
  playbookForOperation,
} from "./playbookData.js";
import {
  enemyPlanFor,
} from "./enemyPlanData.js";

import {
  OPERATIONS,
  PLAYBACK_BEAT_MS,
  breakpointImpactsFor,
  breakpointsFor,
  operationFieldFor,
  reinforcementWaveFor,
  roleDemandsFor,
} from "./operationData.js";
import {
  buildOperationEvents,
  calculateOperationProfile,
  calculatePlacementReadiness,
  calculateRefitProtocols,
  comboWindowTimes,
  evaluateTacticalSequence,
} from "./operationResolution.js";

const emptyAssignments = (playbook) => Object.fromEntries(
  playbook.roles.map((role) => [role.id, null]),
);

const assignmentsWithFormationAtRole = ({ assignments, roles, formationId, roleId }) => {
  const nextAssignments = { ...assignments };
  roles.forEach((role) => {
    if (nextAssignments[role.id] === formationId) nextAssignments[role.id] = null;
  });
  nextAssignments[roleId] = formationId;
  return nextAssignments;
};

const defaultBranches = (operation = OPERATIONS[0]) => Object.fromEntries(
  breakpointsFor(operation).map((breakpoint) => [breakpoint.id, breakpoint.defaultOption]),
);

const fmtClock = (seconds) => {
  const remaining = Math.max(0, 360 - seconds);
  return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(
    remaining % 60,
  ).padStart(2, "0")}`;
};

const fmtDuration = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
  seconds % 60,
).padStart(2, "0")}`;

const protocolImpactText = (impact) => [
  impact.alpha ? `FIRST GATE -${fmtDuration(impact.alpha)}` : null,
  impact.beta ? `SECOND GATE -${fmtDuration(impact.beta)}` : null,
  impact.reactor ? `RELAY -${fmtDuration(impact.reactor)}` : null,
  impact.extraction ? `VOID LIFT -${fmtDuration(impact.extraction)}` : null,
  impact.protects ? `+${impact.protects} FORMATION PRESERVED` : null,
  impact.delayReduction ? `ABSORBS ${fmtDuration(impact.delayReduction)} CONTACT DELAY` : null,
].filter(Boolean).join(" · ");

const reinforcementForecast = (profile) => profile.overrun > 0
  ? `WAVE ARRIVES ${fmtDuration(profile.overrun)} BEFORE CLEAR`
  : `CLEAR ${fmtDuration(profile.timeSaved)} BEFORE ENEMY WAVE`;

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Hammer weight="duotone" />
    </div>
  );
}

function FormationPortrait({ formation, compact = false }) {
  return (
    <img
      className={compact ? "formation-image compact" : "formation-image"}
      src={formation.asset}
      alt={`${formation.name} formation`}
    />
  );
}

function AppHeader({ phase, battleTime, operation, operationIndex, profile }) {
  const reinforcementWave = reinforcementWaveFor(operation, profile.condition);
  const reinforcementsEngaged = (phase === "battle" || phase === "complete") && battleTime >= reinforcementWave.arrivalAt;
  const clock = phase === "plan" || phase === "drill"
    ? { label: "ENEMY WAVE IN", value: fmtDuration(reinforcementWave.arrivalAt), detail: reinforcementWave.name }
    : phase === "complete"
      ? profile.overrun > 0
        ? { label: "ENEMY WAVE CONTACT", value: fmtDuration(profile.overrun), detail: "BEFORE EXTRACTION CLEAR" }
        : { label: "EXTRACTION CLEAR", value: fmtDuration(profile.timeSaved), detail: "BEFORE ENEMY WAVE" }
      : reinforcementsEngaged
        ? { label: "ENEMY WAVE ENGAGED", value: `+${fmtDuration(battleTime - reinforcementWave.arrivalAt)}`, detail: reinforcementWave.order }
        : { label: "ENEMY WAVE IN", value: fmtDuration(Math.max(0, reinforcementWave.arrivalAt - battleTime)), detail: reinforcementWave.approach };
  return (
    <header className="app-header">
      <div className="brand-block">
        <BrandMark />
        <div>
          <p className="eyebrow">PROJECT WARHOST</p>
          <h1>OBJECTIVE WEAVE</h1>
        </div>
      </div>
      <div className="faction-matchup" aria-label="Scrapborn Freeholds versus Helioch Oath">
        <div className="faction faction-player">
          <span className="faction-sigil"><Wrench weight="duotone" /></span>
          <div><b>SCRAPBORN FREEHOLDS</b><small>VOIDBREAKER GUILD</small></div>
        </div>
        <span className="versus">VS</span>
        <div className="faction faction-enemy">
          <div><b>HELIOCH OATH</b><small>ORDO PRAESIDIUM</small></div>
          <span className="faction-sigil"><Target weight="duotone" /></span>
        </div>
      </div>
      <div className="operation-block">
        <div>
          <p className="operation-title">{operation.name}</p>
          <p className="operation-type">{operation.type} · RUN {operationIndex + 1} / {OPERATIONS.length}</p>
        </div>
        <div className="reinforcement-clock" aria-live="polite">
          <span>{clock.label}</span>
          <strong>{clock.value}</strong>
          <small>{clock.detail}</small>
        </div>
      </div>
    </header>
  );
}

// Everything neutral about a formation, at a readable size, without a click. Shows the
// facts and lets the player compare them: capabilities and the stop's demands sit side
// by side, but nothing here grades the fit, ranks a candidate, or reveals a resolved
// combo. Those stay sealed until commitment.
function FormationHoverCard({ formation, anchor, playbook, assignments, condition }) {
  const cardRef = useRef(null);
  const [placement, setPlacement] = useState(null);

  // Measured after paint, so the card is positioned against its real height rather than
  // an assumed one — the content varies with how many conditions a formation reacts to.
  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element || !anchor) {
      setPlacement(null);
      return undefined;
    }
    const place = () => {
      const header = document.querySelector(".app-header");
      const footer = document.querySelector(".footer-controls, .mission-footer");
      const box = element.getBoundingClientRect();
      setPlacement(hoverCardPlacementFor({
        anchor,
        cardHeight: box.height,
        cardWidth: box.width,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        bounds: hoverCardBoundsFor({
          headerBottom: header?.getBoundingClientRect().bottom,
          footerTop: footer?.getBoundingClientRect().top,
          viewportHeight: window.innerHeight,
        }),
      }));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [anchor, formation?.id]);

  if (!formation) return null;
  const Icon = formation.icon;
  const roleIndex = playbook.roles.findIndex((role) => assignments[role.id] === formation.id);
  const role = roleIndex >= 0 ? playbook.roles[roleIndex] : null;
  const demands = role ? roleDemandsFor(role, roleIndex, condition) : [];
  const refit = formation.activeRefit ?? formation.refits[0];
  return (
    // Anchored to the hovered element rather than to the pointer: it appears beside the
    // formation the player is actually looking at, and needs no mousemove tracking to
    // show up on the first hover. Hidden until measured so it never flashes at 0,0.
    <aside
      className="formation-hover-card"
      ref={cardRef}
      aria-hidden="true"
      style={placement
        ? { left: `${placement.left}px`, top: `${placement.top}px`, "--notch-top": `${placement.notchTop}px` }
        : { visibility: "hidden" }}
    >
      <header>
        <FormationPortrait formation={formation} compact />
        <div>
          <span>FORMATION {formation.number}</span>
          <b>{formation.name}</b>
          <small><Icon weight="duotone" /> {tacticalTerm(formation.role)} · {formation.movementProfile.replace(/-/g, " ").toUpperCase()}</small>
        </div>
      </header>
      <p>{formation.purpose}</p>
      <div className="hover-endurance">
        {Object.entries(formation.endurance).map(([axis, value]) => (
          <div key={axis}>
            <span>{axis}</span>
            <b>{value}</b>
            <i><em style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%` }} /></i>
          </div>
        ))}
      </div>
      <dl>
        <div><dt>CAPABILITIES</dt><dd>{formation.capabilities.join(" · ")}</dd></div>
        <div><dt>REFIT INSTALLED</dt><dd>{refit.name}</dd></div>
        <div><dt>CREATES</dt><dd className="creates">{tacticalTerm(refit.creates ?? formation.creates)}</dd></div>
        <div><dt>CAN REACT TO</dt><dd>{(formation.uses ?? []).map(tacticalTerm).join(" · ") || "—"}</dd></div>
      </dl>
      {role ? (
        <footer className="assigned">
          <span>ASSIGNED · STOP {String(roleIndex + 1).padStart(2, "0")} · {role.label}</span>
          <small>THIS STOP DEMANDS {demands.map(tacticalTerm).join(" / ")}</small>
        </footer>
      ) : (
        <footer><span>IN RESERVE</span><small>NOT DEPLOYED ON THIS PLAN</small></footer>
      )}
    </aside>
  );
}

function FormationDossier({ formation, interactions, assignedRole, assignedIndex, readiness, phase, refitsLocked, onRefit }) {
  if (!formation) return null;
  const Icon = formation.icon;

  return (
    <aside className="formation-dossier panel-surface" aria-label={`${formation.name} formation dossier`}>
      <div className="dossier-heading"><span>FORMATION DOSSIER</span><em>NEUTRAL INTEL</em></div>
      <div className="dossier-identity">
        <FormationPortrait formation={formation} compact />
        <div><span>FORMATION {formation.number}</span><b>{formation.name}</b><small><Icon weight="duotone" /> {tacticalTerm(formation.role)}</small></div>
      </div>
      <p>{formation.purpose}</p>
      <div className="dossier-endurance" aria-label="Formation endurance profile">
        {Object.entries(formation.endurance).map(([axis, value]) => (
          // Clamped: an endurance value outside 0-5 used to crash the render with
          // "Invalid count value" rather than just drawing an odd meter.
          <div key={axis}><span>{axis}</span><b>{value}</b><small>{"■".repeat(Math.max(0, Math.min(5, value)))}{"□".repeat(Math.max(0, 5 - value))}</small></div>
        ))}
      </div>
      {formation.campaignCondition && (
        <div className={`dossier-campaign-state ${formation.campaignCondition.state}`}>
          <Warning weight="fill" />
          <span><b>{formation.campaignCondition.label}</b><small>{formation.disabledCapability ? `${formation.disabledCapability} OFFLINE THIS OPERATION` : "FORMATION UNAVAILABLE THIS OPERATION"}</small></span>
        </div>
      )}
      <div className="dossier-refits">
        <span>REFIT BAY · {refitsLocked ? "LOCKED FOR OPERATION" : "ONE PACKAGE INSTALLED"}</span>
        <div>
          {formation.refits.map((refit) => (
            <button
              key={refit.id}
              className={formation.activeRefit.id === refit.id ? "selected" : ""}
              onClick={() => onRefit(formation.id, refit.id)}
              disabled={refitsLocked || phase !== "plan"}
              aria-pressed={formation.activeRefit.id === refit.id}
            >
              <b>{refit.name}</b>
              <small>{refit.summary}</small>
              <em>{refit.capabilities.join(" / ")} · CREATES {tacticalTerm(refit.creates)}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="dossier-reactions">
        <span>CAPABILITIES</span>
        <div>{formation.capabilities.map((capability) => <em key={capability}>{capability}</em>)}</div>
      </div>
      <div className="dossier-condition">
        <span>CREATES</span>
        <b>{tacticalTerm(formation.creates)}</b>
      </div>
      <div className="dossier-reactions">
        <span>CAN REACT TO</span>
        <div>{formation.uses.map((condition) => <em key={condition}>{tacticalTerm(condition)}</em>)}</div>
      </div>
      <div className="dossier-links">
        <span>AUTHORED RENDEZVOUS LINKS</span>
        {interactions.length > 0 ? interactions.map((interaction) => (
          <div key={interaction.partnerId}>
            <b>{interaction.partnerName}</b>
            {interaction.incoming && <small><ArrowRight weight="bold" /> {tacticalText(interaction.incoming.text)}</small>}
            {interaction.outgoing && <small><ArrowRight weight="bold" /> {tacticalText(interaction.outgoing.text)}</small>}
          </div>
        )) : <p>No staffed formation currently meets this formation at an authored rendezvous.</p>}
        <em>Only shared route events can create a combo. No meeting point means no link.</em>
      </div>
      {assignedRole && readiness ? (
        <div className="dossier-placement concealed">
          <div><span>ASSIGNED TO STOP {String(assignedIndex + 1).padStart(2, "0")}</span><b>OUTCOME SEALED</b><small>{assignedRole.label}</small></div>
          <div className="dossier-observations"><em>COMPARE CAPABILITIES</em><em>CHECK CREATES</em><em>CHECK REACTIONS</em></div>
        </div>
      ) : (
        <div className="dossier-unplaced"><b>ASSIGN BY DOCTRINE</b><small>Use the responsibility, capabilities, creates, and reactions above. Results reveal under contact.</small></div>
      )}
    </aside>
  );
}

function MissionMatchupBrief({ condition, operation }) {
  const matchup = resolveDispositionMatchup({
    playerDisposition: operation.matchup?.playerDisposition,
    enemyDisposition: operation.matchup?.enemyDisposition,
    mission: operation.matchup,
  });
  if (!matchup) return null;
  return (
    <section className="mission-matchup-brief" aria-label="Disposition mission matchup">
      <span>MISSION GENERATED BY DISPOSITIONS</span>
      <div className="disposition-versus">
        <div><small>YOUR FORCE</small><b>{matchup.player.name}</b></div>
        <em>VS</em>
        <div><small>ENEMY FORCE</small><b>{matchup.enemy.name}</b></div>
      </div>
      <h2>{matchup.title}</h2>
      <p className="player-order"><b>YOUR ORDER</b>{matchup.playerObjective}</p>
      <p className="enemy-order"><b>ENEMY ORDER</b>{matchup.enemyObjective}</p>
      <p className="mission-pressure-order"><b>MISSION PRESSURE · {condition.name}</b>{condition.brief} {condition.effect}</p>
    </section>
  );
}

function StrategyTestPanel({ activeTrial, available, blindActive, blindPrediction, onBlindPrediction, onLoad, onStartBlind, playbook }) {
  const templates = strategyTrialsForPlaybook(playbook.id);
  return (
    <section className={`strategy-test-panel ${blindActive ? "blind-active" : ""}`} aria-label={blindActive ? "Blind command test" : "Command assistance"}>
      <header><span>{blindActive ? "BLIND COMMAND TEST" : "COMMAND ASSISTANCE"}</span><small>{blindActive ? "OUTCOME SEALED" : `${playbook.name} · EDITABLE STARTS`}</small></header>
      {blindActive ? (
        <>
          <p>The answer is hidden. Build your own play, place every formation, choose the authored breakpoint orders, then predict the result.</p>
          <div className="blind-prediction-block">
            <span>PREDICT BEFORE COMMITMENT</span>
            <div>
              {BLIND_PREDICTIONS.map((prediction) => (
                <button key={prediction.id} className={blindPrediction === prediction.id ? "selected" : ""} onClick={() => onBlindPrediction(prediction.id)} aria-pressed={blindPrediction === prediction.id}>
                  <b>{prediction.label}</b><small>{prediction.detail}</small>
                </button>
              ))}
            </div>
          </div>
          <small className="blind-test-rule">Exact extraction and reinforcement forecasts remain sealed until execution.</small>
        </>
      ) : (
        <>
          <p>Choose a competent starting posture for <b>{playbook.name}</b>, then edit any formation, refit, or breakpoint. Templates contain deliberate compromises and are never the optimal answer.</p>
          <button className="start-blind-test" onClick={onStartBlind} disabled={!available}><Target weight="duotone" /><span><b>START BLIND COMMAND TEST</b><small>Build your own plan and predict its outcome.</small></span></button>
          <div className="strategy-trial-list">
            {templates.map((trial) => (
              <button
                key={trial.id}
                className={activeTrial?.id === trial.id ? "selected" : ""}
                onClick={() => onLoad(trial.id)}
                disabled={!available}
                aria-pressed={activeTrial?.id === trial.id}
              >
                <strong>{trial.run}</strong>
                <span><b>{trial.name}</b><small>{trial.posture === "aggressive" ? "FAST · EXPOSED" : trial.posture === "cautious" ? "PROTECTED · SLOW" : "FLEXIBLE · GENERAL"}</small></span>
              </button>
            ))}
          </div>
          {activeTrial?.playbookId === playbook.id && <div className="strategy-trial-hypothesis"><b>{activeTrial.name} STARTING PLAN LOADED · EDIT FREELY</b><span>{activeTrial.priority}</span><small>TRADEOFF · {activeTrial.sacrifice}</small></div>}
        </>
      )}
    </section>
  );
}

function FormationRoster({ formations, unavailableFormations = [], condition, inspected, onInspect, selected, onSelect, assignments, playbook, previewPlaybookId, onPreviewPlaybook, onPlaybook, operation, phase, strategyTrial, blindTestActive, blindPrediction, onBlindPrediction, onLoadStrategyTrial, onStartBlindTest, onFormationDragStart, onFormationDragEnd, readiness, refitsLocked, onRefit }) {
  const roleByFormation = Object.fromEntries(
    playbook.roles.filter((role) => assignments[role.id]).map((role) => [assignments[role.id], role]),
  );
  const inspectedFormation = formations.find((formation) => formation.id === inspected);
  const inspectedRole = roleByFormation[inspected];
  const inspectedRoleIndex = inspectedRole ? playbook.roles.findIndex((role) => role.id === inspectedRole.id) : -1;
  const inspectedInteractions = formationInteractionsFor({ formations, formationId: inspected });
  const interactionByFormationId = new Map(inspectedInteractions.map((interaction) => [interaction.partnerId, interaction]));
  const adjacentFormationIds = new Set(adjacentFormationIdsFor({ roles: playbook.roles, assignments, formationId: inspected, connections: playbook.comboWindows }));
  const activeInspectedInteractions = inspectedInteractions.filter((interaction) => adjacentFormationIds.has(interaction.partnerId));
  return (
    <section className="left-rail" aria-label="Tactical playbooks and Warhost formations">
      {(phase === "plan" || phase === "drill") && <MissionMatchupBrief condition={condition} operation={operation} />}
      <div className="doctrine-heading"><span>CHOOSE TOTAL-ARMY PLAY</span><Radio weight="duotone" /></div>
      <div className="playbook-list">
        {PLAYBOOKS.map((baseItem) => {
          const item = playbookForOperation(baseItem, operation);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`playbook-row ${playbook.id === item.id ? "selected" : ""} ${previewPlaybookId === item.id ? "previewing" : ""}`}
              onClick={() => onPlaybook(item.id)}
              onMouseEnter={() => onPreviewPlaybook(item.id)}
              onMouseLeave={() => onPreviewPlaybook(null)}
              onFocus={() => onPreviewPlaybook(item.id)}
              onBlur={() => onPreviewPlaybook(null)}
              disabled={phase !== "plan"}
              aria-pressed={playbook.id === item.id}
            >
              <Icon weight="duotone" />
              <span><b>{item.name}</b><small>{item.summary}</small><em>{item.stages.map((stage) => stage.label).join(" → ")}</em></span>
            </button>
          );
        })}
      </div>
      {phase === "plan" && operation.id === "dead-circuit" && (
        <StrategyTestPanel activeTrial={strategyTrial} available={formations.length === FORMATIONS.length} blindActive={blindTestActive} blindPrediction={blindPrediction} onBlindPrediction={onBlindPrediction} onLoad={onLoadStrategyTrial} onStartBlind={onStartBlindTest} playbook={playbook} />
      )}
      <div className="rail-heading">
        <span>SELECT FORMATION</span>
        <span>VIEW ON FIELD</span>
      </div>
      <div className="formation-list">
        {formations.map((formation) => {
          const Icon = formation.icon;
          const active = selected === formation.id;
          const inspectionSource = inspected === formation.id;
          const interaction = interactionByFormationId.get(formation.id) ?? null;
          const direction = interactionDirectionFor(interaction);
          const activeInteraction = Boolean(interaction && adjacentFormationIds.has(formation.id));
          const assignedRole = roleByFormation[formation.id];
          const assignedIndex = assignedRole ? playbook.roles.findIndex((role) => role.id === assignedRole.id) : -1;
          return (
            <button
              key={formation.id}
              className={`formation-row ${active ? "selected" : ""} ${inspectionSource ? "inspection-source" : ""} ${activeInteraction ? `interaction-${direction} interaction-active` : ""} ${assignedRole ? "assigned" : "available"}`}
              onClick={() => onSelect(formation.id)}
              onMouseEnter={(event) => onInspect(formation.id, event.currentTarget)}
              onMouseLeave={() => onInspect(null)}
              onFocus={(event) => onInspect(formation.id, event.currentTarget)}
              onBlur={() => onInspect(null)}
                draggable={phase === "plan"}
                onDragStart={(event) => onFormationDragStart(event, formation.id)}
                onDragEnd={onFormationDragEnd}
              disabled={phase !== "plan" && phase !== "drill"}
              aria-pressed={active}
              aria-label={`${formation.name}. ${assignedRole ? `Assigned to action stop ${assignedIndex + 1}, ${assignedRole.label}` : "Available. Drag to an action stop"}.`}
              title={phase === "plan" ? "Drag to an action stop or click to inspect on the field" : undefined}
            >
              <span className="formation-number">{formation.number}</span>
              <FormationPortrait formation={formation} compact />
              <span className="formation-copy">
                <b>{formation.name}</b>
                <small><Icon weight="duotone" /> {tacticalTerm(formation.role)}</small>
                <em>{assignedRole ? `ASSIGNED · STOP ${String(assignedIndex + 1).padStart(2, "0")}` : "AVAILABLE · DRAG TO STOP"}</em>
                {activeInteraction && <em className={`formation-interaction-hint ${direction} active`}><Radio weight="fill" /> ACTIVE AT RENDEZVOUS</em>}
                {formation.campaignCondition && <em className="formation-campaign-state">{formation.campaignCondition.label} · {formation.disabledCapability} OFFLINE</em>}
              </span>
            </button>
          );
        })}
        {unavailableFormations.map((formation) => (
          <div className="formation-row formation-unavailable" key={formation.id} aria-label={`${formation.name}. Missing and unavailable for this operation.`}>
            <span className="formation-number">{formation.number}</span>
            <FormationPortrait formation={formation} compact />
            <span className="formation-copy"><b>{formation.name}</b><small>MISSING</small><em>UNAVAILABLE · LEAVES ONE STOP EMPTY</em></span>
          </div>
        ))}
      </div>
      <FormationDossier formation={inspectedFormation} interactions={activeInspectedInteractions} assignedRole={inspectedRole} assignedIndex={inspectedRoleIndex} readiness={inspectedRole ? readiness[inspectedRole.id] : null} phase={phase} refitsLocked={refitsLocked} onRefit={onRefit} />
    </section>
  );
}

function MissionRoute({ phase, battleTime, operation, profile }) {
  const steps = [
    { n: 1, label: operation.orders[0], done: battleTime >= profile.betaAt },
    { n: 2, label: operation.orders[1], done: battleTime >= profile.reactorAt },
    { n: 3, label: operation.orders[2], done: phase === "complete" },
  ];
  return (
    <div className="mission-route panel-surface">
      <span className="panel-label">VICTORY ORDERS</span>
      <div className="victory-rule"><b>WIN THE MISSION</b><small>{operation.victory}</small></div>
      {steps.map((step) => (
        <div className={`route-step route-${step.n} ${step.done ? "done" : ""}`} key={step.n}>
          <span>{step.done ? <CheckCircle weight="fill" /> : step.n}</span>
          <b>{step.label}</b>
        </div>
      ))}
    </div>
  );
}

function ObjectiveMarker({ className, number, title, description, state = "active", icon: Icon = MapPin, style }) {
  return (
    <div className={`objective-marker ${className} ${state}`} style={style}>
      <span className="objective-pin"><Icon weight="fill" /></span>
      <div><b>{title}</b><small>{description}</small></div>
      {number && <span className="objective-number">{number}</span>}
    </div>
  );
}

function TabletopBattlefieldOverlay({ landmarks, operation, plan }) {
  const extractionLandmark = plan?.extractionLandmark ?? "extraction";
  const extractionPoint = landmarks[extractionLandmark] ?? landmarks.extraction;
  const objectiveZones = [
    { id: "alpha", label: "OBJECTIVE ALPHA", point: landmarks.alpha, tone: "control" },
    { id: "beta", label: "OBJECTIVE BETA", point: landmarks.beta, tone: "control" },
    { id: "reactor", label: operation.primaryTitle, point: landmarks.reactor, tone: "primary" },
    { id: "extraction", label: plan?.extractionLabel ?? operation.extractionTitle, point: extractionPoint, tone: "extraction" },
  ];
  return (
    <div className="tabletop-battlefield-overlay" aria-hidden="true">
      <div className="tabletop-deployment-zone"><span>WARHOST DEPLOYMENT EDGE</span></div>
      <div className="tabletop-extraction-edge"><span>EXTRACTION EDGE</span></div>
      <div className="tabletop-corridor corridor-west"><span>WEST TRANSIT</span></div>
      <div className="tabletop-corridor corridor-center"><span>CENTRAL APPROACH</span></div>
      {objectiveZones.map((zone) => (
        <div className={`tabletop-objective-zone ${zone.tone}`} style={{ left: `${zone.point.x}%`, top: `${zone.point.y}%` }} key={zone.id}>
          <b>{zone.id === "reactor" ? "P" : zone.id === "extraction" ? "X" : zone.id === "alpha" ? "A" : "B"}</b>
          <span>{zone.label}</span>
        </div>
      ))}
    </div>
  );
}

// The staged clock both map layers draw against. Derived from the profile so the routes
// and the formations travelling along them can never disagree about where the army is.
const actionTimesForProfile = (profile) => [
  profile.alphaAt, profile.betaAt, profile.reactorExposeAt, profile.reactorAt, profile.extractionAt,
];
const stagedClockFor = (profile, battleTime) => {
  const stageTimes = battleStageTimesFor({
    actionTimes: actionTimesForProfile(profile),
    extractionAt: profile.extractionAt,
  });
  return { stageTimes, stagedTime: stagedBattleTimeFor({ battleTime, stageTimes }) };
};

const resolveFieldPoint = (plan, landmarks, reference) => {
  if (typeof reference === "number") return plan.positions[reference];
  if (typeof reference === "string") return landmarks[reference];
  return reference;
};

const fieldSegmentStyle = (start, end, size) => {
  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);
  const dx = ((end.x - start.x) / 100) * width;
  const dy = ((end.y - start.y) / 100) * height;
  return {
    left: `${start.x}%`,
    top: `${start.y}%`,
    width: `${Math.hypot(dx, dy)}px`,
    transform: `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`,
  };
};

function TacticalFieldPlan({ assignments, battleTime, branches, condition, consequences, formationFates, formations, handoffs, operation, phase, playbook, playbackBeat, profile, routePreview }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });
  const operationField = operationFieldFor(operation);
  const plan = fieldPlanForPressure(operationField.plans[playbook.id], condition, playbook.id);
  const battlefieldRead = PLAYBOOK_BATTLEFIELD_READ[playbook.id];
  const battlefieldDoctrine = battlefieldDoctrineFor(playbook.id);
  const breakpoints = breakpointsFor(operation);
  const execution = phase === "battle" || phase === "complete";
  const { stagedTime } = stagedClockFor(profile, battleTime);
  const roleActionTimes = actionTimesForProfile(profile);
  const resolvedFates = new Map((execution ? formationFates : [])
    .filter((formationFate) => formationFate.at <= battleTime)
    .map((formationFate) => [formationFate.formationId, formationFate]));
  const focusedPlayerIds = playbackBeat?.playerFormationIds ?? [];
  const hasPlayerFocus = focusedPlayerIds.length > 0;
  // Formations caught by an enemy order that actually landed. A broken order still
  // focuses them, but only a landed one is drawn as taking the hit.
  const struckIds = ["contact", "result", "intercept"].includes(playbackBeat?.kind)
    ? focusedPlayerIds
    : [];

  useEffect(() => {
    if (!layerRef.current) return undefined;
    const element = layerRef.current;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setLayerSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [condition.id, phase, playbook.id]);

  if (!plan) return null;

  const routes = plan.routes.map((route) => {
    const roleIndex = route.role;
    const role = playbook.roles[roleIndex];
    const formation = formations.find((item) => item.id === assignments[role.id]);
    const start = route.start;
    const playbackClass = execution && hasPlayerFocus
      ? focusedPlayerIds.includes(formation?.id) ? "playback-focused" : "playback-muted"
      : "";
    const consequenceClass = formation && consequences?.[formation.id] ? `state-${consequences[formation.id].state}` : "";
    const fateClass = formation && resolvedFates.has(formation.id) ? `fate-${resolvedFates.get(formation.id).fate}` : "";
    return { ...route, roleIndex, role, formation, start, playbackClass, consequenceClass, fateClass };
  });
  const formationMovementProfiles = Object.fromEntries(
    formations.map((formation) => [formation.id, formation.movementProfile]),
  );
  const executionRoutes = buildAuthoredFormationRoutes({
    plan,
    landmarks: operationField.landmarks,
    roles: playbook.roles,
    assignments,
    branches,
    formationMovementProfiles,
  });
  // Setup and execution share the same selected, end-to-end geometry so the
  // player can read all five journeys before committing the playbook.
  // Planning draws all five journeys end to end — reading them against each other is the
  // whole decision. Execution does not: drawing every complete route from the first frame
  // put five full-length lines across the board for the entire battle, which is the
  // "still lines everywhere" the player reported after the enemy lanes were fixed. During
  // execution a route is drawn only as far as its formation has actually travelled, with
  // the leading segment bright and covered ground faded behind it.
  const baseSegments = executionRoutes.flatMap((route) => {
    const points = route.points;
    const routePresentation = routes.find((item) => item.roleIndex === route.roleIndex);
    const routeParts = splitAuthoredRouteAtActionStop(points, route.actionStopIndex);
    const head = execution
      ? authoredRouteHeadFor({
          points,
          battleTime: stagedTime,
          actionAt: roleActionTimes[route.roleIndex] ?? profile.extractionAt,
          completeAt: profile.completeAt,
          actionStopIndex: route.actionStopIndex,
        })
      : null;
    return points.slice(0, -1).map((point, index) => {
      const state = execution ? routeSegmentStateFor({ segmentIndex: index, head }) : "covered";
      return {
        id: `route-${route.roleIndex}-${index}`,
        start: point,
        end: points[index + 1],
        hidden: state === "ahead",
        className: `base lane-${route.roleIndex + 1} route-${state} ${index < routeParts.approach.length - 1 ? "action-stop-approach" : "route-continuation"} ${routePresentation?.formation ? `staffed movement-${route.movementRouteKind}` : ""} ${routePresentation?.playbackClass ?? ""} ${routePresentation?.consequenceClass ?? ""} ${routePresentation?.fateClass ?? ""}`,
      };
    }).filter((segment) => !segment.hidden);
  });
  const previewRoleIndex = routePreview
    ? playbook.roles.findIndex((role) => role.id === routePreview.roleId)
    : -1;
  const previewFormation = routePreview
    ? formations.find((formation) => formation.id === routePreview.formationId)
    : null;
  const previewAssignments = phase === "plan" && previewFormation && previewRoleIndex >= 0
    ? assignmentsWithFormationAtRole({
        assignments,
        roles: playbook.roles,
        formationId: previewFormation.id,
        roleId: routePreview.roleId,
      })
    : null;
  const previewRoute = previewAssignments
    ? buildAuthoredFormationRoutes({
        plan,
        landmarks: operationField.landmarks,
        roles: playbook.roles,
        assignments: previewAssignments,
        branches,
        formationMovementProfiles,
      }).find((route) => route.roleIndex === previewRoleIndex && route.formationId === previewFormation.id)
    : null;
  const previewSegments = previewRoute
    ? previewRoute.points.slice(0, -1).map((point, index) => ({
        id: `preview-${previewFormation.id}-${previewRoleIndex}-${index}`,
        start: point,
        end: previewRoute.points[index + 1],
      }))
    : [];
  const previewLabelPoint = previewRoute?.points[Math.max(1, previewRoute.points.length - 2)] ?? null;
  // The preview is drawn as geometry, which conveys nothing to a screen reader.
  // Focusing an action stop produces the same preview as hovering it, so the
  // announcement below is the keyboard-equivalent of reading the drawn route.
  const previewAnnouncement = previewRoute ? routePreviewAnnouncement({
    formationName: previewFormation?.name,
    movementRouteKind: previewRoute.movementRouteKind,
    roleIndex: previewRoleIndex,
    roleLabel: playbook.roles[previewRoleIndex]?.label,
  }) : "";
  const objectiveIds = new Set(DEAD_CIRCUIT_MISSION.objectives.map((objective) => objective.id));
  const objectiveStops = (plan.objectivePhases ?? []).map((objectivePhase) => ({
    ...objectivePhase,
    point: operationField.landmarks[objectivePhase.objectiveId ?? objectivePhase.target],
    objective: DEAD_CIRCUIT_MISSION.objectives.find((item) => item.id === (objectivePhase.objectiveId ?? objectivePhase.target)),
  }));
  const objectiveCorridors = (plan.objectiveCorridors ?? []).map((corridor) => ({
    ...corridor,
    start: operationField.landmarks[corridor.from],
    end: operationField.landmarks[corridor.to],
  }));
  const branchTurns = breakpoints.flatMap((breakpoint, breakpointIndex) => {
    const selectedOptionId = branches[breakpoint.id];
    const visibleOptions = breakpoint.options.filter((option) => option.id === selectedOptionId);
    return visibleOptions.flatMap((option) => {
      const selectedRoute = option.id === selectedOptionId;
      return plan.branchRoutes[breakpoint.id][option.id]
        .filter((point) => typeof point === "object" || point === "rescue")
        .slice(0, 1)
        .map((point, index) => ({
          id: `${breakpoint.id}-${option.id}-turn-${index}`,
          point: resolveFieldPoint(plan, operationField.landmarks, point),
          label: option.routeLabel,
          className: `breakpoint-${breakpointIndex + 1} selected-route`,
        }));
    });
  });
  const rendezvousTiming = comboWindowTimes(profile);
  const tacticalLinks = (playbook.comboWindows ?? []).map((window) => {
    const handoff = handoffs.find((item) => item.from === window.from && item.to === window.to);
    const windowAt = rendezvousTiming[window.from];
    const live = execution && battleTime >= windowAt && battleTime < windowAt + 15;
    const resolved = execution && battleTime >= windowAt + 15;
    return {
      ...window,
      fromIndex: window.from,
      toIndex: window.to,
      at: resolveFieldPoint(plan, operationField.landmarks, window.rendezvous),
      staffed: Boolean(assignments[playbook.roles[window.from]?.id] && assignments[playbook.roles[window.to]?.id]),
      state: live ? "live" : resolved ? "resolved" : execution ? "upcoming" : "planning",
      status: live
        ? handoff?.maneuver ? "COMBO TRIGGERED" : "NO REACTION"
        : resolved
          ? handoff?.maneuver ? "COMBO RESOLVED" : "MET · NO COMBO"
          : execution ? "PAIR APPROACHING" : "ROUTES MEET HERE",
    };
  });

  return (
    <div className={`field-plan-layer ${execution ? "executing" : "planning"} ${previewRoute ? "previewing-route" : ""}`} ref={layerRef} aria-label={`${playbook.name} authored battlefield plan`}>
      <div className="field-plan-caption panel-surface" aria-live="polite">
        <div><span>{DEAD_CIRCUIT_MISSION.playerDisposition} MISSION</span><b>{playbook.name}</b></div>
        <div className="field-plan-branch-state">
          {breakpoints.map((breakpoint, index) => {
            const option = breakpoint.options.find((item) => item.id === branches[breakpoint.id]);
            const changed = branches[breakpoint.id] !== breakpoint.defaultOption;
            return <span className={changed ? "changed" : ""} key={breakpoint.id}>BP{index + 1} · {option.routeLabel}</span>;
          })}
        </div>
        <div className="field-plan-route-key" aria-label="Route line key">
          <span><i className="approach" />ORDER TO OBJECTIVE</span>
          <span><i className="continuation" />FOLLOW-ON MOVEMENT</span>
        </div>
      </div>
      {battlefieldRead && (
        <div className="field-plan-strategy-read panel-surface">
          <span>STRATEGIC TRADEOFF</span>
          <div><small>WINS BY</small><b>{battlefieldRead.winsBy}</b></div>
          <div><small>COMMITS TO</small><b>{battlefieldRead.commits}</b></div>
          <div><small>LEAVES EXPOSED</small><b>{battlefieldRead.risks}</b></div>
        </div>
      )}
      {battlefieldDoctrine && (
        <div className="field-plan-battle-sequence panel-surface">
          <header><span>BATTLE SEQUENCE</span><b>{battlefieldDoctrine.pattern}</b></header>
          {battlefieldDoctrine.phases.map((step, index) => (
            <div key={step.label}><small>0{index + 1} · {step.roles}</small><b>{step.label}</b><span>{step.detail}</span></div>
          ))}
        </div>
      )}
      {!execution && objectiveCorridors.map((corridor) => (
        <div
          className="field-plan-operation-corridor"
          style={fieldSegmentStyle(corridor.start, corridor.end, layerSize)}
          key={`operation-${corridor.id}`}
        >
          <span>{corridor.label}</span>
          <small>UNITS {corridor.roles.map((role) => role + 1).join(" / ")}</small>
        </div>
      ))}
      {!execution && objectiveStops.map((stop) => (
        <div
          className={`field-plan-objective-order objective-${stop.target}`}
          style={{ left: `${stop.point.x}%`, top: `${stop.point.y}%` }}
          key={stop.id}
        >
          <b>PHASE {stop.number}</b>
          <strong>{stop.label}</strong>
          <span>{stop.objective?.instruction} · UNITS {stop.roles.map((role) => role + 1).join(" / ")}</span>
        </div>
      ))}
      {!execution && battlefieldDoctrine?.contacts.map((contact) => (
        <div className="field-plan-contact-zone" style={{ left: `${contact.x}%`, top: `${contact.y}%` }} key={contact.label}>
          <Crosshair weight="bold" /><b>{contact.label}</b><span>{contact.detail}</span>
        </div>
      ))}
      <div
        className="field-plan-extraction-convergence"
        style={{ left: `${operationField.landmarks.extraction.x}%`, top: `${operationField.landmarks.extraction.y}%` }}
      >
        <Flag weight="fill" />
        <span>{execution ? "ALL SURVIVING ROUTES" : "ALL 5 ROUTES END HERE"}</span>
        <b>REFORM &amp; EXTRACT</b>
        {!execution && <small>01 · 02 · 03 · 04 · 05</small>}
      </div>
      {baseSegments.map((segment) => (
        <div className={`field-plan-segment ${segment.className} ${Object.entries(operationField.landmarks).some(([id, point]) => objectiveIds.has(id) && point.x === segment.end.x && point.y === segment.end.y) ? "terminates-at-objective" : ""}`} style={fieldSegmentStyle(segment.start, segment.end, layerSize)} key={segment.id}>
          <ArrowRight weight="bold" />
        </div>
      ))}
      {/* The preview carries its own action stop's lane colour. It used to force a single
          gold, so every stop previewed identically and colour stopped meaning "which
          stop" at the exact moment the player was asking that question. Preview is
          signalled by weight, glow and the label instead — none of which collide with
          hue. */}
      {previewSegments.map((segment) => (
        <div
          className={`field-plan-segment route-preview lane-${previewRoleIndex + 1} movement-${previewRoute.movementRouteKind}`}
          style={fieldSegmentStyle(segment.start, segment.end, layerSize)}
          key={segment.id}
        />
      ))}
      {previewFormation && previewRoute && previewLabelPoint && (
        <div
          className={`field-route-preview-label lane-${previewRoleIndex + 1} movement-${previewRoute.movementRouteKind}`}
          style={{ left: `${previewLabelPoint.x}%`, top: `${previewLabelPoint.y}%` }}
          aria-hidden="true"
        >
          <b>PREVIEW ONLY</b>
          <span>{previewFormation.name}</span>
          <small>{previewRoute.movementRouteKind === "walker" ? "WALKER ROUTE - CUTS THROUGH RUINS" : "VEHICLE ROUTE - AVOIDS BLOCKED TERRAIN"}</small>
        </div>
      )}
      <div className="sr-only field-route-preview-announcement" role="status" aria-live="polite">{previewAnnouncement}</div>
      {tacticalLinks.map((link) => (
        <div className={`field-plan-rendezvous ${link.staffed ? "staffed" : ""} ${execution ? `execution-${link.state}` : ""}`} style={{ left: `${link.at.x}%`, top: `${link.at.y}%` }} key={`rendezvous-${link.fromIndex}-${link.toIndex}`}>
          <Radio weight="fill" /><span>{link.status}</span><small>{link.label} · {actionStopPairLabel(link.fromIndex, link.toIndex)}</small>
        </div>
      ))}
      {branchTurns.map((turn) => (
        <div className={`field-plan-turn ${turn.className}`} style={{ left: `${turn.point.x}%`, top: `${turn.point.y}%` }} key={turn.id}>
          <MapPin weight="fill" /><span>{turn.label}</span>
        </div>
      ))}
      {routes.map((route) => (
        <div className={`field-plan-entry lane-${route.roleIndex + 1} ${route.formation ? "staffed" : ""} ${route.playbackClass} ${route.consequenceClass} ${route.fateClass}`} style={{ left: `${route.start.x}%`, top: `${route.start.y}%` }} key={`origin-${route.roleIndex}`}>
          <Flag weight="fill" />
          <span>{actionStopBadge(route.roleIndex)}</span>
          <small>{route.formation ? `${actionStopLabel(route.roleIndex)} · ${route.formation.name}` : actionStopLabel(route.roleIndex)}</small>
        </div>
      ))}
      {plan.positions.map((position, index) => {
        const role = playbook.roles[index];
        const formation = formations.find((item) => item.id === assignments[role.id]);
        const consequenceClass = formation && consequences?.[formation.id] ? `state-${consequences[formation.id].state}` : "";
        const fateClass = formation && resolvedFates.has(formation.id) ? `fate-${resolvedFates.get(formation.id).fate}` : "";
        return (
          <div className={`field-plan-position lane-${index + 1} ${formation ? "staffed" : ""} ${consequenceClass} ${fateClass} ${struckIds.includes(formation?.id) ? "struck" : ""} ${execution && hasPlayerFocus ? focusedPlayerIds.includes(formation?.id) ? "playback-focused" : "playback-muted" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} key={role.id}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{role.label.split(" / ")[0]}</span>
            {/* What this position is FOR. The stops used to sit in a row on the deployment
                line with no stated purpose, so the player could not tell whether a stop
                was something to recover or something to hold for strategic value. */}
            {role.objective && <i className="stop-objective">{role.objective}</i>}
            {routes[index]?.afterLabel && <small>{routes[index].afterLabel}</small>}
            {formation && <em>{formation.name}</em>}
          </div>
        );
      })}
    </div>
  );
}

function EnemyFieldPlan({ battleTime, operation, phase, clashes, profile, planReady, playbook, playbackBeat, collisionFocus }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });
  const enemyPlan = enemyPlanFor(operation);
  const reinforcementWave = reinforcementWaveFor(operation, profile.condition);
  const operationField = operationFieldFor(operation);
  const fieldPlan = fieldPlanForPressure(operationField.plans[playbook.id], profile.condition, playbook.id);
  const firstPosition = fieldPlan.positions[0];
  const secondPosition = fieldPlan.positions[1];
  const collisionPoint = {
    x: (firstPosition.x + secondPosition.x) / 2,
    y: (firstPosition.y + secondPosition.y) / 2,
  };
  const exactRoutesVisible = enemyExactRoutesVisibleFor(phase);
  const contactForecastVisible = enemyContactForecastVisibleFor(phase);

  useEffect(() => {
    if (!layerRef.current) return undefined;
    const element = layerRef.current;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setLayerSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const waveApproachAt = reinforcementWave.arrivalAt - reinforcementWave.approachDuration;
  const waveProgress = exactRoutesVisible
    ? Math.max(0, Math.min(1, (battleTime - waveApproachAt) / reinforcementWave.approachDuration))
    : 0;
  const wavePosition = {
    x: reinforcementWave.start.x + (reinforcementWave.intercept.x - reinforcementWave.start.x) * waveProgress,
    y: reinforcementWave.start.y + (reinforcementWave.intercept.y - reinforcementWave.start.y) * waveProgress,
  };
  const waveArrived = exactRoutesVisible && battleTime >= reinforcementWave.arrivalAt;
  const clearsBeforeWave = planReady && profile.overrun === 0;
  const routeForClash = (formation, clash, index) => {
    if (operation.id !== "ashen-passage") return [formation.start, formation.end];
    if (index === 0 && clash.routeState === "trapped") return [formation.start, collisionPoint];
    if (index === 0 && clash.routeState === "diverted") return [formation.start, collisionPoint, operationField.landmarks.reactor];
    if (index === 0) return [formation.start, collisionPoint, formation.end];
    if (clash.routeState === "redirected") return [formation.start, operationField.landmarks.reactor];
    if (clash.routeState === "starved") return [formation.start, {
      x: formation.start.x + (formation.end.x - formation.start.x) * .12,
      y: formation.start.y + (formation.end.y - formation.start.y) * .12,
    }];
    return [formation.start, formation.end];
  };

  const focusedEnemyIndices = playbackBeat?.enemyFormationIndices?.length
    ? playbackBeat.enemyFormationIndices
    : Number.isInteger(playbackBeat?.enemyFormationIndex) ? [playbackBeat.enemyFormationIndex] : [];
  const doctrinePhase = playbackBeat?.doctrinePhase ?? "none";
  const reinforcementPlaybackClass = playbackBeat?.reinforcementFocus ? "playback-focused" : "";
  // Beats where two plans actually meet, as opposed to beats that only describe intent.
  const strikeBeat = ["contact", "result", "intercept"].includes(playbackBeat?.kind);

  return (
    <div className={`enemy-plan-layer phase-${phase} doctrine-${doctrinePhase}`} ref={layerRef} aria-label={`${enemyPlan.name} enemy battlefield plan`}>
      {enemyPlan.formations.map((formation, index) => {
        const clash = clashes[index];
        const inBattle = exactRoutesVisible;
        const playbackFocused = focusedEnemyIndices.includes(index);
        const playbackClass = inBattle
          ? collisionFocus
            ? playbackFocused ? "playback-focused" : "playback-muted"
            : ""
          : "";
        const counterRevealClass = playbackFocused && (doctrinePhase === "enemy-counter" || doctrinePhase === "outcome") ? "doctrine-counter-reveal" : "";
        const routePhase = enemyRoutePhaseFor({ battleTime, actionAt: formation.actionAt, routesVisible: exactRoutesVisible });
        const progress = enemyRouteProgressFor({ battleTime, actionAt: formation.actionAt, routePhase });
        const route = routeForClash(formation, clash, index);
        const position = pointAlongFieldRoute(route, progress);
        const convergenceSpread = Math.pow(progress, 2);
        const convergenceOffsets = [{ x: -3.8, y: -3.2 }, { x: 4.2, y: .8 }, { x: -2.5, y: 4.1 }];
        const movingPosition = {
          x: position.x + convergenceOffsets[index].x * convergenceSpread,
          y: position.y + convergenceOffsets[index].y * convergenceSpread,
        };
        const endpoint = route.at(-1);
        const displayPosition = contactForecastVisible ? endpoint : movingPosition;
        const intelligence = enemyPlan.stages[index]?.intelligence ?? "UNKNOWN";
        const forecastLabel = intelligence === "KNOWN"
          ? `KNOWN CONTACT · ${formation.name}`
          : intelligence === "UNCERTAIN"
            ? `UNCERTAIN CONTACT · ${formation.name}`
            : "UNKNOWN CONTACT";
        const resolved = inBattle && battleTime >= formation.actionAt;
        return (
          <Fragment key={formation.id}>
            {/* One order's route at a time. See enemyRouteVisibility.js — drawing all
                three at once was the "enemy lines everywhere" problem. */}
            {enemyRouteLineVisible(routePhase) && route.slice(0, -1).map((start, segmentIndex) => (
              <div className={`enemy-plan-segment enemy-lane-${index + 1} ${clash.routeState} ${playbackClass} ${counterRevealClass}`} style={fieldSegmentStyle(start, route[segmentIndex + 1], layerSize)} key={`${formation.id}-segment-${segmentIndex}`}>
                <ArrowRight weight="bold" />
              </div>
            ))}
            {enemyRouteStopVisible(routePhase) && <div className={`enemy-plan-stop enemy-lane-${index + 1} ${clash.routeState} ${routePhase} ${playbackClass} ${counterRevealClass}`} style={{ left: `${endpoint.x}%`, top: `${endpoint.y}%` }}>
              <b>{formation.number}</b><span>{clash.label}</span>
            </div>}
            {/* The engagement has to happen somewhere on the map. Without this the
                enemy order resolved only in a banner, so the player never saw contact
                and had no read on the situation a Command Seal is answering. */}
            {strikeBeat && playbackBeat?.enemyFormationIndex === index && (
              <div
                className={`field-strike ${clash.disrupted ? "broken" : "landed"} ${playbackBeat.kind === "intercept" ? "heavy" : ""}`}
                style={{ left: `${displayPosition.x}%`, top: `${displayPosition.y}%` }}
                key={`strike-${playbackBeat.id}`}
                aria-hidden="true"
              >
                <i /><i /><span>{clash.disrupted ? "BROKEN" : "IMPACT"}</span>
              </div>
            )}
            {/* A waiting order holds on its staging edge and reads as a clock, not as a
                nameless icon drifting across the board from the first frame. */}
            <div className={`enemy-plan-formation ${contactForecastVisible ? "contact-forecast" : ""} ${clash.routeState} route-${routePhase} ${resolved ? clash.disrupted ? "disrupted" : "landed" : "advancing"} ${playbackClass} ${counterRevealClass}`} style={{ left: `${displayPosition.x}%`, top: `${displayPosition.y}%` }}>
              <img src="/assets/helioch-sentinels.png" alt={`${formation.name} executing ${clash.label}`} />
              <span>{formation.number}</span>
              <small>{contactForecastVisible
                ? forecastLabel
                : routePhase === "pending"
                  ? `HOLDING · T+${fmtDuration(formation.actionAt)}`
                  : resolved ? clash.routeState === "starved" ? "CHAIN STARVED" : clash.routeState === "diverted" || clash.routeState === "redirected" ? "REROUTED" : clash.disrupted ? "DISRUPTED" : clash.label : formation.name}</small>
            </div>
          </Fragment>
        );
      })}
      {exactRoutesVisible && operation.id === "ashen-passage" && (
        <div className={`enemy-collision-marker ${profile.enemyCollision?.outcome ?? "unread"} ${playbackBeat?.kind === "contact" ? "playback-focused" : ""}`} style={{ left: `${collisionPoint.x}%`, top: `${collisionPoint.y}%` }}>
          <Crosshair weight="duotone" />
          <span>{profile.enemyCollision?.revealed ? profile.enemyCollision.title : "STOP 01/02 CONTACT WINDOW"}</span>
        </div>
      )}
      {/* The wave lane is one more line, and was drawn from the first frame for the same
          reason the others were. It earns its line once it is actually inbound. */}
      {reinforcementRouteVisible({ battleTime, approachAt: waveApproachAt, routesVisible: exactRoutesVisible }) && <div className={`reinforcement-route ${clearsBeforeWave ? "avoided" : "threat"} ${reinforcementPlaybackClass}`} style={fieldSegmentStyle(reinforcementWave.start, reinforcementWave.intercept, layerSize)}>
        <ArrowRight weight="bold" />
      </div>}
      <div className={`reinforcement-intercept ${clearsBeforeWave ? "avoided" : "threat"} ${reinforcementPlaybackClass}`} style={{ left: `${reinforcementWave.intercept.x}%`, top: `${reinforcementWave.intercept.y}%` }}>
        <Crosshair weight="duotone" />
        <span>{!planReady ? `ENEMY WAVE · T+${fmtDuration(reinforcementWave.arrivalAt)}` : clearsBeforeWave ? "WARHOST CLEARS FIRST" : `${fmtDuration(profile.overrun)} INTERCEPT WINDOW`}</span>
      </div>
      <div className={`enemy-plan-formation reinforcement-wave ${contactForecastVisible ? "contact-forecast" : ""} ${waveArrived ? "landed" : waveProgress > 0 ? "advancing" : "queued"} ${clearsBeforeWave ? "avoided" : ""} ${reinforcementPlaybackClass}`} style={{ left: `${contactForecastVisible ? reinforcementWave.intercept.x : wavePosition.x}%`, top: `${contactForecastVisible ? reinforcementWave.intercept.y : wavePosition.y}%` }}>
        <img src="/assets/helioch-sentinels.png" alt={`${reinforcementWave.name} approaching ${operation.extractionTitle}`} />
        <span>{reinforcementWave.number}</span>
        <small>{waveArrived ? reinforcementWave.order : `WAVE · T+${fmtDuration(reinforcementWave.arrivalAt)}`}</small>
      </div>
    </div>
  );
}

function DoctrineCollisionOverlay({ beat, operation, playbook }) {
  if (!beat?.doctrinePhase) return null;
  const operationField = operationFieldFor(operation);
  const positions = operationField.plans[playbook.id]?.positions ?? [];
  const midpoint = (left, right) => ({
    x: ((left?.x ?? 50) + (right?.x ?? 50)) / 2,
    y: ((left?.y ?? 50) + (right?.y ?? 50)) / 2,
  });
  const point = playbook.id === "spear"
    ? operationField.landmarks.reactor
    : playbook.id === "pressure"
      ? midpoint(operationField.landmarks.alpha, operationField.landmarks.beta)
      : midpoint(positions[0], positions[1]);
  const phaseLabels = {
    "player-play": "YOUR PLAY",
    "field-change": "FIELD CHANGES",
    "enemy-counter": "ENEMY COUNTER-LINES",
    outcome: "COLLISION RESOLVED",
  };

  return (
    <div className={`doctrine-collision-overlay ${playbook.id} ${beat.doctrinePhase} ${beat.routeState ?? ""}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} aria-hidden="true">
      <span>{phaseLabels[beat.doctrinePhase]}</span>
      <b>{playbook.id === "trapline" ? "KILL BOX" : playbook.id === "spear" ? "THRUST / REAR" : "TWO AXES"}</b>
      {(beat.doctrinePhase === "enemy-counter" || beat.doctrinePhase === "outcome") && <Crosshair weight="duotone" />}
    </div>
  );
}

function TacticalHandoffBoard({ feedback, formations, handoffs, profile, staffExerciseIndex, onStaffExercise }) {
  const discovered = [];
  const fullyStaffed = false;
  const timing = comboWindowTimes(profile);

  return (
    <div className="handoff-board" aria-live="polite">
      <div className="handoff-heading">
        <span>SECONDARY BONUS · COMBO WINDOWS</span>
        <small>After route jobs are covered, inspect one named route rendezvous with a Staff Exercise.</small>
      </div>
      {feedback ? (
        <div className="cascade-readout placement-impact rewired" key={feedback.revision} role="status">
          <span><Radio weight="fill" /> ASSIGNMENT RECORDED</span>
          <b>{feedback.formationName} → STOP {String(feedback.targetIndex + 1).padStart(2, "0")}</b>
          <div className="placement-impact-metrics">
            <strong>SEALED<small>COMBO RESULTS</small></strong>
            <strong>COMMIT TO REVEAL<small>MISSION OUTCOME</small></strong>
          </div>
        </div>
      ) : (
        <div className={`cascade-readout ${discovered.length > 0 ? "active" : fullyStaffed ? "broken" : "unresolved"}`}>
          <span><Radio weight="fill" /> COMMAND PLAN SEALED</span>
          <b>Assignments change the battle, but this screen no longer grades them.</b>
          <small>Read each formation's rules, then decide which responsibility it should carry.</small>
        </div>
      )}
      <div className="handoff-grid">
        {handoffs.map((handoff, handoffIndex) => {
          const routeConnected = handoff.routeConnected !== false;
          const staffed = routeConnected && handoff.sourceId && handoff.receiverId;
          const source = formations.find((formation) => formation.id === handoff.sourceId);
          const receiver = formations.find((formation) => formation.id === handoff.receiverId);
          const windowAt = timing[handoff.from];
          const revealed = planningResultRevealed({ phase: "plan", handoffIndex, staffExerciseIndex });
          return (
            <div
              className={`handoff-card ${!routeConnected ? "route-separated" : revealed ? handoff.maneuver ? "discovered" : "independent" : "unresolved"}`}
              key={handoff.id}
            >
              <span className="combo-window-time">{routeConnected ? `T+${fmtDuration(windowAt)} · ${handoff.routeConnectionLabel ?? `AFTER ${String(handoff.from + 1).padStart(2, "0")} / BEFORE ${String(handoff.to + 1).padStart(2, "0")}`}` : `ROUTES ${String(handoff.from + 1).padStart(2, "0")} / ${String(handoff.to + 1).padStart(2, "0")} REMAIN SEPARATE`}</span>
              {!routeConnected ? (
                <><b>NO SHARED ROUTE EVENT</b><small>These responsibilities do not meet anywhere in this battle plan, so they cannot form a combo.</small></>
              ) : revealed && handoff.maneuver ? (
                <>
                  <div className="combo-window-flow">
                    <span><b>{source.name}</b><small>CREATES {tacticalTerm(handoff.maneuver.passes)}</small></span>
                    <ArrowRight weight="bold" />
                    <span><b>{receiver.name}</b><small>REACTS: {handoff.maneuver.name}</small></span>
                  </div>
                  <p><Target weight="fill" /> RESULT: {tacticalTerm(handoff.maneuver.result)} · {tacticalText(handoff.maneuver.impact.text)}</p>
                </>
              ) : (
                <>
                  <b>{revealed ? staffed ? "NO AUTOMATIC REACTION" : "WINDOW UNSTAFFED" : staffed ? "RESULT SEALED" : "STAFF BOTH STOPS"}</b>
                  <small>{revealed && staffed ? `${source.name} creates ${handoff.incomingCondition}; ${receiver.name} cannot use it.` : staffed ? `${source.name} to ${receiver.name}; result unknown.` : "A combo window requires formations on both sides."}</small>
                  {!revealed && staffed && staffExerciseIndex === null && <button className="staff-exercise-button" onClick={() => onStaffExercise(handoffIndex)}><Radio weight="fill" /> RUN STAFF EXERCISE</button>}
                  {!revealed && staffed && staffExerciseIndex !== null && <em className="staff-exercise-spent">{staffExerciseIndex === -1 ? "EXERCISE SPENT · PLAN CHANGED" : "STAFF EXERCISE SPENT"}</em>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaybookBoard({ active, assignments, battleTime, condition, drillStep, draggingFormationId, feedback, formations, handoffs, inspected, onChooseRole, onAssignFormation, onClearRole, onFormationDragStart, onFormationDragEnd, onInspectFormation, onRoutePreview, onSelectFormation, onStaffExercise, onViewRouteMap, outputs, phase, playbook, profile, readiness, refitProtocols, selected, staffExerciseIndex }) {
  const [dropTargetRoleId, setDropTargetRoleId] = useState(null);
  const previewFormationId = draggingFormationId ?? selected;
  const showRoutePreview = (roleId) => {
    if (phase === "plan" && previewFormationId) {
      onRoutePreview({ formationId: previewFormationId, roleId });
    }
  };
  const clearRoutePreview = () => onRoutePreview(null);
  const discoveredHandoffs = handoffs.filter((handoff) => handoff.maneuver);
  const timing = comboWindowTimes(profile);
  const doctrine = profile.doctrine;
  const inspectedFormation = formations.find((formation) => formation.id === inspected) ?? null;
  const inspectedInteractions = formationInteractionsFor({ formations, formationId: inspected });
  const adjacentFormationIds = new Set(adjacentFormationIdsFor({ roles: playbook.roles, assignments, formationId: inspected, connections: playbook.comboWindows }));
  const activeInteractions = inspectedInteractions.filter((interaction) => adjacentFormationIds.has(interaction.partnerId));
  const interactionByFormationId = new Map(activeInteractions.map((interaction) => [interaction.partnerId, interaction]));
  const inspectedAssigned = playbook.roles.some((role) => assignments[role.id] === inspected);
  const inspectingInteractions = (phase === "plan" || phase === "drill") && Boolean(inspectedFormation);
  const authoredRendezvousCount = playbook.comboWindows?.length ?? 0;
  const staffedRendezvousCount = (playbook.comboWindows ?? []).filter((window) => (
    assignments[playbook.roles[window.from]?.id] && assignments[playbook.roles[window.to]?.id]
  )).length;
  const rendezvousStatuses = (playbook.comboWindows ?? []).map((window) => {
    const sourceRole = playbook.roles[window.from];
    const receiverRole = playbook.roles[window.to];
    const source = formations.find((formation) => formation.id === assignments[sourceRole?.id]) ?? null;
    const receiver = formations.find((formation) => formation.id === assignments[receiverRole?.id]) ?? null;
    const handoff = handoffs.find((item) => item.from === window.from && item.to === window.to) ?? null;
    const staffed = Boolean(source && receiver);
    const revealed = phase === "battle";
    const stateLabel = !staffed
      ? "STAFF BOTH ROUTES"
      : revealed
        ? handoff?.maneuver?.name ?? "MET - NO REACTION"
        : "PAIR STAFFED - RESULT SEALED";
    return { ...window, source, receiver, staffed, revealed, handoff, stateLabel };
  });

  if (phase === "battle") {
    return (
      <div className="playbook-board execution-view compact-execution panel-surface">
        <div className="compact-execution-heading">
          <div><span className="panel-label">{playbook.name} · FORMATION ROUTE PLAN</span><b>ORDERS IN MOTION</b></div>
          <strong>{Object.values(assignments).filter(Boolean).length} / {playbook.roles.length} ROUTES STAFFED</strong>
        </div>
        <div className="compact-route-strip">
          {playbook.roles.map((role, index) => {
            const formation = formations.find((item) => item.id === assignments[role.id]);
            return (
              <div className={formation ? "staffed" : "empty"} key={role.id}>
                <span>{String(index + 1).padStart(2, "0")} · {role.label}</span>
                <b>{formation?.name ?? "UNSTAFFED"}</b>
              </div>
            );
          })}
        </div>
        <div className="compact-rendezvous-strip">
          <span>RENDEZVOUS</span>
          {rendezvousStatuses.map((status) => {
            const windowAt = timing[status.from] ?? 0;
            const state = battleTime >= windowAt + 15 ? "resolved" : battleTime >= windowAt ? "live" : "upcoming";
            return (
              <div className={`${state} ${status.staffed ? "staffed" : "empty"}`} key={status.id ?? `${status.from}:${status.to}`}>
                <b>{status.label}</b>
                <small>{!status.staffed ? "UNSTAFFED" : state === "live" ? "CONTACT NOW" : state === "resolved" ? status.stateLabel : `IN ${fmtDuration(windowAt - battleTime)}`}</small>
              </div>
            );
          })}
          {rendezvousStatuses.length === 0 && <small>NO AUTHORED MEETING POINTS</small>}
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className={`combo-panel panel-surface ${active ? "ready" : "broken"}`}>
        <span className="panel-label">{playbook.name}: {playbook.stages.map((stage) => stage.label).join(" → ")}</span>
        <p>{active ? playbook.intent : "One or more tactical roles are unresolved."}</p>
        <div className={`doctrine-battle-readout ${doctrine.triggered ? "triggered" : "exposed"}`}><span>{doctrine.name}</span><b>{doctrine.result}</b></div>
        <div className="combo-steps">
          {playbook.stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <Fragment key={stage.label}>
                <div className={drillStep >= index + 1 ? `lit ${stage.warm ? "warm" : ""}` : ""}><Icon weight="duotone" /><b>{stage.label}</b><small>{stage.detail}</small></div>
                {index < playbook.stages.length - 1 && <ArrowRight />}
              </Fragment>
            );
          })}
        </div>
        <div className="battle-handoffs">
          <span>AUTOMATIC COMBO WINDOWS</span>
          {discoveredHandoffs.length > 0 ? discoveredHandoffs.map((handoff) => {
            const source = formations.find((formation) => formation.id === handoff.sourceId);
            const receiver = formations.find((formation) => formation.id === handoff.receiverId);
            const windowAt = timing[handoff.from];
            const state = phase === "complete" || battleTime >= windowAt + 15
              ? "resolved"
              : battleTime >= windowAt
                ? "live"
                : "upcoming";
            const timingLabel = state === "live"
              ? "NOW"
              : state === "resolved"
                ? "RESOLVED"
                : `IN ${fmtDuration(windowAt - battleTime)}`;
            return (
              <div className={state} key={handoff.id} title={`${source.name} creates ${tacticalTerm(handoff.maneuver.passes)}; ${receiver.name} responds with ${handoff.maneuver.name}`}>
                <Lightning weight="fill" />
                <b>{timingLabel} · {handoff.maneuver.name}</b>
                <small>{source.name} creates {tacticalTerm(handoff.maneuver.passes)} → {receiver.name} turns it into {tacticalTerm(handoff.maneuver.result)}</small>
              </div>
            );
          }) : <p>No combo windows are armed; formations execute independently.</p>}
        </div>
      </div>
    );
  }

  const assignedCount = Object.values(assignments).filter(Boolean).length;
  return (
    <div className={`playbook-board panel-surface ${active ? "ready" : "incomplete"} ${phase === "battle" ? "execution-view" : ""}`}>
      <div className="playbook-board-heading">
        <div>
          <span className="panel-label">{playbook.name} · AUTHORED TACTICAL ROUTE</span>
          <b>{phase === "battle" ? "FORMATION ROUTE PLAN" : "PLACE THE FORMATIONS"}</b>
        </div>
        <div className="playbook-board-actions">
          <strong>
            {assignedCount} / {playbook.roles.length} FORMATIONS PLACED
            {formations.length > playbook.roles.length ? ` · ${formations.length - playbook.roles.length} IN RESERVE` : ""}
          </strong>
          {phase !== "battle" && <button type="button" onClick={onViewRouteMap}><MapPin weight="fill" /> VIEW ROUTE MAP</button>}
        </div>
      </div>
      <p>{phase === "battle" ? "The committed assignments remain visible while the formations execute. Watch the named rendezvous below to see whether a bonus actually triggers." : "Assign each formation to a route responsibility first. A combo is only possible at a named rendezvous where two authored routes meet."}</p>
      <div className="planning-priority" aria-label="Planning priority">
        <div><span>PRIMARY DECISION</span><b>ROUTE RESPONSIBILITY</b><small>Can this formation perform the job at this stop?</small></div>
        <ArrowRight weight="bold" />
        <div><span>SECONDARY BONUS</span><b>RENDEZVOUS COMBO</b><small>Can another formation exploit a shared route event?</small></div>
      </div>
      <div className="playbook-doctrine concealed">
        <span>PLAYBOOK DOCTRINE · {doctrine.name}</span>
        <b>{doctrine.strength}</b>
        <small>EXPOSURE · {doctrine.exposure}</small>
        <em>DOCTRINE RESULT UNRESOLVED</em>
      </div>
      <div className="route-terminals" aria-hidden="true"><span>PRIMARY · ROUTE RESPONSIBILITIES</span><span>SECONDARY · RENDEZVOUS BONUSES</span></div>
      <div className="playbook-route">
        {playbook.roles.map((role, index) => {
          const roleDemands = roleDemandsFor(role, index, condition);
          const formation = formations.find((item) => item.id === assignments[role.id]);
          const refitProtocol = refitProtocols[role.id];
          const nextRole = playbook.roles[index + 1];
          const nextFormation = nextRole ? formations.find((item) => item.id === assignments[nextRole.id]) : null;
          const interaction = formation ? interactionByFormationId.get(formation.id) : null;
          const interactionDirection = interactionDirectionFor(interaction);
          const activeInteraction = Boolean(interaction && adjacentFormationIds.has(formation.id));
          const interactionClass = !inspectingInteractions || !formation
            ? ""
            : formation.id === inspected
              ? "interaction-selected"
              : activeInteraction
                ? `interaction-active interaction-${interactionDirection}`
                : "interaction-muted";
          return (
            <Fragment key={role.id}>
              <div
                className={`playbook-slot-shell ${interactionClass}`}
                onMouseEnter={() => {
                  if (formation) onInspectFormation(formation.id);
                  showRoutePreview(role.id);
                }}
                onMouseLeave={() => {
                  onInspectFormation(null);
                  clearRoutePreview();
                }}
              >
              <button
                className={`playbook-slot planning-concealed ${formation ? "filled" : "empty"} ${dropTargetRoleId === role.id ? "drop-target" : ""} ${interactionClass}`}
                onClick={() => onChooseRole(role.id)}
                onFocus={() => showRoutePreview(role.id)}
                onBlur={clearRoutePreview}
                draggable={phase === "plan" && Boolean(formation)}
                onDragStart={(event) => {
                  if (!formation) return;
                  onRoutePreview({ formationId: formation.id, roleId: role.id });
                  onFormationDragStart(event, formation.id);
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDropTargetRoleId(role.id);
                  showRoutePreview(role.id);
                }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setDropTargetRoleId(null);
                    clearRoutePreview();
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const formationId = event.dataTransfer.getData("application/x-warhost-formation") || event.dataTransfer.getData("text/plain");
                  setDropTargetRoleId(null);
                  clearRoutePreview();
                  onAssignFormation(role.id, formationId);
                }}
                onDragEnd={() => {
                  setDropTargetRoleId(null);
                  onFormationDragEnd();
                  clearRoutePreview();
                }}
                disabled={phase !== "plan"}
                aria-label={`Action stop ${index + 1}, ${role.label}. Currently ${formation?.name ?? "empty"}`}
              >
                <span className="slot-number">STOP {String(index + 1).padStart(2, "0")}</span>
                <span className="slot-role">{role.label}</span>
                <span className="slot-task">{role.brief}<small className="slot-demand">DEMANDS {roleDemands.join(" / ")}</small></span>
                {formation ? (
                  <>
                    <span className="slot-formation"><img src={formation.asset} alt="" /><span><b>{formation.name}</b><small>{formation.activeRefit.name}</small></span></span>
                    <span className="slot-route-fit assigned">
                      <b>ORDER ACCEPTED · {tacticalTerm(formation.role)}</b>
                      <small>{formation.purpose}</small>
                    </span>
                    {formation.id === inspected && <span className="slot-interaction selected"><Radio weight="fill" /> INSPECTING · CREATES {tacticalTerm(formation.creates)}</span>}
                    {activeInteraction && interaction && (
                      <span className={`slot-interaction active ${interactionDirection}`}>
                        <Radio weight="fill" /> ACTIVE AT RENDEZVOUS · {[interaction.outgoing?.condition, interaction.incoming?.condition].filter(Boolean).map(tacticalTerm).join(" / ")}
                      </span>
                    )}
                    {refitProtocol && (
                      <span className="slot-protocol concealed">
                        <b>REFIT INTERFACE UNRESOLVED</b>
                        <small>FIELD INTERACTION REVEALS UNDER CONTACT</small>
                      </span>
                    )}
                    <span className="slot-result concealed">
                      <span className="slot-output"><b>RESULT SEALED</b></span>
                      <span className="slot-readiness"><b>?</b><small>RESULT</small></span>
                    </span>
                  </>
                ) : (
                  <span className="slot-empty"><Plus weight="bold" /><b>DROP UNIT</b><small>OR CLICK</small></span>
                )}
              </button>
              {formation && phase === "plan" && <button className="clear-slot-button" onClick={() => onClearRole(role.id)} aria-label={`Clear ${formation.name} from ${role.label}`}>CLEAR</button>}
              </div>
              {nextRole && (() => {
                const routeConnection = playbook.comboWindows?.find((window) => window.from === index && window.to === index + 1) ?? null;
                return <span className={`route-leg ${routeConnection ? "route-connected" : "route-separated"} ${routeConnection && formation && nextFormation ? "occupied" : ""} ${routeConnection && inspectingInteractions && formation && nextFormation && (formation.id === inspected || nextFormation.id === inspected) && interactionByFormationId.has(formation.id === inspected ? nextFormation.id : formation.id) ? "interaction-active" : ""}`} title={routeConnection?.label ?? "These routes do not meet"} aria-hidden="true">{routeConnection ? <Radio weight="fill" /> : <span>×</span>}</span>;
              })()}
            </Fragment>
          );
        })}
      </div>
      <section className="rendezvous-status-strip" aria-label="Authored rendezvous staffing">
        <span className="rendezvous-strip-title"><Radio weight="fill" /><b>RENDEZVOUS</b><small>{staffedRendezvousCount}/{authoredRendezvousCount} staffed</small></span>
        {rendezvousStatuses.map((rendezvous) => {
          const inspectedAtMeeting = inspected && (rendezvous.source?.id === inspected || rendezvous.receiver?.id === inspected);
          const inspectId = rendezvous.source?.id ?? rendezvous.receiver?.id ?? null;
          return (
            <button
              type="button"
              className={`${rendezvous.staffed ? "staffed" : "unstaffed"} ${rendezvous.revealed && rendezvous.handoff?.maneuver ? "resolved" : ""} ${inspectedAtMeeting ? "inspected" : ""}`}
              key={rendezvous.rendezvous}
              disabled={!inspectId}
              onMouseEnter={() => inspectId && onInspectFormation(inspectId)}
              onMouseLeave={() => onInspectFormation(null)}
              onClick={() => inspectId && onSelectFormation(inspectId)}
            >
              <span><b>{rendezvous.label}</b><small>{actionStopPairLabel(rendezvous.from, rendezvous.to)}</small></span>
              <em>{rendezvous.stateLabel}</em>
            </button>
          );
        })}
        <span className="rendezvous-separated">{Math.max(0, playbook.roles.length - 1 - authoredRendezvousCount)} ROUTE GAPS STAY SEPARATE</span>
      </section>
      <details className="secondary-combo-drawer combo-window-drawer">
        <summary>
          <span><Lightning weight="fill" /> COMBO DETAILS · OPTIONAL BONUS</span>
          <small>{phase === "battle" ? `${discoveredHandoffs.length}/${authoredRendezvousCount} rendezvous produced a reaction` : "Open to inspect formation interactions and every authored meeting point"}</small>
        </summary>
        {inspectingInteractions && (
          <section className="formation-interaction-inspector" aria-live="polite" aria-label={`${inspectedFormation.name} potential formation interactions`}>
            <header>
              <span><Radio weight="fill" /> SELECTED FORMATION</span>
              <b>{inspectedFormation.name}</b>
              <small>CREATES <strong>{inspectedFormation.creates}</strong> · CAN REACT TO <strong>{inspectedFormation.uses.join(" / ")}</strong></small>
              <div className="interaction-legend"><span className="source">CYAN: INSPECTED</span><span className="outgoing">YELLOW: IT FEEDS THEM</span><span className="incoming">PURPLE: THEY FEED IT</span></div>
            </header>
            <div className="formation-interaction-partners">
              {activeInteractions.length > 0 ? activeInteractions.map((interaction) => (
                <button className={`active ${interactionDirectionFor(interaction)}`} key={interaction.partnerId} onClick={() => onSelectFormation(interaction.partnerId)}>
                  <b>{interaction.partnerName}<em>ACTIVE RENDEZVOUS</em></b>
                  {interaction.outgoing && <small><ArrowRight weight="bold" /> {inspectedFormation.name} creates <strong>{tacticalTerm(interaction.outgoing.condition)}</strong>; {interaction.partnerName} reacts</small>}
                  {interaction.incoming && <small><ArrowRight weight="bold" /> {interaction.partnerName} creates <strong>{tacticalTerm(interaction.incoming.condition)}</strong>; {inspectedFormation.name} reacts</small>}
                </button>
              )) : <p>No staffed route meets this formation at a named rendezvous. It is operating independently.</p>}
              {inspectedAssigned && activeInteractions.length === 0 && <p className="independent-state">OPERATING INDEPENDENTLY - its route shares no active rendezvous. This is valid when the responsibility matters more than a bonus.</p>}
            </div>
            <em>Color shows direction, not quality. A combo can arm only where the authored routes share a named rendezvous.</em>
          </section>
        )}
        {!inspectingInteractions && <div className="combo-empty-guide"><Radio weight="fill" /><span><b>SELECT OR HOVER A STAFFED FORMATION</b><small>Only its real partner at an authored rendezvous will highlight. No highlight means the routes never meet.</small></span></div>}
        <TacticalHandoffBoard feedback={feedback} formations={formations} handoffs={handoffs} profile={profile} staffExerciseIndex={staffExerciseIndex} onStaffExercise={onStaffExercise} />
      </details>
    </div>
  );
}

function BattleStateLegend() {
  return (
    <aside className="battle-state-legend" aria-label="Battlefield status legend">
      <span>BATTLEFIELD READ</span>
      <div><i className="active-contact" /><b>ACTIVE CONTACT</b><small>Blue pulse · fighting now</small></div>
      <div><i className="outside-contact" /><b>OUTSIDE CONTACT</b><small>Dimmed · not in this fight</small></div>
      <div><i className="under-pressure" /><b>UNDER PRESSURE</b><small>Amber · delayed or pinned</small></div>
      <div><i className="serious-state" /><b>SERIOUS STATE</b><small>Red · damaged or cut off</small></div>
    </aside>
  );
}

function Battlefield({ formations, formationFates, inspected, onInspect, selected, onSelect, deployments, phase, battleTime, condition, drillStep, draggingFormationId, placementFeedback, planReady, playbook, previewPlaybookId, drillSteps, assignments, branches, handoffs, operation, outputs, profile, routePreview, onChooseRole, onAssignFormation, onClearRole, onFormationDragStart, onFormationDragEnd, onRoutePreview, onStaffExercise, readiness, refitProtocols, staffExerciseIndex, playbackBeat, playbackBeats, playbackIndex, playbackPlaying, onPlaybackToggle, onPlaybackStep, onPlaybackReplay }) {
  const [routeMapOpen, setRouteMapOpen] = useState(false);
  useEffect(() => {
    setRouteMapOpen(false);
  }, [phase, playbook.id]);
  const alphaState = battleTime >= profile.alphaAt ? "secured" : "active";
  const betaState = battleTime >= profile.betaAt ? "secured" : "threat";
  const reactorState = battleTime >= profile.reactorAt ? "secured" : "threat";
  const extractionState = phase === "complete" ? "secured" : "future";
  const playbackActive = phase === "battle" || phase === "complete";
  const focusedPlayerIds = playbackBeat?.playerFormationIds ?? [];
  const hasPlayerFocus = focusedPlayerIds.length > 0;
  const hasEnemyFocus = Boolean(
    playbackBeat?.enemyFormationIndices?.length
      || Number.isInteger(playbackBeat?.enemyFormationIndex)
      || playbackBeat?.reinforcementFocus,
  );
  const collisionFocus = playbackActive && (hasPlayerFocus || hasEnemyFocus);
  const consequences = battlefieldConsequencesAt({ clashes: profile.enemyClashes, battleTime });
  const resolvedFormationFates = new Map((playbackActive ? formationFates : [])
    .filter((formationFate) => formationFate.at <= battleTime)
    .map((formationFate) => [formationFate.formationId, formationFate]));
  const operationField = operationFieldFor(operation);
  const staffedFieldPlan = fieldPlanForPressure(operationField.plans[playbook.id], condition, playbook.id);
  const authoredRoutes = buildAuthoredFormationRoutes({
    plan: staffedFieldPlan,
    landmarks: operationField.landmarks,
    roles: playbook.roles,
    assignments,
    branches,
    formationMovementProfiles: Object.fromEntries(formations.map((formation) => [formation.id, formation.movementProfile])),
  });
  const roleActionTimes = actionTimesForProfile(profile);
  // Turn staging. The army covers ground in bursts between mission milestones and holds
  // between them, rather than inching along a continuous timeline. Drawing only.
  const { stageTimes, stagedTime } = stagedClockFor(profile, battleTime);
  const inspectedFormation = formations.find((formation) => formation.id === inspected) ?? null;
  const inspectedInteractions = formationInteractionsFor({ formations, formationId: inspected });
  const interactionByFormationId = new Map(inspectedInteractions.map((interaction) => [interaction.partnerId, interaction]));
  const adjacentFormationIds = new Set(adjacentFormationIdsFor({ roles: playbook.roles, assignments, formationId: inspected, connections: playbook.comboWindows }));
  const inspectingInteractions = (phase === "plan" || phase === "drill") && Boolean(inspectedFormation);
  const previewBase = phase === "plan" && previewPlaybookId
    ? PLAYBOOKS.find((item) => item.id === previewPlaybookId)
    : null;
  const previewPlaybook = previewBase ? playbookForOperation(previewBase, operation) : null;
  const mapPlaybook = previewPlaybook ?? playbook;
  const previewingPlaybook = Boolean(previewPlaybook);
  const showingRouteMap = previewingPlaybook || routeMapOpen;
  const activeFieldPlan = fieldPlanForPressure(operationField.plans[mapPlaybook.id], condition, mapPlaybook.id);
  const extractionLandmark = activeFieldPlan?.extractionLandmark ?? "extraction";
  const extractionPoint = operationField.landmarks[extractionLandmark] ?? operationField.landmarks.extraction;

  return (
    <section className={`battlefield phase-${phase} operation-${operation.id} doctrine-${playbackBeat?.doctrinePhase ?? "none"} ${playbackActive ? "playback-active" : ""} ${collisionFocus ? "collision-focus" : ""} ${inspectingInteractions ? "interaction-inspecting" : ""}`} aria-label={`${operation.name} mission map`}>
      <img className="battlefield-art battlefield-art-planning" src="/assets/dead-circuit-command-map.png" alt="" aria-hidden="true" />
      <img className="battlefield-art battlefield-art-execution" src="/assets/dead-circuit-foundry.png" alt="" aria-hidden="true" />
      <div className="battlefield-wash" />
      <div className="battlefield-operation-veil" aria-hidden="true" />
      <div className="battlefield-view-mode" aria-hidden="true">
        <span>{phase === "plan" || phase === "drill" ? "COMMAND MAP" : "BATTLE VIEW"}</span>
        <strong>{phase === "plan" || phase === "drill" ? "TOP-DOWN PLANNING" : "ISOMETRIC EXECUTION"}</strong>
      </div>
      <div className="battlefield-map-stage">
      <TabletopBattlefieldOverlay landmarks={operationField.landmarks} operation={operation} plan={activeFieldPlan} />
      <EnemyFieldPlan battleTime={battleTime} operation={operation} phase={phase} clashes={profile.enemyClashes} profile={profile} planReady={planReady} playbook={playbook} playbackBeat={playbackBeat} collisionFocus={collisionFocus} />
      <TacticalFieldPlan assignments={previewingPlaybook ? emptyAssignments(mapPlaybook) : assignments} battleTime={battleTime} branches={branches} condition={condition} consequences={consequences.player} formationFates={formationFates} formations={formations} handoffs={handoffs} operation={operation} phase={phase} playbook={mapPlaybook} playbackBeat={playbackBeat} profile={profile} routePreview={previewingPlaybook ? null : routePreview} />
      {showingRouteMap && (
        <div className="playbook-map-preview" role="status">
          <span>{routeMapOpen ? "YOUR AUTHORED ROUTE" : `ROUTE PREVIEW · ${condition.name}`}</span>
          <b>{mapPlaybook.name}</b>
          <small>{mapPlaybook.stages.map((stage) => stage.label).join(" → ")}</small>
          {routeMapOpen
            ? <button type="button" onClick={() => setRouteMapOpen(false)}>RETURN TO FORMATION PLACEMENT <ArrowRight weight="bold" /></button>
            : <em>MAP ONLY · MOVE AWAY OR TAB ON TO RETURN TO FORMATION PLACEMENT</em>}
        </div>
      )}
      <DoctrineCollisionOverlay beat={playbackBeat} operation={operation} playbook={playbook} />
      <MissionRoute phase={phase} battleTime={battleTime} operation={operation} profile={profile} />
      <div className="map-sector entry-sector"><span>{phase === "plan" || phase === "drill" ? operation.entryPlanTitle : operation.entryBattleTitle}</span><small>{phase === "plan" || phase === "drill" ? "Visible formations · drag into a stop" : "Player deployment edge"}</small></div>
      <ObjectiveMarker className="alpha-objective" number="1" title={operation.controlTitles[0]} description={alphaState === "secured" ? "SECURED · western route open" : "Seize and hold"} state={alphaState} />
      <ObjectiveMarker className="beta-objective" number="1" title={operation.controlTitles[1]} description={betaState === "secured" ? "SECURED · transit lane open" : "Seize and hold"} state={betaState} />
      <ObjectiveMarker className="reactor-objective" number="2" title={operation.primaryTitle} description={reactorState === "secured" ? operation.primaryDone : operation.primaryDescription} state={reactorState} icon={Factory} />
      <ObjectiveMarker className="extraction-objective" number="3" title={activeFieldPlan?.extractionLabel ?? operation.extractionTitle} description={`Extract ${operation.requiredExtraction}+ formations`} state={extractionState} icon={Flag} style={{ left: `${extractionPoint.x}%`, top: `${extractionPoint.y}%`, right: "auto" }} />
      <ObjectiveMarker className="rescue-objective" title={operation.optionalTitle} description={operation.optionalDescription} state="optional" icon={Wrench} />

      <div className="mission-path path-one" aria-hidden="true" />
      <div className="mission-path path-two" aria-hidden="true" />
      <div className="mission-path path-three" aria-hidden="true" />
      <div className={`combo-path combo-pull ${planReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-burn ${planReady ? "active warm" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-break ${planReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`kill-zone ${planReady ? "active" : ""}`}><span>DECISION AREA</span></div>
      {formations.filter((formation) => drawnDuringExecution({
        phase,
        assignedToStop: playbook.roles.some((role) => assignments[role.id] === formation.id),
      })).map((formation) => {
        const assignedRoleIndex = playbook.roles.findIndex((role) => assignments[role.id] === formation.id);
        const assignedRole = assignedRoleIndex >= 0 ? playbook.roles[assignedRoleIndex] : null;
        const assignedStop = assignedRole && staffedFieldPlan?.positions[assignedRoleIndex]
          ? { left: staffedFieldPlan.positions[assignedRoleIndex].x, top: staffedFieldPlan.positions[assignedRoleIndex].y, label: `${actionStopLabel(assignedRoleIndex)} · ${assignedRole.label}` }
          : null;
        const node = assignedStop ?? stagingNodeFor(formation.id);
        const active = selected === formation.id;
        const consequence = consequences.player[formation.id] ?? null;
        const formationFate = resolvedFormationFates.get(formation.id) ?? null;
        const statusDisplay = formationStatusDisplay({ consequence, formationFate });
        const authoredRoute = authoredRoutes.find((route) => route.formationId === formation.id);
        const routeReadiness = assignedRole ? readiness[assignedRole.id] : null;
        const interaction = interactionByFormationId.get(formation.id) ?? null;
        const interactionDirection = interactionDirectionFor(interaction);
        const activeInteraction = Boolean(interaction && adjacentFormationIds.has(formation.id));
        const interactionClass = !inspectingInteractions
          ? ""
          : formation.id === inspected
            ? "interaction-selected"
            : activeInteraction
              ? `interaction-active interaction-${interactionDirection}`
              : "interaction-muted";
        // A formation cut off from extraction halts at the last action stop it reached.
        // It used to be drawn arriving at the gantry and then relabelled CUT OFF, because
        // every authored route terminates at extraction and fate times land at 96-99% of
        // the way along it — so a lost force looked like a force that had made it.
        const lost = formationFate && (formationFate.fate === "missing" || formationFate.fate === "destroyed");
        const drawnTime = lost
          ? Math.min(stagedTime, haltedStageTimeFor({ stageTimes, fateAt: formationFate.at, extractionAt: profile.extractionAt }))
          : stagedTime;
        const routePosition = playbackActive && authoredRoute
          ? positionAlongAuthoredRoute({
              points: authoredRoute.points,
              battleTime: drawnTime,
              actionAt: roleActionTimes[authoredRoute.roleIndex] ?? profile.extractionAt,
              completeAt: profile.completeAt,
              actionStopIndex: authoredRoute.actionStopIndex,
            })
          : { x: node.left, y: node.top };
        return (
          <button
            key={formation.id}
            className={`map-formation ${active ? "selected" : ""} ${interactionClass} ${routeReadiness ? "route-assigned" : ""} ${phase === "battle" && !["missing", "destroyed"].includes(formationFate?.fate) ? "in-motion" : ""} ${consequence ? `state-${consequence.state}` : ""} ${formationFate ? `fate-${formationFate.fate}` : ""} ${!assignedStop && (phase === "plan" || phase === "drill") ? "staged" : ""} ${collisionFocus ? focusedPlayerIds.includes(formation.id) ? "playback-focused" : "playback-muted" : ""}`}
            style={{ left: `${routePosition.x}%`, top: `${routePosition.y}%` }}
            onClick={() => onSelect(formation.id)}
            onMouseEnter={(event) => onInspect(formation.id, event.currentTarget)}
            onMouseLeave={() => onInspect(null)}
            onFocus={(event) => onInspect(formation.id, event.currentTarget)}
            onBlur={() => onInspect(null)}
            draggable={phase === "plan"}
            onDragStart={(event) => onFormationDragStart(event, formation.id)}
            onDragEnd={onFormationDragEnd}
            aria-label={`${formation.name}, ${assignedStop ? tacticalTerm(formation.role) : "unassigned"}, at ${node.label}${formationFate ? `, ${formationFate.battleLabel}` : consequence ? `, ${consequence.label} after ${consequence.cause}` : ""}`}
          >
            <FormationPortrait formation={formation} />
            <span className="map-formation-number">{assignedRoleIndex >= 0 ? actionStopBadge(assignedRoleIndex) : "—"}</span>
            <span className="map-formation-label">{formation.name}</span>
              {routeReadiness && (phase === "plan" || phase === "drill") && (
                <span className="map-route-fit assigned">
                  <b>ASSIGNED ACTION STOP</b>
                  <small>{actionStopLabel(assignedRoleIndex)} · {routeReadiness.roleLabel}</small>
                  {authoredRoute && <em className={`movement-route-chip movement-${authoredRoute.movementRouteKind}`}>{authoredRoute.movementRouteLabel}</em>}
                </span>
              )}
            {activeInteraction && interaction && <span className={`map-formation-interaction active ${interactionDirection}`}><Radio weight="fill" /> ACTIVE AT RENDEZVOUS<small>{interactionDirection === "outgoing" ? `${inspectedFormation.name} FEEDS ${formation.name}` : interactionDirection === "incoming" ? `${formation.name} FEEDS ${inspectedFormation.name}` : "TWO-WAY LINK"} · {[interaction.outgoing?.condition, interaction.incoming?.condition].filter(Boolean).map(tacticalTerm).join(" / ")}</small></span>}
            {statusDisplay && <span className="map-formation-state"><b>{statusDisplay.label}</b><small>{statusDisplay.detail}</small></span>}
          </button>
        );
      })}

      {playbackActive && consequences.active.length > 0 && (
        <div className={`battle-consequence-ledger ${hasPlayerFocus ? "observing" : "overview"}`} aria-live="polite">
          <span>FIELD CONSEQUENCES · PERSISTENT</span>
          {consequences.active.map((consequence) => {
            const formation = formations.find((item) => item.id === consequence.formationId);
            return (
              <div className={`state-${consequence.state}`} key={consequence.formationId}>
                <b>{formation?.name ?? consequence.formationId}</b>
                <em>{consequence.label}</em>
                <small>{consequence.cause}</small>
              </div>
            );
          })}
        </div>
      )}

      {playbackActive && <BattleStateLegend />}
      </div>
      {!showingRouteMap && <PlaybookBoard active={planReady} assignments={assignments} battleTime={battleTime} condition={condition} drillStep={drillStep} draggingFormationId={draggingFormationId} feedback={placementFeedback} formations={formations} handoffs={handoffs} inspected={inspected} onChooseRole={onChooseRole} onAssignFormation={onAssignFormation} onClearRole={onClearRole} onFormationDragStart={onFormationDragStart} onFormationDragEnd={onFormationDragEnd} onInspectFormation={onInspect} onRoutePreview={onRoutePreview} onSelectFormation={onSelect} onStaffExercise={onStaffExercise} onViewRouteMap={() => setRouteMapOpen(true)} outputs={outputs} phase={phase} playbook={playbook} profile={profile} readiness={readiness} refitProtocols={refitProtocols} selected={selected} staffExerciseIndex={staffExerciseIndex} />}
      {phase === "drill" && (
        <div className="drill-status" role="status">
          <Play weight="fill" />
          <div><span>GHOST DRILL {Math.min(drillStep + 1, drillSteps.length)} / {drillSteps.length}</span><b>{drillSteps[Math.min(drillStep, drillSteps.length - 1)]}</b></div>
        </div>
      )}
      {playbackActive && (
        <BattlePlaybackDirector
          beat={playbackBeat}
          beats={playbackBeats}
          index={playbackIndex}
          playing={playbackPlaying}
          onToggle={onPlaybackToggle}
          onStep={onPlaybackStep}
          onReplay={onPlaybackReplay}
          phase={phase}
        />
      )}
    </section>
  );
}

function BattlePlaybackDirector({ beat, beats, index, playing, onToggle, onStep, onReplay, phase }) {
  if (!beat) return null;
  const atStart = index === 0;
  const atEnd = index === beats.length - 1;
  return (
    <div className={`battle-playback-director ${beat.kind} route-${beat.routeState ?? "none"}`}>
      <div className="playback-narration" role="status" aria-live="polite" key={beat.id}>
        <div className="playback-heading">
          <span>{beat.eyebrow}</span>
          <em>BEAT {String(index + 1).padStart(2, "0")} / {String(beats.length).padStart(2, "0")}</em>
        </div>
        <b>{beat.title}</b>
        <p>{beat.detail}</p>
        {beat.resolution && (
          <div className={`playback-resolution outcome-${beat.resolution.outcome}`}>
            {Number.isFinite(beat.resolution.playerScore) ? (
              <>
                <span><small>WARHOST</small><b>{beat.resolution.playerScore}</b></span>
                <em>VS</em>
                <span><small>ENEMY ORDER</small><b>{beat.resolution.enemyScore}</b></span>
                <strong>{beat.resolution.label}</strong>
              </>
            ) : <strong>{beat.resolution.label} · UPSTREAM ORDER BROKEN</strong>}
            <p>{beat.resolution.factors.filter((factor) => factor.score > 0).map((factor) => `${factor.label} +${factor.score}`).join(" · ") || beat.resolution.verdict}</p>
            {beat.resolution.missingCapabilities.length > 0 && <small>MISSING ANSWER · {beat.resolution.missingCapabilities.join(" / ")}</small>}
          </div>
        )}
        {beat.statusChanges?.length > 0 && (
          <div className="playback-status-changes" aria-label="Formation status changes">
            <span>FORMATION IMPACT</span>
            {beat.statusChanges.map((statusChange) => (
              <b className={`state-${statusChange.state}`} key={`${statusChange.formationId}-${statusChange.label}`}>
                {statusChange.formationName}<em>{statusChange.label}</em>
              </b>
            ))}
          </div>
        )}
      </div>
      <div className="playback-transport" aria-label="Battle playback controls">
        <button className="playback-previous" onClick={() => onStep(-1)} disabled={atStart} aria-label="Previous battle beat"><ArrowRight weight="bold" /></button>
        <button className="playback-toggle" onClick={onToggle} disabled={phase === "complete" && atEnd} aria-label={playing ? "Pause battle playback" : "Play battle playback"}>
          {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
          <span>{playing ? "PAUSE" : "PLAY"}</span>
        </button>
        <button onClick={() => onStep(1)} disabled={atEnd} aria-label="Next battle beat"><ArrowRight weight="bold" /></button>
        <button className="playback-replay" onClick={onReplay} aria-label="Replay battle from the beginning"><ArrowCounterClockwise weight="bold" /><span>REPLAY</span></button>
      </div>
      <div className="playback-timeline" aria-label="Battle beat timeline">
        {beats.map((item, beatIndex) => (
          <button
            key={item.id}
            className={`${beatIndex === index ? "current" : ""} ${beatIndex < index ? "resolved" : ""} ${item.kind}`}
            onClick={() => onStep(beatIndex - index)}
            aria-label={`Go to beat ${beatIndex + 1}: ${item.title}`}
            aria-current={beatIndex === index ? "step" : undefined}
            title={item.title}
          />
        ))}
      </div>
    </div>
  );
}

// The planning-phase view of the enemy plan. Every order carries the capabilities that
// break it; before this board that data only surfaced in the debrief, as an explanation
// of a result the player could no longer change. Here it is a decision surface: what is
// coming, what it costs, what breaks it, and whether the current placement holds that.
// Outcomes stay sealed — this reports capability coverage, never a resolution.
function EnemyCounterBoard({ operation, playbook, assignments, formations, condition }) {
  const board = useMemo(
    () => enemyCounterBoardFor({ operation, playbook, assignments, formations, condition }),
    [assignments, condition, formations, operation, playbook],
  );
  const summary = counterBoardSummary(board);
  return (
    <div className="intel-block enemy-counter-board">
      <span className="panel-label">ENEMY PLAYBOOK · COUNTER-BOARD</span>
      <div className="enemy-doctrine-title"><Target weight="duotone" /><span><b>{board.name}</b><small>{board.intent}</small></span></div>
      {board.objective && <p className="enemy-objective"><b>ENEMY OBJECTIVE</b>{board.objective}</p>}
      <div className="counter-coverage" role="status" aria-live="polite">{summary}</div>
      <ol className="counter-order-list">
        {board.orders.map((order) => (
          <li key={order.id} className={`counter-order coverage-${order.coverage}`}>
            <header>
              <span className="counter-order-number">{order.number}</span>
              <span className={`counter-tier tier-${order.disclosure.tier.toLowerCase()}`}>{order.disclosure.label}</span>
              <span className="counter-clock">{order.clock === null ? "TIMING UNCONFIRMED" : `T+${fmtDuration(order.clock)}`}</span>
            </header>
            <b className="counter-order-label">{order.label}{order.enemyName ? <em> · {order.enemyName}</em> : null}</b>
            {order.cost
              ? <small className="counter-cost"><Warning weight="duotone" /> {order.cost}</small>
              : <small className="counter-cost sealed">COST UNCONFIRMED</small>}
            {order.counters
              ? (
                <div className="counter-capabilities">
                  <span>BREAKS IT</span>
                  {order.counters.map((capability) => (
                    <b key={capability} className={order.answeredCapabilities.includes(capability) ? "held" : "missing"}>
                      {tacticalTerm(capability)}
                    </b>
                  ))}
                </div>
              )
              : <div className="counter-capabilities dark"><span>BREAKS IT</span><b className="unknown">NOT SCOUTED</b></div>}
            <ul className="counter-responders">
              {order.responders.map((responder) => (
                <li key={responder.stopIndex} className={responder.formationId ? responder.answers.length > 0 ? "answers" : "present" : "empty"}>
                  <span>{responder.stopLabel}</span>
                  <b>{responder.formationName ?? "UNSTAFFED"}</b>
                  <small>{responder.answers.length > 0 ? responder.answers.map(tacticalTerm).join(" · ") : "NO COUNTER HELD"}</small>
                </li>
              ))}
            </ul>
            <p className="counter-guidance">{order.guidance}</p>
          </li>
        ))}
      </ol>
      <small className="prototype-note">
        SCOUTED BEFORE COMMITMENT · RESOLUTION STAYS SEALED UNTIL EXECUTION. A DARK ORDER IS WHAT A COMMAND SEAL IS FOR.
      </small>
    </div>
  );
}

function EnemyPlanIntel({ battleTime, operation, phase, planReady, blindTestActive, clashes, profile }) {
  const enemyPlan = enemyPlanFor(operation);
  const reinforcementWave = reinforcementWaveFor(operation, profile.condition);
  const collision = profile.enemyCollision;
  const collisionSource = FORMATIONS.find((formation) => formation.id === collision?.sourceId);
  const collisionReceiver = FORMATIONS.find((formation) => formation.id === collision?.receiverId);
  const planningSealed = phase === "plan" || phase === "drill";
  return (
    <div className="intel-block enemy-plan-intel">
      <span className="panel-label">ENEMY PLAYBOOK · EXECUTES IN PARALLEL</span>
      <div className="enemy-doctrine-title"><Target weight="duotone" /><span><b>{enemyPlan.name}</b><small>{enemyPlan.intent}</small></span></div>
      {operation.id === "ashen-passage" && (
        <div className={`enemy-collision-readout ${collision?.outcome ?? "unread"}`} aria-live="polite">
          <span><Crosshair weight="duotone" /> PLAN COLLISION · STOP 01/02</span>
          <b>{planningSealed ? "COLLISION WINDOW SEALED" : collision?.title ?? "COLLISION WINDOW UNRESOLVED"}</b>
          <small>{planningSealed ? "The opposing plans collide here; the outcome resolves during execution." : collision?.summary ?? "Staff Stop 01 and Stop 02 to reveal how the two plans collide."}</small>
          {!planningSealed && collision?.revealed && <em>{collisionSource?.name} → {collisionReceiver?.name}{collision.actorName ? ` · ${collision.actorName}` : " · NO AUTOMATIC REACTION"}</em>}
        </div>
      )}
      <div className="enemy-chain">
        {clashes.map((clash, index) => {
          const resolved = (phase === "battle" || phase === "complete") && battleTime >= clash.actionAt;
          const revealed = resolved;
          const state = !revealed ? "unread" : clash.routeState === "passed" ? "threat" : clash.routeState;
          return (
            <Fragment key={clash.id}>
              <div className={`enemy-chain-step ${state} ${resolved ? "resolved" : ""}`}>
                <span className="enemy-step-number">E{index + 1}</span>
                <span className="enemy-step-copy">
                  <em>{clash.intelligence}</em>
                  <b>{clash.label}</b>
                  <small>{clash.uses ? `${clash.uses} → ` : "CREATES "}{clash.creates}</small>
                </span>
                <span className="enemy-step-result">
                  {!revealed
                    ? "OUTCOME UNREAD"
                    : clash.resultText}
                </span>
                {revealed && clash.resolution && (
                  <span className={`enemy-resolution-summary outcome-${clash.resolution.outcome}`}>
                    <b>{Number.isFinite(clash.resolution.playerScore) ? `WARHOST ${clash.resolution.playerScore} vs ORDER ${clash.resolution.enemyScore}` : "UPSTREAM CHAIN"}</b>
                    <em>{clash.resolution.label}</em>
                    <small>{clash.resolution.factors.filter((factor) => factor.score > 0).slice(0, 3).map((factor) => factor.label).join(" · ") || clash.resolution.verdict}</small>
                  </span>
                )}
              </div>
              {index < clashes.length - 1 && <ArrowRight className="enemy-chain-arrow" weight="bold" />}
            </Fragment>
          );
        })}
      </div>
      <div className={`reinforcement-order ${!planningSealed && planReady && profile.overrun === 0 ? "avoided" : "threat"}`}>
        <span className="enemy-step-number">{reinforcementWave.number}</span>
        <span className="enemy-step-copy">
          <em>ARRIVES T+{fmtDuration(reinforcementWave.arrivalAt)}</em>
          <b>{reinforcementWave.name}</b>
          <small>{reinforcementWave.approach}</small>
        </span>
        <span className="enemy-step-result">
          {planningSealed ? "FORECAST SEALED" : !planReady ? "CONTINGENCY UNREAD" : profile.overrun > 0 ? `${reinforcementForecast(profile)} · ${profile.reinforcementLoss} RECOVERY LOST` : `${reinforcementForecast(profile)} · CONTACT AVOIDED`}
        </span>
      </div>
    </div>
  );
}

function MissionConditionSelector({ condition, locked, operation, phase, onCondition }) {
  const visibleConditions = locked ? [condition] : missionPressuresForOperation(operation.id);
  return (
    <div className="intel-block condition-intel">
      <span className="panel-label">MISSION PRESSURE · {locked ? "ASSIGNED BY OPERATION" : "DISCLOSED BEFORE DEPLOYMENT"}</span>
      <div className="condition-options" role="group" aria-label="Prototype mission pressure">
        {visibleConditions.map((item) => (
          <button
            key={item.id}
            className={condition.id === item.id ? "selected" : ""}
            onClick={() => onCondition(item.id)}
            disabled={locked || phase !== "plan"}
            aria-pressed={condition.id === item.id}
          >
            <b>{item.name}</b>
            <small>{item.brief}</small>
          </button>
        ))}
      </div>
      <p className="condition-effect"><Warning weight="duotone" /><span><b>{condition.name}</b>{condition.effect}</span></p>
      <small className="prototype-note">{locked ? "FIXED FOR THIS OPERATION · ADAPT PLACEMENT AND REFITS TO THE FIELD." : "PROTOTYPE SWITCH · A FULL CAMPAIGN ASSIGNS ONE PRESSURE FROM THE TWO DISPOSITIONS BEFORE PLAYBOOK SELECTION."}</small>
    </div>
  );
}

function IntelRail({ phase, battleTime, condition, onCondition, operation, planReady, blindTestActive, rescueComplete, playbook, assignments, formations, assignedCount, formationCount, integrity, profile }) {
  const planningSealed = phase === "plan" || phase === "drill";
  // Against the fielded force, not the whole roster. `extractedCount` is capped at the
  // number deployed, so dividing by the nine-formation roster made a full extraction read
  // as 5 / 9 and the readout's own ceiling unreachable.
  const deployedCount = profile.readiness.staffedCount;
  const forecast = profile.overrun > 0
    ? `${profile.extractedCount} / ${deployedCount} EXTRACT · WAVE ${fmtDuration(profile.overrun)} EARLY`
    : `${profile.extractedCount} / ${deployedCount} EXTRACT · ${fmtDuration(profile.timeSaved)} CLEAR`;
  return (
    <section className="right-rail" aria-label="Mission outlook and enemy intelligence">
      <MissionConditionSelector condition={condition} locked={operation.conditionLocked} operation={operation} phase={phase} onCondition={onCondition} />
      {/* During planning the counter-board is the surface the player acts on, so it sits
          directly under the pressure and above the outlook rather than below the fold. */}
      {planningSealed && <EnemyCounterBoard operation={operation} playbook={playbook} assignments={assignments} formations={formations} condition={condition} />}
      <div className="intel-block">
        <span className="panel-label">MISSION OUTLOOK</span>
        <strong className={planningSealed ? "sealed" : planReady ? profile.overrun > 0 ? "at-risk" : "viable" : "at-risk"}>{planningSealed && planReady ? "OUTCOME SEALED · COMMIT TO REVEAL" : planReady ? forecast : `${assignedCount} / ${formationCount} AVAILABLE ASSIGNED`}</strong>
        <div className="campaign-integrity-readout">
          <span>WARHOST INTEGRITY</span>
          <IntegrityMeter value={integrity} />
          <small>DEFEAT WITH 2+ EXTRACTED −1 · ONE EXTRACTED −2 · ZERO EXTRACTED −3 · ZERO ENDS THE RUN</small>
        </div>
        {formationCount < FORMATIONS.length && <p className="campaign-shortfall"><Warning weight="fill" /> {FORMATIONS.length - formationCount} FORMATION MISSING · LEAVE AN AUTHORED STOP EMPTY</p>}
        <p><b>{playbook.name}:</b> {playbook.intent}</p>
        <div className={`doctrine-outlook ${planningSealed ? "sealed" : profile.doctrine.triggered ? "triggered" : "exposed"}`}>
          <span>TACTICAL DOCTRINE · {profile.doctrine.name}</span>
          <b>{planningSealed ? "RESULT UNRESOLVED" : profile.doctrine.result}</b>
          <small>{planningSealed ? "The playbook will be tested against the enemy plan during execution." : profile.doctrine.triggered ? "The selected playbook's advantage is active." : "The selected playbook's exposure remains active."}</small>
        </div>
        {profile.readiness.staffedCount > 0 && (
          <div className={`readiness-impact ${planningSealed ? "sealed" : "aligned"}`}>
            <span>FORMATION COMMAND</span>
            <b>{planningSealed ? "ORDERS ASSIGNED · RESULTS SEALED" : `${profile.effects.length} COMBO CHAINS · ${profile.enemyClashes.filter((clash) => clash.disrupted).length} ENEMY ORDERS BROKEN`}</b>
            <small>{planningSealed ? "EVERY FORMATION MAY CARRY ANY ORDER. EQUIPMENT, ROUTE EXPOSURE, AND RENDEZVOUS TIMING RESOLVE UNDER CONTACT." : "NO BINARY ROUTE-FIT PENALTY. THE RESULT CAME FROM THE FORCE'S ACTUAL COLLISIONS WITH THE ENEMY PLAN."}</small>
          </div>
        )}
        {planReady && !planningSealed && (
          <div className={`extraction-breakdown ${profile.extractedCount >= operation.requiredExtraction ? "viable" : profile.extractedCount > 0 ? "costly" : "broken"}`}>
            <span>EXTRACTION BREAKDOWN</span>
            <b>{profile.reserveCapacity} CAPACITY − {profile.reinforcementLoss} WAVE − {profile.enemyRecoveryLoss} ROUTE = {profile.extractedCount} CLEAR</b>
            <small>{profile.recoveryLossPrevented > 0 ? `${profile.recoveryRoleProtection.formationName} ABSORBED 1 ROUTE LOSS AT THE RECOVERY ELEMENT.` : "THE ENEMY WAVE REMOVES ONE RECOVERY SLOT PER COMPLETE 30 SECONDS OF CONTACT."}</small>
          </div>
        )}
        {!planningSealed && profile.protocols.length > 0 && (
          <div className="refit-protocol-impact">
            <span>ASHEN FIELD PROTOCOL{profile.protocols.length > 1 ? "S" : ""} ONLINE</span>
            {profile.protocols.map((protocol) => <b key={protocol.formationId}>{protocol.name} · {protocol.formationName}</b>)}
            {profile.protocols.map((protocol) => <em key={`${protocol.formationId}-impact`}>{protocolImpactText(protocol.impact)}</em>)}
            <small>THE INSTALLED PACKAGE FOUND A BATTLEFIELD INTERFACE AND ALTERED THE MISSION FORECAST.</small>
          </div>
        )}
        {!planReady && phase === "plan" && <p className="assignment-pointer"><ArrowRight weight="bold" /> Place formations on the authored tactical route.</p>}
      </div>
      {/* Planning gets the counter-board above (what is coming and what breaks it);
          execution gets the clash chain (what actually happened). The old chain showed
          "OUTCOME UNREAD" three times during planning: accurate and useless. */}
      {!planningSealed && <EnemyPlanIntel battleTime={battleTime} operation={operation} phase={phase} planReady={planReady} blindTestActive={blindTestActive} clashes={profile.enemyClashes} profile={profile} />}
      <div className="intel-block victory-block">
        <span className="panel-label">VICTORY CONDITION</span>
        <Factory weight="duotone" />
        <p>{operation.victory}</p>
        <small>Annihilating the enemy is not required.</small>
      </div>
      <div className="intel-block objective-progress">
        <span className="panel-label">MISSION STATE</span>
        <ProgressRow label={operation.controlProgress[0]} done={battleTime >= profile.alphaAt} />
        <ProgressRow label={operation.controlProgress[1]} done={battleTime >= profile.betaAt} />
        <ProgressRow label={operation.primaryProgress} done={battleTime >= profile.reactorAt} />
        <ProgressRow label={operation.optionalTitle.replace("RECOVER ", "")} done={rescueComplete} optional />
        <ProgressRow label="Extraction" done={phase === "complete"} />
      </div>
    </section>
  );
}

function ProgressRow({ label, done, optional = false }) {
  return (
    <div className={`progress-row ${done ? "done" : ""}`}>
      {done ? <CheckCircle weight="fill" /> : <MapPin weight="duotone" />}
      <span>{label}{optional ? " · optional" : ""}</span>
    </div>
  );
}

function IntegrityMeter({ value, max = 3 }) {
  const safeValue = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
  return (
    <div className="integrity-meter" aria-label={`${safeValue} of ${max} Warhost Integrity remaining`}>
      <strong>{safeValue} / {max}</strong>
      <span>{Array.from({ length: max }, (_, index) => <Shield key={index} weight={index < safeValue ? "fill" : "thin"} />)}</span>
    </div>
  );
}

function FooterControls({ phase, seals, drillComplete, onDrill, onCommit, onReset, operation, planReady, blindTestActive, blindPrediction, branches, onBranch }) {
  const breakpoints = breakpointsFor(operation);
  const breakpointImpacts = breakpointImpactsFor(operation);
  return (
    <footer className="mission-footer">
      <div className="contingency-block">
        <span className="panel-label">AUTHORED BREAKPOINTS · OVERRIDE COSTS 1 COMMAND SEAL</span>
        <div className="contingencies">
          {breakpoints.map((breakpoint, index) => {
            const selectedOption = breakpoint.options.find((option) => option.id === branches[breakpoint.id]);
            const impact = breakpointImpacts[breakpoint.id][selectedOption.id];
            return (
            <div className="breakpoint" key={breakpoint.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p>{breakpoint.trigger}</p>
                <div className="branch-options">
                  {breakpoint.options.map((option) => (
                    <button
                      key={option.id}
                      className={branches[breakpoint.id] === option.id ? "selected" : ""}
                      onClick={() => onBranch(breakpoint.id, option.id)}
                      disabled={phase !== "plan"}
                      aria-pressed={branches[breakpoint.id] === option.id}
                      title={`${option.routeLabel}: ${option.effect}`}
                    >{option.label}</button>
                  ))}
                </div>
                <small className="branch-impact"><b>{selectedOption.routeLabel}</b> · {impact.text}</small>
              </div>
            </div>
            );
          })}
        </div>
      </div>
      <div className="seals-block">
        <span className="panel-label">COMMAND SEALS · CHANGE AN AUTHORED ORDER</span>
        <div className="seals-visual">
          <strong>{seals}</strong>
          <div>{[0, 1].map((index) => <Seal key={index} weight={index < seals ? "duotone" : "thin"} />)}</div>
        </div>
        <small><b>TIME IS SURVIVAL.</b> Beat the enemy wave to extraction to preserve formations and Warhost Integrity. Speed awards no bonus resources.</small>
      </div>
      <div className="primary-controls">
        {phase === "plan" || phase === "drill" ? (
          <>
            <button className={`ghost-button ${drillComplete ? "complete" : ""}`} onClick={onDrill} disabled={blindTestActive || phase === "drill" || !planReady}>
              {phase === "drill" ? <Pause weight="fill" /> : drillComplete ? <CheckCircle weight="fill" /> : <Play weight="fill" />}
              <span><b>{blindTestActive ? "DRILL LOCKED" : phase === "drill" ? "RUNNING GHOST DRILL" : drillComplete ? "DRILL VERIFIED" : "RUN GHOST DRILL"}</b><small>{blindTestActive ? "Blind test keeps the outcome hidden." : "Preview routes, triggers, and timing."}</small></span>
            </button>
            <button className="commit-button" onClick={onCommit} disabled={!planReady || (blindTestActive && !blindPrediction)}>
              <span><b>COMMIT PLAYBOOK</b><small>{!planReady ? "Staff every action stop first." : blindTestActive && !blindPrediction ? "Predict the result before commitment." : "Execute staffed roles and authored branches."}</small></span>
              <ArrowRight weight="bold" />
            </button>
          </>
        ) : (
          <button className="reset-button" onClick={onReset}>
            <ArrowCounterClockwise weight="bold" />
            <span><b>{phase === "complete" ? "RUN MISSION AGAIN" : "ABORT & RESET"}</b><small>Return to deployment planning.</small></span>
          </button>
        )}
      </div>
    </footer>
  );
}

function DecisionOverlay({ decision, seals, branches, operation, onResolve }) {
  const dialogRef = useModalFocus(Boolean(decision));
  if (!decision) return null;
  const breakpoint = breakpointsFor(operation).find((item) => item.id === decision);
  const breakpointImpacts = breakpointImpactsFor(operation);
  const authored = breakpoint.options.find((option) => option.id === branches[decision]);
  const alternative = breakpoint.options.find((option) => option.id !== branches[decision]);
  return (
    <div className="decision-backdrop" role="dialog" aria-modal="true" aria-labelledby="decision-title" ref={dialogRef}>
      <div className="decision-panel">
        <div className="decision-icon"><Radio weight="duotone" /></div>
        <p className="eyebrow">PLAYBOOK BREAKPOINT</p>
        <h2 id="decision-title">{breakpoint.title}</h2>
        <p>{breakpoint.description}</p>
        <div className="authored-order"><span>AUTHORED ORDER</span><b>{authored.label}</b><small>{authored.effect}</small></div>
        <div className="decision-route-compare">
          <span className="panel-label">HOW THE PLAN CHANGES</span>
          {breakpoint.options.map((option) => {
            const isAuthored = option.id === branches[decision];
            const impact = breakpointImpacts[decision][option.id];
            return (
              <div className={isAuthored ? "authored" : "alternate"} key={option.id}>
                <strong>{isAuthored ? "AUTHORED PATH" : "IF OVERRIDDEN"}</strong>
                <b>{option.routeLabel}</b>
                <span>{option.path.map((step, index) => <Fragment key={step}>{index > 0 && <ArrowRight weight="bold" />}<em>{step}</em></Fragment>)}</span>
                <small className="decision-impact">{impact.text}</small>
              </div>
            );
          })}
        </div>
        <div className="decision-actions">
          <button onClick={() => onResolve("plan")}><Play weight="duotone" /><span><b>EXECUTE PLAYBOOK</b><small>{authored.label} · spend no seal.</small></span></button>
          <button className="spend-seal" onClick={() => onResolve("override")} disabled={seals <= 0}><Seal weight="duotone" /><span><b>BREAK PLAYBOOK</b><small>{alternative.label} · spend 1 seal.</small></span></button>
        </div>
      </div>
    </div>
  );
}

function FormationPicker({ role, playbook, condition, formations, assignments, onChoose, onClose }) {
  const dialogRef = useModalFocus(Boolean(role), { onEscape: onClose });
  if (!role) return null;
  const assignedFormationId = assignments[role.id];
  const roleIndex = playbook.roles.findIndex((item) => item.id === role.id);
  const roleDemands = roleDemandsFor(role, roleIndex, condition);
  const connectedFormationIds = (playbook.comboWindows ?? [])
    .filter((window) => window.from === roleIndex || window.to === roleIndex)
    .map((window) => window.from === roleIndex ? window.to : window.from)
    .map((connectedRoleIndex) => assignments[playbook.roles[connectedRoleIndex]?.id])
    .filter(Boolean);
  const formationStartOrder = new Map(formations.map((formation, index) => [formation.id, index]));
  const formationSlotOrder = new Map(
    playbook.roles
      .map((assignedRole, index) => [assignments[assignedRole.id], index])
      .filter(([formationId]) => Boolean(formationId)),
  );
  const orderedFormations = [...formations].sort((left, right) => {
    const leftSlot = formationSlotOrder.get(left.id);
    const rightSlot = formationSlotOrder.get(right.id);
    if (leftSlot !== undefined && rightSlot !== undefined) return leftSlot - rightSlot;
    if (leftSlot !== undefined) return -1;
    if (rightSlot !== undefined) return 1;
    return formationStartOrder.get(left.id) - formationStartOrder.get(right.id);
  });
  return (
    <div className="decision-backdrop formation-picker-backdrop" role="dialog" aria-modal="true" aria-labelledby="formation-picker-title" ref={dialogRef}>
      <div className="decision-panel formation-picker-panel">
        <p className="eyebrow">STAFF ACTION STOP</p>
        <h2 id="formation-picker-title">Who executes {role.label}?</h2>
        <p>{role.brief} Battlefield pressure: <b>{roleDemands.join(" / ")}</b>. Every formation may take this order; its equipment and battlefield method determine what happens under contact.</p>
        <div className="formation-picker-list">
          {orderedFormations.map((formation) => {
            const currentRole = playbook.roles.find((item) => assignments[item.id] === formation.id);
            const currentRoleIndex = currentRole ? playbook.roles.findIndex((item) => item.id === currentRole.id) : -1;
            const current = assignedFormationId === formation.id;
            const neighborHints = neighboringInteractionHints({
              formations,
              formationId: formation.id,
              neighborIds: connectedFormationIds.filter((formationId) => formationId !== formation.id),
            });
            return (
              <button key={formation.id} className={current ? "current" : ""} onClick={() => onChoose(formation.id)}>
                <FormationPortrait formation={formation} compact />
                <span className="picker-formation-copy">
                  <b>{formation.name}</b>
                  <span className="formation-refit-line">REFIT {formation.activeRefit.name}</span>
                  <span className="formation-capability-line">CAPABILITIES {formation.capabilities.join(" / ")}</span>
                  <span className="responsibility-match method">METHOD · {tacticalTerm(formation.role)}</span>
                  <small>{tacticalTerm(formation.role)} · {formation.purpose}</small>
                  <span className="tactic-vocabulary"><em>CREATES {tacticalTerm(formation.creates)}</em><em>USES {formation.uses.map(tacticalTerm).join(" · ")}</em></span>
                  {neighborHints.length > 0 && <span className="neighbor-interaction-hints">{neighborHints.map((hint, index) => <em key={`${hint.direction}-${hint.condition}-${index}`}><Radio weight="fill" /> {tacticalText(hint.text)}</em>)}</span>}
                  <em className={currentRole ? "assigned" : "available"}>{currentRole ? `ASSIGNED · STOP ${String(currentRoleIndex + 1).padStart(2, "0")} ${currentRole.label}` : "AVAILABLE"}</em>
                </span>
                {current ? <CheckCircle weight="fill" /> : <ArrowRight weight="bold" />}
              </button>
            );
          })}
        </div>
        <button className="picker-cancel" onClick={onClose}>{assignedFormationId ? "KEEP CURRENT PLACEMENT" : "LEAVE STOP EMPTY"}</button>
      </div>
    </div>
  );
}

function SalvageWorkshop({ baseline, choice, formations, integrity, nextOperation, onChoose, onLaunch }) {
  const dialogRef = useModalFocus(true);
  const incomingCondition = missionPressureFor(nextOperation.conditionId, nextOperation.id);
  const selectedAction = choice
    ? choice.type === "repair"
      ? `Repair ${FORMATIONS.find((formation) => formation.id === choice.formationId)?.name}.`
      : choice.type === "recover"
        ? `Recover ${FORMATIONS.find((formation) => formation.id === choice.formationId)?.name}.`
        : `Refit ${FORMATIONS.find((formation) => formation.id === choice.formationId)?.name}.`
    : "No salvage action selected. Launching unchanged is allowed.";
  const isSelected = (action) => choice?.type === action.type
    && choice?.formationId === action.formationId
    && (action.type !== "refit" || choice?.refitId === action.refitId);
  return (
    <div className="decision-backdrop workshop-backdrop" role="dialog" aria-modal="true" aria-labelledby="workshop-title" ref={dialogRef}>
      <div className="decision-panel workshop-panel">
        <div className="workshop-heading">
          <div>
            <p className="eyebrow">INTERMISSION · SCRAPBORN SALVAGE BAY</p>
            <h2 id="workshop-title">Carry the detachment forward.</h2>
            <p>Serious battlefield consequences persist. Spend one salvage action to repair damage, recover a missing formation, or install one refit. The other consequences carry forward.</p>
          </div>
          <div className={`salvage-token ${choice ? "spent" : "available"}`}>
            <Wrench weight="duotone" />
            <span><b>{choice ? "0 / 1" : "1 / 1"}</b><small>SALVAGE ACTION REMAINING</small></span>
          </div>
        </div>
        <div className="incoming-operation">
          <span>INCOMING OPERATION</span>
          <b>{nextOperation.name}</b>
          <small>{nextOperation.victory}</small>
          <em>{incomingCondition.name} · {incomingCondition.effect}</em>
        </div>
        <div className="workshop-integrity">
          <span><b>WARHOST INTEGRITY CARRIED FORWARD</b><small>Another defeat or rout may end the run before the final operation.</small></span>
          <IntegrityMeter value={integrity} />
        </div>
        <div className="workshop-formations">
          {formations.map((formation) => {
            const baseFormation = FORMATIONS.find((item) => item.id === formation.id);
            const carriedRefit = baseFormation.refits.find((refit) => refit.id === baseline.refits[formation.id]);
            const campaignCondition = formation.campaignCondition;
            return (
              <div className={`workshop-formation ${choice?.formationId === formation.id ? "changed" : ""} ${campaignCondition?.state ?? "ready"}`} key={formation.id}>
                <FormationPortrait formation={formation} compact />
                <div className="workshop-formation-copy">
                  <b>{formation.name}</b>
                  <small>CARRIES {carriedRefit.name}</small>
                  {campaignCondition && <em className={`workshop-condition ${campaignCondition.state}`}>{campaignCondition.label}{formation.disabledCapability ? ` · ${formation.disabledCapability} OFFLINE` : " · UNAVAILABLE"}</em>}
                </div>
                <div className="workshop-actions">
                  {campaignCondition?.state === "damaged" && (
                    <button
                      className={`workshop-recovery-action ${isSelected({ type: "repair", formationId: formation.id }) ? "selected" : ""}`}
                      onClick={() => onChoose({ type: "repair", formationId: formation.id })}
                      aria-pressed={isSelected({ type: "repair", formationId: formation.id })}
                    >
                      <b>REPAIR DAMAGE</b><small>Restore {formation.disabledCapability} for the next operation.</small>
                    </button>
                  )}
                  {campaignCondition?.state === "missing" ? (
                    <button
                      className={`workshop-recovery-action ${isSelected({ type: "recover", formationId: formation.id }) ? "selected" : ""}`}
                      onClick={() => onChoose({ type: "recover", formationId: formation.id })}
                      aria-pressed={isSelected({ type: "recover", formationId: formation.id })}
                    >
                      <b>RECOVER FORMATION</b><small>Return this formation to the next authored plan.</small>
                    </button>
                  ) : baseFormation.refits.map((refit) => {
                    const action = { type: "refit", formationId: formation.id, refitId: refit.id };
                    const carried = refit.id === baseline.refits[formation.id];
                    return (
                      <button
                        key={refit.id}
                        className={`${carried ? "carried" : ""} ${isSelected(action) ? "selected" : ""}`}
                        onClick={() => onChoose(action)}
                        disabled={carried}
                        aria-pressed={isSelected(action)}
                      >
                        <b>{refit.name}</b>
                        <small>{carried ? "INSTALLED" : `${refit.capabilities.join(" / ")} · CREATES ${tacticalTerm(refit.creates)}`}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="workshop-footer">
          <span>{selectedAction} Any missing formation leaves one playbook stop empty.</span>
          <button className="commit-button" onClick={onLaunch}><span><b>LAUNCH ASHEN PASSAGE</b><small>Lock the campaign state and return to tactical planning.</small></span><ArrowRight weight="bold" /></button>
        </div>
      </div>
    </div>
  );
}

function CompletionOverlay({ formations, formationFates, canContinue, campaignDestroyed, integrityBefore, integrityLoss, integrityAfter, operation, rescued, usedSeals, playbook, profile, readiness, handoffs, strategyTrial, blindTestActive, blindPrediction, won, onAction }) {
  const dialogRef = useModalFocus(true);
  // Losses are counted against what was fielded. Subtracting from the whole roster
  // reported four reserve formations as casualties of an operation they sat out.
  const lostCount = Math.max(0, profile.readiness.staffedCount - profile.extractedCount);
  const effectiveness = useMemo(() => {
    const rows = formationEffectivenessFor({ readiness, clashes: profile.enemyClashes, handoffs, playbook });
    return { rows, summary: effectivenessSummary(rows) };
  }, [handoffs, playbook, profile.enemyClashes, readiness]);
  // Placement is the deciding lever, so the debrief has to say plainly what it cost.
  // Concealment belongs before commitment; after the fact an unexplained loss is just
  // an unexplained loss.
  const placementCostTotal = profile.readiness.placements.reduce((sum, placement) => sum + (placement.taskDelay ?? 0), 0);
  const placementCost = {
    total: placementCostTotal,
    // Counted in demands rather than formations: most stops ask for two capabilities
    // that no single formation carries, so "formations that fell short" would read as
    // total failure even for a well matched plan.
    unanswered: profile.readiness.placements.reduce((sum, placement) => sum + placement.unansweredDemands.length, 0),
    demanded: profile.readiness.placements.reduce((sum, placement) => sum + placement.demands.length, 0),
    // The wave removes a slot per complete 30s of OVERRUN, not per 30s of placement
    // delay. The two coincide only when the plan had no time buffer, so dividing the
    // delay claimed losses at the wave that the wave never took.
    extractionsLost: profile.reinforcementLoss,
  };
  const recoveryCarrierFate = formationFates.find(({ formation }) => formation.id === "hauler");
  const carrierCutOffAfterRescue = rescued && recoveryCarrierFate?.history?.some(({ state }) => state === "cut-off");
  const disruptedEnemyOrders = profile.enemyClashes.filter((clash) => clash.disrupted).length;
  const finalConsequences = battlefieldConsequencesAt({ clashes: profile.enemyClashes, battleTime: profile.completeAt });
  const reinforcementWave = reinforcementWaveFor(operation, profile.condition);
  const timingResult = profile.overrun > 0
    ? `The ${reinforcementWave.name} reached ${operation.extractionTitle} ${profile.overrun} seconds before extraction cleared.`
    : profile.timeSaved > 0
    ? `The Warhost cleared extraction ${profile.timeSaved} seconds before the enemy wave arrived.`
    : "The Warhost cleared the gantry as the enemy wave arrived.";
  const readinessResult = `${profile.readiness.staffedCount} formation orders were assigned. No generic route-fit modifier was applied; each formation resolved with its own equipment, endurance, combo conditions, and enemy contact.`;
  const protocolResult = profile.protocols.length > 0
    ? `Active Ashen field protocols: ${profile.protocols.map((protocol) => protocol.name).join(", ")}.`
    : "No installed refit found an Ashen field interface.";
  const engagementResult = `Engagements: ${profile.enemyClashes.map((clash) => `${clash.label} ${clash.resolution?.label ?? "UNRESOLVED"}${Number.isFinite(clash.resolution?.playerScore) ? ` ${clash.resolution.playerScore}-${clash.resolution.enemyScore}` : ""}`).join(", ")}.`;
  const fieldStateResult = finalConsequences.active.length > 0
    ? `Final field states: ${finalConsequences.active.map((consequence) => `${formations.find((formation) => formation.id === consequence.formationId)?.name ?? consequence.formationId} ${consequence.label}`).join(", ")}.`
    : "No formation carried a battlefield consequence into extraction.";
  const victoryGrade = victoryGradeFor({
    won,
    extractedCount: profile.extractedCount,
    requiredExtraction: operation.requiredExtraction,
    totalFormations: formations.length,
    formationFates,
  });
  const outcomeLabel = victoryGrade?.eyebrow ?? (campaignDestroyed ? "CAMPAIGN DEFEAT" : canContinue ? "COSTLY CONTINUATION" : "OPERATION FAILED");
  const outcomeBanner = victoryGrade?.label ?? (campaignDestroyed ? "WARHOST BROKEN" : canContinue ? "WITHDRAWAL" : "DEFEAT");
  const outcomeTone = victoryGrade?.tone ?? (campaignDestroyed ? "defeat" : canContinue ? "costly" : "defeat");
  const outcomeTitle = won
    ? `${operation.shortName} is secured.`
    : campaignDestroyed
      ? "Warhost Integrity is exhausted."
      : canContinue
        ? `${operation.shortName} was lost—but the campaign continues.`
        : `${operation.shortName} was lost.`;
  const trialResult = strategyTrialResult(strategyTrial, profile.extractedCount);
  const blindResult = blindPredictionResult({ predictionId: blindPrediction, extractedCount: profile.extractedCount, requiredExtraction: operation.requiredExtraction });
  const strategyOutcomeStory = strategyOutcomeStoryFor({ profile, requiredExtraction: operation.requiredExtraction });
  const strategyCausality = strategyCausalityFor({ profile, requiredExtraction: operation.requiredExtraction });
  const actionLabel = blindTestActive ? "REPEAT BLIND TEST" : strategyTrial ? "RETURN TO STRATEGY TEST" : canContinue ? "ENTER SALVAGE WORKSHOP" : campaignDestroyed ? "BEGIN NEW CAMPAIGN" : "RETURN TO BATTLEFIELD";
  const actionDetail = blindTestActive
    ? "Reset Dead Circuit and author another plan without a forecast."
    : strategyTrial
    ? "Reset Dead Circuit and load the next controlled plan."
    : canContinue
    ? won ? "Carry this detachment into the next operation." : "Withdraw, accept persistent losses, and continue the campaign."
    : campaignDestroyed ? "Warhost Integrity reached zero. This run is over." : "Inspect the completed operation state.";
  const operationResult = won
    ? `${operation.primaryResult} and ${profile.extractedCount} formations escaped.`
    : canContinue
      ? `${operation.primaryResult}, but only ${profile.extractedCount} formations cleared the timed extraction. Scattered survivors regrouped for a costly withdrawal.`
      : `${operation.primaryResult}, but only ${profile.extractedCount} formations escaped before the Warhost lost the ability to continue.`;
  return (
    <div className="decision-backdrop completion-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-title" ref={dialogRef}>
      <div className={`decision-panel completion-panel ${outcomeTone}`}>
        {won ? <CheckCircle className="completion-icon" weight="duotone" /> : <Warning className="completion-icon" weight="duotone" />}
        <p className="eyebrow">{outcomeLabel}</p>
        <div className="victory-banner">{outcomeBanner}</div>
        <h2 id="complete-title">{outcomeTitle}</h2>
        <p>{operationResult} {victoryGrade?.summary} Victory required the primary objective plus at least {operation.requiredExtraction} extracted formations.</p>
        <div className="debrief-marker">
          <Target weight="duotone" />
          <span><b>AFTER-ACTION DEBRIEF</b><small>Start here to see why your route assignments produced this result.</small></span>
        </div>
        <div className="after-action-grid">
          <div><span>PRIMARY · COMPLETE</span><b>{operation.primaryResult}</b><CheckCircle weight="fill" /></div>
          <div><span>EXTRACTION · {won ? "PASSED" : "FAILED"}</span><b>{profile.extractedCount} extracted · {operation.requiredExtraction} required</b>{won ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}</div>
          <div><span>OPTIONAL</span><b>{rescued ? "Crew rescued" : "Crew left behind"}</b>{carrierCutOffAfterRescue && <small>{profile.recoveryRoleProtection ? `${profile.recoveryRoleProtection.formationName} protected one withdrawal route before the remaining reserve was overwhelmed.` : "ARMOURED RECOVERY VEHICLE was cut off afterward."}</small>}{rescued ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}</div>
          <div><span>FORMATION ROUTE PLAN</span><b>{profile.readiness.staffedCount} / {playbook.roles.length} orders staffed</b><small>{profile.effects.length} secondary combo bonuses · {disruptedEnemyOrders} / {profile.enemyClashes.length} enemy orders broken</small><Seal weight="duotone" /></div>
          <div className={`integrity-after-action ${integrityAfter <= 0 ? "collapsed" : "holding"}`}><span>WARHOST INTEGRITY · −{integrityLoss}</span><b>{integrityBefore} → {integrityAfter} REMAINING</b><Shield weight={integrityAfter > 0 ? "fill" : "thin"} /></div>
        </div>
        {/* Per-formation effectiveness. The debrief used to explain the mission without
            ever attributing it to a unit, which is the wrong feedback for a game whose
            whole decision is which formations to field and where. Each row scores the
            three things a placement can contribute — its own stop, its combo windows,
            and the enemy orders aimed at it — and names the single change worth making. */}
        <section className="formation-effectiveness" aria-label="How effective each formation was in its position and role">
          <header>
            <span>FORMATION EFFECTIVENESS · POSITION &amp; ROLE</span>
            <small>
              LIST AVERAGE {effectiveness.summary.average}%
              {effectiveness.summary.best ? ` · BEST ${effectiveness.summary.best.formationName} ${effectiveness.summary.best.effectiveness}%` : ""}
              {effectiveness.summary.worst && effectiveness.summary.worst !== effectiveness.summary.best
                ? ` · WEAKEST ${effectiveness.summary.worst.formationName} ${effectiveness.summary.worst.effectiveness}%`
                : ""}
            </small>
          </header>
          <ol>
            {effectiveness.rows.map((row) => (
              <li className={`grade-${row.grade.toLowerCase()}`} key={row.stopNumber}>
                <span className="effectiveness-stop">STOP {String(row.stopNumber).padStart(2, "0")}</span>
                <b className="effectiveness-name">{row.formationName ?? "UNSTAFFED"}</b>
                <strong className="effectiveness-score">{row.effectiveness}%<em>{row.grade}</em></strong>
                <i className="effectiveness-bar" aria-hidden="true"><em style={{ width: `${row.effectiveness}%` }} /></i>
                {row.staffed && (
                  <div className="effectiveness-components">
                    <span className={row.fit.percent >= 100 ? "full" : row.fit.percent > 0 ? "part" : "none"}>
                      STOP FIT {row.fit.percent}%<em>{row.fit.matched}/{row.fit.demanded} demands{row.secondsConceded > 0 ? ` · +${row.secondsConceded}s` : ""}</em>
                    </span>
                    <span className={row.counter.percent >= 100 ? "full" : row.counter.percent > 0 ? "part" : "none"}>
                      COUNTER {row.counter.percent}%<em>{row.counter.carried}/{row.counter.required} vs {row.counter.orders.map((order) => order.number).join(" · ") || "—"}</em>
                    </span>
                    <span className={row.combo.percent >= 100 ? "full" : row.combo.percent > 0 ? "part" : "none"}>
                      COMBO {row.combo.percent}%<em>{row.combo.names.join(" · ") || `0/${row.combo.windows} windows`}</em>
                    </span>
                  </div>
                )}
                <small className="effectiveness-worked">{row.worked}</small>
                <small className="effectiveness-change"><ArrowRight weight="bold" /> {row.change}</small>
              </li>
            ))}
          </ol>
          {placementCost.total > 0 && (
            <p className="placement-cost-total">
              Unanswered stop demands conceded <b>{fmtDuration(placementCost.total)}</b> in total
              — {placementCost.unanswered} of {placementCost.demanded} demands went unanswered.
            </p>
          )}
          {/* The full extraction ledger. Every term that removed a formation is named
              with its cause: previously the wave term was reported as a consequence of
              placement delay (a different quantity) and the route term — usually the
              larger of the two — was never explained at all, so a player could lose
              three formations and see one of them accounted for. */}
          <ul className="extraction-ledger" aria-label="Why formations did not extract">
            <li className="ledger-start">
              <span>FIELDED</span><b>{profile.readiness.staffedCount}</b>
              <small>Formations committed to action stops. Reserves are not scored.</small>
            </li>
            <li className={profile.reinforcementLoss > 0 ? "ledger-loss" : "ledger-clear"}>
              <span>WAVE</span><b>{profile.reinforcementLoss > 0 ? `−${profile.reinforcementLoss}` : "−0"}</b>
              <small>
                {profile.overrun <= 0
                  ? `Extraction cleared ${fmtDuration(profile.timeSaved)} before ${reinforcementWave.name} arrived. No formation lost to the wave.`
                  : profile.reinforcementLoss > 0
                    ? `${reinforcementWave.name} reached the gantry ${fmtDuration(profile.overrun)} before extraction cleared — one formation per complete 30 seconds of contact.`
                    // Contact without a loss still needs saying, or a player reads an
                    // arriving wave and a −0 as a contradiction.
                    : `${reinforcementWave.name} arrived ${fmtDuration(profile.overrun)} early, under the 30 seconds of contact that costs a formation.`}
              </small>
            </li>
            <li className={profile.enemyRecoveryLoss > 0 ? "ledger-loss" : "ledger-clear"}>
              <span>ROUTE</span><b>{profile.enemyRecoveryLoss > 0 ? `−${profile.enemyRecoveryLoss}` : "−0"}</b>
              <small>
                {profile.enemyRecoveryLoss > 0
                  ? `${profile.enemyClashes.filter((clash) => clash.appliesImpact && clash.impact.recoveryLoss).map((clash) => `${clash.label} (${clash.resolution?.label ?? "LANDED"})`).join(", ") || "Enemy orders"} severed the extraction route.`
                  : "No enemy order reached the extraction route."}
                {profile.recoveryLossPrevented > 0 ? ` ${profile.recoveryRoleProtection.formationName} absorbed one of these at the recovery element.` : ""}
              </small>
            </li>
            <li className={profile.extractedCount >= operation.requiredExtraction ? "ledger-total viable" : "ledger-total broken"}>
              <span>EXTRACTED</span><b>{profile.extractedCount}</b>
              <small>{operation.requiredExtraction} required to win this operation.</small>
            </li>
          </ul>
        </section>
        <section className="strategy-outcome-story" aria-label="How your choices produced the mission result">
          <header><span>WHY YOUR PLAN {won ? "WORKED" : "FAILED"}</span><small>ROUTE ASSIGNMENTS → ENEMY RESPONSE → MISSION COST</small></header>
          <div>
            {strategyOutcomeStory.map((item, index) => (
              <Fragment key={item.id}>
                <article className={item.tone}>
                  <span>{item.label}</span>
                  <b>{item.value}</b>
                  <p>{item.detail}</p>
                </article>
                {index < strategyOutcomeStory.length - 1 && <ArrowRight weight="bold" aria-hidden="true" />}
              </Fragment>
            ))}
          </div>
        </section>
        <section className="strategy-causality" aria-label="Detailed result breakdown">
          <header>
            <span>DETAILED RESULT BREAKDOWN</span>
            <small>OPEN THE OPERATION LOG FOR FULL TIMING</small>
          </header>
          <div className="strategy-causality-chain">
            {strategyCausality.map((item, index) => (
              <div className={`strategy-cause ${item.tone}`} key={item.id}>
                <span className="strategy-cause-step">{item.step}</span>
                <span className="strategy-cause-label">{item.label}</span>
                <b>{item.value}</b>
                <p>{item.detail}</p>
                {index < strategyCausality.length - 1 && <ArrowRight className="strategy-cause-arrow" weight="bold" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </section>
        {strategyTrial && trialResult && (
          <section className="strategy-trial-result template-result">
            <span>{strategyTrial.name} STARTING PLAN · RESULT REVEALED</span>
            <b>{trialResult.extracted} FORMATIONS EXTRACTED</b>
            <p>{strategyTrial.priority} Tradeoff: {strategyTrial.sacrifice} Templates are editable aids, not predicted outcomes.</p>
          </section>
        )}
        {blindTestActive && blindResult && (
          <section className={`blind-test-result ${blindResult.accurate ? "accurate" : "surprised"}`}>
            <span>BLIND COMMAND RESULT · {blindResult.accurate ? "PREDICTION ACCURATE" : "PREDICTION MISSED"}</span>
            <div><b>PREDICTED {blindResult.prediction.label}</b><ArrowRight weight="bold" /><b>ACTUAL {blindResult.actual.label}</b></div>
            <ul>
              <li><strong>{profile.readiness.staffedCount}/{playbook.roles.length}</strong> authored route orders were staffed.</li>
              <li><strong>{profile.effects.length}</strong> combo chains formed; <strong>{disruptedEnemyOrders}/{profile.enemyClashes.length}</strong> enemy orders were broken.</li>
              <li>{profile.overrun > 0 ? <><strong>{fmtDuration(profile.overrun)}</strong> late to extraction; <strong>{profile.reinforcementLoss + profile.enemyRecoveryLoss}</strong> recovery capacity lost.</> : <><strong>{fmtDuration(profile.timeSaved)}</strong> ahead of the enemy wave.</>}</li>
            </ul>
          </section>
        )}
        <section className="formation-fate-ledger" aria-label="Formation fates">
          <header><span>FORMATION FATES · TACTICAL SLOT ORDER</span><small>{campaignDestroyed ? "The campaign is over; surviving formations cannot continue as a Warhost." : "Named outcomes at operation end."}</small></header>
          <div className="formation-fate-list">
            {formationFates.map(({ formation, fate, label, detail, history }, index) => (
              <div className={`formation-fate ${fate}`} key={formation.id}>
                <span className="formation-fate-slot">{String(index + 1).padStart(2, "0")}</span>
                <img src={formation.asset} alt="" />
                <span className="formation-fate-copy">
                  <b>{formation.name}</b>
                  <span className="formation-fate-history" aria-label={`${formation.name} status history`}>
                    {history.map((historyItem, historyIndex) => (
                      <Fragment key={`${historyItem.label}-${historyItem.at}-${historyIndex}`}>
                        {historyIndex > 0 && <i aria-hidden="true">→</i>}
                        <em className={`state-${historyItem.state}`} title={historyItem.cause}>{historyItem.label}</em>
                      </Fragment>
                    ))}
                  </span>
                  <small>{detail}</small>
                </span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
        </section>
        <details className="completion-detail-log">
          <summary>FULL OPERATION LOG</summary>
          <p className="completion-note">Doctrine result: {profile.doctrine.result}. Mission pressure: {profile.condition.name}{profile.pressureTiming ? ` (${profile.pressureTiming > 0 ? "+" : "-"}${fmtDuration(Math.abs(profile.pressureTiming))} playbook timing)` : ""}. Installed refits: {formations.map((formation) => formation.activeRefit.name).join(", ")}. {engagementResult} {fieldStateResult} {protocolResult} {timingResult} {readinessResult} {lostCount === 0 ? "Every formation was recovered." : `${lostCount} ${lostCount === 1 ? "formation did" : "formations did"} not clear extraction.`} {usedSeals === 0 ? "Both authored breakpoints held under contact." : `${usedSeals} authored ${usedSeals === 1 ? "order was" : "orders were"} overridden after contact.`}</p>
        </details>
        <button className="commit-button debrief-button" onClick={onAction}><span><b>{actionLabel}</b><small>{actionDetail}</small></span><ArrowRight /></button>
      </div>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState("plan");
  const [operationIndex, setOperationIndex] = useState(0);
  const [selected, setSelected] = useState("harpoon");
  const [draggingFormationId, setDraggingFormationId] = useState(null);
  const [routePreview, setRoutePreview] = useState(null);
  // The hovered formation carries the element it was hovered from, measured in the same
  // event that set it. Reading the pointer separately is what made the first version of
  // the card miss its first hover.
  const [hovered, setHovered] = useState({ id: null, anchor: null });
  const hoveredFormationId = hovered.id;
  const inspectFormation = useCallback((formationId, element) => {
    if (!formationId) {
      setHovered({ id: null, anchor: null });
      return;
    }
    const rect = element?.getBoundingClientRect?.();
    setHovered({
      id: formationId,
      anchor: rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null,
    });
  }, []);
  const [playbookId, setPlaybookId] = useState("trapline");
  const [previewPlaybookId, setPreviewPlaybookId] = useState(null);
  const [conditionId, setConditionId] = useState("fractured-transit");
  const [refits, setRefits] = useState(defaultRefits);
  const [campaignConditions, setCampaignConditions] = useState({});
  const [warhostIntegrity, setWarhostIntegrity] = useState(3);
  const [assignments, setAssignments] = useState(() => emptyAssignments(PLAYBOOKS[0]));
  const [branches, setBranches] = useState(defaultBranches);
  const [battleBranches, setBattleBranches] = useState(defaultBranches);
  const [drillStep, setDrillStep] = useState(-1);
  const [drillComplete, setDrillComplete] = useState(false);
  const [battleTime, setBattleTime] = useState(0);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackPlaying, setPlaybackPlaying] = useState(false);
  const [seals, setSeals] = useState(2);
  const [decision, setDecision] = useState(null);
  const [resolvedDecisions, setResolvedDecisions] = useState([]);
  const [rescueComplete, setRescueComplete] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showWorkshop, setShowWorkshop] = useState(false);
  const [workshopBaseline, setWorkshopBaseline] = useState(null);
  const [salvageChoice, setSalvageChoice] = useState(null);
  const [pickerRoleId, setPickerRoleId] = useState(null);
  const [placementFeedback, setPlacementFeedback] = useState(null);
  const [strategyTrialId, setStrategyTrialId] = useState(null);
  const [blindTestActive, setBlindTestActive] = useState(false);
  const [blindPrediction, setBlindPrediction] = useState(null);
  const [staffExerciseIndex, setStaffExerciseIndex] = useState(null);
  const placementRevisionRef = useRef(0);

  const operation = OPERATIONS[operationIndex] ?? OPERATIONS[0];
  const strategyTrial = strategyTrialFor(strategyTrialId);
  const playbook = useMemo(
    () => playbookForOperation(PLAYBOOKS.find((item) => item.id === playbookId) ?? PLAYBOOKS[0], operation),
    [operation, playbookId],
  );
  const condition = useMemo(
    () => missionPressureFor(conditionId, operation.id),
    [conditionId, operation.id],
  );
  const allFormations = useMemo(
    () => applyCampaignConditions(resolveFormations(refits), campaignConditions),
    [campaignConditions, refits],
  );
  const formations = useMemo(
    () => allFormations.filter((formation) => formation.available),
    [allFormations],
  );
  const inspectedFormationId = hoveredFormationId ?? selected;
  const workshopFormations = useMemo(
    () => workshopBaseline
      ? applyCampaignConditions(resolveFormations(workshopBaseline.refits), workshopBaseline.conditions)
      : [],
    [workshopBaseline],
  );

  const deployments = useMemo(
    () => Object.fromEntries(playbook.roles.filter((role) => assignments[role.id]).map((role) => [assignments[role.id], role.node])),
    [assignments, playbook],
  );

  const assignedCount = useMemo(
    () => Object.values(assignments).filter(Boolean).length,
    [assignments],
  );

  // The roster is deliberately larger than the number of action stops, so a plan is
  // complete when every stop is staffed — not when every formation has been used.
  // Which five deploy is the list decision; the rest stay in reserve.
  const planReady = useMemo(
    () => formations.length >= playbook.roles.length
      && assignedCount === playbook.roles.length
      && new Set(Object.values(assignments).filter(Boolean)).size === playbook.roles.length,
    [assignedCount, assignments, formations.length, playbook.roles.length],
  );

  const tacticalSequence = useMemo(
    () => evaluateTacticalSequence(playbook, assignments, formations),
    [assignments, formations, playbook],
  );
  const tacticalHandoffs = tacticalSequence.handoffs;
  const roleOutputs = tacticalSequence.outputs;
  const placementReadiness = useMemo(
    () => calculatePlacementReadiness(playbook, assignments, tacticalHandoffs, condition, formations),
    [assignments, condition, formations, playbook, tacticalHandoffs],
  );
  const refitProtocols = useMemo(
    () => calculateRefitProtocols(playbook, assignments, formations, operation),
    [assignments, formations, operation, playbook],
  );

  const activeBranches = phase === "plan" || phase === "drill" ? branches : battleBranches;

  const operationProfile = useMemo(
    () => calculateOperationProfile(tacticalHandoffs, activeBranches, placementReadiness, condition, operation, refitProtocols, playbook),
    [activeBranches, condition, operation, placementReadiness, playbook, refitProtocols, tacticalHandoffs],
  );

  const operationWon = operationProfile.extractedCount >= operation.requiredExtraction;
  const hasNextOperation = operationIndex < OPERATIONS.length - 1;
  const integrityLoss = integrityLossFor({ operationWon, extractedCount: operationProfile.extractedCount });
  const integrityAfterMission = Math.max(0, warhostIntegrity - integrityLoss);
  const campaignOutcome = campaignOutcomeFor({ hasNextOperation, operationWon, integrityRemaining: integrityAfterMission });
  const campaignDestroyed = campaignOutcome === "destroyed";
  const canContinueCampaign = campaignOutcome === "continue";
  const finalConsequences = useMemo(
    () => battlefieldConsequencesAt({ clashes: operationProfile.enemyClashes, battleTime: operationProfile.completeAt }),
    [operationProfile.completeAt, operationProfile.enemyClashes],
  );
  const formationOrderIds = useMemo(
    () => playbook.roles.map((role) => assignments[role.id]).filter(Boolean),
    [assignments, playbook.roles],
  );
  const recoveryProtectedFormationIds = useMemo(
    () => operationProfile.recoveryRoleProtection?.formationId ? [operationProfile.recoveryRoleProtection.formationId] : [],
    [operationProfile.recoveryRoleProtection],
  );
  const operationFormationFates = useMemo(
    () => formationFatesFor({
      formations,
      formationOrderIds,
      // Only the formations actually staffed onto action stops took part in the
      // operation; the rest of the roster stayed in reserve and must not be scored.
      deployedIds: playbook.roles.map((role) => assignments[role.id]).filter(Boolean),
      extractedCount: operationProfile.extractedCount,
      consequences: finalConsequences.player,
      campaignDestroyed,
      extractionAt: operationProfile.extractionAt,
      completeAt: operationProfile.completeAt,
      protectedFormationIds: recoveryProtectedFormationIds,
    }),
    [assignments, campaignDestroyed, finalConsequences.player, formationOrderIds, formations, operationProfile.completeAt, operationProfile.extractedCount, operationProfile.extractionAt, playbook.roles, recoveryProtectedFormationIds],
  );
  const operationEvents = useMemo(
    () => buildOperationEvents(operationProfile, operation),
    [operation, operationProfile],
  );
  const playbackBeats = useMemo(
    () => buildBattlePlayback({
      operation,
      playbookId: playbook.id,
      profile: operationProfile,
      handoffs: tacticalHandoffs,
      formations,
      events: operationEvents,
      comboTimes: comboWindowTimes(operationProfile),
      formationFates: operationFormationFates,
      reinforcementWave: reinforcementWaveFor(operation, condition),
    }),
    [condition, formations, operation, operationEvents, operationFormationFates, operationProfile, playbook.id, tacticalHandoffs],
  );
  const currentPlaybackBeat = playbackBeats[Math.min(playbackIndex, playbackBeats.length - 1)] ?? null;

  const drillSteps = useMemo(
    () => [
      `Mission pressure ${condition.name}: ${condition.effect}`,
      `${formations.length} installed refits locked; no loadout changes after commitment`,
      `Loading ${playbook.name} geometry`,
      ...playbook.stages.map((stage) => `${stage.label} responsibility acknowledged`),
      `${assignedCount} formation orders assigned; battlefield results remain sealed`,
      `${tacticalHandoffs.length} combo windows registered; automatic reactions remain sealed`,
      `${operationProfile.enemyClashes.length} enemy orders identified; collision outcomes remain sealed`,
      `Command drill complete. Commit the play to reveal the result.`,
    ],
    [assignedCount, condition, formations.length, operation, operationProfile, playbook, tacticalHandoffs],
  );

  useEffect(() => {
    if (phase !== "drill") return undefined;
    setDrillStep(0);
    const interval = window.setInterval(() => {
      setDrillStep((current) => {
        if (current >= drillSteps.length - 1) {
          window.clearInterval(interval);
          setDrillComplete(true);
          setPhase("plan");
          return current;
        }
        return current + 1;
      });
    }, 720);
    return () => window.clearInterval(interval);
  }, [phase, drillSteps.length]);

  // Formations are drawn by interpolating their route against battleTime, so snapping
  // battleTime to each beat's timestamp made them lurch: beats early in the operation
  // are five game-seconds apart, later ones sixty, but every beat lasts the same real
  // 2.6s. Easing battleTime across the beat instead makes movement continuous and makes
  // the gap between "closing" and "contact" legible.
  useEffect(() => {
    if (phase !== "battle" && phase !== "complete") return undefined;
    const target = playbackTimeForIndex(playbackBeats, playbackIndex);
    const from = playbackIndex > 0 ? playbackTimeForIndex(playbackBeats, playbackIndex - 1) : 0;
    if (phase === "complete" || !playbackPlaying || target <= from) {
      setBattleTime(target);
      return undefined;
    }
    const started = performance.now();
    let frame = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / PLAYBACK_BEAT_MS);
      setBattleTime(Math.round(from + (target - from) * progress));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, playbackBeats, playbackIndex, playbackPlaying]);

  useEffect(() => {
    if (phase !== "battle" || decision || !playbackPlaying || playbackIndex >= playbackBeats.length - 1) return undefined;
    const timeout = window.setTimeout(() => {
      setPlaybackIndex((current) => playbackIndexAfterStep(current, 1, playbackBeats.length));
    }, PLAYBACK_BEAT_MS);
    return () => window.clearTimeout(timeout);
  }, [decision, phase, playbackBeats.length, playbackIndex, playbackPlaying]);

  useEffect(() => {
    if (phase !== "battle") return;
    if (battleTime >= operationProfile.betaDecisionAt && !resolvedDecisions.includes("beta") && !decision) {
      setDecision("beta");
      return;
    }
    if (battleTime >= operationProfile.rescueDecisionAt && !resolvedDecisions.includes("rescue") && !decision) {
      setDecision("rescue");
      return;
    }
  }, [battleTime, phase, decision, resolvedDecisions, operationProfile]);

  useEffect(() => {
    if (phase !== "battle" || decision || currentPlaybackBeat?.kind !== "complete") return undefined;
    const timeout = window.setTimeout(() => {
      setPhase("complete");
      setPlaybackPlaying(false);
      setShowCompletion(true);
    }, PLAYBACK_BEAT_MS);
    return () => window.clearTimeout(timeout);
  }, [currentPlaybackBeat, decision, phase]);

  const loadStrategyTrial = (trialId) => {
    if (phase !== "plan" || operationIndex !== 0 || formations.length !== FORMATIONS.length) return;
    const trial = strategyTrialFor(trialId);
    const trialPlaybook = PLAYBOOKS.find((item) => item.id === trial?.playbookId);
    const formationIds = new Set(formations.map((formation) => formation.id));
    const assignmentIds = Object.values(trial?.assignments ?? {});
    if (!trial || !trialPlaybook || assignmentIds.length !== formations.length || assignmentIds.some((formationId) => !formationIds.has(formationId))) return;

    setPlaybookId(trial.playbookId);
    setRefits(defaultRefits());
    setAssignments({ ...trial.assignments });
    setBranches({ ...trial.branches });
    setBattleBranches({ ...trial.branches });
    setSelected(trial.assignments[trialPlaybook.roles[0].id]);
    setPickerRoleId(null);
    setDrillStep(-1);
    setDrillComplete(false);
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(false);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setPlacementFeedback(null);
    setStrategyTrialId(trial.id);
    setBlindTestActive(false);
    setBlindPrediction(null);
    setStaffExerciseIndex(null);
  };

  const startBlindTest = () => {
    if (phase !== "plan" || operationIndex !== 0 || formations.length !== FORMATIONS.length) return;
    setPlaybookId(playbook.id);
    setConditionId(condition.id);
    setRefits(defaultRefits());
    setAssignments(emptyAssignments(playbook));
    setBranches(defaultBranches(OPERATIONS[0]));
    setBattleBranches(defaultBranches(OPERATIONS[0]));
    setSelected("harpoon");
    setPickerRoleId(null);
    setDrillStep(-1);
    setDrillComplete(false);
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(false);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setPlacementFeedback(null);
    setStrategyTrialId(null);
    setBlindTestActive(true);
    setBlindPrediction(null);
    setStaffExerciseIndex(null);
  };

  const chooseBlindPrediction = (predictionId) => {
    if (!blindTestActive || phase !== "plan" || !BLIND_PREDICTIONS.some((prediction) => prediction.id === predictionId)) return;
    setBlindPrediction(predictionId);
  };

  const runStaffExercise = (handoffIndex) => {
    if (phase !== "plan") return;
    setStaffExerciseIndex((currentIndex) => claimStaffExercise({
      currentIndex,
      requestedIndex: handoffIndex,
      handoffCount: tacticalHandoffs.length,
    }));
  };

  const changePlaybook = (nextId) => {
    if (phase !== "plan") return;
    const next = PLAYBOOKS.find((item) => item.id === nextId);
    if (!next) return;
    setPlaybookId(next.id);
    setAssignments(emptyAssignments(next));
    setBranches(defaultBranches(operation));
    setBattleBranches(defaultBranches(operation));
    setSelected(formations[0]?.id ?? "");
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillStep(-1);
    setDrillComplete(false);
    setStrategyTrialId(null);
    setStaffExerciseIndex(null);
    if (blindTestActive) setBlindPrediction(null);
  };

  const changeCondition = (nextId) => {
    if (phase !== "plan" || operation.conditionLocked || !missionPressuresForOperation(operation.id).some((item) => item.id === nextId)) return;
    setConditionId(nextId);
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillStep(-1);
    setDrillComplete(false);
    if (staffExerciseIndex !== null) setStaffExerciseIndex(-1);
    if (blindTestActive) setBlindPrediction(null);
  };

  const changeRefit = (formationId, refitId) => {
    if (phase !== "plan" || operationIndex > 0) return;
    const baseFormation = FORMATIONS.find((formation) => formation.id === formationId);
    const nextRefit = baseFormation?.refits.find((refit) => refit.id === refitId);
    if (!baseFormation || !nextRefit || refits[formationId] === refitId) return;

    const nextSelections = { ...refits, [formationId]: refitId };
    const nextFormations = resolveFormations(nextSelections);
    const assignedRole = playbook.roles.find((role) => assignments[role.id] === formationId);

    if (assignedRole) {
      const previousSequence = evaluateTacticalSequence(playbook, assignments, formations);
      const nextSequence = evaluateTacticalSequence(playbook, assignments, nextFormations);
      const previousReadiness = calculatePlacementReadiness(playbook, assignments, previousSequence.handoffs, condition, formations);
      const nextReadiness = calculatePlacementReadiness(playbook, assignments, nextSequence.handoffs, condition, nextFormations);
      const previousProtocols = calculateRefitProtocols(playbook, assignments, formations, operation);
      const nextProtocols = calculateRefitProtocols(playbook, assignments, nextFormations, operation);
      const previousProfile = calculateOperationProfile(previousSequence.handoffs, activeBranches, previousReadiness, condition, operation, previousProtocols, playbook);
      const nextProfile = calculateOperationProfile(nextSequence.handoffs, activeBranches, nextReadiness, condition, operation, nextProtocols, playbook);
      const previousLinks = previousSequence.handoffs.filter((handoff) => handoff.maneuver).length;
      const nextLinks = nextSequence.handoffs.filter((handoff) => handoff.maneuver).length;
      const previousWindow = previousProfile.timeSaved - previousProfile.overrun;
      const nextWindow = nextProfile.timeSaved - nextProfile.overrun;
      const targetIndex = playbook.roles.findIndex((role) => role.id === assignedRole.id);
      const improved = nextLinks > previousLinks || nextProfile.extractedCount > previousProfile.extractedCount || nextWindow > previousWindow;
      const weakened = nextLinks < previousLinks || nextProfile.extractedCount < previousProfile.extractedCount || nextWindow < previousWindow;

      placementRevisionRef.current += 1;
      setPlacementFeedback({
        revision: placementRevisionRef.current,
        affectedFrom: targetIndex,
        changedIndices: [targetIndex],
        targetIndex,
        formationName: `${baseFormation.name} · ${nextRefit.name}`,
        beforeLinks: previousLinks,
        afterLinks: nextLinks,
        forecast: blindTestActive ? "FORECAST SEALED · COMMIT TO REVEAL" : `${nextProfile.extractedCount} / ${formations.length} EXTRACT · ${reinforcementForecast(nextProfile)}`,
        title: weakened ? "REFIT BREAKS CHAIN" : improved ? "REFIT STRENGTHENS CHAIN" : "REFIT REWIRES CHAIN",
        tone: weakened ? "weakened" : improved ? "strengthened" : "rewired",
      });
    } else {
      setPlacementFeedback(null);
    }

    setRefits(nextSelections);
    setSelected(formationId);
    setPickerRoleId(null);
    setDrillStep(-1);
    setDrillComplete(false);
    if (staffExerciseIndex !== null) setStaffExerciseIndex(-1);
    if (blindTestActive) setBlindPrediction(null);
  };

  const assignFormationToRole = (roleId, formationId) => {
    if (phase !== "plan" || !formations.some((formation) => formation.id === formationId)) return;
    const targetRole = playbook.roles.find((role) => role.id === roleId);
    const sourceRole = playbook.roles.find((role) => assignments[role.id] === formationId);
    if (!targetRole) return;
    if (targetRole.id === sourceRole?.id) {
      setPickerRoleId(null);
      return;
    }
    const nextAssignments = {
      ...assignments,
      ...(sourceRole ? { [sourceRole.id]: assignments[targetRole.id] ?? null } : {}),
      [targetRole.id]: formationId,
    };
    const previousSequence = evaluateTacticalSequence(playbook, assignments, formations);
    const nextSequence = evaluateTacticalSequence(playbook, nextAssignments, formations);
    const previousReadiness = calculatePlacementReadiness(playbook, assignments, previousSequence.handoffs, condition, formations);
    const nextReadiness = calculatePlacementReadiness(playbook, nextAssignments, nextSequence.handoffs, condition, formations);
    const previousProtocols = calculateRefitProtocols(playbook, assignments, formations, operation);
    const nextProtocols = calculateRefitProtocols(playbook, nextAssignments, formations, operation);
    const previousProfile = calculateOperationProfile(previousSequence.handoffs, activeBranches, previousReadiness, condition, operation, previousProtocols, playbook);
    const nextProfile = calculateOperationProfile(nextSequence.handoffs, activeBranches, nextReadiness, condition, operation, nextProtocols, playbook);
    const previousLinks = previousSequence.handoffs.filter((handoff) => handoff.maneuver).length;
    const nextLinks = nextSequence.handoffs.filter((handoff) => handoff.maneuver).length;
    const targetIndex = playbook.roles.findIndex((role) => role.id === targetRole.id);
    const sourceIndex = sourceRole ? playbook.roles.findIndex((role) => role.id === sourceRole.id) : targetIndex;
    const previousReady = Object.values(assignments).filter(Boolean).length === formations.length;
    const nextReady = Object.values(nextAssignments).filter(Boolean).length === formations.length;
    const previousWindow = previousProfile.timeSaved - previousProfile.overrun;
    const nextWindow = nextProfile.timeSaved - nextProfile.overrun;
    const improved = nextLinks > previousLinks || nextProfile.extractedCount > previousProfile.extractedCount || nextWindow > previousWindow;
    const weakened = nextLinks < previousLinks || nextProfile.extractedCount < previousProfile.extractedCount || nextWindow < previousWindow;
    const previousProtocolCount = previousProfile.protocols.length;
    const nextProtocolCount = nextProfile.protocols.length;
    const tone = nextProtocolCount > previousProtocolCount ? "strengthened" : nextProtocolCount < previousProtocolCount ? "weakened" : nextReady && !previousReady ? "strengthened" : weakened ? "weakened" : improved ? "strengthened" : "rewired";
    const title = nextProtocolCount > previousProtocolCount ? "REFIT PROTOCOL ONLINE" : nextProtocolCount < previousProtocolCount ? "REFIT PROTOCOL DORMANT" : nextReady && !previousReady ? "PLAN ONLINE" : tone === "weakened" ? "CHAIN BROKEN" : tone === "strengthened" ? "CHAIN STRENGTHENED" : "CHAIN REWIRED";
    const forecast = nextReady
      ? blindTestActive ? "FORECAST SEALED · COMMIT TO REVEAL" : `${nextProfile.extractedCount} / ${formations.length} EXTRACT · ${reinforcementForecast(nextProfile)}`
      : `${Object.values(nextAssignments).filter(Boolean).length} / ${formations.length} FORMATIONS PLACED`;

    placementRevisionRef.current += 1;
    setPlacementFeedback({
      revision: placementRevisionRef.current,
      affectedFrom: Math.min(targetIndex, sourceIndex),
      changedIndices: [...new Set([targetIndex, sourceIndex])],
      targetIndex,
      formationName: formations.find((formation) => formation.id === formationId).name,
      beforeLinks: previousLinks,
      afterLinks: nextLinks,
      forecast,
      title,
      tone,
    });
    setAssignments(nextAssignments);
    setSelected(formationId);
    setPickerRoleId(null);
    setDrillComplete(false);
    if (staffExerciseIndex !== null) setStaffExerciseIndex(-1);
    if (blindTestActive) setBlindPrediction(null);
  };

  const chooseFormationForRole = (formationId) => {
    if (!pickerRoleId) return;
    assignFormationToRole(pickerRoleId, formationId);
  };

  const clearRoleAssignment = (roleId) => {
    if (phase !== "plan" || !playbook.roles.some((role) => role.id === roleId)) return;
    const formationId = assignments[roleId];
    if (!formationId) return;
    setAssignments((current) => ({ ...current, [roleId]: null }));
    setSelected(formationId);
    inspectFormation(null);
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setDrillComplete(false);
    if (staffExerciseIndex !== null) setStaffExerciseIndex(-1);
    if (blindTestActive) setBlindPrediction(null);
  };

  const beginFormationDrag = (event, formationId) => {
    if (phase !== "plan" || !formations.some((formation) => formation.id === formationId)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-warhost-formation", formationId);
    event.dataTransfer.setData("text/plain", formationId);
    setSelected(formationId);
    setDraggingFormationId(formationId);
    setRoutePreview(null);
  };

  const endFormationDrag = () => {
    setDraggingFormationId(null);
    setRoutePreview(null);
  };

  const previewFormationRoute = (preview) => {
    if (phase !== "plan" || !preview?.formationId || !preview?.roleId) {
      setRoutePreview(null);
      return;
    }
    setRoutePreview(preview);
  };

  const chooseBranch = (breakpointId, optionId) => {
    if (phase !== "plan") return;
    const breakpoint = breakpointsFor(operation).find((item) => item.id === breakpointId);
    if (!breakpoint?.options.some((option) => option.id === optionId)) return;
    setBranches((current) => ({ ...current, [breakpointId]: optionId }));
    setDrillComplete(false);
    if (blindTestActive) setBlindPrediction(null);
  };

  const resolveDecision = (choice) => {
    if (choice === "override" && seals <= 0) return;
    const breakpoint = breakpointsFor(operation).find((item) => item.id === decision);
    const breakpointImpacts = breakpointImpactsFor(operation);
    const plannedOption = branches[decision];
    const chosenOption = choice === "override"
      ? breakpoint.options.find((option) => option.id !== plannedOption)?.id
      : plannedOption;
    if (choice === "override" && seals > 0) {
      setSeals((current) => current - 1);
    }
    setBattleBranches((current) => ({ ...current, [decision]: chosenOption }));
    if (decision === "rescue") setRescueComplete(Boolean(breakpointImpacts[decision][chosenOption].rescue));
    setResolvedDecisions((current) => [...current, decision]);
    setDecision(null);
  };

  const stepPlayback = (delta) => {
    if (phase !== "battle" && phase !== "complete") return;
    const nextIndex = playbackIndexAfterStep(playbackIndex, delta, playbackBeats.length);
    setPlaybackPlaying(false);
    setPlaybackIndex(nextIndex);
    setBattleTime(playbackTimeForIndex(playbackBeats, nextIndex));
    if (phase === "complete" && nextIndex < playbackBeats.length - 1) {
      setShowCompletion(false);
      setPhase("battle");
    }
  };

  const togglePlayback = () => {
    if (phase !== "battle" && phase !== "complete") return;
    if (phase === "complete" && playbackIndex < playbackBeats.length - 1) {
      setShowCompletion(false);
      setPhase("battle");
    }
    setPlaybackPlaying((current) => !current);
  };

  const replayPlayback = () => {
    if (phase !== "battle" && phase !== "complete") return;
    setShowCompletion(false);
    setDecision(null);
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(true);
    setPhase("battle");
  };

  const commitMission = () => {
    if (!planReady || (blindTestActive && !blindPrediction)) return;
    setPhase("battle");
    setBattleBranches({ ...branches });
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(true);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setSeals(2);
    setShowCompletion(false);
  };

  const handleCompletionAction = () => {
    if (canContinueCampaign) {
      const battleConditions = seriousConditionsFromConsequences({
        clashes: operationProfile.enemyClashes,
        battleTime: operationProfile.completeAt,
      });
      const seriousConditions = operationWon
        ? battleConditions
        : ensureCostlyContinuationConditions(battleConditions, FORMATIONS.map((formation) => formation.id));
      setWorkshopBaseline({
        refits: { ...refits },
        conditions: mergeCampaignConditions(campaignConditions, seriousConditions),
      });
      setWarhostIntegrity(integrityAfterMission);
      setSalvageChoice(null);
      setShowCompletion(false);
      setShowWorkshop(true);
      return;
    }
    if (campaignDestroyed) {
      resetMission();
      return;
    }
    setShowCompletion(false);
  };

  const chooseWorkshopAction = (action) => {
    if (!showWorkshop || !workshopBaseline) return;
    const preview = applyWorkshopAction({ ...workshopBaseline, action, catalog: FORMATIONS });
    if (!preview.applied) return;
    const sameChoice = salvageChoice?.type === action.type
      && salvageChoice?.formationId === action.formationId
      && (action.type !== "refit" || salvageChoice?.refitId === action.refitId);
    setSalvageChoice(sameChoice ? null : action);
  };

  const launchNextOperation = () => {
    const nextIndex = operationIndex + 1;
    const nextOperation = OPERATIONS[nextIndex];
    if (!showWorkshop || !workshopBaseline || !nextOperation) return;
    const campaignResult = applyWorkshopAction({
      ...workshopBaseline,
      action: salvageChoice,
      catalog: FORMATIONS,
    });
    const nextFormations = applyCampaignConditions(resolveFormations(campaignResult.refits), campaignResult.conditions)
      .filter((formation) => formation.available);
    if (nextFormations.length < nextOperation.requiredExtraction) return;
    setRefits(campaignResult.refits);
    setCampaignConditions(campaignResult.conditions);
    setOperationIndex(nextIndex);
    setConditionId(nextOperation.conditionId);
    setAssignments(emptyAssignments(playbook));
    setBranches(defaultBranches(nextOperation));
    setBattleBranches(defaultBranches(nextOperation));
    setPhase("plan");
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(false);
    setSelected(nextFormations[0]?.id ?? "");
    setDrillStep(-1);
    setDrillComplete(false);
    setSeals(2);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setShowWorkshop(false);
    setWorkshopBaseline(null);
    setSalvageChoice(null);
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setStrategyTrialId(null);
    setBlindTestActive(false);
    setBlindPrediction(null);
    setStaffExerciseIndex(null);
  };

  const resetMission = () => {
    setPhase("plan");
    setBattleTime(0);
    setPlaybackIndex(0);
    setPlaybackPlaying(false);
    setOperationIndex(0);
    setPlaybookId("trapline");
    setConditionId(OPERATIONS[0].conditionId);
    setRefits(defaultRefits());
    setCampaignConditions({});
    setWarhostIntegrity(3);
    setAssignments(emptyAssignments(PLAYBOOKS[0]));
    setBranches(defaultBranches(OPERATIONS[0]));
    setBattleBranches(defaultBranches(OPERATIONS[0]));
    setSelected("harpoon");
    setDrillStep(-1);
    setDrillComplete(false);
    setSeals(2);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setShowWorkshop(false);
    setWorkshopBaseline(null);
    setSalvageChoice(null);
    setPickerRoleId(null);
    setPlacementFeedback(null);
    setStrategyTrialId(null);
    setBlindTestActive(false);
    setBlindPrediction(null);
    setStaffExerciseIndex(null);
  };

  const repeatBlindTest = () => {
    resetMission();
    setBlindTestActive(true);
  };

  return (
    <main className={`warhost-app ${phase}`}>
      <AppHeader phase={phase} battleTime={battleTime} operation={operation} operationIndex={operationIndex} profile={operationProfile} />
      <div className="mission-shell">
        <FormationRoster formations={formations} unavailableFormations={allFormations.filter((formation) => !formation.available)} condition={condition} inspected={inspectedFormationId} onInspect={inspectFormation} selected={selected} onSelect={setSelected} assignments={assignments} playbook={playbook} previewPlaybookId={previewPlaybookId} onPreviewPlaybook={setPreviewPlaybookId} onPlaybook={changePlaybook} operation={operation} phase={phase} strategyTrial={strategyTrial} blindTestActive={blindTestActive} blindPrediction={blindPrediction} onBlindPrediction={chooseBlindPrediction} onLoadStrategyTrial={loadStrategyTrial} onStartBlindTest={startBlindTest} onFormationDragStart={beginFormationDrag} onFormationDragEnd={endFormationDrag} readiness={placementReadiness} refitsLocked={operationIndex > 0} onRefit={changeRefit} />
        <Battlefield formations={formations} formationFates={operationFormationFates} inspected={inspectedFormationId} onInspect={inspectFormation} selected={selected} onSelect={setSelected} deployments={deployments} phase={phase} battleTime={battleTime} condition={condition} drillStep={drillStep} draggingFormationId={draggingFormationId} placementFeedback={placementFeedback} planReady={planReady} playbook={playbook} previewPlaybookId={previewPlaybookId} drillSteps={drillSteps} assignments={assignments} branches={activeBranches} handoffs={tacticalHandoffs} operation={operation} outputs={roleOutputs} profile={operationProfile} routePreview={routePreview} onChooseRole={setPickerRoleId} onAssignFormation={assignFormationToRole} onClearRole={clearRoleAssignment} onFormationDragStart={beginFormationDrag} onFormationDragEnd={endFormationDrag} onRoutePreview={previewFormationRoute} onStaffExercise={runStaffExercise} readiness={placementReadiness} refitProtocols={refitProtocols} staffExerciseIndex={staffExerciseIndex} playbackBeat={currentPlaybackBeat} playbackBeats={playbackBeats} playbackIndex={playbackIndex} playbackPlaying={playbackPlaying} onPlaybackToggle={togglePlayback} onPlaybackStep={stepPlayback} onPlaybackReplay={replayPlayback} />
        <IntelRail phase={phase} battleTime={battleTime} condition={condition} onCondition={changeCondition} operation={operation} planReady={planReady} blindTestActive={blindTestActive} rescueComplete={rescueComplete} playbook={playbook} assignments={assignments} formations={formations} assignedCount={assignedCount} formationCount={formations.length} integrity={warhostIntegrity} profile={operationProfile} />
      </div>
      {phase === "plan" && (
        <FormationHoverCard
          formation={formations.find((item) => item.id === hoveredFormationId) ?? null}
          anchor={hovered.anchor}
          playbook={playbook}
          assignments={assignments}
          condition={condition}
        />
      )}
      <FooterControls phase={phase} seals={seals} drillComplete={drillComplete} onDrill={() => setPhase("drill")} onCommit={commitMission} onReset={resetMission} operation={operation} planReady={planReady} blindTestActive={blindTestActive} blindPrediction={blindPrediction} branches={activeBranches} onBranch={chooseBranch} />
      <DecisionOverlay decision={decision} seals={seals} branches={branches} operation={operation} onResolve={resolveDecision} />
      <FormationPicker role={playbook.roles.find((role) => role.id === pickerRoleId)} playbook={playbook} condition={condition} formations={formations} assignments={assignments} onChoose={chooseFormationForRole} onClose={() => setPickerRoleId(null)} />
      {showCompletion && <CompletionOverlay formations={formations} formationFates={operationFormationFates} canContinue={canContinueCampaign} campaignDestroyed={campaignDestroyed} integrityBefore={warhostIntegrity} integrityLoss={integrityLoss} integrityAfter={integrityAfterMission} operation={operation} rescued={rescueComplete} usedSeals={2 - seals} playbook={playbook} profile={operationProfile} readiness={placementReadiness} handoffs={tacticalHandoffs} strategyTrial={strategyTrial} blindTestActive={blindTestActive} blindPrediction={blindPrediction} won={operationWon} onAction={blindTestActive ? repeatBlindTest : strategyTrial ? resetMission : handleCompletionAction} />}
      {showWorkshop && workshopBaseline && <SalvageWorkshop baseline={workshopBaseline} choice={salvageChoice} formations={workshopFormations} integrity={warhostIntegrity} nextOperation={OPERATIONS[operationIndex + 1]} onChoose={chooseWorkshopAction} onLaunch={launchNextOperation} />}
    </main>
  );
}
