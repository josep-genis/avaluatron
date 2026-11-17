import { enableReordering } from "../js/reorder.js";

const results = document.querySelector("#results");
const list = document.querySelector("#list-a");
let updates = 0;
enableReordering(document, () => updates++);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pointer(handle, type, x, y, pointerType = "mouse") {
  handle.dispatchEvent(new PointerEvent(type, {
    bubbles: true, isPrimary: true, button: type === "pointermove" ? -1 : 0,
    pointerId: 1, pointerType, clientX: x, clientY: y
  }));
}

function drag(item, target, { after = false, finish = "pointerup", pointerType = "mouse" } = {}) {
  const handle = item.querySelector("[data-reorder-handle]");
  handle.setPointerCapture = () => {};
  const start = handle.getBoundingClientRect();
  const end = target.getBoundingClientRect();
  pointer(handle, "pointerdown", start.left + 5, start.top + 5, pointerType);
  pointer(handle, "pointermove", end.left + 5, after ? end.bottom - 5 : end.top + 5, pointerType);
  pointer(handle, finish, end.left + 5, after ? end.bottom - 5 : end.top + 5, pointerType);
}

try {
  const a = document.querySelector("#a");
  const b = document.querySelector("#b");
  const c = document.querySelector("#c");
  const d = document.querySelector("#d");
  a.querySelector("input").value = "Canvi sense desar";
  drag(a, c, { after: true });
  assert([...list.children].map(item => item.id).join() === "b,c,a", "Moure després de l'últim element");
  assert(a.querySelector("input").value === "Canvi sense desar" && updates === 1, "Conservar el contingut i notificar");
  drag(a, b, { pointerType: "touch" });
  assert([...list.children].map(item => item.id).join() === "a,b,c", "Moure abans amb pantalla tàctil");
  drag(a, c, { after: true, finish: "pointercancel" });
  assert([...list.children].map(item => item.id).join() === "a,b,c" && updates === 2, "Cancel·lar l'arrossegament");
  drag(a, d, { after: true });
  assert([...list.children].map(item => item.id).join() === "a,b,c" && updates === 2, "No moure entre llistes");
  const newItem = document.createElement("div");
  newItem.id = "new";
  newItem.dataset.reorderItem = "";
  newItem.innerHTML = "<span data-reorder-handle>Nou</span>";
  list.append(newItem);
  drag(newItem, b);
  assert([...list.children].map(item => item.id).join() === "a,new,b,c" && updates === 3, "Reordenar elements afegits després");
  const scroller = document.createElement("div");
  scroller.style.cssText = "position:fixed;top:20px;left:300px;width:200px;height:120px;overflow:auto;background:white";
  scroller.innerHTML = Array.from({ length: 10 }, (_, index) =>
    `<div data-reorder-item><span data-reorder-handle>${index}</span></div>`
  ).join("");
  document.body.append(scroller);
  const handle = scroller.querySelector("[data-reorder-handle]");
  handle.setPointerCapture = () => {};
  const start = handle.getBoundingClientRect();
  const bounds = scroller.getBoundingClientRect();
  const requestFrame = window.requestAnimationFrame;
  const cancelFrame = window.cancelAnimationFrame;
  let frame;
  window.requestAnimationFrame = callback => { frame = callback; return 1; };
  window.cancelAnimationFrame = () => {};
  pointer(handle, "pointerdown", start.left + 5, start.top + 5);
  pointer(handle, "pointermove", bounds.left + 5, bounds.bottom - 5);
  frame();
  assert(scroller.scrollTop > 0, "Desplaçar la llista durant l'arrossegament");
  pointer(handle, "pointercancel", bounds.left + 5, bounds.bottom - 5);
  window.requestAnimationFrame = requestFrame;
  window.cancelAnimationFrame = cancelFrame;
  scroller.remove();
  results.textContent = "PASS";
} catch (error) {
  results.textContent = `FAIL: ${error.message}`;
  throw error;
}
