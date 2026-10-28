import { data, state } from "./state.js";
import { DAILY_FOLLOWUP_CRITERIA } from "./data.js";
import {
  SCORE_BY_LEVEL, LEVEL_LABELS,
  getAssessment as calculateAssessment, getCompetencyGrade as calculateCompetencyGrade,
  getActivityGrade as calculateActivityGrade, getActivityCompetencyGrade as calculateActivityCompetencyGrade,
  getLevelCompetencyGrade as calculateLevelCompetencyGrade,
  getStudentActivityCount as calculateStudentActivityCount, getEvidenceActivityWeight,
  isActivityIncludedInStudentGrades, isStudentExemptFromActivity, isStudentExemptFromSubject,
  isStudentExemptFromSubjectForActivity
} from "./grades.js";
import { escapeHtml, icon, formatDate, formatGrade, formatGradeWithCode, gradeColorClass, gradeValue, gradeWidth, gradeBadge } from "./formatting.js";

const content = document.querySelector("#app-content");
let activityTableResizeObserver;

function getAssessment(studentId, activityId) {
  return calculateAssessment(data, studentId, activityId);
}

function getCompetencyGrade(studentId, competencyId) {
  return calculateCompetencyGrade(data, studentId, competencyId);
}

function getActivityGrade(studentId, activity, subjectId = null) {
  const activeSubjectId = subjectId ?? (
    state.currentView === "activities" && state.selectedActivityId === activity.id
      ? state.selectedSubjectId
      : null
  );
  return calculateActivityGrade(data, studentId, activity, activeSubjectId);
}

function getActivityCompetencyGrade(studentId, activity, competencyId) {
  return calculateActivityCompetencyGrade(data, studentId, activity, competencyId);
}

function getLevelCompetencyGrade(level, studentId, competencyId, subjectId = state.selectedSubjectId) {
  return calculateLevelCompetencyGrade(data, level, studentId, competencyId, subjectId);
}

function getStudentActivityCount(studentId) {
  return calculateStudentActivityCount(data, studentId);
}

function studentDisplayName(student) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function setView(view) {
  state.currentView = view;
  state.selectedActivityId = null;
  state.selectedStudentId = null;
  state.selectedSubjectId = null;
  state.selectedLevelId = null;
  state.selectedSequence = false;
  state.activityReturnToSequence = false;
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  const labels = { overview: "Resum", students: "Alumnes", groups: "Grups classe", subjects: "Assignatures", activities: "Activitats i proves", "daily-followup": "Seguiment diari", competencies: "Competències" };
  document.querySelector("#current-section").textContent = labels[view] || "Resum";
  render();
}

function render() {
  if (state.currentView === "overview") renderOverview();
  if (state.currentView === "students") state.selectedStudentId ? renderStudentDetail() : renderStudents();
  if (state.currentView === "groups") renderClassGroups();
  if (state.currentView === "subjects") {
    if (!state.selectedSubjectId) renderSubjects();
    else if (state.selectedLevelId && state.selectedSequence) renderLevelSequence();
    else if (state.selectedLevelId) renderLevelDetail();
    else renderSubjectDetail();
  }
  if (state.currentView === "activities") state.selectedActivityId ? renderActivityDetail() : renderActivities();
  if (state.currentView === "daily-followup") renderDailyFollowup();
  if (state.currentView === "competencies") renderCompetencies();
}

function localDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderDailyFollowup() {
  const subjects = data.subjects;
  state.dailySelectedSubjectId = subjects.some(subject => subject.id === state.dailySelectedSubjectId)
    ? state.dailySelectedSubjectId
    : subjects[0]?.id || "";
  state.dailySelectedDate ||= localDateValue();
  const subject = subjects.find(item => item.id === state.dailySelectedSubjectId);
  if (!subject) {
    content.innerHTML = `${pageHeading("SEGUIMENT FORMATIU", "Seguiment diari", "Registra l'evolució de cada alumne a cada sessió de classe.")}
      ${emptyState("Encara no hi ha assignatures", "Crea una assignatura i assigna-hi els grups classe dels alumnes.", "create-subject", "Crea assignatura")}`;
    return;
  }
  const classGroupIds = [...new Set(subject.levels.flatMap(level => level.classGroupIds))];
  const groups = classGroupIds.map(id => getClassGroup(id)).filter(Boolean);
  if (!classGroupIds.includes(state.dailySelectedClassGroupId)) state.dailySelectedClassGroupId = "";
  const selectedGroup = groups.find(group => group.id === state.dailySelectedClassGroupId);
  if (!selectedGroup?.subgroups.some(subgroup => subgroup.id === state.dailySelectedSubgroupId)) state.dailySelectedSubgroupId = "";
  const subgroups = selectedGroup?.subgroups || [];
  const students = data.students.filter(student =>
    classGroupIds.includes(student.classGroupId) &&
    (!state.dailySelectedClassGroupId || student.classGroupId === state.dailySelectedClassGroupId) &&
    (!state.dailySelectedSubgroupId || student.subgroupId === state.dailySelectedSubgroupId)
  ).sort((a, b) => studentDisplayName(a).localeCompare(studentDisplayName(b), "ca"));
  const assessments = data.dailyAssessments.filter(item =>
    item.subjectId === subject.id && item.date === state.dailySelectedDate &&
    students.some(student => student.id === item.studentId)
  );
  const recordedCount = students.filter(student =>
    assessments.some(item => item.studentId === student.id && Object.keys(item.levels).length > 0)
  ).length;
  const observedLevels = assessments.flatMap(item => Object.values(item.levels));
  const average = observedLevels.length
    ? observedLevels.reduce((total, level) => total + level, 0) / observedLevels.length
    : null;
  const subjectOptions = subjects.map(item =>
    `<option value="${escapeHtml(item.id)}" ${item.id === subject.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
  ).join("");
  const groupOptions = `<option value="">Tots els grups</option>${groups.map(group =>
    `<option value="${escapeHtml(group.id)}" ${group.id === state.dailySelectedClassGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`
  ).join("")}`;
  const subgroupOptions = `<option value="">Tots els desdoblaments</option>${subgroups.map(subgroup =>
    `<option value="${escapeHtml(subgroup.id)}" ${subgroup.id === state.dailySelectedSubgroupId ? "selected" : ""}>${escapeHtml(subgroup.name)}</option>`
  ).join("")}`;
  const rows = students.map(student => {
    const assessment = assessments.find(item => item.studentId === student.id);
    const selectors = DAILY_FOLLOWUP_CRITERIA.map(criterion => {
      const selectedLevel = assessment?.levels[criterion.id] || "";
      return `<td data-label="${escapeHtml(criterion.name)}"><select class="grade-select ${gradeColorClass(selectedLevel ? SCORE_BY_LEVEL[selectedLevel] : null)}" aria-label="${escapeHtml(studentDisplayName(student))}: ${criterion.name}" data-daily-assessment data-student-id="${escapeHtml(student.id)}" data-criterion-id="${criterion.id}">
        <option value="">—</option>${LEVEL_LABELS.slice(1).map((label, index) => {
          const level = index + 1;
          return `<option class="${gradeColorClass(SCORE_BY_LEVEL[level])}" value="${level}" ${selectedLevel === level ? "selected" : ""}>${level} · ${label}</option>`;
        }).join("")}
      </select></td>`;
    }).join("");
    const initials = `${student.firstName[0] || ""}${student.lastName[0] || ""}`.toLocaleUpperCase("ca");
    return `<tr><td data-label="Alumne"><div class="daily-student"><span class="daily-student-avatar" aria-hidden="true">${escapeHtml(initials)}</span><span><strong>${escapeHtml(studentDisplayName(student))}</strong><small>${escapeHtml(getStudentGroupLabel(student))}</small></span></div></td>${selectors}<td data-label="Observació"><input class="daily-followup-note" type="text" maxlength="500" aria-label="Observació de ${escapeHtml(studentDisplayName(student))}" placeholder="Afegeix una observació…" value="${escapeHtml(assessment?.note || "")}" data-daily-note data-student-id="${escapeHtml(student.id)}"></td></tr>`;
  }).join("");
  content.innerHTML = `<header class="daily-followup-header"><span class="daily-followup-header-icon">${icon("calendar")}</span><div><p class="eyebrow">SEGUIMENT FORMATIU</p><h1>Seguiment diari</h1><p class="page-subtitle">Observa el progrés de cada alumne sessió a sessió. Les dades es desen automàticament al dispositiu.</p></div></header>
    <section class="panel daily-followup-toolbar">
      <div class="daily-followup-toolbar-heading"><div><h2 class="section-title">Defineix la sessió</h2><span class="section-caption">Tria l'assignatura, la data i el grup que vols observar.</span></div>${icon("filter-list", "daily-followup-toolbar-icon")}</div>
      <div class="daily-followup-filters">
        <label class="daily-followup-filter"><span>Assignatura</span><select id="daily-subject-filter" class="search-input">${subjectOptions}</select></label>
        <label class="daily-followup-filter"><span>Data de la sessió</span><input id="daily-date-filter" class="search-input" type="date" value="${escapeHtml(state.dailySelectedDate)}"></label>
        ${groups.length ? `<label class="daily-followup-filter"><span>Grup classe</span><select id="daily-group-filter" class="search-input">${groupOptions}</select></label>` : ""}
        ${subgroups.length ? `<label class="daily-followup-filter"><span>Desdoblament</span><select id="daily-subgroup-filter" class="search-input">${subgroupOptions}</select></label>` : ""}
      </div>
    </section>
    <div class="daily-followup-stat-grid">
      <article class="daily-followup-stat"><span class="daily-followup-stat-icon">${icon("group")}</span><div><span class="daily-followup-stat-label">Alumnes amb seguiment</span><strong><span id="daily-observed-count">${recordedCount}</span><small> / ${students.length}</small></strong></div></article>
      <article class="daily-followup-stat"><span class="daily-followup-stat-icon daily-average-icon">${icon("stats-report")}</span><div><span class="daily-followup-stat-label">Mitjana dels indicadors</span><strong id="daily-average">${average === null ? "—" : `${average.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}<small>${average === null ? "" : " / 4"}</small></strong></div></article>
    </div>
    <section class="panel daily-followup-panel">
      <div class="daily-followup-panel-heading"><div><p class="eyebrow">${escapeHtml(formatDate(state.dailySelectedDate))}</p><h2>${escapeHtml(subject.name)}</h2><span class="section-caption">${escapeHtml(selectedGroup?.name || "Tots els grups")}${state.dailySelectedSubgroupId ? ` · ${escapeHtml(selectedGroup.subgroups.find(item => item.id === state.dailySelectedSubgroupId)?.name || "")}` : ""} · ${students.length} ${students.length === 1 ? "alumne" : "alumnes"}</span></div><span class="daily-followup-save-hint"><span class="daily-followup-save-dot"></span> Es desa automàticament</span></div>
      ${students.length ? `<div class="table-wrap daily-followup-table-wrap"><table class="assessment-table daily-followup-table"><thead><tr><th>Alumne</th>${DAILY_FOLLOWUP_CRITERIA.map(criterion => `<th>${criterion.name}<small class="daily-followup-scale">1–4 · nivell</small></th>`).join("")}<th>Observació</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state"><strong>${classGroupIds.length ? "No hi ha alumnes en aquesta selecció" : "L'assignatura no té grups assignats"}</strong>${classGroupIds.length ? "Tria un altre grup classe o desdoblament per veure els alumnes." : "Edita l'assignatura i assigna-hi un nivell i un grup classe."}</div>`}
    </section>`;
}

function getClassGroup(classGroupId) {
  return data.classGroups.find(classGroup => classGroup.id === classGroupId);
}

function getStudentGroupLabel(student) {
  const classGroup = getClassGroup(student.classGroupId);
  const subgroup = classGroup?.subgroups.find(item => item.id === student.subgroupId);
  return [classGroup?.name, subgroup?.name].filter(Boolean).join(" · ") || "Sense grup classe";
}

function classGroupOptions(selectedId = "", includeUnassigned = true) {
  return `${includeUnassigned ? '<option value="">Sense grup classe</option>' : ""}${data.classGroups.map(classGroup => `<option value="${escapeHtml(classGroup.id)}" ${selectedId === classGroup.id ? "selected" : ""}>${escapeHtml(classGroup.name)}</option>`).join("")}`;
}

function subgroupOptions(classGroupId, selectedId = "") {
  const subgroups = getClassGroup(classGroupId)?.subgroups || [];
  return `<option value="">Grup classe sencer</option>${subgroups.map(subgroup => `<option value="${escapeHtml(subgroup.id)}" ${selectedId === subgroup.id ? "selected" : ""}>${escapeHtml(subgroup.name)}</option>`).join("")}`;
}

function pageHeading(eyebrow, title, subtitle, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ""}</div>`;
}

function renderOverview() {
  const recentActivities = [...data.activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const competencyAverages = data.competencies.map(competency => {
    const grades = data.students.map(student => getCompetencyGrade(student.id, competency.id)).filter(grade => grade !== null);
    return { competency, average: grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null, count: grades.length };
  });
  content.innerHTML = `
    <section class="welcome-panel">
      <div class="welcome-copy">
        <p class="eyebrow">AVALUACIÓ AMB SENTIT</p>
        <h1>Aprendre és més que una nota.</h1>
        <p>Connecta les evidències de classe amb les competències i acompanya el progrés de cada alumne.</p>
        <button class="button" type="button" data-action="create-activity">${icon("plus")} Crea una activitat</button>
      </div>
    </section>
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-top"><span>Alumnes</span>${icon("group", "metric-icon")}</div><div class="metric-value">${data.students.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Competències</span>${icon("brain", "metric-icon")}</div><div class="metric-value">${data.competencies.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Activitats</span>${icon("list-select", "metric-icon")}</div><div class="metric-value">${data.activities.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Evidències avaluades</span>${icon("stats-report", "metric-icon")}</div><div class="metric-value">${data.assessments.reduce((sum, assessment) => sum + Object.values(assessment.levels).filter(level => level > 0).length, 0)}</div></div>
    </div>
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-heading"><div><h2 class="section-title">Activitat recent</h2><span class="section-caption">Les últimes evidències recollides</span></div><button class="text-button" data-navigate="activities">Veure-ho tot ${icon("arrow-right")}</button></div>
        ${recentActivities.length ? recentActivities.map(activity => `<div class="activity-row">${icon(activity.type === "Prova" ? "clipboard-check" : "notes", "activity-icon")}<div class="activity-info"><strong>${escapeHtml(activity.title)}</strong><span>${escapeHtml(activity.type)} · ${formatDate(activity.date)} · ${activity.evidences.length} evidències</span></div><button class="text-button" data-open-activity="${activity.id}">Avaluar</button></div>`).join("") : emptyState("Encara no hi ha activitats", "Crea una activitat per començar a recollir evidències.", "create-activity", "Crea una activitat")}
      </section>
      <section class="panel">
        <div class="panel-heading"><div><h2 class="section-title">Progrés competencial</h2><span class="section-caption">Mitjana de les evidències disponibles</span></div><button class="text-button" data-navigate="competencies">Veure-ho tot ${icon("arrow-right")}</button></div>
        ${competencyAverages.length ? competencyAverages.map(({ competency, average, count }) => `<div class="competency-row"><strong>${escapeHtml(competency.name)}</strong><div class="progress-track"><div class="progress-fill ${gradeColorClass(average)}" style="width:${gradeWidth(average)}%"></div></div><div class="progress-meta"><span>${count ? `${count} alumnes amb evidències` : "Sense evidències"}</span><span>${average === null ? "—" : gradeValue(average)}</span></div></div>`).join("") : emptyState("Sense competències", "Afegeix les competències que vols avaluar.", "create-competency", "Crea una competència")}
      </section>
    </div>`;
}

function emptyState(title, text, action, actionLabel) {
  return `<div class="empty-state"><strong>${title}</strong>${text}<br><button class="button" type="button" data-action="${action}">${icon("plus")} ${actionLabel}</button></div>`;
}

function renderStudents() {
  const filtered = data.students.filter(student => {
    const matchesQuery = `${studentDisplayName(student)} ${getStudentGroupLabel(student)}`.toLocaleLowerCase("ca").includes(state.studentQuery.toLocaleLowerCase("ca"));
    const matchesClass = !state.selectedClassGroupId || student.classGroupId === state.selectedClassGroupId;
    const matchesSubgroup = !state.selectedSubgroupId || student.subgroupId === state.selectedSubgroupId;
    return matchesQuery && matchesClass && matchesSubgroup;
  });
  const subgroupFilter = state.selectedClassGroupId && getClassGroup(state.selectedClassGroupId)?.subgroups.length
    ? `<select class="search-input group-filter" id="subgroup-filter" aria-label="Filtra per desdoblament">${subgroupOptions(state.selectedClassGroupId, state.selectedSubgroupId)}</select>`
    : "";
  const action = `<select class="search-input group-filter" id="class-group-filter" aria-label="Filtra per grup classe">${classGroupOptions(state.selectedClassGroupId)}</select>${subgroupFilter}<input class="search-input" id="student-search" type="search" placeholder="Cerca un alumne…" value="${escapeHtml(state.studentQuery)}" aria-label="Cerca un alumne"><button class="button button-primary" type="button" data-action="create-student">${icon("plus")} Afegeix alumne</button>`;
  content.innerHTML = `${pageHeading("GRUP I SEGUIMENT", "Alumnes", "Consulta els perfils i el progrés competencial del teu grup.", action)}
    ${filtered.length ? `<ul class="student-list">${filtered.map(student => {
      const grades = data.competencies.map(competency => getCompetencyGrade(student.id, competency.id)).filter(grade => grade !== null);
      const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
      const evidenceCount = getStudentActivityCount(student.id);
      return `<li class="student-list-item"><button class="student-list-open" type="button" data-open-student="${student.id}"><span class="student-list-identity"><strong>${escapeHtml(studentDisplayName(student))}</strong><span>${escapeHtml(getStudentGroupLabel(student))} · ${evidenceCount} ${evidenceCount === 1 ? "activitat" : "activitats"}</span></span><span class="student-list-grade"><span class="student-list-grade-label">Mitjana competencial</span>${gradeBadge(average)}</span></button><button class="text-button student-list-edit" type="button" data-edit-student="${student.id}">Edita alumne</button></li>`;
    }).join("")}</ul>` : emptyState(data.students.length ? "No hi ha coincidències" : "Encara no hi ha alumnes", data.students.length ? "Prova una altra cerca." : "Afegeix el teu primer alumne per començar.", "create-student", "Afegeix alumne")}`;
  document.querySelector("#class-group-filter")?.addEventListener("change", event => {
    state.selectedClassGroupId = event.target.value;
    state.selectedSubgroupId = "";
    renderStudents();
  });
  document.querySelector("#subgroup-filter")?.addEventListener("change", event => {
    state.selectedSubgroupId = event.target.value;
    renderStudents();
  });
  document.querySelector("#student-search")?.addEventListener("input", event => {
    state.studentQuery = event.target.value;
    const cursor = event.target.selectionStart;
    renderStudents();
    const updatedSearch = document.querySelector("#student-search");
    updatedSearch?.focus();
    updatedSearch?.setSelectionRange(cursor, cursor);
  });
}

function renderStudentDetail() {
  const student = data.students.find(item => item.id === state.selectedStudentId);
  if (!student) { state.selectedStudentId = null; renderStudents(); return; }
  const competencies = data.competencies.map(competency => {
    const grade = getCompetencyGrade(student.id, competency.id);
    const evidenceCount = data.activities.reduce((sum, activity) => {
      if (!isActivityIncludedInStudentGrades(data, student.id, activity.id)) return sum;
      const assessment = getAssessment(student.id, activity.id);
      return sum + activity.evidences.filter(evidence => Number(evidence.contributions[competency.id]) > 0 && assessment?.levels[evidence.id] > 0).length;
    }, 0);
    return `<div class="student-competency"><strong>${escapeHtml(competency.name)}</strong><div class="progress-track"><div class="progress-fill ${gradeColorClass(grade)}" style="width:${gradeWidth(grade)}%"></div></div><div class="progress-meta"><span>${evidenceCount} ${evidenceCount === 1 ? "evidència" : "evidències"}</span><span>${grade === null ? "Sense evidències" : gradeValue(grade)}</span></div></div>`;
  }).join("");
  const activities = data.activities.filter(activity =>
    isActivityIncludedInStudentGrades(data, student.id, activity.id) &&
    activity.evidences.some(evidence => getAssessment(student.id, activity.id)?.levels[evidence.id] > 0)
  );
  content.innerHTML = `<button class="detail-back" type="button" data-back="students">${icon("arrow-left")} Torna als alumnes</button>
    ${pageHeading("PERFIL D'ALUMNE", escapeHtml(studentDisplayName(student)), `${getStudentGroupLabel(student)} · Seguiment de les competències`, `<button class="button" type="button" data-edit-student="${student.id}">Edita alumne</button>`)}
    <section class="panel"><div class="panel-heading"><div><h2 class="section-title">Progrés per competència</h2><span class="section-caption">Càlcul ponderat a partir de les evidències</span></div></div>
      ${competencies ? `<div class="student-detail-grid">${competencies}</div>` : emptyState("Sense competències", "Crea una competència per consultar el progrés.")}</section>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><div><h2 class="section-title">Evidències recents</h2><span class="section-caption">Activitats amb evidències avaluades</span></div></div>
      ${activities.length ? activities.map(activity => `<div class="activity-row">${icon(activity.type === "Prova" ? "clipboard-check" : "notes", "activity-icon")}<div class="activity-info"><strong>${escapeHtml(activity.title)}</strong><span>${formatDate(activity.date)} · ${activity.evidences.filter(evidence => getAssessment(student.id, activity.id)?.levels[evidence.id] > 0).length} evidències avaluades</span></div>${gradeBadge(getActivityGrade(student.id, activity))}</div>`).join("") : emptyState("Encara no hi ha evidències", "Avalua aquest alumne en una activitat per començar.")}</section>`;
}

function renderActivities() {
  const sorted = [...data.activities].sort((a, b) => b.date.localeCompare(a.date));
  const action = `<button class="button button-primary" type="button" data-action="create-activity">${icon("plus")} Crea activitat</button>`;
  content.innerHTML = `${pageHeading("EVIDÈNCIES D'APRENENTATGE", "Activitats i proves", "Cada activitat inclou una rúbrica vinculada a les competències.", action)}
    ${sorted.length ? `<div class="card-list">${sorted.map(activity => {
      const eligibleStudents = data.students.filter(student => isActivityIncludedInStudentGrades(data, student.id, activity.id));
      const grades = eligibleStudents.map(student => getActivityGrade(student.id, activity)).filter(grade => grade !== null);
      const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
      const passRate = grades.length ? grades.filter(grade => grade >= 5).length / grades.length * 100 : null;
      const evaluatedRate = eligibleStudents.length ? grades.length / eligibleStudents.length * 100 : null;
      const metric = (label, value, width, detail = "", colorClass = "") => `<div class="activity-metric"><div class="activity-metric-heading"><span>${label}</span><strong class="${colorClass}">${value}</strong></div><div class="progress-track"><div class="progress-fill ${colorClass}" style="width:${width}%"></div></div>${detail ? `<span class="activity-metric-detail">${detail}</span>` : ""}</div>`;
      return `<article class="activity-card" data-open-activity="${escapeHtml(activity.id)}" tabindex="0" role="button" aria-label="Obre l'activitat ${escapeHtml(activity.title)}">
        <div class="activity-card-main">${icon(activity.type === "Prova" ? "clipboard-check" : "notes", "activity-icon")}<div class="activity-info"><strong>${escapeHtml(activity.title)} <span class="badge activity-type ${activity.type === "Prova" ? "gold" : ""}">${escapeHtml(activity.type)}</span></strong><span>${formatDate(activity.date)} · ${activity.evidences.length} evidències</span></div></div>
        <div class="activity-metrics">${metric("Mitjana", formatGradeWithCode(average), gradeWidth(average), "", gradeColorClass(average))}${metric("Aprovats", passRate === null ? "—" : `${Math.round(passRate)}%`, passRate || 0, passRate === null ? "Sense avaluacions" : "De l'alumnat avaluat")}${metric("Avaluats", evaluatedRate === null ? "—" : `${Math.round(evaluatedRate)}%`, evaluatedRate || 0, `${grades.length}/${eligibleStudents.length} alumnes no exempts`)}</div>
      </article>`;
    }).join("")}</div>` : emptyState("Encara no hi ha activitats", "Crea una prova o un projecte amb evidències vinculades a competències.", "create-activity", "Crea una activitat")}`;
}

function getActivityDashboardMarkup(activity, students) {
  const eligibleStudents = students.filter(student =>
    !isStudentExemptFromActivity(data, student.id, activity.id) &&
    !isStudentExemptFromSubjectForActivity(data, student.id, activity.id, state.selectedSubjectId)
  );
  const grades = eligibleStudents
    .map(student => ({ student, grade: getActivityGrade(student.id, activity) }))
    .filter(result => result.grade !== null);
  const values = grades.map(result => result.grade);
  const count = values.length;
  const average = count ? values.reduce((sum, grade) => sum + grade, 0) / count : null;
  const sortedGrades = [...values].sort((a, b) => a - b);
  const median = count
    ? (sortedGrades[Math.floor((count - 1) / 2)] + sortedGrades[Math.floor(count / 2)]) / 2
    : null;
  const standardDeviation = count
    ? Math.sqrt(values.reduce((sum, grade) => sum + (grade - average) ** 2, 0) / count)
    : null;
  const passRate = count ? values.filter(grade => grade >= 5).length / count * 100 : null;
  const metric = (label, value, detail = "") => `<div class="activity-insight-metric"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</div>`;
  const chart = buildActivityDistributionChart(grades, average, standardDeviation);

  return `<div class="activity-insight-metrics">
      ${metric("Mitjana", average === null ? "—" : formatGradeWithCode(average))}
      ${metric("Mediana", median === null ? "—" : formatGradeWithCode(median))}
      ${metric("Aprovats", passRate === null ? "—" : `${Math.round(passRate)}%`, count ? `${values.filter(grade => grade >= 5).length} de ${count} avaluats` : "")}
      ${metric("Avaluats", `${count}/${eligibleStudents.length}`, eligibleStudents.length ? `${Math.round(count / eligibleStudents.length * 100)}% de l'alumnat no exempt` : "")}
    </div>
    <div class="activity-distribution-heading"><div><h3>Distribució de les notes</h3><span class="section-caption">L’alumnat avaluat en comparació amb una campana de Gauss de referència</span></div>${standardDeviation === null ? "" : `<span class="activity-distribution-spread">Desviació estàndard: ${formatGrade(standardDeviation)}</span>`}</div>
    ${chart}`;
}

function buildActivityDistributionChart(grades, average, standardDeviation) {
  const width = 720;
  const height = 254;
  const left = 44;
  const right = 700;
  const plotWidth = right - left;
  const baseline = 143;
  const maxCurveHeight = 99;
  const binWidth = 1;
  const ticks = Array.from({ length: 6 }, (_, index) => {
    const grade = index * 2;
    const x = left + grade / 10 * plotWidth;
    return `<line class="activity-distribution-tick" x1="${x}" y1="${baseline}" x2="${x}" y2="${baseline + 4}"></line><text class="activity-distribution-axis-label" x="${x}" y="${baseline + 17}" text-anchor="middle">${grade}</text>`;
  }).join("");
  if (!grades.length) {
    return `<div class="activity-distribution-chart-wrap"><svg class="activity-distribution-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Encara no hi ha notes d’activitat per representar">
      <line class="activity-distribution-axis" x1="${left}" y1="${baseline}" x2="${right}" y2="${baseline}"></line>${ticks}
      <text class="activity-distribution-empty-label" x="${width / 2}" y="80" text-anchor="middle">Encara no hi ha notes d’activitat per representar</text>
    </svg></div>
    <div class="activity-distribution-legend"><span><i class="activity-legend-bar"></i> Distribució real</span><span><i class="activity-legend-line"></i> Campana de Gauss de referència</span><span><i class="activity-legend-dot"></i> Cada punt és un alumne</span></div>
    <p class="activity-distribution-note">Les notes de l’alumnat apareixeran en aquesta distribució quan registris les primeres avaluacions.</p>`;
  }

  const counts = Array(10).fill(0);
  grades.forEach(({ grade }) => counts[Math.min(9, Math.floor(grade))]++);

  const sigma = standardDeviation > 0 ? standardDeviation : 0.25;
  const gaussian = index => {
    const x = index + 0.5;
    return grades.length * binWidth / (sigma * Math.sqrt(2 * Math.PI)) *
      Math.exp(-0.5 * ((x - average) / sigma) ** 2);
  };
  const maxValue = Math.max(1, ...counts, ...counts.map((_, index) => gaussian(index)));
  const curve = Array.from({ length: 101 }, (_, index) => {
    const grade = index / 10;
    const density = grades.length / (sigma * Math.sqrt(2 * Math.PI)) *
      Math.exp(-0.5 * ((grade - average) / sigma) ** 2);
    const x = left + grade / 10 * plotWidth;
    const y = baseline - density / maxValue * maxCurveHeight;
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const bars = counts.map((value, index) => {
    const barWidth = plotWidth / 10 * 0.68;
    const x = left + (index + 0.16) * plotWidth / 10;
    const barHeight = value / maxValue * maxCurveHeight;
    return `<rect class="activity-distribution-bar" x="${x.toFixed(1)}" y="${(baseline - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="3"><title>${index}–${index + 1}: ${value} alumnes</title></rect>`;
  }).join("");
  const dotsByBin = Array(10).fill(0);
  const studentPoints = grades.map(({ student, grade }) => {
    const bin = Math.min(9, Math.floor(grade));
    const position = dotsByBin[bin]++;
    const jitter = (position % 7 - 3) * 3.2;
    const row = Math.floor(position / 7);
    const x = Math.max(left + 3, Math.min(right - 3, left + grade / 10 * plotWidth + jitter));
    const y = 168 + row * 6;
    return `<circle class="activity-distribution-student ${gradeColorClass(grade)}" cx="${x.toFixed(1)}" cy="${y}" r="3.1"><title>${escapeHtml(studentDisplayName(student))}: ${formatGradeWithCode(grade)}</title></circle>`;
  }).join("");
  return `<div class="activity-distribution-chart-wrap">
    <svg class="activity-distribution-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-labelledby="activity-distribution-title activity-distribution-description">
      <title id="activity-distribution-title">Distribució de notes de l’activitat</title>
      <desc id="activity-distribution-description">${grades.length} alumnes avaluats. Les barres mostren la distribució real, la línia mostra una campana de Gauss ajustada a la mitjana i la desviació estàndard, i cada punt representa un alumne.</desc>
      ${bars}<path class="activity-distribution-gaussian" d="${curve}"></path>
      <line class="activity-distribution-axis" x1="${left}" y1="${baseline}" x2="${right}" y2="${baseline}"></line>${ticks}
      ${studentPoints}
    </svg>
  </div>
  <div class="activity-distribution-legend"><span><i class="activity-legend-bar"></i> Distribució real</span><span><i class="activity-legend-line"></i> Campana de Gauss de referència</span><span><i class="activity-legend-dot"></i> Cada punt és un alumne</span></div>
  <p class="activity-distribution-note">La campana és una referència estadística calculada amb les notes actuals; no és una nota esperada ni un llindar d’avaluació. Passa el cursor per un punt per veure l’alumne i la seva nota.</p>`;
}

function renderActivityDetail() {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity) { state.selectedActivityId = null; renderActivities(); return; }
  const selectedLevel = data.subjects
    .find(subject => subject.id === state.selectedSubjectId)
    ?.levels.find(level => level.id === state.selectedLevelId);
  const students = selectedLevel
    ? data.students.filter(student => selectedLevel.classGroupIds.includes(student.classGroupId))
    : data.students;
  const rows = students.map(student => {
    const assessment = getAssessment(student.id, activity.id);
    const activityExempt = isStudentExemptFromActivity(data, student.id, activity.id);
    const subjectExempt = isStudentExemptFromSubjectForActivity(data, student.id, activity.id, state.selectedSubjectId);
    const exempt = activityExempt || subjectExempt;
    const selectors = activity.evidences.map(evidence => {
      const selectedLevel = assessment?.levels[evidence.id] ?? 0;
      return `<td><select class="grade-select ${gradeColorClass(selectedLevel ? SCORE_BY_LEVEL[selectedLevel] : null)}" aria-label="${escapeHtml(studentDisplayName(student))}: ${escapeHtml(evidence.name)}" data-assess-student="${escapeHtml(student.id)}" data-evidence="${escapeHtml(evidence.id)}" ${exempt ? "disabled" : ""}>
        ${LEVEL_LABELS.map((label, index) => `<option class="${gradeColorClass(index ? SCORE_BY_LEVEL[index] : null)}" value="${index}" ${selectedLevel === index ? "selected" : ""}>${index === 0 ? label : `${index} · ${label} (${formatGradeWithCode(SCORE_BY_LEVEL[index])})`}</option>`).join("")}
      </select></td>`;
    }).join("");
    const activityGrade = getActivityGrade(student.id, activity);
    const didNotPass = activityGrade !== null && activityGrade < 5;
    const exemptionLabel = subjectExempt ? "Exempt/a de l'assignatura" : "Exempt/a de l'activitat";
    return `<tr data-assessment-row="${escapeHtml(student.id)}" data-student-name="${escapeHtml(studentDisplayName(student))}" data-student-group="${escapeHtml(getStudentGroupLabel(student))}" data-class-group="${escapeHtml(student.classGroupId)}" data-grade-value="${activityGrade ?? ""}" data-exempt="${exempt ? "true" : "false"}" class="${didNotPass ? "assessment-row-warning" : ""}"><td><strong>${escapeHtml(studentDisplayName(student))}</strong><br><span class="assessment-student-group">${escapeHtml(getStudentGroupLabel(student))}</span><span class="assessment-warning" data-warning-for="${escapeHtml(student.id)}" ${didNotPass ? "" : "hidden"}>No assoleix l'activitat</span></td><td class="activity-grade-cell" data-grade-for="${escapeHtml(student.id)}">${exempt ? `<span class="badge exemption-badge">${exemptionLabel}</span>` : gradeBadge(activityGrade)}</td><td><label class="exemption-control"><input type="checkbox" data-activity-exemption="${escapeHtml(activity.id)}" data-student-id="${escapeHtml(student.id)}" aria-label="Exempció d'activitat per a ${escapeHtml(studentDisplayName(student))}" ${activityExempt ? "checked" : ""}><span>Exempt</span></label></td>${selectors}</tr>`;
  }).join("");
  const rubricRows = activity.evidences.map(evidence => {
    const contributions = Object.entries(evidence.contributions).map(([competencyId, weight]) => {
      const competency = data.competencies.find(item => item.id === competencyId);
      return competency ? `<span class="badge">${escapeHtml(competency.name)} · ${Number(weight)}%</span>` : "";
    }).join(" ");
    const summary = getEvidenceSummary(evidence, students, activity);
    return `<tr><td><strong>${escapeHtml(evidence.name)}</strong><br><span class="section-caption">Pes derivat per a l'activitat: ${getEvidenceActivityWeight(evidence)}%</span></td><td>${contributions || '<span class="grade-empty">Sense competències vinculades</span>'}</td><td data-evidence-progress="${escapeHtml(evidence.id)}">${summary.progress}</td><td data-evidence-average="${escapeHtml(evidence.id)}">${gradeBadge(summary.average)}</td></tr>`;
  }).join("");
  const totalEvidenceWeight = activity.evidences.reduce((total, evidence) => total + getEvidenceActivityWeight(evidence), 0);
  const evidenceWeightWarning = Math.abs(totalEvidenceWeight - 100) > 0.001
    ? `<div class="rubric-weight-warning" role="status">La suma dels pesos de totes les evidències és ${totalEvidenceWeight.toLocaleString("ca-ES", { maximumFractionDigits: 2 })}%, no 100%. Revisa les contribucions a les competències.</div>`
    : "";
  content.innerHTML = `<button class="detail-back" type="button" data-back="activities">${icon("arrow-left")} ${state.activityReturnToSequence ? "Torna a la seqüència" : "Torna a les activitats"}</button>
    ${pageHeading(escapeHtml(activity.type.toUpperCase()), escapeHtml(activity.title), `${formatDate(activity.date)} · ${selectedLevel ? `${escapeHtml(selectedLevel.name)} · ` : ""}Selecciona el nivell assolit per cada alumne i evidència.`, `<button class="button" type="button" data-edit-activity="${activity.id}">Edita activitat i rúbrica</button>`)}
    <section class="panel activity-insights-panel" data-activity-dashboard><div class="panel-heading"><div><h2 class="section-title">Resum de l’activitat</h2><span class="section-caption">Indicadors i distribució de les notes de l’alumnat</span></div></div><div data-activity-insight-content>${getActivityDashboardMarkup(activity, students)}</div></section>
    <section class="panel"><div class="panel-heading"><div><h2 class="section-title">Rúbrica de l'activitat</h2><span class="section-caption">Evidències observables, competències i nivells d'assoliment</span></div></div>
      ${evidenceWeightWarning}
      ${activity.evidences.length ? `<div class="table-wrap"><table class="assessment-table rubric-table"><thead><tr><th>Evidència</th><th>Competències i pesos</th><th>Progrés d'avaluació</th><th>Nota mitjana</th></tr></thead><tbody>${rubricRows}</tbody></table></div>` : '<div class="empty-state">Aquesta activitat encara no té evidències.</div>'}
    </section>
    <section class="panel assessment-panel"><div class="panel-heading"><div><h2 class="section-title">Avaluació de l'alumnat</h2><span class="section-caption">Selecciona el nivell assolit per cada alumne i evidència. Les notes es calculen automàticament.</span></div></div>
      ${students.length ? `<div class="activity-assessment-sticky-tools"><div class="activity-assessment-controls">
        <input class="search-input" type="search" data-assessment-search placeholder="Cerca alumne o grup…" aria-label="Cerca alumne o grup">
        <select class="search-input group-filter" data-assessment-group aria-label="Filtra per grup"><option value="">Tots els grups</option>${[...new Set(students.map(student => student.classGroupId))].map(groupId => {
          const group = getClassGroup(groupId);
          return group ? `<option value="${escapeHtml(groupId)}">${escapeHtml(group.name)}</option>` : "";
        }).join("")}</select>
        <select class="search-input group-filter" data-assessment-status aria-label="Filtra per estat d'avaluació">
            <option value="all">Tots els estats</option><option value="assessed">Avaluats</option><option value="pending">Pendents d'avaluar</option><option value="passed">Aprovats</option><option value="not-passed">No assolits</option><option value="exempt">Exempts</option>
        </select>
        <select class="search-input group-filter" data-assessment-sort aria-label="Ordena alumnat">
          <option value="name-asc">Nom A–Z</option><option value="name-desc">Nom Z–A</option><option value="group-asc">Grup</option><option value="grade-desc">Nota més alta</option><option value="grade-asc">Nota més baixa</option>
        </select>
        <span class="activity-assessment-count" data-assessment-count aria-live="polite"></span>
      </div>
      <div class="activity-scroll-proxy" data-activity-scroll-proxy role="region" aria-label="Desplaçament horitzontal de la taula d'avaluació" tabindex="0"><div class="activity-scroll-spacer"></div></div></div>` : ""}
      ${students.length ? `<div class="table-wrap"><table class="assessment-table activity-assessment-table"><thead><tr><th>Alumne</th><th class="activity-grade-cell">Nota d'activitat</th><th>Exempció</th>${activity.evidences.map(evidence => `<th>${escapeHtml(evidence.name)}<br><span style="font-weight:400">${getEvidenceActivityWeight(evidence)}% de la nota</span></th>`).join("")}</tr></thead><tbody>${rows}</table></div>` : emptyState(selectedLevel ? "Sense alumnes en aquest nivell" : "Afegeix alumnes primer", selectedLevel ? "Assigna els alumnes als grups classe d'aquest nivell per poder-los avaluar." : "Necessites alumnes per registrar les seves evidències.", "create-student", "Afegeix alumne")}
      ${students.length ? '<p class="activity-assessment-empty" data-assessment-empty hidden>No hi ha alumnes que coincideixin amb aquests filtres.</p>' : ""}
      <div class="grade-legend" aria-label="Llegenda de colors de les qualificacions"><span class="grade-warning">Menys de 5 · No assolit</span><span class="grade-developing">5–6,9 · En procés</span><span class="grade-achieved">7–8,9 · Assolit</span><span class="grade-advanced">9–10 · Avançat</span></div>
      <p class="table-note">El pes de cada evidència en l'activitat és la suma dels pesos de contribució a les competències que avalua. La nota de l'activitat pondera les evidències amb aquest pes; la nota de cada competència fa servir el pes específic assignat a aquella competència.</p>
    </section>`;
  setupActivityAssessmentTable();
}

function normalizeSearchText(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ca");
}

function getEvidenceSummary(evidence, students, activity) {
  const eligibleStudents = students.filter(student =>
    !isStudentExemptFromActivity(data, student.id, activity.id) &&
    !isStudentExemptFromSubjectForActivity(data, student.id, activity.id, state.selectedSubjectId)
  );
  const grades = eligibleStudents
    .map(student => getAssessment(student.id, activity.id)?.levels[evidence.id])
    .filter(level => Number.isInteger(level) && level > 0 && level < SCORE_BY_LEVEL.length)
    .map(level => SCORE_BY_LEVEL[level]);
  const average = grades.length
    ? grades.reduce((total, grade) => total + grade, 0) / grades.length
    : null;
  const progress = eligibleStudents.length ? Math.round(grades.length / eligibleStudents.length * 100) : 0;
  return {
    average,
    progress: `<div class="evidence-assessment-progress"><div class="progress-track"><div class="progress-fill ${gradeColorClass(average)}" style="width:${progress}%"></div></div><div class="evidence-assessment-meta"><span>${grades.length}/${eligibleStudents.length} avaluats</span><strong>${progress}%</strong></div></div>`
  };
}

function applyActivityAssessmentControls() {
  const search = content.querySelector("[data-assessment-search]");
  const groupFilter = content.querySelector("[data-assessment-group]");
  const statusFilter = content.querySelector("[data-assessment-status]");
  const sortSelect = content.querySelector("[data-assessment-sort]");
  const tableBody = content.querySelector(".activity-assessment-table tbody");
  if (!tableBody || !search || !groupFilter || !statusFilter || !sortSelect) return;

  const query = normalizeSearchText(search.value.trim());
  const rows = [...tableBody.querySelectorAll("[data-assessment-row]")];
  const sort = sortSelect.value;
  const sortedRows = [...rows].sort((a, b) => {
    const gradeA = a.dataset.gradeValue === "" ? null : Number(a.dataset.gradeValue);
    const gradeB = b.dataset.gradeValue === "" ? null : Number(b.dataset.gradeValue);
    if (sort === "grade-asc" || sort === "grade-desc") {
      if (gradeA === null || gradeB === null) return gradeA === gradeB ? 0 : gradeA === null ? 1 : -1;
      return sort === "grade-asc" ? gradeA - gradeB : gradeB - gradeA;
    }
    if (sort === "group-asc") {
      return a.dataset.studentGroup.localeCompare(b.dataset.studentGroup, "ca") ||
        a.dataset.studentName.localeCompare(b.dataset.studentName, "ca");
    }
    const direction = sort === "name-desc" ? -1 : 1;
    return direction * a.dataset.studentName.localeCompare(b.dataset.studentName, "ca");
  });
  const currentOrderMatches = rows.every((row, index) => row === sortedRows[index]);
  if (!currentOrderMatches) {
    const tableWrap = content.querySelector(".activity-assessment-table")?.closest(".table-wrap");
    const tableScrollLeft = tableWrap?.scrollLeft ?? 0;
    const pageScrollX = window.scrollX;
    const pageScrollY = window.scrollY;
    sortedRows.forEach(row => tableBody.append(row));
    if (tableWrap) tableWrap.scrollLeft = tableScrollLeft;
    window.scrollTo(pageScrollX, pageScrollY);
  }

  let visibleCount = 0;
  sortedRows.forEach(row => {
    const grade = row.dataset.gradeValue === "" ? null : Number(row.dataset.gradeValue);
    const status = statusFilter.value;
    const matchesStatus = status === "all" ||
      (status === "exempt" && row.dataset.exempt === "true") ||
      (status === "assessed" && grade !== null) ||
      (status === "pending" && grade === null && row.dataset.exempt !== "true") ||
      (status === "passed" && grade !== null && grade >= 5) ||
      (status === "not-passed" && grade !== null && grade < 5);
    const matchesGroup = !groupFilter.value || row.dataset.classGroup === groupFilter.value;
    const matchesQuery = normalizeSearchText(`${row.dataset.studentName} ${row.dataset.studentGroup}`).includes(query);
    row.hidden = !(matchesStatus && matchesGroup && matchesQuery);
    if (!row.hidden) visibleCount++;
  });
  const count = content.querySelector("[data-assessment-count]");
  if (count) count.textContent = `Mostrant ${visibleCount} de ${sortedRows.length} alumnes`;
  const empty = content.querySelector("[data-assessment-empty]");
  if (empty) empty.hidden = visibleCount > 0;
}

function setupActivityAssessmentTable() {
  activityTableResizeObserver?.disconnect();
  activityTableResizeObserver = null;
  const search = content.querySelector("[data-assessment-search]");
  const controls = content.querySelectorAll("[data-assessment-group], [data-assessment-status], [data-assessment-sort]");
  const proxy = content.querySelector("[data-activity-scroll-proxy]");
  const tableWrap = content.querySelector(".activity-assessment-table")?.closest(".table-wrap");
  const table = tableWrap?.querySelector("table");
  const spacer = proxy?.querySelector(".activity-scroll-spacer");
  if (!table || !proxy || !tableWrap || !spacer) return;

  search?.addEventListener("input", applyActivityAssessmentControls);
  controls.forEach(control => control.addEventListener("change", applyActivityAssessmentControls));
  applyActivityAssessmentControls();

  const syncScrollWidth = () => {
    spacer.style.width = `${table.scrollWidth}px`;
    proxy.hidden = table.scrollWidth <= tableWrap.clientWidth;
    proxy.scrollLeft = tableWrap.scrollLeft;
  };
  proxy.addEventListener("scroll", () => {
    if (tableWrap.scrollLeft !== proxy.scrollLeft) tableWrap.scrollLeft = proxy.scrollLeft;
  });
  tableWrap.addEventListener("scroll", () => {
    if (proxy.scrollLeft !== tableWrap.scrollLeft) proxy.scrollLeft = tableWrap.scrollLeft;
  });
  activityTableResizeObserver = new ResizeObserver(syncScrollWidth);
  activityTableResizeObserver.observe(tableWrap);
  activityTableResizeObserver.observe(table);
  syncScrollWidth();
}

function updateActivityAssessmentRow(studentId, activityGrade) {
  const row = content.querySelector(`[data-assessment-row="${CSS.escape(studentId)}"]`);
  const gradeCell = content.querySelector(`[data-grade-for="${CSS.escape(studentId)}"]`);
  if (!row) return;
  row.dataset.gradeValue = activityGrade === null ? "" : String(activityGrade);
  if (gradeCell) gradeCell.innerHTML = gradeBadge(activityGrade);
  const didNotPass = activityGrade !== null && activityGrade < 5;
  row.classList.toggle("assessment-row-warning", didNotPass);
  const warningLabel = content.querySelector(`[data-warning-for="${CSS.escape(studentId)}"]`);
  if (warningLabel) warningLabel.hidden = !didNotPass;
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (activity) {
    const selectedLevel = data.subjects
      .find(subject => subject.id === state.selectedSubjectId)
      ?.levels.find(level => level.id === state.selectedLevelId);
    const students = selectedLevel
      ? data.students.filter(student => selectedLevel.classGroupIds.includes(student.classGroupId))
      : data.students;
    const insightContent = content.querySelector("[data-activity-insight-content]");
    if (insightContent) insightContent.innerHTML = getActivityDashboardMarkup(activity, students);
    activity.evidences.forEach(evidence => {
      const summary = getEvidenceSummary(evidence, students, activity);
      const progressCell = content.querySelector(`[data-evidence-progress="${CSS.escape(evidence.id)}"]`);
      const averageCell = content.querySelector(`[data-evidence-average="${CSS.escape(evidence.id)}"]`);
      if (progressCell) progressCell.innerHTML = summary.progress;
      if (averageCell) averageCell.innerHTML = gradeBadge(summary.average);
    });
  }
  applyActivityAssessmentControls();
}

function renderCompetencies() {
  const action = `<button class="button button-primary" type="button" data-action="create-competency">${icon("plus")} Crea competència</button>`;
  content.innerHTML = `${pageHeading("OBJECTIUS D'APRENENTATGE", "Competències", "Defineix què vols que l'alumnat sigui capaç de fer i relaciona-hi les evidències.", action)}
    ${data.competencies.length ? `<div class="card-grid">${data.competencies.map(competency => {
      const evidenceCount = data.activities.flatMap(activity => activity.evidences.filter(evidence => Number(evidence.contributions[competency.id]) > 0)).length;
      const grades = data.students.map(student => getCompetencyGrade(student.id, competency.id)).filter(grade => grade !== null);
      const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
      return `<article class="record-card"><div class="record-card-top"><h3>${escapeHtml(competency.name)}</h3><span class="badge">${evidenceCount} ${evidenceCount === 1 ? "evidència" : "evidències"}</span></div><p>${escapeHtml(competency.description || "Sense descripció")}</p><div class="progress-track" style="margin-top:14px"><div class="progress-fill ${gradeColorClass(average)}" style="width:${gradeWidth(average)}%"></div></div><div class="record-footer"><span>Mitjana del grup</span>${gradeBadge(average)}</div><button class="text-button" type="button" data-edit-competency="${competency.id}">Edita competència ${icon("arrow-right")}</button></article>`;
    }).join("")}</div>` : emptyState("Encara no hi ha competències", "Crea les competències que vols treballar i avaluar.", "create-competency", "Crea una competència")}`;
}

function renderClassGroups() {
  const action = `<button class="button button-primary" type="button" data-action="create-class-group">${icon("plus")} Crea grup classe</button>`;
  content.innerHTML = `${pageHeading("ORGANITZACIÓ DE L'ALUMNAT", "Grups classe", "Organitza l'alumnat per classes i crea desdoblaments quan una classe es divideixi en subgrups.", action)}
    ${data.classGroups.length ? `<div class="card-grid">${data.classGroups.map(classGroup => {
      const students = data.students.filter(student => student.classGroupId === classGroup.id);
      return `<article class="record-card"><div class="record-card-top"><div><h3>${escapeHtml(classGroup.name)}</h3><p>${students.length} ${students.length === 1 ? "alumne" : "alumnes"}</p></div><span class="badge">${classGroup.subgroups.length} ${classGroup.subgroups.length === 1 ? "desdoblament" : "desdoblaments"}</span></div>
        ${classGroup.subgroups.length ? `<div class="subgroup-list">${classGroup.subgroups.map(subgroup => {
          const count = students.filter(student => student.subgroupId === subgroup.id).length;
          return `<div class="subgroup-row"><span>${escapeHtml(subgroup.name)}</span><span class="section-caption">${count} ${count === 1 ? "alumne" : "alumnes"}</span></div>`;
        }).join("")}</div>` : '<p class="section-caption">Sense desdoblaments. Afegeix-ne si la classe es divideix en subgrups.</p>'}
        <div class="record-actions"><button class="text-button" type="button" data-filter-class-group="${escapeHtml(classGroup.id)}">Veure alumnes ${icon("arrow-right")}</button><button class="text-button" type="button" data-edit-class-group="${escapeHtml(classGroup.id)}">Edita grup</button><button class="text-button danger-text" type="button" data-delete-class-group="${escapeHtml(classGroup.id)}">Elimina</button></div></article>`;
    }).join("")}</div>` : emptyState("Encara no hi ha grups classe", "Crea un grup classe per organitzar-hi l'alumnat i els desdoblaments.", "create-class-group", "Crea grup classe")}`;
}

function renderSubjects() {
  const action = `<button class="button button-primary" type="button" data-action="create-subject">${icon("plus")} Crea assignatura</button>`;
  content.innerHTML = `${pageHeading("PLANIFICACIÓ DOCENT", "Assignatures", "Organitza les assignatures i defineix per separat els nivells, grups, seqüències i progressos competencials.", action)}
    ${data.subjects.length ? `<div class="card-grid">${data.subjects.map(subject => {
      return `<article class="record-card subject-record-card" data-open-subject="${escapeHtml(subject.id)}" tabindex="0" role="link" aria-label="Obre l'assignatura ${escapeHtml(subject.name)}"><div class="record-card-top"><div><h3>${escapeHtml(subject.name)}</h3><p>${escapeHtml(subject.description || "Sense descripció")}</p></div><span class="badge">${subject.levels.length} ${subject.levels.length === 1 ? "nivell" : "nivells"}</span></div>
        <div class="record-footer"><span>${subject.levels.map(level => escapeHtml(level.name || "Sense nivell")).join(", ") || "Sense nivells definits"}</span></div>
        <div class="record-actions"><span class="text-button subject-open-label">Obre assignatura ${icon("arrow-right")}</span><button class="text-button" type="button" data-edit-subject="${escapeHtml(subject.id)}">Edita assignatura</button></div></article>`;
    }).join("")}</div>` : emptyState("Encara no hi ha assignatures", "Crea una assignatura, assigna-hi grups classe i defineix-ne la seqüència d'activitats.", "create-subject", "Crea assignatura")}`;
}

function renderSubjectDetail() {
  const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
  if (!subject) {
    state.selectedSubjectId = null;
    renderSubjects();
    return;
  }
  const action = `<button class="button button-primary" type="button" data-action="create-level">${icon("plus")} Afegeix nivell</button>`;
  const levelCards = subject.levels.map(level => {
    const groups = level.classGroupIds.map(id => getClassGroup(id)).filter(Boolean);
    const students = data.students.filter(student => level.classGroupIds.includes(student.classGroupId));
    const eligibleStudents = students.filter(student => !isStudentExemptFromSubject(data, student.id, subject.id));
    const competencies = data.competencies.filter(competency => level.competencyIds.includes(competency.id));
    const hours = level.sequence.reduce((total, item) => total + Number(item.hours), 0);
    const grades = eligibleStudents.flatMap(student => competencies.map(competency => getLevelCompetencyGrade(level, student.id, competency.id, subject.id)).filter(grade => grade !== null));
    const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
    const situations = level.situations.length;
    return `<article class="record-card level-record-card" data-open-level="${escapeHtml(level.id)}" tabindex="0" role="link" aria-label="Obre el seguiment de ${escapeHtml(level.name || "el nivell")} de ${escapeHtml(subject.name)}"><div class="record-card-top"><div><h3>${escapeHtml(level.name || "Sense nivell")}</h3><p>${groups.length ? escapeHtml(groups.map(group => group.name).join(", ")) : "Sense grups classe"}</p></div><span class="badge">${groups.length} ${groups.length === 1 ? "grup" : "grups"}</span></div>
      <div class="level-card-metrics"><span>${students.length} ${students.length === 1 ? "alumne" : "alumnes"}</span><span>${level.sequence.length} ${level.sequence.length === 1 ? "activitat" : "activitats"}</span><span>${situations} ${situations === 1 ? "situació" : "situacions"}</span><span>${hours.toLocaleString("ca-ES")} h</span></div>
      <div class="record-footer"><span>Progrés competencial</span>${gradeBadge(average)}</div><div class="record-actions"><span class="text-button subject-open-label">Obre seguiment ${icon("arrow-right")}</span><button class="text-button" type="button" data-open-level-sequence="${escapeHtml(level.id)}">Obre seqüència</button><button class="text-button" type="button" data-edit-level="${escapeHtml(level.id)}">Edita nivell</button></div></article>`;
  }).join("");
  content.innerHTML = `<button class="detail-back" type="button" data-back="subjects">${icon("arrow-left")} Torna a les assignatures</button>
    ${pageHeading("ASSIGNATURA", escapeHtml(subject.name), escapeHtml(subject.description || "Nivells, grups, seqüències i seguiment competencial."), `<button class="button" type="button" data-edit-subject="${escapeHtml(subject.id)}">Edita assignatura</button>${action}`)}
    ${subject.levels.length ? `<div class="card-grid">${levelCards}</div>` : emptyState("Encara no hi ha nivells", "Afegeix un nivell per assignar-hi els grups classe, la seqüència i el progrés competencial.", "create-level", "Afegeix nivell")}`;
}

function renderLevelDetail() {
  const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
  const level = subject?.levels.find(item => item.id === state.selectedLevelId);
  if (!subject || !level) {
    state.selectedLevelId = null;
    renderSubjectDetail();
    return;
  }
  const students = data.students.filter(student => level.classGroupIds.includes(student.classGroupId));
  const groups = level.classGroupIds.map(id => getClassGroup(id)).filter(Boolean);
  const competencies = data.competencies.filter(competency => level.competencyIds.includes(competency.id));
  const totalHours = level.sequence.reduce((total, item) => total + Number(item.hours), 0);
  const sequenceRows = level.sequence.map((item, index) => {
    const activity = data.activities.find(record => record.id === item.activityId);
    if (!activity) return "";
    const contributions = competencies
      .map(competency => ({ competency, weight: Number(item.contributions[competency.id] || 0) }))
      .filter(contribution => contribution.weight > 0)
      .map(({ competency, weight }) => `<span class="badge">${escapeHtml(competency.name)} · ${weight}%</span>`)
      .join(" ");
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(activity.title)}</strong><br><span class="section-caption">${escapeHtml(activity.type)} · ${formatDate(activity.date)}</span></td><td>${Number(item.hours).toLocaleString("ca-ES")} h</td><td>${contributions || '<span class="grade-empty">Sense contribucions configurades</span>'}</td><td><button class="text-button" type="button" data-open-activity="${escapeHtml(activity.id)}">Obre ${icon("arrow-right")}</button></td></tr>`;
  }).join("");
  const competencyRows = competencies.map(competency => {
    const eligibleStudents = students.filter(student => !isStudentExemptFromSubject(data, student.id, subject.id));
    const grades = eligibleStudents.map(student => getLevelCompetencyGrade(level, student.id, competency.id, subject.id)).filter(grade => grade !== null);
    const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
    return `<div class="competency-row"><strong>${escapeHtml(competency.name)}</strong><div class="progress-track"><div class="progress-fill ${gradeColorClass(average)}" style="width:${gradeWidth(average)}%"></div></div><div class="progress-meta"><span>${grades.length}/${eligibleStudents.length} alumnes no exempts amb evidències</span><span>${average === null ? "—" : gradeValue(average)}</span></div></div>`;
  }).join("");
  const studentRows = students.map(student => {
    const exempt = isStudentExemptFromSubject(data, student.id, subject.id);
    return `<tr><td><strong>${escapeHtml(studentDisplayName(student))}</strong><br><span class="section-caption">${escapeHtml(getStudentGroupLabel(student))}</span>${exempt ? '<br><span class="badge exemption-badge">Exempt/a de l’assignatura</span>' : ""}</td><td><label class="exemption-control"><input type="checkbox" data-subject-exemption="${escapeHtml(subject.id)}" data-student-id="${escapeHtml(student.id)}" aria-label="Exempció de l'assignatura per a ${escapeHtml(studentDisplayName(student))}" ${exempt ? "checked" : ""}><span>Exempt</span></label></td>${competencies.map(competency => `<td>${gradeBadge(getLevelCompetencyGrade(level, student.id, competency.id, subject.id))}</td>`).join("")}</tr>`;
  }).join("");
  content.innerHTML = `<button class="detail-back" type="button" data-back="level">${icon("arrow-left")} Torna als nivells de ${escapeHtml(subject.name)}</button>
    ${pageHeading(escapeHtml(level.name.toUpperCase()), escapeHtml(subject.name), "Grups, seqüència d'aprenentatge i progrés competencial d'aquest nivell.", `<button class="button" type="button" data-open-level-sequence>Obre seqüència ${icon("arrow-right")}</button><button class="button" type="button" data-edit-level="${escapeHtml(level.id)}">Edita nivell</button>`)}
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-top"><span>Grups classe</span>${icon("view-grid", "metric-icon")}</div><div class="metric-value">${groups.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Alumnes</span>${icon("group", "metric-icon")}</div><div class="metric-value">${students.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Activitats i proves</span>${icon("list-select", "metric-icon")}</div><div class="metric-value">${level.sequence.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Hores planificades</span>${icon("clock", "metric-icon")}</div><div class="metric-value">${totalHours.toLocaleString("ca-ES")}</div></div>
    </div>
    <section class="panel"><div class="panel-heading"><div><h2 class="section-title">Grups classe</h2><span class="section-caption">${escapeHtml(level.name)} · Alumnat inclòs en aquest nivell</span></div></div>
      ${groups.length ? `<div class="group-chip-list">${groups.map(group => `<span class="badge">${escapeHtml(group.name)} · ${data.students.filter(student => student.classGroupId === group.id).length} alumnes</span>`).join("")}</div>` : '<div class="empty-state">Encara no s’han assignat grups classe.</div>'}</section>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><div><h2 class="section-title">Seqüència d'aprenentatge</h2><span class="section-caption">Les hores són la dedicació prevista. La contribució pesa l'evidència de l'activitat en la nota de cada competència.</span></div><button class="text-button" type="button" data-edit-level="${escapeHtml(level.id)}">Edita seqüència ${icon("arrow-right")}</button></div>
      ${level.sequence.length ? `<div class="table-wrap"><table class="assessment-table subject-sequence-table"><thead><tr><th>#</th><th>Activitat o examen</th><th>Hores</th><th>Contribució a les competències</th><th></th></tr></thead><tbody>${sequenceRows}</tbody><tfoot><tr><th colspan="2">Total d'hores</th><th>${totalHours.toLocaleString("ca-ES")} h</th><th colspan="2"></th></tr></tfoot></table></div>` : emptyState("Seqüència buida", "Edita aquest nivell per afegir activitats i exàmens.", "edit-level", "Edita nivell")}</section>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><div><h2 class="section-title">Progrés competencial</h2><span class="section-caption">Mitjana del grup ponderada per la contribució de cada activitat</span></div></div>
      ${competencyRows || '<div class="empty-state">Aquest nivell encara no té competències assignades. Edita’l per seleccionar-ne.</div>'}</section>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><div><h2 class="section-title">Seguiment de l'alumnat</h2><span class="section-caption">Resultat de cada alumne a les competències d'aquesta assignatura</span></div></div>
      ${students.length ? `<div class="table-wrap"><table class="assessment-table subject-student-table"><thead><tr><th>Alumne</th><th>Exempció</th>${competencies.map(competency => `<th>${escapeHtml(competency.name)}</th>`).join("")}</tr></thead><tbody>${studentRows}</tbody></table></div>` : `<div class="empty-state"><strong>Sense dades per mostrar</strong>Assigna alumnes a un grup classe d'aquest nivell.</div>`}</section>`;
}

function renderLevelSequence() {
  const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
  const level = subject?.levels.find(item => item.id === state.selectedLevelId);
  if (!subject || !level) {
    state.selectedSequence = false;
    state.selectedLevelId = null;
    renderSubjectDetail();
    return;
  }
  const competencies = data.competencies.filter(competency => level.competencyIds.includes(competency.id));
  const situations = new Map(level.situations.map(name => [name, []]));
  for (const item of level.sequence) {
    const name = item.situation || "Situació d'aprenentatge 1";
    if (!situations.has(name)) situations.set(name, []);
    situations.get(name).push(item);
  }
  const totalHours = level.sequence.reduce((total, item) => total + Number(item.hours), 0);
  const situationCards = [...situations].map(([name, items], situationIndex) => {
    const activityCards = items.map(item => {
      const activity = data.activities.find(record => record.id === item.activityId);
      if (!activity) return "";
      const sequenceNumber = level.sequence.indexOf(item) + 1;
      const contributions = competencies
        .filter(competency => Number(item.contributions[competency.id] || 0) > 0)
        .map(competency => `<span class="badge">${escapeHtml(competency.name)} · ${Number(item.contributions[competency.id])}%</span>`)
        .join(" ");
      return `<article class="sequence-activity">
        <div class="sequence-activity-number">${String(sequenceNumber).padStart(2, "0")}</div>
        <div class="sequence-activity-copy"><h3>${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.type)} · ${formatDate(activity.date)}</p>${contributions ? `<div class="sequence-contributions">${contributions}</div>` : '<span class="grade-empty">Sense contribucions configurades</span>'}</div>
        <div class="sequence-activity-meta"><span>${Number(item.hours).toLocaleString("ca-ES")} h</span><button class="text-button" type="button" data-open-activity="${escapeHtml(activity.id)}">Obre activitat ${icon("arrow-right")}</button></div>
      </article>`;
    }).join("");
    const hours = items.reduce((total, item) => total + Number(item.hours), 0);
    return `<section class="sequence-situation">
      <div class="sequence-situation-heading"><div><span class="section-caption">SITUACIÓ D'APRENENTATGE ${situationIndex + 1}</span><h2>${escapeHtml(name)}</h2></div><span class="badge">${items.length} ${items.length === 1 ? "activitat" : "activitats"} · ${hours.toLocaleString("ca-ES")} h</span></div>
      <div class="sequence-activity-list">${activityCards || '<p class="sequence-empty">Encara no hi ha activitats en aquesta situació.</p>'}</div>
      <button class="button sequence-add-activity" type="button" data-add-situation-activity="${escapeHtml(name)}">${icon("plus")} Afegeix activitat a aquesta situació</button>
    </section>`;
  }).join("");
  content.innerHTML = `<button class="detail-back" type="button" data-back="levels">${icon("arrow-left")} Torna als nivells de ${escapeHtml(subject.name)}</button>
    ${pageHeading("SEQÜÈNCIA D'APRENENTATGE", escapeHtml(level.name || "Sense nivell"), escapeHtml(subject.name), `<button class="button" type="button" data-open-level-progress>Seguiment del nivell</button><button class="button" type="button" data-add-learning-situation>${icon("plus")} Afegeix situació</button><button class="button button-primary" type="button" data-edit-level="${escapeHtml(level.id)}">${icon("edit-pencil")} Edita seqüència</button>`)}
    <div class="metric-grid sequence-metrics">
      <div class="metric-card"><div class="metric-top"><span>Situacions d'aprenentatge</span>${icon("book-stack", "metric-icon")}</div><div class="metric-value">${situations.size}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Activitats i proves</span>${icon("list-select", "metric-icon")}</div><div class="metric-value">${level.sequence.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Hores planificades</span>${icon("clock", "metric-icon")}</div><div class="metric-value">${totalHours.toLocaleString("ca-ES")}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Grups classe</span>${icon("view-grid", "metric-icon")}</div><div class="metric-value">${level.classGroupIds.length}</div></div>
    </div>
    ${situations.size ? `<div class="sequence-situation-list">${situationCards}</div>` : emptyState("Seqüència buida", "Afegeix una situació d'aprenentatge per començar a organitzar-hi activitats.", "add-learning-situation", "Afegeix situació")}`;
}


export {
  setView, render, getClassGroup, getStudentGroupLabel, classGroupOptions, subgroupOptions,
  renderClassGroups, renderSubjectDetail, renderLevelDetail, renderLevelSequence, renderActivityDetail, renderStudentDetail, studentDisplayName,
  updateActivityAssessmentRow
};
