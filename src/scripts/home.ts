import { scheduleScroll } from "./scroll-control";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import {
  applyGooFilter,
  dropletTransform,
  RETURN,
  PANEL_OPEN,
  springStep,
  svgAttribute,
  trackProximity,
} from "./fluid";
gsap.registerPlugin(Flip);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const duration = (seconds: number) => (reducedMotion.matches ? 0 : seconds);

const root = document.documentElement;

// Fast, interruptible index filtering; keep the complete tools list searchable.
const filters = document.querySelector<HTMLElement>(".filters")!;
const rows = [...document.querySelectorAll<HTMLElement>(".project-row")];
// Labels the earlier-work group while any of its projects remain visible.
const listDivider = document.querySelector<HTMLElement>("[data-list-divider]")!;
const earlierRows = rows.filter(
  (row) =>
    listDivider.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING,
);
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
const activeSearchFilters: { label: string; tool: boolean }[] = [];
const pillList = document.querySelector<HTMLElement>("#active-search-filters")!;
const resetButton =
  document.querySelector<HTMLButtonElement>("#reset-filters")!;
let activeFilter = "all";
// Category chips stay out of the way until asked for; a dot marks an active one.
const filterToggle =
  document.querySelector<HTMLButtonElement>(".filter-toggle")!;
