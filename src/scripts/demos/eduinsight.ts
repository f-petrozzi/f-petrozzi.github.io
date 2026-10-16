import {
  PROGRAMS,
  TERMS,
  benchmark,
  byProgram,
  filterRecords,
  gpaDistribution,
  loadEnrollments,
  sortRecords,
  validateDraft,
  type Draft,
  type Enrollment,
  type Errors,
  type Filters,
} from "../../data/demos/eduinsight";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const FIELDS: { key: keyof Draft; label: string }[] = [
  { key: "student", label: "Student" },
  { key: "program", label: "Program" },
  { key: "term", label: "Term" },
  { key: "gpa", label: "GPA" },
  { key: "enrolled", label: "Enrollment date" },
];

// Bar with rounded data end, flat at the baseline.
function hBar(x: number, y: number, w: number, h: number, r: number) {
  if (w <= 0) return "";
  const rr = Math.min(r, w, h / 2);
  return `M${x} ${y}h${w - rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h - 2 * rr}a${rr} ${rr} 0 0 1 -${rr} ${rr}h-${w - rr}z`;
}
function vBar(x: number, base: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  const rr = Math.min(r, h, w / 2);
  return `M${x} ${base}v-${h - rr}a${rr} ${rr} 0 0 1 ${rr} -${rr}h${w - 2 * rr}a${rr} ${rr} 0 0 1 ${rr} ${rr}v${h - rr}z`;
}

