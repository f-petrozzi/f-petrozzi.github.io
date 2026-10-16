import {
  EVENTS,
  MAX_QTY,
  COLS,
  ROWS,
  SERVICES,
  STEPS,
  availableCount,
  bestAvailable,
  getEvent,
  isTaken,
  money,
  qrPath,
  quote,
  scanTicket,
  seatId,
  seatPrice,
  soldTickets,
  stepServices,
  ticketId,
  tiers,
  whole,
  type ScanResult,
  type SoldTicket,
  type StepId,
} from "../../data/demos/tixly-app-design";

type Screen = "browse" | "detail" | "seats" | "checkout" | "wallet";
type Ticket = SoldTicket & { holder: string; order: number };

type State = {
  screen: Screen;
  eventId: string;
  qty: number;
  picked: string[];
  name: string;
  pay: "card" | "wallet";
  error: string;
  tickets: Ticket[];
  sold: Map<string, SoldTicket>;
  used: Set<string>;
  bought: Set<string>;
  orders: number;
  selected: string;
  flash: string;
  step: StepId;
};

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

function fresh(): State {
  const sold = new Map(soldTickets().map((t) => [t.id, t]));
  const seed = [...sold.values()].find((t) => t.eventId === "riverside-jazz")!;
  return {
    screen: "browse",
    eventId: EVENTS[0].id,
    qty: 2,
    picked: [],
    name: "Alex Rivera",
    pay: "card",
    error: "",
    tickets: [{ ...seed, holder: "Alex Rivera", order: 1000 }],
    sold,
    used: new Set(),
    bought: new Set(),
    orders: 1001,
    selected: seed.id,
    flash: "",
    step: "browse",
  };
}

