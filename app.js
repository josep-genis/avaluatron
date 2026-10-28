import { clone, DAILY_FOLLOWUP_CRITERIA, validateData as validateStoredData } from "./js/data.js";
import { data, state, setData } from "./js/state.js";
import {
  setView, render, getClassGroup, classGroupOptions, subgroupOptions,
  renderClassGroups, renderSubjectDetail, renderLevelDetail, renderLevelSequence, renderActivityDetail, renderStudentDetail, studentDisplayName,
  updateActivityAssessmentRow
} from "./js/views.js";
import {
  SCORE_BY_LEVEL, getAssessment as calculateAssessment, getActivityGrade as calculateActivityGrade
} from "./js/grades.js";
import { sampleData } from "./js/sample-data.js";
import { escapeHtml, icon, formatDate, gradeColorClass } from "./js/formatting.js";
import { EDUCATIONAL_LEVELS } from "./js/education.js";
import { loadFromDrive, saveToDrive } from "./js/drive.js";
import { getGoogleClientId, saveGoogleClientId } from "./js/config.js";

const STORAGE_KEY = "avaluatro.data.v1";
const content = document.querySelector("#app-content");
const dialog = document.querySelector("#app-dialog");
const dialogForm = document.querySelector("#dialog-form");
const dialogContent = document.querySelector("#dialog-content");
const toast = document.querySelector("#toast");
let toastTimer;

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const initialData = validateData(clone(sampleData));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    return initialData;
  }
  const storedData = JSON.parse(saved);
  const validatedData = validateData(storedData);
  if (JSON.stringify(validatedData) !== saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validatedData));
  }
  return validatedData;
}

try {
  setData(loadData());
} catch (error) {
  setData(clone(sampleData));
  setSaveStatus("No s'han pogut carregar les dades");
  showToast(`Error en carregar les dades locals: ${error.message}`, true);
}

function validateData(value) {
  return validateStoredData(value, makeId);
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaveStatus("Desat al dispositiu");
    return true;
  } catch (error) {
    setSaveStatus("Error en desar");
    showToast(`No s'han pogut desar les dades: ${error.message}`, true);
    return false;
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
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3300);
}

