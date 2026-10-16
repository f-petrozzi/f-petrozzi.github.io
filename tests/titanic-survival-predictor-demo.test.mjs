import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makePassengers,
  passengers,
  training,
  heldOut,
  features,
  keys,
  initial,
  naiveBayes,
  trainTree,
  decisionTree,
  accuracy,
  scores,
  tree,
} from "../src/data/demos/titanic-survival-predictor.ts";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
test("seeded 120 rows have valid categories and a disjoint shared split", () => {
  assert.deepEqual(passengers, makePassengers());
  assert.notDeepEqual(passengers, makePassengers(99));
  assert.equal(training.length, 96);
  assert.equal(heldOut.length, 24);
  assert.equal(new Set([...training, ...heldOut].map((r) => r.id)).size, 120);
  assert.ok(training.every((r) => !heldOut.some((t) => t.id === r.id)));
  passengers.forEach((r) =>
    keys.forEach((k) => assert.ok(features[k].includes(r[k]))),
  );
});
test("Bayes likelihoods and posterior match counts and the product rule", () => {
  const result = naiveBayes(initial);
  const survivors = training.filter((r) => r.survived);
  close(result.prior[1], (survivors.length + 1) / 98);
  result.contributions.forEach((c) =>
    close(
      c.likelihood[1],
      (survivors.filter((r) => r[c.key] === initial[c.key]).length + 1) /
        (survivors.length + features[c.key].length),
    ),
  );
  const products = result.prior.map(
    (p, i) => p * result.contributions.reduce((v, c) => v * c.likelihood[i], 1),
  );
  close(result.probability, products[1] / (products[0] + products[1]));
  passengers.forEach((p) =>
    assert.ok(naiveBayes(p).probability > 0 && naiveBayes(p).probability < 1),
  );
});
test("tree learns a separable split and each path ends at the matching training leaf", () => {
  const rows = Array.from({ length: 24 }, (_, id) => ({
    ...initial,
    id,
    sex: id < 12 ? "Female" : "Male",
    survived: id < 12,
  }));
  const model = trainTree(rows);
  assert.equal(model.key, "sex");
  assert.equal(
    decisionTree({ ...initial, sex: "Female" }, model).probability,
    1,
  );
  assert.equal(decisionTree({ ...initial, sex: "Male" }, model).probability, 0);
  passengers.forEach((input) => {
    const prediction = decisionTree(input);
    let matches = training;
    prediction.path.forEach((node) => {
      if (node.key)
        matches = matches.filter(
          (r) =>
            (r[node.key] === node.value) === (input[node.key] === node.value),
        );
    });
    close(
      prediction.probability,
      matches.filter((r) => r.survived).length / matches.length,
    );
    assert.ok(prediction.path.length <= 4);
  });
  assert.equal(tree.count, 96);
});
test("reported accuracies use only held-out labels", () => {
  close(
    scores.bayes,
    heldOut.filter((r) => naiveBayes(r).probability >= 0.5 === r.survived)
      .length / 24,
  );
  close(
    scores.tree,
    accuracy((p) => decisionTree(p).probability),
  );
});
