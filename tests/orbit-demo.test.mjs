import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "parse5";
import postcss from "postcss";
import {
  chatAccounts,
  chatSessions,
  delegatedJobs,
  createChatState,
  changeChat,
  jobStatus,
  previewReply,
  overviewTasks,
  orchestratorEvents,
} from "../public/projects-orbit-app/chat-state.js";
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

test("browsing connected accounts preserves the mounted conversation and its provider", () => {
  const initial = createChatState();
  const claude = changeChat(initial, { type: "browse", account: "C" });
  assert.equal(claude.browse, "C");
  assert.equal(claude.session, 0);
  assert.equal(chatSessions[claude.session].account, "A");
  const opened = changeChat(claude, { type: "session", id: 2 });
  assert.equal(
    chatAccounts[chatSessions[opened.session].account].label,
    "Claude Code",
  );
  assert.equal(initial.browse, "A");
  assert.equal(
    changeChat(initial, { type: "browse", account: "invalid" }),
    initial,
  );
  assert.equal(changeChat(initial, { type: "session", id: 99 }), initial);
});

test("tabs, splits, coding and focus preserve session identity and other workspace choices", () => {
  const initial = createChatState();
  let state = changeChat(initial, { type: "reader", reader: "review" });
  state = changeChat(state, { type: "layout", layout: "split" });
  assert.equal(state.secondary, "review");
  assert.equal(state.reader, "main");
  state = changeChat(state, { type: "focus", value: true });
  state = changeChat(state, { type: "coding", value: false });
  assert.equal(state.session, initial.session);
  assert.equal(state.attached, true);
  assert.equal(state.focus, true);
  assert.equal(state.coding, false);
  state = changeChat(state, { type: "layout", layout: "tabs" });
  assert.equal(state.secondary, "review");
  assert.equal(changeChat(state, { type: "layout", layout: "invalid" }), state);
});

test("delegation advances each independent worker to completion without account handoff", () => {
  let state = createChatState();
  assert.deepEqual(
    delegatedJobs.map((job) => job.account),
    ["B", "C"],
  );
  const timeline = [];
  for (const phase of [0, 1, 2, 3]) {
    state = changeChat(state, { type: "phase", phase });
    timeline.push(delegatedJobs.map((_, i) => jobStatus(state.phase, i)));
    assert.equal(chatSessions[state.session].account, "A");
  }
  assert.deepEqual(timeline, [
    ["Queued", "Queued"],
    ["Working", "Queued"],
    ["Completed", "Working"],
    ["Completed", "Completed"],
  ]);
});

test("phone continuation and desktop feedback update the same preview state and consume only the sent image", () => {
  const initial = createChatState();
  const compact = previewReply(initial, "Make the cards compact");
  assert.equal(compact.state.density, "compact");
  assert.equal(compact.state.attached, false);
  const phone = previewReply(
    compact.state,
    "I checked the shelf on my phone. Use comfortable spacing.",
  );
  assert.equal(phone.state.session, initial.session);
  assert.equal(phone.state.density, "comfortable");
  assert.equal(initial.attached, true);
  assert.equal(
    previewReply(initial, "uncompacted").state.density,
    "comfortable",
  );
});

