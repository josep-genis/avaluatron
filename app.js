import {
  clone, DAILY_FOLLOWUP_CRITERIA, getActivityOffers, getLevelOffers,
  getOfferingStudents, getSequenceActivities, getSequenceItems, getStudentEnrollment,
  validateData as validateStoredData
} from "./js/data.js";
import { data, state, setData } from "./js/state.js";
import {
  setView, render, getClassGroup, classGroupOptions, subgroupOptions,
  renderClassGroups, renderSubjectDetail, renderLevelDetail, renderLevelSequence, renderActivityDetail, renderActivityStudentReport, renderActivityRubric, renderStudentDetail, renderStudentSubjectReport, activityRubricEvidenceRowMarkup, activityRubricCompetencyMarkup, studentDisplayName,
  updateActivityAssessmentRow, refreshActivityGroups, competencyOutcomeMarkup, competencyCriterionMarkup, competencyTagChip
} from "./js/views.js";
import {
  SCORE_BY_LEVEL, isStudentExemptFromSubject, getAssessment as calculateAssessment, getActivityGrade as calculateActivityGrade
} from "./js/grades.js";
import { appearanceFieldsMarkup, normalizeAppearance } from "./js/themes.js";
import { startIconDecorator } from "./js/decorate-icons.js";
import { escapeHtml, icon, formatDate, gradeColorClass } from "./js/formatting.js";
import { EDUCATIONAL_LEVELS } from "./js/education.js";
import { openSwipeDeck } from "./js/swipe-followup.js";
import { planStudentImport } from "./js/student-csv.js";
import { planDailyImport } from "./js/daily-csv.js";
import { withoutUnmodifiedBank, getBankCompetency, isBankCompetency } from "./js/competency-bank.js";
import { openActivityReport, openActivityGroupReports, openGroupAssessmentForms } from "./js/activity-report.js";
import { exportActivityReportsBatch } from "./js/activity-batch-report.js";
import { convertEvaluationItems, getEvaluationConfig, getEvaluationItems } from "./js/assessment.js";
import { initializeNavigation, syncNavigation } from "./js/navigation.js";
import { createCloud } from "./js/cloud.js";
import {
  exportActivityTable, exportActivityGroupsTable, exportActivityRubricTable,
  openActivityRubricReport
} from "./js/activity-export.js";

const STORAGE_KEY = "avaluatro.data.v1";
const EMPTY_DATA = {
  schemaVersion: 1,
  students: [],
  classGroups: [],
  competencies: [],
  activities: [],
  subjects: [],
  dailyAssessments: [],
  assessments: []
};
const content = document.querySelector("#app-content");
const dialog = document.querySelector("#app-dialog");
const dialogForm = document.querySelector("#dialog-form");
const dialogContent = document.querySelector("#dialog-content");
const toast = document.querySelector("#toast");
let toastTimer;
let cloud;

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const initialData = validateData(clone(EMPTY_DATA));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutUnmodifiedBank(initialData)));
    return initialData;
  }
  const storedData = JSON.parse(saved);
  const validatedData = validateData(storedData);
  const serialized = JSON.stringify(withoutUnmodifiedBank(validatedData));
  if (serialized !== saved) {
    localStorage.setItem(STORAGE_KEY, serialized);
  }
  return validatedData;
}

try {
  setData(loadData());
} catch (error) {
  setData(validateData(clone(EMPTY_DATA)));
  setSaveStatus("No s'han pogut carregar les dades");
  showToast(`Error en carregar les dades locals: ${error.message}`, true);
}

function validateData(value) {
  return validateStoredData(value, makeId);
}

function saveData() {
  try {
    data.savedAt = new Date().toISOString();
    const payload = clone(withoutUnmodifiedBank(data));
    if (cloud?.isActive()) cloud.save(payload);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setSaveStatus("Desat al dispositiu");
    return true;
  } catch (error) {
    setSaveStatus("Error en desar");
    showToast(`No s'han pogut desar les dades: ${error.message}`, true);
    return false;
  }
}

function setCurrentAcademicYear(academicYearId) {
  const academicYear = data.academicYears.find(year => year.id === academicYearId);
  if (!academicYear) throw new Error("No s'ha trobat el curs acadèmic.");
  data.currentAcademicYearId = academicYearId;
  for (const year of data.academicYears) year.isCurrent = year.id === academicYearId;
  for (const student of data.students) {
    const enrollment = getStudentEnrollment(student, academicYearId);
    Object.assign(student, {
      academicYearId,
      classGroupId: enrollment?.classGroupId || "",
      subgroupId: enrollment?.subgroupId || "",
      additionalGroupIds: enrollment?.additionalGroupIds || []
    });
  }
}

function setSaveStatus(message) {
  const status = document.querySelector("#save-status");
  const indicator = document.querySelector(".save-indicator");
  if (status) status.textContent = message;
  if (indicator) indicator.classList.toggle("error", message.startsWith("Error") || message.startsWith("No s'han"));
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError === true);
  toast.classList.toggle("warning", isError === "warning");
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3300);
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function getAssessment(studentId, activityId) {
  return calculateAssessment(data, studentId, activityId);
}

function competencyOptions(selectedId = "") {
  return data.competencies.map(competency => `<option value="${competency.id}" ${selectedId === competency.id ? "selected" : ""}>${escapeHtml(competency.name)}</option>`).join("");
}

function openDialog(title, subtitle, body, submitLabel) {
  dialogContent.innerHTML = `<div class="dialog-heading"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-button" type="button" data-close-dialog aria-label="Tanca">${icon("xmark")}</button></div>${body}
    <div class="form-actions"><span></span><div class="form-actions-right"><button class="button" type="button" data-close-dialog>${icon("xmark")} Cancel·la</button><button class="button button-primary" type="submit">${icon("check")} ${submitLabel}</button></div></div>`;
  dialog.showModal();
  dialogContent.querySelector("input, select, textarea")?.focus();
}

function openTeacherProfileDialog() {
  const profile = data.teacherProfile;
  openDialog("Edita el perfil docent", "Aquestes dades es desen al dispositiu, s'inclouen a les còpies i se sincronitzen si actives el núvol.", `<div class="form-grid">
    <div class="field full"><label for="teacher-profile-name">Nom i cognoms</label><input id="teacher-profile-name" name="name" type="text" maxlength="120" autocomplete="name" value="${escapeHtml(profile.name)}"></div>
    <div class="field full"><label for="teacher-profile-role">Funció professional</label><input id="teacher-profile-role" name="role" type="text" maxlength="120" placeholder="Ex.: Professor/a de tecnologia" value="${escapeHtml(profile.role)}"></div>
    <div class="field full"><label for="teacher-profile-institution">Centre educatiu</label><input id="teacher-profile-institution" name="institution" type="text" maxlength="120" autocomplete="organization" value="${escapeHtml(profile.institution)}"></div>
    ${appearanceFieldsMarkup(profile.appearance, escapeHtml)}
  </div>`, "Desa el perfil");
  dialogForm.dataset.formType = "teacher-profile";
  dialogForm.dataset.recordId = "";
}

function openStudentDialog() {
  openStudentDialogFor();
}

function openStudentDialogFor(studentId = null) {
  const student = studentId ? data.students.find(item => item.id === studentId) : null;
  if (studentId && !student) {
    showToast("No s'ha trobat l'alumne que vols editar.", true);
    return;
  }
  const editing = Boolean(student);
  const enrollment = student ? getStudentEnrollment(student, data.currentAcademicYearId) : null;
  const classGroupId = enrollment?.classGroupId || "";
  const additionalGroupFields = studentAdditionalGroupFields(enrollment?.additionalGroupIds || []);
  openDialog(editing ? "Edita el perfil de l'alumne" : "Afegeix un alumne", editing ? "Actualitza el grup classe, el desdoblament i els grups addicionals de l'alumne." : "Crea un perfil i assigna'l al seu grup classe i, si cal, a diversos grups addicionals.", `<div class="form-grid">
    <div class="field"><label for="student-first-name">Noms</label><input id="student-first-name" name="firstName" required maxlength="60" placeholder="Ex.: Júlia Maria"></div>
    <div class="field"><label for="student-last-name">Cognoms</label><input id="student-last-name" name="lastName" required maxlength="80" placeholder="Ex.: Martí Soler"></div>
    <div class="field"><label for="student-class-group">Grup classe</label><select id="student-class-group" name="classGroupId">${classGroupOptions(classGroupId)}</select></div>
    <div class="field"><label for="student-subgroup">Desdoblament</label><select id="student-subgroup" name="subgroupId" ${classGroupId ? "" : "disabled"}>${subgroupOptions(classGroupId, enrollment?.subgroupId || "")}</select></div>
    ${additionalGroupFields}
  </div>`, editing ? "Desa els canvis" : "Desa l'alumne");
  if (student) {
    dialogContent.querySelector("#student-first-name").value = student.firstName;
    dialogContent.querySelector("#student-last-name").value = student.lastName;
  }
  dialogForm.dataset.formType = editing ? "edit-student" : "student";
  dialogForm.dataset.recordId = student?.id || "";
}

function studentAdditionalGroupFields(selectedIds) {
  const selected = new Set(selectedIds);
  const availableGroups = data.additionalGroups.filter(group => !selected.has(group.id));
  const options = availableGroups.length
    ? `<option value="">Selecciona un grup addicional</option>${availableGroups.map(group => `<option value="${escapeHtml(group.id)}">${escapeHtml(group.name)}</option>`).join("")}`
    : '<option value="">Tots els grups ja estan afegits</option>';
  const selectedGroups = data.additionalGroups.filter(group => selected.has(group.id));
  return `<div id="student-additional-groups" class="field full"><label for="student-additional-group-select">Grups addicionals</label>
    <div class="level-selection-add"><select id="student-additional-group-select" aria-label="Selecciona un grup addicional" ${availableGroups.length ? "" : "disabled"}>${options}</select><button class="icon-button level-selection-add-button" type="button" data-add-student-additional-group aria-label="Afegeix grup addicional" ${availableGroups.length ? "" : "disabled"}>${icon("plus")}</button></div>
    <div class="level-selection-list">${selectedGroups.map(group => `<div class="level-selection-item"><input type="hidden" name="additionalGroupIds" value="${escapeHtml(group.id)}"><span>${escapeHtml(group.name)}</span><button class="icon-button level-selection-remove-button" type="button" data-remove-student-additional-group="${escapeHtml(group.id)}" aria-label="Elimina ${escapeHtml(group.name)}" title="Elimina grup addicional">${icon("trash")}</button></div>`).join("")}</div>
    <span class="field-hint">Afegeix un o més grups independents del grup classe, com optatives o SIEI.</span></div>`;
}

function openClassGroupDialog(classGroupId = null) {
  const classGroup = classGroupId ? getClassGroup(classGroupId) : null;
  if (classGroupId && !classGroup) {
    showToast("No s'ha trobat el grup classe que vols editar.", true);
    return;
  }
  const editing = Boolean(classGroup);
  const yearOptions = data.academicYears.map(year =>
    `<option value="${escapeHtml(year.id)}" ${(classGroup?.academicYearId || data.currentAcademicYearId) === year.id ? "selected" : ""}>${escapeHtml(year.name)}${year.isCurrent ? " · vigent" : ""}</option>`
  ).join("");
  openDialog(editing ? "Edita el grup classe" : "Crea un grup classe", "Cada grup pertany a un curs acadèmic; els desdoblaments són opcionals.", `<div class="form-grid">
    <div class="field full"><label for="class-group-name">Nom del grup classe</label><input id="class-group-name" name="name" required maxlength="60" placeholder="Ex.: 4t A" value="${escapeHtml(classGroup?.name || "")}"></div>
    <div class="field full"><label for="class-group-year">Curs acadèmic</label><select id="class-group-year" name="academicYearId" required>${yearOptions}</select></div>
    <div class="field full"><label for="class-group-subgroups">Desdoblaments (opcional)</label><textarea id="class-group-subgroups" name="subgroups" maxlength="500" placeholder="Grup A&#10;Grup B">${escapeHtml(classGroup?.subgroups.map(subgroup => subgroup.name).join("\n") || "")}</textarea></div>
  </div>`, editing ? "Desa els canvis" : "Desa el grup");
  dialogForm.dataset.formType = editing ? "edit-class-group" : "class-group";
  dialogForm.dataset.recordId = classGroup?.id || "";
}

function openAcademicYearDialog() {
  openDialog("Afegeix un curs acadèmic", "Crea un curs per organitzar grups, matrícules i ofertes docents independents.", `<div class="form-grid">
    <div class="field full"><label for="academic-year-name">Nom del curs acadèmic</label><input id="academic-year-name" name="name" required maxlength="20" placeholder="Ex.: 2027-28"></div>
    <div class="field full"><label class="checkbox-label"><input type="checkbox" name="isCurrent" checked> Fes-lo vigent</label><span class="field-hint">En canviar el curs vigent, els anteriors queden consultables però deixen de generar alumnat a avaluar.</span></div>
  </div>`, "Crea curs");
  dialogForm.dataset.formType = "academic-year";
  dialogForm.dataset.recordId = "";
}

function deleteCompetency(competencyId) {
  const competency = data.competencies.find(item => item.id === competencyId);
  if (!competency || isBankCompetency(competencyId)) {
    showToast("Només es poden eliminar les competències pròpies.", true);
    return;
  }
  const usedByLevel = data.subjects.some(subject => subject.levels.some(level => level.competencyIds.includes(competencyId)));
  const usedByEvidence = data.activities.some(activity => getEvaluationItems(activity).some(evidence => Object.hasOwn(evidence.contributions || {}, competencyId)));
  if (usedByLevel || usedByEvidence) {
    showToast("No pots eliminar una competència utilitzada en nivells, evidències o preguntes. Treu-la'n primer.", true);
    return;
  }
  if (!globalThis.confirm(`Vols eliminar la competència «${competency.name}»?`)) return;
  const previousData = clone(data);
  data.competencies = data.competencies.filter(item => item.id !== competencyId);
  if (!saveData()) {
    setData(previousData);
    return;
  }
  state.selectedCompetencyId = null;
  render();
  showToast("Competència eliminada.");
}

function deleteClassGroup(classGroupId) {
  const classGroup = getClassGroup(classGroupId);
  if (!classGroup) {
    showToast("No s'ha trobat el grup classe que vols eliminar.", true);
    return;
  }
  const assignedCount = data.students.filter(student => student.classGroupId === classGroupId).length;
  const usedByOffers = data.teachingOffers.some(offer => offer.classGroupIds.includes(classGroupId));
  if (usedByOffers) {
    showToast("No pots eliminar un grup vinculat a ofertes docents: conserva'l per mantenir l'historial d'avaluació.", true);
    return;
  }
  if (!globalThis.confirm(`Vols eliminar «${classGroup.name}»? ${assignedCount ? `${assignedCount} alumnes quedaran sense grup classe.` : ""}`)) return;
  const previousData = clone(data);
  data.classGroups = data.classGroups.filter(item => item.id !== classGroupId);
  for (const student of data.students) {
    for (const enrollment of student.enrollments || []) {
      if (enrollment.classGroupId === classGroupId) {
        enrollment.classGroupId = "";
        enrollment.subgroupId = "";
      }
    }
    if (student.classGroupId === classGroupId) {
      student.classGroupId = "";
      student.subgroupId = "";
    }
  }
  if (!saveData()) {
    setData(previousData);
    render();
    return;
  }
  renderClassGroups();
  showToast("Grup classe eliminat.");
}

