import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RAW_ROWS,
  cleanAll,
  cleanRow,
  cleanText,
  createState,
  deleteReview,
  importCleaned,
  importSql,
  insertReview,
  parseDate,
  parseRating,
  productStats,
  selectReviews,
  sqlString,
  updateReview,
} from "../src/data/demos/product-reviews-analysis.ts";

const input = {
  product_id: 3,
  reviewer: "Test User",
  rating: 4,
  review_text: "Solid panel.",
  review_date: "2025-03-20",
};

test("cleanText decodes entities, fixes punctuation and strips emoji", () => {
  const out = cleanText("  Good value &amp; “sharp” – nice 👍\n\n ok… ");
  assert.equal(out.value, 'Good value & "sharp" - nice ok...');
  assert.deepEqual(
    new Set(out.changes),
    new Set(["entities", "punctuation", "whitespace", "emoji"]),
  );
  assert.deepEqual(cleanText("Already clean.").changes, []);
  assert.equal(cleanText("x".repeat(600)).value.length, 500);
});

test("dates in several formats normalise to ISO and bad dates are rejected", () => {
  for (const [raw, expected] of [
    ["3/7/2025", "2025-03-07"],
    ["2025.03.09", "2025-03-09"],
    ["Mar 12, 2025", "2025-03-12"],
    ["14th March 2025", "2025-03-14"],
    ["15 Mar 2025", "2025-03-15"],
    ["2025-03-16", "2025-03-16"],
  ])
    assert.equal(parseDate(raw), expected, raw);
  assert.equal(parseDate("13/45/2025"), null);
  assert.equal(parseDate("2/30/2025"), null);
  assert.equal(parseDate("someday"), null);
});

test("ratings are read from messy strings", () => {
  assert.equal(parseRating("5 stars"), 5);
  assert.equal(parseRating("3.0"), 3);
  assert.equal(parseRating("2 / 5"), 2);
  assert.equal(parseRating("9"), null);
  assert.equal(parseRating("great"), null);
});

test("the raw batch cleans to five importable rows and one rejected row", () => {
  const results = cleanAll();
  assert.equal(results.length, RAW_ROWS.length);
  assert.equal(results.filter((r) => r.ok).length, 5);
  const bad = results.find((r) => !r.ok);
  assert.equal(bad.error, "Date not recognised");
  const first = results[0].row;
  assert.deepEqual(first, {
    product_id: 1,
    reviewer: "jess_m",
    rating: 5,
    review_text: "Colors are GREAT!! Setup took 2 min...",
    review_date: "2025-03-07",
  });
  assert.ok(results[0].changes.review_text && results[0].changes.review_date);
  assert.equal(
    cleanRow({ ...RAW_ROWS[0], product_id: "99" }).error,
    "Unknown product",
  );
});

test("SQL strings escape quotes", () => {
  assert.equal(sqlString("O'Connell"), "'O''Connell'");
  const sql = importSql(
    cleanAll()
      .filter((r) => r.ok)
      .map((r) => r.row),
  );
  assert.match(sql, /'S\. O''Connell'/);
  assert.equal((sql.match(/^\s+\(/gm) ?? []).length, 5);
});

test("importing adds the clean rows once and updates the stats", () => {
  const state = createState();
  const before = state.reviews.length;
  const write = importCleaned(state);
  assert.ok(write.ok);
  assert.equal(write.ids.length, 5);
  assert.equal(state.reviews.length, before + 5);
  assert.match(write.sql, /^INSERT INTO reviews/);
  assert.equal(importCleaned(state).ok, false);
  assert.equal(state.reviews.length, before + 5);
});

test("select joins products and filters by product and rating", () => {
  const state = createState();
  const all = selectReviews(state);
  assert.equal(all.rows.length, 14);
  assert.match(all.sql, /JOIN products p ON p\.product_id = r\.product_id/);
  assert.ok(!all.sql.includes("WHERE"));
  const dates = all.rows.map((r) => r.review_date);
  assert.deepEqual(dates, [...dates].sort().reverse());

  const monitor = selectReviews(state, { productId: 3, minRating: 4 });
  assert.match(monitor.sql, /WHERE r\.product_id = 3\n {2}AND r\.rating >= 4/);
  assert.deepEqual(monitor.rows.map((r) => r.review_id).sort(), [6, 7]);
  assert.ok(monitor.rows.every((r) => r.product_name === "Aperture 32 4K UHD"));
});

test("insert, update and delete change the table and return their SQL", () => {
  const state = createState();
  const add = insertReview(state, { ...input, reviewer: "Pat O'Neil" });
  assert.ok(add.ok);
  assert.deepEqual(add.ids, [15]);
  assert.match(
    add.sql,
    /VALUES \(3, 'Pat O''Neil', 4, 'Solid panel\.', '2025-03-20'\);/,
  );
  assert.equal(selectReviews(state, { productId: 3 }).rows.length, 4);

  const stats = productStats(state).find((s) => s.product.product_id === 3);
  assert.equal(stats.count, 4);

  const edit = updateReview(state, 15, {
    ...input,
    reviewer: "Pat O'Neil",
    rating: 2,
  });
  assert.ok(edit.ok);
  assert.equal(
    edit.sql,
    "UPDATE reviews\nSET rating = 2\nWHERE review_id = 15;",
  );
  assert.equal(state.reviews.find((r) => r.review_id === 15).rating, 2);
  assert.equal(
    updateReview(state, 15, { ...input, reviewer: "Pat O'Neil", rating: 2 }).ok,
    false,
  );

  const del = deleteReview(state, 15);
  assert.equal(del.sql, "DELETE FROM reviews\nWHERE review_id = 15;");
  assert.equal(state.reviews.length, 14);
  assert.equal(deleteReview(state, 15).ok, false);
});

test("invalid reviews are rejected without touching the table", () => {
  const state = createState();
  for (const bad of [
    { ...input, product_id: 42 },
    { ...input, rating: 6 },
    { ...input, reviewer: "  " },
    { ...input, review_text: "" },
    { ...input, review_date: "2025-02-30" },
  ]) {
    const write = insertReview(state, bad);
    assert.equal(write.ok, false);
    assert.ok(write.error);
  }
  assert.equal(state.reviews.length, 14);
});

test("a fresh state is independent of earlier edits", () => {
  const state = createState();
  deleteReview(state, 1);
  assert.equal(createState().reviews.length, 14);
});
