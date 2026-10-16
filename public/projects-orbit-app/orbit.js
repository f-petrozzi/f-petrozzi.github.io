/* Static portfolio replica. All state is local to this document and discarded on reload.
 * Orbit source patterns: preview/app.js navigation, tasks.js capture/checks,
 * library.js pane switching, codex.js conversation structure, project-preview.js. */
const root = document.querySelector(".demo-orbit-app");
const $ = (selector, scope = root) => scope.querySelector(selector);
const $$ = (selector, scope = root) => [...scope.querySelectorAll(selector)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const phone = matchMedia("(max-width: 760px)");
const compactLibrary = matchMedia("(max-width: 1199px)");
const dialog = $(".replica-sheet");
const status = $("[data-status]");
const nav = $(".main-nav");
const highlight = $(".nav-highlight");
const sources = {
  brief: [
    "Reading room brief",
    "The reading room opens on Saturday mornings. The first release needs search, availability and a reservation action.",
  ],
  research: [
    "Reader interviews",
    "Readers want to find available books quickly and browse a small collection without creating an account.",
  ],
  access: [
    "Accessibility checklist",
    "Every action needs a keyboard path, a visible focus state and a clear label. Book covers need text alternatives.",
  ],
};
const accountDetails = {
  "Everyday checking": ["Harbor Bank", "$3,240.50", "Checking"],
  "Rainy day savings": ["Harbor Bank", "$6,800.00", "Savings"],
  "Everyday card": ["Cedar Credit", "$246.80", "$4,000 credit limit"],
  "Learning loan": ["Juniper Lending", "$4,200.00", "$120 monthly payment"],
};
let activeView = "tasks";
let taskView = "plan";
let taskList = "all";
let captureDay = "today";
let nextTask = 100;
let returnFocus;
let navigationAnimation;
let paneAnimation;
let libraryTab = "chat";
const announce = (text) => {
  status.textContent = text;
};
const escapeHTML = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

function arrive(element, pointer, horizontal = false) {
  paneAnimation?.cancel();
  if (!pointer || reduced.matches) return;
  paneAnimation = element.animate(
    [
      { opacity: 0.3, transform: horizontal ? "translateX(16px)" : "none" },
      { opacity: 1, transform: "none" },
    ],
    { duration: 320, easing: "cubic-bezier(.22,.75,.25,1)" },
  );
}
function moveHighlight(pointer = false) {
  const selected = $('[data-view][aria-current="page"]', nav);
  const from = getComputedStyle(highlight).transform;
  const box = selected.getBoundingClientRect();
  const parent = nav.getBoundingClientRect();
  const to = `translate(${box.left - parent.left + nav.scrollLeft}px, ${box.top - parent.top + nav.scrollTop}px)`;
  navigationAnimation?.cancel();
  highlight.style.width = `${box.width}px`;
  highlight.style.height = `${box.height}px`;
  highlight.style.transform = to;
  highlight.style.opacity = "1";
  if (pointer && !reduced.matches)
    navigationAnimation = highlight.animate(
      [{ transform: from }, { transform: to }],
      { duration: 300, easing: "cubic-bezier(.22,.75,.25,1)" },
    );
}
function view(id, pointer = false) {
  if (!["tasks", "chat", "library", "finance"].includes(id)) return;
  activeView = id;
  $$("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === id);
    if (button.dataset.view === id) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $$("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== id;
  });
  if (id === "library") syncLibrary();
  syncPreview();
  moveHighlight(pointer);
  arrive($(`[data-panel="${id}"]`), pointer, !["chat", "library"].includes(id));
}
function paintTasks() {
  const search = $("[data-task-search]").value.trim().toLowerCase();
  $$("[data-task-row]").forEach((row) => {
    const done = row.classList.contains("tk-done");
    row.hidden =
      (taskView === "completed" && !done) ||
      (taskList !== "all" && row.dataset.taskList !== taskList) ||
      !$(".tk-title", row).textContent.toLowerCase().includes(search);
  });
  const filtered = taskView !== "plan" || search || taskList !== "all";
  $$(".tk-day, [data-unscheduled]").forEach((day) => {
    day.hidden = Boolean(
      filtered && !$$("[data-task-row]", day).some((row) => !row.hidden),
    );
  });
  const earlier = $(".tk-earlier");
  earlier.hidden =
    taskView !== "plan" ||
    !$$("[data-task-row]", earlier).some((row) => !row.hidden);
  $(".tk-week-wrap").hidden = taskView !== "plan";
  $(".task-empty").hidden = $$("[data-task-row]").some((row) => !row.hidden);
  $(".tk-plan-grid").classList.toggle("is-flat", taskView !== "plan");
  $$("[data-task-view]").forEach((button) => {
    const selected = button.dataset.taskView === taskView;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  $$("[data-list]").forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.list === taskList),
    ),
  );
}
function aim(day) {
  captureDay = day;
  const target = $("[data-target]");
  target.textContent = {
    today: "Today",
    tomorrow: "Tomorrow",
    sunday: "Sunday",
    unscheduled: "No date",
  }[day];
  target.classList.toggle("tk-target-today", day === "today");
  $("#new-task").focus();
}
function checkTask(row, pointer) {
  const done = row.classList.toggle("tk-done");
  const button = $("[data-complete]", row);
  button.setAttribute("aria-pressed", String(done));
  const title = $(".tk-title", row).textContent;
  button.setAttribute("aria-label", `${done ? "Reopen" : "Complete"} ${title}`);
  if (pointer && !reduced.matches) {
    const ring = $(".tk-check-box", row);
    ring.getAnimations().forEach((animation) => animation.cancel());
    ring.animate(
      [
        { transform: "scale(.85)" },
        { transform: "scale(1.12)" },
        { transform: "scale(1)" },
      ],
      { duration: 240, easing: "cubic-bezier(.22,.75,.25,1)" },
    );
  }
  if (taskView === "completed" && !done)
    $('[data-task-view="completed"]').focus();
  paintTasks();
  announce(`${title} ${done ? "completed" : "reopened"}`);
}
function addTask(title) {
  const value = title.trim().slice(0, 120);
  if (!value) return false;
  if ($$("[data-task-row]").length >= 40) {
    announce("Task limit reached. Reload to start again.");
    return false;
  }
  const row = $('[data-task-row="1"]').cloneNode(true);
  row.dataset.taskRow = String(nextTask++);
  row.dataset.taskList = "Work";
  row.hidden = false;
  row.classList.remove("tk-done");
  $(".tk-title", row).textContent = value;
  $(".tk-tail", row).replaceChildren();
  $("[data-complete]", row).setAttribute("aria-pressed", "false");
  $("[data-complete]", row).setAttribute("aria-label", `Complete ${value}`);
  $(`[data-task-zone="${captureDay}"]`).append(row);
  taskView = "plan";
  taskList = "all";
  $("[data-task-search]").value = "";
  paintTasks();
  row.scrollIntoView({ block: "nearest", behavior: "instant" });
  arrive(row, true);
  announce("Task added");
  return true;
}
function sheet(title, html) {
  returnFocus = document.activeElement;
  $("#sheet-title").textContent = title;
  $(".replica-sheet-body").innerHTML = html;
  dialog.showModal();
  // Opening a phone sheet leaves the keyboard closed until its input is chosen.
  $(".tk-close", dialog).focus();
}
function openSheet(id) {
  const content = {
    style: [
      "Style guide",
      '<div class="replica-swatches"><span style="background:#edf1f3">Cloud</span><span style="background:#ffffff80">Glass</span><span style="background:#29313a;color:white">Ink</span><span style="background:#4e766e;color:white">Sage</span><span style="background:#577994;color:white">Blue</span></div><div class="inset-list"><p>Soft surfaces</p><p>Quiet, compact controls</p><p>Motion that follows a change</p></div>',
    ],
    "task-settings": [
      "Task settings",
      '<h3>Lists</h3><div class="inset-list"><p>Work</p><p>Personal</p><p>Learning</p></div><h3>Reminders</h3><p>Off</p>',
    ],
    "day-picker": [
      "Choose a day",
      '<div class="replica-sheet-actions"><button type="button" class="secondary" data-sheet-day="today">Today</button><button type="button" class="secondary" data-sheet-day="tomorrow">Tomorrow</button><button type="button" class="secondary" data-sheet-day="sunday">Sunday</button></div>',
    ],
    attachments: [
      "Attachments",
      '<button type="button" class="lib-source-open" data-attach-sketch>Reading room sketch</button>',
    ],
    "chat-settings": [
      "Chat settings",
      '<div class="inset-list"><label class="replica-setting">Coding mode <input type="checkbox" data-coding checked/></label><label class="replica-setting">Orbit instructions <input type="checkbox" checked/></label></div>',
    ],
    "notebook-details": [
      "The Reading Room",
      '<p>A small neighborhood lending library.</p><div class="inset-list"><p>Collection <strong>Projects</strong></p><p>Sources <strong>3</strong></p><p>Updated <strong>October 16</strong></p></div>',
    ],
    "add-sources": [
      "Add sources",
      '<div class="inset-list"><p>Reading room brief</p><p>Reader interviews</p><p>Accessibility checklist</p></div>',
    ],
    "new-notebook": [
      "New notebook",
      '<form data-new-notebook><label class="replica-field">Name<input name="title" maxlength="80" autocomplete="off" required/></label><button type="button" data-local-submit class="primary">Create notebook</button></form>',
    ],
    "month-picker": [
      "October 2026",
      '<div class="inset-list"><p>Recorded through <strong>October 16</strong></p></div>',
    ],
    "finance-actions": [
      "Finances",
      '<button type="button" class="lib-source-open" data-sheet-link="accounts">Accounts</button><button type="button" class="lib-source-open" data-sheet-link="wishlist">Wishlist</button>',
    ],
    bills: [
      "Bills",
      '<div class="inset-list"><p>Room rent <strong>$900 / month</strong></p><p>Mobile plan <strong>$40 / month</strong></p><p>Cloud storage <strong>$12 / month</strong></p></div>',
    ],
    goal: [
      "A little room to explore",
      '<strong class="replica-sheet-figure">$2,400 <small>of $4,000</small></strong><div class="replica-bar"><i style="width:60%"></i></div><div class="inset-list"><p>Each payday <strong>$200</strong></p><p>Status <strong>On track</strong></p></div>',
    ],
  };
  if (content[id]) sheet(...content[id]);
}
function syncLibrary() {
  const compact = compactLibrary.matches;
  $$("[data-library-pane]").forEach((pane) => {
    pane.hidden = compact && pane.dataset.libraryPane !== libraryTab;
    if (compact) {
      pane.setAttribute("role", "tabpanel");
      pane.setAttribute("aria-labelledby", `tab-${pane.dataset.libraryPane}`);
    } else {
      pane.removeAttribute("role");
      pane.removeAttribute("aria-labelledby");
    }
  });
  $$("[data-library-tab]").forEach((button) => {
    button.id = `tab-${button.dataset.libraryTab}`;
    const selected = button.dataset.libraryTab === libraryTab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}
function sourceSheet(key) {
  if (sources[key]) sheet(sources[key][0], `<p>${sources[key][1]}</p>`);
}
function updateSources() {
  const selected = $$("[data-source-use]:checked").length;
  $("[data-source-count]").textContent =
    selected === 3 ? "All 3 used in chat" : `${selected} of 3 used in chat`;
  $("[data-source-all]").checked = selected === 3;
  $("[data-source-all]").indeterminate = selected > 0 && selected < 3;
  $$("[data-source-use]").forEach((input) =>
    input.closest(".lib-source").classList.toggle("is-off", !input.checked),
  );
  $("#lib-chat .cx-meta").textContent = `${selected} sources`;
}
function preview(open) {
  $("[data-preview]").hidden = !open;
  $(".has-project-preview").classList.toggle("preview-closed", !open);
  $(".pj-preview-toggle").setAttribute("aria-pressed", String(open));
  syncPreview();
  if (open && compactLibrary.matches) $("[data-preview-close]").focus();
  if (!open) $(".pj-preview-toggle").focus();
}
function syncPreview() {
  const modal = !$("[data-preview]").hidden && compactLibrary.matches;
  if (modal) {
    $("[data-preview]").setAttribute("role", "dialog");
    $("[data-preview]").setAttribute("aria-modal", "true");
  } else {
    $("[data-preview]").removeAttribute("role");
    $("[data-preview]").removeAttribute("aria-modal");
  }
  $$(
    ".cx-rail, #view-chat > .page-head, #view-chat .cx-thread-body, #view-chat .cx-thread-head",
  ).forEach((el) => {
    el.inert = modal;
  });
  const phoneChat =
    phone.matches && $("#view-chat").classList.contains("is-phone-chat");
  $("#view-chat > .page-head").inert = modal || phoneChat;
  $(".sidebar").inert =
    (activeView === "chat" && (modal || phoneChat)) ||
    (activeView === "library" && phone.matches && !$("[data-notebook]").hidden);
}
function financeView(id, pointer) {
  $$("[data-fin-panel]").forEach((pane) => {
    pane.hidden = pane.dataset.finPanel !== id;
  });
  $$(".fin-nav [data-fin-view]").forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.finView === id)),
  );
  $(".finance-scroll").scrollTop = 0;
  arrive($(`[data-fin-panel="${id}"]`), pointer, true);
}
function appendMessage(target, text, user) {
  const article = document.createElement("article");
  article.className = `cx-msg ${user ? "user" : "assistant"}`;
  const who = document.createElement("div");
  who.className = "cx-who";
  who.textContent = user ? "You" : "Orbit";
  const bubble = document.createElement("div");
  bubble.className = "cx-bubble";
  const p = document.createElement("p");
  p.textContent = text;
  bubble.append(p);
  article.append(who, bubble);
  target.append(article);
  while (target.children.length > 10) target.firstElementChild.remove();
  target.closest(".cx-scroll").scrollTop =
    target.closest(".cx-scroll").scrollHeight;
}
root.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const pointer = event.detail > 0;
  if (button.hasAttribute("data-local-submit"))
    submitForm(button.closest("form"));
  if (button.hasAttribute("data-sheet-close")) dialog.close();
  if (button.dataset.view) view(button.dataset.view, pointer);
  if (button.hasAttribute("data-quick-add")) {
    view("tasks");
    aim("today");
  }
  if (button.dataset.openSheet) openSheet(button.dataset.openSheet);
  if (button.dataset.usage) {
    const usage = {
      a: ["Account A", 24, 41],
      b: ["Account B", 8, 16],
      c: ["Claude", 12, 28],
    }[button.dataset.usage];
    sheet(
      usage[0] + " usage",
      `<div class="inset-list"><p>5 hour window <strong>${usage[1]}%</strong></p><p>Weekly window <strong>${usage[2]}%</strong></p></div>`,
    );
  }

  if (button.dataset.taskView) {
    taskView = button.dataset.taskView;
    paintTasks();
  }
  if (button.dataset.list) {
    taskList = button.dataset.list;
    paintTasks();
  }
  if (button.hasAttribute("data-complete"))
    checkTask(button.closest("[data-task-row]"), pointer);
  if (button.hasAttribute("data-task-detail")) {
    const row = button.closest("[data-task-row]");
    sheet(
      $(".tk-title", row).textContent,
      `<div class="inset-list"><p>List <strong>${escapeHTML(row.dataset.taskList)}</strong></p><p>Plan <strong>${row.closest("[data-task-zone]")?.dataset.taskZone || "Earlier"}</strong></p></div>`,
    );
  }
  if (button.dataset.aim) aim(button.dataset.aim);
  if (button.hasAttribute("data-target")) {
    const days = ["today", "tomorrow", "sunday", "unscheduled"];
    aim(days[(days.indexOf(captureDay) + 1) % days.length]);
  }
  if (button.dataset.jump)
    $(`[data-day="${button.dataset.jump}"]`).scrollIntoView({
      block: "nearest",
      behavior: "instant",
    });
  if (button.hasAttribute("data-search-toggle")) {
    const search = $("[data-task-search-wrap]");
    search.hidden = !search.hidden;
    button.setAttribute("aria-expanded", String(!search.hidden));
    if (!search.hidden) $("[data-task-search]").focus();
    else {
      $("[data-task-search]").value = "";
      paintTasks();
    }
  }
  if (button.hasAttribute("data-bring-forward")) {
    const earlier = $("[data-earlier-list]");
    while (earlier.firstElementChild)
      $('[data-task-zone="today"]').prepend(earlier.firstElementChild);
    $(".tk-earlier").hidden = true;
    announce("Moved to Today");
  }
  if (button.hasAttribute("data-preview-open")) preview(true);
  if (button.hasAttribute("data-preview-close")) preview(false);
  if (button.dataset.previewSize) {
    $("[data-preview]").dataset.size = button.dataset.previewSize;
    $$("[data-preview-size]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
  }
  if (button.hasAttribute("data-reserve")) {
    const reserved = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(reserved));
    button.textContent = reserved ? "Reserved" : "Reserve";
    announce(reserved ? "Book reserved" : "Reservation cancelled");
  }
  if (button.dataset.bookFilter) {
    $$("[data-book-filter]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
    filterBooks();
  }
  if (button.dataset.libraryTab) {
    libraryTab = button.dataset.libraryTab;
    syncLibrary();
  }
  if (button.hasAttribute("data-library-back")) {
    $("[data-notebook]").hidden = true;
    $("[data-library-shelf]").hidden = false;
    syncPreview();
    $("[data-notebook-open]").focus();
  }
  if (button.hasAttribute("data-notebook-open")) {
    $("[data-notebook]").hidden = false;
    $("[data-library-shelf]").hidden = true;
    syncLibrary();
    syncPreview();
    $("[data-library-back]").focus();
  }
  if (button.dataset.source) sourceSheet(button.dataset.source);
  if (button.dataset.note)
    sheet(
      button.dataset.note,
      "<p>Search, availability and a simple reservation flow come first. Use warm paper, generous spacing and clear type.</p>",
    );
  if (button.hasAttribute("data-save-note") || button.dataset.studio) {
    if (!$$("[data-source-use]:checked").length) {
      announce("Select a source first");
      return;
    }
    const li = document.createElement("li");
    const note = document.createElement("button");
    note.type = "button";
    note.className = "lib-note-row";
    note.dataset.note = button.dataset.studio || "First release";
    note.textContent = note.dataset.note;
    li.append(note);
    $("[data-notes]").prepend(li);
    while ($("[data-notes]").children.length > 8)
      $("[data-notes]").lastElementChild.remove();
    $("[data-note-count]").textContent = String(
      $("[data-notes]").children.length,
    );
    announce("Saved to Studio");
  }
  if (button.dataset.finView) financeView(button.dataset.finView, pointer);
  if (button.dataset.readAccount) {
    const a = accountDetails[button.dataset.readAccount];
    sheet(
      button.dataset.readAccount,
      `<p>${a[0]}</p><strong class="replica-sheet-figure">${a[1]}</strong><div class="inset-list"><p>${a[2]}</p><p>Recorded <strong>October 16</strong></p></div>`,
    );
  }
  if (button.dataset.spending)
    sheet(
      button.dataset.spending,
      '<div class="inset-list"><p>Recorded activity <strong>October</strong></p><p>Posted transactions</p></div>',
    );
  if (button.hasAttribute("data-purchase")) {
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "Restore to wishlist" : "Mark purchased";
    announce(on ? "Marked purchased" : "Restored to wishlist");
  }
  if (button.dataset.sheetDay) {
    const day = button.dataset.sheetDay;
    dialog.close();
    aim(day);
  }
  if (button.dataset.sheetLink) {
    const id = button.dataset.sheetLink;
    dialog.close();
    financeView(id, pointer);
  }
  if (button.hasAttribute("data-attach-sketch")) {
    dialog.close();
    preview(true);
  }
  if (button.dataset.account)
    $$("[data-account]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
  if (button.dataset.scope)
    $$("[data-scope]").forEach((item) =>
      item.setAttribute("aria-pressed", String(item === button)),
    );
  if (button.hasAttribute("data-session")) {
    $$("[data-session]").forEach((item) =>
      item.classList.toggle("is-selected", item === button),
    );
    $("[data-conversation-title]").textContent = $(
      ".cx-session-title",
      button,
    ).textContent;
    $("#view-chat").classList.add("is-phone-chat");
    syncPreview();
  }
  if (button.hasAttribute("data-new-conversation")) {
    $("[data-conversation-title]").textContent = "New conversation";
    $("[data-transcript]").replaceChildren();
    $("#view-chat").classList.add("is-phone-chat");
    syncPreview();
    $("#main-message").focus();
  }
  if (button.hasAttribute("data-conversations-back")) {
    $("#view-chat").classList.remove("is-phone-chat");
    syncPreview();
    $('[data-session="0"]').focus();
  }
});
function filterBooks() {
  const text = $("[data-book-search]").value.trim().toLowerCase();
  const available =
    $('[data-book-filter="available"]').getAttribute("aria-pressed") === "true";
  $$("[data-book]").forEach((book) => {
    book.hidden =
      !book.textContent.toLowerCase().includes(text) ||
      (available &&
        $("[data-reserve]", book).getAttribute("aria-pressed") === "true");
  });
  $("[data-book-empty]").hidden = $$("[data-book]").some(
    (book) => !book.hidden,
  );
}
root.addEventListener("input", (event) => {
  if (event.target.matches("[data-task-search]")) paintTasks();
  if (event.target.matches("[data-book-search]")) filterBooks();
  if (event.target.matches("[data-session-search]"))
    $$("[data-session]").forEach((row) => {
      row.hidden = !row.textContent
        .toLowerCase()
        .includes(event.target.value.toLowerCase());
    });
  if (event.target.matches("[data-notebook-search]"))
    $(".lib-card").hidden = !"the reading room".includes(
      event.target.value.toLowerCase(),
    );
});
root.addEventListener("change", (event) => {
  if (event.target.matches("[data-source-all]"))
    $$("[data-source-use]").forEach((input) => {
      input.checked = event.target.checked;
    });
  if (event.target.matches("[data-source-use], [data-source-all]"))
    updateSources();
  if (event.target.matches("[data-coding]"))
    $$(".replica-composer").forEach((composer) =>
      composer.classList.toggle("coding-off", !event.target.checked),
    );
});
// The iframe omits allow-forms. Click and Enter run local actions directly.
const localForms =
  "[data-capture], [data-chat-form], [data-wish-form], [data-new-notebook]";
