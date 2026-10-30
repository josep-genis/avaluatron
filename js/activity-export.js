import { getActivityOffers, getOfferingStudents } from "./data.js";
import { data, state } from "./state.js";
import {
  SCORE_BY_LEVEL, getActivityGrade, getAssessment, areAllActivityEvidencesAssessed,
  getActivityGroupEvidenceScore, getActivityGroupGrade,
  isStudentExemptFromActivity, isStudentExemptFromSubjectForActivity
} from "./grades.js";
import { gradeAbbreviation } from "./formatting.js";

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

  const header = ["Cognoms", "Nom", "Grup", ...(activity.isGroup ? ["Agrupament"] : []), ...activity.evidences.map(evidence => `${evidence.name} (nivell)`),
    ...activity.evidences.map(evidence => `${evidence.name} (nota /10)`), "Nota activitat /10", "Qualificació", "Estat"];
  const rows = students.map(student => {
    const assessment = getAssessment(data, student.id, activity.id, offering.id);
    const exempt = isStudentExemptFromActivity(data, student.id, activity.id) ||
      isStudentExemptFromSubjectForActivity(data, student.id, activity.id, offering.subjectId);
    const levels = activity.evidences.map(evidence => {
      const level = assessment?.levels[evidence.id];
      return Number.isInteger(level) && level > 0 ? level : null;
    });
    const grade = exempt ? null : getActivityGrade(data, student.id, activity, offering.subjectId, offering.id);
    const status = exempt ? "Exempt/a" : areAllActivityEvidencesAssessed(activity, assessment)
      ? "Avaluat/ada" : levels.some(level => level !== null) ? "Parcial" : "Pendent";
    const group = data.classGroups.find(item => item.id === student.classGroupId)?.name || "";
    const activityGroup = !activity.isGroup ? "" : activity.groups.find(item => item.studentIds.includes(student.id))?.name || "";
    return [student.lastName, student.firstName, group, ...(activity.isGroup ? [activityGroup] : []), ...levels.map(level => level ?? ""),
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

  const header = ["Agrupament", "Membres", ...activity.evidences.map(evidence => `${evidence.name} (mitjana /10)`),
    "Nota del grup /10", "Qualificació", "Evidències avaluades"];
  const rows = groups.map(({ group, members }) => {
    const evidenceScores = activity.evidences.map(evidence =>
      getActivityGroupEvidenceScore(data, activity, group, offering.id, evidence.id));
    const grade = getActivityGroupGrade(data, activity, group, offering.id);
    const assessedCount = evidenceScores.filter(score => score !== null).length;
    return [group.name, members.map(student => `${student.firstName} ${student.lastName}`.trim()).join(", "),
      ...evidenceScores.map(formatNumber), formatNumber(grade), grade === null ? "" : gradeAbbreviation(grade),
      `${assessedCount}/${activity.evidences.length}`];
  });
  downloadTable(format, `agrupaments-${slug(activity.title)}.${format}`, [header, ...rows]);
  return { ok: true, message: `Avaluació dels agrupaments exportada com a ${format.toUpperCase()}.` };
}
