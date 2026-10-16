export const recipeSamples = [
  {
    url: "https://example.com/lemon-chickpea-bowl",
    label: "Chickpea bowl",
    text: `Lemon Chickpea Bowl
Servings: 2

Ingredients
1 can chickpeas
1/2 cup couscous
2 tbsp lemon juice
1 cup cucumber, diced

Steps
1. Cook the couscous in hot water.
2. Drain the chickpeas and dice the cucumber.
3. Toss everything with lemon juice and serve.`,
  },
  {
    url: "https://example.com/berry-oats",
    label: "Berry oats",
    text: `Berry Overnight Oats
Serves 1

Ingredients:
1/2 cup rolled oats
3/4 cup milk
1 tbsp chia seeds
1/2 cup berries

Directions:
1. Stir oats, milk and chia seeds in a jar.
2. Cover and chill overnight.
3. Add berries before serving.`,
  },
  {
    url: "https://example.com/vegetable-soup",
    label: "Vegetable soup",
    text: `Garden Vegetable Soup
Yield: 4 servings

Ingredients
2 carrots, chopped
1 1/2 cups vegetable broth
400 g chopped tomatoes
1 tbsp olive oil
Salt to taste

Method
1. Warm the oil and soften the carrots.
2. Add broth and tomatoes. Simmer for 20 minutes.
3. Season with salt and serve.`,
  },
];

export type SourceField = "title" | "servings" | "ingredient" | "step";
export type SourceSpan = { start: number; end: number; field: SourceField };
export type Ingredient = {
  quantity: number | null;
  unit: string | null;
  name: string;
};

const fractions: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
};
function quantityNumber(value: string): number {
  return value
    .trim()
    .split(/\s+/)
    .reduce((sum, part) => {
      if (part.includes("/")) {
        const [n, d] = part.split("/").map(Number);
        return sum + n / d;
      }
      return sum + (fractions[part] ?? Number(part));
    }, 0);
}

export function parseRecipe(source: string) {
  let title = "Untitled recipe";
  let servings: number | null = null;
  const ingredients: Ingredient[] = [];
  const steps: string[] = [];
  const spans: SourceSpan[] = [];
  let mode: "intro" | "ingredients" | "steps" = "intro";
  let offset = 0;
  let hasTitle = false;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    const start = offset + raw.indexOf(line);
    offset += raw.length + 1;
    if (!line) continue;
    const mark = (field: SourceField) =>
      spans.push({ start, end: start + line.length, field });
    if (/^ingredients?:?$/i.test(line)) {
      mode = "ingredients";
      continue;
    }
    if (/^(steps?|directions?|instructions?|method):?$/i.test(line)) {
      mode = "steps";
      continue;
    }
    const serving = line.match(
      /^(?:servings?\s*:?\s*|serves\s+|yield\s*:?\s*)(\d+)/i,
    );
    if (serving) {
      servings = Number(serving[1]) || null;
      mark("servings");
      continue;
    }
    if (!hasTitle && mode === "intro") {
      title = line.replace(/^#+\s*/, "");
      hasTitle = true;
      mark("title");
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) mode = "steps";
    const clean = line.replace(/^(?:[-*•]|\d+[.)])\s+/, "");
    if (mode === "steps") {
      steps.push(clean);
      mark("step");
      continue;
    }
    // An ingredient list may omit its heading if quantities follow the title.
    if (mode === "intro" && !/^(?:\d|[¼½¾⅓⅔])/.test(clean)) continue;
    mode = "ingredients";
    const amount = clean.match(
      /^(\d+\s+\d+\/[1-9]\d*|\d+\/[1-9]\d*|\d+(?:\.\d+)?|[¼½¾⅓⅔])(?:\s+|$)(.*)$/,
    );
    const remainder = amount ? amount[2] : clean;
    const unit = remainder.match(
      /^(cups?|tbsp|tsp|tablespoons?|teaspoons?|g|grams?|kg|ml|l|oz|ounces?|lb|lbs|cans?|cloves?)\b\.?\s*/i,
    );
    ingredients.push({
      quantity: amount ? quantityNumber(amount[1]) : null,
      unit: unit ? unit[1].toLowerCase() : null,
      name: (unit ? remainder.slice(unit[0].length) : remainder).trim(),
    });
    mark("ingredient");
  }
  const warnings = [
    ...(!hasTitle ? ["Add a recipe title."] : []),
    ...(servings === null ? ["Servings not found."] : []),
    ...(!ingredients.length ? ["No ingredients found."] : []),
    ...(!steps.length ? ["No steps found."] : []),
  ];
  return { title, servings, ingredients, steps, spans, warnings };
}

export function sourceSegments(source: string, spans: SourceSpan[]) {
  const segments: { text: string; field: SourceField | null }[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor)
      segments.push({ text: source.slice(cursor, span.start), field: null });
    segments.push({
      text: source.slice(span.start, span.end),
      field: span.field,
    });
    cursor = span.end;
  }
  segments.push({ text: source.slice(cursor), field: null });
  return segments;
}

export const garminDays = [
  {
    label: "Short sleep",
    sleepSeconds: 18720,
    totalSteps: 3200,
    averageStress: 52,
  },
  {
    label: "Active day",
    sleepSeconds: 28080,
    totalSteps: 10800,
    averageStress: 24,
  },
  {
    label: "High stress",
    sleepSeconds: 25200,
    totalSteps: 5100,
    averageStress: 82,
  },
];
export type GarminDay = (typeof garminDays)[number];
export function ingestDay(day: GarminDay) {
  const limit = (n: number, max: number) =>
    Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  const model = {
    model: "WearableDay",
    source: "garmin",
    date: "2026-04-11",
    sleep_hours:
      Math.round((limit(day.sleepSeconds, 86400) / 3600) * 100) / 100,
    steps: Math.round(limit(day.totalSteps, 100000)),
    stress_score: Math.round(limit(day.averageStress, 100)),
  };
  const priorities = [
    {
      specialist: "Sleep specialist",
      score: Math.max(0, (8 - model.sleep_hours) / 8),
    },
    { specialist: "Stress specialist", score: model.stress_score / 100 },
    {
      specialist: "Activity specialist",
      score: Math.max(0, (10000 - model.steps) / 10000),
    },
  ].sort((a, b) => b.score - a.score);
  const specialist = priorities[0].specialist;
  return {
    model,
    priorities,
    specialist,
    trace: [
      {
        stage: "Garmin adapter",
        result: `${day.sleepSeconds}s sleep · ${day.totalSteps} steps · ${day.averageStress} stress`,
      },
      {
        stage: "Pydantic validation",
        result: `WearableDay accepted · ${model.sleep_hours}h · ${model.steps} steps · ${model.stress_score}/100`,
      },
      { stage: "ADK coordinator", result: `Route → ${specialist}` },
      {
        stage: specialist,
        result: `Received WearableDay for ${model.date}; context review complete.`,
      },
      {
        stage: "Result validation",
        result: "Specialist response matches the run schema.",
      },
      {
        stage: "Run record",
        result: `6 stages recorded · completed · route: ${specialist}`,
      },
    ],
  };
}
