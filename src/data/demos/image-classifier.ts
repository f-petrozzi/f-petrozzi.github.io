export const conditions = ["Atelectasis", "Effusion", "Infiltration"] as const;
export const models = ["CNN from scratch", "Fine-tuned ResNet-50"] as const;
export const examples = [
  {
    title: "Clear fields",
    labels: [false, false, false],
    opacity: [0.08, 0.04, 0.06],
  },
  {
    title: "Basal shading",
    labels: [true, false, false],
    opacity: [0.8, 0.12, 0.2],
  },
  {
    title: "Pleural shading",
    labels: [false, true, false],
    opacity: [0.14, 0.86, 0.18],
  },
  {
    title: "Diffuse shading",
    labels: [false, false, true],
    opacity: [0.22, 0.18, 0.83],
  },
  {
    title: "Mixed basal / pleural",
    labels: [true, true, false],
    opacity: [0.76, 0.78, 0.18],
  },
  {
    title: "Mixed diffuse / basal",
    labels: [true, false, true],
    opacity: [0.65, 0.18, 0.8],
  },
];
// Independent sigmoid outputs: conditions can coexist; rows need not sum to one.
const logits = [
  [
    [-2.3, -2.5, -1.8],
    [1.1, -1.7, -0.4],
    [-0.8, 1.3, -0.9],
    [-0.2, -1.1, 0.8],
    [0.7, 0.9, -0.6],
    [0.25, -0.8, 0.9],
  ],
  [
    [-3, -3.2, -2.7],
    [2, -2.1, -1.4],
    [-1.8, 2.4, -1.6],
    [-1.5, -1.9, 1.9],
    [1.7, 1.8, -1.3],
    [1.2, -1.6, 2.1],
  ],
];
export function probabilities(model: number, example: number) {
  return logits[model][example].map((z) => 1 / (1 + Math.exp(-z)));
}
export type Confusion = { tp: number; fn: number; fp: number; tn: number };
// Each condition is evaluated independently on the same 100 invented cases.
export const evaluation: Confusion[][] = [
  [
    { tp: 27, fn: 13, fp: 12, tn: 48 },
    { tp: 22, fn: 8, fp: 10, tn: 60 },
    { tp: 31, fn: 14, fp: 15, tn: 40 },
  ],
  [
    { tp: 34, fn: 6, fp: 7, tn: 53 },
    { tp: 27, fn: 3, fp: 6, tn: 64 },
    { tp: 38, fn: 7, fp: 10, tn: 45 },
  ],
];
export function metrics(c: Confusion) {
  const total = c.tp + c.fn + c.fp + c.tn;
  return {
    accuracy: total ? (c.tp + c.tn) / total : 0,
    recall: c.tp + c.fn ? c.tp / (c.tp + c.fn) : 0,
  };
}
