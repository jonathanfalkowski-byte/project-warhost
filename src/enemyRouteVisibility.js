// When each enemy order's route is drawn on the field.
//
// The field used to draw all three enemy routes plus the reinforcement lane for the
// whole battle, at once. That is a picture of everything that will ever happen, with no
// time ordering — four permanent arrows crossing each other, which reads as noise rather
// than as a plan. Nothing about it told the player which order was happening now.
//
// A route is a statement about an order that is closing. So it is drawn only while its
// order is closing: before that the formation is a threat pip on its staging edge with a
// clock, after it the route collapses to a result marker at the endpoint. One line at a
// time, and the line that is drawn is always the one the player should be reading.

// How long before an order lands its route is drawn. The authored order clocks are 90s
// apart at the closest, so a 60s lead-in never puts two lines on the field together.
export const ENEMY_ROUTE_LEAD_SECONDS = 60;

export const enemyRoutePhaseFor = ({
  battleTime,
  actionAt,
  routesVisible,
  leadSeconds = ENEMY_ROUTE_LEAD_SECONDS,
} = {}) => {
  // Before execution the player sees a contact forecast, not movement.
  if (!routesVisible) return "forecast";
  if (!Number.isFinite(actionAt) || !Number.isFinite(battleTime)) return "pending";
  if (battleTime >= actionAt) return "resolved";
  if (battleTime >= actionAt - leadSeconds) return "closing";
  return "pending";
};

// Exactly one phase draws a line.
export const enemyRouteLineVisible = (routePhase) => routePhase === "closing";

// How far along its route the formation has travelled. Progress is measured across the
// lead-in window rather than the whole battle, so a formation waits on its staging edge,
// then covers its route during the window and arrives exactly as the order lands. Scaling
// against the whole battle instead would leave every enemy drifting from the first frame
// and make the icon jump the moment its line appeared.
export const enemyRouteProgressFor = ({
  battleTime,
  actionAt,
  routePhase,
  leadSeconds = ENEMY_ROUTE_LEAD_SECONDS,
} = {}) => {
  if (routePhase === "resolved") return 1;
  if (routePhase !== "closing") return 0;
  if (!Number.isFinite(actionAt) || !Number.isFinite(battleTime) || leadSeconds <= 0) return 0;
  return Math.max(0, Math.min(1, (battleTime - (actionAt - leadSeconds)) / leadSeconds));
};

// The endpoint marker is the route's replacement once it has served its purpose, and its
// destination while the route is being drawn.
export const enemyRouteStopVisible = (routePhase) => routePhase === "closing" || routePhase === "resolved";

// The reinforcement wave is one more lane, and was drawn from the first frame for the
// same reason the others were. It earns its line once it is actually inbound.
export const reinforcementRouteVisible = ({ battleTime, approachAt, routesVisible } = {}) => Boolean(
  routesVisible && Number.isFinite(battleTime) && Number.isFinite(approachAt) && battleTime >= approachAt,
);
