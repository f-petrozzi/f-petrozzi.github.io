// Synthetic data and pure logic for the Tixly purchase-flow sample.

export type EventInfo = {
  id: string;
  title: string;
  category: string;
  date: string;
  venue: string;
  about: string;
  base: number;
  hue: number;
  sold: number;
};

export type SoldTicket = { id: string; eventId: string; seat: string };

export type ScanResult = {
  status: "admit" | "used" | "unknown" | "empty";
  id: string;
  ticket?: SoldTicket;
};

export const ROWS = ["A", "B", "C", "D", "E", "F"];
export const COLS = 8;
export const MAX_QTY = 6;
export const QR_SIZE = 25;

export const EVENTS: EventInfo[] = [
  {
    id: "harbor-lights",
    title: "Harbor Lights Festival",
    category: "Music",
    date: "Sat 14 Mar, 7:30 PM",
    venue: "Pier Arena",
    about: "Three stages of indie and electronic sets on the waterfront.",
    base: 48,
    hue: 265,
    sold: 0.45,
  },
  {
    id: "midnight-comedy",
    title: "Midnight Comedy Hour",
    category: "Comedy",
    date: "Fri 20 Mar, 9:00 PM",
    venue: "Lantern Theatre",
    about: "Five stand-up sets and a rotating host.",
    base: 32,
    hue: 25,
    sold: 0.3,
  },
  {
    id: "riverside-jazz",
    title: "Riverside Jazz Night",
    category: "Music",
    date: "Thu 26 Mar, 8:00 PM",
    venue: "Old Mill Hall",
    about: "A quartet and guest vocalists in a converted mill.",
    base: 38,
    hue: 200,
    sold: 0.55,
  },
  {
    id: "city-fc",
    title: "City FC vs Rovers",
    category: "Sports",
    date: "Sun 29 Mar, 3:00 PM",
    venue: "Northgate Stadium",
    about: "League fixture, family section on the east side.",
    base: 55,
    hue: 140,
    sold: 0.65,
  },
  {
    id: "glass-orchard",
    title: "The Glass Orchard",
    category: "Theatre",
    date: "Sat 4 Apr, 7:00 PM",
    venue: "Civic Playhouse",
    about: "A new play in two acts with a live score.",
    base: 65,
    hue: 335,
    sold: 0.4,
  },
];

