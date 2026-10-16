export const features = {
  class: ["1st", "2nd", "3rd"],
  sex: ["Female", "Male"],
  age: ["Child (<16)", "Adult (16–59)", "Older (60+)"],
  fare: ["Low (<£15)", "Mid (£15–50)", "High (>£50)"],
  embarked: ["Southampton", "Cherbourg", "Queenstown"],
  family: ["Alone", "1–3 relatives", "4+ relatives"],
};
export type Feature = keyof typeof features;
export type Passenger = Record<Feature, string>;
export type Row = Passenger & { id: number; survived: boolean };
export const keys = Object.keys(features) as Feature[];
export const labels: Record<Feature, string> = {
  class: "Class",
  sex: "Sex",
  age: "Age band",
  fare: "Fare band",
  embarked: "Embarked",
  family: "Family aboard",
};
export const initial: Passenger = Object.fromEntries(
  keys.map((k) => [k, features[k][0]]),
) as Passenger;
function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function makePassengers(seed = 1912): Row[] {
  const random = randomSource(seed);
  return Array.from({ length: 120 }, (_, id) => {
    const cls = random() < 0.24 ? 0 : random() < 0.35 ? 1 : 2;
    const sex = random() < 0.36 ? 0 : 1;
    const age = random() < 0.17 ? 0 : random() < 0.91 ? 1 : 2;
    const fare = random() < 0.72 ? 2 - cls : Math.floor(random() * 3);
    const port = random() < 0.7 ? 0 : random() < 0.65 ? 1 : 2;
    const family = random() < 0.6 ? 0 : random() < 0.8 ? 1 : 2;
    const probability = Math.max(
      0.04,
      Math.min(
        0.96,
        0.22 +
          (sex === 0 ? 0.47 : 0) +
          (age === 0 ? 0.2 : age === 2 ? -0.12 : 0) +
          (2 - cls) * 0.1 +
          (fare - 1) * 0.03 +
          (family === 1 ? 0.05 : family === 2 ? -0.18 : 0) +
          (port === 1 ? 0.03 : 0),
      ),
    );
    return {
      id,
      class: features.class[cls],
      sex: features.sex[sex],
      age: features.age[age],
      fare: features.fare[fare],
      embarked: features.embarked[port],
      family: features.family[family],
      survived: random() < probability,
    };
  });
}
export const passengers = makePassengers();
export const training = passengers.filter((r) => r.id % 5 !== 0);
export const heldOut = passengers.filter((r) => r.id % 5 === 0);
export function naiveBayes(input: Passenger, rows = training) {
  const counts = [false, true].map((label) =>
    rows.filter((r) => r.survived === label),
  );
  const prior = counts.map((group) => (group.length + 1) / (rows.length + 2));
  const contributions = keys.map((key) => ({
    key,
    likelihood: counts.map(
      (group) =>
        (group.filter((r) => r[key] === input[key]).length + 1) /
        (group.length + features[key].length),
    ),
  }));
  const logScores = prior.map(
    (p, index) =>
      Math.log(p) +
      contributions.reduce((sum, c) => sum + Math.log(c.likelihood[index]), 0),
  );
  const probability = 1 / (1 + Math.exp(logScores[0] - logScores[1]));
  return { probability, prior, contributions };
}
export type Tree = {
  id: string;
  probability: number;
  count: number;
  key?: Feature;
  value?: string;
  yes?: Tree;
  no?: Tree;
};
export function trainTree(rows: Row[], depth = 0, id = "r"): Tree {
  const probability = rows.filter((r) => r.survived).length / rows.length;
  const node: Tree = { id, probability, count: rows.length };
  if (depth === 3 || rows.length < 12 || probability === 0 || probability === 1)
    return node;
  const gini = (group: Row[]) => {
    const p = group.filter((r) => r.survived).length / group.length;
    return 2 * p * (1 - p);
  };
  let best = gini(rows),
    split: { key: Feature; value: string; yes: Row[]; no: Row[] } | undefined;
  for (const key of keys)
    for (const value of features[key]) {
      const yes = rows.filter((r) => r[key] === value),
        no = rows.filter((r) => r[key] !== value);
      if (yes.length < 5 || no.length < 5) continue;
      const score =
        (yes.length * gini(yes) + no.length * gini(no)) / rows.length;
      if (score < best - 1e-10) {
        best = score;
        split = { key, value, yes, no };
      }
    }
  if (!split) return node;
  return {
    ...node,
    key: split.key,
    value: split.value,
    yes: trainTree(split.yes, depth + 1, id + "y"),
    no: trainTree(split.no, depth + 1, id + "n"),
  };
}
export const tree = trainTree(training);
export function decisionTree(input: Passenger, model = tree) {
  const path: Tree[] = [];
  let node = model;
  while (true) {
    path.push(node);
    if (!node.key) break;
    node = input[node.key] === node.value ? node.yes! : node.no!;
  }
  return { probability: node.probability, path };
}
export function accuracy(predict: (p: Passenger) => number, rows = heldOut) {
  return (
    rows.filter((r) => predict(r) >= 0.5 === r.survived).length / rows.length
  );
}
export const scores = {
  bayes: accuracy((p) => naiveBayes(p).probability),
  tree: accuracy((p) => decisionTree(p).probability),
};
