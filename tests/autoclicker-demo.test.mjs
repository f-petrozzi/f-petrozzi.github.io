import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_INTERVAL_MS,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  advance,
  clampInterval,
  describeInput,
  formatRate,
  intervalMessage,
  parseInterval,
  retime,
  startClock,
} from "../src/data/demos/autoclicker.ts";

test("intervals below the minimum are raised to it", () => {
  assert.equal(MIN_INTERVAL_MS, 50);
  for (const raw of ["10", "0", "49", "0.01 s", "49.4"]) {
    const result = parseInterval(raw);
    assert.equal(result.ms, MIN_INTERVAL_MS, raw);
    assert.equal(result.note, "min");
    assert.equal(result.adjusted, true);
  }
  assert.match(intervalMessage("min"), /Minimum interval is 50 ms/);
});

test("valid intervals pass through in ms or seconds", () => {
  assert.deepEqual(parseInterval("250"), {
    ms: 250,
    adjusted: false,
    note: null,
  });
  assert.equal(parseInterval(" 50 ms ").ms, 50);
  assert.equal(parseInterval("0.25 s").ms, 250);
  assert.equal(parseInterval("1,5s").ms, 1500);
  assert.equal(parseInterval("50").adjusted, false);
});

test("bad input falls back to the default or the maximum", () => {
  assert.equal(parseInterval("").ms, DEFAULT_INTERVAL_MS);
  assert.equal(parseInterval("").note, "empty");
  assert.equal(parseInterval("fast").note, "invalid");
  assert.equal(parseInterval("-5").note, "invalid");
  assert.equal(parseInterval("999999").ms, MAX_INTERVAL_MS);
  assert.equal(clampInterval(NaN), DEFAULT_INTERVAL_MS);
  assert.equal(clampInterval(3), MIN_INTERVAL_MS);
});

test("the clock clicks once at start, then once per interval", () => {
  let clock = startClock(1000, 100);
  const clicks = [];
  for (let now = 1000; now <= 1500; now += 10) {
    const step = advance(clock, now);
    clock = step.clock;
    if (step.click) clicks.push(now);
  }
  assert.deepEqual(clicks, [1000, 1100, 1200, 1300, 1400, 1500]);
});

test("the delay reaches the next click exactly", () => {
  const clock = startClock(0, 200);
  const first = advance(clock, 0);
  assert.equal(first.click, true);
  assert.equal(first.delay, 200);
  const early = advance(first.clock, 120);
  assert.equal(early.click, false);
  assert.equal(early.delay, 80);
});

test("a late timer never fires a burst", () => {
  let clock = startClock(0, 50);
  clock = advance(clock, 0).clock;
  const late = advance(clock, 5000);
  assert.equal(late.click, true);
  assert.equal(late.delay, 50);
  assert.equal(advance(late.clock, 5000).click, false);
});

test("a simulated run never exceeds the rate the interval allows", () => {
  let seed = 7;
  const jitter = () => (seed = (seed * 48271) % 2147483647) % 17;
  let clock = startClock(0, 50);
  let now = 0;
  let clicks = 0;
  while (now < 2000) {
    const step = advance(clock, now);
    clock = step.clock;
    if (step.click) clicks++;
    now += step.delay + jitter();
  }
  assert.ok(clicks <= 2000 / MIN_INTERVAL_MS + 1, `clicks=${clicks}`);
  assert.ok(clicks >= 30);
});

test("changing the interval restarts the beat from now", () => {
  const clock = retime(400, 10);
  assert.equal(clock.interval, MIN_INTERVAL_MS);
  assert.equal(clock.nextDue, 450);
});

test("labels describe the chosen input", () => {
  assert.equal(
    describeInput({ kind: "mouse", button: "middle" }),
    "Middle click",
  );
  assert.equal(describeInput({ kind: "key", key: "Space" }), "Space key");
  assert.equal(formatRate(500), "2 clicks/s");
  assert.equal(formatRate(1000), "1 click/s");
  assert.equal(formatRate(50), "20 clicks/s");
  assert.equal(formatRate(4000), "0.3 clicks/s");
});