function openAdditionalGroupDialog(groupId = null) {
  const group = groupId ? data.additionalGroups.find(item => item.id === groupId) : null;
  if (groupId && !group) {
    showToast("No s'ha trobat el grup addicional que vols editar.", true);
    return;
  }
  const editing = Boolean(group);
  openDialog(editing ? "Edita el grup addicional" : "Crea un grup addicional", "Els grups addicionals són independents del grup classe i poden incloure alumnes de diverses classes.", `<div class="form-grid">
    <div class="field full"><label for="additional-group-name">Nom del grup</label><input id="additional-group-name" name="name" required maxlength="60" placeholder="Ex.: Optativa de música o SIEI" value="${escapeHtml(group?.name || "")}"></div>
  </div>`, editing ? "Desa els canvis" : "Crea el grup");
  dialogForm.dataset.formType = editing ? "edit-additional-group" : "additional-group";
  dialogForm.dataset.recordId = group?.id || "";
}

function deleteAdditionalGroup(groupId) {
  const group = data.additionalGroups.find(item => item.id === groupId);
  if (!group) {
    showToast("No s'ha trobat el grup addicional que vols eliminar.", true);
    return;
  }
  if (data.teachingOffers.some(offer => offer.additionalGroupIds.includes(groupId))) {
    showToast("No pots eliminar un grup vinculat a ofertes docents: conserva'l per mantenir l'historial d'avaluació.", true);
    return;
  }
  const assignedCount = data.students.filter(student => student.additionalGroupIds.includes(groupId)).length;
  if (!globalThis.confirm(`Vols eliminar «${group.name}»? ${assignedCount ? `Es retirarà aquesta assignació de ${assignedCount} ${assignedCount === 1 ? "alumne" : "alumnes"}.` : ""}`)) return;
  const previousData = clone(data);
  data.additionalGroups = data.additionalGroups.filter(item => item.id !== groupId);
  if (state.selectedAdditionalGroupId === groupId) state.selectedAdditionalGroupId = "";
  for (const student of data.students) {
    student.additionalGroupIds = student.additionalGroupIds.filter(id => id !== groupId);
    for (const enrollment of student.enrollments || []) {
      enrollment.additionalGroupIds = enrollment.additionalGroupIds.filter(id => id !== groupId);
    }
  }
  if (!saveData()) {
    setData(previousData);
    render();
    return;
  }
  renderClassGroups();
  showToast("Grup addicional eliminat.");
}

function archiveTeachingOffer(offerId) {
  const offer = data.teachingOffers.find(item => item.id === offerId);
  if (!offer) {
    showToast("No s'ha trobat l'oferta docent que vols arxivar.", true);
    return;
  }
  const previousData = clone(data);
  offer.status = "archived";
  if (!saveData()) {
    setData(previousData);
    render();
    return;
  }
  renderLevelDetail();
  showToast("Oferta docent arxivada; se n'han conservat les qualificacions.");
}

function levelCompetencyFields(selectedIds) {
  const selected = new Set(selectedIds);
  const availableCompetencies = data.competencies.filter(competency => !selected.has(competency.id));
  const selectedCompetencies = data.competencies.filter(competency => selected.has(competency.id));
  const options = availableCompetencies.map(competency =>
    `<option value="${escapeHtml(competency.id)}">${escapeHtml(competency.name)}</option>`
  ).join("");
  return `<div class="level-selection-control">
    <div class="level-selection-add"><select id="level-competency-select" aria-label="Selecciona una competència" ${availableCompetencies.length ? "" : "disabled"}>${options || '<option value="">Totes les competències afegides</option>'}</select><button class="icon-button level-selection-add-button" type="button" data-add-level-competency aria-label="Afegeix competència" ${availableCompetencies.length ? "" : "disabled"}>${icon("plus")}</button></div>
    <div class="level-selection-list">${selectedCompetencies.map(competency =>
      `<div class="level-selection-item"><input type="hidden" name="levelCompetencyId" value="${escapeHtml(competency.id)}"><span>${escapeHtml(competency.name)}</span><button class="icon-button level-selection-remove-button" type="button" data-remove-level-competency="${escapeHtml(competency.id)}" aria-label="Elimina ${escapeHtml(competency.name)}" title="Elimina competència">${icon("trash")}</button></div>`
    ).join("") || '<span class="field-hint">Encara no s’ha afegit cap competència.</span>'}</div>
  </div>`;
}

function selectedLevelCompetencyIds() {
  return [...dialogContent.querySelectorAll('[name="levelCompetencyId"]')].map(input => input.value);
}

function educationalLevelOptions(selectedLevel = "") {
  return `<option value="">Sense nivell</option>${EDUCATIONAL_LEVELS.map(stage => `<optgroup label="${escapeHtml(stage.stage)}">${stage.levels.map(level => `<option value="${escapeHtml(level)}" ${selectedLevel === level ? "selected" : ""}>${escapeHtml(level)}</option>`).join("")}</optgroup>`).join("")}`;
}

function subjectSequenceItem(index, item = null, kind = item?.kind === "lecture" ? "lecture" : "activity") {
  if (kind === "lecture") {
    return `<article class="subject-sequence-item" data-sequence-kind="lecture"><div class="subject-sequence-heading"><strong>Element ${index + 1} · Classe</strong><div><button class="text-button" type="button" data-move-sequence="-1" aria-label="Mou amunt">${icon("nav-arrow-up")}</button><button class="text-button" type="button" data-move-sequence="1" aria-label="Mou avall">${icon("nav-arrow-down")}</button><button class="text-button danger-text" type="button" data-remove-sequence-item>${icon("trash")} Elimina</button></div></div>
    <input type="hidden" name="sequenceItemId" value="${escapeHtml(item?.id || "")}">
    <div class="form-grid"><div class="field"><label>Títol de la classe</label><input name="sequenceTitle" type="text" maxlength="140" required placeholder="Ex.: Introducció al cicle de vida" value="${escapeHtml(item?.title || "")}"></div>
      <div class="field"><label>Temporització (hores)</label><input name="sequenceHours" type="number" min="0.25" max="1000" step="0.25" value="${item ? Number(item.hours) : 1}" required></div></div></article>`;
  }
  const selectedActivityId = item?.activityId || data.activities[0]?.id || "";
  const activities = data.activities.map(activity => `<option value="${escapeHtml(activity.id)}" ${selectedActivityId === activity.id ? "selected" : ""}>${escapeHtml(activity.title)} · ${escapeHtml(activity.type)}</option>`).join("");
  return `<article class="subject-sequence-item" data-sequence-kind="activity"><div class="subject-sequence-heading"><strong>Element ${index + 1} · Activitat</strong><div><button class="text-button" type="button" data-move-sequence="-1" aria-label="Mou amunt">${icon("nav-arrow-up")}</button><button class="text-button" type="button" data-move-sequence="1" aria-label="Mou avall">${icon("nav-arrow-down")}</button><button class="text-button danger-text" type="button" data-remove-sequence-item>${icon("trash")} Elimina</button></div></div>
    <input type="hidden" name="sequenceItemId" value="${escapeHtml(item?.id || "")}">
    <div class="form-grid"><div class="field"><label>Activitat o examen</label><select name="sequenceActivityId" required ${data.activities.length ? "" : "disabled"}>${activities || '<option value="">Crea primer una activitat</option>'}</select></div>
      <div class="field"><label>Temporització (hores)</label><input name="sequenceHours" type="number" min="0.25" max="1000" step="0.25" value="${item ? Number(item.hours) : 1}" required></div></div></article>`;
}

