import { DAILY_FOLLOWUP_CRITERIA } from "./data.js";
import { gradeAbbreviation } from "./formatting.js";
import { SCORE_BY_LEVEL } from "./grades.js";
import { parseCsv } from "./student-csv.js";

const normalize = value => value.trim().toLocaleLowerCase("ca").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[·.]/g, "");
const levelsByCode = new Map(SCORE_BY_LEVEL.slice(1, 5).map((score, index) => [gradeAbbreviation(score), index + 1]));

function parseDate(value) {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!iso && !local) return null;
  const [year, month, day] = iso
    ? iso.slice(1).map(Number)
    : [Number(local[3]), Number(local[2]), Number(local[1])];
  if (year < 100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function planDailyImport(text) {
  const rows = parseCsv(text, { strict: true });
  const errors = [];
  const assessments = [];
  const seen = new Set();
  const hasHeader = rows.length > 0 && ["dia", "data"].includes(normalize(rows[0][0]));
  if (hasHeader) {
    const header = rows[0].map(normalize);
    if (![5, 6].includes(header.length) || header[1] !== "participacio" || header[2] !== "preparacio" ||
      header[3] !== "autonomia" || header[4] !== "collaboracio" ||
      header.length === 6 && !["observacio", "observacions"].includes(header[5])) {
      errors.push("La capçalera ha de ser: dia, participació, preparació, autonomia, col·laboració, observacions.");
    }
  }
  const dataRows = rows.slice(hasHeader ? 1 : 0);
  if (!dataRows.length) errors.push("El fitxer CSV no conté cap seguiment.");
  dataRows.forEach((cells, index) => {
    const row = index + (hasHeader ? 2 : 1);
    if (![5, 6].includes(cells.length) || hasHeader && cells.length !== rows[0].length) {
      errors.push(`Fila ${row}: calen cinc columnes de valoració i, opcionalment, una d'observacions.`);
      return;
    }
    const date = parseDate(cells[0]);
    if (!date) {
      errors.push(`Fila ${row}: la data ha de ser vàlida i tenir el format DD/MM/AAAA o AAAA-MM-DD.`);
      return;
    }
    if (seen.has(date)) {
      errors.push(`Fila ${row}: el dia ${date} està repetit.`);
      return;
    }
    seen.add(date);
    const levels = {};
    for (let i = 0; i < DAILY_FOLLOWUP_CRITERIA.length; i++) {
      const value = cells[i + 1].toLocaleUpperCase("ca");
      const level = levelsByCode.get(value) ?? (/^[1-4]$/.test(value) ? Number(value) : null);
      if (value && level === null) {
        errors.push(`Fila ${row}: els indicadors han de ser NA, AS, AN, AE o quedar buits.`);
        return;
      }
      if (level !== null) levels[DAILY_FOLLOWUP_CRITERIA[i].id] = level;
    }
    if (!Object.keys(levels).length) {
      errors.push(`Fila ${row}: cal valorar almenys un indicador.`);
      return;
    }
    const note = cells[5] || "";
    if (note.length > 500) {
      errors.push(`Fila ${row}: l'observació no pot superar els 500 caràcters.`);
      return;
    }
    assessments.push({ date, levels, note });
  });
  return { assessments, errors };
}
