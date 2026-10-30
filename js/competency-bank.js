// Banc de competències compartit per tots els usuaris. Es distribueix amb l'aplicació i
// no es desa a les dades de l'usuari tret que l'usuari en modifiqui el contingut.
// Els identificadors han de ser estables: les dades dels usuaris hi fan referència.
export const COMPETENCY_BANK = [
  {
    id: "bank-tec-1",
    educationalLevels: ["1r d'ESO", "2n d'ESO", "3r d'ESO", "4t d'ESO"],
    subjects: ["Tecnologia i digitalització"],
    name: "Resolució de problemes tecnològics",
    description: "Identificar i resoldre problemes tecnològics aplicant un procés de disseny i fabricació de solucions.",
    learningOutcomes: [
      {
        id: "bank-tec-1-ra-1",
        name: "Analitza una necessitat i en planteja una solució",
        description: "Identifica el problema, el contextualitza i proposa alternatives de solució.",
        criteria: [
          { id: "bank-tec-1-ra-1-ce-1", text: "Descriu la necessitat o el problema que cal resoldre." },
          { id: "bank-tec-1-ra-1-ce-2", text: "Cerca i selecciona informació rellevant per a la solució." },
          { id: "bank-tec-1-ra-1-ce-3", text: "Proposa diverses alternatives i justifica l'elecció d'una." }
        ]
      },
      {
        id: "bank-tec-1-ra-2",
        name: "Dissenya i construeix un prototip",
        description: "Planifica el treball i construeix una solució amb els materials i les eines adequats.",
        criteria: [
          { id: "bank-tec-1-ra-2-ce-1", text: "Elabora la documentació tècnica del projecte (croquis, plànols, esquemes)." },
          { id: "bank-tec-1-ra-2-ce-2", text: "Planifica les fases i els recursos necessaris." },
          { id: "bank-tec-1-ra-2-ce-3", text: "Fabrica el prototip aplicant normes de seguretat i salut." }
        ]
      }
    ]
  },
  {
    id: "bank-tec-2",
    educationalLevels: ["3r d'ESO", "4t d'ESO"],
    subjects: ["Tecnologia i digitalització", "Informàtica"],
    name: "Pensament computacional i programació",
    description: "Dissenyar i programar aplicacions i sistemes de control utilitzant algorismes i eines digitals.",
    learningOutcomes: [
      {
        id: "bank-tec-2-ra-1",
        name: "Dissenya algorismes",
        description: "Descompon problemes i els expressa en forma d'algorisme.",
        criteria: [
          { id: "bank-tec-2-ra-1-ce-1", text: "Descompon un problema en parts més simples." },
          { id: "bank-tec-2-ra-1-ce-2", text: "Representa un algorisme amb diagrames de flux o pseudocodi." }
        ]
      },
      {
        id: "bank-tec-2-ra-2",
        name: "Programa aplicacions i sistemes de control",
        description: "Implementa algorismes en un llenguatge de programació.",
        criteria: [
          { id: "bank-tec-2-ra-2-ce-1", text: "Utilitza estructures de control (condicionals i bucles) i variables." },
          { id: "bank-tec-2-ra-2-ce-2", text: "Depura i corregeix els errors del programa." },
          { id: "bank-tec-2-ra-2-ce-3", text: "Controla un dispositiu físic mitjançant un programa." }
        ]
      }
    ]
  },
  {
    id: "bank-tec-3",
    educationalLevels: ["1r d'ESO", "2n d'ESO"],
    subjects: ["Tecnologia i digitalització"],
    name: "Comunicació i col·laboració digital",
    description: "Utilitzar eines digitals per comunicar, compartir i treballar de forma col·laborativa i responsable.",
    learningOutcomes: [
      {
        id: "bank-tec-3-ra-1",
        name: "Elabora i comparteix documents digitals",
        description: "Crea productes digitals i els comparteix amb eines en línia.",
        criteria: [
          { id: "bank-tec-3-ra-1-ce-1", text: "Crea documents, presentacions o recursos multimèdia coherents." },
          { id: "bank-tec-3-ra-1-ce-2", text: "Comparteix i edita documents de forma col·laborativa." }
        ]
      },
      {
        id: "bank-tec-3-ra-2",
        name: "Fa un ús segur i responsable de les tecnologies",
        description: "Protegeix les dades i adopta hàbits digitals respectuosos.",
        criteria: [
          { id: "bank-tec-3-ra-2-ce-1", text: "Aplica mesures bàsiques de seguretat i privacitat." },
          { id: "bank-tec-3-ra-2-ce-2", text: "Cita les fonts i respecta les llicències dels materials." }
        ]
      }
    ]
  },
  {
    id: "bank-tec-4",
    educationalLevels: ["4t d'ESO", "1r de batxillerat"],
    subjects: ["Tecnologia i digitalització"],
    name: "Sostenibilitat i impacte de la tecnologia",
    description: "Valorar l'impacte social i ambiental de les solucions tecnològiques i proposar-ne alternatives sostenibles.",
    learningOutcomes: [
      {
        id: "bank-tec-4-ra-1",
        name: "Avalua l'impacte d'una solució tecnològica",
        description: "Analitza les conseqüències ambientals i socials d'un producte o procés.",
        criteria: [
          { id: "bank-tec-4-ra-1-ce-1", text: "Analitza el cicle de vida d'un producte." },
          { id: "bank-tec-4-ra-1-ce-2", text: "Identifica els recursos consumits i els residus generats." },
          { id: "bank-tec-4-ra-1-ce-3", text: "Argumenta amb dades propostes de millora sostenibles." }
        ]
      }
    ]
  }
];

const clone = value => JSON.parse(JSON.stringify(value));

export function isBankCompetency(id) {
  return COMPETENCY_BANK.some(competency => competency.id === id);
}

export function getBankCompetency(id) {
  const competency = COMPETENCY_BANK.find(item => item.id === id);
  return competency ? clone(competency) : null;
}

// Afegeix al llistat de l'usuari les competències del banc que encara no hi són.
export function mergeCompetencyBank(competencies) {
  const existing = new Set(competencies.map(competency => competency.id));
  for (const bankCompetency of COMPETENCY_BANK) {
    if (!existing.has(bankCompetency.id)) competencies.push(clone(bankCompetency));
  }
}

// Elimina del desat les competències del banc que l'usuari no ha modificat.
export function withoutUnmodifiedBank(value) {
  const unchanged = competency => {
    const original = COMPETENCY_BANK.find(item => item.id === competency.id);
    return original && JSON.stringify(original) === JSON.stringify(competency);
  };
  return { ...value, competencies: value.competencies.filter(competency => !unchanged(competency)) };
}
