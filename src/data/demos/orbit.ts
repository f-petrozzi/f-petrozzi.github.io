// Invented records only. Source behavior: Orbit TASKS.md, PROJECTS.md,
// CHAT-WORKSPACE.md, FINANCE-WISHLIST.md and preview/library.js.
export type Day = "today" | "tomorrow" | "unscheduled";
export type Task = {
  id: number;
  title: string;
  day: Day;
  list: string;
  done: boolean;
};
export const navigation = [
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "tasks", label: "Tasks", icon: "tasks" },
  { id: "library", label: "Library", icon: "book" },
  { id: "finance", label: "Finances", icon: "wallet" },
] as const;
export const days = [
  { id: "today", label: "Today", date: "Fri 16" },
  { id: "tomorrow", label: "Tomorrow", date: "Sat 17" },
  { id: "unscheduled", label: "Unscheduled", date: "" },
] as const;
export const sources = [
  {
    id: "brief",
    title: "Reading room brief.md",
    kind: "Markdown",
    text: "The reading room opens on Saturday from 10 am to 2 pm. The first release needs a book catalog and a reservation button.",
    fact: "Open Saturday, 10 am to 2 pm.",
  },
  {
    id: "research",
    title: "Reader interviews.txt",
    kind: "Text",
    text: "Readers want to see availability before reserving. They prefer a short list with readable titles and a clear reservation action.",
    fact: "Show availability before the reservation action.",
  },
  {
    id: "access",
    title: "Access review.md",
    kind: "Markdown",
    text: "Keep the catalog usable with a keyboard. Reservation controls need visible focus and a text confirmation. On phones, show one column.",
    fact: "Use one column on phones, visible focus, and text confirmations.",
  },
] as const;
export const accounts = [
  { name: "Harbor Checking", type: "Cash", cents: 284650, read: "Read Oct 16" },
  { name: "Harbor Savings", type: "Cash", cents: 620000, read: "Read Oct 16" },
  { name: "Alder Card", type: "Credit", cents: 38640, read: "Read Oct 15" },
] as const;
export const transactions = [
  { merchant: "Willow Market", category: "Food", cents: 6842 },
  { merchant: "Green Basket", category: "Food", cents: 4238 },
  { merchant: "Cedar Apartment", category: "Home", cents: 92000 },
  { merchant: "Metro Pass", category: "Transport", cents: 4800 },
  { merchant: "Paper & Ink", category: "Shopping", cents: 2650 },
] as const;
export const products = [
  {
    id: "lamp",
    name: "Adjustable reading lamp",
    store: "Amazon",
    cents: 3499,
    target: 3000,
    previous: 3999,
    shape: "lamp",
  },
  {
    id: "stand",
    name: "Aluminum laptop stand",
    store: "Amazon",
    cents: 4299,
    target: 4000,
    previous: 4799,
    shape: "stand",
  },
  {
    id: "book",
    name: "Dot grid notebook set",
    store: "Amazon",
    cents: 1499,
    target: 1200,
    previous: 1699,
    shape: "books",
  },
] as const;
export type State = {
  tasks: Task[];
  nextId: number;
  selected: string[];
  purchased: string[];
  density: "comfortable" | "compact";
};
export function createState(): State {
  return {
    tasks: [
      {
        id: 1,
        title: "Review the catalog preview",
        day: "today",
        list: "Work",
        done: false,
      },
      {
        id: 2,
        title: "Collect reading room sources",
        day: "today",
        list: "Personal",
        done: true,
      },
      {
        id: 3,
        title: "Test keyboard navigation",
        day: "today",
        list: "Work",
        done: false,
      },
      {
        id: 4,
        title: "Pick up library books",
        day: "tomorrow",
        list: "Personal",
        done: false,
      },
      {
        id: 5,
        title: "Find a reading lamp",
        day: "unscheduled",
        list: "Home",
        done: false,
      },
    ],
    nextId: 6,
    selected: sources.map((source) => source.id),
    purchased: [],
    density: "comfortable",
  };
}
export function addTask(state: State, title: string, day: string): State {
  const clean = title.trim().slice(0, 120);
  if (
    !clean ||
    !days.some((item) => item.id === day) ||
    state.tasks.length >= 30
  )
    return state;
  return {
    ...state,
    nextId: state.nextId + 1,
    tasks: [
      ...state.tasks,
      {
        id: state.nextId,
        title: clean,
        day: day as Day,
        list: "Personal",
        done: false,
      },
    ],
  };
}
export function changeTask(
  state: State,
  id: number,
  change: { done?: boolean; day?: string },
): State {
  if (!state.tasks.some((task) => task.id === id)) return state;
  if (change.day !== undefined && !days.some((day) => day.id === change.day))
    return state;
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === id
        ? { ...task, ...change, day: (change.day ?? task.day) as Day }
        : task,
    ),
  };
}
export function toggleSource(state: State, id: string): State {
  if (!sources.some((source) => source.id === id)) return state;
  return {
    ...state,
    selected: state.selected.includes(id)
      ? state.selected.filter((item) => item !== id)
      : [...state.selected, id],
  };
}
export function groundedNote(selected: string[]) {
  return sources
    .filter((source) => selected.includes(source.id))
    .map((source) => ({
      source: source.id,
      title: source.title,
      text: source.fact,
    }));
}
export function spending(category?: string) {
  return transactions
    .filter((row) => !category || row.category === category)
    .reduce((sum, row) => sum + row.cents, 0);
}
export function spendingGroups() {
  return [...new Set(transactions.map((row) => row.category))]
    .map((name) => ({ name, cents: spending(name) }))
    .sort((a, b) => b.cents - a.cents);
}
export function togglePurchased(state: State, id: string): State {
  if (!products.some((product) => product.id === id)) return state;
  return {
    ...state,
    purchased: state.purchased.includes(id)
      ? state.purchased.filter((item) => item !== id)
      : [...state.purchased, id],
  };
}
export function guidePreview(state: State, message: string) {
  if (/\b(compact|tighter|denser)\b/i.test(message))
    return {
      state: { ...state, density: "compact" as const },
      reply:
        "The catalog now uses compact cards. Availability and the reservation action stay visible.",
    };
  if (/\b(roomier|comfortable|spacious)\b/i.test(message))
    return {
      state: { ...state, density: "comfortable" as const },
      reply:
        "The catalog now has more space around each book. The phone layout still uses one column.",
    };
  return {
    state,
    reply:
      "This preview supports compact or comfortable card spacing. The catalog and its reservation controls are ready to try.",
  };
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
