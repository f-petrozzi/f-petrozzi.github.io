import {
  accounts,
  MAX_MINUTES,
  snapshot,
  countdown,
  clockLabel,
  findSessions,
  togglePin,
  initialPins,
  motion,
  spring,
  usageColor,
  providerPaths,
  starPath,
  type AccountId,
  type WindowId,
  type Notice,
} from "../../data/demos/agent-usage";

type Panel = "usage" | "sessions" | "notifications" | null;
type SpringState = { value: number; velocity: number; target: number };
const channel = (value: number): SpringState => ({
  value,
  velocity: 0,
  target: value,
});

function init(root: HTMLElement) {
  const q = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const all = <T extends HTMLElement = HTMLElement>(selector: string) => [
    ...root.querySelectorAll<T>(selector),
  ];
  const clock = q<HTMLInputElement>("[data-clock-input]");
  const search = q<HTMLInputElement>("[data-search]");
  const filter = q<HTMLSelectElement>("[data-session-account]");
  const overlay = q("[data-overlay]");
  const frame = q("[data-frame]");
  const attached = q("[data-attached]");
  const ink = q<SVGElement>("[data-panel-ink]");
  const liquid = q<SVGElement>("[data-liquid]");
  const goo = q<SVGElement>("[data-goo]");
  const notchInk = q<SVGElement>("[data-notch-ink]");
  const bellDisc = q<SVGElement>("[data-bell-disc]");
  const bellNeck = q<SVGElement>("[data-bell-neck]");
  const content = q("[data-panel-content]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
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
  const glyph = (provider: string, className: string) =>
    `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true"><path d="${providerPaths[provider === "Codex" ? "codex" : "claude"]}"/></svg>`;
  let state = snapshot(0);
  let active: AccountId = "lumen";
  let windowId: WindowId = "fiveHour";
  let panel: Panel = "usage";
  let held = false;
  let pinned = false;
  let visible = true;
  let pins = [...initialPins];
  const read = new Set<string>();
  const cleared = new Set<string>();
  const enabled = new Set<Notice["kind"]>(["Usage", "Waiting", "Finished"]);
  let peekTimer: ReturnType<typeof setTimeout> | undefined;
  let leaveTimer: ReturnType<typeof setTimeout> | undefined;
  let alertTimer: ReturnType<typeof setTimeout> | undefined;
  let pointerInside = false;
  let inViewport = true;
  let suspended = false;
  let movedX = 0;
  let dragging: { id: number; start: number; from: number } | null = null;
  let restAt = { x: -99, y: -99 };
  let pendingAccount: AccountId | null = null;
  // Match the revealed server render before any animation frame or pointer input.
  const opening = channel(1);
  const detail = channel(1);
  // Keep the reference's revealed bell visible, including without hover/touch.
  const bell = channel(1);
  const arms = all<HTMLButtonElement>("[data-arm]").map((element) => ({
    element,
    hover: channel(0),
    material: q<SVGElement>(`[data-arm-material="${element.dataset.arm}"]`),
    disc: q<SVGElement>(`[data-arm-disc="${element.dataset.arm}"]`),
    neck: q<SVGElement>(`[data-arm-neck="${element.dataset.arm}"]`),
    icon: element.querySelector<SVGElement>("[data-arm-glyph]")!,
  }));
  let armsOut = 1;
  let armTween: {
    from: number;
    target: number;
    start: number;
    duration: number;
  } | null = null;
  let stow: { from: number; start: number } | null = null;
  let raf = 0;
  let last = 0;
  const accents = new Set<Animation>();

  function accent(element: Element, frames: Keyframe[], duration: number) {
    if (reduce.matches || suspended) return;
    const animation = element.animate(frames, {
      duration,
      easing: "cubic-bezier(.22,1,.36,1)",
    });
    accents.add(animation);
    animation.onfinish = animation.oncancel = () => accents.delete(animation);
  }
  function wake() {
    if (!raf && !suspended && inViewport && !document.hidden)
      raf = requestAnimationFrame(tick);
  }
  function step(
    value: SpringState,
    response: number,
    damping: number,
    dt: number,
  ) {
    if (reduce.matches || suspended) {
      value.value = value.target;
      value.velocity = 0;
      return false;
    }
    [value.value, value.velocity] = spring(
      value.value,
      value.velocity,
      value.target,
      response,
      damping,
      dt,
    );
    const moving =
      Math.abs(value.value - value.target) >= 0.002 ||
      Math.abs(value.velocity) >= 0.025;
    if (!moving) {
      value.value = value.target;
      value.velocity = 0;
    }
    return moving;
  }
  function moveArms(target: number) {
    if (reduce.matches || suspended) {
      armsOut = target;
      armTween = null;
    } else
      armTween = {
        from: armsOut,
        target,
        start: performance.now(),
        duration: target ? motion.armEmerge : motion.armAbsorb,
      };
    wake();
  }
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const smooth = (value: number) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  };
  // notch.js handleMetrics for a 90px top notch: sqrt(90 / 70).
  // shape.js partPath joins filled flares (F=43.88) directly to the body.
  // Hover-only handle drops have radius=27.21; no detached resting strokes.
  // Only resize changes SVG geometry. Motion writes transforms and opacity.
  let inkScaleX = 1;
  let materialMoving = false;
  function attr(element: Element, name: string, value: string) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  function sizeMaterial() {
    const width = q(".notch").clientWidth || 228;
    const panelWidth = attached.offsetWidth || 340;
    const panelHeight = attached.offsetHeight || 270;
    inkScaleX = width / 228;
    attr(ink, "x", String(-panelWidth / inkScaleX / 2));
    attr(ink, "width", String(panelWidth / inkScaleX));
    attr(ink, "height", String(panelHeight));
    paintMotion(materialMoving);
  }
  function paintMotion(moving = false) {
    materialMoving = moving;
    // The source's half-alpha cutback (sigma=4, k=sigma*2.6) merges
    // only the black material. Text, glyphs and focus rings stay sharp.
    if (moving && !reduce.matches && !suspended)
      attr(liquid, "filter", `url(#${goo.id})`);
    else liquid.removeAttribute("filter");
    // Reveal wells out from the edge; stow slides the joined body away.
    frame.style.transform = `translateY(${visible ? 0 : (opening.value - 1) * 96}px)`;
    frame.style.opacity = String(clamp(opening.value * 3));
    const o = Math.max(0, opening.value);
    notchInk.style.transformOrigin = "114px 0";
    notchInk.style.transform = `scale(${0.75 + 0.25 * o}, ${visible ? o : 1})`;
    q(".account-gauges").style.transform =
      `translateY(${(opening.value - 1) * 35}px)`;
    const d = Math.max(0, detail.value);
    ink.style.transform = `scale(${0.67 + 0.33 * d}, ${d})`;
    content.style.transform = `translateY(${(1 - d) * -12}px)`;
    content.style.opacity = String(clamp((d - 0.25) / 0.65));
    if (!panel && detail.value === 0) attached.hidden = true;
    if (!visible && opening.value === 0) overlay.hidden = true;
    for (const { element, hover, material, disc, neck, icon } of arms) {
      const h = clamp(hover.value);
      const side = element.dataset.arm === "pin" ? -1 : 1;
      const lift = smooth((h - 0.28) / 0.72);
      const x = -side * 22.93 * (1 - lift);
      const y = -22.93 * (1 - lift) + 6 * Math.sin(Math.PI * lift);
      const out = armsOut * smooth((o - 0.6) / 0.4);
      material.style.transform = `translate(${-side * (1 - out) * 21}px, ${-(1 - out) * 21}px)`;
      material.style.opacity = String(clamp(o * 3));
      element.style.opacity = String(out);
      element.inert = !visible || out < 0.1;
      disc.style.transform = `translate(${x}px, ${y}px) scale(${0.22 + 0.78 * lift})`;
      disc.style.opacity = String(smooth(h / 0.2));
      neck.style.opacity = String(
        smooth(lift / 0.15) * (1 - smooth((lift - 0.82) / 0.18)),
      );
      neck.style.transformOrigin = "40px -39px";
      neck.style.transform = `scale(${0.3 + 0.7 * lift})`;
      icon.style.transform = `translate(${x * inkScaleX}px, ${y}px) scale(${0.5 + 0.5 * lift}) rotate(${side * (1 - lift) * -25}deg)`;
      icon.style.opacity = String(smooth((lift - 0.45) / 0.4) * out);
    }
    // shape.js drawSprout: the bell leaves C=(20,70) on the corner's
    // bisector, with a 4px gap and a 21.77px radius, rather than sitting
    // against the notch. The unread dot rides onto its shoulder.
    const b = Math.max(0, bell.value);
    const k = 12.9 + (45.77 - 12.9) * b;
    const bx = 20 - Math.SQRT1_2 * k;
    const by = 70 + Math.SQRT1_2 * k;
    bellDisc.style.transform = `translate(${bx}px, ${by}px) scale(${0.28 + 0.72 * smooth(b)})`;
    bellDisc.style.opacity = b > 0.004 ? "1" : "0";
    bellNeck.style.opacity = String(
      smooth(b / 0.15) * (1 - smooth((b - 0.72) / 0.16)),
    );
    bellNeck.style.transformOrigin = "12.93px 77.07px";
    bellNeck.style.transform = `scale(${0.3 + 0.7 * clamp(b)})`;
    // HTML targets are centred on the revealed drop, as in notify.js.
    const homeX = 20 - Math.SQRT1_2 * 45.77;
    const homeY = 70 + Math.SQRT1_2 * 45.77;
    const dx = (bx - homeX) * inkScaleX;
    const dy = by - homeY;
    q("[data-bell-glyph]").style.transform =
      `translate(${dx}px, ${dy}px) scale(${0.28 + 0.72 * smooth(b)}) rotate(${(1 - b) * -20}deg)`;
    q("[data-bell-glyph]").style.opacity = String(smooth((b - 0.45) / 0.4));
    q("[data-unread]").style.transform =
      `translate(${dx + 7.45 * smooth(b)}px, ${dy - 8.54 * smooth(b)}px)`;
  }
  // Invert the renderer's stow cubic-bezier(.55,0,.8,.3).
  function stowEase(t: number) {
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 12; i++) {
      const u = (lo + hi) / 2,
        v = 1 - u;
      if (3 * v * v * u * 0.55 + 3 * v * u * u * 0.8 + u ** 3 < t) lo = u;
      else hi = u;
    }
    const u = (lo + hi) / 2;
    return 3 * (1 - u) * u * u * 0.3 + u ** 3;
  }
  function tick(now: number) {
    raf = 0;
    const dt = Math.min(0.1, (now - (last || now - 16)) / 1000);
    last = now;
    let moving = false;
    if (visible) {
      moving = step(opening, motion.open.response, motion.open.damping, dt);
      if (!dragging && armsOut === 0 && !armTween && opening.value > 0.78)
        moveArms(1);
    } else if (stow) {
      const t = reduce.matches
        ? 1
        : Math.max(0, Math.min(1, (now - stow.start - motion.armAbsorb) / 240));
      opening.value = stow.from * (1 - stowEase(t));
      opening.velocity = 0;
      if (t === 1) {
        opening.value = 0;
        stow = null;
      } else moving = true;
    }
    const config = detail.target ? motion.detailOpen : motion.detailClose;
    moving = step(detail, config.response, config.damping, dt) || moving;
    moving =
      step(bell, bell.target ? 0.78 : 0.56, bell.target ? 0.6 : 0.9, dt) ||
      moving;
    for (const { hover } of arms) {
      const config = hover.target ? motion.armHover : motion.armReturn;
      moving = step(hover, config.response, config.damping, dt) || moving;
    }
    if (armTween) {
      const t = reduce.matches
        ? 1
        : Math.min(1, (now - armTween.start) / armTween.duration);
      const eased = armTween.target ? t * t * (3 - 2 * t) : t * t;
      armsOut = armTween.from + (armTween.target - armTween.from) * eased;
      if (t === 1) armTween = null;
      else moving = true;
    }
    paintMotion(moving);
    if (moving) wake();
    else last = 0;
  }
  function stopTimers() {
    clearTimeout(peekTimer);
    clearTimeout(leaveTimer);
    clearTimeout(alertTimer);
    pendingAccount = null;
  }
  function hideAlert() {
    clearTimeout(alertTimer);
    q("[data-alert]").hidden = true;
  }
  function closePanel() {
    clearTimeout(peekTimer);
    clearTimeout(leaveTimer);
    pendingAccount = null;
    panel = null;
    held = false;
    paint();
  }
  function setPanel(next: Exclude<Panel, null>, hold: boolean) {
    clearTimeout(peekTimer);
    clearTimeout(leaveTimer);
    pendingAccount = null;
    hideAlert();
    const changed = panel !== next;
    panel = next;
    held = hold;
    paint();
    if (changed && detail.value > 0.985)
      accent(content, [{ opacity: 0.55 }, { opacity: 1 }], 180);
  }
  function setVisible(next: boolean) {
    stopTimers();
    hideAlert();
    visible = next;
    overlay.hidden = false;
    frame.inert = !visible;
    if (visible) {
      stow = null;
      opening.target = 1;
      bell.target = 1;
      if (reduce.matches) {
        opening.value = 1;
        moveArms(1);
      }
      for (const svg of root.querySelectorAll(".ring-reading"))
        accent(
          svg,
          [
            { transform: "rotate(-100deg)", opacity: 0 },
            { transform: "rotate(0deg)", opacity: 1 },
          ],
          650,
        );
    } else {
      closePanel();
      opening.target = 0;
      stow = { from: opening.value, start: performance.now() };
      bell.target = 0;
      arms.forEach(({ hover }) => (hover.target = 0));
      moveArms(0);
    }
    paint();
  }
  function paintUsage() {
    const account = state.accounts.find((item) => item.id === active)!;
    q("[data-account-title]").textContent =
      `${account.provider} ${account.alias}`;
    q("[data-title-mark]").setAttribute(
      "d",
      providerPaths[account.provider === "Codex" ? "codex" : "claude"],
    );
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
      meter.setAttribute("aria-valuenow", window.used.toFixed(1));
      meter.setAttribute(
        "aria-valuetext",
        `${Math.round(window.used)}% used; ${Math.round(100 - window.used)}% remaining; resets in ${countdown(window.resetsIn)}`,
      );
      const fill = element.querySelector<HTMLElement>(".usage-fill")!;
      fill.style.transform = `scaleX(${window.used / 100})`;
      fill.style.background = usageColor(window.used);
      element.querySelector<HTMLElement>(".time-marker")!.style.left =
        `${100 - window.timeLeft}%`;
    }
    const recent = findSessions("", active, []).find(
      (session) => session.status !== "Finished",
    );
    q("[data-current-session]").hidden = !recent;
    if (recent) {
      q("[data-current-session-title]").textContent = recent.title;
      q("[data-current-session-status]").textContent = recent.status;
      q(".session-signal").style.background =
        recent.status === "Waiting" ? "#f2ff00" : "#fff";
    }
  }
  function paintSessions() {
    const rows = findSessions(search.value, filter.value, pins);
    q("[data-session-count]").textContent =
      `${rows.length} ${rows.length === 1 ? "chat" : "chats"} / ${rows.filter((row) => pins.includes(row.id)).length} pinned`;
    let previousGroup = "";
    q("[data-session-list]").innerHTML =
      rows
        .map((session) => {
          const account = accounts.find((item) => item.id === session.account)!;
          const pinned = pins.includes(session.id);
          const group = pinned ? "Pinned" : "Recent";
          const heading =
            group === previousGroup
              ? ""
              : `<div class="session-section">${group}</div>`;
          previousGroup = group;
          return `${heading}<article class="session-row">${glyph(account.provider, "session-mark")}<div><strong>${escape(session.title)}</strong><span>${account.provider} ${account.alias} / ${session.status}</span><small>${escape(session.workspace)} / ${countdown(session.age + state.minute)} ago</small></div><button type="button" data-pin="${session.id}" aria-pressed="${pinned}" aria-label="${pinned ? "Unpin" : "Pin"} ${escape(session.title)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="${starPath}"/></svg></button></article>`;
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
        .filter((notice) => enabled.has(notice.kind))
        .map((notice) => {
          const account = accounts.find((item) => item.id === notice.account)!;
          return `<article class="notice-row">${glyph(account.provider, "notice-mark")}<strong>${escape(notice.title)}</strong><small>${countdown(state.minute - notice.minute)} ago</small><p>${account.provider} ${account.alias}</p><p>${escape(notice.body)}</p></article>`;
        })
        .join("") || '<p class="empty-state">No notifications.</p>';
  }
  function paint() {
    detail.target = visible && panel ? 1 : 0;
    attached.inert = !panel || !visible;
    attached.setAttribute("aria-hidden", String(!panel || !visible));
    if (panel) {
      attached.hidden = false;
      all("[data-panel]").forEach(
        (element) => (element.hidden = element.dataset.panel !== panel),
      );
    }
    q(".notch").dataset.focused = String(panel === "usage");
    all<HTMLButtonElement>("[data-account]").forEach((button) => {
      const account = state.accounts.find(
        (item) => item.id === button.dataset.account,
      )!;
      const window = account.windows.find((item) => item.id === windowId)!;
      button.querySelector("[data-gauge-value]")!.textContent =
        `${Math.round(window.used)}%`;
      const circle = button.querySelector(".ring-reading circle")!;
      const dash = `${window.used.toFixed(1)} 100`;
      // Gauge writes happen only on input, never in the animation loop.
      if (circle.getAttribute("stroke-dasharray") !== dash)
        circle.setAttribute("stroke-dasharray", dash);
      (circle as SVGElement).style.stroke = usageColor(window.used);
      button.setAttribute(
        "aria-label",
        `${account.provider} ${account.alias}: ${Math.round(window.used)}% used, ${window.label}. Resets in ${countdown(window.resetsIn)}`,
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
    q("[data-reveal]").textContent = visible ? "Hide notch" : "Reveal notch";
    q("[data-arm=pin]").setAttribute("aria-pressed", String(pinned));
    clock.value = String(state.minute);
    clock.setAttribute(
      "aria-valuetext",
      `${clockLabel(state.minute)}, ${state.minute} minutes elapsed`,
    );
    q("[data-clock]").textContent = clockLabel(state.minute);
    q<HTMLButtonElement>("[data-advance]").disabled =
      state.minute >= MAX_MINUTES;
    paintUsage();
    wake();
  }
  function peek(account: AccountId) {
    if (held || panel === "sessions" || !visible) return;
    const changed = active !== account;
    active = account;
    setPanel("usage", false);
    if (changed && detail.value > 0.985)
      accent(content, [{ opacity: 0.55 }, { opacity: 1 }], 180);
  }
  all<HTMLButtonElement>("[data-account]").forEach((button) => {
    function schedule(event: PointerEvent) {
      if (event.pointerType === "touch" || held || panel === "sessions") return;
      const id = button.dataset.account as AccountId;
      if (panel === "usage" && active === id) return;
      if (
        pendingAccount === id &&
        Math.hypot(event.clientX - restAt.x, event.clientY - restAt.y) <= 3
      )
        return;
      clearTimeout(peekTimer);
      restAt = { x: event.clientX, y: event.clientY };
      pendingAccount = id;
      peekTimer = setTimeout(
        () => peek(id),
        panel ? motion.peekSwitch : motion.peekOpen,
      );
    }
    button.addEventListener("pointerenter", schedule);
    button.addEventListener("pointermove", schedule);
    button.addEventListener("pointerleave", () => {
      clearTimeout(peekTimer);
      pendingAccount = null;
    });
    button.addEventListener("focus", () =>
      peek(button.dataset.account as AccountId),
    );
    button.addEventListener("click", () => {
      const id = button.dataset.account as AccountId;
      if (held && active === id && panel === "usage") closePanel();
      else {
        active = id;
        setPanel("usage", true);
      }
    });
  });
  function scheduleLeave() {
    clearTimeout(peekTimer);
    pendingAccount = null;
    clearTimeout(leaveTimer);
    if (
      !panel ||
      panel === "sessions" ||
      (held && pinned) ||
      overlay.querySelector(":focus-visible")
    )
      return;
    leaveTimer = setTimeout(
      closePanel,
      held ? motion.heldAway : motion.peekGrace,
    );
  }
  // Treat the notch and attached panel as one hover surface.
  for (const surface of [q(".notch"), attached, q("[data-alert]")]) {
    surface.addEventListener("pointerenter", () => {
      pointerInside = true;
      clearTimeout(leaveTimer);
    });
    surface.addEventListener("pointerleave", (event) => {
      const next = event.relatedTarget;
      if (
        next instanceof Node &&
        (q(".notch").contains(next) || attached.contains(next))
      )
        return;
      pointerInside = false;
      scheduleLeave();
    });
  }
  overlay.addEventListener("focusin", () => clearTimeout(leaveTimer));
  overlay.addEventListener("focusout", (event) => {
    if (
      !(
        event.relatedTarget instanceof Node &&
        overlay.contains(event.relatedTarget)
      ) &&
      !pointerInside
    )
      scheduleLeave();
  });
  attached.addEventListener("click", (event) => {
    if (
      panel === "usage" &&
      !(
        event.target instanceof Element &&
        event.target.closest("button, input, select")
      )
    ) {
      held = true;
      paintUsage();
    }
  });
  root.addEventListener("pointerdown", (event) => {
    if (
      !(event.target instanceof Element) ||
      event.target.closest(".notch, .attached-panel, .alert-sliver, .controls")
    )
      return;
    if (held) closePanel();
  });
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (panel) {
      q<HTMLButtonElement>(
        panel === "notifications"
          ? "[data-bell]"
          : `[data-account="${active}"]`,
      ).focus();
      closePanel();
    } else {
      q<HTMLButtonElement>("[data-reveal]").focus();
      setVisible(false);
    }
  });
  all("[data-window-choice]").forEach((button) =>
    button.addEventListener("click", () => {
      windowId = button.dataset.windowChoice as WindowId;
      paint();
    }),
  );
  function showLog(hold: boolean) {
    setPanel("notifications", hold);
    paintNotices();
  }
  function giveWayToHandle(isBell = false) {
    // notch.js retracts the card under a handle so the drop can detach.
    if (panel && panel !== "sessions" && !(isBell && panel === "notifications"))
      closePanel();
  }
  q("[data-bell]").addEventListener("pointerenter", (event) => {
    if (event.pointerType === "touch") return;
    giveWayToHandle(true);
    bell.target = 1;
    wake();
  });
  q("[data-bell]").addEventListener("pointerleave", () => {
    bell.target = visible ? 1 : 0;
    wake();
  });
  q("[data-bell]").addEventListener("focus", () => {
    giveWayToHandle(true);
    bell.target = 1;
    wake();
  });
  q("[data-bell]").addEventListener("blur", () => {
    bell.target = visible ? 1 : 0;
    wake();
  });
  q("[data-bell]").addEventListener("click", () => {
    if (panel === "notifications" && held) closePanel();
    else showLog(true);
  });
  q("[data-alert]").addEventListener("click", () => showLog(true));
  function showSessions(account: string) {
    if (!visible) setVisible(true);
    filter.value = account;
    search.value = "";
    paintSessions();
    setPanel("sessions", true);
    search.focus({ preventScroll: true });
  }
  q("[data-account-sessions]").addEventListener("click", () =>
    showSessions(active),
  );
  q("[data-current-session]").addEventListener("click", () =>
    showSessions(active),
  );
  q("[data-back]").addEventListener("click", () => {
    q<HTMLButtonElement>(`[data-account="${active}"]`).focus();
    setPanel("usage", true);
  });
  all("[data-close]").forEach((button) =>
    button.addEventListener("click", () => {
      q<HTMLButtonElement>(
        panel === "notifications"
          ? "[data-bell]"
          : `[data-account="${active}"]`,
      ).focus();
      closePanel();
    }),
  );
  search.addEventListener("input", () => {
    paintSessions();
    q("[data-session-list]").scrollTop = 0;
  });
  filter.addEventListener("change", () => {
    paintSessions();
    q("[data-session-list]").scrollTop = 0;
  });
  q("[data-session-list]").addEventListener("click", (event) => {
    const button =
      event.target instanceof Element
        ? event.target.closest<HTMLButtonElement>("[data-pin]")
        : null;
    if (!button) return;
    const id = button.dataset.pin!;
    pins = togglePin(pins, id);
    const top = q("[data-session-list]").scrollTop;
    paintSessions();
    q<HTMLButtonElement>(`[data-pin="${id}"]`).focus({ preventScroll: true });
    q("[data-session-list]").scrollTop = top;
  });
  all("[data-notice-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      const kind = button.dataset.noticeFilter as Notice["kind"];
      if (enabled.has(kind)) enabled.delete(kind);
      else enabled.add(kind);
      button.setAttribute("aria-pressed", String(enabled.has(kind)));
      paintNotices();
    }),
  );
  q("[data-clear]").addEventListener("click", () => {
    state.notices.forEach((notice) => cleared.add(notice.id));
    q<HTMLButtonElement>("[data-bell]").focus();
    paintNotices();
    q("[data-status]").textContent =
      `${clockLabel(state.minute)} / Notification log cleared`;
  });
  for (const { element, hover } of arms) {
    element.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      giveWayToHandle();
      hover.target = 1;
      wake();
    });
    element.addEventListener("pointerleave", () => {
      hover.target = element === document.activeElement ? 1 : 0;
      wake();
    });
    element.addEventListener("focus", () => {
      giveWayToHandle();
      hover.target = 1;
      wake();
    });
    element.addEventListener("blur", () => {
      hover.target = 0;
      wake();
    });
  }
  q("[data-arm=pin]").addEventListener("click", () => {
    pinned = !pinned;
    paint();
  });
  const move = q<HTMLButtonElement>("[data-arm=move]");
  function place(value: number) {
    const limit = Math.max(
      0,
      (q("[data-stage]").clientWidth - Math.max(attached.offsetWidth, 310)) /
        2 -
        12,
    );
    movedX = Math.max(-limit, Math.min(limit, value));
    overlay.style.transform = `translateX(${movedX}px)`;
  }
  move.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    move.focus({ preventScroll: true });
    dragging = { id: event.pointerId, start: event.clientX, from: movedX };
    move.setPointerCapture(event.pointerId);
    closePanel();
    moveArms(0);
  });
  move.addEventListener("pointermove", (event) => {
    if (dragging?.id === event.pointerId)
      place(dragging.from + event.clientX - dragging.start);
  });
  move.addEventListener("lostpointercapture", () => {
    dragging = null;
    if (visible) moveArms(1);
  });
  move.addEventListener("pointerup", (event) => {
    if (move.hasPointerCapture(event.pointerId))
      move.releasePointerCapture(event.pointerId);
  });
  move.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) {
      event.preventDefault();
      place(
        event.key === "Home"
          ? 0
          : movedX + (event.key === "ArrowLeft" ? -20 : 20),
      );
    }
  });
  new ResizeObserver(() => place(movedX)).observe(q("[data-stage]"));
  q("[data-reveal]").addEventListener("click", () => setVisible(!visible));
  q("[data-refresh]").addEventListener("click", () => {
    for (const svg of root.querySelectorAll(".ring-reading"))
      accent(
        svg,
        [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
        950,
      );
    accent(
      q("[data-refresh] svg"),
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      950,
    );
    q("[data-status]").textContent =
      `${clockLabel(state.minute)} / All accounts updated`;
  });
  function advance(value: number) {
    const previous = state;
    state = snapshot(value);
    hideAlert();
    const newNotice =
      state.minute > previous.minute
        ? state.notices.find(
            (notice) =>
              enabled.has(notice.kind) &&
              !previous.notices.some((old) => old.id === notice.id),
          )
        : null;
    if (newNotice && visible && panel !== "notifications") {
      closePanel();
      q("[data-alert-title]").textContent = newNotice.title;
      q("[data-alert-body]").textContent = newNotice.body;
      q("[data-alert]").hidden = false;
      accent(
        q("[data-alert]"),
        [
          { opacity: 0, transform: "translateY(-12px) scaleY(.7)" },
          { opacity: 1, transform: "translateY(0) scaleY(1)" },
        ],
        420,
      );
      alertTimer = setTimeout(hideAlert, 6000);
    }
    q("[data-status]").textContent =
      `${clockLabel(state.minute)} / ${newNotice ? `${newNotice.title}. ${newNotice.body}` : "All accounts updated"}`;
    paintSessions();
    paintNotices();
    paint();
  }
  clock.addEventListener("input", () => advance(Number(clock.value)));
  q("[data-advance]").addEventListener("click", () =>
    advance(state.minute + 15),
  );
  q("[data-reset-demo]").addEventListener("click", () => {
    stopTimers();
    state = snapshot(0);
    active = "lumen";
    windowId = "fiveHour";
    panel = "usage";
    held = false;
    pinned = false;
    pins = [...initialPins];
    read.clear();
    cleared.clear();
    enabled.clear();
    for (const kind of ["Usage", "Waiting", "Finished"] as const)
      enabled.add(kind);
    all("[data-notice-filter]").forEach((button) =>
      button.setAttribute("aria-pressed", "true"),
    );
    search.value = "";
    filter.value = "all";
    q("[data-status]").textContent = "09:00 / All accounts updated";
    place(0);
    paintSessions();
    paintNotices();
    setVisible(true);
    q("[data-session-list]").scrollTop = 0;
    q("[data-notice-list]").scrollTop = 0;
  });
  function settle() {
    cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    stopTimers();
    hideAlert();
    accents.forEach((animation) => animation.cancel());
    [opening, detail, bell, ...arms.map(({ hover }) => hover)].forEach(
      (value) => {
        value.value = value.target;
        value.velocity = 0;
      },
    );
    armsOut = visible ? 1 : 0;
    armTween = null;
    stow = null;
    paintMotion();
  }
  const observer = new IntersectionObserver(([entry]) => {
    inViewport = entry.isIntersecting;
    suspended = !inViewport || document.hidden;
    if (suspended) settle();
    else {
      last = 0;
      paintMotion();
    }
  });
  observer.observe(root);
  document.addEventListener("visibilitychange", () => {
    suspended = document.hidden || !inViewport;
    if (suspended) settle();
  });
  window.addEventListener("pagehide", settle);
  reduce.addEventListener("change", () => {
    if (reduce.matches) settle();
  });
  const materialObserver = new ResizeObserver(sizeMaterial);
  materialObserver.observe(q(".notch"));
  materialObserver.observe(attached);
  paintSessions();
  paintNotices();
  paint();
  sizeMaterial();
}

document
  .querySelectorAll<HTMLElement>('[data-demo="agent-usage"]')
  .forEach(init);
