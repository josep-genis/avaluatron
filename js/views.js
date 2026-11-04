import { applyAppearance, PALETTES, MODES } from "./themes.js";
import { data, state } from "./state.js";
import { EDUCATIONAL_LEVELS } from "./education.js";
import { isBankCompetency, withoutUnmodifiedBank } from "./competency-bank.js";
import {
  DAILY_FOLLOWUP_CRITERIA, getActivityOffers,
  getCurrentAcademicYear, getLevelOffers, getOfferingStudents, getSequenceActivities, getSequenceItems, isLectureItem, getStudentEnrollment
} from "./data.js";
import {
  SCORE_BY_LEVEL, LEVEL_LABELS,
  getAssessment as calculateAssessment, getCompetencyGrade as calculateCompetencyGrade,
  getActivityGrade as calculateActivityGrade, getEvidenceScore as calculateEvidenceScore, getActivityCompetencyGrade as calculateActivityCompetencyGrade,
  getLevelCompetencyGrade as calculateLevelCompetencyGrade,
  getActivityCompetencyContribution,
  getStudentActivityCount as calculateStudentActivityCount, getEvidenceActivityWeight,
  areAllActivityEvidencesAssessed, isNonAssessedActivity,
  isActivityIncludedInStudentGrades, isStudentExemptFromActivity, isStudentExemptFromSubject,
  isStudentExemptFromSubjectForActivity
} from "./grades.js";
import { escapeHtml, icon, formatDate, formatGrade, formatGradeWithCode, gradeColorClass, gradeValue, gradeWidth, gradeBadge } from "./formatting.js";
import { getActivityStudentReportMarkup } from "./activity-report.js";

const content = document.querySelector("#app-content");
let activityTableResizeObserver;

function getAssessment(studentId, activityId) {
  return calculateAssessment(data, studentId, activityId, state.selectedOfferingId);
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
  return calculateActivityGrade(data, studentId, activity, activeSubjectId, state.selectedOfferingId);
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

function compareStudents(a, b, sort = state.studentSort) {
  const full = (student, surnameFirst) => (surnameFirst ? `${student.lastName} ${student.firstName}` : `${student.firstName} ${student.lastName}`).trim();
  return full(a, sort === "surname").localeCompare(full(b, sort === "surname"), "ca");
}

function studentSortOptions(selected) {
  return [["name", "Nom A–Z"], ["surname", "Cognom A–Z"]]
    .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
}

function setView(view) {
  state.currentView = view;
  state.selectedActivityId = null;
  state.selectedOfferingId = null;
  state.selectedStudentId = null;
  state.selectedStudentSubjectId = null;
  state.selectedStudentLevelId = null;
  state.activityReportReturnView = null;
  state.selectedSubjectId = null;
  state.selectedLevelId = null;
  state.selectedCompetencyId = null;
  state.selectedSequence = false;
  state.activityReturnToSequence = false;
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  const labels = { overview: "Resum", students: "Alumnes", groups: "Grups classe", subjects: "Assignatures", activities: "Activitats i proves", "daily-followup": "Seguiment diari", competencies: "Competències", "teacher-profile": "Perfil docent" };
  document.querySelector("#current-section").textContent = labels[view] || "Resum";
  render();
}

function updateSidebarProfile() {
  const profile = data.teacherProfile;
  applyAppearance(profile.appearance);
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map(name => name[0]).join("").toLocaleUpperCase("ca") || "D";
  document.querySelector("#sidebar-profile-avatar").textContent = initials;
  document.querySelector("#sidebar-profile-name").textContent = profile.name || "Perfil docent";
  document.querySelector("#sidebar-profile-detail").textContent = profile.role || "Professional de l'educació";
  document.querySelector("#teacher-profile-button").classList.toggle("active", state.currentView === "teacher-profile");
}

function render() {
  updateSidebarProfile();
  if (state.currentView === "overview") renderOverview();
  if (state.currentView === "students") {
    if (!state.selectedStudentId) renderStudents();
    else if (state.selectedStudentSubjectId && state.selectedStudentLevelId) renderStudentSubjectReport();
    else renderStudentDetail();
  }
  if (state.currentView === "groups") renderClassGroups();
  if (state.currentView === "subjects") {
    if (!state.selectedSubjectId) renderSubjects();
    else if (state.selectedLevelId && state.selectedSequence) renderLevelSequence();
    else if (state.selectedLevelId) renderLevelDetail();
    else renderSubjectDetail();
  }
  if (state.currentView === "activities") state.selectedActivityId ? renderActivityDetail() : renderActivities();
  if (state.currentView === "activity-rubric") renderActivityRubric();
  if (state.currentView === "activity-report") renderActivityStudentReport();
  if (state.currentView === "daily-followup") renderDailyFollowup();
  if (state.currentView === "competencies") renderCompetencies();
  if (state.currentView === "teacher-profile") renderTeacherProfile();
}

function renderTeacherProfile() {
  const profile = data.teacherProfile;
  const currentYear = getCurrentAcademicYear(data);
  const offers = data.teachingOffers.filter(offer =>
    offer.status === "active" && offer.academicYearId === data.currentAcademicYearId
  );
  const offerIds = new Set(offers.map(offer => offer.id));
  const students = new Set(offers.flatMap(offer => getOfferingStudents(data, offer).map(student => student.id)));
  const classGroupIds = new Set(offers.flatMap(offer => offer.classGroupIds));
  const additionalGroupIds = new Set(offers.flatMap(offer => offer.additionalGroupIds));
  const subjectIds = new Set(offers.map(offer => offer.subjectId));
  const activityIds = new Set(offers.flatMap(offer => {
    const level = data.subjects.find(subject => subject.id === offer.subjectId)
      ?.levels.find(item => item.id === offer.levelId);
    return level ? getSequenceActivities(level).map(item => item.activityId) : [];
  }));
  const activityAssessments = data.assessments.filter(assessment => {
    if (!Object.values(assessment.levels).some(level => level > 0) || !activityIds.has(assessment.activityId)) return false;
    if (assessment.offeringId) return offerIds.has(assessment.offeringId);
    return getActivityOffers(data, assessment.activityId).some(offer =>
      getOfferingStudents(data, offer).some(student => student.id === assessment.studentId)
    );
  });
  const assessedEvidenceCount = activityAssessments.reduce((total, assessment) =>
    total + Object.values(assessment.levels).filter(level => level > 0).length, 0
  );
  const dailyFollowups = data.dailyAssessments.filter(assessment =>
    offers.some(offer => offer.subjectId === assessment.subjectId &&
      getOfferingStudents(data, offer).some(student => student.id === assessment.studentId))
  );

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) =>
    new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
  ).map(date => ({
    key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    label: new Intl.DateTimeFormat("ca-ES", { month: "short" }).format(date)
  }));
  const monthlyActivity = new Map(months.map(month => [month.key, 0]));
  const monthlyFollowups = new Map(months.map(month => [month.key, 0]));
  data.activities.filter(activity => activityIds.has(activity.id)).forEach(activity => {
    const month = activity.date?.slice(0, 7);
    if (monthlyActivity.has(month)) monthlyActivity.set(month, monthlyActivity.get(month) + 1);
  });
  dailyFollowups.forEach(assessment => {
    const month = assessment.date.slice(0, 7);
    if (monthlyFollowups.has(month)) monthlyFollowups.set(month, monthlyFollowups.get(month) + 1);
  });
  const maxMonthlyCount = Math.max(1, ...monthlyActivity.values(), ...monthlyFollowups.values());
  const chart = months.map(month => {
    const activities = monthlyActivity.get(month.key);
    const followups = monthlyFollowups.get(month.key);
    return `<div class="teacher-chart-month" aria-label="${escapeHtml(month.label)}: ${activities} activitats, ${followups} seguiments">
      <div class="teacher-chart-bars"><span class="teacher-chart-bar teacher-chart-activities" style="height:${Math.max(activities ? 6 : 0, activities / maxMonthlyCount * 100)}%" title="${activities} activitats"></span><span class="teacher-chart-bar teacher-chart-followups" style="height:${Math.max(followups ? 6 : 0, followups / maxMonthlyCount * 100)}%" title="${followups} seguiments"></span></div>
      <span class="teacher-chart-label">${escapeHtml(month.label)}</span>
    </div>`;
  }).join("");
  const initials = profile.name.trim().split(/\s+/).slice(0, 2).map(name => name[0]).join("").toLocaleUpperCase("ca") || "D";
  const profileDetails = [
    profile.role || "Professional de l'educació",
    profile.institution,
    `Tema ${MODES.find(item => item.id === profile.appearance.mode)?.name.toLowerCase()} · ${PALETTES.find(item => item.id === profile.appearance.palette)?.name}`
  ].filter(Boolean);

  content.innerHTML = `${pageHeading("ESPAI PERSONAL", "Perfil docent", "Consulta el teu perfil i l'activitat educativa del curs vigent.", `<button class="button button-primary" type="button" data-action="edit-teacher-profile">${icon("edit-pencil")} Edita el perfil</button>`)}
    <section class="teacher-profile-card">
      <span class="teacher-profile-avatar" aria-hidden="true">${escapeHtml(initials)}</span>
      <div class="teacher-profile-copy"><p class="eyebrow">PERFIL PROFESSIONAL</p><h2>${escapeHtml(profile.name || "El teu perfil")}</h2><p>${profileDetails.map(escapeHtml).join(" · ") || "Afegeix les teves dades professionals per completar el perfil."}</p></div>
      <span class="teacher-profile-year">${escapeHtml(currentYear?.name || "Sense curs vigent")}</span>
    </section>
    <div class="teacher-stat-grid">
      <article class="teacher-stat-card"><span class="teacher-stat-icon">${icon("group")}</span><div><span>Alumnes atesos</span><strong>${students.size}</strong></div></article>
      <article class="teacher-stat-card"><span class="teacher-stat-icon">${icon("home")}</span><div><span>Grups vinculats</span><strong>${classGroupIds.size + additionalGroupIds.size}</strong></div></article>
      <article class="teacher-stat-card"><span class="teacher-stat-icon">${icon("book-stack")}</span><div><span>Assignatures</span><strong>${subjectIds.size}</strong></div></article>
      <article class="teacher-stat-card"><span class="teacher-stat-icon">${icon("list-select")}</span><div><span>Activitats planificades</span><strong>${activityIds.size}</strong></div></article>
      <article class="teacher-stat-card"><span class="teacher-stat-icon">${icon("stats-report")}</span><div><span>Evidències avaluades</span><strong>${assessedEvidenceCount}</strong></div></article>
      <article class="teacher-stat-card"><span class="teacher-stat-icon">${icon("calendar")}</span><div><span>Seguiments diaris</span><strong>${dailyFollowups.length}</strong></div></article>
    </div>
    <section class="panel teacher-activity-panel">
      <div class="panel-heading"><div><h2 class="section-title">Ritme d'activitat docent</h2><span class="section-caption">Activitats planificades i seguiments registrats, últims sis mesos</span></div></div>
      <div class="teacher-chart-legend"><span><i class="teacher-chart-legend-dot teacher-chart-activities"></i>Activitats</span><span><i class="teacher-chart-legend-dot teacher-chart-followups"></i>Seguiments</span></div>
      ${activityIds.size || dailyFollowups.length ? `<div class="teacher-activity-chart">${chart}</div>` : '<div class="teacher-chart-empty">Encara no hi ha activitat docent registrada aquest curs.</div>'}
    </section>`;
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
  const subjectOffers = subject.levels.flatMap(level => getLevelOffers(data, level.id, subject.id));
  const classGroupIds = [...new Set(subjectOffers.flatMap(offer => offer.classGroupIds))];
  const additionalGroupIds = [...new Set(subjectOffers.flatMap(offer => offer.additionalGroupIds))];
  const groups = classGroupIds.map(id => getClassGroup(id)).filter(Boolean);
  const additionalGroups = data.additionalGroups.filter(group => additionalGroupIds.includes(group.id));
  if (!classGroupIds.includes(state.dailySelectedClassGroupId)) state.dailySelectedClassGroupId = "";
  if (!additionalGroupIds.includes(state.dailySelectedAdditionalGroupId)) state.dailySelectedAdditionalGroupId = "";
  const selectedGroup = groups.find(group => group.id === state.dailySelectedClassGroupId);
  if (!selectedGroup?.subgroups.some(subgroup => subgroup.id === state.dailySelectedSubgroupId)) state.dailySelectedSubgroupId = "";
  const subgroups = selectedGroup?.subgroups || [];
  const eligibleStudents = [...new Map(subjectOffers.flatMap(offer => getOfferingStudents(data, offer)).map(student => [student.id, student])).values()];
  const students = eligibleStudents.filter(student =>
    !isStudentExemptFromSubject(data, student.id, subject.id) &&
    (!state.dailySelectedClassGroupId || student.classGroupId === state.dailySelectedClassGroupId) &&
    (!state.dailySelectedAdditionalGroupId || student.additionalGroupIds.includes(state.dailySelectedAdditionalGroupId)) &&
    (!state.dailySelectedSubgroupId || student.subgroupId === state.dailySelectedSubgroupId)
  ).sort((a, b) => compareStudents(a, b));
  const assessments = data.dailyAssessments.filter(item =>
    item.subjectId === subject.id && item.date === state.dailySelectedDate &&
    students.some(student => student.id === item.studentId)
  );
  const recordedCount = students.filter(student =>
    assessments.some(item => item.studentId === student.id && Object.keys(item.levels).length > 0)
  ).length;
  const absentCount = assessments.filter(item => item.absent).length;
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
  const additionalGroupOptions = `<option value="">Tots els grups addicionals</option>${additionalGroups.map(group =>
    `<option value="${escapeHtml(group.id)}" ${group.id === state.dailySelectedAdditionalGroupId ? "selected" : ""}>${escapeHtml(group.name)}</option>`
  ).join("")}`;
  const subgroupOptions = `<option value="">Tots els desdoblaments</option>${subgroups.map(subgroup =>
    `<option value="${escapeHtml(subgroup.id)}" ${subgroup.id === state.dailySelectedSubgroupId ? "selected" : ""}>${escapeHtml(subgroup.name)}</option>`
  ).join("")}`;
  const selectedAdditionalGroup = additionalGroups.find(group => group.id === state.dailySelectedAdditionalGroupId);
  const selectedGroupLabel = [
    selectedGroup?.name,
    selectedAdditionalGroup?.name,
    state.dailySelectedSubgroupId ? selectedGroup?.subgroups.find(item => item.id === state.dailySelectedSubgroupId)?.name : ""
  ].filter(Boolean).join(" · ") || "Tots els grups";
  const rows = students.map(student => {
    const assessment = assessments.find(item => item.studentId === student.id);
    const selectors = DAILY_FOLLOWUP_CRITERIA.map(criterion => {
      const selectedLevel = assessment?.levels[criterion.id] || "";
      return `<td data-label="${escapeHtml(criterion.name)}"><select class="grade-select ${gradeColorClass(selectedLevel ? SCORE_BY_LEVEL[selectedLevel] : null)}" aria-label="${escapeHtml(studentDisplayName(student))}: ${criterion.name}" data-daily-assessment data-student-id="${escapeHtml(student.id)}" data-criterion-id="${criterion.id}" ${assessment?.absent ? "disabled" : ""}>
        <option value="">—</option>${LEVEL_LABELS.slice(1).map((label, index) => {
          const level = index + 1;
          return `<option class="${gradeColorClass(SCORE_BY_LEVEL[level])}" value="${level}" ${selectedLevel === level ? "selected" : ""}>${level} · ${label}</option>`;
        }).join("")}
      </select></td>`;
    }).join("");
    const initials = `${student.firstName[0] || ""}${student.lastName[0] || ""}`.toLocaleUpperCase("ca");
    return `<tr class="${assessment?.absent ? "daily-row-absent" : ""}"><td data-label="Alumne"><div class="daily-student"><span class="daily-student-avatar" aria-hidden="true">${escapeHtml(initials)}</span><span><strong>${escapeHtml(studentDisplayName(student))}</strong><small>${escapeHtml(getStudentGroupLabel(student))}</small></span></div></td><td data-label="Absent"><label class="daily-absent-toggle"><input type="checkbox" data-daily-absent data-student-id="${escapeHtml(student.id)}" aria-label="${escapeHtml(studentDisplayName(student))} ha estat absent" ${assessment?.absent ? "checked" : ""}> Absent</label></td>${selectors}<td data-label="Observació"><input class="daily-followup-note" type="text" maxlength="500" aria-label="Observació de ${escapeHtml(studentDisplayName(student))}" placeholder="Afegeix una observació…" value="${escapeHtml(assessment?.note || "")}" data-daily-note data-student-id="${escapeHtml(student.id)}"></td></tr>`;
  }).join("");
  content.innerHTML = `<header class="daily-followup-header"><span class="daily-followup-header-icon">${icon("calendar")}</span><div><p class="eyebrow">SEGUIMENT FORMATIU</p><h1>Seguiment diari</h1><p class="page-subtitle">Observa el progrés de cada alumne sessió a sessió. Les dades es desen automàticament al dispositiu.</p></div></header>
    <section class="panel daily-followup-toolbar">
      <div class="daily-followup-toolbar-heading"><div><h2 class="section-title">Defineix la sessió</h2><span class="section-caption">Tria l'assignatura, la data i el grup que vols observar.</span></div>${icon("filter-list", "daily-followup-toolbar-icon")}</div>
      <div class="daily-followup-filters">
        <label class="daily-followup-filter"><span>Assignatura</span><select id="daily-subject-filter" class="search-input">${subjectOptions}</select></label>
        <label class="daily-followup-filter"><span>Data de la sessió</span><input id="daily-date-filter" class="search-input" type="date" value="${escapeHtml(state.dailySelectedDate)}"></label>
        ${groups.length ? `<label class="daily-followup-filter"><span>Grup classe</span><select id="daily-group-filter" class="search-input">${groupOptions}</select></label>` : ""}
        ${additionalGroups.length ? `<label class="daily-followup-filter"><span>Grup addicional</span><select id="daily-additional-group-filter" class="search-input">${additionalGroupOptions}</select></label>` : ""}
        <label class="daily-followup-filter"><span>Ordena per</span><select id="daily-student-sort" class="search-input">${studentSortOptions(state.studentSort)}</select></label>
        ${subgroups.length ? `<label class="daily-followup-filter"><span>Desdoblament</span><select id="daily-subgroup-filter" class="search-input">${subgroupOptions}</select></label>` : ""}
      </div>
    </section>
    <div class="daily-followup-stat-grid">
      <article class="daily-followup-stat"><span class="daily-followup-stat-icon">${icon("group")}</span><div><span class="daily-followup-stat-label">Alumnes amb seguiment</span><strong><span id="daily-observed-count">${recordedCount}</span><small> / ${students.length}</small></strong></div></article>
      <article class="daily-followup-stat"><span class="daily-followup-stat-icon daily-average-icon">${icon("stats-report")}</span><div><span class="daily-followup-stat-label">Mitjana dels indicadors</span><strong id="daily-average">${average === null ? "—" : `${average.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}<small>${average === null ? "" : " / 4"}</small></strong></div></article>
      <article class="daily-followup-stat"><span class="daily-followup-stat-icon">${icon("calendar")}</span><div><span class="daily-followup-stat-label">Absències</span><strong id="daily-absent-count">${absentCount}</strong></div></article>
    </div>
    <section class="panel daily-followup-panel">
      <div class="daily-followup-panel-heading"><div><p class="eyebrow">${escapeHtml(formatDate(state.dailySelectedDate))}</p><h2>${escapeHtml(subject.name)}</h2><span class="section-caption">${escapeHtml(selectedGroupLabel)} · ${students.length} ${students.length === 1 ? "alumne" : "alumnes"}</span></div>${students.length ? `<button type="button" class="button button-primary" data-open-swipe-daily>Mode targetes</button>` : ""}<span class="daily-followup-save-hint"><span class="daily-followup-save-dot"></span> Es desa automàticament</span></div>
      ${students.length ? `<div class="table-wrap daily-followup-table-wrap"><table class="assessment-table daily-followup-table"><thead><tr><th>Alumne</th><th>Assistència</th>${DAILY_FOLLOWUP_CRITERIA.map(criterion => `<th>${criterion.name}<small class="daily-followup-scale">1–4 · nivell</small></th>`).join("")}<th>Observació</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state"><strong>${eligibleStudents.length ? "No hi ha alumnes en aquesta selecció" : "L'assignatura no té grups assignats"}</strong>${eligibleStudents.length ? "Tria un altre grup classe o addicional per veure els alumnes." : "Edita l'assignatura i assigna-hi un grup classe o addicional."}</div>`}
    </section>`;
}

function getClassGroup(classGroupId) {
  return data.classGroups.find(classGroup => classGroup.id === classGroupId);
}

function getStudentGroupLabel(student) {
  const classGroup = getClassGroup(student.classGroupId);
  const subgroup = classGroup?.subgroups.find(item => item.id === student.subgroupId);
  const additionalGroups = data.additionalGroups
    .filter(group => student.additionalGroupIds.includes(group.id))
    .map(group => group.name);
  return [[classGroup?.name, subgroup?.name].filter(Boolean).join(" · ") || "Sense grup classe", ...additionalGroups].join(" · ");
}

function classGroupOptions(selectedId = "", includeUnassigned = true) {
  const currentGroups = data.classGroups.filter(classGroup => classGroup.academicYearId === data.currentAcademicYearId);
  return `${includeUnassigned ? '<option value="">Sense grup classe</option>' : ""}${currentGroups.map(classGroup => `<option value="${escapeHtml(classGroup.id)}" ${selectedId === classGroup.id ? "selected" : ""}>${escapeHtml(classGroup.name)}</option>`).join("")}`;
}

function subgroupOptions(classGroupId, selectedId = "") {
  const subgroups = getClassGroup(classGroupId)?.subgroups || [];
  return `<option value="">Grup classe sencer</option>${subgroups.map(subgroup => `<option value="${escapeHtml(subgroup.id)}" ${selectedId === subgroup.id ? "selected" : ""}>${escapeHtml(subgroup.name)}</option>`).join("")}`;
}

function pageHeading(eyebrow, title, subtitle, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-subtitle">${subtitle}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ""}</div>`;
}

