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

test("disclosure springs preserve velocity on reversal and settle without overshoot", () => {
  for (const preset of [fluid.RETURN, fluid.PANEL_OPEN]) {
    for (const hz of [30, 60, 120]) {
      let x = 0,
        v = 0;
      for (let i = 0; i < hz; i++) {
        [x, v] = fluid.springStep(x, v, 1, 1 / hz, preset);
        assert.ok(x >= 0 && x <= 1);
      }
      near(x, 1, 0.00001);
      near(v, 0, 0.00001);
    }
    const once = fluid.springStep(0.3, 1.5, 1, 0.04, preset);
    const half = fluid.springStep(0.3, 1.5, 1, 0.02, preset);
    const twice = fluid.springStep(...half, 1, 0.02, preset);
    once.forEach((value, i) => near(value, twice[i]));
  }
  const approaching = fluid.springStep(0, 0, 1, 0.05, fluid.PANEL_OPEN);
  const reversing = fluid.springStep(...approaching, 0, 0.001, fluid.RETURN);
  assert.ok(reversing[0] > approaching[0]);
  assert.equal(fluid.trackProximity, undefined);
  assert.equal(fluid.applyGooFilter, undefined);
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

test("information requires activation and dismisses on outside press, blur and Escape", () => {
  const p = panelFixture();
  p.details.dispatchEvent(new Event("pointerenter"));
  p.details.dispatchEvent(new Event("pointermove"));
  assert.equal(p.f.frames.size, 0);
  assert.equal(p.summary.getAttribute("aria-expanded"), "false");
  p.click();
  p.f.drain();
  p.doc.dispatchEvent(new Event("pointerdown"));
  assert.equal(p.body.inert, true);
  p.f.drain();
  assert.equal(p.details.open, false);
  p.click(0);
  p.summary.focus = () => {
    p.summary.focused = true;
  };
  const escape = new Event("keydown", { cancelable: true });
  Object.assign(escape, { key: "Escape" });
  p.details.dispatchEvent(escape);
  assert.equal(p.details.open, false);
  assert.equal(p.summary.focused, true);
  assert.equal(p.f.frames.size, 0);
  p.click();
  const blur = new Event("focusout");
  Object.assign(blur, { relatedTarget: null });
  p.details.dispatchEvent(blur);
  p.f.drain();
  assert.equal(p.details.open, false);
});
