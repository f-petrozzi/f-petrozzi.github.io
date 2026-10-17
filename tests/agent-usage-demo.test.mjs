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

test("notch preserves body fillets and detached mirrored round arms in one fixed palette", () => {
  const component = readFileSync(
    new URL("../src/components/demos/AgentUsageDemo.astro", import.meta.url),
    "utf8",
  );
  const script = readFileSync(
    new URL("../src/scripts/demos/agent-usage.ts", import.meta.url),
    "utf8",
  );
  const css = component.split("<style is:inline>")[1];
  assert.ok(css.trimStart().startsWith(".demo-agent-usage {"));
  assert.equal((component.match(/<style/g) ?? []).length, 1);
  assert.match(css, /--au-black:\s*#000;/);
  assert.match(css, /\.notch-material\s*\{[^}]*fill: var\(--au-black\);/);
  assert.doesNotMatch(component + script, /arm-rest/);
  assert.match(
    css,
    /\.arm-stroke\s*\{[^}]*fill: none;[^}]*stroke: var\(--au-black\);[^}]*stroke-width: 11.57;[^}]*stroke-linecap: round;/,
  );
  assert.doesNotMatch(
    css,
    /:global|var\(--(?:bg|ink|muted|line)\)|backdrop-filter/,
  );
  // Reference shape.js partPath, lines 109-114, at width=350 and depth=90.
  // One closed contour keeps both fillets flush with the top and body sides.
  // The first arc is centred at (-F,F), the last at (350+F,F): both concave.
  const filletRadius = Number((38.7 * Math.sqrt(90 / 70)).toFixed(2));
  assert.equal(filletRadius, 43.88);
  const notch = component.match(/<path\s+data-notch-ink\s+([^>]+)>/)[1];
  assert.match(notch, /fill="var\(--au-black\)"\s+stroke="none"/);
  assert.ok(
    notch.includes(
      `d="M-${filletRadius} -40V0A${filletRadius} ${filletRadius} 0 0 1 0 ${filletRadius}V70A20 20 0 0 0 20 90H330A20 20 0 0 0 350 70V${filletRadius}A${filletRadius} ${filletRadius} 0 0 1 ${350 + filletRadius} 0V-40Z"`,
    ),
  );
  // shape.js drawArm uses a concentric quarter arc, with straight legs.
  const scale = Math.sqrt(90 / 70);
  const stroke = 10.2 * scale;
  const radius = 38.7 * scale - stroke / 2 - 5 * scale;
  assert.equal(Number(radius.toFixed(2)), 32.43);
  assert.equal(Number((9 * scale).toFixed(2)), 10.21);
  assert.equal(Number(stroke.toFixed(2)), 11.57);
  assert.ok(
    component.includes('d="M-10.21 -32.43H0A32.43 32.43 0 0 1 32.43 0V10.21"'),
  );
  assert.ok(component.includes("i ? 393.88 : -43.88"));
  assert.ok(component.includes('i ? "scale(-1 1)" : undefined'));
  assert.ok(component.includes('transform="translate(175 80)"'));
  assert.doesNotMatch(css, /inset: -80px/);
  assert.ok(component.includes('stdDeviation="4"'));
  assert.ok(component.includes("0 0 0 10.4 -4.7"));
  assert.ok(
    component.includes("crypto.randomUUID()"),
    "filter ids are per instance",
  );
  assert.doesNotMatch(component + script, /(?:import|from)[^;\n]*fluid/);
  assert.ok(
    component.includes(
      'd="M6.4 16.6V11a5.6 5.6 0 0 1 11.2 0v5.6l1.7 1.9H4.7z"',
    ),
    "use the real notch.html bell outline",
  );
  assert.ok(component.includes('<path d="M10 21h4">'));
  assert.match(css.match(/\.bell-glyph\s*\{([^}]+)\}/)[1], /opacity: 0/);
  assert.match(css.match(/\.bell-disc\s*\{([^}]+)\}/)[1], /opacity: 0/);
  for (const selector of [
    "notch",
    "notch-material",
    "attached-panel",
    "alert-sliver",
  ])
    assert.match(
      css,
      new RegExp(`\\.${selector}\\s*\\{[^}]*width: var\\(--au-notch-width\\);`),
    );
  assert.match(script, /ink.style.transform = `scale\(1, \$\{d\}\)`/);
  assert.match(css, /\.notch-frame\s*\{[^}]*min-height: 125px;/);
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
  assert.deepEqual(
    first.accounts.map((account) => account.provider),
    ["Codex", "Claude", "AGY", "Codex"],
  );
  assert.equal(windowOf(0, "nova").used, 37);
  assert.ok(windowOf(15, "nova").used > windowOf(0, "nova").used);
  assert.equal(usage.providerPath("AGY"), usage.providerPaths.agy);
  assert.notEqual(usage.providerPath("AGY"), usage.providerPaths.claude);
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
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    focus() {
      this.emit("focus");
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
  root.querySelector("[data-goo]").id = "fixture-goo";
  const visibilityListeners = new Map();
  const documentHost = {
    hidden: false,
    querySelectorAll(selector) {
      assert.equal(selector, '[data-demo="agent-usage"]');
      return [root];
    },
    addEventListener(name, callback) {
      visibilityListeners.set(name, callback);
    },
  };
  let viewportChanged;
  let motionChanged;
  let resize;
  const media = {
    matches: reducedMotion,
    addEventListener(name, callback) {
      motionChanged = callback;
    },
  };
  const groups = new Map();
  for (const [selector, key, values] of [
    ["[data-account]", "account", ["lumen", "fern", "nova", "orbit"]],
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
    document: documentHost,
    window: { addEventListener() {} },
    matchMedia: () => media,
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
      constructor(callback) {
        resize = callback;
      }
      observe() {}
    },
    IntersectionObserver: class {
      constructor(callback) {
        viewportChanged = callback;
      }
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
    setInViewport(value) {
      viewportChanged([{ isIntersecting: value }]);
    },
    setHidden(value) {
      documentHost.hidden = value;
      visibilityListeners.get("visibilitychange")();
    },
    setReducedMotion(value) {
      media.matches = value;
      motionChanged();
    },
    resize(width, panelWidth, panelHeight) {
      root.querySelector(".notch").clientWidth = width;
      root.querySelector("[data-attached]").offsetWidth = panelWidth;
      root.querySelector("[data-attached]").offsetHeight = panelHeight;
      resize();
    },
  };
}

for (const reduced of [false, true]) {
  test(`initial notch is revealed before a frame or hover (reduced motion: ${reduced})`, () => {
    const f = interactionFixture(reduced);
    assertNoGoo(f);
    assert.equal(f.q("[data-frame]").style.transform, "translateY(0px)");
    assert.equal(f.q("[data-frame]").style.opacity, "1");
    assert.equal(f.q("[data-panel-content]").style.opacity, "1");
    assert.equal(f.q("[data-bell-glyph]").style.opacity, "0");
    assert.equal(f.q("[data-bell-disc]").style.opacity, "0");
    assert.equal(f.q("[data-unread]").hidden, false);
    assert.equal(f.q("[data-attached]").inert, false);
    assert.equal(f.q("[data-reveal]").textContent, "Hide notch");
    for (const [id, used] of [
      ["lumen", 72],
      ["orbit", 31],
      ["fern", 54],
      ["nova", 37],
    ])
      assert.equal(
        f.el("account", id).querySelector("[data-gauge-value]").textContent,
        `${used}%`,
      );
    for (const side of ["pin", "move"]) {
      assert.equal(f.el("arm", side).style.opacity, "1");
      assert.equal(f.q(`[data-arm-stroke="${side}"]`).style.opacity, "1");
    }
    f.advance(1000);
    assert.equal(f.q("[data-frame]").style.opacity, "1");
    assert.ok(f.idle(), "no idle animation loop or initial auto-close timer");
  });
}

test("AGY opens its own usage with a sparkle and independent readings", () => {
  const f = interactionFixture();
  f.el("account", "nova").emit("click");
  assert.equal(f.q("[data-account-title]").textContent, "AGY Nova");
  assert.equal(
    f.q("[data-title-mark]").getAttribute("d"),
    usage.providerPaths.agy,
  );
  assert.equal(f.el("account", "nova").getAttribute("aria-expanded"), "true");
  assert.equal(
    f.q('[data-usage-window="fiveHour"]').querySelector("[data-used]")
      .textContent,
    "37% used",
  );
  assert.equal(
    f.q('[data-usage-window="weekly"]').querySelector("[data-used]")
      .textContent,
    "23% used",
  );
  f.q("[data-advance]").emit("click");
  assert.equal(
    f.el("account", "nova").querySelector("[data-gauge-value]").textContent,
    "40%",
  );
});

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
  assert.equal(f.q('[data-arm-stroke="pin"]').style.opacity, "0");
  assert.equal(f.q("[data-bell-glyph]").style.opacity, "1");
  arm.emit("pointerleave");
  f.q("[data-bell]").emit("pointerleave");
  f.advance(2000);
  assert.equal(arm.querySelector("[data-arm-glyph]").style.opacity, "0");
  assert.equal(f.q('[data-arm-stroke="pin"]').style.opacity, "1");
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
  assert.equal(f.q("[data-bell-glyph]").style.opacity, "0");
  assert.equal(f.q("[data-unread]").hidden, false);
  assert.ok(f.idle());
});

