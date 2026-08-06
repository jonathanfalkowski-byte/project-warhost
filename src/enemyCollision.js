export const resolveAshenCollision = ({
  firstWindowStaffed,
  firstManeuverName,
  activeProtocolNames = [],
  veilCounterNames = [],
  resolutionOutcome = null,
}) => {
  if (!firstWindowStaffed) return { outcome: "unread", actorName: null };

  const actors = [firstManeuverName, ...activeProtocolNames].filter(Boolean);
  const trapActorName = actors.find((name) => veilCounterNames.includes(name)) ?? null;
  const resolutionAllowsControl = resolutionOutcome === null || ["decisive", "checked"].includes(resolutionOutcome);
  const resolutionAvoidsOverrun = resolutionOutcome === null || resolutionOutcome !== "overrun";
  if (trapActorName && resolutionAllowsControl) return { outcome: "trapped", actorName: trapActorName };
  if (firstManeuverName && resolutionAvoidsOverrun) return { outcome: "diverted", actorName: firstManeuverName };
  return { outcome: "passed", actorName: null };
};
