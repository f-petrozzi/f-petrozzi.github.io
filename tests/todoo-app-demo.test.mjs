import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SNOOZE_MINUTES,
  SIRI_INTENT,
  initialState,
  parseTime,
  formatTime,
  formatClock,
  timeInputValue,
  suggestAlarmTime,
  generateNote,
  applyGenerate,
  addNote,
  addSubtask,
  toggleSubtask,
  removeSubtask,
  deleteNote,
  progress,
  scheduleAlarm,
  cancelAlarm,
  fireAlarm,
  snoozeAlarm,
  stopAlarm,
  alarmLabel,
  siriAddNote,
  setTitle,
} from "../src/data/demos/todoo-app.ts";

const note = (s, id) => s.notes.find((n) => n.id === id);

test("phone keeps its proportions and separates chrome from scrolling content", () => {
  const component = readFileSync(
    new URL("../src/components/demos/TodooDemo.astro", import.meta.url),
    "utf8",
  );
  const rule = (selector) => {
    const body = component.match(
      new RegExp(`\\.${selector}\\s*\\{([^}]+)\\}`),
    )?.[1];
    assert.ok(body, `Missing ${selector} rule`);
    return body;
  };
  const phone = rule("td-phone");
  assert.match(phone, /width:\s*340px\s*;/);
  assert.match(phone, /max-width:\s*100%\s*;/);
  assert.match(phone, /min-width:\s*min\(300px, 100%\)\s*;/);
  assert.match(phone, /aspect-ratio:\s*9 \/ 19\.5\s*;/);
  assert.doesNotMatch(component, /(?:max-)?height:\s*(?:700|660|440)px/);
  assert.match(
    component,
    /grid-template-columns:\s*340px minmax\(200px, 260px\)/,
  );
  const display = rule("td-screen");
  assert.match(display, /position:\s*absolute/);
  assert.match(display, /inset:\s*0\s*;/);
  assert.match(display, /grid-template-rows:\s*48px minmax\(0, 1fr\)/);
  assert.match(display, /padding-bottom:\s*24px/);
  assert.match(display, /overflow:\s*hidden/);
  // The 9px bezel leaves an inner radius of 52 - 9 = 43px.
  assert.match(phone, /border:\s*9px solid/);
  assert.match(phone, /border-radius:\s*52px/);
  assert.match(display, /border-radius:\s*43px/);
  const content = rule("td-content");
  assert.match(content, /min-height:\s*0/);
  assert.match(content, /overflow-y:\s*auto/);
  assert.match(content, /overscroll-behavior:\s*contain/);
  assert.match(rule("td-home"), /bottom:\s*8px/);
  // Persistent chrome sits inside the display, outside the replaced content.
  assert.match(
    component,
    /<div class="td-screen">\s*<div class="td-island"[\s\S]*?data-status[\s\S]*?>9:41<\/span>[\s\S]*?<div class="td-content" data-screen><\/div>\s*<span class="td-home" aria-hidden="true"><\/span>/,
  );
});

test("time helpers parse and format", () => {
  assert.equal(parseTime("10:15"), 615);
  assert.equal(parseTime("24:00"), null);
  assert.equal(parseTime("nope"), null);
  assert.equal(formatTime(615), "10:15 AM");
  assert.equal(formatTime(0), "12:00 AM");
  assert.equal(formatTime(13 * 60 + 5), "1:05 PM");
  assert.equal(formatTime(1440 + 615), "10:15 AM");
  assert.equal(formatClock(initialState().now), "9:41");
  assert.equal(timeInputValue(615), "10:15");
  assert.equal(suggestAlarmTime(initialState()), "10:15");
});

test("generator is deterministic and uses the title", () => {
  const a = generateNote("Plan a trip to the coast");
  assert.deepEqual(a, generateNote("Plan a trip to the coast"));
  assert.ok(a.subtasks.length >= 4 && a.subtasks.length <= 5);
  assert.equal(new Set(a.subtasks).size, a.subtasks.length);
  assert.ok(a.body.length > 20);
  assert.equal(generateNote("   "), null);
});

test("generator picks by theme and always returns distinct subtasks", () => {
  const trip = generateNote("Weekend camping trip");
  const party = generateNote("Birthday dinner for Sam");
  assert.notDeepEqual(trip.subtasks, party.subtasks);
  assert.ok(party.subtasks.length >= 4);
  for (const title of [
    "x",
    "Quarterly report",
    "Clean the garage",
    "Study",
    "Learn guitar",
  ]) {
    const g = generateNote(title);
    assert.equal(new Set(g.subtasks).size, g.subtasks.length);
    assert.ok(g.subtasks.every(Boolean));
  }
  const fallback = generateNote("Learn guitar");
  assert.ok(
    fallback.subtasks.some((t) => /done looks like|first small step/.test(t)),
  );
});

