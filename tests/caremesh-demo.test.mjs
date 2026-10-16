import { test } from "node:test";
import assert from "node:assert/strict";
import {
  garminDays,
  ingestDay,
  parseRecipe,
  recipeSamples,
  sourceSegments,
} from "../src/data/demos/caremesh.ts";

test("all recipe sources extract quantities, servings and ordered steps", () => {
  for (const sample of recipeSamples) {
    const recipe = parseRecipe(sample.text);
    assert.deepEqual(recipe.warnings, []);
    assert.equal(recipe.steps.length, 3);
    assert.ok(recipe.ingredients.length >= 4);
    assert.equal(
      sourceSegments(sample.text, recipe.spans)
        .map((s) => s.text)
        .join(""),
      sample.text,
    );
    for (const field of ["title", "servings", "ingredient", "step"])
      assert.ok(recipe.spans.some((s) => s.field === field));
  }
  const soup = parseRecipe(recipeSamples[2].text);
  assert.equal(soup.servings, 4);
  assert.deepEqual(soup.ingredients[1], {
    quantity: 1.5,
    unit: "cups",
    name: "vegetable broth",
  });
  assert.deepEqual(soup.ingredients.at(-1), {
    quantity: null,
    unit: null,
    name: "Salt to taste",
  });
});
test("pasted text is parsed rather than replaced by a canned recipe", () => {
  const source =
    "# Toast\r\nServes 3\r\n2 slices bread\r\n½ tsp cinnamon\r\nInstructions:\r\nToast the bread.\r\nSprinkle cinnamon.";
  const result = parseRecipe(source);
  assert.equal(result.title, "Toast");
  assert.equal(result.servings, 3);
  assert.equal(result.ingredients[0].name, "slices bread");
  assert.equal(result.ingredients[1].quantity, 0.5);
  assert.deepEqual(result.steps, ["Toast the bread.", "Sprinkle cinnamon."]);
  assert.equal(
    sourceSegments(source, result.spans)
      .map((s) => s.text)
      .join(""),
    source,
  );
  assert.equal(parseRecipe("").warnings.length, 4);
  assert.equal(parseRecipe("Toast\nIngredients\n1 tbsp oil").steps.length, 0);
});
test("Garmin units map to the shared model and trace records the selected specialist", () => {
  const run = ingestDay(garminDays[0]);
  assert.equal(run.model.sleep_hours, 5.2);
  assert.equal(run.model.steps, 3200);
  assert.equal(run.model.stress_score, 52);
  assert.match(run.specialist, /Activity/);
  assert.equal(run.trace.length, 6);
  assert.ok(run.trace[2].result.includes(run.specialist));
  assert.deepEqual(run, ingestDay(garminDays[0]));
  assert.match(ingestDay(garminDays[2]).specialist, /Stress/);
  const sleep = ingestDay({
    label: "Sleep",
    sleepSeconds: 3600,
    totalSteps: 10000,
    averageStress: 10,
  });
  assert.match(sleep.specialist, /Sleep/);
});
test("routing priorities respond continuously and model fields stay in range", () => {
  const a = ingestDay(garminDays[0]);
  const b = ingestDay({ ...garminDays[0], averageStress: 53 });
  assert.ok(
    b.priorities.find((p) => p.specialist === "Stress specialist").score >
      a.priorities.find((p) => p.specialist === "Stress specialist").score,
  );
  const invalid = ingestDay({
    label: "Invalid",
    sleepSeconds: -1,
    totalSteps: Infinity,
    averageStress: 150,
  });
  assert.equal(invalid.model.sleep_hours, 0);
  assert.equal(invalid.model.steps, 0);
  assert.equal(invalid.model.stress_score, 100);
});
