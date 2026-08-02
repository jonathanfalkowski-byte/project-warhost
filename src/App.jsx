import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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

const PLAYBOOKS = [
  {
    id: "trapline",
    name: "TRAPLINE",
    summary: "Displace, deny, then breach.",
    intent: "Open Alpha by forcing the defender through overlapping fires.",
    icon: Anchor,
    stages: [
      { label: "PULL", detail: "Displace blocker.", icon: Anchor },
      { label: "BURN", detail: "Deny response.", icon: Fire, warm: true },
      { label: "BREAK", detail: "Collapse hold.", icon: Hammer },
    ],
    roles: [
      { id: "pull", label: "PULL / DISPLACER", brief: "Draw Alpha into the kill zone.", node: "alphaApproach", accepts: ["harpoon", "breaker"], defaultFormation: "harpoon" },
      { id: "burn", label: "BURN / DENIER", brief: "Seal the hostile response lane.", node: "fireLine", accepts: ["furnace", "railjack"], defaultFormation: "furnace" },
      { id: "break", label: "BREAK / BREACHER", brief: "Exploit the opened route.", node: "breachLine", accepts: ["breaker", "harpoon"], defaultFormation: "breaker" },
      { id: "anchor", label: "ANCHOR", brief: "Hold the captured control node.", node: "anchorLine", accepts: ["railjack", "furnace"], defaultFormation: "railjack" },
      { id: "recover", label: "RECOVERY", brief: "Preserve extraction capacity.", node: "recoveryLine", accepts: ["hauler"], defaultFormation: "hauler" },
    ],
  },
  {
    id: "spear",
    name: "ARMORED SPEAR",
    summary: "Screen, punch through, exploit.",
    intent: "Concentrate protection around one decisive reactor thrust.",
    icon: Shield,
    stages: [
      { label: "SCREEN", detail: "Absorb contact.", icon: Shield },
      { label: "PUNCH", detail: "Rupture Beta.", icon: Hammer, warm: true },
      { label: "EXPLOIT", detail: "Drive on reactor.", icon: Lightning },
    ],
    roles: [
      { id: "screen", label: "SCREEN", brief: "Take first contact at Alpha.", node: "alphaApproach", accepts: ["railjack", "breaker"], defaultFormation: "railjack" },
      { id: "point", label: "POINT", brief: "Mark the narrow transit lane.", node: "highWalk", accepts: ["harpoon", "breaker"], defaultFormation: "harpoon" },
      { id: "punch", label: "PUNCH / BREACHER", brief: "Crack Beta and the reactor shell.", node: "breachLine", accepts: ["breaker", "harpoon"], defaultFormation: "breaker" },
      { id: "suppress", label: "SUPPRESSION", brief: "Deny flanking reinforcements.", node: "fireLine", accepts: ["furnace", "railjack"], defaultFormation: "furnace" },
      { id: "recover", label: "RECOVERY", brief: "Follow the armored corridor.", node: "recoveryLine", accepts: ["hauler"], defaultFormation: "hauler" },
    ],
  },
  {
    id: "withdrawal",
    name: "FIGHTING WITHDRAWAL",
    summary: "Trade ground for force preservation.",
    intent: "Complete the sabotage while keeping an organized escape corridor.",
    icon: Crosshair,
    stages: [
      { label: "SCREEN", detail: "Mask intent.", icon: Eye },
      { label: "SABOTAGE", detail: "Strike and delay.", icon: Factory, warm: true },
      { label: "WITHDRAW", detail: "Exit in order.", icon: Flag },
    ],
    roles: [
      { id: "screen", label: "FORWARD SCREEN", brief: "Make contact without becoming fixed.", node: "alphaApproach", accepts: ["harpoon", "railjack"], defaultFormation: "harpoon" },
      { id: "delay", label: "DELAY", brief: "Close pursuit lanes behind the screen.", node: "fireLine", accepts: ["furnace", "harpoon"], defaultFormation: "furnace" },
      { id: "sabotage", label: "SABOTAGE", brief: "Strike the Reactor Spine on schedule.", node: "betaLane", accepts: ["breaker", "furnace"], defaultFormation: "breaker" },
      { id: "rearguard", label: "REARGUARD", brief: "Keep the extraction corridor open.", node: "anchorLine", accepts: ["railjack", "breaker"], defaultFormation: "railjack" },
      { id: "recover", label: "RECOVERY", brief: "Collect disabled formations en route.", node: "rescuePen", accepts: ["hauler"], defaultFormation: "hauler" },
    ],
  },
];

