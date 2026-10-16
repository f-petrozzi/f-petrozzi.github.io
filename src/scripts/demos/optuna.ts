import {
  trials,
  history,
  importance,
  bestTrial,
} from "../../data/demos/optuna";
function init(root: HTMLElement) {
  let count = trials.length,
    timer: ReturnType<typeof setTimeout> | undefined,
    playing = false,
    visible = true;
  const play = root.querySelector<HTMLButtonElement>("[data-play]")!;
  const step = root.querySelector<HTMLButtonElement>("[data-step]")!;
  function stop() {
    clearTimeout(timer);
    playing = false;
    play.textContent = "Play";
    play.setAttribute("aria-pressed", "false");
  }
  function render() {
    const rows = trials.slice(0, count),
      best = bestTrial(rows)!;
    root.querySelector("[data-best]")!.textContent = best.loss.toFixed(4);
    root.querySelector("[data-status]")!.textContent =
      `${count} / ${trials.length} trials; ${rows.filter((t) => t.state === "pruned").length} pruned; Best trial #${best.number}`;
    root.querySelector("[data-config]")!.innerHTML = [
      `${best.width} units`,
      `Dropout ${best.dropout.toFixed(2)}`,
      `Learning rate ${best.learningRate.toPrecision(2)}`,
      best.optimizer,
    ]
      .map((value) => `<span>${value}</span>`)
      .join("");
    const chart = root.querySelector<HTMLElement>("[data-history]")!;
    const width = Math.max(210, chart.clientWidth);
    const height = Math.max(250, chart.clientHeight);
    const bottom = height - 46;
    const x = (n: number) =>
      36 + ((n - 1) / (trials.length - 1)) * (width - 52);
    const y = (loss: number) => bottom - ((loss - 0.3) / 0.35) * (bottom - 36);
    const points = history(rows).filter((p) => p.best !== null);
    const line = points
      .map(
        (p, i) => `${i ? "H" : "M"}${x(p.number)}${i ? "V" : ","}${y(p.best!)}`,
      )
      .join(" ");
    chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Validation loss by trial. Best completed loss ${best.loss.toFixed(4)} at trial ${best.number}. Crosses indicate pruned intermediate losses."><path class="axis" d="M36 26V${bottom}H${width - 12}"/>${[0.3, 0.4, 0.5, 0.6].map((v) => `<text x="2" y="${y(v) + 4}">${v.toFixed(1)}</text>`).join("")}<text x="36" y="16">Validation loss ↓</text><text x="${width / 2}" y="${height - 4}" text-anchor="middle">Trial</text>${[1, 10, 20, 30].map((n) => `<text x="${x(n)}" y="${bottom + 20}" text-anchor="middle">${n}</text>`).join("")}<path class="series" d="${line}"/>${rows.map((t) => (t.state === "pruned" ? `<path class="axis" d="M${x(t.number) - 4},${y(t.loss) - 4}l8,8m0,-8l-8,8"><title>Trial ${t.number}: pruned, intermediate loss ${t.loss.toFixed(4)}</title></path>` : `<circle class="point" cx="${x(t.number)}" cy="${y(t.loss)}" r="3.5"><title>Trial ${t.number}: ${t.loss.toFixed(4)}</title></circle>`)).join("")}</svg>`;
    const bars = importance(rows);
    const importanceChart =
      root.querySelector<HTMLElement>("[data-importance]")!;
    const barWidth = Math.max(190, importanceChart.clientWidth);
    importanceChart.innerHTML = `<svg viewBox="0 0 ${barWidth} 250" role="img" aria-label="Relative grouped loss variance: ${bars.map((b) => `${b.name} ${(b.value * 100).toFixed(0)}%`).join(", ")}">${bars.map((b, i) => `<text x="0" y="${18 + i * 56}">${b.name}</text><rect class="point" x="0" y="${27 + i * 56}" width="${b.value * (barWidth - 42)}" height="12"/><text x="${barWidth - 3}" y="${38 + i * 56}" text-anchor="end">${(b.value * 100).toFixed(0)}%</text>`).join("")}</svg>`;
    const latest = rows.at(-1)!;
    root.querySelector("[data-latest]")!.textContent =
      `Trial #${latest.number}; ${latest.state}; ${latest.width} units; dropout ${latest.dropout.toFixed(2)}; learning rate ${latest.learningRate.toPrecision(2)}; ${latest.optimizer}; ${latest.state === "pruned" ? "intermediate" : "validation"} loss ${latest.loss.toFixed(4)}`;
    step.disabled = count === trials.length;
  }
  function advance() {
    if (count < trials.length) count++;
    render();
    if (count === trials.length) stop();
  }
  function tick() {
    if (!playing) return;
    advance();
    if (playing)
      timer = setTimeout(
        tick,
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 1400 : 750,
      );
  }
  play.addEventListener("click", () => {
    if (playing) return stop();
    if (!visible || document.hidden) return;
    if (count === trials.length) {
      count = 1;
      render();
    }
    playing = true;
    play.textContent = "Pause";
    play.setAttribute("aria-pressed", "true");
    timer = setTimeout(tick, 750);
  });
  step.addEventListener("click", () => {
    stop();
    advance();
  });
  root.querySelector("[data-reset]")!.addEventListener("click", () => {
    stop();
    count = trials.length;
    render();
  });
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const resize = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 60);
  });
  resize.observe(root.querySelector("[data-history]")!);
  resize.observe(root.querySelector("[data-importance]")!);
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (!visible) stop();
  });
  observer.observe(root);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  window.addEventListener("pagehide", stop);
  render();
}
document.querySelectorAll<HTMLElement>('[data-demo="optuna"]').forEach(init);
