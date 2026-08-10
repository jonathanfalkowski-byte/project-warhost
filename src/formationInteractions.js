const textList = (value) => Array.isArray(value)
  ? value.filter((item) => typeof item === "string" && item.length > 0)
  : [];

export const capabilityMatchesFor = ({ formation, demands } = {}) => {
  if (!formation || typeof formation.id !== "string") return [];
  const capabilities = new Set(textList(formation.capabilities));
  return textList(demands).filter((demand) => capabilities.has(demand));
};

export const formationInteractionsFor = ({ formations, formationId } = {}) => {
  if (!Array.isArray(formations) || typeof formationId !== "string") return [];
  const selected = formations.find((formation) => formation?.id === formationId);
  if (!selected || typeof selected.creates !== "string") return [];
  const selectedUses = new Set(textList(selected.uses));

  return formations.flatMap((partner) => {
    if (!partner || partner.id === selected.id || typeof partner.id !== "string") return [];
    const partnerUses = new Set(textList(partner.uses));
    const outgoing = partnerUses.has(selected.creates)
      ? { direction: "outgoing", condition: selected.creates, text: `${selected.name} creates ${selected.creates}; ${partner.name} can react.` }
      : null;
    const incoming = typeof partner.creates === "string" && selectedUses.has(partner.creates)
      ? { direction: "incoming", condition: partner.creates, text: `${partner.name} creates ${partner.creates}; ${selected.name} can react.` }
      : null;
    if (!outgoing && !incoming) return [];
    return [{ partnerId: partner.id, partnerName: partner.name, outgoing, incoming }];
  });
};

export const interactionDirectionFor = (interaction) => {
  if (!interaction || typeof interaction !== "object") return null;
  if (interaction.outgoing && interaction.incoming) return "mutual";
  if (interaction.outgoing) return "outgoing";
  if (interaction.incoming) return "incoming";
  return null;
};

export const adjacentFormationIdsFor = ({ roles, assignments, formationId } = {}) => {
  if (!Array.isArray(roles) || !assignments || typeof assignments !== "object" || typeof formationId !== "string") return [];
  const roleIndex = roles.findIndex((role) => role?.id && assignments[role.id] === formationId);
  if (roleIndex < 0) return [];
  return [roles[roleIndex - 1], roles[roleIndex + 1]]
    .map((role) => role?.id ? assignments[role.id] : null)
    .filter((neighborId) => typeof neighborId === "string" && neighborId.length > 0);
};

export const neighboringInteractionHints = ({ formations, formationId, neighborIds } = {}) => {
  const allowedNeighbors = new Set(textList(neighborIds));
  return formationInteractionsFor({ formations, formationId })
    .filter((interaction) => allowedNeighbors.has(interaction.partnerId))
    .flatMap((interaction) => [interaction.incoming, interaction.outgoing].filter(Boolean));
};
