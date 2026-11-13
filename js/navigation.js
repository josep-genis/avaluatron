import { data, state } from "./state.js";

const labels = {
  overview: "Resum", students: "Alumnes", groups: "Grups classe",
  subjects: "Assignatures", activities: "Activitats i proves",
  "daily-followup": "Seguiment diari", competencies: "Competències",
  "teacher-profile": "Perfil docent"
};
const selectionDefaults = {
  selectedActivityId: null, selectedOfferingId: null, selectedStudentId: null,
  selectedStudentSubjectId: null, selectedStudentLevelId: null,
  activityReportReturnView: null, selectedSubjectId: null, selectedLevelId: null,
  selectedSequence: false, activityReturnToSequence: false, selectedCompetencyId: null
};
const historyKey = "avaluatroNavigation";
const breadcrumbs = document.querySelector(".breadcrumbs");
let currentRoute;
let crumbRoutes = [];

function snapshot() {
  return { ...state };
}

function topLevel(view, route) {
  return { ...route, ...selectionDefaults, currentView: view };
}

function routeKey(route) {
  const { currentView: view } = route;
  if (view === "students") return JSON.stringify([view, route.selectedStudentId, route.selectedStudentSubjectId, route.selectedStudentLevelId]);
  if (view === "subjects") return JSON.stringify([view, route.selectedSubjectId, route.selectedLevelId, route.selectedSequence]);
  if (view === "competencies") return JSON.stringify([view, route.selectedCompetencyId]);
  if (view === "activities" || view === "activity-rubric" || view === "activity-report") {
    return JSON.stringify([view, route.selectedActivityId, view === "activity-report" ? route.selectedStudentId : null,
      view === "activity-report" ? route.activityReportReturnView : null,
      route.activityReturnToSequence ? route.selectedSubjectId : null,
      route.activityReturnToSequence ? route.selectedLevelId : null]);
  }
  return JSON.stringify([view]);
}

function getCrumbs(route) {
  const crumbs = [{ label: "Espai docent", route: topLevel("overview", route) }];
  const add = (label, target) => crumbs.push({ label, route: target });
  const subject = data.subjects.find(item => item.id === route.selectedSubjectId);
  const level = subject?.levels.find(item => item.id === route.selectedLevelId);
  const student = data.students.find(item => item.id === route.selectedStudentId);
  const activity = data.activities.find(item => item.id === route.selectedActivityId);
  const competency = data.competencies.find(item => item.id === route.selectedCompetencyId);

  const addSubjects = () => {
    add(labels.subjects, topLevel("subjects", route));
    if (!subject) return;
    const subjectRoute = { ...topLevel("subjects", route), selectedSubjectId: subject.id };
    add(subject.name, subjectRoute);
    if (!level) return;
    const levelRoute = { ...subjectRoute, selectedLevelId: level.id };
    add(level.name || "Sense nivell", levelRoute);
    if (route.selectedSequence || route.activityReturnToSequence) {
      add("Seqüència d'aprenentatge", { ...levelRoute, selectedSequence: true });
    }
  };
  const addStudents = () => {
    add(labels.students, topLevel("students", route));
    if (!student) return;
    const studentRoute = { ...topLevel("students", route), selectedStudentId: student.id };
    add(`${student.firstName} ${student.lastName}`.trim(), studentRoute);
    const studentSubject = data.subjects.find(item => item.id === route.selectedStudentSubjectId);
    const studentLevel = studentSubject?.levels.find(item => item.id === route.selectedStudentLevelId);
    if (studentSubject && studentLevel) {
      add(`${studentSubject.name} · ${studentLevel.name}`, {
        ...studentRoute, selectedStudentSubjectId: studentSubject.id,
        selectedStudentLevelId: studentLevel.id, selectedSubjectId: studentSubject.id
      });
    }
  };
  const addActivity = () => {
    if (route.activityReturnToSequence && subject && level) addSubjects();
    else add(labels.activities, topLevel("activities", route));
    if (activity) add(activity.title, { ...route, currentView: "activities", selectedStudentId: null, activityReportReturnView: null });
  };

  if (route.currentView === "overview") return crumbs;
  if (route.currentView === "subjects") addSubjects();
  else if (route.currentView === "students") addStudents();
  else if (route.currentView === "activities" || route.currentView === "activity-rubric") {
    addActivity();
    if (route.currentView === "activity-rubric") add("Editor", route);
  } else if (route.currentView === "activity-report") {
    if (route.activityReportReturnView === "students") addStudents();
    else addActivity();
    add(`Informe · ${route.activityReportReturnView === "students" ? activity?.title || "Activitat" : student ? `${student.firstName} ${student.lastName}`.trim() : "Alumne"}`, route);
  } else {
    add(labels[route.currentView] || labels.overview, topLevel(route.currentView, route));
    if (route.currentView === "competencies" && competency) add(competency.name, route);
  }
  return crumbs;
}

