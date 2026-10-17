// Synthetic data and pure logic for the EduInsight enrollment sample.

export type Enrollment = {
  id: number;
  student: string;
  program: string;
  term: string;
  gpa: number;
  enrolled: string;
};

export type Draft = {
  student: string;
  program: string;
  term: string;
  gpa: string;
  enrolled: string;
};

export type Filters = { program: string; term: string };
export type Errors = Partial<Record<keyof Draft, string>>;

export const PROGRAMS = [
  { name: "Computer Science", short: "Computer Sci.", peer: 3.05 },
  { name: "Nursing", short: "Nursing", peer: 3.3 },
  { name: "Business Administration", short: "Business", peer: 3.1 },
  { name: "Biology", short: "Biology", peer: 3.0 },
  { name: "Education", short: "Education", peer: 3.4 },
  { name: "Mechanical Engineering", short: "Mech. Eng.", peer: 2.95 },
];
export const TERMS = ["Fall 2024", "Spring 2025", "Fall 2025", "Spring 2026"];

export const GPA_BINS = [
  { label: "Under 2.0", min: 0, max: 2 },
  { label: "2.0-2.4", min: 2, max: 2.5 },
  { label: "2.5-2.9", min: 2.5, max: 3 },
  { label: "3.0-3.4", min: 3, max: 3.5 },
  { label: "3.5-4.0", min: 3.5, max: 4.01 },
];

export const SAMPLE_CSV = `student,program,term,gpa,enrolled
Maya Okafor,Nursing,Spring 2025,3.30,2025-01-25
Owen Lindqvist,Business Administration,Fall 2025,2.86,2025-09-12
Priya Marsh,Computer Science,Spring 2025,3.55,2025-01-14
Lucas Varga,Nursing,Spring 2026,3.64,2026-01-13
Nadia Castillo,Education,Fall 2024,2.94,2024-09-02
Theo Nair,Computer Science,Spring 2026,2.71,2026-01-13
Elena Brandt,Mechanical Engineering,Fall 2024,3.18,2024-09-12
Marcus Ito,Computer Science,Fall 2024,2.86,2024-09-13
Aisha Delgado,Nursing,Spring 2025,2.84,2025-01-16
Jonas Haddad,Nursing,Fall 2024,3.08,2024-09-13
Camila Whitlock,Computer Science,Spring 2025,2.95,2025-01-28
Dev Moreau,Nursing,Spring 2026,2.97,2026-01-23
Freya Kapoor,Nursing,Spring 2025,3.73,2025-01-20
Hugo Sandoval,Business Administration,Fall 2025,3.19,2025-09-08
Leila Ng,Nursing,Fall 2024,3.13,2024-08-29
Noah Fischer,Nursing,Spring 2026,3.38,2026-01-25
Imani Adeyemi,Computer Science,Fall 2024,2.33,2024-09-12
Felix Rossi,Nursing,Fall 2025,2.99,2025-09-09
Sofia Bauer,Business Administration,Spring 2026,3.58,2026-01-14
Rohan Tanaka,Business Administration,Fall 2024,2.09,2024-08-27
Tessa Quinn,Education,Fall 2025,4.00,2025-09-12
Mateo Ferreira,Nursing,Spring 2026,3.36,2026-02-02
Anika Mbeki,Nursing,Spring 2026,3.51,2026-01-23
Caleb Holm,Computer Science,Fall 2025,3.35,2025-08-29
Yara Sato,Education,Spring 2026,3.81,2026-01-24
Ivan Petrov,Computer Science,Spring 2026,2.89,2026-01-29
Zoe Alvarez,Nursing,Spring 2025,3.64,2025-01-26
Amir Khan,Business Administration,Fall 2025,2.73,2025-09-06
Greta Doyle,Mechanical Engineering,Spring 2025,3.10,2025-01-15
Kofi Lund,Nursing,Spring 2026,3.69,2026-01-30
Lina Osei,Computer Science,Fall 2025,3.49,2025-08-25
Pablo Reyes,Biology,Fall 2025,3.54,2025-08-29
Rhea Vogel,Biology,Fall 2024,3.73,2024-09-09
Soren Chen,Mechanical Engineering,Spring 2026,2.49,2026-01-24
Wren Dubois,Business Administration,Fall 2024,2.89,2024-09-10
Idris Hale,Computer Science,Spring 2025,3.03,2025-01-27
`;

