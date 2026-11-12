export const EVALUATION_TYPES = {
  Activitat: {
    itemCollection: "evidences",
    itemLabel: "evidència",
    itemLabelPlural: "evidències",
    editorLabel: "rúbrica",
    achievementLabel: "criteris d'assoliment",
    itemFields: ["descriptors"],
    defaultItem: () => ({ descriptors: {} })
  },
  Prova: {
    itemCollection: "questions",
    itemLabel: "pregunta",
    itemLabelPlural: "preguntes",
    editorLabel: "solucionari",
    achievementLabel: "solucionari",
    itemFields: ["answerKey"],
    defaultItem: () => ({ answerKey: "" })
  }
};

export function getEvaluationType(evaluation) {
  return EVALUATION_TYPES[evaluation?.type] ? evaluation.type : "Activitat";
}

export function getEvaluationConfig(evaluation) {
  return EVALUATION_TYPES[getEvaluationType(evaluation)];
}

export function getEvaluationItems(evaluation) {
  return evaluation?.[getEvaluationConfig(evaluation).itemCollection] || [];
}

export function convertEvaluationItems(evaluation, nextType) {
  if (!EVALUATION_TYPES[nextType]) throw new Error("Tipus d'element avaluable no vàlid.");
  const currentType = getEvaluationType(evaluation);
  if (currentType === nextType) return;
  const currentConfig = EVALUATION_TYPES[currentType];
  const nextConfig = EVALUATION_TYPES[nextType];
  const items = getEvaluationItems(evaluation);
  evaluation.conversionData ??= {};
  evaluation.conversionData[currentType] = Object.fromEntries(items.map(item => [
    item.id,
    Object.fromEntries(currentConfig.itemFields.map(field => [field, item[field]]))
  ]));
  const retainedIds = new Set(items.map(item => item.id));
  for (const [type, snapshots] of Object.entries(evaluation.conversionData)) {
    if (EVALUATION_TYPES[type] && snapshots && typeof snapshots === "object") {
      for (const id of Object.keys(snapshots)) {
        if (!retainedIds.has(id)) delete snapshots[id];
      }
    }
  }
  evaluation[nextConfig.itemCollection] = items.map(item => ({
    id: item.id,
    name: item.name,
    contributions: { ...item.contributions },
    ...nextConfig.defaultItem(),
    ...(Object.hasOwn(evaluation.conversionData[nextType] || {}, item.id)
      ? evaluation.conversionData[nextType][item.id]
      : {})
  }));
  delete evaluation[currentConfig.itemCollection];
  evaluation.type = nextType;
}
