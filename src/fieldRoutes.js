const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const isPoint = (value) => Number.isFinite(value?.x) && Number.isFinite(value?.y);

const samePoint = (left, right) => left?.x === right?.x && left?.y === right?.y;

const pushDistinctPoint = (points, point) => {
  if (isPoint(point) && !samePoint(points.at(-1), point)) points.push(point);
};

export const actionStopLabel = (index) => `STOP ${String(index + 1).padStart(2, "0")}`;
export const actionStopBadge = (index) => `S${String(index + 1).padStart(2, "0")}`;
export const actionStopPairLabel = (from, to) => `${actionStopLabel(from)} + ${actionStopLabel(to)}`;

export const resolveAuthoredPoint = (plan, landmarks, reference) => {
  if (typeof reference === "number") return plan.positions[reference] ?? null;
  if (typeof reference === "string") return landmarks[reference] ?? null;
  return isPoint(reference) ? reference : null;
};

export const pointAlongRoute = (points, progress) => {
  const validPoints = points.filter(isPoint);
  if (validPoints.length === 0) return { x: 0, y: 0 };
  if (validPoints.length === 1) return validPoints[0];
  const segments = validPoints.slice(0, -1).map((start, index) => {
    const end = validPoints[index + 1];
    return { start, end, length: Math.hypot(end.x - start.x, end.y - start.y) };
  });
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  let remaining = clamp(progress, 0, 1) * totalLength;
  for (const segment of segments) {
    if (remaining <= segment.length) {
      const ratio = segment.length > 0 ? remaining / segment.length : 0;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
        y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
      };
    }
    remaining -= segment.length;
  }
  return validPoints.at(-1);
};

export const splitAuthoredRouteAtActionStop = (points) => ({
  approach: points.slice(0, 2),
  continuation: points.slice(1),
});

export const movementRouteKeyFor = (route, movementProfile = "tracked") => {
  const genericMovementProfile = movementProfile.replace(/^(light|heavy|support)-/, "");
  const movementRoutes = route.movementRoutes ?? {};
  return movementRoutes[movementProfile]
    ? movementProfile
    : movementRoutes[genericMovementProfile]
      ? genericMovementProfile
      : movementRoutes.tracked
        ? "tracked"
        : null;
};

export const movementRoutePresentation = ({ movementRouteKey = null, staffed = false } = {}) => {
  const kind = movementRouteKey === "walker" ? "walker" : staffed ? "vehicle" : "standard";
  return {
    kind,
    label: kind === "walker"
      ? "WALKER CUT-THROUGH"
      : kind === "vehicle"
        ? "VEHICLE STREET ROUTE"
        : "STANDARD AUTHORED ROUTE",
    terrainLabel: kind === "walker"
      ? "THROUGH RUINS"
      : kind === "vehicle"
        ? "AROUND RUINS"
        : "OPEN APPROACH",
  };
};

// A route preview is drawn as map geometry, which conveys nothing to a screen
// reader. Focusing an action stop produces the same preview as hovering it, so this
// sentence is the keyboard-and-screen-reader equivalent of reading the drawn route.
// Returns "" when there is nothing to announce, which clears the live region.
export const routePreviewAnnouncement = ({ formationName, movementRouteKind, roleIndex, roleLabel } = {}) => {
  if (!formationName || !roleLabel || !Number.isInteger(roleIndex) || roleIndex < 0) return "";
  const terrain = movementRouteKind === "walker"
    ? "walker route, cutting through ruins"
    : "vehicle route, avoiding blocked terrain";
  return `Route preview only, not assigned. ${formationName} would take the ${terrain}, to action stop ${roleIndex + 1}, ${roleLabel}.`;
};

// Deliberately takes no formation staging coordinates. The playbook owns every
// legal corridor, so a route's origin is always its authored start; staffing only
// selects which authored corridor that formation's movement profile permits.
// Callers that still pass staging positions are ignored by design.
export const buildAuthoredFormationRoutes = ({
  plan,
  landmarks,
  roles,
  assignments,
  formationMovementProfiles = {},
  branches,
}) => {
  if (!plan) return [];
  return plan.routes.map((route) => {
    const role = roles[route.role];
    const formationId = role ? assignments[role.id] : null;
    const movementProfile = formationMovementProfiles[formationId] ?? "tracked";
    const authoredStart = resolveAuthoredPoint(plan, landmarks, route.start);
    const points = [];
    pushDistinctPoint(points, authoredStart);
    const movementRoutes = route.movementRoutes ?? {};
    const movementRouteKey = movementRouteKeyFor(route, movementProfile);
    const routeReferences = movementRouteKey ? movementRoutes[movementRouteKey] : route.points;
    const movementRoutePresentationData = movementRoutePresentation({
      movementRouteKey,
      staffed: Boolean(formationId),
    });
    routeReferences
      .map((reference) => resolveAuthoredPoint(plan, landmarks, reference))
      .forEach((point) => pushDistinctPoint(points, point));

    if (route.breakpoint) {
      const selectedBranch = branches[route.breakpoint];
      const branchReferences = plan.branchRoutes?.[route.breakpoint]?.[selectedBranch] ?? [];
      branchReferences
        .map((reference) => resolveAuthoredPoint(plan, landmarks, reference))
        .filter(isPoint)
        .forEach((point) => pushDistinctPoint(points, point));
    }

    const extractionLandmark = route.extractionLandmark ?? plan.extractionLandmark ?? "extraction";
    const extraction = landmarks[extractionLandmark] ?? landmarks.extraction;
    pushDistinctPoint(points, extraction);

    return {
      roleIndex: route.role,
      roleId: role?.id ?? null,
      formationId,
      movementProfile,
      movementRouteKey,
      movementRouteKind: movementRoutePresentationData.kind,
      movementRouteLabel: movementRoutePresentationData.label,
      movementTerrainLabel: movementRoutePresentationData.terrainLabel,
      extractionLandmark,
      breakpoint: route.breakpoint ?? null,
      points,
    };
  });
};

export const positionAlongAuthoredRoute = ({ points, battleTime, actionAt, completeAt }) => {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const safeActionAt = Math.max(1, actionAt);
  if (battleTime <= safeActionAt) {
    return pointAlongRoute(points.slice(0, 2), battleTime / safeActionAt);
  }
  const remainingRoute = points.slice(1);
  const remainingDuration = Math.max(1, completeAt - safeActionAt);
  return pointAlongRoute(remainingRoute, (battleTime - safeActionAt) / remainingDuration);
};
