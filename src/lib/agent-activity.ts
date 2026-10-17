export type ActivityDay = { date: string; count: number };
export type ActivityExport = {
  schemaVersion: number;
  generatedAt: string;
  timezone: string;
  days: ActivityDay[];
};

const DAY = 86_400_000;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

// Nearest-rank quartiles of positive days. Ties stay together in the lower bin.
// Zero is its own level, so a quiet history never changes the meaning of zero.
export function activityThresholds(counts: number[]): number[] {
  const positive = counts.filter((count) => count > 0).sort((a, b) => a - b);
  return positive.length
    ? [0.25, 0.5, 0.75].map(
        (quantile) => positive[Math.ceil(positive.length * quantile) - 1],
      )
    : [];
}

export function activityLevel(count: number, thresholds: number[]): number {
  if (count <= 0) return 0;
  return 1 + thresholds.filter((threshold) => count > threshold).length;
}

export function activityGrid(days: ActivityDay[], endDate: string) {
  // Calendar arithmetic uses UTC on already-local date strings, avoiding DST drift.
  const end = new Date(`${endDate}T00:00:00Z`);
  const start = new Date(end.getTime() - (52 * 7 + end.getUTCDay()) * DAY);
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const thresholds = activityThresholds(
    days
      .filter((day) => day.date >= dateKey(start) && day.date <= endDate)
      .map((day) => day.count),
  );
  const weeks = Array.from({ length: 53 }, (_, column) =>
    Array.from({ length: 7 }, (_, row) => {
      const date = dateKey(
        new Date(start.getTime() + (column * 7 + row) * DAY),
      );
      const future = date > endDate;
      const count = future ? 0 : (counts.get(date) ?? 0);
      return { date, count, future, level: activityLevel(count, thresholds) };
    }),
  );
  const visible = weeks.flat().filter((day) => !day.future);
  return {
    weeks,
    thresholds,
    total: visible.reduce((sum, day) => sum + day.count, 0),
    activeDays: visible.filter((day) => day.count > 0).length,
    days: visible,
  };
}

export function localDate(instant: string, timezone = "America/New_York") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}
