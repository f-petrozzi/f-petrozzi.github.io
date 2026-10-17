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
    0,
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

test("the card-free grid keeps 11px squares and 3px gaps from 320 to 1440px", () => {
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
  assert.equal(
    base(".activity-chart", "grid-template-columns"),
    "repeat(var(--activity-weeks), 11px)",
  );
  assert.equal(base(".activity-chart", "gap"), "3px");
  // An implicit auto column takes its minimum width from the nowrap month
  // label. Its cells then overflow the 11px outer track and cover the gaps.
  assert.equal(
    base(".activity-week", "grid-template-columns"),
    "minmax(0, 1fr)",
  );
  assert.equal(
    base(".activity-week", "grid-template-rows"),
    "15px repeat(7, 11px)",
  );
  assert.equal(base(".activity-week", "gap"), "3px");
  assert.equal(base(".activity-week", "transform-origin"), undefined);
  assert.equal(base(".activity-band", "container-type"), "inline-size");
  assert.equal(base(".activity-band", "width"), "100%");
  assert.equal(base(".activity-band", "max-width"), "739px");
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
      requiredWidth: Number(rule.parent.params.match(/width < (\d+)px/)[1]),
      weeks: Number(
        rule.nodes.find((d) => d.prop === "--activity-weeks").value,
      ),
    }));
  assert.equal(crops.length, 3);
  let previousWeeks = 53;
  for (const { requiredWidth, weeks } of crops) {
    assert.equal(requiredWidth, previousWeeks * 14 - 3);
    const hidden = rules.find(
      (rule) =>
        rule.selector === `.activity-week:nth-child(-n + ${53 - weeks})`,
    );
    assert.equal(hidden.parent.name, "container");
    assert.equal(hidden.parent.params, `(width < ${requiredWidth}px)`);
    assert.equal(hidden.nodes.find((d) => d.prop === "display").value, "none");
    previousWeeks = weeks;
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
  // Check the track constraints at every CSS pixel. This is a geometry check,
  // not a substitute for the owner's rendered visual review.
  for (let viewport = 320; viewport <= 1440; viewport++) {
    const phone = viewport <= 767;
    const content =
      Math.min(1240, viewport) -
      (viewport <= 850 ? 56 : 60) -
      (phone ? 22 : 60);
    const width = Math.min(content, phone ? 361 : 739);
    const weeks = crops.reduce(
      (count, crop) => (width < crop.requiredWidth ? crop.weeks : count),
      53,
    );
    assert.ok(weeks * 11 + (weeks - 1) * 3 <= width, `${viewport}px overflows`);
    assert.equal(15 + 7 * 11 + 7 * 3, 113);
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
  band.contains = (target) => [cell, tip].includes(target);
  const cell = new Element();
  cell.dataset.tooltip = "Oct 12, 38 prompts";
  cell.getBoundingClientRect = () => ({ left: 286, top: 140, width: 11 });
  const tip = new Element();
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
    querySelector: (selector) => (selector === ".activity-band" ? band : tip),
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
    tip,
    label,
    document,
    motion,
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
  assert.equal(h.tip.style.left, "62px");
  assert.equal(h.tip.style.top, "41px");
  assert.ok(h.tip.attrs.has("data-open"));
  h.band.listeners.get("pointerout")({ relatedTarget: h.tip });
  assert.ok(h.tip.attrs.has("data-open"));
  h.document.listeners.get("keydown")({ key: "Escape" });
  assert.ok(!h.tip.attrs.has("data-open"));
  h.band.listeners.get("pointerover")({ target: h.cell });
  h.band.listeners.get("pointerout")({ relatedTarget: null });
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
