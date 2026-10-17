import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "parse5";
import postcss from "postcss";

const read = (file) => readFileSync(file, "utf8");
const home = parse(read("dist/index.html"));
function find(node, predicate) {
  return [
    ...(predicate(node) ? [node] : []),
    ...(node.childNodes ?? []).flatMap((child) => find(child, predicate)),
  ];
}
const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const hasClass = (node, name) => attr(node, "class")?.split(" ").includes(name);
const text = (node) => node.value ?? (node.childNodes ?? []).map(text).join("");
const css = postcss.parse(read("src/styles/home.css"));
function declarations(selector) {
  const rules = [];
  css.walkRules(selector, (rule) => rules.push(rule));
  return Object.fromEntries(
    rules.flatMap((rule) =>
      rule.nodes
        .filter((node) => node.type === "decl")
        .map((d) => [d.prop, d.value]),
    ),
  );
}

test("hero has four named icon links with hidden visual labels and the original destinations", () => {
  const [row] = find(home, (node) => hasClass(node, "hero-links"));
  const links = find(row, (node) => node.tagName === "a");
  assert.deepEqual(
    links.map((link) => [attr(link, "aria-label"), attr(link, "href")]),
    [
      ["Résumé", "/files/resume.pdf"],
      ["GitHub", "https://github.com/f-petrozzi"],
      ["LinkedIn", "https://www.linkedin.com/in/fabriziopetrozzi/"],
      ["Email", "#contact"],
    ],
  );
  for (const link of links) {
    const icons = find(link, (node) => node.tagName === "svg");
    assert.equal(icons.length, 1);
    assert.equal(attr(icons[0], "aria-hidden"), "true");
    const [label] = find(link, (node) => hasClass(node, "hero-link-label"));
    assert.equal(attr(label, "aria-hidden"), "true");
    assert.equal(text(label).trim(), attr(link, "aria-label"));
    assert.ok(
      !link.childNodes.some(
        (node) => node.nodeName === "#text" && text(node).trim(),
      ),
    );
  }
  // The existing contact copy action remains wired separately from navigation.
  const [copy] = find(home, (node) => hasClass(node, "copy-email"));
  assert.equal(copy.tagName, "button");
  assert.equal(attr(copy, "data-email"), "petrozzi@usf.edu");
  assert.match(
    read("src/scripts/home.ts"),
    /navigator\.clipboard\.writeText\(copyButton\.dataset\.email!\)/,
  );
});

test("hero targets, alignment and tooltip transitions work for touch and keyboard", () => {
  const target = declarations(".hero-links a");
  assert.equal(target.width, "44px");
  assert.equal(target.height, "44px");
  const icon = declarations(".hero-links .ui-icon");
  assert.equal(icon.width, "20px");
  assert.equal(icon.height, "20px");
  const row = declarations(".hero-links");
  assert.equal(row.display, "flex");
  assert.equal(row["grid-template-columns"], undefined);
  // 12px inset within the target cancels the row's optical alignment margin.
  assert.equal(
    Number.parseFloat(row.margin.split(" ").at(-1)) + (44 - 20) / 2,
    0,
  );
  assert.ok(4 * 44 + 3 * Number.parseFloat(row.gap) <= 320 - 56 - 24);
  const label = declarations(".hero-link-label");
  assert.equal(label.opacity, "0");
  assert.equal(label["pointer-events"], "none");
  assert.deepEqual(
    label.transition.split(",").map((part) => part.trim().split(" ")[0]),
    ["opacity", "transform"],
  );
  assert.equal(
    declarations(".hero-links a:focus-visible .hero-link-label").opacity,
    "1",
  );
  css.walkRules(".hero-links a:hover .hero-link-label", (rule) => {
    assert.equal(rule.parent.name, "media");
    assert.match(rule.parent.params, /hover: hover/);
    assert.match(rule.parent.params, /pointer: fine/);
  });
  assert.match(read("src/styles/home.css"), /prefers-reduced-motion: reduce/);
});

test("hero facts align with the lead and activity belongs to the intro flow", () => {
  assert.equal(declarations(".hero-grid")["align-items"], "start");
  assert.equal(declarations(".hero-facts")["align-self"], "start");
  const [hero] = find(home, (node) => hasClass(node, "hero"));
  const activity = find(
    hero,
    (node) => attr(node, "data-activity") !== undefined,
  );
  // The real export is optional. If present, activity shares the hero's gutters.
  for (const section of activity) assert.ok(!hasClass(section, "wrap"));
  assert.equal(
    activity.length,
    find(home, (node) => attr(node, "data-activity") !== undefined).length,
  );
});

test("every timeline logo is real vector artwork at an untransformed integer size", () => {
  const tiles = find(home, (node) => hasClass(node, "org-icon"));
  assert.equal(tiles.length, 8);
  for (const tile of tiles) {
    const [img] = find(tile, (node) => node.tagName === "img");
    assert.equal(attr(img, "width"), "48");
    assert.equal(attr(img, "height"), "48");
    const path = attr(img, "src");
    assert.ok(path.endsWith(".svg"), path);
    const vector = read(join("public", path));
    assert.match(vector, /<path\b/);
    assert.doesNotMatch(vector, /<image\b|data:image|<filter\b/i);
  }
  const img = declarations(".org-icon img");
  assert.equal(img.width, "48px");
  assert.equal(img.height, "48px");
  css.walkRules((rule) => {
    if (!rule.selector.includes(".org-icon") || !rule.selector.includes("img"))
      return;
    rule.walkDecls((d) =>
      assert.ok(
        !["transform", "scale", "translate", "filter"].includes(d.prop),
      ),
    );
  });
});

function pages(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? pages(path)
      : path.endsWith(".html")
        ? [path]
        : [];
  });
}
function styles(html) {
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(
    ([, css]) => css,
  );
  const linked = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)]
    .map(([tag]) => tag.match(/href="([^"]+)"/)[1])
    .filter((href) => href.startsWith("/"))
    .map((href) => read(join("dist", href)));
  return [...inline, ...linked].join("\n");
}

test("Agent Usage CSS appears only on its project and standalone demo pages", () => {
  for (const path of ["dist/index.html", ...pages("dist/projects")]) {
    const own = [
      "dist/projects/agent-usage/index.html",
      "dist/projects/agent-usage/demo/index.html",
    ].includes(path);
    assert.equal(styles(read(path)).includes("--au-notch-width"), own, path);
  }
  const component = read("src/components/demos/AgentUsageDemo.astro");
  const block = component.match(/<style is:inline>([\s\S]*?)<\/style>/)[1];
  const parsed = postcss.parse(block);
  const roots = parsed.nodes.filter((node) => node.type !== "comment");
  assert.equal(roots.length, 1);
  assert.equal(roots[0].selector, ".demo-agent-usage");
  assert.doesNotMatch(
    block,
    /:global|data-theme|var\(--(?:bg|ink|muted|faint|accent|line)\b/,
  );
  assert.match(block, /--au-notch-width: 350px/);
  assert.match(block, /--au-scale: min\(1, calc\(100cqi \/ 500px\)\)/);
  assert.match(block, /--au-text-min: calc\(11px \/ var\(--au-scale\)\)/);
  const page = parse(read("dist/projects/agent-usage/demo/index.html"));
  const [scale] = find(page, (node) => attr(node, "data-scale") !== undefined);
  for (const name of [
    "notch-material",
    "account-gauges",
    "arm-leading",
    "arm-trailing",
    "attached-panel",
  ])
    assert.equal(find(scale, (node) => hasClass(node, name)).length, 1, name);
});
