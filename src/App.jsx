import { useEffect, useMemo, useRef, useState } from "react";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/400.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import {
  Anchor,
  ArrowCounterClockwise,
  ArrowRight,
  CheckCircle,
  Crosshair,
  Eye,
  Factory,
  Fire,
  Flag,
  Hammer,
  Lightning,
  MapPin,
  Pause,
  Play,
  Radio,
  Seal,
  Shield,
  Target,
  Truck,
  Warning,
  Wrench,
} from "@phosphor-icons/react";

const FORMATIONS = [
  {
    id: "harpoon",
    number: "1",
    name: "HARPOON RIG",
    role: "DISPLACE",
    purpose: "Pull the Alpha blocker into the kill zone.",
    asset: "/assets/harpoon-rig.png",
    icon: Anchor,
    defaultNode: "alphaApproach",
  },
  {
    id: "furnace",
    number: "2",
    name: "FURNACE CREW",
    role: "DENY",
    purpose: "Seal the reinforcement lane with heat.",
    asset: "/assets/furnace-crew.png",
    icon: Fire,
    defaultNode: "fireLine",
  },
  {
    id: "breaker",
    number: "3",
    name: "BREAKER EXO",
    role: "BREACH",
    purpose: "Crack the Reactor Spine after Beta falls.",
    asset: "/assets/breaker-exo.png",
    icon: Hammer,
    defaultNode: "breachLine",
  },
  {
    id: "railjack",
    number: "4",
    name: "RAILJACK",
    role: "HOLD",
    purpose: "Anchor the captured Alpha control node.",
    asset: "/assets/railjack.png",
    icon: Shield,
    defaultNode: "anchorLine",
  },
  {
    id: "hauler",
    number: "5",
    name: "SALVAGE HAULER",
    role: "EXTRACT",
    purpose: "Recover the crew and damaged formations.",
    asset: "/assets/salvage-hauler.png",
    icon: Truck,
    defaultNode: "recoveryLine",
  },
];

const NODES = {
  alphaApproach: { left: 20, top: 63, label: "Alpha approach" },
  fireLine: { left: 31, top: 72, label: "Thermal firing line" },
  breachLine: { left: 44, top: 66, label: "Breach route" },
  anchorLine: { left: 36, top: 82, label: "Anchor line" },
  recoveryLine: { left: 53, top: 80, label: "Recovery route" },
  highWalk: { left: 47, top: 34, label: "Elevated transit" },
  betaLane: { left: 66, top: 28, label: "Beta transit lane" },
  rescuePen: { left: 69, top: 72, label: "Salvage enclosure" },
};

const DEFAULT_DEPLOYMENT = Object.fromEntries(
  FORMATIONS.map((formation) => [formation.id, formation.defaultNode]),
);

const DOCTRINES = [
  {
    id: "breakthrough",
    name: "BREAKTHROUGH",
    summary: "Momentum over position.",
    icon: Lightning,
  },
  {
    id: "hold",
    name: "HOLD",
    summary: "Anchor strongpoints.",
    icon: Shield,
  },
  {
    id: "hunt",
    name: "HUNT",
    summary: "Disrupt and collapse.",
    icon: Crosshair,
  },
];

const DRILL_STEPS = [
  "Scanning the Alpha approach",
  "Harpoon Rig establishes line of sight",
  "Furnace Crew overlaps the kill zone",
  "Breaker Exo confirms the breach path",
  "Extraction timing remains inside the window",
];

const EVENTS = [
  { at: 30, text: "Harpoon Rig has contact. Trapline primed." },
  { at: 60, text: "Control Node Alpha seized. Railjack anchoring." },
  { at: 105, text: "Helioch fire closes the Beta transit lane." },
  { at: 150, text: "Control Node Beta seized under pressure." },
  { at: 210, text: "Salvage crew located below the reactor deck." },
  { at: 255, text: "Reactor Spine exposed. Breaker Exo advancing." },
  { at: 300, text: "Reactor Spine sabotaged. Extraction route open." },
  { at: 345, text: "Warhost crossing the Extraction Gantry." },
];

