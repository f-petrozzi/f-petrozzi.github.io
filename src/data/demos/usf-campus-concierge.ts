export const passages = [
  {
    id: 1,
    title: "First-year application",
    text: "A first-year application needs a high school transcript and short statement of interest. Admissions reviews the application when all three arrive.",
  },
  {
    id: 2,
    title: "Application timeline",
    text: "Autumn application review opens in February. The applicant portal shows missing documents, review progress and decisions.",
  },
  {
    id: 3,
    title: "Orientation registration",
    text: "Confirm admission, then register for orientation in the welcome portal. Choose a session and add guests before submitting.",
  },
  {
    id: 4,
    title: "Orientation day",
    text: "Orientation starts at 9 a.m. in the welcome center with a campus tour, student services and course planning. Bring photo ID and registration confirmation.",
  },
  {
    id: 5,
    title: "Meet an academic advisor",
    text: "Request 30-minute academic advising before choosing courses. Include your intended major and two questions. Remote and campus appointments are available.",
  },
  {
    id: 6,
    title: "Financial aid checklist",
    text: "Apply for financial aid and check the aid portal for requested documents. The aid team explains scholarship reviews and award status.",
  },
  {
    id: 7,
    title: "Tuition and payment",
    text: "After course registration, the billing portal lists tuition and payment dates. Request a payment plan before the first payment.",
  },
  {
    id: 8,
    title: "Campus housing",
    text: "After admission, submit housing interest, room preferences and roommate requests in the housing form. The housing team confirms availability separately.",
  },
  {
    id: 9,
    title: "Getting to campus",
    text: "Use east visitor parking or the campus shuttle from the transit stop. Get maps and directions at welcome center check-in.",
  },
  {
    id: 10,
    title: "International applicants",
    text: "International applicants submit translated transcripts and language documents from their checklist. International admissions advisors answer document questions remotely.",
  },
  {
    id: 11,
    title: "Access and accommodations",
    text: "Request orientation accommodations from the access team with your session date and support needs. Accessible tours and captioned remote sessions are available.",
  },
  {
    id: 12,
    title: "Student ID card",
    text: "After confirming admission, upload a photo to the student card portal. Bring photo ID to collect your card at orientation’s welcome center.",
  },
];

export const prompts = [
  "What does a student need to apply?",
  "How should a student register for orientation?",
  "Can a student meet an advisor?",
  "How should a student request financial aid?",
];
const stop = new Set(
  "a an and are as at be before by can do does for from how i in is it me my of on or our the their this to what when where which who with you your need want about please could would should student students".split(
    " ",
  ),
);
const aliases: Record<string, string> = {
  apply: "application",
  applications: "application",
  applying: "application",
  admissions: "admission",
  admitted: "admission",
  applicants: "applicant",
  register: "registration",
  registering: "registration",
  registered: "registration",
  advisors: "advisor",
  advising: "advisor",
  appointment: "meeting",
  appointments: "meeting",
  meet: "meeting",
  meetings: "meeting",
  schedule: "meeting",
  documents: "document",
  transcripts: "transcript",
  requirements: "checklist",
  scholarships: "scholarship",
  fees: "tuition",
  accommodation: "access",
  accommodations: "access",
  accessibility: "access",
  dorm: "housing",
  dorms: "housing",
  park: "parking",
  parking: "parking",
  bus: "shuttle",
  email: "contact",
};
export function terms(text: string) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((word) => !stop.has(word))
    .map((word) => aliases[word] ?? word);
}

