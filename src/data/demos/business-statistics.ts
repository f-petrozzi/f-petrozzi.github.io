export const predictorNames = ["Age", "BMI", "Smoker (0/1)"];
export const observations = Array.from({ length: 18 }, (_, i) => {
  const age = 22 + ((i * 7) % 43),
    bmi = 21 + ((i * 5) % 16),
    smoker = i % 4 === 0 ? 1 : 0;
  const charges =
    900 +
    145 * age +
    210 * bmi +
    11500 * smoker +
    [500, -900, 250, -400, 800, -200][i % 6];
  return { predictors: [age, bmi, smoker], charges };
});
export type Observation = { predictors: number[]; charges: number };
export function regress(rows: Observation[], selected: number[]) {
  if (
    !rows.length ||
    rows.length <= selected.length + 1 ||
    new Set(selected).size !== selected.length
  )
    throw new Error("Insufficient observations or duplicate predictors");
  const x = rows.map((r) => [1, ...selected.map((i) => r.predictors[i])]);
  const n = selected.length + 1;
  const augmented = Array.from({ length: n }, (_, j) => [
    ...Array.from({ length: n }, (_, k) =>
      x.reduce((s, row) => s + row[j] * row[k], 0),
    ),
    x.reduce((s, row, i) => s + row[j] * rows[i].charges, 0),
  ]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(augmented[r][c]) > Math.abs(augmented[pivot][c])) pivot = r;
    [augmented[c], augmented[pivot]] = [augmented[pivot], augmented[c]];
    const divisor = augmented[c][c];
    if (Math.abs(divisor) < 1e-10) throw new Error("Collinear predictors");
    augmented[c] = augmented[c].map((v) => v / divisor);
    for (let r = 0; r < n; r++)
      if (r !== c) {
        const factor = augmented[r][c];
        augmented[r] = augmented[r].map((v, j) => v - factor * augmented[c][j]);
      }
  }
  const coefficients = augmented.map((row) => row[n]);
  const fitted = x.map((row) =>
    row.reduce((s, v, j) => s + v * coefficients[j], 0),
  );
  const residuals = rows.map((row, i) => row.charges - fitted[i]);
  const mean = rows.reduce((s, row) => s + row.charges, 0) / rows.length;
  const sse = residuals.reduce((s, v) => s + v * v, 0),
    sst = rows.reduce((s, row) => s + (row.charges - mean) ** 2, 0);
  return {
    coefficients,
    fitted,
    residuals,
    r2: sst ? 1 - sse / sst : sse < 1e-12 ? 1 : 0,
    sse,
  };
}
export type Point = { x: number; y: number };
export function solveProduction(labor: number, material: number) {
  if (
    !Number.isFinite(labor) ||
    !Number.isFinite(material) ||
    labor < 0 ||
    material < 0
  )
    throw new Error("Resources must be finite and nonnegative");
  // Boundary equations: 2x+y=labor; x+2y=material; x=0; y=0.
  const lines = [
    [2, 1, labor],
    [1, 2, material],
    [1, 0, 0],
    [0, 1, 0],
  ];
  const vertices: Point[] = [];
  for (let i = 0; i < lines.length; i++)
    for (let j = i + 1; j < lines.length; j++) {
      const [a, b, c] = lines[i],
        [d, e, f] = lines[j],
        det = a * e - b * d;
      if (!det) continue;
      const x = (c * e - b * f) / det,
        y = (a * f - c * d) / det;
      if (
        x >= -1e-9 &&
        y >= -1e-9 &&
        2 * x + y <= labor + 1e-9 &&
        x + 2 * y <= material + 1e-9 &&
        !vertices.some(
          (p) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9,
        )
      )
        vertices.push({ x: Math.max(0, x), y: Math.max(0, y) });
    }
  const center = {
    x: vertices.reduce((s, p) => s + p.x, 0) / vertices.length,
    y: vertices.reduce((s, p) => s + p.y, 0) / vertices.length,
  };
  vertices.sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) -
      Math.atan2(b.y - center.y, b.x - center.x),
  );
  const objective = (p: Point) => 40 * p.x + 30 * p.y;
  const optimum = vertices.reduce(
    (best, p) => (objective(p) > objective(best) ? p : best),
    vertices[0],
  );
  return {
    vertices,
    optimum,
    profit: objective(optimum),
    laborUsed: 2 * optimum.x + optimum.y,
    materialUsed: optimum.x + 2 * optimum.y,
  };
}
