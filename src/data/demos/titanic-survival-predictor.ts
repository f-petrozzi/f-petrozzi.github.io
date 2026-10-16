export const features = {
  class: ["1st", "2nd", "3rd"],
  sex: ["Female", "Male"],
  age: ["Child (<16)", "Adult (16-59)", "Older (60+)"],
  fare: ["Low (<£15)", "Mid (£15-50)", "High (>£50)"],
  embarked: ["Southampton", "Cherbourg", "Queenstown"],
  family: ["Alone", "1-3 relatives", "4+ relatives"],
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
  return Array.from({ length: 1000 }, (_, id) => {
    const classDraw = random();
    const cls = classDraw < 0.24 ? 0 : classDraw < 0.44 ? 1 : 2;
    const sex = random() < 0.36 ? 0 : 1;
    const ageDraw = random();
    const age = ageDraw < 0.12 ? 0 : ageDraw < 0.95 ? 1 : 2;
    const fare = random() < 0.72 ? 2 - cls : Math.floor(random() * 3);
    const portDraw = random();
    const port = portDraw < 0.72 ? 0 : portDraw < 0.9 ? 1 : 2;
    const familyDraw = random();
    const family = familyDraw < 0.6 ? 0 : familyDraw < 0.9 ? 1 : 2;
    // Sex and class dominate; children and small families have an advantage.
    // Outcomes remain stochastic, including within each demographic group.
    const probability = Math.max(
      0.04,
      Math.min(
        0.96,
        (sex === 0 ? [0.94, 0.88, 0.5][cls] : [0.35, 0.16, 0.1][cls]) +
          (age === 0 ? 0.25 : age === 2 ? -0.1 : 0) +
          (family === 1 ? 0.04 : family === 2 ? -0.16 : 0),
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
export function layoutTree(model: Tree) {
  const nodeWidth = 132;
  const nodeHeight = 48;
  const gap = 16;
  const padding = 16;
  const nodes: { node: Tree; x: number; y: number }[] = [];
  const edges: { from: Tree; to: Tree; label: string }[] = [];
  let leaves = 0;
  function visit(node: Tree, depth: number): number {
    let x: number;
    if (node.yes && node.no) {
      const left = visit(node.yes, depth + 1);
      const right = visit(node.no, depth + 1);
      x = (left + right) / 2;
      edges.push(
        { from: node, to: node.yes, label: "Yes" },
        { from: node, to: node.no, label: "No" },
      );
    } else {
      x = padding + nodeWidth / 2 + leaves++ * (nodeWidth + gap);
    }
    nodes.push({ node, x, y: padding + nodeHeight / 2 + depth * 96 });
    return x;
  }
  visit(model, 0);
  return {
    nodes,
    edges,
    nodeWidth,
    nodeHeight,
    width: leaves * (nodeWidth + gap) - gap + padding * 2,
    height: Math.max(...nodes.map(({ y }) => y)) + nodeHeight / 2 + padding,
  };
}
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
