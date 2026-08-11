const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

const isPoint = (value) => Number.isFinite(value?.x) && Number.isFinite(value?.y);

const samePoint = (left, right) => left?.x === right?.x && left?.y === right?.y;

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

export const buildAuthoredFormationRoutes = ({
  plan,
  landmarks,
  roles,
  assignments,
  formationStarts,
  branches,
}) => {
  if (!plan) return [];
  return plan.routes.map((route) => {
    const role = roles[route.role];
    const formationId = role ? assignments[role.id] : null;
    const authoredStart = resolveAuthoredPoint(plan, landmarks, route.start);
    // Staffing changes which formation travels a route, never the authored
    // geometry of the army plan itself.
    const formationStart = authoredStart;
    const points = [formationStart, ...route.points.map((reference) => resolveAuthoredPoint(plan, landmarks, reference))]
      .filter(isPoint);

    if (route.breakpoint) {
      const selectedBranch = branches[route.breakpoint];
      const branchReferences = plan.branchRoutes?.[route.breakpoint]?.[selectedBranch] ?? [];
      branchReferences
        .map((reference) => resolveAuthoredPoint(plan, landmarks, reference))
        .filter(isPoint)
        .forEach((point) => {
          if (!samePoint(points.at(-1), point)) points.push(point);
        });
    }

    const extraction = landmarks.extraction;
    if (isPoint(extraction) && !samePoint(points.at(-1), extraction)) points.push(extraction);

    return {
      roleIndex: route.role,
      roleId: role?.id ?? null,
      formationId,
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
