export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

export function icon(name, className = "") {
  return `<i class="iconoir-${name}${className ? ` ${className}` : ""}" aria-hidden="true"></i>`;
}

export function formatDate(value) {
  if (!value) return "Data no indicada";
  return new Intl.DateTimeFormat("ca-ES", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export function formatGrade(grade) {
  return grade === null ? "—" : `${grade.toLocaleString("ca-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

export function gradeAbbreviation(grade) {
  if (grade === null) return "";
  if (grade < 5) return "NA";
  if (grade < 7) return "AS";
  if (grade < 9) return "AN";
  return "AE";
}

export function formatGradeWithCode(grade) {
  return grade === null ? "—" : `${formatGrade(grade)} / 10 · ${gradeAbbreviation(grade)}`;
}

export function gradeColorClass(grade) {
  if (grade === null) return "grade-unrated";
  if (grade < 5) return "grade-warning";
  if (grade < 7) return "grade-developing";
  if (grade < 9) return "grade-achieved";
  return "grade-advanced";
}

export function gradeValue(grade) {
  return grade === null
    ? '<span class="grade-empty">—</span>'
    : `<span class="grade-score ${gradeColorClass(grade)}">${formatGradeWithCode(grade)}</span>`;
}

export function gradeWidth(grade) {
  return grade === null ? 0 : Math.max(0, Math.min(100, grade * 10));
}

export function gradeBadge(grade) {
  return grade === null ? '<span class="grade-empty">Sense evidències</span>' : `<span class="grade-pill ${gradeColorClass(grade)}">${formatGradeWithCode(grade)}</span>`;
}
