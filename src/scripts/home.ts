import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
gsap.registerPlugin(Flip);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const duration = (seconds: number) => (reducedMotion.matches ? 0 : seconds);

// The scrollbar follows native page scrolling. It never intercepts wheel or touch scrolling.
const root = document.documentElement;
const rail = document.querySelector<HTMLElement>(".scroll-rail")!;
const thumb = document.querySelector<HTMLElement>(".scroll-thumb")!;
const readout = document.querySelector<HTMLElement>(".scroll-readout")!;
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
} | null = null;
let scrollFrame = 0;
const range = () => Math.max(0, root.scrollHeight - innerHeight);
const travel = () => Math.max(1, rail.clientHeight - thumb.offsetHeight);
// Touch drags have a bounded gain and one frame loop, then gently coast.
let motionFrame = 0,
  motionTime = 0,
  motionTarget = 0,
  motionPosition = 0,
  motionVelocity = 0;
function stopMomentum() {
  cancelAnimationFrame(motionFrame);
  motionFrame = 0;
  motionVelocity = 0;
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
  }
}
function wakeMomentum() {
  if (motionFrame || reducedMotion.matches) return;
  motionTime = performance.now();
  motionFrame = requestAnimationFrame(stepMomentum);
}
// Cursor proximity deforms the small surface. Scrolling only changes its position.
const fluid = document.querySelector<HTMLElement>(".scroll-fluid")!;
let fluidFrame = 0,
  fluidTime = 0;
