export let data;

export const state = {
  currentView: "overview",
  selectedActivityId: null,
  selectedStudentId: null,
  selectedSubjectId: null,
  selectedLevelId: null,
  selectedSequence: false,
  activityReturnToSequence: false,
  studentQuery: "",
  selectedClassGroupId: "",
  selectedSubgroupId: "",
  dailySelectedSubjectId: "",
  dailySelectedDate: "",
  dailySelectedClassGroupId: "",
  dailySelectedSubgroupId: ""
};

export function setData(value) {
  data = value;
}
