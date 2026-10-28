import { EDUCATIONAL_LEVEL_NAMES } from "./education.js";

export const DAILY_FOLLOWUP_CRITERIA = [
  { id: "participation", name: "Participació" },
  { id: "preparation", name: "Preparació" },
  { id: "autonomy", name: "Autonomia" },
  { id: "collaboration", name: "Col·laboració" }
];

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function validateData(value, makeId) {
  if (!value || value.schemaVersion !== 1 || !["students", "competencies", "activities", "assessments"].every(key => Array.isArray(value[key]))) {
    throw new Error("el fitxer no té un format Avaluatró vàlid (versió 1).");
  }
  value.classGroups ??= [];
  value.subjects ??= [];
  value.dailyAssessments ??= [];
  value.subjectExemptions ??= [];
  value.activityExemptions ??= [];
  if (!Array.isArray(value.classGroups)) throw new Error("la llista de grups classe no és vàlida.");
  if (!Array.isArray(value.subjects)) throw new Error("la llista d'assignatures no és vàlida.");
  if (!Array.isArray(value.dailyAssessments)) throw new Error("la llista de seguiments diaris no és vàlida.");
  if (!Array.isArray(value.subjectExemptions)) throw new Error("la llista d'exempcions d'assignatura no és vàlida.");
  if (!Array.isArray(value.activityExemptions)) throw new Error("la llista d'exempcions d'activitat no és vàlida.");
  for (const subject of value.subjects) {
    const hasLegacyLevelData = subject && typeof subject === "object" &&
      ["level", "classGroupIds", "sequence"].some(key => Object.hasOwn(subject, key));
    if (subject && typeof subject === "object" && !Object.hasOwn(subject, "levels") && hasLegacyLevelData) {
      subject.levels = [{
        id: makeId("niv"),
        name: subject.level || "",
        classGroupIds: subject.classGroupIds || [],
        sequence: subject.sequence || []
      }];
      delete subject.level;
      delete subject.classGroupIds;
      delete subject.sequence;
    }
  }
  const legacyGroupNames = [...new Set(value.students.map(student => student.group?.trim()).filter(Boolean))];
  for (const name of legacyGroupNames) {
    let classGroup = value.classGroups.find(item => item.name === name);
    if (!classGroup) {
      classGroup = { id: makeId("gc"), name, subgroups: [] };
      value.classGroups.push(classGroup);
    }
    for (const student of value.students) {
      if (student.group?.trim() === name && !student.classGroupId) {
        student.classGroupId = classGroup.id;
        student.subgroupId = "";
      }
    }
  }
  for (const student of value.students) {
    if (typeof student.firstName !== "string" || typeof student.lastName !== "string") {
      const legacyName = String(student.name || "").trim();
      const [firstName = "", ...lastNames] = legacyName.split(/\s+/);
      student.firstName ??= firstName;
      student.lastName ??= lastNames.join(" ");
    }
    delete student.name;
    student.classGroupId ||= "";
    student.subgroupId ||= "";
    delete student.group;
  }
  for (const classGroup of value.classGroups) classGroup.subgroups ||= [];
  const ids = new Set();
  for (const listName of ["students", "competencies", "activities", "classGroups"]) {
    for (const record of value[listName]) {
      if (!record || typeof record.id !== "string" || !record.id || typeof record.name !== "string" && !["activities", "students"].includes(listName)) {
        throw new Error(`hi ha un registre invàlid a «${listName}».`);
      }
      if (ids.has(record.id)) throw new Error("hi ha identificadors duplicats.");
      ids.add(record.id);
      if (listName === "classGroups") {
        if (!Array.isArray(record.subgroups)) throw new Error("hi ha un grup classe invàlid.");
        for (const subgroup of record.subgroups) {
          if (!subgroup || typeof subgroup.id !== "string" || !subgroup.id || typeof subgroup.name !== "string" || ids.has(subgroup.id)) {
            throw new Error("hi ha un desdoblament invàlid o amb un identificador duplicat.");
          }
          ids.add(subgroup.id);
        }
      }
    }
    for (const student of value.students) {
      if (typeof student.firstName !== "string" || !student.firstName.trim() || typeof student.lastName !== "string") {
        throw new Error("cada alumne ha de tenir noms i cognoms vàlids.");
      }
    }
  }
  const studentIds = new Set(value.students.map(student => student.id));
  const classGroupIds = new Set(value.classGroups.map(classGroup => classGroup.id));
  const subgroupIds = new Set(value.classGroups.flatMap(classGroup => classGroup.subgroups.map(subgroup => subgroup.id)));
  for (const student of value.students) {
    if (student.classGroupId && !classGroupIds.has(student.classGroupId)) throw new Error("hi ha un alumne assignat a un grup classe inexistent.");
    if (student.subgroupId && !subgroupIds.has(student.subgroupId)) throw new Error("hi ha un alumne assignat a un desdoblament inexistent.");
    const assignedClassGroup = value.classGroups.find(classGroup => classGroup.id === student.classGroupId);
    if (student.subgroupId && !assignedClassGroup?.subgroups.some(subgroup => subgroup.id === student.subgroupId)) {
      throw new Error("el desdoblament d'un alumne no correspon al seu grup classe.");
    }
  }
  const competencyIds = new Set(value.competencies.map(competency => competency.id));
  const activityIds = new Set(value.activities.map(activity => activity.id));
  for (const activity of value.activities) {
    if (Array.isArray(activity.criteria) && !Array.isArray(activity.evidences)) {
      activity.evidences = activity.criteria.map(criterion => criterion && ({
        id: criterion.id,
        name: criterion.name,
        contributions: { [criterion.competencyId]: criterion.weight }
      }));
    }
    delete activity.criteria;
    if (typeof activity.title !== "string" || !Array.isArray(activity.evidences)) throw new Error("hi ha una activitat invàlida.");
    for (const evidence of activity.evidences) {
      if (!evidence || typeof evidence.id !== "string" || !evidence.id || ids.has(evidence.id) ||
        typeof evidence.name !== "string" || !evidence.name.trim() ||
        !evidence.contributions || typeof evidence.contributions !== "object" || Array.isArray(evidence.contributions) ||
        !Object.keys(evidence.contributions).length ||
        Object.entries(evidence.contributions).some(([competencyId, weight]) => !competencyIds.has(competencyId) || !Number.isFinite(Number(weight)) || Number(weight) <= 0 || Number(weight) > 100)) {
        throw new Error("hi ha una evidència de rúbrica invàlida o sense competències associades.");
      }
      delete evidence.weight;
      ids.add(evidence.id);
    }
  }
  for (const subject of value.subjects) {
    if (!subject || typeof subject.id !== "string" || !subject.id || typeof subject.name !== "string") {
      throw new Error("hi ha una assignatura invàlida.");
    }
    if (ids.has(subject.id)) throw new Error("hi ha identificadors duplicats.");
    ids.add(subject.id);
  }
  const activitySequenceIds = new Set();
  for (const subject of value.subjects) {
    if (!Array.isArray(subject.levels)) throw new Error("la llista de nivells d'una assignatura no és vàlida.");
    const levelNames = new Set();
    const assignedGroups = new Set();
    for (const level of subject.levels) {
      if (!level || typeof level.id !== "string" || !level.id || typeof level.name !== "string" || level.name && !EDUCATIONAL_LEVEL_NAMES.includes(level.name) || ids.has(level.id)) {
        throw new Error("hi ha un nivell educatiu invàlid o amb un identificador duplicat.");
      }
      level.competencyIds ??= [...competencyIds];
      if (level.name && levelNames.has(level.name)) throw new Error("hi ha nivells repetits en una assignatura.");
      ids.add(level.id);
      if (level.name) levelNames.add(level.name);
      if (!Array.isArray(level.competencyIds) || level.competencyIds.some(id => !competencyIds.has(id)) || new Set(level.competencyIds).size !== level.competencyIds.length) {
        throw new Error("hi ha una llista de competències invàlida per a un nivell.");
      }
      if (!Array.isArray(level.classGroupIds) || level.classGroupIds.some(id => !classGroupIds.has(id))) {
        throw new Error("hi ha un nivell vinculat a un grup classe inexistent.");
      }
      for (const classGroupId of level.classGroupIds) {
        if (assignedGroups.has(classGroupId)) throw new Error("un grup classe no es pot assignar a més d'un nivell de la mateixa assignatura.");
        assignedGroups.add(classGroupId);
      }
      if (!Array.isArray(level.sequence)) throw new Error("la seqüència d'un nivell no és vàlida.");
      if (level.situations !== undefined && !Array.isArray(level.situations)) throw new Error("la llista de situacions d'aprenentatge no és vàlida.");
      const situations = new Map((level.situations || []).map(situation => {
        if (typeof situation !== "string" || !situation.trim() || situation.trim().length > 100) {
          throw new Error("hi ha una situació d'aprenentatge invàlida.");
        }
        return [situation.trim().toLocaleLowerCase("ca"), situation.trim()];
      }));
      for (const item of level.sequence) {
        if (!item || typeof item.id !== "string" || !item.id || !activityIds.has(item.activityId) || !Number.isFinite(Number(item.hours)) || Number(item.hours) <= 0) {
          throw new Error("hi ha un element de seqüència d'assignatura invàlid.");
        }
        if (typeof item.situation !== "string" || !item.situation.trim()) item.situation = "Situació d'aprenentatge 1";
        else item.situation = item.situation.trim();
        if (item.situation.length > 100) throw new Error("el nom d'una situació d'aprenentatge no pot superar els 100 caràcters.");
        const situationKey = item.situation.toLocaleLowerCase("ca");
        if (!situations.has(situationKey)) situations.set(situationKey, item.situation);
        item.situation = situations.get(situationKey);
        if (ids.has(item.id) || activitySequenceIds.has(`${subject.id}:${level.id}:${item.activityId}`)) {
          throw new Error("hi ha identificadors duplicats o activitats repetides a la seqüència del nivell.");
        }
        ids.add(item.id);
        activitySequenceIds.add(`${subject.id}:${level.id}:${item.activityId}`);
        if (!item.contributions || typeof item.contributions !== "object" || Object.entries(item.contributions).some(([competencyId, weight]) => !level.competencyIds.includes(competencyId) || !Number.isFinite(Number(weight)) || Number(weight) < 0 || Number(weight) > 100)) {
          throw new Error("hi ha una contribució a competències invàlida.");
        }
      }
      level.situations = [...situations.values()];
    }
  }
  for (const assessment of value.assessments) {
    if (!assessment || !studentIds.has(assessment.studentId) || !activityIds.has(assessment.activityId) || !assessment.levels || typeof assessment.levels !== "object") {
      throw new Error("hi ha una avaluació sense alumne o activitat vàlids.");
    }
    for (const level of Object.values(assessment.levels)) {
      if (!Number.isInteger(level) || level < 0 || level > 4) throw new Error("hi ha un nivell d'avaluació invàlid.");
    }
  }
  const subjectIds = new Set(value.subjects.map(subject => subject.id));
  const subjectExemptionKeys = new Set();
  for (const exemption of value.subjectExemptions) {
    if (!exemption || !studentIds.has(exemption.studentId) || !subjectIds.has(exemption.subjectId)) {
      throw new Error("hi ha una exempció d'assignatura sense alumne o assignatura vàlids.");
    }
    const key = `${exemption.subjectId}\u0000${exemption.studentId}`;
    if (subjectExemptionKeys.has(key)) throw new Error("hi ha exempcions d'assignatura duplicades.");
    subjectExemptionKeys.add(key);
  }
  const activityExemptionKeys = new Set();
  for (const exemption of value.activityExemptions) {
    if (!exemption || !studentIds.has(exemption.studentId) || !activityIds.has(exemption.activityId)) {
      throw new Error("hi ha una exempció d'activitat sense alumne o activitat vàlids.");
    }
    const key = `${exemption.activityId}\u0000${exemption.studentId}`;
    if (activityExemptionKeys.has(key)) throw new Error("hi ha exempcions d'activitat duplicades.");
    activityExemptionKeys.add(key);
  }
  const dailyAssessmentKeys = new Set();
  const dailyCriterionIds = new Set(DAILY_FOLLOWUP_CRITERIA.map(criterion => criterion.id));
  for (const assessment of value.dailyAssessments) {
    if (!assessment || !studentIds.has(assessment.studentId) || !subjectIds.has(assessment.subjectId) ||
      typeof assessment.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(assessment.date) ||
      !assessment.levels || typeof assessment.levels !== "object" || Array.isArray(assessment.levels) ||
      assessment.note !== undefined && (typeof assessment.note !== "string" || assessment.note.length > 500)) {
      throw new Error("hi ha un seguiment diari sense dades vàlides.");
    }
    const [year, month, day] = assessment.date.split("-").map(Number);
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
      throw new Error("hi ha una data invàlida en un seguiment diari.");
    }
    const key = `${assessment.subjectId}\u0000${assessment.studentId}\u0000${assessment.date}`;
    if (dailyAssessmentKeys.has(key)) throw new Error("hi ha seguiments diaris duplicats per alumne, assignatura i data.");
    dailyAssessmentKeys.add(key);
    const levels = Object.entries(assessment.levels);
    if (levels.some(([criterionId, level]) => !dailyCriterionIds.has(criterionId) || !Number.isInteger(level) || level < 1 || level > 4) ||
      !levels.length && !assessment.note?.trim()) {
      throw new Error("hi ha un nivell o una observació invàlids en un seguiment diari.");
    }
  }
  return value;
}
