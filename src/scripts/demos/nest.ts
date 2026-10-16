import {
  addTask,
  calendarDays,
  confirmStock,
  createState,
  markMealMade,
  money,
  proposeStock,
  readReceipt,
  receiptTotal,
  savePurchase,
  stockLabels,
  toggleTask,
  week,
  type PantryItem,
  type ReceiptItem,
  type Stock,
  type Task,
} from "../../data/demos/nest";

function init(root: HTMLElement) {
  if (root.dataset.ready) return;
  root.dataset.ready = "true";
  const q = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const all = <T extends HTMLElement = HTMLElement>(selector: string) => [
    ...root.querySelectorAll<T>(selector),
  ];
  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text = "",
    className = "",
  ) => {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  };
  let state = createState();
  let receipt: ReceiptItem[] = [];
  let changes: PantryItem[] = [];
  const review = q<HTMLFormElement>("[data-receipt-review]");
  const taskForm = q<HTMLFormElement>("[data-task-form]");
  const sheet = q<HTMLDialogElement>("[data-consume]");
  const made = q<HTMLButtonElement>("[data-made]");
  const mealStatus = q("[data-meal-status]");
  mealStatus.tabIndex = -1;

  function announce(message: string) {
    q("[data-status]").textContent = `${message} Riley’s phone is up to date.`;
    q("[data-device-update]").textContent = message;
  }

  function view(name: string) {
    all("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
    all("[data-view]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === name));
    });
  }

  function pantryRows(container: HTMLElement, compact = false) {
    container.replaceChildren(
      ...state.pantry.map((item) => {
        const row = el("li");
        const name = el(compact ? "span" : "strong", item.name);
        const stock = el("span", stockLabels[item.stock]);
        stock.dataset.stock = item.stock;
        row.append(name, stock);
        return row;
      }),
    );
  }

  function render() {
    pantryRows(q("[data-pantry]"));
    pantryRows(q("[data-device-pantry]"), true);
    made.disabled = state.made;
    made.textContent = state.made ? "Made ✓" : "Mark as made";
    mealStatus.textContent = state.made
      ? "Made by Sam · Wednesday"
      : "Planned for Wednesday";
    q("[data-device-meal]").textContent = state.made
      ? "Made · Sam"
      : "Planned · Sam";
    const done = state.tasks.filter((task) => task.done).length;
    q("[data-task-count]").textContent = String(state.tasks.length - done);
    q("[data-device-tasks]").textContent =
      `${state.tasks.length} ${state.tasks.length === 1 ? "task" : "tasks"} · ${done} done`;
    const latest = state.tasks.at(-1)!;
    const day = week.find((entry) => entry.date === latest.date)!;
    q("[data-device-task]").textContent =
      `${latest.title} · ${day.day} ${day.number}${latest.done ? " · Done" : ""}`;
    all("[data-tasks]").forEach((list, listIndex) => {
      list.replaceChildren(
        ...state.tasks.map((task) => {
          const row = el("li", "", `nest-task${task.done ? " is-done" : ""}`);
          const button = el("button", task.done ? "✓" : "○");
          button.type = "button";
          button.dataset.taskId = String(task.id);
          button.setAttribute("aria-pressed", String(task.done));
          button.setAttribute(
            "aria-label",
            `${task.done ? "Reopen" : "Complete"} ${task.title}`,
          );
          button.addEventListener("click", () => {
            state = toggleTask(state, task.id);
            render();
            all("[data-tasks]")
              [listIndex].querySelector<HTMLButtonElement>(
                `[data-task-id="${task.id}"]`,
              )
              ?.focus();
            announce(`${task.title} ${task.done ? "reopened" : "completed"}.`);
          });
          const copy = el("div", "", "nest-task-copy");
          const day = week.find((entry) => entry.date === task.date)!;
          copy.append(
            el("strong", task.title),
            el(
              "span",
              `${task.person} · ${day.day} ${day.number} Oct${task.done ? " · Done" : ""}`,
            ),
          );
          row.append(button, copy);
          return row;
        }),
      );
    });
    all("[data-week]").forEach((grid) => {
      grid.replaceChildren(
        ...calendarDays(state).map((day) => {
          const cell = el("div", "", "nest-day");
          const heading = el("div", day.day, "nest-day-heading");
          heading.append(el("strong", String(day.number)));
          cell.append(heading);
          day.tasks.forEach((task) => {
            const item = el(
              "div",
              "",
              `nest-calendar-item${task.done ? " is-done" : ""}`,
            );
            item.append(
              el("strong", task.title),
              el("span", `${task.person} · ${task.done ? "Done ✓" : "Task"}`),
            );
            cell.append(item);
          });
          return cell;
        }),
      );
    });
    q("[data-receipt-start]").hidden =
      state.purchase !== null || !review.hidden;
    q("[data-receipt-saved]").hidden = state.purchase === null;
    q("[data-device-purchase]").hidden = state.purchase === null;
    if (state.purchase) {
      const trip = `${state.purchase.items.length} ${state.purchase.items.length === 1 ? "item" : "items"} · ${money(state.purchase.total)}`;
      q("[data-purchase]").textContent = trip;
      q("[data-device-total]").textContent = `Maple Market · ${trip}`;
    }
  }

  function updateReceipt() {
    q("[data-total]").textContent = money(receiptTotal(receipt));
    q<HTMLButtonElement>("[data-save]").disabled = !receipt.some(
      (item) => item.include,
    );
    q("[data-receipt-error]").hidden = true;
  }

  function renderReceipt() {
    q("[data-receipt-items]").replaceChildren(
      ...receipt.map((item, index) => {
        const row = el("div", "", "nest-receipt-row");
        const line = el("div", "", "nest-item-line");
        const includeLabel = el("label", "", "nest-include");
        const include = el("input");
        include.type = "checkbox";
        include.checked = item.include;
        includeLabel.append(
          include,
          el("span", `Include receipt item ${index + 1}`, "nest-sr"),
        );
        const nameLabel = el("label");
        const name = el("input");
        name.type = "text";
        name.value = item.name;
        name.maxLength = 60;
        name.required = true;
        name.autocomplete = "off";
        nameLabel.append(el("span", `Item ${index + 1} name`, "nest-sr"), name);
        line.append(
          includeLabel,
          nameLabel,
          el("span", money(item.cents), "nest-item-price"),
        );
        const amountLabel = el("label", "Amount", "nest-item-amount");
        const amount = el("input");
        amount.type = "text";
        amount.value = item.amount;
        amount.maxLength = 30;
        amount.required = true;
        amount.autocomplete = "off";
        amountLabel.append(amount);
        include.addEventListener("change", () => {
          item.include = include.checked;
          name.disabled = amount.disabled = !include.checked;
          updateReceipt();
        });
        name.addEventListener("input", () => {
          item.name = name.value;
          updateReceipt();
        });
        amount.addEventListener("input", () => {
          item.amount = amount.value;
          updateReceipt();
        });
        row.append(line, amountLabel);
        return row;
      }),
    );
    updateReceipt();
  }

  all<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => view(button.dataset.view!));
  });
  q("[data-open-tasks]").addEventListener("click", () => {
    view("tasks");
    taskForm.querySelector<HTMLInputElement>("[name=title]")!.focus();
  });
  q("[data-recipe-link]").addEventListener("click", () => {
    q<HTMLDetailsElement>(".nest-recipe").open = true;
  });
  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = taskForm.querySelector<HTMLInputElement>("[name=title]")!;
    const date =
      taskForm.querySelector<HTMLSelectElement>("[name=date]")!.value;
    const person = taskForm.querySelector<HTMLSelectElement>("[name=person]")!
      .value as Task["person"];
    const next = addTask(state, title.value, date, person);
    if (next === state) {
      title.setCustomValidity("Enter a task name.");
      title.reportValidity();
      return;
    }
    state = next;
    render();
    const day = week.find((entry) => entry.date === date)!;
    announce(
      `${state.tasks.at(-1)!.title} added to ${day.day} ${day.number} Oct.`,
    );
    title.value = "";
    title.focus();
  });
  taskForm.addEventListener("input", () => {
    taskForm
      .querySelector<HTMLInputElement>("[name=title]")!
      .setCustomValidity("");
  });

  q("[data-read]").addEventListener("click", () => {
    receipt = readReceipt();
    renderReceipt();
    review.hidden = false;
    q("[data-receipt-start]").hidden = true;
    q("[data-review-title]").focus();
    q("[data-status]").textContent = "Receipt read · 3 items ready for review.";
  });
  q("[data-cancel-receipt]").addEventListener("click", () => {
    receipt = [];
    review.reset();
    review.hidden = true;
    render();
    q("[data-read]").focus();
    q("[data-status]").textContent = "Receipt cancelled.";
  });
  review.addEventListener("submit", (event) => {
    event.preventDefault();
    const next = savePurchase(state, receipt);
    if (next === state) {
      const error = q("[data-receipt-error]");
      error.textContent = "Include an item with a name and amount.";
      error.hidden = false;
      return;
    }
    state = next;
    review.hidden = true;
    render();
    const purchase = q("[data-purchase]");
    purchase.tabIndex = -1;
    purchase.focus();
    announce(`Trip saved · ${money(state.purchase!.total)}. Pantry restocked.`);
  });

  made.addEventListener("click", () => {
    state = markMealMade(state);
    changes = proposeStock(state);
    q("[data-stock-rows]").replaceChildren(
      ...changes.map((item) => {
        const field = el("fieldset", "", "nest-stock-row");
        field.append(el("legend", item.name));
        const options = el("div", "", "nest-stock-options");
        (["in", "low", "out"] as Stock[]).forEach((stock) => {
          const button = el(
            "button",
            { in: "In", low: "Low", out: "Out" }[stock],
          );
          button.type = "button";
          button.setAttribute("aria-pressed", String(item.stock === stock));
          button.addEventListener("click", () => {
            item.stock = stock;
            [...options.children].forEach((other) =>
              other.setAttribute("aria-pressed", String(other === button)),
            );
          });
          options.append(button);
        });
        field.append(options);
        return field;
      }),
    );
    render();
    announce("Sam made the skillet.");
    sheet.showModal();
  });
  q("[data-stock-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    state = confirmStock(state, changes);
    render();
    sheet.close();
    announce("Pantry updated after dinner.");
  });
  q("[data-skip]").addEventListener("click", () => sheet.close());
  sheet.addEventListener("close", () => {
    changes = [];
    mealStatus.focus();
  });

  q("[data-reset]").addEventListener("click", () => {
    if (sheet.open) sheet.close();
    state = createState();
    receipt = [];
    changes = [];
    taskForm.reset();
    taskForm
      .querySelector<HTMLInputElement>("[name=title]")!
      .setCustomValidity("");
    review.reset();
    review.hidden = true;
    q("[data-receipt-items]").replaceChildren();
    q("[data-receipt-error]").hidden = true;
    q<HTMLDetailsElement>(".nest-recipe").open = false;
    all(".nest-week-scroll").forEach((scroll) => {
      scroll.scrollLeft = 0;
    });
    view("kitchen");
    render();
    q("[data-status]").textContent = "Home is up to date.";
    q("[data-device-update]").textContent = "All caught up.";
  });
  render();
}

document.querySelectorAll<HTMLElement>('[data-demo="nest"]').forEach(init);
