import { runSampleAgent } from "../data/nume-agent";
const root = document.querySelector<HTMLElement>(".nume-sample")!;
const sleep = root.querySelector<HTMLInputElement>("#sample-sleep")!;
const stress = root.querySelector<HTMLInputElement>("#sample-stress")!;
const message = root.querySelector<HTMLElement>(".sample-message")!;
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;
let lastQuestion = "Plan my day";
function execute() {
  return runSampleAgent(lastQuestion, {
    sleep: Number(sleep.value),
    stress: Number(stress.value),
  });
}
let execution = execute();
let stages = execution.trace;
const nodes = [...root.querySelectorAll<HTMLButtonElement>("[data-stage]")];
const play = root.querySelector<HTMLButtonElement>(".sample-play")!;
const status = root.querySelector<HTMLElement>(".sample-trace-status")!;
function stop() {
  generation++;
  clearTimeout(timer);
  play.textContent = "Play sample trace";
  play.disabled = false;
}
function stage(index: number) {
  nodes.forEach((node, i) =>
    node.setAttribute("aria-pressed", String(i === index)),
  );
  const panel = root.querySelector<HTMLElement>(".sample-stage-detail")!,
    data = stages[index];
  panel.querySelector(".sample-kicker")!.textContent = data.kicker;
  panel.querySelector("h3")!.textContent = data.title;
  panel.querySelector("p")!.textContent = data.copy;
  panel.querySelector("[data-trace-input]")!.textContent = data.input;
  panel.querySelector("[data-trace-output]")!.textContent = data.output;
  if (!reduce.matches)
    panel.animate(
      [
        { opacity: 0.4, transform: "translateY(5px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 220, easing: "cubic-bezier(.22,1,.36,1)" },
    );
}
function view(name: string) {
  stop();
  root
    .querySelectorAll<HTMLElement>("[data-panel]")
    .forEach((panel) => (panel.hidden = panel.dataset.panel !== name));
  root.querySelectorAll<HTMLElement>("[data-view]").forEach((button) => {
    if (button.dataset.view === name)
      button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (name === "agents")
    stage(
      Math.max(
        0,
        nodes.findIndex((node) => node.getAttribute("aria-pressed") === "true"),
      ),
    );
  const panel = root.querySelector<HTMLElement>(`[data-panel="${name}"]`)!;
  if (!reduce.matches)
    panel.animate(
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 260, easing: "cubic-bezier(.22,1,.36,1)" },
    );
}
root
  .querySelectorAll<HTMLButtonElement>("[data-view]")
  .forEach((button) =>
    button.addEventListener("click", () => view(button.dataset.view!)),
  );
function update() {
  execution = execute();
  stages = execution.trace;
  if (!root.querySelector<HTMLElement>(".sample-question")!.hidden)
    root.querySelector(".sample-reply")!.textContent = execution.answer;
  const low = Number(sleep.value) < 6 || Number(stress.value) > 60;
  root.querySelector("#sample-sleep-label")!.textContent =
    `${Number(sleep.value).toFixed(1)} hours`;
  root.querySelector("#sample-stress-label")!.textContent =
    `${stress.value} / 100`;
  root
    .querySelectorAll('[data-metric="sleep"]')
    .forEach((el) => (el.textContent = `${Number(sleep.value).toFixed(1)}h`));
  root
    .querySelectorAll('[data-metric="stress"]')
    .forEach((el) => (el.textContent = stress.value));
  const copy = low
    ? "Start with one good meal, a short walk and an earlier bedtime."
    : "There is more room in the day. Try a balanced meal and a longer movement break.";
  if (message.textContent !== copy) message.textContent = copy;
  root.querySelector("[data-meal-title]")!.textContent = low
    ? "Spinach & Walnut Power Salad"
    : "Calming Chamomile Oat Bowl";
  root.querySelector("[data-meal-copy]")!.textContent = low
    ? "A simple meal with leafy greens, nuts and whole grains."
    : "Warm oats with chamomile and fruit for a steady start.";
  root.querySelector("[data-activity-title]")!.textContent = low
    ? "Gentle Movement Break"
    : "Make Time for a Walk";
  root.querySelector("[data-activity-copy]")!.textContent = low
    ? "A 15-minute walk between classes."
    : "A 30-minute walk that fits the sample day's schedule.";
  root
    .querySelectorAll<HTMLButtonElement>(".sample-accept")
    .forEach((button) => {
      button.setAttribute("aria-pressed", "false");
      button.textContent = button.closest("[data-panel=recipes]")
        ? "Add to sample plan"
        : "I'll do this";
    });
}
sleep.addEventListener("input", update);
stress.addEventListener("input", update);
root.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) =>
  button.addEventListener("click", () => {
    sleep.value = button.dataset.preset === "rested" ? "7.8" : "5.2";
    stress.value = button.dataset.preset === "rested" ? "28" : "72";
    update();
  }),
);
root.querySelectorAll<HTMLButtonElement>(".sample-accept").forEach((button) =>
  button.addEventListener("click", () => {
    const accepted = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(accepted));
    button.textContent = accepted
      ? "Added to sample plan"
      : button.closest("[data-panel=recipes]")
        ? "Add to sample plan"
        : "I'll do this";
  }),
);
root
  .querySelectorAll<HTMLButtonElement>("[data-recipe-filter]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      root
        .querySelectorAll("[data-recipe-filter]")
        .forEach((other) =>
          other.setAttribute("aria-pressed", String(other === button)),
        );
      root
        .querySelectorAll<HTMLElement>("[data-recipe-minutes]")
        .forEach(
          (recipe) =>
            (recipe.hidden =
              button.dataset.recipeFilter === "quick" &&
              Number(recipe.dataset.recipeMinutes) >= 15),
        );
    }),
  );