const fluidState = {
  x: 0,
  y: 0,
  pressure: 0,
  vx: 0,
  vy: 0,
  vp: 0,
  tx: 0,
  ty: 0,
  tp: 0,
};
let thumbCenter = { x: 0, y: 0 };
const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));
function drawFluid() {
  const { x, y, pressure: p } = fluidState;
  if (Math.abs(x) + Math.abs(y) + p < 0.001) {
    fluid.style.transform = "";
    fluid.style.removeProperty("--fluid-radius");
    return;
  }
  const stretchX = 1 + p * 0.2 + Math.abs(x) * 0.014;
  const stretchY = 1 - p * 0.13 + Math.abs(y) * 0.01;
  fluid.style.transform = `translate3d(${x * 0.45}px,${y * 0.35}px,0) scale(${stretchX},${stretchY})`;
  // Local corner curvature changes independently of translation: the surface spreads
  // beneath the pointer instead of behaving as a rigid, rotating object.
  const lx = (x + y) * 0.707,
    ly = (y - x) * 0.707;
  const horizontal = [12 + p * 27 - ly, 64 + lx, 59 + ly, 65 - lx]
    .map((v) => `${v}%`)
    .join(" ");
  const vertical = [18 + p * 25 - lx, 68 - ly, 57 + lx, 65 + ly]
    .map((v) => `${v}%`)
    .join(" ");
  fluid.style.setProperty("--fluid-radius", `${horizontal} / ${vertical}`);
}
function settleFluid(time: number) {
  fluidFrame = 0;
  const dt = Math.min(0.032, Math.max(0.001, (time - fluidTime) / 1000));
  fluidTime = time;
  for (const [position, velocity, target] of [
    ["x", "vx", "tx"],
    ["y", "vy", "ty"],
    ["pressure", "vp", "tp"],
  ] as const) {
    fluidState[velocity] +=
      (190 * (fluidState[target] - fluidState[position]) -
        22 * fluidState[velocity]) *
      dt;
    fluidState[position] += fluidState[velocity] * dt;
  }
  drawFluid();
  const residual =
    Math.abs(fluidState.tx - fluidState.x) +
    Math.abs(fluidState.ty - fluidState.y) +
    Math.abs(fluidState.tp - fluidState.pressure) +
    Math.abs(fluidState.vx) +
    Math.abs(fluidState.vy) +
    Math.abs(fluidState.vp);
  if (residual > 0.012) fluidFrame = requestAnimationFrame(settleFluid);
  else {
    fluidState.x = fluidState.tx;
    fluidState.y = fluidState.ty;
    fluidState.pressure = fluidState.tp;
    fluidState.vx = fluidState.vy = fluidState.vp = 0;
    drawFluid();
  }
}
function wakeFluid() {
  if (reducedMotion.matches || document.hidden || fluidFrame) return;
  fluidTime = performance.now();
  fluidFrame = requestAnimationFrame(settleFluid);
}
function releaseFluid() {
  fluidState.tx = fluidState.ty = fluidState.tp = 0;
  wakeFluid();
}
function stopFluid() {
  cancelAnimationFrame(fluidFrame);
  fluidFrame = 0;
  Object.keys(fluidState).forEach((key) => (fluidState[key] = 0));
  drawFluid();
}
function aimFluid(x: number, y: number) {
  if (reducedMotion.matches) return;
  const dx = x - thumbCenter.x,
    dy = y - thumbCenter.y,
    distance = Math.hypot(dx, dy);
  const proximity = Math.max(0, 1 - distance / 88);
  fluidState.tx = clamp(dx, 24) * proximity * 0.6;
  fluidState.ty = clamp(dy, 28) * proximity * 0.5;
  fluidState.tp = Math.max(0, 1 - distance / 32);
  wakeFluid();
}
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
  if (!drag) releaseFluid();
  const max = range();
  const fraction = max ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  thumb.style.transform = `translate3d(0, ${fraction * travel()}px, 0)`;
  const railBounds = rail.getBoundingClientRect();
  thumbCenter = {
    x: railBounds.left + thumb.offsetWidth / 2,
    y: railBounds.top + fraction * travel() + thumb.offsetHeight / 2,
  };
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
  readout.textContent = `${percent}%`;
  thumb.setAttribute("aria-disabled", String(max === 0));
}
function scheduleScroll() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
}
function endDrag(coast = false) {
  if (!drag) return;
  const releasedTouch = drag.touch;
  if (performance.now() - drag.lastTime > 100) motionVelocity = 0;
  const id = drag.id;
  drag = null;
  releaseFluid();
  if (thumb.hasPointerCapture(id)) thumb.releasePointerCapture(id);
  thumb.classList.remove("is-dragging");
  document.body.classList.remove("is-scroll-dragging");
  if (coast && releasedTouch && !reducedMotion.matches) wakeMomentum();
  else stopMomentum();
}
thumb.addEventListener("pointerdown", (event) => {
  if (!event.isPrimary || event.button !== 0 || !range()) return;
  event.preventDefault();
  stopMomentum();
  motionTarget = motionPosition = scrollY;
  thumb.focus({ preventScroll: true });
  drag = {
    id: event.pointerId,
    y: event.clientY,
    x: event.clientX,
    scroll: scrollY,
    range: range(),
    travel: travel(),
    touch: event.pointerType === "touch",
    lastY: event.clientY,
    lastTime: performance.now(),
  };
  thumb.setPointerCapture(event.pointerId);
  thumb.classList.add("is-dragging");
  document.body.classList.add("is-scroll-dragging");
});
thumb.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  if (drag.touch) {
    const now = performance.now();
    const gain = Math.min(4, drag.range / drag.travel);
    const elapsed = Math.max(8, now - drag.lastTime);
    const velocity = (((event.clientY - drag.lastY) * gain) / elapsed) * 1000;
    motionVelocity =
      motionVelocity * 0.3 + Math.max(-2500, Math.min(2500, velocity)) * 0.7;
    drag.lastY = event.clientY;
    drag.lastTime = now;
    motionTarget = Math.max(
      0,
      Math.min(range(), drag.scroll + (event.clientY - drag.y) * gain),
    );
    if (reducedMotion.matches)
      window.scrollTo({ top: motionTarget, behavior: "instant" });
    else wakeMomentum();
  } else {
    aimFluid(event.clientX, event.clientY);
    const top =
      drag.scroll + ((event.clientY - drag.y) / drag.travel) * drag.range;
    window.scrollTo({
      top: Math.min(drag.range, Math.max(0, top)),
      behavior: "instant",
    });
    scheduleScroll();
  }
});
thumb.addEventListener("pointerup", () => endDrag(true));
thumb.addEventListener("pointercancel", () => endDrag());
thumb.addEventListener("lostpointercapture", () => endDrag());
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
rail.hidden = false;
root.classList.add("has-scroll-control");
updateScroll();

