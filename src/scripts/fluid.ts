/** Opt-in liquid motion (no work at import time).
 * springStep(x, velocity, target, seconds, preset?) defaults to critical damping;
 * ARM_APPROACH/ARM_RETURN and PANEL_OPEN preserve Agent Usage's notch timing.
 * armGeometry(progress, scale?) returns the notch's contour, bowed strand and bead.
 * trackProximity(card, anchor, paint) calls paint(value, moving, swayDegrees);
 * stop() freezes, reset() returns home, destroy() removes listeners. Frames end
 * when settled (including the bounded snap sway). Touch/reduced motion stay still.
 * applyGooFilter(svg, group) owns a bounded SVG filter; update(sigma, moving, bounds?)
 * removes it at rest. Import styles/fluid.css separately for opt-in SVG classes.
 * Ported from Agent-Usage desktop/ui/runtime.js (spring), shape.js (morphHandles,
 * drawArm, openShape, swayFor, setGooBlur), and notch.js (near). The square reach
 * gains a card-distance ramp before hover; geometry is scaled to the info mark.
 */
export const ARM_APPROACH = { response: 0.74, damping: 0.86 };
export const ARM_RETURN = { response: 0.82, damping: 0.9 };
export const PANEL_OPEN = { response: 0.62, damping: 0.72 };
export const clamp = (value: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, value));
const smooth = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};
const n = (value: number) => +value.toFixed(2);

export function springStep(
  x: number,
  v: number,
  target: number,
  elapsed: number,
  { response = 0.74, damping = 1 } = {},
): [number, number] {
  const dt = clamp(elapsed, 0, 0.1),
    omega = (2 * Math.PI) / response,
    y = x - target;
  if (!dt) return [x, v];
  if (damping < 1) {
    const a = damping * omega,
      b = omega * Math.sqrt(1 - damping * damping),
      e = Math.exp(-a * dt),
      c = Math.cos(b * dt),
      s = Math.sin(b * dt),
      q = (v + a * y) / b;
    return [
      target + e * (y * c + q * s),
      e * (v * c - ((a * v + omega * omega * y) / b) * s),
    ];
  }
  if (Math.abs(damping - 1) < 1e-6) {
    const q = v + omega * y,
      e = Math.exp(-omega * dt);
    return [target + (y + q * dt) * e, (v - omega * q * dt) * e];
  }
  const d = Math.sqrt(damping * damping - 1),
    a = -omega * (damping - d),
    b = -omega * (damping + d),
    p = (v - b * y) / (a - b),
    q = y - p;
  return [
    target + p * Math.exp(a * dt) + q * Math.exp(b * dt),
    a * p * Math.exp(a * dt) + b * q * Math.exp(b * dt),
  ];
}

// Agent Usage's square `near` hit region, with a smooth approach outside it.
export function proximityAt(
  x: number,
  y: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  reach = 70,
) {
  const dx = x - rect.left - rect.width / 2,
    dy = y - rect.top - rect.height / 2,
    distance = Math.max(Math.abs(dx), Math.abs(dy)),
    inside = Math.max(rect.width, rect.height) / 2;
  return smooth((reach - distance) / Math.max(1, reach - inside));
}

export function armSway(seconds: number) {
  return seconds >= 0 && seconds < 1.2
    ? 14 * Math.exp(-seconds / 0.26) * Math.sin((2 * Math.PI * seconds) / 0.38)
    : 0;
}

