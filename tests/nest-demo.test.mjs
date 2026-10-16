import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addTask,
  calendarDays,
  confirmStock,
  createState,
  markMealMade,
  money,
  navigation,
  proposeStock,
  readReceipt,
  receiptTotal,
  savePurchase,
  sectionTabs,
  toggleTask,
} from "../src/data/demos/nest.ts";

test("main navigation follows the source app's active tabs and order", () => {
  assert.deepEqual(
    navigation.map(({ id, label }) => [id, label]),
    [
      ["dashboard", "Home"],
      ["calendar", "Calendar"],
      ["tasks", "Tasks"],
      ["cats", "Cats"],
      ["kitchen", "Kitchen"],
      ["finance", "Finance"],
      ["health", "Health"],
    ],
  );
});

test("sections retain Nest's real sub-tab structure", () => {
  assert.deepEqual(sectionTabs, {
    kitchen: ["Plan", "Nesty", "Recipes", "Shop", "Pantry"],
    cats: ["Today", "Health", "Pantry", "Gallery"],
    finance: ["Overview", "Expenses", "Subscriptions", "History"],
    health: ["Overview", "Activity", "Sleep", "Nutrition", "Trends"],
  });
});

test("a dated task appears on its calendar day and completion stays in sync", () => {
  const initial = createState();
  const added = addTask(
    initial,
    "  Pick up the parcel  ",
    "2026-10-16",
    "Both",
  );
  const task = added.tasks.at(-1);
  assert.equal(task.title, "Pick up the parcel");
  assert.equal(task.person, "Both");
  assert.notEqual(task.id, initial.tasks[0].id);
  assert.deepEqual(calendarDays(added).find((day) => day.number === 16).tasks, [
    task,
  ]);
  const completed = toggleTask(added, task.id);
  assert.equal(completed.tasks.at(-1).done, true);
  assert.equal(
    calendarDays(completed).find((day) => day.number === 16).tasks[0].done,
    true,
  );
  assert.equal(toggleTask(completed, task.id).tasks.at(-1).done, false);
  assert.equal(initial.tasks.length, 1);
  assert.equal(added.tasks.at(-1).done, false);
});

test("invalid tasks leave the household unchanged", () => {
  const initial = createState();
  assert.equal(addTask(initial, "  ", "2026-10-16", "Sam"), initial);
  assert.equal(addTask(initial, "Task", "2026-10-30", "Sam"), initial);
  assert.equal(addTask(initial, "Task", "2026-10-16", "Unknown"), initial);
  assert.equal(
    addTask(initial, "x".repeat(100), "2026-10-16", "Sam").tasks.at(-1).title
      .length,
    80,
  );
});

test("receipt reading is deterministic, isolated and leaves pantry untouched before saving", () => {
  const initial = createState();
  const before = structuredClone(initial);
  const items = readReceipt();
  assert.deepEqual(items, readReceipt());
  assert.equal(receiptTotal(items), 720);
  assert.equal(money(receiptTotal(items)), "$7.20");
  items[0].name = "White beans";
  items[1].include = false;
  assert.equal(readReceipt()[0].name, "Chickpeas");
  assert.equal(readReceipt()[1].include, true);
  assert.deepEqual(initial, before);
});

test("saving uses only reviewed items and restocks matching or renamed pantry entries", () => {
  const initial = createState();
  const items = readReceipt();
  items[0].name = " White beans ";
  items[0].amount = " 3 cans ";
  items[1].include = false;
  const saved = savePurchase(initial, items);
  assert.equal(saved.purchase.total, 400);
  assert.deepEqual(
    saved.purchase.items.map((item) => item.name),
    ["White beans", "Lemons"],
  );
  assert.equal(saved.purchase.items[0].amount, "3 cans");
  assert.equal(
    saved.pantry.find((item) => item.name === "Spinach").stock,
    "low",
  );
  assert.equal(saved.pantry.find((item) => item.name === "Lemons").stock, "in");
  assert.equal(
    saved.pantry.find((item) => item.name === "White beans").stock,
    "in",
  );
  assert.equal(
    initial.pantry.find((item) => item.name === "Lemons").stock,
    "out",
  );
  items[0].name = "Changed after saving";
  assert.equal(saved.purchase.items[0].name, "White beans");
  assert.equal(savePurchase(saved, readReceipt()), saved);
});

test("empty or incomplete receipt reviews cannot save or partially restock", () => {
  const initial = createState();
  assert.equal(
    savePurchase(
      initial,
      readReceipt().map((item) => ({ ...item, include: false })),
    ),
    initial,
  );
  for (const invalid of [
    { name: " " },
    { amount: " " },
    { cents: -1 },
    { cents: NaN },
    { cents: 2.5 },
  ]) {
    const items = readReceipt();
    Object.assign(items[1], invalid);
    assert.equal(savePurchase(initial, items), initial);
  }
});

test("making a meal prompts stock changes; confirming is a separate action", () => {
  const initial = createState();
  const made = markMealMade(initial);
  assert.equal(made.made, true);
  assert.equal(initial.made, false);
  assert.deepEqual(made.pantry, initial.pantry);
  const proposed = proposeStock(made);
  assert.deepEqual(proposed, [
    { name: "Chickpeas", stock: "low" },
    { name: "Spinach", stock: "out" },
    { name: "Olive oil", stock: "in" },
  ]);
  assert.equal(confirmStock(initial, proposed), initial);
  proposed[0].stock = "out";
  const confirmed = confirmStock(made, proposed);
  assert.equal(
    confirmed.pantry.find((item) => item.name === "Chickpeas").stock,
    "out",
  );
  assert.equal(
    confirmed.pantry.find((item) => item.name === "Spinach").stock,
    "out",
  );
  assert.equal(
    confirmed.pantry.find((item) => item.name === "Lemons").stock,
    "out",
  );
  assert.deepEqual(made.pantry, initial.pantry);
  assert.equal(
    confirmStock(made, [{ name: "Spinach", stock: "invalid" }]).pantry[1].stock,
    "low",
  );
});

test("receipt and meal flows work in either order, with fresh state for reset and each device", () => {
  const fresh = createState();
  const first = markMealMade(fresh);
  const consumed = confirmStock(first, proposeStock(first));
  const restocked = savePurchase(consumed, readReceipt());
  assert.equal(
    restocked.pantry.find((item) => item.name === "Spinach").stock,
    "in",
  );
  const bought = markMealMade(savePurchase(createState(), readReceipt()));
  const cooked = confirmStock(bought, proposeStock(bought));
  assert.equal(
    cooked.pantry.find((item) => item.name === "Spinach").stock,
    "out",
  );
  assert.equal(cooked.purchase.total, 720);
  assert.equal(
    proposeStock(consumed).find((item) => item.name === "Spinach").stock,
    "out",
  );
  const reset = createState();
  assert.deepEqual(reset, fresh);
  reset.pantry[0].stock = "out";
  reset.tasks[0].done = true;
  assert.equal(createState().pantry[0].stock, "in");
  assert.equal(createState().tasks[0].done, false);
});