// Fast, interruptible index filtering; keep the complete tools list searchable.
const filters = document.querySelector<HTMLElement>(".filters")!;
const rows = [...document.querySelectorAll<HTMLElement>(".project-row")];
const filterButtons = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-filter]"),
];
const search = document.querySelector<HTMLInputElement>("#project-search")!;
const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const count = document.querySelector<HTMLElement>("#result-count")!;
const empty = document.querySelector<HTMLElement>("#empty-results")!;
let activeFilter = "all";
let filterAnimation: gsap.core.Timeline | null = null;
function filterProjects() {
  filterAnimation?.progress(1).kill();
  const state = reducedMotion.matches ? null : Flip.getState(rows);
  const term = normalizeSearch(search.value.trim());
  let total = 0;
  rows.forEach((row) => {
    const matches =
      (activeFilter === "all" ||
        row.dataset.facets!.split(" ").includes(activeFilter)) &&
      normalizeSearch(row.dataset.search!).includes(term);
    row.hidden = !matches;
    if (matches) total++;
  });
  count.textContent = `${total} ${total === 1 ? "project" : "projects"}`;
  empty.hidden = total !== 0;
  if (state)
    filterAnimation = Flip.from(state, {
      duration: 0.22,
      ease: "power2.out",
      absoluteOnLeave: true,
      onEnter: (elements) =>
        gsap.fromTo(
          elements,
          { opacity: 0 },
          { opacity: 1, duration: 0.16, clearProps: "opacity" },
        ),
    });
  scheduleScroll();
}
filterButtons.forEach((button) =>
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter!;
    filterButtons.forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    filterProjects();
  }),
);
search.addEventListener("input", filterProjects);
// Small, explicit tool completions. Typing still filters projects immediately.
const suggestions =
  document.querySelector<HTMLUListElement>("#tool-suggestions")!;
const tools = [
  ...new Set(rows.flatMap((row) => JSON.parse(row.dataset.tools!) as string[])),
].sort((a, b) => a.localeCompare(b));
let matches: string[] = [];
let activeSuggestion = -1;
function closeSuggestions() {
  suggestions.hidden = true;
  search.setAttribute("aria-expanded", "false");
  search.removeAttribute("aria-activedescendant");
  activeSuggestion = -1;
}
function showSuggestions() {
  const prefix = normalizeSearch(search.value.trim());
  matches = prefix
    ? tools.filter(
        (tool) =>
          normalizeSearch(tool).startsWith(prefix) &&
          normalizeSearch(tool) !== prefix,
      )
    : [];
  suggestions.replaceChildren();
  activeSuggestion = -1;
  search.removeAttribute("aria-activedescendant");
  matches.forEach((tool, index) => {
    const option = document.createElement("li");
    option.id = `tool-suggestion-${index}`;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");
    option.textContent = tool;
    option.addEventListener("pointerdown", (event) => event.preventDefault());
    option.addEventListener("click", () => chooseSuggestion(index));
    suggestions.append(option);
  });
  suggestions.hidden = matches.length === 0;
  search.setAttribute("aria-expanded", String(matches.length > 0));
}
function chooseSuggestion(index: number) {
  search.value = matches[index];
  closeSuggestions();
  filterProjects();
}
search.addEventListener("input", showSuggestions);
search.addEventListener("focus", showSuggestions);
search.addEventListener("blur", closeSuggestions);
search.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !suggestions.hidden) {
    event.preventDefault();
    event.stopPropagation();
    closeSuggestions();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (suggestions.hidden) showSuggestions();
    if (!matches.length) return;
    event.preventDefault();
    activeSuggestion =
      activeSuggestion < 0
        ? event.key === "ArrowDown"
          ? 0
          : matches.length - 1
        : (activeSuggestion +
            (event.key === "ArrowDown" ? 1 : -1) +
            matches.length) %
          matches.length;
    [...suggestions.children].forEach((option, index) =>
      option.setAttribute("aria-selected", String(index === activeSuggestion)),
    );
    const option = suggestions.children[activeSuggestion];
    search.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest", behavior: "instant" });
  } else if (
    event.key === "Enter" &&
    !suggestions.hidden &&
    activeSuggestion >= 0
  ) {
    event.preventDefault();
    chooseSuggestion(activeSuggestion);
  }
});
function resetFilters() {
  closeSuggestions();
  search.value = "";
  activeFilter = "all";
  filterButtons.forEach((item) =>
    item.setAttribute("aria-pressed", String(item.dataset.filter === "all")),
  );
  filterProjects();
  search.focus({ preventScroll: true });
}
document
  .querySelector("#clear-filters")!
  .addEventListener("click", resetFilters);
