/* Pure logic for the Personal Autoclicker demo. No DOM, no timers. */

export const MIN_INTERVAL_MS = 50;
export const MAX_INTERVAL_MS = 60000;
export const DEFAULT_INTERVAL_MS = 500;

export type MouseButton = "left" | "right" | "middle";

export type ClickInput =
  { kind: "mouse"; button: MouseButton } | { kind: "key"; key: string };

export const MOUSE_BUTTONS: { id: MouseButton; label: string }[] = [
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "middle", label: "Middle" },
];

export const KEY_OPTIONS = [
  "Space",
  "Enter",
  "E",
  "F",
  "X",
  "Z",
  "1",
  "2",
] as const;

export type IntervalNote = "empty" | "invalid" | "min" | "max" | null;

export interface IntervalResult {
  ms: number;
  /* The accepted value differs from what was typed. */
  adjusted: boolean;
  note: IntervalNote;
}

/* Reads an interval typed as "250", "250 ms" or "0.25 s" and keeps it in
   range. Anything below the minimum is raised to it. */
export function parseInterval(raw: string): IntervalResult {
  const text = raw.trim().toLowerCase();
  if (!text) return { ms: DEFAULT_INTERVAL_MS, adjusted: true, note: "empty" };
  const match = /^(\d+(?:[.,]\d+)?|[.,]\d+)\s*(ms|s)?$/.exec(text);
  if (!match)
    return { ms: DEFAULT_INTERVAL_MS, adjusted: true, note: "invalid" };
  const amount = Number(match[1].replace(",", "."));
  const ms = Math.round(match[2] === "s" ? amount * 1000 : amount);
  if (ms < MIN_INTERVAL_MS)
    return { ms: MIN_INTERVAL_MS, adjusted: true, note: "min" };
  if (ms > MAX_INTERVAL_MS)
    return { ms: MAX_INTERVAL_MS, adjusted: true, note: "max" };
  return { ms, adjusted: false, note: null };
}

export function intervalMessage(note: IntervalNote): string {
  if (note === "min") return `Minimum interval is ${MIN_INTERVAL_MS} ms`;
  if (note === "max") return `Maximum interval is ${MAX_INTERVAL_MS} ms`;
  if (note === "invalid") return "Enter a number of milliseconds";
  if (note === "empty") return "Enter an interval";
  return "";
}

export function describeInput(input: ClickInput): string {
  if (input.kind === "key") return `${input.key} key`;
  const label = MOUSE_BUTTONS.find((entry) => entry.id === input.button)!.label;
  return `${label} click`;
}

export function formatRate(ms: number): string {
  const perSecond = 1000 / ms;
  const text =
    perSecond >= 10
      ? String(Math.round(perSecond))
      : String(Math.round(perSecond * 10) / 10);
  return `${text} ${text === "1" ? "click" : "clicks"}/s`;
}

export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

/* ---------- Click schedule ---------- */

export interface Clock {
  interval: number;
  /* Time at which the next click is due. */
  nextDue: number;
}

export function startClock(now: number, interval: number): Clock {
  return { interval: clampInterval(interval), nextDue: now };
}

export function clampInterval(ms: number): number {
  if (!Number.isFinite(ms)) return DEFAULT_INTERVAL_MS;
  return Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, Math.round(ms)));
}

/* Changing the interval while running restarts the beat from now. */
export function retime(now: number, interval: number): Clock {
  const clamped = clampInterval(interval);
  return { interval: clamped, nextDue: now + clamped };
}

export interface Step {
  clock: Clock;
  /* At most one click per step, however late the timer fires. */
  click: boolean;
  /* Milliseconds until the next step. */
  delay: number;
}

export function advance(clock: Clock, now: number): Step {
  if (now < clock.nextDue)
    return { clock, click: false, delay: clock.nextDue - now };
  const late = now - clock.nextDue;
  /* A timer that fired a whole interval late (throttled tab) restarts the
     beat instead of firing a burst to catch up. */
  const nextDue =
    late >= clock.interval
      ? now + clock.interval
      : clock.nextDue + clock.interval;
  return {
    clock: { interval: clock.interval, nextDue },
    click: true,
    delay: nextDue - now,
  };
}
