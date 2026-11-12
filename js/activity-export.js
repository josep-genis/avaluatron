import { getActivityOffers, getOfferingStudents } from "./data.js";
import { data, state } from "./state.js";
import {
  SCORE_BY_LEVEL, LEVEL_LABELS, NOT_SUBMITTED_LEVEL, NOT_SUBMITTED_LABEL, getActivityGrade, getAssessment, areAllActivityEvidencesAssessed,
  getActivityGroupEvidenceScore, getActivityGroupGrade,
  getEvidenceActivityWeight, isStudentExemptFromActivity, isStudentExemptFromSubjectForActivity
} from "./grades.js";
import { escapeHtml, formatDate, gradeAbbreviation } from "./formatting.js";
import { getEvaluationConfig, getEvaluationItems } from "./assessment.js";

const DELIMITERS = { csv: ";", tsv: "\t" };

function formatNumber(value) {
  return value === null ? "" : value.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 2, useGrouping: false });
}

function cell(value, delimiter) {
  let text = String(value ?? "");
  // Evita que el full de càlcul interpreti text com una fórmula.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return new RegExp(`["\\r\\n${delimiter}]`).test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function slug(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "activitat";
}

function getSelectedOffering(activity) {
  const offerings = getActivityOffers(data, activity.id).filter(offer =>
    (!state.selectedSubjectId || offer.subjectId === state.selectedSubjectId) &&
    (!state.selectedLevelId || offer.levelId === state.selectedLevelId)
  );
  return offerings.find(offer => offer.id === state.selectedOfferingId) || (offerings.length === 1 ? offerings[0] : null);
}

function downloadTable(format, filename, rows) {
  const delimiter = DELIMITERS[format];
  const text = rows.map(row => row.map(value => cell(value, delimiter)).join(delimiter)).join("\r\n");
  const blob = new Blob(["\ufeff", text, "\r\n"], { type: format === "csv" ? "text/csv;charset=utf-8" : "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportActivityTable(format) {
  const delimiter = DELIMITERS[format];
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!delimiter || !activity) return { ok: false, message: "No s'ha trobat l'activitat." };
  const offering = getSelectedOffering(activity);
  if (!offering) return { ok: false, message: "Tria una oferta docent per exportar-ne l'avaluació." };
  const students = getOfferingStudents(data, offering).sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "ca"));
  if (!students.length) return { ok: false, message: "No hi ha alumnat per exportar." };

  const items = getEvaluationItems(activity);
  const header = ["Cognoms", "Nom", "Grup", ...(activity.isGroup ? ["Agrupament"] : []), ...items.map(evidence => `${evidence.name} (nivell)`),
    ...items.map(evidence => `${evidence.name} (nota /10)`), "Nota de l'element /10", "Qualificació", "Estat"];
  const rows = students.map(student => {
    const assessment = getAssessment(data, student.id, activity.id, offering.id);
    const exempt = isStudentExemptFromActivity(data, student.id, activity.id) ||
      isStudentExemptFromSubjectForActivity(data, student.id, activity.id, offering.subjectId);
    const levels = items.map(evidence => {
      const level = assessment?.levels[evidence.id];
      return Number.isInteger(level) && level > 0 && level < SCORE_BY_LEVEL.length ? level : null;
    });
    const grade = exempt ? null : getActivityGrade(data, student.id, activity, offering.subjectId, offering.id);
    const status = exempt ? "Exempt/a" : areAllActivityEvidencesAssessed(activity, assessment)
      ? (assessment?.recovered ? "Avaluat/ada (recuperada)" : "Avaluat/ada") : levels.some(level => level !== null) ? "Parcial" : "Pendent";
    const group = data.classGroups.find(item => item.id === student.classGroupId)?.name || "";
    const activityGroup = !activity.isGroup ? "" : activity.groups.find(item => item.studentIds.includes(student.id))?.name || "";
    return [student.lastName, student.firstName, group, ...(activity.isGroup ? [activityGroup] : []), ...levels.map(level => level === NOT_SUBMITTED_LEVEL ? NOT_SUBMITTED_LABEL : level ?? ""),
      ...levels.map(level => level === null ? "" : formatNumber(SCORE_BY_LEVEL[level])),
      formatNumber(grade), grade === null ? "" : gradeAbbreviation(grade), status];
  });

  downloadTable(format, `avaluacio-${slug(activity.title)}.${format}`, [header, ...rows]);
  return { ok: true, message: `Avaluació exportada com a ${format.toUpperCase()}.` };
}

