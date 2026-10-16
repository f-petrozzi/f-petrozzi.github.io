import { createDroplet } from "./droplet";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// The scrollbar follows native page scrolling. It never intercepts wheel or touch scrolling.
const root = document.documentElement;
const rail = document.querySelector<HTMLElement>(".scroll-rail")!;
const thumb = document.querySelector<HTMLElement>(".scroll-thumb")!;
let drag: {
  id: number;
  y: number;
  x: number;
  scroll: number;
  range: number;
  travel: number;
  touch: boolean;
  lastY: number;
  lastTime: number;
  railTop: number;
  grabOffset: number;
} | null = null;
let scrollFrame = 0;
const range = () => Math.max(0, root.scrollHeight - innerHeight);
const travel = () => Math.max(1, rail.clientHeight - thumb.offsetHeight);
// Held movement follows the pointer exactly; only release uses the inertia loop.
let motionFrame = 0,
  motionTime = 0,
  motionTarget = 0,
  motionPosition = 0,
  motionVelocity = 0;
function stopMomentum() {
  cancelAnimationFrame(motionFrame);
  motionFrame = 0;
  motionVelocity = 0;
  if (!drag?.touch) {
    root.classList.remove("is-touch-scrolling");
    rail.style.removeProperty("top");
    rail.style.removeProperty("height");
    rail.style.removeProperty("bottom");
  }
}
function stepMomentum(time: number) {
  motionFrame = 0;
  const dt = Math.min(0.04, Math.max(0.001, (time - motionTime) / 1000));
  motionTime = time;
  if (!drag) {
    motionTarget += motionVelocity * dt;
    motionVelocity *= Math.exp(-dt / 0.22);
  }
  const limit = range();
  motionTarget = Math.max(0, Math.min(limit, motionTarget));
  if (motionTarget === 0 || motionTarget === limit) motionVelocity = 0;
  motionPosition +=
    (motionTarget - motionPosition) * (1 - Math.exp(-dt / 0.045));
  window.scrollTo({ top: motionPosition, behavior: "instant" });
  scheduleScroll();
  if (
    drag?.touch ||
    Math.abs(motionVelocity) > 10 ||
    Math.abs(motionTarget - motionPosition) > 0.5
  ) {
    motionFrame = requestAnimationFrame(stepMomentum);
  } else {
    window.scrollTo({ top: motionTarget, behavior: "instant" });
    stopMomentum();
  }
}
function wakeMomentum() {
  if (motionFrame || reducedMotion.matches) return;
  motionTime = performance.now();
  motionFrame = requestAnimationFrame(stepMomentum);
}
// Visual deformation never writes scroll position or modifies touch geometry.
const fluid = document.querySelector<HTMLElement>(".scroll-fluid")!;
const droplet = createDroplet(fluid, thumb, reducedMotion);
const aimFluid = droplet.aim;
const releaseFluid = droplet.release;
const stopFluid = droplet.reset;
document.addEventListener(
  "pointermove",
  (event) => {
    if (event.pointerType !== "touch" && !drag)
      aimFluid(event.clientX, event.clientY);
  },
  { passive: true },
);
document.documentElement.addEventListener("pointerleave", releaseFluid);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    endDrag();
    stopMomentum();
    stopFluid();
  }
});
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    stopFluid();
    stopMomentum();
  }
});
function updateScroll() {
  scrollFrame = 0;
  const max = drag?.touch ? drag.range : range();
  rail.hidden = max <= 1;
  root.classList.toggle("has-scroll-control", max > 1);
  const thumbTravel = drag?.touch ? drag.travel : travel();
  const fraction = max ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  thumb.style.transform = `translate3d(0, ${fraction * thumbTravel}px, 0)`;
  const railBounds = rail.getBoundingClientRect();
  droplet.position(
    {
      x: railBounds.left + thumb.offsetWidth / 2,
      y: railBounds.top + fraction * thumbTravel + thumb.offsetHeight / 2,
    },
    scrollY,
    max,
    thumbTravel,
  );
  const percent = Math.round(fraction * 100);
  thumb.setAttribute("aria-valuenow", String(percent));
  thumb.setAttribute(
    "aria-valuetext",
    percent === 0
      ? "Top of page"
      : percent === 100
        ? "Bottom of page"
        : `${percent}% down the page`,
  );
  thumb.setAttribute("aria-disabled", String(max === 0));
}
export function scheduleScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
}
export function endDrag(coast = false) {
  if (!drag) return;
  const releasedTouch = drag.touch;
  if (performance.now() - drag.lastTime > 100) motionVelocity = 0;
  const id = drag.id;
  drag = null;
  releaseFluid();
  if (!releasedTouch && thumb.hasPointerCapture(id))
    thumb.releasePointerCapture(id);
  thumb.classList.remove("is-dragging");
  document.body.classList.remove("is-scroll-dragging");
  if (coast && !reducedMotion.matches) wakeMomentum();
  else stopMomentum();
}
thumb.addEventListener("pointerdown", (event) => {
  if (
    event.pointerType === "touch" ||
    !event.isPrimary ||
    event.button !== 0 ||
    !range()
  )
    return;
  event.preventDefault();
  stopMomentum();
  thumb.focus({ preventScroll: true });
  motionTarget = motionPosition = scrollY;
  drag = {
    id: event.pointerId,
    y: event.clientY,
    x: event.clientX,
    scroll: scrollY,
    range: range(),
    travel: travel(),
    touch: false,
    lastY: event.clientY,
    lastTime: performance.now(),
    railTop: 0,
    grabOffset: 0,
  };
  droplet.grab(event.clientX, event.clientY);
  thumb.setPointerCapture(event.pointerId);
  thumb.classList.add("is-dragging");
  document.body.classList.add("is-scroll-dragging");
});
thumb.addEventListener("pointermove", (event) => {
  if (!drag || drag.touch || event.pointerId !== drag.id) return;
  aimFluid(event.clientX, event.clientY);
  const top =
    drag.scroll + ((event.clientY - drag.y) / drag.travel) * drag.range;
  const next = Math.min(drag.range, Math.max(0, top));
  const now = performance.now();
  const velocity =
    ((next - motionPosition) / Math.max(8, now - drag.lastTime)) * 1000;
  motionVelocity =
    motionVelocity * 0.25 + Math.max(-1800, Math.min(1800, velocity)) * 0.75;
  motionTarget = motionPosition = next;
  drag.lastTime = now;
  drag.lastY = event.clientY;
  window.scrollTo({ top: next, behavior: "instant" });
  scheduleScroll();
});
// Use one native touch stream, with viewport-relative coordinates and fixed rail
// geometry. Mixing screen coordinates and accumulated deltas caused mobile jumps.
thumb.addEventListener(
  "touchstart",
  (event) => {
    event.preventDefault();
    if (event.touches.length !== 1 || !range()) return;
    endDrag();
    stopMomentum();
    stopFluid();
    (document.activeElement as HTMLElement)?.blur();
    const touch = event.touches[0];
    droplet.grab(touch.clientX, touch.clientY);
    const bounds = rail.getBoundingClientRect();
    const thumbBounds = thumb.getBoundingClientRect();
    rail.style.top = `${bounds.top}px`;
    rail.style.height = `${bounds.height}px`;
    rail.style.bottom = "auto";
    root.classList.add("is-touch-scrolling");
    motionTarget = motionPosition = scrollY;
    drag = {
      id: touch.identifier,
      y: touch.clientY,
      x: touch.clientX,
      scroll: scrollY,
      range: range(),
      travel: travel(),
      touch: true,
      lastY: touch.clientY,
      lastTime: performance.now(),
      railTop: bounds.top,
      grabOffset: touch.clientY - thumbBounds.top,
    };
    thumb.classList.add("is-dragging");
    document.body.classList.add("is-scroll-dragging");
  },
  { passive: false },
);
thumb.addEventListener(
  "touchmove",
  (event) => {
    if (!drag?.touch) return;
    event.preventDefault();
    const touch = [...event.touches].find(
      (touch) => touch.identifier === drag!.id,
    );
    if (!touch) return;
    aimFluid(touch.clientX, touch.clientY);
    const now = performance.now();
    const top =
      ((touch.clientY - drag.railTop - drag.grabOffset) / drag.travel) *
      drag.range;
    const next = Math.max(0, Math.min(drag.range, top));
    const velocity =
      ((next - motionPosition) / Math.max(8, now - drag.lastTime)) * 1000;
    motionVelocity =
      motionVelocity * 0.25 + Math.max(-1800, Math.min(1800, velocity)) * 0.75;
    motionTarget = motionPosition = next;
    drag.lastTime = now;
    drag.lastY = touch.clientY;
    window.scrollTo({ top: next, behavior: "instant" });
    updateScroll();
  },
  { passive: false },
);
thumb.addEventListener(
  "touchend",
  (event) => {
    if (!drag?.touch) return;
    event.preventDefault();
    if (
      [...event.changedTouches].some((touch) => touch.identifier === drag!.id)
    )
      endDrag(true);
  },
  { passive: false },
);
thumb.addEventListener("touchcancel", () => {
  if (drag?.touch) endDrag();
});
thumb.addEventListener("contextmenu", (event) => event.preventDefault());
thumb.addEventListener("pointerup", () => {
  if (drag && !drag.touch) endDrag(true);
});
thumb.addEventListener("pointercancel", () => {
  if (drag && !drag.touch) endDrag();
});
thumb.addEventListener("lostpointercapture", () => {
  if (drag && !drag.touch) endDrag();
});
window.addEventListener("blur", () => {
  endDrag();
  stopMomentum();
});
let viewportWidth = innerWidth;
window.addEventListener("resize", () => {
  // Mobile browser chrome and the keyboard change height during normal use.
  if (innerWidth !== viewportWidth) {
    endDrag();
    stopMomentum();
    viewportWidth = innerWidth;
  }
  scheduleScroll();
});
window.addEventListener("wheel", stopMomentum, { passive: true });
document.addEventListener(
  "pointerdown",
  (event) => {
    if (!thumb.contains(event.target as Node)) stopMomentum();
  },
  { passive: true },
);
document.addEventListener("keydown", stopMomentum);
thumb.addEventListener("keydown", (event) => {
  const positions: Record<string, number> = {
    ArrowDown: scrollY + 60,
    ArrowUp: scrollY - 60,
    PageDown: scrollY + innerHeight * 0.85,
    PageUp: scrollY - innerHeight * 0.85,
    Home: 0,
    End: range(),
    " ": scrollY + innerHeight * 0.85 * (event.shiftKey ? -1 : 1),
  };
  if (!(event.key in positions)) return;
  event.preventDefault();
  window.scrollTo({ top: positions[event.key], behavior: "instant" });
});
rail.addEventListener("pointerdown", (event) => {
  if (
    event.target !== rail &&
    !(event.target as HTMLElement).classList.contains("scroll-track")
  )
    return;
  if (event.button !== 0 || !event.isPrimary) return;
  const rect = rail.getBoundingClientRect();
  const fraction = Math.min(
    1,
    Math.max(0, (event.clientY - rect.top - thumb.offsetHeight / 2) / travel()),
  );
  window.scrollTo({ top: fraction * range(), behavior: "instant" });
  thumb.focus({ preventScroll: true });
});
window.addEventListener("scroll", scheduleScroll, { passive: true });
new ResizeObserver(scheduleScroll).observe(document.body);
updateScroll();
void droplet.startEntrance();
