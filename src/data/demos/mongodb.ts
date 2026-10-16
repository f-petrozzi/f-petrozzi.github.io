// Synthetic hospital collections plus a small aggregation-pipeline engine.
// Supports only the operators the preset pipelines use; results are computed, not canned.

export type Doc = Record<string, any>;
export type Stage = Record<string, any>;
export type CollectionName =
  "appointments" | "patients" | "doctors" | "billing";
export type Db = Record<CollectionName, Doc[]>;

export const COLLECTIONS: CollectionName[] = [
  "appointments",
  "patients",
  "doctors",
  "billing",
];
export const STATUSES = ["scheduled", "completed", "cancelled", "no-show"];

const SEED: Db = {
  patients: [
    { _id: "p101", name: "Rhea Castellano", city: "Dayton" },
    { _id: "p102", name: "Marcus Oyelaran", city: "Toledo" },
    { _id: "p103", name: "Ingrid Halvorsen", city: "Akron" },
    { _id: "p104", name: "Devon Pacheco", city: "Columbus" },
    { _id: "p105", name: "Sana Qureshi", city: "Dayton" },
    { _id: "p106", name: "Tomas Brandt", city: "Cleveland" },
    { _id: "p107", name: "Alina Voss", city: "Toledo" },
    { _id: "p108", name: "Julian Mbeki", city: "Akron" },
  ],
  doctors: [
    {
      _id: "d01",
      name: "Dr. Marisol Vega",
      specialty: "Cardiology",
      rate: 240,
    },
    {
      _id: "d02",
      name: "Dr. Tobias Lindqvist",
      specialty: "Dermatology",
      rate: 160,
    },
    { _id: "d03", name: "Dr. Priya Raman", specialty: "Pediatrics", rate: 140 },
    {
      _id: "d04",
      name: "Dr. Jonah Whitaker",
      specialty: "Orthopedics",
      rate: 280,
    },
  ],
  appointments: [
    {
      _id: "a1001",
      patientId: "p101",
      doctorId: "d01",
      date: "2025-02-03",
      status: "completed",
      reason: "Chest pain follow-up",
    },
    {
      _id: "a1002",
      patientId: "p102",
      doctorId: "d02",
      date: "2025-02-05",
      status: "completed",
      reason: "Rash",
    },
    {
      _id: "a1003",
      patientId: "p103",
      doctorId: "d03",
      date: "2025-02-11",
      status: "completed",
      reason: "Annual checkup",
    },
    {
      _id: "a1004",
      patientId: "p104",
      doctorId: "d04",
      date: "2025-02-18",
      status: "completed",
      reason: "Knee pain",
    },
    {
      _id: "a1005",
      patientId: "p105",
      doctorId: "d01",
      date: "2025-03-04",
      status: "completed",
      reason: "Blood pressure review",
    },
    {
      _id: "a1006",
      patientId: "p106",
      doctorId: "d02",
      date: "2025-03-07",
      status: "completed",
      reason: "Mole check",
    },
    {
      _id: "a1007",
      patientId: "p101",
      doctorId: "d01",
      date: "2025-03-12",
      status: "completed",
      reason: "ECG",
    },
    {
      _id: "a1008",
      patientId: "p107",
      doctorId: "d03",
      date: "2025-03-14",
      status: "cancelled",
      reason: "Ear infection",
    },
    {
      _id: "a1009",
      patientId: "p108",
      doctorId: "d04",
      date: "2025-03-19",
      status: "completed",
      reason: "Shoulder strain",
    },
    {
      _id: "a1010",
      patientId: "p102",
      doctorId: "d03",
      date: "2025-03-25",
      status: "completed",
      reason: "Vaccination",
    },
    {
      _id: "a1011",
      patientId: "p103",
      doctorId: "d01",
      date: "2025-04-02",
      status: "scheduled",
      reason: "Stress test",
    },
    {
      _id: "a1012",
      patientId: "p104",
      doctorId: "d02",
      date: "2025-04-04",
      status: "scheduled",
      reason: "Skin screening",
    },
    {
      _id: "a1013",
      patientId: "p105",
      doctorId: "d04",
      date: "2025-04-09",
      status: "scheduled",
      reason: "Physical therapy review",
    },
    {
      _id: "a1014",
      patientId: "p106",
      doctorId: "d03",
      date: "2025-04-10",
      status: "no-show",
      reason: "Checkup",
    },
    {
      _id: "a1015",
      patientId: "p107",
      doctorId: "d01",
      date: "2025-04-15",
      status: "scheduled",
      reason: "Consultation",
    },
    {
      _id: "a1016",
      patientId: "p108",
      doctorId: "d02",
      date: "2025-03-28",
      status: "cancelled",
      reason: "Acne treatment",
    },
  ],
  billing: [
    {
      _id: "b2001",
      appointmentId: "a1001",
      amount: 240,
      status: "paid",
      issued: "2025-02-03",
    },
    {
      _id: "b2002",
      appointmentId: "a1002",
      amount: 160,
      status: "paid",
      issued: "2025-02-05",
    },
    {
      _id: "b2003",
      appointmentId: "a1003",
      amount: 140,
      status: "paid",
      issued: "2025-02-11",
    },
    {
      _id: "b2004",
      appointmentId: "a1004",
      amount: 280,
      status: "paid",
      issued: "2025-02-18",
    },
    {
      _id: "b2005",
      appointmentId: "a1005",
      amount: 240,
      status: "outstanding",
      issued: "2025-03-04",
    },
    {
      _id: "b2006",
      appointmentId: "a1006",
      amount: 200,
      status: "outstanding",
      issued: "2025-03-07",
    },
    {
      _id: "b2007",
      appointmentId: "a1007",
      amount: 320,
      status: "paid",
      issued: "2025-03-12",
    },
    {
      _id: "b2008",
      appointmentId: "a1009",
      amount: 280,
      status: "outstanding",
      issued: "2025-03-19",
    },
    {
      _id: "b2009",
      appointmentId: "a1010",
      amount: 140,
      status: "paid",
      issued: "2025-03-25",
    },
  ],
};

