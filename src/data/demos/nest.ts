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

// Active navigation from Nest's static/index.html. Watchlist and Countdowns
// are dormant in the source app, so they are deliberately absent here too.
export const navigation = [
  { id: "dashboard", label: "Home", icon: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z" },
  {
    id: "calendar",
    label: "Calendar",
    icon: "M4 5h16v16H4ZM8 2v6m8-6v6M4 11h16",
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: "m3 6 2 2 4-4m3 2h9M3 14l2 2 4-4m3 2h9M12 21h9",
  },
  {
    id: "cats",
    label: "Cats",
    icon: "M4 4l6 4h4l6-4v11a8 6 0 0 1-16 0Zm4 9h1m6 0h1m-6 4h4",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    icon: "M4 3v6a3 3 0 0 0 6 0V3M7 3v18m13 0V3c-5 3-5 10 0 10",
  },
  { id: "finance", label: "Finance", icon: "M20 7V4H4v16h16V7H4m12 4h6v5h-6Z" },
  {
    id: "health",
    label: "Health",
    icon: "M20 13 12 21 4 13C-2 7 6 0 12 7c6-7 14 0 8 6ZM3 12h5l2-3 4 7 2-4h5",
  },
] as const;

export const sectionTabs = {
  kitchen: ["Plan", "Nesty", "Recipes", "Shop", "Pantry"],
  cats: ["Today", "Health", "Pantry", "Gallery"],
  finance: ["Overview", "Expenses", "Subscriptions", "History"],
  health: ["Overview", "Activity", "Sleep", "Nutrition", "Trends"],
} as const;

// Small, invented snapshots for sections outside the four interactive flows.
export const sectionPreviews = [
  {
    id: "cats",
    title: "Cat Care",
    eyebrow: "Juniper & Miso",
    tabs: sectionTabs.cats,
    cards: [
      {
        title: "Breakfast is sorted",
        value: "2 bowls filled",
        copy: "Sam fed Juniper and Miso at 07:30. Fresh water is ready.",
      },
      {
        title: "Weight check",
        value: "4.2 kg",
        copy: "Juniper’s latest entry. Next check Saturday 17 October.",
      },
      {
        title: "Cat cupboard",
        value: "8 portions",
        copy: "Wet food is in stock. Dry food is running low.",
      },
      {
        title: "By the kitchen window",
        value: "Wednesday",
        copy: "Juniper and Miso found the warmest spot.",
      },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    eyebrow: "Household ledger",
    tabs: sectionTabs.finance,
    cards: [
      {
        title: "October spending",
        value: "$286.40",
        copy: "Groceries $186.40. Household essentials $100.00.",
      },
      {
        title: "Latest expenses",
        value: "$24.60",
        copy: "Maple Market grocery trip on Monday. Paid by Riley, shared equally.",
      },
      {
        title: "Home internet",
        value: "$42.00 / month",
        copy: "Due 20 October. Shared equally.",
      },
      {
        title: "September settled",
        value: "$0.00 balance",
        copy: "Sam and Riley settled last month.",
      },
    ],
  },
  {
    id: "health",
    title: "Health",
    eyebrow: "Sam's day",
    tabs: sectionTabs.health,
    cards: [
      {
        title: "Daily overview",
        value: "6,240 steps",
        copy: "7 hours 35 minutes of sleep. A 25-minute walk this morning.",
      },
      {
        title: "Morning walk",
        value: "25 minutes",
        copy: "An easy 1.8 km neighborhood walk.",
      },
      {
        title: "Last night",
        value: "7 h 35 min",
        copy: "Bedtime 23:10. Woke at 06:45.",
      },
      {
        title: "Today's meals",
        value: "Breakfast & lunch",
        copy: "Oats with berries. Roasted vegetable wrap.",
      },
      {
        title: "This week's steps",
        value: "6,100 daily average",
        copy: "Monday 5,900. Tuesday 6,160. Wednesday 6,240.",
      },
    ],
  },
] as const;

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
