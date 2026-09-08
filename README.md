# Fabrizio Petrozzi | portfolio

A static Astro portfolio for petrozzi.dev, with Markdown project pages and the original hand-built website preserved at `/classic/`.

## Develop

Use Node.js 24.19 or later.

```sh
npm ci
npm run dev
```

Open http://localhost:4321 for the development server. The shared homelab preview is
http://petro.ink:4444/ (the existing `portfolio-preview` container). It serves
`dist/`, so run `npm run build` after source changes and reload that URL.
The separate Agent Usage preview remains at `/agent-usage/`. The approved PoC design is now integrated at `/`; the separate `/preview/` page has been retired. The homepage retains featured project metadata, theme preference, full project pages, and the original-site switch. A short then-and-now story introduces the original site. Filter chips and search organize the collection; prefix-based tool suggestions support keyboard and pointer selection.

For a standalone production preview:

```sh
npm run build
npm test
npm run preview
```

In a restricted environment, prefix Astro commands with `ASTRO_TELEMETRY_DISABLED=1`.

## Add a project

Copy `templates/project.md` into `src/content/projects/your-project.md`. Fill in the metadata and write the project story below it. The filename becomes the URL. Lower `order` values appear first. `featured: true` adds the project to Selected work, alongside the Homelab feature. Tool suggestions come from the content automatically. Links are optional: omit them for private work. Use confirmed outcomes, and distinguish an illustration from an actual screenshot.

- `src/pages/index.astro`: homepage and collection filtering
- `src/pages/projects/[id].astro`: generated project pages
- `src/components/ProjectVisual.astro`: lightweight HTML/CSS project illustrations
- `src/styles/home.css` and `src/scripts/home.ts`: homepage design and interactions
- `src/styles/global.css`: full project-page layout
- `public/assets/`: homepage fonts, screenshots, and organization logos
- `src/content.config.ts`: required metadata validation
- `public/era.js` and `public/era.css`: original/current transition
- `public/classic/`: original HTML, styles, scripts, and assets
- `public/files/resume.pdf`: existing resume, retained pending a content refresh

The original descriptions and tool labels of earlier projects are retained as historical content. New project descriptions come from local repository documentation. Project illustrations show the actual workflow or application scope, not simulated product screenshots. Public source links for NüMe, Proterra, Slice, Agent Usage, and CareMesh were checked against the public GitHub repository list on September 8, 2026. Current demo availability and biography/resume details should be checked before publishing.

## Original / current switch

The link works with no JavaScript. Supported browsers use cross-document View Transitions: a single circular mask reveals the destination from the clicked button. The outgoing page stays still. A short cover/entrance animation provides a fallback where cross-document transitions are unavailable. Reduced-motion preferences bypass the effect. Only explicit era links animate; ordinary navigation stays immediate. The versions have separate assets, so the modern homepage does not load the original map, icon libraries, or fonts. The original still needs those third-party services for its map/icons, but starts loading them after the reveal finishes. The synchronous head script registers the first-render listener before rendering; a render expectation waits for the page markup.

## Verification

`npm test` checks generated local links, project rendering, and legacy dependency isolation after a build. With the shared preview available at http://petro.ink:4444/:

```sh
npx playwright install chromium
npm run test:browser
node tests/home-interactions.mjs
```

Set `CHROMIUM_PATH` to reuse an installed Chromium executable and `PREVIEW_URL` to test another host. `node tests/transitions.mjs` verifies three round trips with a delayed transition script and stalled external assets, and samples frame intervals. These headless samples are diagnostics, not a real-device performance guarantee. Browser checks cover filtering, theme persistence, project navigation, round-trip era switching, mobile overflow, reduced motion, and no-JavaScript rendering. They save screenshots in `/tmp`. External requests on the original site are blocked during this test, so map availability is not assessed. Cross-browser testing on Safari and Firefox remains a manual release check.

## GitHub Pages

`.github/workflows/deploy.yml` builds and validates on pushes to `main`, then deploys `dist` to GitHub Pages. Set the repository's Pages publishing source to **GitHub Actions**. The custom domain is retained in `public/CNAME`; existing DNS must point to GitHub Pages. No server runtime or API keys are needed. This checkout has not been pushed or deployed by the overhaul.

## Personal logo (local assets)

`docs/F.png` and `docs/f-background.png` are intentionally ignored. Compact WebP assets in `public/brand/` are versioned so clean builds retain the approved logo. When the originals are present, the prebuild script refreshes those assets without recoloring them. The transparent F appears in the header.
