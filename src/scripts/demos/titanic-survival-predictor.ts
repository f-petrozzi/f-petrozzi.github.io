import {
  keys,
  labels,
  naiveBayes,
  decisionTree,
  tree,
  scores,
  type Passenger,
  type Tree,
} from "../../data/demos/titanic-survival-predictor";
const pct = (n: number) => `${(100 * n).toFixed(1)}%`;
function init(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>("form")!;
  function update() {
    const input = Object.fromEntries(
      keys.map((k) => [
        k,
        root.querySelector<HTMLSelectElement>(`[name="${k}"]`)!.value,
      ]),
    ) as Passenger;
    const bayes = naiveBayes(input),
      result = decisionTree(input);
    root.querySelector("[data-bayes]")!.textContent = pct(bayes.probability);
    root.querySelector("[data-tree-score]")!.textContent = pct(
      result.probability,
    );
    root.querySelector("[data-likelihoods]")!.innerHTML =
      `<tr><th scope="row">Prior</th><td>${pct(bayes.prior[1])}</td><td>${pct(bayes.prior[0])}</td></tr>` +
      bayes.contributions
        .map(
          (c) =>
            `<tr><th scope="row">${labels[c.key]}: ${input[c.key]}</th><td>${pct(c.likelihood[1])}</td><td>${pct(c.likelihood[0])}</td></tr>`,
        )
        .join("");
    const active = new Set(result.path.map((n) => n.id));
    const nodes: { node: Tree; x: number; y: number }[] = [],
      edges: string[] = [];
    function visit(node: Tree, lo: number, hi: number, depth: number) {
      const x = (lo + hi) / 2,
        y = 30 + depth * 85;
      nodes.push({ node, x, y });
      for (const [child, a, b, label] of [
        [node.yes, lo, x, "Yes"],
        [node.no, x, hi, "No"],
      ] as const) {
        if (!child) continue;
        const cx = (a + b) / 2,
          cy = y + 85;
        edges.push(
          `<path class="${active.has(child.id) ? "selected" : "branch"}" d="M${x},${y + 15} L${cx},${cy - 20}"/><text x="${(x + cx) / 2}" y="${(y + cy) / 2}">${label}</text>`,
        );
        visit(child, a, b, depth + 1);
      }
    }
    visit(tree, 0, 800, 0);
    root.querySelector("[data-tree]")!.innerHTML =
      `<svg viewBox="0 0 800 325" role="img" aria-label="Decision tree. Highlighted route: ${result.path.map((n) => (n.key ? `${labels[n.key]} equals ${n.value}: ${input[n.key] === n.value ? "yes" : "no"}` : `survival ${pct(n.probability)}`)).join("; ")}">${edges.join("")}${nodes.map(({ node, x, y }) => `<g class="${active.has(node.id) ? "selected" : "branch"}"><rect x="${x - 47}" y="${y - 20}" width="94" height="40" rx="6"/><text x="${x}" y="${y - 3}">${node.key ? labels[node.key] : pct(node.probability)}</text><text x="${x}" y="${y + 11}">${node.key ? node.value : `${node.count} passengers`}</text></g>`).join("")}</svg>`;
    root.querySelector("[data-path]")!.textContent = result.path
      .map((n) =>
        n.key
          ? `${labels[n.key]} = ${n.value}? ${input[n.key] === n.value ? "Yes" : "No"}`
          : `${pct(n.probability)} survive (${n.count} training rows)`,
      )
      .join(" → ");
  }
  form.addEventListener("change", update);
  root.querySelector("[data-reset]")!.addEventListener("click", () => {
    form.reset();
    update();
  });
  root.querySelector("[data-accuracy]")!.textContent =
    `Held-out accuracy · Naive Bayes ${pct(scores.bayes)} · Tree ${pct(scores.tree)} · 96 training / 24 test rows`;
  update();
}
document
  .querySelectorAll<HTMLElement>('[data-demo="titanic-survival-predictor"]')
  .forEach(init);
