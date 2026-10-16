import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROGRAMS,
  TERMS,
  averageGpa,
  benchmark,
  byProgram,
  filterRecords,
  gpaDistribution,
  loadEnrollments,
  parseCsv,
  sortRecords,
  validateDraft,
} from "../src/data/demos/eduinsight.ts";

const good = {
  student: "  Jamie Park ",
  program: "Biology",
  term: "Fall 2025",
  gpa: "3.5",
  enrolled: "2025-09-01",
};

test("CSV parsing handles quotes, doubled quotes and CRLF", () => {
  assert.deepEqual(parseCsv('a,"b,c","d""e"\r\n1,2,3\r\n'), [
    ["a", "b,c", 'd"e'],
    ["1", "2", "3"],
  ]);
});

test("the embedded CSV loads into typed records", () => {
  const rows = loadEnrollments();
  assert.equal(rows.length, 36);
  assert.ok(rows.every((r) => r.gpa >= 0 && r.gpa <= 4));
  assert.ok(rows.every((r) => PROGRAMS.some((p) => p.name === r.program)));
  assert.ok(rows.every((r) => TERMS.includes(r.term)));
  assert.equal(rows[0].student, "Maya Okafor");
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
});

test("validation trims, rounds and rejects bad input", () => {
  const ok = validateDraft(good);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.student, "Jamie Park");
  assert.equal(ok.value.gpa, 3.5);
  assert.equal(validateDraft({ ...good, gpa: "0" }).ok, true);
  assert.equal(validateDraft({ ...good, gpa: "4" }).ok, true);
  for (const gpa of ["4.01", "-1", "abc", "", "3.456"])
    assert.ok(validateDraft({ ...good, gpa }).errors.gpa, gpa);
  const empty = validateDraft({
    student: " ",
    program: "",
    term: "",
    gpa: "",
    enrolled: "",
  });
  assert.equal(empty.ok, false);
  assert.deepEqual(Object.keys(empty.errors).sort(), [
    "enrolled",
    "gpa",
    "program",
    "student",
    "term",
  ]);
  assert.ok(validateDraft({ ...good, enrolled: "2025-02-30" }).errors.enrolled);
});

test("filters combine and charts follow the selection", () => {
  const rows = loadEnrollments();
  const nursing = filterRecords(rows, { program: "Nursing", term: "" });
  assert.ok(
    nursing.length > 0 && nursing.every((r) => r.program === "Nursing"),
  );
  const both = filterRecords(rows, { program: "Nursing", term: "Spring 2026" });
  assert.ok(both.length < nursing.length);
  assert.equal(
    byProgram(rows).reduce((s, p) => s + p.count, 0),
    rows.length,
  );
  const dist = gpaDistribution(rows);
  assert.equal(
    dist.reduce((s, b) => s + b.count, 0),
    rows.length,
  );
  assert.equal(
    gpaDistribution([{ gpa: 4 }, { gpa: 2 }, { gpa: 1.99 }])
      .map((b) => b.count)
      .join(),
    "1,1,0,0,1",
  );
});

test("benchmark compares the selection against weighted peer figures", () => {
  const rows = loadEnrollments();
  assert.equal(benchmark([]), null);
  const b = benchmark(rows);
  assert.ok(Math.abs(b.delta - (b.sample - b.peer)) < 1e-9);
  assert.equal(b.sample, averageGpa(rows));
  const bio = benchmark(filterRecords(rows, { program: "Biology", term: "" }));
  assert.equal(bio.peer, 3.0);
  assert.equal(
    sortRecords(rows)[0].enrolled >= sortRecords(rows)[1].enrolled,
    true,
  );
});