function subjectSequenceSituation(index, situation = null) {
  const activities = situation?.activities || [];
  return `<section class="subject-sequence-situation">
    <div class="subject-sequence-situation-heading"><strong>Situació d'aprenentatge ${index + 1}</strong><div>
      <button class="text-button" type="button" data-move-situation="-1" aria-label="Mou situació amunt">${icon("nav-arrow-up")}</button>
      <button class="text-button" type="button" data-move-situation="1" aria-label="Mou situació avall">${icon("nav-arrow-down")}</button>
      <button class="text-button danger-text" type="button" data-remove-situation>${icon("trash")} Elimina situació</button>
    </div></div>
    <input type="hidden" name="sequenceSituationId" value="${escapeHtml(situation?.id || "")}">
    <div class="field"><label>Nom de la situació d'aprenentatge</label><input name="sequenceSituationName" type="text" maxlength="100" value="${escapeHtml(situation?.name || `Situació d'aprenentatge ${index + 1}`)}" required></div>
    <div class="subject-sequence-activities">${activities.map((item, activityIndex) => subjectSequenceItem(activityIndex, item)).join("")}</div>
    <div class="sequence-add-buttons"><button class="button" type="button" data-add-situation-sequence-item ${data.activities.length ? "" : "disabled"}>${icon("plus")} Afegeix activitat a la situació</button><button class="button" type="button" data-add-situation-lecture-item>${icon("plus")} Afegeix classe a la situació</button></div>
  </section>`;
}

function openSubjectDialog(subjectId = null) {
  const subject = subjectId ? data.subjects.find(item => item.id === subjectId) : null;
  if (subjectId && !subject) {
    showToast("No s'ha trobat l'assignatura que vols editar.", true);
    return;
  }
  const editing = Boolean(subject);
  openDialog(editing ? "Edita l'assignatura" : "Crea una assignatura", "Crea l'assignatura. Després hi podràs afegir targetes de nivell, cadascuna amb els seus grups, seqüència i progrés.", `<div class="form-grid">
    <div class="field full"><label for="subject-name">Nom de l'assignatura</label><input id="subject-name" name="name" required maxlength="100" placeholder="Ex.: Tecnologia i sostenibilitat" value="${escapeHtml(subject?.name || "")}"></div>
    <div class="field full"><label for="subject-description">Descripció (opcional)</label><textarea id="subject-description" name="description" maxlength="500" placeholder="Objectius o informació de l'assignatura">${escapeHtml(subject?.description || "")}</textarea></div>
  </div>`, editing ? "Desa els canvis" : "Crea assignatura");
  dialogForm.dataset.formType = editing ? "edit-subject" : "subject";
  dialogForm.dataset.recordId = subject?.id || "";
}

function openLevelDialog(levelId = null) {
  const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
  if (!subject) {
    showToast("No s'ha trobat l'assignatura del nivell.", true);
    return;
  }
  const level = levelId ? subject.levels.find(item => item.id === levelId) : null;
  if (levelId && !level) {
    showToast("No s'ha trobat el nivell que vols editar.", true);
    return;
  }
  const selectedCompetencyIds = level?.competencyIds || data.competencies.map(competency => competency.id);
  const competencyFields = levelCompetencyFields(selectedCompetencyIds);
  const situations = level?.situations || [];
  openDialog(level ? "Edita el nivell" : "Afegeix un nivell", "Defineix la planificació programativa i la seqüència d'activitats sense vincular-la a grups d'alumnes.", `<div class="form-grid">
    <div class="field full"><label for="level-name">Nivell educatiu</label><select id="level-name" name="name" required>${educationalLevelOptions(level?.name || "").replace('<option value="">Sense nivell</option>', '<option value="">Tria un nivell</option>')}</select></div>
    <div class="field full"><label>Competències avaluades en aquest nivell</label><div id="level-competencies">${competencyFields}</div><span class="field-hint">Les contribucions del nivell es calculen a partir de les evidències de cada activitat.</span></div>
  </div>
  <div class="panel-heading subject-form-heading"><div><h3 class="section-title">Seqüència per situacions d'aprenentatge</h3><span class="section-caption">Cada situació conté les seves activitats. Les hores en ponderen automàticament les contribucions.</span></div></div>
  <div id="subject-sequence-list" class="subject-sequence-list">${situations.map((situation, index) => subjectSequenceSituation(index, situation)).join("")}</div>
  <button class="button" type="button" data-add-sequence-situation>${icon("plus")} Afegeix situació d'aprenentatge</button>
  ${!data.activities.length ? '<p class="field-hint">Crea primer activitats o exàmens a «Activitats i proves».</p>' : ""}`, level ? "Desa els canvis" : "Afegeix nivell");
  dialogForm.dataset.formType = level ? "edit-level" : "level";
  dialogForm.dataset.recordId = level?.id || "";
  dialogForm.dataset.returnToSequence = state.selectedSequence ? "true" : "false";
}

function teachingOfferGroupFields(academicYearId, classGroupIds = [], additionalGroupIds = []) {
  const selectedClassGroups = new Set(classGroupIds);
  const selectedAdditionalGroups = new Set(additionalGroupIds);
  const classGroups = data.classGroups.filter(group => group.academicYearId === academicYearId);
  return `<fieldset class="teaching-offer-groups"><legend>Grups classe del curs</legend>
    ${classGroups.length ? classGroups.map(group => `<label class="offer-group-option"><input type="checkbox" name="offerClassGroupIds" value="${escapeHtml(group.id)}" ${selectedClassGroups.has(group.id) ? "checked" : ""}><span>${escapeHtml(group.name)}</span></label>`).join("") : '<span class="field-hint">Encara no hi ha grups classe en aquest curs.</span>'}
  </fieldset>
  <fieldset class="teaching-offer-groups"><legend>Grups addicionals (opcional)</legend>
    ${data.additionalGroups.length ? data.additionalGroups.map(group => `<label class="offer-group-option"><input type="checkbox" name="offerAdditionalGroupIds" value="${escapeHtml(group.id)}" ${selectedAdditionalGroups.has(group.id) ? "checked" : ""}><span>${escapeHtml(group.name)}</span></label>`).join("") : '<span class="field-hint">No hi ha grups addicionals.</span>'}
  </fieldset>`;
}

function openTeachingOfferDialog(offerId = null) {
  const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
  const level = subject?.levels.find(item => item.id === state.selectedLevelId);
  const offer = offerId ? data.teachingOffers.find(item => item.id === offerId) : null;
  if (!subject || !level || offerId && (!offer || offer.subjectId !== subject.id || offer.levelId !== level.id)) {
    showToast("No s'ha trobat el nivell o l'oferta docent que vols editar.", true);
    return;
  }
  const academicYearId = offer?.academicYearId || data.currentAcademicYearId;
  const yearOptions = data.academicYears.map(year =>
    `<option value="${escapeHtml(year.id)}" ${year.id === academicYearId ? "selected" : ""}>${escapeHtml(year.name)}${year.isCurrent ? " · vigent" : ""}</option>`
  ).join("");
  openDialog(offer ? "Edita l'oferta docent" : "Afegeix una oferta docent", `Connecta «${subject.name} · ${level.name}» amb grups i matrícules d'un curs acadèmic.`, `<div class="form-grid">
    <div class="field full"><label for="teaching-offer-year">Curs acadèmic</label><select id="teaching-offer-year" name="academicYearId" required>${yearOptions}</select></div>
    <div class="field full" id="teaching-offer-groups">${teachingOfferGroupFields(academicYearId, offer?.classGroupIds || [], offer?.additionalGroupIds || [])}</div>
    <div class="field full"><span class="field-hint">L'alumnat es calcula a partir de les matrícules dels grups. Les qualificacions d'altres cursos es conserven, però no apareixen com a pendents del curs vigent.</span></div>
  </div>`, offer ? "Desa l'oferta" : "Crea l'oferta");
  dialogForm.dataset.formType = "teaching-offer";
  dialogForm.dataset.recordId = offer?.id || "";
}

function getSelectedSequenceLevel() {
  const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
  const level = subject?.levels.find(item => item.id === state.selectedLevelId);
  if (!subject || !level) {
    showToast("No s'ha trobat el nivell de la seqüència.", true);
    return null;
  }
  return { subject, level };
}

function openLearningSituationDialog() {
  if (!getSelectedSequenceLevel()) return;
  openDialog("Afegeix una situació d'aprenentatge", "Crea un espai per organitzar-hi les activitats de la seqüència.", `<div class="field"><label for="learning-situation-name">Nom de la situació</label><input id="learning-situation-name" name="name" required maxlength="100" placeholder="Ex.: Disseny d'una solució sostenible"></div>`, "Afegeix situació");
  dialogForm.dataset.formType = "learning-situation";
  dialogForm.dataset.recordId = state.selectedLevelId;
}

function openSequenceActivityDialog(situationId) {
  const context = getSelectedSequenceLevel();
  if (!context) return;
  const { level } = context;
  const situation = level.situations.find(item => item.id === situationId);
  if (!situation) {
    showToast("No s'ha trobat la situació d'aprenentatge seleccionada.", true);
    return;
  }
  const usedActivityIds = new Set(getSequenceActivities(level).map(item => item.activityId));
  const availableActivities = data.activities.filter(activity => !usedActivityIds.has(activity.id));
  const selectedActivityId = availableActivities[0]?.id || "";
  const activityOptions = availableActivities.map(activity => `<option value="${escapeHtml(activity.id)}">${escapeHtml(activity.title)} · ${escapeHtml(activity.type)}</option>`).join("");
  openDialog("Afegeix un element avaluable a la situació", `L'element s'afegirà a «${escapeHtml(situation.name)}». Les contribucions per competència es ponderaran segons les hores.`, `<div class="form-grid">
    <div class="field full"><label for="sequence-activity-select">Activitat o prova</label><select id="sequence-activity-select" name="sequenceActivityId" required ${availableActivities.length ? "" : "disabled"}>${activityOptions || '<option value="">No hi ha elements avaluatius disponibles</option>'}</select>${availableActivities.length ? "" : '<span class="field-hint">Crea primer una activitat o prova des de «Activitats i proves».</span>'}</div>
    <div class="field"><label>Inversió de temps (hores)</label><input name="sequenceHours" type="number" min="0.25" max="1000" step="0.25" value="1" required></div>
  </div>`, "Afegeix element");
  dialogForm.dataset.formType = "sequence-activity";
  dialogForm.dataset.recordId = level.id;
  dialogForm.dataset.situationId = situation.id;
  dialogForm.querySelector('[type="submit"]').disabled = !availableActivities.length;
}

function openSequenceLectureDialog(situationId) {
  const context = getSelectedSequenceLevel();
  const situation = context?.level.situations.find(item => item.id === situationId);
  if (!situation) {
    showToast("No s'ha trobat la situació d'aprenentatge seleccionada.", true);
    return;
  }
  openDialog("Afegeix una classe a la situació", `La classe s'afegirà a «${escapeHtml(situation.name)}». No s'avalua amb rúbrica: l'alumnat es segueix amb el seguiment diari.`, `<div class="form-grid">
    <div class="field full"><label for="sequence-lecture-title">Títol de la classe</label><input id="sequence-lecture-title" name="sequenceTitle" type="text" maxlength="140" required placeholder="Ex.: Introducció al cicle de vida"></div>
    <div class="field"><label>Inversió de temps (hores)</label><input name="sequenceHours" type="number" min="0.25" max="1000" step="0.25" value="1" required></div>
  </div>`, "Afegeix classe");
  dialogForm.dataset.formType = "sequence-lecture";
  dialogForm.dataset.recordId = context.level.id;
  dialogForm.dataset.situationId = situation.id;
}

function openActivityGroupDialog(groupId = null) {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  const offering = data.teachingOffers.find(item => item.id === state.selectedOfferingId);
  if (!activity || !offering) {
    showToast("Selecciona una oferta per crear agrupaments.", true);
    return;
  }
  const group = groupId ? activity.groups.find(item => item.id === groupId) : null;
  const students = getOfferingStudents(data, offering).filter(student => {
    const owner = activity.groups.find(item => item.studentIds.includes(student.id));
    return !owner || owner.id === groupId;
  }).sort((a, b) => studentDisplayName(a).localeCompare(studentDisplayName(b), "ca"));
  openDialog(group ? "Edita l'agrupament" : "Crea un agrupament", "Cada alumne pot pertànyer a un sol agrupament dins l'activitat.", `<div class="form-grid">
    <div class="field full"><label for="activity-group-name">Nom de l'agrupament</label><input id="activity-group-name" name="groupName" type="text" maxlength="60" required value="${escapeHtml(group?.name || "")}"></div>
    <div class="field full"><label for="activity-group-search">Membres</label>
      <div class="member-chips" id="activity-group-chips" aria-live="polite"></div>
      <div class="member-picker"><input id="activity-group-search" type="search" autocomplete="off" placeholder="Cerca un alumne per afegir-lo…" role="combobox" aria-expanded="false" aria-controls="activity-group-options" ${students.length ? "" : "disabled"}><div class="member-picker-options" id="activity-group-options" role="listbox" hidden></div></div>
      ${students.length ? "" : '<p class="section-caption">Tots els alumnes ja tenen agrupament.</p>'}</div>
  </div>`, group ? "Desa" : "Crea agrupament");
  dialogForm.dataset.formType = "activity-group";
  dialogForm.dataset.recordId = groupId || "";
  setupActivityGroupMemberPicker(students, new Set(group?.studentIds || []));
}

function openActivityGroupAssessmentDocumentDialog() {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity?.isGroup) {
    showToast("Aquesta activitat no està configurada com a activitat en grup.", true);
    return;
  }
  openDialog(
    "Genera fitxes d'avaluació",
    "Es crearà una fitxa imprimible per alumne de l'oferta seleccionada. Les valoracions seguiran l'escala de la rúbrica.",
    `<div class="form-grid">
      <div class="field full"><span class="section-caption">Tria els apartats que vols incloure:</span></div>
      <div class="field full"><label class="checkbox-option"><input type="checkbox" name="includeSelfAssessment" checked> Autoavaluació de les evidències</label></div>
      <div class="field full"><label class="checkbox-option"><input type="checkbox" name="includePeerAssessment" checked> Coavaluació de cada company o companya del seu agrupament</label></div>
      <div class="field full"><label class="checkbox-option"><input type="checkbox" name="includeTeacherAssessment" checked> Avaluació de l'actuació docent</label></div>
      <p class="section-caption full">Cada valoració inclou els nivells de la rúbrica i espai per a comentaris.</p>
    </div>`,
    "Genera PDF"
  );
  dialogForm.dataset.formType = "activity-group-assessment-document";
  dialogForm.dataset.recordId = activity.id;
}

function setupActivityGroupMemberPicker(students, selected) {
  const search = dialogForm.querySelector("#activity-group-search");
  const options = dialogForm.querySelector("#activity-group-options");
  const chips = dialogForm.querySelector("#activity-group-chips");
  const renderChips = () => {
    chips.innerHTML = students.filter(student => selected.has(student.id)).map(student =>
      `<span class="member-chip">${escapeHtml(studentDisplayName(student))}<input type="hidden" name="groupStudent" value="${escapeHtml(student.id)}"><button type="button" data-remove-member="${escapeHtml(student.id)}" aria-label="Treu ${escapeHtml(studentDisplayName(student))}">${icon("xmark")}</button></span>`).join("");
  };
  const matches = () => {
    const query = search.value.trim().toLowerCase();
    return students.filter(student => !selected.has(student.id) &&
      (!query || `${studentDisplayName(student)} ${student.lastName} ${student.firstName}`.toLowerCase().includes(query)));
  };
  const renderOptions = () => {
    const found = matches();
    options.innerHTML = found.length
      ? found.map(student => `<button type="button" role="option" data-add-member="${escapeHtml(student.id)}">${escapeHtml(studentDisplayName(student))}</button>`).join("")
      : '<span class="member-picker-empty">Cap alumne disponible</span>';
    options.hidden = false;
    search.setAttribute("aria-expanded", "true");
  };
  const closeOptions = () => {
    options.hidden = true;
    search.setAttribute("aria-expanded", "false");
  };
  const add = id => {
    selected.add(id);
    search.value = "";
    renderChips();
    renderOptions();
    search.focus();
  };
  search.addEventListener("focus", renderOptions);
  search.addEventListener("input", renderOptions);
  search.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      const first = matches()[0];
      if (first) add(first.id);
    } else if (event.key === "Escape" && !options.hidden) {
      event.stopPropagation();
      event.preventDefault();
      closeOptions();
    }
  });
  options.addEventListener("mousedown", event => event.preventDefault());
  options.addEventListener("click", event => {
    const button = event.target.closest("[data-add-member]");
    if (button) add(button.dataset.addMember);
  });
  chips.addEventListener("click", event => {
    const button = event.target.closest("[data-remove-member]");
    if (!button) return;
    selected.delete(button.dataset.removeMember);
    renderChips();
    if (!options.hidden) renderOptions();
  });
  search.addEventListener("blur", closeOptions);
  renderChips();
}

function openCompetencyDialog() {
  openDialog("Crea una competència", "Descriu una capacitat observable. Després hi podràs afegir resultats d'aprenentatge i criteris d'avaluació.", `<div class="form-grid">
    <div class="field full"><label for="competency-name">Nom de la competència</label><input id="competency-name" name="name" required maxlength="140" placeholder="Ex.: Avaluar l'impacte ecològic d'una tecnologia"></div>
    <div class="field full"><label for="competency-description">Descripció</label><textarea id="competency-description" name="description" maxlength="500" placeholder="Quines accions o coneixements demostren aquesta competència?"></textarea></div>
  </div>`, "Desa la competència");
  dialogForm.dataset.formType = "competency";
  dialogForm.dataset.recordId = "";
}

function openActivityDialog(activityId = null) {
  const activity = activityId ? data.activities.find(item => item.id === activityId) : null;
  if (activityId && !activity) {
    showToast("No s'ha trobat l'activitat que vols editar.", true);
    return;
  }
  if (!data.competencies.length) {
    showToast("Crea una competència abans de preparar la rúbrica d'una activitat.", true);
    openCompetencyDialog();
    return;
  }
  const editing = Boolean(activity);
  const typeOptions = ["Activitat", "Prova"];
  if (activity && !typeOptions.includes(activity.type)) typeOptions.push(activity.type);
  openDialog(editing ? "Edita l'element avaluable" : "Crea un element avaluable", editing ? "Actualitza les dades bàsiques. En canviar el tipus, es conserva la correspondència entre els ítems i les qualificacions." : "Defineix una activitat o una prova per incorporar-la a la programació.", `<div class="form-grid">
    <div class="field full"><label for="activity-title">Nom de l'element</label><input id="activity-title" name="title" required maxlength="140" placeholder="Ex.: Projecte de sostenibilitat o prova del tema 1" value="${escapeHtml(activity?.title || "")}"></div>
    <div class="field"><label for="activity-type">Tipus d'element avaluable</label><select id="activity-type" name="type">${typeOptions.map(type => `<option ${activity?.type === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></div>
    <div class="field"><label for="activity-date">Data (opcional)</label><input id="activity-date" name="date" type="date" value="${escapeHtml(activity?.date || "")}"></div>
    <div class="field full"><label class="checkbox-option"><input type="checkbox" name="isGroup" ${activity?.isGroup ? "checked" : ""}> Activitat en grup (permet crear agrupaments d'alumnes)</label></div>
  </div>`, editing ? "Desa els canvis" : "Crea element");
  dialogForm.dataset.formType = editing ? "edit-activity" : "activity";
  dialogForm.dataset.recordId = activity?.id || "";
}

function exportData() {
  const exported = { ...withoutUnmodifiedBank(data), savedAt: data.savedAt || new Date().toISOString(), exportedAt: new Date().toISOString() };
  const blob = new Blob([`${JSON.stringify(exported, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `avaluatro-dades-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Còpia JSON exportada.");
}

function importData(file) {
  const reader = new FileReader();
  reader.onerror = () => showToast("No s'ha pogut llegir el fitxer seleccionat.", true);
  reader.onload = () => {
    try {
      const imported = validateData(JSON.parse(String(reader.result)));
      const formatDate = value => new Date(value).toLocaleString("ca-ES");
      const importedTime = Date.parse(imported.savedAt);
      const currentTime = Date.parse(data.savedAt);
      let warning = "";
      if (Number.isNaN(importedTime)) {
        warning = "Aquest fitxer no porta data de versió i no es pot saber si és més antic que les dades actuals.\n\n";
      } else if (!Number.isNaN(currentTime) && importedTime < currentTime) {
        warning = `⚠️ Estàs important una versió MÉS ANTIGA de les dades.\nFitxer: ${formatDate(importedTime)}\nDades actuals: ${formatDate(currentTime)}\nSe sobreescriuran els canvis posteriors.\n\n`;
      }
      if (!globalThis.confirm(`${warning}La importació substituirà les dades de l'espai actual${cloud?.isActive() ? " i se sincronitzarà amb el núvol" : " d'aquest dispositiu"}. Vols continuar?`)) return;
      const previous = data;
      setData(imported);
      if (!saveData()) {
        setData(previous);
        return;
      }
      setView("overview");
      syncNavigation();
      showToast("Dades importades correctament.");
    } catch (error) {
      showToast(`No s'ha pogut importar el JSON: ${error.message}`, true);
    }
  };
  reader.readAsText(file);
}

function importStudentsCsv(file) {
  const reader = new FileReader();
  reader.onerror = () => showToast("No s'ha pogut llegir el fitxer seleccionat.", true);
  reader.onload = () => {
    const { students, errors, skipped } = planStudentImport(String(reader.result), data);
    if (errors.length) {
      const shown = errors.slice(0, 5).join(" ");
      showToast(`No s'ha importat cap alumne. ${shown}${errors.length > 5 ? ` (+${errors.length - 5} errors més)` : ""}`, true);
      return;
    }
    const previousData = clone(data);
    for (const item of students) {
      data.students.push({
        id: makeId("al"),
        ...item,
        academicYearId: data.currentAcademicYearId,
        additionalGroupIds: [],
        enrollments: [{ academicYearId: data.currentAcademicYearId, classGroupId: item.classGroupId, subgroupId: item.subgroupId, additionalGroupIds: [] }]
      });
    }
    if (!saveData()) {
      setData(previousData);
      return;
    }
    render();
    showToast(`${students.length} alumnes importats${skipped ? `; ${skipped} duplicats omesos` : ""}.`);
  };
  reader.readAsText(file);
}

document.querySelector("#student-csv-file").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) importStudentsCsv(file);
  event.target.value = "";
});

