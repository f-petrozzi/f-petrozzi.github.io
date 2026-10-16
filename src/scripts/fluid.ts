/** Bounded disclosure motion; no pointer tracking or idle animation. */
export const RETURN = { response: 0.26, damping: 1 };
export const PANEL_OPEN = { response: 0.28, damping: 1 };
export const clamp = (value: number, low = 0, high = 1) =>
  Math.max(low, Math.min(high, value));

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

// Avoid redundant SVG writes, as in uiMotion.attr.
export function svgAttribute(
  node: Element,
  key: string,
  value: string | number,
) {
  const text = String(value);
  if (node.getAttribute(key) !== text) node.setAttribute(key, text);
}
