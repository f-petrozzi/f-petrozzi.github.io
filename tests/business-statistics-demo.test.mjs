import { test } from "node:test";
import assert from "node:assert/strict";
import {
  regress,
  observations,
  makeObservations,
  solveProduction,
} from "../src/data/demos/business-statistics.ts";
const close = (a, b, tol = 1e-7) =>
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);
test("least squares recovers known coefficients and zero residuals", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    predictors: [i, i % 3],
    charges: 5 + 2 * i - 3 * (i % 3),
  }));
  const result = regress(rows, [0, 1]);
  result.coefficients.forEach((v, i) => close(v, [5, 2, -3][i]));
  close(result.r2, 1);
  close(result.sse, 0);
});
test("all predictor subsets satisfy OLS residual orthogonality and nested R squared", () => {
  const full = regress(observations, [0, 1, 2]);
  for (let mask = 0; mask < 8; mask++) {
    const selected = [0, 1, 2].filter((i) => mask & (1 << i));
    const result = regress(observations, selected);
    close(
      result.residuals.reduce((s, v) => s + v, 0),
      0,
    );
    selected.forEach((k) =>
      close(
        result.residuals.reduce(
          (s, v, i) => s + v * observations[i].predictors[k],
          0,
        ),
        0,
        1e-5,
      ),
    );
    assert.ok(full.r2 + 1e-10 >= result.r2);
    assert.ok(result.r2 >= -1e-10 && result.r2 <= 1);
  }
  close(regress(observations, []).r2, 0);
  assert.throws(() => regress(observations, [0, 0]));
  assert.throws(
    () =>
      regress(
        Array.from({ length: 5 }, () => ({ predictors: [1], charges: 2 })),
        [0],
      ),
    /Collinear/,
  );
});
test("production optimum matches analytic intersection and boundary cases", () => {
  const result = solveProduction(70, 80);
  close(result.optimum.x, 20);
  close(result.optimum.y, 30);
  close(result.profit, 1700);
  assert.deepEqual(solveProduction(0, 0).optimum, { x: 0, y: 0 });
  close(solveProduction(100, 20).profit, 800);
  close(solveProduction(20, 100).profit, 600);
  assert.throws(() => solveProduction(-1, 20));
  assert.throws(() => solveProduction(Infinity, 20));
});
test("feasible polygon and optimum obey all constraints across slider range", () => {
  for (let labor = 20; labor <= 100; labor += 10)
    for (let material = 20; material <= 100; material += 10) {
      const result = solveProduction(labor, material);
      result.vertices.forEach((p) => {
        assert.ok(p.x >= 0 && p.y >= 0);
        assert.ok(
          2 * p.x + p.y <= labor + 1e-9 && p.x + 2 * p.y <= material + 1e-9,
        );
        assert.ok(40 * p.x + 30 * p.y <= result.profit + 1e-9);
      });
      // Compare against every feasible integer production plan, independent of vertex enumeration.
      for (let x = 0; x <= 50; x++)
        for (let y = 0; y <= 50; y++)
          if (2 * x + y <= labor && x + 2 * y <= material)
            assert.ok(40 * x + 30 * y <= result.profit + 1e-9);
    }
});

test("noisy medical charges have a useful but imperfect fit driven by smoking", () => {
  assert.deepEqual(observations, makeObservations());
  assert.notDeepEqual(observations, makeObservations(41));
  const full = regress(observations, [0, 1, 2]);
  const withoutSmoking = regress(observations, [0, 1]);
  assert.equal(observations.length, 60);
  assert.ok(
    observations.every(
      (row) => Number.isFinite(row.charges) && row.charges > 0,
    ),
  );
  assert.ok(full.r2 >= 0.75 && full.r2 <= 0.85, `R² ${full.r2}`);
  assert.ok(full.r2 - withoutSmoking.r2 > 0.4);
  assert.ok(withoutSmoking.r2 < 0.4);
  assert.ok(Math.sqrt(full.sse / observations.length) > 2000);
  assert.ok(full.coefficients[3] > 8000);
});