function updateDriveProfileStatus() {
  const status = document.querySelector("#drive-profile-status");
  if (status) status.textContent = getGoogleClientId() ? "Google Drive preparat" : "Configura Google Drive";
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function getAssessment(studentId, activityId) {
  return calculateAssessment(data, studentId, activityId);
}

function getActivityGrade(studentId, activity) {
  return calculateActivityGrade(data, studentId, activity);
}

function competencyOptions(selectedId = "") {
  return data.competencies.map(competency => `<option value="${competency.id}" ${selectedId === competency.id ? "selected" : ""}>${escapeHtml(competency.name)}</option>`).join("");
}

function openDialog(title, subtitle, body, submitLabel) {
  dialogContent.innerHTML = `<div class="dialog-heading"><div><h2>${title}</h2><p>${subtitle}</p></div><button class="icon-button" type="button" data-close-dialog aria-label="Tanca">${icon("xmark")}</button></div>${body}
    <div class="form-actions"><span></span><div class="form-actions-right"><button class="button" type="button" data-close-dialog>Cancel·la</button><button class="button button-primary" type="submit">${submitLabel}</button></div></div>`;
  dialog.showModal();
  dialogContent.querySelector("input, select, textarea")?.focus();
}

function openDriveSettingsDialog() {
  openDialog("Configura Google Drive", "Introdueix el Client ID OAuth públic de la teva aplicació. Després, Google et demanarà que triïs el compte i n’autoritzi l’accés per desar la còpia actual.", `<div class="form-grid">
    <div class="field full"><label for="google-client-id">Client ID d’aplicació web</label><input id="google-client-id" name="clientId" type="text" required autocomplete="off" spellcheck="false" placeholder="123456789-abc.apps.googleusercontent.com" value="${escapeHtml(getGoogleClientId())}"><span class="field-hint">No introdueixis la contrasenya de Gmail ni un secret de client. L’inici de sessió es fa a la pàgina segura de Google.</span></div>
    <div class="field full"><span class="field-hint">A Google Cloud Console, activa Google Drive API, crea un Client ID OAuth de tipus aplicació web i afegeix aquest origen com a origen JavaScript autoritzat: <strong>${escapeHtml(globalThis.location.origin)}</strong>. La còpia s’emmagatzema a l’àrea privada de l’aplicació.</span></div>
    <div class="field full"><a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Obre les credencials de Google Cloud</a></div>
  </div>`, "Desa i connecta");
  dialogForm.dataset.formType = "drive-settings";
  dialogForm.dataset.recordId = "";
}

async function connectDriveAndBackup(clientId, submitButton) {
  submitButton.disabled = true;
  try {
    saveGoogleClientId(clientId);
    updateDriveProfileStatus();
    await saveToDrive(data);
    dialog.close();
    showToast("Compte autoritzat i còpia desada a Google Drive.");
  } catch (error) {
    showToast(`No s'ha pogut connectar o desar la còpia a Google Drive: ${error.message}`, true);
  } finally {
    submitButton.disabled = false;
  }
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
  const classGroupId = student?.classGroupId || "";
  openDialog(editing ? "Edita el perfil de l'alumne" : "Afegeix un alumne", editing ? "Actualitza el grup classe i el desdoblament de l'alumne." : "Crea un perfil i assigna'l a un grup classe i, si cal, a un desdoblament.", `<div class="form-grid">
    <div class="field"><label for="student-first-name">Noms</label><input id="student-first-name" name="firstName" required maxlength="60" placeholder="Ex.: Júlia Maria"></div>
    <div class="field"><label for="student-last-name">Cognoms</label><input id="student-last-name" name="lastName" required maxlength="80" placeholder="Ex.: Martí Soler"></div>
    <div class="field"><label for="student-class-group">Grup classe</label><select id="student-class-group" name="classGroupId">${classGroupOptions(classGroupId)}</select></div>
    <div class="field"><label for="student-subgroup">Desdoblament</label><select id="student-subgroup" name="subgroupId" ${classGroupId ? "" : "disabled"}>${subgroupOptions(classGroupId, student?.subgroupId || "")}</select></div>
  </div>`, editing ? "Desa els canvis" : "Desa l'alumne");
  if (student) {
    dialogContent.querySelector("#student-first-name").value = student.firstName;
    dialogContent.querySelector("#student-last-name").value = student.lastName;
  }
  dialogForm.dataset.formType = editing ? "edit-student" : "student";
  dialogForm.dataset.recordId = student?.id || "";
}

function openClassGroupDialog(classGroupId = null) {
  const classGroup = classGroupId ? getClassGroup(classGroupId) : null;
  if (classGroupId && !classGroup) {
    showToast("No s'ha trobat el grup classe que vols editar.", true);
    return;
  }
  const editing = Boolean(classGroup);
  openDialog(editing ? "Edita el grup classe" : "Crea un grup classe", "Els desdoblaments són opcionals i poden contenir grups com «A» i «B». Escriu-ne un per línia.", `<div class="form-grid">
    <div class="field full"><label for="class-group-name">Nom del grup classe</label><input id="class-group-name" name="name" required maxlength="60" placeholder="Ex.: 4t A" value="${escapeHtml(classGroup?.name || "")}"></div>
    <div class="field full"><label for="class-group-subgroups">Desdoblaments (opcional)</label><textarea id="class-group-subgroups" name="subgroups" maxlength="500" placeholder="Grup A&#10;Grup B">${escapeHtml(classGroup?.subgroups.map(subgroup => subgroup.name).join("\n") || "")}</textarea></div>
  </div>`, editing ? "Desa els canvis" : "Desa el grup");
  dialogForm.dataset.formType = editing ? "edit-class-group" : "class-group";
  dialogForm.dataset.recordId = classGroup?.id || "";
}

function deleteClassGroup(classGroupId) {
  const classGroup = getClassGroup(classGroupId);
  if (!classGroup) {
    showToast("No s'ha trobat el grup classe que vols eliminar.", true);
    return;
  }
  const assignedCount = data.students.filter(student => student.classGroupId === classGroupId).length;
  if (!globalThis.confirm(`Vols eliminar «${classGroup.name}»? ${assignedCount ? `${assignedCount} alumnes quedaran sense grup classe.` : ""}`)) return;
  const previousData = clone(data);
  data.classGroups = data.classGroups.filter(item => item.id !== classGroupId);
  for (const subject of data.subjects) {
    for (const level of subject.levels) {
      level.classGroupIds = level.classGroupIds.filter(id => id !== classGroupId);
    }
  }
  for (const student of data.students) {
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

function subjectContributionFields(activityId, competencyIds, savedContributions = {}) {
  const activity = data.activities.find(item => item.id === activityId);
  return data.competencies.filter(competency => competencyIds.includes(competency.id)).map(competency => {
    const participates = activity?.evidences.some(evidence => Number(evidence.contributions[competency.id]) > 0) || false;
    const defaultWeight = participates ? 100 : 0;
    const weight = Object.hasOwn(savedContributions, competency.id) ? Number(savedContributions[competency.id]) : defaultWeight;
    return `<label class="contribution-field"><span>${escapeHtml(competency.name)}</span><span class="contribution-input"><input type="number" min="0" max="100" step="1" value="${weight}" data-sequence-contribution="${escapeHtml(competency.id)}" aria-label="Contribució de ${escapeHtml(competency.name)}" required><span>%</span></span></label>`;
  }).join("");
}

function selectedLevelCompetencyIds() {
  return [...dialogContent.querySelectorAll('[name="levelCompetencyId"]:checked')].map(input => input.value);
}

function refreshSequenceContributionFields(sequenceItem) {
  const savedContributions = Object.fromEntries([...sequenceItem.querySelectorAll("[data-sequence-contribution]")]
    .map(input => [input.dataset.sequenceContribution, Number(input.value)]));
  const activityId = sequenceItem.querySelector("[data-sequence-activity]").value;
  sequenceItem.querySelector(".subject-contributions").innerHTML =
    subjectContributionFields(activityId, selectedLevelCompetencyIds(), savedContributions);
}

function educationalLevelOptions(selectedLevel = "") {
  return `<option value="">Sense nivell</option>${EDUCATIONAL_LEVELS.map(stage => `<optgroup label="${escapeHtml(stage.stage)}">${stage.levels.map(level => `<option value="${escapeHtml(level)}" ${selectedLevel === level ? "selected" : ""}>${escapeHtml(level)}</option>`).join("")}</optgroup>`).join("")}`;
}

function subjectSequenceItem(index, item = null, competencyIds = data.competencies.map(competency => competency.id)) {
  const selectedActivityId = item?.activityId || data.activities[0]?.id || "";
  const activities = data.activities.map(activity => `<option value="${escapeHtml(activity.id)}" ${selectedActivityId === activity.id ? "selected" : ""}>${escapeHtml(activity.title)} · ${escapeHtml(activity.type)}</option>`).join("");
  return `<article class="subject-sequence-item"><div class="subject-sequence-heading"><strong>Element ${index + 1}</strong><div><button class="text-button" type="button" data-move-sequence="-1" aria-label="Mou amunt">${icon("nav-arrow-up")}</button><button class="text-button" type="button" data-move-sequence="1" aria-label="Mou avall">${icon("nav-arrow-down")}</button><button class="text-button danger-text" type="button" data-remove-sequence-item>Elimina</button></div></div>
    <input type="hidden" name="sequenceItemId" value="${escapeHtml(item?.id || "")}">
    <div class="form-grid"><div class="field"><label>Activitat o examen</label><select name="sequenceActivityId" data-sequence-activity required ${data.activities.length ? "" : "disabled"}>${activities || '<option value="">Crea primer una activitat</option>'}</select></div>
      <div class="field"><label>Situació d'aprenentatge</label><input name="sequenceSituation" type="text" maxlength="100" value="${escapeHtml(item?.situation || "Situació d'aprenentatge 1")}" required></div>
      <div class="field"><label>Inversió de temps (hores)</label><input name="sequenceHours" type="number" min="0.25" max="1000" step="0.25" value="${item ? Number(item.hours) : 1}" required></div></div>
    <div class="field"><label>Contribució a cada competència (%)</label><div class="subject-contributions">${subjectContributionFields(selectedActivityId, competencyIds, item?.contributions || {})}</div><span class="field-hint">0% vol dir que aquesta activitat no aporta evidència a la competència.</span></div></article>`;
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
  const selectedGroups = new Set(level?.classGroupIds || []);
  const selectedCompetencies = new Set(level?.competencyIds || data.competencies.map(competency => competency.id));
  const classGroupFields = data.classGroups.length
    ? `<div class="class-group-checkboxes">${data.classGroups.map(classGroup => {
      const assignedLevel = subject.levels.find(item => item.id !== level?.id && item.classGroupIds.includes(classGroup.id));
      const isSelected = selectedGroups.has(classGroup.id);
      return `<label class="class-group-checkbox"><input type="checkbox" name="levelClassGroupId" value="${escapeHtml(classGroup.id)}" ${isSelected ? "checked" : ""} ${assignedLevel ? "disabled" : ""}><span>${escapeHtml(classGroup.name)}${assignedLevel ? ` · assignat a ${escapeHtml(assignedLevel.name)}` : ""}</span></label>`;
    }).join("")}</div>`
    : '<div class="empty-state">Crea primer grups classe per assignar-hi alumnes.</div>';
  const competencyFields = data.competencies.length
    ? `<div class="class-group-checkboxes">${data.competencies.map(competency => `<label class="class-group-checkbox"><input type="checkbox" name="levelCompetencyId" value="${escapeHtml(competency.id)}" ${selectedCompetencies.has(competency.id) ? "checked" : ""}><span>${escapeHtml(competency.name)}</span></label>`).join("")}</div>`
    : '<div class="empty-state">Crea primer competències per poder-les assignar a aquest nivell.</div>';
  const sequence = level?.sequence || [];
  const competencyIds = [...selectedCompetencies];
  openDialog(level ? "Edita el nivell" : "Afegeix un nivell", "Assigna a aquest nivell els grups classe i la seva pròpia seqüència d'activitats i exàmens.", `<div class="form-grid">
    <div class="field full"><label for="level-name">Nivell educatiu</label><select id="level-name" name="name" required>${educationalLevelOptions(level?.name || "").replace('<option value="">Sense nivell</option>', '<option value="">Tria un nivell</option>')}</select></div>
    <div class="field full"><label>Grups classe del nivell</label>${classGroupFields}<span class="field-hint">Cada grup classe només es pot assignar a un nivell d'aquesta assignatura.</span></div>
    <div class="field full"><label>Competències avaluades en aquest nivell</label>${competencyFields}<span class="field-hint">Només aquestes competències estaran disponibles com a contribucions de les activitats de la seqüència.</span></div>
  </div>
  <div class="panel-heading subject-form-heading"><div><h3 class="section-title">Seqüència d'activitats i exàmens</h3><span class="section-caption">Aquesta seqüència i les seves contribucions són pròpies del nivell.</span></div></div>
  <p class="field-hint">Escriu el mateix nom a les activitats que pertanyen a una mateixa situació d'aprenentatge; apareixeran agrupades a la pàgina de la seqüència.</p>
  <div id="subject-sequence-list" class="subject-sequence-list">${sequence.map((item, index) => subjectSequenceItem(index, item, competencyIds)).join("")}</div>
  <button class="button" type="button" data-add-sequence-item ${data.activities.length ? "" : "disabled"}>${icon("plus")} Afegeix activitat o examen</button>
  ${!data.activities.length ? '<p class="field-hint">Crea primer activitats o exàmens a «Activitats i proves».</p>' : ""}`, level ? "Desa els canvis" : "Afegeix nivell");
  dialogForm.dataset.formType = level ? "edit-level" : "level";
  dialogForm.dataset.recordId = level?.id || "";
  dialogForm.dataset.returnToSequence = state.selectedSequence ? "true" : "false";
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

function openSequenceActivityDialog(situation) {
  const context = getSelectedSequenceLevel();
  if (!context) return;
  const { level } = context;
  const usedActivityIds = new Set(level.sequence.map(item => item.activityId));
  const availableActivities = data.activities.filter(activity => !usedActivityIds.has(activity.id));
  const selectedActivityId = availableActivities[0]?.id || "";
  const activityOptions = availableActivities.map(activity => `<option value="${escapeHtml(activity.id)}">${escapeHtml(activity.title)} · ${escapeHtml(activity.type)}</option>`).join("");
  openDialog("Afegeix una activitat a la situació", `La nova activitat s'afegirà a «${escapeHtml(situation)}».`, `<div class="form-grid">
    <div class="field full"><label for="sequence-activity-select">Activitat o examen</label><select id="sequence-activity-select" name="sequenceActivityId" required ${availableActivities.length ? "" : "disabled"}>${activityOptions || '<option value="">No hi ha activitats disponibles</option>'}</select>${availableActivities.length ? "" : '<span class="field-hint">Crea primer una activitat o examen des de «Activitats i proves».</span>'}</div>
    <div class="field"><label>Inversió de temps (hores)</label><input name="sequenceHours" type="number" min="0.25" max="1000" step="0.25" value="1" required></div>
    <div class="field full"><label>Contribució a cada competència (%)</label><div id="sequence-activity-contributions" class="subject-contributions">${subjectContributionFields(selectedActivityId, level.competencyIds)}</div><span class="field-hint">0% vol dir que aquesta activitat no aporta evidència a la competència.</span></div>
  </div>`, "Afegeix activitat");
  dialogForm.dataset.formType = "sequence-activity";
  dialogForm.dataset.recordId = level.id;
  dialogForm.dataset.situation = situation;
  dialogForm.querySelector('[type="submit"]').disabled = !availableActivities.length;
}

function openCompetencyDialog(competencyId = null) {
  const competency = competencyId ? data.competencies.find(item => item.id === competencyId) : null;
  if (competencyId && !competency) {
    showToast("No s'ha trobat la competència que vols editar.", true);
    return;
  }
  const editing = Boolean(competency);
  openDialog(editing ? "Edita la competència" : "Crea una competència", "Descriu una capacitat observable que l'alumnat desenvoluparà.", `<div class="form-grid">
    <div class="field full"><label for="competency-name">Nom de la competència</label><input id="competency-name" name="name" required maxlength="140" placeholder="Ex.: Avaluar l'impacte ecològic d'una tecnologia" value="${escapeHtml(competency?.name || "")}"></div>
    <div class="field full"><label for="competency-description">Descripció</label><textarea id="competency-description" name="description" maxlength="500" placeholder="Quines accions o coneixements demostren aquesta competència?">${escapeHtml(competency?.description || "")}</textarea></div>
  </div>`, editing ? "Desa els canvis" : "Desa la competència");
  dialogForm.dataset.formType = editing ? "edit-competency" : "competency";
  dialogForm.dataset.recordId = competency?.id || "";
}

function evidenceFormItem(index, evidence = null) {
  const selectedCompetencies = new Set(Object.keys(evidence?.contributions || {}));
  if (!evidence && data.competencies[0]) selectedCompetencies.add(data.competencies[0].id);
  const competencyFields = data.competencies
    .filter(competency => selectedCompetencies.has(competency.id))
    .map(competency => evidenceCompetencyField(competency, evidence?.contributions[competency.id] ?? 100))
    .join("");
  const availableCompetencies = data.competencies.filter(competency => !selectedCompetencies.has(competency.id));
  return `<div class="rubric-form-item evidence-form-item"><div class="rubric-form-heading"><div class="rubric-form-title">Evidència ${index + 1}</div><button class="text-button rubric-remove" type="button" data-remove-evidence aria-label="Elimina aquesta evidència">Elimina</button></div>
    <input name="evidenceId" type="hidden" value="${escapeHtml(evidence?.id || "")}">
    <div class="field"><label>Quina evidència s'observarà?</label><input name="evidenceName" required maxlength="100" placeholder="${index === 0 ? "Ex.: Anàlisi de l'impacte ambiental" : "Ex.: Argumentació amb dades"}" value="${escapeHtml(evidence?.name || "")}"></div>
    <div class="field"><label>Competències a les quals contribueix</label><div class="evidence-competencies">${competencyFields}</div><div class="evidence-competency-add"><select data-evidence-competency-select aria-label="Selecciona una competència" ${availableCompetencies.length ? "" : "disabled"}>${availableCompetencies.length ? availableCompetencies.map(competency => `<option value="${escapeHtml(competency.id)}">${escapeHtml(competency.name)}</option>`).join("") : '<option value="">Totes les competències afegides</option>'}</select><button class="button" type="button" data-add-evidence-competency ${availableCompetencies.length ? "" : "disabled"}>${icon("plus")} Afegeix competència</button></div><span class="field-hint">Defineix l'aportació a cada competència. La suma determina el pes total de l'evidència en la nota de l'activitat.</span></div></div>`;
}

function evidenceCompetencyField(competency, weight) {
  return `<div class="evidence-competency-row"><input type="hidden" name="evidenceCompetencyId" value="${escapeHtml(competency.id)}"><span class="evidence-competency-name">${escapeHtml(competency.name)}</span><label class="evidence-contribution"><span>Aportació</span><input type="number" min="1" max="100" step="1" value="${Number(weight)}" data-evidence-contribution="${escapeHtml(competency.id)}" aria-label="Aportació de ${escapeHtml(competency.name)}" required><span>%</span></label><button class="text-button rubric-remove" type="button" data-remove-evidence-competency="${escapeHtml(competency.id)}" aria-label="Treu ${escapeHtml(competency.name)}">Treu</button></div>`;
}

function refreshEvidenceCompetencyOptions(evidenceItem) {
  const select = evidenceItem.querySelector("[data-evidence-competency-select]");
  const selectedIds = new Set([...evidenceItem.querySelectorAll('[name="evidenceCompetencyId"]')].map(input => input.value));
  const options = data.competencies.filter(competency => !selectedIds.has(competency.id));
  select.innerHTML = options.length
    ? options.map(competency => `<option value="${escapeHtml(competency.id)}">${escapeHtml(competency.name)}</option>`).join("")
    : '<option value="">Totes les competències afegides</option>';
  select.disabled = !options.length;
  evidenceItem.querySelector("[data-add-evidence-competency]").disabled = !options.length;
}

function openActivityDialog(activityId = null) {
  const activity = activityId ? data.activities.find(item => item.id === activityId) : null;
  if (activityId && !activity) {
    showToast("No s'ha trobat l'activitat que vols editar.", true);
    return;
  }
  if (!data.competencies.length) {
    showToast("Crea una competència abans de preparar una activitat.", true);
    openCompetencyDialog();
    return;
  }
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const editing = Boolean(activity);
  const typeOptions = ["Prova", "Projecte en grup", "Activitat", "Presentació"];
  if (activity && !typeOptions.includes(activity.type)) typeOptions.push(activity.type);
  openDialog(editing ? "Edita l'activitat i la rúbrica" : "Crea una activitat", editing ? "Actualitza els detalls i les evidències. Les avaluacions existents es conserven per a les evidències que mantinguis." : "Defineix una prova o un projecte i les evidències que permetran avaluar l'alumnat.", `<div class="form-grid">
    <div class="field full"><label for="activity-title">Nom de l'activitat</label><input id="activity-title" name="title" required maxlength="140" placeholder="Ex.: Projecte de sostenibilitat" value="${escapeHtml(activity?.title || "")}"></div>
    <div class="field"><label for="activity-type">Tipus</label><select id="activity-type" name="type">${typeOptions.map(type => `<option ${activity?.type === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}</select></div>
    <div class="field"><label for="activity-date">Data</label><input id="activity-date" name="date" type="date" value="${escapeHtml(activity?.date || localDate)}" required></div>
  </div>
  <div class="panel-heading" style="margin:15px 0 10px"><div><h3 class="section-title">Evidències de la rúbrica</h3><span class="section-caption">Cada evidència pot contribuir a una o més competències amb pesos independents.</span></div></div>
  <div id="rubric-form-list" class="rubric-form-list">${activity ? activity.evidences.map((evidence, index) => evidenceFormItem(index, evidence)).join("") : evidenceFormItem(0)}</div>
  <button class="button" type="button" data-add-evidence style="margin-top:10px">${icon("plus")} Afegeix evidència</button>`, editing ? "Desa els canvis" : "Desa l'activitat");
  dialogForm.dataset.formType = editing ? "edit-activity" : "activity";
  dialogForm.dataset.recordId = activity?.id || "";
}

function exportData() {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
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
      if (!globalThis.confirm("La importació substituirà totes les dades actuals d'aquest dispositiu. Vols continuar?")) return;
      const previous = data;
      setData(imported);
      if (!saveData()) {
        setData(previous);
        return;
      }
      state.currentView = "overview";
      state.selectedActivityId = null;
      state.selectedStudentId = null;
      render();
      showToast("Dades importades correctament.");
    } catch (error) {
      showToast(`No s'ha pogut importar el JSON: ${error.message}`, true);
    }
  };
  reader.readAsText(file);
}

async function backupToDrive() {
  const button = document.querySelector("#drive-save-button");
  button.disabled = true;
  try {
    await saveToDrive(data);
    showToast("Còpia desada a la carpeta privada de l'aplicació a Google Drive.");
  } catch (error) {
    showToast(`No s'ha pogut desar la còpia a Google Drive: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

async function restoreFromDrive() {
  const button = document.querySelector("#drive-load-button");
  button.disabled = true;
  try {
    const stored = await loadFromDrive();
    if (!stored) {
      showToast("No hi ha cap còpia d'Avaluatró a Google Drive.", true);
      return;
    }
    const imported = validateData(stored);
    if (!globalThis.confirm("La còpia de Google Drive substituirà totes les dades actuals d'aquest dispositiu. Vols continuar?")) return;
    const previous = data;
    setData(imported);
    if (!saveData()) {
      setData(previous);
      return;
    }
    state.currentView = "overview";
    state.selectedActivityId = null;
    state.selectedStudentId = null;
    render();
    showToast("Còpia de Google Drive restaurada correctament.");
  } catch (error) {
    showToast(`No s'ha pogut restaurar la còpia de Google Drive: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelector("#export-button").addEventListener("click", exportData);
document.querySelector("#teacher-profile-button").addEventListener("click", openDriveSettingsDialog);
document.querySelector("#import-button").addEventListener("click", () => document.querySelector("#import-file").click());
document.querySelector("#drive-save-button").addEventListener("click", backupToDrive);
document.querySelector("#drive-load-button").addEventListener("click", restoreFromDrive);
document.querySelector("#import-file").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) importData(file);
  event.target.value = "";
});

document.addEventListener("click", event => {
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "create-student") openStudentDialog();
    if (action === "create-competency") openCompetencyDialog();
    if (action === "create-activity") openActivityDialog();
    if (action === "create-class-group") openClassGroupDialog();
    if (action === "edit-level") openLevelDialog(state.selectedLevelId);
    if (action === "add-learning-situation") openLearningSituationDialog();
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
  if (event.target.closest("[data-open-level-progress]")) {
    state.selectedSequence = false;
    document.querySelector("#current-section").textContent = "Assignatures";
    renderLevelDetail();
  }
  const editSubjectButton = event.target.closest("[data-edit-subject]");
  if (editSubjectButton) openSubjectDialog(editSubjectButton.dataset.editSubject);
  const editLevelButton = event.target.closest("[data-edit-level]");
  if (editLevelButton) openLevelDialog(editLevelButton.dataset.editLevel);
  const activityButton = event.target.closest("[data-open-activity]");
  if (activityButton) {
    state.selectedActivityId = activityButton.dataset.openActivity;
    state.activityReturnToSequence = state.currentView === "subjects" && state.selectedSequence;
    state.currentView = "activities";
    document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === "activities"));
    document.querySelector("#current-section").textContent = "Activitats i proves";
    renderActivityDetail();
  }
  const editActivityButton = event.target.closest("[data-edit-activity]");
  if (editActivityButton) openActivityDialog(editActivityButton.dataset.editActivity);
  const editCompetencyButton = event.target.closest("[data-edit-competency]");
  if (editCompetencyButton) openCompetencyDialog(editCompetencyButton.dataset.editCompetency);
  const editStudentButton = event.target.closest("[data-edit-student]");
  if (editStudentButton) openStudentDialogFor(editStudentButton.dataset.editStudent);
  const editClassGroupButton = event.target.closest("[data-edit-class-group]");
  if (editClassGroupButton) openClassGroupDialog(editClassGroupButton.dataset.editClassGroup);
  const deleteClassGroupButton = event.target.closest("[data-delete-class-group]");
  if (deleteClassGroupButton) deleteClassGroup(deleteClassGroupButton.dataset.deleteClassGroup);
  const filterClassGroupButton = event.target.closest("[data-filter-class-group]");
  if (filterClassGroupButton) {
    state.selectedClassGroupId = filterClassGroupButton.dataset.filterClassGroup;
    state.selectedSubgroupId = "";
    setView("students");
    const filter = document.querySelector("#class-group-filter");
    if (filter) filter.value = state.selectedClassGroupId;
  }
  const studentButton = event.target.closest("[data-open-student]");
  if (studentButton) {
    state.selectedStudentId = studentButton.dataset.openStudent;
    renderStudentDetail();
  }
  const backButton = event.target.closest("[data-back]");
  if (backButton) {
    if (backButton.dataset.back === "activities") {
      state.selectedActivityId = null;
      if (state.activityReturnToSequence) {
        state.activityReturnToSequence = false;
        state.currentView = "subjects";
        state.selectedSequence = true;
        document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === "subjects"));
        document.querySelector("#current-section").textContent = "Seqüència d'aprenentatge";
      }
    }
    if (backButton.dataset.back === "students") state.selectedStudentId = null;
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
    updateDriveProfileStatus();
  }
  if (event.target.closest("[data-close-dialog]")) dialog.close();
  if (event.target.closest("[data-add-sequence-item]")) {
    const list = dialogContent.querySelector("#subject-sequence-list");
    list.insertAdjacentHTML("beforeend", subjectSequenceItem(list.children.length, null, selectedLevelCompetencyIds()));
  }
  const moveSequenceButton = event.target.closest("[data-move-sequence]");
  if (moveSequenceButton) {
    const item = moveSequenceButton.closest(".subject-sequence-item");
    const direction = Number(moveSequenceButton.dataset.moveSequence);
    if (direction < 0 && item.previousElementSibling) listMoveBefore(item, item.previousElementSibling);
    if (direction > 0 && item.nextElementSibling) listMoveBefore(item.nextElementSibling, item);
    dialogContent.querySelectorAll(".subject-sequence-item > .subject-sequence-heading > strong").forEach((label, index) => {
      label.textContent = `Element ${index + 1}`;
    });
  }
  const removeSequenceItemButton = event.target.closest("[data-remove-sequence-item]");
  if (removeSequenceItemButton) {
    removeSequenceItemButton.closest(".subject-sequence-item").remove();
    dialogContent.querySelectorAll(".subject-sequence-item > .subject-sequence-heading > strong").forEach((label, index) => {
      label.textContent = `Element ${index + 1}`;
    });
  }
  if (event.target.closest("[data-add-evidence]")) {
    const list = document.querySelector("#rubric-form-list");
    list.insertAdjacentHTML("beforeend", evidenceFormItem(list.children.length));
  }
  const removeEvidenceButton = event.target.closest("[data-remove-evidence]");
  if (removeEvidenceButton) removeEvidenceButton.closest(".rubric-form-item").remove();
  const addEvidenceCompetencyButton = event.target.closest("[data-add-evidence-competency]");
  if (addEvidenceCompetencyButton) {
    const evidenceItem = addEvidenceCompetencyButton.closest(".evidence-form-item");
    const competencyId = evidenceItem.querySelector("[data-evidence-competency-select]").value;
    const competency = data.competencies.find(item => item.id === competencyId);
    if (!competency) {
      showToast("Selecciona una competència vàlida per afegir-la a l'evidència.", true);
      return;
    }
    evidenceItem.querySelector(".evidence-competencies").insertAdjacentHTML("beforeend", evidenceCompetencyField(competency, 100));
    refreshEvidenceCompetencyOptions(evidenceItem);
  }
  const removeEvidenceCompetencyButton = event.target.closest("[data-remove-evidence-competency]");
  if (removeEvidenceCompetencyButton) {
    const evidenceItem = removeEvidenceCompetencyButton.closest(".evidence-form-item");
    removeEvidenceCompetencyButton.closest(".evidence-competency-row").remove();
    refreshEvidenceCompetencyOptions(evidenceItem);
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
  if (event.target.id === "student-class-group") {
    const subgroupSelect = dialogContent.querySelector("#student-subgroup");
    subgroupSelect.innerHTML = subgroupOptions(event.target.value);
    subgroupSelect.disabled = !event.target.value;
    return;
  }
  if (event.target.matches("[data-sequence-activity]")) {
    refreshSequenceContributionFields(event.target.closest(".subject-sequence-item"));
    return;
  }
  if (event.target.id === "sequence-activity-select") {
    const savedContributions = Object.fromEntries([...dialogContent.querySelectorAll("[data-sequence-contribution]")]
      .map(input => [input.dataset.sequenceContribution, Number(input.value)]));
    const level = data.subjects.flatMap(subject => subject.levels).find(item => item.id === state.selectedLevelId);
    dialogContent.querySelector("#sequence-activity-contributions").innerHTML =
      subjectContributionFields(event.target.value, level?.competencyIds || [], savedContributions);
    return;
  }
  if (event.target.matches('[name="levelCompetencyId"]')) {
    dialogContent.querySelectorAll(".subject-sequence-item").forEach(refreshSequenceContributionFields);
    return;
  }
});

