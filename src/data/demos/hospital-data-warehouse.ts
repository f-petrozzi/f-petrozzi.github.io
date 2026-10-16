// Synthetic star schema and a tiny query engine for the Hospital Data Warehouse sample.
// Every number on screen is computed from these arrays; there is no SQL parser.

export type TableName =
  | "fact_visits"
  | "fact_prescriptions"
  | "dim_patient"
  | "dim_doctor"
  | "dim_date"
  | "dim_procedure"
  | "dim_state";

export type QueryId = "specialty" | "charges" | "states" | "scd";
export type Quarter = "all" | "Q1" | "Q2" | "Q3" | "Q4";
export type HistoryMode = "type2" | "type1";

export interface Options {
  quarter: Quarter;
  changeDate: string;
  mode: HistoryMode;
}

export const DEFAULT_OPTIONS: Options = {
  quarter: "all",
  changeDate: "2025-07-01",
  mode: "type2",
};
export const CHANGE_DATES = [
  "2025-03-01",
  "2025-05-01",
  "2025-07-01",
  "2025-09-01",
  "2025-11-01",
];
export const QUARTERS: Quarter[] = ["all", "Q1", "Q2", "Q3", "Q4"];
export const OPEN_END = "9999-12-31";
export const MOVING_DOCTOR = "D-07";

interface Doctor {
  id: string;
  name: string;
  specialty: string;
}
export const DOCTORS: Doctor[] = [
  { id: "D-01", name: "Dr. Marisol Vega", specialty: "Cardiology" },
  { id: "D-02", name: "Dr. Tobias Lindqvist", specialty: "Orthopedics" },
  { id: "D-03", name: "Dr. Priya Raman", specialty: "Pediatrics" },
  { id: "D-04", name: "Dr. Jonah Whitaker", specialty: "Oncology" },
  { id: "D-05", name: "Dr. Amara Nwosu", specialty: "Neurology" },
  { id: "D-06", name: "Dr. Henrik Sato", specialty: "Family Medicine" },
  { id: "D-07", name: "Dr. Imani Okafor", specialty: "Internal Medicine" },
  { id: "D-08", name: "Dr. Lucia Ferreira", specialty: "Obstetrics" },
];
export const NEW_SPECIALTY = "Cardiology";

export const PROCEDURES = [
  { key: 1, name: "Chest X-ray", base: 280, stay: 0 },
  { key: 2, name: "MRI scan", base: 1900, stay: 0 },
  { key: 3, name: "Knee arthroscopy", base: 7400, stay: 1 },
  { key: 4, name: "Appendectomy", base: 9800, stay: 2 },
  { key: 5, name: "Cesarean delivery", base: 12600, stay: 4 },
  { key: 6, name: "Cardiac stent", base: 21800, stay: 3 },
];

export const STATES = [
  { key: 1, code: "OH", name: "Ohio" },
  { key: 2, code: "PA", name: "Pennsylvania" },
  { key: 3, code: "NY", name: "New York" },
  { key: 4, code: "MI", name: "Michigan" },
  { key: 5, code: "IN", name: "Indiana" },
];

const DRUGS = [
  { name: "Lisinopril", cost: 18 },
  { name: "Metformin", cost: 12 },
  { name: "Atorvastatin", cost: 24 },
  { name: "Amoxicillin", cost: 15 },
  { name: "Ibuprofen", cost: 9 },
  { name: "Sumatriptan", cost: 46 },
  { name: "Levothyroxine", cost: 21 },
];

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function dateOf(index: number, total: number): string {
  const day = Math.floor((index * 365) / total);
  const d = new Date(Date.UTC(2025, 0, 1 + day));
  return d.toISOString().slice(0, 10);
}

export function quarterOf(date: string): Exclude<Quarter, "all"> {
  const month = Number(date.slice(5, 7));
  return `Q${Math.ceil(month / 3)}` as Exclude<Quarter, "all">;
}

export interface Visit {
  visit_id: number;
  patient_key: number;
  doctor_id: string;
  procedure_key: number;
  state_key: number;
  date: string;
  charge: number;
  length_of_stay: number;
}
export interface Prescription {
  rx_id: number;
  patient_key: number;
  doctor_id: string;
  date: string;
  drug: string;
  quantity: number;
  cost: number;
}

const VISIT_COUNT = 96;
const RX_COUNT = 80;

