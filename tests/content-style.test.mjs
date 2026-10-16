// Checks for missing and duplicate project copy, not writing voice or punctuation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = new URL("../src/content/projects/", import.meta.url).pathname;
const files = readdirSync(dir).filter((f) => f.endsWith(".md"));

const parse = (name) => {
  const raw = readFileSync(join(dir, name), "utf8");
  const end = raw.indexOf("\n---", 4);
  return { front: raw.slice(0, end), body: raw.slice(end + 4) };
};

test("every project has a real body", () => {
  assert.ok(files.length > 0);
  for (const name of files) {
    const { body } = parse(name);
    assert.ok(
      !body.includes("part of my earlier work"),
      `${name} still has the placeholder body`,
    );
    assert.ok(body.trim().length > 0, `${name} body is empty`);
  }
});

test("project descriptions and bodies are not duplicated", () => {
  const summaries = new Map();
  const bodies = new Map();
  const normalize = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();
  for (const name of files) {
    const { front, body } = parse(name);
    const summary = front.match(/^summary:\s*(.+)$/m)?.[1];
    assert.ok(summary, `${name} has no summary`);
    for (const [seen, value, label] of [
      [summaries, summary, "summary"],
      [bodies, body, "body"],
    ]) {
      const key = normalize(value);
      assert.ok(!seen.has(key), `${name} shares its ${label} with ${seen.get(key)}`);
      seen.set(key, name);
    }
  }
});
