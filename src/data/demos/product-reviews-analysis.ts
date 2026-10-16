// Synthetic two-table review database (products, reviews joined by product_id),
// the import clean-up rules, and the SQL each action would run.

export interface Product {
  product_id: number;
  product_name: string;
  brand: string;
  screen_size: number;
  price: number;
}
export interface Review {
  review_id: number;
  product_id: number;
  reviewer: string;
  rating: number;
  review_text: string;
  review_date: string;
}
export interface State {
  products: Product[];
  reviews: Review[];
  imported: boolean;
}

export const PRODUCTS: Product[] = [
  {
    product_id: 1,
    product_name: "Lumio 27 QHD Monitor",
    brand: "Lumio",
    screen_size: 27,
    price: 289.99,
  },
  {
    product_id: 2,
    product_name: "Veridian 24 Full HD",
    brand: "Veridian",
    screen_size: 24,
    price: 129.0,
  },
  {
    product_id: 3,
    product_name: "Aperture 32 4K UHD",
    brand: "Aperture",
    screen_size: 32,
    price: 449.5,
  },
  {
    product_id: 4,
    product_name: "Northwind 34 Ultrawide",
    brand: "Northwind",
    screen_size: 34,
    price: 399.0,
  },
  {
    product_id: 5,
    product_name: "Halcyon 27 Curved Gaming",
    brand: "Halcyon",
    screen_size: 27,
    price: 319.95,
  },
];

const SEED_REVIEWS: Review[] = [
  {
    review_id: 1,
    product_id: 1,
    reviewer: "Alex R.",
    rating: 5,
    review_text: "Sharp text and accurate colors out of the box.",
    review_date: "2025-01-12",
  },
  {
    review_id: 2,
    product_id: 1,
    reviewer: "Dana W.",
    rating: 4,
    review_text: "Great picture, stand is a bit basic.",
    review_date: "2025-01-28",
  },
  {
    review_id: 3,
    product_id: 1,
    reviewer: "Sam T.",
    rating: 3,
    review_text: "Fine for office work. Speakers are weak.",
    review_date: "2025-02-09",
  },
  {
    review_id: 4,
    product_id: 2,
    reviewer: "Lee P.",
    rating: 4,
    review_text: "Good value for a second screen.",
    review_date: "2025-01-19",
  },
  {
    review_id: 5,
    product_id: 2,
    reviewer: "Morgan C.",
    rating: 2,
    review_text: "Washed-out colors at an angle.",
    review_date: "2025-02-02",
  },
  {
    review_id: 6,
    product_id: 3,
    reviewer: "Ines V.",
    rating: 5,
    review_text: "4K is stunning for photo editing.",
    review_date: "2025-02-14",
  },
  {
    review_id: 7,
    product_id: 3,
    reviewer: "Chris B.",
    rating: 4,
    review_text: "Excellent panel, pricey but worth it.",
    review_date: "2025-02-21",
  },
  {
    review_id: 8,
    product_id: 3,
    reviewer: "Noor A.",
    rating: 3,
    review_text: "Needs scaling tweaks on my laptop.",
    review_date: "2025-03-01",
  },
  {
    review_id: 9,
    product_id: 4,
    reviewer: "Jules F.",
    rating: 5,
    review_text: "Ultrawide replaced my two-monitor setup.",
    review_date: "2025-01-30",
  },
  {
    review_id: 10,
    product_id: 4,
    reviewer: "Pat H.",
    rating: 4,
    review_text: "Roomy desktop, a little dim indoors.",
    review_date: "2025-02-17",
  },
  {
    review_id: 11,
    product_id: 5,
    reviewer: "Kai M.",
    rating: 5,
    review_text: "Smooth motion and a gentle curve.",
    review_date: "2025-02-05",
  },
  {
    review_id: 12,
    product_id: 5,
    reviewer: "Ren O.",
    rating: 3,
    review_text: "Fast, but the menu is confusing.",
    review_date: "2025-02-26",
  },
  {
    review_id: 13,
    product_id: 5,
    reviewer: "Tess L.",
    rating: 4,
    review_text: "Nice build quality for the price.",
    review_date: "2025-03-04",
  },
  {
    review_id: 14,
    product_id: 2,
    reviewer: "Omar D.",
    rating: 5,
    review_text: "Perfect for a home office desk.",
    review_date: "2025-03-06",
  },
];

export function createState(): State {
  return {
    products: structuredClone(PRODUCTS),
    reviews: structuredClone(SEED_REVIEWS),
    imported: false,
  };
}

// ---------- SQL text ----------

export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export const SCHEMA = [
  {
    table: "products",
    columns: ["product_id PK", "product_name", "brand", "screen_size", "price"],
  },
  {
    table: "reviews",
    columns: [
      "review_id PK",
      "product_id FK",
      "reviewer",
      "rating",
      "review_text",
      "review_date",
    ],
  },
];

// ---------- clean-up for import ----------

export interface RawRow {
  product_id: string;
  reviewer: string;
  rating: string;
  review_text: string;
  review_date: string;
}