export const STEPS = [
  { id: "browse", label: "Browse" },
  { id: "detail", label: "Event" },
  { id: "seats", label: "Seats" },
  { id: "checkout", label: "Checkout" },
  { id: "wallet", label: "Wallet" },
  { id: "door", label: "Door" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

export const SERVICES = [
  { id: "app", name: "Mobile app", note: "Client" },
  { id: "gateway", name: "API gateway", note: "Auth, routing" },
  { id: "catalog", name: "Event catalog", note: "Events, venues" },
  { id: "inventory", name: "Inventory", note: "Seat holds" },
  { id: "payments", name: "Payments", note: "Card processor" },
  { id: "orders", name: "Orders", note: "Ticket store" },
  { id: "validation", name: "Validation", note: "Door scans" },
] as const;
export type ServiceId = (typeof SERVICES)[number]["id"];

const TOUCHES: Record<StepId, ServiceId[]> = {
  browse: ["app", "gateway", "catalog"],
  detail: ["app", "gateway", "catalog", "inventory"],
  seats: ["app", "gateway", "inventory"],
  checkout: ["app", "gateway", "inventory", "payments", "orders"],
  wallet: ["app", "gateway", "orders"],
  door: ["orders", "validation"],
};

export function stepServices(step: StepId): ServiceId[] {
  return TOUCHES[step];
}

export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seatId(row: string, col: number): string {
  return `${row}${col}`;
}

export function getEvent(id: string): EventInfo {
  return EVENTS.find((e) => e.id === id) ?? EVENTS[0];
}

const TIER = [
  { name: "Front", rows: ["A", "B"], factor: 1.5 },
  { name: "Middle", rows: ["C", "D"], factor: 1 },
  { name: "Rear", rows: ["E", "F"], factor: 0.75 },
];

export function tiers(event: EventInfo) {
  return TIER.map((t) => ({
    name: t.name,
    rows: t.rows.join(", "),
    cents: Math.round(event.base * t.factor) * 100,
  }));
}

export function seatPrice(event: EventInfo, seat: string): number {
  const tier = TIER.find((t) => t.rows.includes(seat[0])) ?? TIER[1];
  return Math.round(event.base * tier.factor) * 100;
}

export function isTaken(event: EventInfo, seat: string): boolean {
  return hash32(`seat:${event.id}:${seat}`) / 4294967296 < event.sold;
}

export function allSeats(): string[] {
  return ROWS.flatMap((r) =>
    Array.from({ length: COLS }, (_, i) => seatId(r, i + 1)),
  );
}

export function availableCount(
  event: EventInfo,
  unavailable: (seat: string) => boolean = () => false,
): number {
  return allSeats().filter((s) => !isTaken(event, s) && !unavailable(s)).length;
}

// Picks the free run of adjacent seats nearest the middle of the hall,
// falling back to scattered seats when no run is long enough.
export function bestAvailable(
  event: EventInfo,
  qty: number,
  unavailable: (seat: string) => boolean = () => false,
): string[] {
  const free = (s: string) => !isTaken(event, s) && !unavailable(s);
  const order = ["C", "D", "B", "E", "A", "F"];
  const centre = (COLS + 1) / 2;
  for (const row of order) {
    let best: string[] | null = null;
    let bestDist = Infinity;
    for (let start = 1; start + qty - 1 <= COLS; start++) {
      const run = Array.from({ length: qty }, (_, i) => seatId(row, start + i));
      if (!run.every(free)) continue;
      const dist = Math.abs(start + (qty - 1) / 2 - centre);
      if (dist < bestDist) {
        best = run;
        bestDist = dist;
      }
    }
    if (best) return best;
  }
  const out: string[] = [];
  for (const row of order)
    for (let c = 1; c <= COLS && out.length < qty; c++)
      if (free(seatId(row, c))) out.push(seatId(row, c));
  return out;
}

export function quote(event: EventInfo, seats: string[]) {
  const subtotal = seats.reduce((sum, s) => sum + seatPrice(event, s), 0);
  const fee = Math.round(subtotal * 0.1) + 250 * seats.length;
  return { subtotal, fee, total: subtotal + fee };
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function whole(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ticketId(eventId: string, seat: string): string {
  const next = prng(hash32(`ticket:${eventId}:${seat}`));
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[Math.floor(next() * 32)];
  return `TX-${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeId(raw: string): string {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (s.startsWith("TX")) s = s.slice(2);
  return s.length === 8 ? `TX-${s.slice(0, 4)}-${s.slice(4)}` : s;
}

// Tickets already sold before the visitor arrives: the first three taken seats of each event.
export function soldTickets(): SoldTicket[] {
  return EVENTS.flatMap((event) =>
    allSeats()
      .filter((s) => isTaken(event, s))
      .slice(0, 3)
      .map((seat) => ({
        id: ticketId(event.id, seat),
        eventId: event.id,
        seat,
      })),
  );
}

export function scanTicket(
  raw: string,
  sold: ReadonlyMap<string, SoldTicket>,
  used: ReadonlySet<string>,
): ScanResult {
  if (!raw.trim()) return { status: "empty", id: "" };
  const id = normalizeId(raw);
  const ticket = sold.get(id);
  if (!ticket) return { status: "unknown", id };
  if (used.has(id)) return { status: "used", id, ticket };
  return { status: "admit", id, ticket };
}

// Illustrative QR-style pattern: finder squares, timing lines, one alignment square,
// and data cells drawn from a generator seeded by the ticket ID. Not scannable.
export function qrMatrix(id: string): boolean[][] {
  const n = QR_SIZE;
  const dark = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const fixed = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const set = (r: number, c: number, v: boolean) => {
    if (r < 0 || c < 0 || r >= n || c >= n) return;
    dark[r][c] = v;
    fixed[r][c] = true;
  };
  const finder = (r0: number, c0: number) => {
    for (let dr = -1; dr <= 7; dr++)
      for (let dc = -1; dc <= 7; dc++) {
        const inside = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const ring = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        set(r0 + dr, c0 + dc, inside && ring !== 2);
      }
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      const ring = Math.max(Math.abs(dr), Math.abs(dc));
      set(18 + dr, 18 + dc, ring !== 1);
    }
  const next = prng(hash32(`qr:${id}`));
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (!fixed[r][c]) dark[r][c] = next() < 0.5;
  return dark;
}

export function qrPath(id: string): string {
  const m = qrMatrix(id);
  let d = "";
  m.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < row.length && row[end]) end++;
      d += `M${c} ${r}h${end - c}v1h-${end - c}z`;
      c = end;
    }
  });
  return d;
}
