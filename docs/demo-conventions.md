# Project demo conventions

Interactive demos on project pages follow the NüMe sample (`src/components/NumeDemo.astro`,
`src/scripts/nume-sample.ts`, `src/data/nume-agent.ts`, `src/pages/projects/nume/demo.astro`).
Read those four files before starting. They are a working reference for structure, scale and tone.

## What a demo is

- A compact, disconnected slice of the real project that a visitor can operate in under a minute.
- Synthetic data only. No real names, accounts, receipts, emails, health data or private details.
- Nothing connects or saves: no `fetch`, no WebSocket, no external images/fonts/scripts, no
  `localStorage`/`sessionStorage`/cookies. Reset returns the demo to its initial state.
- Faithful to what the project actually does. Base behavior on the project's content file
  (`src/content/projects/<id>.md`) and, when given, its local source. Do not invent features.
  When the real thing uses a model or service, simulate it with deterministic local rules and say
  so once in a short note, as NüMe does ("This sample does not run …").
- Two to four views or interactions at most. A focused slice beats a shallow clone.
- Lead with the project's output, not its controls: the first screen should show what the project
  produces, with inputs next to it.
- Simulated internals (agents, pipelines, models) replay the real system's stages and vocabulary.
  Do not narrate the demo's own mechanics ("matched a keyword table").
- Continuous inputs should produce continuous changes (rankings, scores, charts), not a single
  threshold flip between two canned outputs.
- Say "sample/synthetic" once: the page header line plus at most one short note inside the demo.
  No toolbar disclaimers or helper sentences.

## Files (create only these; do not edit existing files)

- `src/components/demos/<Pascal>Demo.astro`: markup, scoped `<style>`, and a `<script>` that imports
  the script module below.
- `src/scripts/demos/<id>.ts`: DOM wiring. Initialize every root with
  `document.querySelectorAll<HTMLElement>('[data-demo="<id>"]').forEach(init)` and query inside the
  root only.
- `src/data/demos/<id>.ts`: synthetic data and pure logic (no DOM), so it can be unit tested.
- `tests/<id>-demo.test.mjs`: `node:test` checks for the pure logic (Node 24 imports `.ts` directly,
  see `tests/nume-agent.test.mjs`).
- `src/pages/projects/<id>/demo.astro`: standalone page modeled on `src/pages/projects/nume/demo.astro`
  (back link to `/projects/<id>/`, eyebrow "Interactive sample", h1 "Try <Title>", the line
  "Sample data. Nothing connects or saves.").

The orchestrator wires demos into `src/pages/projects/[id].astro`. Do not touch that file, global
CSS, `src/data/featured.ts`, `package.json`, or any other existing file.

## Markup and styling

- Root: `<section class="demo demo-<id>" data-demo="<id>" aria-label="<Title> interactive sample">`.
- Use Astro scoped styles. For elements your script creates, use `:global()` nested under
  `.demo-<id>`. Never style bare elements or shared class names globally.
- Use the site tokens from `src/styles/tokens.css` (`--bg`, `--ink`, `--muted`, `--faint`,
  `--accent`, `--accent-ink`, `--line`, `--radius-*`, `--ease`). The site has dark (default) and
  light (`:root[data-theme="light"]`) themes; the demo must read well in both. A demo may carry the
  real app's accent color for its own chrome if it still passes contrast in both themes.
- Layout must work from 320px to 1440px wide with no horizontal page overflow. Wide tables or
  diagrams scroll inside their own container.
- Text inputs use 16px font on mobile (iOS zoom). Touch targets at least 44px.
- Interface copy is short, plain labels. No tutorial text, captions explaining how to use the demo,
  or credit rows. One short note about what is simulated is fine.

## Behavior, accessibility, performance

- Real `<button>`s for actions, `aria-pressed` for toggles, `<label>`s for inputs, visible
  `:focus-visible` styles, `aria-live="polite"` for results that change.
- Respect `prefers-reduced-motion`. No perpetual animation loops; any `requestAnimationFrame` or
  timer stops when idle or when the demo leaves the viewport.
- Keep each demo's script and data modest (aim under ~30 KB of source combined). No new npm
  dependencies. Inline SVG is fine; canvas only if it is clearly the right tool.

## Verification

Run from the worktree root:

```bash
PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH npm run build
PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH node --test tests/<id>-demo.test.mjs
PATH=$HOME/.nvm/versions/node/v24.19.0/bin:$PATH npx prettier --check <your new files>
```

Do not launch browsers, Playwright, Puppeteer or headless Chrome. Do not run `npm install`.
The orchestrator does visual checks.

## Report

End with a short summary: files created, what a visitor can do, which details came from source vs.
were assumed, and anything you could not verify.

## Revision rules (2026-10-16, owner feedback)

- **Styles render with the demo, not in the shared bundle.** All project pages share one route, so
  Astro bundles every demo's `<style>` into every project page. Convert each demo's styles to a
  single `<style is:inline>` block whose whole contents are nested inside the demo root selector
  (`.demo-<id> { ... }` using native CSS nesting), drop `:global()` wrappers, and keep selectors
  specific enough not to leak. After building, `dist/projects/<other-id>/index.html` must not
  contain this demo's CSS.
- **One fixed look per demo.** Demos do not follow the site's light/dark toggle. Define the demo's
  own palette as custom properties on its root with fixed values (NüMe stays light; a project whose
  real UI is dark stays dark). Do not read `--bg`, `--ink`, etc. from the site for demo surfaces.
- **Feel like the real project:** card shapes, tabs, navigation and user flow follow the real app.
  Typography stays the portfolio's fonts. Exact colors are optional.
- **Copy:** no `·` dot separators between text items (use separate elements, spacing or line breaks),
  no em or en dashes in visible copy (use a normal hyphen or rephrase), no left color-stripe accents
  on pills or chips.
- **Bounded height:** long content (tables, pipeline stages, logs, JSON) lives in a fixed-height
  region with its own scroll, or behind tabs/disclosures, so the demo never makes the project page
  much longer than one screen of demo.
- **Scrollbars:** every internal scroll region gets a clean thin scrollbar
  (`scrollbar-width: thin; scrollbar-color: <thumb> transparent;` plus matching
  `::-webkit-scrollbar` rules), never the default.
- **Smoothness:** animate only `transform` and `opacity`; no `backdrop-filter`; no idle
  `requestAnimationFrame` loops; debounce heavy SVG redraws. Interactions must feel instant.
