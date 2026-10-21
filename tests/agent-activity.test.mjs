import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { transform } from "@astrojs/compiler-rs";
import { experimental_AstroContainer } from "astro/container";
import { parseFragment } from "parse5";
import postcss from "postcss";
import {
  activityThresholds,
  activityLevel,
  activityGrid,
  localDate,
} from "../src/lib/agent-activity.ts";

test("nearest-rank quantiles ignore zero and distribute nonzero counts over four levels", () => {
  const thresholds = activityThresholds([0, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(thresholds, [2, 4, 6]);
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => activityLevel(n, thresholds)),
    [0, 1, 1, 2, 2, 3, 3, 4, 4],
  );
});

test("empty and sparse histories keep zero distinct and ties in the same level", () => {
  assert.deepEqual(activityThresholds([0, 0]), []);
  assert.equal(activityLevel(0, []), 0);
  assert.deepEqual(activityThresholds([5]), [5, 5, 5]);
  assert.equal(activityLevel(5, [5, 5, 5]), 1);
  const thresholds = activityThresholds([1, 1, 1, 1, 9, 9, 9, 9]);
  assert.equal(activityLevel(1, thresholds), 1);
  assert.equal(activityLevel(9, thresholds), 3);
});

test("all seven current weekdays fit 53 Sunday-start columns without future activity", () => {
  for (let weekday = 0; weekday < 7; weekday++) {
    const end = `2026-10-${11 + weekday}`;
    const grid = activityGrid([], end);
    assert.equal(grid.weeks.length, 53);
    assert.ok(grid.weeks.every((week) => week.length === 7));
    assert.equal(grid.days.length, 365 + weekday);
    assert.equal(grid.weeks[0][0].date, "2025-10-12");
    assert.equal(grid.weeks[52][weekday].date, end);
    assert.equal(
      grid.weeks.flat().filter((day) => day.future).length,
      6 - weekday,
    );
    assert.equal(new Set(grid.weeks.flat().map((day) => day.date)).size, 371);
    assert.ok(
      grid.weeks.every(
        (week) => new Date(`${week[0].date}T00:00:00Z`).getUTCDay() === 0,
      ),
    );
  }
});

test("visible totals and quantiles exclude old or future days and fill quiet days", () => {
  const grid = activityGrid(
    [
      { date: "2025-10-11", count: 10000 },
      { date: "2025-10-12", count: 2 },
      { date: "2026-10-16", count: 6 },
      { date: "2026-10-17", count: 10000 },
    ],
    "2026-10-16",
  );
  assert.equal(grid.total, 8);
  assert.equal(grid.activeDays, 2);
  assert.equal(grid.yearTotal, 6);
  assert.equal(grid.yearActiveDays, 1);
  assert.deepEqual(grid.thresholds, [2, 2, 6]);
  assert.equal(grid.weeks[0][0].count, 2);
  assert.equal(grid.weeks[0][1].count, 0);
  assert.equal(grid.weeks[52][6].count, 0);
});

test("calendar math crosses leap day and daylight saving without gaps", () => {
  const grid = activityGrid([], "2024-11-03");
  const dates = grid.days.map((day) => day.date);
  for (const date of [
    "2024-02-28",
    "2024-02-29",
    "2024-03-01",
    "2024-03-10",
    "2024-11-03",
  ])
    assert.ok(dates.includes(date));
  assert.equal(localDate("2026-10-13T03:59:59Z"), "2026-10-12");
  assert.equal(localDate("2026-10-13T04:00:00Z"), "2026-10-13");
  assert.equal(localDate("2026-03-08T06:59:00Z"), "2026-03-08");
  assert.equal(localDate("2026-03-08T07:00:00Z"), "2026-03-08");
});

