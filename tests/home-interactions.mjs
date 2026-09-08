import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
});
const base = process.env.PREVIEW_URL || "http://petro.ink:4444";
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const settle = () => page.waitForTimeout(500);
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await settle();
assert.equal(await page.locator(".project-row").count(), 21);
assert.equal(await page.locator(".sheen").count(), 0);
assert.ok(!(await page.locator("body").innerText()).includes("↗"));
assert.equal(
  await page
    .locator("dialog")
    .evaluate((el) => getComputedStyle(el, "::backdrop").backdropFilter),
  "none",
);
assert.equal(await page.locator(".project-thumb img").count(), 0);
assert.ok((await page.locator(".ui-icon").count()) > 40);
assert.equal(
  await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollbarWidth,
  ),
  "none",
);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth),
  1440,
);
await page.screenshot({
  path: "/tmp/portfolio-r5-desktop.png",
  fullPage: true,
});
await page.screenshot({ path: "/tmp/portfolio-r5-top.png" });
// Wheel behavior remains native.
await page.mouse.move(900, 700);
await page.mouse.wheel(0, 500);
await settle();
assert.ok(await page.evaluate(() => scrollY > 300));
const thumb = page.getByRole("scrollbar", { name: "Page scroll" });
await thumb.focus();
await page.keyboard.press("Home");
await settle();
assert.equal(await page.evaluate(() => scrollY), 0);
await thumb.hover();
await settle();
assert.ok(
  await page
    .locator(".scroll-glass")
    .evaluate((el) => el.getBoundingClientRect().width >= 29),
);
await page.screenshot({ path: "/tmp/portfolio-r5-glass.png" });
let box = await thumb.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + 20, 980, { steps: 14 });
await page.mouse.up();
await settle();
assert.ok(
  await page.evaluate(
    () =>
      scrollY / (document.documentElement.scrollHeight - innerHeight) > 0.98,
  ),
);
assert.equal(await thumb.getAttribute("aria-valuenow"), "100");
await page.keyboard.press("Home");
await settle();
// The surface follows nearby pointer direction, then rests. Wheel motion adds no bounce.
let dropletBox = await thumb.boundingBox();
await page.mouse.move(dropletBox.x + 58, dropletBox.y + 32);
await page.waitForTimeout(700);
const rightMorph = await page.locator(".scroll-fluid").evaluate((el) => ({
  transform: el.style.transform,
  radius: el.style.getPropertyValue("--fluid-radius"),
}));
assert.ok(rightMorph.transform && rightMorph.radius);
await page.mouse.move(dropletBox.x + 1, dropletBox.y + 12);
await page.waitForTimeout(700);
const leftMorph = await page
  .locator(".scroll-fluid")
  .evaluate((el) => el.style.getPropertyValue("--fluid-radius"));
assert.notEqual(leftMorph, rightMorph.radius);
await page.screenshot({ path: "/tmp/portfolio-r5-cursor.png" });
await page.mouse.move(1000, 400);
await page.waitForTimeout(1600);
assert.equal(
  await page.locator(".scroll-fluid").evaluate((el) => el.style.transform),
  "",
);
await page.mouse.wheel(0, 150);
await settle();
assert.equal(
  await page.locator(".scroll-fluid").evaluate((el) => el.style.transform),
  "",
);
// Connected opening, Escape close, exact scroll/focus restoration.
const trigger = page.locator(".feature-image");
await trigger.scrollIntoViewIfNeeded();
const before = await page.evaluate(() => scrollY);
await trigger.click();
await settle();
assert.equal(await page.locator("dialog").evaluate((el) => el.open), true);
assert.equal(new URL(page.url()).hash, "#project-homelab");
await page.screenshot({ path: "/tmp/portfolio-r5-detail.png" });
await page.keyboard.press("Escape");
await settle();
assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
assert.ok(Math.abs((await page.evaluate(() => scrollY)) - before) <= 1);
assert.ok(await trigger.evaluate((el) => el === document.activeElement));
await page.goForward();
await settle();
assert.equal(await page.locator("dialog").evaluate((el) => el.open), true);
await page.goBack();
await settle();
assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
// All tools are searchable, including those beyond the three displayed previously.
await page.locator("#project-search").fill("Cloudflare");
await settle();
assert.ok((await page.locator(".project-row:visible").count()) >= 3);
await page.locator("#project-search").fill("no-such-project-123");
await settle();
assert.equal(await page.locator(".project-row:visible").count(), 0);
assert.ok(await page.locator("#empty-results").isVisible());
await page.locator("#clear-filters").click();
await settle();
assert.equal(await page.locator(".project-row:visible").count(), 21);
for (const id of ["ai", "web", "infra", "all"])
  await page.locator(`[data-filter="${id}"]`).click();
