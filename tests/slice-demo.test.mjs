import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PERIODS,
  SALES_ITEMS,
  SAMPLE_MENU,
  analyze,
  classify,
  formatMenu,
  parseMenu,
  plotScale,
  sortRows,
} from "../src/data/demos/slice.ts";

test("the sample menu round-trips through the parser", () => {
  const result = parseMenu(formatMenu(SAMPLE_MENU));
  assert.equal(result.ok, true);
  assert.equal(result.menu.sections.length, SAMPLE_MENU.sections.length);
  assert.equal(
    result.itemCount,
    SAMPLE_MENU.sections.reduce(
      (sum, section) => sum + section.items.length,
      0,
    ),
  );
  assert.equal(result.menu.sections[0].description, "");
});

test("invalid JSON and wrong shapes return errors instead of throwing", () => {
  assert.match(parseMenu("{ nope").error, /^Invalid JSON/);
  assert.match(parseMenu("[]").error, /must be an object/);
  assert.match(parseMenu('{"sections":[]}').error, /empty/);
  assert.match(
    parseMenu('{"sections":[{"title":"A","items":[{"price":"$1"}]}]}').error,
    /sections\[0\]\.items\[0\]\.name/,
  );
  assert.match(
    parseMenu('{"sections":[{"title":"A","items":[{"name":"x","price":[]}]}]}')
      .error,
    /price/,
  );
});

test("numeric prices are formatted and optional fields default to empty", () => {
  const result = parseMenu(
    '{"sections":[{"title":" Pies ","items":[{"name":"Plain","price":9.5}]}]}',
  );
  assert.equal(result.ok, true);
  const item = result.menu.sections[0].items[0];
  assert.equal(result.menu.sections[0].title, "Pies");
  assert.equal(item.price, "$9.50");
  assert.equal(item.description, "");
  assert.equal(result.menu.note, "");
});

test("analysis is deterministic and internally consistent", () => {
  for (const period of PERIODS) {
    const a = analyze(period.id);
    assert.deepEqual(a, analyze(period.id));
    assert.equal(a.rows.length, SALES_ITEMS.length);
    const mixTotal = a.rows.reduce((sum, row) => sum + row.mix, 0);
    assert.ok(Math.abs(mixTotal - 1) < 1e-9);
    assert.equal(
      a.totals.units,
      a.rows.reduce((sum, row) => sum + row.units, 0),
    );
    assert.ok(
      Math.abs(a.thresholds.margin - a.totals.contribution / a.totals.units) <
        0.01,
    );
    assert.equal(a.thresholds.popularity, 0.7 / SALES_ITEMS.length);
    assert.equal(
      Object.values(a.counts).reduce((sum, n) => sum + n, 0),
      a.rows.length,
    );
    for (const key of ["star", "plowhorse", "puzzle", "dog"])
      assert.ok(a.counts[key] > 0, `${period.id} has ${key}`);
  }
});

test("longer periods sell more units, and periods differ", () => {
  const week = analyze("week");
  const quarter = analyze("quarter");
  assert.ok(quarter.totals.units > week.totals.units * 8);
  assert.notDeepEqual(
    week.rows.map((row) => row.units),
    quarter.rows.map((row) => row.units),
  );
});

test("quadrants follow the popularity and margin thresholds", () => {
  const t = { popularity: 0.05, margin: 8 };
  assert.equal(classify(0.06, 9, t), "star");
  assert.equal(classify(0.06, 5, t), "plowhorse");
  assert.equal(classify(0.02, 9, t), "puzzle");
  assert.equal(classify(0.02, 5, t), "dog");
  assert.equal(classify(0.05, 8, t), "star");
  const a = analyze("month");
  for (const row of a.rows)
    assert.equal(row.quadrant, classify(row.mix, row.margin, a.thresholds));
});

test("sorting is stable and respects direction", () => {
  const a = analyze("month");
  const byUnits = sortRows(a.rows, "units");
  assert.ok(byUnits[0].units >= byUnits[1].units);
  const byName = sortRows(a.rows, "name");
  assert.equal(byName[0].name, [...a.rows.map((r) => r.name)].sort()[0]);
  assert.equal(
    sortRows(a.rows, "units", false).at(0).units,
    Math.min(...a.rows.map((r) => r.units)),
  );
});

test("plot scale keeps every point and both thresholds inside the plot", () => {
  const plot = {
    width: 320,
    height: 280,
    pad: { top: 12, right: 14, bottom: 40, left: 46 },
  };
  for (const period of PERIODS) {
    const a = analyze(period.id);
    const scale = plotScale(a, plot);
    const points = [
      ...a.rows.map((row) => [scale.x(row.mix), scale.y(row.margin)]),
      [scale.x(a.thresholds.popularity), scale.y(a.thresholds.margin)],
    ];
    for (const [x, y] of points) {
      assert.ok(x >= plot.pad.left && x <= plot.width - plot.pad.right);
      assert.ok(y >= plot.pad.top && y <= plot.height - plot.pad.bottom);
    }
  }
});