function getTeacherTasks() {
  const today = localDateValue();
  const activityTasks = [];
  data.activities.filter(activity => !isNonAssessedActivity(activity)).forEach(activity => {
    getActivityOffers(data, activity.id).forEach(offer => {
      const pending = getOfferingStudents(data, offer).filter(student =>
        isActivityIncludedInStudentGrades(data, student.id, activity.id) &&
        !areAllActivityEvidencesAssessed(activity, calculateAssessment(data, student.id, activity.id, offer.id))
      );
      if (!pending.length) return;
      const subject = data.subjects.find(item => item.id === offer.subjectId);
      const level = subject?.levels.find(item => item.id === offer.levelId);
      const groupNames = [
        ...offer.classGroupIds.map(id => getClassGroup(id)?.name),
        ...offer.additionalGroupIds.map(id => data.additionalGroups.find(group => group.id === id)?.name)
      ].filter(Boolean).join(", ");
      activityTasks.push({ activity, offer, subject, level, groupNames, count: pending.length });
    });
  });
  activityTasks.sort((a, b) => (a.activity.date || "9999").localeCompare(b.activity.date || "9999"));
  const dailyTasks = [];
  const seen = new Set();
  data.teachingOffers.filter(offer => offer.status === "active" && offer.academicYearId === data.currentAcademicYearId).forEach(offer => {
    const subject = data.subjects.find(item => item.id === offer.subjectId);
    if (!subject) return;
    const offerStudents = getOfferingStudents(data, offer);
    const targets = [
      ...offer.classGroupIds.map(id => ({ classGroupId: id, additionalGroupId: "", name: getClassGroup(id)?.name })),
      ...offer.additionalGroupIds.map(id => ({ classGroupId: "", additionalGroupId: id, name: data.additionalGroups.find(group => group.id === id)?.name }))
    ];
    targets.filter(target => target.name).forEach(target => {
      const key = `${subject.id}|${target.classGroupId}|${target.additionalGroupId}`;
      if (seen.has(key)) return;
      seen.add(key);
      const students = offerStudents.filter(student => target.classGroupId
        ? student.classGroupId === target.classGroupId
        : student.additionalGroupIds.includes(target.additionalGroupId));
      if (!students.length) return;
      const hasEntry = data.dailyAssessments.some(item =>
        item.subjectId === subject.id && item.date === today &&
        Object.keys(item.levels).length > 0 && students.some(student => student.id === item.studentId)
      );
      if (!hasEntry) dailyTasks.push({ subject, ...target });
    });
  });
  return { activityTasks, dailyTasks };
}

function teacherTasksMarkup() {
  const { activityTasks, dailyTasks } = getTeacherTasks();
  const total = activityTasks.length + dailyTasks.length;
  const activityRows = activityTasks.map(({ activity, offer, subject, level, groupNames, count }) =>
    `<button class="activity-row activity-row-button" type="button" data-open-activity="${escapeHtml(activity.id)}" data-subject-id="${escapeHtml(offer.subjectId)}" data-level-id="${escapeHtml(offer.levelId)}" data-offering-id="${escapeHtml(offer.id)}">${icon("clipboard-check", "activity-icon")}<div class="activity-info"><strong>Avalua «${escapeHtml(activity.title)}»</strong><span>${escapeHtml(subject?.name || "")}${level?.name ? ` · ${escapeHtml(level.name)}` : ""} · ${escapeHtml(groupNames)}${activity.date ? ` · ${formatDate(activity.date)}` : ""}</span></div><span class="badge">${count} ${count === 1 ? "alumne pendent" : "alumnes pendents"}</span></button>`
  ).join("");
  const dailyRows = dailyTasks.map(task =>
    `<button class="activity-row activity-row-button" type="button" data-open-daily data-subject-id="${escapeHtml(task.subject.id)}" data-class-group-id="${escapeHtml(task.classGroupId)}" data-additional-group-id="${escapeHtml(task.additionalGroupId)}">${icon("calendar", "activity-icon")}<div class="activity-info"><strong>Afegeix el seguiment diari d'avui</strong><span>${escapeHtml(task.subject.name)} · ${escapeHtml(task.name)}</span></div><span class="badge">Suggeriment</span></button>`
  ).join("");
  return `<section class="panel teacher-tasks-panel">
    <div class="panel-heading"><div><h2 class="section-title">Tasques pendents</h2><span class="section-caption">${total ? `${activityTasks.length} activitats per avaluar · ${dailyTasks.length} grups sense seguiment diari avui` : "No tens cap tasca pendent."}</span></div></div>
    ${total ? `${activityRows}${dailyRows}` : '<div class="empty-state">Tot al dia: no hi ha activitats pendents d\'avaluar ni grups sense seguiment diari avui.</div>'}
  </section>`;
}

