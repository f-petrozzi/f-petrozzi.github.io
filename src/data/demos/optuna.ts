export type Trial = {
  number: number;
  width: number;
  dropout: number;
  learningRate: number;
  optimizer: string;
  loss: number;
  state: "complete" | "pruned";
};
export function makeStudy(seed = 42, count = 30): Trial[] {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => {
    const width = [16, 32, 64, 128][Math.floor(random() * 4)];
    const dropout = Math.round((0.05 + random() * 0.5) * 100) / 100;
    const learningRate = 10 ** (-4 + random() * 2.5);
    const optimizer = random() < 0.65 ? "Adam" : "SGD";
    const loss =
      0.32 +
      0.018 * Math.abs(Math.log2(width / 64)) +
      0.45 * (dropout - 0.25) ** 2 +
      0.065 * Math.abs(Math.log10(learningRate) + 2.7) +
      (optimizer === "SGD" ? 0.065 : 0) +
      random() * 0.025;
    const pruned = index > 3 && loss > 0.455;
    return {
      number: index + 1,
      width,
      dropout,
      learningRate,
      optimizer,
      loss: loss + (pruned ? 0.045 : 0),
      state: pruned ? "pruned" : "complete",
    };
  });
}
export const trials = makeStudy();
export function history(rows: Trial[]) {
  let best = Infinity;
  return rows.map((t) => {
    if (t.state === "complete") best = Math.min(best, t.loss);
    return { number: t.number, best: Number.isFinite(best) ? best : null };
  });
}
export function bestTrial(rows: Trial[]) {
  return rows
    .filter((t) => t.state === "complete")
    .reduce<Trial | null>(
      (best, t) => (!best || t.loss < best.loss ? t : best),
      null,
    );
}
// Descriptive one-way explained variance by parameter group; no causal interpretation.
export function importance(rows: Trial[]) {
  const complete = rows.filter((t) => t.state === "complete");
  const names = ["Layer width", "Dropout", "Learning rate", "Optimizer"];
  const group = [
    (t: Trial) => String(t.width),
    (t: Trial) => String(Math.floor(t.dropout / 0.2)),
    (t: Trial) => String(Math.floor(Math.log10(t.learningRate))),
    (t: Trial) => t.optimizer,
  ];
  const mean =
    complete.reduce((sum, t) => sum + t.loss, 0) / (complete.length || 1);
  const total = complete.reduce((sum, t) => sum + (t.loss - mean) ** 2, 0);
  const raw = group.map((fn) => {
    const groups = new Map<string, number[]>();
    complete.forEach((t) => {
      const key = fn(t);
      groups.set(key, [...(groups.get(key) ?? []), t.loss]);
    });
    return total === 0
      ? 0
      : [...groups.values()].reduce(
          (sum, values) =>
            sum +
            values.length *
              (values.reduce((s, v) => s + v, 0) / values.length - mean) ** 2,
          0,
        ) / total;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return names.map((name, i) => ({ name, value: sum ? raw[i] / sum : 0 }));
}
