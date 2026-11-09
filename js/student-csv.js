const normalize = value => String(value ?? "").trim().toLocaleLowerCase("ca").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function parseCsv(text, { strict = false } = {}) {
  const source = String(text).replace(/^\uFEFF/, "");
  const delimiterCounts = new Map([";", "\t", ","].map(char => [char, 0]));
  for (const line of source.split(/\r\n|\r|\n/)) {
    let inQuotes = false;
    for (let index = 0; index < line.length; index++) {
      const char = line[index];
      if (char === '"') {
        if (inQuotes && line[index + 1] === '"') index++;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && delimiterCounts.has(char)) {
        delimiterCounts.set(char, delimiterCounts.get(char) + 1);
      }
    }
    if ([...delimiterCounts.values()].some(count => count > 0) || inQuotes) break;
  }
  const delimiter = [...delimiterCounts].sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
    } else if (strict && closedQuote && char !== delimiter && char !== "\n" && char !== "\r" && !/\s/.test(char)) {
      throw new Error("El CSV conté text després d'un camp entre cometes.");
    } else if (char === '"') {
      if (strict && (cell.trim() || closedQuote)) throw new Error("El CSV conté cometes en una posició invàlida.");
      quoted = true;
    } else if (char === delimiter) { row.push(cell); cell = ""; closedQuote = false; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closedQuote = false;
    } else cell += char;
  }
  if (strict && quoted) throw new Error("El CSV conté un camp entre cometes sense tancar.");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(cells => cells.map(value => value.trim())).filter(cells => cells.some(Boolean));
}

// Columns: nom, cognom, grup classe, grup de desdoblament (optional).
export function planStudentImport(text, data) {
  const rows = parseCsv(text);
  const hasHeader = rows.length && ["nom", "noms", "name", "firstname"].includes(normalize(rows[0][0]));
  const firstLineNumber = hasHeader ? 2 : 1;
  const errors = [];
  const students = [];
  let skipped = 0;
  const seen = new Set(data.students.map(student => `${normalize(student.firstName)}|${normalize(student.lastName)}|${student.classGroupId}`));
  const classGroups = data.classGroups.filter(group => group.academicYearId === data.currentAcademicYearId);
  rows.slice(hasHeader ? 1 : 0).forEach((cells, index) => {
    const line = index + firstLineNumber;
    const [firstName = "", lastName = "", classGroupName = "", subgroupName = ""] = cells;
    if (!firstName || !lastName || !classGroupName) {
      errors.push(`Línia ${line}: falta el nom, el cognom o el grup classe.`);
      return;
    }
    const classGroup = classGroups.find(group => normalize(group.name) === normalize(classGroupName));
    if (!classGroup) {
      errors.push(`Línia ${line}: el grup classe «${classGroupName}» no existeix al curs vigent.`);
      return;
    }
    const subgroup = subgroupName ? classGroup.subgroups.find(item => normalize(item.name) === normalize(subgroupName)) : null;
    if (subgroupName && !subgroup) {
      errors.push(`Línia ${line}: el desdoblament «${subgroupName}» no existeix a ${classGroup.name}.`);
      return;
    }
    const key = `${normalize(firstName)}|${normalize(lastName)}|${classGroup.id}`;
    if (seen.has(key)) { skipped++; return; }
    seen.add(key);
    students.push({ firstName, lastName, classGroupId: classGroup.id, subgroupId: subgroup?.id || "" });
  });
  if (!rows.length || rows.length === (hasHeader ? 1 : 0)) errors.push("El fitxer CSV no conté cap alumne.");
  return { students, errors, skipped };
}
