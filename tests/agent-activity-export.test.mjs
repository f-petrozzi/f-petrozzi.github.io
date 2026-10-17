import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const fixture = resolve("tests/fixtures/agent-activity");
const exporter = resolve("scripts/export-agent-activity.py");
const now = "2026-10-16T16:00:00Z";
const codexTotals = {
  "2024-01-01": 2,
  "2026-03-08": 2,
  "2026-10-12": 3,
  "2026-10-13": 1,
  "2026-10-14": 2,
  "2026-10-15": 2,
};
const claudeTotals = {
  "2024-01-01": 1,
  "2026-03-08": 1,
  "2026-10-12": 2,
  "2026-10-13": 3,
  "2026-10-14": 1,
  "2026-10-16": 1,
};

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
  const ledger = join(root, "private", "ledger.json");
  function copy(
    provider,
    target = env[provider === "codex" ? "CODEX_HOME" : "CLAUDE_CONFIG_DIR"],
  ) {
    cpSync(join(fixture, provider), target, { recursive: true });
  }
  function run(...args) {
    return spawnSync(
      "python3",
      [exporter, "--now", now, "--output", output, "--ledger", ledger, ...args],
      { env, encoding: "utf8" },
    );
  }
  function read(path = output) {
    return JSON.parse(readFileSync(path, "utf8"));
  }
  return { root, home, env, output, ledger, copy, run, read };
}

function success(result) {
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
}

function privateFree(text, root) {
  assert.doesNotMatch(
    text,
    /PRIVATE_FIXTURE|FIXTURE_|session|project|cwd|prompt|\/tmp\//i,
  );
  assert.ok(!text.includes(root));
}

test("exports transcript/history daily maxima, correct local dates and the unchanged public schema", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  box.copy("claude");
  const result = box.run();
  success(result);
  assert.equal(result.stdout, "");
  const data = box.read();
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
  assert.equal(counts["2026-03-08"], 3);
  assert.equal(counts["2026-10-12"], 5);
  assert.equal(counts["2026-10-13"], 4);
  assert.equal(counts["2026-10-14"], 3);
  assert.equal(counts["2026-10-15"], 2);
  assert.equal(counts["2026-10-16"], 1);
  assert.equal(
    data.days.reduce((sum, day) => sum + day.count, 0),
    18,
  );
  for (const day of data.days) {
    assert.deepEqual(Object.keys(day), ["date", "count"]);
    assert.ok(Number.isInteger(day.count) && day.count >= 0);
  }
  assert.deepEqual(box.read(box.ledger), {
    schemaVersion: 1,
    timezone: "America/New_York",
    providers: { codex: codexTotals, claude: claudeTotals },
  });
  for (const path of [box.output, box.ledger])
    privateFree(readFileSync(path, "utf8"), box.root);
  assert.deepEqual(readdirSync(dirname(box.output)), ["activity.json"]);
  assert.deepEqual(readdirSync(dirname(box.ledger)), ["ledger.json"]);
});

test("dry run reports each provider/source and merged ledger without writing", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  box.copy("claude");
  let result = box.run("--dry-run");
  success(result);
  assert.equal(
    result.stdout,
    [
      "codex transcripts: 8 turns across 5 active days; earliest 2024-01-01",
      "codex history: 8 turns across 4 active days; earliest 2024-01-01",
      "codex ledger: 12 turns across 6 active days; earliest 2024-01-01",
      "claude transcripts: 5 turns across 4 active days; earliest 2026-03-08",
      "claude history: 6 turns across 4 active days; earliest 2024-01-01",
      "claude ledger: 9 turns across 6 active days; earliest 2024-01-01",
      "",
    ].join("\n"),
  );
  privateFree(result.stdout + result.stderr, box.root);
  assert.ok(!existsSync(box.output));
  assert.ok(!existsSync(box.ledger));
  success(box.run());
  const before = [box.output, box.ledger].map((path) =>
    readFileSync(path, "utf8"),
  );
  result = box.run("--dry-run");
  success(result);
  assert.deepEqual(
    [box.output, box.ledger].map((path) => readFileSync(path, "utf8")),
    before,
  );
});