function updateNavigation() {
  const route = snapshot();
  const activeView = route.currentView === "activity-report"
    ? route.activityReportReturnView || "activities"
    : route.currentView === "activity-rubric" ? "activities" : route.currentView;
  document.querySelectorAll(".nav-link").forEach(button => button.classList.toggle("active", button.dataset.view === activeView));
  document.querySelector("#teacher-profile-button").classList.toggle("active", activeView === "teacher-profile");
  const crumbs = getCrumbs(route);
  crumbRoutes = crumbs.map(crumb => crumb.route);
  breadcrumbs.replaceChildren();
  crumbs.forEach((crumb, index) => {
    if (index) {
      const separator = document.createElement("span");
      separator.className = "crumb-separator";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "/";
      breadcrumbs.append(separator);
    }
    const element = document.createElement(index === crumbs.length - 1 ? "strong" : "button");
    element.textContent = crumb.label;
    if (index === crumbs.length - 1) {
      element.id = "current-section";
      element.setAttribute("aria-current", "page");
    } else {
      element.type = "button";
      element.dataset.crumbIndex = index;
    }
    breadcrumbs.append(element);
  });
}

function saveHistory(route, replace) {
  const historyState = { ...history.state, [historyKey]: route };
  if (replace) history.replaceState(historyState, "");
  else history.pushState(historyState, "");
}

export function syncNavigation(event) {
  const route = snapshot();
  if (currentRoute && JSON.stringify(currentRoute) === JSON.stringify(route)) {
    const currentLabel = getCrumbs(route).at(-1).label;
    if (event?.type === "submit" || document.querySelector("#current-section").textContent !== currentLabel) updateNavigation();
    return;
  }
  const changed = currentRoute && routeKey(currentRoute) !== routeKey(route);
  saveHistory(route, !changed);
  currentRoute = route;
  updateNavigation();
}

export function initializeNavigation(render, dialog, notify) {
  function restore(route) {
    Object.assign(state, route);
    if (state.currentView === "activity-report" &&
      (!data.activities.some(item => item.id === state.selectedActivityId) ||
       !data.students.some(item => item.id === state.selectedStudentId))) {
      state.currentView = state.activityReportReturnView === "students" ? "students" : "activities";
      if (state.currentView === "students") state.selectedActivityId = null;
      else state.selectedStudentId = null;
      state.activityReportReturnView = null;
    }
    if (dialog.open) dialog.close();
    render();
    const restored = snapshot();
    if (routeKey(restored) !== routeKey(route)) notify("La vista anterior ja no està disponible.", true);
    currentRoute = restored;
    saveHistory(restored, true);
    updateNavigation();
  }

  const saved = history.state?.[historyKey];
  if (saved && (labels[saved.currentView] || ["activity-rubric", "activity-report"].includes(saved.currentView))) {
    restore(saved);
  } else {
    render();
    syncNavigation();
  }
  window.addEventListener("popstate", event => {
    const route = event.state?.[historyKey];
    restore(route || topLevel("overview", snapshot()));
    window.scrollTo(0, 0);
  });
  breadcrumbs.addEventListener("click", event => {
    const button = event.target.closest("[data-crumb-index]");
    if (!button) return;
    Object.assign(state, crumbRoutes[Number(button.dataset.crumbIndex)]);
    render();
    syncNavigation();
    window.scrollTo(0, 0);
  });
}
