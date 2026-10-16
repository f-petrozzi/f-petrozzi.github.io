/** Small radial surface with a closed, smooth contour. Units are SVG pixels. */
export const POINT_COUNT = 48;
const TAU = Math.PI * 2;
export type SurfaceForces = {
  radius: number;
  time: number;
  idle: boolean;
  inertia: number;
  slosh?: number;
  stretchForce?: number;
  pointerX: number;
  pointerY: number;
  contact: number;
  angle: number;
  ripple: number;
};
export const limit = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
// Preserve content-speed response on long pages, but give fast travel along
// the rail the same weight on short pages. Four content pixels per rail pixel
// bridges the existing force tuning to the visible motion of the droplet.
export function dropletVelocity(
  delta: number,
  elapsed: number,
  scrollRange: number,
  railTravel: number,
): number {
  if (scrollRange <= 0 || railTravel <= 0) return 0;
  const trackGain = Math.max(1, (railTravel * 4) / scrollRange);
  return limit(
    (delta / limit(elapsed, 0.008, 0.06)) * trackGain,
    -12000,
    12000,
  );
}

// Keep the original slow-scroll response; fast travel adds a smooth extra stretch.
export function scrollForce(velocity: number): number {
  const speed = Math.abs(velocity);
  const baseline = Math.min(speed / 1700, 1);
  const extra = 0.8 * (1 - Math.exp(-Math.max(0, speed - 1700) / 2600));
  return Math.sign(velocity) * (baseline + extra);
}
const angularDistance = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function targetRadii(forces: SurfaceForces): number[] {
  const {
    radius,
    time,
    idle,
    inertia,
    contact,
    angle,
    ripple,
    slosh = 0,
    stretchForce = inertia,
  } = forces;
  const radii = Array.from({ length: POINT_COUNT }, (_, i) => {
    const a = (i / POINT_COUNT) * TAU;
    // Small travelling waves, not a uniform pulse. Normalization below preserves area.
    const still = idle
      ? 0.22 * Math.sin(a * 2 + time * 0.7) +
        0.14 * Math.sin(a * 3 - time * 1.03)
      : 0;
    const organic = 0.25 * Math.sin(a * 3 + 0.8);
    // Positive/downward velocity gathers volume toward the upper side (-sin).
    const lag =
      -inertia * radius * (0.17 * Math.sin(a) + 0.055 * Math.sin(a * 3));
    const d = angularDistance(a, angle);
    // Negative contact dents the approaching edge; positive contact displaces it outward.
    const pocket =
      contact *
      (contact > 0 ? 1.85 : 1) *
      (radius * 0.34 * Math.exp((-d * d) / (contact > 0 ? 0.34 : 0.22)) -
        radius * 0.065 * Math.exp(-Math.pow(Math.abs(d) - 0.8, 2) / 0.12));
    const wave = ripple * 0.7 * Math.cos(d * 4) * Math.exp((-d * d) / 1.5);
    // Rebounding mass excites a second surface mode, trailing the main slosh.
    const settling =
      radius * 0.065 * slosh * Math.cos(a * 2) +
      radius * 0.035 * slosh * Math.sin(a * 3);
    // Fast travel draws out a thin, rounded column. Lower speeds retain the
    // small liquid silhouette; area normalization draws the sides inward.
    const stretch = Math.max(0, Math.abs(stretchForce) - 0.85);
    const length = 1 + stretch * 1.9;
    const width = 1 / Math.sqrt(length);
    const exponent = 2 + Math.min(0.6, stretch);
    const column =
      radius /
      Math.pow(
        Math.pow(Math.abs(Math.cos(a)) / width, exponent) +
          Math.pow(Math.abs(Math.sin(a)) / length, exponent),
        1 / exponent,
      );
    // Small radial ripples become large necks on a thin column. Suppress those
    // modes while stretched; restore them as the liquid gathers and rebounds.
    const surfaceDetail = 1 / (1 + stretch * 16);
    return (
      column +
      pocket +
      (organic + still + lag + wave + settling) * surfaceDetail
    );
  });
  return conserveArea(radii, radius);
}

export function conserveArea(radii: number[], radius: number): number[] {
  // Polar polygon area. Retain equal apparent volume as the material is displaced.
  const area =
    (Math.sin(TAU / radii.length) *
      radii.reduce((sum, r, i) => sum + r * radii[(i + 1) % radii.length], 0)) /
    2;
  const circlePolygonArea =
    (radii.length * Math.sin(TAU / radii.length) * radius * radius) / 2;
  const scale = Math.sqrt(circlePolygonArea / Math.max(1, area));
  return radii.map((r) => limit(r * scale, radius * 0.25, radius * 3.5));
}

export function surfacePath(
  radii: number[],
  offsetX = 0,
  offsetY = 0,
  pullX = 0,
  pullY = 0,
): string {
  const pull = Math.hypot(pullX, pullY);
  const axisX = pull ? pullX / pull : 1;
  const axisY = pull ? pullY / pull : 0;
  // Concentrate the extension near the grabbed tip, with a firm upper limit.
  const extension = 0.32 * Math.min(1, pull);
  const rear = Math.min(
    ...radii.map((r, i) => {
      const a = (i / radii.length) * TAU;
      return r * (Math.cos(a) * axisX + Math.sin(a) * axisY);
    }),
  );
  const front = Math.max(
    ...radii.map((r, i) => {
      const a = (i / radii.length) * TAU;
      return r * (Math.cos(a) * axisX + Math.sin(a) * axisY);
    }),
  );
  const span = Math.max(1, front - rear);
  const points = radii.map((r, i) => {
    const angle = (i / radii.length) * TAU;
    const x = Math.cos(angle) * r,
      y = Math.sin(angle) * r;
    const projection = x * axisX + y * axisY;
    const fraction = limit((projection - rear) / span, 0, 1);
    const along = projection + extension * span * fraction ** 3;
    // Compress locally by the axial derivative, preserving area as the tip stretches.
    const across =
      (-x * axisY + y * axisX) / (1 + 3 * extension * fraction ** 2);
    return {
      x: 40 + offsetX + along * axisX - across * axisY,
      y: 45 + offsetY + along * axisY + across * axisX,
    };
  });
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i + points.length - 1) % points.length];
    const start = points[i];
    const end = points[(i + 1) % points.length];
    const next = points[(i + 2) % points.length];
    d += `C${f(start.x + (end.x - prev.x) / 6)} ${f(start.y + (end.y - prev.y) / 6)} ${f(end.x - (next.x - start.x) / 6)} ${f(end.y - (next.y - start.y) / 6)} ${f(end.x)} ${f(end.y)}`;
  }
  return d + "Z";
}