test("generate fills an empty note and does not duplicate subtasks", () => {
  let s = initialState();
  assert.equal(note(s, "n3").subtasks.length, 0);
  s = applyGenerate(s, "n3");
  const n = note(s, "n3");
  assert.ok(n.body.length > 0);
  assert.ok(n.subtasks.length >= 4);
  const again = applyGenerate(s, "n3");
  assert.equal(note(again, "n3").subtasks.length, n.subtasks.length);
  // untitled notes are left alone
  const blank = addNote(s);
  assert.equal(applyGenerate(blank.state, blank.id), blank.state);
  // the original state is never mutated
  assert.equal(note(initialState(), "n3").subtasks.length, 0);
});

test("subtasks can be added, toggled, removed and counted", () => {
  let s = initialState();
  assert.deepEqual(progress(note(s, "n1")), { done: 1, total: 3 });
  s = addSubtask(s, "n1", "  Book the room ");
  assert.equal(note(s, "n1").subtasks.at(-1).text, "Book the room");
  assert.equal(addSubtask(s, "n1", "   "), s);
  const added = note(s, "n1").subtasks.at(-1);
  s = toggleSubtask(s, "n1", added.id);
  assert.deepEqual(progress(note(s, "n1")), { done: 2, total: 4 });
  s = removeSubtask(s, "n1", added.id);
  assert.deepEqual(progress(note(s, "n1")), { done: 1, total: 3 });
  const ids = new Set(note(s, "n1").subtasks.map((t) => t.id));
  assert.equal(ids.size, 3);
});

test("new notes go to the top and can be deleted", () => {
  let s = initialState();
  const added = addNote(s, "Call the dentist");
  assert.equal(added.state.notes[0].id, added.id);
  assert.equal(added.state.notes.length, s.notes.length + 1);
  s = setTitle(added.state, added.id, "Call the vet");
  assert.equal(note(s, added.id).title, "Call the vet");
  s = deleteNote(s, added.id);
  assert.equal(s.notes.length, 3);
});

test("scheduling rolls to tomorrow when the time has passed", () => {
  let s = initialState();
  s = scheduleAlarm(s, "n2", "11:00");
  assert.equal(note(s, "n2").alarm.at, 11 * 60);
  assert.equal(alarmLabel(s, note(s, "n2").alarm), "11:00 AM");
  s = scheduleAlarm(s, "n2", "07:30");
  assert.equal(note(s, "n2").alarm.at, 1440 + 7 * 60 + 30);
  assert.equal(alarmLabel(s, note(s, "n2").alarm), "Tomorrow 7:30 AM");
  assert.equal(scheduleAlarm(s, "n2", "bad"), s);
  s = cancelAlarm(s, "n2");
  assert.equal(note(s, "n2").alarm, null);
});

test("fire now rings the alarm and moves the clock to its time", () => {
  let s = initialState();
  s = fireAlarm(s, "n1");
  assert.equal(s.ringing, "n1");
  assert.equal(s.now, 10 * 60 + 15);
  assert.equal(note(s, "n1").alarm.status, "ringing");
  // notes without an alarm cannot ring
  assert.equal(fireAlarm(initialState(), "n2").ringing, null);
});

test("snooze reschedules the alarm nine minutes out", () => {
  let s = fireAlarm(initialState(), "n1");
  s = snoozeAlarm(s);
  const alarm = note(s, "n1").alarm;
  assert.equal(s.ringing, null);
  assert.equal(alarm.status, "scheduled");
  assert.equal(alarm.at, 10 * 60 + 15 + SNOOZE_MINUTES);
  assert.equal(alarm.snoozes, 1);
  assert.equal(alarmLabel(s, alarm), "Snoozed to 10:24 AM");
  // it can ring again and snooze again
  s = snoozeAlarm(fireAlarm(s, "n1"));
  assert.equal(note(s, "n1").alarm.at, 10 * 60 + 24 + SNOOZE_MINUTES);
  assert.equal(note(s, "n1").alarm.snoozes, 2);
});

test("stop ends the ring without rescheduling", () => {
  let s = stopAlarm(fireAlarm(initialState(), "n1"));
  assert.equal(s.ringing, null);
  assert.equal(note(s, "n1").alarm.status, "stopped");
  assert.equal(alarmLabel(s, note(s, "n1").alarm), "Stopped");
  assert.equal(stopAlarm(s), s);
  assert.equal(snoozeAlarm(s), s);
});

test("deleting or cancelling a ringing note clears the alert", () => {
  const ringing = fireAlarm(initialState(), "n1");
  assert.equal(deleteNote(ringing, "n1").ringing, null);
  assert.equal(cancelAlarm(ringing, "n1").ringing, null);
});

test("the Siri intent adds a titled note and replies", () => {
  assert.equal(SIRI_INTENT.title, "Add a note in Todoo");
  const s = initialState();
  const done = siriAddNote(s, "  Pick up   dry cleaning ");
  assert.equal(done.state.notes[0].title, "Pick up dry cleaning");
  assert.equal(done.reply, "Added “Pick up dry cleaning” to Todoo.");
  assert.equal(done.state.notes.length, s.notes.length + 1);
  const empty = siriAddNote(s, "  ");
  assert.equal(empty.id, null);
  assert.equal(empty.state, s);
  assert.equal(empty.reply, SIRI_INTENT.question);
});