function assertNoGoo(f) {
  assert.equal(f.q("[data-liquid]").getAttribute("filter"), null);
}
function assertGoo(f) {
  assert.equal(
    f.q("[data-liquid]").getAttribute("filter"),
    "url(#fixture-goo)",
  );
}

test("arm, peek and reveal springs enable goo only until they settle", () => {
  const f = interactionFixture();
  f.advance(1000);
  assertNoGoo(f);
  for (const selector of ['[data-arm="pin"]', '[data-arm="move"]']) {
    f.q(selector).emit("pointerenter");
    f.advance(16);
    assertGoo(f);
    f.advance(2000);
    assertNoGoo(f);
    f.q(selector).emit("pointerleave");
    f.advance(16);
    assertGoo(f);
    f.advance(2000);
    assertNoGoo(f);
    assert.ok(f.idle());
  }
  f.el("account", "lumen").emit("pointerenter");
  f.advance(motion.peekOpen + 1500);
  f.q(".notch").emit("pointerleave");
  f.advance(motion.peekGrace + 16);
  assertGoo(f);
  f.advance(1500);
  assertNoGoo(f);
  f.el("account", "fern").emit("pointerenter");
  f.advance(motion.peekOpen + 16);
  assertGoo(f);
  f.advance(1500);
  assertNoGoo(f);
  f.q("[data-reveal]").emit("click");
  f.advance(16);
  assertGoo(f);
  f.advance(2000);
  assertNoGoo(f);
  f.q("[data-reveal]").emit("click");
  f.advance(16);
  assertGoo(f);
  f.advance(2000);
  assertNoGoo(f);
  assert.ok(f.idle());
});