test("no-history reads transcripts only, excludes helpers and harness lines, and avoids mirrored Codex turns", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  box.copy("claude");
  // Keep histories with higher daily counts present: disabling backfill must
  // produce lower counts on a fresh ledger.
  success(box.run("--no-history"));
  assert.deepEqual(box.read(box.ledger).providers, {
    codex: {
      "2024-01-01": 1,
      "2026-03-08": 2,
      "2026-10-12": 2,
      "2026-10-13": 1,
      "2026-10-14": 2,
    },
    claude: {
      "2026-03-08": 1,
      "2026-10-12": 2,
      "2026-10-13": 1,
      "2026-10-14": 1,
    },
  });
  assert.equal(
    box.read().days.reduce((sum, day) => sum + day.count, 0),
    12,
  );
  const result = box.run("--no-history", "--dry-run");
  success(result);
  assert.match(
    result.stdout,
    /codex history: 0 turns across 0 active days; earliest none/,
  );
});

test("profiles and the default home both contribute; aliases, symlinks and hardlinks count once", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  const profiles = join(box.env.CODEX_ACCOUNTS_DIR, "profiles");
  mkdirSync(profiles, { recursive: true });
  symlinkSync(box.env.CODEX_HOME, join(profiles, "a"), "dir");
  symlinkSync(box.env.CODEX_HOME, join(profiles, "alias"), "dir");
  box.copy("accounts/profiles/second", join(profiles, "second"));
  const original = join(
    box.env.CODEX_HOME,
    "sessions/2026/10/12/rollout-main.jsonl",
  );
  linkSync(original, join(dirname(original), "rollout-hardlink.jsonl"));
  symlinkSync(original, join(dirname(original), "rollout-symlink.jsonl"));
  mkdirSync(join(profiles, "hardlinked"));
  linkSync(
    join(box.env.CODEX_HOME, "history.jsonl"),
    join(profiles, "hardlinked/history.jsonl"),
  );
  success(box.run());
  assert.deepEqual(box.read(box.ledger).providers.codex, {
    ...codexTotals,
    "2026-10-15": 3,
  });
});

test("XDG, home fallbacks and an empty profiles directory stay inside fixture homes", (t) => {
  for (const xdg of [true, false]) {
    const box = sandbox(t);
    delete box.env.CODEX_ACCOUNTS_DIR;
    delete box.env.CODEX_HOME;
    delete box.env.CLAUDE_CONFIG_DIR;
    if (!xdg) delete box.env.XDG_DATA_HOME;
    const base = xdg ? box.env.XDG_DATA_HOME : join(box.home, ".local/share");
    const profiles = join(base, "codex-accounts/profiles");
    mkdirSync(profiles, { recursive: true });
    box.copy("codex", join(box.home, ".codex"));
    box.copy("claude", join(box.home, ".claude"));
    success(box.run());
    assert.deepEqual(box.read(box.ledger).providers.codex, codexTotals);
    box.copy("accounts/profiles/second", join(profiles, "second"));
    success(box.run());
    assert.equal(box.read(box.ledger).providers.codex["2026-10-15"], 3);
  }
});

test("ledger preserves all days after transcript pruning, history disabling, and complete source removal", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  box.copy("claude");
  success(box.run());
  const before = box.read(box.ledger);
  rmSync(join(box.env.CLAUDE_CONFIG_DIR, "projects"), { recursive: true });
  success(box.run("--no-history"));
  assert.deepEqual(box.read(box.ledger), before);
  rmSync(box.env.CODEX_HOME, { recursive: true });
  rmSync(box.env.CLAUDE_CONFIG_DIR, { recursive: true });
  success(box.run());
  assert.deepEqual(box.read(box.ledger), before);
  success(box.run("--now", "2028-01-07T16:00:00Z"));
  assert.deepEqual(box.read(box.ledger), before);
  assert.equal(
    box.read().days.reduce((sum, day) => sum + day.count, 0),
    0,
  );
});

