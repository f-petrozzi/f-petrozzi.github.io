// Pure logic for the Todoo demo: notes with subtasks, a local stand-in for
// the note generator, alarms with stop/snooze, and the Siri "add a note" intent.

export const SNOOZE_MINUTES = 9;
export const SIRI_INTENT = {
  title: "Add a note in Todoo",
  phrase: "Add a note in Todoo",
  question: "What should the note say?",
};

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}

export type AlarmStatus = "scheduled" | "ringing" | "stopped";

export interface Alarm {
  /** Minutes since day zero, so tomorrow is 1440 + time of day. */
  at: number;
  status: AlarmStatus;
  snoozes: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  subtasks: Subtask[];
  alarm: Alarm | null;
}

export interface State {
  /** Simulated clock, minutes since day zero. */
  now: number;
  nextId: number;
  notes: Note[];
  ringing: string | null;
}

export function initialState(): State {
  return {
    now: 9 * 60 + 41,
    nextId: 20,
    ringing: null,
    notes: [
      {
        id: "n1",
        title: "Send Q3 summary",
        body: "Numbers are final. Lead with the result in one page.",
        subtasks: [
          { id: "s1", text: "Pull the final figures", done: true },
          { id: "s2", text: "Write the one-page summary", done: false },
          { id: "s3", text: "Send to the team", done: false },
        ],
        alarm: { at: 10 * 60 + 15, status: "scheduled", snoozes: 0 },
      },
      {
        id: "n2",
        title: "Pack for Saturday hike",
        body: "Early start on an exposed trail. Pack sun protection and water.",
        subtasks: [
          { id: "s4", text: "Fill two water bottles", done: true },
          { id: "s5", text: "Sunscreen and hat", done: false },
          { id: "s6", text: "Trail snacks", done: false },
          { id: "s7", text: "Charge the phone", done: false },
        ],
        alarm: null,
      },
      {
        id: "n3",
        title: "Birthday dinner for Sam",
        body: "",
        subtasks: [],
        alarm: null,
      },
    ],
  };
}

/* ---------- time ---------- */

