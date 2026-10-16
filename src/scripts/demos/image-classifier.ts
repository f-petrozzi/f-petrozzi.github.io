import {
  conditions,
  models,
  examples,
  probabilities,
  evaluation,
  metrics,
} from "../../data/demos/image-classifier";
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
function init(root: HTMLElement) {
  let selected = 0;
  const condition = root.querySelector<HTMLSelectElement>("select")!;
  function update() {
    const c = Number(condition.value);
    root
      .querySelectorAll<HTMLButtonElement>("[data-image]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(Number(b.dataset.image) === selected),
        ),
      );
    root.querySelector("[data-selected]")!.textContent =
      `${examples[selected].title} · Assigned labels: ${conditions.filter((_, i) => examples[selected].labels[i]).join(", ") || "none of these conditions"}`;
    root.querySelectorAll<HTMLElement>("[data-model]").forEach((panel, m) => {
      const values = probabilities(m, selected),
        counts = evaluation[m][c],
        result = metrics(counts);
      panel.querySelector("[data-probabilities]")!.innerHTML =
        `<svg viewBox="0 0 430 175" role="img" aria-label="${models[m]} independent probabilities: ${conditions.map((name, i) => `${name} ${pct(values[i])}`).join(", ")}">${conditions.map((name, i) => `<text x="2" y="${30 + i * 45}">${name}</text><rect class="point" x="110" y="${16 + i * 45}" width="${values[i] * 250}" height="20"/><text x="${118 + values[i] * 250}" y="${30 + i * 45}">${pct(values[i])}</text>`).join("")}<text x="110" y="165">0%</text><text x="335" y="165">100%</text></svg>`;
      panel.querySelector("[data-matrix]")!.innerHTML =
        `<table><caption>${conditions[c]} · threshold 50% · 100 cases</caption><thead><tr><th scope="col">Actual / predicted</th><th scope="col">Positive</th><th scope="col">Negative</th></tr></thead><tbody><tr><th scope="row">Positive</th><td>${counts.tp} TP</td><td>${counts.fn} FN</td></tr><tr><th scope="row">Negative</th><td>${counts.fp} FP</td><td>${counts.tn} TN</td></tr></tbody></table>`;
      panel.querySelector("[data-metrics]")!.textContent =
        `Accuracy ${pct(result.accuracy)} · Recall ${pct(result.recall)}`;
    });
  }
  root.querySelectorAll<HTMLButtonElement>("[data-image]").forEach((button) =>
    button.addEventListener("click", () => {
      selected = Number(button.dataset.image);
      update();
    }),
  );
  condition.addEventListener("change", update);
  root.querySelector("[data-reset]")!.addEventListener("click", () => {
    selected = 0;
    condition.value = "0";
    update();
  });
  update();
}
document
  .querySelectorAll<HTMLElement>('[data-demo="image-classifier"]')
  .forEach(init);