document
  .querySelector("#reset-filters")!
  .addEventListener("click", resetFilters);
filters.hidden = false;

// Native details remain usable without JavaScript; GSAP handles interruptible growth.
document
  .querySelectorAll<HTMLDetailsElement>(".career-card")
  .forEach((card) => {
    const summary = card.querySelector<HTMLElement>("summary")!;
    const description = card.querySelector<HTMLElement>(".career-description")!;
    let expanded = false;
    function expand(open: boolean) {
      if (expanded === open) return;
      expanded = open;
      gsap.killTweensOf(description);
      const height = card.open ? description.getBoundingClientRect().height : 0;
      card.open = true;
      gsap.fromTo(
        description,
        { height, opacity: open ? 0.4 : 1 },
        {
          height: open ? description.scrollHeight : 0,
          opacity: open ? 1 : 0,
          duration: duration(0.38),
          ease: "power3.inOut",
          onComplete: () => {
            card.open = open;
            gsap.set(description, { clearProps: "height,opacity" });
            sizeCareerSegments();
            scheduleScroll();
          },
        },
      );
    }
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      expand(!expanded);
    });
    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse" && matchMedia("(hover: hover)").matches)
        expand(true);
    });
    card.addEventListener("pointerleave", (event) => {
      if (event.pointerType === "mouse" && matchMedia("(hover: hover)").matches)
        expand(false);
    });
  });

// The two timelines share an animated selector and a continuous chronological spine.
const timelineTabs = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-timeline]"),
];
const timelineStage = document.querySelector<HTMLElement>(".timeline-stage")!;
const timelineIndicator = document.querySelector<HTMLElement>(
  ".timeline-tab-indicator",
)!;
// Connect card centers even when descriptions wrap to different heights.
function sizeCareerSegments() {
  document
    .querySelectorAll<HTMLElement>(".timeline-panel:not([hidden])")
    .forEach((panel) => {
      const stops = [...panel.querySelectorAll<HTMLElement>(".career-stop")];
      stops.forEach((stop, index) => {
        const next = stops[index + 1];
        if (!next) return;
        const marker = stop.querySelector<HTMLElement>(".career-marker")!;
        const nextMarker = next.querySelector<HTMLElement>(".career-marker")!;
        const length =
          next.offsetTop -
          stop.offsetTop +
          (nextMarker.offsetHeight - marker.offsetHeight) / 2;
        stop.style.setProperty("--segment-length", `${length}px`);
      });
    });
}
const careerResizeObserver = new ResizeObserver(sizeCareerSegments);
document
  .querySelectorAll(".career-card")
  .forEach((card) => careerResizeObserver.observe(card));
