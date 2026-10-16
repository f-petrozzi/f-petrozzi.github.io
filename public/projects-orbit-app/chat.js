import {
  chatAccounts,
  chatSessions,
  delegatedJobs,
  createChatState,
  changeChat,
  jobStatus,
  previewReply,
} from "./chat-state.js";

export function initChat(
  root,
  {
    preview,
    sheet,
    announce,
    appendMessage,
    reduced,
    phone,
    closeSheet,
    syncPreview,
  },
) {
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  let state = createChatState();
  let selectedJob = 0;
  let timers = [];
  let replaying = false;
  const snapshots = new Map();
  const initialTranscript = $("[data-transcript]").innerHTML;
  const drafts = new Map([[0, "Make the cards more compact."]]);
  const images = new Map([[0, true]]);
  const dispatch = (action) => {
    state = changeChat(state, action);
  };
  const mainInput = $("#main-message");
  const workspace = $(".replica-workspace");
  const mainTranscript = $("[data-transcript]");
  const sessionAccount = () =>
    chatAccounts[chatSessions[state.session].account];
  function latest() {
    const scroll = mainTranscript.closest(".cx-scroll");
    scroll.scrollTop = scroll.scrollHeight;
  }

  function paintJobs() {
    $$("[data-job-status]").forEach((el) => {
      el.textContent = jobStatus(state.phase, Number(el.dataset.jobStatus));
      el.dataset.status = el.textContent.toLowerCase();
    });
    $$("[data-replay]").forEach((button) => {
      button.textContent = replaying ? "Finish replay" : "Replay delegation";
    });
    $$("[data-replay-summary]").forEach((el) => {
      el.textContent =
        state.phase === 3
          ? "2 sessions completed"
          : replaying
            ? "Delegating work"
            : "2 sessions ready";
    });
    const job = delegatedJobs[selectedJob];
    const detail = $("[data-job-detail]");
    detail.replaceChildren();
    const title = document.createElement("h3");
    title.textContent = job.title;
    const status = document.createElement("p");
    status.className = "replica-job-state";
    status.textContent = `${chatAccounts[job.account].label}: ${jobStatus(state.phase, selectedJob)}`;
    const speaker = document.createElement("p");
    speaker.className = "cx-who";
    speaker.textContent = "Orbit";
    const result = document.createElement("p");
    result.textContent =
      jobStatus(state.phase, selectedJob) === "Completed"
        ? job.result + ". The result is ready for the parent conversation."
        : state.phase
          ? "Checking the collection in an independent session."
          : "Waiting for the parent conversation to dispatch this work.";
    const activity = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Activity";
    const file = document.createElement("p");
    file.textContent = job.file;
    activity.append(summary, file);
    detail.append(title, status, speaker, result, activity);
    $$(".replica-job-list [data-job]").forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.job) === selectedJob),
      ),
    );
  }
  function paintLayout() {
    workspace.dataset.layout = state.layout;
    const narrow = phone.matches;
    $$("[data-chat-reader]").forEach((pane) => {
      const id = pane.dataset.chatReader;
      pane.hidden =
        state.layout === "tabs" || narrow
          ? id !== state.reader
          : id !== "main" && id !== state.secondary;
      // ARIA tabs name each retained panel, including both visible split panels.
    });
    $$("[data-reader]").forEach((b) => {
      b.setAttribute(
        "aria-selected",
        String(b.dataset.reader === state.reader),
      );
      b.tabIndex = b.dataset.reader === state.reader ? 0 : -1;
    });
    root.classList.toggle("chat-focus", state.focus);
    $("[data-exit-focus]").hidden = !state.focus;
    $$(".replica-composer").forEach((el) =>
      el.classList.toggle("coding-off", !state.coding),
    );
    $$("[data-coding-activity]").forEach((el) => {
      el.hidden = !state.coding;
    });
    $("[data-attachment]").hidden = !state.attached;
    $(".reading-app").dataset.density = state.density;
    syncPreview();
  }
  function paintBrowse() {
    $$("[data-account]").forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.account === state.browse),
      ),
    );
    $("[data-browse-label]").textContent =
      `${chatAccounts[state.browse].label} connected`;
    const search = $("[data-session-search]").value.toLowerCase();
    const scopeAll =
      $('[data-scope="all"]').getAttribute("aria-pressed") === "true";
    $$("[data-session]").forEach((row) => {
      row.hidden =
        row.dataset.sessionAccount !== state.browse ||
        (!scopeAll &&
          chatSessions[Number(row.dataset.session)].workspace !==
            "reading-room") ||
        !row.textContent.toLowerCase().includes(search);
    });
    $("[data-session-empty]").hidden = $$("[data-session]").some(
      (row) => !row.hidden,
    );
    $("[data-parent-jobs]").hidden = $('[data-session="0"]').hidden;
    $(".session-group").textContent = scopeAll
      ? "All sessions"
      : "Reading Room";
  }
  function setFocus(value, restoreFocus = true) {
    dispatch({ type: "focus", value });
    paintLayout();
    if (!value && restoreFocus) $("[data-chat-menu]").focus();
  }
  function openReader(reader) {
    dispatch({ type: "reader", reader });
    $("#view-chat").classList.add("is-phone-chat");
    // The shared primary reader and every draft stay mounted.
    paintLayout();
  }
  function openSession(id) {
    stop();
    drafts.set(state.session, mainInput.value);
    images.set(state.session, state.attached);
    snapshots.set(state.session, mainTranscript.innerHTML);
    dispatch({ type: "session", id });
    dispatch({ type: "attached", value: images.get(id) || false });
    const session = chatSessions[id];
    mainTranscript.innerHTML =
      snapshots.get(id) || (id === 0 ? initialTranscript : "");
    if (!mainTranscript.children.length) {
      appendMessage(
        mainTranscript,
        id === 1
          ? "Review the collection and its small screen layout."
          : id === 2
            ? "Check the collection with only a keyboard."
            : "Explain native CSS nesting for a small app.",
        true,
      );
      appendMessage(
        mainTranscript,
        id === 1
          ? "The collection keeps title, author and Reserve together. The review is ready beside the main build."
          : id === 2
            ? "The search field, availability filter and Reserve actions have clear labels and visible focus states."
            : "Nest component rules beneath their root so each view keeps its own styles.",
        false,
      );
    }
    mainInput.value = drafts.get(id) || "";
    $("[data-conversation-title]").textContent = session.title;
    $("#tab-main").textContent = session.title;
    const connection = $("[data-session-connection]");
    connection.querySelector(".replica-agent").dataset.agent = session.account;
    connection
      .querySelector("use")
      .setAttribute(
        "href",
        `#agent-${session.account === "C" ? "claude" : "codex"}`,
      );
    connection.lastElementChild.textContent = sessionAccount().label;
    $$("[data-session]").forEach((b) =>
      b.classList.toggle("is-selected", Number(b.dataset.session) === id),
    );
    openReader("main");
    paintJobs();
    preview(id === 0 && !matchMedia("(max-width: 1000px)").matches);
    latest();
  }
  function stop() {
    timers.forEach(clearTimeout);
    timers = [];
    if (replaying) {
      replaying = false;
      dispatch({ type: "phase", phase: 3 });
      paintJobs();
    }
  }
  function replay() {
    if (replaying) {
      stop();
      announce("Delegation complete");
      return;
    }
    replaying = true;
    dispatch({ type: "phase", phase: 1 });
    paintJobs();
    const step = (phase) => {
      dispatch({ type: "phase", phase });
      if (phase === 3) {
        replaying = false;
        timers = [];
        announce("Both worker sessions completed");
      }
      paintJobs();
    };
    if (reduced.matches) {
      step(3);
      return;
    }
    timers = [setTimeout(() => step(2), 650), setTimeout(() => step(3), 1500)];
    announce("Dispatched to Codex B and Claude Code");
  }
  function settings() {
    sheet(
      "Chat settings",
      `<div class="inset-list"><label class="replica-setting">Coding mode <input type="checkbox" data-coding ${state.coding ? "checked" : ""}/></label><label class="replica-setting">Orbit instructions <input type="checkbox" checked/></label></div>`,
    );
  }
  function menu() {
    sheet(
      "Conversation",
      `<div class="replica-menu-actions"><button type="button" data-workspace-layout="tabs">Show as tabs</button><button type="button" data-workspace-layout="split">Split view</button><button type="button" data-workspace-layout="below">Split below</button><button type="button" data-open-orchestrator>Orchestrator</button><button type="button" data-chat-focus>Focus mode</button><button type="button" data-phone-open>Continue on phone</button><button type="button" data-preview-menu>Preview</button></div>`,
    );
  }
  function phoneSheet() {
    const session = chatSessions[state.session];
    // Build from the currently selected session; no duplicated history or connection.
    sheet(
      "Continue on phone",
      '<div class="replica-phone"><header><span class="orb chat-orb" aria-hidden="true"></span><strong data-phone-title></strong><span data-phone-account></span></header><div class="replica-phone-history"></div><div class="replica-phone-compose"><p data-phone-draft></p><button type="button" class="primary" data-phone-send>Send from phone</button></div></div><p class="replica-device-label">Same session on desktop and phone</p>',
    );
    $("[data-phone-title]").textContent = session.title;
    $("[data-phone-draft]").textContent =
      state.session === 0
        ? "I checked the shelf on my phone. Use comfortable spacing."
        : "Continue this conversation from my phone.";
    $("[data-phone-account]").textContent = sessionAccount().label;
    const history = $(".replica-phone-history");
    [...mainTranscript.querySelectorAll(".cx-msg")].slice(-2).forEach((m) => {
      const bubble = document.createElement("p");
      bubble.textContent =
        m.querySelector(".cx-bubble > p, .cx-bubble p")?.textContent ||
        "The collection is ready.";
      history.append(bubble);
    });
  }
  function submit(form) {
    const input = form.querySelector("textarea");
    const text = input.value.trim();
    if (!text && !state.attached) return;
    appendMessage(mainTranscript, text || "Use the attached sketch.", true);
    if (state.attached) {
      const image = document.createElement("img");
      image.src = "reading-room.svg";
      image.alt = "Pasted Reading Room sketch";
      image.width = 156;
      image.height = 88;
      image.className = "replica-sent-image";
      mainTranscript.lastElementChild.querySelector(".cx-bubble").append(image);
    }
    if (state.session === 0) {
      const result = previewReply(state, text);
      state = result.state;
      appendMessage(mainTranscript, result.reply, false);
    } else {
      dispatch({ type: "attached", value: false });
      appendMessage(
        mainTranscript,
        state.session === 1
          ? "The collection review keeps the search field, book titles and Reserve actions available on the small screen."
          : state.session === 2
            ? "The keyboard review covers search, filtering and reservations."
            : "Each nested selector stays under the component root.",
        false,
      );
    }
    input.value = "";
    images.set(state.session, false);
    paintLayout();
    announce("Scripted reply added");
  }
  function click(button) {
    if (button.dataset.account) {
      dispatch({ type: "browse", account: button.dataset.account });
      paintBrowse();
      announce(`${chatAccounts[state.browse].label} conversations`);
      return true;
    }
    if (button.dataset.scope) {
      $$("[data-scope]").forEach((b) =>
        b.setAttribute("aria-pressed", String(b === button)),
      );
      paintBrowse();
      return true;
    }
    if (button.dataset.session !== undefined) {
      openSession(Number(button.dataset.session));
      return true;
    }
    if (button.dataset.reader) {
      openReader(button.dataset.reader);
      return true;
    }
    if (button.hasAttribute("data-chat-menu")) {
      menu();
      return true;
    }
    if (button.dataset.openSheet === "chat-settings") {
      settings();
      return true;
    }
    if (button.dataset.workspaceLayout) {
      closeSheet();
      preview(false);
      dispatch({ type: "layout", layout: button.dataset.workspaceLayout });
      paintLayout();
      return true;
    }
    if (button.hasAttribute("data-open-orchestrator")) {
      closeSheet();
      openReader("orchestrator");
      return true;
    }
    if (button.dataset.job !== undefined) {
      selectedJob = Number(button.dataset.job);
      openReader("orchestrator");
      paintJobs();
      return true;
    }
    if (button.hasAttribute("data-replay")) {
      replay();
      return true;
    }
    if (button.hasAttribute("data-chat-focus")) {
      closeSheet();
      setFocus(true);
      $("[data-exit-focus]").focus();
      return true;
    }
    if (button.hasAttribute("data-exit-focus")) {
      setFocus(false);
      return true;
    }
    if (button.hasAttribute("data-phone-open")) {
      closeSheet();
      phoneSheet();
      return true;
    }
    if (button.hasAttribute("data-phone-send")) {
      const message = $("[data-phone-draft]").textContent;
      const desktopDraft = mainInput.value;
      const desktopImage = state.attached;
      closeSheet();
      openReader("main");
      mainInput.value = message;
      dispatch({ type: "attached", value: false });
      submit($("[data-chat-form]"));
      mainInput.value = desktopDraft;
      dispatch({ type: "attached", value: desktopImage });
      paintLayout();
      announce("Phone reply is visible in the desktop session");
      return true;
    }
    if (button.hasAttribute("data-preview-menu")) {
      closeSheet();
      openReader("main");
      preview(true);
      return true;
    }
    if (button.hasAttribute("data-guide")) {
      preview(false);
      mainInput.value = "Make the cards more compact.";
      mainInput.focus();
      return true;
    }
    if (button.hasAttribute("data-remove-image")) {
      dispatch({ type: "attached", value: false });
      paintLayout();
      return true;
    }
    if (button.hasAttribute("data-attach-sketch")) {
      closeSheet();
      dispatch({ type: "attached", value: true });
      paintLayout();
      mainInput.focus();
      return true;
    }
    if (button.hasAttribute("data-review-send")) {
      const form = $("[data-review-form]");
      const input = form.querySelector("textarea");
      if (input.value.trim()) {
        const target = $("#reader-review .cx-transcript");
        appendMessage(target, input.value.trim(), true);
        appendMessage(
          target,
          "The small screen review is complete. Titles wrap cleanly and the reservation actions keep their labels.",
          false,
        );
        input.value = "";
      }
      return true;
    }
    if (button.hasAttribute("data-new-conversation")) {
      sheet(
        "Chats",
        '<div class="replica-menu-actions">' +
          chatSessions
            .map(
              (s, id) =>
                `<button type="button" data-catalog-session="${id}">${s.title}<small>${chatAccounts[s.account].label}</small></button>`,
            )
            .join("") +
          "</div>",
      );
      return true;
    }
    if (button.dataset.catalogSession !== undefined) {
      closeSheet();
      openSession(Number(button.dataset.catalogSession));
      return true;
    }
    return false;
  }
  const focusExit = document.createElement("button");
  focusExit.type = "button";
  focusExit.dataset.exitFocus = "";
  focusExit.className = "replica-focus-exit";
  focusExit.textContent = "Exit focus";
  focusExit.hidden = true;
  $("#view-chat").prepend(focusExit);
  mainInput.addEventListener("paste", (event) => {
    if (
      [...(event.clipboardData?.items || [])].some((item) =>
        item.type.startsWith("image/"),
      )
    ) {
      event.preventDefault();
      dispatch({ type: "attached", value: true });
      paintLayout();
      announce("Sample sketch attached");
    }
  });
  phone.addEventListener("change", paintLayout);
  reduced.addEventListener("change", () => {
    if (reduced.matches) stop();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
  });
  const visibility = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) stop();
  });
  visibility.observe($("#view-chat"));
  window.addEventListener(
    "pagehide",
    () => {
      stop();
      visibility.disconnect();
    },
    { once: true },
  );
  paintJobs();
  paintLayout();
  paintBrowse();
  latest();
  return {
    click,
    submit,
    stop,
    setFocus,
    input: paintBrowse,
    coding(value) {
      dispatch({ type: "coding", value });
      paintLayout();
    },
    keydown(event) {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing &&
        !phone.matches &&
        event.target.matches("#main-message, #review-message")
      ) {
        event.preventDefault();
        if (event.target.id === "main-message") submit($("[data-chat-form]"));
        else click($("[data-review-send]"));
        return true;
      }
      if (
        event.key === "Escape" &&
        state.focus &&
        !$(".replica-sheet").open &&
        $("[data-preview]").hidden
      ) {
        setFocus(false);
        return true;
      }
      return false;
    },
  };
}