const filterPanel = document.querySelector<HTMLElement>("#filter-panel")!;
const filterDot = filterToggle.querySelector<HTMLElement>(".filter-dot")!;
const filterState = filterToggle.querySelector<HTMLElement>(".filter-state")!;
function setFilterPanel(open: boolean) {
  filterPanel.hidden = !open;
  filterToggle.setAttribute("aria-expanded", String(open));
  if (open) requestAnimationFrame(() => updateFilterOverflow());
  scheduleScroll();
}
filterToggle.addEventListener("click", () =>
  setFilterPanel(filterPanel.hidden),
);
let filterAnimation: gsap.core.Timeline | null = null;
let restoringCollection = false;
// Filtering shrinks the list. Near the bottom of the page that would force the
// browser to pull the scroll position up, so the search box would jump. A spacer
// after the footer keeps the page tall enough for the search box to stay put,
// then gives the height back as the reader scrolls up.
const filterSpacer = document.createElement("div");
filterSpacer.className = "filter-spacer";
filterSpacer.setAttribute("aria-hidden", "true");
document.querySelector("#page-content")!.append(filterSpacer);
let spacerHeight = 0;
function setSpacer(height: number) {
  height = Math.max(0, Math.ceil(height));
  if (height === spacerHeight) return;
  spacerHeight = height;
  filterSpacer.style.height = `${height}px`;
  scheduleScroll();
}
function spacerNeeded() {
  const content = document.documentElement.scrollHeight - spacerHeight;
  return scrollY + innerHeight - content;
}
addEventListener(
  "scroll",
  () => {
    if (spacerHeight > 0 && spacerNeeded() < spacerHeight)
      setSpacer(spacerNeeded());
  },
  { passive: true },
);
function filterProjects() {
  filterAnimation?.progress(1).kill();
  const anchorTop = filters.getBoundingClientRect().top;
  const state =
    reducedMotion.matches || restoringCollection
      ? null
      : Flip.getState([...rows, listDivider]);
  const term = normalizeSearch(search.value.trim());
  resetButton.hidden =
    activeFilter === "all" && activeSearchFilters.length === 0 && !term;
  let total = 0;
  rows.forEach((row) => {
    const matches =
      (activeFilter === "all" ||
        row.dataset.facets!.split(" ").includes(activeFilter)) &&
      normalizeSearch(row.dataset.search!).includes(term) &&
      activeSearchFilters.every((filter) =>
        filter.tool
          ? (JSON.parse(row.dataset.tools!) as string[]).some(
              (tool) => normalizeSearch(tool) === normalizeSearch(filter.label),
            )
          : normalizeSearch(row.dataset.search!).includes(
              normalizeSearch(filter.label),
            ),
      );
    row.hidden = !matches;
    if (matches) total++;
  });
  listDivider.hidden = earlierRows.every((row) => row.hidden);
  // No recent work above it: drop the divider's rule and top spacing.
  listDivider.classList.toggle(
    "is-leading",
    rows.every((row) => row.hidden || earlierRows.includes(row)),
  );
  filterDot.hidden = activeFilter === "all";
  filterState.textContent =
    activeFilter === "all"
      ? ""
      : `, ${filterButtons.find((b) => b.dataset.filter === activeFilter)?.textContent?.trim()} selected`;
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
  if (!restoringCollection) {
    setSpacer(spacerNeeded());
    const drift = filters.getBoundingClientRect().top - anchorTop;
    if (Math.abs(drift) > 0.5) scrollBy({ top: drift, behavior: "instant" });
  }
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
let choosingSuggestion = false;
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
          !activeSearchFilters.some(
            (filter) => normalizeSearch(filter.label) === normalizeSearch(tool),
          ),
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
    let startX = 0,
      startY = 0;
    option.addEventListener("pointerdown", (event) => {
      choosingSuggestion = true;
      startX = event.clientX;
      startY = event.clientY;
      if (event.pointerType !== "touch") event.preventDefault();
    });
    option.addEventListener("pointerup", (event) => {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) >= 10) {
        choosingSuggestion = false;
        if (document.activeElement !== search) closeSuggestions();
      }
    });
    option.addEventListener("pointercancel", () => {
      choosingSuggestion = false;
      if (document.activeElement !== search) closeSuggestions();
    });
    // Keep the option mounted through touchend and blur until the actual click.
    // Removing it earlier can send the compatibility click to a project below it.
    option.addEventListener("click", (event) => {
      event.preventDefault();
      choosingSuggestion = false;
      addSearchFilter(tool);
    });
    suggestions.append(option);
  });
  suggestions.hidden = matches.length === 0;
  search.setAttribute("aria-expanded", String(matches.length > 0));
}
function renderSearchFilters() {
  pillList.replaceChildren();
  pillList.hidden = activeSearchFilters.length === 0;
  activeSearchFilters.forEach((filter, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-filter-pill";
    button.textContent = `${filter.label} ×`;
    button.setAttribute("aria-label", `Remove ${filter.label} filter`);
    button.addEventListener("click", () => {
      activeSearchFilters.splice(index, 1);
      renderSearchFilters();
      filterProjects();
      search.focus({ preventScroll: true });
    });
    pillList.append(button);
  });
}
function addSearchFilter(value: string) {
  const term = value.trim();
  if (!term) return;
  const tool = tools.find(
    (tool) => normalizeSearch(tool) === normalizeSearch(term),
  );
  const label = tool || term;
  if (
    !activeSearchFilters.some(
      (filter) => normalizeSearch(filter.label) === normalizeSearch(label),
    )
  ) {
    activeSearchFilters.push({ label, tool: Boolean(tool) });
  }
  search.value = "";
  closeSuggestions();
  renderSearchFilters();
  filterProjects();
}
function chooseSuggestion(index: number) {
  addSearchFilter(matches[index]);
}
search.addEventListener("input", showSuggestions);
search.addEventListener("focus", showSuggestions);
search.addEventListener("blur", () => {
  if (!choosingSuggestion) closeSuggestions();
});
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
  } else if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    if (!suggestions.hidden && activeSuggestion >= 0)
      chooseSuggestion(activeSuggestion);
    else addSearchFilter(search.value);
  }
});
function resetFilters() {
  activeSearchFilters.length = 0;
  renderSearchFilters();
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
const chipStrip = document.querySelector<HTMLElement>(".filter-chips")!;
const chipShell = document.querySelector<HTMLElement>(".filter-scroll-shell")!;
const moreFilters = document.querySelector<HTMLButtonElement>(
  ".filter-scroll-more",
)!;
function updateFilterOverflow() {
  const more =
    chipStrip.scrollWidth - chipStrip.clientWidth - chipStrip.scrollLeft > 2;
  moreFilters.hidden = !more;
  chipShell.classList.toggle("has-more", more);
}
chipStrip.addEventListener("scroll", updateFilterOverflow, { passive: true });
new ResizeObserver(updateFilterOverflow).observe(chipStrip);
moreFilters.addEventListener("click", () =>
  chipStrip.scrollBy({
    left: chipStrip.clientWidth * 0.7,
    behavior: reducedMotion.matches ? "instant" : "smooth",
  }),
);
updateFilterOverflow();

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
  });

