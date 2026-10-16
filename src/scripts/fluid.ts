/** Opt-in liquid motion. Springs settle completely; filters detach at rest. */
export const APPROACH = { response: 0.34, damping: 0.82 };
export const RETURN = { response: 0.38, damping: 0.86 };
export const PANEL_OPEN = { response: 0.42, damping: 0.84 };
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

export type Proximity = { x: number; y: number; strength: number };

// Circular falloff and a bounded pull, like the scroll droplet's displaced mass.
export function proximityAt(
  x: number,
  y: number,
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  reach = 96,
): Proximity {
  const dx = x - rect.left - rect.width / 2,
    dy = y - rect.top - rect.height / 2,
    distance = Math.hypot(dx, dy),
    strength = smooth(1 - distance / reach),
    pull = distance ? Math.min(2.6, distance * strength * 0.14) / distance : 0;
  return { x: dx * pull, y: dy * pull, strength };
}

// Transform an intact round surface; the glyph can follow without stretching.
export function dropletTransform({ x, y, strength }: Proximity) {
  const angle = (Math.atan2(y, x) * 180) / Math.PI,
    stretch = Math.min(1, Math.hypot(x, y) / 2.6) * clamp(strength);
  return `translate(${n(x)}px, ${n(y)}px) rotate(${n(angle)}deg) scale(${n(1 + stretch * 0.13)}, ${n(1 - stretch * 0.045)}) rotate(${n(-angle)}deg)`;
}

export function trackProximity(
  card: HTMLElement,
  anchor: HTMLElement,
  paint: (value: Proximity, moving: boolean) => void,
  {
    reduced = matchMedia("(prefers-reduced-motion: reduce)"),
    request = requestAnimationFrame,
    cancel = cancelAnimationFrame,
    clock = () => performance.now(),
    enabled = () => true,
  } = {},
) {
  let value: Proximity = { x: 0, y: 0, strength: 0 },
    target = { ...value },
    velocity = { ...value },
    bounds: DOMRect | null = null,
    frame = 0,
    last = 0;
  const keys = ["x", "y", "strength"] as const;
  function tick(now: number) {
    frame = 0;
    const dt = (now - last) / 1000;
    last = now;
    const preset = target.strength > value.strength ? APPROACH : RETURN;
    for (const key of keys)
      [value[key], velocity[key]] = springStep(
        value[key],
        velocity[key],
        target[key],
        dt,
        preset,
      );
    const settled = keys.every(
      (key) =>
        Math.abs(value[key] - target[key]) < 0.002 &&
        Math.abs(velocity[key]) < 0.025,
    );
    if (settled) {
      value = { ...target };
      velocity = { x: 0, y: 0, strength: 0 };
    }
    paint({ ...value }, !settled);
    if (!settled) frame = request(tick);
  }
  function aim(next: Proximity) {
    if (keys.every((key) => next[key] === target[key])) return;
    target = next;
    if (!frame) {
      last = clock();
      frame = request(tick);
    }
  }
  function move(event: PointerEvent) {
    if (event.pointerType !== "mouse" || reduced.matches || !enabled()) return;
    bounds ??= anchor.getBoundingClientRect();
    aim(proximityAt(event.clientX, event.clientY, bounds));
  }
  const leave = () => aim({ x: 0, y: 0, strength: 0 });
  function stop() {
    cancel(frame);
    frame = 0;
    velocity = { x: 0, y: 0, strength: 0 };
    target = { ...value };
    paint({ ...value }, false);
  }
  function reset() {
    cancel(frame);
    frame = 0;
    bounds = null;
    target = value = { x: 0, y: 0, strength: 0 };
    velocity = { ...value };
    paint({ ...value }, false);
  }
  card.addEventListener("pointermove", move, { passive: true });
  card.addEventListener("pointerleave", leave);
  // Invalidate cached geometry without reading layout from a scroll handler.
  const invalidate = () => {
    bounds = null;
    if (frame || keys.some((key) => value[key] || target[key])) reset();
  };
  window.addEventListener("scroll", invalidate, { passive: true });
  window.addEventListener("resize", invalidate, { passive: true });
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
      window.removeEventListener("resize", invalidate);
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
