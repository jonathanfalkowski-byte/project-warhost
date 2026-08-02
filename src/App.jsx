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
  Plus,
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

const STAGING_NODES = {
  harpoon: { left: 17, top: 83, label: "Staging line" },
  furnace: { left: 26, top: 87, label: "Staging line" },
  breaker: { left: 35, top: 83, label: "Staging line" },
  railjack: { left: 44, top: 87, label: "Staging line" },
  hauler: { left: 53, top: 83, label: "Staging line" },
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
      { id: "pull", label: "PULL / DISPLACER", brief: "Draw Alpha into the kill zone.", node: "alphaApproach", accepts: ["harpoon", "breaker"] },
      { id: "burn", label: "BURN / DENIER", brief: "Seal the hostile response lane.", node: "fireLine", accepts: ["furnace", "railjack"] },
      { id: "break", label: "BREAK / BREACHER", brief: "Exploit the opened route.", node: "breachLine", accepts: ["breaker", "harpoon"] },
      { id: "anchor", label: "ANCHOR", brief: "Hold the captured control node.", node: "anchorLine", accepts: ["railjack", "furnace"] },
      { id: "recover", label: "RECOVERY", brief: "Preserve extraction capacity.", node: "recoveryLine", accepts: ["hauler"] },
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
      { id: "screen", label: "SCREEN", brief: "Take first contact at Alpha.", node: "alphaApproach", accepts: ["railjack", "breaker"] },
      { id: "point", label: "POINT", brief: "Mark the narrow transit lane.", node: "highWalk", accepts: ["harpoon", "breaker"] },
      { id: "punch", label: "PUNCH / BREACHER", brief: "Crack Beta and the reactor shell.", node: "breachLine", accepts: ["breaker", "harpoon"] },
      { id: "suppress", label: "SUPPRESSION", brief: "Deny flanking reinforcements.", node: "fireLine", accepts: ["furnace", "railjack"] },
      { id: "recover", label: "RECOVERY", brief: "Follow the armored corridor.", node: "recoveryLine", accepts: ["hauler"] },
    ],
  },
  {
    id: "pressure",
    name: "DIVIDED PRESSURE",
    summary: "Pin both nodes, converge on reactor.",
    intent: "Split the defense at Alpha and Beta, then reunite for the sabotage.",
    icon: Crosshair,
    stages: [
      { label: "PIN", detail: "Fix both guards.", icon: Target },
      { label: "SPLIT", detail: "Open two lanes.", icon: Crosshair, warm: true },
      { label: "CONVERGE", detail: "Collapse on reactor.", icon: Factory },
    ],
    roles: [
      { id: "alpha", label: "ALPHA PIN", brief: "Hold the known defenders in place.", node: "alphaApproach", accepts: ["railjack", "harpoon"] },
      { id: "beta", label: "BETA RAID", brief: "Pressure the uncertain control node.", node: "betaLane", accepts: ["harpoon", "breaker"] },
      { id: "deny", label: "LANE DENIAL", brief: "Prevent either defense from reinforcing.", node: "fireLine", accepts: ["furnace", "railjack"] },
      { id: "reactor", label: "REACTOR TEAM", brief: "Converge through the opening and sabotage.", node: "breachLine", accepts: ["breaker", "harpoon"] },
      { id: "recover", label: "EXTRACTION", brief: "Collect the split force at the gantry.", node: "recoveryLine", accepts: ["hauler", "railjack"] },
    ],
  },
];

const BREAKPOINTS = [
  {
    id: "beta",
    trigger: "IF Beta lane is ranged",
    options: [
      { id: "tempo", label: "PRESERVE TEMPO", effect: "Cross exposed; keep reactor timing.", routeLabel: "DIRECT CROSSING", path: ["BETA LANE", "REACTOR"] },
      { id: "protect", label: "PROTECT BREACHER", effect: "Lay smoke and divert the thrust.", routeLabel: "COVERED DIVERSION", path: ["SMOKE LINE", "COVERED ARC", "REACTOR"] },
    ],
    defaultOption: "tempo",
  },
  {
    id: "rescue",
    trigger: "IF salvage crew is located",
    options: [
      { id: "clock", label: "PRESERVE CLOCK", effect: "Leave the crew; secure extraction.", routeLabel: "BYPASS SALVAGE", path: ["REACTOR", "EXTRACTION"] },
      { id: "recover", label: "RECOVER CREW", effect: "Divert the Hauler before sabotage.", routeLabel: "RECOVERY LOOP", path: ["REACTOR", "SALVAGE PEN", "EXTRACTION"] },
    ],
    defaultOption: "clock",
  },
];

