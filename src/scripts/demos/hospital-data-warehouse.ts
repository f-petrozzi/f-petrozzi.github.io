import {
  DEFAULT_OPTIONS,
  QUERY_LIST,
  formatValue,
  runQuery,
  type HistoryMode,
  type Options,
  type Quarter,
  type QueryId,
  type QueryResult,
} from "../../data/demos/hospital-data-warehouse";

const KEYWORDS =
  /\b(SELECT|FROM|JOIN|ON|WHERE|GROUP BY|ORDER BY|AS|COUNT|SUM|AVG|DESC|AND)\b/g;

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

function highlight(sql: string) {
  return escapeHtml(sql).replace(KEYWORDS, '<span class="hw-kw">$1</span>');
}

function chartHtml(result: QueryResult, metricKey: string) {
  const metric = result.metrics.find((m) => m.key === metricKey)!;
  const values = result.rows.map((r) => Number(r[metric.key]));
  const max = Math.max(...values, 1);
  return result.rows
    .map((r, i) => {
      const width = Math.max(0, (values[i] / max) * 100);
      const label = escapeHtml(String(r[result.labelKey]));
      const value = escapeHtml(formatValue(values[i], metric.format));
      return `<div class="hw-c-row"><div class="hw-c-heading"><span class="hw-c-label">${label}</span><span class="hw-c-value">${value}</span></div><div class="hw-c-track" aria-hidden="true"><i class="hw-c-bar" style="width:${width.toFixed(2)}%"></i></div></div>`;
    })
    .join("");
}

function init(root: HTMLElement) {
  const $ = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const queryButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-query]"),
  ];
  const modeButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-mode]"),
  ];
  const quarterSelect = $<HTMLSelectElement>(".hw-quarter");
  const changeSelect = $<HTMLSelectElement>(".hw-change");
  const sqlBox = $<HTMLElement>(".hw-sql code");
  const title = $<HTMLElement>(".hw-title");
  const tableWrap = $<HTMLElement>(".hw-table");
  const chartWrap = $<HTMLElement>(".hw-chart");

  let query: QueryId = QUERY_LIST[0].id;
  let options: Options = { ...DEFAULT_OPTIONS };
  let metric = "";

  function renderTable(result: QueryResult) {
    const head = result.columns
      .map((c) => {
        const numeric = c.format && c.format !== "text";
        return `<th scope="col"${numeric ? ' class="is-num"' : ""}>${escapeHtml(c.label)}</th>`;
      })
      .join("");
    const body = result.rows
      .map(
        (r) =>
          `<tr>${result.columns
            .map((c) => {
              const numeric = c.format && c.format !== "text";
              return `<td${numeric ? ' class="is-num"' : ""}>${escapeHtml(formatValue(r[c.key], c.format))}</td>`;
            })
            .join("")}</tr>`,
      )
      .join("");
    tableWrap.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  const metricButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-metric]"),
  ];
  function renderMetrics(result: QueryResult) {
    if (!result.metrics.some((m) => m.key === metric))
      metric = result.metrics[0].key;
    metricButtons.forEach((button, i) => {
      const m = result.metrics[i];
      button.hidden = !m;
      if (!m) return;
      button.textContent = m.label;
      button.dataset.key = m.key;
      button.setAttribute("aria-pressed", String(m.key === metric));
    });
  }
  metricButtons.forEach((button) =>
    button.addEventListener("click", () => {
      metric = button.dataset.key!;
      render();
    }),
  );

  function render() {
    const result = runQuery(query, options);
    const label = QUERY_LIST.find((q) => q.id === query)!.label;
    title.textContent = label;
    queryButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.query === query)),
    );
    root
      .querySelectorAll<HTMLElement>("[data-option]")
      .forEach((el) => (el.hidden = el.dataset.option !== query));
    modeButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === options.mode)),
    );
    quarterSelect.value = options.quarter;
    changeSelect.value = options.changeDate;
    sqlBox.innerHTML = highlight(result.sql);
    renderTable(result);
    renderMetrics(result);
    chartWrap.innerHTML = chartHtml(result, metric);
    root.querySelectorAll<SVGGElement>("[data-table]").forEach((node) => {
      node.classList.toggle(
        "is-on",
        result.tables.includes(node.dataset.table as never),
      );
    });
    root.querySelectorAll<SVGLineElement>("[data-edge]").forEach((edge) => {
      const [a, b] = edge.dataset.edge!.split("|");
      edge.classList.toggle(
        "is-on",
        result.joins.some(([x, y]) => x === a && y === b),
      );
    });
  }

  queryButtons.forEach((b) =>
    b.addEventListener("click", () => {
      query = b.dataset.query as QueryId;
      metric = "";
      render();
    }),
  );
  quarterSelect.addEventListener("change", () => {
    options = { ...options, quarter: quarterSelect.value as Quarter };
    render();
  });
  changeSelect.addEventListener("change", () => {
    options = { ...options, changeDate: changeSelect.value };
    render();
  });
  modeButtons.forEach((b) =>
    b.addEventListener("click", () => {
      options = { ...options, mode: b.dataset.mode as HistoryMode };
      render();
    }),
  );
  $<HTMLButtonElement>(".hw-reset").addEventListener("click", () => {
    query = QUERY_LIST[0].id;
    options = { ...DEFAULT_OPTIONS };
    metric = "";
    render();
  });

  render();
}

document
  .querySelectorAll<HTMLElement>('[data-demo="hospital-data-warehouse"]')
  .forEach(init);