// drawArm's inset flare contour, gather, quadratic lift and reversible pinching
// strand. Local origin is the flare pocket; one even gap follows both legs.
export function armGeometry(value: number, scale = 1) {
  const disc = clamp(value),
    F = 38.7 * scale,
    stroke = 10.2 * scale,
    R = 24 * scale,
    rho = F - stroke / 2 - 5 * scale,
    leg = 9 * scale,
    H = (rho * Math.PI) / 4 + leg,
    mid = -Math.PI / 4,
    dir = [Math.cos(mid), Math.sin(mid)],
    contour = (sigma: number) => {
      const arc = (rho * Math.PI) / 4,
        th = mid + clamp(sigma, -arc, arc) / rho,
        p = [rho * Math.cos(th), rho * Math.sin(th)],
        over = Math.abs(sigma) - arc;
      return over <= 0
        ? p
        : [
            p[0] - Math.sign(sigma) * Math.sin(th) * over,
            p[1] + Math.sign(sigma) * Math.cos(th) * over,
          ];
    };
  const gather = smooth(disc / 0.42),
    lift = smooth((disc - 0.28) / 0.72),
    src = dir.map((d) => (F + stroke * 0.3) * d),
    perp = [-dir[1], dir[0]],
    bow = (p0: number[], p1: number[], k: number) => {
      const l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      return p0.map((p, i) => (p + p1[i]) / 2 + perp[i] * l * k);
    },
    quad = (p0: number[], c: number[], p1: number[], t: number) =>
      p0.map(
        (p, i) => (1 - t) ** 2 * p + 2 * (1 - t) * t * c[i] + t * t * p1[i],
      ),
    mid0 = contour(0),
    bead = quad(mid0, bow(mid0, [0, 0], 0.3), [0, 0], lift),
    shift = bead.map((p, i) => p - mid0[i]),
    sc = bow(src, bead, 0.22),
    extent = H * (1 - gather),
    points = Array.from({ length: 41 }, (_, k) => {
      const q = contour(-extent + (2 * extent * k) / 40);
      return `${k ? "L" : "M"}${n(q[0] + shift[0])} ${n(q[1] + shift[1])}`;
    });
  const beadRadius = stroke * 0.75 + (R - stroke * 0.75) * smooth(lift),
    width =
      stroke * (1 + 0.5 * gather) +
      (2 * beadRadius - stroke * (1 + 0.5 * gather)) * smooth(lift),
    tip = 1 - smooth((lift - 0.82) / 0.18);
  let neck = "";
  if (tip > 0.02 && lift > 0.01) {
    const thin = 1 - smooth((lift - 0.25) / (0.82 - 0.25)),
      base = stroke * 1.3,
      pinch = Math.max(0.5, stroke * 0.95 * thin),
      tail = Math.max(0.5, stroke * 0.35),
      end = tail + (beadRadius * 0.78 - tail) * tip,
      left: string[] = [],
      right: string[] = [];
    for (let k = 0; k <= 20; k++) {
      const f = k / 20,
        t = f * tip,
        q = quad(src, sc, bead, t),
        tangent = sc.map(
          (p, i) => 2 * (1 - t) * (p - src[i]) + 2 * t * (bead[i] - p),
        ),
        len = Math.hypot(...tangent) || 1,
        [gx, gy] = tangent.map((p) => p / len),
        half =
          f < 0.55
            ? base + (pinch - base) * smooth(f / 0.55)
            : pinch + (end - pinch) * smooth((f - 0.55) / 0.45);
      left.push(`${n(q[0] - gy * half)} ${n(q[1] + gx * half)}`);
      right.push(`${n(q[0] + gy * half)} ${n(q[1] - gx * half)}`);
    }
    neck = `M${left.join("L")}L${right.reverse().join("L")}Z`;
  }
  return {
    arm: points.join(""),
    neck,
    lift,
    strokeWidth: width,
    blur: stroke * 0.72 * Math.pow(Math.sin(Math.PI * lift), 0.55),
    x: shift[0],
    y: shift[1],
    originX: 22 - mid0[0],
    originY: 22 - mid0[1],
  };
}

