import { getActivityOffers, getOfferingStudents } from "./data.js";
import { data, state } from "./state.js";
import { RECOVERED_MAX_SCORE } from "./grades.js";
import { formatDate, formatGradeWithCode } from "./formatting.js";
import { getStudentReportData, RECOVERY_EXPLANATION } from "./activity-report.js";

let libraryLoading;
let fontsLoaded = false;

function loadScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL(path, import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error(`No s'ha pogut carregar ${path}.`));
    };
    document.head.append(script);
  });
}

function loadLibraries() {
  if (!libraryLoading) {
    libraryLoading = (async () => {
      if (!window.pdfMake) await loadScript("../third-party/pdfmake/pdfmake.min.js");
      if (!fontsLoaded) {
        await loadScript("../third-party/pdfmake/vfs_fonts.js");
        fontsLoaded = true;
      }
      if (!window.fflate) await loadScript("../third-party/fflate/index.js");
      if (!window.pdfMake?.createPdf || !window.fflate?.zipSync) {
        throw new Error("Les biblioteques de PDF o ZIP no estan disponibles.");
      }
    })().catch(error => {
      libraryLoading = null;
      throw error;
    });
  }
  return libraryLoading;
}

function safeName(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "alumne";
}

function reportDefinition(activity, report) {
  const generatedDate = new Intl.DateTimeFormat("ca-ES", { dateStyle: "long" }).format(new Date());
  const rows = [
    [{ text: "Evidència i competències", bold: true }, { text: "Pes", bold: true }, { text: "Resultat", bold: true }],
    ...report.evidences.map(evidence => [
      { stack: [{ text: evidence.name, bold: true }, { text: evidence.contributions, style: "secondary" }] },
      `${evidence.weight}%`,
      { stack: [
        { text: evidence.result },
        ...(evidence.capped ? [{ text: `Nota limitada a ${formatGradeWithCode(RECOVERED_MAX_SCORE)} per recuperació.`, style: "secondary" }] : []),
        ...(evidence.descriptor ? [{ text: evidence.descriptor, style: "secondary" }] : [])
      ] }
    ])
  ];
  if (!report.evidences.length) rows.push([{ text: "Aquesta activitat encara no té evidències.", colSpan: 3 }, "", ""]);
  const gradeText = report.gradeLabel + (report.grade !== null && report.recovered ? " (recuperada, màxim 5/AS)" : "");
  const content = [
    { text: "INFORME D'AVALUACIÓ", style: "eyebrow" },
    { text: activity.title, style: "title" },
    { text: activity.type, style: "secondary", margin: [0, 0, 0, 16] },
    { columns: [
      { stack: [{ text: "Alumne/a", style: "secondary" }, { text: report.studentName, bold: true }] },
      { stack: [{ text: "Grup classe", style: "secondary" }, { text: report.studentGroup, bold: true }] },
      { stack: [{ text: "Data de l'activitat", style: "secondary" }, { text: formatDate(activity.date), bold: true }] }
    ], columnGap: 12, margin: [0, 0, 0, 18] },
    { text: "Nota final de l'activitat", style: "heading" },
    { text: report.exempt ? "Aquesta activitat no es compta en la qualificació de l'alumne/a." : `${report.evaluatedEvidenceCount} de ${report.evidences.length} evidències avaluades`, style: "secondary" },
    { text: gradeText, bold: true, fontSize: 13, margin: [0, 5, 0, 16] }
  ];
  if (report.recovered && !report.exempt) {
    content.push({ text: "Activitat recuperada", style: "heading" }, { text: RECOVERY_EXPLANATION, margin: [0, 0, 0, 15] });
  }
  content.push(
    { text: "Progrés per evidència", style: "heading" },
    { text: "La nota de cada evidència es mostra sobre 10 amb la seva qualificació textual.", style: "secondary", margin: [0, 0, 0, 8] },
    { table: { headerRows: 1, widths: ["*", 35, "*"], body: rows }, layout: "lightHorizontalLines" }
  );
  if (report.feedback.trim()) {
    content.push({ text: "Retroacció", style: "heading", margin: [0, 18, 0, 5] }, { text: report.feedback });
  }
  return {
    pageSize: "A4",
    pageMargins: [48, 42, 48, 52],
    info: { title: `Informe ${report.studentName} - ${activity.title}` },
    defaultStyle: { font: "Roboto", fontSize: 10, color: "#303832" },
    styles: {
      eyebrow: { fontSize: 9, bold: true, color: "#708177", margin: [0, 0, 0, 6] },
      title: { fontSize: 20, bold: true, color: "#2c604b", margin: [0, 0, 0, 5] },
      heading: { fontSize: 12, bold: true, margin: [0, 0, 0, 5] },
      secondary: { fontSize: 9, color: "#68736b" }
    },
    footer: (currentPage, pageCount) => ({
      text: `Avaluatró · Informe generat el ${generatedDate}\nNA: No assolit · AS: Assoliment satisfactori · AN: Assoliment notable · AE: Assoliment excel·lent    ${currentPage}/${pageCount}`,
      fontSize: 8, color: "#68736b", margin: [48, 12, 48, 0]
    }),
    content
  };
}

function generatePdf(definition) {
  return new Promise((resolve, reject) => {
    const stream = window.pdfMake.createPdf(definition).getStream();
    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => {
      new Blob(chunks).arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject);
    });
    stream.end();
  });
}

export async function exportActivityReportsBatch() {
  const activity = data.activities.find(item => item.id === state.selectedActivityId);
  if (!activity) throw new Error("No s'ha trobat l'activitat.");
  const offerings = getActivityOffers(data, activity.id).filter(offer =>
    (!state.selectedSubjectId || offer.subjectId === state.selectedSubjectId) &&
    (!state.selectedLevelId || offer.levelId === state.selectedLevelId)
  );
  const offering = offerings.find(offer => offer.id === state.selectedOfferingId) ||
    (offerings.length === 1 ? offerings[0] : null);
  if (!offering) throw new Error("Tria una oferta docent per exportar-ne els informes.");
  const students = getOfferingStudents(data, offering);
  if (!students.length) throw new Error("No hi ha alumnat per exportar.");

  const reports = students.map(student => getStudentReportData(activity, student, state.selectedSubjectId, offering.id));
  const activityInfo = { title: activity.title, type: activity.type, date: activity.date };
  await loadLibraries();
  const files = {};
  const names = new Set();
  for (const report of reports) {
    const base = safeName(report.studentName);
    let filename = `${base}.pdf`;
    let suffix = 2;
    while (names.has(filename)) filename = `${base}-${suffix++}.pdf`;
    names.add(filename);
    files[filename] = await generatePdf(reportDefinition(activityInfo, report));
  }
  const archive = window.fflate.zipSync(files, { level: 0 });
  const url = URL.createObjectURL(new Blob([archive], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `informes-${safeName(activityInfo.title)}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return reports.length;
}
