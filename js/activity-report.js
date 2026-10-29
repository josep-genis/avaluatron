import { getActivityOffers, getOfferingStudents } from "./data.js";
import { data, state } from "./state.js";
import {
  SCORE_BY_LEVEL, LEVEL_LABELS, getActivityGrade, getAssessment,
  getEvidenceActivityWeight, isStudentExemptFromActivity,
  isStudentExemptFromSubjectForActivity
} from "./grades.js";
import { escapeHtml, formatDate, formatGradeWithCode, gradeColorClass } from "./formatting.js";

function studentName(student) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function studentGroup(student) {
  const group = data.classGroups.find(item => item.id === student.classGroupId);
  const subgroup = group?.subgroups.find(item => item.id === student.subgroupId);
  return [group?.name, subgroup?.name].filter(Boolean).join(" · ") || "Sense grup classe";
}

function evidenceContributionLabel(evidence) {
  const contributions = Object.entries(evidence.contributions).map(([competencyId, weight]) => {
    const competency = data.competencies.find(item => item.id === competencyId);
    return competency ? `${competency.name} (${Number(weight)}%)` : "";
  }).filter(Boolean);
  return contributions.length ? contributions.join(" · ") : "Sense competències vinculades";
}

function studentReport(activity, student, subjectId, offeringId = null) {
  const assessment = getAssessment(data, student.id, activity.id, offeringId);
  const activityExempt = isStudentExemptFromActivity(data, student.id, activity.id);
  const subjectExempt = isStudentExemptFromSubjectForActivity(data, student.id, activity.id, subjectId);
  const exempt = activityExempt || subjectExempt;
  const grade = getActivityGrade(data, student.id, activity, subjectId, offeringId);
  const evaluatedEvidenceCount = activity.evidences.filter(evidence => {
    const level = assessment?.levels[evidence.id];
    return Number.isInteger(level) && level > 0 && level < SCORE_BY_LEVEL.length;
  }).length;
  const gradeLabel = exempt
    ? subjectExempt ? "Exempt/a de l’assignatura" : "Exempt/a de l’activitat"
    : grade === null ? "Pendent d’avaluar" : formatGradeWithCode(grade);
  const gradeClass = grade === null ? "" : gradeColorClass(grade);
  const evidenceRows = activity.evidences.map(evidence => {
    const level = assessment?.levels[evidence.id];
    const hasGrade = Number.isInteger(level) && level > 0 && level < SCORE_BY_LEVEL.length;
    const result = exempt
      ? "No avaluable (exempció)"
      : hasGrade
        ? `${LEVEL_LABELS[level]} · ${formatGradeWithCode(SCORE_BY_LEVEL[level])}`
        : "Pendent d’avaluar";
    return `<tr>
      <td><strong>${escapeHtml(evidence.name)}</strong><small>${escapeHtml(evidenceContributionLabel(evidence))}</small></td>
      <td>${getEvidenceActivityWeight(evidence)}%</td>
      <td>${result}</td>
    </tr>`;
  }).join("");

  return `<article class="report-page">
    <header class="report-header">
      <div><p class="report-eyebrow">Informe d’avaluació</p><h1>${escapeHtml(activity.title)}</h1></div>
      <span class="report-type">${escapeHtml(activity.type)}</span>
    </header>
    <div class="report-student">
      <div><span>Alumne/a</span><strong>${escapeHtml(studentName(student))}</strong></div>
      <div><span>Grup classe</span><strong>${escapeHtml(studentGroup(student))}</strong></div>
      <div><span>Data de l’activitat</span><strong>${escapeHtml(formatDate(activity.date))}</strong></div>
    </div>
    <section class="report-final-grade">
      <div><span>Nota final de l’activitat</span><small>${exempt ? "Aquesta activitat no es compta en la qualificació de l’alumne/a." : `${evaluatedEvidenceCount} de ${activity.evidences.length} evidències avaluades`}</small></div>
      <strong class="${gradeClass}">${escapeHtml(gradeLabel)}</strong>
    </section>
    <section class="report-evidence">
      <h2>Progrés per evidència</h2>
      <p>La nota de cada evidència es mostra sobre 10 amb la seva qualificació textual.</p>
      <table><thead><tr><th>Evidència i competències</th><th>Pes</th><th>Resultat</th></tr></thead><tbody>${evidenceRows || '<tr><td colspan="3">Aquesta activitat encara no té evidències.</td></tr>'}</tbody></table>
    </section>
    <footer class="report-footer"><span>Avaluatró · Informe generat el ${new Intl.DateTimeFormat("ca-ES", { dateStyle: "long" }).format(new Date())}</span><span>NA: No assolit · AS: Assoliment satisfactori · AN: Assoliment notable · AE: Assoliment excel·lent</span></footer>
  </article>`;
}

