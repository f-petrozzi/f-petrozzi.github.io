import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import * as fluid from "../src/scripts/fluid.ts";

const near = (a, b, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

test("critical spring is exact across frame rates and does not overshoot", () => {
  for (const hz of [30, 60, 120]) {
    let x = 0,
      v = 0,
      previous = 0;
    for (let i = 0; i < hz; i++) {
      [x, v] = fluid.springStep(x, v, 1, 1 / hz);
      assert.ok(x >= previous && x <= 1);
      previous = x;
    }
    const omega = (2 * Math.PI) / 0.74;
    near(x, 1 - (1 + omega) * Math.exp(-omega));
  }
  assert.deepEqual(fluid.springStep(2, -3, 1, 0), [2, -3]);
  assert.deepEqual(
    fluid.springStep(2, -3, 1, 20),
    fluid.springStep(2, -3, 1, 0.1),
  );
});

test("notch presets retain their timing, soft overshoot and reversal velocity", () => {
  assert.deepEqual(fluid.ARM_APPROACH, { response: 0.74, damping: 0.86 });
  assert.deepEqual(fluid.ARM_RETURN, { response: 0.82, damping: 0.9 });
  assert.deepEqual(fluid.PANEL_OPEN, { response: 0.62, damping: 0.72 });
  for (const preset of [
    fluid.ARM_APPROACH,
    fluid.ARM_RETURN,
    fluid.PANEL_OPEN,
    { response: 0.7, damping: 1.4 },
  ]) {
    const once = fluid.springStep(0.3, 1.5, 1, 0.04, preset);
    const half = fluid.springStep(0.3, 1.5, 1, 0.02, preset);
    const twice = fluid.springStep(...half, 1, 0.02, preset);
    once.forEach((v, i) => near(v, twice[i]));
  }
  let x = 0,
    v = 0,
    peak = 0;
  for (let i = 0; i < 240; i++) {
    [x, v] = fluid.springStep(x, v, 1, 1 / 120, fluid.PANEL_OPEN);
    peak = Math.max(peak, x);
  }
  assert.ok(peak > 1.03 && peak < 1.05);
  const approaching = fluid.springStep(0, 0, 1, 0.1, fluid.ARM_APPROACH);
  const reversing = fluid.springStep(
    ...approaching,
    0,
    0.001,
    fluid.ARM_RETURN,
  );
  assert.ok(reversing[0] > approaching[0]);
});

test("proximity ramps smoothly outside the icon with the notch's square reach", () => {
  const rect = { left: 100, top: 100, width: 44, height: 44 };
  assert.equal(fluid.proximityAt(122, 122, rect), 1);
  assert.equal(fluid.proximityAt(144, 144, rect), 1);
  assert.equal(fluid.proximityAt(192, 122, rect), 0);
  const ramp = [191, 180, 170, 160, 150].map((x) =>
    fluid.proximityAt(x, 122, rect),
  );
  ramp.forEach((value, i) => {
    assert.ok(value > 0 && value < 1);
    if (i) assert.ok(value > ramp[i - 1]);
  });
  near(fluid.proximityAt(170, 122, rect), fluid.proximityAt(122, 74, rect));
});

test("arm gathers along the inset contour, lifts on a bow and pinches before release", () => {
  const rest = fluid.armGeometry(0);
  near(rest.x, 0);
  near(rest.y, 0);
  assert.equal((rest.arm.match(/L/g) || []).length, 40);
  assert.equal(rest.neck, "");
  assert.equal(rest.strokeWidth, 10.2);
  const gather = fluid.armGeometry(0.2),
    lift = fluid.armGeometry(0.65),
    pocket = fluid.armGeometry(1);
  assert.equal(gather.lift, 0);
  assert.ok(gather.strokeWidth > rest.strokeWidth);
  assert.ok(lift.x < 0 && lift.y > 0 && lift.blur > 0);
  assert.ok(lift.neck.startsWith("M") && lift.neck.endsWith("Z"));
  assert.equal(pocket.neck, "");
  assert.equal(pocket.strokeWidth, 48);
  assert.ok(pocket.blur < 1e-6);
  near(
    pocket.originX + pocket.x,
    22 - (38.7 - 10.2 / 2 - 5) * Math.SQRT1_2 * 2,
  );
  for (const value of [-0.02, 0, 0.4, 0.8, 1, 1.03]) {
    const shape = fluid.armGeometry(value, 0.52);
    assert.ok(!/NaN|Infinity/.test(shape.arm + shape.neck));
  }
  near(fluid.armSway(0.095), 14 * Math.exp(-0.095 / 0.26));
  assert.equal(fluid.armSway(1.2), 0);
});

class Node extends EventTarget {
  style = {};
  attrs = new Map();
  children = [];
  classList = { add() {}, toggle() {} };
  setAttribute(k, v) {
    this.attrs.set(k, String(v));
  }
  getAttribute(k) {
    return this.attrs.get(k) ?? null;
  }
  removeAttribute(k) {
    this.attrs.delete(k);
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  prepend(node) {
    this.children.unshift(node);
  }
  remove() {
    this.removed = true;
  }
}
function fixture() {
  let now = 0,
    next = 0;
  const frames = new Map(),
    reduced = new Node();
  reduced.matches = false;
  const options = {
    reduced,
    request(fn) {
      frames.set(++next, fn);
      return next;
    },
    cancel(id) {
      frames.delete(id);
    },
    clock: () => now,
  };
  function drain() {
    let count = 0;
    while (frames.size && count++ < 500) {
      now += 1000 / 60;
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((fn) => fn(now));
    }
    assert.equal(frames.size, 0, "animation must become idle");
    return count;
  }
  return { options, frames, reduced, drain };
}
function pointer(target, x, y, type = "mouse") {
  const event = new Event("pointermove");
  Object.assign(event, { pointerType: type, clientX: x, clientY: y });
  target.dispatchEvent(event);
}

test("tracker is idle far away, coalesces events, settles near and returns home", (t) => {
  const original = globalThis.window;
  globalThis.window = new Node();
  t.after(() => {
    globalThis.window = original;
  });
  const card = new Node(),
    f = fixture(),
    paints = [];
  const anchor = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 44, height: 44 }),
  };
  const tracker = fluid.trackProximity(
    card,
    anchor,
    (...args) => paints.push(args),
    f.options,
  );
  assert.equal(f.frames.size, 0);
  pointer(card, 500, 500);
  pointer(card, 22, 22, "touch");
  assert.equal(f.frames.size, 0);
  for (let i = 0; i < 30; i++) pointer(card, 30, 30);
  assert.equal(f.frames.size, 1);
  assert.ok(f.drain() < 200);
  assert.deepEqual(paints.at(-1), [1, false, 0]);
  pointer(card, 30, 30);
  assert.equal(
    f.frames.size,
    0,
    "stationary near pointer must not restart a loop",
  );
  card.dispatchEvent(new Event("pointerleave"));
  f.drain();
  assert.deepEqual(paints.at(-1), [0, false, 0]);
  pointer(card, 60, 22);
  globalThis.window.dispatchEvent(new Event("scroll"));
  assert.equal(f.frames.size, 0);
  f.reduced.matches = true;
  f.reduced.dispatchEvent(new Event("change"));
  pointer(card, 22, 22);
  assert.equal(f.frames.size, 0);
  tracker.destroy();
  f.reduced.matches = false;
  pointer(card, 22, 22);
  assert.equal(f.frames.size, 0);
});

