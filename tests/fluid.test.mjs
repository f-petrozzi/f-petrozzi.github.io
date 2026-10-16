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

test("liquid springs preserve velocity on reversal at different frame rates", () => {
  assert.deepEqual(fluid.APPROACH, { response: 0.34, damping: 0.82 });
  assert.deepEqual(fluid.RETURN, { response: 0.38, damping: 0.86 });
  assert.deepEqual(fluid.PANEL_OPEN, { response: 0.42, damping: 0.84 });
  for (const preset of [
    fluid.APPROACH,
    fluid.RETURN,
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
  assert.ok(peak > 1.005 && peak < 1.01);
  const approaching = fluid.springStep(0, 0, 1, 0.1, fluid.APPROACH);
  const reversing = fluid.springStep(...approaching, 0, 0.001, fluid.RETURN);
  assert.ok(reversing[0] > approaching[0]);
});

test("proximity uses circular falloff with bounded directional displacement", () => {
  const rect = { left: 100, top: 100, width: 44, height: 44 };
  assert.deepEqual(fluid.proximityAt(122, 122, rect), {
    x: 0,
    y: 0,
    strength: 1,
  });
  assert.deepEqual(fluid.proximityAt(222, 122, rect), {
    x: 0,
    y: 0,
    strength: 0,
  });
  const right = fluid.proximityAt(160, 122, rect);
  const above = fluid.proximityAt(122, 84, rect);
  near(right.strength, above.strength);
  near(right.x, -above.y);
  assert.ok(right.x > 0 && right.x < 3);
  assert.equal(right.y, 0);
  const diagonal = fluid.proximityAt(160, 160, rect);
  assert.ok(diagonal.strength < right.strength);
  assert.ok(diagonal.x > 0 && diagonal.y > 0);
  assert.equal(fluid.proximityAt(214, 214, rect).strength, 0);
});

test("the round surface stays intact at rest and swells gently toward the pointer", () => {
  assert.equal(
    fluid.dropletTransform({ x: 0, y: 0, strength: 0 }),
    "translate(0px, 0px) rotate(0deg) scale(1, 1) rotate(0deg)",
  );
  const right = fluid.dropletTransform({ x: 2.6, y: 0, strength: 1 });
  assert.match(right, /scale\(1.13, 0.95\)/);
  for (let angle = -Math.PI; angle < Math.PI; angle += 0.1) {
    const transform = fluid.dropletTransform({
      x: 3 * Math.cos(angle),
      y: 3 * Math.sin(angle),
      strength: 1.01,
    });
    assert.ok(!/NaN|Infinity/.test(transform));
  }
  assert.equal(fluid.armGeometry, undefined);
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
  function step() {
    now += 1000 / 60;
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach((fn) => fn(now));
  }
  function drain() {
    let count = 0;
    while (frames.size && count++ < 500) {
      step();
    }
    assert.equal(frames.size, 0, "animation must become idle");
    return count;
  }
  return { options, frames, reduced, drain, step };
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
  let reads = 0;
  const anchor = {
    getBoundingClientRect() {
      reads++;
      return { left: 0, top: 0, width: 44, height: 44 };
    },
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
  assert.deepEqual(paints.at(-1), [
    fluid.proximityAt(30, 30, anchor.getBoundingClientRect()),
    false,
  ]);
  assert.equal(reads, 2, "pointer events share one cached geometry read");
  pointer(card, 30, 30);
  assert.equal(
    f.frames.size,
    0,
    "stationary near pointer must not restart a loop",
  );
  card.dispatchEvent(new Event("pointerleave"));
  f.drain();
  assert.deepEqual(paints.at(-1), [{ x: 0, y: 0, strength: 0 }, false]);
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

test("goo uses a bounded half-alpha cut-back and detaches at rest/reduced motion", (t) => {
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

function panelFixture() {
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
  const panel = ink(),
    orb = ink();
  const nodes = new Map([
    ["summary", summary],
    [".work-more-body", body],
    [".info-ink", panel],
    [".info-orb", orb],
  ]);
  details.querySelector = (name) => nodes.get(name);
  details.closest = () => card;
  details.contains = () => false;
  summary.querySelector = () => glyph;
  details.parentElement = { clientWidth: 520 };
  let measures = 0;
  Object.defineProperty(body, "offsetHeight", {
    get() {
      assert.equal(details.open, true);
      measures++;
      return Math.min(420, Math.ceil(120000 / parseFloat(body.style.width)));
    },
  });
  const f = fixture();
  let resize, intersection;
  const doc = new Node();
  doc.querySelectorAll = () => [details];
  doc.fonts = { ready: { then() {} } };
  const context = vm.createContext({
    ...fluid,
    document: doc,
    reducedMotion: f.reduced,
    matchMedia: () => ({ matches: true }),
    getComputedStyle: () => ({ paddingLeft: "10", paddingRight: "10" }),
    requestAnimationFrame: f.options.request,
    cancelAnimationFrame: f.options.cancel,
    performance: { now: f.options.clock },
    setTimeout,
    clearTimeout,
    ResizeObserver: class {
      constructor(fn) {
        resize = fn;
      }
      observe() {}
    },
    IntersectionObserver: class {
      constructor(fn) {
        intersection = fn;
      }
      observe() {}
    },
    trackProximity: () => ({ stop() {}, reset() {} }),
    applyGooFilter: () => ({ update() {} }),
  });
  vm.runInContext(source, context);
  const click = (detail = 1) => {
    const event = new Event("click", { cancelable: true });
    Object.assign(event, { detail });
    summary.dispatchEvent(event);
  };
  return {
    details,
    summary,
    body,
    panel,
    orb,
    doc,
    click,
    f,
    measures: () => measures,
    resize: () => resize(),
    hide: () => intersection([{ isIntersecting: false }]),
  };
}

test("info panel measures once, keeps card geometry fixed during animation and resizes", () => {
  const p = panelFixture();
  p.click();
  assert.equal(p.body.style.width, "500px");
  p.f.drain();
  assert.equal(p.panel.style.height, "240px");
  assert.equal(p.body.style.opacity, "1");
  assert.equal(p.measures(), 1, "frames must not measure layout");
  assert.equal(p.details.style.width, undefined);
  assert.equal(p.details.style.height, undefined);
  p.click();
  p.f.drain();
  assert.equal(p.details.open, false);
  assert.equal(p.orb.style.opacity, "1");
  p.click();
  p.f.drain();
  assert.equal(p.panel.style.height, "240px");
  p.details.parentElement.clientWidth = 340;
  p.resize();
  assert.equal(p.panel.style.height, "375px");
  assert.equal(p.body.style.width, "320px");
  assert.equal(p.f.frames.size, 0);
});

test("rapid panel reversals settle, keyboard/reduced motion are instant, hidden panels stop", () => {
  const p = panelFixture();
  p.click();
  p.f.step();
  p.click();
  p.f.step();
  p.click();
  p.f.drain();
  assert.equal(p.body.style.opacity, "1");
  assert.equal(p.summary.getAttribute("aria-expanded"), "true");
  p.click(0);
  assert.equal(p.f.frames.size, 0);
  assert.equal(p.details.open, false);
  assert.equal(p.body.inert, true);
  p.f.reduced.matches = true;
  p.f.reduced.dispatchEvent(new Event("change"));
  p.click();
  assert.equal(p.details.open, true);
  assert.equal(p.f.frames.size, 0);
  p.f.reduced.matches = false;
  p.click();
  assert.equal(p.f.frames.size, 1);
  p.hide();
  assert.equal(p.f.frames.size, 0);
  assert.equal(p.details.open, false);
  p.click();
  p.doc.hidden = true;
  p.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(p.f.frames.size, 0);
  assert.equal(p.details.open, false);
});
