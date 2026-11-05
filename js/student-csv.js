const normalize = value => String(value ?? "").trim().toLocaleLowerCase("ca").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function parseCsv(text) {
  const source = String(text).replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter = [";", "\t", ","].map(char => [char, firstLine.split(char).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
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
