import { DEFAULT_APPEARANCE, isValidAppearance } from "./themes.js";
import { EDUCATIONAL_LEVEL_NAMES } from "./education.js";
import { mergeCompetencyBank } from "./competency-bank.js";

export const DAILY_FOLLOWUP_CRITERIA = [
  { id: "participation", name: "Participació" },
  { id: "preparation", name: "Preparació" },
  { id: "autonomy", name: "Autonomia" },
  { id: "collaboration", name: "Col·laboració" }
];

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getSequenceItems(level) {
  return level.situations.flatMap(situation => situation.activities);
}

export function isLectureItem(item) {
  return item.kind === "lecture";
}

// Només els elements de seqüència que apunten a una activitat avaluable.
export function getSequenceActivities(level) {
  return getSequenceItems(level).filter(item => !isLectureItem(item));
}

export function getCurrentAcademicYear(data) {
  return data.academicYears.find(year => year.id === data.currentAcademicYearId) || null;
}

export function getStudentEnrollment(student, academicYearId) {
  return student.enrollments?.find(enrollment => enrollment.academicYearId === academicYearId) ||
    (student.academicYearId === academicYearId
      ? {
          academicYearId,
          classGroupId: student.classGroupId,
          subgroupId: student.subgroupId,
          additionalGroupIds: student.additionalGroupIds || []
        }
      : null);
}

export function getOfferingStudents(data, offering) {
  const classGroupIds = new Set(offering.classGroupIds);
  const additionalGroupIds = new Set(offering.additionalGroupIds);
  return data.students.filter(student => {
    const enrollment = getStudentEnrollment(student, offering.academicYearId);
    return enrollment && (
      classGroupIds.has(enrollment.classGroupId) ||
      enrollment.additionalGroupIds.some(groupId => additionalGroupIds.has(groupId))
    );
  });
}

export function isStudentAssociatedWithOffering(data, offering, studentId) {
  return offering.studentIds?.includes(studentId) ||
    getOfferingStudents(data, offering).some(student => student.id === studentId);
}

export function getActivityOffers(data, activityId, currentOnly = true) {
  return data.teachingOffers.filter(offering => {
    if (currentOnly && (offering.status !== "active" || offering.academicYearId !== data.currentAcademicYearId)) return false;
    const level = data.subjects.find(subject => subject.id === offering.subjectId)
      ?.levels.find(item => item.id === offering.levelId);
    return level && getSequenceActivities(level).some(item => item.activityId === activityId);
  });
}

export function getLevelOffers(data, levelId, subjectId = null, currentOnly = true) {
  return data.teachingOffers.filter(offer =>
    offer.levelId === levelId &&
    (!subjectId || offer.subjectId === subjectId) &&
    (!currentOnly || offer.status === "active" && offer.academicYearId === data.currentAcademicYearId)
  );
}

export function getLevelStudents(students, level, academicYearId = null) {
  const classGroupIds = new Set(level.classGroupIds);
  const additionalGroupIds = new Set(level.additionalGroupIds || []);
  return students.filter(student => {
    const enrollment = academicYearId ? getStudentEnrollment(student, academicYearId) : student;
    return enrollment && (
      classGroupIds.has(enrollment.classGroupId) ||
      (enrollment.additionalGroupIds || []).some(groupId => additionalGroupIds.has(groupId))
    );
  });
}

