export let data;

export const state = {
  currentView: "overview",
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
  studentQuery: "",
  studentSort: "name",
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
