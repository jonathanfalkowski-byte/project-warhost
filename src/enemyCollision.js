export const resolveAshenCollision = ({
  firstWindowStaffed,
  firstManeuverName,
  activeProtocolNames = [],
  veilCounterNames = [],
}) => {
  if (!firstWindowStaffed) return { outcome: "unread", actorName: null };

  const actors = [firstManeuverName, ...activeProtocolNames].filter(Boolean);
  const trapActorName = actors.find((name) => veilCounterNames.includes(name)) ?? null;
  if (trapActorName) return { outcome: "trapped", actorName: trapActorName };
  if (firstManeuverName) return { outcome: "diverted", actorName: firstManeuverName };
  return { outcome: "passed", actorName: null };
};
