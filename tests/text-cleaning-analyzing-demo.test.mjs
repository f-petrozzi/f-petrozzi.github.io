import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXCERPT,
  STEPS,
  runPipeline,
  tokenize,
  countWords,
  cosineSimilarity,
  similarityMatrix,
  movingAverage,
  romanToNumber,
} from "../src/data/demos/text-cleaning-analyzing.ts";

const step = (p, id) => p.steps.find((s) => s.id === id);

test("excerpt stays small and carries a Gutenberg header and footer", () => {
  assert.ok(Buffer.byteLength(EXCERPT) < 12 * 1024);
  assert.match(EXCERPT, /\*\*\* START OF THE PROJECT GUTENBERG EBOOK/);
  assert.match(EXCERPT, /\*\*\* END OF THE PROJECT GUTENBERG EBOOK/);
  assert.equal(STEPS.length, 6);
});

test("strip removes the header and footer and reports both matches", () => {
  const p = runPipeline(EXCERPT);
  const strip = step(p, "strip");
  assert.equal(strip.matches, 2);
  assert.match(strip.after, /^Chapter I\./);
  assert.doesNotMatch(strip.after, /GUTENBERG/);
  assert.match(strip.after, /made for her\.$/);
  for (const span of strip.beforeSpans)
    assert.ok(span.end <= strip.before.length && span.start < span.end);
});

test("normalize straightens quotes, dashes and strips underscores", () => {
  const p = runPipeline(EXCERPT);
  const norm = step(p, "normalize");
  assert.doesNotMatch(norm.after, /[‘’“”—]/);
  assert.match(norm.after, /farmer's wife/);
  assert.match(norm.after, /cellar - except/);
  assert.equal(norm.beforeSpans.length, norm.matches);
  // spans on both sides point at the same replacement count
  assert.equal(norm.afterSpans.length, norm.matches);
});

test("chapters are found, numbered and split into bodies", () => {
  const p = runPipeline(EXCERPT);
  const chapters = step(p, "chapters");
  assert.equal(chapters.matches, 3);
  assert.deepEqual(p.labels, ["Ch. I", "Ch. II", "Ch. III"]);
  assert.match(chapters.after, /^§ 1 \/ The Cyclone\n/);
  assert.match(chapters.after, /§ 3 \/ How Dorothy Saved the Scarecrow/);
  assert.equal(p.totals.chapters, 3);
  assert.equal(romanToNumber("XIV"), 14);
});

test("sentence splitting yields one unit per line and keeps quotes", () => {
  const p = runPipeline(EXCERPT);
  const s = step(p, "sentences");
  const lines = s.after.split("\n").filter((l) => l && !l.startsWith("§ "));
  assert.equal(lines.length, p.totals.units);
  assert.ok(lines.length > 40);
  assert.ok(lines.some((l) => l.startsWith('"They surely will never do')));
  assert.ok(lines.some((l) => l.startsWith('"I wonder if')));
  assert.ok(lines.every((l) => !/[.!?] [A-Z]/.test(l.replace(/U\.S\./, ""))));
  assert.equal(p.lengths.length, p.totals.units);
  assert.equal(p.lengthUnit, "sentence");
});

test("tokenizing lowercases words and stopwords drop common ones", () => {
  assert.deepEqual(tokenize("Dorothy’s dog, Toto!"), [
    "dorothy’s",
    "dog",
    "toto",
  ]);
  const p = runPipeline(EXCERPT);
  const stop = step(p, "stopwords");
  assert.ok(stop.matches > 300);
  assert.ok(!p.tokens.flat().includes("the"));
  assert.ok(!p.tokens.flat().includes("and"));
  assert.equal(p.top[0].word, "dorothy");
  assert.equal(p.totals.tokens, step(p, "tokens").matches - stop.matches);
  for (const span of stop.beforeSpans) {
    const word = stop.before.slice(span.start, span.end);
    assert.ok(/^[a-z']+$/.test(word));
  }
});

test("turning steps off changes the outputs", () => {
  const all = runPipeline(EXCERPT);
  const noStop = runPipeline(EXCERPT, { stopwords: false });
  assert.equal(noStop.top[0].word, "the");
  assert.ok(noStop.totals.tokens > all.totals.tokens);
  const noChapters = runPipeline(EXCERPT, { chapters: false });
  assert.equal(noChapters.totals.chapters, 0);
  assert.equal(noChapters.similarity.length, 1);
  assert.equal(step(noChapters, "chapters").matches, 0);
  const noStrip = runPipeline(EXCERPT, { strip: false });
  assert.ok(noStrip.tokens.flat().includes("gutenberg"));
  assert.ok(!all.tokens.flat().includes("gutenberg"));
  assert.ok(noStrip.totals.tokens > all.totals.tokens);
  const noSplit = runPipeline(EXCERPT, { sentences: false });
  assert.equal(noSplit.lengthUnit, "paragraph");
  assert.ok(noSplit.totals.meanLength > all.totals.meanLength);
  const noTokens = runPipeline(EXCERPT, { tokens: false, stopwords: false });
  assert.ok(noTokens.tokens.flat().some((t) => /[.,]$/.test(t)));
  assert.ok(!step(noTokens, "tokens").enabled);
});

test("the pipeline is deterministic and never mutates the input", () => {
  const copy = `${EXCERPT}`;
  assert.deepEqual(runPipeline(EXCERPT), runPipeline(copy));
});

test("top words are sorted by count then alphabetically", () => {
  const top = countWords(
    [
      ["b", "a", "b"],
      ["a", "c", "b"],
    ],
    3,
  );
  assert.deepEqual(top, [
    { word: "b", count: 3 },
    { word: "a", count: 2 },
    { word: "c", count: 1 },
  ]);
  const p = runPipeline(EXCERPT);
  assert.equal(p.top.length, 12);
  for (let i = 1; i < p.top.length; i++)
    assert.ok(p.top[i - 1].count >= p.top[i].count);
});

test("cosine similarity of bags of words", () => {
  assert.equal(cosineSimilarity(["a", "b"], ["b", "a"]), 1);
  assert.equal(cosineSimilarity(["a"], ["b"]), 0);
  assert.equal(cosineSimilarity([], ["b"]), 0);
  assert.ok(
    Math.abs(cosineSimilarity(["a", "a", "b"], ["a", "b", "b"]) - 0.8) < 1e-9,
  );
  const m = similarityMatrix([["a", "b"], ["b", "c"], ["z"]]);
  assert.equal(m[0][0], 1);
  assert.equal(m[0][1], m[1][0]);
  assert.equal(m[2][0], 0);
});

test("chapter similarity matrix is symmetric with a unit diagonal", () => {
  const { similarity } = runPipeline(EXCERPT);
  assert.equal(similarity.length, 3);
  similarity.forEach((row, i) =>
    row.forEach((v, j) => {
      assert.ok(v >= 0 && v <= 1);
      assert.equal(v, similarity[j][i]);
      if (i === j) assert.equal(v, 1);
      else assert.ok(v < 1 && v > 0);
    }),
  );
});

test("moving average smooths and keeps length", () => {
  const out = movingAverage([0, 10, 0, 10, 0], 3);
  assert.equal(out.length, 5);
  assert.equal(out[0], 5);
  assert.ok(Math.abs(out[2] - 20 / 3) < 1e-9);
});
