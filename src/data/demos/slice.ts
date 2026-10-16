/* Pure logic and synthetic data for the Slice of the Burg demo. No DOM. */

export interface MenuItem {
  name: string;
  price: string;
  description: string;
}
export interface MenuSection {
  title: string;
  description: string;
  items: MenuItem[];
}
export interface Menu {
  note: string;
  sections: MenuSection[];
}
export type ParseResult =
  { ok: true; menu: Menu; itemCount: number } | { ok: false; error: string };

/* Same shape as the site's menus.json (note + sections of items), with
   adapted items and prices. */
export const SAMPLE_MENU = {
  note: "Vegetarian and gluten free options are marked in item descriptions where available.",
  sections: [
    {
      title: "Starters",
      items: [
        {
          name: "Garlic Knots",
          price: "(6) $5.99 / (12) $9.59",
          description: "Vegetarian. Served with marinara.",
        },
        {
          name: "Mozzarella Sticks",
          price: "$8.49",
          description: "Vegetarian. Seven pieces.",
        },
        {
          name: "Loaded Fries or Tots",
          price: "$9.49",
          description: "Cheese, bacon, jalapenos and ranch.",
        },
        {
          name: "Fried Mushrooms",
          price: "",
          description: "Served with ranch or zesty sauce.",
        },
      ],
    },
    {
      title: "Pizza",
      description: "Hand-tossed, 18 inch. Add any topping for $2.50.",
      items: [
        {
          name: "Cheese Pie",
          price: "$18.99",
          description: "Vegetarian. House blend mozzarella.",
        },
        {
          name: "Pepperoni Pie",
          price: "$21.49",
          description: "Cup-and-char pepperoni.",
        },
        {
          name: "The Burg",
          price: "$26.99",
          description: "Sausage, peppers, onions, mushrooms and extra cheese.",
        },
      ],
    },
    {
      title: "Sandwiches",
      items: [
        {
          name: "Philly Cheesesteak",
          price: "$12.49",
          description: "Shaved steak, onions and provolone on a toasted roll.",
        },
        {
          name: "Chicken Parm Sub",
          price: "$11.99",
          description: "Breaded chicken, marinara and mozzarella.",
        },
      ],
    },
  ],
};

export function formatMenu(menu: unknown): string {
  return JSON.stringify(menu, null, 2);
}

const MAX_TEXT = 24000;
const MAX_SECTIONS = 24;
const MAX_ITEMS = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown, path: string): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value.trim();
  throw new Error(`${path} must be text`);
}