test("unread dot rests inside the bottom-left corner and rides the bell on hover", () => {
  const f = interactionFixture();
  assert.equal(f.q("[data-bell-disc]").style.opacity, "0");
  assert.equal(f.q("[data-bell-glyph]").style.opacity, "0");
  const rest = f.q("[data-unread]").style.transform;
  const [, dotX, dotY] = rest.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
  const homeX = 20 - Math.SQRT1_2 * 45.77;
  const homeY = 70 + Math.SQRT1_2 * 45.77;
  assert.ok(Math.abs(Number(dotX) + homeX - (20 - Math.SQRT1_2 * 10)) < 0.01);
  assert.ok(Math.abs(Number(dotY) + homeY - (70 + Math.SQRT1_2 * 10)) < 0.01);
  f.q("[data-bell]").emit("pointerenter");
  f.advance(2000);
  const transform = f.q("[data-bell-disc]").style.transform;
  const [, x, y] = transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
  assert.ok(Number(x) < 0, "bell clears the leading flank");
  assert.ok(Number(y) > 90, "bell clears the front edge");
  assert.ok(
    Math.abs(Math.hypot(Number(x) - 20, Number(y) - 70) - 20 - 21.77 - 4) <
      0.01,
  );
  assert.equal(f.q("[data-bell-disc]").style.opacity, "1");
  assert.equal(f.q("[data-bell-glyph]").style.opacity, "1");
  assert.equal(
    f.q("[data-bell-glyph]").style.transform,
    "translate(0px, 0px) scale(1) rotate(0deg)",
    "glyph centre coincides with the revealed drop and button centre",
  );
  assert.equal(
    f.q("[data-unread]").style.transform,
    "translate(7.45px, -8.54px)",
    "badge sits on the shoulder (.34,-.39 glyph sizes in notify.js)",
  );
  assert.equal(f.q("[data-attached]").hidden, true, "card gives the bell room");
  f.q("[data-bell]").emit("click");
  assert.equal(f.q("[data-bell]").getAttribute("aria-expanded"), "true");
  assert.equal(
    f.q("[data-unread]").hidden,
    true,
    "opening the log reads alerts",
  );
  f.q("[data-bell]").emit("pointerleave");
  f.q("[data-bell]").emit("blur");
  f.advance(2000);
  assert.equal(f.q("[data-bell-glyph]").style.opacity, "0");
  assert.equal(f.q("[data-unread]").style.transform, rest);
  assertNoGoo(f);
  assert.ok(f.idle());
});

