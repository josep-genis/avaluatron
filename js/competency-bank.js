// Banc de competències compartit per tots els usuaris. Es defineix a data/competency-bank.json,
// que es pot editar a mà, i no es desa a les dades de l'usuari tret que l'usuari en modifiqui el contingut.
// Els identificadors han de ser estables: les dades dels usuaris hi fan referència.
const response = await fetch(new URL("../data/competency-bank.json", import.meta.url), { cache: "no-cache" });
if (!response.ok) throw new Error("No s'ha pogut carregar data/competency-bank.json.");
export const COMPETENCY_BANK = await response.json();

const clone = value => JSON.parse(JSON.stringify(value));

export function isBankCompetency(id) {
  return COMPETENCY_BANK.some(competency => competency.id === id);
}

export function getBankCompetency(id) {
  const competency = COMPETENCY_BANK.find(item => item.id === id);
  return competency ? clone(competency) : null;
}

// Afegeix al llistat de l'usuari les competències del banc que encara no hi són.
export function mergeCompetencyBank(competencies) {
  const existing = new Set(competencies.map(competency => competency.id));
  for (const bankCompetency of COMPETENCY_BANK) {
    if (!existing.has(bankCompetency.id)) competencies.push(clone(bankCompetency));
  }
}

export function migrateLegacyTransversalCompetencies(value) {
  const legacyId = /^bank-(cpsaa|cd|ce|cc)-\d+$/;
  const mapId = id => {
    const match = typeof id === "string" ? id.match(legacyId) : null;
    return match ? `bank-${match[1]}` : id;
  };

  for (const activity of value.activities || []) {
    for (const criterion of activity.criteria || []) {
      if (criterion?.competencyId) criterion.competencyId = mapId(criterion.competencyId);
    }
    for (const evidence of activity.evidences || []) {
      if (!evidence.contributions || typeof evidence.contributions !== "object") continue;
      const contributions = new Map();
      for (const [id, weight] of Object.entries(evidence.contributions)) {
        const mappedId = mapId(id);
        const current = contributions.get(mappedId) || { total: 0, count: 0 };
        current.total += Number(weight);
        current.count += 1;
        contributions.set(mappedId, current);
      }
      // Consolidated competencies should not receive duplicate weight from their old entries.
      evidence.contributions = Object.fromEntries(
        [...contributions].map(([id, value]) => [id, value.count > 1 ? value.total / value.count : value.total])
      );
    }
  }

  for (const subject of value.subjects || []) {
    for (const level of subject.levels || []) {
      if (Array.isArray(level.competencyIds)) {
        level.competencyIds = [...new Set(level.competencyIds.map(mapId))];
      }
    }
  }

  // Keep saved legacy entries; they may contain user edits and now behave as custom competencies.
}

// Elimina del desat les competències del banc que l'usuari no ha modificat.
export function withoutUnmodifiedBank(value) {
  const unchanged = competency => {
    const original = COMPETENCY_BANK.find(item => item.id === competency.id);
    return original && JSON.stringify(original) === JSON.stringify(competency);
  };
  return { ...value, competencies: value.competencies.filter(competency => !unchanged(competency)) };
}
