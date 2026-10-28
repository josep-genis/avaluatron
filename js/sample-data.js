export const sampleData = {
  schemaVersion: 1,
  students: [
    { id: "al-1", firstName: "Laia", lastName: "Soler", classGroupId: "gc-1", subgroupId: "" },
    { id: "al-2", firstName: "Marc", lastName: "Vidal", classGroupId: "gc-1", subgroupId: "" },
    { id: "al-3", firstName: "Aina", lastName: "Costa", classGroupId: "gc-2", subgroupId: "" }
  ],
  classGroups: [
    { id: "gc-1", name: "4t A", subgroups: [] },
    { id: "gc-2", name: "4t B", subgroups: [] }
  ],
  competencies: [
    { id: "co-1", name: "Avaluar l'impacte ecològic d'una tecnologia", description: "Analitza el cicle de vida, els recursos consumits i les conseqüències ambientals d'una solució tecnològica." },
    { id: "co-2", name: "Argumentar decisions amb evidències", description: "Justifica conclusions fent servir dades pertinents i fonts contrastables." }
  ],
  activities: [
    {
      id: "ac-1",
      title: "Anàlisi de l'impacte d'un telèfon mòbil",
      type: "Prova",
      date: "2026-10-21",
      evidences: [
        { id: "cr-1", name: "Impacte del cicle de vida", contributions: { "co-1": 60 } },
        { id: "cr-2", name: "Ús de dades i arguments", contributions: { "co-2": 40 } }
      ]
    },
    {
      id: "ac-2",
      title: "Projecte: tecnologia i sostenibilitat",
      type: "Projecte en grup",
      date: "2026-10-16",
      evidences: [
        { id: "cr-3", name: "Proposta de millora ecològica", contributions: { "co-1": 70 } },
        { id: "cr-4", name: "Comunicació de les conclusions", contributions: { "co-2": 30 } }
      ]
    }
  ],
  subjects: [
    {
      id: "as-1",
      name: "Tecnologia i sostenibilitat",
      description: "Analitzem l'impacte ambiental de les solucions tecnològiques.",
      levels: [
        {
          id: "niv-1",
          name: "4t d'ESO",
          classGroupIds: ["gc-1", "gc-2"],
          competencyIds: ["co-1", "co-2"],
          situations: ["El cicle de vida d'un mòbil", "Disseny d'una tecnologia sostenible"],
          sequence: [
            { id: "seq-1", activityId: "ac-1", situation: "El cicle de vida d'un mòbil", hours: 3, contributions: { "co-1": 100, "co-2": 100 } },
            { id: "seq-2", activityId: "ac-2", situation: "Disseny d'una tecnologia sostenible", hours: 5, contributions: { "co-1": 100, "co-2": 100 } }
          ]
        }
      ]
    }
  ],
  dailyAssessments: [],
  assessments: [
    { studentId: "al-1", activityId: "ac-1", levels: { "cr-1": 4, "cr-2": 3 } },
    { studentId: "al-2", activityId: "ac-1", levels: { "cr-1": 3, "cr-2": 2 } },
    { studentId: "al-3", activityId: "ac-1", levels: { "cr-1": 3, "cr-2": 4 } },
    { studentId: "al-1", activityId: "ac-2", levels: { "cr-3": 3, "cr-4": 4 } },
    { studentId: "al-2", activityId: "ac-2", levels: { "cr-3": 2, "cr-4": 3 } }
  ]
};
