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
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 700 },
  ]) {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/`);
    await expect(page.locator(".filters")).toBeVisible();
    expect(
      await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
    ).toBe(true);

    async function checkLayout() {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${viewport.width}px: no horizontal document overflow`,
      ).toBe(true);
      const nav = page.locator(".nav-capsule");
      await expect(nav).toBeVisible();
      const capsule = await nav.boundingBox();
      expect(capsule.x).toBeGreaterThanOrEqual(0);
      expect(capsule.x + capsule.width).toBeLessThanOrEqual(viewport.width);
      const targets = nav.locator("a, button");
      await expect(targets).toHaveCount(5);
      for (const target of await targets.all()) {
        await expect(target).toBeVisible();
        const box = await target.boundingBox();
        expect(
          box.width,
          `${(await target.getAttribute("aria-label")) || (await target.innerText())}: target width`,
        ).toBeGreaterThanOrEqual(40);
        expect(box.height, "nav target height").toBeGreaterThanOrEqual(40);
        expect(box.x).toBeGreaterThanOrEqual(capsule.x);
        expect(box.x + box.width).toBeLessThanOrEqual(
          capsule.x + capsule.width,
        );
      }
      expect(
        await page
          .locator("#project-search")
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    }
    await checkLayout();

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    for (const [name, id] of [
      ["Work", "work"],
      ["Background", "background"],
      ["Projects", "projects"],
      ["Contact", "contact"],
    ]) {
      await nav.getByRole("link", { name, exact: true }).tap();
      await expect(page).toHaveURL(`${base}/#${id}`);
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    await nav
      .getByRole("button", { name: "Switch to light theme", exact: true })
      .tap();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("portfolio-theme")))
      .toBe("light");
    await page.reload();
    await expect(page.locator(".filters")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const details = page.locator("article.work-card details").first();
    await details.locator("summary").tap();
    await expect(details).toHaveJSProperty("open", true);
    await checkLayout();
    await details.locator("summary").tap();
    await expect(details).toHaveJSProperty("open", false);

    for (const kind of ["experience", "education"]) {
      await page.locator(`#tab-${kind}`).tap();
      await expect(page.locator(`#panel-${kind}`)).toBeVisible();
      const card = page.locator(`#panel-${kind} details.career-card`).first();
      await card.locator("summary").scrollIntoViewIfNeeded();
      await expect(card.locator("summary")).toBeVisible({ timeout: 10000 });
      await card.locator("summary").tap();
      await expect(card).toHaveJSProperty("open", true);
      await expect(card.locator(".career-description")).toBeVisible();
      await card.locator("summary").tap();
      await expect(card).toHaveJSProperty("open", false);
    }

    // Real touch selection must survive blur and create a pill rather than navigate.
    const search = page.locator("#project-search");
    await search.fill("py");
    const beforeSelection = page.url();
    await page.getByRole("option", { name: "Python", exact: true }).tap();
    await expect(page).toHaveURL(beforeSelection);
    await expect(
      page.getByRole("button", { name: "Remove Python filter", exact: true }),
    ).toBeVisible();
    await expect(search).toHaveValue("");
    await search.fill("Docker");
    await search.press("Enter");
    await expect(page.locator(".search-filter-pill")).toHaveCount(2);
    await expect
      .poll(() =>
        page.locator(".project-row:visible").evaluateAll(
          (rows) =>
            rows.length > 0 &&
            rows.every((row) => {
              const tools = JSON.parse(row.dataset.tools);
              return tools.includes("Python") && tools.includes("Docker");
            }),
        ),
      )
      .toBe(true);
    await checkLayout();
    await page
      .getByRole("button", { name: "Remove Python filter", exact: true })
      .tap();
    await expect(page.locator(".search-filter-pill")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Reset filters", exact: true })
      .tap();
    await expect(page.locator(".search-filter-pill")).toHaveCount(0);
    await expect(page.locator(".project-row:visible")).toHaveCount(21);
    await expect(page.locator("#result-count")).toHaveText("21 projects");
    await checkLayout();
    expect(errors).toEqual([]);
    await context.close();
    console.log(
      `PASS mobile-controls ${viewport.width}x${viewport.height}: touch navigation, capsule fit/40px targets, no overflow, 16px search, persistent theme, featured/career details, AND pills/reset, no page errors.`,
    );
  }
} finally {
  await browser.close();
}
