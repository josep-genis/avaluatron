import { getActivityOffers, getSequenceActivities, isStudentAssociatedWithOffering } from "./data.js";
import { getEvaluationItems } from "./assessment.js";

export const SCORE_BY_LEVEL = [null, 2.5, 5, 7.5, 10, 0];
export const RECOVERED_MAX_SCORE = 5;
export const NOT_SUBMITTED_LEVEL = 5;
export const NOT_SUBMITTED_LABEL = "No presentat";
export const LEVEL_LABELS = ["Sense evidència", "Inicial", "En procés", "Assolit", "Avançat"];

export function getAssessment(data, studentId, activityId, offeringId = null) {
  if (offeringId) {
    return data.assessments.find(item =>
      item.studentId === studentId && item.activityId === activityId && item.offeringId === offeringId
    );
  }
  const legacyAssessment = data.assessments.find(item =>
    item.studentId === studentId && item.activityId === activityId && !item.offeringId
  );
  if (legacyAssessment) return legacyAssessment;
  const matchingOffers = getActivityOffers(data, activityId).filter(offer =>
    isStudentAssociatedWithOffering(data, offer, studentId)
  );
  if (matchingOffers.length !== 1) return undefined;
  return getAssessment(data, studentId, activityId, matchingOffers[0].id);
}

export function isStudentExemptFromSubject(data, studentId, subjectId) {
  return data.subjectExemptions.some(item => item.studentId === studentId && item.subjectId === subjectId);
}

export function isStudentExemptFromActivity(data, studentId, activityId) {
  return data.activityExemptions.some(item => item.studentId === studentId && item.activityId === activityId);
}

export function isStudentExemptFromSubjectForActivity(data, studentId, activityId, subjectId = null) {
  if (subjectId) return isStudentExemptFromSubject(data, studentId, subjectId);
  const subjectIds = data.subjects
    .filter(subject => subject.levels.some(level => getSequenceActivities(level).some(item => item.activityId === activityId)))
    .map(subject => subject.id);
  return subjectIds.length > 0 && subjectIds.every(id => isStudentExemptFromSubject(data, studentId, id));
}

export function isActivityIncludedInStudentGrades(data, studentId, activityId) {
  const hasActiveOffering = getActivityOffers(data, activityId).some(offer =>
    isStudentAssociatedWithOffering(data, offer, studentId)
  );
  if (!hasActiveOffering) return false;
  if (isStudentExemptFromActivity(data, studentId, activityId)) return false;
  return !isStudentExemptFromSubjectForActivity(data, studentId, activityId);
}

function getRelevantOfferings(data, activityId, studentId, subjectId = null) {
  return getActivityOffers(data, activityId).filter(offer =>
    (!subjectId || offer.subjectId === subjectId) &&
    isStudentAssociatedWithOffering(data, offer, studentId)
  );
}

export function getEvidenceActivityWeight(evidence) {
  return Object.values(evidence.contributions).reduce((total, contribution) => total + Number(contribution), 0);
}

export function getActivityCompetencyContribution(activity, competencyId) {
  return getEvaluationItems(activity).reduce(
    (total, evidence) => total + Number(evidence.contributions[competencyId] || 0),
    0
  );
}

export function isNonAssessedActivity(activity) {
  return !getEvaluationItems(activity).length;
}

export function areAllActivityEvidencesAssessed(activity, assessment) {
  const items = getEvaluationItems(activity);
  return items.length > 0 && items.every(evidence => {
    const level = assessment?.levels[evidence.id];
    return Number.isInteger(level) && level > 0 && level < SCORE_BY_LEVEL.length;
  });
}

// Una activitat recuperada mai pot superar 5/10.
function capRecoveredScore(score, assessment) {
  return assessment?.recovered ? Math.min(score, RECOVERED_MAX_SCORE) : score;
}

function isValidLevel(level) {
  return Number.isInteger(level) && level > 0 && level < SCORE_BY_LEVEL.length;
}

export function getActivityGroupEvidenceScore(data, activity, group, offeringId, evidenceId) {
  const offering = data.teachingOffers.find(item => item.id === offeringId);
  const scores = [];
  for (const memberId of group.studentIds) {
    if (offering && !isStudentAssociatedWithOffering(data, offering, memberId)) continue;
    if (isStudentExemptFromActivity(data, memberId, activity.id) ||
      offering && isStudentExemptFromSubject(data, memberId, offering.subjectId)) continue;
    const memberAssessment = getAssessment(data, memberId, activity.id, offeringId);
    const level = memberAssessment?.levels[evidenceId];
    if (isValidLevel(level)) scores.push(capRecoveredScore(SCORE_BY_LEVEL[level], memberAssessment));
  }
  return scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null;
}

export function getActivityGroupGrade(data, activity, group, offeringId) {
  let weightedScore = 0;
  let totalWeight = 0;
  for (const evidence of getEvaluationItems(activity)) {
    const score = getActivityGroupEvidenceScore(data, activity, group, offeringId, evidence.id);
    const weight = getEvidenceActivityWeight(evidence);
    if (score !== null) {
      weightedScore += score * weight;
      totalWeight += weight;
    }
  }
  return totalWeight ? weightedScore / totalWeight : null;
}