function makeVisits(): Visit[] {
  const next = lcg(20250);
  return Array.from({ length: VISIT_COUNT }, (_, i) => {
    const proc = PROCEDURES[Math.floor(next() * PROCEDURES.length)];
    const charge = Math.round(proc.base * (0.88 + next() * 0.3));
    const stay = proc.stay === 0 ? 0 : proc.stay + Math.floor(next() * 3) - 1;
    return {
      visit_id: 5000 + i,
      patient_key: 1 + Math.floor(next() * 24),
      doctor_id: DOCTORS[i % DOCTORS.length].id,
      procedure_key: proc.key,
      state_key: 1 + Math.floor(next() * STATES.length),
      date: dateOf(i, VISIT_COUNT),
      charge,
      length_of_stay: Math.max(0, stay),
    };
  });
}

function makePrescriptions(): Prescription[] {
  const next = lcg(77031);
  return Array.from({ length: RX_COUNT }, (_, i) => {
    const drug = DRUGS[Math.floor(next() * DRUGS.length)];
    const quantity = 1 + Math.floor(next() * 3);
    return {
      rx_id: 9000 + i,
      patient_key: 1 + Math.floor(next() * 24),
      doctor_id: DOCTORS[(i * 5 + 3) % DOCTORS.length].id,
      date: dateOf(i, RX_COUNT),
      drug: drug.name,
      quantity,
      cost: drug.cost * quantity,
    };
  });
}

export const VISITS = makeVisits();
export const PRESCRIPTIONS = makePrescriptions();

export interface DoctorRow {
  doctor_key: number;
  doctor_id: string;
  name: string;
  specialty: string;
  valid_from: string;
  valid_to: string;
  is_current: boolean;
}

// Builds dim_doctor. Type 2 closes the old row and opens a new surrogate key;
// type 1 overwrites the specialty in place.
export function buildDoctorDim(options: Options): DoctorRow[] {
  const rows: DoctorRow[] = [];
  let key = 1;
  for (const d of DOCTORS) {
    if (d.id !== MOVING_DOCTOR) {
      rows.push({
        doctor_key: key++,
        doctor_id: d.id,
        name: d.name,
        specialty: d.specialty,
        valid_from: "2024-01-01",
        valid_to: OPEN_END,
        is_current: true,
      });
    } else if (options.mode === "type1") {
      rows.push({
        doctor_key: key++,
        doctor_id: d.id,
        name: d.name,
        specialty: NEW_SPECIALTY,
        valid_from: "2024-01-01",
        valid_to: OPEN_END,
        is_current: true,
      });
    } else {
      rows.push({
        doctor_key: key++,
        doctor_id: d.id,
        name: d.name,
        specialty: d.specialty,
        valid_from: "2024-01-01",
        valid_to: options.changeDate,
        is_current: false,
      });
      rows.push({
        doctor_key: key++,
        doctor_id: d.id,
        name: d.name,
        specialty: NEW_SPECIALTY,
        valid_from: options.changeDate,
        valid_to: OPEN_END,
        is_current: true,
      });
    }
  }
  return rows;
}

// ETL step: each fact row gets the surrogate key that was valid on its date.
function doctorKeyFor(dim: DoctorRow[], doctorId: string, date: string) {
  const row = dim.find(
    (r) =>
      r.doctor_id === doctorId && r.valid_from <= date && date < r.valid_to,
  );
  if (!row) throw new Error(`No dim_doctor row for ${doctorId} on ${date}`);
  return row.doctor_key;
}

export interface Column {
  key: string;
  label: string;
  format?: "text" | "int" | "money" | "decimal";
}
export interface Metric {
  key: string;
  label: string;
  format: "int" | "money" | "decimal";
}
export interface QueryResult {
  id: QueryId;
  sql: string;
  joins: [TableName, TableName][];
  tables: TableName[];
  columns: Column[];
  rows: Record<string, string | number>[];
  metrics: Metric[];
  labelKey: string;
}

export const QUERY_LIST: { id: QueryId; label: string }[] = [
  { id: "specialty", label: "Prescriptions by specialty" },
  { id: "charges", label: "Charges vs length of stay" },
  { id: "states", label: "Revenue by state" },
  { id: "scd", label: "Specialty change over time" },
];