export function createDb(): Db {
  return structuredClone(SEED);
}

// ---------- mongosh-style text ----------

export function shell(value: unknown): string {
  if (Array.isArray(value))
    return value.length ? `[${value.map(shell).join(", ")}]` : "[]";
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return "{}";
    return `{ ${entries
      .map(
        ([k, v]) =>
          `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${shell(v)}`,
      )
      .join(", ")} }`;
  }
  return JSON.stringify(value) ?? "null";
}

export function pipelineText(collection: string, pipeline: Stage[]): string {
  return `db.${collection}.aggregate([\n${pipeline
    .map((s) => `  ${shell(s)}`)
    .join(",\n")}\n])`;
}

// ---------- aggregation engine ----------

export function getPath(doc: unknown, path: string): any {
  let value: any = doc;
  for (const part of path.split(".")) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  return value;
}

function setPath(doc: Doc, path: string, value: unknown) {
  doc[path] = value;
}

function expr(doc: Doc, e: unknown): any {
  if (typeof e === "string" && e.startsWith("$"))
    return getPath(doc, e.slice(1));
  return e;
}

function matches(doc: Doc, filter: Stage): boolean {
  return Object.entries(filter).every(([field, cond]) => {
    const value = getPath(doc, field);
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, arg]: [string, any]) => {
        if (op === "$in") return arg.includes(value);
        if (op === "$ne") return value !== arg;
        if (op === "$eq") return value === arg;
        if (op === "$gt") return value > arg;
        if (op === "$gte") return value >= arg;
        if (op === "$lt") return value < arg;
        if (op === "$lte") return value <= arg;
        throw new Error(`Unsupported operator ${op}`);
      });
    }
    return value === cond;
  });
}