test("goo uses the notch's half-alpha cut-back and detaches at rest/reduced motion", (t) => {
  const saved = {
    document: globalThis.document,
    matchMedia: globalThis.matchMedia,
  };
  const reduced = new Node();
  reduced.matches = false;
  globalThis.matchMedia = () => reduced;
  globalThis.document = { createElementNS: () => new Node() };
  t.after(() => Object.assign(globalThis, saved));
  const svg = new Node(),
    group = new Node();
  const goo = fluid.applyGooFilter(svg, group);
  const filter = svg.children[0].children[0],
    [blur, matrix] = filter.children;
  assert.equal(filter.getAttribute("filterUnits"), "userSpaceOnUse");
  assert.equal(group.getAttribute("filter"), null);
  goo.update(3, true);
  assert.equal(blur.getAttribute("stdDeviation"), "3");
  assert.ok(matrix.getAttribute("values").endsWith("7.8 -3.4"));
  assert.equal(group.getAttribute("filter"), `url(#${filter.id})`);
  goo.update(3, false);
  assert.equal(blur.getAttribute("stdDeviation"), "0");
  assert.equal(group.getAttribute("filter"), null);
  goo.update(3, true);
  reduced.matches = true;
  reduced.dispatchEvent(new Event("change"));
  assert.equal(group.getAttribute("filter"), null);
  goo.destroy();
  assert.equal(svg.children[0].removed, true);
});

