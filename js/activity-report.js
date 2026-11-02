import { getActivityOffers, getOfferingStudents } from "./data.js";
import { data, state } from "./state.js";
import {
  SCORE_BY_LEVEL, LEVEL_LABELS, getActivityGrade, getAssessment,
  getActivityGroupEvidenceScore, getActivityGroupGrade,
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

function studentReport(activity, student, subjectId, offeringId = null, editableFeedback = false) {
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
  const feedback = String(assessment?.feedback || "");
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
    ${editableFeedback
      ? `<section class="report-feedback"><label for="activity-student-feedback">Retroacció per a ${escapeHtml(studentName(student))}</label><p>Es desa amb l'avaluació d'aquest alumne per a l'activitat.</p><textarea id="activity-student-feedback" data-activity-feedback data-activity-id="${escapeHtml(activity.id)}" data-student-id="${escapeHtml(student.id)}" data-offering-id="${escapeHtml(offeringId || "")}" maxlength="2000" rows="5" placeholder="Escriu una retroacció específica per a aquest alumne…">${escapeHtml(feedback)}</textarea><small>Fins a 2.000 caràcters</small></section>`
      : feedback.trim() ? `<section class="report-feedback"><h2>Retroacció</h2><p>${escapeHtml(feedback).replaceAll("\\n", "<br>")}</p></section>` : ""}
    <footer class="report-footer"><span>Avaluatró · Informe generat el ${new Intl.DateTimeFormat("ca-ES", { dateStyle: "long" }).format(new Date())}</span><span>NA: No assolit · AS: Assoliment satisfactori · AN: Assoliment notable · AE: Assoliment excel·lent</span></footer>
  </article>`;
}

function reportDocument(activity, students, subjectId, offeringId, reportMarkup = null, titleOverride = null) {
  const title = titleOverride || (students.length === 1
    ? `Informe ${studentName(students[0])} - ${activity.title}`
    : `Informes de l’activitat - ${activity.title}`);
  const reports = reportMarkup ?? students.map(student => studentReport(activity, student, subjectId, offeringId)).join("");
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
    .report-feedback { margin-top: 24px; padding: 14px; border: 1px solid #e6ebe6; border-radius: 8px; background: #fbfcfb; }
    .report-feedback h2 { margin: 0 0 7px; font-size: 14px; }
    .report-feedback p { margin: 0; color: #49534b; font-size: 11px; line-height: 1.6; white-space: pre-wrap; }
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
  const offerings = getActivityOffers(data, activityId).filter(offer =>
    (!subjectId || offer.subjectId === subjectId) &&
    getOfferingStudents(data, offer).some(item => item.id === studentId)
  );
  const offeringId = offerings.some(offer => offer.id === state.selectedOfferingId)
    ? state.selectedOfferingId
    : offerings.length === 1 ? offerings[0].id : null;
  return activity && student ? studentReport(activity, student, subjectId, offeringId, true) : "";
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

function activityGroupReport(activity, group, students, offeringId) {
  const grade = getActivityGroupGrade(data, activity, group, offeringId);
  const evidenceRows = activity.evidences.map(evidence => {
    const score = getActivityGroupEvidenceScore(data, activity, group, offeringId, evidence.id);
    return `<tr><td><strong>${escapeHtml(evidence.name)}</strong><small>${escapeHtml(evidenceContributionLabel(evidence))}</small></td>
      <td>${getEvidenceActivityWeight(evidence)}%</td><td>${score === null ? "Pendent d'avaluar" : formatGradeWithCode(score)}</td></tr>`;
  }).join("");
  const membersMarkup = students.map(student => escapeHtml(studentName(student))).join(", ");
  const gradeLabel = grade === null ? "Pendent d’avaluar" : formatGradeWithCode(grade);
  const gradeClass = grade === null ? "" : gradeColorClass(grade);
  return `<article class="report-page">
    <header class="report-header"><div><p class="report-eyebrow">Informe d’avaluació de l’agrupament</p><h1>${escapeHtml(activity.title)}</h1></div><span class="report-type">${escapeHtml(activity.type)}</span></header>
    <div class="report-student"><div><span>Agrupament</span><strong>${escapeHtml(group.name)}</strong></div><div><span>Membres</span><strong>${membersMarkup || "Sense membres"}</strong></div><div><span>Data de l’activitat</span><strong>${escapeHtml(formatDate(activity.date))}</strong></div></div>
    <section class="report-final-grade"><div><span>Nota mitjana de l'agrupament</span><small>Mitjana de les avaluacions individuals dels components, ponderada per evidència</small></div><strong class="${gradeClass}">${escapeHtml(gradeLabel)}</strong></section>
    <section class="report-evidence"><h2>Progrés mitjà per evidència</h2><p>Mitjana de les avaluacions individuals dels membres que tenen nota per a cada evidència.</p>
      <table><thead><tr><th>Evidència i competències</th><th>Pes</th><th>Mitjana</th></tr></thead><tbody>${evidenceRows || '<tr><td colspan="3">Aquesta activitat encara no té evidències.</td></tr>'}</tbody></table>
    </section>
    <footer class="report-footer"><span>Avaluatró · Informe generat el ${new Intl.DateTimeFormat("ca-ES", { dateStyle: "long" }).format(new Date())}</span><span>NA: No assolit · AS: Assoliment satisfactori · AN: Assoliment notable · AE: Assoliment excel·lent</span></footer>
  </article>`;
}

export function openActivityGroupReports() {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity?.isGroup) return false;
  const offerings = getActivityOffers(data, activity.id).filter(offer =>
    (!state.selectedSubjectId || offer.subjectId === state.selectedSubjectId) &&
    (!state.selectedLevelId || offer.levelId === state.selectedLevelId)
  );
  const offering = offerings.find(item => item.id === state.selectedOfferingId) ||
    (offerings.length === 1 ? offerings[0] : null);
  if (!offering) return false;
  const students = getOfferingStudents(data, offering);
  const reports = activity.groups.map(group => {
    const members = students.filter(student => group.studentIds.includes(student.id));
    return members.length ? activityGroupReport(activity, group, members, offering.id) : "";
  }).filter(Boolean).join("");
  if (!reports) return false;

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;
  reportWindow.document.open();
  reportWindow.document.write(reportDocument(
    activity, [], offering.subjectId, offering.id, reports, `Informes dels agrupaments - ${activity.title}`
  ));
  reportWindow.document.close();
  return true;
}

export function openGroupAssessmentForms(components) {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity?.isGroup) return false;
  const offerings = getActivityOffers(data, activity.id).filter(offer =>
    (!state.selectedSubjectId || offer.subjectId === state.selectedSubjectId) &&
    (!state.selectedLevelId || offer.levelId === state.selectedLevelId)
  );
  const offering = offerings.find(item => item.id === state.selectedOfferingId) ||
    (offerings.length === 1 ? offerings[0] : null);
  if (!offering) return false;
  const students = getOfferingStudents(data, offering).sort((a, b) => studentName(a).localeCompare(studentName(b), "ca"));
  if (!students.length) return false;

  const scaleHeaders = LEVEL_LABELS.slice(1).map((label, index) =>
    `<th>${escapeHtml(label)}<small>${formatGradeWithCode(SCORE_BY_LEVEL[index + 1])}</small></th>`
  ).join("");
  const ratingRows = `<table class="worksheet-rating"><thead><tr><th>Evidència</th>${scaleHeaders}</tr></thead><tbody>${activity.evidences.map(evidence =>
    `<tr><th>${escapeHtml(evidence.name)}<small>${getEvidenceActivityWeight(evidence)}% de l'activitat</small></th>${LEVEL_LABELS.slice(1).map((_, index) => `<td><span class="worksheet-radio"></span></td>`).join("")}</tr>`
  ).join("")}</tbody></table>`;
  const overallRating = `<table class="worksheet-rating worksheet-overall"><thead><tr><th>Valoració global</th>${scaleHeaders}</tr></thead><tbody><tr><th>Com valores l'acompanyament del docent en aquesta activitat?</th>${LEVEL_LABELS.slice(1).map(() => `<td><span class="worksheet-radio"></span></td>`).join("")}</tr></tbody></table>`;
  const commentSpace = `<div class="worksheet-comment"><strong>Comentari</strong><div></div><div></div></div>`;
  const worksheetSection = (title, description, body) => `<section class="worksheet-section"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p>${body}</section>`;
  const pages = students.map(student => {
    const group = activity.groups.find(item => item.studentIds.includes(student.id));
    const peers = group
      ? students.filter(peer => peer.id !== student.id && group.studentIds.includes(peer.id))
      : [];
    const parts = [];
    if (components.self) {
      parts.push(worksheetSection("Autoavaluació", "Valora el teu treball per a cada evidència de la rúbrica.", ratingRows + commentSpace));
    }
    if (components.peers) {
      const peerForms = peers.length
        ? peers.map(peer => `<div class="worksheet-peer"><h3>${escapeHtml(studentName(peer))}</h3>${ratingRows}${commentSpace}</div>`).join("")
        : '<p class="worksheet-no-peers">No tens companys assignats a un agrupament d’aquesta activitat.</p>';
      parts.push(worksheetSection("Coavaluació", "Valora per separat l’aportació de cada company o companya del teu agrupament.", peerForms));
    }
    if (components.teacher) {
      parts.push(worksheetSection("Avaluació de l’actuació docent", "Valora globalment l’acompanyament del docent durant aquesta activitat.", overallRating + commentSpace));
    }
    return `<article class="worksheet-page">
      <header class="worksheet-header"><p>FITXA D'AVALUACIÓ</p><h1>${escapeHtml(activity.title)}</h1></header>
      <div class="worksheet-student"><span>Alumne/a</span><strong>${escapeHtml(studentName(student))}</strong><span>Agrupament</span><strong>${escapeHtml(group?.name || "Sense agrupament")}</strong></div>
      ${parts.join("")}
      <footer>Escala de la rúbrica: ${LEVEL_LABELS.slice(1).map((label, index) => `${escapeHtml(label)} (${formatGradeWithCode(SCORE_BY_LEVEL[index + 1])})`).join(" · ")}</footer>
    </article>`;
  }).join("");

  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;
  const title = `Fitxes d'avaluació - ${activity.title}`;
  reportWindow.document.open();
  reportWindow.document.write(`<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, sans-serif; color: #303832; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f2f5f2; font-size: 12px; }
    .worksheet-toolbar { position: sticky; top: 0; z-index: 1; display: flex; justify-content: center; gap: 12px; padding: 14px; border-bottom: 1px solid #dfe5df; background: #fff; }
    .worksheet-toolbar button { padding: 10px 16px; border: 0; border-radius: 6px; background: #2c604b; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    .worksheet-toolbar span { align-self: center; color: #68736b; font-size: 11px; }
    .worksheet-page { display: flex; min-height: 273mm; flex-direction: column; width: min(210mm, calc(100% - 32px)); margin: 20px auto; padding: 13mm 14mm 11mm; background: #fff; box-shadow: 0 3px 20px #24372d18; page-break-after: always; break-after: page; }
    .worksheet-page:last-child { page-break-after: auto; break-after: auto; }
    .worksheet-header { padding-bottom: 10px; border-bottom: 2px solid #2c604b; }
    .worksheet-header p { margin: 0 0 5px; color: #708177; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
    h1 { margin: 0; font-size: 20px; }
    .worksheet-student { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 7px 10px; align-items: baseline; margin: 12px 0 14px; }
    .worksheet-student span { color: #758078; font-size: 10px; }
    .worksheet-section { margin: 0 0 14px; }
    .worksheet-section h2 { margin: 0 0 3px; font-size: 14px; }
    .worksheet-section > p { margin: 0 0 7px; color: #68736b; font-size: 10px; }
    .worksheet-rating { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .worksheet-rating th, .worksheet-rating td { padding: 5px 6px; border: 1px solid #dfe5df; text-align: center; vertical-align: middle; }
    .worksheet-rating th:first-child { width: 34%; text-align: left; }
    .worksheet-rating thead th { background: #f3f6f3; font-size: 9px; }
    .worksheet-rating tbody th { font-size: 9px; font-weight: 600; }
    .worksheet-rating small { display: block; margin-top: 2px; color: #78827a; font-size: 8px; font-weight: 400; }
    .worksheet-radio { display: inline-block; width: 12px; height: 12px; border: 1px solid #79867c; border-radius: 50%; }
    .worksheet-comment { margin-top: 7px; }
    .worksheet-comment strong { font-size: 9px; }
    .worksheet-comment div { height: 17px; border-bottom: 1px solid #cfd7d0; }
    .worksheet-peer { margin: 9px 0; break-inside: avoid; }
    .worksheet-peer h3 { margin: 0 0 4px; font-size: 11px; }
    .worksheet-no-peers { padding: 8px; border: 1px dashed #cfd7d0; color: #68736b; font-size: 10px; }
    .worksheet-overall th:first-child { width: 34%; }
    .worksheet-page footer { margin-top: auto; padding-top: 8px; border-top: 1px solid #e6ebe6; color: #78827a; font-size: 8px; }
    @page { size: A4; margin: 9mm; }
    @media print { body { background: #fff; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .worksheet-toolbar { display: none; } .worksheet-page { width: auto; min-height: 279mm; margin: 0; padding: 4mm 3mm; box-shadow: none; } }
  </style></head><body><div class="worksheet-toolbar"><button type="button" onclick="window.print()">Imprimeix o desa com a PDF</button><span>Tria «Desa com a PDF» al diàleg d’impressió.</span></div>${pages}</body></html>`);
  reportWindow.document.close();
  return true;
}
