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
    itemFields: ["answerKey", "questionFormat"],
    defaultItem: () => ({ answerKey: "", questionFormat: "desenvolupament" })
  }
};

export function getQuestionFormat(question) {
  return question?.questionFormat === "test" ? "test" : "desenvolupament";
}

export function getEvaluationType(evaluation) {
  return EVALUATION_TYPES[evaluation?.type] ? evaluation.type : "Activitat";
}

export function getEvaluationConfig(evaluation) {
  return EVALUATION_TYPES[getEvaluationType(evaluation)];
}

export function getEvaluationItems(evaluation) {
  return evaluation?.[getEvaluationConfig(evaluation).itemCollection] || [];
}

export function convertEvaluationItems(evaluation, nextType, assessments = []) {
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
      : {}),
    ...(currentType === "Activitat" && nextType === "Prova" ? { questionFormat: "test" } : {})
  }));
  for (const assessment of assessments) {
    if (assessment.activityId !== evaluation.id || !assessment.levels) continue;
    for (const item of items) {
      if (!Object.hasOwn(assessment.levels, item.id)) continue;
      const level = assessment.levels[item.id];
      if (currentType === "Activitat" && nextType === "Prova") {
        assessment.levels[item.id] = level === 5 || level === 1 ? 1 : level === 0 ? 0 : 4;
      } else if (currentType === "Prova" && nextType === "Activitat") {
        if (level === 5) assessment.levels[item.id] = 5;
        else if (level === 1) assessment.levels[item.id] = 1;
        else if (level === 0) assessment.levels[item.id] = 0;
        else if (level >= 2 && level <= 4) assessment.levels[item.id] = 4;
      }
    }
  }
  delete evaluation[currentConfig.itemCollection];
  evaluation.type = nextType;
}