function reportDocument(activity, students, subjectId, offeringId) {
  const title = students.length === 1
    ? `Informe ${studentName(students[0])} - ${activity.title}`
    : `Informes de l’activitat - ${activity.title}`;
  const reports = students.map(student => studentReport(activity, student, subjectId, offeringId)).join("");
  return `<!doctype html>
<html lang="ca">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #303832; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f2f5f2; font-size: 13px; }
    .report-toolbar { position: sticky; top: 0; z-index: 1; display: flex; justify-content: center; gap: 12px; padding: 14px; border-bottom: 1px solid #dfe5df; background: #fff; }
    .report-toolbar button { padding: 10px 16px; border: 0; border-radius: 6px; background: #2c604b; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    .report-toolbar span { align-self: center; color: #68736b; font-size: 12px; }
    .report-page { display: flex; min-height: 260mm; flex-direction: column; width: min(210mm, calc(100% - 32px)); margin: 20px auto; padding: 18mm 17mm 14mm; background: #fff; box-shadow: 0 3px 20px #24372d18; page-break-after: always; break-after: page; }
    .report-page:last-child { page-break-after: auto; break-after: auto; }
    .report-header { display: flex; justify-content: space-between; gap: 20px; padding-bottom: 18px; border-bottom: 2px solid #2c604b; }
    .report-eyebrow { margin: 0 0 7px; color: #708177; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    h1 { margin: 0; font-size: 23px; line-height: 1.25; }
    .report-type { align-self: start; padding: 6px 9px; border-radius: 5px; background: #edf4ef; color: #315d46; font-size: 10px; font-weight: 700; }
    .report-student { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 14px; margin: 20px 0; }
    .report-student div { display: grid; gap: 5px; }
    .report-student span, .report-final-grade span { color: #758078; font-size: 10px; }
    .report-student strong { font-size: 12px; }
    .report-final-grade { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; padding: 16px 18px; border: 1px solid #e6ebe6; border-radius: 8px; background: #fbfcfb; }
    .report-final-grade div { display: grid; gap: 6px; }
    .report-final-grade > strong { padding: 8px 11px; border-radius: 6px; background: #f1f3f1; font-size: 17px; white-space: nowrap; }
    .report-final-grade > strong.grade-warning { background: #fff0ef; color: #a63d37; }
    .report-final-grade > strong.grade-developing { background: #fff8e6; color: #8e6b1f; }
    .report-final-grade > strong.grade-achieved { background: #edf6ef; color: #356847; }
    .report-final-grade > strong.grade-advanced { background: #edf4fb; color: #315f8d; }
    .report-evidence h2 { margin: 0 0 5px; font-size: 15px; }
    .report-evidence > p { margin: 0 0 12px; color: #758078; font-size: 10px; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 9px; border-bottom: 1px solid #e9ede9; text-align: left; vertical-align: top; }
    th { background: #f6f8f6; color: #667269; font-size: 9px; text-transform: uppercase; }
    td { font-size: 10px; line-height: 1.5; }
    td strong, td small { display: block; }
    td small { margin-top: 4px; color: #7d877f; font-size: 9px; }
    .report-footer { display: flex; flex-direction: column; gap: 5px; margin-top: auto; padding-top: 18px; color: #89928b; font-size: 8px; }
    @media (max-width: 600px) {
      .report-page { width: 100%; min-height: 0; margin: 0 auto 12px; padding: 22px 16px; }
      .report-student { grid-template-columns: 1fr 1fr; }
      .report-student div:first-child { grid-column: 1 / -1; }
      .report-final-grade { align-items: flex-start; flex-direction: column; gap: 12px; }
    }
    @page { size: A4; margin: 12mm; }
    @media print {
      body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .report-toolbar { display: none; }
      .report-page { width: auto; min-height: 273mm; margin: 0; padding: 5mm 4mm; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="report-toolbar"><button type="button" onclick="window.print()">Imprimeix o desa com a PDF</button><span>Tria «Desa com a PDF» al diàleg d’impressió.</span></div>
  ${reports}
</body>
</html>`;
}

export function getActivityStudentReportMarkup(activityId, studentId, subjectId = null) {
  const activity = data.activities.find(item => item.id === activityId);
  const student = data.students.find(item => item.id === studentId);
  const offeringId = state.selectedOfferingId || getActivityOffers(data, activityId)
    .find(offer => offer.subjectId === subjectId && getOfferingStudents(data, offer).some(item => item.id === studentId))?.id || null;
  return activity && student ? studentReport(activity, student, subjectId, offeringId) : "";
}

export function openActivityReport(studentId = null) {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity) return false;

  const offerings = getActivityOffers(data, activity.id).filter(offer =>
    (!state.selectedSubjectId || offer.subjectId === state.selectedSubjectId) &&
    (!state.selectedLevelId || offer.levelId === state.selectedLevelId)
  );
  const selectedOfferingId = offerings.some(offer => offer.id === state.selectedOfferingId)
    ? state.selectedOfferingId
    : offerings.length === 1 ? offerings[0].id : null;
  const selectedOffering = offerings.find(offer => offer.id === selectedOfferingId);
  const classStudents = selectedOffering ? getOfferingStudents(data, selectedOffering) : [];
  const students = studentId
    ? classStudents.filter(student => student.id === studentId)
    : classStudents;
  if (!students.length) return false;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;
  reportWindow.document.open();
  reportWindow.document.write(reportDocument(activity, students, state.selectedSubjectId, selectedOfferingId));
  reportWindow.document.close();
  return true;
}