function submitForm(form) {
  if (!form?.matches(localForms) || !form.reportValidity()) return;
  if (form.matches("[data-capture]")) {
    const input = $("#new-task");
    if (addTask(input.value)) input.value = "";
  }
  if (form.matches("[data-chat-form]")) {
    const input = $('[name="message"]', form);
    const text = input.value.trim();
    if (!text) return;
    const library = form.closest("#lib-chat");
    const transcript = library
      ? $("[data-library-transcript]")
      : $("[data-transcript]");
    appendMessage(transcript, text, true);
    const selected = $$("[data-source-use]:checked").map(
      (input) => input.dataset.sourceUse,
    );
    const reply = library
      ? selected.length
        ? selected.map((key) => sources[key][1]).join(" ")
        : "Select a source to ask about the notebook."
      : "The reading room preview is ready to explore. Search the shelf or reserve a book to try the layout.";
    appendMessage(transcript, reply, false);
    input.value = "";
    announce("Scripted reply added");
  }
  if (form.matches("[data-wish-form]")) {
    const input = $('[name="wish"]', form);
    if (!input.value.trim()) return;
    if ($("[data-wishes]").children.length >= 10) {
      announce("Wishlist limit reached. Reload to start again.");
      return;
    }
    const article = $(".replica-wish").cloneNode(true);
    $("h2", article).textContent = input.value.trim();
    $("p", article).textContent = "Price not set";
    const button = $("[data-purchase]", article);
    button.setAttribute("aria-pressed", "false");
    button.textContent = "Mark purchased";
    $("[data-wishes]").append(article);
    input.value = "";
    announce("Added to wishlist");
  }
  if (form.matches("[data-new-notebook]")) {
    $(".lib-nb-title h1").textContent = $('[name="title"]', form).value.trim();
    dialog.close();
    $("[data-notebook-open]").click();
  }
}
root.addEventListener("submit", (event) => {
  if (!event.target.matches(localForms)) return;
  event.preventDefault();
  submitForm(event.target);
});
dialog.addEventListener("close", () => {
  if (returnFocus?.isConnected && !returnFocus.closest("[hidden]"))
    returnFocus.focus();
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const b = dialog.getBoundingClientRect();
    if (
      event.clientX < b.left ||
      event.clientX > b.right ||
      event.clientY < b.top ||
      event.clientY > b.bottom
    )
      dialog.close();
  }
});
root.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.isComposing &&
    event.target.matches("input")
  ) {
    const form = event.target.closest("form");
    if (form?.matches(localForms)) {
      event.preventDefault();
      submitForm(form);
      return;
    }
  }
  const tab = event.target.closest('[role="tab"]');
  if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const tabs = $$('[role="tab"]', tab.parentElement);
    const i = tabs.indexOf(tab);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (i + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
            tabs.length;
    tabs[next].click();
    tabs[next].focus();
  }
  if (
    event.key === "Escape" &&
    !dialog.open &&
    !$("[data-preview]").hidden &&
    activeView === "chat"
  )
    preview(false);
  if (
    event.key === "Tab" &&
    activeView === "chat" &&
    compactLibrary.matches &&
    !$("[data-preview]").hidden &&
    !dialog.open
  ) {
    const controls = $$(
      "button:not([hidden]), input",
      $("[data-preview]"),
    ).filter((el) => el.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && event.target === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && event.target === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
const resize = new ResizeObserver(() => moveHighlight());
resize.observe(nav);
compactLibrary.addEventListener("change", () => {
  syncLibrary();
  syncPreview();
});
phone.addEventListener("change", syncPreview);
reduced.addEventListener("change", () => {
  navigationAnimation?.cancel();
  paneAnimation?.cancel();
});
window.addEventListener("hashchange", () => view(location.hash.slice(1)));
window.addEventListener(
  "pagehide",
  () => {
    navigationAnimation?.cancel();
    paneAnimation?.cancel();
    resize.disconnect();
  },
  { once: true },
);
$("#view-chat").classList.add("is-phone-chat");
$("[data-preview]").hidden = compactLibrary.matches;
view(location.hash.slice(1) || "tasks");
syncLibrary();
moveHighlight();
