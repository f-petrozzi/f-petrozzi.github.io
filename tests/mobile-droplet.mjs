import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.PREVIEW_URL || "http://petro.ink:4444";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("portfolio-liquid-arrival-v4", "seen"),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const running = () =>
    page.waitForFunction(
      () =>
        document.querySelector(".scroll-fluid")?.dataset.arrival === "running",
    );
  const done = () =>
    page.waitForFunction(
      () => document.querySelector(".scroll-fluid")?.dataset.arrival === "done",
    );
  for (const route of ["/", "/projects/homelab/"]) {
    await page.goto(base + route);
    await running();
    assert.equal(await page.locator(".arrival-drop").count(), 4);
    const before = await page
      .locator(".arrival-drop")
      .first()
      .evaluate((el) => el.style.transform);
    await page.setViewportSize({ width: 390, height: 780 });
    await page.waitForTimeout(120);
    assert.equal(
      await page.locator(".scroll-fluid").first().getAttribute("data-arrival"),
      "running",
    );
    assert.notEqual(
      await page
        .locator(".arrival-drop")
        .first()
        .evaluate((el) => el.style.transform),
      before,
    );
    await done();
    assert.equal(await page.locator(".arrival-drop").count(), 0);
    await page.reload();
    await running();
    await done();
    console.log(
      `Mobile entrance survives height changes and replays on reload: ${route}`,
    );
  }
  await page.reload();
  await running();
  await page.evaluate(() => scrollTo({ top: 100, behavior: "instant" }));
  await page.waitForFunction(
    () =>
      document.querySelector(".scroll-fluid").dataset.arrival === "interrupted",
  );
  assert.equal(await page.locator(".arrival-drop").count(), 0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  assert.equal(await page.locator(".arrival-drop").count(), 0);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
