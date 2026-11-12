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
      questions: [
        { id: "cr-1", name: "Quin impacte té el cicle de vida del telèfon?", contributions: { "co-1": 60 }, answerKey: "Descriu l'extracció de materials, la fabricació, l'ús i el final de vida." },
        { id: "cr-2", name: "Quines dades justifiquen la conclusió?", contributions: { "co-2": 40 }, answerKey: "Cita dades pertinents i explica com sostenen la conclusió." }
      ]
    },
    {
      id: "ac-2",
      title: "Projecte: tecnologia i sostenibilitat",
      type: "Activitat",
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
          situations: [
            {
              id: "sit-1",
              name: "El cicle de vida d'un mòbil",
              activities: [
                { id: "seq-1", activityId: "ac-1", hours: 3 }
              ]
            },
            {
              id: "sit-2",
              name: "Disseny d'una tecnologia sostenible",
              activities: [
                { id: "seq-2", activityId: "ac-2", hours: 5 }
              ]
            }
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
