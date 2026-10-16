import { test } from "node:test";
import assert from "node:assert/strict";
import { runSampleAgent } from "../src/data/nume-agent.ts";
test("sample replies are deterministic and use the current inputs", () => {
  const question = "What should I eat?",
    profile = { sleep: 5.2, stress: 72 };
  const first = runSampleAgent(question, profile);
  assert.deepEqual(first, runSampleAgent(question, profile));
  assert.equal(first.intent, "meal");
  assert.match(first.answer, /Spinach & Walnut/);
  assert.match(first.trace[1].input, /5\.2h.*72/);
  assert.equal(first.trace.at(-1).output, first.answer);
  const rested = runSampleAgent(question, { sleep: 7.8, stress: 28 });
  assert.match(rested.answer, /Oat Bowl/);
  assert.notEqual(first.answer, rested.answer);
});
test("unsupported questions take the fallback path", () => {
  const result = runSampleAgent("Tell me the capital of France", {
    sleep: 7,
    stress: 20,
  });
  assert.equal(result.intent, "unknown");
  assert.match(result.answer, /sample meal, activity or plan/);
  assert.match(result.trace[3].output, /fallback/);
});
test("reasoning and trace share the same low-effort rule", () => {
  const low = runSampleAgent("Why this plan?", { sleep: 8, stress: 72 });
  assert.equal(low.intent, "reasoning");
  assert.equal(low.low, true);
  assert.match(low.answer, /stress is above 60/);
  assert.match(low.trace[2].input, /low_effort/);
  const regular = runSampleAgent("Why this plan?", { sleep: 8, stress: 20 });
  assert.equal(regular.low, false);
  assert.match(regular.trace[2].input, /regular/);
});