function compare(a: any, b: any) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function applyStage(db: Db, docs: Doc[], stage: Stage): Doc[] {
  const [name] = Object.keys(stage);
  const arg = stage[name];
  switch (name) {
    case "$match":
      return docs.filter((d) => matches(d, arg));
    case "$lookup":
      return docs.map((d) => ({
        ...d,
        [arg.as]: db[arg.from as CollectionName].filter(
          (f) => getPath(f, arg.foreignField) === getPath(d, arg.localField),
        ),
      }));
    case "$unwind": {
      const path = String(typeof arg === "string" ? arg : arg.path).slice(1);
      return docs.flatMap((d) => {
        const list = getPath(d, path);
        if (!Array.isArray(list)) return list === undefined ? [] : [d];
        return list.map((item) => {
          const copy = { ...d };
          setPath(copy, path, item);
          return copy;
        });
      });
    }
    case "$group": {
      const groups = new Map<string, Doc>();
      const counts = new Map<string, Record<string, number>>();
      for (const d of docs) {
        const id = expr(d, arg._id);
        const key = JSON.stringify(id ?? null);
        let g = groups.get(key);
        if (!g) {
          g = { _id: id ?? null };
          groups.set(key, g);
          counts.set(key, {});
        }
        const n = counts.get(key)!;
        for (const [field, acc] of Object.entries(arg) as [string, any][]) {
          if (field === "_id") continue;
          const [op] = Object.keys(acc);
          const value = expr(d, acc[op]);
          if (op === "$sum") g[field] = (g[field] ?? 0) + (Number(value) || 0);
          else if (op === "$avg") {
            n[field] = (n[field] ?? 0) + 1;
            g[field] =
              ((g[field] ?? 0) * (n[field] - 1) + Number(value)) / n[field];
          } else if (op === "$first") g[field] ??= value;
          else if (op === "$max")
            g[field] =
              g[field] === undefined ? value : Math.max(g[field], value);
          else throw new Error(`Unsupported accumulator ${op}`);
        }
      }
      return [...groups.values()];
    }
    case "$sort": {
      const keys = Object.entries(arg) as [string, number][];
      return [...docs].sort((a, b) => {
        for (const [field, dir] of keys) {
          const c = compare(getPath(a, field), getPath(b, field));
          if (c) return c * dir;
        }
        return 0;
      });
    }
    case "$project":
      return docs.map((d) => {
        const out: Doc = {};
        if (arg._id !== 0 && "_id" in d) out._id = d._id;
        for (const [field, spec] of Object.entries(arg) as [string, any][]) {
          if (field === "_id" && (spec === 0 || spec === false)) continue;
          if (spec === 1 || spec === true) out[field] = getPath(d, field);
          else if (typeof spec === "string") out[field] = expr(d, spec);
        }
        return out;
      });
    default:
      throw new Error(`Unsupported stage ${name}`);
  }
}

export interface PipelineRun {
  stages: { stage: Stage; output: Doc[] }[];
  result: Doc[];
}

export function aggregate(
  db: Db,
  collection: CollectionName,
  pipeline: Stage[],
): PipelineRun {
  let docs: Doc[] = db[collection].map((d) => ({ ...d }));
  const stages = pipeline.map((stage) => {
    docs = applyStage(db, docs, stage);
    return { stage, output: docs };
  });
  return { stages, result: docs };
}

// ---------- preset operations ----------

export type OperationId =
  "revenue" | "statuses" | "outstanding" | "appointment";

export const OPERATIONS: { id: OperationId; label: string }[] = [
  { id: "revenue", label: "Revenue by doctor" },
  { id: "statuses", label: "Appointment statuses" },
  { id: "outstanding", label: "Outstanding invoices" },
  { id: "appointment", label: "Add or edit appointment" },
];

export const PIPELINES: Record<
  Exclude<OperationId, "appointment">,
  { collection: CollectionName; pipeline: Stage[] }