sizeCareerSegments();
let timelineAnimation: gsap.core.Timeline | null = null;
let activeTimeline = "experience";
let timelineExit: Animation | null = null;
let timelineRevision = 0;
let timelineVisited = false;
function revealPath(panel: HTMLElement, beforeHeight?: number) {
  timelineAnimation?.progress(1).kill();
  if (reducedMotion.matches) {
    scheduleScroll();
    return;
  }
  const stops = [...panel.querySelectorAll<HTMLElement>(".career-stop")];
  timelineAnimation = gsap.timeline({ onComplete: scheduleScroll });
  if (beforeHeight !== undefined)
    timelineAnimation.fromTo(
      timelineStage,
      { height: beforeHeight, overflow: "hidden" },
      {
        height: panel.getBoundingClientRect().height,
        duration: 0.35,
        ease: "power3.inOut",
        clearProps: "height,overflow",
      },
      0,
    );
  let arrival = 0.06;
  stops.forEach((stop, index) => {
    const dot = stop.querySelector(".career-node");
    const date = stop.querySelector(".career-date");
    const card = stop.querySelector(".career-card");
    timelineAnimation!.fromTo(
      dot,
      { opacity: 0, scale: 0.65 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.18,
        ease: "power2.out",
        clearProps: "opacity,transform",
      },
      arrival,
    );
    timelineAnimation!.fromTo(
      [date, card],
      { opacity: 0, x: 7 },
      {
        opacity: 1,
        x: 0,
        duration: 0.26,
        ease: "power2.out",
        clearProps: "opacity,transform",
      },
      arrival + 0.08,
    );
    if (index < stops.length - 1) {
      const segment = stop.querySelector(".career-segment");
      const run = Math.max(0.19, Math.min(0.3, stop.offsetHeight / 1000));
      timelineAnimation!.fromTo(
        segment,
        { scaleY: 0 },
        { scaleY: 1, duration: run, ease: "none", clearProps: "transform" },
        arrival + 0.13,
      );
      arrival += 0.13 + run - 0.035;
    }
  });
}
async function selectTimeline(kind: string) {
  if (kind === activeTimeline) return;
  const revision = ++timelineRevision;
  timelineVisited = true;
  timelineExit?.cancel();
  timelineAnimation?.progress(1).kill();
  activeTimeline = kind;
  timelineTabs.forEach((tab) => {
    const selected = tab.dataset.timeline === kind;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  gsap.to(timelineIndicator, {
    xPercent: kind === "education" ? 100 : 0,
    duration: duration(0.32),
    ease: "power3.inOut",
    overwrite: true,
  });
  const oldPanel = document.querySelector<HTMLElement>(
    ".timeline-panel:not([hidden])",
  )!;
  if (!reducedMotion.matches) {
    timelineExit = oldPanel.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 120,
      easing: "ease-out",
    });
    await timelineExit.finished.catch(() => {});
    if (revision !== timelineRevision) return;
  }
  const beforeHeight = timelineStage.getBoundingClientRect().height;
  document
    .querySelectorAll<HTMLElement>(".timeline-panel")
    .forEach((panel) => (panel.hidden = panel.id !== `panel-${kind}`));
  document.getElementById("journey-start")!.textContent =
    kind === "education" ? "2019" : "2023";
  sizeCareerSegments();
  revealPath(document.getElementById(`panel-${kind}`)!, beforeHeight);
}
timelineTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectTimeline(tab.dataset.timeline!));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? timelineTabs.length - 1
          : (index +
              (event.key === "ArrowRight" ? 1 : -1) +
              timelineTabs.length) %
            timelineTabs.length;
    timelineTabs[next].focus();
    selectTimeline(timelineTabs[next].dataset.timeline!);
  });
});
document.getElementById("panel-education")!.hidden = true;
document.querySelector<HTMLElement>(".timeline-tabs")!.hidden = false;
document.querySelector(".journey")!.classList.add("timeline-enhanced");
const timelineObserver = new IntersectionObserver(
  (entries) => {
    if (!timelineVisited && entries.some((entry) => entry.isIntersecting)) {
      timelineVisited = true;
      revealPath(document.getElementById("panel-experience")!);
      timelineObserver.disconnect();
    }
  },
  { threshold: 0.12 },
);
timelineObserver.observe(timelineStage);
reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) {
    timelineExit?.finish();
    timelineAnimation?.progress(1).kill();
    gsap.killTweensOf(timelineIndicator);
    gsap.set(timelineIndicator, {
      xPercent: activeTimeline === "education" ? 100 : 0,
    });
  }
});