const FIELD_PLANS = {
  trapline: {
    positions: [
      { x: 35, y: 32 },
      { x: 49, y: 38 },
      { x: 62, y: 32 },
      { x: 70, y: 25 },
      { x: 73, y: 47 },
    ],
    routes: [
      { role: 0, start: { x: 17, y: 76 }, points: [0, "alpha", { x: 48, y: 25 }] },
      { role: 1, start: { x: 26, y: 80 }, points: [1, { x: 57, y: 39 }, { x: 67, y: 46 }] },
      { role: 2, start: { x: 35, y: 76 }, points: [2], breakpoint: "beta" },
      { role: 3, start: { x: 44, y: 80 }, points: [3, "beta"] },
      { role: 4, start: { x: 53, y: 76 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 2, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [2, "reactor"],
        protect: [2, { x: 67, y: 20 }, { x: 72, y: 34 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
  spear: {
    positions: [
      { x: 34, y: 36 },
      { x: 49, y: 27 },
      { x: 61, y: 36 },
      { x: 54, y: 43 },
      { x: 73, y: 48 },
    ],
    routes: [
      { role: 0, start: { x: 17, y: 76 }, points: [0, "alpha"] },
      { role: 1, start: { x: 26, y: 80 }, points: [1, "beta"] },
      { role: 2, start: { x: 35, y: 76 }, points: [2], breakpoint: "beta" },
      { role: 3, start: { x: 44, y: 80 }, points: [3, { x: 66, y: 43 }] },
      { role: 4, start: { x: 53, y: 76 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 2, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [2, "reactor"],
        protect: [2, { x: 65, y: 23 }, { x: 72, y: 34 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
  pressure: {
    positions: [
      { x: 34, y: 32 },
      { x: 60, y: 18 },
      { x: 48, y: 40 },
      { x: 64, y: 38 },
      { x: 73, y: 48 },
    ],
    routes: [
      { role: 0, start: { x: 17, y: 76 }, points: [0, "alpha"] },
      { role: 1, start: { x: 26, y: 80 }, points: [1, "beta"] },
      { role: 2, start: { x: 35, y: 76 }, points: [2, { x: 56, y: 33 }] },
      { role: 3, start: { x: 44, y: 80 }, points: [3], breakpoint: "beta" },
      { role: 4, start: { x: 53, y: 76 }, points: [4], breakpoint: "rescue" },
    ],
    breakpointRoles: { beta: 3, rescue: 4 },
    branchRoutes: {
      beta: {
        tempo: [3, "reactor"],
        protect: [3, { x: 68, y: 25 }, { x: 73, y: 35 }, "reactor"],
      },
      rescue: {
        clock: [4, "extraction"],
        recover: [4, "rescue", "extraction"],
      },
    },
  },
};

const FIELD_LANDMARKS = {
  alpha: { x: 35, y: 24 },
  beta: { x: 76, y: 12 },
  reactor: { x: 76, y: 46 },
  extraction: { x: 91, y: 18 },
  rescue: { x: 83, y: 75 },
};

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

const emptyAssignments = (playbook) => Object.fromEntries(
  playbook.roles.map((role) => [role.id, null]),
);

const SYNERGY_LINKS = new Set([
  "breaker:harpoon",
  "breaker:hauler",
  "breaker:railjack",
  "furnace:harpoon",
  "furnace:railjack",
  "hauler:railjack",
]);

const formationsLink = (leftId, rightId) => {
  if (!leftId || !rightId) return false;
  return SYNERGY_LINKS.has([leftId, rightId].sort().join(":"));
};

const calculateRoleOutputs = (playbook, assignments) => Object.fromEntries(
  playbook.roles.map((role, index) => {
    const formationId = assignments[role.id];
    if (!formationId) return [role.id, null];
    const neighbors = [playbook.roles[index - 1], playbook.roles[index + 1]].filter(Boolean);
    const links = neighbors.filter((neighbor) => formationsLink(formationId, assignments[neighbor.id])).length;
    const hiddenFit = role.accepts.includes(formationId) ? 72 : 58;
    const score = Math.min(96, hiddenFit + links * 10 + (links === 2 ? 4 : 0));
    return [role.id, { score, links }];
  }),
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

function FormationRoster({ selected, onSelect, assignments, playbook, onPlaybook, phase, onFormationDragStart }) {
  const roleByFormation = Object.fromEntries(
    playbook.roles.filter((role) => assignments[role.id]).map((role) => [assignments[role.id], role]),
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
        <span>VIEW ON FIELD</span>
      </div>
      <div className="formation-list">
        {FORMATIONS.map((formation) => {
          const Icon = formation.icon;
          const active = selected === formation.id;
          const assignedRole = roleByFormation[formation.id];
          const assignedIndex = assignedRole ? playbook.roles.findIndex((role) => role.id === assignedRole.id) : -1;
          return (
            <button
              key={formation.id}
              className={`formation-row ${active ? "selected" : ""} ${assignedRole ? "assigned" : "available"}`}
              onClick={() => onSelect(formation.id)}
              draggable={phase === "plan"}
              onDragStart={(event) => onFormationDragStart(event, formation.id)}
              disabled={phase !== "plan" && phase !== "drill"}
              aria-pressed={active}
              aria-label={`${formation.name}. ${assignedRole ? `Assigned to action stop ${assignedIndex + 1}, ${assignedRole.label}` : "Available. Drag to an action stop"}.`}
              title={phase === "plan" ? "Drag to an action stop or click to inspect on the field" : undefined}
            >
              <span className="formation-number">{formation.number}</span>
              <FormationPortrait formation={formation} compact />
              <span className="formation-copy">
                <b>{formation.name}</b>
                <small><Icon weight="duotone" /> {formation.role}</small>
                <em>{assignedRole ? `STOP ${String(assignedIndex + 1).padStart(2, "0")} · ${assignedRole.label}` : "AVAILABLE · DRAG TO STOP"}</em>
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
      <span className="panel-label">VICTORY ORDERS</span>
      <div className="victory-rule"><b>WIN THE MISSION</b><small>Sabotage Reactor Spine + extract 3 formations.</small></div>
      {steps.map((step) => (
        <div className={`route-step route-${step.n} ${step.done ? "done" : ""}`} key={step.n}>
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

const resolveFieldPoint = (plan, reference) => {
  if (typeof reference === "number") return plan.positions[reference];
  if (typeof reference === "string") return FIELD_LANDMARKS[reference];
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

function TacticalFieldPlan({ assignments, branches, phase, playbook }) {
  const layerRef = useRef(null);
  const [layerSize, setLayerSize] = useState({ width: 1, height: 1 });
  const plan = FIELD_PLANS[playbook.id];

  useEffect(() => {
    if (!layerRef.current || phase === "battle" || phase === "complete") return undefined;
    const element = layerRef.current;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      setLayerSize({ width: bounds.width, height: bounds.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [phase, playbook.id]);

  if (!plan || phase === "battle" || phase === "complete") return null;

  const routes = plan.routes.map((route) => {
    const roleIndex = route.role;
    const role = playbook.roles[roleIndex];
    const formation = FORMATIONS.find((item) => item.id === assignments[role.id]);
    const staging = formation ? STAGING_NODES[formation.id] : null;
    const start = staging ? { x: staging.left, y: staging.top - 3 } : route.start;
    return { ...route, roleIndex, role, formation, start };
  });
  const baseSegments = routes.flatMap((route) => {
    const points = [route.start, ...route.points].map((point) => resolveFieldPoint(plan, point));
    return points.slice(0, -1).map((point, index) => ({
      id: `route-${route.roleIndex}-${index}`,
      start: point,
      end: points[index + 1],
      className: `base lane-${route.roleIndex + 1} ${route.formation ? "staffed" : ""}`,
    }));
  });
  const branchSegments = BREAKPOINTS.flatMap((breakpoint, breakpointIndex) => {
    const selectedOptionId = branches[breakpoint.id];
    const roleIndex = plan.breakpointRoles[breakpoint.id];
    const role = playbook.roles[roleIndex];
    const staffed = Boolean(assignments[role.id]);
    const orderedOptions = [
      ...breakpoint.options.filter((option) => option.id !== selectedOptionId),
      ...breakpoint.options.filter((option) => option.id === selectedOptionId),
    ];
    return orderedOptions.flatMap((option) => {
      const route = plan.branchRoutes[breakpoint.id][option.id];
      const selectedRoute = option.id === selectedOptionId;
      const changed = selectedRoute && option.id !== breakpoint.defaultOption;
      return route.slice(0, -1).map((point, index) => ({
        id: `${breakpoint.id}-${option.id}-${index}`,
        start: resolveFieldPoint(plan, point),
        end: resolveFieldPoint(plan, route[index + 1]),
        className: `branch breakpoint-${breakpointIndex + 1} lane-${roleIndex + 1} ${selectedRoute ? "selected-route" : "alternative-route"} ${staffed ? "staffed" : ""} ${changed ? "changed" : ""}`,
      }));
    });
  });
  const branchTurns = BREAKPOINTS.flatMap((breakpoint, breakpointIndex) => {
    const selectedOptionId = branches[breakpoint.id];
    return breakpoint.options.flatMap((option) => {
      const selectedRoute = option.id === selectedOptionId;
      return plan.branchRoutes[breakpoint.id][option.id]
        .filter((point) => typeof point === "object" || point === "rescue")
        .slice(0, 1)
        .map((point, index) => ({
          id: `${breakpoint.id}-${option.id}-turn-${index}`,
          point: resolveFieldPoint(plan, point),
          label: `${selectedRoute ? "" : "ALT · "}${option.routeLabel}`,
          className: `breakpoint-${breakpointIndex + 1} ${selectedRoute ? "selected-route" : "alternative-route"}`,
        }));
    });
  });

  return (
    <div className="field-plan-layer" ref={layerRef} aria-label={`${playbook.name} authored battlefield plan`}>
      <div className="field-plan-caption panel-surface" aria-live="polite">
        <div><span>5 FORMATION ROUTES</span><b>{playbook.name}</b></div>
        <div className="field-plan-branch-state">
          {BREAKPOINTS.map((breakpoint, index) => {
            const option = breakpoint.options.find((item) => item.id === branches[breakpoint.id]);
            const changed = branches[breakpoint.id] !== breakpoint.defaultOption;
            return <span className={changed ? "changed" : ""} key={breakpoint.id}>BP{index + 1} · {option.routeLabel}</span>;
          })}
        </div>
      </div>
      {[...baseSegments, ...branchSegments].map((segment) => (
        <div className={`field-plan-segment ${segment.className}`} style={fieldSegmentStyle(segment.start, segment.end, layerSize)} key={segment.id}>
          <ArrowRight weight="bold" />
        </div>
      ))}
      {branchTurns.map((turn) => (
        <div className={`field-plan-turn ${turn.className}`} style={{ left: `${turn.point.x}%`, top: `${turn.point.y}%` }} key={turn.id}>
          <MapPin weight="fill" /><span>{turn.label}</span>
        </div>
      ))}
      {routes.map((route) => (
        <div className={`field-plan-entry lane-${route.roleIndex + 1} ${route.formation ? "staffed" : ""}`} style={{ left: `${route.start.x}%`, top: `${route.start.y}%` }} key={`origin-${route.roleIndex}`}>
          <Flag weight="fill" />
          <span>{route.formation ? route.formation.number : String(route.roleIndex + 1).padStart(2, "0")}</span>
          <small>{route.formation ? route.formation.name : `ROUTE ${String(route.roleIndex + 1).padStart(2, "0")}`}</small>
        </div>
      ))}
      {plan.positions.map((position, index) => {
        const role = playbook.roles[index];
        const formation = FORMATIONS.find((item) => item.id === assignments[role.id]);
        return (
          <div className={`field-plan-position lane-${index + 1} ${formation ? "staffed" : ""}`} style={{ left: `${position.x}%`, top: `${position.y}%` }} key={role.id}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{role.label.split(" / ")[0]}</span>
            {formation && <em>{formation.name}</em>}
          </div>
        );
      })}
    </div>
  );
}

function PlaybookBoard({ active, assignments, drillStep, onChooseRole, onAssignFormation, outputs, phase, playbook }) {
  const [dropTargetRoleId, setDropTargetRoleId] = useState(null);

  if (phase === "battle" || phase === "complete") {
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

  const assignedCount = Object.values(assignments).filter(Boolean).length;
  return (
    <div className={`playbook-board panel-surface ${active ? "ready" : "incomplete"}`}>
      <div className="playbook-board-heading">
        <div>
          <span className="panel-label">{playbook.name} · AUTHORED TACTICAL ROUTE</span>
          <b>PLACE THE FORMATIONS</b>
        </div>
        <strong>{assignedCount} / {playbook.roles.length} PLACED</strong>
      </div>
      <p>Each stop belongs to a separate formation route. Drag or click to staff it; the lightning links show placement combos, not movement.</p>
      <div className="route-terminals" aria-hidden="true"><span>FORMATION LANES</span><span>COMBO ORDER</span></div>
      <div className="playbook-route">
        {playbook.roles.map((role, index) => {
          const formation = FORMATIONS.find((item) => item.id === assignments[role.id]);
          const output = outputs[role.id];
          const nextRole = playbook.roles[index + 1];
          const nextFormation = nextRole ? FORMATIONS.find((item) => item.id === assignments[nextRole.id]) : null;
          const linked = formation && nextFormation ? formationsLink(formation.id, nextFormation.id) : false;
          return (
            <Fragment key={role.id}>
              <button
                className={`playbook-slot ${formation ? "filled" : "empty"} ${dropTargetRoleId === role.id ? "drop-target" : ""}`}
                onClick={() => onChooseRole(role.id)}
                onDragEnter={(event) => { event.preventDefault(); setDropTargetRoleId(role.id); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTargetRoleId(null); }}
                onDrop={(event) => {
                  event.preventDefault();
                  const formationId = event.dataTransfer.getData("application/x-warhost-formation") || event.dataTransfer.getData("text/plain");
                  setDropTargetRoleId(null);
                  onAssignFormation(role.id, formationId);
                }}
                disabled={phase !== "plan"}
                aria-label={`Action stop ${index + 1}, ${role.label}. Currently ${formation?.name ?? "empty"}`}
              >
                <span className="slot-number">STOP {String(index + 1).padStart(2, "0")}</span>
                <span className="slot-role">{role.label}</span>
                <span className="slot-task">{role.brief}</span>
                {formation ? (
                  <>
                    <span className="slot-formation"><img src={formation.asset} alt="" /><b>{formation.name}</b></span>
                    <span className="slot-result"><b>{output.score}%</b><small>{output.links} {output.links === 1 ? "LINK" : "LINKS"}</small></span>
                  </>
                ) : (
                  <span className="slot-empty"><Plus weight="bold" /><b>DROP UNIT</b><small>OR CLICK</small></span>
                )}
              </button>
              {nextRole && <span className={`route-leg ${formation && nextFormation ? "occupied" : ""} ${linked ? "linked" : ""}`} aria-hidden="true" title="Placement combo link, not a movement route"><Lightning weight="fill" /></span>}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function Battlefield({ selected, onSelect, deployments, phase, battleTime, drillStep, planReady, playbook, drillSteps, assignments, branches, outputs, onChooseRole, onAssignFormation, onFormationDragStart }) {
  const activeFormations = phase === "complete" ? ["harpoon", "furnace", "breaker", "railjack"] : FORMATIONS.map((f) => f.id);
  const alphaState = battleTime >= 60 ? "secured" : "active";
  const betaState = battleTime >= 150 ? "secured" : "threat";
  const reactorState = battleTime >= 300 ? "secured" : "threat";
  const extractionState = phase === "complete" ? "secured" : "future";

  return (
    <section className={`battlefield phase-${phase}`} aria-label="Operation Dead Circuit mission map">
      <img className="battlefield-art" src="/assets/dead-circuit-foundry.png" alt="Isometric industrial foundry battlefield" />
      <div className="battlefield-wash" />
      <TacticalFieldPlan assignments={assignments} branches={branches} phase={phase} playbook={playbook} />
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
        const assignedNode = deployments[formation.id] ? NODES[deployments[formation.id]] : null;
        const node = assignedNode ?? STAGING_NODES[formation.id];
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
            draggable={phase === "plan"}
            onDragStart={(event) => onFormationDragStart(event, formation.id)}
            aria-label={`${formation.name}, ${assignedNode ? formation.role : "unassigned"}, at ${node.label}`}
          >
            <FormationPortrait formation={formation} />
            <span className="map-formation-number">{formation.number}</span>
            <span className="map-formation-label">{formation.name}</span>
          </button>
        );
      })}

      <PlaybookBoard active={planReady} assignments={assignments} drillStep={drillStep} onChooseRole={onChooseRole} onAssignFormation={onAssignFormation} outputs={outputs} phase={phase} playbook={playbook} />
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

function IntelRail({ phase, battleTime, planReady, rescueComplete, playbook, assignedCount }) {
  return (
    <section className="right-rail" aria-label="Mission outlook and enemy intelligence">
      <div className="intel-block">
        <span className="panel-label">MISSION OUTLOOK</span>
        <strong className={planReady ? "viable" : "at-risk"}>{planReady ? "VIABLE" : `${assignedCount} / 5 ASSIGNED`}</strong>
        <p><b>{playbook.name}:</b> {playbook.intent}</p>
        {!planReady && phase === "plan" && <p className="assignment-pointer"><ArrowRight weight="bold" /> Place formations on the authored tactical route.</p>}
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
                      title={`${option.routeLabel}: ${option.effect}`}
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
        <div className="decision-route-compare">
          <span className="panel-label">HOW THE PLAN CHANGES</span>
          {breakpoint.options.map((option) => {
            const isAuthored = option.id === branches[decision];
            return (
              <div className={isAuthored ? "authored" : "alternate"} key={option.id}>
                <strong>{isAuthored ? "AUTHORED PATH" : "IF OVERRIDDEN"}</strong>
                <b>{option.routeLabel}</b>
                <span>{option.path.map((step, index) => <Fragment key={step}>{index > 0 && <ArrowRight weight="bold" />}<em>{step}</em></Fragment>)}</span>
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

function FormationPicker({ role, playbook, assignments, onChoose, onClose }) {
  if (!role) return null;
  const assignedFormationId = assignments[role.id];
  return (
    <div className="decision-backdrop formation-picker-backdrop" role="dialog" aria-modal="true" aria-labelledby="formation-picker-title">
      <div className="decision-panel formation-picker-panel">
        <p className="eyebrow">STAFF ACTION STOP</p>
        <h2 id="formation-picker-title">Who executes {role.label}?</h2>
        <p>{role.brief} The route and timing are already authored. Choose the formation; its output and neighboring connections are revealed after placement.</p>
        <div className="formation-picker-list">
          {FORMATIONS.map((formation) => {
            const currentRole = playbook.roles.find((item) => assignments[item.id] === formation.id);
            const currentRoleIndex = currentRole ? playbook.roles.findIndex((item) => item.id === currentRole.id) : -1;
            const current = assignedFormationId === formation.id;
            return (
              <button key={formation.id} className={current ? "current" : ""} onClick={() => onChoose(formation.id)}>
                <FormationPortrait formation={formation} compact />
                <span className="picker-formation-copy">
                  <b>{formation.name}</b>
                  <small>{formation.role} · {formation.purpose}</small>
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

function CompletionOverlay({ rescued, usedSeals, playbook, onClose }) {
  return (
    <div className="decision-backdrop completion-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-title">
      <div className="decision-panel completion-panel">
        <CheckCircle className="completion-icon" weight="duotone" />
        <p className="eyebrow">OPERATION SUCCESS</p>
        <div className="victory-banner">VICTORY</div>
        <h2 id="complete-title">You won Operation Dead Circuit.</h2>
        <p>The Reactor Spine was sabotaged and 4 formations escaped. Victory required the primary objective plus at least 3 extracted formations.</p>
        <div className="after-action-grid">
          <div><span>PRIMARY · COMPLETE</span><b>Reactor sabotaged</b><CheckCircle weight="fill" /></div>
          <div><span>EXTRACTION · PASSED</span><b>4 extracted · 3 required</b><CheckCircle weight="fill" /></div>
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
  const [assignments, setAssignments] = useState(() => emptyAssignments(PLAYBOOKS[0]));
  const [branches, setBranches] = useState(defaultBranches);
  const [drillStep, setDrillStep] = useState(-1);
  const [drillComplete, setDrillComplete] = useState(false);
  const [battleTime, setBattleTime] = useState(0);
  const [seals, setSeals] = useState(2);
  const [decision, setDecision] = useState(null);
  const [resolvedDecisions, setResolvedDecisions] = useState([]);
  const [rescueComplete, setRescueComplete] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [pickerRoleId, setPickerRoleId] = useState(null);
  const timerRef = useRef(null);

  const playbook = useMemo(
    () => PLAYBOOKS.find((item) => item.id === playbookId) ?? PLAYBOOKS[0],
    [playbookId],
  );

  const deployments = useMemo(
    () => Object.fromEntries(playbook.roles.filter((role) => assignments[role.id]).map((role) => [assignments[role.id], role.node])),
    [assignments, playbook],
  );

  const assignedCount = useMemo(
    () => Object.values(assignments).filter(Boolean).length,
    [assignments],
  );

  const planReady = useMemo(
    () => playbook.roles.every((role) => Boolean(assignments[role.id]))
      && new Set(Object.values(assignments).filter(Boolean)).size === FORMATIONS.length,
    [assignments, playbook],
  );

  const roleOutputs = useMemo(
    () => calculateRoleOutputs(playbook, assignments),
    [assignments, playbook],
  );

  const drillSteps = useMemo(
    () => [
      `Loading ${playbook.name} geometry`,
      ...playbook.stages.map((stage) => `${stage.label} timing and support arcs confirmed`),
      `All ${assignedCount} assigned formations evaluated against neighboring links`,
      `Both authored breakpoints remain inside the mission window`,
    ],
    [assignedCount, playbook],
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
    setAssignments(emptyAssignments(next));
    setBranches(defaultBranches());
    setSelected("harpoon");
    setPickerRoleId(null);
    setDrillStep(-1);
    setDrillComplete(false);
  };

  const assignFormationToRole = (roleId, formationId) => {
    if (phase !== "plan" || !FORMATIONS.some((formation) => formation.id === formationId)) return;
    const targetRole = playbook.roles.find((role) => role.id === roleId);
    const sourceRole = playbook.roles.find((role) => assignments[role.id] === formationId);
    if (!targetRole) return;
    if (targetRole.id === sourceRole?.id) {
      setPickerRoleId(null);
      return;
    }
    setAssignments((current) => ({
      ...current,
      ...(sourceRole ? { [sourceRole.id]: current[targetRole.id] ?? null } : {}),
      [targetRole.id]: formationId,
    }));
    setSelected(formationId);
    setPickerRoleId(null);
    setDrillComplete(false);
  };

  const chooseFormationForRole = (formationId) => {
    if (!pickerRoleId) return;
    assignFormationToRole(pickerRoleId, formationId);
  };

  const beginFormationDrag = (event, formationId) => {
    if (phase !== "plan" || !FORMATIONS.some((formation) => formation.id === formationId)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-warhost-formation", formationId);
    event.dataTransfer.setData("text/plain", formationId);
    setSelected(formationId);
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
    setAssignments(emptyAssignments(PLAYBOOKS[0]));
    setBranches(defaultBranches());
    setSelected("harpoon");
    setDrillStep(-1);
    setDrillComplete(false);
    setSeals(2);
    setDecision(null);
    setResolvedDecisions([]);
    setRescueComplete(false);
    setShowCompletion(false);
    setPickerRoleId(null);
  };

  return (
    <main className={`warhost-app ${phase}`}>
      <AppHeader phase={phase} battleTime={battleTime} />
      <div className="mission-shell">
        <FormationRoster selected={selected} onSelect={setSelected} assignments={assignments} playbook={playbook} onPlaybook={changePlaybook} phase={phase} onFormationDragStart={beginFormationDrag} />
        <Battlefield selected={selected} onSelect={setSelected} deployments={deployments} phase={phase} battleTime={battleTime} drillStep={drillStep} planReady={planReady} playbook={playbook} drillSteps={drillSteps} assignments={assignments} branches={branches} outputs={roleOutputs} onChooseRole={setPickerRoleId} onAssignFormation={assignFormationToRole} onFormationDragStart={beginFormationDrag} />
        <IntelRail phase={phase} battleTime={battleTime} planReady={planReady} rescueComplete={rescueComplete} playbook={playbook} assignedCount={assignedCount} />
      </div>
      <FooterControls phase={phase} seals={seals} drillComplete={drillComplete} onDrill={() => setPhase("drill")} onCommit={commitMission} onReset={resetMission} planReady={planReady} branches={branches} onBranch={chooseBranch} />
      <DecisionOverlay decision={decision} seals={seals} branches={branches} onResolve={resolveDecision} />
      <FormationPicker role={playbook.roles.find((role) => role.id === pickerRoleId)} playbook={playbook} assignments={assignments} onChoose={chooseFormationForRole} onClose={() => setPickerRoleId(null)} />
      {showCompletion && <CompletionOverlay rescued={rescueComplete} usedSeals={2 - seals} playbook={playbook} onClose={() => setShowCompletion(false)} />}
    </main>
  );
}
