import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.PREVIEW_URL || "http://petro.ink:4444";
for (const cached of [false, true]) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(cached ? { ignoreDefaultArgs: ["--disable-back-forward-cache"] } : {}),
  });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      // The top back link and the "All projects" link in the closing nav.
      for (const returnSelector of [".back-link", ".case-nav-all"]) {
        await page.goto(base);
        await page.locator("#project-search").fill("python");
        const row = page
          .locator(".project-row:visible .project-row-link")
          .last();
        await row.evaluate((el) =>
          el.scrollIntoView({ block: "center", behavior: "instant" }),
        );
        await page.waitForTimeout(350);
        const before = await page.evaluate(() => ({
          scroll: scrollY,
          count: document.querySelectorAll(".project-row:not([hidden])").length,
        }));
        await row.click();
        await page.waitForURL("**/projects/**");
        assert.equal(
          await page.evaluate(() => history.state.collectionBack),
          true,
        );
        if (returnSelector === ".case-nav-all") await page.reload();
        await page
          .locator(returnSelector)
          .filter({ hasText: "All projects" })
          .click();
        await page.waitForURL(base + "/");
        await page.waitForFunction(
          (scroll) => Math.abs(scrollY - scroll) < 2,
          before.scroll,
        );
        assert.equal(
          await page.locator("#project-search").inputValue(),
          "python",
        );
        assert.equal(
          await page.locator(".project-row:visible").count(),
          before.count,
        );
        console.log(
          `${width}px cached=${cached}: ${returnSelector} restored ${before.scroll}px and filters`,
        );
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
    const direct = await browser.newPage();
    await direct.goto(base + "/projects/nest/");
    await direct
      .getByRole("link", { name: "All projects", exact: true })
      .first()
      .click();
    await direct.waitForURL("**/#projects");
    await direct.close();
  } finally {
    await browser.close();
  }
}
