import {
  garminDays,
  ingestDay,
  parseRecipe,
  recipeSamples,
  sourceSegments,
} from "../../data/demos/caremesh";

function init(root: HTMLElement) {
  const get = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const input = get<HTMLTextAreaElement>("[data-recipe-input]");
  const picker = get<HTMLSelectElement>("[data-recipe-picker]");
  function parse() {
    const recipe = parseRecipe(input.value);
    get("[data-title]").textContent = recipe.title;
    get("[data-servings]").textContent =
      recipe.servings === null
        ? "Servings unknown"
        : `${recipe.servings} servings`;
    const ingredients = get("[data-ingredients]");
    ingredients.replaceChildren(
      ...recipe.ingredients.map((item) => {
        const row = document.createElement("li");
        row.textContent = [item.quantity, item.unit, item.name]
          .filter((v) => v !== null)
          .join(" ");
        return row;
      }),
    );
    get("[data-steps]").replaceChildren(
      ...recipe.steps.map((text) => {
        const row = document.createElement("li");
        row.textContent = text;
        return row;
      }),
    );
    get("[data-source]").replaceChildren(
      ...sourceSegments(input.value, recipe.spans).map((segment) => {
        if (!segment.field) return document.createTextNode(segment.text);
        const mark = document.createElement("mark");
        mark.dataset.field = segment.field;
        mark.title = segment.field;
        mark.textContent = segment.text;
        return mark;
      }),
    );
    get("[data-recipe-json]").textContent = JSON.stringify(
      {
        title: recipe.title,
        servings: recipe.servings,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
      },
      null,
      2,
    );
    get("[data-parse-status]").textContent = recipe.warnings.length
      ? recipe.warnings.join(" ")
      : `Gemini extraction → Recipe validated / ${recipe.ingredients.length} ingredients / ${recipe.steps.length} steps`;
  }
  get<HTMLFormElement>("[data-recipe-form]").addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      parse();
    },
  );
  picker.addEventListener("change", () => {
    if (picker.value === "paste") return;
    input.value = recipeSamples[Number(picker.value)].text;
    parse();
  });
  input.addEventListener("input", () => {
    picker.value = "paste";
    get("[data-parse-status]").textContent =
      "Input changed / extract to update the recipe.";
  });
  const sleep = get<HTMLInputElement>("[data-sleep]");
  const steps = get<HTMLInputElement>("[data-walking]");
  const stress = get<HTMLInputElement>("[data-stress]");
  const dayPicker = get<HTMLSelectElement>("[data-day]");
  function ingest() {
    const raw = {
      label: "Edited day",
      sleepSeconds: Math.round(Number(sleep.value) * 3600),
      totalSteps: Number(steps.value),
      averageStress: Number(stress.value),
    };
    const run = ingestDay(raw);
    get("[data-sleep-value]").textContent = `${sleep.value} h`;
    get("[data-walking-value]").textContent = Number(
      steps.value,
    ).toLocaleString("en-US");
    get("[data-stress-value]").textContent = `${stress.value} / 100`;
    get("[data-garmin-json]").textContent = JSON.stringify(
      {
        sleepSeconds: raw.sleepSeconds,
        totalSteps: raw.totalSteps,
        averageStress: raw.averageStress,
      },
      null,
      2,
    );
    get("[data-model-json]").textContent = JSON.stringify(run.model, null, 2);
    get("[data-route]").textContent = run.specialist;
    get("[data-run]").replaceChildren(
      ...run.trace.map((step) => {
        const row = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = step.stage;
        const result = document.createElement("span");
        result.textContent = step.result;
        row.append(title, result);
        return row;
      }),
    );
    get("[data-priorities]").replaceChildren(
      ...run.priorities.map((priority) => {
        const row = document.createElement("div");
        const label = document.createElement("span");
        label.textContent = `${priority.specialist} / ${Math.round(priority.score * 100)}%`;
        const meter = document.createElement("meter");
        meter.min = 0;
        meter.max = 1;
        meter.value = priority.score;
        meter.setAttribute(
          "aria-label",
          `${priority.specialist} routing priority`,
        );
        row.append(label, meter);
        return row;
      }),
    );
  }
  function loadDay() {
    const day = garminDays[Number(dayPicker.value)];
    sleep.value = String(day.sleepSeconds / 3600);
    steps.value = String(day.totalSteps);
    stress.value = String(day.averageStress);
    ingest();
  }
  dayPicker.addEventListener("change", loadDay);
  [sleep, steps, stress].forEach((control) =>
    control.addEventListener("input", () => {
      dayPicker.value = "";
      ingest();
    }),
  );
  function view(name: string) {
    root
      .querySelectorAll<HTMLElement>("[data-panel]")
      .forEach((panel) => (panel.hidden = panel.dataset.panel !== name));
    root
      .querySelectorAll<HTMLButtonElement>("[data-view]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.view === name),
        ),
      );
  }
  root
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((button) =>
      button.addEventListener("click", () => view(button.dataset.view!)),
    );
  get("[data-reset]").addEventListener("click", () => {
    picker.value = "0";
    input.value = recipeSamples[0].text;
    dayPicker.value = "0";
    root
      .querySelectorAll<HTMLDetailsElement>("details")
      .forEach(
        (detail) => (detail.open = detail.hasAttribute("data-source-details")),
      );
    parse();
    loadDay();
    view("recipe");
  });
  parse();
  loadDay();
}
document.querySelectorAll<HTMLElement>('[data-demo="caremesh"]').forEach(init);
