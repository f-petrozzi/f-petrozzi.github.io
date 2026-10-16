import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { is } from "css-select";
import { Element } from "domhandler";

const read = (path) => readFileSync(path, "utf8");
const tokens = postcss.parse(read("src/styles/tokens.css"));
const ring = tokens.nodes.find((node) =>
  node.nodes?.some(
    (declaration) =>
      declaration.prop === "outline" &&
      declaration.value.startsWith("1px solid"),
  ),
);

test("keyboard rings exclude every text field and select, including fields with tabindex", () => {
  assert.ok(ring, "shared keyboard ring is missing");
  const matches = (name, attributes, keyboard) =>
    is(new Element(name, attributes), ring.selector, {
      pseudos: { "focus-visible": () => keyboard },
    });
  for (const type of [
    undefined,
    "text",
    "search",
    "email",
    "password",
    "number",
    "tel",
    "url",
    "date",
    "time",
    "datetime-local",
    "month",
    "week",
  ]) {
    const attributes = { tabindex: "0", ...(type ? { type } : {}) };
    assert.equal(matches("input", attributes, true), false, type ?? "no type");
  }
  for (const name of ["select", "textarea"])
    assert.equal(matches(name, { tabindex: "0" }, true), false, name);
  assert.equal(
    matches("div", { contenteditable: "true", tabindex: "0" }, true),
    false,
  );
  for (const [name, attributes] of [
    ["button", {}],
    ["a", { href: "/projects/" }],
    ["summary", {}],
    ["div", { tabindex: "0" }],
    ...[
      "checkbox",
      "radio",
      "range",
      "color",
      "file",
      "button",
      "submit",
      "reset",
    ].map((type) => ["input", { type }]),
  ]) {
    assert.equal(matches(name, attributes, true), true, name);
    assert.equal(
      matches(name, attributes, false),
      false,
      `${name} pointer focus`,
    );
  }
});

const demos = readdirSync("src/components/demos")
  .filter((name) => name.endsWith(".astro") && name !== "OrbitFrame.astro")
  .map((name) => join("src/components/demos", name));

test("focus styles cannot reintroduce shadow or border frames", () => {
  for (const path of [
    "src/styles/tokens.css",
    "src/styles/global.css",
    "src/styles/home.css",
    ...demos,
    "src/components/NumeGallery.astro",
  ]) {
    const source = read(path);
    const styles = path.endsWith(".css")
      ? [source]
      : [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(
          ([, css]) => css,
        );
    for (const css of styles) {
      postcss.parse(css).walkRules((rule) => {
        if (!rule.selector.includes(":focus")) return;
        rule.walkDecls((declaration) => {
          if (declaration.prop === "box-shadow")
            assert.equal(declaration.value, "none", path);
          assert.ok(
            !declaration.prop.startsWith("border"),
            `${path}: focus border`,
          );
          if (declaration.prop === "outline" && declaration.value !== "none") {
            assert.ok(
              rule.selector.includes(":focus-visible"),
              `${path}: pointer ring`,
            );
            assert.match(declaration.value, /^1px solid/);
          }
          assert.ok(!declaration.important, `${path}: forced focus override`);
        });
      });
    }
  }
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

test("all demo styles keep one fixed root and reach only their own generated pages", () => {
  const built = ["dist/index.html", ...pages("dist/projects")].map((path) => [
    path,
    styles(read(path)),
  ]);
  for (const path of demos) {
    const blocks = [
      ...read(path).matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g),
    ];
    assert.equal(blocks.length, 1, path);
    assert.ok(blocks[0][1].includes("is:inline"), path);
    const css = blocks[0][2];
    const parsed = postcss.parse(css);
    const roots = parsed.nodes.filter((node) => node.type !== "comment");
    assert.equal(roots.length, 1, path);
    const selector = roots[0].selector;
    assert.match(selector, /^\.demo-[\w-]+$/);
    assert.doesNotMatch(
      css,
      /:global|data-theme|var\(--(?:bg|ink|muted|faint|accent|line)\b/,
    );
    assert.match(css, /color-scheme:\s*(light|dark)/);
    // The retired Orbit component is replaced by OrbitFrame, whose files stay untouched.
    const id = selector === ".demo-caremesh" ? "nume" : selector.slice(6);
    const marker =
      selector === ".demo-orbit" ? "--orbit-cloud" : `${selector} {`;
    for (const [page, content] of built) {
      // The CareMesh origin sample renders only below NüMe's project writeup.
      const routes =
        selector === ".demo-caremesh"
          ? ["dist/projects/nume/index.html"]
          : [
              `dist/projects/${id}/index.html`,
              `dist/projects/${id}/demo/index.html`,
            ];
      const own = id !== "orbit" && routes.includes(page);
      assert.equal(content.includes(marker), own, `${path}: ${page}`);
    }
  }
});
