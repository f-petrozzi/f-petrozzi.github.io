import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.PREVIEW_URL || "http://petro.ink:4444";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
});
await context.addInitScript(() => {
  addEventListener("pagereveal", (e) => {
    if (!e.viewTransition) return;
    e.viewTransition.ready.then(
      () => {
        const sample = (window.transitionSample = {
          started: true,
          finished: false,
          frames: [],
        });
        const tick = (time) => {
          sample.frames.push(time);
          if (!sample.finished) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        e.viewTransition.finished.then(() => {
          sample.finished = true;
        });
      },
      () => {},
    );
  });
});
const page = await context.newPage();
// Simulate stalled CDNs. They must not hold up either document's reveal.
await page.route("https://**/*", async (route) => {
  await new Promise((r) => setTimeout(r, 5000));
  await route.abort().catch(() => {});
});
// Specifically exercise the old defer-script race with a slow transition script.
await page.route("**/era.js", async (route) => {
  await new Promise((r) => setTimeout(r, 250));
  await route.continue();
});
await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
const results = [];
for (let i = 0; i < 6; i++) {
  const old = i % 2 === 0;
  const link = page.locator(old ? ".era-switch" : ".classic-era-switch");
  await link.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(`${base}${old ? "/classic/" : "/"}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.transitionSample?.finished === true, {
    timeout: 5000,
  });
  const sample = await page.evaluate(() => {
    const times = window.transitionSample.frames;
    const gaps = times
      .slice(1)
      .map((t, i) => t - times[i])
      .sort((a, b) => a - b);
    return {
      frames: times.length,
      p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)] || 0),
    };
  });
  results.push({
    direction: old ? "current to original" : "original to current",
    ...sample,
  });
}
await page.goBack({ waitUntil: "domcontentloaded" });
await page.goForward({ waitUntil: "domcontentloaded" });
await page.emulateMedia({ reducedMotion: "reduce" });
await page.locator(".era-switch").click();
await page.waitForURL(`${base}/classic/`, { waitUntil: "domcontentloaded" });
assert.ok(
  !((await page.locator("html").getAttribute("class")) || "").includes(
    "era-arrival",
  ),
);
console.log(
  JSON.stringify({
    result: "passed",
    roundTrips: 3,
    slowScriptMs: 250,
    stalledExternalMs: 5000,
    samples: results,
  }),
);
await browser.close();