const fmtClock = (seconds) => {
  const remaining = Math.max(0, 360 - seconds);
  return `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(
    remaining % 60,
  ).padStart(2, "0")}`;
};

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

function AppHeader({ phase, battleTime }) {
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
          <p className="operation-title">OPERATION DEAD CIRCUIT</p>
          <p className="operation-type">SABOTAGE &amp; EXTRACT</p>
        </div>
        <div className="reinforcement-clock" aria-live="polite">
          <span>{phase === "battle" ? "MISSION WINDOW" : phase === "complete" ? "MISSION COMPLETE" : "REINFORCEMENTS IN"}</span>
          <strong>{phase === "battle" ? fmtClock(battleTime) : phase === "complete" ? "00:00" : "06:00"}</strong>
          <small>{phase === "complete" ? "EXTRACTION CONFIRMED" : "UNKNOWN FORCE SIZE"}</small>
        </div>
      </div>
    </header>
  );
}

function FormationRoster({ selected, onSelect, deployments, phase, doctrine, setDoctrine }) {
  return (
    <section className="left-rail" aria-label="Warhost formations and doctrine">
      <div className="rail-heading">
        <span>YOUR FORMATIONS</span>
        <span>5 / 5 DEPLOYED</span>
      </div>
      <div className="formation-list">
        {FORMATIONS.map((formation) => {
          const Icon = formation.icon;
          const active = selected === formation.id;
          return (
            <button
              key={formation.id}
              className={`formation-row ${active ? "selected" : ""}`}
              onClick={() => onSelect(formation.id)}
              disabled={phase !== "plan" && phase !== "drill"}
              aria-pressed={active}
            >
              <span className="formation-number">{formation.number}</span>
              <FormationPortrait formation={formation} compact />
              <span className="formation-copy">
                <b>{formation.name}</b>
                <small><Icon weight="duotone" /> {formation.role}</small>
                <em>{NODES[deployments[formation.id]].label}</em>
              </span>
            </button>
          );
        })}
      </div>
      <div className="doctrine-heading"><span>DOCTRINE</span><Radio weight="duotone" /></div>
      <div className="doctrine-list">
        {DOCTRINES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`doctrine-row ${doctrine === item.id ? "selected" : ""}`}
              onClick={() => setDoctrine(item.id)}
              disabled={phase !== "plan"}
              aria-pressed={doctrine === item.id}
            >
              <Icon weight="duotone" />
              <span><b>{item.name}</b><small>{item.summary}</small></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function MissionRoute({ phase, battleTime }) {
  const steps = [
    { n: 1, label: "SEIZE BOTH NODES", done: battleTime >= 150 },
    { n: 2, label: "SABOTAGE REACTOR", done: battleTime >= 300 },
    { n: 3, label: "EXTRACT 3+ FORMATIONS", done: phase === "complete" },
  ];
  return (
    <div className="mission-route panel-surface">
      <span className="panel-label">MISSION ROUTE</span>
      {steps.map((step) => (
        <div className={`route-step ${step.done ? "done" : ""}`} key={step.n}>
          <span>{step.done ? <CheckCircle weight="fill" /> : step.n}</span>
          <b>{step.label}</b>
        </div>
      ))}
    </div>
  );
}

function ObjectiveMarker({ className, number, title, description, state = "active", icon: Icon = MapPin }) {
  return (
    <div className={`objective-marker ${className} ${state}`}>
      <span className="objective-pin"><Icon weight="fill" /></span>
      <div><b>{title}</b><small>{description}</small></div>
      {number && <span className="objective-number">{number}</span>}
    </div>
  );
}

function ComboPanel({ active, drillStep }) {
  return (
    <div className={`combo-panel panel-surface ${active ? "ready" : "broken"}`}>
      <span className="panel-label">TRAPLINE: PULL → BURN → BREAK</span>
      <p>{active ? "Clear the Alpha approach. Open the route." : "Placement has broken the support chain."}</p>
      <div className="combo-steps">
        <div className={drillStep >= 1 ? "lit" : ""}><Anchor weight="duotone" /><b>PULL</b><small>Displace blocker.</small></div>
        <ArrowRight />
        <div className={drillStep >= 2 ? "lit warm" : ""}><Fire weight="duotone" /><b>BURN</b><small>Deny response.</small></div>
        <ArrowRight />
        <div className={drillStep >= 3 ? "lit" : ""}><Hammer weight="duotone" /><b>BREAK</b><small>Collapse hold.</small></div>
      </div>
    </div>
  );
}

function Battlefield({ selected, onSelect, deployments, onMove, phase, battleTime, drillStep, traplineReady }) {
  const activeFormations = phase === "complete" ? ["harpoon", "furnace", "breaker", "railjack"] : FORMATIONS.map((f) => f.id);
  const alphaState = battleTime >= 60 ? "secured" : "active";
  const betaState = battleTime >= 150 ? "secured" : "threat";
  const reactorState = battleTime >= 300 ? "secured" : "threat";
  const extractionState = phase === "complete" ? "secured" : "future";

  return (
    <section className={`battlefield phase-${phase}`} aria-label="Operation Dead Circuit mission map">
      <img className="battlefield-art" src="/assets/dead-circuit-foundry.png" alt="Isometric industrial foundry battlefield" />
      <div className="battlefield-wash" />
      <MissionRoute phase={phase} battleTime={battleTime} />
      <div className="map-sector entry-sector"><span>ENTRY / BREACH</span><small>Player deployment edge</small></div>
      <ObjectiveMarker className="alpha-objective" number="1" title="CONTROL NODE ALPHA" description={alphaState === "secured" ? "SECURED · Railjack anchoring" : "Seize and hold"} state={alphaState} />
      <ObjectiveMarker className="beta-objective" number="1" title="CONTROL NODE BETA" description={betaState === "secured" ? "SECURED · Transit lane open" : "Seize and hold"} state={betaState} />
      <ObjectiveMarker className="reactor-objective" number="2" title="REACTOR SPINE" description={reactorState === "secured" ? "SABOTAGED" : "Primary target"} state={reactorState} icon={Factory} />
      <ObjectiveMarker className="extraction-objective" number="3" title="EXTRACTION GANTRY" description="Extract 3+ formations" state={extractionState} icon={Flag} />
      <ObjectiveMarker className="rescue-objective" title="RESCUE SALVAGE CREW" description="Optional · field repair reward" state="optional" icon={Wrench} />

      <div className="mission-path path-one" aria-hidden="true" />
      <div className="mission-path path-two" aria-hidden="true" />
      <div className="mission-path path-three" aria-hidden="true" />
      <div className={`combo-path combo-pull ${traplineReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-burn ${traplineReady ? "active warm" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-break ${traplineReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`kill-zone ${traplineReady ? "active" : ""}`}><span>KILL ZONE</span></div>

      <div className={`enemy-formation enemy-alpha ${battleTime >= 60 ? "routed" : ""}`}>
        <img src="/assets/helioch-sentinels.png" alt="Helioch Oath defenders at Control Node Alpha" />
        <span>{battleTime >= 60 ? "ALPHA DEFENDERS ROUTED" : "KNOWN DEFENDERS"}</span>
      </div>
      <div className={`enemy-formation enemy-beta ${battleTime >= 150 ? "routed" : "uncertain"}`}>
        <img src="/assets/helioch-sentinels.png" alt="Uncertain Helioch Oath presence near Control Node Beta" />
        <span>{battleTime >= 150 ? "BETA DEFENDERS ROUTED" : "STRENGTH UNCERTAIN"}</span>
      </div>

      {phase === "plan" && Object.entries(NODES).map(([nodeId, node]) => (
        <button
          key={nodeId}
          className="deployment-node"
          style={{ left: `${node.left}%`, top: `${node.top}%` }}
          onClick={() => onMove(selected, nodeId)}
          aria-label={`Move selected formation to ${node.label}`}
          title={node.label}
        />
      ))}

      {FORMATIONS.filter((formation) => activeFormations.includes(formation.id)).map((formation) => {
        const node = NODES[deployments[formation.id]];
        const active = selected === formation.id;
        const progressShift = phase === "battle" || phase === "complete"
          ? Math.min(22, Math.floor(battleTime / 30) * 2.2)
          : 0;
        return (
          <button
            key={formation.id}
            className={`map-formation ${active ? "selected" : ""} ${phase === "battle" ? "in-motion" : ""}`}
            style={{ left: `${node.left + progressShift}%`, top: `${node.top - progressShift * 0.45}%` }}
            onClick={() => onSelect(formation.id)}
            aria-label={`${formation.name}, ${formation.role}, at ${node.label}`}
          >
            <FormationPortrait formation={formation} />
            <span className="map-formation-number">{formation.number}</span>
            <span className="map-formation-label">{formation.name}</span>
          </button>
        );
      })}

      <ComboPanel active={traplineReady} drillStep={drillStep} />
      {phase === "drill" && (
        <div className="drill-status" role="status">
          <Play weight="fill" />
          <div><span>GHOST DRILL {Math.min(drillStep + 1, DRILL_STEPS.length)} / {DRILL_STEPS.length}</span><b>{DRILL_STEPS[Math.min(drillStep, DRILL_STEPS.length - 1)]}</b></div>
        </div>
      )}
      {(phase === "battle" || phase === "complete") && <BattlePulse battleTime={battleTime} />}
    </section>
  );
}

function BattlePulse({ battleTime }) {
  const current = [...EVENTS].reverse().find((event) => battleTime >= event.at) ?? { text: "Warhost advancing from the breach line." };
  return (
    <div className="battle-pulse" role="status" aria-live="polite">
      <Radio weight="duotone" />
      <div><span>LIVE OPERATIONS</span><b>{current.text}</b></div>
    </div>
  );
}

function IntelRail({ phase, battleTime, traplineReady, rescueComplete }) {
  return (
    <section className="right-rail" aria-label="Mission outlook and enemy intelligence">
      <div className="intel-block">
        <span className="panel-label">MISSION OUTLOOK</span>
        <strong className={traplineReady ? "viable" : "at-risk"}>{traplineReady ? "VIABLE" : "AT RISK"}</strong>
        <p><b>KEY RISK:</b> Beta transit lane exposed.</p>
      </div>
      <div className="intel-block enemy-intel">
        <span className="panel-label">ENEMY INTELLIGENCE</span>
        <div><Target weight="duotone" /><p><b>KNOWN</b><small>Defenders guard Alpha.</small></p></div>
        <div><Warning weight="duotone" /><p><b>UNCERTAIN</b><small>Hostile forces at Beta.</small></p></div>
        <div><Eye weight="duotone" /><p><b>UNKNOWN</b><small>Reserve may enter from east.</small></p></div>
      </div>
      <div className="intel-block victory-block">
        <span className="panel-label">VICTORY CONDITION</span>
        <Factory weight="duotone" />
        <p>Sabotage Reactor Spine and extract at least 3 formations.</p>
        <small>Annihilating the enemy is not required.</small>
      </div>
      <div className="intel-block objective-progress">
        <span className="panel-label">MISSION STATE</span>
        <ProgressRow label="Alpha" done={battleTime >= 60} />
        <ProgressRow label="Beta" done={battleTime >= 150} />
        <ProgressRow label="Reactor" done={battleTime >= 300} />
        <ProgressRow label="Salvage crew" done={rescueComplete} optional />
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

function FooterControls({ phase, seals, drillComplete, onDrill, onCommit, onReset, traplineReady }) {
  return (
    <footer className="mission-footer">
      <div className="contingency-block">
        <span className="panel-label">CONTINGENCIES · 2 COMMAND SEALS TO AUTHOR</span>
        <div className="contingencies">
          <div><span>01</span><p>IF Alpha is secured <ArrowRight /> <b>Railjack holds.</b></p></div>
          <div><span>02</span><p>IF reactor route opens <ArrowRight /> <b>Breaker Exo advances.</b></p></div>
        </div>
      </div>
      <div className="seals-block">
        <span className="panel-label">COMMAND SEALS</span>
        <div className="seals-visual">
          <strong>{seals}</strong>
          <div>{[0, 1].map((index) => <Seal key={index} weight={index < seals ? "duotone" : "thin"} />)}</div>
        </div>
        <small>Override one order when contact changes the mission.</small>
      </div>
      <div className="primary-controls">
        {phase === "plan" || phase === "drill" ? (
          <>
            <button className={`ghost-button ${drillComplete ? "complete" : ""}`} onClick={onDrill} disabled={phase === "drill" || !traplineReady}>
              {phase === "drill" ? <Pause weight="fill" /> : drillComplete ? <CheckCircle weight="fill" /> : <Play weight="fill" />}
              <span><b>{phase === "drill" ? "RUNNING GHOST DRILL" : drillComplete ? "DRILL VERIFIED" : "RUN GHOST DRILL"}</b><small>Preview routes, triggers, and timing.</small></span>
            </button>
            <button className="commit-button" onClick={onCommit} disabled={!traplineReady}>
              <span><b>COMMIT MISSION PLAN</b><small>{traplineReady ? "Deploy and execute autonomously." : "Restore Trapline placement first."}</small></span>
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

function DecisionOverlay({ decision, seals, onResolve }) {
  if (!decision) return null;
  const isBeta = decision === "beta";
  return (
    <div className="decision-backdrop" role="dialog" aria-modal="true" aria-labelledby="decision-title">
      <div className="decision-panel">
        <div className="decision-icon"><Radio weight="duotone" /></div>
        <p className="eyebrow">COMMAND INTERRUPTION</p>
        <h2 id="decision-title">{isBeta ? "Beta lane is collapsing" : "Salvage crew is cut off"}</h2>
        <p>{isBeta ? "Helioch fire has the planned transit lane ranged. The mission can continue, but Breaker Exo will cross exposed." : "The optional rescue now conflicts with the reactor timetable. Override the Hauler or preserve the mission clock."}</p>
        <div className="decision-actions">
          <button onClick={() => onResolve("hold")}><Shield weight="duotone" /><span><b>HOLD THE PLAN</b><small>Spend no seal. Accept the exposure.</small></span></button>
          <button className="spend-seal" onClick={() => onResolve("override")} disabled={seals <= 0}><Seal weight="duotone" /><span><b>{isBeta ? "LAY SMOKE & DIVERT" : "DIVERT SALVAGE HAULER"}</b><small>Spend 1 Command Seal.</small></span></button>
        </div>
      </div>
    </div>
  );
}

function CompletionOverlay({ rescued, usedSeals, onClose }) {
  return (
    <div className="decision-backdrop completion-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-title">
      <div className="decision-panel completion-panel">
        <CheckCircle className="completion-icon" weight="duotone" />
        <p className="eyebrow">MISSION COMPLETE</p>
        <h2 id="complete-title">Dead Circuit is dark.</h2>
        <p>The Reactor Spine is sabotaged. Four formations crossed the Extraction Gantry before Helioch reinforcements sealed the foundry.</p>
        <div className="after-action-grid">
          <div><span>PRIMARY</span><b>Reactor sabotaged</b><CheckCircle weight="fill" /></div>
          <div><span>EXTRACTION</span><b>4 / 5 formations</b><CheckCircle weight="fill" /></div>
          <div><span>OPTIONAL</span><b>{rescued ? "Crew rescued" : "Crew left behind"}</b>{rescued ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}</div>
          <div><span>COMMAND</span><b>{usedSeals} seals spent</b><Seal weight="duotone" /></div>
        </div>
        <button className="commit-button debrief-button" onClick={onClose}><span><b>RETURN TO BATTLEFIELD</b><small>Inspect the completed mission state.</small></span><ArrowRight /></button>
      </div>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState("plan");
  const [selected, setSelected] = useState("harpoon");
  const [deployments, setDeployments] = useState(DEFAULT_DEPLOYMENT);
  const [doctrine, setDoctrine] = useState("breakthrough");
  const [drillStep, setDrillStep] = useState(-1);
  const [drillComplete, setDrillComplete] = useState(false);
  const [battleTime, setBattleTime] = useState(0);
  const [seals, setSeals] = useState(2);
  const [decision, setDecision] = useState(null);
  const [resolvedDecisions, setResolvedDecisions] = useState([]);
  const [rescueComplete, setRescueComplete] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const timerRef = useRef(null);

  const traplineReady = useMemo(
    () => deployments.harpoon === "alphaApproach" && deployments.furnace === "fireLine" && deployments.breaker === "breachLine",
    [deployments],
  );

  useEffect(() => {
    if (phase !== "drill") return undefined;
    setDrillStep(0);
    const interval = window.setInterval(() => {
      setDrillStep((current) => {
        if (current >= DRILL_STEPS.length - 1) {
          window.clearInterval(interval);
          setDrillComplete(true);
          setPhase("plan");
          return current;
        }
        return current + 1;
      });
    }, 720);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "battle" || decision) return undefined;
    timerRef.current = window.setInterval(() => {
      setBattleTime((current) => Math.min(360, current + 15));
    }, 620);
    return () => window.clearInterval(timerRef.current);
  }, [phase, decision]);

  useEffect(() => {
    if (phase !== "battle") return;
    if (battleTime >= 105 && !resolvedDecisions.includes("beta") && !decision) {
      setDecision("beta");
      return;
    }
    if (battleTime >= 210 && !resolvedDecisions.includes("rescue") && !decision) {
      setDecision("rescue");
      return;
    }
    if (battleTime >= 360) {
      setPhase("complete");
      setShowCompletion(true);
    }
  }, [battleTime, phase, decision, resolvedDecisions]);

  const moveFormation = (formationId, nodeId) => {
    if (!formationId || phase !== "plan") return;
    setDeployments((current) => ({ ...current, [formationId]: nodeId }));
    setDrillComplete(false);
  };

  const resolveDecision = (choice) => {
    if (choice === "override" && seals > 0) {
      setSeals((current) => current - 1);
      if (decision === "rescue") setRescueComplete(true);
    }
    setResolvedDecisions((current) => [...current, decision]);
    setDecision(null);
  };

  const commitMission = () => {
    if (!traplineReady) return;
    setPhase("battle");
    setBattleTime(0);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setSeals(2);
    setShowCompletion(false);
  };

  const resetMission = () => {
    setPhase("plan");
    setBattleTime(0);
    setDeployments(DEFAULT_DEPLOYMENT);
    setDoctrine("breakthrough");
    setSelected("harpoon");
    setDrillStep(-1);
    setDrillComplete(false);
    setSeals(2);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
  };

  return (
    <main className={`warhost-app ${phase}`}>
      <AppHeader phase={phase} battleTime={battleTime} />
      <div className="mission-shell">
        <FormationRoster selected={selected} onSelect={setSelected} deployments={deployments} phase={phase} doctrine={doctrine} setDoctrine={setDoctrine} />
        <Battlefield selected={selected} onSelect={setSelected} deployments={deployments} onMove={moveFormation} phase={phase} battleTime={battleTime} drillStep={drillStep} traplineReady={traplineReady} />
        <IntelRail phase={phase} battleTime={battleTime} traplineReady={traplineReady} rescueComplete={rescueComplete} />
      </div>
      <FooterControls phase={phase} seals={seals} drillComplete={drillComplete} onDrill={() => setPhase("drill")} onCommit={commitMission} onReset={resetMission} traplineReady={traplineReady} />
      <DecisionOverlay decision={decision} seals={seals} onResolve={resolveDecision} />
      {showCompletion && <CompletionOverlay rescued={rescueComplete} usedSeals={2 - seals} onClose={() => setShowCompletion(false)} />}
    </main>
  );
}