export function exportActivityGroupsTable(format) {
  const delimiter = DELIMITERS[format];
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!delimiter || !activity?.isGroup) return { ok: false, message: "No s'han trobat els agrupaments de l'activitat." };
  const offering = getSelectedOffering(activity);
  if (!offering) return { ok: false, message: "Tria una oferta docent per exportar-ne els agrupaments." };
  const students = getOfferingStudents(data, offering);
  const groups = activity.groups.map(group => ({
    group,
    members: students.filter(student => group.studentIds.includes(student.id))
  })).filter(item => item.members.length);
  if (!groups.length) return { ok: false, message: "No hi ha agrupaments amb alumnes en aquesta oferta." };

  const items = getEvaluationItems(activity);
  const config = getEvaluationConfig(activity);
  const header = ["Agrupament", "Membres", ...items.map(evidence => `${evidence.name} (mitjana /10)`),
    "Nota del grup /10", "Qualificació", `${config.itemLabelPlural} avaluades`];
  const rows = groups.map(({ group, members }) => {
    const evidenceScores = items.map(evidence =>
      getActivityGroupEvidenceScore(data, activity, group, offering.id, evidence.id));
    const grade = getActivityGroupGrade(data, activity, group, offering.id);
    const assessedCount = evidenceScores.filter(score => score !== null).length;
    return [group.name, members.map(student => `${student.firstName} ${student.lastName}`.trim()).join(", "),
      ...evidenceScores.map(formatNumber), formatNumber(grade), grade === null ? "" : gradeAbbreviation(grade),
      `${assessedCount}/${items.length}`];
  });
  downloadTable(format, `agrupaments-${slug(activity.title)}.${format}`, [header, ...rows]);
  return { ok: true, message: `Avaluació dels agrupaments exportada com a ${format.toUpperCase()}.` };
}

export function exportActivityRubricTable(format) {
  const delimiter = DELIMITERS[format];
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!delimiter || !activity) return { ok: false, message: "No s'ha trobat l'activitat." };
  const items = getEvaluationItems(activity);
  const config = getEvaluationConfig(activity);
  if (!items.length) return { ok: false, message: `Aquest element no té ${config.itemLabelPlural} per exportar.` };

  const header = activity.type === "Prova"
    ? ["Pregunta", "Pes de la pregunta (%)", "Competències i pesos", "Solucionari"]
    : ["Evidència", "Pes en l'activitat (%)", "Competències i pesos",
      ...LEVEL_LABELS.slice(1).map((_, index) => `${["NA", "AS", "AN", "AE"][index]} · ${formatNumber(SCORE_BY_LEVEL[index + 1])}/10`)];
  const rows = items.map(evidence => {
    const contributions = Object.entries(evidence.contributions).map(([competencyId, weight]) => {
      const competency = data.competencies.find(item => item.id === competencyId);
      return competency ? `${competency.name} (${Number(weight)}%)` : "";
    }).filter(Boolean).join(" · ");
    return activity.type === "Prova"
      ? [evidence.name, getEvidenceActivityWeight(evidence), contributions, evidence.answerKey || ""]
      : [evidence.name, getEvidenceActivityWeight(evidence), contributions,
        ...["1", "2", "3", "4"].map(level => evidence.descriptors?.[level] || "")];
  });
  downloadTable(format, `${slug(config.editorLabel)}-${slug(activity.title)}.${format}`, [header, ...rows]);
  return { ok: true, message: `${config.editorLabel[0].toLocaleUpperCase("ca")}${config.editorLabel.slice(1)} exportat com a ${format.toUpperCase()}.` };
}

