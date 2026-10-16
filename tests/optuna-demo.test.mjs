import { test } from "node:test";
import assert from "node:assert/strict";
import {
  trials,
  makeStudy,
  history,
  bestTrial,
  importance,
} from "../src/data/demos/optuna.ts";
test("study is reproducible and contains completed and pruned trials", () => {
  assert.deepEqual(trials, makeStudy());
  assert.notDeepEqual(trials, makeStudy(7));
  assert.equal(trials.length, 30);
  assert.ok(trials.some((t) => t.state === "pruned"));
  trials.forEach((t) => {
    assert.ok(Number.isFinite(t.loss));
    assert.ok(t.learningRate > 0);
    assert.ok(t.dropout >= 0 && t.dropout <= 1);
  });
});
test("best-so-far is monotone and excludes pruning, even with a lower intermediate loss", () => {
  const sample = [
    { ...trials[0], number: 1, loss: 0.6, state: "complete" },
    { ...trials[1], number: 2, loss: 0.1, state: "pruned" },
    { ...trials[2], number: 3, loss: 0.4, state: "complete" },
  ];
  assert.deepEqual(
    history(sample).map((p) => p.best),
    [0.6, 0.6, 0.4],
  );
  assert.equal(bestTrial(sample).number, 3);
  const values = history(trials).map((p) => p.best);
  values.forEach((v, i) => {
    if (i) assert.ok(v <= values[i - 1]);
  });
  assert.equal(bestTrial([]), null);
  assert.deepEqual(
    history([sample[1]]).map((p) => p.best),
    [null],
  );
});
test("importance detects grouped variation and ignores pruned rows", () => {
  const sample = [16, 16, 64, 64].map((width, i) => ({
    ...trials[0],
    width,
    dropout: 0.2,
    learningRate: 0.001,
    optimizer: "Adam",
    loss: i < 2 ? 0.3 : 0.6,
    state: "complete",
  }));
  assert.deepEqual(
    importance(sample).map((p) => p.value),
    [1, 0, 0, 0],
  );
  assert.deepEqual(
    importance([...sample, { ...sample[0], loss: 100, state: "pruned" }]),
    importance(sample),
  );
  assert.ok(
    Math.abs(importance(trials).reduce((s, p) => s + p.value, 0) - 1) < 1e-10,
  );
  assert.ok(importance([]).every((p) => p.value === 0));
});
