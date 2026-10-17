import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { stripTypeScriptTypes } from "node:module";
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
    cells.filter((node) => attr(node, "title") === "Oct 12, 2026, 38 prompts")
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
    /38 prompts across 1 day in the last 53 weeks/,
  );
  assert.equal(
    find(
      page,
      (node) =>
        node.tagName === "summary" && text(node).trim() === "Daily counts",
    ).length,
    1,
  );
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

test("the empty placeholder hides activity and its CSS never reaches project or demo pages", () => {
  const data = JSON.parse(readFileSync("src/data/agent-activity.json", "utf8"));
  const home = readFileSync("dist/index.html", "utf8");
  if (!data.days.length) {
    assert.doesNotMatch(home, /<section[^>]*\sdata-activity(?:\s|>)/);
  } else {
    assert.match(home, /<section[^>]*\sdata-activity(?:\s|>)/);
  }
  assert.match(home, /--activity-bg/);
  for (const path of htmlFiles("dist/projects")) {
    const html = readFileSync(path, "utf8");
    assert.doesNotMatch(html, /--activity-bg/, path);
    for (const [, href] of html.matchAll(/href="(\/_astro\/[^\"]+\.css)"/g)) {
      assert.doesNotMatch(
        readFileSync(join("dist", href), "utf8"),
        /--activity-bg/,
        path,
      );
    }
  }
});
