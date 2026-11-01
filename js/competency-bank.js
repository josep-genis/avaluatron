// Banc de competències compartit per tots els usuaris. Es defineix a data/competency-bank.json,
// que es pot editar a mà, i no es desa a les dades de l'usuari tret que l'usuari en modifiqui el contingut.
// Els identificadors han de ser estables: les dades dels usuaris hi fan referència.
const response = await fetch(new URL("../data/competency-bank.json", import.meta.url));
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

// Elimina del desat les competències del banc que l'usuari no ha modificat.
export function withoutUnmodifiedBank(value) {
  const unchanged = competency => {
    const original = COMPETENCY_BANK.find(item => item.id === competency.id);
    return original && JSON.stringify(original) === JSON.stringify(competency);
  };
  return { ...value, competencies: value.competencies.filter(competency => !unchanged(competency)) };
}