function init(root: HTMLElement) {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const main = q<HTMLElement>("[data-main]");
  const status = q<HTMLElement>("[data-status]");
  const programFilter = q<HTMLSelectElement>("[data-filter-program]");
  const termFilter = q<HTMLSelectElement>("[data-filter-term]");
  const createBtn = q<HTMLButtonElement>("[data-create]");
  const chartPrograms = q<HTMLElement>("[data-chart-programs]");
  const chartGpa = q<HTMLElement>("[data-chart-gpa]");
  const bench = q<HTMLElement>("[data-bench]");

  let rows: Enrollment[] = loadEnrollments();
  let nextId = rows.length + 1;
  let filters: Filters = { program: "", term: "" };
  let form: { id: number | null; draft: Draft; errors: Errors } | null = null;

  const visible = () => sortRecords(filterRecords(rows, filters));

  function renderList() {
    const list = visible();
    const body = list
      .map(
        (r) =>
          `<tr><td>${esc(r.student)}</td><td>${esc(r.program)}</td><td>${esc(r.term)}</td><td class="num">${r.gpa.toFixed(2)}</td><td>${r.enrolled}</td><td><button type="button" class="ei-link" data-edit="${r.id}" aria-label="Edit ${esc(r.student)}">Edit</button></td></tr>`,
      )
      .join("");
    main.innerHTML = `<div class="ei-panel-head"><h2>Index</h2><span>${list.length} of ${rows.length} records</span></div><div class="ei-scroll" tabindex="0" role="region" aria-label="Enrollment records"><table class="ei-table"><thead><tr><th scope="col">Student</th><th scope="col">Program</th><th scope="col">Term</th><th scope="col" class="num">GPA</th><th scope="col">Enrolled</th><th scope="col"><span class="ei-sr">Actions</span></th></tr></thead><tbody>${body || '<tr><td colspan="6" class="ei-none">No records match these filters.</td></tr>'}</tbody></table></div>`;
  }

  function renderForm() {
    const f = form!;
    const err = (k: keyof Draft) => f.errors[k];
    const bad = (k: keyof Draft) =>
      err(k) ? ` aria-invalid="true" aria-describedby="ei-${k}-err"` : "";
    const msg = (k: keyof Draft) =>
      `<span class="ei-field-err" id="ei-${k}-err">${esc(err(k) ?? "")}</span>`;
    const opts = (list: string[], value: string) =>
      `<option value="">Select</option>${list.map((o) => `<option value="${esc(o)}"${o === value ? " selected" : ""}>${esc(o)}</option>`).join("")}`;
    const summary = Object.values(f.errors).length
      ? `<div class="ei-summary" role="alert"><b>Please correct the following.</b><ul>${FIELDS.filter(
          (x) => err(x.key),
        )
          .map((x) => `<li>${esc(err(x.key)!)}</li>`)
          .join("")}</ul></div>`
      : "";
    main.innerHTML = `<div class="ei-panel-head"><h2>${f.id === null ? "Create" : "Edit"}</h2><span>Enrollment</span></div><form class="ei-form" data-form novalidate>${summary}
      <div class="ei-row"><label for="ei-student">Student</label><input id="ei-student" name="student" type="text" autocomplete="off" maxlength="80" value="${esc(f.draft.student)}"${bad("student")}>${msg("student")}</div>
      <div class="ei-row"><label for="ei-program">Program</label><select id="ei-program" name="program"${bad("program")}>${opts(
        PROGRAMS.map((p) => p.name),
        f.draft.program,
      )}</select>${msg("program")}</div>
      <div class="ei-row"><label for="ei-term">Term</label><select id="ei-term" name="term"${bad("term")}>${opts(TERMS, f.draft.term)}</select>${msg("term")}</div>
      <div class="ei-row"><label for="ei-gpa">GPA</label><input id="ei-gpa" name="gpa" type="text" inputmode="decimal" autocomplete="off" value="${esc(f.draft.gpa)}"${bad("gpa")}>${msg("gpa")}</div>
      <div class="ei-row"><label for="ei-enrolled">Enrollment date</label><input id="ei-enrolled" name="enrolled" type="date" value="${esc(f.draft.enrolled)}"${bad("enrolled")}>${msg("enrolled")}</div>
      <div class="ei-actions"><button type="submit" class="ei-btn">Save</button><button type="button" class="ei-link" data-back>Back to List</button></div></form>`;
  }

  function renderCharts(list: Enrollment[]) {
    // Enrollments by program (horizontal bars)
    const progs = byProgram(list);
    const max = Math.max(1, ...progs.map((p) => p.count));
    const rowH = 28;
    const bars = progs
      .map((p, i) => {
        const y = i * rowH;
        const w = Math.round((p.count / max) * 160);
        return `<g><title>${esc(p.program)}: ${p.count}</title><text class="ei-t" x="0" y="${y + 15}">${esc(p.short)}</text><path class="ei-bar" d="${hBar(104, y + 5, w, 12, 4)}"/><text class="ei-v" x="${104 + w + 6}" y="${y + 15}">${p.count}</text></g>`;
      })
      .join("");
    chartPrograms.innerHTML = `<svg viewBox="0 0 320 ${progs.length * rowH}" role="img" aria-label="Enrollments by program: ${progs.map((p) => `${p.program} ${p.count}`).join(", ")}"><line class="ei-axis" x1="104" y1="0" x2="104" y2="${progs.length * rowH}"/>${bars}</svg>`;

    // GPA distribution (columns)
    const dist = gpaDistribution(list);
    const dmax = Math.max(1, ...dist.map((d) => d.count));
    const base = 118;
    const colW = 40;
    const cols = dist
      .map((d, i) => {
        const x = 14 + i * 60;
        const h = Math.round((d.count / dmax) * 88);
        return `<g><title>${d.label}: ${d.count}</title><path class="ei-bar" d="${vBar(x, base, colW, h, 4)}"/><text class="ei-v" x="${x + colW / 2}" y="${base - h - 6}" text-anchor="middle">${d.count}</text><text class="ei-t" x="${x + colW / 2}" y="${base + 16}" text-anchor="middle">${d.label.replace("Under ", "<")}</text></g>`;
      })
      .join("");
    chartGpa.innerHTML = `<svg viewBox="0 0 320 140" role="img" aria-label="GPA distribution: ${dist.map((d) => `${d.label} ${d.count}`).join(", ")}"><line class="ei-axis" x1="6" y1="${base}" x2="314" y2="${base}"/>${cols}</svg>`;

    // Benchmark card
    const b = benchmark(list);
    const scope =
      [filters.program || "All programs", filters.term]
        .filter(Boolean)
        .join(" / ") || "All programs";
    if (!b) {
      bench.innerHTML = `<p class="ei-scope">${esc(scope)}</p><p class="ei-none">No records in this selection.</p>`;
      return;
    }
    const pos = (v: number) =>
      10 + ((Math.min(4, Math.max(2, v)) - 2) / 2) * 300;
    const sign = b.delta >= 0 ? "+" : "−";
    bench.innerHTML = `<p class="ei-scope">${esc(scope)}</p><dl class="ei-stats"><div><dt>Sample average</dt><dd>${b.sample.toFixed(2)}</dd></div><div><dt>Peer average</dt><dd>${b.peer.toFixed(2)}</dd></div><div><dt>Difference</dt><dd>${sign}${Math.abs(b.delta).toFixed(2)}</dd></div></dl><svg viewBox="0 0 320 76" role="img" aria-label="Sample average ${b.sample.toFixed(2)} against peer average ${b.peer.toFixed(2)} on a 2.0 to 4.0 scale"><line class="ei-axis" x1="10" y1="18" x2="310" y2="18"/><line class="ei-axis" x1="10" y1="44" x2="310" y2="44"/><text class="ei-t" x="10" y="70">2.0</text><text class="ei-t" x="160" y="70" text-anchor="middle">3.0</text><text class="ei-t" x="310" y="70" text-anchor="end">4.0</text><circle class="ei-peer" cx="${pos(b.peer).toFixed(1)}" cy="44" r="6"/><circle class="ei-me" cx="${pos(b.sample).toFixed(1)}" cy="18" r="5"/></svg><p class="ei-key"><i class="me"></i>Sample <i class="peer"></i>Peer</p>`;
  }

  function render() {
    if (form) renderForm();
    else renderList();
    renderCharts(visible());
    createBtn.disabled = form !== null;
  }

  function say(text: string) {
    status.textContent = text;
  }

  function open(id: number | null) {
    const r = rows.find((x) => x.id === id);
    form = {
      id,
      errors: {},
      draft: r
        ? {
            student: r.student,
            program: r.program,
            term: r.term,
            gpa: r.gpa.toFixed(2),
            enrolled: r.enrolled,
          }
        : { student: "", program: "", term: "", gpa: "", enrolled: "" },
    };
    say("");
    render();
    q<HTMLInputElement>("#ei-student").focus();
  }

  function close(focusSel: string) {
    form = null;
    render();
    root.querySelector<HTMLElement>(focusSel)?.focus();
  }

  createBtn.addEventListener("click", () => open(null));

  programFilter.addEventListener("change", () => {
    filters = { ...filters, program: programFilter.value };
    render();
    say(`${visible().length} records`);
  });
  termFilter.addEventListener("change", () => {
    filters = { ...filters, term: termFilter.value };
    render();
    say(`${visible().length} records`);
  });

  main.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const edit = t.closest<HTMLElement>("[data-edit]");
    if (edit) open(Number(edit.dataset.edit));
    else if (t.closest("[data-back]")) {
      const id = form?.id;
      close(id ? `[data-edit="${id}"]` : "[data-create]");
    }
  });

  main.addEventListener("input", (ev) => {
    const t = ev.target as HTMLInputElement | HTMLSelectElement;
    if (form && t.name) form.draft[t.name as keyof Draft] = t.value;
  });

  main.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!form) return;
    const res = validateDraft(form.draft);
    if (!res.ok || !res.value) {
      form.errors = res.errors;
      render();
      const first = FIELDS.find((x) => res.errors[x.key]);
      if (first) q<HTMLElement>(`#ei-${first.key}`).focus();
      return;
    }
    const id = form.id ?? nextId++;
    if (form.id === null) rows = [...rows, { id, ...res.value }];
    else rows = rows.map((r) => (r.id === id ? { id, ...res.value! } : r));
    const hidden = filterRecords([{ id, ...res.value }], filters).length === 0;
    if (hidden) {
      filters = { program: "", term: "" };
      programFilter.value = "";
      termFilter.value = "";
    }
    close(`[data-edit="${id}"]`);
    say(`Saved ${res.value.student}.`);
  });

  q<HTMLButtonElement>("[data-reset]").addEventListener("click", () => {
    rows = loadEnrollments();
    nextId = rows.length + 1;
    filters = { program: "", term: "" };
    programFilter.value = "";
    termFilter.value = "";
    form = null;
    render();
    say("");
  });

  render();
}

document
  .querySelectorAll<HTMLElement>('[data-demo="eduinsight"]')
  .forEach(init);
