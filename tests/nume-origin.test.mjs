import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const html = (route) => readFileSync(`dist/${route}/index.html`, "utf8");

test("NüMe includes the hackathon origin after its existing demo", () => {
  const page = html("projects/nume");
  const sample = page.indexOf('class="nume-sample"');
  const heading = page.indexOf('id="where-it-started"');
  const origin = page.indexOf('data-demo="caremesh"');
  assert.ok(sample >= 0 && heading > sample && origin > heading);
  assert.match(page, /HackUSF 2026 team prototype/);
  assert.match(page, /I built its FastAPI backend/);
  assert.match(page, /Other team members built the frontend/);
  assert.match(page, /href="https:\/\/github.com\/f-petrozzi\/HackUSF26"/);
  assert.equal((page.match(/data-demo="caremesh"/g) || []).length, 1);
  assert.ok(!existsSync("src/content/projects/caremesh.md"));
  assert.ok(!html("").includes("/projects/caremesh/"));
});

test("both former CareMesh routes provide static redirects and fallback links", () => {
  for (const [route, target] of [
    ["projects/caremesh", "/projects/nume/"],
    ["projects/caremesh/demo", "/projects/nume/#where-it-started"],
  ]) {
    const page = html(route);
    assert.ok(page.includes(`http-equiv="refresh" content="0;url=${target}"`));
    assert.ok(page.includes(`href="${target}"`));
    assert.ok(page.includes('rel="canonical" href="/projects/nume/"'));
    assert.ok(!page.includes('data-demo="caremesh"'));
  }
});

function pages(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory()
      ? pages(path)
      : path.endsWith(".html")
        ? [path]
        : [];
  });
}

test("origin CSS renders only on NüMe; NüMe sample CSS stays on its two pages", () => {
  for (const file of pages("dist")) {
    const page = readFileSync(file, "utf8");
    const inline = [...page.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
      .map(([, css]) => css)
      .join("\n");
    const linked = [...page.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => /rel="stylesheet"/.test(tag))
      .map((tag) => tag.match(/href="([^"]+)"/)[1])
      .filter((href) => href.startsWith("/"))
      .map((href) => readFileSync(join("dist", href), "utf8"))
      .join("\n");
    assert.ok(!linked.includes(".demo-caremesh"), file);
    assert.ok(!linked.includes(".nume-sample"), file);
    assert.equal(
      inline.includes(".demo-caremesh"),
      file === "dist/projects/nume/index.html",
      file,
    );
    assert.equal(
      inline.includes(".nume-sample"),
      [
        "dist/projects/nume/index.html",
        "dist/projects/nume/demo/index.html",
      ].includes(file),
      file,
    );
  }
});
