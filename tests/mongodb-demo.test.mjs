import { test } from "node:test";
import assert from "node:assert/strict";
import {
  OPERATIONS,
  PIPELINES,
  aggregate,
  createDb,
  markPaid,
  pipelineText,
  runOperation,
  saveAppointment,
  shell,
  totalOf,
} from "../src/data/demos/mongodb.ts";

const revenueByDoctor = (db) => {
  const out = {};
  for (const b of db.billing.filter((x) => x.status === "paid")) {
    const a = db.appointments.find((x) => x._id === b.appointmentId);
    const d = db.doctors.find((x) => x._id === a.doctorId);
    out[d.name] = (out[d.name] ?? 0) + b.amount;
  }
  return out;
};
const asMap = (rows, key, value) =>
  Object.fromEntries(rows.map((r) => [r[key], r[value]]));

test("the starting data links appointments, patients, doctors and billing by id", () => {
  const db = createDb();
  for (const a of db.appointments) {
    assert.ok(db.patients.some((p) => p._id === a.patientId));
    assert.ok(db.doctors.some((d) => d._id === a.doctorId));
  }
  for (const b of db.billing)
    assert.ok(db.appointments.some((a) => a._id === b.appointmentId));
});

test("every preset pipeline runs and reports each stage's output", () => {
  const db = createDb();
  for (const { id } of OPERATIONS.filter((o) => o.id !== "appointment")) {
    const run = runOperation(db, id);
    assert.equal(run.stages.length, PIPELINES[id].pipeline.length);
    assert.deepEqual(run.result, run.stages.at(-1).output);
    assert.match(pipelineText(run.collection, run.pipeline), /aggregate\(\[/);
  }
});

test("revenue by doctor matches an independent computation and is sorted", () => {
  const db = createDb();
  const run = runOperation(db, "revenue");
  assert.deepEqual(asMap(run.result, "doctor", "revenue"), revenueByDoctor(db));
  const revenue = run.result.map((r) => r.revenue);
  assert.deepEqual(
    revenue,
    [...revenue].sort((a, b) => b - a),
  );
  assert.equal(run.stages[0].output.length, db.appointments.length);
  assert.equal(run.stages[2].output.length, 6);
  assert.deepEqual(Object.keys(run.result[0]), [
    "doctor",
    "revenue",
    "invoices",
  ]);
});

test("status counts add up to the appointments", () => {
  const db = createDb();
  const run = runOperation(db, "statuses");
  assert.equal(totalOf(run.result, "count"), db.appointments.length);
  assert.deepEqual(asMap(run.result, "_id", "count"), {
    completed: 9,
    scheduled: 4,
    cancelled: 2,
    "no-show": 1,
  });
});

test("outstanding invoices name the patient and sort by amount", () => {
  const db = createDb();
  const run = runOperation(db, "outstanding");
  assert.equal(run.result.length, 3);
  assert.equal(totalOf(run.result, "amount"), 240 + 200 + 280);
  assert.equal(run.result[0].amount, 280);
  assert.equal(run.result[0].patient, "Julian Mbeki");
});

test("marking an invoice paid moves revenue and shrinks the outstanding list", () => {
  const db = createDb();
  const before = asMap(runOperation(db, "revenue").result, "doctor", "revenue");
  const write = markPaid(db, "b2005");
  assert.ok(write.ok);
  assert.match(write.commands[0], /updateOne\(\{ _id: "b2005" \}/);
  const after = asMap(runOperation(db, "revenue").result, "doctor", "revenue");
  assert.equal(after["Dr. Marisol Vega"], before["Dr. Marisol Vega"] + 240);
  assert.equal(runOperation(db, "outstanding").result.length, 2);
  assert.equal(markPaid(db, "b2005").ok, false);
});

test("adding a scheduled appointment changes the status counts", () => {
  const db = createDb();
  const write = saveAppointment(db, {
    patientId: "p101",
    doctorId: "d02",
    date: "2025-05-02",
    status: "scheduled",
    reason: "",
  });
  assert.ok(write.ok);
  assert.equal(write.touched[0].id, "a1017");
  assert.match(write.commands[0], /insertOne/);
  assert.equal(db.billing.length, 9);
  const counts = asMap(runOperation(db, "statuses").result, "_id", "count");
  assert.equal(counts.scheduled, 5);
});

test("completing an appointment issues an invoice at the doctor's rate", () => {
  const db = createDb();
  const write = saveAppointment(db, {
    id: "a1011",
    patientId: "p103",
    doctorId: "d01",
    date: "2025-04-02",
    status: "completed",
    reason: "Stress test",
  });
  assert.equal(write.commands.length, 2);
  assert.match(write.commands[0], /\$set: \{ status: "completed" \}/);
  const invoice = db.billing.at(-1);
  assert.equal(invoice.appointmentId, "a1011");
  assert.equal(invoice.amount, 240);
  assert.equal(invoice.status, "outstanding");
  assert.equal(runOperation(db, "outstanding").result.length, 4);
});

test("reassigning an appointment regroups paid revenue by doctor", () => {
  const db = createDb();
  saveAppointment(db, {
    id: "a1001",
    patientId: "p101",
    doctorId: "d04",
    date: "2025-02-03",
    status: "completed",
    reason: "Chest pain follow-up",
  });
  assert.deepEqual(
    asMap(runOperation(db, "revenue").result, "doctor", "revenue"),
    revenueByDoctor(db),
  );
  assert.equal(
    asMap(runOperation(db, "revenue").result, "doctor", "revenue")[
      "Dr. Jonah Whitaker"
    ],
    280 + 240,
  );
});

test("invalid input is rejected and a fresh database restores the start", () => {
  const db = createDb();
  const bad = saveAppointment(db, {
    patientId: "p999",
    doctorId: "d01",
    date: "2025-05-02",
    status: "scheduled",
    reason: "",
  });
  assert.equal(bad.ok, false);
  saveAppointment(db, {
    id: "a1002",
    patientId: "p102",
    doctorId: "d02",
    date: "2025-02-05",
    status: "cancelled",
    reason: "Rash",
  });
  markPaid(db, "b2006");
  assert.notDeepEqual(db, createDb());
  assert.deepEqual(createDb(), createDb());
  assert.equal(
    createDb().appointments.find((a) => a._id === "a1002").status,
    "completed",
  );
});

test("shell text unquotes plain keys and keeps dotted ones quoted", () => {
  assert.equal(
    shell({ $match: { "bill.status": "paid", n: [1, 2] } }),
    '{ $match: { "bill.status": "paid", n: [1, 2] } }',
  );
});

test("engine supports $in and $ne filters and rejects unknown stages", () => {
  const db = createDb();
  assert.equal(
    aggregate(db, "appointments", [
      { $match: { status: { $in: ["cancelled", "no-show"] } } },
    ]).result.length,
    3,
  );
  assert.equal(
    aggregate(db, "appointments", [
      { $match: { status: { $ne: "completed" } } },
    ]).result.length,
    7,
  );
  assert.throws(() => aggregate(db, "appointments", [{ $bucket: {} }]));
});
