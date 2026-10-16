import {
  observations,
  predictorNames,
  regress,
  solveProduction,
} from "../../data/demos/business-statistics";
function init(root: HTMLElement) {
  const labor = root.querySelector<HTMLInputElement>('[name="labor"]')!,
    material = root.querySelector<HTMLInputElement>('[name="material"]')!;
  function regression() {
    const selected = [
      ...root.querySelectorAll<HTMLInputElement>("[data-predictor]:checked"),
    ].map((el) => Number(el.value));
    const result = regress(observations, selected);
    root.querySelector("[data-r2]")!.textContent = result.r2.toFixed(3);
    root.querySelector("[data-coefficients]")!.innerHTML = [
      "Intercept",
      ...selected.map((i) => predictorNames[i]),
    ]
      .map(
        (name, i) =>
          `<tr><th scope="row">${name}</th><td>${result.coefficients[i].toFixed(2)}</td></tr>`,
      )
      .join("");
    const min = Math.min(...result.fitted) - 1000,
      max = Math.max(...result.fitted) + 1000;
    const extent = Math.max(1000, ...result.residuals.map(Math.abs)) * 1.15;
    const x = (v: number) => 60 + ((v - min) / (max - min)) * 460,
      y = (v: number) => 115 - (v / extent) * 80;
    root.querySelector("[data-residuals]")!.innerHTML =
      `<svg viewBox="0 0 560 270" role="img" aria-label="Residuals versus fitted charges for ${observations.length} observations. R squared ${result.r2.toFixed(3)}"><path class="axis" d="M60 25V210H530M60 115H530"/><text x="60" y="16">Residual ($)</text><text x="10" y="40">${(extent / 1000).toFixed(0)}k</text><text x="30" y="119">0</text><text x="6" y="200">−${(extent / 1000).toFixed(0)}k</text><text x="60" y="230">${(min / 1000).toFixed(0)}k</text><text x="490" y="230">${(max / 1000).toFixed(0)}k</text><text x="210" y="255">Fitted charges ($)</text>${result.fitted.map((v, i) => `<circle class="point" cx="${x(v)}" cy="${y(result.residuals[i])}" r="4"><title>Case ${i + 1}: fitted $${v.toFixed(0)}, residual $${result.residuals[i].toFixed(0)}</title></circle>`).join("")}</svg>`;
  }
  function production() {
    const l = Number(labor.value),
      m = Number(material.value),
      result = solveProduction(l, m);
    root.querySelector("[data-labor]")!.textContent = `${l} hours`;
    root.querySelector("[data-material]")!.textContent = `${m} units`;
    root.querySelector("[data-profit]")!.textContent =
      `$${result.profit.toFixed(2)}`;
    root.querySelector("[data-optimum]")!.textContent =
      `A = ${result.optimum.x.toFixed(2)}, B = ${result.optimum.y.toFixed(2)}; Labor ${result.laborUsed.toFixed(1)} / ${l}; Material ${result.materialUsed.toFixed(1)} / ${m}`;
    const x = (v: number) => 45 + (v / 60) * 440,
      y = (v: number) => 245 - (v / 60) * 210;
    // Clip each constraint to the visible 60 × 60 plot.
    const boundary = (a: number, b: number, c: number) => {
      const points = [
        { x: 0, y: c / b },
        { x: 60, y: (c - a * 60) / b },
        { x: c / a, y: 0 },
        { x: (c - b * 60) / a, y: 60 },
      ].filter((p) => p.x >= 0 && p.x <= 60 && p.y >= 0 && p.y <= 60);
      return points.length >= 2
        ? `M${x(points[0].x)},${y(points[0].y)}L${x(points[1].x)},${y(points[1].y)}`
        : "";
    };
    root.querySelector("[data-region]")!.innerHTML =
      `<svg viewBox="0 0 540 300" role="img" aria-label="Feasible production region. Optimum A ${result.optimum.x.toFixed(2)}, B ${result.optimum.y.toFixed(2)}, profit ${result.profit.toFixed(2)} dollars."><path class="axis" d="M45 25V245H495"/><polygon class="region" points="${result.vertices.map((p) => `${x(p.x)},${y(p.y)}`).join(" ")}"/><path class="series" d="${boundary(2, 1, l)}"/><path class="axis material" d="${boundary(1, 2, m)}"/>${[0, 20, 40, 60].map((v) => `<text x="${x(v)}" y="266">${v}</text><text x="14" y="${y(v) + 4}">${v}</text>`).join("")}<circle class="point" cx="${x(result.optimum.x)}" cy="${y(result.optimum.y)}" r="6"/><text x="45" y="16">Product B</text><text x="220" y="292">Product A</text></svg>`;
  }
  root
    .querySelectorAll<HTMLInputElement>("[data-predictor]")
    .forEach((el) => el.addEventListener("change", regression));
  let redraw: ReturnType<typeof setTimeout> | undefined;
  const scheduleProduction = () => {
    root.querySelector("[data-labor]")!.textContent = `${labor.value} hours`;
    root.querySelector("[data-material]")!.textContent =
      `${material.value} units`;
    clearTimeout(redraw);
    redraw = setTimeout(production, 60);
  };
  labor.addEventListener("input", scheduleProduction);
  material.addEventListener("input", scheduleProduction);
  root.querySelector("[data-reset]")!.addEventListener("click", () => {
    clearTimeout(redraw);
    root.querySelector<HTMLFormElement>("form")!.reset();
    regression();
    production();
  });
  regression();
  production();
}
document
  .querySelectorAll<HTMLElement>('[data-demo="business-statistics"]')
  .forEach(init);
