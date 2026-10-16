import {
  QUADRANTS,
  SAMPLE_MENU,
  analyze,
  formatMenu,
  money,
  parseMenu,
  percent,
  plotScale,
  sortRows,
  type Analysis,
  type AnalysisRow,
  type Menu,
  type PeriodId,
  type PlotScale,
  type Quadrant,
  type SortKey,
} from "../../data/demos/slice";

const SVG_NS = "http://www.w3.org/2000/svg";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, String(value));
  return node;
}

const singular = (quadrant: Quadrant) =>
  QUADRANTS.find((entry) => entry.id === quadrant)!.label.slice(0, -1);

/* Marker outlines, centred on the origin, one shape per quadrant so the
   class never depends on color alone. */
function markerPath(quadrant: Quadrant, r: number): string {
  if (quadrant === "star")
    return `M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  if (quadrant === "plowhorse")
    return `M${-r} ${-r}h${2 * r}v${2 * r}h${-2 * r}Z`;
  if (quadrant === "puzzle") {
    const d = r * 1.3;
    return `M0 ${-d}L${d} 0L0 ${d}L${-d} 0Z`;
  }
  const d = r * 1.2;
  return `M0 ${-d}L${d} ${d * 0.8}H${-d}Z`;
}

function init(root: HTMLElement) {
  const q = <T extends Element>(selector: string) =>
    root.querySelector<T>(selector)!;
  const qa = <T extends Element>(selector: string) => [
    ...root.querySelectorAll<T>(selector),
  ];

  /* ---------- View switch ---------- */
  const viewButtons = qa<HTMLButtonElement>("[data-view]");
  const panels = qa<HTMLElement>("[data-panel]");
  function showView(name: string) {
    viewButtons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.view === name)),
    );
    panels.forEach((panel) => (panel.hidden = panel.dataset.panel !== name));
    if (name === "analysis") drawChart();
  }
  viewButtons.forEach((button) =>
    button.addEventListener("click", () => showView(button.dataset.view!)),
  );

  /* ---------- Menu as data ---------- */
  const editor = q<HTMLTextAreaElement>("[data-editor]");
  const status = q<HTMLElement>("[data-status]");
  const site = q<HTMLElement>("[data-site]");
  const siteNote = q<HTMLElement>("[data-site-note]");
  const siteTabs = q<HTMLElement>("[data-site-tabs]");
  const siteBody = q<HTMLElement>("[data-site-body]");
  const stale = q<HTMLElement>("[data-stale]");
  let parseTimer: ReturnType<typeof setTimeout> | undefined;

  function renderMenu(menu: Menu) {
    siteNote.textContent = menu.note;
    siteNote.hidden = !menu.note;
    siteTabs.replaceChildren();
    siteBody.replaceChildren();
    menu.sections.forEach((section, index) => {
      const tab = h("button", "sl-tab", section.title);
      tab.type = "button";
      tab.setAttribute("aria-pressed", String(index === 0));
      const block = h("section", "sl-section");
      block.append(h("h3", "sl-section-title", section.title));
      if (section.description)
        block.append(h("p", "sl-section-note", section.description));
      const list = h("div", "sl-items");
      section.items.forEach((item) => {
        const entry = h("article", "sl-item");
        const head = h("div", "sl-item-head");
        head.append(h("h4", "", item.name));
        if (item.price) head.append(h("span", "", item.price));
        entry.append(head);
        if (item.description) entry.append(h("p", "", item.description));
        list.append(entry);
      });
      block.append(list);
      siteBody.append(block);
      tab.addEventListener("click", () => {
        siteTabs
          .querySelectorAll("button")
          .forEach((other) =>
            other.setAttribute("aria-pressed", String(other === tab)),
          );
        const top =
          block.getBoundingClientRect().top -
          siteBody.getBoundingClientRect().top +
          siteBody.scrollTop;
        siteBody.scrollTo({
          top,
          behavior: reduceMotion.matches ? "auto" : "smooth",
        });
      });
      siteTabs.append(tab);
    });
    siteBody.scrollTop = 0;
  }

  function applyEditor() {
    const result = parseMenu(editor.value);
    if (result.ok) {
      renderMenu(result.menu);
      status.className = "sl-status";
      status.textContent = `${result.itemCount} items in ${result.menu.sections.length} sections`;
      status.removeAttribute("role");
      editor.removeAttribute("aria-invalid");
      site.classList.remove("is-stale");
      stale.hidden = true;
    } else {
      status.className = "sl-status is-error";
      status.textContent = result.error;
      status.setAttribute("role", "alert");
      editor.setAttribute("aria-invalid", "true");
      site.classList.add("is-stale");
      stale.hidden = false;
    }
  }
  editor.addEventListener("input", () => {
    clearTimeout(parseTimer);
    parseTimer = setTimeout(applyEditor, 140);
  });

  /* ---------- Menu analysis ---------- */
  let period: PeriodId = "month";
  let sort: { key: SortKey; descending: boolean } = {
    key: "contribution",
    descending: true,
  };
  let selectedId = "";
  let focusQuadrant: Quadrant | null = null;
  let analysis: Analysis = analyze(period);
  let scale: PlotScale | null = null;
  let drawnWidth = 0;
  const plotBox = q<HTMLElement>("[data-plot]");
  const tbody = q<HTMLElement>("[data-rows]");
  const detail = q<HTMLElement>("[data-detail]");
  const thresholds = q<HTMLElement>("[data-thresholds]");
  const periodButtons = qa<HTMLButtonElement>("[data-period]");
  const legendButtons = qa<HTMLButtonElement>("[data-quadrant]");
  const sortButtons = qa<HTMLButtonElement>("[data-sort]");
  const pointRefs = new Map<string, SVGGElement>();
  const rowRefs = new Map<string, HTMLTableRowElement>();
  let label: SVGTextElement | null = null;
  let chart: SVGSVGElement | null = null;

  qa<SVGPathElement>("[data-glyph]").forEach((path) => {
    const quadrant = path.dataset.glyph as Quadrant;
    path.setAttribute("d", markerPath(quadrant, 5));
  });

  function topId(): string {
    return sortRows(analysis.rows, "contribution")[0].id;
  }

  function rowById(id: string): AnalysisRow | undefined {
    return analysis.rows.find((row) => row.id === id);
  }

  function placeLabel() {
    const row = rowById(selectedId);
    if (!label || !scale || !row) return;
    const x = scale.x(row.mix);
    const y = scale.y(row.margin);
    label.textContent = row.name;
    const flip = x > drawnWidth * 0.58;
    label.setAttribute("text-anchor", flip ? "end" : "start");
    label.setAttribute("x", String(x + (flip ? -11 : 11)));
    label.setAttribute("y", String(y < 30 ? y + 20 : y - 11));
  }

  function select(id: string, scrollRow = false) {
    const row = rowById(id);
    if (!row) return;
    selectedId = id;
    pointRefs.forEach((node, key) => {
      const on = key === id;
      node.classList.toggle("is-selected", on);
      node.setAttribute("aria-pressed", String(on));
    });
    rowRefs.forEach((node, key) => {
      const on = key === id;
      node.classList.toggle("is-selected", on);
      node.querySelector("button")!.setAttribute("aria-pressed", String(on));
    });
    if (scrollRow) {
      const node = rowRefs.get(id);
      const box = node?.closest<HTMLElement>("[data-table-scroll]");
      if (node && box) {
        const head = box.querySelector("thead")?.getBoundingClientRect();
        const top =
          node.getBoundingClientRect().top - box.getBoundingClientRect().top;
        if (
          top < (head?.height ?? 0) ||
          top + node.offsetHeight > box.clientHeight
        )
          box.scrollTop += top - (head?.height ?? 0) - 8;
      }
    }
    detail.textContent = `${row.name}, ${singular(row.quadrant)}. ${percent(row.mix)} of units, ${money(row.margin)} margin per unit, ${money(row.contribution)} contribution.`;
    placeLabel();
  }

  function drawChart() {
    const width = Math.round(plotBox.clientWidth);
    if (width < 120) return;
    drawnWidth = width;
    const height = Math.min(400, Math.max(280, Math.round(width * 0.78)));
    const pad = { top: 12, right: 14, bottom: 40, left: 46 };
    const plot = { width, height, pad };
    scale = plotScale(analysis, plot);
    const sc = scale;
    const left = pad.left;
    const right = width - pad.right;
    const top = pad.top;
    const bottom = height - pad.bottom;
    const tx = sc.x(analysis.thresholds.popularity);
    const ty = sc.y(analysis.thresholds.margin);

    const svg = s("svg", {
      class: "sl-chart",
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "group",
      "aria-label": "Menu engineering matrix: popularity against margin",
    });
    if (focusQuadrant) svg.dataset.focus = focusQuadrant;

    const bands: [Quadrant, number, number, number, number][] = [
      ["puzzle", left, top, tx - left, ty - top],
      ["star", tx, top, right - tx, ty - top],
      ["dog", left, ty, tx - left, bottom - ty],
      ["plowhorse", tx, ty, right - tx, bottom - ty],
    ];
    bands.forEach(([quadrant, x, y, w, hh]) =>
      svg.append(
        s("rect", {
          class: `sl-band is-${quadrant}`,
          x,
          y,
          width: Math.max(0, w),
          height: Math.max(0, hh),
        }),
      ),
    );

    for (let t = 0; t <= sc.xMax + 1e-9; t += 0.02) {
      const x = sc.x(t);
      svg.append(
        s("line", { class: "sl-grid", x1: x, x2: x, y1: top, y2: bottom }),
      );
      const tick = s("text", {
        class: "sl-tick",
        x,
        y: bottom + 16,
        "text-anchor": "middle",
      });
      tick.textContent = `${Math.round(t * 100)}%`;
      svg.append(tick);
    }
    for (let t = 0; t <= sc.yMax + 1e-9; t += 4) {
      const y = sc.y(t);
      svg.append(
        s("line", { class: "sl-grid", x1: left, x2: right, y1: y, y2: y }),
      );
      const tick = s("text", {
        class: "sl-tick",
        x: left - 8,
        y: y + 4,
        "text-anchor": "end",
      });
      tick.textContent = `$${t}`;
      svg.append(tick);
    }
    const xTitle = s("text", {
      class: "sl-axis-title",
      x: (left + right) / 2,
      y: height - 6,
      "text-anchor": "middle",
    });
    xTitle.textContent = "Share of units sold";
    const yTitle = s("text", {
      class: "sl-axis-title",
      transform: `translate(11 ${(top + bottom) / 2}) rotate(-90)`,
      "text-anchor": "middle",
    });
    yTitle.textContent = "Margin per unit";
    svg.append(xTitle, yTitle);

    svg.append(
      s("line", { class: "sl-threshold", x1: tx, x2: tx, y1: top, y2: bottom }),
      s("line", { class: "sl-threshold", x1: left, x2: right, y1: ty, y2: ty }),
    );

    const corners: [Quadrant, number, number, string][] = [
      ["puzzle", left + 8, top + 15, "start"],
      ["star", right - 8, top + 15, "end"],
      ["dog", left + 8, bottom - 8, "start"],
      ["plowhorse", right - 8, bottom - 8, "end"],
    ];
    corners.forEach(([quadrant, x, y, anchor]) => {
      const text = s("text", {
        class: `sl-corner is-${quadrant}`,
        x,
        y,
        "text-anchor": anchor,
      });
      text.textContent = QUADRANTS.find(
        (entry) => entry.id === quadrant,
      )!.label;
      svg.append(text);
    });

    pointRefs.clear();
    const points = s("g");
    analysis.rows.forEach((row) => {
      const g = s("g", {
        class: `sl-point is-${row.quadrant}`,
        transform: `translate(${sc.x(row.mix)} ${sc.y(row.margin)})`,
        tabindex: 0,
        role: "button",
        "aria-pressed": "false",
        "aria-label": `${row.name}, ${singular(row.quadrant)}, ${percent(row.mix)} of units, ${money(row.margin)} margin`,
      });
      g.append(
        s("circle", { class: "sl-hit", r: 16 }),
        s("circle", { class: "sl-ring", r: 12 }),
        s("path", { class: "sl-mark", d: markerPath(row.quadrant, 6.5) }),
      );
      g.addEventListener("click", () => select(row.id, true));
      g.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select(row.id, true);
        }
      });
      g.addEventListener("pointerenter", (event) => {
        if (event.pointerType === "mouse" && selectedId !== row.id)
          select(row.id);
      });
      g.addEventListener("focus", () => {
        if (selectedId !== row.id) select(row.id);
      });
      pointRefs.set(row.id, g);
      points.append(g);
    });
    label = s("text", { class: "sl-label" });
    svg.append(points, label);
    plotBox.replaceChildren(svg);
    chart = svg;
    if (!rowById(selectedId)) selectedId = topId();
    select(selectedId);
  }

  function drawTable() {
    rowRefs.clear();
    const rows = sortRows(analysis.rows, sort.key, sort.descending);
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => {
      const tr = h("tr");
      tr.dataset.quadrant = row.quadrant;
      const name = h("td", "sl-name");
      const button = h("button", "", row.name);
      button.type = "button";
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => select(row.id));
      name.append(button, h("small", "", row.category));
      const tag = h("td", "sl-class");
      const glyph = s("svg", {
        class: `sl-glyph is-${row.quadrant}`,
        viewBox: "-8 -8 16 16",
        "aria-hidden": "true",
      });
      glyph.append(s("path", { d: markerPath(row.quadrant, 5) }));
      tag.append(glyph, document.createTextNode(singular(row.quadrant)));
      tr.append(
        name,
        h("td", "sl-num", row.units.toLocaleString("en-US")),
        h("td", "sl-num", money(row.margin)),
        h("td", "sl-num", money(row.contribution)),
        tag,
      );
      rowRefs.set(row.id, tr);
      fragment.append(tr);
    });
    tbody.replaceChildren(fragment);
    sortButtons.forEach((button) => {
      const th = button.closest("th")!;
      const active = button.dataset.sort === sort.key;
      th.setAttribute(
        "aria-sort",
        active ? (sort.descending ? "descending" : "ascending") : "none",
      );
    });
  }

  function drawSummary() {
    q("[data-total-units]").textContent =
      analysis.totals.units.toLocaleString("en-US");
    q("[data-total-revenue]").textContent = money(
      analysis.totals.revenue,
    ).replace(/\.\d\d$/, "");
    q("[data-total-contribution]").textContent = money(
      analysis.totals.contribution,
    ).replace(/\.\d\d$/, "");
    legendButtons.forEach((button) => {
      button.querySelector("[data-count]")!.textContent = String(
        analysis.counts[button.dataset.quadrant as Quadrant],
      );
    });
    thresholds.textContent = `Popular from ${percent(analysis.thresholds.popularity)} of units. High margin from ${money(analysis.thresholds.margin)} per unit.`;
  }

  function setPeriod(next: PeriodId) {
    period = next;
    analysis = analyze(period);
    periodButtons.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.period === next),
      ),
    );
    drawSummary();
    drawTable();
    drawChart();
  }
  periodButtons.forEach((button) =>
    button.addEventListener("click", () =>
      setPeriod(button.dataset.period as PeriodId),
    ),
  );

  legendButtons.forEach((button) =>
    button.addEventListener("click", () => {
      const next = button.dataset.quadrant as Quadrant;
      focusQuadrant = focusQuadrant === next ? null : next;
      legendButtons.forEach((other) =>
        other.setAttribute(
          "aria-pressed",
          String(other.dataset.quadrant === focusQuadrant),
        ),
      );
      if (chart) {
        if (focusQuadrant) chart.dataset.focus = focusQuadrant;
        else delete chart.dataset.focus;
      }
      tbody.dataset.focus = focusQuadrant ?? "";
    }),
  );

  sortButtons.forEach((button) =>
    button.addEventListener("click", () => {
      const key = button.dataset.sort as SortKey;
      sort =
        sort.key === key
          ? { key, descending: !sort.descending }
          : { key, descending: key !== "name" };
      drawTable();
      select(selectedId);
    }),
  );

  if (typeof ResizeObserver === "function")
    new ResizeObserver(() => {
      if (!panels.find((p) => p.dataset.panel === "analysis")!.hidden)
        if (Math.abs(plotBox.clientWidth - drawnWidth) > 1) drawChart();
    }).observe(plotBox);

  /* ---------- Reset ---------- */
  function reset() {
    clearTimeout(parseTimer);
    editor.value = formatMenu(SAMPLE_MENU);
    applyEditor();
    focusQuadrant = null;
    legendButtons.forEach((button) =>
      button.setAttribute("aria-pressed", "false"),
    );
    tbody.dataset.focus = "";
    sort = { key: "contribution", descending: true };
    selectedId = "";
    period = "month";
    setPeriod("month");
    showView("menu");
  }
  q("[data-reset]").addEventListener("click", reset);

  reset();
}

document.querySelectorAll<HTMLElement>('[data-demo="slice"]').forEach(init);
