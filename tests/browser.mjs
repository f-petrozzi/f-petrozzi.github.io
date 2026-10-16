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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  context.on("page", (page) =>
    page.on("pageerror", (error) => errors.push(error.message)),
  );
  const page = await context.newPage();
  await page.goto(`${base}/`);
  await expect(page.locator(".filters")).toBeVisible();
  await expect(page.locator(".project-row:visible")).toHaveCount(21);
  await expect(page.locator("h1")).toContainText("Fabrizio Petrozzi");

  // Each featured disclosure supports native pointer and keyboard activation.
  const cards = page.locator("article.work-card");
  await expect(cards).toHaveCount(4);
  const projects = [];
  for (const card of await cards.all()) {
    const details = card.locator("details");
    const summary = details.locator("summary");
    await expect(summary).toHaveAccessibleName(/^About /);
    await expect(details).toHaveJSProperty("open", false);
    await summary.hover();
    await expect(details).toHaveJSProperty("open", true);
    await expect(summary).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(() =>
        details.evaluate((el) =>
          Math.abs(
            el.clientHeight - el.querySelector(".work-more-body").scrollHeight,
          ),
        ),
      )
      .toBeLessThan(2);
    await expect(details.locator(".work-more-body")).toBeVisible();
    await summary.click();
    await expect(details).toHaveJSProperty("open", false);
    await summary.focus();
    await summary.press("Enter");
    await expect(details).toHaveJSProperty("open", true);
    await summary.press("Space");
    await expect(details).toHaveJSProperty("open", false);

    const link = card.getByRole("link", { name: /^Read project/ });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/projects\/[a-z0-9-]+\/$/);
    projects.push({
      href,
      title: (await card.locator("h3").innerText()).trim(),
    });
  }
  expect(projects.map(({ href }) => href).sort()).toEqual([
    "/projects/homelab/",
    "/projects/nest/",
    "/projects/nume/",
    "/projects/proterra/",
  ]);
  // Follow every Read project link and verify its destination actually renders.
  for (const { href, title } of projects) {
    await page.locator(`.work-read[href="${href}"]`).click();
    await expect(page).toHaveURL(`${base}${href}`);
    await expect(page.locator("h1")).toHaveText(title);
    await expect(page.locator(".case-facts")).toBeVisible();
    await page.goto(`${base}/`);
    await expect(page.locator(".filters")).toBeVisible();
  }

  // Featured photos and diagrams open quick previews without navigating.
  await page
    .getByRole("button", { name: "Preview Homelab", exact: true })
    .click();
  await expect(page.locator(".image-viewer")).toBeVisible();
  await expect(page).toHaveURL(`${base}/`);
  await page.keyboard.press("Escape");
  await expect(page.locator(".image-viewer")).toBeHidden();
  await page.getByRole("button", { name: "Preview Nest", exact: true }).click();
  await expect(page.locator(".visual-viewer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".visual-viewer")).toBeHidden();

  // Screenshot controls switch real captures, with the enlarged image following selection.
  const gallery = page.locator(".nume-gallery");
  await gallery.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(gallery.locator("img")).toHaveAttribute(
    "src",
    /nume-orchestration.webp$/,
  );
  await page.locator("#work-nume").locator("../..").locator("summary").click();
  await expect(gallery).not.toHaveAttribute("inert", "");
  await page
    .locator("#work-nume")
    .locator("../..")
    .locator("summary")
    .press("Escape");
  await expect(gallery).not.toHaveAttribute("inert", "");
  await gallery
    .getByRole("button", { name: "Preview NüMe screenshot" })
    .click();
  await expect(page.locator(".preview-tabs")).toBeVisible();
  await page
    .locator(".preview-tabs")
    .getByRole("button", { name: "Sleep", exact: true })
    .click();
  await expect(page.locator(".image-viewer img")).toHaveAttribute(
    "src",
    /nume-sleep.webp$/,
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".image-viewer img")).toHaveAttribute(
    "src",
    /nume-orchestration.webp$/,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".image-viewer")).toBeHidden();
  await page.goto(`${base}/projects/nume/`);
  await expect(page.locator(".nume-sample")).toBeVisible();
  await expect(page.locator(".nume-gallery")).toHaveCount(0);
  await page
    .getByRole("button", { name: "What should I eat?", exact: true })
    .click();
  await expect(page.locator(".sample-reply")).toContainText("Spinach & Walnut");
  await page.goto(`${base}/`);

  const theme = page.locator(".nav-capsule .theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const value of ["light", "dark"]) {
    await theme.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", value);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("portfolio-theme")))
      .toBe(value);
    await page.reload();
    await expect(page.locator(".filters")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", value);
    await expect(theme).toHaveAccessibleName(
      `Switch to ${value === "light" ? "dark" : "light"} theme`,
    );
  }

  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const [name, id] of [
    ["Work", "work"],
    ["Background", "background"],
    ["Projects", "projects"],
    ["Contact", "contact"],
  ]) {
    const link = nav.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", `#${id}`);
    await link.click();
    await expect(page).toHaveURL(`${base}/#${id}`);
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
  const era = page
    .locator("footer")
    .getByRole("link", { name: "Original portfolio (2023)" });
  await expect(era).toHaveAttribute("href", "/classic/");
  await expect(era).toBeVisible();

  // Verify progressive enhancement in a genuinely script-free context.
  const nojs = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 1000 },
  });
  const plain = await nojs.newPage();
  await plain.goto(`${base}/`);
  await expect(plain.locator(".project-row:visible")).toHaveCount(21);
  await expect(plain.locator(".filters")).toBeHidden();
  await expect(plain.locator("#panel-experience")).toBeVisible();
  await expect(plain.locator("#panel-education")).toBeVisible();
  await expect(plain.locator(".career-stop:visible")).toHaveCount(8);
  await expect(plain.locator("footer a[href='/classic/']")).toBeVisible();
  await nojs.close();

  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const quiet = await reduced.newPage();
  quiet.on("pageerror", (error) => errors.push(error.message));
  await quiet.goto(`${base}/`);
  await expect(quiet.locator(".filters")).toBeVisible();
  await expect(quiet.locator("article.work-card")).toHaveCount(4);
  await expect(quiet.locator(".project-row:visible")).toHaveCount(21);
  expect(
    await quiet.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  await quiet.locator(".filter-toggle").click();
  await quiet.locator('[data-filter="infra"]').click();
  await expect(quiet.locator(".project-row:visible")).toHaveCount(1);
  await expect(quiet.locator("#result-count")).toHaveText("1 project");
  await quiet.locator("#project-search").fill("no-such-project-regression");
  await expect(quiet.locator("#empty-results")).toBeVisible();
  await quiet
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(quiet.locator(".project-row:visible")).toHaveCount(21);
  await reduced.close();

  expect(errors).toEqual([]);
  console.log(
    "PASS browser: four featured disclosures and project destinations, persistent themes, capsule navigation, footer era link, no-JS rows/timelines, reduced-motion filtering, no page errors.",
  );
} finally {
  await browser.close();
}
