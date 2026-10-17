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
  { id: "lumen", provider: "Codex", alias: "Lumen", color: "#00ff88" },
  { id: "fern", provider: "Claude", alias: "Fern", color: "#00ff88" },
  { id: "nova", provider: "AGY", alias: "Nova", color: "#00ff88" },
  { id: "orbit", provider: "Codex", alias: "Orbit", color: "#00ff88" },
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
  nova: {
    fiveHour: { used: 37, rate: 0.21, reset: 180, duration: 300 },
    weekly: { used: 23, rate: 0.03, reset: 3600, duration: 10080 },
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
    body: "Finished working / tiny-atlas",
  },
  {
    id: "waiting",
    account: "fern",
    minute: -6,
    kind: "Waiting",
    title: "Review keyboard navigation",
    body: "Waiting for input / paper-studio",
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
              title: `${account.provider} / ${account.alias} ${threshold === 100 ? "limit reached" : "usage warning"}`,
              body: `${current.label} / ${threshold}% used / ${100 - threshold}% left`,
            });
          }
        }
      }
      if (id === "fiveHour" && current.cycle > 0) {
        notices.push({
          id: `${account.id}-renewed-${current.cycle}`,
          account: account.id,
          minute: seed.reset + (current.cycle - 1) * seed.duration,
          kind: "Usage",
          title: "Allowance renewed",
          body: `${account.provider} ${account.alias} / 5-hour window reset`,
        });
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

// Small ports from Agent-Usage desktop/ui/{runtime,shape,details,notch}.js.
// Response is the spring period in seconds, not a fixed animation duration.
export const motion = {
  open: { response: 0.62, damping: 0.72 },
  detailOpen: { response: 0.74, damping: 0.78 },
  detailClose: { response: 0.38, damping: 1 },
  armHover: { response: 0.74, damping: 0.86 },
  armReturn: { response: 0.82, damping: 0.9 },
  armEmerge: 660,
  armAbsorb: 260,
  peekOpen: 120,
  peekSwitch: 110,
  peekGrace: 300,
  heldAway: 1500,
} as const;

// Exact analytic spring. Reuse position AND velocity when reversing a target.
export function spring(
  position: number,
  velocity: number,
  target: number,
  response: number,
  damping: number,
  elapsed: number,
): [number, number] {
  const dt = Math.max(0, Math.min(0.1, elapsed));
  if (!dt) return [position, velocity];
  const omega = (2 * Math.PI) / response;
  const y = position - target;
  if (damping < 1) {
    const a = damping * omega;
    const b = omega * Math.sqrt(1 - damping * damping);
    const e = Math.exp(-a * dt);
    const c = Math.cos(b * dt);
    const s = Math.sin(b * dt);
    const q = (velocity + a * y) / b;
    return [
      target + e * (y * c + q * s),
      e * (velocity * c - ((a * velocity + omega * omega * y) / b) * s),
    ];
  }
  if (Math.abs(damping - 1) < 1e-6) {
    const q = velocity + omega * y;
    const e = Math.exp(-omega * dt);
    return [target + (y + q * dt) * e, (velocity - omega * q * dt) * e];
  }
  const d = Math.sqrt(damping * damping - 1);
  const a = -omega * (damping - d);
  const b = -omega * (damping + d);
  const p = (velocity - b * y) / (a - b);
  const q = y - p;
  return [
    target + p * Math.exp(a * dt) + q * Math.exp(b * dt),
    a * p * Math.exp(a * dt) + b * q * Math.exp(b * dt),
  ];
}

export function usageColor(used: number): string {
  return used >= 95 ? "#ff6b47" : used >= 80 ? "#f2ff00" : "#00ff88";
}

// Provider glyph paths copied from the real renderer; no external assets needed.
export const providerPaths = {
  codex:
    "M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z",
  agy: "M12 1C11 8 8 11 1 12c7 1 10 4 11 11 1-7 4-10 11-11C16 11 13 8 12 1Z",
  claude:
    "M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z",
} as const;

export const starPath =
  "m10 2 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.7l5.4-.8Z";

export function providerPath(provider: string): string {
  return providerPaths[
    provider === "Codex" ? "codex" : provider === "AGY" ? "agy" : "claude"
  ];
}
