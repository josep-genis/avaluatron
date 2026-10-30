import { icon } from "./formatting.js";

const LABEL_ICONS = [
  [/data|curs acad|any/i, "calendar"],
  [/cognoms|^noms?$|alumne/i, "user"],
  [/agrupament|desdobl|grup/i, "group"],
  [/descripci/i, "text"],
  [/hores|temporitz|inversi/i, "clock"],
  [/tipus|origen/i, "label"],
  [/activitat|examen|evid|situaci|classe/i, "clipboard-check"],
  [/compet|resultat|criteri/i, "medal"],
  [/nivell|assignatura|mat[eè]ria/i, "book"],
  [/client/i, "key"],
  [/nom|t[ií]tol/i, "edit-pencil"]
];

const SELECT_ICONS = [
  [/ordena/i, "sort"],
  [/estat/i, "filter"],
  [/grup|desdobl/i, "group"],
  [/curs/i, "calendar"],
  [/nivell|mat[eè]ria/i, "book"],
  [/compet/i, "medal"],
  [/origen/i, "label"],
  [/filtra/i, "filter"]
];

function pick(table, text) {
  const match = table.find(([pattern]) => pattern.test(text));
  return match ? match[1] : null;
}

function decorateLabel(label) {
  if (label.dataset.iconDecorated || label.querySelector("input, select, textarea")) return;
  label.dataset.iconDecorated = "1";
  const name = pick(LABEL_ICONS, label.textContent.trim());
  if (name) label.insertAdjacentHTML("afterbegin", `${icon(name, "label-icon")} `);
}

function decorateSelect(select) {
  if (select.closest(".select-with-icon") || select.classList.contains("grade-select")) return;
  const text = `${select.getAttribute("aria-label") || ""} ${select.id}`;
  const name = pick(SELECT_ICONS, text);
  if (!name || !select.parentElement) return;
  const wrapper = document.createElement("span");
  wrapper.className = "select-with-icon";
  select.before(wrapper);
  wrapper.insertAdjacentHTML("beforeend", icon(name, "select-icon"));
  wrapper.append(select);
}

function decorate(root) {
  root.querySelectorAll(".field > label").forEach(decorateLabel);
  root.querySelectorAll("select.group-filter, select.search-input, select[data-current-year]").forEach(decorateSelect);
}

export function startIconDecorator() {
  let scheduled = false;
  const run = () => {
    scheduled = false;
    observer.disconnect();
    decorate(document);
    observer.observe(document.body, { childList: true, subtree: true });
  };
  const observer = new MutationObserver(() => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(run); }
  });
  run();
}