test("static replica opens Overview and keeps the retained readers and connection marker", async () => {
  const html = await readFile(
    new URL("../public/projects-orbit-app/index.html", import.meta.url),
    "utf8",
  );
  const errors = [];
  const document = parse(html, {
    onParseError: (error) => errors.push(error.code),
  });
  assert.deepEqual(errors, []);
  const nodes = [];
  const walk = (node) => {
    nodes.push(node);
    for (const child of node.childNodes || []) walk(child);
  };
  walk(document);
  const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
  const ids = nodes.map((node) => attr(node, "id")).filter(Boolean);
  assert.equal(ids.length, new Set(ids).size);
  const readers = nodes.filter((node) => attr(node, "data-chat-reader"));
  assert.equal(readers.length, 3);
  for (const reader of readers)
    assert.ok(ids.includes(attr(reader, "aria-labelledby")));
  assert.deepEqual(
    nodes.map((node) => attr(node, "data-account")).filter(Boolean),
    [],
  );
  const mainNav = nodes.find((node) => attr(node, "class") === "main-nav");
  assert.equal(
    mainNav.childNodes
      .find((node) => node.tagName === "button")
      .attrs.find((a) => a.name === "data-view").value,
    "overview",
  );
  assert.equal(
    nodes.filter((node) => attr(node, "data-account-picker") !== undefined)
      .length,
    1,
  );
  assert.ok(
    nodes.some((node) => attr(node, "data-session-connection") !== undefined),
  );
  assert.ok(
    nodes.some(
      (node) =>
        attr(node, "data-panel") === "overview" &&
        attr(node, "hidden") === undefined,
    ),
  );
  assert.ok(
    nodes.some(
      (node) =>
        attr(node, "data-panel") === "chat" &&
        attr(node, "hidden") !== undefined,
    ),
  );
  assert.ok(
    nodes.some(
      (node) =>
        attr(node, "data-panel") === "tasks" &&
        attr(node, "hidden") !== undefined,
    ),
  );
  const visibleCopy = nodes
    .filter(
      (node) =>
        node.nodeName === "#text" &&
        !["script", "style"].includes(node.parentNode?.tagName),
    )
    .map((node) => node.value)
    .join("");
  assert.doesNotMatch(visibleCopy, /Style guide|[·—–]/);
});

test("Overview selects at most three unfinished tasks without changing the plan", () => {
  const tasks = [
    { id: 1, day: "tomorrow", done: false },
    { id: 2, day: "today", done: true },
    { id: 3, day: "today", done: false },
    { id: 4, day: "earlier", done: false },
    { id: 5, day: "unscheduled", done: false },
    { id: 6, day: "today", done: false },
    { id: 7, day: "today", done: false },
  ];
  const before = structuredClone(tasks);
  assert.deepEqual(
    overviewTasks(tasks).map((task) => task.id),
    [4, 3, 6],
  );
  assert.deepEqual(
    overviewTasks(
      tasks.map((task) => ({ ...task, done: task.id === 4 || task.done })),
    ).map((task) => task.id),
    [3, 6, 7],
  );
  assert.deepEqual(
    overviewTasks(tasks.map((task) => ({ ...task, done: true }))),
    [],
  );
  assert.deepEqual(overviewTasks([]), []);
  assert.deepEqual(tasks, before);
});

test("worker results return to the orchestrator only after that worker completes", () => {
  for (const phase of [0, 1, 2, 3]) {
    const events = orchestratorEvents(phase);
    assert.equal(events[0].speaker, "You");
    assert.match(events[1].text, /coordinate two workers/);
    for (const [index, job] of delegatedJobs.entries()) {
      const returned = events.find((event) => event.speaker === job.name);
      assert.equal(Boolean(returned), jobStatus(phase, index) === "Completed");
      if (returned) {
        assert.match(returned.text, /Returning.*Orbit/);
        assert.equal(chatSessions[job.session].account, job.account);
        assert.equal(chatSessions[job.session].title, job.name);
        const dispatch = events.findIndex(
          (event) => event.id === `dispatch-${job.name.toLowerCase()}`,
        );
        assert.ok(dispatch > 1 && dispatch < events.indexOf(returned));
      }
    }
    assert.equal(
      events.some((event) => event.id === "complete"),
      phase === 3,
    );
  }
});

