import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHANGE_DATES,
  DEFAULT_OPTIONS,
  MOVING_DOCTOR,
  PRESCRIPTIONS,
  QUARTERS,
  QUERY_LIST,
  VISITS,
  buildDoctorDim,
  formatValue,
  quarterOf,
  runQuery,
} from "../src/data/demos/hospital-data-warehouse.ts";

const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

test("every preset query returns rows, SQL and the tables it joins", () => {
  for (const { id } of QUERY_LIST) {
    const result = runQuery(id);
    assert.ok(result.rows.length > 0, id);
    assert.match(result.sql, /^SELECT/);
    assert.ok(result.tables.length >= 2);
    for (const [fact, dim] of result.joins) {
      assert.ok(result.tables.includes(fact) && result.tables.includes(dim));
      assert.match(result.sql, new RegExp(`\\b${fact}\\b`));
      assert.match(result.sql, new RegExp(`\\b${dim}\\b`));
    }
    assert.ok(result.columns.every((c) => c.key in result.rows[0]));
  }
});

test("prescriptions by specialty accounts for every prescription", () => {
  const result = runQuery("specialty");
  assert.equal(sum(result.rows, "prescriptions"), PRESCRIPTIONS.length);
  assert.equal(
    sum(result.rows, "total_cost"),
    PRESCRIPTIONS.reduce((total, rx) => total + rx.cost, 0),
  );
  const counts = result.rows.map((r) => r.prescriptions);
  assert.deepEqual(
    counts,
    [...counts].sort((a, b) => b - a),
  );
});

test("procedure charges are averaged per procedure and sorted", () => {
  const result = runQuery("charges");
  assert.equal(sum(result.rows, "visits"), VISITS.length);
  const charges = result.rows.map((r) => r.avg_charge);
  assert.deepEqual(
    charges,
    [...charges].sort((a, b) => b - a),
  );
  const stent = result.rows.find((r) => r.procedure === "Cardiac stent");
  const xray = result.rows.find((r) => r.procedure === "Chest X-ray");
  assert.ok(stent.avg_charge > xray.avg_charge);
  assert.ok(stent.avg_stay > xray.avg_stay);
});

test("revenue by state reconciles with the fact table and filters by quarter", () => {
  const all = runQuery("states");
  assert.equal(sum(all.rows, "revenue"), sum(VISITS, "charge"));
  assert.ok(!all.tables.includes("dim_date"));
  assert.ok(!all.sql.includes("WHERE"));

  let quarterly = 0;
  for (const q of QUARTERS.filter((x) => x !== "all")) {
    const r = runQuery("states", { ...DEFAULT_OPTIONS, quarter: q });
    assert.ok(r.tables.includes("dim_date"));
    assert.match(r.sql, new RegExp(`quarter = '${q}'`));
    const expected = VISITS.filter((v) => quarterOf(v.date) === q);
    assert.equal(sum(r.rows, "visits"), expected.length);
    quarterly += sum(r.rows, "revenue");
  }
  assert.equal(quarterly, sum(all.rows, "revenue"));
});

test("type 2 keeps the old specialty on old visits", () => {
  const options = { ...DEFAULT_OPTIONS, changeDate: "2025-07-01" };
  const dim = buildDoctorDim(options).filter(
    (r) => r.doctor_id === MOVING_DOCTOR,
  );
  assert.equal(dim.length, 2);
  assert.equal(dim[0].specialty, "Internal Medicine");
  assert.equal(dim[0].valid_to, "2025-07-01");
  assert.equal(dim[1].valid_from, "2025-07-01");
  assert.equal(dim[1].is_current, true);

  const result = runQuery("scd", options);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(
    result.rows.map((r) => r.specialty),
    ["Internal Medicine", "Cardiology"],
  );
  const mine = VISITS.filter((v) => v.doctor_id === MOVING_DOCTOR);
  const before = mine.filter((v) => v.date < "2025-07-01").length;
  assert.equal(result.rows[0].visits, before);
  assert.equal(result.rows[1].visits, mine.length - before);
  assert.ok(before > 0 && before < mine.length);
});

test("moving the change date moves visits between the two rows", () => {
  const counts = CHANGE_DATES.map(
    (changeDate) =>
      runQuery("scd", { ...DEFAULT_OPTIONS, changeDate }).rows[0].visits,
  );
  assert.deepEqual(
    counts,
    [...counts].sort((a, b) => a - b),
  );
  assert.ok(counts[0] < counts.at(-1));
});

test("type 1 overwrite loses history", () => {
  const result = runQuery("scd", { ...DEFAULT_OPTIONS, mode: "type1" });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].specialty, "Cardiology");
  assert.equal(
    result.rows[0].visits,
    VISITS.filter((v) => v.doctor_id === MOVING_DOCTOR).length,
  );
});

test("the specialty report follows the dimension history", () => {
  const find = (result, name) =>
    result.rows.find((r) => r.specialty === name)?.prescriptions ?? 0;
  const type2 = runQuery("specialty");
  const type1 = runQuery("specialty", { ...DEFAULT_OPTIONS, mode: "type1" });
  assert.equal(find(type1, "Internal Medicine"), 0);
  assert.ok(find(type2, "Internal Medicine") > 0);
  assert.ok(find(type1, "Cardiology") > find(type2, "Cardiology"));
  assert.equal(sum(type1.rows, "prescriptions"), PRESCRIPTIONS.length);
});

test("values format for display", () => {
  assert.equal(formatValue(12345.6, "money"), "$12,346");
  assert.equal(formatValue(2.25, "decimal"), "2.3");
  assert.equal(formatValue("Ohio"), "Ohio");
  assert.equal(formatValue(1200, "int"), "1,200");
});