dialogForm.addEventListener("submit", event => {
  event.preventDefault();
  const formType = dialogForm.dataset.formType;
  if (formType === "drive-settings") {
    const clientId = String(new FormData(dialogForm).get("clientId") || "").trim();
    if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId)) {
      showToast("Introdueix un Client ID OAuth d’aplicació web vàlid (acaba en .apps.googleusercontent.com).", true);
      return;
    }
    try {
      void connectDriveAndBackup(clientId, dialogForm.querySelector('[type="submit"]'));
    } catch (error) {
      showToast(`No s'ha pogut desar la configuració de Google Drive: ${error.message}`, true);
    }
    return;
  }
  const recordId = dialogForm.dataset.recordId;
  const formData = new FormData(dialogForm);
  const previousData = clone(data);
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
    if (level.situations.some(situation => situation.toLocaleLowerCase("ca") === name.toLocaleLowerCase("ca"))) {
      showToast("Ja existeix una situació d'aprenentatge amb aquest nom en aquest nivell.", true);
      return;
    }
    level.situations.push(name);
    state.currentView = "subjects";
    state.selectedSequence = true;
  }
  if (formType === "sequence-activity") {
    const level = data.subjects.find(subject => subject.id === state.selectedSubjectId)?.levels.find(item => item.id === recordId);
    const activityId = String(formData.get("sequenceActivityId") || "");
    const activity = data.activities.find(item => item.id === activityId);
    const situation = dialogForm.dataset.situation;
    const hours = Number(formData.get("sequenceHours"));
    const contributions = Object.fromEntries([...dialogContent.querySelectorAll("[data-sequence-contribution]")]
      .map(input => [input.dataset.sequenceContribution, Number(input.value)]));
    if (!level || !level.situations.includes(situation)) {
      showToast("No s'ha trobat la situació d'aprenentatge seleccionada.", true);
      return;
    }
    if (!activity || level.sequence.some(item => item.activityId === activityId) || !Number.isFinite(hours) || hours <= 0 ||
      Object.entries(contributions).some(([competencyId, weight]) => !level.competencyIds.includes(competencyId) || !Number.isFinite(weight) || weight < 0 || weight > 100)) {
      showToast("Revisa l'activitat, les hores i les contribucions (entre 0 i 100%).", true);
      return;
    }
    level.sequence.push({
      id: makeId("seq"),
      activityId,
      situation,
      hours,
      contributions: Object.fromEntries(Object.entries(contributions).filter(([, weight]) => weight > 0))
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
    if (classGroupId && !getClassGroup(classGroupId) || subgroupId && !getClassGroup(classGroupId)?.subgroups.some(item => item.id === subgroupId)) {
      showToast("Selecciona un grup classe i un desdoblament vàlids.", true);
      return;
    }
    const firstName = String(formData.get("firstName")).trim();
    const lastName = String(formData.get("lastName")).trim();
    if (!firstName || !lastName) {
      showToast("Escriu els noms i els cognoms de l'alumne.", true);
      return;
    }
    const updatedStudent = { id: student?.id || makeId("al"), firstName, lastName, classGroupId, subgroupId };
    if (student) Object.assign(student, updatedStudent);
    else data.students.push(updatedStudent);
    if (formType === "student") state.studentQuery = "";
  }
  if (formType === "class-group" || formType === "edit-class-group") {
    const classGroup = formType === "edit-class-group" ? getClassGroup(recordId) : null;
    if (formType === "edit-class-group" && !classGroup) {
      showToast("No s'ha trobat el grup classe que vols editar.", true);
      return;
    }
    const name = String(formData.get("name")).trim();
    const duplicateName = data.classGroups.some(item => item.id !== classGroup?.id && item.name.trim().toLocaleLowerCase("ca") === name.toLocaleLowerCase("ca"));
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
      Object.assign(classGroup, { name, subgroups });
      const subgroupIds = new Set(subgroups.map(subgroup => subgroup.id));
      for (const student of data.students) {
        if (student.classGroupId === classGroupId && student.subgroupId && !subgroupIds.has(student.subgroupId)) student.subgroupId = "";
      }
    } else {
      data.classGroups.push({ id: classGroupId, name, subgroups });
    }
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
    const classGroupIds = [...new Set(formData.getAll("levelClassGroupId").map(String))];
    if (classGroupIds.some(id => !getClassGroup(id))) {
      showToast("Selecciona grups classe vàlids.", true);
      return;
    }
    const assignedToOtherLevel = subject.levels.some(item =>
      item.id !== level?.id && item.classGroupIds.some(id => classGroupIds.includes(id))
    );
    if (assignedToOtherLevel) {
      showToast("Un grup classe no es pot assignar a més d'un nivell de la mateixa assignatura.", true);
      return;
    }
    const competencyIds = [...new Set(formData.getAll("levelCompetencyId").map(String))];
    if (competencyIds.some(id => !data.competencies.some(competency => competency.id === id))) {
      showToast("Selecciona competències vàlides per a aquest nivell.", true);
      return;
    }
    const existingItems = new Map((level?.sequence || []).map(item => [item.id, item]));
    const sequenceItems = [...dialogContent.querySelectorAll(".subject-sequence-item")].map(sequenceItem => {
      const requestedId = sequenceItem.querySelector('[name="sequenceItemId"]').value;
      const activityId = sequenceItem.querySelector('[name="sequenceActivityId"]').value;
      const situation = sequenceItem.querySelector('[name="sequenceSituation"]').value.trim();
      const hours = Number(sequenceItem.querySelector('[name="sequenceHours"]').value);
      const contributions = Object.fromEntries([...sequenceItem.querySelectorAll("[data-sequence-contribution]")].map(input => [input.dataset.sequenceContribution, Number(input.value)]));
      return { requestedId, activityId, situation, hours, contributions };
    });
    if (sequenceItems.some(item => !data.activities.some(activity => activity.id === item.activityId) || !item.situation || item.situation.length > 100 || !Number.isFinite(item.hours) || item.hours <= 0 || Object.values(item.contributions).some(weight => !Number.isFinite(weight) || weight < 0 || weight > 100))) {
      showToast("Revisa les activitats, les situacions d'aprenentatge, les hores i les contribucions (entre 0 i 100%).", true);
      return;
    }
    if (new Set(sequenceItems.map(item => item.activityId)).size !== sequenceItems.length) {
      showToast("No repeteixis una activitat a la seqüència d'aquest nivell.", true);
      return;
    }
    const sequence = sequenceItems.map(item => {
      const existing = existingItems.get(item.requestedId);
      const contributions = Object.fromEntries(Object.entries(item.contributions).filter(([competencyId]) => competencyIds.includes(competencyId)));
      return { id: existing?.id || makeId("seq"), activityId: item.activityId, situation: item.situation, hours: item.hours, contributions };
    });
    const situations = [...(level?.situations || [])];
    for (const item of sequence) {
      if (!situations.some(situation => situation.toLocaleLowerCase("ca") === item.situation.toLocaleLowerCase("ca"))) {
        situations.push(item.situation);
      }
    }
    const updatedLevel = { id: level?.id || makeId("niv"), name, classGroupIds, competencyIds, sequence, situations };
    if (level) Object.assign(level, updatedLevel);
    else subject.levels.push(updatedLevel);
    state.selectedLevelId = updatedLevel.id;
    state.currentView = "subjects";
    state.selectedSequence = formType === "edit-level" && dialogForm.dataset.returnToSequence === "true";
  }
  if (formType === "competency") {
    data.competencies.push({ id: makeId("co"), name: String(formData.get("name")).trim(), description: String(formData.get("description")).trim() });
  }
  if (formType === "edit-competency") {
    const competency = data.competencies.find(item => item.id === recordId);
    if (!competency) {
      showToast("No s'ha trobat la competència que vols editar.", true);
      return;
    }
    competency.name = String(formData.get("name")).trim();
    competency.description = String(formData.get("description")).trim();
  }
  if (formType === "activity" || formType === "edit-activity") {
    const evidenceItems = [...dialogContent.querySelectorAll(".evidence-form-item")].map(item => {
      const contributions = Object.fromEntries([...item.querySelectorAll('[name="evidenceCompetencyId"]')].map(input => {
        const weightInput = item.querySelector(`[data-evidence-contribution="${CSS.escape(input.value)}"]`);
        return [input.value, Number(weightInput.value)];
      }));
      return {
        name: String(item.querySelector('[name="evidenceName"]').value).trim(),
        id: item.querySelector('[name="evidenceId"]').value,
        contributions
      };
    });
    if (!evidenceItems.length || evidenceItems.some(item => !item.name || !Object.keys(item.contributions).length || Object.entries(item.contributions).some(([competencyId, weight]) =>
        !data.competencies.some(competency => competency.id === competencyId) || !Number.isFinite(weight) || weight <= 0 || weight > 100))) {
      showToast("Revisa les evidències, les competències vinculades i els pesos de la rúbrica.", true);
      return;
    }
    const activity = formType === "edit-activity" ? data.activities.find(item => item.id === recordId) : null;
    if (formType === "edit-activity" && !activity) {
      showToast("No s'ha trobat l'activitat que vols editar.", true);
      return;
    }
    const oldEvidenceIds = new Set(activity?.evidences.map(evidence => evidence.id) || []);
    const retainedEvidenceIds = new Set();
    const evidences = evidenceItems.map(evidence => {
      const id = oldEvidenceIds.has(evidence.id) && !retainedEvidenceIds.has(evidence.id) ? evidence.id : makeId("ev");
      retainedEvidenceIds.add(id);
      return { id, name: evidence.name, contributions: evidence.contributions };
    });
    const activityId = activity?.id || makeId("ac");
    const updatedActivity = {
      id: activityId,
      title: String(formData.get("title")).trim(),
      type: String(formData.get("type")),
      date: String(formData.get("date")),
      evidences
    };
    if (activity) {
      Object.assign(activity, updatedActivity);
      for (const assessment of data.assessments.filter(item => item.activityId === activityId)) {
        for (const evidenceId of oldEvidenceIds) {
          if (!retainedEvidenceIds.has(evidenceId)) delete assessment.levels[evidenceId];
        }
      }
    } else {
      data.activities.push(updatedActivity);
    }
    state.selectedActivityId = activityId;
    state.currentView = "activities";
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
    subject: "Assignatura creada.",
    "edit-subject": "Assignatura actualitzada.",
    level: "Nivell afegit.",
    "edit-level": "Nivell actualitzat.",
    "learning-situation": "Situació d'aprenentatge afegida.",
    "sequence-activity": "Activitat afegida a la situació d'aprenentatge.",
    competency: "Competència creada.",
    "edit-competency": "Competència actualitzada.",
    activity: "Activitat creada.",
    "edit-activity": "Activitat i rúbrica actualitzades."
  };
  showToast(messages[formType]);
});

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

