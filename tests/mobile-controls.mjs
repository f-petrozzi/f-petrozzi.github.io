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
const desktopSide = await desktop
  .locator("#panel-experience .career-stop")
  .first()
  .evaluate((el) => ({
    card: el.querySelector(".career-card").getBoundingClientRect().x,
    dot: el.querySelector(".career-node").getBoundingClientRect().x,
  }));
assert.ok(desktopSide.card < desktopSide.dot);
assert.ok(
  (
    await desktop.locator("#panel-experience .career-card").last().innerText()
  ).includes("Slice of the Burg"),
);
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
await page.locator(".theme-toggle").tap();
assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
const headerItems = await page.locator(".site-header > *").evaluateAll((els) =>
  els
    .filter((el) => el.getBoundingClientRect().height > 0)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return r.y + r.height / 2;
    }),
);
assert.ok(
  Math.max(...headerItems) - Math.min(...headerItems) < 2,
  "header stays on one row",
);
const mobileCard = page.locator("#panel-experience .career-card").first();
await mobileCard.locator("summary").tap();
await page.waitForTimeout(500);
assert.ok(await mobileCard.evaluate((el) => el.open));
await mobileCard.locator("summary").tap();
await page.waitForTimeout(500);
assert.equal(await mobileCard.evaluate((el) => el.open), false);

// Mirrored mobile tracks and GPA stay readable without expanding cards.
const side = async (kind) =>
  page
    .locator(`#panel-${kind} .career-stop`)
    .first()
    .evaluate((el) => ({
      card: el.querySelector(".career-card").getBoundingClientRect().x,
      dot: el.querySelector(".career-node").getBoundingClientRect().x,
    }));
assert.ok((await side("experience")).card < (await side("experience")).dot);
await page.getByRole("tab", { name: "Education", exact: true }).tap();
await page.waitForTimeout(1400);
assert.ok((await side("education")).card > (await side("education")).dot);
assert.equal(await page.locator("#panel-education .gpa:visible").count(), 2);
assert.equal(
  await page.locator("#panel-education .career-card[open]").count(),
  0,
);
// Mobile selection survives blur and becomes a persistent, stackable pill.
await page.locator("#project-search").fill("py");
await page.getByRole("option", { name: "Python", exact: true }).tap();
assert.ok(
  await page
    .getByRole("button", { name: "Remove Python filter", exact: true })
    .isVisible(),
);
await page.locator("#project-search").fill("docker");
await page.locator("#project-search").press("Enter");
assert.equal(await page.locator(".search-filter-pill").count(), 2);
assert.ok(
  await page.locator(".project-row:visible").evaluateAll(
    (els) =>
      els.length > 0 &&
      els.every((el) => {
        const tools = JSON.parse(el.dataset.tools);
        return tools.includes("Python") && tools.includes("Docker");
      }),
  ),
);
await page
  .getByRole("button", { name: "Remove Python filter", exact: true })
  .tap();
assert.equal(await page.locator(".search-filter-pill").count(), 1);
await page.getByRole("button", { name: "Reset filters", exact: true }).tap();
assert.equal(await page.locator(".search-filter-pill").count(), 0);
await page.locator("#project-search").fill("p");
await page.locator("#project-search").press("ArrowDown");
const selectedTool = await page
  .getByRole("option", { selected: true })
  .innerText();
await page.locator("#project-search").press("Enter");
assert.ok(
  await page
    .getByRole("button", { name: `Remove ${selectedTool} filter`, exact: true })
    .isVisible(),
);
await page.getByRole("button", { name: "Reset filters", exact: true }).tap();
await page.locator("#project-search").blur();
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
await page.waitForTimeout(750);
assert.equal(
  await page
    .locator(".scroll-thumb")
    .evaluate((el) => el === document.activeElement),
  false,
);
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
  const moved = await page.locator(".scroll-thumb").boundingBox();
  assert.ok(
    Math.abs(moved.y + moved.height / 2 - (y + i * 12)) < 2,
    "held droplet should stay under the finger",
  );
}
for (const delta of [80, 64, 48, 64, 80, 96]) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x, y: y + delta }],
  });
  await page.waitForTimeout(20);
  const moved = await page.locator(".scroll-thumb").boundingBox();
  assert.ok(
    Math.abs(moved.y + moved.height / 2 - (y + delta)) < 2,
    "direction reversal should track the finger",
  );
}
await page.evaluate(() => {
  window.samples = [];
});
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
  "PASS: mobile icon navigation, no overflow, 16px search, standalone theme, hover/keyboard/tap cards, held touch inertia, cancellation, mirrored timelines, GPA, and stacked tool filters.",
);
await browser.close();
