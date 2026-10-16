import {
  addTask,
  changeTask,
  createState,
  days,
  groundedNote,
  guidePreview,
  money,
  sources,
  togglePurchased,
  toggleSource,
  transactions,
} from "../../data/demos/orbit";

function init(root: HTMLElement) {
  if (root.dataset.ready) return;
  root.dataset.ready = "true";
  const query = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const all = <T extends HTMLElement = HTMLElement>(selector: string) => [
    ...root.querySelectorAll<T>(selector),
  ];
  const status = query("[data-status]");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const narrow = matchMedia("(max-width: 760px)");
  let state = createState();
  let taskView = "plan";
  let taskList = "all";
  let answer = groundedNote(state.selected);
  const template = query("[data-task]").cloneNode(true) as HTMLElement;
  const originalTranscript = query("[data-transcript]").cloneNode(
    true,
  ) as HTMLElement;
  let activeAnimation: Animation | undefined;
  let navAnimation: Animation | undefined;
  const nav = query('[role="tablist"]');
  const highlight = query(".orbit-nav-highlight");

  function highlightNavigation(pointer = false) {
    if (!root.isConnected || !root.getClientRects().length) return;
    const selected = query<HTMLButtonElement>(
      '[data-view][aria-selected="true"]',
    );
    const from = getComputedStyle(highlight).transform;
    const box = selected.getBoundingClientRect();
    const parent = nav.getBoundingClientRect();
    const to = `translate(${box.left - parent.left}px, ${box.top - parent.top}px)`;
    navAnimation?.cancel();
    highlight.style.width = `${box.width}px`;
    highlight.style.height = `${box.height}px`;
    highlight.style.transform = to;
    nav.dataset.highlightReady = "true";
    if (pointer && !reduced.matches)
      navAnimation = highlight.animate(
        [{ transform: from }, { transform: to }],
        { duration: 300, easing: "cubic-bezier(.22,.75,.25,1)" },
      );
  }

  function announce(text: string) {
    status.textContent = text;
  }
  function arrive(panel: HTMLElement, pointer: boolean) {
    activeAnimation?.cancel();
    if (pointer && !reduced.matches)
      activeAnimation = panel.animate(
        [
          { opacity: 0.4, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 320, easing: "cubic-bezier(.22,.75,.25,1)" },
      );
  }
  function view(id: string, pointer = false) {
    all<HTMLButtonElement>("[data-view]").forEach((button) => {
      const selected = button.dataset.view === id;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    all("[data-panel]").forEach(
      (panel) => (panel.hidden = panel.dataset.panel !== id),
    );
    highlightNavigation(pointer);
    announce("");
    arrive(query(`[data-panel="${id}"]`), pointer);
  }
  function libraryPane(id: string) {
    all("[data-library-pane]").forEach((panel) =>
      panel.classList.toggle("is-selected", panel.dataset.libraryPane === id),
    );
    all("[data-library-tab]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.libraryTab === id),
      ),
    );
  }
  function preview(open: boolean) {
    query("[data-preview]").hidden = !open;
    query("[data-preview-toggle]").setAttribute("aria-pressed", String(open));
    // The phone preview replaces the conversation within the same mounted pane.
    query(".orbit-conversation").inert = open && narrow.matches;
  }
  function paintTasks() {
    for (const task of state.tasks) {
      let row = root.querySelector<HTMLElement>(`[data-task="${task.id}"]`);
      if (!row) {
        row = template.cloneNode(true) as HTMLElement;
        row.dataset.task = String(task.id);
        row.querySelector("details")!.open = false;
        const check = row.querySelector<HTMLInputElement>("[data-complete]")!;
        check.dataset.complete = String(task.id);
        const move = row.querySelector<HTMLSelectElement>("[data-move]")!;
        move.dataset.move = String(task.id);
      }
      const destination = query(`[data-task-list="${task.day}"]`);
      if (row.parentElement !== destination) destination.append(row);
      row.querySelector("[data-task-title]")!.textContent = task.title;
      const check = row.querySelector<HTMLInputElement>("[data-complete]")!;
      check.checked = task.done;
      check.setAttribute(
        "aria-label",
        `${task.done ? "Reopen" : "Complete"} ${task.title}`,
      );
      check.parentElement!.className = `orbit-check orbit-${task.list.toLowerCase()}`;
      row.querySelector<HTMLSelectElement>("[data-move]")!.value = task.day;
      row.classList.toggle("is-done", task.done);
      row.hidden =
        (taskList !== "all" && task.list !== taskList) ||
        (taskView === "completed" && !task.done);
    }
    for (const day of days) {
      const region = query(`[data-day="${day.id}"]`);
      const visible = [
        ...region.querySelectorAll<HTMLElement>("[data-task]"),
      ].some((row) => !row.hidden);
      region.hidden = taskView !== "plan" && !visible;
      region.querySelector<HTMLElement>("[data-task-empty]")!.hidden = visible;
    }
    // A single empty state is enough in filtered collections.
    if (taskView !== "plan" && !all("[data-task]").some((row) => !row.hidden)) {
      query('[data-day="today"]').hidden = false;
      query('[data-day="today"] [data-task-empty]').textContent =
        taskView === "completed" ? "No completed tasks" : "No tasks";
    } else
      query('[data-day="today"] [data-task-empty]').textContent = "No tasks";
    query(".orbit-week").hidden = taskView !== "plan";
    all("[data-task-view]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.taskView === taskView),
      ),
    );
    all("[data-list]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.list === taskList),
      ),
    );
  }
  function sourceReader(id: string) {
    const source = sources.find((item) => item.id === id);
    if (!source) return;
    query("[data-source-reader] h4").textContent = source.title;
    query("[data-source-reader] p").textContent = source.text;
    libraryPane("sources");
    const button = query<HTMLButtonElement>(`[data-read-source="${id}"]`);
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: "nearest", behavior: "instant" });
    announce(`Opened ${source.title}`);
  }
  function paintNote(
    container: HTMLElement,
    notes: typeof answer,
    citations: boolean,
  ) {
    const elements = notes.map((note, index) => {
      const p = document.createElement("p");
      p.textContent = note.text;
      if (citations) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "orbit-citation";
        button.dataset.citation = note.source;
        button.setAttribute("aria-label", `Read source: ${note.title}`);
        button.textContent = `[${index + 1}]`;
        p.append(" ", button);
      } else {
        const small = document.createElement("small");
        small.textContent = note.title;
        p.append(small);
      }
      return p;
    });
    if (!elements.length) {
      const empty = document.createElement("p");
      empty.textContent = "No sources selected";
      elements.push(empty);
    }
    container.replaceChildren(...elements);
  }
  function financeView(id: string, pointer = false) {
    all("[data-fin-panel]").forEach(
      (panel) => (panel.hidden = panel.dataset.finPanel !== id),
    );
    all(".orbit-segments [data-fin-view]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.finView === id),
      ),
    );
    query(".orbit-fin-body").scrollTop = 0;
    arrive(query(`[data-fin-panel="${id}"]`), pointer);
  }
  function paintTransactions(category = "") {
    all("[data-spending]").forEach((item) =>
      item.setAttribute(
        "aria-pressed",
        String(item.dataset.spending === category),
      ),
    );
    query("[data-transactions]").replaceChildren(
      ...transactions
        .filter((row) => !category || row.category === category)
        .map((row) => {
          const article = document.createElement("article");
          for (const [tag, text] of [
            ["strong", row.merchant],
            ["small", row.category],
            ["span", money(row.cents)],
          ]) {
            const element = document.createElement(tag);
            element.textContent = text;
            article.append(element);
          }
          return article;
        }),
    );
  }
  function chatMessage(speaker: string, text: string) {
    const transcript = query("[data-transcript]");
    const article = document.createElement("article");
    article.className = `orbit-message${speaker === "You" ? " is-user" : ""}`;
    const label = document.createElement("span");
    label.textContent = speaker;
    const p = document.createElement("p");
    p.textContent = text;
    article.append(label, p);
    transcript.append(article);
    while (transcript.children.length > 10)
      transcript.firstElementChild?.remove();
    transcript.scrollTop = transcript.scrollHeight;
  }

  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || !root.contains(button)) return;
    if (button.dataset.view) view(button.dataset.view, event.detail > 0);
    if (button.dataset.taskView) {
      taskView = button.dataset.taskView;
      paintTasks();
    }
    if (button.dataset.list) {
      taskList = button.dataset.list;
      paintTasks();
    }
    if (button.hasAttribute("data-preview-toggle")) {
      preview(query("[data-preview]").hidden);
      if (narrow.matches && !query("[data-preview]").hidden)
        query<HTMLButtonElement>("[data-preview-close]").focus();
    }
    if (button.hasAttribute("data-preview-close")) {
      preview(false);
      query<HTMLButtonElement>("[data-preview-toggle]").focus();
    }
    if (button.hasAttribute("data-open-preview")) {
      preview(true);
      if (narrow.matches)
        query<HTMLButtonElement>("[data-preview-close]").focus();
    }
    if (button.hasAttribute("data-preview-size")) {
      const phone = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(phone));
      query("[data-preview]").classList.toggle("is-phone", phone);
    }
    if (button.hasAttribute("data-reserve")) {
      const reserved = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(reserved));
      button.textContent = reserved ? "Cancel reservation" : "Reserve";
      button
        .closest("article")!
        .querySelector("[data-availability]")!.textContent = reserved
        ? "Reserved for you"
        : "Available";
      announce(reserved ? "Book reserved" : "Reservation cancelled");
    }
    if (button.dataset.libraryTab) libraryPane(button.dataset.libraryTab);
    if (button.dataset.readSource) sourceReader(button.dataset.readSource);
    if (button.dataset.citation) sourceReader(button.dataset.citation);
    if (button.hasAttribute("data-generate")) {
      answer = groundedNote(state.selected);
      paintNote(query("[data-grounded-answer]"), answer, true);
      announce(
        answer.length
          ? `Answer grounded in ${answer.length} sources`
          : "Select a source before summarizing",
      );
    }
    if (button.hasAttribute("data-save-note")) {
      paintNote(query("[data-studio-note]"), answer, false);
      announce(
        answer.length
          ? "Saved First release to Studio"
          : "No grounded answer to save",
      );
    }
    if (button.dataset.finView)
      financeView(button.dataset.finView, event.detail > 0);
    if (button.dataset.spending) {
      const category =
        button.getAttribute("aria-pressed") === "true"
          ? ""
          : button.dataset.spending;
      paintTransactions(category);
      announce(category ? `${category} transactions` : "All transactions");
    }
    if (button.dataset.purchase) {
      state = togglePurchased(state, button.dataset.purchase);
      const purchased = state.purchased.includes(button.dataset.purchase);
      button.setAttribute("aria-pressed", String(purchased));
      button.textContent = purchased ? "Restore to wishlist" : "Mark purchased";
      announce(purchased ? "Marked purchased" : "Restored to wishlist");
    }
    if (button.hasAttribute("data-reset")) reset();
  });
  root.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.complete) {
      state = changeTask(state, Number(input.dataset.complete), {
        done: input.checked,
      });
      paintTasks();
      if (input.closest<HTMLElement>("[data-task]")!.hidden)
        query<HTMLButtonElement>('[data-task-view="completed"]').focus();
      announce(input.checked ? "Task completed" : "Task reopened");
    }
    if (input.dataset.move) {
      const id = Number(input.dataset.move);
      state = changeTask(state, id, { day: input.value });
      paintTasks();
      const moved = query<HTMLSelectElement>(`[data-move="${id}"]`);
      if (!moved.closest<HTMLElement>("[data-day]")!.hidden)
        moved.focus({ preventScroll: true });
      else query<HTMLButtonElement>('[data-task-view="plan"]').focus();
      announce(`Moved to ${days.find((day) => day.id === input.value)?.label}`);
    }
    if (input.dataset.source) {
      state = toggleSource(state, input.dataset.source);
      announce(`${state.selected.length} sources selected`);
    }
  });
  query<HTMLFormElement>("[data-capture]").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const input = form.elements.namedItem("task") as HTMLInputElement;
      const day = (form.elements.namedItem("day") as HTMLSelectElement).value;
      const next = addTask(state, input.value, day);
      if (next === state) {
        announce(
          state.tasks.length >= 30
            ? "Task limit reached. Reset to start again."
            : "Enter a task title",
        );
        input.focus();
        return;
      }
      state = next;
      taskView = "plan";
      taskList = "all";
      paintTasks();
      input.value = "";
      query(`[data-task="${state.nextId - 1}"]`).scrollIntoView({
        block: "nearest",
        behavior: "instant",
      });
      announce("Task added");
    },
  );
  query<HTMLFormElement>("[data-chat-form]").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      const input = (event.currentTarget as HTMLFormElement).elements.namedItem(
        "message",
      ) as HTMLInputElement;
      if (!input.value.trim()) return;
      const result = guidePreview(state, input.value);
      state = result.state;
      chatMessage("You", input.value.trim());
      chatMessage("Orbit", result.reply);
      query("[data-app]").dataset.density = state.density;
      input.value = "";
      announce(result.reply);
    },
  );
  root.addEventListener("keydown", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "[data-view]",
    );
    if (
      button &&
      [
        "ArrowRight",
        "ArrowLeft",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    ) {
      event.preventDefault();
      const tabs = all<HTMLButtonElement>("[data-view]");
      const current = tabs.indexOf(button);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (current +
                (event.key === "ArrowLeft" || event.key === "ArrowUp"
                  ? -1
                  : 1) +
                tabs.length) %
              tabs.length;
      view(tabs[next].dataset.view!);
      tabs[next].focus();
    }
    if (
      event.key === "Escape" &&
      narrow.matches &&
      !query("[data-preview]").hidden &&
      !query('[data-panel="chat"]').hidden
    ) {
      preview(false);
      query<HTMLButtonElement>("[data-preview-toggle]").focus();
    }
  });
  function reset() {
    activeAnimation?.cancel();
    state = createState();
    taskView = "plan";
    taskList = "all";
    answer = groundedNote(state.selected);
    all("[data-task]").forEach((row) => {
      if (!state.tasks.some((task) => String(task.id) === row.dataset.task))
        row.remove();
    });
    all<HTMLDetailsElement>("details").forEach(
      (details) =>
        (details.open = details.closest(".orbit-chat-picker") !== null),
    );
    all<HTMLFormElement>("form").forEach((form) => form.reset());
    all<HTMLInputElement>("[data-source]").forEach(
      (input) => (input.checked = true),
    );
    all("[data-purchase]").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
      button.textContent = "Mark purchased";
    });
    all("[data-reserve]").forEach((button) => {
      button.setAttribute("aria-pressed", "false");
      button.textContent = "Reserve";
    });
    all("[data-availability]").forEach(
      (label) => (label.textContent = "Available"),
    );
    paintTransactions();
    const transcript = query("[data-transcript]");
    transcript.replaceChildren(
      ...[...originalTranscript.children].map((child) => child.cloneNode(true)),
    );
    query("[data-app]").dataset.density = "comfortable";
    query("[data-preview]").classList.remove("is-phone");
    query("[data-preview-size]").setAttribute("aria-pressed", "false");
    query("[data-source-reader] h4").textContent = sources[0].title;
    query("[data-source-reader] p").textContent = sources[0].text;
    paintNote(query("[data-grounded-answer]"), answer, true);
    paintNote(query("[data-studio-note]"), answer, false);
    paintTasks();
    libraryPane("sources");
    financeView("overview");
    preview(!narrow.matches);
    view("tasks");
    all(".orbit-scroll").forEach((element) => (element.scrollTop = 0));
    announce("Orbit reset");
  }
  paintTasks();
  libraryPane("sources");
  preview(!narrow.matches);
  highlightNavigation();
  // Geometry changes only on resize; no animation loop or timer.
  const resize = new ResizeObserver(() => {
    highlightNavigation();
    query(".orbit-conversation").inert =
      !query("[data-preview]").hidden && narrow.matches;
  });
  resize.observe(nav);
  reduced.addEventListener("change", () => {
    activeAnimation?.cancel();
    navAnimation?.cancel();
  });
  window.addEventListener(
    "pagehide",
    () => {
      activeAnimation?.cancel();
      navAnimation?.cancel();
      resize.disconnect();
    },
    { once: true },
  );
}
document.querySelectorAll<HTMLElement>('[data-demo="orbit"]').forEach(init);
