import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import vm from "node:vm";
const root = resolve("dist");
const projectCount = readdirSync("src/content/projects").filter((f) =>
  f.endsWith(".md"),
).length;
function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(path, e.name)) : [join(path, e.name)],
  );
}
test("all generated local links and image references resolve", () => {
  for (const file of files(root).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(file, "utf8");
    for (const [, url] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (/^(https?:|mailto:|data:|tel:)/.test(url)) continue;
      const clean = decodeURI(url.split(/[?#]/)[0]);
      const path = clean.startsWith("/")
        ? join(root, clean)
        : resolve(dirname(file), clean);
      assert.ok(existsSync(path), `${file}: missing ${url}`);
    }
  }
});
test("homepage renders all projects without JavaScript and no legacy dependencies", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  assert.equal((html.match(/class="project-row"/g) || []).length, projectCount);
  for (const dependency of ["unpkg.com", "fonts.googleapis.com", "maplibre-gl"])
    assert.ok(!html.includes(dependency));
  assert.ok(html.includes("data-era-link"));
  assert.ok(
    readFileSync(join(root, "classic/index.html"), "utf8").includes(
      "Back to the new design",
    ),
  );
});

test("integrated homepage retains main content and retires the PoC route", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  for (const marker of [
    'id="work"',
    'id="background"',
    'id="projects"',
    'id="contact"',
    'id="tool-suggestions"',
    "theme-toggle",
    "data-era-link",
    "/projects/nume/",
    "/projects/nest/",
    "/projects/proterra/",
  ])
    assert.ok(html.includes(marker), marker);
  for (const removed of [
    'id="tool-filter"',
    'id="category-filter"',
    "A little background",
  ])
    assert.ok(!html.includes(removed));
  assert.ok(!html.includes("noindex"));
  assert.ok(!html.includes("/preview/"));
  assert.ok(!existsSync(join(root, "preview/index.html")));
});

test("Portfolio Markdown link opts into the existing era transition", () => {
  const html = readFileSync(
    join(root, "projects/portfolio/index.html"),
    "utf8",
  );
  assert.ok(html.includes("data-portfolio-era"));
  assert.match(html, /href="\/classic\/"[^>]*>original site<\/a>/);
  assert.equal((html.match(/src="\/era.js"/g) || []).length, 1);
  assert.equal((html.match(/href="\/era.css"/g) || []).length, 1);
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, content]) => content)
    .find((content) => content.includes("portfolio-collection-departure"));
  assert.ok(script);
  const attributes = new Map();
  vm.runInNewContext(script, {
    document: {
      querySelectorAll(selector) {
        if (selector === '[data-portfolio-era] a[href="/classic/"]')
          return [{ setAttribute: (key, value) => attributes.set(key, value) }];
        assert.equal(selector, "[data-collection-return]");
        return [];
      },
    },
    sessionStorage: { getItem: () => null, removeItem() {} },
  });
  assert.equal(attributes.get("data-era-link"), "");
  for (const id of ["nume", "homelab", "agent-usage"])
    assert.ok(
      !readFileSync(join(root, `projects/${id}/index.html`), "utf8").includes(
        "data-portfolio-era>",
      ),
    );
});

test("home panel and fluid CSS do not load on project or demo pages", () => {
  function styles(html) {
    return [...html.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => /rel="stylesheet"/.test(tag))
      .map((tag) => tag.match(/href="([^"]+)"/)[1])
      .filter((href) => href.startsWith("/"))
      .map((href) => readFileSync(join(root, href), "utf8"))
      .join("\n");
  }
  const homeStyles = styles(readFileSync(join(root, "index.html"), "utf8"));
  assert.ok(homeStyles.includes(".work-more"));
  assert.ok(homeStyles.includes(".fluid-arm"));
  for (const file of files(join(root, "projects")).filter((file) =>
    file.endsWith(".html"),
  )) {
    const html = readFileSync(file, "utf8"),
      css = styles(html);
    assert.ok(!css.includes(".work-more"), `${file} loads home panel CSS`);
    assert.ok(!css.includes(".fluid-arm"), `${file} loads unused fluid CSS`);
  }
});