function renderOverview() {
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
      ${teacherTasksMarkup()}
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
    const matchesAdditionalGroup = !state.selectedAdditionalGroupId || student.additionalGroupIds.includes(state.selectedAdditionalGroupId);
    return matchesQuery && matchesClass && matchesSubgroup && matchesAdditionalGroup;
  }).sort((a, b) => compareStudents(a, b));
  const subgroupFilter = state.selectedClassGroupId && getClassGroup(state.selectedClassGroupId)?.subgroups.length
    ? `<select class="search-input group-filter" id="subgroup-filter" aria-label="Filtra per desdoblament">${subgroupOptions(state.selectedClassGroupId, state.selectedSubgroupId)}</select>`
    : "";
  const additionalGroupFilter = data.additionalGroups.length
    ? `<select class="search-input group-filter" id="additional-group-filter" aria-label="Filtra per grup addicional"><option value="">Tots els grups addicionals</option>${data.additionalGroups.map(group => `<option value="${escapeHtml(group.id)}" ${state.selectedAdditionalGroupId === group.id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}</select>`
    : "";
  const action = `<select class="search-input group-filter" id="class-group-filter" aria-label="Filtra per grup classe">${classGroupOptions(state.selectedClassGroupId)}</select>${subgroupFilter}${additionalGroupFilter}<select class="search-input group-filter" id="student-sort" aria-label="Ordena alumnat">${studentSortOptions(state.studentSort)}</select><input class="search-input" id="student-search" type="search" placeholder="Cerca un alumne…" value="${escapeHtml(state.studentQuery)}" aria-label="Cerca un alumne"><button class="button button-primary" type="button" data-action="create-student">${icon("plus")} Afegeix alumne</button>`;
  content.innerHTML = `${pageHeading("GRUP I SEGUIMENT", "Alumnes", "Consulta els perfils i el progrés competencial del teu grup.", action)}
    ${filtered.length ? `<ul class="student-list">${filtered.map(student => {
      const grades = data.competencies.map(competency => getCompetencyGrade(student.id, competency.id)).filter(grade => grade !== null);
      const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
      const evidenceCount = getStudentActivityCount(student.id);
      return `<li class="student-list-item"><button class="student-list-open" type="button" data-open-student="${student.id}"><span class="student-list-identity"><strong>${escapeHtml(studentDisplayName(student))}</strong><span>${escapeHtml(getStudentGroupLabel(student))} · ${evidenceCount} ${evidenceCount === 1 ? "activitat" : "activitats"}</span></span><span class="student-list-grade"><span class="student-list-grade-label">Mitjana competencial</span>${gradeBadge(average)}</span></button><button class="text-button student-list-edit" type="button" data-edit-student="${student.id}">${icon("edit-pencil")} Edita alumne</button></li>`;
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
  document.querySelector("#additional-group-filter")?.addEventListener("change", event => {
    state.selectedAdditionalGroupId = event.target.value;
    renderStudents();
  });
  document.querySelector("#student-sort")?.addEventListener("change", event => {
    state.studentSort = event.target.value;
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
  const subjectLevels = data.subjects.flatMap(subject => subject.levels
    .filter(level => getLevelOffers(data, level.id, subject.id).some(offer =>
      getOfferingStudents(data, offer).some(item => item.id === student.id)
    ))
    .map(level => {
      const competencies = data.competencies.filter(competency => level.competencyIds.includes(competency.id));
      const grades = competencies
        .map(competency => getLevelCompetencyGrade(level, student.id, competency.id, subject.id))
        .filter(grade => grade !== null);
      const average = grades.length ? grades.reduce((total, grade) => total + grade, 0) / grades.length : null;
      const activities = getSequenceActivities(level);
      const assessedActivities = activities.filter(item => {
        const activity = data.activities.find(record => record.id === item.activityId);
        const offering = activity && getActivityOffers(data, activity.id).find(offer =>
          offer.subjectId === subject.id && offer.levelId === level.id &&
          getOfferingStudents(data, offer).some(candidate => candidate.id === student.id)
        );
        const assessment = activity && calculateAssessment(data, student.id, activity.id, offering?.id);
        return activity && !isStudentExemptFromActivity(data, student.id, activity.id) &&
          !isStudentExemptFromSubject(data, student.id, subject.id) &&
          areAllActivityEvidencesAssessed(activity, assessment);
      }).length;
      return { subject, level, average, activities, assessedActivities };
    })
  );
  const levelCards = subjectLevels.map(({ subject, level, average, activities, assessedActivities }) => {
    const exempt = isStudentExemptFromSubject(data, student.id, subject.id);
    return `<button class="student-subject-card" type="button" data-open-student-subject="${escapeHtml(subject.id)}" data-student-level-id="${escapeHtml(level.id)}">
      <span class="student-subject-card-copy"><strong>${escapeHtml(subject.name)}</strong><span>${escapeHtml(level.name || "Sense nivell")} · ${escapeHtml(getStudentGroupLabel(student))}</span><small>${exempt ? "Exempt/a de l'assignatura" : `${assessedActivities}/${activities.length} activitats avaluades completament`}</small></span>
      <span class="student-subject-card-grade"><span>Mitjana</span>${exempt ? '<span class="badge exemption-badge">Exempt/a</span>' : gradeBadge(average)}<span class="student-subject-card-link">Informe ${icon("arrow-right")}</span></span>
    </button>`;
  }).join("");
  const dailyHistory = data.dailyAssessments
    .filter(item => item.studentId === student.id && !isStudentExemptFromSubject(data, student.id, item.subjectId))
    .sort((a, b) => b.date.localeCompare(a.date) ||
      (data.subjects.find(x => x.id === a.subjectId)?.name || "").localeCompare(data.subjects.find(x => x.id === b.subjectId)?.name || "", "ca"));
  const absences = dailyHistory.filter(item => item.absent).length;
  const dailyRows = dailyHistory.map(item => {
    const subjectName = data.subjects.find(x => x.id === item.subjectId)?.name || "";
    const levels = DAILY_FOLLOWUP_CRITERIA.filter(criterion => item.levels[criterion.id]).map(criterion =>
      `<span class="badge ${gradeColorClass(SCORE_BY_LEVEL[item.levels[criterion.id]])}" title="${escapeHtml(criterion.name)}">${escapeHtml(criterion.name)}: ${item.levels[criterion.id]}</span>`
    ).join("");
    return `<tr><td data-label="Data">${escapeHtml(formatDate(item.date))}</td><td data-label="Assignatura">${escapeHtml(subjectName)}</td><td data-label="Seguiment">${item.absent ? '<span class="badge">Absent</span>' : levels || "—"}</td><td data-label="Observació">${escapeHtml(item.note || "")}</td></tr>`;
  }).join("");
  const dailySection = `<section class="panel"><div class="panel-heading"><div><h2 class="section-title">Historial de seguiment diari</h2><span class="section-caption">Valoracions i absències registrades a classe, de més recent a més antiga.</span></div><span class="badge">${dailyHistory.length} ${dailyHistory.length === 1 ? "sessió" : "sessions"}${absences ? ` · ${absences} ${absences === 1 ? "absència" : "absències"}` : ""}</span></div>
      ${dailyRows ? `<div class="table-wrap"><table class="assessment-table"><thead><tr><th>Data</th><th>Assignatura</th><th>Seguiment</th><th>Observació</th></tr></thead><tbody>${dailyRows}</tbody></table></div>` : emptyState("Cap seguiment diari", "Encara no hi ha cap sessió registrada per a aquest alumne.")}</section>`;
  content.innerHTML = `<button class="detail-back" type="button" data-back="students">${icon("arrow-left")} Torna als alumnes</button>
    ${pageHeading("PERFIL D'ALUMNE", escapeHtml(studentDisplayName(student)), `${getStudentGroupLabel(student)} · Assignatures i nivells actuals`, `<button class="button" type="button" data-edit-student="${student.id}">${icon("edit-pencil")} Edita alumne</button>`)}
    <section class="panel"><div class="panel-heading"><div><h2 class="section-title">Assignatures que cursa</h2><span class="section-caption">Obre un nivell per consultar el report de l'assignatura, les competències i les activitats.</span></div><span class="badge">${subjectLevels.length} ${subjectLevels.length === 1 ? "nivell" : "nivells"}</span></div>
      ${levelCards ? `<div class="student-subject-list">${levelCards}</div>` : emptyState("Cap nivell assignat", "Aquest alumne encara no té cap assignatura vinculada al seu grup classe.")}</section>
    ${dailySection}`;
}

function renderStudentSubjectReport() {
  const student = data.students.find(item => item.id === state.selectedStudentId);
  const subject = data.subjects.find(item => item.id === state.selectedStudentSubjectId);
  const level = subject?.levels.find(item => item.id === state.selectedStudentLevelId);
  if (!student || !subject || !level || !getLevelOffers(data, level.id, subject.id).some(offer =>
    getOfferingStudents(data, offer).some(item => item.id === student.id)
  )) {
    state.selectedStudentSubjectId = null;
    state.selectedStudentLevelId = null;
    if (student) renderStudentDetail();
    else { state.selectedStudentId = null; renderStudents(); }
    return;
  }
  const exempt = isStudentExemptFromSubject(data, student.id, subject.id);
  const competencies = data.competencies.filter(competency => level.competencyIds.includes(competency.id));
  const competencyGrades = competencies.map(competency => ({
    competency,
    grade: getLevelCompetencyGrade(level, student.id, competency.id, subject.id)
  }));
  const availableGrades = competencyGrades.map(item => item.grade).filter(grade => grade !== null);
  const average = availableGrades.length
    ? availableGrades.reduce((total, grade) => total + grade, 0) / availableGrades.length
    : null;
  const sequenceActivities = getSequenceActivities(level);
  const activityRows = sequenceActivities.map((item, index) => {
    const activity = data.activities.find(record => record.id === item.activityId);
    if (!activity) return "";
    const situation = level.situations.find(record => record.activities.includes(item));
    const offering = getActivityOffers(data, activity.id).find(offer =>
      offer.subjectId === subject.id && offer.levelId === level.id &&
      getOfferingStudents(data, offer).some(candidate => candidate.id === student.id)
    );
    const activityExempt = isStudentExemptFromActivity(data, student.id, activity.id);
    const activityGrade = calculateActivityGrade(data, student.id, activity, subject.id, offering?.id);
    const assessment = calculateAssessment(data, student.id, activity.id, offering?.id);
    const assessedEvidenceCount = activity.evidences.filter(evidence =>
      Number.isInteger(assessment?.levels[evidence.id]) && assessment.levels[evidence.id] > 0
    ).length;
    const fullyAssessed = areAllActivityEvidencesAssessed(activity, assessment);
    const status = isNonAssessedActivity(activity) ? "Activitat no avaluable" : exempt ? "Exempt/a de l'assignatura" :
      activityExempt ? "Exempt/a de l'activitat" :
      fullyAssessed ? "Avaluada completament" : `${assessedEvidenceCount}/${activity.evidences.length} evidències avaluades`;
    return `<button class="student-subject-activity" type="button" data-open-student-activity-report="${escapeHtml(student.id)}" data-activity-id="${escapeHtml(activity.id)}" data-report-subject-id="${escapeHtml(subject.id)}">
      <span class="student-subject-activity-number">${String(index + 1).padStart(2, "0")}</span><span class="student-subject-activity-copy"><strong>${escapeHtml(activity.title)}</strong><span>${escapeHtml(situation?.name || "")} · ${escapeHtml(activity.type)} · ${formatDate(activity.date)}</span><small>${status}</small></span>
      ${isNonAssessedActivity(activity) ? '<span class="badge">No avaluable</span>' : exempt || activityExempt ? '<span class="badge exemption-badge">Exempt/a</span>' : gradeBadge(activityGrade)}${icon("arrow-right", "student-subject-activity-arrow")}
    </button>`;
  }).join("");
  const competencyRows = competencyGrades.map(({ competency, grade }) =>
    `<div class="student-subject-competency"><div><strong>${escapeHtml(competency.name)}</strong><span>${grade === null ? "Sense evidències avaluades" : "Progrés competencial"}</span></div>${gradeBadge(grade)}</div>`
  ).join("");
  content.innerHTML = `<button class="detail-back" type="button" data-back="student-subject">${icon("arrow-left")} Torna a les assignatures de ${escapeHtml(studentDisplayName(student))}</button>
    ${pageHeading("REPORT D'ASSIGNATURA", escapeHtml(subject.name), `${escapeHtml(level.name || "Sense nivell")} · ${escapeHtml(getStudentGroupLabel(student))}`, `<button class="button" type="button" data-edit-student="${escapeHtml(student.id)}">${icon("edit-pencil")} Edita alumne</button>`)}
    <div class="student-subject-summary">
      <section class="student-subject-summary-main"><span class="eyebrow">MITJANA DE L'ASSIGNATURA</span>${exempt ? '<span class="badge exemption-badge">Exempt/a de l’assignatura</span>' : gradeBadge(average)}<p>${exempt ? "L'exempció és activa; les qualificacions registrades es conserven, però no compten en els càlculs." : `${availableGrades.length} de ${competencies.length} competències amb evidències avaluades.`}</p></section>
      <div class="student-subject-summary-metric"><span>Activitats</span><strong>${sequenceActivities.length}</strong></div>
      <div class="student-subject-summary-metric"><span>Avaluades completament</span><strong>${exempt ? "—" : `${sequenceActivities.filter(item => {
        const activity = data.activities.find(record => record.id === item.activityId);
        const offering = activity && getActivityOffers(data, activity.id).find(offer =>
          offer.subjectId === subject.id && offer.levelId === level.id &&
          getOfferingStudents(data, offer).some(candidate => candidate.id === student.id)
        );
        const assessment = activity && calculateAssessment(data, student.id, activity.id, offering?.id);
        return activity && !isStudentExemptFromActivity(data, student.id, activity.id) &&
          areAllActivityEvidencesAssessed(activity, assessment);
      }).length}`}</strong></div>
    </div>
    <section class="panel student-subject-report-section"><div class="panel-heading"><div><h2 class="section-title">Progrés per competència</h2><span class="section-caption">Resultat de les competències assignades a aquest nivell</span></div></div>
      ${competencyRows || '<div class="empty-state">Aquest nivell encara no té competències assignades.</div>'}</section>
    <section class="panel student-subject-report-section"><div class="panel-heading"><div><h2 class="section-title">Activitats i evidències</h2><span class="section-caption">Obre una activitat per consultar el report detallat de les evidències.</span></div><span class="badge">${sequenceActivities.length}</span></div>
        ${sequenceActivities.length ? `<div class="student-subject-activity-list">${activityRows}</div>` : '<div class="empty-state">Aquest nivell encara no té activitats a la seqüència.</div>'}</section>`;
}

function renderActivities() {
  const sorted = [...data.activities].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const action = `<button class="button button-primary" type="button" data-action="create-activity">${icon("plus")} Crea activitat</button>`;
  content.innerHTML = `${pageHeading("EVIDÈNCIES D'APRENENTATGE", "Activitats i proves", "Cada activitat inclou una rúbrica vinculada a les competències.", action)}
    ${sorted.length ? `<div class="card-list">${sorted.map(activity => {
      const offerings = getActivityOffers(data, activity.id);
      const eligibleStudents = [...new Map(offerings.flatMap(offer => getOfferingStudents(data, offer)).map(student => [student.id, student])).values()];
      const grades = offerings.length === 1
        ? eligibleStudents
          .filter(student => areAllActivityEvidencesAssessed(activity, calculateAssessment(data, student.id, activity.id, offerings[0].id)))
          .map(student => calculateActivityGrade(data, student.id, activity, offerings[0].subjectId, offerings[0].id))
          .filter(grade => grade !== null)
        : [];
      const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
      const passRate = grades.length ? grades.filter(grade => grade >= 5).length / grades.length * 100 : null;
      const evaluatedRate = eligibleStudents.length ? grades.length / eligibleStudents.length * 100 : null;
      const nonAssessed = isNonAssessedActivity(activity);
      const metric = (label, value, width, detail = "", colorClass = "") => `<div class="activity-metric"><div class="activity-metric-heading"><span>${label}</span><strong class="${colorClass}">${value}</strong></div><div class="progress-track"><div class="progress-fill ${colorClass}" style="width:${width}%"></div></div>${detail ? `<span class="activity-metric-detail">${detail}</span>` : ""}</div>`;
      return `<article class="activity-card" data-open-activity="${escapeHtml(activity.id)}" tabindex="0" role="button" aria-label="Obre l'activitat ${escapeHtml(activity.title)}">
        <div class="activity-card-main">${icon(activity.type === "Prova" ? "clipboard-check" : "notes", "activity-icon")}<div class="activity-info"><strong>${escapeHtml(activity.title)} <span class="badge activity-type ${activity.type === "Prova" ? "gold" : ""}">${escapeHtml(activity.type)}</span></strong><span>${formatDate(activity.date)} · ${nonAssessed ? "No avaluable" : `${activity.evidences.length} evidències`} · ${offerings.length} ofertes vigents</span></div></div>
        ${nonAssessed ? '<div class="activity-metrics"><span class="activity-metric-detail">Activitat no avaluativa: no genera qualificacions.</span></div>' : `<div class="activity-metrics">${metric("Mitjana", formatGradeWithCode(average), gradeWidth(average), offerings.length > 1 ? "Tria una oferta per veure les notes" : "", gradeColorClass(average))}${metric("Aprovats", passRate === null ? "—" : `${Math.round(passRate)}%`, passRate || 0, passRate === null ? "Sense avaluacions" : "De l'alumnat avaluat")}${metric("Avaluats", evaluatedRate === null ? "—" : `${Math.round(evaluatedRate)}%`, evaluatedRate || 0, `${grades.length}/${eligibleStudents.length} alumnes de les ofertes vigents`)}</div>`}
      </article>`;
    }).join("")}</div>` : emptyState("Encara no hi ha activitats", "Crea una prova o un projecte amb evidències vinculades a competències.", "create-activity", "Crea una activitat")}`;
}

function getActivityDashboardMarkup(activity, students) {
  const eligibleStudents = students.filter(student =>
    !isStudentExemptFromActivity(data, student.id, activity.id) &&
    !isStudentExemptFromSubjectForActivity(data, student.id, activity.id, state.selectedSubjectId)
  );
  const grades = eligibleStudents
    .filter(student => areAllActivityEvidencesAssessed(
      activity, calculateAssessment(data, student.id, activity.id, state.selectedOfferingId)
    ))
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
    return `<div class="activity-distribution-chart-wrap"><svg class="activity-distribution-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Encara no hi ha notes d’activitat per representar">
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
    <svg class="activity-distribution-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="activity-distribution-title activity-distribution-description">
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

function getActivityGroupOf(activity, studentId) {
  if (!activity.isGroup) return null;
  return (activity.groups || []).find(group => group.studentIds.includes(studentId)) || null;
}

function getActivityGroupsMarkup(activity, students, selectedOffering) {
  if (!activity.isGroup || !selectedOffering || !students.length) return "";
  const studentIds = new Set(students.map(student => student.id));
  const groups = (activity.groups || []).filter(group => !group.studentIds.length || group.studentIds.some(id => studentIds.has(id)));
  const groupMode = activity.groupGrading === "group";
  const ungrouped = students.filter(student => !getActivityGroupOf(activity, student.id)).length;
  const rows = groups.map(group => {
    const members = students.filter(student => group.studentIds.includes(student.id));
    const derived = !groupMode ? "" : members.length
      ? `${activity.evidences.map(evidence => `<td>${gradeBadge(calculateEvidenceScore(data, activity, members[0].id, selectedOffering.id, evidence.id))}</td>`).join("")}<td>${gradeBadge(calculateActivityGrade(data, members[0].id, activity, selectedOffering.subjectId, selectedOffering.id))}</td>`
      : `<td colspan="${activity.evidences.length + 1}"></td>`;
    return `<tr data-activity-group-row="${escapeHtml(group.id)}"><td><strong>${escapeHtml(group.name)}</strong><br><span class="section-caption">${members.map(student => escapeHtml(studentDisplayName(student))).join(", ") || "Sense membres"}</span></td>${derived}<td class="activity-group-actions"><button class="text-button" type="button" data-edit-activity-group="${escapeHtml(group.id)}">${icon("edit-pencil")} Edita</button><button class="text-button danger-text" type="button" data-delete-activity-group="${escapeHtml(group.id)}">${icon("trash")} Elimina</button></td></tr>`;
  }).join("");
  const caption = groupMode
    ? "Qualificació en grup: tots els membres reben la mitjana de les avaluacions individuals dels components de l'agrupament. Les avaluacions individuals no es modifiquen."
    : "Qualificació individual: cada alumne rep la nota de la seva pròpia avaluació.";
  return `<section class="panel activity-groups-panel" data-activity-groups><div class="panel-heading"><div><h2 class="section-title">Agrupaments de l'activitat</h2><span class="section-caption">${caption}${ungrouped && groups.length ? ` ${ungrouped} ${ungrouped === 1 ? "alumne" : "alumnes"} sense agrupament${groupMode ? " (es qualifiquen individualment)" : ""}.` : ""}</span></div>
    <details class="activity-export-menu">
      <summary class="button">${icon("download")} Exporta ${icon("nav-arrow-down")}</summary>
      <div class="activity-export-options" role="group" aria-label="Exporta agrupaments">
        <button type="button" data-export-activity-group-reports>${icon("download")} Informe PDF per grup</button>
        <button type="button" data-export-activity-groups="csv">${icon("download")} Agrupaments CSV</button>
        <button type="button" data-export-activity-groups="tsv">${icon("download")} Agrupaments TSV</button>
        <button type="button" data-export-group-assessment-forms>${icon("edit-pencil")} Fitxes d'avaluació de l'alumnat (PDF)</button>
      </div>
    </details>
  </div>
    <div class="grading-mode-row"><span class="section-caption" id="grading-mode-label">Determina el tipus de qualificació</span>
    <div class="grading-mode-toggle" role="group" aria-labelledby="grading-mode-label">
      <button type="button" class="${groupMode ? "" : "active"}" aria-pressed="${!groupMode}" data-set-grading-mode="individual">${icon("user")} Individual</button>
      <button type="button" class="${groupMode ? "active" : ""}" aria-pressed="${groupMode}" data-set-grading-mode="group">${icon("group")} En grup</button>
    </div></div>
    ${!groups.length ? '<div class="empty-state">Encara no hi ha agrupaments. Crea\'n per qualificar equips.<div style="margin-top:10px"><button class="button" type="button" data-create-activity-group>${icon("plus")} Crea agrupament</button></div></div>'
      : `<div class="table-wrap"><table class="assessment-table activity-group-table"><thead><tr><th>Agrupament</th>${groupMode ? `${activity.evidences.map(evidence => `<th>${escapeHtml(evidence.name)}</th>`).join("")}<th>Nota</th>` : ""}<th class="activity-group-actions"><button class="button" type="button" data-create-activity-group>${icon("plus")} Crea agrupament</button></th></tr></thead><tbody>${rows}</tbody></table></div>`}
  </section>`;
}

// Actualitza en lloc el quadre d'agrupaments i, en mode grupal, les notes dels companys de l'agrupament.
function refreshActivityGroups(studentId = null) {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  const offering = data.teachingOffers.find(item => item.id === state.selectedOfferingId);
  if (!activity?.isGroup || !offering) return;
  const students = getOfferingStudents(data, offering);
  const panel = content.querySelector("[data-activity-groups]");
  if (panel) panel.outerHTML = getActivityGroupsMarkup(activity, students, offering);
  const group = studentId ? getActivityGroupOf(activity, studentId) : null;
  if (group && activity.groupGrading === "group") {
    for (const memberId of group.studentIds.filter(id => id !== studentId && students.some(student => student.id === id))) {
      updateActivityAssessmentRow(memberId, calculateActivityGrade(data, memberId, activity, offering.subjectId, offering.id));
    }
  }
}

function renderActivityDetail() {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity) { state.selectedActivityId = null; renderActivities(); return; }
  const selectedLevel = data.subjects
    .find(subject => subject.id === state.selectedSubjectId)
    ?.levels.find(level => level.id === state.selectedLevelId);
  const activityOffers = getActivityOffers(data, activity.id).filter(offer =>
    (!state.selectedSubjectId || offer.subjectId === state.selectedSubjectId) &&
    (!state.selectedLevelId || offer.levelId === state.selectedLevelId)
  );
  if (!activityOffers.some(offer => offer.id === state.selectedOfferingId)) {
    state.selectedOfferingId = activityOffers.length === 1 ? activityOffers[0].id : null;
  }
  const selectedOffering = activityOffers.find(offer => offer.id === state.selectedOfferingId);
  const students = selectedOffering ? getOfferingStudents(data, selectedOffering) : [];
  const rows = students.map(student => {
    const assessment = getAssessment(student.id, activity.id);
    const activityExempt = isStudentExemptFromActivity(data, student.id, activity.id);
    const subjectExempt = isStudentExemptFromSubjectForActivity(data, student.id, activity.id, selectedOffering?.subjectId);
    const exempt = activityExempt || subjectExempt;
    const selectors = activity.evidences.map(evidence => {
      const selectedLevel = assessment?.levels[evidence.id] ?? 0;
      return `<td><select class="grade-select ${gradeColorClass(selectedLevel ? SCORE_BY_LEVEL[selectedLevel] : null)}" aria-label="${escapeHtml(studentDisplayName(student))}: ${escapeHtml(evidence.name)}" data-assess-student="${escapeHtml(student.id)}" data-evidence="${escapeHtml(evidence.id)}" ${exempt ? "disabled" : ""}>
        ${LEVEL_LABELS.map((label, index) => `<option class="${gradeColorClass(index ? SCORE_BY_LEVEL[index] : null)}" title="${escapeHtml(evidence.descriptors?.[index] || "")}" value="${index}" ${selectedLevel === index ? "selected" : ""}>${index === 0 ? label : `${index} · ${label} (${formatGradeWithCode(SCORE_BY_LEVEL[index])})`}</option>`).join("")}
      </select></td>`;
    }).join("");
    const activityGrade = selectedOffering
      ? calculateActivityGrade(data, student.id, activity, selectedOffering.subjectId, selectedOffering.id)
      : null;
    const fullyAssessed = Boolean(selectedOffering && areAllActivityEvidencesAssessed(
      activity, calculateAssessment(data, student.id, activity.id, selectedOffering.id)
    ));
    const didNotPass = fullyAssessed && activityGrade !== null && activityGrade < 5;
    const exemptionLabel = subjectExempt ? "Exempt/a de l'assignatura" : "Exempt/a de l'activitat";
    return `<tr data-assessment-row="${escapeHtml(student.id)}" data-student-surname="${escapeHtml(`${student.lastName} ${student.firstName}`.trim())}" data-student-name="${escapeHtml(studentDisplayName(student))}" data-student-group="${escapeHtml(getStudentGroupLabel(student))}" data-activity-group="${escapeHtml(getActivityGroupOf(activity, student.id)?.name || "")}" data-class-group="${escapeHtml(student.classGroupId)}" data-grade-value="${activityGrade ?? ""}" data-assessed="${fullyAssessed ? "true" : "false"}" data-exempt="${exempt ? "true" : "false"}" class="${didNotPass ? "assessment-row-warning" : ""}"><td><div class="assessment-student-name"><button class="student-activity-report-link" type="button" data-open-student-activity-report="${escapeHtml(student.id)}"><strong>${escapeHtml(studentDisplayName(student))}</strong></button><span class="assessment-warning" data-warning-for="${escapeHtml(student.id)}" role="img" aria-label="No assoleix l'activitat" title="No assoleix l'activitat" ${didNotPass ? "" : "hidden"}>${icon("warning-triangle")}</span></div><span class="assessment-student-group">${escapeHtml(getStudentGroupLabel(student))}${getActivityGroupOf(activity, student.id) ? ` · ${escapeHtml(getActivityGroupOf(activity, student.id).name)}` : ""}</span></td><td class="activity-grade-cell" data-grade-for="${escapeHtml(student.id)}"><span class="activity-grade-report-result">${exempt ? `<span class="badge exemption-badge">${exemptionLabel}</span>` : gradeBadge(activityGrade)}</span></td><td class="activity-exemption-cell"><label class="exemption-control"><input type="checkbox" data-activity-exemption="${escapeHtml(activity.id)}" data-student-id="${escapeHtml(student.id)}" aria-label="Exempció d'activitat per a ${escapeHtml(studentDisplayName(student))}" ${activityExempt ? "checked" : ""}></label></td>${selectors}</tr>`;
  }).join("");
  const rubricRows = activity.evidences.map(evidence => {
    const contributions = Object.entries(evidence.contributions).map(([competencyId, weight]) => {
      const competency = data.competencies.find(item => item.id === competencyId);
      return competency ? `<span class="badge">${escapeHtml(competency.name)} · ${Number(weight)}%</span>` : "";
    }).join(" ");
    const levelCriteria = [["NA", "1"], ["AS", "2"], ["AN", "3"], ["AE", "4"]]
      .filter(([, level]) => evidence.descriptors?.[level])
      .map(([label, level]) => `<li><strong>${label}</strong> ${escapeHtml(evidence.descriptors[level])}</li>`).join("");
    const criteriaDisclosure = levelCriteria
      ? `<details class="evidence-rubric-descriptors"><summary>Criteris d'assoliment</summary><ul>${levelCriteria}</ul></details>`
      : "";
    const summary = getEvidenceSummary(evidence, students, activity);
    return `<tr><td><strong>${escapeHtml(evidence.name)}</strong><br><span class="section-caption">Pes derivat per a l'activitat: ${getEvidenceActivityWeight(evidence)}%</span>${criteriaDisclosure}</td><td>${contributions || '<span class="grade-empty">Sense competències vinculades</span>'}</td><td data-evidence-progress="${escapeHtml(evidence.id)}">${summary.progress}</td><td data-evidence-average="${escapeHtml(evidence.id)}">${gradeBadge(summary.average)}</td></tr>`;
  }).join("");
  const totalEvidenceWeight = activity.evidences.reduce((total, evidence) => total + getEvidenceActivityWeight(evidence), 0);
  const evidenceWeightWarning = Math.abs(totalEvidenceWeight - 100) > 0.001
    ? `<div class="rubric-weight-warning" role="status">La suma dels pesos de totes les evidències és ${totalEvidenceWeight.toLocaleString("ca-ES", { maximumFractionDigits: 2 })}%, no 100%. Revisa les contribucions a les competències.</div>`
    : "";
  const offeringSelector = activityOffers.length > 1
    ? `<div class="field activity-offering-selector"><label for="activity-offering-select">Oferta docent vigent</label><select id="activity-offering-select" data-select-offering><option value="">Tria una oferta per avaluar</option>${activityOffers.map(offer => {
      const subject = data.subjects.find(item => item.id === offer.subjectId);
      const level = subject?.levels.find(item => item.id === offer.levelId);
      const groupNames = [
        ...offer.classGroupIds.map(id => getClassGroup(id)?.name),
        ...offer.additionalGroupIds.map(id => data.additionalGroups.find(group => group.id === id)?.name)
      ].filter(Boolean);
      const year = data.academicYears.find(item => item.id === offer.academicYearId);
      return `<option value="${escapeHtml(offer.id)}" ${selectedOffering?.id === offer.id ? "selected" : ""}>${escapeHtml(subject?.name || "")} · ${escapeHtml(level?.name || "")} · ${escapeHtml(groupNames.join(", "))} · ${escapeHtml(year?.name || "")}</option>`;
    }).join("")}</select></div>`
    : "";
  const assignmentNotice = !activityOffers.length
    ? '<div class="empty-state">Aquesta activitat és al banc de planificació i encara no està assignada a cap oferta docent del curs vigent. No hi ha alumnat per avaluar.</div>'
    : activityOffers.length > 1 && !selectedOffering
      ? '<div class="empty-state">Tria una oferta docent vigent per carregar-ne l’alumnat i les qualificacions.</div>'
      : "";
  const detailBack = `<button class="detail-back" type="button" data-back="activities">${icon("arrow-left")} ${state.activityReturnToSequence ? "Torna a la seqüència" : "Torna a les activitats"}</button>`;
  const detailHeading = pageHeading(escapeHtml(activity.type.toUpperCase()), escapeHtml(activity.title), `${formatDate(activity.date)} · ${selectedLevel ? `${escapeHtml(selectedLevel.name)} · ` : ""}Banc d'activitats i avaluació per oferta docent.`, `<button class="button" type="button" data-edit-activity="${activity.id}">${icon("edit-pencil")} Edita activitat</button>`);
  if (isNonAssessedActivity(activity)) {
    content.innerHTML = `${detailBack}${detailHeading}<div class="empty-state"><strong>Activitat no avaluable</strong>Aquesta activitat no té evidències, de manera que no genera qualificacions i no compta en les mitjanes de l'alumnat. Afegeix evidències a la rúbrica si vols avaluar-la.<div style="margin-top:12px"><button class="button" type="button" data-edit-activity-rubric>${icon("edit-pencil")} Edita la rúbrica</button></div></div>`;
    return;
  }
  content.innerHTML = `${detailBack}
    ${detailHeading}
    ${offeringSelector}
    ${assignmentNotice}
    <section class="panel activity-insights-panel" data-activity-dashboard><div class="panel-heading"><div><h2 class="section-title">Resum de l’activitat</h2><span class="section-caption">Indicadors i distribució de les notes de l’alumnat</span></div></div><div data-activity-insight-content>${getActivityDashboardMarkup(activity, students)}</div></section>
    <section class="panel"><div class="panel-heading"><div><h2 class="section-title">Rúbrica de l'activitat</h2><span class="section-caption">Evidències observables, competències i nivells d'assoliment</span></div><div class="heading-actions"><button class="button" type="button" data-edit-activity-rubric>${icon("edit-pencil")} Edita la rúbrica</button><details class="activity-export-menu"><summary class="button">${icon("download")} Exporta ${icon("nav-arrow-down")}</summary><div class="activity-export-options" role="group" aria-label="Exporta la rúbrica"><button type="button" data-export-activity-rubric="csv">${icon("download")} CSV</button><button type="button" data-export-activity-rubric="tsv">${icon("download")} TSV</button><button type="button" data-export-activity-rubric-pdf>${icon("download")} PDF</button></div></details></div></div>
      ${evidenceWeightWarning}
      ${activity.evidences.length ? `<div class="table-wrap"><table class="assessment-table rubric-table"><thead><tr><th>Evidència</th><th>Competències i pesos</th><th>Progrés d'avaluació</th><th>Nota mitjana</th></tr></thead><tbody>${rubricRows}</tbody></table></div>` : '<div class="empty-state">Aquesta activitat encara no té evidències.</div>'}
    </section>
    ${getActivityGroupsMarkup(activity, students, selectedOffering)}
    <section class="panel assessment-panel"><div class="panel-heading"><div><h2 class="section-title">Avaluació de l'alumnat</h2><span class="section-caption">Selecciona el nivell assolit per cada alumne i evidència. Les notes es calculen automàticament.</span></div><details class="activity-export-menu"><summary class="button">${icon("download")} Exporta ${icon("nav-arrow-down")}</summary><div class="activity-export-options" role="group" aria-label="Exporta l'avaluació de l'alumnat"><button type="button" data-export-activity-table="csv">${icon("download")} CSV</button><button type="button" data-export-activity-table="tsv">${icon("download")} TSV</button><button type="button" data-export-activity-reports>${icon("download")} Informes PDF</button></div></details></div>
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
          <option value="name-asc">Nom A–Z</option><option value="name-desc">Nom Z–A</option><option value="surname-asc">Cognom A–Z</option><option value="surname-desc">Cognom Z–A</option><option value="group-asc">Grup</option>${activity.isGroup ? '<option value="activity-group-asc">Agrupament de l\'activitat</option>' : ""}<option value="grade-desc">Nota més alta</option><option value="grade-asc">Nota més baixa</option>
        </select>
        <span class="activity-assessment-count" data-assessment-count aria-live="polite"></span>
      </div>
      <div class="activity-scroll-proxy" data-activity-scroll-proxy role="region" aria-label="Desplaçament horitzontal de la taula d'avaluació" tabindex="0"><div class="activity-scroll-spacer"></div></div></div>` : ""}
      ${students.length ? `<div class="table-wrap"><table class="assessment-table activity-assessment-table"><thead><tr><th>Alumne</th><th class="activity-grade-cell">Nota d'activitat</th><th class="activity-exemption-cell" aria-label="Exempció de l'activitat" title="Exempció de l'activitat">Ex.</th>${activity.evidences.map(evidence => `<th>${escapeHtml(evidence.name)}<br><span style="font-weight:400">${getEvidenceActivityWeight(evidence)}% de la nota</span></th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : emptyState("Sense alumnat a avaluar", selectedOffering ? "No hi ha cap alumne matriculat als grups d'aquesta oferta docent." : "Tria una oferta vigent o assigna l'activitat a la seqüència d'un nivell amb oferta docent vigent.")}
      ${students.length ? '<p class="activity-assessment-empty" data-assessment-empty hidden>No hi ha alumnes que coincideixin amb aquests filtres.</p>' : ""}
      <div class="grade-legend" aria-label="Llegenda de colors de les qualificacions"><span class="grade-warning">Menys de 5 · No assolit</span><span class="grade-developing">5–6,9 · En procés</span><span class="grade-achieved">7–8,9 · Assolit</span><span class="grade-advanced">9–10 · Avançat</span></div>
      <p class="table-note">El pes de cada evidència en l'activitat és la suma dels pesos de contribució a les competències que avalua. La nota de l'activitat pondera les evidències amb aquest pes; la nota de cada competència fa servir el pes específic assignat a aquella competència.</p>
    </section>`;
  setupActivityAssessmentTable();
}

export function activityRubricCompetencyMarkup(evidence, competency, weight) {
  return `<div class="rubric-page-competency" data-rubric-competency-row>
    <input type="hidden" name="rubricCompetencyId" value="${escapeHtml(competency.id)}">
    <span>${escapeHtml(competency.name)}</span>
    <label><span class="sr-only">Pes de ${escapeHtml(competency.name)}</span><input type="number" name="rubricCompetencyWeight" min="1" max="100" step="1" value="${Number(weight)}" required aria-label="Pes de ${escapeHtml(competency.name)} a l'evidència ${escapeHtml(evidence.name)}">%</label>
    <button class="text-button danger-text" type="button" data-remove-rubric-competency aria-label="Treu ${escapeHtml(competency.name)}">${icon("xmark")}</button>
  </div>`;
}

export function activityRubricEvidenceRowMarkup(index, evidence = null, rowKey = evidence?.id || `new-${index}`) {
  const selectedIds = new Set(Object.keys(evidence?.contributions || {}));
  const competencies = data.competencies.filter(competency => selectedIds.has(competency.id));
  const availableCompetencies = data.competencies.filter(competency => !selectedIds.has(competency.id));
  const descriptors = evidence?.descriptors || {};
  const levelHeaders = [
    ["1", "NA", "No assolit · 2,5/10"],
    ["2", "AS", "Assoliment satisfactori · 5/10"],
    ["3", "AN", "Assoliment notable · 7,5/10"],
    ["4", "AE", "Assoliment excel·lent · 10/10"]
  ];
  return `<tr data-rubric-evidence-row>
    <td class="rubric-evidence-name-cell"><input type="hidden" name="rubricEvidenceId" value="${escapeHtml(evidence?.id || "")}"><label class="sr-only" for="rubric-evidence-${escapeHtml(rowKey)}">Evidència ${index + 1}</label><input id="rubric-evidence-${escapeHtml(rowKey)}" name="rubricEvidenceName" required maxlength="100" value="${escapeHtml(evidence?.name || "")}" placeholder="Descriu l'evidència"><button class="text-button danger-text" type="button" data-remove-rubric-evidence>${icon("trash")} Elimina</button></td>
    <td class="rubric-evidence-competencies"><div class="rubric-page-competency-list" data-rubric-competencies>${competencies.map(competency => activityRubricCompetencyMarkup(evidence, competency, evidence.contributions[competency.id])).join("")}</div><div class="evidence-competency-warning" role="status" ${competencies.length ? "hidden" : ""}>${icon("warning-triangle")} Afegeix almenys una competència.</div><div class="evidence-competency-add"><select data-rubric-competency-select aria-label="Afegeix una competència a l'evidència ${index + 1}" ${availableCompetencies.length ? "" : "disabled"}>${availableCompetencies.map(competency => `<option value="${escapeHtml(competency.id)}">${escapeHtml(competency.name)}</option>`).join("") || '<option value="">Totes les competències afegides</option>'}</select><button class="icon-button" type="button" data-add-rubric-competency aria-label="Afegeix competència" ${availableCompetencies.length ? "" : "disabled"}>${icon("plus")}</button></div></td>
    ${levelHeaders.map(([level, abbreviation, label]) => `<td class="rubric-descriptor-cell"><label class="sr-only" for="rubric-${escapeHtml(rowKey)}-level-${level}">${abbreviation}: criteri per a ${evidence?.name || `l'evidència ${index + 1}`}</label><textarea id="rubric-${escapeHtml(rowKey)}-level-${level}" name="rubricDescriptor${level}" maxlength="500" required placeholder="${abbreviation}: criteri observable" title="${label}">${escapeHtml(descriptors[level] || "")}</textarea></td>`).join("")}
  </tr>`;
}

export function renderActivityRubric() {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity) {
    state.currentView = "activities";
    state.selectedActivityId = null;
    renderActivities();
    return;
  }
  const evidenceRows = activity.evidences.map((evidence, index) => activityRubricEvidenceRowMarkup(index, evidence)).join("");
  const levelHeaders = [
    ["NA", "No assolit · 2,5/10"],
    ["AS", "Assoliment satisfactori · 5/10"],
    ["AN", "Assoliment notable · 7,5/10"],
    ["AE", "Assoliment excel·lent · 10/10"]
  ];
  content.innerHTML = `<button class="detail-back" type="button" data-back="activity-detail">${icon("arrow-left")} Torna a ${escapeHtml(activity.title)}</button>
    ${pageHeading("RÚBRICA", "Edita la rúbrica", `Defineix les evidències, les competències vinculades i el criteri observable per assolir cada nivell de ${escapeHtml(activity.title)}.`)}
    <form id="activity-rubric-form" data-activity-id="${escapeHtml(activity.id)}">
      <section class="panel activity-rubric-editor">
        <div class="panel-heading"><div><h2 class="section-title">Evidències i criteris d'avaluació</h2><span class="section-caption">Escriu què ha de demostrar l'alumnat a cada nivell.</span></div><button class="button" type="button" data-add-rubric-evidence>${icon("plus")} Afegeix evidència</button></div>
        <div class="table-wrap activity-rubric-table-wrap"><table class="assessment-table activity-rubric-table"><thead><tr><th>Evidències</th><th>Competències</th>${levelHeaders.map(([abbreviation, label]) => `<th title="${label}">${abbreviation}<small>${label}</small></th>`).join("")}</tr></thead><tbody>${evidenceRows || `<tr class="rubric-empty-row"><td colspan="6">Encara no hi ha evidències. Afegeix-ne una per començar la rúbrica.</td></tr>`}</tbody></table></div>
      </section>
      <div class="activity-rubric-actions"><button class="button" type="button" data-back="activity-detail">Cancel·la</button><button class="button button-primary" type="submit">${icon("check")} Desa la rúbrica</button></div>
    </form>`;
}

function renderActivityStudentReport() {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  const student = data.students.find(item => item.id === state.selectedStudentId);
  if (!activity || !student) {
    content.innerHTML = `<button class="detail-back" type="button" data-back="activity-report">${icon("arrow-left")} Torna</button>
      <div class="empty-state"><strong>No s'ha trobat l'informe</strong>L'activitat o l'alumne ja no existeix.</div>`;
    return;
  }
  const report = isNonAssessedActivity(activity)
    ? '<div class="empty-state"><strong>Activitat no avaluable</strong>Aquesta activitat no té evidències i no genera informe de qualificació.</div>'
    : getActivityStudentReportMarkup(activity.id, student.id, state.selectedSubjectId);
  const returnLabel = state.activityReportReturnView === "students" ? "Torna al perfil de l'alumne" : "Torna a l'avaluació";
  content.innerHTML = `<button class="detail-back" type="button" data-back="activity-report">${icon("arrow-left")} ${returnLabel}</button>
    <section class="panel activity-report-view">
      <div class="activity-report-view-toolbar"><span>Informe d'activitat</span><button class="button button-primary" type="button" data-export-student-report="${escapeHtml(student.id)}">${icon("download")} Exporta PDF</button></div>
      ${report}
    </section>`;
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
    if (sort === "activity-group-asc") {
      if (!a.dataset.activityGroup !== !b.dataset.activityGroup) return a.dataset.activityGroup ? -1 : 1;
      return a.dataset.activityGroup.localeCompare(b.dataset.activityGroup, "ca") ||
        a.dataset.studentName.localeCompare(b.dataset.studentName, "ca");
    }
    if (sort === "group-asc") {
      return a.dataset.studentGroup.localeCompare(b.dataset.studentGroup, "ca") ||
        a.dataset.studentName.localeCompare(b.dataset.studentName, "ca");
    }
    if (sort.startsWith("surname")) {
      return (sort === "surname-desc" ? -1 : 1) * a.dataset.studentSurname.localeCompare(b.dataset.studentSurname, "ca");
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
      (status === "assessed" && row.dataset.assessed === "true") ||
      (status === "pending" && row.dataset.assessed !== "true" && row.dataset.exempt !== "true") ||
      (status === "passed" && row.dataset.assessed === "true" && grade !== null && grade >= 5) ||
      (status === "not-passed" && row.dataset.assessed === "true" && grade !== null && grade < 5);
    const matchesGroup = !groupFilter.value || row.dataset.classGroup === groupFilter.value;
    const matchesQuery = normalizeSearchText(`${row.dataset.studentName} ${row.dataset.studentGroup} ${row.dataset.activityGroup}`).includes(query);
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
  const gradeDisplay = gradeCell?.querySelector(".activity-grade-report-result");
  if (gradeDisplay) gradeDisplay.innerHTML = gradeBadge(activityGrade);
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  const assessment = activity && calculateAssessment(data, studentId, activity.id, state.selectedOfferingId);
  const fullyAssessed = Boolean(activity && areAllActivityEvidencesAssessed(activity, assessment));
  row.dataset.assessed = fullyAssessed ? "true" : "false";
  const didNotPass = fullyAssessed && activityGrade !== null && activityGrade < 5;
  row.classList.toggle("assessment-row-warning", didNotPass);
  const warningLabel = content.querySelector(`[data-warning-for="${CSS.escape(studentId)}"]`);
  if (warningLabel) warningLabel.hidden = !didNotPass;
  if (activity) {
    const offering = data.teachingOffers.find(item => item.id === state.selectedOfferingId);
    const students = offering ? getOfferingStudents(data, offering) : [];
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

function normalizeSearch(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function competencySearchText(competency) {
  return normalizeSearch([
    competency.name, competency.description, ...competency.educationalLevels, ...competency.subjects,
    ...competency.learningOutcomes.flatMap(outcome => [outcome.name, outcome.description, ...outcome.criteria.map(criterion => criterion.text)])
  ].join(" "));
}

function competencyCards() {
  const terms = normalizeSearch(state.competencyQuery).split(/\s+/).filter(Boolean);
  const filtered = data.competencies.filter(competency => {
    const text = competencySearchText(competency);
    const matchesSource = !state.competencySource || (state.competencySource === "bank") === isBankCompetency(competency.id);
    const matchesLevel = !state.competencyLevel || competency.educationalLevels.includes(state.competencyLevel);
    const matchesSubject = !state.competencySubject || competency.subjects.includes(state.competencySubject);
    return matchesSource && matchesLevel && matchesSubject && terms.every(term => text.includes(term));
  });
  if (!filtered.length) return `<div class="empty-state"><strong>No hi ha coincidències</strong>Prova una altra cerca o crea una competència pròpia.</div>`;
  return `<div class="card-grid">${filtered.map(competency => {
    const evidenceCount = data.activities.flatMap(activity => activity.evidences.filter(evidence => Number(evidence.contributions[competency.id]) > 0)).length;
    const grades = data.students.map(student => getCompetencyGrade(student.id, competency.id)).filter(grade => grade !== null);
    const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
    const outcomeCount = competency.learningOutcomes.length;
    const criteriaCount = competency.learningOutcomes.reduce((sum, outcome) => sum + outcome.criteria.length, 0);
    return `<article class="record-card"><div class="record-card-top"><h3>${escapeHtml(competency.name)}</h3><span class="badge">${isBankCompetency(competency.id) ? "Banc" : "Pròpia"}</span></div><p>${escapeHtml(competency.description || "Sense descripció")}</p><div class="tag-list">${[...competency.educationalLevels, ...competency.subjects].map(tag => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}</div><p class="section-caption">${outcomeCount} ${outcomeCount === 1 ? "resultat d'aprenentatge" : "resultats d'aprenentatge"} · ${criteriaCount} ${criteriaCount === 1 ? "criteri" : "criteris"} · ${evidenceCount} ${evidenceCount === 1 ? "evidència" : "evidències"}</p><div class="progress-track" style="margin-top:14px"><div class="progress-fill ${gradeColorClass(average)}" style="width:${gradeWidth(average)}%"></div></div><div class="record-footer"><span>Mitjana del grup</span>${gradeBadge(average)}</div><button class="text-button" type="button" data-edit-competency="${escapeHtml(competency.id)}">Obre la competència ${icon("arrow-right")}</button></article>`;
  }).join("")}</div>`;
}

function renderCompetencies() {
  if (state.selectedCompetencyId) {
    renderCompetencyDetail();
    return;
  }
  const subjects = [...new Set(data.competencies.flatMap(competency => competency.subjects))].sort((a, b) => a.localeCompare(b, "ca"));
  const levelFilter = `<select class="search-input group-filter" id="competency-level" aria-label="Filtra per nivell educatiu"><option value="">Tots els nivells</option>${EDUCATIONAL_LEVELS.flatMap(stage => stage.levels).map(level => `<option value="${escapeHtml(level)}" ${state.competencyLevel === level ? "selected" : ""}>${escapeHtml(level)}</option>`).join("")}</select>`;
  const subjectFilter = `<select class="search-input group-filter" id="competency-subject" aria-label="Filtra per matèria"><option value="">Totes les matèries</option>${subjects.map(subject => `<option value="${escapeHtml(subject)}" ${state.competencySubject === subject ? "selected" : ""}>${escapeHtml(subject)}</option>`).join("")}</select>`;
  const action = `${levelFilter}${subjectFilter}<select class="search-input group-filter" id="competency-source" aria-label="Filtra per origen"><option value="">Totes</option><option value="bank" ${state.competencySource === "bank" ? "selected" : ""}>Banc de competències</option><option value="custom" ${state.competencySource === "custom" ? "selected" : ""}>Pròpies</option></select><input class="search-input" id="competency-search" type="search" placeholder="Cerca competències, resultats o criteris…" value="${escapeHtml(state.competencyQuery)}" aria-label="Cerca competències"><button class="button button-primary" type="button" data-action="create-competency">${icon("plus")} Crea competència</button>`;
  content.innerHTML = `${pageHeading("OBJECTIUS D'APRENENTATGE", "Competències", "Cerca al banc de competències compartit o crea’n de pròpies, amb els seus resultats d'aprenentatge i criteris d'avaluació.", action)}<div id="competency-results">${competencyCards()}</div>`;
  for (const [id, key] of [["#competency-source", "competencySource"], ["#competency-level", "competencyLevel"], ["#competency-subject", "competencySubject"]]) {
    document.querySelector(id).addEventListener("change", event => {
      state[key] = event.target.value;
      document.querySelector("#competency-results").innerHTML = competencyCards();
    });
  }
  document.querySelector("#competency-search").addEventListener("input", event => {
    state.competencyQuery = event.target.value;
    document.querySelector("#competency-results").innerHTML = competencyCards();
  });
}

function competencyCriterionMarkup(criterion) {
  return `<div class="criterion-row" data-criterion-id="${escapeHtml(criterion.id)}"><input name="criterionText" maxlength="400" required aria-label="Criteri d'avaluació" placeholder="Criteri d'avaluació" value="${escapeHtml(criterion.text)}"><button class="text-button" type="button" data-remove-criterion aria-label="Elimina el criteri">${icon("trash")}</button></div>`;
}

function competencyOutcomeMarkup(outcome) {
  return `<section class="panel outcome-item" data-outcome-id="${escapeHtml(outcome.id)}">
    <div class="field"><label>Resultat d'aprenentatge</label><input name="outcomeName" maxlength="200" required placeholder="Nom del resultat d'aprenentatge" value="${escapeHtml(outcome.name)}"></div>
    <div class="field"><label>Descripció</label><textarea name="outcomeDescription" maxlength="600">${escapeHtml(outcome.description)}</textarea></div>
    <div class="field"><label>Criteris d'avaluació</label><div class="criteria-list">${outcome.criteria.map(competencyCriterionMarkup).join("")}</div></div>
    <div class="outcome-actions"><button class="button" type="button" data-add-criterion>${icon("plus")} Afegeix criteri</button><button class="text-button" type="button" data-remove-outcome>${icon("trash")} Elimina el resultat</button></div>
  </section>`;
}

function knownCompetencySubjects() {
  return [...new Set(data.competencies.flatMap(competency => competency.subjects))].sort((a, b) => a.localeCompare(b, "ca"));
}

function competencyTagChip(name, value) {
  return `<span class="badge tag-chip"><input type="hidden" name="${name}" value="${escapeHtml(value)}">${escapeHtml(value)}<button class="tag-remove" type="button" data-remove-tag aria-label="Elimina ${escapeHtml(value)}">${icon("xmark")} ×</button></span>`;
}

function competencyTagEditor(name, label, selected, options, placeholder, allowNew = false) {
  const available = options.filter(option => !selected.includes(option));
  return `<div class="field tag-editor" data-tag-name="${name}"><label>${label}</label>
    <div class="level-selection-add"><select data-tag-select aria-label="${label}"><option value="">${placeholder}</option>${available.map(option => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select>${allowNew ? '<input data-tag-new maxlength="80" placeholder="o escriu-ne una de nova" aria-label="Nova matèria">' : ""}<button class="button" type="button" data-add-tag>${icon("plus")} Afegeix</button></div>
    <div class="tag-list">${selected.map(value => competencyTagChip(name, value)).join("")}</div></div>`;
}

function renderCompetencyDetail() {
  const competency = data.competencies.find(item => item.id === state.selectedCompetencyId);
  if (!competency) {
    state.selectedCompetencyId = null;
    renderCompetencies();
    return;
  }
  const bank = isBankCompetency(competency.id);
  const modified = bank && JSON.stringify(withoutUnmodifiedBank({ competencies: [competency] }).competencies).length > 2;
  content.innerHTML = `<button class="detail-back" type="button" data-back="competencies">${icon("arrow-left")} Torna a les competències</button>
    ${pageHeading(bank ? "BANC DE COMPETÈNCIES" : "COMPETÈNCIA PRÒPIA", escapeHtml(competency.name), bank ? (modified ? "Aquesta competència del banc té canvis propis." : "Competència del banc compartit. Si l'edites, els canvis només s'apliquen a les teves dades.") : "Edita’n tota la informació.")}
    <form id="competency-form" data-competency-id="${escapeHtml(competency.id)}">
      <div class="field"><label for="competency-detail-name">Nom de la competència</label><input id="competency-detail-name" name="name" required maxlength="140" value="${escapeHtml(competency.name)}"></div>
      <div class="field"><label for="competency-detail-description">Descripció</label><textarea id="competency-detail-description" name="description" maxlength="500">${escapeHtml(competency.description)}</textarea></div>
      ${competencyTagEditor("educationalLevel", "Nivells educatius", competency.educationalLevels, EDUCATIONAL_LEVELS.flatMap(stage => stage.levels), "Afegeix un nivell…")}
      ${competencyTagEditor("subject", "Matèries", competency.subjects, knownCompetencySubjects(), "Afegeix una matèria…", true)}
      <h2 class="section-title">Resultats d'aprenentatge</h2>
      <div id="competency-outcomes">${competency.learningOutcomes.map(competencyOutcomeMarkup).join("")}</div>
      <div class="outcome-actions"><button class="button" type="button" data-add-outcome>${icon("plus")} Afegeix resultat d'aprenentatge</button></div>
      <div class="outcome-actions"><button class="button button-primary" type="submit">${icon("check")} Desa els canvis</button>${bank ? "" : `<button class="button danger-text" type="button" data-delete-competency="${escapeHtml(competency.id)}">${icon("trash")} Elimina la competència</button>`}${modified ? `<button class="button" type="button" data-restore-competency>${icon("undo")} Restaura el valor del banc</button>` : ""}</div>
    </form>`;
}

function renderClassGroups() {
  const currentYear = data.academicYears.find(year => year.id === data.currentAcademicYearId);
  const action = `<label class="current-year-control"><span>Curs vigent</span><select data-current-year aria-label="Canvia el curs acadèmic vigent">${data.academicYears.map(year => `<option value="${escapeHtml(year.id)}" ${year.id === data.currentAcademicYearId ? "selected" : ""}>${escapeHtml(year.name)}</option>`).join("")}</select></label><button class="button" type="button" data-action="create-academic-year">${icon("plus")} Afegeix curs</button><button class="button button-primary" type="button" data-action="create-class-group">${icon("plus")} Crea grup classe</button>`;
  content.innerHTML = `${pageHeading("ORGANITZACIÓ DE L'ALUMNAT", "Grups classe", "Organitza grups i matrícules per curs acadèmic; les ofertes docents connecten aquests grups amb la planificació.", action)}
    ${data.classGroups.length ? `<div class="card-grid">${data.classGroups.map(classGroup => {
      const students = data.students.filter(student =>
        getStudentEnrollment(student, classGroup.academicYearId)?.classGroupId === classGroup.id
      );
      const year = data.academicYears.find(item => item.id === classGroup.academicYearId);
      return `<article class="record-card"><div class="record-card-top"><div><h3>${escapeHtml(classGroup.name)}</h3><p>${students.length} ${students.length === 1 ? "alumne" : "alumnes"} · ${escapeHtml(year?.name || "Curs desconegut")}</p></div><span class="badge">${classGroup.subgroups.length} ${classGroup.subgroups.length === 1 ? "desdoblament" : "desdoblaments"}</span></div>
        ${classGroup.subgroups.length ? `<div class="subgroup-list">${classGroup.subgroups.map(subgroup => {
          const count = students.filter(student =>
            getStudentEnrollment(student, classGroup.academicYearId)?.subgroupId === subgroup.id
          ).length;
          return `<div class="subgroup-row"><span>${escapeHtml(subgroup.name)}</span><span class="section-caption">${count} ${count === 1 ? "alumne" : "alumnes"}</span></div>`;
        }).join("")}</div>` : '<p class="section-caption">Sense desdoblaments. Afegeix-ne si la classe es divideix en subgrups.</p>'}
        <div class="record-actions"><button class="text-button" type="button" data-filter-class-group="${escapeHtml(classGroup.id)}">Veure alumnes ${icon("arrow-right")}</button><button class="text-button" type="button" data-edit-class-group="${escapeHtml(classGroup.id)}">${icon("edit-pencil")} Edita grup</button><button class="text-button danger-text" type="button" data-delete-class-group="${escapeHtml(classGroup.id)}">${icon("trash")} Elimina</button></div></article>`;
    }).join("")}</div>` : emptyState("Encara no hi ha grups classe", "Crea un grup classe per organitzar-hi l'alumnat i els desdoblaments.", "create-class-group", "Crea grup classe")}
    <div class="page-heading supplementary-groups-heading"><div><p class="eyebrow">OPTATIVES, SIEI I ALTRES</p><h2>Grups addicionals</h2><p class="page-subtitle">Un alumne pot formar part de diversos grups addicionals, independentment del seu grup classe.</p></div><div class="heading-actions"><button class="button button-primary" type="button" data-action="create-additional-group">${icon("plus")} Crea grup addicional</button></div></div>
    ${data.additionalGroups.length ? `<div class="card-grid">${data.additionalGroups.map(group => {
      const students = data.students.filter(student =>
        getStudentEnrollment(student, data.currentAcademicYearId)?.additionalGroupIds.includes(group.id)
      );
      return `<article class="record-card"><div class="record-card-top"><div><h3>${escapeHtml(group.name)}</h3><p>${students.length} ${students.length === 1 ? "alumne" : "alumnes"}</p></div></div>
        <div class="record-actions"><button class="text-button" type="button" data-filter-additional-group="${escapeHtml(group.id)}">Veure alumnes ${icon("arrow-right")}</button><button class="text-button" type="button" data-edit-additional-group="${escapeHtml(group.id)}">${icon("edit-pencil")} Edita grup</button><button class="text-button danger-text" type="button" data-delete-additional-group="${escapeHtml(group.id)}">${icon("trash")} Elimina</button></div></article>`;
    }).join("")}</div>` : `<div class="empty-state">Encara no hi ha grups addicionals. Crea'n per organitzar les optatives, el SIEI o altres necessitats.</div>`}`;
}

function renderSubjects() {
  const action = `<button class="button button-primary" type="button" data-action="create-subject">${icon("plus")} Crea assignatura</button>`;
  content.innerHTML = `${pageHeading("PLANIFICACIÓ DOCENT", "Assignatures", "Organitza les assignatures i defineix per separat els nivells, grups, seqüències i progressos competencials.", action)}
    ${data.subjects.length ? `<div class="card-grid">${data.subjects.map(subject => {
      return `<article class="record-card subject-record-card" data-open-subject="${escapeHtml(subject.id)}" tabindex="0" role="link" aria-label="Obre l'assignatura ${escapeHtml(subject.name)}"><div class="record-card-top"><div><h3>${escapeHtml(subject.name)}</h3><p>${escapeHtml(subject.description || "Sense descripció")}</p></div><span class="badge">${subject.levels.length} ${subject.levels.length === 1 ? "nivell" : "nivells"}</span></div>
        <div class="record-footer"><span>${subject.levels.map(level => escapeHtml(level.name || "Sense nivell")).join(", ") || "Sense nivells definits"}</span></div>
        <div class="record-actions"><span class="text-button subject-open-label">Obre assignatura ${icon("arrow-right")}</span><button class="text-button" type="button" data-edit-subject="${escapeHtml(subject.id)}">${icon("edit-pencil")} Edita assignatura</button></div></article>`;
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
    const offerings = getLevelOffers(data, level.id, subject.id);
    const groups = [
      ...[...new Set(offerings.flatMap(offer => offer.classGroupIds))].map(id => ({ ...getClassGroup(id), type: "Grup classe" })).filter(group => group.id),
      ...[...new Set(offerings.flatMap(offer => offer.additionalGroupIds))].map(id => ({ ...data.additionalGroups.find(group => group.id === id), type: "Grup addicional" })).filter(group => group.id)
    ];
    const students = [...new Map(offerings.flatMap(offer => getOfferingStudents(data, offer)).map(student => [student.id, student])).values()];
    const eligibleStudents = students.filter(student => !isStudentExemptFromSubject(data, student.id, subject.id));
    const competencies = data.competencies.filter(competency => level.competencyIds.includes(competency.id));
    const sequenceActivities = getSequenceActivities(level);
    const hours = getSequenceItems(level).reduce((total, item) => total + Number(item.hours), 0);
    const grades = eligibleStudents.flatMap(student => competencies.map(competency => getLevelCompetencyGrade(level, student.id, competency.id, subject.id)).filter(grade => grade !== null));
    const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
    const situations = level.situations.length;
    return `<article class="record-card level-record-card" data-open-level="${escapeHtml(level.id)}" tabindex="0" role="link" aria-label="Obre el seguiment de ${escapeHtml(level.name || "el nivell")} de ${escapeHtml(subject.name)}"><div class="record-card-top"><div><h3>${escapeHtml(level.name || "Sense nivell")}</h3><p>${groups.length ? escapeHtml(groups.map(group => `${group.name} (${group.type})`).join(", ")) : "Sense grups assignats"}</p></div><span class="badge">${groups.length} ${groups.length === 1 ? "grup" : "grups"}</span></div>
      <div class="level-card-metrics"><span>${students.length} ${students.length === 1 ? "alumne" : "alumnes"}</span><span>${sequenceActivities.length} ${sequenceActivities.length === 1 ? "activitat" : "activitats"}</span><span>${situations} ${situations === 1 ? "situació" : "situacions"}</span><span>${hours.toLocaleString("ca-ES")} h</span></div>
      <div class="record-footer"><span>Progrés competencial</span>${gradeBadge(average)}</div><div class="record-actions"><span class="text-button subject-open-label">Obre seguiment ${icon("arrow-right")}</span><button class="text-button" type="button" data-open-level-sequence="${escapeHtml(level.id)}">Obre seqüència</button><button class="text-button" type="button" data-edit-level="${escapeHtml(level.id)}">${icon("edit-pencil")} Edita nivell</button></div></article>`;
  }).join("");
  content.innerHTML = `<button class="detail-back" type="button" data-back="subjects">${icon("arrow-left")} Torna a les assignatures</button>
    ${pageHeading("ASSIGNATURA", escapeHtml(subject.name), escapeHtml(subject.description || "Nivells, grups, seqüències i seguiment competencial."), `<button class="button" type="button" data-edit-subject="${escapeHtml(subject.id)}">${icon("edit-pencil")} Edita assignatura</button>${action}`)}
    ${subject.levels.length ? `<div class="card-grid">${levelCards}</div>` : emptyState("Encara no hi ha nivells", "Afegeix un nivell per assignar-hi els grups classe o addicionals, la seqüència i el progrés competencial.", "create-level", "Afegeix nivell")}`;
}

function renderLevelDetail() {
  const subject = data.subjects.find(item => item.id === state.selectedSubjectId);
  const level = subject?.levels.find(item => item.id === state.selectedLevelId);
  if (!subject || !level) {
    state.selectedLevelId = null;
    renderSubjectDetail();
    return;
  }
  const offerings = getLevelOffers(data, level.id, subject.id);
  const allOfferings = getLevelOffers(data, level.id, subject.id, false);
  const currentClassGroupIds = [...new Set(offerings.flatMap(offer => offer.classGroupIds))];
  const currentAdditionalGroupIds = [...new Set(offerings.flatMap(offer => offer.additionalGroupIds))];
  const students = [...new Map(offerings.flatMap(offer => getOfferingStudents(data, offer)).map(student => [student.id, student])).values()];
  const groups = [
    ...currentClassGroupIds.map(id => ({ ...getClassGroup(id), type: "Grup classe" })).filter(group => group.id),
    ...currentAdditionalGroupIds.map(id => ({ ...data.additionalGroups.find(group => group.id === id), type: "Grup addicional" })).filter(group => group.id)
  ];
  const competencies = data.competencies.filter(competency => level.competencyIds.includes(competency.id));
  const sequenceActivities = level.situations.flatMap(situation =>
    situation.activities.map(item => ({ ...item, situationName: situation.name }))
  );
  const totalHours = sequenceActivities.reduce((total, item) => total + Number(item.hours), 0);
  const sequenceRows = sequenceActivities.map((item, index) => {
    if (isLectureItem(item)) {
      return `<tr><td>${index + 1}</td><td>${escapeHtml(item.situationName)}</td><td><strong>${escapeHtml(item.title)}</strong><br><span class="section-caption">Classe · seguiment diari</span></td><td>${Number(item.hours).toLocaleString("ca-ES")} h</td><td><span class="grade-empty">No s'avalua amb rúbrica</span></td><td></td></tr>`;
    }
    const activity = data.activities.find(record => record.id === item.activityId);
    if (!activity) return "";
    const contributions = competencies
      .map(competency => ({ competency, weight: getActivityCompetencyContribution(activity, competency.id) }))
      .filter(contribution => contribution.weight > 0)
      .map(({ competency, weight }) => `<span class="badge">${escapeHtml(competency.name)} · ${weight.toLocaleString("ca-ES")}%</span>`)
      .join(" ");
    return `<tr><td>${index + 1}</td><td>${escapeHtml(item.situationName)}</td><td><strong>${escapeHtml(activity.title)}</strong><br><span class="section-caption">${escapeHtml(activity.type)} · ${formatDate(activity.date)}</span></td><td>${Number(item.hours).toLocaleString("ca-ES")} h</td><td>${contributions || '<span class="grade-empty">Sense contribucions configurades</span>'}</td><td><button class="text-button" type="button" data-open-activity="${escapeHtml(activity.id)}" data-subject-id="${escapeHtml(subject.id)}" data-level-id="${escapeHtml(level.id)}">Obre ${icon("arrow-right")}</button></td></tr>`;
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
  const offeringRows = allOfferings.map(offer => {
    const year = data.academicYears.find(item => item.id === offer.academicYearId);
    const offerGroups = [
      ...offer.classGroupIds.map(id => getClassGroup(id)?.name),
      ...offer.additionalGroupIds.map(id => data.additionalGroups.find(group => group.id === id)?.name)
    ].filter(Boolean);
    const rosterCount = getOfferingStudents(data, offer).length;
    const isCurrent = offer.academicYearId === data.currentAcademicYearId;
    const statusLabel = offer.status === "archived" ? "Arxivada" : isCurrent ? "Vigent" : "Curs anterior";
    return `<article class="teaching-offer-card"><div><strong>${escapeHtml(year?.name || "Curs desconegut")}</strong><span>${escapeHtml(offerGroups.join(", "))} · ${rosterCount} alumnes</span></div><span class="badge ${isCurrent && offer.status === "active" ? "grade-achieved" : ""}">${statusLabel}</span><div class="record-actions"><button class="text-button" type="button" data-edit-teaching-offer="${escapeHtml(offer.id)}">${icon("edit-pencil")} Edita oferta</button>${offer.status === "active" ? `<button class="text-button danger-text" type="button" data-archive-teaching-offer="${escapeHtml(offer.id)}">${icon("archive")} Arxiva</button>` : ""}</div></article>`;
  }).join("");
  const groupChips = groups.map(group => {
    const groupStudents = [...new Map(offerings.flatMap(offer => getOfferingStudents(data, offer).filter(student =>
      group.type === "Grup classe"
        ? offer.classGroupIds.includes(student.enrollments.find(enrollment => enrollment.academicYearId === offer.academicYearId)?.classGroupId)
        : offer.additionalGroupIds.some(id => student.enrollments.find(enrollment => enrollment.academicYearId === offer.academicYearId)?.additionalGroupIds.includes(id))
    )).map(student => [student.id, student])).values()];
    return `<span class="badge">${escapeHtml(group.name)} · ${group.type} · ${groupStudents.length} alumnes</span>`;
  }).join("");
  content.innerHTML = `<button class="detail-back" type="button" data-back="level">${icon("arrow-left")} Torna als nivells de ${escapeHtml(subject.name)}</button>
    ${pageHeading(escapeHtml(level.name.toUpperCase()), escapeHtml(subject.name), "Planificació programativa i ofertes docents separades per curs i grup.", `<button class="button" type="button" data-open-level-sequence>Obre seqüència ${icon("arrow-right")}</button><button class="button" type="button" data-action="create-teaching-offer">${icon("plus")} Afegeix oferta</button><button class="button" type="button" data-edit-level="${escapeHtml(level.id)}">${icon("edit-pencil")} Edita nivell</button>`)}
    <div class="metric-grid">
      <div class="metric-card"><div class="metric-top"><span>Grups assignats</span>${icon("view-grid", "metric-icon")}</div><div class="metric-value">${groups.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Alumnes</span>${icon("group", "metric-icon")}</div><div class="metric-value">${students.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Activitats i proves</span>${icon("list-select", "metric-icon")}</div><div class="metric-value">${sequenceActivities.filter(item => !isLectureItem(item)).length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Hores planificades</span>${icon("clock", "metric-icon")}</div><div class="metric-value">${totalHours.toLocaleString("ca-ES")}</div></div>
    </div>
    <section class="panel"><div class="panel-heading"><div><h2 class="section-title">Ofertes docents</h2><span class="section-caption">L'enllaç entre aquesta planificació i les matrícules dels grups classe o addicionals.</span></div><button class="text-button" type="button" data-action="create-teaching-offer">${icon("plus")} Afegeix oferta</button></div>
      ${offeringRows ? `<div class="teaching-offer-list">${offeringRows}</div>` : "<div class=\"empty-state\">Aquest nivell encara no s'ha ofert a cap grup. La seqüència continua al banc de planificació, sense alumnat a avaluar.</div>"}</section>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><div><h2 class="section-title">Grups del curs vigent</h2><span class="section-caption">${escapeHtml(level.name)} · Matrícules incloses en l'avaluació</span></div></div>
      ${groups.length ? `<div class="group-chip-list">${groupChips}</div>` : '<div class="empty-state">Encara no hi ha grups al curs vigent.</div>'}</section>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><div><h2 class="section-title">Seqüència d'aprenentatge</h2><span class="section-caption">Les hores són la dedicació prevista. La contribució pesa l'evidència de l'activitat en la nota de cada competència.</span></div><button class="text-button" type="button" data-edit-level="${escapeHtml(level.id)}">${icon("edit-pencil")} Edita seqüència ${icon("arrow-right")}</button></div>
      ${sequenceActivities.length ? `<div class="table-wrap"><table class="assessment-table subject-sequence-table"><thead><tr><th>#</th><th>Situació d'aprenentatge</th><th>Activitat o examen</th><th>Hores</th><th>Contribució a les competències</th><th></th></tr></thead><tbody>${sequenceRows}</tbody><tfoot><tr><th colspan="3">Total d'hores</th><th>${totalHours.toLocaleString("ca-ES")} h</th><th colspan="2"></th></tr></tfoot></table></div>` : emptyState("Seqüència buida", "Edita aquest nivell per afegir activitats i exàmens.", "edit-level", "Edita nivell")}</section>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><div><h2 class="section-title">Progrés competencial</h2><span class="section-caption">Mitjana del grup ponderada per la contribució de cada activitat i les hores de dedicació</span></div></div>
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
  const situations = level.situations;
  const sequenceItems = getSequenceItems(level);
  const sequenceActivities = getSequenceActivities(level);
  const totalHours = sequenceItems.reduce((total, item) => total + Number(item.hours), 0);
  const situationCards = situations.map((situation, situationIndex) => {
    const items = situation.activities;
    const activityCards = items.map(item => {
      const sequenceNumber = sequenceItems.indexOf(item) + 1;
      if (isLectureItem(item)) {
        return `<article class="sequence-activity sequence-lecture">
        <div class="sequence-activity-number">${String(sequenceNumber).padStart(2, "0")}</div>
        <div class="sequence-activity-copy"><h3>${escapeHtml(item.title)}</h3><p>Classe · s'avalua amb el seguiment diari</p></div>
        <div class="sequence-activity-meta"><span>${Number(item.hours).toLocaleString("ca-ES")} h</span></div>
      </article>`;
      }
      const activity = data.activities.find(record => record.id === item.activityId);
      if (!activity) return "";
      const contributions = competencies
        .map(competency => ({ competency, contribution: getActivityCompetencyContribution(activity, competency.id) }))
        .filter(({ contribution }) => contribution > 0)
        .map(({ competency, contribution }) => `<span class="badge">${escapeHtml(competency.name)} · ${contribution.toLocaleString("ca-ES")}%</span>`)
        .join(" ");
      return `<article class="sequence-activity">
        <div class="sequence-activity-number">${String(sequenceNumber).padStart(2, "0")}</div>
        <div class="sequence-activity-copy"><h3>${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.type)} · ${formatDate(activity.date)}</p>${contributions ? `<div class="sequence-contributions">${contributions}</div>` : '<span class="grade-empty">Sense contribucions configurades</span>'}</div>
        <div class="sequence-activity-meta"><span>${Number(item.hours).toLocaleString("ca-ES")} h</span><button class="text-button" type="button" data-open-activity="${escapeHtml(activity.id)}" data-subject-id="${escapeHtml(subject.id)}" data-level-id="${escapeHtml(level.id)}">Obre activitat ${icon("arrow-right")}</button></div>
      </article>`;
    }).join("");
    const hours = items.reduce((total, item) => total + Number(item.hours), 0);
    const lectureCount = items.filter(isLectureItem).length;
    return `<section class="sequence-situation">
      <div class="sequence-situation-heading"><div><span class="section-caption">SITUACIÓ D'APRENENTATGE ${situationIndex + 1}</span><h2>${escapeHtml(situation.name)}</h2></div><span class="badge">${items.length - lectureCount} ${items.length - lectureCount === 1 ? "activitat" : "activitats"}${lectureCount ? ` · ${lectureCount} ${lectureCount === 1 ? "classe" : "classes"}` : ""} · ${hours.toLocaleString("ca-ES")} h</span></div>
      <div class="sequence-activity-list">${activityCards || '<p class="sequence-empty">Encara no hi ha activitats en aquesta situació.</p>'}</div>
      <button class="button sequence-add-activity" type="button" data-add-situation-activity="${escapeHtml(situation.id)}">${icon("plus")} Afegeix activitat a aquesta situació</button> <button class="button sequence-add-activity" type="button" data-add-situation-lecture="${escapeHtml(situation.id)}">${icon("plus")} Afegeix classe</button>
    </section>`;
  }).join("");
  content.innerHTML = `<button class="detail-back" type="button" data-back="levels">${icon("arrow-left")} Torna als nivells de ${escapeHtml(subject.name)}</button>
    ${pageHeading("SEQÜÈNCIA D'APRENENTATGE", escapeHtml(level.name || "Sense nivell"), escapeHtml(subject.name), `<button class="button" type="button" data-open-level-progress>${icon("graph-up")} Seguiment del nivell</button><button class="button" type="button" data-add-learning-situation>${icon("plus")} Afegeix situació</button><button class="button button-primary" type="button" data-edit-level="${escapeHtml(level.id)}">${icon("edit-pencil")} Edita seqüència</button>`)}
    <div class="metric-grid sequence-metrics">
      <div class="metric-card"><div class="metric-top"><span>Situacions d'aprenentatge</span>${icon("book-stack", "metric-icon")}</div><div class="metric-value">${situations.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Activitats i proves</span>${icon("list-select", "metric-icon")}</div><div class="metric-value">${sequenceActivities.length}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Hores planificades</span>${icon("clock", "metric-icon")}</div><div class="metric-value">${totalHours.toLocaleString("ca-ES")}</div></div>
      <div class="metric-card"><div class="metric-top"><span>Ofertes docents</span>${icon("view-grid", "metric-icon")}</div><div class="metric-value">${getLevelOffers(data, level.id, subject.id).length}</div></div>
    </div>
    <p class="section-caption">Les contribucions es calculen automàticament a partir de les evidències de cada activitat i es ponderen segons les hores de dedicació.</p>
    ${situations.length ? `<div class="sequence-situation-list">${situationCards}</div>` : emptyState("Seqüència buida", "Afegeix una situació d'aprenentatge per començar a organitzar-hi activitats.", "add-learning-situation", "Afegeix situació")}`;
}


export {
  setView, render, getClassGroup, getStudentGroupLabel, classGroupOptions, subgroupOptions,
  renderClassGroups, renderSubjectDetail, renderLevelDetail, renderLevelSequence, renderActivityDetail, renderActivityStudentReport, renderStudentDetail, renderStudentSubjectReport, studentDisplayName,
  updateActivityAssessmentRow, refreshActivityGroups, competencyOutcomeMarkup, competencyCriterionMarkup, competencyTagChip
};
