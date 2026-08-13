export const enemyExactRoutesVisibleFor = (phase) => phase === "battle" || phase === "complete";

export const enemyContactForecastVisibleFor = (phase) => !enemyExactRoutesVisibleFor(phase);