export const RAW_ROWS: RawRow[] = [
  {
    product_id: " 1 ",
    reviewer: "  jess_m ",
    rating: "5 stars",
    review_text: "  Colors are GREAT!!  \n\nSetup took 2 min…  ",
    review_date: "3/7/2025",
  },
  {
    product_id: "2",
    reviewer: "Omar  K.",
    rating: "4",
    review_text: "Good value &amp; sharp text – no dead pixels 👍",
    review_date: "2025.03.09",
  },
  {
    product_id: "3",
    reviewer: "PriyaN",
    rating: "3.0",
    review_text: "It’s “fine” but the stand wobbles.\tReturned the stand.",
    review_date: "Mar 12, 2025",
  },
  {
    product_id: "5",
    reviewer: "d.brandt",
    rating: "5",
    review_text: "Smooth 165Hz   — no tearing",
    review_date: "14th March 2025",
  },
  {
    product_id: "4",
    reviewer: "S. O'Connell",
    rating: "2 / 5",
    review_text: "Backlight bleed on the left edge,   needs   a firmer   panel",
    review_date: "15 Mar 2025",
  },
  {
    product_id: "2",
    reviewer: "anon",
    rating: "4",
    review_text: "Fine",
    review_date: "13/45/2025",
  },
];

export type Change =
  "whitespace" | "entities" | "punctuation" | "emoji" | "date" | "rating";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

export function cleanText(
  raw: string,
  max = 500,
): { value: string; changes: Change[] } {
  const changes = new Set<Change>();
  let s = raw;
  const step = (next: string, change: Change) => {
    if (next !== s) changes.add(change);
    s = next;
  };
  step(
    s
      .replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m])
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))),
    "entities",
  );
  step(
    s
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "..."),
    "punctuation",
  );
  step(s.replace(/\s+/g, " ").trim(), "whitespace");
  step(s.replace(/[^\x20-\x7e]/g, ""), "emoji");
  step(s.replace(/\s+/g, " ").trim(), "whitespace");
  return { value: s.slice(0, max), changes: [...changes] };
}

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

function iso(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null;
  return date.toISOString().slice(0, 10);
}

export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return iso(+m[3], +m[1], +m[2]);
  m = s.match(/^([A-Za-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    return month ? iso(+m[3], month, +m[2]) : null;
  }
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]{3,9})\.?,? (\d{4})$/);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return month ? iso(+m[3], month, +m[1]) : null;
  }
  return null;
}

export function parseRating(raw: string): number | null {
  const m = raw.trim().match(/^(\d(?:\.\d)?)/);
  if (!m) return null;
  const n = Math.round(Number(m[1]));
  return n >= 1 && n <= 5 ? n : null;
}

export interface CleanResult {
  ok: boolean;
  error?: string;
  row?: Omit<Review, "review_id">;
  changes: Record<
    "product_id" | "reviewer" | "rating" | "review_text" | "review_date",
    boolean
  >;
  labels: Change[];
}

export function cleanRow(
  raw: RawRow,
  products: Product[] = PRODUCTS,
): CleanResult {
  const reviewer = cleanText(raw.reviewer, 60);
  const text = cleanText(raw.review_text);
  const date = parseDate(raw.review_date);
  const rating = parseRating(raw.rating);
  const productId = Number(raw.product_id.trim());
  const labels = new Set<Change>([...reviewer.changes, ...text.changes]);
  if (date !== null && date !== raw.review_date) labels.add("date");
  if (rating !== null && String(rating) !== raw.rating) labels.add("rating");
  const changes = {
    product_id: String(productId) !== raw.product_id,
    reviewer: reviewer.value !== raw.reviewer,
    rating: rating !== null && String(rating) !== raw.rating,
    review_text: text.value !== raw.review_text,
    review_date: date !== null && date !== raw.review_date,
  };
  let error: string | undefined;
  if (!products.some((p) => p.product_id === productId))
    error = "Unknown product";
  else if (rating === null) error = "Rating not recognised";
  else if (date === null) error = "Date not recognised";
  else if (!text.value || !reviewer.value) error = "Missing text";
  if (error) return { ok: false, error, changes, labels: [...labels] };
  return {
    ok: true,
    row: {
      product_id: productId,
      reviewer: reviewer.value,
      rating: rating!,
      review_text: text.value,
      review_date: date!,
    },
    changes,
    labels: [...labels],
  };
}

export function cleanAll(rows: RawRow[] = RAW_ROWS): CleanResult[] {
  return rows.map((r) => cleanRow(r));
}

// ---------- CRUD ----------

export interface ReviewInput {
  product_id: number;
  reviewer: string;
  rating: number;
  review_text: string;
  review_date: string;
}
export interface Write {
  ok: boolean;
  error?: string;
  kind: "INSERT" | "UPDATE" | "DELETE";
  sql: string;
  ids: number[];
}

const fail = (kind: Write["kind"], error: string): Write => ({
  ok: false,
  error,
  kind,
  sql: "",
  ids: [],
});