function importDailyCsv(file, context) {
  const reader = new FileReader();
  reader.onerror = () => showToast("No s'ha pogut llegir el fitxer seleccionat.", true);
  reader.onload = () => {
    let plan;
    try {
      plan = planDailyImport(String(reader.result));
      if (plan.needsHeaderConfirmation && globalThis.confirm(
        "La primera fila no és una data vàlida ni una capçalera reconeguda. Vols ometre-la com a capçalera?\n\nLes columnes han d'estar en aquest ordre: dia, participació, preparació, autonomia, col·laboració i, opcionalment, observacions."
      )) {
        plan = planDailyImport(String(reader.result), { skipFirstRow: true });
      }
    } catch (error) {
      showToast(`No s'ha importat cap seguiment: ${error.message}`, true);
      return;
    }
    if (plan.errors.length) {
      const shown = plan.errors.slice(0, 5).join(" ");
      showToast(`No s'ha importat cap seguiment. ${shown}${plan.errors.length > 5 ? ` (+${plan.errors.length - 5} errors més)` : ""}`, true);
      return;
    }
    const { studentId, subjectId, levelId, academicYearId } = context;
    if (data.currentAcademicYearId !== academicYearId ||
      isStudentExemptFromSubject(data, studentId, subjectId) ||
      !getLevelOffers(data, levelId, subjectId).some(offer =>
        getOfferingStudents(data, offer).some(student => student.id === studentId)
      )) {
      showToast("No s'ha importat el CSV: l'alumne ja no cursa aquest nivell o està exempt de l'assignatura.", true);
      return;
    }
    const existing = data.dailyAssessments.filter(item =>
      item.studentId === studentId && item.subjectId === subjectId &&
      plan.assessments.some(row => row.date === item.date)
    );
    const absences = existing.filter(item => item.absent).length;
    if (existing.length && !globalThis.confirm(
      `${existing.length} ${existing.length === 1 ? "dia ja té" : "dies ja tenen"} seguiment. Les valoracions se substituiran i es conservaran les observacions.${absences ? ` ${absences} ${absences === 1 ? "absència quedarà anul·lada" : "absències quedaran anul·lades"}.` : ""}\n\nVols continuar?`
    )) return;
    const previousData = clone(data);
    for (const row of plan.assessments) {
      const assessment = data.dailyAssessments.find(item =>
        item.studentId === studentId && item.subjectId === subjectId && item.date === row.date
      );
      if (assessment) {
        assessment.levels = row.levels;
        delete assessment.absent;
      } else {
        data.dailyAssessments.push({ studentId, subjectId, date: row.date, levels: row.levels, note: row.note });
      }
    }
    if (!saveData()) {
      setData(previousData);
      render();
      return;
    }
    render();
    showToast(`${plan.assessments.length} ${plan.assessments.length === 1 ? "seguiment importat" : "seguiments importats"}${existing.length ? `; ${existing.length} ${existing.length === 1 ? "dia actualitzat" : "dies actualitzats"}` : ""}.`);
  };
  reader.readAsText(file);
}

document.querySelector("#daily-csv-file").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) importDailyCsv(file, {
    studentId: state.selectedStudentId,
    subjectId: state.selectedStudentSubjectId,
    levelId: state.selectedStudentLevelId,
    academicYearId: data.currentAcademicYearId
  });
  event.target.value = "";
});