test("activity styles have one inline root with a fixed five-level palette", () => {
  const source = readFileSync("src/components/ActivityGrid.astro", "utf8");
  const [, css] = source.match(/<style is:inline>([\s\S]*?)<\/style>/);
  const roots = postcss
    .parse(css)
    .nodes.filter((node) => node.type !== "comment");
  assert.equal(roots.length, 1);
  assert.equal(roots[0].selector, ".activity-grid");
  assert.doesNotMatch(
    css,
    /:global|data-theme|var\(--(?:bg|ink|muted|faint|accent|line)\b/,
  );
  assert.equal([...css.matchAll(/--activity-[0-4]:/g)].length, 5);
  assert.equal([...css.matchAll(/hsl\(196 /g)].length, 5);
});

async function renderActivity(data) {
  const { code } = await transform(
    readFileSync("src/components/ActivityGrid.astro", "utf8"),
    {
      filename: "src/components/ActivityGrid.astro",
      internalURL: "astro/compiler-runtime",
    },
  );
  // Substitute Vite's JSON glob and omit metadata that the production build
  // tree-shakes. The actual template runs without a browser or source mutation.
  const compiled = stripTypeScriptTypes(
    code.replace(
      /const exports = import\.meta\.glob[\s\S]*?;\s*(?=const source)/,
      `const exports = ${JSON.stringify(data ? { fixture: data } : {})};`,
    ),
  )
    .replace(/, createMetadata as \$\$createMetadata/, "")
    .replace(/export const \$\$metadata[\s\S]*?(?=const \$\$ActivityGrid)/, "")
    .replaceAll(
      '"astro/compiler-runtime"',
      JSON.stringify(import.meta.resolve("astro/compiler-runtime")),
    )
    .replaceAll(
      '"../lib/agent-activity"',
      JSON.stringify(
        pathToFileURL(join(process.cwd(), "src/lib/agent-activity.ts")).href,
      ),
    );
  const { default: Component } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
  );
  const container = await experimental_AstroContainer.create();
  return container.renderToString(Component);
}

function find(node, predicate) {
  return [
    ...(predicate(node) ? [node] : []),
    ...(node.childNodes ?? []).flatMap((child) => find(child, predicate)),
  ];
}
const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const text = (node) => node.value ?? (node.childNodes ?? []).map(text).join("");

test("server-rendered grid offers every value without hundreds of tab stops", async () => {
  // Invented counts exist in this test only, never in the source export or dist.
  const html = await renderActivity({
    schemaVersion: 1,
    generatedAt: "2026-10-16T16:00:00Z",
    timezone: "America/New_York",
    days: [{ date: "2026-10-12", count: 38 }],
  });
  const page = parseFragment(html);
  const [chart] = find(
    page,
    (node) => attr(node, "class") === "activity-chart",
  );
  assert.equal(attr(chart, "aria-hidden"), "true");
  assert.equal(
    find(chart, (node) => attr(node, "data-activity-column") !== undefined)
      .length,
    53,
  );
  const cells = find(chart, (node) => attr(node, "class") === "activity-cell");
  assert.equal(cells.length, 371);
  assert.equal(
    cells.filter((node) => attr(node, "data-future") !== undefined).length,
    1,
  );
  assert.equal(
    cells.filter((node) => attr(node, "data-tooltip") === "Oct 12, 38 prompts")
      .length,
    1,
  );
  assert.ok(cells.every((node) => attr(node, "tabindex") === undefined));
  const [summary] = find(
    page,
    (node) => attr(node, "id") === "activity-summary",
  );
  assert.match(
    text(summary).replace(/\s+/g, " "),
    /38 prompts across 1 day this year/,
  );
  assert.equal(
    find(
      page,
      (node) => node.tagName === "summary" || node.tagName === "details",
    ).length,
    0,
  );
  const [values] = find(
    page,
    (node) => attr(node, "class") === "activity-values",
  );
  assert.equal(find(values, (node) => node.tagName === "table").length, 1);
  assert.equal(
    find(page, (node) => attr(node, "tabindex") !== undefined).length,
    1,
  );
  assert.doesNotMatch(text(summary), /[:;—–]|daysin/);
  assert.equal(
    find(page, (node) => node.tagName === "tbody")[0].childNodes.filter(
      (node) => node.tagName === "tr",
    ).length,
    370,
  );
  assert.equal(
    find(page, (node) => node.tagName === "td" && text(node) === "38").length,
    1,
  );
});

test("missing exports and empty placeholders render no activity section", async () => {
  for (const data of [undefined, { days: [] }]) {
    const page = parseFragment(await renderActivity(data));
    assert.equal(find(page, (node) => node.tagName === "section").length, 0);
  }
});

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? htmlFiles(path)
      : path.endsWith(".html")
        ? [path]
        : [];
  });
}

