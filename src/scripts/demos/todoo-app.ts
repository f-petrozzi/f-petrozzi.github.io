import {
  SIRI_INTENT,
  SNOOZE_MINUTES,
  addNote,
  addSubtask,
  alarmLabel,
  applyGenerate,
  cancelAlarm,
  deleteNote,
  fireAlarm,
  formatClock,
  formatTime,
  initialState,
  progress,
  removeSubtask,
  scheduleAlarm,
  setBody,
  setTitle,
  siriAddNote,
  snoozeAlarm,
  stopAlarm,
  suggestAlarmTime,
  timeInputValue,
  toggleSubtask,
  type Note,
  type State,
} from "../../data/demos/todoo-app";

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

const svg = (body: string, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  chevronRight: svg('<path d="m9 6 6 6-6 6"/>', 16),
  chevronLeft: svg('<path d="m15 6-6 6 6 6"/>', 22),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 22),
  trash: svg(
    '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>',
    20,
  ),
  bell: svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 21h4"/>', 14),
  bellLarge: svg(
    '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 21h4"/>',
    28,
  ),
  sparkle: svg(
    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
    18,
  ),
  check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 14),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>', 18),
  mic: svg(
    '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    22,
  ),
};

type View = { name: "list" } | { name: "note"; id: string };
interface SiriState {
  open: boolean;
  title: string;
  reply: string | null;
}

