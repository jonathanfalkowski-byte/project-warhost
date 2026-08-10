export const OPERATIONAL_DISPOSITIONS = Object.freeze({
  dominion: Object.freeze({ id: "dominion", name: "DOMINION", summary: "Capture and maintain decisive ground." }),
  eradication: Object.freeze({ id: "eradication", name: "ERADICATION", summary: "Break designated enemy strength." }),
  disruption: Object.freeze({ id: "disruption", name: "DISRUPTION", summary: "Disable systems and fracture operations." }),
  reconnaissance: Object.freeze({ id: "reconnaissance", name: "RECONNAISSANCE", summary: "Reveal, mark, and escape with intelligence." }),
  safeguard: Object.freeze({ id: "safeguard", name: "SAFEGUARD", summary: "Protect, recover, or evacuate priority assets." }),
});

const MATCHUP_TITLES = Object.freeze({
  dominion: Object.freeze({ dominion: "CONTESTED GROUND", eradication: "HOLD UNDER FIRE", disruption: "SECURE THE NETWORK", reconnaissance: "DENY THE SURVEY", safeguard: "CLAIM THE ASSET" }),
  eradication: Object.freeze({ dominion: "BREAK THE LINE", eradication: "MUTUAL DESTRUCTION", disruption: "HUNT THE RAIDERS", reconnaissance: "CLOSE THE NET", safeguard: "DESTROY THE ESCORT" }),
  disruption: Object.freeze({ dominion: "UNMAKE THE HOLD", eradication: "CRIPPLE THE HUNTERS", disruption: "SYSTEMS WAR", reconnaissance: "BLIND THE WATCHERS", safeguard: "BREACH THE CORDON" }),
  reconnaissance: Object.freeze({ dominion: "MAP THE STRONGPOINT", eradication: "EVADE THE HUNT", disruption: "TRACE THE SABOTEURS", reconnaissance: "SHADOW CONTEST", safeguard: "IDENTIFY THE ASSET" }),
  safeguard: Object.freeze({ dominion: "HOLD THE LAST ROUTE", eradication: "PRESERVE THE FORCE", disruption: "SECURE THE SYSTEM", reconnaissance: "DENY THE SIGNAL", safeguard: "RIVAL EVACUATIONS" }),
});

const cleanMissionText = (value, fallback) => typeof value === "string" && value.trim().length > 0
  ? value.trim().slice(0, 180)
  : fallback;

export const resolveDispositionMatchup = ({ playerDisposition, enemyDisposition, mission = {} } = {}) => {
  const player = OPERATIONAL_DISPOSITIONS[playerDisposition] ?? null;
  const enemy = OPERATIONAL_DISPOSITIONS[enemyDisposition] ?? null;
  if (!player || !enemy) return null;
  return {
    id: `${player.id}-vs-${enemy.id}`,
    title: cleanMissionText(mission.title, MATCHUP_TITLES[player.id][enemy.id]),
    player,
    enemy,
    playerObjective: cleanMissionText(mission.playerObjective, player.summary),
    enemyObjective: cleanMissionText(mission.enemyObjective, enemy.summary),
  };
};
