import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
});
const base = process.env.PREVIEW_URL || "http://petro.ink:4444";
const desktop = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
});
await desktop.goto(base, { waitUntil: "networkidle" });
const card = desktop.locator("#panel-experience .career-card").first();
await card.scrollIntoViewIfNeeded();
await desktop.waitForTimeout(1800);
const collapsed = (await card.boundingBox()).height;
await card.hover();
await desktop.waitForTimeout(500);
assert.ok((await card.boundingBox()).height > collapsed + 15);
assert.ok(await card.locator(".career-description").isVisible());
await desktop.mouse.move(0, 0);
await desktop.waitForTimeout(500);
assert.ok(Math.abs((await card.boundingBox()).height - collapsed) < 1);
await card.locator("summary").focus();
await desktop.keyboard.press("Enter");
await desktop.waitForTimeout(500);
assert.ok(await card.evaluate((el) => el.open));
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(base, { waitUntil: "networkidle" });
for (const width of [320, 390]) {
  await page.setViewportSize({ width, height: 844 });
  for (const name of ["Work", "Background", "Contact"])
    assert.ok(
      await page
        .getByRole("navigation")
        .getByRole("link", { name, exact: true })
        .isVisible(),
    );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  assert.ok(
    await page
      .locator("#project-search")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16),
  );
}
const slider = page.locator(".theme-slider");
const dark = await slider.evaluate(
  (el) =>
    el.getBoundingClientRect().x - el.parentElement.getBoundingClientRect().x,
);
await page.locator(".theme-toggle").tap();
await page.waitForTimeout(500);
const light = await slider.evaluate(
  (el) =>
    el.getBoundingClientRect().x - el.parentElement.getBoundingClientRect().x,
);
assert.ok(dark - light >= 25);
await page
  .locator(".site-header")
  .screenshot({ path: "/tmp/portfolio-mobile-header.png" });
const mobileCard = page.locator("#panel-experience .career-card").first();
await mobileCard.locator("summary").tap();
await page.waitForTimeout(500);
assert.ok(await mobileCard.evaluate((el) => el.open));
await mobileCard.locator("summary").tap();
await page.waitForTimeout(500);
assert.equal(await mobileCard.evaluate((el) => el.open), false);
await page
  .locator(".journey")
  .screenshot({ path: "/tmp/portfolio-mobile-cards.png" });
// Real touch input through Chromium exercises pointer capture and release inertia.
const cdp = await context.newCDPSession(page);
await page.evaluate(() => scrollTo({ top: 600, behavior: "instant" }));
await page.waitForTimeout(100);
const thumb = await page.locator(".scroll-thumb").boundingBox();
const x = thumb.x + thumb.width / 2,
  y = thumb.y + thumb.height / 2;
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x, y }],
});
await page.evaluate(() => {
  window.samples = [];
  window.sampling = true;
  const tick = () => {
    window.samples.push(scrollY);
    if (window.sampling) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
for (let i = 1; i <= 8; i++) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y + i * 12 }],
  });
  await page.waitForTimeout(20);
}
const releaseY = await page.evaluate(() => scrollY);
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await page.waitForTimeout(1400);
const samples = await page.evaluate(() => {
  window.sampling = false;
  return window.samples;
});
assert.ok(samples.at(-1) > releaseY + 20, "release should coast");
assert.ok(
  samples.every((v, i) => i === 0 || v >= samples[i - 1] - 1),
  "touch scroll should not jitter backwards",
);
assert.ok(
  Math.abs(samples.at(-1) - samples.at(-5)) < 3,
  "momentum should settle",
);
// A new touch must stop the coast, while a cancelled drag must not start one.
const second = await page.locator(".scroll-thumb").boundingBox();
const sx = second.x + 22,
  sy = second.y + 32;
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: sx, y: sy }],
});
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchMove",
  touchPoints: [{ x: sx, y: sy - 60 }],
});
await page.waitForTimeout(50);
await cdp.send("Input.dispatchTouchEvent", {
  type: "touchCancel",
  touchPoints: [],
});
const cancelled = await page.evaluate(() => scrollY);
await page.waitForTimeout(300);
assert.ok(Math.abs((await page.evaluate(() => scrollY)) - cancelled) < 2);
assert.deepEqual(errors, []);
console.log(
  "PASS: mobile icon navigation, no overflow, 16px search, sliding theme, hover/keyboard/tap cards, monotonic touch inertia and cancellation.",
);
await browser.close();
