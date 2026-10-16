export type WindowId = "fiveHour" | "weekly";
export type UsageWindow = {
  id: WindowId;
  label: string;
  used: number;
  resetsIn: number;
  timeLeft: number;
  cycle: number;
};

type WindowSeed = {
  used: number;
  rate: number;
  reset: number;
  duration: number;
};

export const MAX_MINUTES = 120;
export const accounts = [
  { id: "lumen", provider: "Codex", alias: "Lumen", color: "#8ecbff" },
  { id: "orbit", provider: "Codex", alias: "Orbit", color: "#c4adff" },
  { id: "fern", provider: "Claude", alias: "Fern", color: "#f0b58e" },
] as const;
export type AccountId = (typeof accounts)[number]["id"];

const seeds: Record<AccountId, Record<WindowId, WindowSeed>> = {
  lumen: {
    fiveHour: { used: 72, rate: 0.4, reset: 45, duration: 300 },
    weekly: { used: 44, rate: 0.035, reset: 4320, duration: 10080 },
  },
  orbit: {
    fiveHour: { used: 31, rate: 0.18, reset: 210, duration: 300 },
    weekly: { used: 68, rate: 0.025, reset: 2880, duration: 10080 },
  },
  fern: {
    fiveHour: { used: 54, rate: 0.28, reset: 150, duration: 300 },
    weekly: { used: 75, rate: 0.05, reset: 1440, duration: 10080 },
  },
};

export type Session = {
  id: string;
  account: AccountId;
  title: string;
  workspace: string;
  age: number;
  status: "Working" | "Waiting" | "Finished";
};

export const sessions: readonly Session[] = [
  {
    id: "s1",
    account: "lumen",
    title: "Refine command palette",
    workspace: "paper-studio",
    age: 2,
    status: "Working",
  },
  {
    id: "s2",
    account: "fern",
    title: "Review keyboard navigation",
    workspace: "paper-studio",
    age: 6,
    status: "Waiting",
  },
  {
    id: "s3",
    account: "orbit",
    title: "Add export fixtures",
    workspace: "tiny-atlas",
    age: 12,
    status: "Finished",
  },
  {
    id: "s4",
    account: "lumen",
    title: "Simplify panel layout",
    workspace: "paper-studio",
    age: 28,
    status: "Finished",
  },
  {
    id: "s5",
    account: "fern",
    title: "Draft release notes",
    workspace: "tiny-atlas",
    age: 42,
    status: "Finished",
  },
  {
    id: "s6",
    account: "orbit",
    title: "Check date formatting",
    workspace: "tiny-atlas",
    age: 58,
    status: "Finished",
  },
];
export const initialPins = ["s4", "s3"];

export type Notice = {
  id: string;
  account: AccountId;
  minute: number;
  kind: "Usage" | "Waiting" | "Finished";
  title: string;
  body: string;
};

const initialNotices: readonly Notice[] = [
  {
    id: "finished",
    account: "orbit",
    minute: -12,
    kind: "Finished",
    title: "Add export fixtures",
    body: "Finished working · tiny-atlas",
  },
  {
    id: "waiting",
    account: "fern",
    minute: -6,
    kind: "Waiting",
    title: "Review keyboard navigation",
    body: "Waiting for input · paper-studio",
  },
];

export function clampMinute(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(MAX_MINUTES, value)) : 0;
}

function reading(seed: WindowSeed, minute: number, id: WindowId): UsageWindow {
  const cycle =
    minute < seed.reset
      ? 0
      : 1 + Math.floor((minute - seed.reset) / seed.duration);
  const elapsed =
    cycle === 0 ? minute : minute - seed.reset - (cycle - 1) * seed.duration;
  const resetsIn = seed.reset + cycle * seed.duration - minute;
  return {
    id,
    label: id === "fiveHour" ? "5-hour" : "Weekly",
    used: Math.min(100, (cycle === 0 ? seed.used : 0) + elapsed * seed.rate),
    resetsIn,
    timeLeft: (resetsIn / seed.duration) * 100,
    cycle,
  };
}

export function snapshot(value: number) {
  const minute = clampMinute(value);
  const notices: Notice[] = initialNotices.map((notice) => ({ ...notice }));
  const readings = accounts.map((account) => {
    const windows = (["fiveHour", "weekly"] as const).map((id) => {
      const seed = seeds[account.id][id];
      const current = reading(seed, minute, id);
      for (let cycle = 0; cycle <= current.cycle; cycle++) {
        const start =
          cycle === 0 ? 0 : seed.reset + (cycle - 1) * seed.duration;
        const end = cycle === 0 ? seed.reset : start + seed.duration;
        for (const threshold of [80, 100]) {
          const crossed =
            start + (threshold - (cycle === 0 ? seed.used : 0)) / seed.rate;
          if (crossed > start && crossed < end && crossed <= minute) {
            notices.push({
              id: `${account.id}-${id}-${cycle}-${threshold}`,
              account: account.id,
              minute: crossed,
              kind: "Usage",
              title: `${account.provider} · ${account.alias} ${threshold === 100 ? "limit reached" : "usage warning"}`,
              body: `${current.label}: ${threshold}% used · ${100 - threshold}% remaining`,
            });
          }
        }
      }
      return current;
    });
    return { ...account, windows };
  });
  notices.sort((a, b) => b.minute - a.minute || a.id.localeCompare(b.id));
  return { minute, accounts: readings, notices };
}

export function countdown(minutes: number): string {
  const total = Math.max(0, Math.ceil(minutes));
  if (total >= 1440)
    return `${Math.floor(total / 1440)}d ${Math.floor((total % 1440) / 60)}h`;
  if (total >= 60)
    return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, "0")}m`;
  return `${total}m`;
}

export function clockLabel(minutes: number): string {
  const total = 540 + Math.floor(clampMinute(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function findSessions(
  query: string,
  account: string,
  pins: readonly string[],
): Session[] {
  const text = query.trim().toLowerCase();
  return sessions
    .filter((session) => {
      const owner = accounts.find((item) => item.id === session.account)!;
      return (
        (account === "all" || session.account === account) &&
        `${session.title} ${session.workspace} ${session.id} ${owner.provider} ${owner.alias}`
          .toLowerCase()
          .includes(text)
      );
    })
    .sort(
      (a, b) =>
        Number(pins.includes(b.id)) - Number(pins.includes(a.id)) ||
        a.age - b.age,
    );
}

export function togglePin(pins: readonly string[], id: string): string[] {
  if (!sessions.some((session) => session.id === id)) return [...pins];
  return pins.includes(id) ? pins.filter((pin) => pin !== id) : [...pins, id];
}