export function parseTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** "10:15 AM" */
export function formatTime(minutes: number): string {
  const day = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(day / 60);
  const m = day % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Status bar clock, "9:41" */
export function formatClock(minutes: number): string {
  return formatTime(minutes).replace(/ [AP]M$/, "");
}

/** Value for an <input type="time"> */
export function timeInputValue(minutes: number): string {
  const day = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(day / 60)).padStart(2, "0")}:${String(day % 60).padStart(2, "0")}`;
}

export function dayLabel(state: State, at: number): "Today" | "Tomorrow" {
  return Math.floor(at / 1440) > Math.floor(state.now / 1440)
    ? "Tomorrow"
    : "Today";
}

/** A sensible default for a new alarm: half an hour out, on the 5 minute mark. */
export function suggestAlarmTime(state: State): string {
  return timeInputValue(Math.ceil((state.now + 30) / 5) * 5);
}

/* ---------- generator ---------- */

interface Template {
  test: RegExp;
  bodies: string[];
  tasks: string[];
}

const TEMPLATES: Template[] = [
  {
    test: /trip|travel|flight|vacation|hike|camp|road/i,
    bodies: [
      "Plan the route and timing. Pack for the weather.",
      "Confirm logistics early.",
    ],
    tasks: [
      "Check the weather forecast",
      "Confirm the route and timing",
      "Pack essentials the night before",
      "Share the plan with someone",
      "Charge phone and power bank",
    ],
  },
  {
    test: /party|birthday|dinner|celebrat|wedding|gather|brunch/i,
    bodies: [
      "Choose the date, guests and menu first.",
      "Set a clear time, short menu and one special detail.",
    ],
    tasks: [
      "Choose a date and time",
      "Confirm the guest list",
      "Plan the menu",
      "Pick up a gift or decorations",
      "Send reminders the day before",
    ],
  },
  {
    test: /workout|gym|run|train|yoga|marathon|exercise/i,
    bodies: [
      "Schedule short, regular sessions.",
      "Start easy. Track progress and add a little weekly.",
    ],
    tasks: [
      "Pick three days this week",
      "Lay out workout clothes",
      "Warm up for ten minutes",
      "Log the session",
      "Plan a rest day",
    ],
  },
  {
    test: /grocer|shop|meal|cook|recipe|bake|buy/i,
    bodies: [
      "Check the kitchen. List what’s missing.",
      "Buy for two or three planned meals.",
    ],
    tasks: [
      "Check the pantry and fridge",
      "Write the list by aisle",
      "Compare a couple of options",
      "Pick up the items",
      "Put everything away",
    ],
  },
  {
    test: /study|exam|class|homework|essay|read|course|lecture/i,
    bodies: [
      "Study in short sessions. Finish with a self-test.",
      "Start with the hardest topic.",
    ],
    tasks: [
      "List the topics to cover",
      "Block two focused sessions",
      "Summarize each topic in a few lines",
      "Try practice questions",
      "Review what felt shaky",
    ],
  },
  {
    test: /report|meeting|launch|presentation|project|deadline|review|email|summary|invoice/i,
    bodies: [
      "Agree on the outcome. Plan back from the deadline.",
      "Lead with the outcome. Share a concise draft early.",
    ],
    tasks: [
      "Define what done looks like",
      "Gather the inputs",
      "Write a first draft",
      "Get one review",
      "Send it and note the follow-ups",
    ],
  },
  {
    test: /clean|move|fix|repair|organi[sz]e|laundry|garden|declutter/i,
    bodies: [
      "Finish one area at a time.",
      "Set a timer. Clear the worst spot first.",
    ],
    tasks: [
      "Gather supplies",
      "Start with the busiest area",
      "Sort into keep, donate and toss",
      "Wipe down and reset",
      "Take out the trash",
    ],
  },
];

const FALLBACK: Template = {
  test: /./,
  bodies: [
    "Define the outcome. Take a small step today.",
    "Split the work. Schedule the first step.",
  ],
  tasks: [
    "Define what done looks like",
    "List what is needed",
    "Take the first small step",
    "Set a time to continue",
    "Review and wrap up",
  ],
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic local stand-in for the note-generation call. */
export function generateNote(
  title: string,
): { body: string; subtasks: string[] } | null {
  const clean = title.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const template = TEMPLATES.find((t) => t.test.test(clean)) ?? FALLBACK;
  const h = hash(clean.toLowerCase());
  const body = template.bodies[h % template.bodies.length];
  const count = 4 + (h % 2);
  const offset = count === 4 ? (h >>> 3) % 2 : 0;
  return { body, subtasks: template.tasks.slice(offset, offset + count) };
}

/* ---------- reducers ---------- */

function mapNote(state: State, id: string, fn: (n: Note) => Note): State {
  return {
    ...state,
    notes: state.notes.map((n) => (n.id === id ? fn(n) : n)),
  };
}

export function progress(note: Note): { done: number; total: number } {
  return {
    done: note.subtasks.filter((s) => s.done).length,
    total: note.subtasks.length,
  };
}

export function addNote(
  state: State,
  title = "",
  body = "",
): { state: State; id: string } {
  const id = `n${state.nextId}`;
  const note: Note = { id, title, body, subtasks: [], alarm: null };
  return {
    id,
    state: {
      ...state,
      nextId: state.nextId + 1,
      notes: [note, ...state.notes],
    },
  };
}

export function deleteNote(state: State, id: string): State {
  return {
    ...state,
    notes: state.notes.filter((n) => n.id !== id),
    ringing: state.ringing === id ? null : state.ringing,
  };
}

export function setTitle(state: State, id: string, title: string): State {
  return mapNote(state, id, (n) => ({ ...n, title }));
}

export function setBody(state: State, id: string, body: string): State {
  return mapNote(state, id, (n) => ({ ...n, body }));
}

export function addSubtask(state: State, id: string, text: string): State {
  const clean = text.trim();
  if (!clean) return state;
  return {
    ...mapNote(state, id, (n) => ({
      ...n,
      subtasks: [
        ...n.subtasks,
        { id: `s${state.nextId}`, text: clean, done: false },
      ],
    })),
    nextId: state.nextId + 1,
  };
}

export function toggleSubtask(
  state: State,
  noteId: string,
  subtaskId: string,
): State {
  return mapNote(state, noteId, (n) => ({
    ...n,
    subtasks: n.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s,
    ),
  }));
}

export function removeSubtask(
  state: State,
  noteId: string,
  subtaskId: string,
): State {
  return mapNote(state, noteId, (n) => ({
    ...n,
    subtasks: n.subtasks.filter((s) => s.id !== subtaskId),
  }));
}

/** Fill a note from its title: replaces the body and appends new subtasks. */
export function applyGenerate(state: State, id: string): State {
  const note = state.notes.find((n) => n.id === id);
  const result = note && generateNote(note.title);
  if (!note || !result) return state;
  const have = new Set(note.subtasks.map((s) => s.text.toLowerCase()));
  let next = state.nextId;
  const added = result.subtasks
    .filter((t) => !have.has(t.toLowerCase()))
    .map((text) => ({ id: `s${next++}`, text, done: false }));
  return {
    ...mapNote(state, id, (n) => ({
      ...n,
      body: result.body,
      subtasks: [...n.subtasks, ...added],
    })),
    nextId: next,
  };
}

/* ---------- alarms ---------- */

export function scheduleAlarm(state: State, id: string, time: string): State {
  const t = parseTime(time);
  if (t === null) return state;
  let at = Math.floor(state.now / 1440) * 1440 + t;
  if (at <= state.now) at += 1440;
  return mapNote(state, id, (n) => ({
    ...n,
    alarm: { at, status: "scheduled", snoozes: 0 },
  }));
}

export function cancelAlarm(state: State, id: string): State {
  return {
    ...mapNote(state, id, (n) => ({ ...n, alarm: null })),
    ringing: state.ringing === id ? null : state.ringing,
  };
}

/** Jump the simulated clock to the alarm time and ring it. */
export function fireAlarm(state: State, id: string): State {
  const note = state.notes.find((n) => n.id === id);
  if (!note?.alarm || note.alarm.status === "ringing") return state;
  const next = mapNote(state, id, (n) => ({
    ...n,
    alarm: { ...n.alarm!, status: "ringing" },
  }));
  return { ...next, now: Math.max(state.now, note.alarm.at), ringing: id };
}

export function snoozeAlarm(state: State): State {
  const id = state.ringing;
  if (!id) return state;
  return {
    ...mapNote(state, id, (n) =>
      n.alarm
        ? {
            ...n,
            alarm: {
              at: state.now + SNOOZE_MINUTES,
              status: "scheduled",
              snoozes: n.alarm.snoozes + 1,
            },
          }
        : n,
    ),
    ringing: null,
  };
}

export function stopAlarm(state: State): State {
  const id = state.ringing;
  if (!id) return state;
  return {
    ...mapNote(state, id, (n) =>
      n.alarm ? { ...n, alarm: { ...n.alarm, status: "stopped" } } : n,
    ),
    ringing: null,
  };
}

export function alarmLabel(state: State, alarm: Alarm): string {
  if (alarm.status === "stopped") return "Stopped";
  const when = `${dayLabel(state, alarm.at) === "Tomorrow" ? "Tomorrow " : ""}${formatTime(alarm.at)}`;
  if (alarm.status === "ringing") return `Ringing ${when}`;
  return alarm.snoozes ? `Snoozed to ${when}` : when;
}

/* ---------- Siri ---------- */

export function siriAddNote(
  state: State,
  title: string,
): { state: State; id: string | null; reply: string } {
  const clean = title.trim().replace(/\s+/g, " ");
  if (!clean) return { state, id: null, reply: SIRI_INTENT.question };
  const added = addNote(state, clean);
  return {
    state: added.state,
    id: added.id,
    reply: `Added “${clean}” to Todoo.`,
  };
}
