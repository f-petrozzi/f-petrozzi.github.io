import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
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