test("activity CSS stays on the homepage and never reaches project or demo pages", () => {
  const home = readFileSync("dist/index.html", "utf8");
  assert.match(home, /--activity-0/);
  for (const path of htmlFiles("dist/projects")) {
    const html = readFileSync(path, "utf8");
    assert.doesNotMatch(html, /--activity-0/, path);
    for (const [, href] of html.matchAll(/href="(\/_astro\/[^\"]+\.css)"/g)) {
      assert.doesNotMatch(
        readFileSync(join("dist", href), "utf8"),
        /--activity-0/,
        path,
      );
    }
  }
});

test("the card-free grid fills its row with square cells and 3px gaps from 320 to 1440px", () => {
  const source = readFileSync("src/components/ActivityGrid.astro", "utf8");
  const [, css] = source.match(/<style is:inline>([\s\S]*?)<\/style>/);
  const parsed = postcss.parse(css);
  const rules = [];
  parsed.walkRules((rule) => rules.push(rule));
  const declarations = (selector) =>
    rules
      .filter((rule) => rule.selector === selector)
      .flatMap((rule) => rule.nodes.filter((node) => node.type === "decl"));
  const base = (selector, prop) =>
    declarations(selector).find((d) => d.prop === prop)?.value;
  // Columns share the band width, so cells grow with the layout instead of
  // leaving the chart condensed at one side.
  assert.equal(
    base(".activity-chart", "grid-template-columns"),
    "repeat(var(--activity-weeks), minmax(0, 1fr))",
  );
  assert.equal(base(".activity-chart", "gap"), "3px");
  // An implicit auto column takes its minimum width from the nowrap month
  // label. Its cells then overflow the outer track and cover the gaps.
  assert.equal(
    base(".activity-week", "grid-template-columns"),
    "minmax(0, 1fr)",
  );
  assert.equal(
    base(".activity-week", "grid-template-rows"),
    "16px repeat(7, auto)",
  );
  assert.equal(base(".activity-week", "gap"), "3px");
  assert.equal(base(".activity-week", "transform-origin"), undefined);
  assert.equal(base(".activity-band", "container-type"), "inline-size");
  assert.equal(base(".activity-band", "width"), "100%");
  assert.equal(base(".activity-band", "max-width"), undefined);
  assert.equal(base(".activity-grid", "--activity-weeks"), "53");
  assert.doesNotMatch(css, /overflow-x|min-width: (?!0)|scrollbar/);
  assert.equal(base(".activity-cell", "width"), "100%");
  assert.equal(base(".activity-cell", "aspect-ratio"), "1");
  assert.equal(base(".activity-values", "clip-path"), "inset(50%)");
  const crops = rules
    .filter(
      (rule) =>
        rule.selector === ".activity-chart" && rule.parent.name === "container",
    )
    .map((rule) => ({
      params: rule.parent.params,
      weeks: Number(
        rule.nodes.find((d) => d.prop === "--activity-weeks").value,
      ),
    }));
  assert.deepEqual(crops, [
    { params: "(width < 720px)", weeks: 36 },
    { params: "(width < 480px)", weeks: 26 },
    { params: "(width < 340px)", weeks: 18 },
  ]);
  for (const { params, weeks } of crops) {
    const hidden = rules.find(
      (rule) =>
        rule.selector === `.activity-week:nth-child(-n + ${53 - weeks})`,
    );
    assert.equal(hidden.parent.name, "container");
    assert.equal(hidden.parent.params, params);
    assert.equal(hidden.nodes.find((d) => d.prop === "display").value, "none");
  }
  for (const selector of [
    ".activity-grid",
    ".activity-band",
    ".activity-chart",
  ]) {
    assert.ok(
      !declarations(selector).some((d) =>
        /^(background|border|padding)/.test(d.prop),
      ),
      `${selector} has card chrome`,
    );
  }
  // Cells share the band width, so check they stay readable at every CSS
  // pixel. This is a geometry check, not a substitute for a rendered review.
  const limits = crops.map(({ params, weeks }) => ({
    below: Number(params.match(/width < (\d+)px/)[1]),
    weeks,
  }));
  for (let viewport = 320; viewport <= 1440; viewport++) {
    const phone = viewport <= 767;
    const content =
      Math.min(1240, viewport) -
      (viewport <= 850 ? 56 : 60) -
      (phone ? 22 : 60);
    // Desktop places the summary in a 150-200px column with a 40px gap.
    const band = phone
      ? content
      : content - Math.min(200, Math.max(150, content * 0.2)) - 40;
    const weeks = limits.reduce(
      (count, limit) => (band < limit.below ? limit.weeks : count),
      53,
    );
    const cell = (band - (weeks - 1) * 3) / weeks;
    assert.ok(cell >= 8, `${viewport}px cells shrink below 8px`);
    assert.ok(cell <= 24, `${viewport}px cells grow beyond 24px`);
  }
});

