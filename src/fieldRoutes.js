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

export const splitAuthoredRouteAtActionStop = (points, actionStopIndex = 1) => {
  const index = Math.min(Math.max(Number.isFinite(actionStopIndex) ? actionStopIndex : 1, 1), Math.max(1, points.length - 1));
  return { approach: points.slice(0, index + 1), continuation: points.slice(index) };
};

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
    // Track where the role's own action stop lands in the finished polyline. It used to
    // be points[1] by convention, because every stop was authored on the deployment line
    // and therefore had to be the first waypoint. Stops now sit on the ground they
    // describe, so a route reaches its stop partway along and the index has to be real.
    let actionStopIndex = -1;
    routeReferences.forEach((reference) => {
      const point = resolveAuthoredPoint(plan, landmarks, reference);
      pushDistinctPoint(points, point);
      if (typeof reference === "number" && isPoint(point)) {
        const landed = points.findIndex((existing) => samePoint(existing, point));
        if (landed >= 0) actionStopIndex = landed;
      }
    });

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
      // Clamped into the polyline: a stop that failed to resolve must not produce an
      // approach of zero length or one that swallows the whole route.
      actionStopIndex: Math.min(Math.max(actionStopIndex, 1), Math.max(1, points.length - 1)),
      points,
    };
  });
};

// A formation covers its whole approach — deployment edge to action stop — between t=0
// and its action time, then the continuation between there and completion. The approach
// used to be hard-coded to `points.slice(0, 2)`, which was only ever correct while every
// stop sat on the deployment line: once a stop is real ground, a single segment is 1-4%
// of the journey, so a formation crawled through the first fifth of the battle and then
// covered the rest in a rush.
export const positionAlongAuthoredRoute = ({ points, battleTime, actionAt, completeAt, actionStopIndex = 1 }) => {
  if (points.length < 2) return points[0] ?? { x: 0, y: 0 };
  const { approach, continuation } = splitAuthoredRouteAtActionStop(points, actionStopIndex);
  const safeActionAt = Math.max(1, actionAt);
  if (battleTime <= safeActionAt) {
    return pointAlongRoute(approach, battleTime / safeActionAt);
  }
  const remainingDuration = Math.max(1, completeAt - safeActionAt);
  return pointAlongRoute(continuation, (battleTime - safeActionAt) / remainingDuration);
};

// Which segment of an authored route a formation is currently on, and how far into it.
//
// Mirrors `positionAlongAuthoredRoute`'s two-phase parameterisation exactly: the first
// segment is covered between t=0 and the formation's action stop, and the remainder of
// the polyline is covered by length between the action stop and completion. Needed so
// the map can draw the ground a formation has actually covered rather than drawing all
// five complete routes from the first frame of the battle.
export const authoredRouteHeadFor = ({ points, battleTime, actionAt, completeAt, actionStopIndex = 1 } = {}) => {
  const validPoints = Array.isArray(points) ? points.filter(isPoint) : [];
  if (validPoints.length < 2) return { segmentIndex: 0, fraction: 0, segmentCount: 0 };
  const segmentCount = validPoints.length - 1;
  const safeActionAt = Math.max(1, Number(actionAt) || 1);
  const time = Number.isFinite(battleTime) ? Math.max(0, battleTime) : 0;
  const stopIndex = Math.min(Math.max(Number.isFinite(actionStopIndex) ? actionStopIndex : 1, 1), segmentCount);

  if (time <= safeActionAt) {
    // Walk the approach by length, the same way the formation is drawn along it.
    const approach = validPoints.slice(0, stopIndex + 1);
    const approachLengths = approach.slice(0, -1).map((start, index) => Math.hypot(
      approach[index + 1].x - start.x,
      approach[index + 1].y - start.y,
    ));
    const approachTotal = approachLengths.reduce((sum, length) => sum + length, 0);
    let travelled = clamp(time / safeActionAt, 0, 1) * approachTotal;
    for (let index = 0; index < approachLengths.length; index += 1) {
      if (travelled <= approachLengths[index] || index === approachLengths.length - 1) {
        const fraction = approachLengths[index] > 0 ? clamp(travelled / approachLengths[index], 0, 1) : 1;
        return { segmentIndex: index, fraction, segmentCount };
      }
      travelled -= approachLengths[index];
    }
    return { segmentIndex: 0, fraction: 0, segmentCount };
  }

  const remainingPoints = validPoints.slice(stopIndex);
  const lengths = remainingPoints.slice(0, -1).map((start, index) => Math.hypot(
    remainingPoints[index + 1].x - start.x,
    remainingPoints[index + 1].y - start.y,
  ));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const duration = Math.max(1, (Number(completeAt) || safeActionAt) - safeActionAt);
  let remaining = clamp((time - safeActionAt) / duration, 0, 1) * totalLength;

  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const fraction = lengths[index] > 0 ? clamp(remaining / lengths[index], 0, 1) : 1;
      // Offset because these lengths index the polyline from the action stop onward.
      return { segmentIndex: index + stopIndex, fraction, segmentCount };
    }
    remaining -= lengths[index];
  }
  return { segmentIndex: segmentCount - 1, fraction: 1, segmentCount };
};

// How a route segment should be drawn relative to where its formation currently is.
// "ahead" segments are not drawn during execution — drawing them is what put five
// complete routes on the board at once and made the battle unreadable.
export const routeSegmentStateFor = ({ segmentIndex, head } = {}) => {
  if (!head || head.segmentCount === 0) return "covered";
  if (segmentIndex < head.segmentIndex) return "covered";
  if (segmentIndex > head.segmentIndex) return "ahead";
  return "leading";
};