function currentAcademicYearName(date = new Date()) {
  const startYear = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function migrateVersionOne(value, makeId) {
  const academicYear = { id: makeId("curs"), name: currentAcademicYearName(), isCurrent: true };
  value.academicYears = [academicYear];
  value.currentAcademicYearId = academicYear.id;
  value.classGroups ??= [];
  for (const group of value.classGroups) group.academicYearId = academicYear.id;
  for (const student of value.students) {
    student.academicYearId = academicYear.id;
    student.enrollments = [{
      academicYearId: academicYear.id,
      classGroupId: student.classGroupId || "",
      subgroupId: student.subgroupId || "",
      additionalGroupIds: student.additionalGroupIds || []
    }];
  }
  value.teachingOffers = [];
  for (const subject of value.subjects || []) {
    for (const level of subject.levels || []) {
      const classGroupIds = [...new Set(level.classGroupIds || [])];
      const additionalGroupIds = [...new Set(level.additionalGroupIds || [])];
      if (!classGroupIds.length && !additionalGroupIds.length) continue;
      value.teachingOffers.push({
        id: makeId("oferta"),
        subjectId: subject.id,
        levelId: level.id,
        academicYearId: academicYear.id,
        classGroupIds,
        additionalGroupIds,
        studentIds: [],
        status: "active"
      });
    }
  }
  for (const offer of value.teachingOffers) {
    offer.studentIds = getOfferingStudents(value, offer).map(student => student.id);
  }
  const assessments = value.assessments || [];
  value.assessments = assessments.flatMap(assessment => {
    const matchingOffers = value.teachingOffers.filter(offer => {
      const level = value.subjects.find(subject => subject.id === offer.subjectId)?.levels.find(item => item.id === offer.levelId);
      const legacyItems = Array.isArray(level?.sequence) ? level.sequence : [];
      const nestedItems = (Array.isArray(level?.situations) ? level.situations : [])
        .flatMap(situation => Array.isArray(situation?.activities) ? situation.activities : []);
      return [...legacyItems, ...nestedItems].some(item => item?.activityId === assessment.activityId)
        && getOfferingStudents(value, offer).some(student => student.id === assessment.studentId);
    });
    return matchingOffers.length
      ? matchingOffers.map(offer => ({ ...assessment, levels: { ...assessment.levels }, offeringId: offer.id }))
      : [{ ...assessment, offeringId: "" }];
  });
  for (const subject of value.subjects) {
    for (const level of subject.levels || []) {
      delete level.classGroupIds;
      delete level.additionalGroupIds;
    }
  }
  value.schemaVersion = 2;
}

export function validateData(value, makeId) {
  if (!value || ![1, 2].includes(value.schemaVersion) || !["students", "competencies", "activities", "assessments"].every(key => Array.isArray(value[key]))) {
    throw new Error("el fitxer no té un format Avaluatró vàlid (versió 1 o 2).");
  }
  if (value.schemaVersion === 2 && (!Array.isArray(value.academicYears) || !Array.isArray(value.teachingOffers))) {
    throw new Error("les llistes de cursos acadèmics i ofertes docents no són vàlides.");
  }
  if (value.schemaVersion === 2) value.currentAcademicYearId ??= "";
  value.classGroups ??= [];
  value.additionalGroups ??= [];
  value.subjects ??= [];
  value.dailyAssessments ??= [];
  value.subjectExemptions ??= [];
  value.activityExemptions ??= [];
  value.teacherProfile ??= { name: "", role: "", institution: "" };
  if (value.teacherProfile && typeof value.teacherProfile === "object") value.teacherProfile.appearance ??= { ...DEFAULT_APPEARANCE };
  if (!Array.isArray(value.classGroups)) throw new Error("la llista de grups classe no és vàlida.");
  if (!Array.isArray(value.additionalGroups)) throw new Error("la llista de grups addicionals no és vàlida.");
  if (!Array.isArray(value.subjects)) throw new Error("la llista d'assignatures no és vàlida.");
  if (!Array.isArray(value.dailyAssessments)) throw new Error("la llista de seguiments diaris no és vàlida.");
  if (!Array.isArray(value.subjectExemptions)) throw new Error("la llista d'exempcions d'assignatura no és vàlida.");
  if (!Array.isArray(value.activityExemptions)) throw new Error("la llista d'exempcions d'activitat no és vàlida.");
  if (!value.teacherProfile || typeof value.teacherProfile !== "object" || Array.isArray(value.teacherProfile) ||
    ["name", "role", "institution"].some(key =>
      typeof value.teacherProfile[key] !== "string" || value.teacherProfile[key].length > 120
    )) {
    throw new Error("el perfil docent no és vàlid.");
  }
  if (!isValidAppearance(value.teacherProfile.appearance)) {
    throw new Error("l'aparença del perfil docent no és vàlida.");
  }
  for (const subject of value.subjects) {
    const hasLegacyLevelData = subject && typeof subject === "object" &&
      ["level", "classGroupIds", "sequence"].some(key => Object.hasOwn(subject, key));
    if (subject && typeof subject === "object" && !Object.hasOwn(subject, "levels") && hasLegacyLevelData) {
      subject.levels = [{
        id: makeId("niv"),
        name: subject.level || "",
        classGroupIds: subject.classGroupIds || [],
        sequence: subject.sequence || [],
        situations: subject.situations || []
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
    student.additionalGroupIds ||= [];
    delete student.group;
  }
  for (const classGroup of value.classGroups) classGroup.subgroups ||= [];
  if (value.schemaVersion === 1) migrateVersionOne(value, makeId);
  mergeCompetencyBank(value.competencies);
  for (const competency of value.competencies) {
    if (!competency || typeof competency !== "object") continue;
    competency.description ??= "";
    competency.learningOutcomes ??= [];
    for (const tagList of ["educationalLevels", "subjects"]) {
      competency[tagList] ??= [];
      if (!Array.isArray(competency[tagList]) || competency[tagList].some(tag => typeof tag !== "string")) throw new Error("hi ha una competència amb etiquetes invàlides.");
    }
    if (!Array.isArray(competency.learningOutcomes)) throw new Error("hi ha una competència amb resultats d'aprenentatge invàlids.");
    for (const outcome of competency.learningOutcomes) {
      outcome.description ??= "";
      outcome.criteria ??= [];
      if (typeof outcome.id !== "string" || typeof outcome.name !== "string" || !Array.isArray(outcome.criteria) || outcome.criteria.some(criterion => typeof criterion?.id !== "string" || typeof criterion.text !== "string")) {
        throw new Error("hi ha un resultat d'aprenentatge invàlid.");
      }
    }
  }
  const ids = new Set();
  for (const listName of ["students", "competencies", "activities", "classGroups", "additionalGroups", "academicYears", "teachingOffers"]) {
    for (const record of value[listName]) {
      if (!record || typeof record.id !== "string" || !record.id || typeof record.name !== "string" && !["activities", "students", "teachingOffers"].includes(listName)) {
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
      if (listName === "academicYears" && (typeof record.name !== "string" || !record.name.trim())) {
        throw new Error("hi ha un curs acadèmic invàlid.");
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
  const additionalGroupIds = new Set(value.additionalGroups.map(group => group.id));
  const academicYearIds = new Set(value.academicYears.map(year => year.id));
  if (!value.academicYears.length || !academicYearIds.has(value.currentAcademicYearId) ||
    value.academicYears.filter(year => year.isCurrent).length !== 1 ||
    !value.academicYears.find(year => year.id === value.currentAcademicYearId)?.isCurrent) {
    throw new Error("cal que hi hagi exactament un curs acadèmic vigent.");
  }
  for (const group of value.classGroups) group.academicYearId ||= value.currentAcademicYearId;
  if (value.classGroups.some(group => !academicYearIds.has(group.academicYearId))) {
    throw new Error("hi ha un grup classe sense curs acadèmic vàlid.");
  }
  for (const student of value.students) {
    student.academicYearId ||= value.currentAcademicYearId;
    student.enrollments ??= [{
      academicYearId: student.academicYearId,
      classGroupId: student.classGroupId || "",
      subgroupId: student.subgroupId || "",
      additionalGroupIds: student.additionalGroupIds || []
    }];
    if (!Array.isArray(student.enrollments) || student.enrollments.some(enrollment =>
      !academicYearIds.has(enrollment.academicYearId) ||
      enrollment.classGroupId && !classGroupIds.has(enrollment.classGroupId) ||
      enrollment.subgroupId && !subgroupIds.has(enrollment.subgroupId) ||
      !Array.isArray(enrollment.additionalGroupIds) ||
      enrollment.additionalGroupIds.some(id => !additionalGroupIds.has(id)) ||
      new Set(enrollment.additionalGroupIds).size !== enrollment.additionalGroupIds.length
    )) {
      throw new Error("hi ha una matrícula d'alumne invàlida.");
    }
    if (new Set(student.enrollments.map(enrollment => enrollment.academicYearId)).size !== student.enrollments.length ||
      student.enrollments.some(enrollment => {
        const group = value.classGroups.find(item => item.id === enrollment.classGroupId);
        const subgroup = group?.subgroups.find(item => item.id === enrollment.subgroupId);
        return enrollment.classGroupId && group?.academicYearId !== enrollment.academicYearId ||
          enrollment.subgroupId && (!subgroup || !group?.subgroups.some(item => item.id === enrollment.subgroupId));
      })) {
      throw new Error("un alumne té matrícules duplicades o una assignació de grup invàlida.");
    }
    const currentEnrollment = getStudentEnrollment(student, value.currentAcademicYearId);
    Object.assign(student, {
      academicYearId: value.currentAcademicYearId,
      classGroupId: currentEnrollment?.classGroupId || "",
      subgroupId: currentEnrollment?.subgroupId || "",
      additionalGroupIds: currentEnrollment?.additionalGroupIds || []
    });
  }
  for (const student of value.students) {
    if (!Array.isArray(student.additionalGroupIds) || student.additionalGroupIds.some(id => !additionalGroupIds.has(id)) ||
      new Set(student.additionalGroupIds).size !== student.additionalGroupIds.length) {
      throw new Error("hi ha un alumne assignat a un grup addicional inexistent o repetit.");
    }
    if (student.classGroupId && !classGroupIds.has(student.classGroupId)) throw new Error("hi ha un alumne assignat a un grup classe inexistent.");
    if (student.subgroupId && !subgroupIds.has(student.subgroupId)) throw new Error("hi ha un alumne assignat a un desdoblament inexistent.");
    const assignedClassGroup = value.classGroups.find(classGroup => classGroup.id === student.classGroupId);
    if (student.subgroupId && !assignedClassGroup?.subgroups.some(subgroup => subgroup.id === student.subgroupId)) {
      throw new Error("el desdoblament d'un alumne no correspon al seu grup classe.");
    }
  }
  const competencyIds = new Set(value.competencies.map(competency => competency.id));
  const legacyLectures = new Map(value.activities.filter(activity => activity?.type === "Magistral").map(activity => [activity.id, activity]));
  const convertedLectureIds = new Set();
  for (const activity of value.activities) {
    if (activity && typeof activity === "object" && activity.type !== "Prova") activity.type = "Activitat";
  }
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
      evidence.descriptors ??= {};
      if (!evidence.descriptors || typeof evidence.descriptors !== "object" || Array.isArray(evidence.descriptors) ||
        Object.entries(evidence.descriptors).some(([level, descriptor]) =>
          !["1", "2", "3", "4"].includes(level) || typeof descriptor !== "string" || descriptor.length > 500
        )) {
        throw new Error("hi ha criteris d'avaluació invàlids a la rúbrica.");
      }
      delete evidence.weight;
      ids.add(evidence.id);
    }
    activity.groups ??= [];
    activity.isGroup = activity.isGroup === true || (activity.isGroup === undefined && activity.groups.length > 0);
    activity.groupGrading = activity.groupGrading === "group" ? "group" : "individual";
    if (!Array.isArray(activity.groups)) throw new Error("els agrupaments d'una activitat no són vàlids.");
    const groupedStudentIds = new Set();
    for (const group of activity.groups) {
      if (!group || typeof group.id !== "string" || !group.id || ids.has(group.id) ||
        typeof group.name !== "string" || !group.name.trim() || group.name.trim().length > 60 ||
        !Array.isArray(group.studentIds) || new Set(group.studentIds).size !== group.studentIds.length || group.studentIds.some(id => !studentIds.has(id) || groupedStudentIds.has(id))) {
        throw new Error("hi ha un agrupament d'activitat invàlid o amb alumnes repetits.");
      }
      group.name = group.name.trim();
      group.studentIds.forEach(id => groupedStudentIds.add(id));
      ids.add(group.id);
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
      delete level.classGroupIds;
      delete level.additionalGroupIds;
      if (level.situations !== undefined && !Array.isArray(level.situations)) throw new Error("la llista de situacions d'aprenentatge no és vàlida.");
      const situationRecords = [];
      const situationsByName = new Map();
      const addSituation = (name, id = makeId("sit"), activities = []) => {
        if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
          throw new Error("hi ha una situació d'aprenentatge invàlida.");
        }
        const normalizedName = name.trim();
        const key = normalizedName.toLocaleLowerCase("ca");
        if (situationsByName.has(key)) return situationsByName.get(key);
        const situation = { id, name: normalizedName, activities };
        situationRecords.push(situation);
        situationsByName.set(key, situation);
        return situation;
      };
      const storedSituations = level.situations || [];
      const isNestedSequence = storedSituations.length
        ? storedSituations.every(situation =>
          situation && typeof situation === "object" && !Array.isArray(situation) && Array.isArray(situation.activities)
        )
        : !Array.isArray(level.sequence);
      if (isNestedSequence) {
        for (const situation of storedSituations) {
          if (typeof situation.name === "string" && situationsByName.has(situation.name.trim().toLocaleLowerCase("ca"))) {
            throw new Error("hi ha situacions d'aprenentatge repetides en un nivell.");
          }
          addSituation(situation.name, situation.id, situation.activities);
        }
      } else {
        for (const situation of storedSituations) {
          if (typeof situation !== "string") throw new Error("hi ha una situació d'aprenentatge invàlida.");
          addSituation(situation);
        }
        if (!Array.isArray(level.sequence)) throw new Error("la seqüència d'un nivell no és vàlida.");
        for (const item of level.sequence) {
          const name = typeof item?.situation === "string" && item.situation.trim()
            ? item.situation.trim()
            : "Situació d'aprenentatge 1";
          addSituation(name).activities.push(item);
        }
      }
      delete level.sequence;
      const sequenceActivityIds = new Set();
      for (const situation of situationRecords) {
        if (Array.isArray(situation.activities)) {
          situation.activities = situation.activities.map(item => {
            const legacy = item && legacyLectures.get(item.activityId);
            if (!legacy) return item;
            convertedLectureIds.add(legacy.id);
            return { id: item.id, kind: "lecture", title: legacy.title, hours: item.hours };
          });
        }
        if (typeof situation.id !== "string" || !situation.id || ids.has(situation.id) || !Array.isArray(situation.activities)) {
          throw new Error("hi ha una situació d'aprenentatge invàlida o amb un identificador duplicat.");
        }
        ids.add(situation.id);
        for (const item of situation.activities) {
          if (item?.kind === "lecture") {
            if (typeof item.id !== "string" || !item.id || ids.has(item.id) || typeof item.title !== "string" || !item.title.trim() ||
              !Number.isFinite(Number(item.hours)) || Number(item.hours) <= 0) {
              throw new Error("hi ha una classe de la seqüència invàlida.");
            }
            ids.add(item.id);
            item.title = item.title.trim();
            continue;
          }
          if (!item || typeof item.id !== "string" || !item.id || !activityIds.has(item.activityId) || !Number.isFinite(Number(item.hours)) || Number(item.hours) <= 0) {
            throw new Error("hi ha un element de seqüència d'assignatura invàlid.");
          }
          if (ids.has(item.id) || sequenceActivityIds.has(item.activityId)) {
            throw new Error("hi ha identificadors duplicats o activitats repetides a la seqüència del nivell.");
          }
          ids.add(item.id);
          sequenceActivityIds.add(item.activityId);
          activitySequenceIds.add(`${subject.id}:${level.id}:${item.activityId}`);
          delete item.contributions;
        }
      }
      level.situations = situationRecords;
    }
  }
  if (convertedLectureIds.size) {
    value.activities = value.activities.filter(activity => !convertedLectureIds.has(activity.id));
    value.assessments = (value.assessments || []).filter(item => !convertedLectureIds.has(item.activityId));
    value.activityExemptions = (value.activityExemptions || []).filter(item => !convertedLectureIds.has(item.activityId));
    for (const id of convertedLectureIds) activityIds.delete(id);
  }
  const offerKeys = new Set();
  for (const offer of value.teachingOffers) {
    if (!offer || typeof offer !== "object") throw new Error("hi ha una oferta docent invàlida.");
    const subject = value.subjects.find(item => item.id === offer.subjectId);
    const level = subject?.levels.find(item => item.id === offer.levelId);
    const key = `${offer.subjectId}\u0000${offer.levelId}\u0000${offer.academicYearId}`;
    offer.studentIds ??= [];
    if (!level || !academicYearIds.has(offer.academicYearId) ||
      !Array.isArray(offer.classGroupIds) || offer.classGroupIds.some(id => !classGroupIds.has(id)) ||
      new Set(offer.classGroupIds).size !== offer.classGroupIds.length ||
      !Array.isArray(offer.additionalGroupIds) || offer.additionalGroupIds.some(id => !additionalGroupIds.has(id)) ||
      new Set(offer.additionalGroupIds).size !== offer.additionalGroupIds.length ||
      !offer.classGroupIds.length && !offer.additionalGroupIds.length ||
      !Array.isArray(offer.studentIds) || offer.studentIds.some(id => !studentIds.has(id)) ||
      new Set(offer.studentIds).size !== offer.studentIds.length ||
      !["active", "archived"].includes(offer.status) || offerKeys.has(key)) {
      throw new Error("hi ha una oferta docent invàlida o duplicada.");
    }
    if (offer.classGroupIds.some(id => value.classGroups.find(group => group.id === id)?.academicYearId !== offer.academicYearId)) {
      throw new Error("una oferta docent inclou un grup classe d'un altre curs acadèmic.");
    }
    offerKeys.add(key);
  }
  const assessmentKeys = new Set();
  for (const assessment of value.assessments) {
    if (!assessment || !studentIds.has(assessment.studentId) || !activityIds.has(assessment.activityId) ||
      assessment.offeringId && !value.teachingOffers.some(offer => offer.id === assessment.offeringId) ||
      !assessment.levels || typeof assessment.levels !== "object" ||
      assessment.feedback !== undefined && (typeof assessment.feedback !== "string" || assessment.feedback.length > 2000)) {
      throw new Error("hi ha una avaluació sense alumne o activitat vàlids.");
    }
    if (assessment.offeringId) {
      const offer = value.teachingOffers.find(item => item.id === assessment.offeringId);
      const level = value.subjects.find(subject => subject.id === offer.subjectId)?.levels.find(item => item.id === offer.levelId);
      if (!offer.studentIds.includes(assessment.studentId) &&
        !getOfferingStudents(value, offer).some(student => student.id === assessment.studentId) ||
        !getSequenceActivities(level).some(item => item.activityId === assessment.activityId)) {
        throw new Error("hi ha una avaluació fora de la matrícula o la seqüència de l'oferta docent.");
      }
    }
    const key = `${assessment.offeringId || "legacy"}\u0000${assessment.studentId}\u0000${assessment.activityId}`;
    if (assessmentKeys.has(key)) throw new Error("hi ha avaluacions duplicades per alumne, activitat i oferta docent.");
    assessmentKeys.add(key);
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
  value.schemaVersion = 2;
  return value;
}
