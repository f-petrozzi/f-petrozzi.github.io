import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  accounts,
  addTask,
  changeTask,
  createState,
  groundedNote,
  guidePreview,
  money,
  navigation,
  products,
  sources,
  spending,
  spendingGroups,
  togglePurchased,
  toggleSource,
  transactions,
} from "../src/data/demos/orbit.ts";

test("task capture, planning, completion, and reopening stay independent", () => {
  const initial = createState();
  const captured = addTask(initial, "  Review the new layout  ", "today");
  const task = captured.tasks.at(-1);
  assert.equal(task.title, "Review the new layout");
  assert.equal(task.day, "today");
  assert.equal(captured.nextId, task.id + 1);
  const completed = changeTask(captured, task.id, { done: true });
  const moved = changeTask(completed, task.id, { day: "tomorrow" });
  assert.deepEqual(moved.tasks.at(-1), {
    ...task,
    done: true,
    day: "tomorrow",
  });
  const reopened = changeTask(moved, task.id, { done: false });
  assert.equal(reopened.tasks.at(-1).day, "tomorrow");
  assert.equal(reopened.tasks.at(-1).done, false);
  assert.equal(captured.tasks.at(-1).done, false);
  assert.equal(initial.tasks.length, 5);
});

test("invalid input cannot create tasks, move them outside the plan, or reuse IDs", () => {
  const initial = createState();
  assert.equal(addTask(initial, "  ", "today"), initial);
  assert.equal(addTask(initial, "Task", "invalid"), initial);
  assert.equal(changeTask(initial, 1, { day: "invalid" }), initial);
  assert.equal(changeTask(initial, 999, { done: true }), initial);
  let state = addTask(initial, "x".repeat(150), "unscheduled");
  assert.equal(state.tasks.at(-1).title.length, 120);
  for (let n = 0; n < 50; n++) state = addTask(state, `Task ${n}`, "today");
  assert.equal(state.tasks.length, 30);
  assert.equal(new Set(state.tasks.map((task) => task.id)).size, 30);
  assert.equal(addTask(state, "Over limit", "today"), state);
});

test("notebook answers cite only selected sources and retain source order", () => {
  const initial = createState();
  const selection = toggleSource(initial, "brief");
  const notes = groundedNote(selection.selected);
  assert.deepEqual(
    notes.map((note) => note.source),
    ["research", "access"],
  );
  assert.equal(
    notes.some((note) => note.text.includes("Saturday")),
    false,
  );
  assert.deepEqual(
    groundedNote(["access", "brief"]).map((note) => note.source),
    ["brief", "access"],
  );
  for (const note of notes) {
    const source = sources.find((source) => source.id === note.source);
    assert.equal(note.title, source.title);
    assert.equal(note.text, source.fact);
  }
  assert.deepEqual(groundedNote([]), []);
  assert.deepEqual(groundedNote(["unknown"]), []);
  assert.equal(toggleSource(initial, "unknown"), initial);
  assert.deepEqual(
    toggleSource(selection, "brief").selected.sort(),
    [...initial.selected].sort(),
  );
  assert.equal(initial.selected.length, 3);
});

test("saved grounded notes are snapshots independent of later source selection", () => {
  const initial = createState();
  const saved = groundedNote(initial.selected);
  const changed = toggleSource(initial, "access");
  assert.equal(groundedNote(changed.selected).length, 2);
  assert.equal(saved.length, 3);
  saved[0].text = "Edited note";
  assert.equal(groundedNote(initial.selected)[0].text, sources[0].fact);
});

test("spending families reconcile to posted transactions in integer cents", () => {
  assert.equal(spending(), 110530);
  assert.equal(spending("Food"), 11080);
  assert.equal(spending("Unknown"), 0);
  const groups = spendingGroups();
  assert.equal(groups[0].name, "Home");
  assert.equal(
    groups.reduce((sum, row) => sum + row.cents, 0),
    spending(),
  );
  assert.equal(
    spending(),
    transactions.reduce((sum, row) => sum + row.cents, 0),
  );
  assert.equal(money(spending()), "$1,105.30");
});

test("wishlist changes never alter account balances, spending, or goals", () => {
  const initial = createState();
  const before = structuredClone({ accounts, transactions, products });
  const purchased = togglePurchased(initial, "lamp");
  assert.deepEqual(purchased.purchased, ["lamp"]);
  assert.deepEqual(initial.purchased, []);
  assert.deepEqual(togglePurchased(purchased, "lamp"), initial);
  assert.equal(togglePurchased(initial, "unknown"), initial);
  assert.deepEqual({ accounts, transactions, products }, before);
  assert.equal(spending(), 110530);
});

test("project feedback changes preview spacing without changing unrelated state", () => {
  const initial = createState();
  const compact = guidePreview(initial, "Make the cards more compact");
  assert.equal(compact.state.density, "compact");
  assert.equal(initial.density, "comfortable");
  const comfortable = guidePreview(compact.state, "Use comfortable spacing");
  assert.equal(comfortable.state.density, "comfortable");
  assert.deepEqual(comfortable.state, initial);
  assert.equal(guidePreview(initial, "Delete all the books").state, initial);
  assert.equal(guidePreview(initial, "uncompacted").state, initial);
  assert.match(
    guidePreview(initial, "unknown").reply,
    /compact or comfortable/,
  );
});

test("reset produces independent task, source, wishlist, and preview state", () => {
  const changed = createState();
  changed.tasks[0].done = true;
  changed.tasks.push({
    id: 99,
    title: "Extra",
    done: false,
    day: "today",
    list: "Home",
  });
  changed.selected.pop();
  changed.purchased.push("lamp");
  changed.density = "compact";
  const reset = createState();
  assert.equal(reset.tasks.length, 5);
  assert.equal(reset.tasks[0].done, false);
  assert.equal(reset.selected.length, 3);
  assert.deepEqual(reset.purchased, []);
  assert.equal(reset.density, "comfortable");
  assert.deepEqual(
    navigation.map((item) => item.label),
    ["Chat", "Tasks", "Library", "Finances"],
  );
});

test("demo stays local and styles render inside its own fixed-palette root", async () => {
  const component = await readFile(
    new URL("../src/components/demos/OrbitDemo.astro", import.meta.url),
    "utf8",
  );
  const script = await readFile(
    new URL("../src/scripts/demos/orbit.ts", import.meta.url),
    "utf8",
  );
  const data = await readFile(
    new URL("../src/data/demos/orbit.ts", import.meta.url),
    "utf8",
  );
  assert.match(component, /<style is:inline>\s*\.demo-orbit\s*\{/);
  assert.equal((component.match(/<style/g) || []).length, 1);
  assert.doesNotMatch(
    component,
    /:global\(|var\(--(?:bg|ink|muted|accent|line)\b|backdrop-filter|transition:\s*all/,
  );
  assert.match(component, /prefers-reduced-motion/);
  assert.match(component, /scrollbar-width:\s*thin/);
  assert.doesNotMatch(
    component + script + data,
    /\bfetch\s*\(|\bWebSocket\b|\blocalStorage\b|\bsessionStorage\b|document\.cookie|https?:\/\//,
  );
  assert.match(
    script,
    /document\.querySelectorAll<HTMLElement>\('\[data-demo="orbit"\]'\)\.forEach\(init\)/,
  );
});