await settle();
assert.equal(await page.locator(".project-row:visible").count(), 21);
// A filter must not assign Nest to AI just because it uses Pydantic or FastAPI.
await page.locator('[data-filter="ai"]').click();
await settle();
assert.equal(
  await page
    .locator(".project-row:visible")
    .filter({ hasText: "My household app" })
    .count(),
  0,
);
await page.locator('[data-filter="all"]').click();
await settle();
// Hover draws once, holds its endpoint, and resets only on leaving.
await page.locator(".journey-intro").hover();
assert.deepEqual(
  await page.locator(".journey-intro").evaluate((el) =>
    el
      .getAnimations({ subtree: true })
      .filter((a) => a.animationName?.startsWith("journey-"))
      .map((a) => a.effect.getTiming().iterations),
  ),
  [1, 1, 1],
);
await page.waitForTimeout(1000);
assert.equal(
  await page
    .locator(".journey-years > span:last-child")
    .evaluate((el) => getComputedStyle(el).opacity),
  "1",
);
assert.equal(
  await page
    .locator(".year-line")
    .evaluate((el) => getComputedStyle(el, "::after").right),
  "0px",
);
await page.mouse.move(0, 0);
assert.equal(
  await page
    .locator(".year-line")
    .evaluate((el) => getComputedStyle(el, "::after").animationName),
  "none",
);
// Chronological tabs and keyboard controls, including interruptions.
await page.getByRole("tab", { name: "Education", exact: true }).click();
await settle();
assert.ok(await page.locator("#panel-education").isVisible());
assert.equal(await page.locator("#panel-education .career-stop").count(), 2);
assert.equal(await page.locator("#journey-start").innerText(), "2019");
await page.screenshot({ path: "/tmp/portfolio-r5-education.png" });
await page.keyboard.press("ArrowLeft");
await settle();
assert.ok(await page.locator("#panel-experience").isVisible());
assert.equal(await page.locator("#panel-experience .career-stop").count(), 5);
assert.ok(
  (await page.locator("#panel-experience").innerText()).includes(
    "Handshake AI",
  ),
);
assert.ok(
  (await page.locator("#panel-experience").innerText()).includes(
    "Audio Visual Technician",
  ),
);
for (const name of ["Education", "Experience", "Education", "Experience"])
  await page.getByRole("tab", { name, exact: true }).click();
await settle();
assert.equal(
  await page.locator(".timeline-stage").evaluate((el) => el.style.height),
  "",
);
await page.waitForTimeout(2000);
await page.screenshot({ path: "/tmp/portfolio-r5-experience.png" });
const geometry = await page.locator("#panel-experience").evaluate((panel) => {
  const stops = [...panel.querySelectorAll(".career-stop")];
  return stops.map((stop, i) => {
    const card = stop.querySelector(".career-card").getBoundingClientRect();
    const year = stop.querySelector(".career-date").getBoundingClientRect();
    const dot = stop.querySelector(".career-node").getBoundingClientRect();
    const segment = stop.querySelector(".career-segment");
    const next = stops[i + 1]
      ?.querySelector(".career-node")
      .getBoundingClientRect();
    return {
      cardCenter: card.top + card.height / 2,
      dotCenter: dot.top + dot.height / 2,
      yearLeft: year.left,
      dotRight: dot.right,
      yearRight: year.right,
      dotLeft: dot.left,
      segmentEnd: segment.getBoundingClientRect().bottom,
      nextY: next ? next.top + next.height / 2 : null,
      lastHidden: getComputedStyle(segment).display === "none",
    };
  });
});
for (const row of geometry) {
  assert.ok(Math.abs(row.cardCenter - row.dotCenter) < 1);
  assert.ok(row.yearLeft > row.dotRight);
  if (row.nextY !== null) assert.ok(Math.abs(row.segmentEnd - row.nextY) < 2);
  else assert.ok(row.lastHidden);
}
assert.ok(
  await page.locator("#panel-experience .org-icon img").evaluateAll((images) =>
    images.every((img) => {
      const a = img.getBoundingClientRect(),
        b = img.parentElement.getBoundingClientRect();
      return (
        a.left >= b.left &&
        a.right <= b.right &&
        a.top >= b.top &&
        a.bottom <= b.bottom
      );
    }),
  ),
);
await page.getByRole("scrollbar").focus();
await page.keyboard.press("Home");
await page.waitForTimeout(1800);
assert.equal(
  await page.locator(".scroll-fluid").evaluate((el) => el.style.transform),
  "",
);
// Reduced motion, responsive viewport, and direct detail URLs.
await page.emulateMedia({ reducedMotion: "reduce" });
await page.locator(".journey-intro").hover();
assert.equal(
  await page
    .locator(".year-line")
    .evaluate((el) => getComputedStyle(el, "::after").animationName),
  "none",
);
await page.goto(`${base}/#project-homelab`, {
  waitUntil: "networkidle",
});
assert.equal(await page.locator("dialog").evaluate((el) => el.open), true);
assert.equal(await page.locator(".project-ghost").count(), 0);
await page.keyboard.press("Escape");
await settle();
assert.equal(await page.locator("dialog").evaluate((el) => el.open), false);
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.screenshot({ path: "/tmp/portfolio-r5-mobile.png", fullPage: true });
await page.screenshot({ path: "/tmp/portfolio-r5-mobile-top.png" });
await page.locator(".feature-image").click();
assert.ok(
  await page
    .locator("dialog")
    .evaluate((el) => el.scrollWidth <= el.clientWidth),
);
await page.screenshot({ path: "/tmp/portfolio-r5-mobile-detail.png" });
await page.keyboard.press("Escape");
await settle();
await page.setViewportSize({ width: 320, height: 740 });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
assert.ok(await page.getByRole("scrollbar").isVisible());
const nojs = await browser.newContext({ javaScriptEnabled: false });
const plain = await nojs.newPage();
await plain.goto(`${base}/`);
assert.equal(await plain.locator(".project-row:visible").count(), 21);
assert.equal(await plain.locator(".filters").isVisible(), false);
assert.equal(await plain.locator(".career-stop:visible").count(), 7);
assert.equal(await plain.locator(".scroll-rail").isVisible(), false);
assert.equal(
  await plain.locator(".feature-image").getAttribute("href"),
  "/projects/homelab/",
);
assert.deepEqual(errors, []);
console.log(
  "PASS: wheel, drag bounds, keyboard, glass expansion, dialog/history/focus/scroll, filtering, mobile, reduced motion, no-JS, console.",
);
await browser.close();
