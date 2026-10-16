import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EVENTS,
  QR_SIZE,
  availableCount,
  bestAvailable,
  getEvent,
  isTaken,
  normalizeId,
  qrMatrix,
  qrPath,
  quote,
  scanTicket,
  seatPrice,
  soldTickets,
  stepServices,
  ticketId,
} from "../src/data/demos/tixly-app-design.ts";

test("ticket IDs are deterministic, formatted and unique per seat", () => {
  const a = ticketId("harbor-lights", "C4");
  assert.equal(a, ticketId("harbor-lights", "C4"));
  assert.match(a, /^TX-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
  assert.notEqual(a, ticketId("harbor-lights", "C5"));
  const sold = soldTickets();
  assert.equal(new Set(sold.map((t) => t.id)).size, sold.length);
  assert.equal(sold.length, EVENTS.length * 3);
});

test("QR pattern derives from the ticket ID", () => {
  const id = ticketId("city-fc", "B2");
  const m = qrMatrix(id);
  assert.equal(m.length, QR_SIZE);
  assert.deepEqual(m, qrMatrix(id));
  assert.notDeepEqual(m, qrMatrix(ticketId("city-fc", "B3")));
  // finder squares: dark corner, light ring, dark centre
  assert.equal(m[0][0], true);
  assert.equal(m[1][1], false);
  assert.equal(m[3][3], true);
  assert.equal(m[3][QR_SIZE - 4], true);
  assert.equal(m[QR_SIZE - 4][3], true);
  assert.match(qrPath(id), /^M\d+ \d+h\d+v1h-\d+z/);
});

test("scanning admits once, then rejects reuse and unknown IDs", () => {
  const sold = new Map(soldTickets().map((t) => [t.id, t]));
  const used = new Set();
  const [first] = sold.keys();
  const one = scanTicket(first.toLowerCase().replace(/-/g, " "), sold, used);
  assert.equal(one.status, "admit");
  assert.equal(one.id, first);
  used.add(one.id);
  assert.equal(scanTicket(first, sold, used).status, "used");
  assert.equal(scanTicket("TX-0000-0000", sold, used).status, "unknown");
  assert.equal(scanTicket("  ", sold, used).status, "empty");
});

test("normalizeId accepts spaces, case and missing prefix", () => {
  assert.equal(normalizeId("tx 1abc 2def"), "TX-1ABC-2DEF");
  assert.equal(normalizeId("1abc2def"), "TX-1ABC-2DEF");
});

test("best available picks adjacent free seats and respects unavailable seats", () => {
  for (const event of EVENTS) {
    const seats = bestAvailable(event, 3);
    assert.equal(seats.length, 3);
    assert.ok(seats.every((s) => !isTaken(event, s)));
    const blocked = new Set(seats);
    const again = bestAvailable(event, 3, (s) => blocked.has(s));
    assert.equal(again.length, 3);
    assert.ok(again.every((s) => !blocked.has(s)));
  }
});

test("quote adds a per-ticket fee and tier pricing", () => {
  const e = getEvent("harbor-lights");
  assert.equal(seatPrice(e, "A1"), 7200);
  assert.equal(seatPrice(e, "C1"), 4800);
  assert.equal(seatPrice(e, "F8"), 3600);
  const q = quote(e, ["C1", "C2"]);
  assert.equal(q.subtotal, 9600);
  assert.equal(q.fee, 960 + 500);
  assert.equal(q.total, q.subtotal + q.fee);
  assert.ok(availableCount(e) > 0 && availableCount(e) < 48);
});

test("each step maps to services, ending at validation for the door", () => {
  assert.ok(stepServices("seats").includes("inventory"));
  assert.ok(stepServices("checkout").includes("payments"));
  assert.ok(stepServices("door").includes("validation"));
});
