import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
const base = process.env.PREVIEW_URL || "http://petro.ink:4444";
const projectCount = readdirSync("src/content/projects").filter((f) =>
  f.endsWith(".md"),
).length;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("pageerror", (e) => errors.push(e.message));
const requests = [];
page.on("request", (r) => requests.push(r.url()));
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.locator(".about-person").scrollIntoViewIfNeeded();
await page.locator(".about-person img").evaluate((img) => img.decode());
await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
await page.screenshot({ path: "/tmp/portfolio-desktop.png", fullPage: true });
assert.equal(await page.locator(".project-row:visible").count(), projectCount);
assert.ok(
  !requests.some(
    (r) =>
      r.includes("unpkg") ||
      r.includes("googleapis") ||
      r.includes("/classic/"),
  ),
);
await page.locator("#project-search").fill("nume");
assert.equal(await page.locator(".project-row:visible").count(), 1);
await page.locator("#project-search").fill("FastAPI");
assert.equal(await page.locator(".project-row:visible").count(), 3);
await page.getByRole("button", { name: "Reset filters" }).click();
await page.locator("#category-filter").selectOption("Earlier work");
assert.equal(await page.locator(".project-row:visible").count(), 13);
await page.locator("#tool-filter").selectOption("Python");
assert.ok((await page.locator(".project-row:visible").count()) > 0);
await page.locator("#project-search").fill("nothingmatches");
assert.ok(await page.locator("#empty-results").isVisible());
await page.getByRole("button", { name: "Reset filters" }).click();
await page.getByRole("button", { name: "Switch to light theme" }).click();
assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
await page.reload();
assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
await page.getByRole("button", { name: "Switch to dark theme" }).click();
await page.locator(".project-summary").first().click();
await page.waitForURL("**/projects/nume/");
assert.ok(
  await page.getByRole("heading", { name: "How it works" }).isVisible(),
);
await page.goto(`${base}/`);
// Block external legacy requests to keep offline comparison checks deterministic.
await page.route("https://**/*", (route) => route.abort());
await page.locator(".era-switch").click();
await page.waitForURL("**/classic/");
assert.ok(
  ((await page.locator("html").getAttribute("class")) || "").includes(
    "era-arrival",
  ),
);
await page.waitForTimeout(1000);
assert.ok(await page.locator(".classic-era-switch").isVisible());
await page.locator(".classic-era-switch").click();
await page.waitForURL(`${base}/`);
await page.waitForTimeout(1000);
assert.equal(await page.locator(".project-row:visible").count(), projectCount);
await page.setViewportSize({ width: 320, height: 740 });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "/tmp/portfolio-mobile.png", fullPage: true });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.emulateMedia({ reducedMotion: "reduce" });
await page.locator(".era-switch").click();
await page.waitForURL("**/classic/");
assert.ok(
  !((await page.locator("html").getAttribute("class")) || "").includes(
    "era-arrival",
  ),
);
const nojs = await browser.newContext({ javaScriptEnabled: false });
const p = await nojs.newPage();
await p.goto(`${base}/`);
assert.equal(await p.locator(".project-row:visible").count(), projectCount);
assert.ok(!(await p.locator(".filters").isVisible()));
// Legacy's third-party map is intentionally unavailable in this offline check.
assert.deepEqual(
  errors.filter((e) => !e.includes("maplibregl")),
  [],
);
const fallback = await browser.newContext();
await fallback.addInitScript(() => {
  const supports = CSS.supports.bind(CSS);
  CSS.supports = (...args) =>
    args[0] === "view-transition-name" ? false : supports(...args);
});
const fp = await fallback.newPage();
await fp.route("https://**/*", (r) => r.abort());
await fp.goto(`${base}/`);
await fp.locator(".era-switch").click();
await fp.waitForURL("**/classic/");
assert.ok(
  ((await fp.locator("html").getAttribute("class")) || "").includes(
    "era-fallback-arrival",
  ),
);
await fp.locator(".classic-era-switch").click();
await fp.waitForURL(`${base}/`);
console.log(
  JSON.stringify({
    result: "passed",
    homeRequests: requests.filter((r) => r.startsWith(`${base}/`)).length,
    desktop: "/tmp/portfolio-desktop.png",
    mobile: "/tmp/portfolio-mobile.png",
    legacyExternalRequests: "blocked for deterministic test",
  }),
);
await browser.close();