// Minimal CSV reader: quoted fields, doubled quotes, CRLF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function loadEnrollments(csv: string = SAMPLE_CSV): Enrollment[] {
  const [head, ...body] = parseCsv(csv);
  const col = (name: string) => head.indexOf(name);
  const [s, p, t, g, d] = ["student", "program", "term", "gpa", "enrolled"].map(
    col,
  );
  return body.map((r, i) => ({
    id: i + 1,
    student: r[s].trim(),
    program: r[p].trim(),
    term: r[t].trim(),
    gpa: Number(r[g]),
    enrolled: r[d].trim(),
  }));
}

function realDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateDraft(draft: Draft): {
  ok: boolean;
  errors: Errors;
  value?: Omit<Enrollment, "id">;
} {
  const errors: Errors = {};
  const student = draft.student.trim();
  if (!student) errors.student = "Enter a student.";
  else if (student.length > 60)
    errors.student = "Keep the student name within 60 characters.";
  if (!PROGRAMS.some((p) => p.name === draft.program))
    errors.program = "Choose a program.";
  if (!TERMS.includes(draft.term)) errors.term = "Choose a term.";
  const gpaText = draft.gpa.trim();
  const gpa = Number(gpaText);
  if (!gpaText) errors.gpa = "Enter a GPA.";
  else if (!/^\d+(\.\d{1,2})?$/.test(gpaText))
    errors.gpa = "Use a GPA with up to two decimals.";
  else if (gpa < 0 || gpa > 4) errors.gpa = "GPA must be between 0 and 4.";
  if (!draft.enrolled) errors.enrolled = "Enter an enrollment date.";
  else if (!realDate(draft.enrolled))
    errors.enrolled = "Enter a valid enrollment date.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    errors,
    value: {
      student,
      program: draft.program,
      term: draft.term,
      gpa: Math.round(gpa * 100) / 100,
      enrolled: draft.enrolled,
    },
  };
}

export function filterRecords(rows: Enrollment[], f: Filters): Enrollment[] {
  return rows.filter(
    (r) =>
      (!f.program || r.program === f.program) && (!f.term || r.term === f.term),
  );
}

export function sortRecords(rows: Enrollment[]): Enrollment[] {
  return [...rows].sort(
    (a, b) =>
      b.enrolled.localeCompare(a.enrolled) ||
      a.student.localeCompare(b.student),
  );
}

export function byProgram(rows: Enrollment[]) {
  return PROGRAMS.map((p) => ({
    program: p.name,
    short: p.short,
    count: rows.filter((r) => r.program === p.name).length,
  }));
}

export function gpaDistribution(rows: Enrollment[]) {
  return GPA_BINS.map((b) => ({
    label: b.label,
    count: rows.filter((r) => r.gpa >= b.min && r.gpa < b.max).length,
  }));
}

export function averageGpa(rows: Enrollment[]): number | null {
  if (!rows.length) return null;
  return rows.reduce((sum, r) => sum + r.gpa, 0) / rows.length;
}

// Peer figure weighted by the programs present in the current selection.
export function benchmark(rows: Enrollment[]) {
  const sample = averageGpa(rows);
  if (sample === null) return null;
  const peer =
    rows.reduce(
      (sum, r) => sum + (PROGRAMS.find((p) => p.name === r.program)?.peer ?? 0),
      0,
    ) / rows.length;
  return { sample, peer, delta: sample - peer };
}