export function retrieve(question: string) {
  const query = terms(question);
  const documents = passages.map((passage) =>
    terms(`${passage.title} ${passage.text}`),
  );
  const idf = (term: string) =>
    Math.log(
      (documents.length + 1) /
        (documents.filter((doc) => doc.includes(term)).length + 1),
    ) + 1;
  const vector = (words: string[]) => {
    const counts = new Map<string, number>();
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
    return new Map(
      [...counts].map(([word, count]) => [
        word,
        (1 + Math.log(count)) * idf(word),
      ]),
    );
  };
  const q = vector(query);
  const norm = (v: Map<string, number>) =>
    Math.sqrt([...v.values()].reduce((sum, n) => sum + n * n, 0));
  const qNorm = norm(q);
  return passages
    .map((passage, index) => {
      const doc = vector(documents[index]);
      const dot = [...q].reduce(
        (sum, [word, weight]) => sum + weight * (doc.get(word) ?? 0),
        0,
      );
      return { ...passage, score: qNorm ? dot / (qNorm * norm(doc)) : 0 };
    })
    .sort((a, b) => b.score - a.score || a.id - b.id);
}

export function ask(question: string) {
  const ranked = retrieve(question);
  const citations = ranked
    .filter((p) => p.score > 0.08 && p.score >= ranked[0].score * 0.5)
    .slice(0, 3);
  const answer = citations.map((passage, index) => ({
    text: passage.text,
    passageId: passage.id,
    number: index + 1,
  }));
  const fallback =
    "No supporting passage found. Ask about applications, orientation or student services.";
  const timings = {
    retrieve: 18 + terms(question).length * 3,
    generate: 110 + answer.reduce((sum, p) => sum + p.text.length, 0),
    tool: 0,
  };
  return {
    question: question.trim(),
    ranked,
    citations,
    answer,
    fallback,
    timings,
  };
}
export type Reply = ReturnType<typeof ask>;
export type EmailDraft = { to: string; subject: string; body: string };
export function draftEmail(reply: Reply): EmailDraft {
  const topic = reply.citations[0]?.title ?? "Admissions question";
  return {
    to: "student@example.com",
    subject: `Next steps for ${topic.toLowerCase()}`,
    body: `Hello,\n\nYour next steps\n\n${reply.answer.map((part) => `${part.text} [${part.number}]`).join("\n\n")}\n\nUniversity references\n${reply.citations.map((passage, index) => `[${index + 1}] ${passage.title}`).join("\n")}\n\nReply for help booking advising.\n\nUSF Student Support`,
  };
}
export function emailCall(
  draft: EmailDraft,
  action: "draft" | "send" = "draft",
) {
  return {
    tool: action === "send" ? "gmail.send_email" : "gmail.create_draft",
    arguments: { ...draft },
    result: {
      status: action === "send" ? "sent" : "draft_ready",
      message: { ...draft },
    },
  };
}
export const meetingSlots = [
  { date: "2026-04-15", day: "Wed 15", times: ["10:00", "14:00"] },
  { date: "2026-04-16", day: "Thu 16", times: ["09:30", "13:30"] },
  { date: "2026-04-17", day: "Fri 17", times: ["11:00", "15:00"] },
];
export function meetingCall(
  reply: Reply,
  slot?: { date: string; time: string },
) {
  const valid =
    slot &&
    meetingSlots.some(
      (day) => day.date === slot.date && day.times.includes(slot.time),
    );
  return valid
    ? {
        tool: "google_calendar.create_event",
        arguments: {
          topic: reply.question,
          attendees: ["student@example.com"],
          start: `${slot.date}T${slot.time}:00-04:00`,
          duration_minutes: 30,
          time_zone: "America/New_York",
        },
        result: {
          status: "confirmed",
          start: `${slot.date} ${slot.time}`,
          message: "Meeting booked. Invitation sent to student@example.com.",
        },
      }
    : {
        tool: "google_calendar.find_available_slots",
        arguments: {
          topic: reply.question,
          duration_minutes: 30,
          date_from: "2026-04-15",
          date_to: "2026-04-17",
          time_zone: "America/New_York",
        },
        result: { status: "slots_available", slots: meetingSlots },
      };
}
export function latency(
  reply: Reply,
  action: "none" | "email" | "calendar" = "none",
) {
  return {
    ...reply.timings,
    tool: action === "email" ? 74 : action === "calendar" ? 96 : 0,
  };
}
