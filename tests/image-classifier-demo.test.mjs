import { test } from "node:test";
import assert from "node:assert/strict";
import {
  models,
  conditions,
  examples,
  probabilities,
  evaluation,
  metrics,
} from "../src/data/demos/image-classifier.ts";
test("six illustrations have independent multi-label probabilities for both networks", () => {
  assert.equal(examples.length, 6);
  assert.equal(models.length, 2);
  models.forEach((_, m) =>
    examples.forEach((_, i) => {
      const values = probabilities(m, i);
      assert.equal(values.length, conditions.length);
      assert.deepEqual(values, probabilities(m, i));
      assert.ok(values.every((p) => p > 0 && p < 1));
    }),
  );
  assert.ok(probabilities(1, 4).filter((p) => p > 0.5).length === 2);
  assert.ok(probabilities(1, 0).every((p) => p < 0.5));
  assert.notDeepEqual(probabilities(0, 3), probabilities(1, 3));
});
test("binary confusion counts yield exact accuracy and positive-class recall", () => {
  assert.deepEqual(metrics({ tp: 30, fn: 10, fp: 5, tn: 55 }), {
    accuracy: 0.85,
    recall: 0.75,
  });
  assert.deepEqual(metrics({ tp: 0, fn: 0, fp: 0, tn: 0 }), {
    accuracy: 0,
    recall: 0,
  });
  evaluation.forEach((counts) =>
    counts.forEach((c) => {
      assert.equal(c.tp + c.fn + c.fp + c.tn, 100);
      const result = metrics(c);
      assert.equal(result.accuracy, (c.tp + c.tn) / 100);
      assert.equal(result.recall, c.tp / (c.tp + c.fn));
    }),
  );
  conditions.forEach((_, i) =>
    assert.equal(
      evaluation[0][i].tp + evaluation[0][i].fn,
      evaluation[1][i].tp + evaluation[1][i].fn,
    ),
  );
});
