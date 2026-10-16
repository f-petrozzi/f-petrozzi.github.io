import {
  DEFAULT_INTERVAL_MS,
  advance,
  describeInput,
  formatCount,
  formatRate,
  intervalMessage,
  parseInterval,
  retime,
  startClock,
  type ClickInput,
  type Clock,
  type MouseButton,
} from "../../data/demos/autoclicker";

const MAX_RIPPLES = 14;

/* Clicks here are drawn, never dispatched: nothing in this file creates or
   dispatches an event, and no listener is attached outside the demo root
   except the page-visibility check that stops the run. */
function init(root: HTMLElement) {
  const q = <T extends Element>(selector: string) =>
    root.querySelector<T>(selector)!;
  const pad = q<HTMLElement>("[data-pad]");
  const layer = q<HTMLElement>("[data-ripples]");
  const counter = q<HTMLElement>("[data-count]");
  const last = q<HTMLElement>("[data-last]");
  const intervalInput = q<HTMLInputElement>("[data-interval]");
  const intervalError = q<HTMLElement>("[data-interval-error]");
  const keySelect = q<HTMLSelectElement>("[data-key]");
  const modeInputs = [
    ...root.querySelectorAll<HTMLInputElement>("[data-mode]"),
  ];
  const toggle = q<HTMLButtonElement>("[data-toggle]");
  const hotkey = q<HTMLButtonElement>("[data-hotkey]");
  const status = q<HTMLElement>("[data-status]");
  const reset = q<HTMLButtonElement>("[data-reset]");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  let intervalMs = DEFAULT_INTERVAL_MS;
  let count = 0;
  let running = false;
  let clock: Clock | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let visible = true;
  let cursor: { x: number; y: number } | null = null;
  let marker: HTMLElement | null = null;

  function currentInput(): ClickInput {
    const mode = modeInputs.find((input) => input.checked)?.value ?? "left";
    if (mode === "key") return { kind: "key", key: keySelect.value };
    return { kind: "mouse", button: mode as MouseButton };
  }

  function syncUi(message?: string) {
    root.classList.toggle("is-running", running);
    toggle.textContent = running ? "Stop" : "Start";
    toggle.setAttribute("aria-pressed", String(running));
    hotkey.setAttribute("aria-pressed", String(running));
    keySelect.disabled = !modeInputs.find((i) => i.value === "key")!.checked;
    status.textContent =
      message ??
      (running
        ? `Running, ${formatRate(intervalMs)}`
        : `Idle, ${formatRate(intervalMs)} when started`);
  }

  function ripple(input: ClickInput) {
    const rect = pad.getBoundingClientRect();
    const key = input.kind === "key";
    const x = key || !cursor ? rect.width / 2 : cursor.x;
    const y = key || !cursor ? rect.height / 2 : cursor.y;
    if (reduce.matches) {
      if (!marker) {
        marker = document.createElement("span");
        marker.className = "ac-marker";
        layer.append(marker);
      }
      marker.dataset.kind = key ? "key" : input.button;
      marker.textContent = key ? input.key : "";
      marker.style.left = `${x}px`;
      marker.style.top = `${y}px`;
      return;
    }
    const node = document.createElement("span");
    node.className = `ac-ripple is-${key ? "key" : input.button}`;
    if (key) node.textContent = input.key;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    layer.append(node);
    const animation = node.animate(
      key
        ? [
            { opacity: 1, transform: "translate(-50%, -50%) scale(0.9)" },
            { opacity: 0, transform: "translate(-50%, -90%) scale(1.25)" },
          ]
        : [
            { opacity: 1, transform: "scale(0.6)" },
            { opacity: 0, transform: "scale(4.2)" },
          ],
      {
        duration: 700,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        fill: "forwards",
      },
    );
    animation.onfinish = () => node.remove();
    while (layer.children.length > MAX_RIPPLES)
      layer.firstElementChild?.remove();
  }

  function click() {
    const input = currentInput();
    count++;
    counter.textContent = formatCount(count);
    last.textContent = describeInput(input);
    ripple(input);
  }

  function schedule(delay: number) {
    clearTimeout(timer);
    timer = setTimeout(tick, delay);
  }

  function tick() {
    if (!running || !clock) return;
    if (!root.isConnected || !visible || document.hidden) {
      stop("Stopped, demo out of view");
      return;
    }
    const step = advance(clock, performance.now());
    clock = step.clock;
    if (step.click) click();
    schedule(step.delay);
  }

  function start() {
    if (running || !visible || document.hidden) return;
    running = true;
    clock = startClock(performance.now(), intervalMs);
    syncUi();
    tick();
  }

  function stop(message?: string) {
    const was = running;
    running = false;
    clock = null;
    clearTimeout(timer);
    if (was || message) syncUi(message);
  }

  function flip() {
    if (running) stop();
    else start();
  }
  toggle.addEventListener("click", flip);
  hotkey.addEventListener("click", flip);

  function commitInterval() {
    const result = parseInterval(intervalInput.value);
    intervalMs = result.ms;
    intervalInput.value = String(result.ms);
    intervalError.textContent = intervalMessage(result.note);
    if (result.adjusted) intervalInput.setAttribute("aria-invalid", "true");
    else intervalInput.removeAttribute("aria-invalid");
    if (running) {
      clock = retime(performance.now(), intervalMs);
      schedule(intervalMs);
    }
    syncUi();
  }
  intervalInput.addEventListener("change", commitInterval);
  intervalInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitInterval();
    }
  });
  intervalInput.addEventListener("input", () => {
    if (intervalError.textContent) {
      intervalError.textContent = "";
      intervalInput.removeAttribute("aria-invalid");
    }
  });

  modeInputs.forEach((input) =>
    input.addEventListener("change", () => syncUi()),
  );
  keySelect.addEventListener("change", () => syncUi());

  /* The pointer position inside the target is where mouse clicks land. */
  function track(event: PointerEvent) {
    const rect = pad.getBoundingClientRect();
    cursor = {
      x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
    };
  }
  pad.addEventListener("pointermove", track);
  pad.addEventListener("pointerdown", track);
  pad.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") cursor = null;
  });

  function resetAll() {
    stop();
    count = 0;
    counter.textContent = "0";
    last.textContent = "None yet";
    layer.replaceChildren();
    marker = null;
    cursor = null;
    modeInputs.forEach((input) => (input.checked = input.value === "left"));
    keySelect.value = keySelect.options[0].value;
    intervalInput.value = String(DEFAULT_INTERVAL_MS);
    intervalMs = DEFAULT_INTERVAL_MS;
    intervalError.textContent = "";
    intervalInput.removeAttribute("aria-invalid");
    syncUi();
  }
  reset.addEventListener("click", resetAll);

  /* Stop whenever the demo is not on screen. */
  if (typeof IntersectionObserver === "function")
    new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (!visible && running) stop("Stopped, demo out of view");
    }).observe(root);
  const onHidden = () => {
    if (!root.isConnected) {
      document.removeEventListener("visibilitychange", onHidden);
      stop();
    } else if (document.hidden && running) stop("Stopped, tab hidden");
  };
  document.addEventListener("visibilitychange", onHidden);

  resetAll();
}

document
  .querySelectorAll<HTMLElement>('[data-demo="autoclicker"]')
  .forEach(init);
