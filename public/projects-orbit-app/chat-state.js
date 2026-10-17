// Invented sessions. Account browsing never changes a mounted reader's connection.
export const chatAccounts = {
  A: { label: "Codex A", short: "Account A", fiveHour: 24, week: 41 },
  B: { label: "Codex B", short: "Account B", fiveHour: 8, week: 16 },
  C: { label: "Claude Code", short: "Claude", fiveHour: 12, week: 28 },
};
export const chatSessions = [
  { title: "Build the reading room", account: "A", workspace: "reading-room" },
  {
    title: "Collection",
    account: "B",
    workspace: "reading-room",
  },
  { title: "Accessibility", account: "C", workspace: "reading-room" },
  { title: "Notes on native CSS", account: "B", workspace: "Orbit" },
];
export const delegatedJobs = [
  {
    name: "Collection",
    title: "Build the collection",
    session: 1,
    account: "B",
    result: "Search and reservations ready",
    file: "src/Collection.astro",
  },
  {
    name: "Accessibility",
    title: "Review keyboard access",
    session: 2,
    account: "C",
    result: "Focus order and labels checked",
    file: "src/Search.astro",
  },
];
export function createChatState() {
  return {
    browse: "A",
    session: 0,
    reader: "main",
    secondary: "orchestrator",
    layout: "tabs",
    coding: true,
    focus: false,
    phase: 1,
    attached: true,
    density: "comfortable",
  };
}
export function changeChat(state, action) {
  switch (action.type) {
    case "browse":
      return chatAccounts[action.account]
        ? { ...state, browse: action.account }
        : state;
    case "session":
      return chatSessions[action.id]
        ? { ...state, session: action.id, reader: "main" }
        : state;
    case "reader":
      return ["main", "review", "orchestrator"].includes(action.reader)
        ? {
            ...state,
            reader: action.reader,
            secondary:
              action.reader === "main" ? state.secondary : action.reader,
          }
        : state;
    case "layout":
      return ["tabs", "split", "below"].includes(action.layout)
        ? { ...state, layout: action.layout, reader: "main" }
        : state;
    case "coding":
    case "focus":
    case "attached":
      return { ...state, [action.type]: Boolean(action.value) };
    case "phase":
      return [0, 1, 2, 3].includes(action.phase)
        ? { ...state, phase: action.phase }
        : state;
    default:
      return state;
  }
}
export function jobStatus(phase, index) {
  if (phase === 3 || (phase === 2 && index === 0)) return "Completed";
  if (phase >= 1 && (index === 0 || phase === 2)) return "Working";
  return "Queued";
}
// A deterministic conversation. Returned work stays in the orchestrator's thread.
export function orchestratorEvents(phase) {
  const events = [
    {
      id: "request",
      speaker: "You",
      text: "Build the reading room. Delegate the collection and keyboard review.",
    },
    {
      id: "plan",
      speaker: "Orbit",
      text: "I’ll coordinate two workers. Collection will build search and reservations. Accessibility will review the keyboard path. I’ll bring their results together here.",
    },
  ];
  if (phase >= 1)
    events.push({
      id: "dispatch-collection",
      speaker: "Orbit",
      text: "Dispatched to Collection on Codex B. Build search, availability and reservations.",
    });
  if (phase >= 2)
    events.push(
      {
        id: "return-collection",
        speaker: "Collection",
        text: "Search and reservations ready. Returning src/Collection.astro to Orbit.",
      },
      {
        id: "dispatch-accessibility",
        speaker: "Orbit",
        text: "Dispatched to Accessibility on Claude Code. Check search, filtering and reservations with a keyboard.",
      },
    );
  if (phase >= 3)
    events.push(
      {
        id: "return-accessibility",
        speaker: "Accessibility",
        text: "Focus order and labels checked. Returning the keyboard review to Orbit.",
      },
      {
        id: "complete",
        speaker: "Orbit",
        text: "Both workers have returned. Search and reservations are ready, and the keyboard review is complete.",
      },
    );
  return events;
}

export function overviewTasks(tasks) {
  return tasks
    .filter((task) => !task.done && ["earlier", "today"].includes(task.day))
    .sort((a, b) => Number(b.day === "earlier") - Number(a.day === "earlier"))
    .slice(0, 3);
}
export function previewReply(state, message) {
  const density = /\bcompact\b/i.test(message)
    ? "compact"
    : /\bcomfortable\b|\bgenerous\b/i.test(message)
      ? "comfortable"
      : state.density;
  return {
    state: { ...state, density, attached: false },
    reply:
      density !== state.density
        ? `The shelf now uses ${density} spacing. The preview is updated.`
        : "The Reading Room preview has search, availability and reservations. I can make the cards compact or comfortable.",
  };
}