content.addEventListener("change", event => {
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
  const subgroupFilter = event.target.closest("#daily-subgroup-filter");
  if (subgroupFilter) {
    state.dailySelectedSubgroupId = subgroupFilter.value;
    render();
    return;
  }
  const dailySelect = event.target.closest("[data-daily-assessment]");
  const dailyNote = event.target.closest("[data-daily-note]");
  if (dailySelect || dailyNote) {
    const studentId = (dailySelect || dailyNote).dataset.studentId;
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
    if (dailySelect) {
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
    if (!Object.keys(assessment.levels).length && !assessment.note) {
      data.dailyAssessments = data.dailyAssessments.filter(item => item !== assessment);
    }
    if (!saveData()) {
      data.dailyAssessments = previousDailyAssessments;
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
  const select = event.target.closest("[data-assess-student][data-evidence]");
  if (!select) return;
  const studentId = select.dataset.assessStudent;
  const evidenceId = select.dataset.evidence;
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity) return;
  let assessment = getAssessment(studentId, activity.id);
  if (!assessment) {
    assessment = { studentId, activityId: activity.id, levels: {} };
    data.assessments.push(assessment);
  }
  assessment.levels[evidenceId] = Number(select.value);
  saveData();
  const selectedLevel = Number(select.value);
  select.className = `grade-select ${gradeColorClass(selectedLevel ? SCORE_BY_LEVEL[selectedLevel] : null)}`;
  const activityGrade = getActivityGrade(studentId, activity);
  updateActivityAssessmentRow(studentId, activityGrade);
  showToast("Avaluació desada. Les notes competencials s'han actualitzat.");
});

render();