nodes.forEach((node, i) =>
  node.addEventListener("click", () => {
    stop();
    stage(i);
    status.textContent = "Local execution / inspecting input and output.";
  }),
);
play.addEventListener("click", () => {
  stop();
  execution = execute();
  stages = execution.trace;
  const token = generation;
  nodes.forEach((node) => node.classList.remove("is-complete"));
  play.disabled = true;
  play.textContent = "Playing sample…";
  let index = 0;
  function next() {
    if (token !== generation) return;
    stage(index);
    nodes[index].classList.add("is-complete");
    status.textContent = `Sample stage ${index + 1} of ${nodes.length}: ${stages[index].kicker}`;
    index++;
    if (index < nodes.length)
      timer = setTimeout(next, reduce.matches ? 0 : 650);
    else {
      play.disabled = false;
      play.textContent = "Replay sample trace";
      status.textContent =
        "Local flow complete. No external agents were called.";
      root.querySelector(".sample-reply")!.textContent = execution.answer;
    }
  }
  next();
});
root.querySelector(".sample-reset")!.addEventListener("click", () => {
  stop();
  sleep.value = "5.2";
  stress.value = "72";
  update();
  root
    .querySelectorAll<HTMLDetailsElement>("details")
    .forEach((d) => (d.open = false));
  root
    .querySelectorAll<HTMLElement>("[data-recipe-minutes]")
    .forEach((r) => (r.hidden = false));
  root
    .querySelectorAll<HTMLElement>("[data-recipe-filter]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.recipeFilter === "all")),
    );
  nodes.forEach((n) => n.classList.remove("is-complete"));
  lastQuestion = "Plan my day";
  execution = execute();
  stages = execution.trace;
  root.querySelector<HTMLFormElement>(".sample-chat-form")!.reset();
  root.querySelector<HTMLElement>(".sample-question")!.hidden = true;
  root.querySelector(".sample-reply")!.textContent =
    "Ask about your sample day. I can explain meals, activity and the plan.";
  stage(0);
  status.textContent =
    "Local execution / select a stage to inspect its input and output.";
  view("dashboard");
});
window.addEventListener("pagehide", stop);

const form = root.querySelector<HTMLFormElement>(".sample-chat-form")!;
const question = root.querySelector<HTMLInputElement>(
  "#sample-question-input",
)!;
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!question.value.trim()) return;
  stop();
  lastQuestion = question.value.trim();
  execution = execute();
  stages = execution.trace;
  const user = root.querySelector<HTMLElement>(".sample-question")!;
  user.hidden = false;
  user.textContent = lastQuestion;
  root.querySelector(".sample-reply")!.textContent = execution.answer;
  nodes.forEach((n) => n.classList.add("is-complete"));
  stage(4);
  status.textContent =
    "Local flow complete. Select any stage to inspect its input and output.";
  question.value = "";
});
root.querySelectorAll<HTMLButtonElement>("[data-prompt]").forEach((button) =>
  button.addEventListener("click", () => {
    question.value = button.dataset.prompt!;
    form.requestSubmit();
  }),
);
root.querySelector(".sample-view-trace")!.addEventListener("click", () => {
  view("agents");
  stage(4);
});
stage(0);
