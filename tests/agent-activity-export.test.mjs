import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const fixture = resolve("tests/fixtures/agent-activity");
const exporter = resolve("scripts/export-agent-activity.py");
const now = "2026-10-16T16:00:00Z";

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), "agent-activity-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home");
  mkdirSync(home);
  const env = {
    ...process.env,
    HOME: home,
    XDG_DATA_HOME: join(root, "xdg"),
    CODEX_ACCOUNTS_DIR: join(root, "accounts"),
    CODEX_HOME: join(root, "codex"),
    CLAUDE_CONFIG_DIR: join(root, "claude"),
  };
  const output = join(root, "output", "activity.json");
  function copy(
    provider,
    target = env[provider === "codex" ? "CODEX_HOME" : "CLAUDE_CONFIG_DIR"],
  ) {
    mkdirSync(target, { recursive: true });
    copyFileSync(
      join(fixture, provider, "history.jsonl"),
      join(target, "history.jsonl"),
    );
  }
  function run(...args) {
    return spawnSync(
      "python3",
      [exporter, "--now", now, "--output", output, ...args],
      { env, encoding: "utf8" },
    );
  }
  return { root, home, env, output, copy, run };
}

test("exports timestamp-only local counts with exact schema and no fixture prompt text", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  box.copy("claude");
  const result = box.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
  const raw = readFileSync(box.output, "utf8");
  const data = JSON.parse(raw);
  assert.deepEqual(Object.keys(data), [
    "schemaVersion",
    "generatedAt",
    "timezone",
    "days",
  ]);
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.generatedAt, now);
  assert.equal(data.timezone, "America/New_York");
  assert.equal(data.days.length, 370);
  assert.equal(data.days[0].date, "2025-10-12");
  assert.equal(data.days.at(-1).date, "2026-10-16");
  const counts = Object.fromEntries(
    data.days.map(({ date, count }) => [date, count]),
  );
  assert.equal(counts["2025-10-12"], 1);
  assert.equal(counts["2026-03-08"], 2);
  assert.equal(counts["2026-10-12"], 4);
  assert.equal(counts["2026-10-13"], 1);
  assert.equal(counts["2026-10-16"], 1);
  assert.equal(
    data.days.reduce((sum, day) => sum + day.count, 0),
    9,
  );
  for (const day of data.days) {
    assert.deepEqual(Object.keys(day), ["date", "count"]);
    assert.ok(Number.isInteger(day.count) && day.count >= 0);
  }
  assert.doesNotMatch(
    raw,
    /PRIVATE_FIXTURE_PROMPT|FIXTURE_|text|display|session|project|cwd|ts"/i,
  );
  // The sensitive-looking text is present in the fixture, never in public output.
  assert.match(
    readFileSync(join(fixture, "codex/history.jsonl"), "utf8"),
    /PRIVATE_FIXTURE_PROMPT/,
  );
  assert.deepEqual(readdirSync(join(box.root, "output")), ["activity.json"]);
});

test("dry run prints totals only and preserves an existing output", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  box.copy("claude");
  mkdirSync(join(box.root, "output"));
  writeFileSync(box.output, "keep existing output\n");
  const result = box.run("--dry-run");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "9 prompts across 5 active days\n");
  assert.equal(readFileSync(box.output, "utf8"), "keep existing output\n");
});

test("missing histories fail clearly without creating output", (t) => {
  const box = sandbox(t);
  const result = box.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No history.jsonl files found/);
  assert.doesNotMatch(result.stderr, new RegExp(box.root));
  assert.deepEqual(readdirSync(box.root), ["home"]);
});

test("account profiles take precedence over CODEX_HOME and all profiles contribute", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  box.copy("claude");
  box.copy("codex", join(box.env.CODEX_ACCOUNTS_DIR, "profiles", "first"));
  const second = join(box.env.CODEX_ACCOUNTS_DIR, "profiles", "second");
  mkdirSync(second);
  copyFileSync(
    join(fixture, "accounts/profiles/second/history.jsonl"),
    join(second, "history.jsonl"),
  );
  const result = box.run("--dry-run");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "10 prompts across 6 active days\n");
});

test("XDG and default-home discovery use only isolated fixture directories", (t) => {
  for (const xdg of [true, false]) {
    const box = sandbox(t);
    delete box.env.CODEX_ACCOUNTS_DIR;
    delete box.env.CODEX_HOME;
    delete box.env.CLAUDE_CONFIG_DIR;
    if (!xdg) delete box.env.XDG_DATA_HOME;
    const base = xdg ? box.env.XDG_DATA_HOME : join(box.home, ".local/share");
    box.copy("codex", join(base, "codex-accounts/profiles/first"));
    box.copy("claude", join(box.home, ".claude"));
    const result = box.run("--dry-run");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "9 prompts across 5 active days\n");
  }
});

test("single account default home and an empty profiles directory match the collector", (t) => {
  const box = sandbox(t);
  delete box.env.CODEX_HOME;
  box.copy("codex", join(box.home, ".codex"));
  mkdirSync(join(box.env.CODEX_ACCOUNTS_DIR, "profiles"), { recursive: true });
  const result = box.run("--dry-run");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "6 prompts across 4 active days\n");
});

test("aliased profile histories count once", (t) => {
  const box = sandbox(t);
  const profiles = join(box.env.CODEX_ACCOUNTS_DIR, "profiles");
  box.copy("codex", join(profiles, "first"));
  symlinkSync(join(profiles, "first"), join(profiles, "alias"), "dir");
  const result = box.run("--dry-run");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "6 prompts across 4 active days\n");
});

test("invalid account directory names and ambiguous test times fail safely", (t) => {
  const box = sandbox(t);
  mkdirSync(join(box.env.CODEX_ACCOUNTS_DIR, "profiles", "invalid profile"), {
    recursive: true,
  });
  const result = box.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid Codex account directory name/);
  assert.doesNotMatch(result.stderr, /invalid profile/);
  const ambiguous = box.run("--now", "2026-10-16T12:00:00");
  assert.notEqual(ambiguous.status, 0);
  assert.match(ambiguous.stderr, /timezone offset/);
});
