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

// Obre un mazo de targetes. `cards` = [{ id, title, subtitle, initials, criterion }].
// `onRate(card, level | null)` desa o desfà la valoració i retorna `false` si ha fallat.
export function openSwipeDeck({ cards, heading, onRate }) {
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
    document.removeEventListener("keydown", onKey);
    root.remove();
  };

  function render() {
    const card = cards[index];
    const hints = Object.entries(DIRECTIONS).map(([name, item]) =>
      `<button type="button" class="swipe-hint swipe-hint-${name}" data-swipe-dir="${name}" ${card ? "" : "disabled"} aria-label="${item.code}: ${item.label}"><strong>${item.arrow} ${item.code}</strong><small>${item.label}</small></button>`
    ).join("");
    root.innerHTML = `<div class="swipe-shell">
      <header class="swipe-header">
        <div><p class="eyebrow">${escapeHtml(heading)}</p><strong>${Math.min(index, cards.length)} / ${cards.length}</strong></div>
        <div class="swipe-header-actions">
          <button type="button" class="button button-quiet" data-swipe-skip ${card ? "" : "disabled"}>Salta</button>
          <button type="button" class="button button-quiet" data-swipe-undo ${history.length ? "" : "disabled"}>Desfés</button>
          <button type="button" class="button button-quiet" data-swipe-close>Tanca</button>
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
          <span class="swipe-stamp" aria-hidden="true"></span>
        </article>` : `<div class="swipe-done"><h2>Fet!</h2><p>No queden targetes pendents.</p><button type="button" class="button button-primary" data-swipe-close>Acaba</button></div>`}
      </div>
      <p class="swipe-help">Arrossega la targeta o usa les fletxes del teclat: ↑ AE · → AN · ↓ NA · ← AS</p>
    </div>`;
    root.querySelector(".swipe-card")?.focus({ preventScroll: true });
  }

  function commit(direction) {
    const card = cards[index];
    if (!card) return;
    const { level } = DIRECTIONS[direction];
    if (onRate(card, level) === false) return;
    history.push({ card, index });
    index += 1;
    render();
  }

  function skip() {
    if (!cards[index]) return;
    cards.push(cards.splice(index, 1)[0]);
    if (index >= cards.length) index = cards.length - 1;
    render();
  }

  function undo() {
    const last = history.pop();
    if (!last) return;
    if (onRate(last.card, null) === false) {
      history.push(last);
      return;
    }
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
    } else if (KEY_DIRECTIONS[event.key]) {
      event.preventDefault();
      commit(KEY_DIRECTIONS[event.key]);
    } else if ((event.key === "z" || event.key === "Z") && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      undo();
    }
  }

  root.addEventListener("click", event => {
    const dir = event.target.closest("[data-swipe-dir]");
    if (dir) commit(dir.dataset.swipeDir);
    else if (event.target.closest("[data-swipe-skip]")) skip();
    else if (event.target.closest("[data-swipe-undo]")) undo();
    else if (event.target.closest("[data-swipe-close]")) close();
  });

  root.addEventListener("pointerdown", event => {
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
    stamp.textContent = distance > 30 ? DIRECTIONS[direction].code : "";
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