document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelector(".brand").addEventListener("click", event => {
  event.preventDefault();
  setView("overview");
});
document.querySelector("#export-button").addEventListener("click", exportData);
document.querySelector("#teacher-profile-button").addEventListener("click", () => setView("teacher-profile"));
document.querySelector("#import-button").addEventListener("click", () => document.querySelector("#import-file").click());
document.querySelector("#import-file").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) importData(file);
  event.target.value = "";
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-import-daily-csv]")) {
    document.querySelector("#daily-csv-file").click();
    return;
  }
  const groupAssessmentFormsButton = event.target.closest("[data-export-group-assessment-forms]");
  if (groupAssessmentFormsButton) {
    groupAssessmentFormsButton.closest("details")?.removeAttribute("open");
    openActivityGroupAssessmentDocumentDialog();
    return;
  }
  const rubricTableExportButton = event.target.closest("[data-export-activity-rubric]");
  if (rubricTableExportButton) {
    const result = exportActivityRubricTable(rubricTableExportButton.dataset.exportActivityRubric);
    rubricTableExportButton.closest("details")?.removeAttribute("open");
    showToast(result.message, !result.ok);
    return;
  }
  const rubricPdfExportButton = event.target.closest("[data-export-activity-rubric-pdf]");
  if (rubricPdfExportButton) {
    rubricPdfExportButton.closest("details")?.removeAttribute("open");
    if (!openActivityRubricReport()) {
      showToast("No s'ha pogut obrir el PDF de la rúbrica. Permet les finestres emergents del navegador.", true);
    }
    return;
  }
  const groupTableExportButton = event.target.closest("[data-export-activity-groups]");
  if (groupTableExportButton) {
    const result = exportActivityGroupsTable(groupTableExportButton.dataset.exportActivityGroups);
    groupTableExportButton.closest("details")?.removeAttribute("open");
    showToast(result.message, !result.ok);
    return;
  }
  const tableExportButton = event.target.closest("[data-export-activity-table]");
  if (tableExportButton) {
    const result = exportActivityTable(tableExportButton.dataset.exportActivityTable);
    tableExportButton.closest("details")?.removeAttribute("open");
    showToast(result.message, !result.ok);
    return;
  }
  const studentReportButton = event.target.closest("[data-export-student-report]");
  const activityReportsButton = event.target.closest("[data-export-activity-reports]");
  const activityGroupReportsButton = event.target.closest("[data-export-activity-group-reports]");
  if (activityReportsButton) {
    activityReportsButton.closest("details")?.removeAttribute("open");
    activityReportsButton.disabled = true;
    showToast("Generant els informes PDF...");
    exportActivityReportsBatch().then(count => {
      showToast(`S'han generat ${count} informes PDF en un fitxer ZIP.`);
    }).catch(error => {
      console.error("Error en exportar els informes:", error);
      showToast(`No s'han pogut exportar els informes: ${error instanceof Error ? error.message : String(error)}`, true);
    }).finally(() => {
      activityReportsButton.disabled = false;
    });
    return;
  }
  if (studentReportButton || activityGroupReportsButton) {
    activityGroupReportsButton?.closest("details")?.removeAttribute("open");
    const opened = activityGroupReportsButton
      ? openActivityGroupReports()
      : openActivityReport(studentReportButton?.dataset.exportStudentReport || null);
    if (!opened) showToast("No s'ha pogut obrir l'informe. Permet les finestres emergents per desar-lo com a PDF.", true);
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "create-student") openStudentDialog();
    if (action === "import-students-csv") document.querySelector("#student-csv-file").click();
    if (action === "create-competency") openCompetencyDialog();
    if (action === "create-activity") openActivityDialog();
    if (action === "create-class-group") openClassGroupDialog();
    if (action === "create-academic-year") openAcademicYearDialog();
    if (action === "create-teaching-offer") openTeachingOfferDialog();
    if (action === "create-additional-group") openAdditionalGroupDialog();
    if (action === "edit-level") openLevelDialog(state.selectedLevelId);
    if (action === "add-learning-situation") openLearningSituationDialog();
    if (action === "edit-teacher-profile") openTeacherProfileDialog();
  }
  const navigateButton = event.target.closest("[data-navigate]");
  if (navigateButton) setView(navigateButton.dataset.navigate);
  const actionButtonSubject = event.target.closest('[data-action="create-subject"]');
  if (actionButtonSubject) openSubjectDialog();
  if (event.target.closest('[data-action="create-level"]')) openLevelDialog();
  if (event.target.closest('[data-action="edit-subject"]')) openSubjectDialog(state.selectedSubjectId);
  const openSubjectButton = event.target.closest("[data-open-subject]");
  if (openSubjectButton && !event.target.closest("[data-edit-subject]")) {
    event.preventDefault();
    state.selectedSubjectId = openSubjectButton.dataset.openSubject;
    state.selectedLevelId = null;
    state.selectedSequence = false;
    state.currentView = "subjects";
    document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === "subjects"));
    document.querySelector("#current-section").textContent = "Assignatures";
    renderSubjectDetail();
  }
  const openLevelButton = event.target.closest("[data-open-level]");
  if (openLevelButton && !event.target.closest("[data-edit-level], [data-open-level-sequence]")) {
    event.preventDefault();
    state.selectedLevelId = openLevelButton.dataset.openLevel;
    state.selectedSequence = false;
    document.querySelector("#current-section").textContent = "Assignatures";
    renderLevelDetail();
  }
  const openLevelSequenceButton = event.target.closest("[data-open-level-sequence]");
  if (openLevelSequenceButton) {
    state.selectedLevelId = openLevelSequenceButton.dataset.openLevelSequence || state.selectedLevelId;
    state.selectedSequence = true;
    document.querySelector("#current-section").textContent = "Seqüència d'aprenentatge";
    renderLevelSequence();
  }
  const addLearningSituationButton = event.target.closest("[data-add-learning-situation]");
  if (addLearningSituationButton) openLearningSituationDialog();
  const addSituationActivityButton = event.target.closest("[data-add-situation-activity]");
  if (addSituationActivityButton) openSequenceActivityDialog(addSituationActivityButton.dataset.addSituationActivity);
  const addSituationLectureButton = event.target.closest("[data-add-situation-lecture]");
  if (addSituationLectureButton) openSequenceLectureDialog(addSituationLectureButton.dataset.addSituationLecture);
  if (event.target.closest("[data-open-level-progress]")) {
    state.selectedSequence = false;
    document.querySelector("#current-section").textContent = "Assignatures";
    renderLevelDetail();
  }
  const editSubjectButton = event.target.closest("[data-edit-subject]");
  if (editSubjectButton) openSubjectDialog(editSubjectButton.dataset.editSubject);
  const editLevelButton = event.target.closest("[data-edit-level]");
  if (editLevelButton) openLevelDialog(editLevelButton.dataset.editLevel);
  const editTeachingOfferButton = event.target.closest("[data-edit-teaching-offer]");
  if (editTeachingOfferButton) openTeachingOfferDialog(editTeachingOfferButton.dataset.editTeachingOffer);
  const archiveTeachingOfferButton = event.target.closest("[data-archive-teaching-offer]");
  if (archiveTeachingOfferButton) archiveTeachingOffer(archiveTeachingOfferButton.dataset.archiveTeachingOffer);
  const activityButton = event.target.closest("[data-open-activity]");
  if (activityButton) {
    state.selectedActivityId = activityButton.dataset.openActivity;
    state.activityReturnToSequence = state.currentView === "subjects" && state.selectedSequence;
    state.selectedSubjectId = activityButton.dataset.subjectId || null;
    state.selectedLevelId = activityButton.dataset.levelId || null;
    const offers = getActivityOffers(data, state.selectedActivityId).filter(offer =>
      (!state.selectedSubjectId || offer.subjectId === state.selectedSubjectId) &&
      (!state.selectedLevelId || offer.levelId === state.selectedLevelId)
    );
    state.selectedOfferingId = offers.length === 1 ? offers[0].id : null;
    if (activityButton.dataset.offeringId && offers.some(offer => offer.id === activityButton.dataset.offeringId)) {
      state.selectedOfferingId = activityButton.dataset.offeringId;
    }
    if (offers.length === 1) {
      state.selectedSubjectId = offers[0].subjectId;
      state.selectedLevelId = offers[0].levelId;
    }
    state.currentView = "activities";
    document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === "activities"));
    document.querySelector("#current-section").textContent = "Activitats i proves";
    renderActivityDetail();
  }
  if (event.target.closest("[data-open-swipe-daily]")) {
    const cards = [...content.querySelectorAll(".daily-followup-table tbody tr")].flatMap(row => {
      const name = row.querySelector(".daily-student strong")?.textContent || "";
      const group = row.querySelector(".daily-student small")?.textContent || "";
      const initials = row.querySelector(".daily-student-avatar")?.textContent || "";
      const note = row.querySelector("[data-daily-note]");
      if (!note || row.querySelector("[data-daily-absent]")?.checked) return [];
      const ratings = [...row.querySelectorAll("[data-daily-assessment]")].filter(select => !select.value && !select.disabled).map(select => ({
        studentId: select.dataset.studentId,
        criterionId: select.dataset.criterionId,
        title: name,
        subtitle: group,
        initials,
        criterion: DAILY_FOLLOWUP_CRITERIA.find(item => item.id === select.dataset.criterionId)?.name || ""
      }));
      return [...ratings, {
        type: "note",
        studentId: note.dataset.studentId,
        title: name,
        subtitle: group,
        initials,
        criterion: "Observació",
        note: note.value
      }];
    });
    if (!cards.length) {
      showToast("No hi ha alumnes presents en aquesta selecció.");
      return;
    }
    openSwipeDeck({
      cards,
      heading: `${formatDate(state.dailySelectedDate)} · Seguiment diari`,
      onAbsent: (card, absent) => {
        const toggle = [...content.querySelectorAll("[data-daily-absent]")].find(item => item.dataset.studentId === card.studentId);
        if (!toggle) return false;
        toggle.checked = absent;
        toggle.dispatchEvent(new Event("change", { bubbles: true }));
        return !!data.dailyAssessments.find(item => item.studentId === card.studentId &&
          item.subjectId === state.dailySelectedSubjectId && item.date === state.dailySelectedDate)?.absent === absent;
      },
      onRate: (card, level) => {
        const select = [...content.querySelectorAll("[data-daily-assessment]")].find(item =>
          item.dataset.studentId === card.studentId && item.dataset.criterionId === card.criterionId);
        if (!select) return false;
        select.value = level ? String(level) : "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        const assessment = data.dailyAssessments.find(item => item.studentId === card.studentId &&
          item.subjectId === state.dailySelectedSubjectId && item.date === state.dailySelectedDate);
        return select.isConnected && (assessment?.levels[card.criterionId] || null) === level;
      },
      onNote: (card, note) => {
        const input = [...content.querySelectorAll("[data-daily-note]")].find(item => item.dataset.studentId === card.studentId);
        if (!input) return false;
        input.value = note;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        const assessment = data.dailyAssessments.find(item => item.studentId === card.studentId &&
          item.subjectId === state.dailySelectedSubjectId && item.date === state.dailySelectedDate);
        return input.isConnected && (assessment?.note || "") === note.trim();
      }
    });
    return;
  }
  const dailyTaskButton = event.target.closest("[data-open-daily]");
  if (dailyTaskButton) {
    state.dailySelectedSubjectId = dailyTaskButton.dataset.subjectId;
    state.dailySelectedDate = "";
    state.dailySelectedClassGroupId = dailyTaskButton.dataset.classGroupId;
    state.dailySelectedAdditionalGroupId = dailyTaskButton.dataset.additionalGroupId;
    state.dailySelectedSubgroupId = "";
    setView("daily-followup");
  }
  const gradingModeButton = event.target.closest("[data-set-grading-mode]");
  if (gradingModeButton) {
    const activity = data.activities.find(item => item.id === state.selectedActivityId);
    const mode = gradingModeButton.dataset.setGradingMode === "group" ? "group" : "individual";
    if (activity && activity.groupGrading !== mode) {
      const previousData = clone(data);
      activity.groupGrading = mode;
      if (!saveData()) {
        setData(previousData);
        renderActivityDetail();
        return;
      }
      renderActivityDetail();
      showToast(mode === "group" ? "Qualificació en grup activada." : "Qualificació individual activada.");
    }
    return;
  }
  if (event.target.closest("[data-create-activity-group]")) {
    openActivityGroupDialog();
    return;
  }
  const editActivityGroupButton = event.target.closest("[data-edit-activity-group]");
  if (editActivityGroupButton) {
    openActivityGroupDialog(editActivityGroupButton.dataset.editActivityGroup);
    return;
  }
  const deleteActivityGroupButton = event.target.closest("[data-delete-activity-group]");
  if (deleteActivityGroupButton) {
    const activity = data.activities.find(item => item.id === state.selectedActivityId);
    const group = activity?.groups.find(item => item.id === deleteActivityGroupButton.dataset.deleteActivityGroup);
    if (group && globalThis.confirm(`Vols eliminar l'agrupament «${group.name}»? Les notes dels alumnes es conserven.`)) {
      const previousData = clone(data);
      activity.groups = activity.groups.filter(item => item !== group);
      if (!saveData()) {
        setData(previousData);
        renderActivityDetail();
        return;
      }
      renderActivityDetail();
      showToast("Agrupament eliminat.");
    }
    return;
  }
  const studentActivityReportButton = event.target.closest("[data-open-student-activity-report]");
  if (studentActivityReportButton) {
    state.activityReportReturnView = state.currentView === "students" ? "students" : "activities";
    state.selectedStudentId = studentActivityReportButton.dataset.openStudentActivityReport;
    state.selectedActivityId = studentActivityReportButton.dataset.activityId || state.selectedActivityId;
    state.selectedSubjectId = studentActivityReportButton.dataset.reportSubjectId || state.selectedSubjectId;
    state.currentView = "activity-report";
    document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === state.activityReportReturnView));
    document.querySelector("#current-section").textContent = "Informe d'activitat";
    renderActivityStudentReport();
  }
  const editActivityButton = event.target.closest("[data-edit-activity]");
  if (editActivityButton) openActivityDialog(editActivityButton.dataset.editActivity);
  if (event.target.closest("[data-edit-activity-rubric]")) {
    if (!data.activities.some(activity => activity.id === state.selectedActivityId)) {
      showToast("No s'ha trobat l'activitat per editar-ne la rúbrica.", true);
      return;
    }
    state.currentView = "activity-rubric";
    document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === "activities"));
    document.querySelector("#current-section").textContent = "Activitats i proves · Rúbrica";
    renderActivityRubric();
    window.scrollTo(0, 0);
    return;
  }
  const deleteCompetencyButton = event.target.closest("[data-delete-competency]");
  if (deleteCompetencyButton) deleteCompetency(deleteCompetencyButton.dataset.deleteCompetency);
  const editCompetencyButton = event.target.closest("[data-edit-competency]");
  if (editCompetencyButton) {
    state.selectedCompetencyId = editCompetencyButton.dataset.editCompetency;
    render();
    window.scrollTo(0, 0);
  }
  const editStudentButton = event.target.closest("[data-edit-student]");
  if (editStudentButton) openStudentDialogFor(editStudentButton.dataset.editStudent);
  const editClassGroupButton = event.target.closest("[data-edit-class-group]");
  if (editClassGroupButton) openClassGroupDialog(editClassGroupButton.dataset.editClassGroup);
  const deleteClassGroupButton = event.target.closest("[data-delete-class-group]");
  if (deleteClassGroupButton) deleteClassGroup(deleteClassGroupButton.dataset.deleteClassGroup);
  const editAdditionalGroupButton = event.target.closest("[data-edit-additional-group]");
  if (editAdditionalGroupButton) openAdditionalGroupDialog(editAdditionalGroupButton.dataset.editAdditionalGroup);
  const deleteAdditionalGroupButton = event.target.closest("[data-delete-additional-group]");
  if (deleteAdditionalGroupButton) deleteAdditionalGroup(deleteAdditionalGroupButton.dataset.deleteAdditionalGroup);
  const filterAdditionalGroupButton = event.target.closest("[data-filter-additional-group]");
  if (filterAdditionalGroupButton) {
    state.selectedClassGroupId = "";
    state.selectedSubgroupId = "";
    state.selectedAdditionalGroupId = filterAdditionalGroupButton.dataset.filterAdditionalGroup;
    setView("students");
    const filter = document.querySelector("#additional-group-filter");
    if (filter) filter.value = state.selectedAdditionalGroupId;
  }
  const filterClassGroupButton = event.target.closest("[data-filter-class-group]");
  if (filterClassGroupButton) {
    state.selectedClassGroupId = filterClassGroupButton.dataset.filterClassGroup;
    state.selectedSubgroupId = "";
    state.selectedAdditionalGroupId = "";
    setView("students");
    const filter = document.querySelector("#class-group-filter");
    if (filter) filter.value = state.selectedClassGroupId;
  }
  const studentButton = event.target.closest("[data-open-student]");
  if (studentButton) {
    state.selectedStudentId = studentButton.dataset.openStudent;
    state.selectedStudentSubjectId = null;
    state.selectedStudentLevelId = null;
    renderStudentDetail();
  }
  const studentSubjectButton = event.target.closest("[data-open-student-subject]");
  if (studentSubjectButton) {
    state.selectedStudentSubjectId = studentSubjectButton.dataset.openStudentSubject;
    state.selectedStudentLevelId = studentSubjectButton.dataset.studentLevelId;
    state.selectedSubjectId = state.selectedStudentSubjectId;
    renderStudentSubjectReport();
  }
  const competencyForm = event.target.closest("#competency-form");
  if (competencyForm) {
    const outcomes = competencyForm.querySelector("#competency-outcomes");
    if (event.target.closest("[data-add-outcome]")) {
      outcomes.insertAdjacentHTML("beforeend", competencyOutcomeMarkup({ id: makeId("ra"), name: "", description: "", criteria: [] }));
      outcomes.lastElementChild.querySelector("input").focus();
    }
    const addCriterion = event.target.closest("[data-add-criterion]");
    if (addCriterion) {
      const list = addCriterion.closest(".outcome-item").querySelector(".criteria-list");
      list.insertAdjacentHTML("beforeend", competencyCriterionMarkup({ id: makeId("ce"), text: "" }));
      list.lastElementChild.querySelector("input").focus();
    }
    const addTag = event.target.closest("[data-add-tag]");
    if (addTag) {
      const editor = addTag.closest(".tag-editor");
      const select = editor.querySelector("[data-tag-select]");
      const newInput = editor.querySelector("[data-tag-new]");
      const value = (newInput?.value.trim() || select.value);
      if (newInput) newInput.value = "";
      const list = editor.querySelector(".tag-list");
      const exists = [...list.querySelectorAll("input")].some(input => input.value === value);
      if (value && !exists) {
        list.insertAdjacentHTML("beforeend", competencyTagChip(editor.dataset.tagName, value));
        select.querySelector(`option[value="${CSS.escape(value)}"]`)?.remove();
      }
      select.value = "";
    }
    event.target.closest("[data-remove-tag]")?.closest(".tag-chip").remove();
    event.target.closest("[data-remove-criterion]")?.closest(".criterion-row").remove();
    event.target.closest("[data-remove-outcome]")?.closest(".outcome-item").remove();
    if (event.target.closest("[data-restore-competency]")) {
      const original = getBankCompetency(competencyForm.dataset.competencyId);
      const index = data.competencies.findIndex(item => item.id === competencyForm.dataset.competencyId);
      if (original && index >= 0) {
        const previousData = clone(data);
        data.competencies[index] = original;
        if (!saveData()) setData(previousData);
        render();
        showToast("Competència restaurada al valor del banc.");
      }
    }
    return;
  }
  if (event.target.closest('[data-back="competencies"]')) {
    state.selectedCompetencyId = null;
    render();
    return;
  }
  const backButton = event.target.closest("[data-back]");
  if (backButton) {
    if (backButton.dataset.back === "activity-detail") {
      state.currentView = "activities";
      document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === "activities"));
      document.querySelector("#current-section").textContent = "Activitats i proves";
    } else if (backButton.dataset.back === "activity-report") {
      state.currentView = state.activityReportReturnView || "activities";
      if (state.currentView === "students") state.selectedActivityId = null;
      else state.selectedStudentId = null;
      state.activityReportReturnView = null;
      document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === state.currentView));
      document.querySelector("#current-section").textContent = state.currentView === "students" ? "Alumnes" : "Activitats i proves";
    } else if (backButton.dataset.back === "activities") {
      state.selectedActivityId = null;
      state.selectedOfferingId = null;
      if (state.activityReturnToSequence) {
        state.activityReturnToSequence = false;
        state.currentView = "subjects";
        state.selectedSequence = true;
        document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === "subjects"));
        document.querySelector("#current-section").textContent = "Seqüència d'aprenentatge";
      }
    }
    if (backButton.dataset.back === "students") state.selectedStudentId = null;
    if (backButton.dataset.back === "students") {
      state.selectedStudentSubjectId = null;
      state.selectedStudentLevelId = null;
    }
    if (backButton.dataset.back === "student-subject") {
      state.selectedStudentSubjectId = null;
      state.selectedStudentLevelId = null;
      state.selectedSubjectId = null;
    }
    if (backButton.dataset.back === "level") state.selectedLevelId = null;
    if (backButton.dataset.back === "level") state.selectedSequence = false;
    if (backButton.dataset.back === "levels") {
      state.selectedLevelId = null;
      state.selectedSequence = false;
      document.querySelector("#current-section").textContent = "Assignatures";
    }
    if (backButton.dataset.back === "subjects") {
      state.selectedSubjectId = null;
      state.selectedLevelId = null;
      state.selectedSequence = false;
    }
    render();
  }
  if (event.target.closest("[data-close-dialog]")) dialog.close();
  const addStudentAdditionalGroupButton = event.target.closest("[data-add-student-additional-group]");
  const removeStudentAdditionalGroupButton = event.target.closest("[data-remove-student-additional-group]");
  if (addStudentAdditionalGroupButton || removeStudentAdditionalGroupButton) {
    const selectedIds = [...dialogContent.querySelectorAll('[name="additionalGroupIds"]')].map(input => input.value);
    if (addStudentAdditionalGroupButton) {
      const selectedId = dialogContent.querySelector("#student-additional-group-select").value;
      if (selectedId && !selectedIds.includes(selectedId)) selectedIds.push(selectedId);
    } else {
      const selectedId = removeStudentAdditionalGroupButton.dataset.removeStudentAdditionalGroup;
      const selectedIndex = selectedIds.indexOf(selectedId);
      if (selectedIndex >= 0) selectedIds.splice(selectedIndex, 1);
    }
    dialogContent.querySelector("#student-additional-groups").outerHTML = studentAdditionalGroupFields(selectedIds);
  }
  const addLevelCompetencyButton = event.target.closest("[data-add-level-competency]");
  const removeLevelCompetencyButton = event.target.closest("[data-remove-level-competency]");
  if (addLevelCompetencyButton || removeLevelCompetencyButton) {
    const selectedIds = selectedLevelCompetencyIds();
    if (addLevelCompetencyButton) {
      const selectedId = dialogContent.querySelector("#level-competency-select").value;
      if (selectedId && !selectedIds.includes(selectedId)) selectedIds.push(selectedId);
    } else {
      const selectedId = removeLevelCompetencyButton.dataset.removeLevelCompetency;
      const selectedIndex = selectedIds.indexOf(selectedId);
      if (selectedIndex >= 0) selectedIds.splice(selectedIndex, 1);
    }
    dialogContent.querySelector("#level-competencies").innerHTML = levelCompetencyFields(selectedIds);
  }
  if (event.target.closest("[data-add-sequence-situation]")) {
    const list = dialogContent.querySelector("#subject-sequence-list");
    list.insertAdjacentHTML("beforeend", subjectSequenceSituation(list.children.length));
  }
  if (event.target.closest("[data-add-situation-lecture-item]")) {
    const list = event.target.closest(".subject-sequence-situation").querySelector(".subject-sequence-activities");
    list.insertAdjacentHTML("beforeend", subjectSequenceItem(list.children.length, null, "lecture"));
  }
  if (event.target.closest("[data-add-situation-sequence-item]")) {
    const situation = event.target.closest(".subject-sequence-situation");
    const list = situation.querySelector(".subject-sequence-activities");
    list.insertAdjacentHTML("beforeend", subjectSequenceItem(list.children.length));
  }
  const moveSituationButton = event.target.closest("[data-move-situation]");
  if (moveSituationButton) {
    const situation = moveSituationButton.closest(".subject-sequence-situation");
    const direction = Number(moveSituationButton.dataset.moveSituation);
    if (direction < 0 && situation.previousElementSibling) listMoveBefore(situation, situation.previousElementSibling);
    if (direction > 0 && situation.nextElementSibling) listMoveBefore(situation.nextElementSibling, situation);
    dialogContent.querySelectorAll(".subject-sequence-situation").forEach((item, index) => {
      item.querySelector(".subject-sequence-situation-heading > strong").textContent = `Situació d'aprenentatge ${index + 1}`;
    });
  }
  const removeSituationButton = event.target.closest("[data-remove-situation]");
  if (removeSituationButton) {
    removeSituationButton.closest(".subject-sequence-situation").remove();
    dialogContent.querySelectorAll(".subject-sequence-situation").forEach((item, index) => {
      item.querySelector(".subject-sequence-situation-heading > strong").textContent = `Situació d'aprenentatge ${index + 1}`;
    });
  }
  const moveSequenceButton = event.target.closest("[data-move-sequence]");
  if (moveSequenceButton) {
    const item = moveSequenceButton.closest(".subject-sequence-item");
    const list = item.parentElement;
    const direction = Number(moveSequenceButton.dataset.moveSequence);
    if (direction < 0 && item.previousElementSibling) listMoveBefore(item, item.previousElementSibling);
    if (direction > 0 && item.nextElementSibling) listMoveBefore(item.nextElementSibling, item);
    list.querySelectorAll(".subject-sequence-item > .subject-sequence-heading > strong").forEach((label, index) => {
      label.textContent = `Element ${index + 1} · ${label.closest(".subject-sequence-item").dataset.sequenceKind === "lecture" ? "Classe" : "Activitat"}`;
    });
  }
  const removeSequenceItemButton = event.target.closest("[data-remove-sequence-item]");
  if (removeSequenceItemButton) {
    const item = removeSequenceItemButton.closest(".subject-sequence-item");
    const list = item.parentElement;
    item.remove();
    list.querySelectorAll(".subject-sequence-item > .subject-sequence-heading > strong").forEach((label, index) => {
      label.textContent = `Element ${index + 1} · ${label.closest(".subject-sequence-item").dataset.sequenceKind === "lecture" ? "Classe" : "Activitat"}`;
    });
  }
  if (event.target.closest("[data-add-rubric-evidence]")) {
    const body = document.querySelector("#activity-rubric-form tbody");
    const form = document.querySelector("#activity-rubric-form");
    const isTest = form.dataset.itemType === "Prova";
    body.querySelector(".rubric-empty-row")?.remove();
    const index = body.querySelectorAll("[data-rubric-evidence-row]").length;
    body.insertAdjacentHTML("beforeend", activityRubricEvidenceRowMarkup(index, null, makeId("row"), isTest));
    body.lastElementChild.querySelector('[name="rubricEvidenceName"]').focus();
  }
  const removeRubricEvidenceButton = event.target.closest("[data-remove-rubric-evidence]");
  if (removeRubricEvidenceButton) {
    const body = removeRubricEvidenceButton.closest("tbody");
    removeRubricEvidenceButton.closest("[data-rubric-evidence-row]").remove();
    if (!body.querySelector("[data-rubric-evidence-row]")) {
      const isTest = document.querySelector("#activity-rubric-form").dataset.itemType === "Prova";
      const config = getEvaluationConfig({ type: isTest ? "Prova" : "Activitat" });
      body.innerHTML = `<tr class="rubric-empty-row"><td colspan="${isTest ? 3 : 6}">Encara no hi ha ${config.itemLabelPlural}. Afegeix-ne una per començar el ${config.editorLabel}.</td></tr>`;
    }
    return;
  }
  const addRubricCompetencyButton = event.target.closest("[data-add-rubric-competency]");
  const removeRubricCompetencyButton = event.target.closest("[data-remove-rubric-competency]");
  if (addRubricCompetencyButton || removeRubricCompetencyButton) {
    const evidenceRow = (addRubricCompetencyButton || removeRubricCompetencyButton).closest("[data-rubric-evidence-row]");
    if (addRubricCompetencyButton) {
      const competencyId = evidenceRow.querySelector("[data-rubric-competency-select]").value;
      const competency = data.competencies.find(item => item.id === competencyId);
      if (!competency || evidenceRow.querySelector(`[name="rubricCompetencyId"][value="${CSS.escape(competencyId)}"]`)) {
        showToast("Selecciona una competència vàlida per afegir-la a l'evidència.", true);
        return;
      }
      const isTest = document.querySelector("#activity-rubric-form").dataset.itemType === "Prova";
      const evidence = { name: evidenceRow.querySelector('[name="rubricEvidenceName"]').value || (isTest ? "pregunta" : "evidència") };
      evidenceRow.querySelector("[data-rubric-competencies]").insertAdjacentHTML("beforeend", activityRubricCompetencyMarkup(evidence, competency, 100));
    } else {
      removeRubricCompetencyButton.closest("[data-rubric-competency-row]").remove();
    }
    const competencyList = evidenceRow.querySelector("[data-rubric-competencies]");
    const selectedIds = new Set([...competencyList.querySelectorAll('[name="rubricCompetencyId"]')].map(input => input.value));
    const selector = evidenceRow.querySelector("[data-rubric-competency-select]");
    const available = data.competencies.filter(competency => !selectedIds.has(competency.id));
    selector.innerHTML = available.map(competency => `<option value="${escapeHtml(competency.id)}">${escapeHtml(competency.name)}</option>`).join("") || '<option value="">Totes les competències afegides</option>';
    selector.disabled = !available.length;
    evidenceRow.querySelector("[data-add-rubric-competency]").disabled = !available.length;
    evidenceRow.querySelector(".evidence-competency-warning").hidden = selectedIds.size > 0;
  }
});

