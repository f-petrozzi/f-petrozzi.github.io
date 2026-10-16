import {
  keys,
  labels,
  naiveBayes,
  decisionTree,
  tree,
  scores,
  type Passenger,
  layoutTree,
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
    const layout = layoutTree(tree);
    const positions = new Map(layout.nodes.map((item) => [item.node.id, item]));
    const edges = layout.edges.map(({ from, to, label }) => {
      const a = positions.get(from.id)!;
      const b = positions.get(to.id)!;
      return `<path class="${active.has(to.id) ? "selected" : "branch"}" d="M${a.x},${a.y + layout.nodeHeight / 2}L${b.x},${b.y - layout.nodeHeight / 2}"/><text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2}">${label}</text>`;
    });
    const diagram = root.querySelector<HTMLElement>("[data-tree]")!;
    diagram.style.setProperty("--tree-width", `${layout.width}px`);
    diagram.innerHTML = `<svg viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-label="Decision tree. Highlighted route: ${result.path.map((n) => (n.key ? `${labels[n.key]} equals ${n.value}: ${input[n.key] === n.value ? "yes" : "no"}` : `survival ${pct(n.probability)}`)).join("; ")}">${edges.join("")}${layout.nodes.map(({ node, x, y }) => `<g class="${active.has(node.id) ? "selected" : "branch"}"><rect x="${x - layout.nodeWidth / 2}" y="${y - layout.nodeHeight / 2}" width="${layout.nodeWidth}" height="${layout.nodeHeight}" rx="6"/><text x="${x}" y="${y - 4}">${node.key ? labels[node.key] : pct(node.probability)}</text><text x="${x}" y="${y + 13}">${node.key ? node.value : `${node.count} passengers`}</text></g>`).join("")}</svg>`;
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
    `Held-out accuracy; Naive Bayes ${pct(scores.bayes)}; Tree ${pct(scores.tree)}; 800 training / 200 test rows`;
  update();
}
document
  .querySelectorAll<HTMLElement>('[data-demo="titanic-survival-predictor"]')
  .forEach(init);
