import {
  RAW_ROWS,
  cleanAll,
  createState,
  deleteReview,
  importCleaned,
  importSql,
  insertReview,
  productStats,
  selectReviews,
  updateReview,
  type CleanResult,
  type ReviewInput,
  type State,
  type Write,
} from "../../data/demos/product-reviews-analysis";

const DEFAULT_DATE = "2025-03-20";

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

// Make stray whitespace in raw strings visible.
function visible(value: string) {
  return value
    .replace(/\n/g, "↵")
    .replace(/\t/g, "⇥")
    .replace(/^ +| +$/g, (m) => "␠".repeat(m.length));
}

function init(root: HTMLElement) {
  const $ = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const viewButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-view]"),
  ];
  const modeButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-mode]"),
  ];
  const productButtons = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-product]"),
  ];
  const minRating = $<HTMLSelectElement>(".pr-min");
  const kind = $(".pr-kind");
  const sqlCode = $(".pr-sql code");
  const tableBox = $(".pr-table");
  const form = $<HTMLFormElement>(".pr-form");
  const formTitle = $(".pr-form-title");
  const productSelect = $<HTMLSelectElement>("[name=product]");
  const reviewerInput = $<HTMLInputElement>("[name=reviewer]");
  const ratingSelect = $<HTMLSelectElement>("[name=rating]");
  const textInput = $<HTMLTextAreaElement>("[name=text]");
  const dateInput = $<HTMLInputElement>("[name=date]");
  const saveButton = $<HTMLButtonElement>(".pr-save");
  const cancelButton = $<HTMLButtonElement>(".pr-cancel");
  const errorBox = $(".pr-error");
  const prepBox = $(".pr-prep-table");
  const prepSql = $(".pr-prep-sql code");
  const importButton = $<HTMLButtonElement>(".pr-import");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  let state: State = createState();
  let view = "reviews";
  let mode = "clean";
  let productId = 0;
  let editing: number | null = null;
  let touched = new Set<number>();
  let statement: Write | null = null;
  const cleaned: CleanResult[] = cleanAll();

  function currentSelect() {
    return selectReviews(state, {
      productId: productId || undefined,
      minRating: Number(minRating.value) || undefined,
    });
  }

  function renderStats() {
    productStats(state).forEach(({ product, count, average }) => {
      const button = productButtons.find(
        (b) => b.dataset.product === String(product.product_id),
      );
      const stat = button?.querySelector<HTMLElement>("[data-stat]");
      if (stat)
        stat.textContent = count ? `${count} / ${average!.toFixed(1)}` : "none";
    });
    const total = $("[data-stat-all]");
    total.textContent = String(state.reviews.length);
  }

  function renderReviews() {
    productButtons.forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.product) === productId),
      ),
    );
    const { sql, rows } = currentSelect();
    kind.textContent = statement?.kind ?? "SELECT";
    sqlCode.textContent = statement ? statement.sql : sql;

    const table = el("table");
    const head = el("tr");
    ["ID", "Product", "Reviewer", "Rating", "Review", "Date", ""].forEach(
      (label, i) => {
        const th = el("th", i === 3 ? "is-num" : "", label);
        th.scope = "col";
        if (!label) th.append(el("span", "pr-sr", "Actions"));
        head.append(th);
      },
    );
    const thead = el("thead");
    thead.append(head);
    const body = el("tbody");
    rows.forEach((r) => {
      const tr = el("tr");
      if (touched.has(r.review_id)) tr.className = "is-hit";
      if (editing === r.review_id) tr.className = "is-editing";
      tr.append(
        el("td", "is-num", String(r.review_id)),
        el("td", "", r.product_name),
        el("td", "", r.reviewer),
        el("td", "is-num", `${r.rating} / 5`),
        el("td", "is-text", r.review_text),
        el("td", "", r.review_date),
      );
      const actions = el("td", "is-actions");
      const edit = el("button", "pr-row-btn", "Edit");
      edit.type = "button";
      edit.dataset.edit = String(r.review_id);
      edit.setAttribute("aria-label", `Edit review ${r.review_id}`);
      const del = el("button", "pr-row-btn is-danger", "Delete");
      del.type = "button";
      del.dataset.delete = String(r.review_id);
      del.setAttribute("aria-label", `Delete review ${r.review_id}`);
      actions.append(edit, del);
      tr.append(actions);
      body.append(tr);
    });
    if (!rows.length) {
      const tr = el("tr");
      const td = el("td", "is-empty", "No reviews match.");
      td.colSpan = 7;
      tr.append(td);
      body.append(tr);
    }
    table.append(thead, body);
    tableBox.replaceChildren(table);
    renderStats();
  }

  function renderPrep() {
    modeButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
    );
    const raw = mode === "raw";
    const table = el("table");
    const head = el("tr");
    [
      "Product ID",
      "Reviewer",
      "Rating",
      "Review text",
      "Date",
      raw ? "" : "Result",
    ].forEach((label) => {
      const th = el("th", "", label);
      th.scope = "col";
      if (!label) th.append(el("span", "pr-sr", "Result"));
      head.append(th);
    });
    const thead = el("thead");
    thead.append(head);
    const body = el("tbody");
    RAW_ROWS.forEach((r, i) => {
      const c = cleaned[i];
      const tr = el("tr");
      if (!raw && !c.ok) tr.className = "is-skipped";
      const cell = (
        rawValue: string,
        cleanValue: string,
        changed: boolean,
        cls = "",
      ) => {
        const td = el("td", cls);
        if (raw) {
          td.classList.add("is-raw");
          td.textContent = visible(rawValue);
        } else {
          td.textContent = c.ok ? cleanValue : visible(rawValue);
          if (c.ok && changed) td.classList.add("is-changed");
        }
        return td;
      };
      const row = c.row;
      tr.append(
        cell(r.product_id, String(row?.product_id ?? ""), c.changes.product_id),
        cell(r.reviewer, row?.reviewer ?? "", c.changes.reviewer),
        cell(r.rating, String(row?.rating ?? ""), c.changes.rating),
        cell(
          r.review_text,
          row?.review_text ?? "",
          c.changes.review_text,
          "is-text",
        ),
        cell(r.review_date, row?.review_date ?? "", c.changes.review_date),
      );
      if (!raw) {
        const td = el("td", "is-result");
        if (c.ok) {
          if (c.labels.length)
            c.labels.forEach((l) => td.append(el("span", "pr-chip", l)));
          else td.append(el("span", "pr-chip", "ready"));
        } else td.append(el("span", "pr-chip is-bad", `Skipped: ${c.error}`));
        tr.append(td);
      }
      body.append(tr);
    });
    table.append(thead, body);
    prepBox.replaceChildren(table);
    const rows = cleaned.filter((c) => c.ok).map((c) => c.row!);
    prepSql.textContent = raw ? "" : importSql(rows);
    prepSql.parentElement!.hidden = raw;
    importButton.disabled = state.imported;
    importButton.textContent = state.imported
      ? "Imported"
      : `Import ${rows.length} rows`;
    importButton.hidden = raw;
  }

  function resetForm() {
    editing = null;
    productSelect.value = String(state.products[0].product_id);
    reviewerInput.value = "";
    ratingSelect.value = "5";
    textInput.value = "";
    dateInput.value = DEFAULT_DATE;
    formTitle.textContent = "Add review";
    saveButton.textContent = "Add review";
    cancelButton.hidden = true;
    errorBox.textContent = "";
  }

  function render() {
    viewButtons.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.view === view)),
    );
    root
      .querySelectorAll<HTMLElement>("[data-panel]")
      .forEach((p) => (p.hidden = p.dataset.panel !== view));
    if (view === "reviews") renderReviews();
    else renderPrep();
  }

  function apply(write: Write) {
    if (!write.ok) {
      errorBox.textContent = write.error ?? "";
      return false;
    }
    errorBox.textContent = "";
    statement = write;
    touched = new Set(write.ids);
    return true;
  }

  function clearStatement() {
    statement = null;
    touched = new Set();
  }

  viewButtons.forEach((b) =>
    b.addEventListener("click", () => {
      view = b.dataset.view!;
      render();
    }),
  );
  modeButtons.forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.mode!;
      renderPrep();
    }),
  );
  productButtons.forEach((b) =>
    b.addEventListener("click", () => {
      productId = Number(b.dataset.product);
      clearStatement();
      renderReviews();
    }),
  );
  minRating.addEventListener("change", () => {
    clearStatement();
    renderReviews();
  });
  importButton.addEventListener("click", () => {
    if (!apply(importCleaned(state, cleaned))) return;
    view = "reviews";
    productId = 0;
    minRating.value = "0";
    render();
  });
  tableBox.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const edit = target.closest<HTMLElement>("[data-edit]");
    const del = target.closest<HTMLElement>("[data-delete]");
    if (edit) {
      const review = state.reviews.find(
        (r) => r.review_id === Number(edit.dataset.edit),
      );
      if (!review) return;
      editing = review.review_id;
      productSelect.value = String(review.product_id);
      reviewerInput.value = review.reviewer;
      ratingSelect.value = String(review.rating);
      textInput.value = review.review_text;
      dateInput.value = review.review_date;
      formTitle.textContent = `Edit review ${review.review_id}`;
      saveButton.textContent = "Save changes";
      cancelButton.hidden = false;
      errorBox.textContent = "";
      renderReviews();
      form.scrollIntoView({
        block: "nearest",
        behavior: reduce.matches ? "auto" : "smooth",
      });
      ratingSelect.focus({ preventScroll: true });
    } else if (del) {
      const id = Number(del.dataset.delete);
      if (apply(deleteReview(state, id))) {
        if (editing === id) resetForm();
        renderReviews();
      }
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input: ReviewInput = {
      product_id: Number(productSelect.value),
      reviewer: reviewerInput.value,
      rating: Number(ratingSelect.value),
      review_text: textInput.value,
      review_date: dateInput.value,
    };
    const write =
      editing === null
        ? insertReview(state, input)
        : updateReview(state, editing, input);
    if (!apply(write)) return;
    productId = 0;
    minRating.value = "0";
    resetForm();
    renderReviews();
  });
  cancelButton.addEventListener("click", () => {
    resetForm();
    renderReviews();
  });
  $<HTMLButtonElement>(".pr-reset").addEventListener("click", () => {
    state = createState();
    view = "reviews";
    mode = "clean";
    productId = 0;
    minRating.value = "0";
    clearStatement();
    resetForm();
    render();
  });

  resetForm();
  render();
}

document
  .querySelectorAll<HTMLElement>('[data-demo="product-reviews-analysis"]')
  .forEach(init);