function init(root: HTMLElement) {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const screen = q("[data-screen]");
  const status = q("[data-status]");
  const clock = q("[data-clock]");
  const alarmLayer = q("[data-alarm]");
  const siriLayer = q("[data-siri]");
  const toast = q("[data-toast]");
  const siriButton = q<HTMLButtonElement>("[data-siri-open]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  let state: State = initialState();
  let view: View = { name: "list" };
  let siri: SiriState = { open: false, title: "", reply: null };
  let pendingFocus: string | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  let lastView = "list";

  const current = (): Note | undefined => {
    const v = view;
    return v.name === "note"
      ? state.notes.find((n) => n.id === v.id)
      : undefined;
  };

  function say(text: string) {
    toast.textContent = text;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => toast.classList.remove("is-on"),
      reduce.matches ? 3200 : 2400,
    );
  }

  /* ---------- screens ---------- */

  function alarmChip(note: Note) {
    if (!note.alarm) return "";
    const off = note.alarm.status === "stopped" ? " is-off" : "";
    return `<span class="td-chip td-chip-alarm${off}">${ICON.bell}${esc(alarmLabel(state, note.alarm))}</span>`;
  }

  function listHTML() {
    const rows = state.notes
      .map((n) => {
        const p = progress(n);
        const prog = p.total
          ? `<span class="td-chip">${ICON.check}${p.done} of ${p.total}</span>`
          : "";
        return `<li><button type="button" class="td-row" data-act="open" data-id="${n.id}" data-k="open-${n.id}">
          <span class="td-row-main">
            <span class="td-row-title">${esc(n.title.trim() || "New note")}</span>
            <span class="td-row-sub">${esc(n.body.trim() || "No additional text")}</span>
            <span class="td-row-meta">${prog}${alarmChip(n)}</span>
          </span>${ICON.chevronRight}</button></li>`;
      })
      .join("");
    return `<header class="td-nav"><span></span><button type="button" class="td-icon" data-act="new" data-k="new" aria-label="New note">${ICON.plus}</button></header>
      <h2 class="td-large">Notes</h2>
      <ul class="td-list">${rows || '<li class="td-empty">No notes</li>'}</ul>`;
  }

  function noteHTML(n: Note) {
    const subs = n.subtasks
      .map(
        (s) => `<li class="td-sub">
          <label class="td-check"><input type="checkbox" data-sub="${s.id}" data-k="sub-${s.id}"${s.done ? " checked" : ""}><span class="td-box">${ICON.check}</span><span class="td-sub-text">${esc(s.text)}</span></label>
          <button type="button" class="td-icon td-icon-quiet" data-act="remove-sub" data-sid="${s.id}" data-k="rm-${s.id}" aria-label="Remove ${esc(s.text)}">${ICON.close}</button></li>`,
      )
      .join("");
    const alarm = n.alarm;
    const live = alarm && alarm.status !== "stopped";
    const alarmBlock = live
      ? `<div class="td-alarm-row"><span class="td-alarm-label">${ICON.bell}<span>${esc(alarmLabel(state, alarm))}</span></span>
          <span class="td-alarm-actions"><button type="button" class="td-pill" data-act="fire" data-k="fire">Fire now</button>
          <button type="button" class="td-pill td-pill-quiet" data-act="cancel-alarm" data-k="cancel-alarm">Cancel</button></span></div>`
      : `<form class="td-alarm-row" data-form="alarm" autocomplete="off">
          ${alarm ? '<span class="td-alarm-label td-muted">Stopped</span>' : ""}
          <label class="td-time"><span class="td-sr">Alarm time</span><input type="time" name="time" value="${suggestAlarmTime(state)}" data-k="time"></label>
          <button type="submit" class="td-pill" data-k="set-alarm">Set alarm</button></form>`;
    return `<header class="td-nav"><button type="button" class="td-back" data-act="back" data-k="back">${ICON.chevronLeft}<span>Notes</span></button>
        <button type="button" class="td-icon" data-act="delete" data-k="delete" aria-label="Delete note">${ICON.trash}</button></header>
      <div class="td-editor">
        <label class="td-sr" for="td-title">Title</label>
        <input id="td-title" class="td-title" data-field="title" data-k="title" type="text" value="${esc(n.title)}" placeholder="Title" enterkeyhint="done" autocomplete="off">
        <label class="td-sr" for="td-body">Note</label>
        <textarea id="td-body" class="td-body" data-field="body" data-k="body" rows="3" placeholder="Note">${esc(n.body)}</textarea>
        <button type="button" class="td-generate" data-act="generate" data-k="generate"${n.title.trim() ? "" : " disabled"}>${ICON.sparkle}<span>Generate</span></button>
        <h3 class="td-group-title">Subtasks</h3>
        <div class="td-group"><ul class="td-subs">${subs}</ul>
          <form class="td-add" data-form="sub" autocomplete="off"><label class="td-sr" for="td-new-sub">New subtask</label><input id="td-new-sub" name="text" type="text" placeholder="Add subtask" enterkeyhint="done" data-k="new-sub"><button type="submit" class="td-pill" data-k="add-sub">Add</button></form></div>
        <h3 class="td-group-title">Alarm</h3>
        <div class="td-group td-group-pad">${alarmBlock}</div>
      </div>`;
  }

  function alertHTML(n: Note) {
    return `<div class="td-alert">
        <span class="td-alert-icon">${ICON.bellLarge}</span>
        <p class="td-alert-kicker">Alarm</p>
        <h3 id="td-alert-title">${esc(n.title.trim() || "New note")}</h3>
        <p class="td-alert-time">${formatTime(state.now)}</p>
        <div class="td-alert-actions">
          <button type="button" class="td-stop" data-act="stop" data-k="stop">Stop</button>
          <button type="button" class="td-snooze" data-act="snooze" data-k="snooze">Snooze<small>${SNOOZE_MINUTES} min</small></button>
        </div></div>`;
  }

  function siriHTML() {
    const done = siri.reply !== null;
    return `<div class="td-siri-card">
        <span class="td-orb" aria-hidden="true"></span>
        <p class="td-siri-intent"><span class="td-siri-app">T</span><span><strong>${SIRI_INTENT.title}</strong><small>Todoo shortcut</small></span></p>
        <blockquote class="td-phrase"><span class="td-phrase-icon">${ICON.mic}</span>“Hey Siri, ${SIRI_INTENT.phrase.toLowerCase()}”</blockquote>
        ${
          done
            ? `<p class="td-siri-reply" id="td-siri-reply">${esc(siri.reply!)}</p>
               <div class="td-siri-actions"><button type="button" class="td-pill td-pill-solid" data-act="siri-done" data-k="siri-done">Done</button></div>`
            : `<form data-form="siri" autocomplete="off">
                <label class="td-siri-q" for="td-siri-title">${SIRI_INTENT.question}</label>
                <input id="td-siri-title" name="title" type="text" value="${esc(siri.title)}" placeholder="Note title" enterkeyhint="done" data-k="siri-title">
                <div class="td-siri-actions"><button type="button" class="td-pill td-pill-quiet" data-act="siri-cancel" data-k="siri-cancel">Cancel</button><button type="submit" class="td-pill td-pill-solid" data-k="siri-run">Run</button></div>
              </form>`
        }
      </div>`;
  }

  /* ---------- rendering ---------- */

  function render() {
    const active = document.activeElement as HTMLElement | null;
    const key =
      pendingFocus ??
      (active && root.contains(active)
        ? active.closest<HTMLElement>("[data-k]")?.dataset.k
        : null);
    pendingFocus = null;

    const note = current();
    if (view.name === "note" && !note) view = { name: "list" };
    const name = view.name === "note" ? `note-${view.id}` : "list";
    const switched = name !== lastView;
    lastView = name;
    const top = screen.scrollTop;
    screen.innerHTML = note ? noteHTML(note) : listHTML();
    screen.scrollTop = switched ? 0 : top;
    clock.textContent = formatClock(state.now);

    const ringingNote = state.notes.find((n) => n.id === state.ringing);
    const wasRinging = !alarmLayer.hidden;
    alarmLayer.hidden = !ringingNote;
    if (ringingNote) {
      alarmLayer.innerHTML = alertHTML(ringingNote);
      if (!wasRinging) pendingFocus = "stop";
    } else alarmLayer.replaceChildren();

    siriLayer.hidden = !siri.open;
    if (siri.open && !siriLayer.querySelector(".td-siri-card"))
      siriLayer.innerHTML = siriHTML();
    if (!siri.open) siriLayer.replaceChildren();

    const covered = !!ringingNote || siri.open;
    screen.inert = covered;
    status.inert = covered;
    siriButton.disabled = !!ringingNote;

    const target = pendingFocus ?? key;
    pendingFocus = null;
    if (target) {
      const scope = ringingNote ? alarmLayer : siri.open ? siriLayer : screen;
      scope.querySelector<HTMLElement>(`[data-k="${target}"]`)?.focus({
        preventScroll: true,
      });
    }
  }

  function renderSiri(focus?: string) {
    siriLayer.hidden = !siri.open;
    siriLayer.innerHTML = siri.open ? siriHTML() : "";
    screen.inert = status.inert = siri.open;
    if (focus)
      siriLayer
        .querySelector<HTMLElement>(`[data-k="${focus}"]`)
        ?.focus({ preventScroll: true });
  }

  /* ---------- events ---------- */

  screen.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!el || el.hasAttribute("disabled")) return;
    const note = current();
    switch (el.dataset.act) {
      case "open":
        view = { name: "note", id: el.dataset.id! };
        pendingFocus = "back";
        break;
      case "new": {
        const added = addNote(state);
        state = added.state;
        view = { name: "note", id: added.id };
        pendingFocus = "title";
        break;
      }
      case "back": {
        const empty =
          note &&
          !note.title.trim() &&
          !note.body.trim() &&
          !note.subtasks.length &&
          !note.alarm;
        if (note && empty) state = deleteNote(state, note.id);
        pendingFocus = note && !empty ? `open-${note.id}` : "new";
        view = { name: "list" };
        break;
      }
      case "delete":
        if (note) {
          state = deleteNote(state, note.id);
          view = { name: "list" };
          pendingFocus = "new";
          say("Note deleted");
        }
        break;
      case "generate":
        if (note) {
          state = applyGenerate(state, note.id);
          say("Note generated");
        }
        break;
      case "remove-sub":
        if (note) {
          const sid = el.dataset.sid!;
          state = removeSubtask(state, note.id, sid);
          pendingFocus = "new-sub";
        }
        break;
      case "cancel-alarm":
        if (note) {
          state = cancelAlarm(state, note.id);
          pendingFocus = "time";
          say("Alarm cancelled");
        }
        break;
      case "fire":
        if (note) state = fireAlarm(state, note.id);
        break;
    }
    render();
  });

  screen.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    const note = current();
    if (note && el.dataset.sub) {
      state = toggleSubtask(state, note.id, el.dataset.sub);
      render();
    }
  });

  screen.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement | HTMLTextAreaElement;
    const note = current();
    if (!note) return;
    if (el.dataset.field === "title") {
      state = setTitle(state, note.id, el.value);
      screen
        .querySelector<HTMLButtonElement>("[data-act='generate']")!
        .toggleAttribute("disabled", !el.value.trim());
    } else if (el.dataset.field === "body") {
      state = setBody(state, note.id, el.value);
    }
  });

  screen.addEventListener("submit", (e) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const note = current();
    if (!note) return;
    if (form.dataset.form === "sub") {
      const input = form.elements.namedItem("text") as HTMLInputElement;
      state = addSubtask(state, note.id, input.value);
      pendingFocus = "new-sub";
      render();
    } else if (form.dataset.form === "alarm") {
      const time = (form.elements.namedItem("time") as HTMLInputElement).value;
      state = scheduleAlarm(state, note.id, time);
      const alarm = state.notes.find((n) => n.id === note.id)?.alarm;
      if (alarm) say(`Alarm set for ${alarmLabel(state, alarm)}`);
      pendingFocus = "fire";
      render();
    }
  });

  alarmLayer.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!el) return;
    const id = state.ringing;
    if (el.dataset.act === "stop") {
      state = stopAlarm(state);
      say("Alarm stopped");
    } else if (el.dataset.act === "snooze") {
      state = snoozeAlarm(state);
      const note = state.notes.find((n) => n.id === id);
      say(`Snoozed until ${formatTime(note?.alarm?.at ?? state.now)}`);
    } else return;
    const alarm = state.notes.find((n) => n.id === id)?.alarm;
    pendingFocus =
      view.name !== "note"
        ? `open-${id}`
        : alarm?.status === "stopped"
          ? "time"
          : "fire";
    render();
  });

  function closeSiri() {
    siri = { open: false, title: "", reply: null };
    renderSiri();
    siriButton.focus({ preventScroll: true });
  }

  siriLayer.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!el) return;
    if (el.dataset.act === "siri-cancel" || el.dataset.act === "siri-done")
      closeSiri();
  });
  siriLayer.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.name === "title") siri.title = el.value;
  });
  siriLayer.addEventListener("submit", (e) => {
    e.preventDefault();
    const result = siriAddNote(state, siri.title);
    if (!result.id) {
      siriLayer.querySelector<HTMLElement>("[data-k='siri-title']")?.focus();
      return;
    }
    state = result.state;
    view = { name: "list" };
    siri = { ...siri, reply: result.reply };
    render();
    renderSiri("siri-done");
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && siri.open) closeSiri();
  });

  siriButton.addEventListener("click", () => {
    siri = { open: true, title: "", reply: null };
    renderSiri("siri-title");
  });
  q("[data-reset]").addEventListener("click", () => {
    state = initialState();
    view = { name: "list" };
    siri = { open: false, title: "", reply: null };
    toast.classList.remove("is-on");
    renderSiri();
    render();
  });

  render();
}

document.querySelectorAll<HTMLElement>('[data-demo="todoo-app"]').forEach(init);