function init(root: HTMLElement) {
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const host = q<HTMLElement>("[data-screen]");
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const fidelity = [
    ...root.querySelectorAll<HTMLButtonElement>("[data-fidelity]"),
  ];
  const doorInput = q<HTMLInputElement>("[data-door-input]");
  const doorResult = q<HTMLElement>("[data-door-result]");
  const soldHost = q<HTMLElement>("[data-sold]");
  const soldCount = q<HTMLElement>("[data-sold-count]");
  const archNote = q<HTMLElement>("[data-arch-note]");
  const archNodes = [...root.querySelectorAll<HTMLElement>("[data-svc]")];
  let s = fresh();
  let moveFocus = false;

  const unavailable = (seat: string) => s.bought.has(`${s.eventId}:${seat}`);
  const taken = (seat: string) =>
    isTaken(getEvent(s.eventId), seat) || unavailable(seat);
  const maxQty = () =>
    Math.min(MAX_QTY, availableCount(getEvent(s.eventId), unavailable));

  function art(hue: number, label: string, tall = false) {
    return `<span class="tx-art${tall ? " is-tall" : ""}" style="--h:${hue}" aria-hidden="true"><span>${esc(label)}</span></span>`;
  }

  function browse() {
    const cards = EVENTS.map((e) => {
      const from = tiers(e).reduce((m, t) => Math.min(m, t.cents), Infinity);
      return `<li><button type="button" class="tx-event" data-act="open" data-id="${e.id}" data-key="e-${e.id}">${art(e.hue, e.category)}<span class="tx-event-body"><b>${esc(e.title)}</b><small>${esc(e.date)}</small><small>${esc(e.venue)}</small></span><span class="tx-from">from ${whole(from)}</span></button></li>`;
    }).join("");
    return `<h2 class="tx-h" tabindex="-1" data-heading>Events near you</h2><ul class="tx-list">${cards}</ul>`;
  }

  function detail() {
    const e = getEvent(s.eventId);
    const left = availableCount(e, unavailable);
    const rows = tiers(e)
      .map(
        (t) =>
          `<li><span>${t.name}<small>Rows ${t.rows}</small></span><b>${whole(t.cents)}</b></li>`,
      )
      .join("");
    return `<button type="button" class="tx-back" data-act="back-browse" data-key="back">Events</button>${art(e.hue, e.category, true)}<h2 class="tx-h" tabindex="-1" data-heading>${esc(e.title)}</h2><p class="tx-meta">${esc(e.date)}<br>${esc(e.venue)}</p><p>${esc(e.about)}</p><ul class="tx-tiers">${rows}</ul><p class="tx-left">${left} seats left</p><button type="button" class="tx-cta" data-act="to-seats" data-key="cta">Choose seats</button>`;
  }

  function seats() {
    const e = getEvent(s.eventId);
    const grid = ROWS.map((row) => {
      const cells = Array.from({ length: COLS }, (_, i) => {
        const id = seatId(row, i + 1);
        const isTakenSeat = taken(id);
        const on = s.picked.includes(id);
        return `<button type="button" class="tx-seat${isTakenSeat ? " is-taken" : ""}" data-act="seat" data-seat="${id}" data-key="s-${id}" aria-pressed="${on}" aria-label="Row ${row} seat ${i + 1}, ${whole(seatPrice(e, id))}${isTakenSeat ? ", taken" : ""}" ${isTakenSeat ? "disabled" : ""}></button>`;
      }).join("");
      return `<span class="tx-row-label" aria-hidden="true">${row}</span>${cells}`;
    }).join("");
    const total = quote(e, s.picked).total;
    const ready = s.picked.length === s.qty;
    return `<button type="button" class="tx-back" data-act="back-detail" data-key="back">${esc(e.title)}</button><h2 class="tx-h" tabindex="-1" data-heading>Choose seats</h2><div class="tx-qty"><span id="tx-qty-label">Tickets</span><div role="group" aria-labelledby="tx-qty-label"><button type="button" data-act="qty-" data-key="q-" aria-label="Fewer tickets" ${s.qty <= 1 ? "disabled" : ""}>−</button><output aria-live="polite">${s.qty}</output><button type="button" data-act="qty+" data-key="q+" aria-label="More tickets" ${s.qty >= maxQty() ? "disabled" : ""}>+</button></div></div><div class="tx-stage-bar">Stage</div><div class="tx-seats" style="--cols:${COLS}">${grid}</div><p class="tx-legend"><i class="a"></i>Open <i class="t"></i>Taken <i class="p"></i>Yours</p><p class="tx-sum" aria-live="polite">${s.picked.length} of ${s.qty} seats${s.picked.length ? ` · ${money(total)}` : ""}</p><button type="button" class="tx-cta" data-act="to-checkout" data-key="cta" ${ready ? "" : "disabled"}>Continue</button>`;
  }

  function checkout() {
    const e = getEvent(s.eventId);
    const qt = quote(e, s.picked);
    const lines = s.picked
      .map(
        (p) =>
          `<li><span>Seat ${p}</span><b>${money(seatPrice(e, p))}</b></li>`,
      )
      .join("");
    const opt = (id: "card" | "wallet", label: string) =>
      `<button type="button" class="tx-pay" data-act="pay-${id}" data-key="p-${id}" aria-pressed="${s.pay === id}">${label}</button>`;
    return `<button type="button" class="tx-back" data-act="back-seats" data-key="back">Seats</button><h2 class="tx-h" tabindex="-1" data-heading>Checkout</h2><p class="tx-meta"><b>${esc(e.title)}</b><br>${esc(e.date)}</p><ul class="tx-lines">${lines}<li><span>Service fee</span><b>${money(qt.fee)}</b></li><li class="is-total"><span>Total</span><b>${money(qt.total)}</b></li></ul><form data-form novalidate><label class="tx-field" for="tx-name">Name on tickets</label><input id="tx-name" name="name" type="text" autocomplete="off" maxlength="40" value="${esc(s.name)}" ${s.error ? 'aria-invalid="true" aria-describedby="tx-name-err"' : ""}><p class="tx-err" id="tx-name-err" role="alert">${esc(s.error)}</p><div class="tx-pays">${opt("card", "Card ending 4242")}${opt("wallet", "Phone wallet")}</div><button type="submit" class="tx-cta" data-key="cta">Pay ${money(qt.total)}</button></form>`;
  }

  function wallet() {
    const flash = s.flash
      ? `<p class="tx-flash" role="status">${esc(s.flash)}</p>`
      : "";
    if (!s.tickets.length)
      return `<h2 class="tx-h" tabindex="-1" data-heading>Tickets</h2>${flash}<p class="tx-empty">No tickets yet.</p>`;
    const t = s.tickets.find((x) => x.id === s.selected) ?? s.tickets[0];
    const e = getEvent(t.eventId);
    const used = s.used.has(t.id);
    const others = s.tickets
      .map(
        (x) =>
          `<li><button type="button" class="tx-mini" data-act="select" data-id="${x.id}" data-key="t-${x.id}" aria-pressed="${x.id === t.id}"><span>${esc(getEvent(x.eventId).title)}</span><small>Seat ${x.seat}${s.used.has(x.id) ? " · scanned" : ""}</small></button></li>`,
      )
      .join("");
    return `<h2 class="tx-h" tabindex="-1" data-heading>Tickets</h2>${flash}<article class="tx-ticket${used ? " is-used" : ""}">${art(e.hue, e.category)}<div class="tx-ticket-body"><b>${esc(e.title)}</b><small>${esc(e.date)} · ${esc(e.venue)}</small><small>Seat ${t.seat} · ${esc(t.holder)}</small></div><svg class="tx-qr" viewBox="-2 -2 29 29" role="img" aria-label="Illustrative QR code for ticket ${t.id}"><rect x="-2" y="-2" width="29" height="29" fill="#fff"/><path d="${qrPath(t.id)}" fill="#111"/></svg><code class="tx-id">${t.id}</code>${used ? '<span class="tx-stamp">Scanned</span>' : ""}<button type="button" class="tx-door-btn" data-act="to-door" data-id="${t.id}" data-key="door">Scan at door</button></article>${s.tickets.length > 1 ? `<ul class="tx-minis">${others}</ul>` : ""}`;
  }

  function currentStep(): StepId {
    return s.step;
  }

  function renderArch() {
    const active = stepServices(currentStep());
    archNodes.forEach((n) => {
      const on = active.includes(n.dataset.svc as never);
      if (on) n.setAttribute("data-active", "");
      else n.removeAttribute("data-active");
    });
    const label = STEPS.find((x) => x.id === currentStep())!.label;
    const names = SERVICES.filter(
      (v) => active.includes(v.id) && v.id !== "app" && v.id !== "gateway",
    ).map((v) => v.name);
    archNote.textContent = `${label}: ${names.join(", ")}`;
  }

  function render() {
    const prev = document.activeElement as HTMLElement | null;
    const key = prev && host.contains(prev) ? prev.dataset.key : undefined;
    const top = host.scrollTop;
    host.innerHTML = { browse, detail, seats, checkout, wallet }[s.screen]();
    tabs.forEach((t) => {
      const on = (t.dataset.tab === "wallet") === (s.screen === "wallet");
      if (on) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    if (moveFocus) {
      host.scrollTop = 0;
      host.querySelector<HTMLElement>("[data-heading]")?.focus({
        preventScroll: true,
      });
      moveFocus = false;
    } else {
      host.scrollTop = top;
      if (key)
        host
          .querySelector<HTMLElement>(`[data-key="${key}"]`)
          ?.focus({ preventScroll: true });
    }
    renderArch();
  }

  function go(screen: Screen) {
    s.screen = screen;
    s.step = screen;
    moveFocus = true;
    render();
  }

  function renderSold() {
    soldCount.textContent = String(s.sold.size);
    soldHost.innerHTML = [...s.sold.values()]
      .map(
        (t) =>
          `<button type="button" class="tx-chip${s.used.has(t.id) ? " is-used" : ""}" data-act="fill" data-id="${t.id}">${t.id}</button>`,
      )
      .join("");
  }

  function showScan(r: ScanResult) {
    doorResult.dataset.state = r.status;
    if (r.status === "empty") {
      doorResult.innerHTML = "<b>Enter a ticket ID</b>";
      return;
    }
    const where = r.ticket
      ? `${esc(getEvent(r.ticket.eventId).title)}, seat ${r.ticket.seat}`
      : "";
    const head = {
      admit: "Valid. Admit",
      used: "Already used. Do not admit",
      unknown: "Not on the sold list",
      empty: "",
    }[r.status];
    doorResult.innerHTML = `<b>${head}</b><span>${esc(r.id)}${where ? ` · ${where}` : ""}</span>`;
  }

  function scan(raw: string) {
    const r = scanTicket(raw, s.sold, s.used);
    if (r.status === "admit") s.used.add(r.id);
    showScan(r);
    s.step = "door";
    renderSold();
    if (s.screen === "wallet") render();
    else renderArch();
  }

  function resetDoor() {
    doorInput.value = "";
    doorResult.dataset.state = "idle";
    doorResult.innerHTML = "<b>Ready to scan</b>";
    renderSold();
  }

  function setPicked() {
    s.picked = bestAvailable(getEvent(s.eventId), s.qty, unavailable);
  }

  host.addEventListener("click", (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!el) return;
    const act = el.dataset.act!;
    if (act === "open") {
      s.eventId = el.dataset.id!;
      go("detail");
    } else if (act === "back-browse") go("browse");
    else if (act === "to-seats") {
      s.qty = Math.min(2, maxQty());
      setPicked();
      go("seats");
    } else if (act === "back-detail") go("detail");
    else if (act === "qty+" || act === "qty-") {
      s.qty = Math.max(
        1,
        Math.min(maxQty(), s.qty + (act === "qty+" ? 1 : -1)),
      );
      setPicked();
      render();
    } else if (act === "seat") {
      const id = el.dataset.seat!;
      s.picked = s.picked.includes(id)
        ? s.picked.filter((p) => p !== id)
        : [...s.picked, id].slice(-s.qty);
      render();
    } else if (act === "to-checkout") {
      s.error = "";
      go("checkout");
    } else if (act === "back-seats") go("seats");
    else if (act === "pay-card" || act === "pay-wallet") {
      s.pay = act === "pay-card" ? "card" : "wallet";
      render();
    } else if (act === "select") {
      s.selected = el.dataset.id!;
      render();
    } else if (act === "to-door") {
      doorInput.value = el.dataset.id!;
      scan(el.dataset.id!);
      doorResult.scrollIntoView({ block: "nearest" });
    }
  });

  host.addEventListener("input", (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.name === "name") s.name = t.value;
  });

  host.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = s.name.trim();
    if (!name) {
      s.error = "Enter the name for these tickets.";
      render();
      host.querySelector<HTMLInputElement>("#tx-name")?.focus();
      return;
    }
    const e = getEvent(s.eventId);
    const order = s.orders++;
    const made = s.picked.map((seat) => {
      const t: Ticket = {
        id: ticketId(e.id, seat),
        eventId: e.id,
        seat,
        holder: name,
        order,
      };
      s.sold.set(t.id, t);
      s.bought.add(`${e.id}:${seat}`);
      return t;
    });
    s.tickets = [...made, ...s.tickets];
    s.selected = made[0].id;
    s.flash = `Order ${order} confirmed. ${made.length} ${made.length === 1 ? "ticket" : "tickets"} added.`;
    s.picked = [];
    renderSold();
    go("wallet");
  });

  tabs.forEach((t) =>
    t.addEventListener("click", () => {
      if (t.dataset.tab === "wallet") {
        s.flash = "";
        go("wallet");
      } else go("browse");
    }),
  );

  fidelity.forEach((b) =>
    b.addEventListener("click", () => {
      root.dataset.fidelity = b.dataset.fidelity;
      fidelity.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    }),
  );

  q<HTMLFormElement>("[data-door-form]").addEventListener("submit", (ev) => {
    ev.preventDefault();
    scan(doorInput.value);
  });

  soldHost.addEventListener("click", (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (el?.dataset.act === "fill") {
      doorInput.value = el.dataset.id!;
      doorInput.focus();
    }
  });

  q<HTMLButtonElement>("[data-reset]").addEventListener("click", () => {
    s = fresh();
    moveFocus = false;
    resetDoor();
    render();
  });

  resetDoor();
  render();
}

document
  .querySelectorAll<HTMLElement>('[data-demo="tixly-app-design"]')
  .forEach(init);