// The two timelines share an animated selector and a continuous chronological spine.
const timelineTabs = [
  ...document.querySelectorAll<HTMLButtonElement>("[data-timeline]"),
];
const timelineIndicator = document.querySelector<HTMLElement>(
  ".timeline-tab-indicator",
)!;
// Connect card centers even when descriptions wrap to different heights.
function sizeCareerSegments() {
  const measurements = [
    ...document.querySelectorAll<HTMLElement>(".timeline-panel:not([hidden])"),
  ].flatMap((panel) => {
    const stops = [...panel.querySelectorAll<HTMLElement>(".career-stop")];
    const centers = stops.map((stop) => {
      const rect = stop
        .querySelector(".career-marker")!
        .getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
    return stops.slice(1).map((stop, index) => ({
      stop,
      length: centers[index + 1] - centers[index],
    }));
  });
  measurements.forEach(({ stop, length }) =>
    stop.style.setProperty("--segment-length", `${length}px`),
  );
}
const careerResizeObserver = new ResizeObserver(sizeCareerSegments);
document
  .querySelectorAll(".career-card")
  .forEach((card) => careerResizeObserver.observe(card));
sizeCareerSegments();
let activeTimeline = "experience";
const careerStops = [...document.querySelectorAll<HTMLElement>(".career-stop")];
const revealTimers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
let nextRevealAt = 0;
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const stop = entry.target as HTMLElement;
      if (
        !entry.isIntersecting ||
        stop.closest<HTMLElement>(".timeline-panel")!.hidden ||
        stop.classList.contains("is-revealed") ||
        stop.classList.contains("is-revealing")
      )
        continue;
      if (reducedMotion.matches) {
        stop.classList.add("is-revealed");
      } else {
        const delay = Math.max(0, nextRevealAt - performance.now());
        nextRevealAt = performance.now() + delay + 780;
        revealTimers.set(
          stop,
          setTimeout(() => {
            stop.classList.add("is-revealing");
            revealTimers.set(
              stop,
              setTimeout(() => {
                stop.classList.add("is-revealed");
                stop.classList.remove("is-revealing");
                revealTimers.delete(stop);
              }, 1200),
            );
          }, delay),
        );
      }
      revealObserver.unobserve(stop);
    }
  },
  { threshold: 0.15, rootMargin: "0px 0px -32px 0px" },
);
// Each panel's arrival plays once. Returning to a panel shows what already
// arrived; only stops that never revealed wait for the viewport.
function observeTimeline(panel: HTMLElement) {
  revealObserver.disconnect();
  nextRevealAt = 0;
  for (const stop of careerStops) {
    if (!stop.classList.contains("is-revealing")) continue;
    // Finish an arrival interrupted by a tab switch instead of replaying it.
    clearTimeout(revealTimers.get(stop));
    revealTimers.delete(stop);
    stop.classList.remove("is-revealing");
    stop.classList.add("is-revealed");
  }
  panel.querySelectorAll<HTMLElement>(".career-stop").forEach((stop) => {
    if (stop.classList.contains("is-revealed")) return;
    if (reducedMotion.matches) stop.classList.add("is-revealed");
    else if (!revealTimers.has(stop)) revealObserver.observe(stop);
  });
}
function selectTimeline(kind: string) {
  if (kind === activeTimeline) return;
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
  document.querySelectorAll<HTMLElement>(".timeline-panel").forEach((panel) => {
    const selected = panel.id === `panel-${kind}`;
    panel.hidden = !selected;
    panel.classList.toggle("is-active", selected);
  });
  observeTimeline(document.getElementById(`panel-${kind}`)!);
  sizeCareerSegments();
  scheduleScroll();
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
// Keyboard focus must never land on (or skip) cards still waiting to reveal.
document.querySelectorAll<HTMLElement>(".timeline-panel").forEach((panel) =>
  panel.addEventListener("focusin", () => {
    panel.querySelectorAll<HTMLElement>(".career-stop").forEach((stop) => {
      clearTimeout(revealTimers.get(stop));
      revealTimers.delete(stop);
      revealObserver.unobserve(stop);
      stop.classList.remove("is-revealing");
      stop.classList.add("is-revealed");
    });
  }),
);
document.getElementById("panel-education")!.hidden = true;
document.querySelector<HTMLElement>(".timeline-tabs")!.hidden = false;
document.querySelector(".journey")!.classList.add("timeline-enhanced");
observeTimeline(document.getElementById("panel-experience")!);
reducedMotion.addEventListener("change", () => {
  root.classList.toggle("timeline-motion", !reducedMotion.matches);
  observeTimeline(document.getElementById(`panel-${activeTimeline}`)!);
  gsap.killTweensOf(timelineIndicator);
  gsap.set(timelineIndicator, {
    xPercent: activeTimeline === "education" ? 100 : 0,
  });
});

reducedMotion.addEventListener("change", () => {
  if (reducedMotion.matches) filterAnimation?.progress(1).kill();
});

// Save the collection on its existing history entry. Returning can reuse the
// browser's cached document; this snapshot also covers a cache miss.
document.addEventListener("click", (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!link || link.target || link.hasAttribute("download")) return;
  const url = new URL(link.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/projects/"))
    return;
  history.replaceState(
    {
      ...history.state,
      collectionSnapshot: {
        scroll: scrollY,
        search: search.value,
        category: activeFilter,
        filters: activeSearchFilters,
      },
    },
    "",
  );
  try {
    sessionStorage.setItem(
      "portfolio-collection-departure",
      JSON.stringify({ path: url.pathname, at: Date.now() }),
    );
  } catch {}
});
const collectionSnapshot = history.state?.collectionSnapshot;
const navigation = performance.getEntriesByType("navigation")[0] as
  PerformanceNavigationTiming | undefined;
if (navigation?.type === "back_forward" && collectionSnapshot) {
  restoringCollection = true;
  search.value = collectionSnapshot.search;
  activeFilter = collectionSnapshot.category;
  activeSearchFilters.splice(
    0,
    activeSearchFilters.length,
    ...collectionSnapshot.filters,
  );
  filterButtons.forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.filter === activeFilter),
    ),
  );
  renderSearchFilters();
  if (activeFilter !== "all") setFilterPanel(true);
  filterProjects();
  restoringCollection = false;
  window.scrollTo({ top: collectionSnapshot.scroll, behavior: "instant" });
}