document.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".subject-record-card, .level-record-card, .activity-card")) {
    event.preventDefault();
    event.target.click();
  }
});

function listMoveBefore(item, reference) {
  reference.parentNode.insertBefore(item, reference);
}

dialogContent.addEventListener("change", event => {
  if (event.target.id === "teaching-offer-year") {
    const classGroupIds = [...dialogContent.querySelectorAll('[name="offerClassGroupIds"]:checked')].map(input => input.value);
    const additionalGroupIds = [...dialogContent.querySelectorAll('[name="offerAdditionalGroupIds"]:checked')].map(input => input.value);
    dialogContent.querySelector("#teaching-offer-groups").innerHTML =
      teachingOfferGroupFields(event.target.value, classGroupIds, additionalGroupIds);
    return;
  }
  if (event.target.id === "student-class-group") {
    const subgroupSelect = dialogContent.querySelector("#student-subgroup");
    subgroupSelect.innerHTML = subgroupOptions(event.target.value);
    subgroupSelect.disabled = !event.target.value;
    return;
  }
});

dialogForm.addEventListener("submit", event => {
  event.preventDefault();
  const formType = dialogForm.dataset.formType;
  const recordId = dialogForm.dataset.recordId;
  const formData = new FormData(dialogForm);
  if (formType === "activity-group-assessment-document") {
    const components = {
      self: formData.get("includeSelfAssessment") === "on",
      peers: formData.get("includePeerAssessment") === "on",
      teacher: formData.get("includeTeacherAssessment") === "on"
    };
    if (!Object.values(components).some(Boolean)) {
      showToast("Selecciona almenys un apartat per generar les fitxes.", true);
      return;
    }
    if (!openGroupAssessmentForms(components)) {
      showToast("No s'han pogut generar les fitxes. Comprova l'oferta docent i permet les finestres emergents.", true);
      return;
    }
    dialog.close();
    showToast("Fitxes d'avaluació generades. Pots imprimir-les o desar-les com a PDF.");
    return;
  }
  const previousData = clone(data);
  if (formType === "teacher-profile") {
    data.teacherProfile = {
      name: String(formData.get("name") || "").trim(),
      role: String(formData.get("role") || "").trim(),
      institution: String(formData.get("institution") || "").trim(),
      appearance: normalizeAppearance({ palette: formData.get("palette"), mode: formData.get("mode") })
    };
    state.currentView = "teacher-profile";
  }
  if (formType === "learning-situation") {
    const level = data.subjects.find(subject => subject.id === state.selectedSubjectId)?.levels.find(item => item.id === recordId);
    if (!level) {
      showToast("No s'ha trobat el nivell on vols afegir la situació.", true);
      return;
    }
    const name = String(formData.get("name") || "").trim();
    if (!name || name.length > 100) {
      showToast("Escriu un nom de situació d'aprenentatge de fins a 100 caràcters.", true);
      return;
    }
    if (level.situations.some(situation => situation.name.toLocaleLowerCase("ca") === name.toLocaleLowerCase("ca"))) {
      showToast("Ja existeix una situació d'aprenentatge amb aquest nom en aquest nivell.", true);
      return;
    }
    level.situations.push({ id: makeId("sit"), name, activities: [] });
    state.currentView = "subjects";
    state.selectedSequence = true;
  }
  if (formType === "activity-group") {
    const activity = data.activities.find(item => item.id === state.selectedActivityId);
    const name = String(formData.get("groupName") || "").trim();
    if (!activity || !name) {
      showToast("Indica un nom per a l'agrupament.", true);
      return;
    }
    if (activity.groups.some(item => item.id !== recordId && item.name.toLowerCase() === name.toLowerCase())) {
      showToast("Ja hi ha un agrupament amb aquest nom.", true);
      return;
    }
    const studentIds = formData.getAll("groupStudent").map(String);
    const group = recordId ? activity.groups.find(item => item.id === recordId) : null;
    if (group) {
      const offeringIds = new Set(data.teachingOffers.find(item => item.id === state.selectedOfferingId) ? getOfferingStudents(data, data.teachingOffers.find(item => item.id === state.selectedOfferingId)).map(student => student.id) : []);
      group.name = name;
      group.studentIds = [...group.studentIds.filter(id => !offeringIds.has(id)), ...studentIds];
    } else {
      activity.groups.push({ id: makeId("grp"), name, studentIds });
    }
  }
  if (formType === "sequence-lecture") {
    const level = data.subjects.find(subject => subject.id === state.selectedSubjectId)?.levels.find(item => item.id === recordId);
    const situation = level?.situations.find(item => item.id === dialogForm.dataset.situationId);
    const title = String(formData.get("sequenceTitle") || "").trim();
    const hours = Number(formData.get("sequenceHours"));
    if (!level || !situation) {
      showToast("No s'ha trobat la situació d'aprenentatge seleccionada.", true);
      return;
    }
    if (!title || !Number.isFinite(hours) || hours <= 0) {
      showToast("Revisa el títol i les hores de la classe.", true);
      return;
    }
    situation.activities.push({ id: makeId("seq"), kind: "lecture", title, hours });
    state.currentView = "subjects";
    state.selectedSequence = true;
  }
  if (formType === "sequence-activity") {
    const level = data.subjects.find(subject => subject.id === state.selectedSubjectId)?.levels.find(item => item.id === recordId);
    const activityId = String(formData.get("sequenceActivityId") || "");
    const activity = data.activities.find(item => item.id === activityId);
    const situationId = dialogForm.dataset.situationId;
    const situation = level?.situations.find(item => item.id === situationId);
    const hours = Number(formData.get("sequenceHours"));
    if (!level || !situation) {
      showToast("No s'ha trobat la situació d'aprenentatge seleccionada.", true);
      return;
    }
    if (!activity || getSequenceActivities(level).some(item => item.activityId === activityId) || !Number.isFinite(hours) || hours <= 0) {
      showToast("Revisa l'activitat i les hores.", true);
      return;
    }
    situation.activities.push({
      id: makeId("seq"),
      activityId,
      hours
    });
    state.currentView = "subjects";
    state.selectedSequence = true;
  }
  if (formType === "student" || formType === "edit-student") {
    const student = formType === "edit-student" ? data.students.find(item => item.id === recordId) : null;
    if (formType === "edit-student" && !student) {
      showToast("No s'ha trobat l'alumne que vols editar.", true);
      return;
    }
    const classGroupId = String(formData.get("classGroupId") || "");
    const subgroupId = String(formData.get("subgroupId") || "");
    const additionalGroupIds = formData.getAll("additionalGroupIds").map(String);
    if (classGroupId && !getClassGroup(classGroupId) || subgroupId && !getClassGroup(classGroupId)?.subgroups.some(item => item.id === subgroupId)) {
      showToast("Selecciona un grup classe i un desdoblament vàlids.", true);
      return;
    }
    if (additionalGroupIds.some(id => !data.additionalGroups.some(group => group.id === id)) ||
      new Set(additionalGroupIds).size !== additionalGroupIds.length) {
      showToast("Selecciona grups addicionals vàlids.", true);
      return;
    }
    const firstName = String(formData.get("firstName")).trim();
    const lastName = String(formData.get("lastName")).trim();
    if (!firstName || !lastName) {
      showToast("Escriu els noms i els cognoms de l'alumne.", true);
      return;
    }
    if (classGroupId && getClassGroup(classGroupId)?.academicYearId !== data.currentAcademicYearId) {
      showToast("Assigna l'alumne a un grup del curs acadèmic vigent.", true);
      return;
    }
    const updatedStudent = student || {
      id: makeId("al"),
      firstName,
      lastName,
      academicYearId: data.currentAcademicYearId,
      classGroupId,
      subgroupId,
      additionalGroupIds,
      enrollments: []
    };
    Object.assign(updatedStudent, { firstName, lastName, academicYearId: data.currentAcademicYearId, classGroupId, subgroupId, additionalGroupIds });
    const enrollment = updatedStudent.enrollments.find(item => item.academicYearId === data.currentAcademicYearId);
    const currentEnrollment = { academicYearId: data.currentAcademicYearId, classGroupId, subgroupId, additionalGroupIds };
    if (enrollment) Object.assign(enrollment, currentEnrollment);
    else updatedStudent.enrollments.push(currentEnrollment);
    if (!student) data.students.push(updatedStudent);
    if (formType === "student") state.studentQuery = "";
  }
  if (formType === "class-group" || formType === "edit-class-group") {
    const classGroup = formType === "edit-class-group" ? getClassGroup(recordId) : null;
    if (formType === "edit-class-group" && !classGroup) {
      showToast("No s'ha trobat el grup classe que vols editar.", true);
      return;
    }
    const name = String(formData.get("name")).trim();
    const academicYearId = String(formData.get("academicYearId") || "");
    if (!data.academicYears.some(year => year.id === academicYearId)) {
      showToast("Selecciona un curs acadèmic vàlid.", true);
      return;
    }
    if (classGroup && classGroup.academicYearId !== academicYearId &&
      (data.students.some(student => student.enrollments.some(enrollment => enrollment.classGroupId === classGroup.id)) ||
        data.teachingOffers.some(offer => offer.classGroupIds.includes(classGroup.id)))) {
      showToast("No pots canviar de curs un grup amb matrícules o historial d'ofertes; crea'n un de nou per al curs corresponent.", true);
      return;
    }
    const duplicateName = data.classGroups.some(item => item.id !== classGroup?.id &&
      item.academicYearId === academicYearId &&
      item.name.trim().toLocaleLowerCase("ca") === name.toLocaleLowerCase("ca"));
    if (duplicateName) {
      showToast("Ja existeix un grup classe amb aquest nom.", true);
      return;
    }
    const subgroupNames = String(formData.get("subgroups") || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
    const normalizedNames = subgroupNames.map(item => item.toLocaleLowerCase("ca"));
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      showToast("No repeteixis el nom d'un desdoblament.", true);
      return;
    }
    const previousSubgroups = classGroup?.subgroups || [];
    const subgroups = subgroupNames.map(subgroupName => {
      const existing = previousSubgroups.find(item => item.name.trim().toLocaleLowerCase("ca") === subgroupName.toLocaleLowerCase("ca"));
      return { id: existing?.id || makeId("sg"), name: subgroupName };
    });
    const classGroupId = classGroup?.id || makeId("gc");
    if (classGroup) {
      Object.assign(classGroup, { name, subgroups, academicYearId });
      const subgroupIds = new Set(subgroups.map(subgroup => subgroup.id));
      for (const student of data.students) {
        if (student.classGroupId === classGroupId && student.subgroupId && !subgroupIds.has(student.subgroupId)) student.subgroupId = "";
        for (const enrollment of student.enrollments) {
          if (enrollment.classGroupId === classGroupId && enrollment.subgroupId && !subgroupIds.has(enrollment.subgroupId)) enrollment.subgroupId = "";
        }
      }
    } else {
      data.classGroups.push({ id: classGroupId, name, subgroups, academicYearId });
    }
  }
  if (formType === "academic-year") {
    const name = String(formData.get("name") || "").trim();
    if (!name || data.academicYears.some(year => year.name.toLocaleLowerCase("ca") === name.toLocaleLowerCase("ca"))) {
      showToast("Escriu un nom vàlid que no estigui assignat a un altre curs acadèmic.", true);
      return;
    }
    const academicYear = { id: makeId("curs"), name, isCurrent: formData.get("isCurrent") === "on" };
    data.academicYears.push(academicYear);
    if (academicYear.isCurrent) setCurrentAcademicYear(academicYear.id);
  }
  if (formType === "additional-group" || formType === "edit-additional-group") {
    const group = formType === "edit-additional-group" ? data.additionalGroups.find(item => item.id === recordId) : null;
    if (formType === "edit-additional-group" && !group) {
      showToast("No s'ha trobat el grup addicional que vols editar.", true);
      return;
    }
    const name = String(formData.get("name") || "").trim();
    if (!name) {
      showToast("Escriu el nom del grup addicional.", true);
      return;
    }
    if (data.additionalGroups.some(item => item.id !== group?.id && item.name.trim().toLocaleLowerCase("ca") === name.toLocaleLowerCase("ca"))) {
      showToast("Ja existeix un grup addicional amb aquest nom.", true);
      return;
    }
    if (group) group.name = name;
    else data.additionalGroups.push({ id: makeId("ga"), name });
  }
  if (formType === "subject" || formType === "edit-subject") {
    const subject = formType === "edit-subject" ? data.subjects.find(item => item.id === recordId) : null;
    if (formType === "edit-subject" && !subject) {
      showToast("No s'ha trobat l'assignatura que vols editar.", true);
      return;
    }
    const name = String(formData.get("name")).trim();
    const duplicateName = data.subjects.some(item => item.id !== subject?.id && item.name.trim().toLocaleLowerCase("ca") === name.toLocaleLowerCase("ca"));
    if (duplicateName) {
      showToast("Ja existeix una assignatura amb aquest nom.", true);
      return;
    }
    const subjectId = subject?.id || makeId("as");
    const updatedSubject = {
      id: subjectId,
      name,
      description: String(formData.get("description") || "").trim(),
      levels: subject?.levels || []
    };
    if (subject) Object.assign(subject, updatedSubject);
    else data.subjects.push(updatedSubject);
    state.selectedSubjectId = subjectId;
    state.selectedLevelId = null;
    state.currentView = "subjects";
  }
  if (formType === "teaching-offer") {
    const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
    const level = subject?.levels.find(item => item.id === state.selectedLevelId);
    const existing = recordId ? data.teachingOffers.find(item => item.id === recordId) : null;
    const academicYearId = String(formData.get("academicYearId") || "");
    const classGroupIds = [...new Set(formData.getAll("offerClassGroupIds").map(String))];
    const additionalGroupIds = [...new Set(formData.getAll("offerAdditionalGroupIds").map(String))];
    if (!subject || !level || recordId && !existing ||
      !data.academicYears.some(year => year.id === academicYearId) ||
      classGroupIds.some(id => !data.classGroups.some(group => group.id === id && group.academicYearId === academicYearId)) ||
      additionalGroupIds.some(id => !data.additionalGroups.some(group => group.id === id)) ||
      !classGroupIds.length && !additionalGroupIds.length) {
      showToast("Selecciona un curs i almenys un grup vàlids per a l'oferta docent.", true);
      return;
    }
    if (data.teachingOffers.some(offer => offer.id !== existing?.id &&
      offer.subjectId === subject.id && offer.levelId === level.id && offer.academicYearId === academicYearId)) {
      showToast("Ja existeix una oferta per a aquest nivell i curs acadèmic.", true);
      return;
    }
    const updatedOffer = existing || {
      id: makeId("oferta"),
      subjectId: subject.id,
      levelId: level.id,
      academicYearId,
      classGroupIds: [],
      additionalGroupIds: [],
      studentIds: [],
      status: "active"
    };
    const currentStudents = getOfferingStudents(data, { ...updatedOffer, academicYearId, classGroupIds, additionalGroupIds });
    Object.assign(updatedOffer, {
      academicYearId,
      classGroupIds,
      additionalGroupIds,
      studentIds: [...new Set([...updatedOffer.studentIds, ...currentStudents.map(student => student.id)])],
      status: "active"
    });
    if (!existing) data.teachingOffers.push(updatedOffer);
  }
  if (formType === "level" || formType === "edit-level") {
    const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
    const level = formType === "edit-level" ? subject?.levels.find(item => item.id === recordId) : null;
    if (!subject || formType === "edit-level" && !level) {
      showToast("No s'ha trobat l'assignatura o el nivell que vols editar.", true);
      return;
    }
    const name = String(formData.get("name") || "");
    if (!EDUCATIONAL_LEVELS.some(stage => stage.levels.includes(name))) {
      showToast("Selecciona un nivell d'ESO o batxillerat vàlid.", true);
      return;
    }
    if (subject.levels.some(item => item.id !== level?.id && item.name === name)) {
      showToast("Aquest nivell ja existeix en aquesta assignatura.", true);
      return;
    }
    const competencyIds = [...new Set(formData.getAll("levelCompetencyId").map(String))];
    if (competencyIds.some(id => !data.competencies.some(competency => competency.id === id))) {
      showToast("Selecciona competències vàlides per a aquest nivell.", true);
      return;
    }
    const existingSituations = new Map((level?.situations || []).map(situation => [situation.id, situation]));
    const existingItems = new Map(getSequenceItems(level || { situations: [] }).map(item => [item.id, item]));
    const situations = [...dialogContent.querySelectorAll(".subject-sequence-situation")].map(situationElement => ({
      requestedId: situationElement.querySelector('[name="sequenceSituationId"]').value,
      name: situationElement.querySelector('[name="sequenceSituationName"]').value.trim(),
      activities: [...situationElement.querySelectorAll(".subject-sequence-item")].map(sequenceItem => ({
        requestedId: sequenceItem.querySelector('[name="sequenceItemId"]').value,
        kind: sequenceItem.dataset.sequenceKind,
        title: sequenceItem.querySelector('[name="sequenceTitle"]')?.value.trim() || "",
        activityId: sequenceItem.querySelector('[name="sequenceActivityId"]')?.value || "",
        hours: Number(sequenceItem.querySelector('[name="sequenceHours"]').value)
      }))
    }));
    const situationNames = situations.map(situation => situation.name.toLocaleLowerCase("ca"));
    const sequenceItems = situations.flatMap(situation => situation.activities);
    const activityItems = sequenceItems.filter(item => item.kind !== "lecture");
    if (situations.some(situation => !situation.name || situation.name.length > 100) ||
      new Set(situationNames).size !== situationNames.length ||
      sequenceItems.some(item => item.kind === "lecture" ? !item.title : !data.activities.some(activity => activity.id === item.activityId)) ||
      sequenceItems.some(item => !Number.isFinite(item.hours) || item.hours <= 0)) {
      showToast("Revisa els noms de les situacions, les activitats i les hores.", true);
      return;
    }
    if (new Set(activityItems.map(item => item.activityId)).size !== activityItems.length) {
      showToast("No repeteixis una activitat a la seqüència d'aquest nivell.", true);
      return;
    }
    const updatedSituations = situations.map(situation => {
      const existing = existingSituations.get(situation.requestedId);
      return {
        id: existing?.id || makeId("sit"),
        name: situation.name,
        activities: situation.activities.map(item => {
          const existingItem = existingItems.get(item.requestedId);
          const id = existingItem?.id || makeId("seq");
          return item.kind === "lecture"
            ? { id, kind: "lecture", title: item.title, hours: item.hours }
            : { id, activityId: item.activityId, hours: item.hours };
        })
      };
    });
    const updatedLevel = { id: level?.id || makeId("niv"), name, competencyIds, situations: updatedSituations };
    if (level) Object.assign(level, updatedLevel);
    else subject.levels.push(updatedLevel);
    state.selectedLevelId = updatedLevel.id;
    state.currentView = "subjects";
    state.selectedSequence = formType === "edit-level" && dialogForm.dataset.returnToSequence === "true";
  }
  if (formType === "competency") {
    const competency = { id: makeId("co"), name: String(formData.get("name")).trim(), description: String(formData.get("description")).trim(), learningOutcomes: [], educationalLevels: [], subjects: [] };
    data.competencies.push(competency);
    state.selectedCompetencyId = competency.id;
    state.currentView = "competencies";
  }
  if (formType === "activity" || formType === "edit-activity") {
    const activity = formType === "edit-activity" ? data.activities.find(item => item.id === recordId) : null;
    if (formType === "edit-activity" && !activity) {
      showToast("No s'ha trobat l'activitat que vols editar.", true);
      return;
    }
    const activityId = activity?.id || makeId("ac");
    const type = String(formData.get("type"));
    if (activity) convertEvaluationItems(activity, type);
    const updatedActivity = {
      id: activityId,
      title: String(formData.get("title")).trim(),
      type,
      date: String(formData.get("date") || ""),
      isGroup: formData.get("isGroup") === "on",
      groups: activity?.groups || [],
      groupGrading: activity?.groupGrading || "individual",
      [type === "Prova" ? "questions" : "evidences"]: activity ? getEvaluationItems(activity) : []
    };
    if (activity) Object.assign(activity, updatedActivity);
    else data.activities.push(updatedActivity);
    state.selectedActivityId = activityId;
    state.currentView = activity ? "activities" : "activity-rubric";
  }
  if (!saveData()) {
    setData(previousData);
    render();
    return;
  }
  dialog.close();
  render();
  const messages = {
    student: "Alumne afegit.",
    "edit-student": "Perfil de l'alumne actualitzat.",
    "class-group": "Grup classe creat.",
    "edit-class-group": "Grup classe actualitzat.",
    "academic-year": "Curs acadèmic creat.",
    "additional-group": "Grup addicional creat.",
    "edit-additional-group": "Grup addicional actualitzat.",
    subject: "Assignatura creada.",
    "edit-subject": "Assignatura actualitzada.",
    level: "Nivell afegit.",
    "edit-level": "Nivell actualitzat.",
    "learning-situation": "Situació d'aprenentatge afegida.",
    "sequence-activity": "Activitat afegida a la situació d'aprenentatge.",
    "sequence-lecture": "Classe afegida a la situació d'aprenentatge.",
    competency: "Competència creada.",
    activity: "Element avaluable creat. Defineix-ne ara els ítems.",
    "edit-activity": "Element avaluable actualitzat.",
    "teacher-profile": "Perfil docent actualitzat."
  };
  showToast(messages[formType]);
});

