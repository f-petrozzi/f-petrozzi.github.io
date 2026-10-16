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
  layoutTree,
} from "../src/data/demos/titanic-survival-predictor.ts";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
test("seeded 1,000 rows have valid categories and a disjoint shared split", () => {
  assert.deepEqual(passengers, makePassengers());
  assert.notDeepEqual(passengers, makePassengers(99));
  assert.equal(training.length, 800);
  assert.equal(heldOut.length, 200);
  assert.equal(new Set([...training, ...heldOut].map((r) => r.id)).size, 1000);
  assert.ok(training.every((r) => !heldOut.some((t) => t.id === r.id)));
  passengers.forEach((r) =>
    keys.forEach((k) => assert.ok(features[k].includes(r[k]))),
  );
});
test("Bayes likelihoods and posterior match counts and the product rule", () => {
  const result = naiveBayes(initial);
  const survivors = training.filter((r) => r.survived);
  close(result.prior[1], (survivors.length + 1) / (training.length + 2));
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
  assert.equal(tree.count, training.length);
});
test("reported accuracies use only held-out labels", () => {
  close(
    scores.bayes,
    heldOut.filter((r) => naiveBayes(r).probability >= 0.5 === r.survived)
      .length / heldOut.length,
  );
  close(
    scores.tree,
    accuracy((p) => decisionTree(p).probability),
  );
});

test("held-out accuracy is believable and the models are close", () => {
  for (const score of Object.values(scores))
    assert.ok(score >= 0.75 && score <= 0.82, `accuracy ${score}`);
  assert.ok(Math.abs(scores.bayes - scores.tree) <= 0.03);
});
test("invented cohort follows the main Titanic demographic patterns", () => {
  const rate = (rows) => rows.filter((r) => r.survived).length / rows.length;
  const group = (key, value) => passengers.filter((r) => r[key] === value);
  assert.ok(rate(group("sex", "Female")) - rate(group("sex", "Male")) > 0.35);
  assert.ok(rate(group("class", "1st")) > rate(group("class", "2nd")));
  assert.ok(rate(group("class", "2nd")) > rate(group("class", "3rd")));
  assert.ok(
    rate(group("age", features.age[0])) > rate(group("age", features.age[1])),
  );
  assert.ok(
    rate(group("age", features.age[1])) > rate(group("age", features.age[2])),
  );
  assert.ok(
    rate(group("family", "1-3 relatives")) >
      rate(group("family", "4+ relatives")),
  );
  assert.ok(rate(passengers) > 0.3 && rate(passengers) < 0.45);
  for (const cls of features.class) {
    const rows = group("class", cls);
    const mostCommon = features.fare.reduce((best, fare) =>
      rows.filter((r) => r.fare === fare).length >
      rows.filter((r) => r.fare === best).length
        ? fare
        : best,
    );
    assert.equal(mostCommon, features.fare[2 - features.class.indexOf(cls)]);
  }
});
test("tree layout encloses every node, including its rightmost branch", () => {
  const layout = layoutTree(tree);
  assert.equal(layout.edges.length, layout.nodes.length - 1);
  layout.nodes.forEach(({ x, y }) => {
    assert.ok(x - layout.nodeWidth / 2 >= 0);
    assert.ok(x + layout.nodeWidth / 2 <= layout.width);
    assert.ok(y - layout.nodeHeight / 2 >= 0);
    assert.ok(y + layout.nodeHeight / 2 <= layout.height);
  });
  for (const a of layout.nodes)
    for (const b of layout.nodes) {
      if (a !== b && a.y === b.y)
        assert.ok(Math.abs(a.x - b.x) >= layout.nodeWidth);
    }
});
