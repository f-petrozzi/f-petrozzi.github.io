import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const base = process.env.PREVIEW_URL || "http://petro.ink:4444";
try {
  for (const width of [1440, 900, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    console.log(`Checking arrival at ${width}px`);
    await page.goto(base);
    await page.waitForFunction(
      () =>
        document.querySelector(".scroll-fluid")?.dataset.arrival === "running",
    );
    assert.equal(await page.locator(".arrival-drop").count(), 4);
    assert.equal(await page.locator(".site-header .brand").innerText(), "");
    await page.waitForFunction(
      () => document.querySelector(".scroll-fluid")?.dataset.arrival === "done",
    );
    assert.equal(await page.locator(".arrival-drop").count(), 0);
    for (const route of ["/", "/projects/homelab/", "/projects/nest/"]) {
      console.log(`Checking ${route} at ${width}px`);
      await page.goto(base + route);
      await page.waitForFunction(() =>
        document.documentElement.classList.contains("has-scroll-control"),
      );
      const geometry = await page.evaluate(() => {
        const logo = document
          .querySelector(".brand img,.wordmark img")
          .getBoundingClientRect();
        const rail = document
          .querySelector(".scroll-rail")
          .getBoundingClientRect();
        return {
          logoX: logo.x + logo.width * 0.358 - 4,
          railX: rail.x + rail.width / 2,
          logoWidth: logo.width,
        };
      });
      assert.ok(Math.abs(geometry.logoX - geometry.railX) < 1);
      assert.equal(geometry.logoWidth, 38);
      const thumb = page.locator(".scroll-thumb");
      await thumb.focus();
      // Owner preference: no focus frames.
      assert.equal(
        await thumb.evaluate((el) => getComputedStyle(el).outlineStyle),
        "none",
      );
      await page.keyboard.press("End");
      await page.waitForFunction(
        () =>
          document
            .querySelector(".scroll-thumb")
            .getAttribute("aria-valuenow") === "100",
      );
      await page.keyboard.press("Home");
    }
    assert.equal(await page.locator("body > aside.scroll-rail").count(), 1);
    // Dynamic content that fits the viewport should not retain a scrollbar.
    await page.goto(base + "/projects/nest/");
    await page.evaluate(() => {
      document.querySelector("main").style.display = "none";
      document.querySelector("footer").style.display = "none";
    });
    await page.waitForFunction(
      () => document.querySelector(".scroll-rail").hidden,
    );
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`Scroll control verified at ${width}px`);
  }
  const page = await browser.newPage({ reducedMotion: "reduce" });
  await page.goto(base);
  await page.waitForFunction(() =>
    document.documentElement.classList.contains("has-scroll-control"),
  );
  assert.equal(await page.locator(".arrival-drop").count(), 0);
  await page.close();
} finally {
  await browser.close();
}