// A native dialog supplies focus containment and Escape behavior. The shared screenshot
// carries the opening and closing movement; normal links remain the no-JavaScript path.
const dialog = document.querySelector<HTMLDialogElement>(".project-dialog")!;
const featureImage = document.querySelector<HTMLImageElement>("#feature-shot")!;
const detailImage = document.querySelector<HTMLImageElement>("#detail-shot")!;
let returnFocus: HTMLElement | null = null;
let returnScroll = 0;
let previousOverflow = "";
let ghost: HTMLImageElement | null = null;
let imageTween: gsap.core.Tween | null = null;
let closing = false;
let ownedHistoryEntry = false;
function clearImageTransition() {
  imageTween?.kill();
  imageTween = null;
  ghost?.remove();
  ghost = null;
  detailImage.style.visibility = "";
  featureImage.style.visibility = "";
}
function moveImage(from: DOMRect, to: DOMRect, complete: () => void) {
  clearImageTransition();
  if (
    reducedMotion.matches ||
    from.bottom < 0 ||
    from.top > innerHeight ||
    from.width === 0 ||
    to.bottom < 0 ||
    to.top > innerHeight
  ) {
    complete();
    return;
  }
  ghost = featureImage.cloneNode() as HTMLImageElement;
  ghost.removeAttribute("id");
  ghost.alt = "";
  ghost.setAttribute("aria-hidden", "true");
  ghost.className = "project-ghost";
  dialog.append(ghost);
  detailImage.style.visibility = "hidden";
  featureImage.style.visibility = "hidden";
  gsap.set(ghost, {
    left: to.left,
    top: to.top,
    width: to.width,
    height: to.height,
  });
  imageTween = gsap.fromTo(
    ghost,
    {
      x: from.left - to.left,
      y: from.top - to.top,
      scaleX: from.width / to.width,
      scaleY: from.height / to.height,
    },
    {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      duration: 0.42,
      ease: "power3.inOut",
      onComplete: () => {
        clearImageTransition();
        complete();
      },
    },
  );
}
function openProject(trigger: HTMLElement | null, push = true) {
  if (dialog.open) return;
  endDrag();
  closing = false;
  returnFocus = trigger;
  returnScroll = scrollY;
  const source = featureImage.getBoundingClientRect();
  previousOverflow = root.style.overflow;
  root.style.overflow = "hidden";
  dialog.showModal();
  dialog.scrollTop = 0;
  if (push) {
    history.pushState({ portfolioProject: true }, "", "#project-homelab");
    ownedHistoryEntry = true;
  }
  const target = detailImage.getBoundingClientRect();
  moveImage(source, target, () => {});
  gsap.fromTo(
    dialog.querySelector(".detail-heading"),
    { y: 8 },
    { y: 0, duration: duration(0.35), clearProps: "transform" },
  );
}
function finishClose() {
  clearImageTransition();
  dialog.close();
  root.style.overflow = previousOverflow;
  window.scrollTo({ top: returnScroll, behavior: "instant" });
  returnFocus?.focus({ preventScroll: true });
  closing = false;
  scheduleScroll();
}
function closeProject() {
  if (!dialog.open || closing) return;
  closing = true;
  clearImageTransition();
  const source = detailImage.getBoundingClientRect();
  const target = featureImage.getBoundingClientRect();
  moveImage(source, target, finishClose);
}
function requestClose() {
  if (closing) return;
  if (ownedHistoryEntry) {
    ownedHistoryEntry = false;
    history.back();
  } else {
    history.replaceState(
      history.state,
      "",
      location.pathname + location.search,
    );
    closeProject();
  }
}
document.querySelectorAll<HTMLAnchorElement>(".project-open").forEach((link) =>
  link.addEventListener("click", (event) => {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    openProject(link);
  }),
);
document
  .querySelectorAll(".close-project")
  .forEach((button) => button.addEventListener("click", requestClose));
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  requestClose();
});
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    requestClose();
});
window.addEventListener("popstate", () => {
  if (location.hash === "#project-homelab") {
    ownedHistoryEntry = !!history.state?.portfolioProject;
    if (closing) {
      clearImageTransition();
      closing = false;
    }
    openProject(null, false);
  } else {
    ownedHistoryEntry = false;
    closeProject();
  }
});
window.addEventListener("resize", () => {
  if (closing) finishClose();
  else clearImageTransition();
});
reducedMotion.addEventListener("change", () => {
  if (!reducedMotion.matches) return;
  filterAnimation?.progress(1).kill();
  if (closing) finishClose();
  else clearImageTransition();
});
if (location.hash === "#project-homelab") openProject(null, false);
// One restrained arrival, leaving the name and introduction readable from first paint.
if (!reducedMotion.matches)
  gsap.fromTo(
    ".feature-image",
    { y: 14 },
    { y: 0, duration: 0.5, ease: "power3.out", clearProps: "transform" },
  );
