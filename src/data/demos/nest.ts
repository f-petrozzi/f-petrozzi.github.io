export type Stock = "in" | "low" | "out";
export type PantryItem = { name: string; stock: Stock };
export type Task = {
  id: number;
  title: string;
  date: string;
  person: "Sam" | "Riley" | "Both";
  done: boolean;
};
export type ReceiptItem = {
  name: string;
  amount: string;
  cents: number;
  include: boolean;
};
export type State = {
  tasks: Task[];
  pantry: PantryItem[];
  made: boolean;
  purchase: { items: ReceiptItem[]; total: number } | null;
};

export const week = [
  { date: "2026-10-12", day: "Mon", number: 12 },
  { date: "2026-10-13", day: "Tue", number: 13 },
  { date: "2026-10-14", day: "Wed", number: 14 },
  { date: "2026-10-15", day: "Thu", number: 15 },
  { date: "2026-10-16", day: "Fri", number: 16 },
  { date: "2026-10-17", day: "Sat", number: 17 },
  { date: "2026-10-18", day: "Sun", number: 18 },
] as const;

export const stockLabels: Record<Stock, string> = {
  in: "In stock",
  low: "Running low",
  out: "Out of stock",
};

export function createState(): State {
  return {
    tasks: [
      {
        id: 1,
        title: "Water the plants",
        date: "2026-10-14",
        person: "Riley",
        done: false,
      },
    ],
    pantry: [
      { name: "Chickpeas", stock: "in" },
      { name: "Spinach", stock: "low" },
      { name: "Olive oil", stock: "in" },
      { name: "Lemons", stock: "out" },
    ],
    made: false,
    purchase: null,
  };
}

export function addTask(
  state: State,
  title: string,
  date: string,
  person: Task["person"],
): State {
  const clean = title.trim().slice(0, 80);
  if (
    !clean ||
    !week.some((day) => day.date === date) ||
    !["Sam", "Riley", "Both"].includes(person)
  )
    return state;
  return {
    ...state,
    tasks: [
      ...state.tasks,
      {
        id: Math.max(0, ...state.tasks.map((task) => task.id)) + 1,
        title: clean,
        date,
        person,
        done: false,
      },
    ],
  };
}

export function toggleTask(state: State, id: number): State {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, done: !task.done } : task,
    ),
  };
}

export function calendarDays(state: State) {
  return week.map((day) => ({
    ...day,
    tasks: state.tasks.filter((task) => task.date === day.date),
  }));
}

export function readReceipt(): ReceiptItem[] {
  return [
    { name: "Chickpeas", amount: "2 cans", cents: 240, include: true },
    { name: "Spinach", amount: "1 bag", cents: 320, include: true },
    { name: "Lemons", amount: "2 loose", cents: 160, include: true },
  ];
}

export function selectedItems(items: ReceiptItem[]) {
  return items
    .filter((item) => item.include)
    .map((item) => ({
      ...item,
      name: item.name.trim().slice(0, 60),
      amount: item.amount.trim().slice(0, 30),
    }));
}

export function receiptTotal(items: ReceiptItem[]) {
  return selectedItems(items).reduce((sum, item) => sum + item.cents, 0);
}

export function savePurchase(state: State, items: ReceiptItem[]): State {
  if (state.purchase) return state;
  const selected = selectedItems(items);
  if (
    !selected.length ||
    selected.some(
      (item) =>
        !item.name ||
        !item.amount ||
        !Number.isSafeInteger(item.cents) ||
        item.cents < 0,
    )
  )
    return state;
  const pantry = state.pantry.map((item) => ({ ...item }));
  for (const item of selected) {
    const existing = pantry.find(
      (entry) => entry.name.toLowerCase() === item.name.toLowerCase(),
    );
    if (existing) existing.stock = "in";
    else pantry.push({ name: item.name, stock: "in" });
  }
  return {
    ...state,
    pantry,
    purchase: { items: selected, total: receiptTotal(selected) },
  };
}

export function markMealMade(state: State): State {
  return { ...state, made: true };
}

export function proposeStock(state: State): PantryItem[] {
  const suggestions: Record<string, Stock> = {
    Chickpeas: "low",
    Spinach: "out",
    "Olive oil": "in",
  };
  return state.pantry
    .filter((item) => Object.hasOwn(suggestions, item.name))
    .map((item) => ({
      name: item.name,
      stock: item.stock === "out" ? "out" : suggestions[item.name],
    }));
}

export function confirmStock(state: State, changes: PantryItem[]): State {
  if (!state.made) return state;
  return {
    ...state,
    pantry: state.pantry.map((item) => {
      const change = changes.find((entry) => entry.name === item.name);
      return change && ["in", "low", "out"].includes(change.stock)
        ? { ...item, stock: change.stock }
        : item;
    }),
  };
}

export function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