const BREAKPOINTS = [
  {
    id: "beta",
    trigger: "IF Beta lane is ranged",
    options: [
      { id: "tempo", label: "PRESERVE TEMPO", effect: "Cross exposed; keep reactor timing." },
      { id: "protect", label: "PROTECT BREACHER", effect: "Lay smoke and divert the thrust." },
    ],
    defaultOption: "tempo",
  },
  {
    id: "rescue",
    trigger: "IF salvage crew is located",
    options: [
      { id: "clock", label: "PRESERVE CLOCK", effect: "Leave the crew; secure extraction." },
      { id: "recover", label: "RECOVER CREW", effect: "Divert the Hauler before sabotage." },
    ],
    defaultOption: "clock",
  },
];

const EVENTS = [
  { at: 30, text: "Forward role has contact. Playbook in motion." },
  { at: 60, text: "Control Node Alpha seized. Railjack anchoring." },
  { at: 105, text: "Helioch fire closes the Beta transit lane." },
  { at: 150, text: "Control Node Beta seized under pressure." },
  { at: 210, text: "Salvage crew located below the reactor deck." },
  { at: 255, text: "Reactor Spine exposed. Breaker Exo advancing." },
  { at: 300, text: "Reactor Spine sabotaged. Extraction route open." },
  { at: 345, text: "Warhost crossing the Extraction Gantry." },
];

const defaultAssignments = (playbook) => Object.fromEntries(
  playbook.roles.map((role) => [role.id, role.defaultFormation]),
);

const defaultBranches = () => Object.fromEntries(
  BREAKPOINTS.map((breakpoint) => [breakpoint.id, breakpoint.defaultOption]),
);

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

