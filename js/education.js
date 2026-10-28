export const EDUCATIONAL_LEVELS = [
  { stage: "ESO", levels: ["1r d'ESO", "2n d'ESO", "3r d'ESO", "4t d'ESO"] },
  { stage: "Batxillerat", levels: ["1r de batxillerat", "2n de batxillerat"] }
];

export const EDUCATIONAL_LEVEL_NAMES = EDUCATIONAL_LEVELS.flatMap(stage => stage.levels);