> = {
  revenue: {
    collection: "appointments",
    pipeline: [
      {
        $lookup: {
          from: "billing",
          localField: "_id",
          foreignField: "appointmentId",
          as: "bill",
        },
      },
      { $unwind: "$bill" },
      { $match: { "bill.status": "paid" } },
      {
        $group: {
          _id: "$doctorId",
          revenue: { $sum: "$bill.amount" },
          invoices: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "doctors",
          localField: "_id",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: "$doctor" },
      { $project: { _id: 0, doctor: "$doctor.name", revenue: 1, invoices: 1 } },
      { $sort: { revenue: -1, doctor: 1 } },
    ],
  },
  statuses: {
    collection: "appointments",
    pipeline: [
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ],
  },
  outstanding: {
    collection: "billing",
    pipeline: [
      { $match: { status: "outstanding" } },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appt",
        },
      },
      { $unwind: "$appt" },
      {
        $lookup: {
          from: "patients",
          localField: "appt.patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: "$patient" },
      {
        $project: { patient: "$patient.name", amount: 1, issued: 1 },
      },
      { $sort: { amount: -1, _id: 1 } },
    ],
  },
};

export function runOperation(
  db: Db,
  id: Exclude<OperationId, "appointment">,
): PipelineRun & { collection: CollectionName; pipeline: Stage[] } {
  const { collection, pipeline } = PIPELINES[id];
  return { collection, pipeline, ...aggregate(db, collection, pipeline) };
}

export function totalOf(docs: Doc[], field: string): number {
  return docs.reduce((sum, d) => sum + (Number(d[field]) || 0), 0);
}

// ---------- writes ----------

export interface AppointmentInput {
  id?: string;
  patientId: string;
  doctorId: string;
  date: string;
  status: string;
  reason: string;
}
export interface WriteResult {
  ok: boolean;
  error?: string;
  commands: string[];
  touched: { collection: CollectionName; id: string }[];
}

function nextId(docs: Doc[], prefix: string, start: number) {
  const max = docs.reduce(
    (m, d) => Math.max(m, Number(String(d._id).slice(prefix.length)) || 0),
    start - 1,
  );
  return `${prefix}${max + 1}`;
}

function issueInvoice(db: Db, appointment: Doc, result: WriteResult) {
  if (appointment.status !== "completed") return;
  if (db.billing.some((b) => b.appointmentId === appointment._id)) return;
  const doctor = db.doctors.find((d) => d._id === appointment.doctorId)!;
  const invoice = {
    _id: nextId(db.billing, "b", 2001),
    appointmentId: appointment._id,
    amount: doctor.rate,
    status: "outstanding",
    issued: appointment.date,
  };
  db.billing.push(invoice);
  result.commands.push(`db.billing.insertOne(${shell(invoice)})`);
  result.touched.push({ collection: "billing", id: invoice._id });
}

export function saveAppointment(db: Db, input: AppointmentInput): WriteResult {
  const result: WriteResult = { ok: true, commands: [], touched: [] };
  const fail = (error: string) => ({ ...result, ok: false, error });
  if (!db.patients.some((p) => p._id === input.patientId))
    return fail("Choose a patient.");
  if (!db.doctors.some((d) => d._id === input.doctorId))
    return fail("Choose a doctor.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Choose a date.");
  if (!STATUSES.includes(input.status)) return fail("Choose a status.");
  const reason = input.reason.trim() || "Consultation";

  if (!input.id) {
    const doc = {
      _id: nextId(db.appointments, "a", 1001),
      patientId: input.patientId,
      doctorId: input.doctorId,
      date: input.date,
      status: input.status,
      reason,
    };
    db.appointments.push(doc);
    result.commands.push(`db.appointments.insertOne(${shell(doc)})`);
    result.touched.push({ collection: "appointments", id: doc._id });
    issueInvoice(db, doc, result);
    return result;
  }

  const doc = db.appointments.find((a) => a._id === input.id);
  if (!doc) return fail("That appointment no longer exists.");
  const next: Doc = {
    patientId: input.patientId,
    doctorId: input.doctorId,
    date: input.date,
    status: input.status,
    reason,
  };
  const changed: Doc = {};
  for (const [k, v] of Object.entries(next)) if (doc[k] !== v) changed[k] = v;
  if (!Object.keys(changed).length) {
    result.commands.push("// no fields changed");
    return result;
  }
  Object.assign(doc, changed);
  result.commands.push(
    `db.appointments.updateOne(${shell({ _id: doc._id })}, ${shell({ $set: changed })})`,
  );
  result.touched.push({ collection: "appointments", id: doc._id });
  issueInvoice(db, doc, result);
  return result;
}

export function markPaid(db: Db, invoiceId: string): WriteResult {
  const result: WriteResult = { ok: true, commands: [], touched: [] };
  const invoice = db.billing.find((b) => b._id === invoiceId);
  if (!invoice || invoice.status === "paid")
    return { ...result, ok: false, error: "Invoice not found." };
  invoice.status = "paid";
  result.commands.push(
    `db.billing.updateOne(${shell({ _id: invoiceId })}, ${shell({ $set: { status: "paid" } })})`,
  );
  result.touched.push({ collection: "billing", id: invoiceId });
  return result;
}
