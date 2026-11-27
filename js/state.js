export let data;

export const state = {
  currentView: "overview",
  accountId: null,
  selectedActivityId: null,
  selectedOfferingId: null,
  selectedStudentId: null,
  selectedStudentSubjectId: null,
  selectedStudentLevelId: null,
  activityReportReturnView: null,
  selectedSubjectId: null,
  selectedLevelId: null,
  selectedSequence: false,
  activityReturnToSequence: false,
  subjectDashboardMode: "total",
  subjectDashboardCompetencyId: null,
  selectedCompetencyId: null,
  competencyQuery: "",
  competencySource: "",
  competencyLevel: "",
  competencySubject: "",
  competencyType: "",
  studentQuery: "",
  studentSort: "name",
  studentAdaptationFilter: "",
  selectedClassGroupId: "",
  selectedSubgroupId: "",
  selectedAdditionalGroupId: "",
  dailySelectedSubjectId: "",
  dailySelectedDate: "",
  dailySelectedClassGroupId: "",
  dailySelectedAdditionalGroupId: "",
  dailySelectedSubgroupId: ""
};

export function setData(value) {
  data = value;
}