test("first info open measures the laid-out width, matches later opens and resizes", () => {
  const home = readFileSync(
    new URL("../src/scripts/home.ts", import.meta.url),
    "utf8",
  );
  const source = stripTypeScriptTypes(
    home.slice(home.indexOf("// The information surface")),
  );
  const details = new Node(),
    summary = new Node(),
    body = new Node(),
    foot = new Node(),
    card = new Node(),
    glyph = new Node();
  const ink = () => {
    const svg = new Node(),
      nodes = new Map();
    svg.querySelector = (name) => {
      if (!nodes.has(name)) nodes.set(name, new Node());
      return nodes.get(name);
    };
    return svg;
  };
  const nodes = new Map([
    ["summary", summary],
    [".work-more-body", body],
    [".info-ink", ink()],
    [".info-arm", ink()],
  ]);
  details.querySelector = (name) => nodes.get(name);
  details.closest = () => card;
  summary.querySelector = () => glyph;
  summary.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 44,
    height: 44,
  });
  details.parentElement = { clientWidth: 520, querySelector: () => foot };
  let measures = 0;
  body.getBoundingClientRect = () => {
    // Native disclosure layout must be open at the body's final width before
    // its wrapped content can be measured. A closed/stale width would be taller.
    assert.equal(details.open, true);
    assert.equal(details.style.width, body.style.width);
    measures++;
    return { height: Math.ceil(120000 / parseFloat(body.style.width)) };
  };
  const f = fixture();
  let resize;
  const context = vm.createContext({
    ...fluid,
    document: {
      querySelectorAll: () => [details],
      fonts: { ready: { then() {} } },
    },
    reducedMotion: f.reduced,
    matchMedia: () => f.reduced,
    getComputedStyle: () => ({ paddingLeft: "10", paddingRight: "10" }),
    requestAnimationFrame: f.options.request,
    cancelAnimationFrame: f.options.cancel,
    performance: { now: f.options.clock },
    scheduleScroll() {},
    setTimeout,
    clearTimeout,
    ResizeObserver: class {
      constructor(fn) {
        resize = fn;
      }
      observe() {}
    },
    IntersectionObserver: class {
      observe() {}
    },
    // Proximity and filters are tested above; this exercises the real panel code.
    trackProximity: () => ({ stop() {}, reset() {} }),
    applyGooFilter: () => ({ update() {} }),
  });
  vm.runInContext(source, context);
  const click = () =>
    summary.dispatchEvent(new Event("click", { cancelable: true }));
  click();
  f.drain();
  const firstHeight = details.style.height;
  assert.equal(firstHeight, "240px");
  click();
  f.drain();
  assert.equal(details.open, false);
  click();
  f.drain();
  assert.equal(details.style.height, firstHeight);
  details.parentElement.clientWidth = 340;
  resize();
  f.drain();
  assert.equal(details.style.height, "375px");
  f.reduced.matches = true;
  f.reduced.dispatchEvent(new Event("change"));
  click();
  assert.equal(details.open, false);
  assert.equal(f.frames.size, 0);
  assert.ok(measures >= 4);
});