export function trackProximity(
  card: HTMLElement,
  anchor: HTMLElement,
  paint: (value: number, moving: boolean, sway: number) => void,
  {
    reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    request = requestAnimationFrame,
    cancel = cancelAnimationFrame,
    clock = () => performance.now(),
    enabled = () => true,
  } = {},
) {
  let value = 0,
    velocity = 0,
    target = 0,
    frame = 0,
    last = 0;
  let preset = ARM_APPROACH;
  let snapAt = 0;
  function tick(now: number) {
    frame = 0;
    [value, velocity] = springStep(
      value,
      velocity,
      target,
      (now - last) / 1000,
      preset,
    );
    last = now;
    const settled =
      Math.abs(value - target) < 0.002 && Math.abs(velocity) < 0.025;
    if (settled) {
      value = target;
      velocity = 0;
    }
    const lift = smooth((clamp(value) - 0.28) / 0.72);
    if (preset === ARM_RETURN || lift < 0.5) snapAt = 0;
    else if (lift > 0.82 && !snapAt) snapAt = now;
    const since = snapAt ? (now - snapAt) / 1000 : 9;
    paint(value, !settled, armSway(since));
    if (!settled || since < 1.2) frame = request(tick);
  }
  function aim(next: number) {
    if (next === target) return;
    preset = next > target ? ARM_APPROACH : ARM_RETURN;
    target = next;
    if (!frame) {
      last = clock();
      frame = request(tick);
    }
  }
  function move(event: PointerEvent) {
    if (event.pointerType !== "mouse" || reduced.matches || !enabled()) return;
    aim(
      proximityAt(event.clientX, event.clientY, anchor.getBoundingClientRect()),
    );
  }
  const leave = () => aim(0);
  function stop() {
    cancel(frame);
    frame = snapAt = velocity = 0;
    target = value;
    paint(value, false, 0);
  }
  function reset() {
    cancel(frame);
    frame = snapAt = 0;
    target = value = velocity = 0;
    paint(0, false, 0);
  }
  card.addEventListener("pointermove", move, { passive: true });
  card.addEventListener("pointerleave", leave);
  // A scroll can move a card out from under a stationary cursor.
  const invalidate = () => {
    if (target || frame) reset();
  };
  window.addEventListener("scroll", invalidate, { passive: true });
  window.addEventListener("blur", invalidate);
  reduced.addEventListener("change", reset);
  return {
    stop,
    reset,
    destroy() {
      reset();
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", invalidate);
      window.removeEventListener("blur", invalidate);
      reduced.removeEventListener("change", reset);
    },
  };
}

// Avoid redundant SVG writes, as in uiMotion.attr.
export function svgAttribute(
  node: Element,
  key: string,
  value: string | number,
) {
  const text = String(value);
  if (node.getAttribute(key) !== text) node.setAttribute(key, text);
}

let filterId = 0;
export function applyGooFilter(svg: SVGSVGElement, group: SVGGElement) {
  const ns = "http://www.w3.org/2000/svg",
    filter = document.createElementNS(ns, "filter"),
    blur = document.createElementNS(ns, "feGaussianBlur"),
    matrix = document.createElementNS(ns, "feColorMatrix"),
    defs = document.createElementNS(ns, "defs"),
    reduced = matchMedia("(prefers-reduced-motion: reduce)");
  filter.id = `fluid-goo-${++filterId}`;
  for (const [key, value] of Object.entries({
    filterUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  }))
    filter.setAttribute(key, value);
  filter.append(blur, matrix);
  defs.append(filter);
  svg.prepend(defs);
  function update(
    sigma: number,
    moving: boolean,
    bounds = { x: -44, y: -44, width: 132, height: 132 },
  ) {
    // A gathered arm is a point with a round stroke. Its geometry bounding box
    // has zero area, so objectBoundingBox filters would make that bead disappear.
    for (const [key, value] of Object.entries(bounds))
      svgAttribute(filter, key, n(value));
    sigma = moving && !reduced.matches ? Math.max(0, sigma) : 0;
    svgAttribute(blur, "stdDeviation", n(sigma));
    const k = clamp(2.6 * sigma, 1, 24);
    svgAttribute(
      matrix,
      "values",
      `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${n(k)} ${n(0.5 - k / 2)}`,
    );
    if (sigma > 0.3) svgAttribute(group, "filter", `url(#${filter.id})`);
    else group.removeAttribute("filter");
  }
  const stop = () => update(0, false);
  reduced.addEventListener("change", stop);
  stop();
  return {
    update,
    destroy() {
      stop();
      reduced.removeEventListener("change", stop);
      defs.remove();
    },
  };
}