function activityHarness({ reduced = false } = {}) {
  const transformWrites = [];
  class Element {
    listeners = new Map();
    style = new Proxy(
      {},
      {
        set(target, property, value) {
          if (["transform", "scale", "translate"].includes(property))
            transformWrites.push({ property, value });
          target[property] = value;
          return true;
        },
      },
    );
    dataset = {};
    attrs = new Set();
    addEventListener(type, fn) {
      this.listeners.set(type, fn);
    }
    removeEventListener(type) {
      this.listeners.delete(type);
    }
    setAttribute(name) {
      this.attrs.add(name);
    }
    removeAttribute(name) {
      this.attrs.delete(name);
    }
    closest(selector) {
      return selector.includes("data-tooltip") ? this : null;
    }
  }
  const band = new Element();
  band.getBoundingClientRect = () => ({ left: 56, top: 100, width: 242 });
  band.setPointerCapture = (id) => {
    band.capturedPointer = id;
  };
  band.contains = (target) =>
    [band, cell, nearby, hidden, tip].includes(target);
  const cell = new Element();
  cell.dataset.tooltip = "Oct 12, 38 prompts";
  cell.getBoundingClientRect = () => ({
    left: 286,
    top: 140,
    width: 11,
    height: 11,
  });
  cell.getClientRects = () => [{}];
  const nearby = new Element();
  nearby.dataset.tooltip = "Oct 11, 12 prompts";
  nearby.getBoundingClientRect = () => ({
    left: 272,
    top: 140,
    width: 11,
    height: 11,
  });
  nearby.getClientRects = () => [{}];
  const hidden = new Element();
  hidden.dataset.tooltip = "Jan 1, 99 prompts";
  hidden.getBoundingClientRect = () => ({
    left: 300,
    top: 140,
    width: 11,
    height: 11,
  });
  hidden.getClientRects = () => [];
  band.querySelectorAll = () => [nearby, cell, hidden];
  const tip = new Element();
  tip.getBoundingClientRect = () => ({ width: 130 });
  const selection = new Element();
  const label = {};
  tip.querySelector = () => label;
  const motion = new Element();
  motion.matches = reduced;
  const hover = new Element();
  hover.matches = true;
  const document = new Element();
  const window = new Element();
  const animations = [];
  const columns = [true, false, true].map((visible) => {
    const column = new Element();
    column.cells = Array.from({ length: 7 }, () => new Element());
    column.querySelectorAll = () => column.cells;
    column.getClientRects = () => (visible ? [{}] : []);
    column.animate = (frames, options) => {
      const { promise, resolve, reject } = Promise.withResolvers();
      const animation = {
        frames,
        options,
        cancelled: false,
        finished: promise,
        finish: resolve,
        commitStyles() {
          Object.assign(column.style, frames.at(-1));
        },
        cancel() {
          this.cancelled = true;
          reject(new Error("Animation cancelled"));
        },
      };
      animations.push(animation);
      return animation;
    };
    return column;
  });
  const cells = columns.flatMap((column) => column.cells);
  const root = {
    querySelector: (selector) =>
      selector === ".activity-band"
        ? band
        : selector === "[data-activity-selection]"
          ? selection
          : tip,
    querySelectorAll: (selector) =>
      selector.includes("activity-cell") ? cells : columns,
  };
  document.querySelectorAll = () => [root];
  let observer;
  class IntersectionObserver {
    constructor(callback) {
      this.callback = callback;
      observer = this;
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  window.IntersectionObserver = IntersectionObserver;
  runInNewContext(
    stripTypeScriptTypes(readFileSync("src/scripts/agent-activity.ts", "utf8")),
    {
      document,
      window,
      Element,
      IntersectionObserver,
      matchMedia: (query) =>
        query.includes("reduced-motion") ? motion : hover,
    },
  );
  return {
    band,
    cell,
    nearby,
    hidden,
    selection,
    tip,
    label,
    document,
    window,
    motion,
    hover,
    animations,
    observer,
    columns,
    cells,
    transformWrites,
  };
}

test("hover tooltips stay within the chart and support hover persistence and Escape", () => {
  const h = activityHarness();
  h.band.listeners.get("pointerover")({ target: h.cell });
  assert.equal(h.label.textContent, "Oct 12, 38 prompts");
  assert.equal(h.tip.style.left, "112px");
  assert.equal(h.tip.style.top, "34px");
  assert.ok(h.tip.attrs.has("data-open"));
  h.band.listeners.get("pointerout")({ relatedTarget: h.tip });
  assert.ok(h.tip.attrs.has("data-open"));
  h.document.listeners.get("keydown")({ key: "Escape" });
  assert.ok(!h.tip.attrs.has("data-open"));
  h.band.listeners.get("pointerover")({ target: h.cell });
  h.band.listeners.get("pointerout")({ relatedTarget: null });
  assert.ok(!h.tip.attrs.has("data-open"));
});

function touch(h, type, x = 285, y = 145, overrides = {}) {
  h.band.listeners.get(type)({
    pointerType: "touch",
    pointerId: 7,
    isPrimary: true,
    clientX: x,
    clientY: y,
    target: h.band,
    ...overrides,
  });
}

test("touch selects the nearest day from a gap and keeps its readout after release", () => {
  const h = activityHarness();
  h.hover.matches = false;
  touch(h, "pointerdown");
  assert.equal(h.band.capturedPointer, 7);
  assert.equal(h.label.textContent, "Oct 12, 38 prompts");
  assert.equal(h.tip.style.top, "0px");
  assert.ok(h.cell.attrs.has("data-selected"));
  touch(h, "pointerup");
  h.band.listeners.get("pointerout")({ relatedTarget: null });
  assert.ok(h.tip.attrs.has("data-open"));
  assert.equal(h.selection.textContent, "Oct 12, 38 prompts");
  h.document.listeners.get("pointerdown")({ target: new Object() });
  assert.ok(!h.tip.attrs.has("data-open"));
  assert.ok(!h.cell.attrs.has("data-selected"));
});

test("touch scrubbing changes days, ignores secondary pointers and excludes hidden weeks", () => {
  const h = activityHarness();
  touch(h, "pointerdown", 300);
  assert.equal(h.label.textContent, "Oct 12, 38 prompts");
  touch(h, "pointermove", 277, 145, { pointerId: 8 });
  assert.equal(h.label.textContent, "Oct 12, 38 prompts");
  touch(h, "pointermove", 277);
  assert.equal(h.label.textContent, "Oct 11, 12 prompts");
  assert.ok(!h.cell.attrs.has("data-selected"));
  assert.ok(h.nearby.attrs.has("data-selected"));
  touch(h, "pointercancel", 277);
  assert.ok(!h.tip.attrs.has("data-open"));
  touch(h, "pointermove");
  assert.ok(!h.tip.attrs.has("data-open"));
});

test("touch works on hybrid devices and scrolling clears the selection", () => {
  const h = activityHarness();
  assert.equal(h.hover.matches, true);
  touch(h, "pointerdown");
  touch(h, "pointerup");
  h.window.listeners.get("scroll")();
  assert.ok(!h.tip.attrs.has("data-open"));
  assert.equal(h.selection.textContent, "");
});

test("mouse and non-primary presses do not start touch selection", () => {
  const h = activityHarness();
  touch(h, "pointerdown", 285, 145, { pointerType: "mouse" });
  assert.ok(!h.tip.attrs.has("data-open"));
  touch(h, "pointerdown", 285, 145, { isPrimary: false });
  assert.ok(!h.tip.attrs.has("data-open"));
});

test("one keyboard target exposes the latest count and supports day and endpoint navigation", () => {
  const h = activityHarness();
  h.band.listeners.get("focus")();
  assert.equal(h.label.textContent, "Oct 12, 38 prompts");
  let prevented = 0;
  const press = (key) =>
    h.band.listeners.get("keydown")({
      key,
      preventDefault: () => {
        prevented++;
      },
    });
  press("Home");
  assert.equal(h.selection.textContent, "Oct 11, 12 prompts");
  press("ArrowDown");
  assert.equal(h.selection.textContent, "Oct 12, 38 prompts");
  press("End");
  assert.equal(h.selection.textContent, "Oct 12, 38 prompts");
  assert.equal(prevented, 3);
  h.band.listeners.get("blur")();
  assert.ok(!h.tip.attrs.has("data-open"));
});

test("entrance animates visible columns once and cancels when scrolled away", () => {
  const h = activityHarness();
  h.observer.callback([{ isIntersecting: true }]);
  assert.equal(h.animations.length, 2);
  assert.deepEqual(
    h.animations.map((a) => a.options.delay),
    [0, 3],
  );
  for (const animation of h.animations) {
    for (const frame of animation.frames) {
      assert.deepEqual(Object.keys(frame), ["opacity", "transform"]);
      assert.match(frame.transform, /^translateY\((?:3px|0)\)$/);
    }
    assert.ok(animation.options.duration <= 200);
  }
  h.observer.callback([{ isIntersecting: true }]);
  assert.equal(h.animations.length, 2);
  h.observer.callback([{ isIntersecting: false }]);
  assert.ok(h.animations.every((a) => a.cancelled));
  assert.ok(h.observer.disconnected);
});

function assertNoInlineTransforms(h) {
  assert.deepEqual(h.transformWrites, []);
  for (const element of [...h.columns, ...h.cells]) {
    for (const property of ["transform", "scale", "translate"])
      assert.ok(!element.style[property]);
  }
}

test("completed entrance clears every animation and leaves no inline week or cell transforms", async () => {
  const h = activityHarness();
  h.observer.callback([{ isIntersecting: true }]);
  h.animations.forEach((animation) => animation.finish());
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(h.animations.every((animation) => animation.cancelled));
  assert.ok(h.observer.disconnected);
  assert.ok(!h.motion.listeners.has("change"));
  assertNoInlineTransforms(h);
});

test("reduced motion skips entrance or cancels an entrance already in progress", () => {
  const reduced = activityHarness({ reduced: true });
  assert.equal(reduced.observer, undefined);
  assert.deepEqual(reduced.animations, []);
  assertNoInlineTransforms(reduced);
  const h = activityHarness();
  h.observer.callback([{ isIntersecting: true }]);
  h.motion.matches = true;
  h.motion.listeners.get("change")();
  assert.ok(h.animations.every((a) => a.cancelled));
  assert.ok(h.observer.disconnected);
  assertNoInlineTransforms(h);
});