export function formatValue(
  value: string | number,
  format: Column["format"] = "text",
): string {
  if (typeof value === "string") return value;
  if (format === "money")
    return "$" + Math.round(value).toLocaleString("en-US");
  if (format === "decimal") return value.toFixed(1);
  return value.toLocaleString("en-US");
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function tablesOf(joins: [TableName, TableName][]): TableName[] {
  return [...new Set(joins.flat())];
}

export function runQuery(
  id: QueryId,
  options: Options = DEFAULT_OPTIONS,
): QueryResult {
  const dim = buildDoctorDim(options);
  const doctor = (doctorId: string, date: string) =>
    dim.find((r) => r.doctor_key === doctorKeyFor(dim, doctorId, date))!;

  if (id === "specialty") {
    const groups = new Map<string, { n: number; cost: number }>();
    for (const rx of PRESCRIPTIONS) {
      const s = doctor(rx.doctor_id, rx.date).specialty;
      const g = groups.get(s) ?? { n: 0, cost: 0 };
      g.n += 1;
      g.cost += rx.cost;
      groups.set(s, g);
    }
    const rows = [...groups]
      .map(([specialty, g]) => ({
        specialty,
        prescriptions: g.n,
        total_cost: g.cost,
      }))
      .sort(
        (a, b) =>
          b.prescriptions - a.prescriptions ||
          a.specialty.localeCompare(b.specialty),
      );
    const joins: [TableName, TableName][] = [
      ["fact_prescriptions", "dim_doctor"],
    ];
    return {
      id,
      sql: `SELECT d.specialty,
       COUNT(*)     AS prescriptions,
       SUM(rx.cost) AS total_cost
FROM fact_prescriptions rx
JOIN dim_doctor d ON d.doctor_key = rx.doctor_key
GROUP BY d.specialty
ORDER BY prescriptions DESC;`,
      joins,
      tables: tablesOf(joins),
      columns: [
        { key: "specialty", label: "Specialty" },
        { key: "prescriptions", label: "Prescriptions", format: "int" },
        { key: "total_cost", label: "Total cost", format: "money" },
      ],
      rows,
      metrics: [
        { key: "prescriptions", label: "Prescriptions", format: "int" },
        { key: "total_cost", label: "Total cost", format: "money" },
      ],
      labelKey: "specialty",
    };
  }

  if (id === "charges") {
    const rows = PROCEDURES.map((p) => {
      const mine = VISITS.filter((v) => v.procedure_key === p.key);
      const n = mine.length;
      return {
        procedure: p.name,
        visits: n,
        avg_charge: n ? mine.reduce((s, v) => s + v.charge, 0) / n : 0,
        avg_stay: n
          ? round1(mine.reduce((s, v) => s + v.length_of_stay, 0) / n)
          : 0,
      };
    })
      .filter((r) => r.visits > 0)
      .sort((a, b) => b.avg_charge - a.avg_charge);
    const joins: [TableName, TableName][] = [["fact_visits", "dim_procedure"]];
    return {
      id,
      sql: `SELECT p.procedure_name,
       COUNT(*)                AS visits,
       AVG(v.charge)           AS avg_charge,
       AVG(v.length_of_stay)   AS avg_stay_days
FROM fact_visits v
JOIN dim_procedure p ON p.procedure_key = v.procedure_key
GROUP BY p.procedure_name
ORDER BY avg_charge DESC;`,
      joins,
      tables: tablesOf(joins),
      columns: [
        { key: "procedure", label: "Procedure" },
        { key: "visits", label: "Visits", format: "int" },
        { key: "avg_charge", label: "Avg charge", format: "money" },
        { key: "avg_stay", label: "Avg stay (days)", format: "decimal" },
      ],
      rows,
      metrics: [
        { key: "avg_charge", label: "Avg charge", format: "money" },
        { key: "avg_stay", label: "Avg stay", format: "decimal" },
      ],
      labelKey: "procedure",
    };
  }

  if (id === "states") {
    const filtered = options.quarter !== "all";
    const rows = STATES.map((s) => {
      const mine = VISITS.filter(
        (v) =>
          v.state_key === s.key &&
          (!filtered || quarterOf(v.date) === options.quarter),
      );
      return {
        state: s.name,
        visits: mine.length,
        revenue: mine.reduce((sum, v) => sum + v.charge, 0),
      };
    })
      .filter((r) => r.visits > 0)
      .sort((a, b) => b.revenue - a.revenue || a.state.localeCompare(b.state));
    const joins: [TableName, TableName][] = [["fact_visits", "dim_state"]];
    if (filtered) joins.push(["fact_visits", "dim_date"]);
    const sql = filtered
      ? `SELECT s.state_name,
       COUNT(*)      AS visits,
       SUM(v.charge) AS revenue
FROM fact_visits v
JOIN dim_state s ON s.state_key = v.state_key
JOIN dim_date  d ON d.date_key  = v.date_key
WHERE d.quarter = '${options.quarter}'
GROUP BY s.state_name
ORDER BY revenue DESC;`
      : `SELECT s.state_name,
       COUNT(*)      AS visits,
       SUM(v.charge) AS revenue
FROM fact_visits v
JOIN dim_state s ON s.state_key = v.state_key
GROUP BY s.state_name
ORDER BY revenue DESC;`;
    return {
      id,
      sql,
      joins,
      tables: tablesOf(joins),
      columns: [
        { key: "state", label: "State" },
        { key: "visits", label: "Visits", format: "int" },
        { key: "revenue", label: "Revenue", format: "money" },
      ],
      rows,
      metrics: [
        { key: "revenue", label: "Revenue", format: "money" },
        { key: "visits", label: "Visits", format: "int" },
      ],
      labelKey: "state",
    };
  }

  // scd: one doctor, grouped by the dimension row each visit was loaded against.
  const groups = new Map<
    number,
    { row: DoctorRow; n: number; revenue: number }
  >();
  for (const v of VISITS.filter((x) => x.doctor_id === MOVING_DOCTOR)) {
    const row = doctor(v.doctor_id, v.date);
    const g = groups.get(row.doctor_key) ?? { row, n: 0, revenue: 0 };
    g.n += 1;
    g.revenue += v.charge;
    groups.set(row.doctor_key, g);
  }
  const rows = [...groups.values()]
    .sort((a, b) => a.row.valid_from.localeCompare(b.row.valid_from))
    .map(({ row, n, revenue }) => ({
      doctor_key: row.doctor_key,
      specialty: row.specialty,
      valid_from: row.valid_from,
      valid_to: row.valid_to,
      visits: n,
      revenue,
      period:
        row.valid_to === OPEN_END
          ? `${row.specialty} (from ${row.valid_from})`
          : `${row.specialty} (until ${row.valid_to})`,
    }));
  const joins: [TableName, TableName][] = [["fact_visits", "dim_doctor"]];
  return {
    id,
    sql: `SELECT d.doctor_key, d.specialty,
       d.valid_from, d.valid_to,
       COUNT(*)      AS visits,
       SUM(v.charge) AS revenue
FROM fact_visits v
JOIN dim_doctor d ON d.doctor_key = v.doctor_key
WHERE d.doctor_id = '${MOVING_DOCTOR}'
GROUP BY d.doctor_key, d.specialty, d.valid_from, d.valid_to
ORDER BY d.valid_from;`,
    joins,
    tables: tablesOf(joins),
    columns: [
      { key: "doctor_key", label: "Key", format: "int" },
      { key: "specialty", label: "Specialty" },
      { key: "valid_from", label: "Valid from" },
      { key: "valid_to", label: "Valid to" },
      { key: "visits", label: "Visits", format: "int" },
      { key: "revenue", label: "Revenue", format: "money" },
    ],
    rows,
    metrics: [
      { key: "visits", label: "Visits", format: "int" },
      { key: "revenue", label: "Revenue", format: "money" },
    ],
    labelKey: "period",
  };
}

// Schema diagram layout (viewBox 0 0 680 300).
export interface DiagramNode {
  name: TableName;
  kind: "fact" | "dim";
  x: number;
  y: number;
  w: number;
  h: number;
  columns: string[];
}
export const DIAGRAM: DiagramNode[] = [
  {
    name: "dim_date",
    kind: "dim",
    x: 10,
    y: 14,
    w: 160,
    h: 62,
    columns: ["date_key PK", "month, quarter, year"],
  },
  {
    name: "dim_patient",
    kind: "dim",
    x: 10,
    y: 119,
    w: 160,
    h: 62,
    columns: ["patient_key PK", "age_band, sex"],
  },
  {
    name: "dim_doctor",
    kind: "dim",
    x: 10,
    y: 224,
    w: 160,
    h: 62,
    columns: ["doctor_key PK, doctor_id", "specialty, valid_from/to"],
  },
  {
    name: "fact_visits",
    kind: "fact",
    x: 260,
    y: 40,
    w: 160,
    h: 82,
    columns: [
      "visit_id PK",
      "patient, doctor, date FKs",
      "procedure, state FKs",
      "charge, length_of_stay",
    ],
  },
  {
    name: "fact_prescriptions",
    kind: "fact",
    x: 260,
    y: 170,
    w: 160,
    h: 82,
    columns: ["rx_id PK", "patient, doctor, date FKs", "drug, quantity, cost"],
  },
  {
    name: "dim_procedure",
    kind: "dim",
    x: 510,
    y: 30,
    w: 160,
    h: 62,
    columns: ["procedure_key PK", "procedure_name, category"],
  },
  {
    name: "dim_state",
    kind: "dim",
    x: 510,
    y: 124,
    w: 160,
    h: 62,
    columns: ["state_key PK", "state_name, region"],
  },
];
export const EDGES: [TableName, TableName][] = [
  ["fact_visits", "dim_date"],
  ["fact_visits", "dim_patient"],
  ["fact_visits", "dim_doctor"],
  ["fact_visits", "dim_procedure"],
  ["fact_visits", "dim_state"],
  ["fact_prescriptions", "dim_date"],
  ["fact_prescriptions", "dim_patient"],
  ["fact_prescriptions", "dim_doctor"],
];