function requiredText(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${path} must be non-empty text`);
  return value.trim();
}

function priceText(value: unknown, path: string): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0)
      throw new Error(`${path} must be a positive number or text`);
    return `$${value.toFixed(2)}`;
  }
  return optionalText(value, path);
}

/* Validates the menu JSON the way the site's build step reads it. Never
   throws: a bad edit returns an error message and the caller keeps its last
   good menu. */
export function parseMenu(text: string): ParseResult {
  if (text.length > MAX_TEXT)
    return { ok: false, error: "Menu is too long for this sample" };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return { ok: false, error: `Invalid JSON: ${message}` };
  }
  try {
    if (!isRecord(data)) throw new Error("Menu must be an object");
    const note = optionalText(data.note, "note");
    if (!Array.isArray(data.sections))
      throw new Error("sections must be a list");
    if (data.sections.length > MAX_SECTIONS)
      throw new Error(`sections can hold at most ${MAX_SECTIONS}`);
    if (!data.sections.length) throw new Error("sections is empty");
    let itemCount = 0;
    const sections = data.sections.map((raw: unknown, s: number) => {
      const at = `sections[${s}]`;
      if (!isRecord(raw)) throw new Error(`${at} must be an object`);
      if (!Array.isArray(raw.items))
        throw new Error(`${at}.items must be a list`);
      if (raw.items.length > MAX_ITEMS)
        throw new Error(`${at}.items can hold at most ${MAX_ITEMS}`);
      const items = raw.items.map((entry: unknown, i: number) => {
        const path = `${at}.items[${i}]`;
        if (!isRecord(entry)) throw new Error(`${path} must be an object`);
        itemCount++;
        return {
          name: requiredText(entry.name, `${path}.name`),
          price: priceText(entry.price, `${path}.price`),
          description: optionalText(entry.description, `${path}.description`),
        };
      });
      return {
        title: requiredText(raw.title, `${at}.title`),
        description: optionalText(raw.description, `${at}.description`),
        items,
      };
    });
    return { ok: true, menu: { note, sections }, itemCount };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid menu",
    };
  }
}

/* ---------- Menu analysis ---------- */

export type Quadrant = "star" | "plowhorse" | "puzzle" | "dog";

export const QUADRANTS: {
  id: Quadrant;
  label: string;
  note: string;
}[] = [
  { id: "star", label: "Stars", note: "Popular, high margin" },
  { id: "plowhorse", label: "Plowhorses", note: "Popular, low margin" },
  { id: "puzzle", label: "Puzzles", note: "Less popular, high margin" },
  { id: "dog", label: "Dogs", note: "Less popular, low margin" },
];

export interface SalesItem {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  /* Invented average units sold per week. */
  weekly: number;
}

export const SALES_ITEMS: SalesItem[] = [
  {
    id: "cheese-pie",
    name: "Cheese Pie",
    category: "Pizza",
    price: 18.99,
    cost: 4.9,
    weekly: 118,
  },
  {
    id: "pepperoni-pie",
    name: "Pepperoni Pie",
    category: "Pizza",
    price: 21.49,
    cost: 6.4,
    weekly: 132,
  },
  {
    id: "the-burg",
    name: "The Burg",
    category: "Pizza",
    price: 26.99,
    cost: 9.8,
    weekly: 54,
  },
  {
    id: "white-pie",
    name: "White Pie",
    category: "Pizza",
    price: 22.49,
    cost: 6.9,
    weekly: 33,
  },
  {
    id: "veggie-pie",
    name: "Garden Veggie Pie",
    category: "Pizza",
    price: 23.99,
    cost: 9.4,
    weekly: 19,
  },
  {
    id: "garlic-knots",
    name: "Garlic Knots",
    category: "Starters",
    price: 5.99,
    cost: 1.1,
    weekly: 96,
  },
  {
    id: "mozz-sticks",
    name: "Mozzarella Sticks",
    category: "Starters",
    price: 8.49,
    cost: 2.7,
    weekly: 64,
  },
  {
    id: "loaded-fries",
    name: "Loaded Fries",
    category: "Starters",
    price: 9.49,
    cost: 3.4,
    weekly: 40,
  },
  {
    id: "boneless-wings",
    name: "Boneless Wings",
    category: "Wings",
    price: 12.99,
    cost: 5.6,
    weekly: 85,
  },
  {
    id: "bone-in-wings",
    name: "Bone-in Wings",
    category: "Wings",
    price: 14.99,
    cost: 7.9,
    weekly: 71,
  },
  {
    id: "philly",
    name: "Philly Cheesesteak",
    category: "Sandwiches",
    price: 12.49,
    cost: 5.5,
    weekly: 78,
  },
  {
    id: "chicken-parm",
    name: "Chicken Parm Sub",
    category: "Sandwiches",
    price: 11.99,
    cost: 4.2,
    weekly: 36,
  },
  {
    id: "calzone",
    name: "Calzone",
    category: "Baked",
    price: 12.79,
    cost: 4.0,
    weekly: 42,
  },
  {
    id: "baked-ziti",
    name: "Baked Ziti",
    category: "Entrees",
    price: 13.99,
    cost: 4.1,
    weekly: 21,
  },
  {
    id: "caesar",
    name: "Caesar Salad",
    category: "Salads",
    price: 11.49,
    cost: 2.9,
    weekly: 17,
  },
  {
    id: "fountain-drink",
    name: "Fountain Drink",
    category: "Beverages",
    price: 2.99,
    cost: 0.35,
    weekly: 140,
  },
  {
    id: "cannoli",
    name: "Cannoli",
    category: "Desserts",
    price: 4.99,
    cost: 1.9,
    weekly: 31,
  },
];

export type PeriodId = "week" | "month" | "quarter";

export const PERIODS: {
  id: PeriodId;
  label: string;
  weeks: number;
  /* Invented week-to-week swing: shorter windows are noisier. */
  swing: number;
}[] = [
  { id: "week", label: "Last week", weeks: 1, swing: 0.3 },
  { id: "month", label: "Last 4 weeks", weeks: 4, swing: 0.16 },
  { id: "quarter", label: "Last quarter", weeks: 13, swing: 0.09 },
];

/* Deterministic noise in [-1, 1] from a string key (FNV-1a). */
export function noise(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967295) * 2 - 1;
}

export interface Thresholds {
  /* Mix share at or above which an item counts as popular (0.7 / N rule). */
  popularity: number;
  /* Weighted average contribution margin per unit, in dollars. */
  margin: number;
}

export function classify(
  mix: number,
  margin: number,
  thresholds: Thresholds,
): Quadrant {
  const popular = mix >= thresholds.popularity;
  const rich = margin >= thresholds.margin;
  if (popular) return rich ? "star" : "plowhorse";
  return rich ? "puzzle" : "dog";
}

export interface AnalysisRow {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  units: number;
  /* Share of all units sold, 0..1. */
  mix: number;
  /* Contribution margin per unit, in dollars. */
  margin: number;
  revenue: number;
  contribution: number;
  quadrant: Quadrant;
}

export interface Analysis {
  period: PeriodId;
  label: string;
  rows: AnalysisRow[];
  thresholds: Thresholds;
  totals: { units: number; revenue: number; contribution: number };
  counts: Record<Quadrant, number>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function analyze(
  periodId: PeriodId,
  items: SalesItem[] = SALES_ITEMS,
): Analysis {
  const period = PERIODS.find((entry) => entry.id === periodId) ?? PERIODS[1];
  const base = items.map((item) => {
    const wobble = 1 + period.swing * noise(`${item.id}:units:${period.id}`);
    const cost = round2(
      item.cost * (1 + 0.05 * noise(`${item.id}:cost:${period.id}`)),
    );
    const units = Math.max(1, Math.round(item.weekly * period.weeks * wobble));
    return { item, cost, units };
  });
  const totalUnits = base.reduce((sum, entry) => sum + entry.units, 0);
  const totalContribution = base.reduce(
    (sum, entry) => sum + entry.units * (entry.item.price - entry.cost),
    0,
  );
  const thresholds: Thresholds = {
    popularity: 0.7 / items.length,
    margin: totalContribution / totalUnits,
  };
  const rows: AnalysisRow[] = base.map(({ item, cost, units }) => {
    const margin = round2(item.price - cost);
    const mix = units / totalUnits;
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      cost,
      units,
      mix,
      margin,
      revenue: round2(units * item.price),
      contribution: round2(units * margin),
      quadrant: classify(mix, margin, thresholds),
    };
  });
  const counts: Record<Quadrant, number> = {
    star: 0,
    plowhorse: 0,
    puzzle: 0,
    dog: 0,
  };
  rows.forEach((row) => counts[row.quadrant]++);
  return {
    period: period.id,
    label: period.label,
    rows,
    thresholds,
    totals: {
      units: totalUnits,
      revenue: round2(rows.reduce((sum, row) => sum + row.revenue, 0)),
      contribution: round2(
        rows.reduce((sum, row) => sum + row.contribution, 0),
      ),
    },
    counts,
  };
}

export type SortKey = "name" | "units" | "margin" | "contribution";

export function sortRows(
  rows: AnalysisRow[],
  key: SortKey,
  descending = key !== "name",
): AnalysisRow[] {
  const direction = descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    const diff =
      key === "name" ? a.name.localeCompare(b.name) : a[key] - b[key];
    return diff * direction || a.name.localeCompare(b.name);
  });
}

export interface Plot {
  width: number;
  height: number;
  pad: { top: number; right: number; bottom: number; left: number };
}

export interface PlotScale {
  xMax: number;
  yMax: number;
  x: (mix: number) => number;
  y: (margin: number) => number;
}

/* Linear scales for the matrix: popularity (mix share) across, contribution
   margin up. Domains are rounded up so the thresholds sit inside the plot. */
export function plotScale(analysis: Analysis, plot: Plot): PlotScale {
  const maxMix = Math.max(
    analysis.thresholds.popularity * 1.4,
    ...analysis.rows.map((row) => row.mix),
  );
  const maxMargin = Math.max(
    analysis.thresholds.margin * 1.3,
    ...analysis.rows.map((row) => row.margin),
  );
  const xMax = (Math.ceil((maxMix * 100 * 1.05) / 2) * 2) / 100;
  const yMax = Math.ceil((maxMargin * 1.05) / 2) * 2;
  const innerW = plot.width - plot.pad.left - plot.pad.right;
  const innerH = plot.height - plot.pad.top - plot.pad.bottom;
  return {
    xMax,
    yMax,
    x: (mix) => plot.pad.left + (mix / xMax) * innerW,
    y: (margin) => plot.pad.top + innerH - (margin / yMax) * innerH,
  };
}

export function money(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function percent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}