test("Overview opens the existing tools and orchestration stays in an announced, bounded conversation", async () => {
  const html = await readFile(
    new URL("../public/projects-orbit-app/index.html", import.meta.url),
    "utf8",
  );
  const nodes = [];
  function walk(node) {
    nodes.push(node);
    for (const child of node.childNodes || []) walk(child);
  }
  walk(parse(html));
  const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
  const overview = nodes.find((node) => attr(node, "id") === "view-overview");
  const controls = [];
  function buttons(node) {
    if (node.tagName === "button") controls.push(node);
    for (const child of node.childNodes || []) buttons(child);
  }
  buttons(overview);
  assert.ok(controls.some((node) => attr(node, "data-view") === "chat"));
  assert.ok(
    controls.some((node) => attr(node, "data-quick-add") !== undefined),
  );
  assert.ok(
    controls.some((node) => attr(node, "data-overview-notebook") !== undefined),
  );
  assert.deepEqual(
    controls.map((node) => attr(node, "data-overview-worker")).filter(Boolean),
    ["0", "1"],
  );
  assert.deepEqual(
    controls.map((node) => attr(node, "data-overview-finance")).filter(Boolean),
    ["spending", "wishlist"],
  );
  const thread = nodes.find(
    (node) => attr(node, "data-orchestrator-transcript") !== undefined,
  );
  assert.equal(attr(thread, "role"), "log");
  assert.equal(attr(thread, "aria-live"), "polite");
  assert.match(attr(thread.parentNode, "class"), /replica-orchestrator-scroll/);
  const overviewSpent = controls.find(
    (node) => attr(node, "class") === "ov-spent",
  );
  const financeSpent = nodes.find(
    (node) => attr(node, "class") === "replica-spent",
  );
  const text = (node) =>
    node.nodeName === "#text"
      ? node.value
      : (node.childNodes || []).map(text).join("");
  assert.ok(text(overviewSpent).includes(text(financeSpent).trim()));
  assert.equal(
    nodes.some((node) => /\bcx-account\b/.test(attr(node, "class") || "")),
    false,
  );
});

test("all replica CSS stays inside one root with keyboard-only button and link focus", async () => {
  const css = await readFile(
    new URL("../public/projects-orbit-app/orbit.css", import.meta.url),
    "utf8",
  );
  const ast = postcss.parse(css);
  assert.deepEqual(
    ast.nodes
      .filter((node) => node.type !== "comment")
      .map((node) => node.selector),
    [".demo-orbit-app"],
  );
  const root = ast.nodes.find((node) => node.type === "rule");
  const focus = root.nodes.find((node) => node.selector === ":focus");
  assert.ok(
    focus.nodes.some(
      (node) =>
        node.prop === "outline" && node.value === "none" && node.important,
    ),
  );
  const keyboard = root.nodes.find(
    (node) => node.selector === ":is(button, a):focus-visible",
  );
  assert.ok(
    keyboard.nodes.some(
      (node) =>
        node.prop === "outline" && node.important && node.value !== "none",
    ),
  );
  assert.doesNotMatch(css, /:focus-within|:has\([^)]*:focus-visible/);
  for (const selector of [".ov-scroll", ".replica-orchestrator-scroll"]) {
    const region = root.nodes.find((node) => node.selector === selector);
    assert.ok(
      region.nodes.some(
        (node) => node.prop === "overflow" && node.value === "auto",
      ),
    );
  }
});

test("Orbit summary and body use concise plain sentences without colons or semicolons", async () => {
  const content = await readFile(
    new URL("../src/content/projects/orbit.md", import.meta.url),
    "utf8",
  );
  const [, frontmatter, body] = content.split("---");
  const summary = frontmatter.match(/^summary: "([^"]*)"/m)[1];
  assert.doesNotMatch(summary + body, /[:;]/);
  assert.ok(body.trim().split(/\s+/).length < 90);
});

test("replica stylesheet stays inline, fixed and mirrored without network, storage or idle work", async () => {
  const base = new URL("../public/projects-orbit-app/", import.meta.url);
  const [html, css, ...scripts] = await Promise.all(
    ["index.html", "orbit.css", "orbit.js", "chat.js", "chat-state.js"].map(
      (name) => readFile(new URL(name, base), "utf8"),
    ),
  );
  const blocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0][1].replace(/\s+/g, ""), css.replace(/\s+/g, ""));
  assert.match(css, /\.demo-orbit-app\s*\{/);
  assert.match(css, /color-scheme: light/);
  assert.match(css, /scrollbar-width: thin/);
  assert.doesNotMatch(
    css,
    /:global\(|backdrop-filter|transition:\s*all|@keyframes/,
  );
  assert.doesNotMatch(
    scripts.join("\n"),
    /\bfetch\s*\(|\bWebSocket\b|\blocalStorage\b|\bsessionStorage\b|document\.cookie|\bsetInterval\s*\(|\brequestAnimationFrame\s*\(/,
  );
  assert.match(scripts[1], /visibilitychange/);
  assert.match(scripts[1], /IntersectionObserver/);
  assert.match(scripts[1], /timers\.forEach\(clearTimeout\)/);
});