export function openActivityRubricReport() {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity) return false;
  const items = getEvaluationItems(activity);
  if (!items.length) return false;

  const evidenceRows = items.map(evidence => {
    const contributions = Object.entries(evidence.contributions).map(([competencyId, weight]) => {
      const competency = data.competencies.find(item => item.id === competencyId);
      return competency ? `${escapeHtml(competency.name)} (${Number(weight)}%)` : "";
    }).filter(Boolean).join("<br>");
    const achievement = activity.type === "Prova"
      ? `<td>${escapeHtml(evidence.answerKey || "—").replaceAll("\n", "<br>")}</td>`
      : ["1", "2", "3", "4"].map(level =>
        `<td>${escapeHtml(evidence.descriptors?.[level] || "—").replaceAll("\n", "<br>")}</td>`
      ).join("");
    return `<tr><td><strong>${escapeHtml(evidence.name)}</strong></td><td>${getEvidenceActivityWeight(evidence)}%</td><td>${contributions || "Sense competències vinculades"}</td>${achievement}</tr>`;
  }).join("");
  const achievementHeaders = activity.type === "Prova"
    ? "<th>Solucionari</th>"
    : `<th>NA · ${formatNumber(SCORE_BY_LEVEL[1])}</th><th>AS · ${formatNumber(SCORE_BY_LEVEL[2])}</th><th>AN · ${formatNumber(SCORE_BY_LEVEL[3])}</th><th>AE · ${formatNumber(SCORE_BY_LEVEL[4])}</th>`;
  const config = getEvaluationConfig(activity);
  const report = `<article class="report-page">
    <header class="report-header"><div><p class="report-eyebrow">${escapeHtml(config.editorLabel)} de ${activity.type === "Prova" ? "la prova" : "l’activitat"}</p><h1>${escapeHtml(activity.title)}</h1></div><span class="report-type">${escapeHtml(activity.type)}</span></header>
    <div class="report-student"><div><span>Data</span><strong>${escapeHtml(formatDate(activity.date))}</strong></div><div><span>${escapeHtml(config.itemLabelPlural)}</span><strong>${items.length}</strong></div><div><span>Pes total</span><strong>${items.reduce((total, evidence) => total + getEvidenceActivityWeight(evidence), 0)}%</strong></div></div>
    <section class="report-evidence"><h2>${activity.type === "Prova" ? "Preguntes i solucionari" : "Evidències i criteris d'avaluació"}</h2><p>El pes de cada ${escapeHtml(config.itemLabel)} és la suma dels pesos assignats a les competències.</p>
      <table><thead><tr><th>${activity.type === "Prova" ? "Pregunta" : "Evidència"}</th><th>Pes</th><th>Competències</th>${achievementHeaders}</tr></thead><tbody>${evidenceRows}</tbody></table>
    </section>
    <footer class="report-footer"><span>Avaluatró · Document del ${escapeHtml(config.editorLabel)} generat el ${new Intl.DateTimeFormat("ca-ES", { dateStyle: "long" }).format(new Date())}</span></footer>
  </article>`;
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;
  const documentMarkup = `<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(config.editorLabel)} - ${escapeHtml(activity.title)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #303832; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f2f5f2; font-size: 13px; }
    .report-toolbar { position: sticky; top: 0; z-index: 1; display: flex; justify-content: center; gap: 12px; padding: 14px; border-bottom: 1px solid #dfe5df; background: #fff; }
    .report-toolbar button { padding: 10px 16px; border: 0; border-radius: 6px; background: #2c604b; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    .report-toolbar span { align-self: center; color: #68736b; font-size: 12px; }
    .report-page { display: flex; min-height: 190mm; flex-direction: column; width: min(297mm, calc(100% - 32px)); margin: 20px auto; padding: 18mm 17mm 14mm; background: #fff; box-shadow: 0 3px 20px #24372d18; page-break-after: always; break-after: page; }
    .report-page:last-child { page-break-after: auto; break-after: auto; }
    .report-header { display: flex; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 2px solid #2c604b; }
    .report-eyebrow { margin: 0 0 7px; color: #708177; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    h1 { margin: 0; font-size: 23px; line-height: 1.25; }
    .report-type { align-self: start; padding: 6px 9px; border-radius: 5px; background: #edf4ef; color: #315d46; font-size: 10px; font-weight: 700; }
    .report-student { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 14px; margin: 20px 0; }
    .report-student div { display: grid; gap: 5px; }
    .report-student span { color: #758078; font-size: 10px; }
    .report-student strong { font-size: 12px; }
    .report-evidence { margin-bottom: 22px; }
    .report-evidence h2 { margin: 0 0 5px; font-size: 15px; }
    .report-evidence > p { margin: 0 0 12px; color: #758078; font-size: 10px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 9px; border-bottom: 1px solid #e9ede9; text-align: left; vertical-align: top; }
    th { background: #f6f8f6; color: #667269; font-size: 9px; text-transform: uppercase; }
    td { font-size: 10px; line-height: 1.5; }
    .report-footer { display: flex; flex-direction: column; gap: 5px; margin-top: auto; padding-top: 18px; color: #89928b; font-size: 8px; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print { body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .report-toolbar { display: none; } .report-page { width: auto; min-height: 190mm; margin: 0; padding: 5mm 4mm; box-shadow: none; } }
  </style></head><body><div class="report-toolbar"><button type="button" onclick="window.print()">Imprimeix o desa com a PDF</button><span>Tria «Desa com a PDF» al diàleg d’impressió.</span></div>${report}</body></html>`;
  reportWindow.document.open();
  reportWindow.document.write(documentMarkup);
  reportWindow.document.close();
  return true;
}