// En mode grupal, la nota d'una evidència és la mitjana de les avaluacions individuals dels membres de l'agrupament.
export function getEvidenceScore(data, activity, studentId, offeringId, evidenceId) {
  const group = activity.isGroup && activity.groupGrading === "group"
    ? (activity.groups || []).find(item => item.studentIds.includes(studentId))
    : null;
  if (!group) {
    const assessment = getAssessment(data, studentId, activity.id, offeringId);
    const level = assessment?.levels[evidenceId];
    return isValidLevel(level) ? capRecoveredScore(SCORE_BY_LEVEL[level], assessment) : null;
  }
  return getActivityGroupEvidenceScore(data, activity, group, offeringId, evidenceId);
}

export function getCompetencyGrade(data, studentId, competencyId) {
  let weightedScore = 0;
  let totalWeight = 0;
  for (const activity of data.activities) {
    for (const offering of getRelevantOfferings(data, activity.id, studentId)) {
      if (isStudentExemptFromActivity(data, studentId, activity.id) ||
        isStudentExemptFromSubject(data, studentId, offering.subjectId)) continue;
      for (const evidence of getEvaluationItems(activity)) {
        const score = getEvidenceScore(data, activity, studentId, offering.id, evidence.id);
        const contribution = Number(evidence.contributions[competencyId] || 0);
        if (contribution > 0 && score !== null) {
          weightedScore += score * contribution;
          totalWeight += contribution;
        }
      }
    }
  }
  return totalWeight ? weightedScore / totalWeight : null;
}

export function getActivityGrade(data, studentId, activity, subjectId = null, offeringId = null) {
  if (!isActivityIncludedInStudentGrades(data, studentId, activity.id) ||
    subjectId && isStudentExemptFromSubject(data, studentId, subjectId)) return null;
  const offerings = offeringId
    ? getRelevantOfferings(data, activity.id, studentId, subjectId).filter(offer => offer.id === offeringId)
    : getRelevantOfferings(data, activity.id, studentId, subjectId);
  if (offerings.length !== 1) return null;
  let weightedScore = 0;
  let totalWeight = 0;
  for (const evidence of getEvaluationItems(activity)) {
    const score = getEvidenceScore(data, activity, studentId, offerings[0].id, evidence.id);
    const weight = getEvidenceActivityWeight(evidence);
    if (score !== null) {
      weightedScore += score * weight;
      totalWeight += weight;
    }
  }
  return totalWeight ? weightedScore / totalWeight : null;
}

export function getActivityCompetencyGrade(data, studentId, activity, competencyId, subjectId = null, offeringId = null) {
  if (!isActivityIncludedInStudentGrades(data, studentId, activity.id) ||
    subjectId && isStudentExemptFromSubject(data, studentId, subjectId)) return null;
  const offerings = offeringId
    ? getRelevantOfferings(data, activity.id, studentId, subjectId).filter(offer => offer.id === offeringId)
    : getRelevantOfferings(data, activity.id, studentId, subjectId);
  if (offerings.length !== 1) return null;
  let weightedScore = 0;
  let totalWeight = 0;
  for (const evidence of getEvaluationItems(activity)) {
    const score = getEvidenceScore(data, activity, studentId, offerings[0].id, evidence.id);
    const contribution = Number(evidence.contributions[competencyId] || 0);
    if (contribution > 0 && score !== null) {
      weightedScore += score * contribution;
      totalWeight += contribution;
    }
  }
  return totalWeight ? weightedScore / totalWeight : null;
}

export function getLevelCompetencyGrade(data, level, studentId, competencyId, subjectId = null) {
  if (subjectId && isStudentExemptFromSubject(data, studentId, subjectId)) return null;
  let weightedScore = 0;
  let totalContribution = 0;
  for (const item of getSequenceActivities(level)) {
    const activity = data.activities.find(record => record.id === item.activityId);
    if (!activity) continue;
    const contribution = getActivityCompetencyContribution(activity, competencyId) * Number(item.hours);
    if (contribution <= 0) continue;
    const grade = getActivityCompetencyGrade(data, studentId, activity, competencyId, subjectId);
    if (grade !== null && grade !== undefined) {
      weightedScore += grade * contribution;
      totalContribution += contribution;
    }
  }
  return totalContribution ? weightedScore / totalContribution : null;
}

export function getLevelCompetencyAssessmentProgress(data, level, studentId, competencyId, subjectId) {
  if (isStudentExemptFromSubject(data, studentId, subjectId)) return null;
  let totalWeight = 0;
  let assessedWeight = 0;
  for (const item of getSequenceActivities(level)) {
    const activity = data.activities.find(record => record.id === item.activityId);
    if (!activity || isStudentExemptFromActivity(data, studentId, item.activityId)) continue;
    const offerings = getRelevantOfferings(data, activity.id, studentId, subjectId);
    if (!offerings.length) continue;
    for (const evidence of getEvaluationItems(activity)) {
      const weight = Number(evidence.contributions[competencyId] || 0) * Number(item.hours);
      if (weight <= 0) continue;
      totalWeight += weight;
      if (offerings.length === 1 && getEvidenceScore(data, activity, studentId, offerings[0].id, evidence.id) !== null) {
        assessedWeight += weight;
      }
    }
  }
  return totalWeight ? assessedWeight / totalWeight * 100 : null;
}

export function getStudentActivityCount(data, studentId) {
  return data.activities.filter(activity => {
    if (isStudentExemptFromActivity(data, studentId, activity.id)) return false;
    return getRelevantOfferings(data, activity.id, studentId).some(offering => {
      if (isStudentExemptFromSubject(data, studentId, offering.subjectId)) return false;
      const assessment = getAssessment(data, studentId, activity.id, offering.id);
      return areAllActivityEvidencesAssessed(activity, assessment);
    });
  }).length;
}