test("later source growth raises the ledger once and partial transcripts cannot lower it", (t) => {
  const box = sandbox(t);
  box.copy("claude");
  success(box.run());
  const transcript = join(
    box.env.CLAUDE_CONFIG_DIR,
    "projects/FIXTURE_PROJECT/chat.jsonl",
  );
  const extra =
    JSON.stringify({
      type: "user",
      timestamp: "2026-10-12T18:00:00Z",
      message: { content: "PRIVATE_FIXTURE_PROMPT extra" },
    }) + "\n";
  writeFileSync(transcript, readFileSync(transcript, "utf8") + extra);
  success(box.run());
  assert.equal(box.read(box.ledger).providers.claude["2026-10-12"], 3);
  writeFileSync(transcript, extra);
  success(box.run());
  assert.equal(box.read(box.ledger).providers.claude["2026-10-12"], 3);
});

test("history alone can backfill; no sources and no ledger fail without writes", (t) => {
  const box = sandbox(t);
  const result = box.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No activity sources found/);
  privateFree(result.stderr, box.root);
  assert.deepEqual(readdirSync(box.root), ["home"]);
  mkdirSync(box.env.CODEX_HOME);
  cpSync(
    join(fixture, "codex/history.jsonl"),
    join(box.env.CODEX_HOME, "history.jsonl"),
  );
  success(box.run());
  assert.equal(box.read(box.ledger).providers.codex["2026-10-12"], 3);
});

test("invalid accounts, times and filesystem errors never disclose paths or fixture text", (t) => {
  const box = sandbox(t);
  const badAccount = join(
    box.env.CODEX_ACCOUNTS_DIR,
    "profiles",
    "PRIVATE_FIXTURE invalid profile",
  );
  mkdirSync(badAccount, { recursive: true });
  const bad = box.run();
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Invalid Codex account directory name/);
  privateFree(bad.stderr, box.root);
  for (const timestamp of ["2026-10-16T12:00:00", "PRIVATE_FIXTURE_BAD_TIME"]) {
    const result = box.run("--now", timestamp);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /timezone offset/);
    privateFree(result.stderr, box.root);
  }
  rmSync(badAccount, { recursive: true });
  box.copy("codex");
  mkdirSync(box.output, { recursive: true });
  const result = box.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Check permissions and formats/);
  privateFree(result.stderr, box.root);
  assert.ok(
    existsSync(box.ledger),
    "durable counts survive an output write failure",
  );
  assert.deepEqual(readdirSync(dirname(box.output)), ["activity.json"]);
});

test("invalid ledgers are preserved and never exposed through error messages", (t) => {
  const box = sandbox(t);
  box.copy("codex");
  mkdirSync(dirname(box.ledger));
  const invalid = [
    "PRIVATE_FIXTURE_BROKEN_JSON",
    JSON.stringify({
      schemaVersion: 2,
      timezone: "America/New_York",
      providers: { codex: {}, claude: {} },
    }),
    JSON.stringify({
      schemaVersion: 1,
      timezone: "UTC",
      providers: { codex: {}, claude: {} },
    }),
    JSON.stringify({
      schemaVersion: 1,
      timezone: "America/New_York",
      providers: { codex: { "2026-02-30": 1 }, claude: {} },
    }),
    JSON.stringify({
      schemaVersion: 1,
      timezone: "America/New_York",
      providers: { codex: { "2026-10-12": -1 }, claude: {} },
    }),
    JSON.stringify({
      schemaVersion: 1,
      timezone: "America/New_York",
      providers: { codex: { "2026-10-12": true }, claude: {} },
    }),
    JSON.stringify({
      schemaVersion: 1,
      timezone: "America/New_York",
      providers: { codex: {}, claude: {} },
      text: "PRIVATE_FIXTURE_PROMPT",
    }),
  ];
  for (const raw of invalid) {
    writeFileSync(box.ledger, raw);
    const result = box.run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid activity ledger/);
    privateFree(result.stderr, box.root);
    assert.equal(readFileSync(box.ledger, "utf8"), raw);
    assert.ok(!existsSync(box.output));
  }
});