content.addEventListener("submit", event => {
  const rubricForm = event.target.closest("#activity-rubric-form");
  if (rubricForm) {
    event.preventDefault();
    if (!rubricForm.reportValidity()) return;
    const activity = data.activities.find(item => item.id === rubricForm.dataset.activityId);
    if (!activity) {
      showToast("No s'ha trobat l'activitat que vols editar.", true);
      return;
    }
    const isTest = activity.type === "Prova";
    const evidenceRows = [...rubricForm.querySelectorAll("[data-rubric-evidence-row]")];
    const evidenceItems = evidenceRows.map(row => {
      const contributions = Object.fromEntries([...row.querySelectorAll("[data-rubric-competency-row]")].map(competencyRow => [
        competencyRow.querySelector('[name="rubricCompetencyId"]').value,
        Number(competencyRow.querySelector('[name="rubricCompetencyWeight"]').value)
      ]));
      const item = {
        id: row.querySelector('[name="rubricEvidenceId"]').value,
        name: String(row.querySelector('[name="rubricEvidenceName"]').value).trim(),
        contributions
      };
      if (isTest) {
        item.answerKey = String(row.querySelector('[name="rubricAnswerKey"]').value).trim();
      } else {
        item.descriptors = Object.fromEntries(["1", "2", "3", "4"].map(level => [
          level, String(row.querySelector(`[name="rubricDescriptor${level}"]`).value).trim()
        ]));
      }
      return item;
    });
    const unlinkedEvidence = evidenceItems.find(evidence => !Object.keys(evidence.contributions).length);
    if (unlinkedEvidence) {
      const row = evidenceRows[evidenceItems.indexOf(unlinkedEvidence)];
      row.querySelector(".evidence-competency-warning").hidden = false;
      row.scrollIntoView({ block: "center" });
      showToast(`L'evidència «${unlinkedEvidence.name || "sense nom"}» necessita almenys una competència.`, "warning");
      return;
    }
    const invalidEvidence = evidenceItems.find(evidence =>
      Object.entries(evidence.contributions).some(([competencyId, weight]) =>
        !data.competencies.some(competency => competency.id === competencyId) ||
        !Number.isFinite(weight) || weight <= 0 || weight > 100
      )
    );
    if (invalidEvidence) {
      showToast("Revisa les competències i els pesos de les evidències.", true);
      return;
    }
    const previousData = clone(data);
    const oldItems = getEvaluationItems(activity);
    const oldEvidenceIds = new Set(oldItems.map(evidence => evidence.id));
    const retainedEvidenceIds = new Set();
    const updatedItems = evidenceItems.map(evidence => {
      const id = oldEvidenceIds.has(evidence.id) && !retainedEvidenceIds.has(evidence.id) ? evidence.id : makeId("ev");
      retainedEvidenceIds.add(id);
      const previousItem = oldItems.find(item => item.id === id);
      return {
        ...previousItem,
        ...evidence,
        id
      };
    });
    if (isTest) {
      activity.questions = updatedItems;
      delete activity.evidences;
    } else {
      activity.evidences = updatedItems;
      delete activity.questions;
    }
    for (const snapshots of Object.values(activity.conversionData || {})) {
      if (!snapshots || typeof snapshots !== "object") continue;
      for (const itemId of Object.keys(snapshots)) {
        if (!retainedEvidenceIds.has(itemId)) delete snapshots[itemId];
      }
    }
    for (const assessment of data.assessments.filter(item => item.activityId === activity.id)) {
      for (const evidenceId of oldEvidenceIds) {
        if (!retainedEvidenceIds.has(evidenceId)) delete assessment.levels[evidenceId];
      }
    }
    if (!saveData()) {
      setData(previousData);
      renderActivityRubric();
      return;
    }
    state.currentView = "activities";
    renderActivityDetail();
    window.scrollTo(0, 0);
    showToast(`${getEvaluationConfig(activity).editorLabel[0].toLocaleUpperCase("ca")}${getEvaluationConfig(activity).editorLabel.slice(1)} desat.`);
    return;
  }
  const form = event.target.closest("#competency-form");
  if (!form) return;
  event.preventDefault();
  const competency = data.competencies.find(item => item.id === form.dataset.competencyId);
  if (!competency) return;
  const previousData = clone(data);
  const field = (root, name) => String(root.querySelector(`[name="${name}"]`).value).trim();
  const learningOutcomes = [...form.querySelectorAll(".outcome-item")].map(item => ({
    id: item.dataset.outcomeId,
    name: field(item, "outcomeName"),
    description: field(item, "outcomeDescription"),
    criteria: [...item.querySelectorAll(".criterion-row")].map(row => ({ id: row.dataset.criterionId, text: field(row, "criterionText") }))
  }));
  const educationalLevels = [...form.querySelectorAll('[name="educationalLevel"]')].map(input => input.value);
  const subjects = [...form.querySelectorAll('[name="subject"]')].map(input => input.value);
  Object.assign(competency, { name: field(form, "name"), description: field(form, "description"), educationalLevels, subjects, learningOutcomes });
  if (!saveData()) {
    setData(previousData);
    return;
  }
  render();
  showToast("Competència actualitzada.");
});

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

