import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ask,
  draftEmail,
  emailCall,
  latency,
  meetingCall,
  meetingSlots,
  passages,
  prompts,
  retrieve,
} from "../src/data/demos/usf-campus-concierge.ts";

test("retrieval uses question content and returns ranked, deterministic similarities", () => {
  assert.equal(passages.length, 12);
  const expected = [1, 3, 5, 6];
  prompts.forEach((question, i) => {
    const reply = ask(question);
    assert.equal(reply.ranked[0].id, expected[i]);
    assert.ok(reply.citations.length > 0);
    assert.deepEqual(reply, ask(question));
    assert.ok(
      reply.ranked.every(
        (p, index) => !index || p.score <= reply.ranked[index - 1].score,
      ),
    );
  });
  const narrow = retrieve("orientation").find((p) => p.id === 3).score;
  const specific = retrieve("orientation registration welcome portal").find(
    (p) => p.id === 3,
  ).score;
  assert.notEqual(narrow, specific);
  assert.ok(specific > narrow);
});
test("answers cite the exact passages and unsupported questions have no citations", () => {
  const reply = ask("Where do I park for orientation?");
  reply.answer.forEach((part, i) => {
    assert.equal(part.number, i + 1);
    assert.equal(part.text, passages.find((p) => p.id === part.passageId).text);
    assert.equal(reply.citations[i].id, part.passageId);
  });
  for (const question of ["", "   ", "What is the capital of France?", "🪐"]) {
    const unknown = ask(question);
    assert.deepEqual(unknown.answer, []);
    assert.deepEqual(unknown.citations, []);
    assert.match(unknown.fallback, /No supporting passage/);
  }
});
test("email tool arguments and result reflect editable draft fields", () => {
  const reply = ask(prompts[1]);
  const draft = draftEmail(reply);
  assert.equal(draft.to, "student@example.com");
  reply.answer.forEach((part) =>
    assert.ok(draft.body.includes(`${part.text} [${part.number}]`)),
  );
  reply.citations.forEach((passage, i) =>
    assert.ok(draft.body.includes(`[${i + 1}] ${passage.title}`)),
  );
  assert.match(draft.body, /USF Student Support/);
  const edited = {
    ...draft,
    subject: "Your orientation registration",
    body: "Please choose a remote orientation session.",
  };
  const call = emailCall(edited);
  assert.equal(call.tool, "gmail.create_draft");
  assert.deepEqual(call.arguments, edited);
  assert.deepEqual(call.result.message, edited);
  assert.equal(call.result.status, "draft_ready");
  const sent = emailCall(edited, "send");
  assert.equal(sent.tool, "gmail.send_email");
  assert.equal(sent.result.status, "sent");
  assert.deepEqual(sent.arguments, edited);
  assert.deepEqual(sent.result.message, edited);
  assert.equal(call.result.status, "draft_ready");
});
test("calendar availability and booked slots use the same dates and times", () => {
  const reply = ask(prompts[2]);
  const available = meetingCall(reply);
  assert.equal(available.tool, "google_calendar.find_available_slots");
  assert.deepEqual(available.result.slots, meetingSlots);
  const proposal = meetingCall(reply, {
    date: meetingSlots[1].date,
    time: meetingSlots[1].times[0],
  });
  assert.equal(proposal.tool, "google_calendar.create_event");
  assert.equal(proposal.arguments.topic, reply.question);
  assert.equal(proposal.arguments.duration_minutes, 30);
  assert.equal(proposal.arguments.start, "2026-04-16T09:30:00-04:00");
  assert.equal(proposal.result.status, "confirmed");
  assert.match(proposal.result.message, /Invitation sent/);
  assert.deepEqual(proposal.arguments.attendees, ["student@example.com"]);
  assert.equal(
    meetingCall(reply, { date: "2026-04-18", time: "04:00" }).result.status,
    "slots_available",
  );
});
test("last request latency includes only the action performed", () => {
  const reply = ask(prompts[0]);
  assert.equal(latency(reply).tool, 0);
  assert.equal(latency(reply, "email").tool, 74);
  assert.equal(latency(reply, "calendar").tool, 96);
  assert.equal(latency(reply, "email").retrieve, reply.timings.retrieve);
  assert.ok(
    ask("orientation registration guests welcome session").timings.retrieve >
      ask("orientation").timings.retrieve,
  );
});
