export const SCORE_BY_LEVEL = [null, 2.5, 5, 7.5, 10];
export const LEVEL_LABELS = ["Sense evidència", "Inicial", "En procés", "Assolit", "Avançat"];

export function getAssessment(data, studentId, activityId) {
  return data.assessments.find(item => item.studentId === studentId && item.activityId === activityId);
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
    .filter(subject => subject.levels.some(level => level.sequence.some(item => item.activityId === activityId)))
    .map(subject => subject.id);
  return subjectIds.length > 0 && subjectIds.every(id => isStudentExemptFromSubject(data, studentId, id));
}

export function isActivityIncludedInStudentGrades(data, studentId, activityId) {
  if (isStudentExemptFromActivity(data, studentId, activityId)) return false;
  return !isStudentExemptFromSubjectForActivity(data, studentId, activityId);
}

export function getEvidenceActivityWeight(evidence) {
  return Object.values(evidence.contributions).reduce((total, contribution) => total + Number(contribution), 0);
}

export function getCompetencyGrade(data, studentId, competencyId) {
  let weightedScore = 0;
  let totalWeight = 0;
  for (const activity of data.activities) {
    if (!isActivityIncludedInStudentGrades(data, studentId, activity.id)) continue;
    const assessment = getAssessment(data, studentId, activity.id);
    if (!assessment) continue;
    for (const evidence of activity.evidences) {
      const level = assessment.levels[evidence.id];
      const contribution = Number(evidence.contributions[competencyId] || 0);
      if (contribution > 0 && Number.isInteger(level) && level > 0) {
        weightedScore += SCORE_BY_LEVEL[level] * contribution;
        totalWeight += contribution;
      }
    }
  }
  return totalWeight ? weightedScore / totalWeight : null;
}

export function getActivityGrade(data, studentId, activity, subjectId = null) {
  if (!isActivityIncludedInStudentGrades(data, studentId, activity.id) ||
    subjectId && isStudentExemptFromSubject(data, studentId, subjectId)) return null;
  const assessment = getAssessment(data, studentId, activity.id);
  if (!assessment) return null;
  let weightedScore = 0;
  let totalWeight = 0;
  for (const evidence of activity.evidences) {
    const level = assessment.levels[evidence.id];
    const weight = getEvidenceActivityWeight(evidence);
    if (Number.isInteger(level) && level > 0) {
      weightedScore += SCORE_BY_LEVEL[level] * weight;
      totalWeight += weight;
    }
  }
  return totalWeight ? weightedScore / totalWeight : null;
}

export function getActivityCompetencyGrade(data, studentId, activity, competencyId, subjectId = null) {
  if (!isActivityIncludedInStudentGrades(data, studentId, activity.id) ||
    subjectId && isStudentExemptFromSubject(data, studentId, subjectId)) return null;
  const assessment = getAssessment(data, studentId, activity.id);
  if (!assessment) return null;
  let weightedScore = 0;
  let totalWeight = 0;
  for (const evidence of activity.evidences) {
    const level = assessment.levels[evidence.id];
    const contribution = Number(evidence.contributions[competencyId] || 0);
    if (contribution > 0 && Number.isInteger(level) && level > 0) {
      weightedScore += SCORE_BY_LEVEL[level] * contribution;
      totalWeight += contribution;
    }
  }
  return totalWeight ? weightedScore / totalWeight : null;
}

export function getLevelCompetencyGrade(data, level, studentId, competencyId, subjectId = null) {
  if (subjectId && isStudentExemptFromSubject(data, studentId, subjectId)) return null;
  let weightedScore = 0;
  let totalContribution = 0;
  for (const item of level.sequence) {
    const contribution = Number(item.contributions[competencyId] || 0);
    const activity = data.activities.find(record => record.id === item.activityId);
    const grade = activity && getActivityCompetencyGrade(data, studentId, activity, competencyId, subjectId);
    if (grade !== null && grade !== undefined && contribution > 0) {
      weightedScore += grade * contribution;
      totalContribution += contribution;
    }
  }
  return totalContribution ? weightedScore / totalContribution : null;
}

export function getStudentActivityCount(data, studentId) {
  return data.activities.filter(activity => {
    if (!isActivityIncludedInStudentGrades(data, studentId, activity.id)) return false;
    const assessment = getAssessment(data, studentId, activity.id);
    return activity.evidences.some(evidence => assessment?.levels[evidence.id] > 0);
  }).length;
}