content.addEventListener("change", event => {
  const activityFeedback = event.target.closest("[data-activity-feedback]");
  if (activityFeedback) {
    const activityId = activityFeedback.dataset.activityId;
    const studentId = activityFeedback.dataset.studentId;
    const offeringId = activityFeedback.dataset.offeringId;
    const feedback = activityFeedback.value.trim();
    const previousData = clone(data);
    const activity = data.activities.find(item => item.id === activityId);
    const student = data.students.find(item => item.id === studentId);
    const offering = offeringId ? data.teachingOffers.find(item => item.id === offeringId) : null;
    if (!activity || !student || offeringId && (!offering ||
      !getActivityOffers(data, activityId).some(item => item.id === offeringId) ||
      !getOfferingStudents(data, offering).some(item => item.id === studentId))) {
      showToast("No s'ha pogut desar la retroacció: l'alumne, l'activitat o l'oferta ja no són vàlids.", true);
      render();
      return;
    }
    let assessment = data.assessments.find(item =>
      item.studentId === studentId && item.activityId === activityId &&
      (offeringId ? item.offeringId === offeringId : !item.offeringId)
    );
    if (!assessment && feedback) {
      assessment = { studentId, activityId, ...(offeringId ? { offeringId } : {}), levels: {}, feedback };
      data.assessments.push(assessment);
    } else if (assessment) {
      if (feedback) assessment.feedback = feedback;
      else delete assessment.feedback;
      if (!Object.keys(assessment.levels).length && !assessment.feedback && !assessment.recovered) {
        data.assessments = data.assessments.filter(item => item !== assessment);
      }
    }
    if (!saveData()) {
      setData(previousData);
      renderActivityStudentReport();
      return;
    }
    showToast("Retroacció desada per a l'alumne.");
    return;
  }
  const currentYearSelect = event.target.closest("[data-current-year]");
  if (currentYearSelect) {
    const previousData = clone(data);
    try {
      setCurrentAcademicYear(currentYearSelect.value);
    } catch (error) {
      showToast(`No s'ha pogut canviar el curs vigent: ${error.message}`, true);
      render();
      return;
    }
    if (!saveData()) setData(previousData);
    render();
    return;
  }
  const offeringSelect = event.target.closest("[data-select-offering]");
  if (offeringSelect) {
    state.selectedOfferingId = offeringSelect.value || null;
    const selectedOffering = data.teachingOffers.find(offer => offer.id === state.selectedOfferingId);
    state.selectedSubjectId = selectedOffering?.subjectId || null;
    state.selectedLevelId = selectedOffering?.levelId || null;
    renderActivityDetail();
    return;
  }
  const subjectExemption = event.target.closest("[data-subject-exemption]");
  if (subjectExemption) {
    const subjectId = subjectExemption.dataset.subjectExemption;
    const studentId = subjectExemption.dataset.studentId;
    const previousData = clone(data);
    if (!data.subjects.some(subject => subject.id === subjectId) || !data.students.some(student => student.id === studentId)) {
      showToast("No s'ha pogut desar l'exempció d'assignatura: l'alumne o l'assignatura ja no existeix.", true);
      render();
      return;
    }
    data.subjectExemptions = data.subjectExemptions.filter(item => item.subjectId !== subjectId || item.studentId !== studentId);
    if (subjectExemption.checked) data.subjectExemptions.push({ subjectId, studentId });
    if (!saveData()) {
      setData(previousData);
      render();
      return;
    }
    render();
    showToast(subjectExemption.checked ? "S'ha desat l'exempció de l'assignatura." : "S'ha retirat l'exempció de l'assignatura.");
    return;
  }
  const activityExemption = event.target.closest("[data-activity-exemption]");
  if (activityExemption) {
    const activityId = activityExemption.dataset.activityExemption;
    const studentId = activityExemption.dataset.studentId;
    const previousData = clone(data);
    if (!data.activities.some(activity => activity.id === activityId) || !data.students.some(student => student.id === studentId)) {
      showToast("No s'ha pogut desar l'exempció d'activitat: l'alumne o l'activitat ja no existeix.", true);
      render();
      return;
    }
    data.activityExemptions = data.activityExemptions.filter(item => item.activityId !== activityId || item.studentId !== studentId);
    if (activityExemption.checked) data.activityExemptions.push({ activityId, studentId });
    if (!saveData()) {
      setData(previousData);
      render();
      return;
    }
    render();
    showToast(activityExemption.checked ? "S'ha desat l'exempció de l'activitat." : "S'ha retirat l'exempció de l'activitat.");
    return;
  }
  const subjectFilter = event.target.closest("#daily-subject-filter");
  if (subjectFilter) {
    state.dailySelectedSubjectId = subjectFilter.value;
    state.dailySelectedClassGroupId = "";
    state.dailySelectedAdditionalGroupId = "";
    render();
    return;
  }
  const dateFilter = event.target.closest("#daily-date-filter");
  if (dateFilter) {
    state.dailySelectedDate = dateFilter.value;
    render();
    return;
  }
  const groupFilter = event.target.closest("#daily-group-filter");
  if (groupFilter) {
    state.dailySelectedClassGroupId = groupFilter.value;
    state.dailySelectedSubgroupId = "";
    render();
    return;
  }
  const dailySort = event.target.closest("#daily-student-sort");
  if (dailySort) {
    state.studentSort = dailySort.value;
    render();
    return;
  }
  const additionalGroupFilter = event.target.closest("#daily-additional-group-filter");
  if (additionalGroupFilter) {
    state.dailySelectedAdditionalGroupId = additionalGroupFilter.value;
    render();
    return;
  }
  const subgroupFilter = event.target.closest("#daily-subgroup-filter");
  if (subgroupFilter) {
    state.dailySelectedSubgroupId = subgroupFilter.value;
    render();
    return;
  }
  const dailySelect = event.target.closest("[data-daily-assessment]");
  const dailyNote = event.target.closest("[data-daily-note]");
  const dailyAbsent = event.target.closest("[data-daily-absent]");
  if (dailySelect || dailyNote || dailyAbsent) {
    const studentId = (dailySelect || dailyNote || dailyAbsent).dataset.studentId;
    if (isStudentExemptFromSubject(data, studentId, state.dailySelectedSubjectId)) {
      showToast("Aquest alumne està exempt de l'assignatura.", true);
      render();
      return;
    }
    const previousDailyAssessments = clone(data.dailyAssessments);
    let assessment = data.dailyAssessments.find(item =>
      item.subjectId === state.dailySelectedSubjectId &&
      item.studentId === studentId &&
      item.date === state.dailySelectedDate
    );
    if (!assessment) {
      assessment = {
        subjectId: state.dailySelectedSubjectId,
        studentId,
        date: state.dailySelectedDate,
        levels: {},
        note: ""
      };
      data.dailyAssessments.push(assessment);
    }
    if (dailyAbsent) {
      assessment.absent = dailyAbsent.checked;
      if (assessment.absent) assessment.levels = {};
      else delete assessment.absent;
    } else if (dailySelect) {
      if (assessment.absent) {
        data.dailyAssessments = previousDailyAssessments;
        render();
        return;
      }
      const criterionId = dailySelect.dataset.criterionId;
      if (!DAILY_FOLLOWUP_CRITERIA.some(criterion => criterion.id === criterionId)) {
        showToast("No s'ha pogut desar un indicador de seguiment desconegut.", true);
        data.dailyAssessments = previousDailyAssessments;
        render();
        return;
      }
      if (dailySelect.value) assessment.levels[criterionId] = Number(dailySelect.value);
      else delete assessment.levels[criterionId];
    } else {
      assessment.note = dailyNote.value.trim();
    }
    if (!Object.keys(assessment.levels).length && !assessment.note && !assessment.absent) {
      data.dailyAssessments = data.dailyAssessments.filter(item => item !== assessment);
    }
    if (!saveData()) {
      data.dailyAssessments = previousDailyAssessments;
      render();
      return;
    }
    if (dailyAbsent) {
      render();
      return;
    }
    const rows = [...content.querySelectorAll(".daily-followup-table tbody tr")];
    const observedRows = rows.filter(row => [...row.querySelectorAll("[data-daily-assessment]")].some(select => select.value));
    const observedLevels = rows.flatMap(row =>
      [...row.querySelectorAll("[data-daily-assessment]")].map(select => Number(select.value)).filter(level => level > 0)
    );
    const average = observedLevels.length
      ? observedLevels.reduce((total, level) => total + level, 0) / observedLevels.length
      : null;
    content.querySelector("#daily-observed-count").textContent = String(observedRows.length);
    content.querySelector("#daily-average").innerHTML = average === null
      ? "—"
      : `${average.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<small> / 4</small>`;
    if (dailySelect) dailySelect.className = `grade-select ${gradeColorClass(dailySelect.value ? SCORE_BY_LEVEL[Number(dailySelect.value)] : null)}`;
    return;
  }
  const recoveredToggle = event.target.closest("[data-activity-recovered]");
  if (recoveredToggle) {
    const studentId = recoveredToggle.dataset.studentId;
    const activity = data.activities.find(item => item.id === state.selectedActivityId);
    const offering = data.teachingOffers.find(item => item.id === state.selectedOfferingId);
    if (!activity || !offering || offering.status !== "active" || offering.academicYearId !== data.currentAcademicYearId ||
      !getOfferingStudents(data, offering).some(student => student.id === studentId)) {
      showToast("No es pot modificar aquest alumne: l'activitat no està assignada a una oferta vigent o l'alumne no hi està matriculat.", true);
      renderActivityDetail();
      return;
    }
    const previousData = clone(data);
    let assessment = data.assessments.find(item =>
      item.studentId === studentId && item.activityId === activity.id && item.offeringId === offering.id
    );
    if (recoveredToggle.checked) {
      if (!assessment) {
        assessment = { studentId, activityId: activity.id, offeringId: offering.id, levels: {} };
        data.assessments.push(assessment);
      }
      assessment.recovered = true;
    } else if (assessment) {
      delete assessment.recovered;
      if (!Object.keys(assessment.levels).length && !assessment.feedback) {
        data.assessments = data.assessments.filter(item => item !== assessment);
      }
    }
    if (!saveData()) {
      setData(previousData);
      renderActivityDetail();
      return;
    }
    updateActivityAssessmentRow(studentId, calculateActivityGrade(data, studentId, activity, offering.subjectId, offering.id));
    refreshActivityGroups(studentId);
    showToast(recoveredToggle.checked ? "Activitat marcada com a recuperada: la nota no pot superar 5." : "Recuperació desmarcada.");
    return;
  }
  const select = event.target.closest("[data-assess-student][data-evidence]");
  if (!select) return;
  const studentId = select.dataset.assessStudent;
  const evidenceId = select.dataset.evidence;
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity) return;
  const offering = data.teachingOffers.find(item => item.id === state.selectedOfferingId);
  if (!offering || offering.status !== "active" || offering.academicYearId !== data.currentAcademicYearId ||
    !getActivityOffers(data, activity.id).some(item => item.id === offering.id) ||
    !getOfferingStudents(data, offering).some(student => student.id === studentId)) {
    showToast("No es pot avaluar aquest alumne: l'activitat no està assignada a una oferta vigent o l'alumne no hi està matriculat.", true);
    renderActivityDetail();
    return;
  }
  const previousData = clone(data);
  let assessment = data.assessments.find(item =>
    item.studentId === studentId && item.activityId === activity.id && item.offeringId === offering.id
  );
  if (!assessment) {
    assessment = { studentId, activityId: activity.id, offeringId: offering.id, levels: {} };
    data.assessments.push(assessment);
  }
  if (!offering.studentIds.includes(studentId)) offering.studentIds.push(studentId);
  assessment.levels[evidenceId] = Number(select.value);
  if (!saveData()) {
    setData(previousData);
    renderActivityDetail();
    return;
  }
  const selectedLevel = Number(select.value);
  select.className = `grade-select ${gradeColorClass(selectedLevel ? SCORE_BY_LEVEL[selectedLevel] : null)}`;
  const activityGrade = calculateActivityGrade(data, studentId, activity, offering.subjectId, offering.id);
  updateActivityAssessmentRow(studentId, activityGrade);
  refreshActivityGroups(studentId);
  showToast("Avaluació desada. Les notes competencials s'han actualitzat.");
});

for (const eventType of ["click", "submit", "change", "input"]) {
  document.addEventListener(eventType, syncNavigation);
}
initializeNavigation(render, dialog, showToast);
startIconDecorator();
cloud = createCloud({
  readLocal: loadData,
  validate: value => validateData(clone(value)),
  serialize: value => clone(withoutUnmodifiedBank(value)),
  applyData: value => {
    if (dialog.open) dialog.close();
    setData(value);
    setView("overview");
    syncNavigation();
  },
  notify: showToast
});
cloud.start();