// Copy-email is an enhancement: mailto stays the primary path without JavaScript.
const copyButton = document.querySelector<HTMLButtonElement>(".copy-email");
if (copyButton && navigator.clipboard) {
  const label = copyButton.querySelector<HTMLElement>(".copy-label")!;
  const status = document.querySelector<HTMLElement>("#copy-status")!;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  copyButton.hidden = false;
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyButton.dataset.email!);
      label.textContent = "Copied";
      status.textContent = "Email address copied";
      copyButton.classList.add("is-copied");
    } catch {
      label.textContent = copyButton.dataset.email!;
      status.textContent = "Copy unavailable; the address is shown";
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      label.textContent = "Copy email";
      status.textContent = "";
      copyButton.classList.remove("is-copied");
    }, 2200);
  });
}

// The information surface opens above its icon without changing the card's layout.
document
  .querySelectorAll<HTMLDetailsElement>(".work-more")
  .forEach((details) => {
    const summary = details.querySelector<HTMLElement>("summary")!;
    const body = details.querySelector<HTMLElement>(".work-more-body")!;
    const ink = details.querySelector<SVGSVGElement>(".info-ink")!;
    const rect = ink.querySelector("rect")!;
    const orb = details.querySelector<SVGSVGElement>(".info-orb")!;
    const glyph = summary.querySelector<HTMLElement>(".more-closed")!;
    const panelGoo = applyGooFilter(ink, ink.querySelector("g")!);
    const orbGoo = applyGooFilter(orb, orb.querySelector("g")!);
    details.classList.add("info-enhanced");
    let expanded = false,
      frame = 0,
      last = 0,
      progress = 0,
      velocity = 0;
    let openWidth = 44,
      openHeight = 44;
    let approach = { x: 0, y: 0, strength: 0 };
    function paint(moving = false) {
      const p = Math.max(0, Math.min(1, progress));
      const remainder = 1 - p;
      ink.style.transform = `translate(${approach.x * remainder}px, ${approach.y * remainder}px) scale(${44 / openWidth + (1 - 44 / openWidth) * progress}, ${44 / openHeight + (1 - 44 / openHeight) * progress})`;
      ink.style.opacity = String(Math.min(1, p * 5));
      orb.style.transform = dropletTransform(approach);
      orb.style.opacity = String(Math.max(0, 1 - p * 4));
      glyph.style.transform = `translate(${approach.x}px, ${approach.y}px)`;
      body.style.opacity = String(Math.max(0, (p - 0.35) / 0.65));
      body.style.transform = `translateY(${remainder * 6}px) scale(${0.98 + p * 0.02})`;
      panelGoo.update(1.8 * Math.sin(Math.PI * p), moving, {
        x: -12,
        y: -12,
        width: openWidth + 24,
        height: openHeight + 24,
      });
    }
    const proximity = trackProximity(
      details.closest<HTMLElement>(".work-card")!,
      summary,
      (value, moving) => {
        approach = value;
        orbGoo.update(0.7 + value.strength * 0.5, moving, {
          x: -8,
          y: -8,
          width: 60,
          height: 60,
        });
        paint(Boolean(frame));
      },
      { reduced: reducedMotion, enabled: () => !expanded && !frame },
    );
    function availableWidth() {
      const parent = details.parentElement!,
        style = getComputedStyle(parent);
      return (
        parent.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight)
      );
    }
    // Measure once per transition or resize. Frames only write transforms/opacity.
    function measure() {
      openWidth = availableWidth();
      body.style.width = `${openWidth}px`;
      openHeight = Math.max(44, body.offsetHeight);
      ink.style.width = `${openWidth}px`;
      ink.style.height = `${openHeight}px`;
      svgAttribute(rect, "width", openWidth);
      svgAttribute(rect, "height", openHeight);
    }
    function tick(now: number) {
      const dt = (now - last) / 1000;
      last = now;
      const target = expanded ? 1 : 0;
      [progress, velocity] = springStep(
        progress,
        velocity,
        target,
        dt,
        expanded ? PANEL_OPEN : RETURN,
      );
      const settled =
        Math.abs(progress - target) < 0.001 && Math.abs(velocity) < 0.015;
      if (settled) {
        progress = target;
        velocity = 0;
        if (expanded) approach = { x: 0, y: 0, strength: 0 };
      }
      paint(!settled);
      if (!settled) frame = requestAnimationFrame(tick);
      else {
        frame = 0;
        if (!expanded) {
          details.open = false;
          proximity.reset();
        }
      }
    }
    function setExpanded(value: boolean, immediate = false) {
      if (value === expanded && !immediate) return;
      expanded = value;
      proximity.stop();
      details.classList.toggle("is-expanded", value);
      summary.setAttribute("aria-expanded", String(value));
      body.inert = !value;
      details.open = true;
      if (value) {
        measure();
        body.scrollTop = 0;
      }
      if (reducedMotion.matches || immediate) {
        cancelAnimationFrame(frame);
        frame = 0;
        progress = value ? 1 : 0;
        velocity = 0;
        paint();
        details.open = value;
        if (!value) proximity.reset();
      } else if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
    let leaveTimer: ReturnType<typeof setTimeout> | undefined;
    details.addEventListener("pointerenter", (event) => {
      if (
        event.pointerType !== "mouse" ||
        !matchMedia("(hover: hover)").matches
      )
        return;
      clearTimeout(leaveTimer);
      setExpanded(true);
    });
    details.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== "mouse") return;
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        if (
          !details.contains(document.activeElement) ||
          !document.activeElement?.matches(":focus-visible")
        )
          setExpanded(false);
      }, 160);
    });
    details.addEventListener("focusout", (event) => {
      if (!details.contains(event.relatedTarget as Node | null))
        setExpanded(false);
    });
    summary.setAttribute("aria-expanded", "false");
    body.inert = true;
    paint();
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      clearTimeout(leaveTimer);
      setExpanded(!expanded, (event as MouseEvent).detail === 0);
    });
    details.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !expanded) return;
      event.preventDefault();
      setExpanded(false, true);
      summary.focus({ preventScroll: true });
    });
    new ResizeObserver(() => {
      if (expanded && Math.abs(availableWidth() - openWidth) > 0.5) {
        measure();
        paint(Boolean(frame));
      }
    }).observe(details.parentElement!);
    document.fonts.ready.then(() => {
      if (expanded) {
        measure();
        paint(Boolean(frame));
      }
    });
    new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        clearTimeout(leaveTimer);
        setExpanded(false, true);
      }
    }).observe(details);
    reducedMotion.addEventListener("change", () => setExpanded(expanded, true));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        clearTimeout(leaveTimer);
        setExpanded(false, true);
      }
    });
  });
