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
  assert.deepEqual(
    cards.map(([, id]) => id),
    ["orbit", "homelab", "nume", "proterra", "nest"],
  );
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
    const budget = id === "orbit" ? 140000 : 120000;
    assert.ok(statSync(file).size <= budget, `${id} exceeds ${budget} bytes`);
    assert.match(tag, /alt="[^"]+"/);
    assert.ok(tag.includes(`loading="${id === "orbit" ? "eager" : "lazy"}"`));
    assert.ok(
      tag.includes(`fetchpriority="${id === "orbit" ? "high" : "auto"}"`),
    );
  }
  assert.equal(featured.find((item) => item.id === "nest").image.height, 630);
});

test("Orbit leads the grid with the existing card controls and an uncropped frame", () => {
  const card = html.match(
    /<article\b[^>]*data-project="orbit"[^>]*>([\s\S]*?)<\/article>/,
  );
  assert.match(card[0], /class="work-card work-card-lead"/);
  assert.match(card[1], /id="work-orbit"/);
  assert.equal((card[1].match(/<img\b/g) || []).length, 1);
  assert.match(card[1], /aria-controls="info-orbit"/);
  assert.match(card[1], /href="\/projects\/orbit\/"/);
  assert.match(card[1], /Read project/);
  assert.match(css(html), /\.work-card-lead\s*\{grid-column:1\/-1\}/);
  assert.match(
    css(html),
    /\.work-card-lead \.work-stage\s*\{aspect-ratio:1120\/650;border-radius:0\}/,
  );
  assert.match(
    readFileSync("src/content/projects/orbit.md", "utf8"),
    /^featured: true$/m,
  );
  const row = [
    ...html.matchAll(
      /<article\b[^>]*class="project-row"[^>]*>([\s\S]*?)<\/article>/g,
    ),
  ].find(([, body]) => body.includes('href="/projects/orbit/"'));
  assert.match(row[0], /data-facets="ai web"/);
});

test("featured crops remove the page background and the NüMe sidebar edge", async () => {
  const { default: sharp } = await import("sharp");
  const orbit = await sharp("public/assets/shots/orbit-featured.webp")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => [
    ...orbit.data.subarray(
      (y * orbit.info.width + x) * 4,
      (y * orbit.info.width + x) * 4 + 4,
    ),
  ];
  for (const [x, y] of [
    [0, 0],
    [1119, 0],
    [0, 649],
    [1119, 649],
  ])
    assert.equal(
      pixel(x, y)[3],
      0,
      `Orbit corner ${x},${y} retains page background`,
    );
  assert.equal(pixel(560, 325)[3], 255);
  for (let y = 0; y < 650; y++)
    for (let x = 0; x < 1120; x++) {
      if (x > 1 && x < 1118 && y > 1 && y < 648) continue;
      const [r, g, b, alpha] = pixel(x, y);
      assert.ok(
        alpha === 0 || r + g + b > 500,
        `Orbit retains dark page pixel ${x},${y}`,
      );
    }
  const edge = await sharp("public/assets/shots/nume-featured.webp")
    .extract({ left: 0, top: 0, width: 3, height: 630 })
    .removeAlpha()
    .raw()
    .toBuffer();
  assert.ok(
    [...edge].every((value) => value > 235),
    "NüMe retains a sidebar or seam on its left edge",
  );
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
    ["orbit", ".demo-orbit {"],
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
  assert.equal((html.match(/<circle cx="22" cy="22" r="20"/g) || []).length, 5);
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
