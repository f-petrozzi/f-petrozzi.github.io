import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";
import * as usage from "../src/data/demos/agent-usage.ts";
import {
  snapshot,
  countdown,
  clockLabel,
  findSessions,
  togglePin,
  initialPins,
  MAX_MINUTES,
  motion,
  spring,
  usageColor,
} from "../src/data/demos/agent-usage.ts";

const windowOf = (minute, account = "lumen", id = "fiveHour") =>
  snapshot(minute)
    .accounts.find((row) => row.id === account)
    .windows.find((window) => window.id === id);

test("notch arms face their flares and use the notch's fixed black ink locally", () => {
  const component = readFileSync(
    new URL("../src/components/demos/AgentUsageDemo.astro", import.meta.url),
    "utf8",
  );
  const script = readFileSync(
    new URL("../src/scripts/demos/agent-usage.ts", import.meta.url),
    "utf8",
  );
  assert.match(component, /<style is:inline>\s*\.demo-agent-usage\s*\{/);
  assert.match(component, /--au-black:\s*#000;/);
  assert.match(component, /\.notch\s*\{[^}]*background: var\(--au-black\);/);
  assert.match(component, /\.arm-rest\s*\{[^}]*stroke: var\(--au-black\);/);
  // SVG circles start at the right and sweep clockwise: these quarters face
  // up/right on the left shoulder and up/left on the right, as in shape.js.
  assert.match(
    component,
    /\.arm-leading \.arm-rest\s*\{\s*transform: rotate\(270deg\);/,
  );
  assert.match(
    component,
    /\.arm-trailing \.arm-rest\s*\{\s*transform: rotate\(180deg\);/,
  );
  assert.equal(
    (component.match(/stroke-dasharray="44\.77 179\.07"/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(component + script, /(?:import|from)[^;\n]*fluid/);
});

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
    2,
  );
  assert.equal(
    snapshot(60).notices.find((notice) => /warning/.test(notice.title)).minute,
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

test("renewals enter the same log once, at the reset time", () => {
  assert.equal(
    snapshot(44).notices.some((notice) => notice.title === "Allowance renewed"),
    false,
  );
  const renewal = snapshot(45).notices.find(
    (notice) => notice.title === "Allowance renewed",
  );
  assert.equal(renewal.minute, 45);
  assert.equal(renewal.account, "lumen");
  assert.match(renewal.body, /5-hour window reset/);
  assert.deepEqual(
    snapshot(120).notices.filter(
      (notice) => notice.title === "Allowance renewed",
    ),
    [renewal],
  );
  assert.equal(
    snapshot(20).notices.some((notice) => notice.id === renewal.id),
    false,
  );
});

test("the opening spring overshoots gently and every renderer spring settles", () => {
  for (const config of [
    motion.open,
    motion.detailOpen,
    motion.detailClose,
    motion.armHover,
    motion.armReturn,
  ]) {
    let value = 0,
      velocity = 0,
      maximum = 0;
    for (let frame = 0; frame < 180; frame++) {
      [value, velocity] = spring(
        value,
        velocity,
        1,
        config.response,
        config.damping,
        1 / 60,
      );
      maximum = Math.max(maximum, value);
    }
    assert.ok(Math.abs(value - 1) < 0.0001);
    assert.ok(Math.abs(velocity) < 0.0001);
    assert.ok(maximum < 1.05, "overshoot stays below five percent");
    if (config === motion.open) assert.ok(maximum > 1.03);
  }
});

test("spring reversal keeps its incoming velocity instead of restarting", () => {
  const { response, damping } = motion.open;
  let value = 0,
    velocity = 0;
  for (let i = 0; i < 8; i++)
    [value, velocity] = spring(value, velocity, 1, response, damping, 1 / 60);
  assert.ok(velocity > 0);
  const reversed = spring(value, velocity, 0, response, damping, 0.001);
  assert.ok(reversed[0] > value, "momentum continues briefly after reversing");
  assert.ok(reversed[1] > 0);
  assert.ok(reversed[1] < velocity);
  assert.deepEqual(spring(value, velocity, 0, response, damping, 0), [
    value,
    velocity,
  ]);
  assert.deepEqual(
    spring(value, velocity, 0, response, damping, 10),
    spring(value, velocity, 0, response, damping, 0.1),
  );
});

test("analytic spring is independent of frame partitioning", () => {
  for (const damping of [0.72, 1, 1.3]) {
    const full = spring(0.2, -0.1, 1, 0.62, damping, 0.08);
    let partial = [0.2, -0.1];
    for (let i = 0; i < 4; i++)
      partial = spring(...partial, 1, 0.62, damping, 0.02);
    assert.ok(Math.abs(partial[0] - full[0]) < 1e-12);
    assert.ok(Math.abs(partial[1] - full[1]) < 1e-12);
  }
});

test("usage colors flag consumed allowance rather than remaining allowance", () => {
  assert.equal(usageColor(0), "#00ff88");
  assert.equal(usageColor(79.9), "#00ff88");
  assert.equal(usageColor(80), "#f2ff00");
  assert.equal(usageColor(95), "#ff6b47");
  assert.equal(usageColor(100), "#ff6b47");
});

// Exercise the real DOM wiring with a small event/animation host, without a browser.
function interactionFixture(reducedMotion = false) {
  class Element {
    style = {};
    dataset = {};
    attributes = new Map();
    children = new Map();
    listeners = new Map();
    hidden = false;
    value = "";
    textContent = "";
    querySelector(selector) {
      if (selector === ":focus-visible") return null;
      if (!this.children.has(selector))
        this.children.set(selector, new Element());
      return this.children.get(selector);
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    addEventListener(name, callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(callback);
    }
    emit(name, event = {}) {
      for (const callback of this.listeners.get(name) ?? [])
        callback({
          target: this,
          relatedTarget: null,
          pointerType: "mouse",
          clientX: 0,
          clientY: 0,
          preventDefault() {},
          ...event,
        });
    }
    contains(element) {
      return element === this;
    }
    animate() {
      return { cancel() {} };
    }
  }
  const root = new Element();
  const groups = new Map();
  for (const [selector, key, values] of [
    ["[data-account]", "account", ["lumen", "orbit", "fern"]],
    ["[data-arm]", "arm", ["pin", "move"]],
    ["[data-panel]", "panel", ["usage", "sessions", "notifications"]],
    ["[data-window-choice]", "windowChoice", ["fiveHour", "weekly"]],
    ["[data-notice-filter]", "noticeFilter", ["Usage", "Waiting", "Finished"]],
    ["[data-close]", "close", ["usage", "sessions", "notifications"]],
  ]) {
    groups.set(
      selector,
      values.map((value) => {
        const element = new Element();
        element.dataset[key] = value;
        const attribute = selector.slice(1, -1);
        root.children.set(`[${attribute}="${value}"]`, element);
        root.children.set(`[${attribute}=${value}]`, element);
        return element;
      }),
    );
  }
  groups.set(".ring-reading", []);
  root.querySelectorAll = (selector) => {
    assert.ok(groups.has(selector), `known group: ${selector}`);
    return groups.get(selector);
  };
  let now = 0;
  let nextId = 0;
  const timers = new Map();
  const frames = new Map();
  const source = readFileSync(
    new URL("../src/scripts/demos/agent-usage.ts", import.meta.url),
    "utf8",
  ).replace(/^import \{[\s\S]*?\} from "[^"]+";/, "");
  vm.runInNewContext(stripTypeScriptTypes(source), {
    ...usage,
    Element,
    Node: Element,
    document: {
      hidden: false,
      querySelectorAll(selector) {
        assert.equal(selector, '[data-demo="agent-usage"]');
        return [root];
      },
      addEventListener() {},
    },
    window: { addEventListener() {} },
    matchMedia: () => ({ matches: reducedMotion, addEventListener() {} }),
    performance: { now: () => now },
    setTimeout(callback, delay) {
      const id = ++nextId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame(callback) {
      const id = ++nextId;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class {
      observe() {}
    },
    IntersectionObserver: class {
      observe() {}
    },
  });
  return {
    q: (selector) => root.querySelector(selector),
    el: (key, value) => root.querySelector(`[data-${key}="${value}"]`),
    advance(milliseconds) {
      const end = now + milliseconds;
      while (now < end) {
        now = Math.min(end, now + 16);
        for (const [id, timer] of timers) {
          if (timer.at <= now) {
            timers.delete(id);
            timer.callback();
          }
        }
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(now));
      }
    },
    idle: () => frames.size === 0 && timers.size === 0,
  };
}

for (const reduced of [false, true]) {
  test(`initial notch is revealed before a frame or hover (reduced motion: ${reduced})`, () => {
    const f = interactionFixture(reduced);
    assert.equal(f.q("[data-frame]").style.transform, "translateY(0px)");
    assert.equal(f.q("[data-frame]").style.opacity, "1");
    assert.equal(f.q("[data-panel-content]").style.opacity, "1");
    assert.equal(f.q("[data-attached]").inert, false);
    assert.equal(f.q("[data-reveal]").textContent, "Hide notch");
    for (const [id, used] of [
      ["lumen", 72],
      ["orbit", 31],
      ["fern", 54],
    ])
      assert.equal(
        f.el("account", id).querySelector("[data-gauge-value]").textContent,
        `${used}%`,
      );
    for (const side of ["pin", "move"])
      assert.equal(f.el("arm", side).style.opacity, "1");
    f.advance(1000);
    assert.equal(f.q("[data-frame]").style.opacity, "1");
    assert.ok(f.idle(), "no idle animation loop or initial auto-close timer");
  });
}

test("peek switches from rest, click holds, and leaving dismisses after the right delay", () => {
  const f = interactionFixture();
  f.el("account", "orbit").emit("pointerenter");
  f.advance(motion.peekSwitch - 1);
  assert.equal(f.q("[data-account-title]").textContent, "Codex Lumen");
  f.advance(1);
  assert.equal(f.q("[data-account-title]").textContent, "Codex Orbit");
  assert.equal(f.q("[data-hold-status]").textContent, "Peek");
  f.el("account", "orbit").emit("click");
  assert.equal(f.q("[data-hold-status]").textContent, "Held open");
  assert.equal(f.el("account", "orbit").getAttribute("aria-pressed"), "true");
  f.el("account", "fern").emit("pointerenter");
  f.advance(500);
  assert.equal(f.q("[data-account-title]").textContent, "Codex Orbit");
  f.q(".notch").emit("pointerleave", { relatedTarget: f.q("[data-attached]") });
  f.advance(2000);
  assert.equal(
    f.q("[data-attached]").inert,
    false,
    "panel crossing stays open",
  );
  f.q("[data-attached]").emit("pointerleave");
  f.advance(motion.heldAway - 1);
  assert.equal(f.q("[data-attached]").inert, false);
  f.advance(1);
  assert.equal(f.q("[data-attached]").inert, true);
  f.advance(1000);
  f.el("account", "fern").emit("pointerenter");
  f.advance(motion.peekOpen);
  assert.equal(f.q("[data-account-title]").textContent, "Claude Fern");
  f.q(".notch").emit("pointerleave");
  f.advance(motion.peekGrace);
  assert.equal(f.q("[data-attached]").inert, true);
  f.advance(1000);
  assert.ok(f.idle());
});

test("hover icons, hide/reveal and reset work directly from the revealed state", () => {
  const f = interactionFixture();
  const arm = f.el("arm", "pin");
  arm.emit("pointerenter");
  f.q("[data-bell]").emit("pointerenter");
  f.advance(2000);
  assert.equal(arm.querySelector("[data-arm-glyph]").style.opacity, "1");
  assert.equal(f.q("[data-bell-glyph]").style.opacity, "1");
  arm.emit("pointerleave");
  f.q("[data-bell]").emit("pointerleave");
  f.advance(2000);
  assert.equal(arm.querySelector("[data-arm-glyph]").style.opacity, "0");
  assert.equal(f.q("[data-bell-glyph]").style.opacity, "0");
  f.q("[data-reveal]").emit("click");
  f.advance(2000);
  assert.equal(f.q("[data-overlay]").hidden, true);
  assert.equal(f.q("[data-reveal]").textContent, "Reveal notch");
  f.q("[data-reveal]").emit("click");
  f.advance(2000);
  assert.equal(f.q("[data-overlay]").hidden, false);
  assert.equal(f.q("[data-frame]").style.opacity, "1");
  assert.equal(arm.style.opacity, "1");
  f.q("[data-reset-demo]").emit("click");
  f.advance(2000);
  assert.equal(f.q("[data-attached]").inert, false);
  assert.equal(f.q("[data-panel-content]").style.opacity, "1");
  assert.equal(f.q("[data-account-title]").textContent, "Codex Lumen");
  assert.equal(f.q("[data-clock]").textContent, "09:00");
  assert.ok(f.idle());
});
