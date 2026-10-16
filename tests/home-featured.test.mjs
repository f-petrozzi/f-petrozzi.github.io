import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { featured } from "../src/data/featured.ts";

const html = readFileSync("dist/index.html", "utf8");
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
function css(document) {
  const inline = [
    ...document.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g),
  ].map(([, content]) => content);
  const linked = [...document.matchAll(/<link\b[^>]*>/g)]
    .filter(([tag]) => /rel="stylesheet"/.test(tag))
    .map(([tag]) => tag.match(/href="([^"]+)"/)[1])
    .filter((href) => href.startsWith("/"))
    .map((href) => readFileSync(join("dist", href), "utf8"));
  return [...inline, ...linked].join("\n");
}

test("featured screenshots are real WebPs within budget, with accurate dimensions and loading", async () => {
  const { default: sharp } = await import("sharp");
  const cards = [
    ...html.matchAll(
      /<article\b[^>]*data-project="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g,
    ),
  ];
  assert.equal(cards.length, 4);
  for (const [, id, card] of cards) {
    assert.ok(
      !card.includes("project-art"),
      `${id} retains a drawn placeholder`,
    );
    const tag = card.match(/<img\b[^>]*>/)[0];
    const src = tag.match(/src="([^"]+)"/)[1];
    const width = Number(tag.match(/width="(\d+)"/)[1]);
    const height = Number(tag.match(/height="(\d+)"/)[1]);
    const file = join("public", src);
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(width, metadata.width, `${id} width`);
    assert.equal(height, metadata.height, `${id} height`);
    assert.ok(width >= 1120, `${id} needs a 2x-ready image`);
    assert.ok(statSync(file).size <= 120000, `${id} exceeds 120 KB`);
    assert.match(tag, /alt="[^"]+"/);
    assert.ok(tag.includes(`loading="${id === "homelab" ? "eager" : "lazy"}"`));
  }
  assert.equal(featured.find((item) => item.id === "nest").image.height, 630);
});

test("gallery keeps its inline fixed palette out of pages that do not render it", () => {
  const source = readFileSync("src/components/NumeGallery.astro", "utf8");
  const styles = [...source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)];
  assert.equal(styles.length, 1);
  assert.ok(styles[0][1].includes("is:inline"));
  assert.match(styles[0][2], /^\s*\.nume-gallery\s*\{/);
  assert.ok(
    !/:global|var\(--(?:bg|ink|muted|faint|accent|line)\b/.test(styles[0][2]),
  );
  assert.ok(!css(html).includes("--gallery-bg"));
  for (const path of pages("dist/projects")) {
    assert.ok(
      !css(readFileSync(path, "utf8")).includes("--gallery-bg"),
      `${path} loads gallery CSS`,
    );
  }
});

test("featured demo CSS stays on each project's own project and demo pages", () => {
  for (const [id, selector] of [
    ["nume", ".nume-sample {"],
    ["homelab", ".demo-homelab {"],
    ["proterra", ".demo-proterra {"],
    ["nest", ".demo-nest {"],
  ]) {
    const own = [
      `dist/projects/${id}/index.html`,
      `dist/projects/${id}/demo/index.html`,
    ];
    assert.ok(!css(html).includes(selector), `${id} demo CSS reaches homepage`);
    for (const path of pages("dist/projects")) {
      assert.equal(
        css(readFileSync(path, "utf8")).includes(selector),
        own.includes(path),
        `${id}: ${path}`,
      );
    }
  }
});

test("info animation keeps card dimensions fixed and removes cursor proximity", () => {
  assert.equal((html.match(/<circle cx="22" cy="22" r="20"/g) || []).length, 4);
  assert.ok(!html.includes("info-arm"));
  const home = readFileSync("src/scripts/home.ts", "utf8");
  const panel = home.slice(home.indexOf("// The information surface"));
  const tick = panel.slice(
    panel.indexOf("function tick"),
    panel.indexOf("function setExpanded"),
  );
  assert.ok(
    !/getBoundingClientRect|offsetHeight|\.style\.(?:width|height|margin|padding)|scheduleScroll/.test(
      tick,
    ),
  );
  assert.ok(
    !/trackProximity|dropletTransform|applyGooFilter|pointerenter/.test(panel),
  );
  for (const [, , card] of html.matchAll(
    /<article\b[^>]*data-project="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g,
  )) {
    assert.ok(!/work-kind|work-tools|figcaption|gallery-controls/.test(card));
    assert.match(card, /work-summary/);
    assert.match(card, /Read project/);
  }
});
