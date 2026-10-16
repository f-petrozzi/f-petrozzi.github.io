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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/`);
  await expect(page.locator(".filters")).toBeVisible();
  // Category chips are quiet by default and open from the Filters toggle.
  const filterToggle = page.locator(".filter-toggle");
  await expect(page.locator("#filter-panel")).toBeHidden();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await filterToggle.click();
  await expect(filterToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#filter-panel")).toBeVisible();
  const search = page.locator("#project-search");
  const divider = page.locator("[data-list-divider]");
  const reset = page.getByRole("button", {
    name: "Reset filters",
    exact: true,
  });
  const catalog = await page.locator(".project-row").evaluateAll((rows) =>
    rows.map((row) => ({
      href: row.querySelector("a").getAttribute("href"),
      facets: row.dataset.facets.split(" "),
      tools: JSON.parse(row.dataset.tools),
      earlier: row.dataset.category === "Earlier work",
      search: row.dataset.search,
    })),
  );
  expect(catalog).toHaveLength(21);
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  async function checkResults(expected) {
    await expect(page.locator(".project-row:visible")).toHaveCount(
      expected.length,
    );
    await expect
      .poll(() =>
        page
          .locator(".project-row:visible a")
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute("href")),
          ),
      )
      .toEqual(expected.map(({ href }) => href));
    await expect(page.locator("#result-count")).toHaveText(
      `${expected.length} ${expected.length === 1 ? "project" : "projects"}`,
    );
    if (expected.some(({ earlier }) => earlier))
      await expect(divider).toBeVisible();
    else await expect(divider).toBeHidden();
    if (expected.length)
      await expect(page.locator("#empty-results")).toBeHidden();
    else await expect(page.locator("#empty-results")).toBeVisible();
  }
  await expect(page.locator("#result-count")).toHaveAttribute("role", "status");
  await expect(page.locator("#result-count")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await checkResults(catalog);
  await expect(reset).toBeHidden();

  // Facets use collection metadata, avoiding stale title and count fixtures.
  const facets = await page
    .locator("[data-filter]")
    .evaluateAll((buttons) => buttons.map((button) => button.dataset.filter));
  expect(facets).toEqual([
    "all",
    "web",
    "ai",
    "data",
    "infra",
    "desktop",
    "design",
  ]);
  for (const facet of facets) {
    await page.locator(`[data-filter="${facet}"]`).click();
    await expect(
      page.locator("[data-filter][aria-pressed='true']"),
    ).toHaveCount(1);
    await expect(page.locator(`[data-filter="${facet}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await checkResults(
      catalog.filter((row) => facet === "all" || row.facets.includes(facet)),
    );
  }
  await reset.click();
  await checkResults(catalog);
  await expect(search).toBeFocused();
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Typing filters immediately; clicking a completion creates a persistent tool pill.
  await search.fill("py");
  await checkResults(
    catalog.filter((row) => normalize(row.search).includes("py")),
  );
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("option", { name: "Python", exact: true }).click();
  const pythonPill = page.getByRole("button", {
    name: "Remove Python filter",
    exact: true,
  });
  await expect(pythonPill).toBeVisible();
  await expect(search).toHaveValue("");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#tool-suggestions")).toBeHidden();
  await checkResults(catalog.filter((row) => row.tools.includes("Python")));

  // Keyboard completion and Enter intersect with the existing pill (AND).
  await search.fill("docker");
  await search.press("ArrowDown");
  const docker = page.getByRole("option", { name: "Docker", exact: true });
  await expect(docker).toHaveAttribute("aria-selected", "true");
  await expect(search).toHaveAttribute(
    "aria-activedescendant",
    await docker.getAttribute("id"),
  );
  await search.press("Enter");
  await expect(page.locator(".search-filter-pill")).toHaveCount(2);
  const intersection = catalog.filter(
    (row) => row.tools.includes("Python") && row.tools.includes("Docker"),
  );
  expect(intersection.length).toBeGreaterThan(0);
  await checkResults(intersection);
  await page.locator('[data-filter="web"]').click();
  // A collapsed panel still signals the active category.
  await filterToggle.click();
  await expect(page.locator(".filter-dot")).toBeVisible();
  await expect(filterToggle).toHaveAccessibleName(/Web apps selected/);
  await filterToggle.click();
  await checkResults(intersection.filter((row) => row.facets.includes("web")));
  await page.locator('[data-filter="all"]').click();
  await pythonPill.click();
  await expect(page.locator(".search-filter-pill")).toHaveCount(1);
  await checkResults(catalog.filter((row) => row.tools.includes("Docker")));
  await expect(search).toBeFocused();
  // Enter on the same exact tool must not add a duplicate.
  await search.fill("Docker");
  await search.press("Enter");
  await expect(page.locator(".search-filter-pill")).toHaveCount(1);
  await reset.click();
  await checkResults(catalog);
  await expect(page.locator(".search-filter-pill")).toHaveCount(0);
  await expect(search).toHaveValue("");
  await expect(reset).toBeHidden();

  // Plain Enter adds text pills; Escape only dismisses completions.
  await search.fill("homelab");
  await search.press("Enter");
  await expect(
    page.getByRole("button", { name: "Remove homelab filter", exact: true }),
  ).toBeVisible();
  await checkResults(
    catalog.filter((row) => normalize(row.search).includes("homelab")),
  );
  await page
    .getByRole("button", { name: "Remove homelab filter", exact: true })
    .click();
  await checkResults(catalog);
  await search.fill("py");
  await expect(page.locator("#tool-suggestions")).toBeVisible();
  await search.press("Escape");
  await expect(page.locator("#tool-suggestions")).toBeHidden();
  await expect(search).toHaveValue("py");
  await search.fill("no-such-project-regression");
  await search.press("Enter");
  await checkResults([]);
  await expect(page.locator(".search-filter-pill")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await checkResults(catalog);
  await expect(page.locator(".search-filter-pill")).toHaveCount(0);
  await expect(search).toHaveValue("");
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(reset).toBeHidden();

  async function checkTimeline(kind, focused = false) {
    const other = kind === "experience" ? "education" : "experience";
    const tab = page.locator(`#tab-${kind}`);
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(tab).toHaveJSProperty("tabIndex", 0);
    if (focused) await expect(tab).toBeFocused();
    await expect(page.locator(`#tab-${other}`)).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.locator(`#tab-${other}`)).toHaveJSProperty(
      "tabIndex",
      -1,
    );
    await expect(page.locator(`#panel-${kind}`)).toBeVisible();
    await expect(page.locator(`#panel-${other}`)).toBeHidden();
  }
  await checkTimeline("experience");
  for (const kind of ["education", "experience"]) {
    await page.locator(`#tab-${kind}`).click();
    await checkTimeline(kind, true);
  }
  for (const [key, kind] of [
    ["ArrowRight", "education"],
    ["ArrowRight", "experience"],
    ["ArrowLeft", "education"],
    ["Home", "experience"],
    ["End", "education"],
    ["ArrowLeft", "experience"],
  ]) {
    await page.keyboard.press(key);
    await checkTimeline(kind, true);
  }
  await expect(page.locator("#panel-experience .career-card")).toHaveCount(6);
  await expect(page.locator("#panel-education .career-card")).toHaveCount(2);
  // Keyboard avoids the desktop mouse-hover preview of career descriptions.
  for (const kind of ["experience", "education"]) {
    await page.locator(`#tab-${kind}`).click();
    const card = page.locator(`#panel-${kind} details.career-card`).first();
    const summary = card.locator("summary");
    await summary.scrollIntoViewIfNeeded();
    await expect(summary).toBeVisible({ timeout: 10000 });
    await summary.focus();
    await summary.press("Enter");
    await expect(card).toHaveJSProperty("open", true);
    await expect(card.locator(".career-description")).toBeVisible();
    await summary.press("Space");
    await expect(card).toHaveJSProperty("open", false);
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS home-interactions: all facets, live counts, divider, click/Enter AND pills, removal/reset/empty state, suggestion keyboard/Escape, timeline click/Arrow/Home/End and career disclosures, no page errors.",
  );
} finally {
  await browser.close();
}
