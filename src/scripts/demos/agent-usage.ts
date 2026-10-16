import {
  accounts,
  MAX_MINUTES,
  snapshot,
  countdown,
  clockLabel,
  findSessions,
  togglePin,
  initialPins,
  type AccountId,
  type WindowId,
} from "../../data/demos/agent-usage";

function init(root: HTMLElement) {
  const q = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const all = <T extends HTMLElement = HTMLElement>(selector: string) => [
    ...root.querySelectorAll<T>(selector),
  ];
  const clock = q<HTMLInputElement>("[data-clock-input]");
  const search = q<HTMLInputElement>("[data-search]");
  const filter = q<HTMLSelectElement>("[data-session-account]");
  const overlay = q("[data-overlay]");
  const escape = (text: string) =>
    text.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
  let state = snapshot(0);
  let active: AccountId = "lumen";
  let windowId: WindowId = "fiveHour";
  let panel: "usage" | "sessions" | "notifications" | null = "usage";
  let held = false;
  let visible = true;
  let pins = [...initialPins];
  const read = new Set<string>();
  const cleared = new Set<string>();

  function paintUsage() {
    const account = state.accounts.find((item) => item.id === active)!;
    q("[data-account-title]").textContent =
      `${account.provider} · ${account.alias}`;
    q("[data-account-sessions]").setAttribute(
      "aria-label",
      `Recent sessions for ${account.provider} ${account.alias}`,
    );
    q("[data-hold-status]").textContent = held ? "Held open" : "Peek";
    for (const window of account.windows) {
      const element = q(`[data-usage-window="${window.id}"]`);
      element.querySelector("[data-used]")!.textContent =
        `${Math.round(window.used)}% used`;
      element.querySelector("[data-reset]")!.textContent =
        `Resets in ${countdown(window.resetsIn)}`;
      element.querySelector("[data-left]")!.textContent =
        `${Math.round(100 - window.used)}% left`;
      const meter = element.querySelector<HTMLElement>("[role=meter]")!;
      meter.setAttribute("aria-valuenow", (100 - window.used).toFixed(1));
      meter.setAttribute(
        "aria-valuetext",
        `${Math.round(100 - window.used)}% remaining; resets in ${countdown(window.resetsIn)}`,
      );
      const fill = element.querySelector<HTMLElement>(".usage-fill")!;
      fill.style.width = `${100 - window.used}%`;
      fill.style.background = window.used >= 80 ? "#f3c765" : account.color;
      element.querySelector<HTMLElement>(".time-marker")!.style.left =
        `${window.timeLeft}%`;
    }
  }

  function paintSessions() {
    const rows = findSessions(search.value, filter.value, pins);
    q("[data-session-count]").textContent =
      `${rows.length} ${rows.length === 1 ? "chat" : "chats"} · ${rows.filter((row) => pins.includes(row.id)).length} pinned`;
    q("[data-session-list]").innerHTML =
      rows
        .map((session) => {
          const account = accounts.find((item) => item.id === session.account)!;
          const pinned = pins.includes(session.id);
          return `<article class="session-row"><div><strong>${escape(session.title)}</strong><span>${account.provider} · ${account.alias} / ${escape(session.workspace)}</span><small>${session.status} · ${countdown(session.age + state.minute)} ago</small></div><button type="button" data-pin="${session.id}" aria-pressed="${pinned}" aria-label="${pinned ? "Unpin" : "Pin"} ${escape(session.title)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l-1 7 4 4H5l4-4-1-7ZM12 14v7"/></svg></button></article>`;
        })
        .join("") || '<p class="empty-state">No chats found.</p>';
  }

  function paintNotices() {
    const notices = state.notices.filter((notice) => !cleared.has(notice.id));
    if (panel === "notifications" && visible)
      notices.forEach((notice) => read.add(notice.id));
    const unread = notices.filter((notice) => !read.has(notice.id)).length;
    q("[data-unread]").hidden = unread === 0;
    q("[data-bell]").setAttribute(
      "aria-label",
      `Notifications, ${unread} unread`,
    );
    q<HTMLButtonElement>("[data-clear]").disabled = notices.length === 0;
    q("[data-notice-list]").innerHTML =
      notices
        .map((notice) => {
          const account = accounts.find((item) => item.id === notice.account)!;
          return `<article class="notice-row"><small>${notice.kind} · ${account.provider} ${account.alias} · ${countdown(state.minute - notice.minute)} ago</small><strong>${escape(notice.title)}</strong><p>${escape(notice.body)}</p></article>`;
        })
        .join("") || '<p class="empty-state">No notifications.</p>';
  }

  function paint() {
    overlay.hidden = !visible;
    q("[data-attached]").hidden = panel === null;
    all("[data-panel]").forEach((element) => {
      element.hidden = element.dataset.panel !== panel;
    });
    all<HTMLButtonElement>("[data-account]").forEach((button) => {
      const account = state.accounts.find(
        (item) => item.id === button.dataset.account,
      )!;
      const window = account.windows.find((item) => item.id === windowId)!;
      const remaining = Math.round(100 - window.used);
      button.querySelector("[data-gauge-value]")!.textContent = `${remaining}%`;
      button.querySelector("[data-gauge-reset]")!.textContent = countdown(
        window.resetsIn,
      );
      button
        .querySelector(".ring-fill")!
        .setAttribute("stroke-dasharray", `${remaining} 100`);
      button.setAttribute(
        "aria-label",
        `${account.provider} ${account.alias}: ${remaining}% remaining, ${window.label}. Resets in ${countdown(window.resetsIn)}`,
      );
      button.setAttribute(
        "aria-pressed",
        String(held && panel === "usage" && active === account.id),
      );
      button.setAttribute(
        "aria-expanded",
        String(panel === "usage" && active === account.id),
      );
    });
    all("[data-window-choice]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.windowChoice === windowId),
      ),
    );
    q("[data-bell]").setAttribute(
      "aria-pressed",
      String(panel === "notifications" && held),
    );
    q("[data-bell]").setAttribute(
      "aria-expanded",
      String(panel === "notifications"),
    );
    q("[data-sessions]").setAttribute(
      "aria-pressed",
      String(panel === "sessions" && visible),
    );
    q("[data-reveal]").setAttribute("aria-pressed", String(visible));
    q("[data-reveal]").innerHTML = visible
      ? "Hide notch <kbd>Escape</kbd>"
      : "Reveal notch <kbd>Scroll Lock</kbd>";
    const time = clockLabel(state.minute);
    clock.value = String(state.minute);
    clock.setAttribute(
      "aria-valuetext",
      `${time}, ${state.minute} minutes elapsed`,
    );
    q("[data-clock]").textContent = time;
    q("[data-desktop-clock]").textContent = time;
    q<HTMLButtonElement>("[data-advance]").disabled =
      state.minute >= MAX_MINUTES;
    paintUsage();
    paintSessions();
    paintNotices();
  }

  function peek(account: AccountId) {
    if (held || panel === "sessions") return;
    active = account;
    panel = "usage";
    paint();
  }

  all<HTMLButtonElement>("[data-account]").forEach((button) => {
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch")
        peek(button.dataset.account as AccountId);
    });
    button.addEventListener("focus", () =>
      peek(button.dataset.account as AccountId),
    );
    button.addEventListener("click", () => {
      const account = button.dataset.account as AccountId;
      if (held && active === account && panel === "usage") {
        panel = null;
        held = false;
      } else {
        active = account;
        panel = "usage";
        held = true;
      }
      paint();
    });
  });
  overlay.addEventListener("pointerleave", () => {
    if (!held && !overlay.contains(document.activeElement)) {
      panel = null;
      paint();
    }
  });
  overlay.addEventListener("focusout", (event) => {
    if (
      !held &&
      !(
        event.relatedTarget instanceof Node &&
        overlay.contains(event.relatedTarget)
      )
    ) {
      panel = null;
      paint();
    }
  });
  all("[data-window-choice]").forEach((button) =>
    button.addEventListener("click", () => {
      windowId = button.dataset.windowChoice as WindowId;
      paint();
    }),
  );
  function showLog(hold: boolean) {
    panel = "notifications";
    held = hold;
    q("[data-alert]").hidden = true;
    paint();
  }
  q("[data-bell]").addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch" && !held && !q("[data-unread]").hidden)
      showLog(false);
  });
  q("[data-bell]").addEventListener("click", () => {
    if (panel === "notifications" && held) {
      panel = null;
      held = false;
      paint();
    } else showLog(true);
  });
  function showSessions(account: string) {
    visible = true;
    panel = "sessions";
    held = true;
    filter.value = account;
    search.value = "";
    paint();
    search.focus();
  }
  q("[data-account-sessions]").addEventListener("click", () =>
    showSessions(active),
  );
  q("[data-sessions]").addEventListener("click", () => {
    if (panel === "sessions" && visible) {
      panel = null;
      held = false;
      paint();
    } else showSessions("all");
  });
  q("[data-back]").addEventListener("click", () => {
    q<HTMLButtonElement>(`[data-account="${active}"]`).focus();
    panel = "usage";
    held = true;
    paint();
  });
  all("[data-close]").forEach((button) =>
    button.addEventListener("click", () => {
      const target =
        panel === "notifications"
          ? "[data-bell]"
          : panel === "sessions"
            ? "[data-sessions]"
            : `[data-account="${active}"]`;
      q<HTMLButtonElement>(target).focus();
      panel = null;
      held = false;
      paint();
    }),
  );
  search.addEventListener("input", paintSessions);
  filter.addEventListener("change", paintSessions);
  q("[data-session-list]").addEventListener("click", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-pin]")
        : null;
    if (!button) return;
    const id = button.dataset.pin!;
    pins = togglePin(pins, id);
    paintSessions();
    q<HTMLButtonElement>(`[data-pin="${id}"]`).focus();
  });
  q("[data-clear]").addEventListener("click", () => {
    state.notices.forEach((notice) => cleared.add(notice.id));
    q<HTMLButtonElement>("[data-bell]").focus();
    paintNotices();
    q("[data-status]").textContent =
      `${clockLabel(state.minute)} · Notification log cleared`;
  });
  q("[data-reveal]").addEventListener("click", () => {
    visible = !visible;
    panel = null;
    held = false;
    q("[data-alert]").hidden = true;
    paint();
  });
  function advance(value: number) {
    const previous = state;
    state = snapshot(value);
    const newNotice = state.notices.find(
      (notice) => !previous.notices.some((old) => old.id === notice.id),
    );
    const resetAccount = state.accounts.find(
      (account, index) =>
        account.windows[0].cycle > previous.accounts[index].windows[0].cycle,
    );
    const reset = resetAccount
      ? `${resetAccount.provider} · ${resetAccount.alias}: 5-hour window reset · ${Math.round(100 - resetAccount.windows[0].used)}% remaining`
      : "";
    q("[data-alert]").hidden =
      !visible || panel === "notifications" || !(newNotice || reset);
    if (newNotice || reset) {
      q("[data-alert-title]").textContent = reset
        ? "Allowance renewed"
        : newNotice!.title;
      q("[data-alert-body]").textContent = reset || newNotice!.body;
    }
    q("[data-status]").textContent =
      `${clockLabel(state.minute)} · ${reset || (newNotice ? `${newNotice.title}. ${newNotice.body}` : "All accounts updated")}`;
    paint();
  }
  clock.addEventListener("input", () => advance(Number(clock.value)));
  q("[data-advance]").addEventListener("click", () =>
    advance(state.minute + 15),
  );
  q("[data-reset-demo]").addEventListener("click", () => {
    state = snapshot(0);
    active = "lumen";
    windowId = "fiveHour";
    panel = "usage";
    held = false;
    visible = true;
    pins = [...initialPins];
    read.clear();
    cleared.clear();
    search.value = "";
    filter.value = "all";
    q("[data-alert]").hidden = true;
    q("[data-status]").textContent = "09:00 · All accounts updated";
    paint();
    q("[data-session-list]").scrollTop = 0;
    q("[data-notice-list]").scrollTop = 0;
  });
  paint();
}

document
  .querySelectorAll<HTMLElement>('[data-demo="agent-usage"]')
  .forEach(init);