function FormationRoster({ selected, onSelect, assignments, playbook, onPlaybook, phase }) {
  const roleByFormation = Object.fromEntries(
    playbook.roles.map((role) => [assignments[role.id], role]),
  );
  return (
    <section className="left-rail" aria-label="Tactical playbooks and Warhost formations">
      <div className="doctrine-heading"><span>TACTICAL PLAYBOOK</span><Radio weight="duotone" /></div>
      <div className="playbook-list">
        {PLAYBOOKS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`playbook-row ${playbook.id === item.id ? "selected" : ""}`}
              onClick={() => onPlaybook(item.id)}
              disabled={phase !== "plan"}
              aria-pressed={playbook.id === item.id}
            >
              <Icon weight="duotone" />
              <span><b>{item.name}</b><small>{item.summary}</small></span>
            </button>
          );
        })}
      </div>
      <div className="rail-heading">
        <span>SELECT FORMATION</span>
        <span>ASSIGN TO ROLE →</span>
      </div>
      <div className="formation-list">
        {FORMATIONS.map((formation) => {
          const Icon = formation.icon;
          const active = selected === formation.id;
          const assignedRole = roleByFormation[formation.id];
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
                <em>{assignedRole?.label ?? "UNASSIGNED"}</em>
              </span>
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

function ComboPanel({ active, drillStep, playbook }) {
  return (
    <div className={`combo-panel panel-surface ${active ? "ready" : "broken"}`}>
      <span className="panel-label">{playbook.name}: {playbook.stages.map((stage) => stage.label).join(" → ")}</span>
      <p>{active ? playbook.intent : "One or more tactical roles are unresolved."}</p>
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
    </div>
  );
}

function Battlefield({ selected, onSelect, deployments, phase, battleTime, drillStep, planReady, playbook, drillSteps }) {
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
      <div className={`combo-path combo-pull ${planReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-burn ${planReady ? "active warm" : ""}`} aria-hidden="true" />
      <div className={`combo-path combo-break ${planReady ? "active" : ""}`} aria-hidden="true" />
      <div className={`kill-zone ${planReady ? "active" : ""}`}><span>DECISION AREA</span></div>

      <div className={`enemy-formation enemy-alpha ${battleTime >= 60 ? "routed" : ""}`}>
        <img src="/assets/helioch-sentinels.png" alt="Helioch Oath defenders at Control Node Alpha" />
        <span>{battleTime >= 60 ? "ALPHA DEFENDERS ROUTED" : "KNOWN DEFENDERS"}</span>
      </div>
      <div className={`enemy-formation enemy-beta ${battleTime >= 150 ? "routed" : "uncertain"}`}>
        <img src="/assets/helioch-sentinels.png" alt="Uncertain Helioch Oath presence near Control Node Beta" />
        <span>{battleTime >= 150 ? "BETA DEFENDERS ROUTED" : "STRENGTH UNCERTAIN"}</span>
      </div>

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

      <ComboPanel active={planReady} drillStep={drillStep} playbook={playbook} />
      {phase === "drill" && (
        <div className="drill-status" role="status">
          <Play weight="fill" />
          <div><span>GHOST DRILL {Math.min(drillStep + 1, drillSteps.length)} / {drillSteps.length}</span><b>{drillSteps[Math.min(drillStep, drillSteps.length - 1)]}</b></div>
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

function RoleBoard({ playbook, assignments, selected, onAssign, canAssign, phase }) {
  return (
    <div className="intel-block role-board">
      <span className="panel-label">PLAYBOOK ROLE SLOTS</span>
      <p className="role-instruction">Select a formation, then assign it to a compatible role.</p>
      <div className="role-list">
        {playbook.roles.map((role, index) => {
          const formation = FORMATIONS.find((item) => item.id === assignments[role.id]);
          const assignable = canAssign(role.id);
          return (
            <button
              key={role.id}
              className={`role-slot ${formation?.id === selected ? "selected" : ""}`}
              onClick={() => onAssign(role.id)}
              disabled={phase !== "plan" || !assignable}
              aria-label={`Assign selected formation to ${role.label}. Currently ${formation?.name ?? "unassigned"}`}
              title={`${role.brief} Compatible formations: ${role.accepts.map((id) => FORMATIONS.find((item) => item.id === id)?.name).join(", ")}.`}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span><b>{role.label}</b><small>{formation?.name ?? "UNASSIGNED"}</small></span>
              {formation?.id === selected ? <CheckCircle weight="fill" /> : <ArrowRight weight="bold" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IntelRail({ phase, battleTime, planReady, rescueComplete, playbook, assignments, selected, onAssign, canAssign }) {
  return (
    <section className="right-rail" aria-label="Mission outlook and enemy intelligence">
      {(phase === "plan" || phase === "drill") && <RoleBoard playbook={playbook} assignments={assignments} selected={selected} onAssign={onAssign} canAssign={canAssign} phase={phase} />}
      <div className="intel-block">
        <span className="panel-label">MISSION OUTLOOK</span>
        <strong className={planReady ? "viable" : "at-risk"}>{planReady ? "VIABLE" : "INCOMPLETE"}</strong>
        <p><b>{playbook.name}:</b> {playbook.intent}</p>
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

function FooterControls({ phase, seals, drillComplete, onDrill, onCommit, onReset, planReady, branches, onBranch }) {
  return (
    <footer className="mission-footer">
      <div className="contingency-block">
        <span className="panel-label">AUTHORED BREAKPOINTS · OVERRIDE COSTS 1 COMMAND SEAL</span>
        <div className="contingencies">
          {BREAKPOINTS.map((breakpoint, index) => (
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
                    >{option.label}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
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
            <button className={`ghost-button ${drillComplete ? "complete" : ""}`} onClick={onDrill} disabled={phase === "drill" || !planReady}>
              {phase === "drill" ? <Pause weight="fill" /> : drillComplete ? <CheckCircle weight="fill" /> : <Play weight="fill" />}
              <span><b>{phase === "drill" ? "RUNNING GHOST DRILL" : drillComplete ? "DRILL VERIFIED" : "RUN GHOST DRILL"}</b><small>Preview routes, triggers, and timing.</small></span>
            </button>
            <button className="commit-button" onClick={onCommit} disabled={!planReady}>
              <span><b>COMMIT PLAYBOOK</b><small>{planReady ? "Execute roles and authored branches." : "Resolve every required role first."}</small></span>
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

function DecisionOverlay({ decision, seals, branches, onResolve }) {
  if (!decision) return null;
  const isBeta = decision === "beta";
  const breakpoint = BREAKPOINTS.find((item) => item.id === decision);
  const authored = breakpoint.options.find((option) => option.id === branches[decision]);
  const alternative = breakpoint.options.find((option) => option.id !== branches[decision]);
  return (
    <div className="decision-backdrop" role="dialog" aria-modal="true" aria-labelledby="decision-title">
      <div className="decision-panel">
        <div className="decision-icon"><Radio weight="duotone" /></div>
        <p className="eyebrow">PLAYBOOK BREAKPOINT</p>
        <h2 id="decision-title">{isBeta ? "Beta lane is collapsing" : "Salvage crew is cut off"}</h2>
        <p>{isBeta ? "Helioch fire has the planned transit lane ranged. Your authored response is ready for execution." : "The optional rescue now conflicts with the reactor timetable. Your playbook already contains a response."}</p>
        <div className="authored-order"><span>AUTHORED ORDER</span><b>{authored.label}</b><small>{authored.effect}</small></div>
        <div className="decision-actions">
          <button onClick={() => onResolve("plan")}><Play weight="duotone" /><span><b>EXECUTE PLAYBOOK</b><small>{authored.label} · spend no seal.</small></span></button>
          <button className="spend-seal" onClick={() => onResolve("override")} disabled={seals <= 0}><Seal weight="duotone" /><span><b>BREAK PLAYBOOK</b><small>{alternative.label} · spend 1 seal.</small></span></button>
        </div>
      </div>
    </div>
  );
}

function CompletionOverlay({ rescued, usedSeals, playbook, onClose }) {
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
          <div><span>PLAYBOOK</span><b>{playbook.name}</b><Seal weight="duotone" /></div>
        </div>
        <p className="completion-note">{usedSeals === 0 ? "Both authored breakpoints held under contact." : `${usedSeals} authored ${usedSeals === 1 ? "order was" : "orders were"} overridden after contact.`}</p>
        <button className="commit-button debrief-button" onClick={onClose}><span><b>RETURN TO BATTLEFIELD</b><small>Inspect the completed mission state.</small></span><ArrowRight /></button>
      </div>
    </div>
  );
}

export function App() {
  const [phase, setPhase] = useState("plan");
  const [selected, setSelected] = useState("harpoon");
  const [playbookId, setPlaybookId] = useState("trapline");
  const [assignments, setAssignments] = useState(() => defaultAssignments(PLAYBOOKS[0]));
  const [branches, setBranches] = useState(defaultBranches);
  const [drillStep, setDrillStep] = useState(-1);
  const [drillComplete, setDrillComplete] = useState(false);
  const [battleTime, setBattleTime] = useState(0);
  const [seals, setSeals] = useState(2);
  const [decision, setDecision] = useState(null);
  const [resolvedDecisions, setResolvedDecisions] = useState([]);
  const [rescueComplete, setRescueComplete] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const timerRef = useRef(null);

  const playbook = useMemo(
    () => PLAYBOOKS.find((item) => item.id === playbookId) ?? PLAYBOOKS[0],
    [playbookId],
  );

  const deployments = useMemo(
    () => Object.fromEntries(playbook.roles.map((role) => [assignments[role.id], role.node])),
    [assignments, playbook],
  );

  const planReady = useMemo(
    () => playbook.roles.every((role) => role.accepts.includes(assignments[role.id]))
      && new Set(Object.values(assignments)).size === FORMATIONS.length,
    [assignments, playbook],
  );

  const drillSteps = useMemo(
    () => [
      `Loading ${playbook.name} geometry`,
      ...playbook.stages.map((stage) => `${stage.label} timing and support arcs confirmed`),
      `Both authored breakpoints remain inside the mission window`,
    ],
    [playbook],
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

  const changePlaybook = (nextId) => {
    if (phase !== "plan") return;
    const next = PLAYBOOKS.find((item) => item.id === nextId);
    if (!next) return;
    setPlaybookId(next.id);
    setAssignments(defaultAssignments(next));
    setBranches(defaultBranches());
    setSelected(next.roles[0].defaultFormation);
    setDrillStep(-1);
    setDrillComplete(false);
  };

  const canAssign = (roleId) => {
    const targetRole = playbook.roles.find((role) => role.id === roleId);
    const currentRole = playbook.roles.find((role) => assignments[role.id] === selected);
    const displacedFormation = assignments[roleId];
    if (!targetRole?.accepts.includes(selected)) return false;
    return !currentRole || currentRole.id === roleId || currentRole.accepts.includes(displacedFormation);
  };

  const assignFormation = (roleId) => {
    if (phase !== "plan" || !canAssign(roleId)) return;
    const currentRole = playbook.roles.find((role) => assignments[role.id] === selected);
    if (!currentRole || currentRole.id === roleId) return;
    setAssignments((current) => ({
      ...current,
      [currentRole.id]: current[roleId],
      [roleId]: selected,
    }));
    setDrillComplete(false);
  };

  const chooseBranch = (breakpointId, optionId) => {
    if (phase !== "plan") return;
    const breakpoint = BREAKPOINTS.find((item) => item.id === breakpointId);
    if (!breakpoint?.options.some((option) => option.id === optionId)) return;
    setBranches((current) => ({ ...current, [breakpointId]: optionId }));
    setDrillComplete(false);
  };

  const resolveDecision = (choice) => {
    const breakpoint = BREAKPOINTS.find((item) => item.id === decision);
    const plannedOption = branches[decision];
    const chosenOption = choice === "override"
      ? breakpoint.options.find((option) => option.id !== plannedOption)?.id
      : plannedOption;
    if (choice === "override" && seals > 0) {
      setSeals((current) => current - 1);
    }
    if (decision === "rescue") setRescueComplete(chosenOption === "recover");
    setResolvedDecisions((current) => [...current, decision]);
    setDecision(null);
  };

  const commitMission = () => {
    if (!planReady) return;
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
    setPlaybookId("trapline");
    setAssignments(defaultAssignments(PLAYBOOKS[0]));
    setBranches(defaultBranches());
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
        <FormationRoster selected={selected} onSelect={setSelected} assignments={assignments} playbook={playbook} onPlaybook={changePlaybook} phase={phase} />
        <Battlefield selected={selected} onSelect={setSelected} deployments={deployments} phase={phase} battleTime={battleTime} drillStep={drillStep} planReady={planReady} playbook={playbook} drillSteps={drillSteps} />
        <IntelRail phase={phase} battleTime={battleTime} planReady={planReady} rescueComplete={rescueComplete} playbook={playbook} assignments={assignments} selected={selected} onAssign={assignFormation} canAssign={canAssign} />
      </div>
      <FooterControls phase={phase} seals={seals} drillComplete={drillComplete} onDrill={() => setPhase("drill")} onCommit={commitMission} onReset={resetMission} planReady={planReady} branches={branches} onBranch={chooseBranch} />
      <DecisionOverlay decision={decision} seals={seals} branches={branches} onResolve={resolveDecision} />
      {showCompletion && <CompletionOverlay rescued={rescueComplete} usedSeals={2 - seals} playbook={playbook} onClose={() => setShowCompletion(false)} />}
    </main>
  );
}