for (const suspend of ["setInViewport", "setHidden", "setReducedMotion"]) {
  test(`goo and frame work stop on ${suspend}`, () => {
    const f = interactionFixture();
    f.el("arm", "pin").emit("pointerenter");
    f.advance(32);
    assertGoo(f);
    f[suspend](suspend !== "setInViewport");
    assertNoGoo(f);
    assert.ok(f.idle());
  });
}

test("reduced motion and touch hover keep ink sharp and leave no frame loop", () => {
  for (const reduced of [false, true]) {
    const f = interactionFixture(reduced);
    f.advance(1000);
    for (const selector of ['[data-arm="pin"]', "[data-bell]"])
      f.q(selector).emit("pointerenter", { pointerType: "touch" });
    f.advance(32);
    assert.equal(
      f.el("arm", "pin").querySelector("[data-arm-glyph]").style.opacity,
      "0",
    );
    assert.equal(f.q("[data-bell-glyph]").style.opacity, "0");
    assertNoGoo(f);
    assert.ok(f.idle());
    if (reduced) {
      f.el("arm", "pin").emit("focus");
      f.q("[data-bell]").emit("focus");
      f.advance(16);
      assert.equal(f.q("[data-bell-glyph]").style.opacity, "1");
      assertNoGoo(f);
      assert.ok(f.idle());
    }
  }
});

test("resizing updates card geometry once while motion leaves it unchanged", () => {
  const f = interactionFixture();
  f.advance(1000);
  f.resize(180, 180, 320);
  const ink = f.q("[data-panel-ink]");
  assert.ok(Math.abs(Number(ink.getAttribute("width")) - 350) < 1e-9);
  assert.ok(Math.abs(Number(ink.getAttribute("x")) + 175) < 1e-9);
  assert.equal(ink.getAttribute("height"), "320");
  const geometry = [...ink.attributes];
  f.el("arm", "pin").emit("pointerenter");
  f.advance(2000);
  assert.deepEqual([...ink.attributes], geometry);
  assertNoGoo(f);
});