function validate(state: State, input: ReviewInput): string | null {
  if (!state.products.some((p) => p.product_id === input.product_id))
    return "Choose a product.";
  if (!input.reviewer.trim()) return "Add a reviewer.";
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    return "Rating must be 1 to 5.";
  if (!input.review_text.trim()) return "Add review text.";
  if (input.review_text.length > 500)
    return "Keep the review under 500 characters.";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.review_date) ||
    parseDate(input.review_date) !== input.review_date
  )
    return "Choose a valid date.";
  return null;
}

const COLUMNS = "product_id, reviewer, rating, review_text, review_date";
const values = (r: ReviewInput) =>
  `(${r.product_id}, ${sqlString(r.reviewer)}, ${r.rating}, ${sqlString(r.review_text)}, ${sqlString(r.review_date)})`;

function nextId(state: State) {
  return state.reviews.reduce((m, r) => Math.max(m, r.review_id), 0) + 1;
}

export function insertReview(state: State, input: ReviewInput): Write {
  const clean = {
    ...input,
    reviewer: input.reviewer.trim(),
    review_text: input.review_text.trim(),
  };
  const error = validate(state, clean);
  if (error) return fail("INSERT", error);
  const review_id = nextId(state);
  state.reviews.push({ review_id, ...clean });
  return {
    ok: true,
    kind: "INSERT",
    sql: `INSERT INTO reviews (${COLUMNS})\nVALUES ${values(clean)};`,
    ids: [review_id],
  };
}

export function updateReview(
  state: State,
  id: number,
  input: ReviewInput,
): Write {
  const review = state.reviews.find((r) => r.review_id === id);
  if (!review) return fail("UPDATE", "That review no longer exists.");
  const clean = {
    ...input,
    reviewer: input.reviewer.trim(),
    review_text: input.review_text.trim(),
  };
  const error = validate(state, clean);
  if (error) return fail("UPDATE", error);
  const sets: string[] = [];
  const literal = (v: string | number) =>
    typeof v === "number" ? String(v) : sqlString(v);
  for (const key of [
    "product_id",
    "reviewer",
    "rating",
    "review_text",
    "review_date",
  ] as const) {
    if (review[key] !== clean[key])
      sets.push(`${key} = ${literal(clean[key])}`);
  }
  if (!sets.length) return fail("UPDATE", "Nothing changed.");
  Object.assign(review, clean);
  return {
    ok: true,
    kind: "UPDATE",
    sql: `UPDATE reviews\nSET ${sets.join(",\n    ")}\nWHERE review_id = ${id};`,
    ids: [id],
  };
}

export function deleteReview(state: State, id: number): Write {
  const index = state.reviews.findIndex((r) => r.review_id === id);
  if (index < 0) return fail("DELETE", "That review no longer exists.");
  state.reviews.splice(index, 1);
  return {
    ok: true,
    kind: "DELETE",
    sql: `DELETE FROM reviews\nWHERE review_id = ${id};`,
    ids: [id],
  };
}

export function importCleaned(
  state: State,
  results: CleanResult[] = cleanAll(),
): Write {
  const rows = results.filter((r) => r.ok).map((r) => r.row!);
  if (state.imported || !rows.length)
    return fail("INSERT", "Nothing to import.");
  const ids: number[] = [];
  for (const row of rows) {
    const review_id = nextId(state);
    state.reviews.push({ review_id, ...row });
    ids.push(review_id);
  }
  state.imported = true;
  return {
    ok: true,
    kind: "INSERT",
    sql: importSql(rows),
    ids,
  };
}

export function importSql(rows: ReviewInput[]): string {
  return `INSERT INTO reviews (${COLUMNS})\nVALUES\n${rows.map((r) => `  ${values(r)}`).join(",\n")};`;
}

export interface Filter {
  productId?: number;
  minRating?: number;
}

export function selectReviews(state: State, filter: Filter = {}) {
  const where: string[] = [];
  if (filter.productId) where.push(`r.product_id = ${filter.productId}`);
  if (filter.minRating) where.push(`r.rating >= ${filter.minRating}`);
  const rows = state.reviews
    .filter(
      (r) =>
        (!filter.productId || r.product_id === filter.productId) &&
        (!filter.minRating || r.rating >= filter.minRating),
    )
    .sort(
      (a, b) =>
        b.review_date.localeCompare(a.review_date) || b.review_id - a.review_id,
    )
    .map((r) => ({
      ...r,
      product_name: state.products.find((p) => p.product_id === r.product_id)!
        .product_name,
    }));
  const sql = `SELECT r.review_id, p.product_name, r.reviewer, r.rating,
       r.review_text, r.review_date
FROM reviews r
JOIN products p ON p.product_id = r.product_id${where.length ? `\nWHERE ${where.join("\n  AND ")}` : ""}
ORDER BY r.review_date DESC, r.review_id DESC;`;
  return { sql, rows };
}

export function productStats(state: State) {
  return state.products.map((product) => {
    const mine = state.reviews.filter(
      (r) => r.product_id === product.product_id,
    );
    return {
      product,
      count: mine.length,
      average: mine.length
        ? mine.reduce((s, r) => s + r.rating, 0) / mine.length
        : null,
    };
  });
}
