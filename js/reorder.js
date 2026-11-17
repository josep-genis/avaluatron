export function enableReordering(root, onReorder) {
  let drag = null;

  function clearDrag() {
    if (!drag) return;
    cancelAnimationFrame(drag.frame);
    drag.item.classList.remove("reorder-dragging");
    drag.target?.classList.remove("reorder-before", "reorder-after");
    drag = null;
  }

  function updateTarget() {
    drag.target?.classList.remove("reorder-before", "reorder-after");
    let target = document.elementFromPoint(drag.currentX, drag.currentY);
    while (target && target.parentElement !== drag.list) target = target.parentElement;
    drag.target = target?.matches("[data-reorder-item]") && target !== drag.item ? target : null;
    if (drag.target) {
      const rect = drag.target.getBoundingClientRect();
      drag.after = drag.currentY >= rect.top + rect.height / 2;
      drag.target.classList.add(drag.after ? "reorder-after" : "reorder-before");
    }
  }

  function scrollDuringDrag() {
    if (!drag?.active) return;
    for (const container of drag.scrollContainers) {
      const rect = container === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth }
        : container.getBoundingClientRect();
      if (drag.currentX < rect.left || drag.currentX > rect.right || drag.currentY < rect.top || drag.currentY > rect.bottom) continue;
      const direction = drag.currentY < rect.top + 40 ? -1 : drag.currentY > rect.bottom - 40 ? 1 : 0;
      if (!direction) continue;
      const previous = container.scrollTop;
      container.scrollTop += direction * 12;
      if (container.scrollTop !== previous) {
        updateTarget();
        break;
      }
    }
    drag.frame = requestAnimationFrame(scrollDuringDrag);
  }

  root.addEventListener("pointerdown", event => {
    const handle = event.target.closest("[data-reorder-handle]");
    if (!handle || !event.isPrimary || event.button !== 0 || drag) return;
    const item = handle.closest("[data-reorder-item]");
    if (!item?.parentElement) return;
    const scrollContainers = [];
    for (let parent = item.parentElement; parent && parent !== document.scrollingElement; parent = parent.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) scrollContainers.push(parent);
    }
    scrollContainers.push(document.scrollingElement);
    drag = { item, list: item.parentElement, pointerId: event.pointerId, x: event.clientX, y: event.clientY, currentX: event.clientX, currentY: event.clientY, active: false, target: null, after: false, scrollContainers, frame: 0 };
    handle.setPointerCapture(event.pointerId);
  });

  root.addEventListener("pointermove", event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.currentX = event.clientX;
    drag.currentY = event.clientY;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
      drag.active = true;
      drag.item.classList.add("reorder-dragging");
      drag.frame = requestAnimationFrame(scrollDuringDrag);
    }
    updateTarget();
  });

  root.addEventListener("pointerup", event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { item, list, target, after, active } = drag;
    if (active && target && item.parentElement === list && target.parentElement === list) {
      const reference = after ? target.nextElementSibling : target;
      if (reference !== item) {
        list.insertBefore(item, reference);
        onReorder(list);
      }
    }
    clearDrag();
  });
  root.addEventListener("pointercancel", event => {
    if (drag?.pointerId === event.pointerId) clearDrag();
  });
  root.addEventListener("lostpointercapture", event => {
    if (drag?.pointerId === event.pointerId) clearDrag();
  });
  root.addEventListener("keydown", event => {
    if (event.key === "Escape" && drag) clearDrag();
  });
}
