import {
  COLLECTIONS,
  OPERATIONS,
  STATUSES,
  createDb,
  markPaid,
  pipelineText,
  runOperation,
  saveAppointment,
  shell,
  totalOf,
  type CollectionName,
  type Db,
  type Doc,
  type OperationId,
  type WriteResult,
} from "../../data/demos/mongodb";

const NEW = "";
const DEFAULT_DATE = "2025-04-22";
const MONEY = new Set(["revenue", "amount"]);
const PREVIEW = 3;

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const flat = (doc: Doc) =>
  `{ ${Object.entries(doc)
    .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(", ")} }`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function option(value: string, label: string, selected = false) {
  const o = el("option", undefined, label);
  o.value = value;
  o.selected = selected;
  return o;
}

function init(root: HTMLElement) {
  const $ = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const opButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-op]")];
  const collButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-coll]"),
  ];
  const queryPanel = $("[data-panel='query']");
  const formPanel = $("[data-panel='appointment']");
  const title = $(".mg-title");
  const command = $(".mg-command code");
  const resultBox = $(".mg-result");
  const total = $(".mg-total");
  const stagesBox = $(".mg-stages");
  const docsBox = $(".mg-docs");
  const collCount = $(".mg-count");
  const log = $(".mg-log");
  const logCode = $(".mg-log code");
  const form = $<HTMLFormElement>(".mg-form");
  const apptSelect = $<HTMLSelectElement>("[name=appointment]");
  const patientSelect = $<HTMLSelectElement>("[name=patient]");
  const doctorSelect = $<HTMLSelectElement>("[name=doctor]");
  const dateInput = $<HTMLInputElement>("[name=date]");
  const statusSelect = $<HTMLSelectElement>("[name=status]");
  const reasonInput = $<HTMLInputElement>("[name=reason]");
  const saveButton = $<HTMLButtonElement>(".mg-save");
  const errorBox = $(".mg-error");

  let db: Db = createDb();
  let op: OperationId = "revenue";
  let coll: CollectionName = "billing";
  let touched = new Set<string>();
  let commands: string[] = [];

  function fillSelects() {
    const keep = {
      appt: apptSelect.value,
      patient: patientSelect.value,
      doctor: doctorSelect.value,
      status: statusSelect.value,
    };
    apptSelect.replaceChildren(
      option(NEW, "New appointment"),
      ...db.appointments.map((a) => {
        const patient = db.patients.find((p) => p._id === a.patientId)!;
        return option(a._id, `${a._id} · ${patient.name} · ${a.date}`);
      }),
    );
    apptSelect.value = db.appointments.some((a) => a._id === keep.appt)
      ? keep.appt
      : NEW;
    patientSelect.replaceChildren(
      ...db.patients.map((p) => option(p._id, p.name)),
    );
    doctorSelect.replaceChildren(
      ...db.doctors.map((d) => option(d._id, `${d.name} · ${d.specialty}`)),
    );
    statusSelect.replaceChildren(...STATUSES.map((s) => option(s, s)));
    if (keep.patient) patientSelect.value = keep.patient;
    if (keep.doctor) doctorSelect.value = keep.doctor;
    if (keep.status) statusSelect.value = keep.status;
  }

  function loadForm() {
    const doc = db.appointments.find((a) => a._id === apptSelect.value);
    patientSelect.value = doc?.patientId ?? db.patients[0]._id;
    doctorSelect.value = doc?.doctorId ?? db.doctors[0]._id;
    dateInput.value = doc?.date ?? DEFAULT_DATE;
    statusSelect.value = doc?.status ?? "scheduled";
    reasonInput.value = doc?.reason ?? "";
    saveButton.textContent = doc ? "Update appointment" : "Insert appointment";
    errorBox.textContent = "";
  }

  function renderResult() {
    const id = op as Exclude<OperationId, "appointment">;
    const run = runOperation(db, id);
    command.textContent = pipelineText(run.collection, run.pipeline);

    const columns = Object.keys(run.result[0] ?? {});
    const table = el("table");
    const head = el("tr");
    columns.forEach((c) => {
      const th = el(
        "th",
        MONEY.has(c) || c === "count" || c === "invoices" ? "is-num" : "",
        c,
      );
      th.scope = "col";
      head.append(th);
    });
    if (id === "outstanding") head.append(el("th"));
    const thead = el("thead");
    thead.append(head);
    table.append(thead);
    const body = el("tbody");
    run.result.forEach((doc) => {
      const tr = el("tr");
      columns.forEach((c) => {
        const v = doc[c];
        tr.append(
          el(
            "td",
            typeof v === "number" ? "is-num" : "",
            MONEY.has(c) ? money(v) : String(v),
          ),
        );
      });
      if (id === "outstanding") {
        const td = el("td", "is-action");
        const button = el("button", "mg-pay", "Mark paid");
        button.type = "button";
        button.dataset.pay = doc._id;
        button.setAttribute("aria-label", `Mark invoice ${doc._id} paid`);
        td.append(button);
        tr.append(td);
      }
      body.append(tr);
    });
    table.append(body);
    resultBox.replaceChildren(table);

    const totals: Record<string, string> = {
      revenue: `Paid revenue ${money(totalOf(run.result, "revenue"))}`,
      statuses: `${totalOf(run.result, "count")} appointments`,
      outstanding: run.result.length
        ? `Outstanding ${money(totalOf(run.result, "amount"))}`
        : "No outstanding invoices",
    };
    total.textContent = totals[id];

    stagesBox.replaceChildren(
      ...run.stages.map(({ stage, output }, i) => {
        const last = i === run.stages.length - 1;
        const details = el("details", "mg-stage");
        details.open = true;
        const summary = el("summary");
        summary.append(
          el("span", "mg-n", String(i + 1)),
          el("code", "mg-op", Object.keys(stage)[0]),
          el(
            "span",
            "mg-docs-count",
            `${output.length} ${output.length === 1 ? "doc" : "docs"}`,
          ),
        );
        const input = el("pre", "mg-stage-json");
        input.textContent = shell(stage);
        const out = el("pre", "mg-stage-out");
        const shown = last ? output : output.slice(0, PREVIEW);
        out.textContent =
          shown.map(flat).join("\n") +
          (shown.length < output.length
            ? `\n... ${output.length - shown.length} more`
            : "");
        if (!output.length) out.textContent = "(no documents)";
        details.append(summary, input, out);
        return details;
      }),
    );
  }

  function renderDocs() {
    collButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.coll === coll)),
    );
    collCount.textContent = `${db[coll].length} documents`;
    docsBox.replaceChildren(
      ...db[coll].map((doc) => {
        const line = el("div", "mg-doc", flat(doc));
        if (touched.has(`${coll}:${doc._id}`)) line.classList.add("is-hit");
        return line;
      }),
    );
  }

  function render() {
    const label = OPERATIONS.find((o) => o.id === op)!.label;
    title.textContent = label;
    opButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.op === op)),
    );
    const isForm = op === "appointment";
    queryPanel.hidden = isForm;
    formPanel.hidden = !isForm;
    if (isForm) fillSelects();
    else renderResult();
    log.hidden = commands.length === 0;
    logCode.textContent = commands.join("\n");
    renderDocs();
  }

  function applyWrite(result: WriteResult) {
    if (!result.ok) {
      errorBox.textContent = result.error ?? "";
      return false;
    }
    errorBox.textContent = "";
    commands = result.commands;
    touched = new Set(result.touched.map((t) => `${t.collection}:${t.id}`));
    coll = result.touched[0]?.collection ?? coll;
    return true;
  }

  opButtons.forEach((b) =>
    b.addEventListener("click", () => {
      op = b.dataset.op as OperationId;
      if (op === "appointment") {
        coll = "appointments";
        fillSelects();
        loadForm();
      } else if (op === "outstanding" || op === "revenue") coll = "billing";
      else coll = "appointments";
      render();
    }),
  );
  collButtons.forEach((b) =>
    b.addEventListener("click", () => {
      coll = b.dataset.coll as CollectionName;
      renderDocs();
    }),
  );
  apptSelect.addEventListener("change", loadForm);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const wasNew = apptSelect.value === NEW;
    const result = saveAppointment(db, {
      id: apptSelect.value || undefined,
      patientId: patientSelect.value,
      doctorId: doctorSelect.value,
      date: dateInput.value,
      status: statusSelect.value,
      reason: reasonInput.value,
    });
    if (!applyWrite(result)) return;
    fillSelects();
    if (wasNew) apptSelect.value = NEW;
    loadForm();
    render();
  });
  queryPanel.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-pay]",
    );
    if (!button) return;
    if (!applyWrite(markPaid(db, button.dataset.pay!))) return;
    coll = "billing";
    render();
  });
  $<HTMLButtonElement>(".mg-reset").addEventListener("click", () => {
    db = createDb();
    op = "revenue";
    coll = "billing";
    touched = new Set();
    commands = [];
    fillSelects();
    loadForm();
    render();
  });

  fillSelects();
  loadForm();
  render();
}

document.querySelectorAll<HTMLElement>('[data-demo="mongodb"]').forEach(init);
