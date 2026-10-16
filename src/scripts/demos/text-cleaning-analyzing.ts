import {
  EXCERPT,
  STEPS,
  movingAverage,
  runPipeline,
  type Pipeline,
  type Span,
  type StepId,
} from "../../data/demos/text-cleaning-analyzing";

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

function paint(pre: HTMLElement, text: string, spans: Span[]) {
  const frag = document.createDocumentFragment();
  let pos = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start < pos || s.end <= s.start) continue;
    if (s.start > pos) frag.append(text.slice(pos, s.start));
    const mark = document.createElement("mark");
    mark.className = "tc-hit";
    mark.textContent = text.slice(s.start, s.end);
    frag.append(mark);
    pos = s.end;
  }
  frag.append(text.slice(pos));
  pre.replaceChildren(frag);
}

function topWords(p: Pipeline) {
  const max = p.top[0]?.count ?? 1;
  return p.top
    .map(
      (w) =>
        `<li><span class="tc-word">${esc(w.word)}</span><span class="tc-bar"><i style="width:${((w.count / max) * 100).toFixed(1)}%"></i></span><span class="tc-count">${w.count}</span></li>`,
    )
    .join("");
}

function lengthChart(p: Pipeline) {
  const W = 640,
    H = 210,
    L = 34,
    R = 8,
    T = 10,
    B = 26;
  const n = p.lengths.length;
  if (!n) return "";
  const raw = Math.max(...p.lengths.map((l) => l.words), 1);
  const top = Math.max(10, Math.ceil(raw / 10) * 10);
  const pw = W - L - R,
    ph = H - T - B;
  const step = pw / n;
  const y = (v: number) => T + ph - (v / top) * ph;
  const grid = [0, top / 2, top]
    .map(
      (v) =>
        `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="tc-grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="tc-axis">${v}</text>`,
    )
    .join("");
  const bars = p.lengths
    .map((l, i) => {
      const h = Math.max(1, (l.words / top) * ph);
      return `<rect class="tc-s${l.chapter % 3}" x="${(L + i * step + 0.4).toFixed(2)}" y="${(T + ph - h).toFixed(2)}" width="${Math.max(1, step - 0.8).toFixed(2)}" height="${h.toFixed(2)}"><title>${esc(p.labels[l.chapter])}, ${p.lengthUnit} ${i + 1}: ${l.words} words</title></rect>`;
    })
    .join("");
  const avg = movingAverage(
    p.lengths.map((l) => l.words),
    7,
  )
    .map((v, i) => `${(L + (i + 0.5) * step).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const labels = p.labels
    .map((label, c) => {
      const idx = p.lengths
        .map((l, i) => (l.chapter === c ? i : -1))
        .filter((i) => i >= 0);
      if (!idx.length) return "";
      const mid = L + ((idx[0] + idx.at(-1)! + 1) / 2) * step;
      return `<text x="${mid.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="tc-axis">${esc(label)}</text>`;
    })
    .join("");
  const cuts = p.lengths
    .map((l, i) =>
      i && p.lengths[i - 1].chapter !== l.chapter
        ? `<line x1="${(L + i * step).toFixed(1)}" x2="${(L + i * step).toFixed(1)}" y1="${T}" y2="${T + ph}" class="tc-cut"/>`
        : "",
    )
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Words per ${p.lengthUnit}: ${n} bars, mean ${p.totals.meanLength.toFixed(1)}, longest ${p.totals.longest}">${grid}${cuts}${bars}<polyline points="${avg}" class="tc-avg"/>${labels}</svg>`;
}

function matrix(p: Pipeline) {
  if (p.similarity.length < 2) return "";
  const head = p.labels.map((l) => `<th scope="col">${esc(l)}</th>`).join("");
  const rows = p.similarity
    .map(
      (row, i) =>
        `<tr><th scope="row">${esc(p.labels[i])}</th>${row
          .map((v) => {
            const a = Math.round(10 + Math.sqrt(v) * 35);
            return `<td style="background:color-mix(in srgb, var(--accent) ${a}%, transparent)">${v.toFixed(2)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  return `<table><thead><tr><td></td>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function init(root: HTMLElement) {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const enabled = {} as Record<StepId, boolean>;
  let selected = 0;
  const reset = () => {
    STEPS.forEach((s) => (enabled[s.id] = true));
    selected = 0;
  };
  reset();

  const list = q<HTMLOListElement>("[data-steps]");
  const rows = STEPS.map((s, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" class="tc-switch" aria-pressed="true" aria-label="Run step: ${esc(s.label)}"><span></span></button><button type="button" class="tc-step"><b>${i + 1}</b><span>${esc(s.label)}</span><em></em></button>`;
    list.append(li);
    const [toggle, pick] = li.querySelectorAll("button");
    toggle.addEventListener("click", () => {
      enabled[s.id] = !enabled[s.id];
      render();
    });
    pick.addEventListener("click", () => {
      selected = i;
      render();
    });
    return { li, toggle, pick, count: li.querySelector("em")! };
  });

  const detailTitle = q("[data-detail-title]");
  const patterns = q("[data-patterns]");
  const state = q("[data-state]");
  const before = q("[data-before]");
  const after = q("[data-after]");
  const prev = q<HTMLButtonElement>("[data-prev]");
  const next = q<HTMLButtonElement>("[data-next]");
  const summary = q("[data-summary]");
  const topEl = q("[data-top]");
  const chart = q("[data-lengths]");
  const sim = q("[data-matrix]");
  const simBox = q("[data-matrix-box]");
  const unit = q("[data-length-unit]");

  function render() {
    const p = runPipeline(EXCERPT, enabled);
    p.steps.forEach((s, i) => {
      const row = rows[i];
      row.toggle.setAttribute("aria-pressed", String(s.enabled));
      row.li.classList.toggle("is-off", !s.enabled);
      row.pick.setAttribute("aria-current", String(i === selected));
      row.count.textContent = s.enabled ? `${s.matches}` : "off";
    });
    const step = p.steps[selected];
    detailTitle.textContent = `${selected + 1}. ${step.label}`;
    patterns.replaceChildren(
      ...step.patterns.map((pat) => {
        const code = document.createElement("code");
        code.textContent = pat;
        return code;
      }),
    );
    state.textContent = step.enabled
      ? `${step.matches} ${step.unit}`
      : "Skipped";
    paint(before, step.before, step.beforeSpans);
    paint(after, step.after, step.afterSpans);
    prev.disabled = selected === 0;
    next.disabled = selected === STEPS.length - 1;

    const t = p.totals;
    summary.textContent =
      `${t.chapters || 1} ${t.chapters > 1 ? "chapters" : "chapter"} · ` +
      `${t.units} ${p.lengthUnit}s · ${t.tokens} words · ${t.vocabulary} unique`;
    topEl.innerHTML = topWords(p);
    unit.textContent = `Words per ${p.lengthUnit}`;
    chart.innerHTML = lengthChart(p);
    const html = matrix(p);
    sim.innerHTML = html;
    simBox.hidden = !html;
  }

  prev.addEventListener("click", () => {
    selected = Math.max(0, selected - 1);
    render();
  });
  next.addEventListener("click", () => {
    selected = Math.min(STEPS.length - 1, selected + 1);
    render();
  });
  q("[data-reset]").addEventListener("click", () => {
    reset();
    render();
  });
  render();
}

document
  .querySelectorAll<HTMLElement>('[data-demo="text-cleaning-analyzing"]')
  .forEach(init);
