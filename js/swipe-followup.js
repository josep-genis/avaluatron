import { escapeHtml } from "./formatting.js";

// Nivells del seguiment diari: 1 = NA, 2 = AS, 3 = AN, 4 = AE.
const DIRECTIONS = {
  up: { level: 4, code: "AE", label: "Assoliment excel·lent", arrow: "↑" },
  right: { level: 3, code: "AN", label: "Assoliment notable", arrow: "→" },
  down: { level: 1, code: "NA", label: "No assolit", arrow: "↓" },
  left: { level: 2, code: "AS", label: "Assoliment satisfactori", arrow: "←" }
};
const KEY_DIRECTIONS = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left" };
const SWIPE_THRESHOLD = 90;

export function openSwipeDeck({ cards, heading, onRate, onAbsent, onNote }) {
  const root = document.createElement("div");
  root.className = "swipe-overlay";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Seguiment diari per targetes");
  document.body.append(root);

  const history = [];
  let index = 0;
  let drag = null;

  const close = () => {
    const currentNote = root.querySelector("[data-swipe-note]");
    if (currentNote) cards[index].draft = currentNote.value;
    if (cards.some(card => card.type === "note" && card.draft !== undefined && card.draft !== (card.note || "")) &&
      !globalThis.confirm("Hi ha observacions sense desar. Vols tancar el mode targetes i descartar-les?")) return;
    document.removeEventListener("keydown", onKey);
    root.remove();
  };

  function render() {
    const card = cards[index];
    const isNote = card?.type === "note";
    const hints = Object.entries(DIRECTIONS).map(([name, item]) =>
      `<button type="button" class="swipe-hint swipe-hint-${name}" data-swipe-dir="${name}" ${card ? "" : "disabled"} aria-label="${isNote ? `Acaba l'observació ${item.arrow}` : `${item.code}: ${item.label}`}"><strong>${item.arrow} ${isNote ? "Fet" : item.code}</strong><small>${isNote ? "Acaba l'observació" : item.label}</small></button>`
    ).join("");
    root.innerHTML = `<div class="swipe-shell">
      <header class="swipe-header">
        <div><p class="eyebrow">${escapeHtml(heading)}</p><strong>${Math.min(index, cards.length)} / ${cards.length}</strong></div>
        <div class="swipe-header-actions">
          ${onAbsent ? `<button type="button" class="button button-quiet" data-swipe-absent ${card ? "" : "disabled"}>Absent · A</button>` : ""}
          <button type="button" class="button button-quiet" data-swipe-skip ${card ? "" : "disabled"}>Salta</button>
          <button type="button" class="button button-quiet" data-swipe-undo ${history.length ? "" : "disabled"}>Desfés</button>
          <button type="button" class="button button-quiet swipe-close" data-swipe-close aria-label="Tanca" title="Tanca">✕</button>
        </div>
      </header>
      <div class="swipe-progress"><span style="width:${cards.length ? (index / cards.length) * 100 : 100}%"></span></div>
      <div class="swipe-stage">
        ${hints}
        ${card ? `<article class="swipe-card" tabindex="0" aria-live="polite">
          <span class="swipe-card-avatar" aria-hidden="true">${escapeHtml(card.initials)}</span>
          <h2>${escapeHtml(card.title)}</h2>
          <p>${escapeHtml(card.subtitle)}</p>
          <span class="swipe-card-criterion">${escapeHtml(card.criterion)}</span>
          ${isNote ? `<textarea class="swipe-card-note" data-swipe-note maxlength="500" aria-label="Observació de ${escapeHtml(card.title)}" placeholder="Afegeix una observació…">${escapeHtml(card.draft ?? card.note ?? "")}</textarea>` : ""}
          <span class="swipe-stamp" aria-hidden="true"></span>
        </article>` : `<div class="swipe-done"><h2>Fet!</h2><p>No queden targetes pendents.</p><button type="button" class="button button-primary" data-swipe-close>Acaba</button></div>`}
      </div>
      <p class="swipe-help">${isNote ? "Edita l'observació i arrossega la targeta en qualsevol direcció per acabar. També pots usar les fletxes fora del camp de text." : "Arrossega la targeta o usa les fletxes del teclat: ↑ AE · → AN · ↓ NA · ← AS"}${onAbsent ? " · A absent" : ""}</p>
    </div>`;
    root.querySelector(".swipe-card")?.focus({ preventScroll: true });
  }

  function commit(direction) {
    const card = cards[index];
    if (!card) return;
    if (card.type === "note") {
      const previousNote = card.note || "";
      const note = root.querySelector("[data-swipe-note]").value.trim();
      if (onNote(card, note) === false) return;
      card.note = note;
      delete card.draft;
      history.push({ card, index, previousNote });
    } else {
      const { level } = DIRECTIONS[direction];
      if (onRate(card, level) === false) return;
      history.push({ card, index });
    }
    index += 1;
    render();
  }

  function markAbsent() {
    const card = cards[index];
    if (!card || !onAbsent) return;
    if (card.type === "note") {
      card.draft = root.querySelector("[data-swipe-note]").value;
    }
    if (cards.slice(index).some(item => item.studentId === card.studentId && item.type === "note" &&
      item.draft !== undefined && item.draft !== (item.note || "")) &&
      !globalThis.confirm("L'observació encara no s'ha desat. Vols marcar l'alumne com a absent?")) return;
    if (onAbsent(card, true) === false) return;
    const removed = cards.slice(index + 1).filter(item => item.studentId === card.studentId);
    for (const item of removed) cards.splice(cards.indexOf(item), 1);
    history.push({ card, index, absent: true, removed });
    index += 1;
    render();
  }

  function skip() {
    if (!cards[index]) return;
    if (cards[index].type === "note") cards[index].draft = root.querySelector("[data-swipe-note]").value;
    cards.push(cards.splice(index, 1)[0]);
    if (index >= cards.length) index = cards.length - 1;
    render();
  }

  function undo() {
    const last = history.pop();
    if (!last) return;
    const success = last.absent ? onAbsent(last.card, false) :
      last.card.type === "note" ? onNote(last.card, last.previousNote) : onRate(last.card, null);
    if (success === false) {
      history.push(last);
      return;
    }
    if (last.card.type === "note" && !last.absent) {
      last.card.note = last.previousNote;
      delete last.card.draft;
    }
    if (last.absent) cards.splice(last.index + 1, 0, ...last.removed);
    index = last.index;
    render();
  }

  function directionOf(dx, dy) {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
  }

  function onKey(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.target.closest("input, textarea, select, [contenteditable='true']")) {
      return;
    } else if (KEY_DIRECTIONS[event.key]) {
      event.preventDefault();
      commit(KEY_DIRECTIONS[event.key]);
    } else if ((event.key === "a" || event.key === "A") && onAbsent && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      markAbsent();
    } else if ((event.key === "z" || event.key === "Z") && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      undo();
    }
  }

  root.addEventListener("click", event => {
    const dir = event.target.closest("[data-swipe-dir]");
    if (dir) commit(dir.dataset.swipeDir);
    else if (event.target.closest("[data-swipe-absent]")) markAbsent();
    else if (event.target.closest("[data-swipe-skip]")) skip();
    else if (event.target.closest("[data-swipe-undo]")) undo();
    else if (event.target.closest("[data-swipe-close]")) close();
  });

  root.addEventListener("pointerdown", event => {
    if (event.target.closest("input, textarea, button, select")) return;
    const el = event.target.closest(".swipe-card");
    if (!el) return;
    drag = { el, x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
    el.setPointerCapture(event.pointerId);
    el.classList.add("dragging");
  });

  root.addEventListener("pointermove", event => {
    if (!drag) return;
    drag.dx = event.clientX - drag.x;
    drag.dy = event.clientY - drag.y;
    const direction = directionOf(drag.dx, drag.dy);
    const distance = Math.hypot(drag.dx, drag.dy);
    drag.el.style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 20}deg)`;
    const stamp = drag.el.querySelector(".swipe-stamp");
    stamp.textContent = distance > 30 ? (cards[index]?.type === "note" ? "Fet" : DIRECTIONS[direction].code) : "";
    stamp.dataset.dir = direction;
    stamp.style.opacity = Math.min(distance / SWIPE_THRESHOLD, 1);
  });

  const endDrag = event => {
    if (!drag) return;
    const { dx, dy, el } = drag;
    drag = null;
    el.classList.remove("dragging");
    if (event.type !== "pointercancel" && Math.hypot(dx, dy) >= SWIPE_THRESHOLD) {
      commit(directionOf(dx, dy));
      if (el.isConnected) el.style.transform = "";
    } else {
      el.style.transform = "";
      const stamp = el.querySelector(".swipe-stamp");
      if (stamp) stamp.style.opacity = 0;
    }
  };
  root.addEventListener("pointerup", endDrag);
  root.addEventListener("pointercancel", endDrag);

  document.addEventListener("keydown", onKey);
  render();
}
