import { test } from "node:test";
import assert from "node:assert/strict";
import {
  snapshot,
  countdown,
  clockLabel,
  findSessions,
  togglePin,
  initialPins,
  MAX_MINUTES,
} from "../src/data/demos/agent-usage.ts";

const windowOf = (minute, account = "lumen", id = "fiveHour") =>
  snapshot(minute)
    .accounts.find((row) => row.id === account)
    .windows.find((window) => window.id === id);

test("clock advances usage continuously and keeps windows independent", () => {
  const first = snapshot(0);
  assert.equal(
    first.accounts.filter((account) => account.provider === "Codex").length,
    2,
  );
  assert.equal(
    first.accounts.filter((account) => account.provider === "Claude").length,
    1,
  );
  assert.equal(windowOf(10).used, 76);
  assert.equal(windowOf(10.5).used, 76.2);
  assert.equal(windowOf(10).resetsIn, 35);
  assert.equal(windowOf(10, "lumen", "weekly").used, 44.35);
  assert.ok(windowOf(15, "orbit").used > windowOf(0, "orbit").used);
  assert.ok(windowOf(15, "fern").used > windowOf(0, "fern").used);
  assert.deepEqual(snapshot(0), first);
});

test("80 percent warning appears at the crossing, once per window", () => {
  const usage = (minute) =>
    snapshot(minute).notices.filter((notice) => notice.kind === "Usage");
  assert.equal(usage(19).length, 0);
  assert.equal(usage(20).length, 1);
  assert.match(usage(20)[0].body, /5-hour: 80% used/);
  assert.equal(usage(30).length, 1);
  assert.equal(usage(44).length, 1);
  assert.equal(
    new Set(usage(120).map((notice) => notice.id)).size,
    usage(120).length,
  );
  assert.ok(
    usage(120).some(
      (notice) => notice.account === "fern" && /Weekly/.test(notice.body),
    ),
  );
});

test("reset renews allowance at the boundary and retains the prior alert", () => {
  assert.ok(windowOf(44).used > 89);
  assert.equal(windowOf(45).used, 0);
  assert.equal(windowOf(45).resetsIn, 300);
  assert.equal(windowOf(45).timeLeft, 100);
  assert.equal(windowOf(45).cycle, 1);
  assert.equal(windowOf(60).used, 6);
  assert.equal(windowOf(60).resetsIn, 285);
  assert.ok(
    windowOf(45, "lumen", "weekly").used > windowOf(44, "lumen", "weekly").used,
  );
  assert.equal(
    snapshot(45).notices.filter((notice) => notice.kind === "Usage").length,
    1,
  );
  assert.equal(
    snapshot(60).notices.find((notice) => notice.kind === "Usage").minute,
    20,
  );
});

test("readings remain bounded for every clock position and invalid input", () => {
  for (let minute = 0; minute <= MAX_MINUTES; minute++) {
    for (const account of snapshot(minute).accounts) {
      for (const window of account.windows) {
        assert.ok(window.used >= 0 && window.used <= 100);
        assert.ok(window.timeLeft >= 0 && window.timeLeft <= 100);
        assert.ok(window.resetsIn > 0);
      }
    }
  }
  assert.deepEqual(snapshot(-50), snapshot(0));
  assert.deepEqual(snapshot(NaN), snapshot(0));
  assert.deepEqual(snapshot(Infinity), snapshot(0));
  assert.deepEqual(snapshot(999), snapshot(MAX_MINUTES));
  assert.equal(clockLabel(45), "09:45");
  assert.equal(clockLabel(120), "11:00");
  assert.equal(countdown(300), "5h 00m");
  assert.equal(countdown(4320), "3d 0h");
  assert.equal(countdown(0.1), "1m");
});

test("Sessions search spans title, workspace and account; pins sort first", () => {
  const rows = findSessions("", "all", initialPins);
  assert.equal(rows.length, 6);
  assert.deepEqual(
    rows.slice(0, 2).map((row) => row.id),
    ["s3", "s4"],
  );
  assert.equal(findSessions(" KEYBOARD ", "fern", []).length, 1);
  assert.equal(findSessions("tiny-atlas", "all", []).length, 3);
  assert.equal(findSessions("Codex Lumen", "all", []).length, 2);
  assert.equal(findSessions("keyboard", "orbit", []).length, 0);
  assert.equal(findSessions("<script>", "all", []).length, 0);
  const pins = togglePin(initialPins, "s1");
  assert.equal(findSessions("", "lumen", pins)[0].id, "s1");
  assert.deepEqual(togglePin(pins, "s1"), initialPins);
  assert.deepEqual(togglePin(initialPins, "unknown"), initialPins);
  assert.deepEqual(initialPins, ["s4", "s3"]);
});
