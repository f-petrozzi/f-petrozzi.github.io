import { chromium, expect } from "@playwright/test";
const base = (process.env.PREVIEW_URL || "http://127.0.0.1:4620").replace(
  /\/$/,
  "",
);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [],
      unexpected = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin || /\/api\//.test(url.pathname)) {
        unexpected.push(url.href);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(`${base}/projects/nume/demo/`);
    const sample = page.locator(".nume-sample");
    await expect(
      sample.getByRole("heading", { name: "Good morning, Alex" }),
    ).toBeVisible();
    await sample.getByRole("button", { name: "Rested", exact: true }).click();
    await expect(sample.locator("[data-meal-title]")).toHaveText(
      "Calming Chamomile Oat Bowl",
    );
    await expect(sample.locator("#sample-sleep-label")).toHaveText("7.8 hours");
    await sample.locator(".sample-accept").first().click();
    await expect(sample.locator(".sample-accept").first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await sample
      .getByRole("button", { name: "What should I eat?", exact: true })
      .click();
    await expect(sample.locator(".sample-reply")).toContainText(
      "Calming Chamomile",
    );
    await sample
      .getByRole("button", { name: "See how the answer was made" })
      .click();
    await expect(sample.locator("[data-trace-output]")).toContainText(
      "Calming Chamomile",
    );
    await sample.locator('[data-stage="parallel"]').click();
    await expect(sample.locator("[data-trace-input]")).toContainText(
      "sleep=7.8h, stress=28",
    );
    await sample.getByRole("button", { name: "Health", exact: true }).click();
    await expect(
      sample.locator('[data-panel="health"] [data-metric="sleep"]'),
    ).toHaveText("7.8h");
    await sample.getByRole("button", { name: "Recipes", exact: true }).click();
    await sample.getByRole("button", { name: "Under 15 minutes" }).click();
    await expect(sample.locator("[data-recipe-minutes]:visible")).toHaveCount(
      2,
    );
    await sample
      .getByRole("button", { name: "Agent trace", exact: true })
      .click();
    await sample.getByRole("button", { name: "Play sample trace" }).click();
    await expect(sample.locator(".sample-trace-status")).toHaveText(
      "Local flow complete. No external agents were called.",
    );
    await expect(sample.locator("[data-stage].is-complete")).toHaveCount(5);
    await sample.locator('[data-stage="parallel"]').click();
    await expect(sample.locator(".sample-stage-detail h3")).toContainText(
      "Read the current sample inputs",
    );
    await sample.getByRole("button", { name: "Reset sample" }).click();
    await expect(sample.locator("#sample-sleep-label")).toHaveText("5.2 hours");
    await expect(sample.locator("[data-panel=dashboard]")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
    console.log(
      `PASS NüMe sample ${width}px: inputs, plan feedback, health, recipe filters, agent playback, reset, no API/external calls or overflow.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
