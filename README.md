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
`dist/`, so run `npm run build` after source changes and reload that URL. The `postbuild` step makes `dist/` world-readable, because the container's nginx user (uid 101) returns 404 for files created under a restrictive umask such as agent sandboxes' 077.
The separate Agent Usage preview remains at `/agent-usage/`. The approved PoC design is now integrated at `/`; the separate `/preview/` page has been retired. The October 15, 2026 redesign ("glass over still water") is documented in `/mnt/ssd/homelab/artifacts/portfolio-revamp/` (brief, direction, research, reviews). Homepage order: introduction (name; an unboxed list of work, study and location facts with briefcase, graduation and map-pin icons; Résumé/GitHub/LinkedIn/Email links directly beneath those facts on desktop and mobile). Experience lists Raymond James (2023 - 2024), the USF teaching assistant and AV technician roles, Handshake AI (Jul - Aug 2026), Slice of the Burg (Jul - Oct 2026) and the current Raymond James AI Enablement role (2026 - Present), Selected work, Background, All projects, Contact, and a footer link to the original 2023 site. Selected work is a bento of four glass cards (Homelab, NüMe, Proterra, Nest): type, title and summary first, then the visual, an information icon below its visual that grows into the project details, with copy in `src/data/featured.ts` (each line traced to its content file in the revamp artifacts), and Read project. Featured images expand into a quick image preview; the Nest and Proterra workflow illustrations open a diagram preview. Read project opens the full project page. Background mirrors its tabs: Experience cards sit left of the spine, Education cards right; each panel's arrival plays once, and switching tabs never replays it. A "Click to expand" / "Tap to expand" hint follows the input type. Dots have no background ring, so the spine meets them without a gap. Organization logos in `public/assets/org/*.svg` fill their tiles: the USF bull is cropped from the official lockup inlined on usf.edu (white on USF green); Raymond James uses the official vector wordmark stacked in white on RJ navy, with proportions guided by the owner’s supplied reference; Handshake is its own app icon (joinhandshake.com); Slice of the Burg uses the full transparent logo from the existing Slice project, on white for contrast. All organization logos use matching 48px square tiles on desktop and mobile; full wordmarks are centered inside them, preserving their proportions. Small organization assets load eagerly with matching fallback colors to avoid white flashes. Timeline cards fade into place without a translating bright inset edge; segments use measured marker centers, including after expansion. Navigation links use text without directional arrows. Owner preferences, October 15: no drop shadows on glass or images (images get one hairline edge), no focus frames anywhere (a site-wide `outline: none`), no dot separators and no em/en dashes in page text (plain "-"). The featured information control sits alongside the footer actions when closed, then grows into a naturally sized panel below the image. Fine-pointer hover opens it; leaving starts a short close grace period, with click/tap and keyboard alternatives. Its local SVG bead, neck and lobe use blur plus alpha cutback only during separation/merging, following Agent Usage’s arm treatment. Text has equal side padding; the close control occupies the header’s trailing corner. The card grid does not stretch shorter cards, and the panel measures the content width after subtracting padding. It never covers the image or uses an inner scrollbar. Escape, keyboard activation and reduced motion settle immediately. The Selected work heading has no "All projects" shortcut. Search is quiet by default: typing suggests tools that become pills, and a Filters toggle reveals the category chips (a dot marks an active category while collapsed). A spacer after the footer keeps the search box in place while results shrink, and gives the height back as the reader scrolls up. Contact is a card with "Email me" (mailto), a JavaScript "Copy email" button and profile buttons; no form, since a static site would need a third-party form service. Tool icons come from Simple Icons (CC0, `simple-icons` package) through `src/data/tool-icons.ts` (explicit per-label mapping with generic fallbacks; never fuzzy-matched) and `ToolIcon.astro`; `ToolIconSprite.astro` defines each mark once per page so paths are not repeated. Filter chips carry their category icons. The hero name has a -0.06em optical offset so the F's visible edge aligns with the details below. All projects is one glass panel of compact rows, recent work first, then an "Earlier work" group whose label hides when filtering leaves none of it visible. Filter chips and search organize the collection; prefix-based tool suggestions support keyboard and pointer selection. Selecting a suggestion or pressing Enter adds a removable search pill; stacked pills require every selected tool or term to match. Reset filters clears both pills and category chips.

For a standalone production preview:

```sh
npm run build
npm test
npm run preview
```

In a restricted environment, prefix Astro commands with `ASTRO_TELEMETRY_DISABLED=1`.

## Agent activity

The homepage activity band uses a local, aggregate-only export. From this
repository, export counts and rebuild with

```sh
PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH" python3 scripts/export-agent-activity.py && PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH" npm run build
```

For a daily refresh at 6 am in the cron host's timezone, run `crontab -e` and add
this line, replacing the repository path with this checkout's absolute path:

```cron
0 6 * * * cd /absolute/path/to/portfolio && PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH" && export PATH && python3 scripts/export-agent-activity.py && npm run build
```

This cron command refreshes the homelab preview only. The public site is built
and deployed separately by GitHub Actions; rebuilding locally does not update
petrozzi.dev. The prompt counter reads local saved transcripts and history,
independently of the shared quota service, and does not launch provider CLIs or
call provider APIs.

The exporter reads Codex `sessions/**/rollout-*.jsonl` and Claude
`projects/**/*.jsonl` transcripts, including saved Codex app-server, `codex exec`,
Claude Agent SDK and `claude -p` conversations. Codex profile discovery follows
`accounts_root` and automatic `codex_profiles` in
`Agent-Usage/scripts/agent-usage` as of October 17, 2026:
`CODEX_ACCOUNTS_DIR/profiles`, or `$XDG_DATA_HOME/codex-accounts/profiles`
(default `~/.local/share/codex-accounts/profiles`). It also includes `CODEX_HOME`
or `~/.codex` even when profiles exist. Realpath and device/inode deduplication
prevent aliased homes, symlinks and hardlinks from counting a file twice. Claude
uses `CLAUDE_CONFIG_DIR` or `~/.claude`.

Codex counts user-message events, falling back to user response items only for
rollouts without those events. It excludes sub-agent, guardian and spawned-helper
rollouts using the collector's metadata signals. Claude counts user messages
excluding sidechains, meta messages, tool-result-only content, injected command
lines and system-reminder-only content. `codex exec --ephemeral` worker runs are
not recorded anywhere and so are not counted.

By default it also reads each provider's `history.jsonl` for older interactive TUI
activity. For each provider and local day it takes **max(transcripts, history)**,
never their sum. `--no-history` disables this backfill for later use; it does not
erase previously retained counts. Dates use `America/New_York`, including daylight
saving transitions. Invalid records and future timestamps are skipped.

The durable `data/agent-activity-ledger.json` stores only schema version, timezone
and per-provider date/count maps for **all days ever seen**. Each run merges daily
maxima into it, preserving counts when Claude prunes transcripts after roughly 30
days. This is a monotonic lower bound: counts can rise but cannot decrease, and a
partially pruned day's unseen turns cannot be reconstructed. Run the exporter
daily to retain coverage. The ledger starts empty, lives outside `src/` and
`public/`, and is never shipped. It is not gitignored; whether to commit populated
aggregate counts is the owner's choice. `--ledger` can select another private
ledger path. Both the ledger and public export are replaced atomically, with the
ledger saved first. An invalid ledger fails safely without replacing either file.

The public `src/data/agent-activity.json` keeps its existing shape: schema version,
generation time, timezone and daily counts summed across providers for 53
Sunday-start calendar weeks including the current partial week. Future cells
are blank. `--output` can select another public output path.

The chart supports desktop hover and touch exploration. Tapping anywhere in
the chart selects the nearest visible day, including taps in cell gaps. A
horizontal drag explores adjacent days, with a persistent readout above the
chart and a marked selected cell. Release announces the count to assistive
technology. Outside taps, Escape, scrolling, resize and pointer cancellation
clear the selection. One keyboard stop supports day/week arrow navigation and
Home/End, with selected counts announced. Hidden weeks and future dates cannot
be selected. A
coarse-pointer hint explains the interaction; the full daily table remains
available to screen readers. `touch-action: pan-y pinch-zoom` preserves native
vertical scrolling and zoom, following [MDN's gesture guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action).

`--dry-run` prints totals, active days and earliest dates for each provider's
transcripts, history and merged ledger without writing either file:

```sh
python3 scripts/export-agent-activity.py --dry-run
python3 scripts/export-agent-activity.py --no-history
```

Parsing retains only timestamps and classification flags. Claude message content
is inspected transiently to identify excluded harness/tool records; message text,
paths, session identifiers and project names are never retained or emitted. The
exporter never reads credentials, configuration contents, session indexes,
databases, uploads, backups, environment files or logs, and never calls a provider
or runs the collector. Only transcript/history files and the aggregate ledger are
opened. Filesystem errors never print private paths. Fixture tests use isolated,
invented provider homes. The owner-requested October 20 refresh was run against
local saved history and published as aggregate daily counts.

## Add a project

Copy `templates/project.md` into `src/content/projects/your-project.md`. Fill in the metadata and write the project story below it. The filename becomes the URL. Lower `order` values appear first. `featured: true` adds the project to Selected work, alongside the Homelab feature. Tool suggestions come from the content automatically. Links are optional: omit them for private work.

### Writing house style

Write for recruiters, hiring managers, and visitors who want to see what Fabrizio has built. The intended impression is that he understands AI, builds things, and is driven by curiosity. Show that through the projects and his contributions. Use the approved examples below and Fabrizio’s corrections as the reference for voice.

- The summary says what the project does. The page body should add context or explain Fabrizio’s contribution, rather than repeat the summary. Distinguish individual work from team work.
- Use plain, direct language. First person is natural when describing his work, but every sentence does not need to start with "I".
- Show AI understanding through specific choices, implementations, and explanations that matter to the project. Avoid broad claims of expertise.
- Show curiosity through a confirmed question, interest, or reason for building something when it adds context. Do not invent motivations, feelings, lessons, or a personal growth story.
- Use “my homelab,” never “the lab.” Keep captions short and about the subject; omit commentary about cropping, curation, or why an image was chosen.
- Keep homepage summaries short and distinct. Put technical detail on the project page when it helps a reader understand the work.
- Include decisions, constraints, and unfinished work when relevant. No project is required to have a tradeoff, confession, or limitations section to sound credible.
- Keep personal routines, household details, troubleshooting history, and internal client details out unless Fabrizio wants them included and they help explain the project. Do not describe clients or users dismissively.
- Use straightforward headings when useful. Projects may share headings; they should not share generic descriptions. Short projects may need no headings.
- Let length follow substance. Do not pad pages with punchlines, sweeping claims, or concluding life lessons.
- Check implementation claims against code, notebooks, or reports when possible. READMEs and repository names can be stale or incorrect. Never infer a dataset, completed feature, or personal contribution from a project name.
- Use confirmed facts and outcomes only. Relevant, verified numbers are allowed; do not invent metrics. Distinguish illustrations from actual screenshots.
- Punctuation is not a substitute for voice. There is no blanket ban on em dashes or colons.
- Calibrate new copy using short alternatives and Fabrizio's specific corrections before applying a sitewide rewrite. Save approved examples here as they are established.

Approved voice examples:

> I’m interested in how AI works and what I can build with it.

> My homelab is where I learn to build and manage systems. It also serves as my own cloud, hosting my projects and AI agents so I can work from anywhere.

> I started my homelab to secure my network. Over time, I added more containers and learned how to manage the services running in them. It now hosts my projects and AI agents, with secure SSH access from my devices so I can work on projects wherever I am.

Use these as references for directness and detail, not as sentence templates to repeat across projects.

Homepage introduction (October 2026): show the name, current role, education, location, and four profile/contact icon links. The owner removed both the apps-and-tools headline and AI subline; keep the intro compact and let the projects carry that context. Keep a featured section to draw visitors in. Keep petrozzi@usf.edu as the contact address. No portrait photo.

These guidelines supersede writing recommendations in the historical redesign documents under `docs/`. The project template is optional scaffolding, not a required narrative structure. Automated content checks catch missing or duplicate copy; voice remains an editorial judgment.

- `src/pages/index.astro`: homepage and collection filtering
- `src/pages/projects/[id].astro`: generated project pages
- `src/components/ProjectVisual.astro`: lightweight HTML/CSS project illustrations
- `src/styles/tokens.css`: shared tokens and glass materials
- `src/data/featured.ts`: verified "How it works" copy for the four featured cards
- `src/styles/home.css` and `src/scripts/home.ts`: homepage design and interactions
- `src/styles/global.css`: full project-page layout
- `public/assets/`: homepage fonts, screenshots, and organization logos
- `src/content.config.ts`: required metadata validation
- `public/era.js` and `public/era.css`: original/current transition
- `public/classic/`: original HTML, styles, scripts, and assets
- `public/files/resume.pdf`: existing resume, retained pending a content refresh

Every project description was rewritten in September 2026 from local repository documentation and the author's own project notes; the earlier-work placeholder text is gone. A follow-up editorial pass applied the approved opening and homelab voice across the collection, removing forced lessons and unnecessary personal details while retaining project-specific explanations. The September 12 editorial review corrected older tool labels against source material and recorded project-by-project evidence in `docs/content-review-2026-09-12.md`. Project illustrations show the actual workflow or application scope, not simulated product screenshots. Public source links for NüMe, Proterra, Slice, Agent Usage, and CareMesh were checked against the public GitHub repository list on September 8, 2026. Current demo availability and biography/resume details should be checked before publishing.

## Original / current switch

The link works with no JavaScript. Supported browsers use cross-document View Transitions: a single circular mask reveals the destination from the clicked button. The outgoing page stays still. A short cover/entrance animation provides a fallback where cross-document transitions are unavailable. Reduced-motion preferences bypass the effect. Only explicit era links animate; ordinary navigation stays immediate. The versions have separate assets, so the modern homepage does not load the original map, icon libraries, or fonts. The original still needs those third-party services for its map/icons, but starts loading them after the reveal finishes. The synchronous head script registers the first-render listener before rendering; a render expectation waits for the page markup.

## Project pages

Each page has the category, title and summary, a glass facts panel (type, tools, demo/repository links), an optional `ProjectVisual` diagram for featured projects, or NüMe’s embedded interactive sample, a 66ch story column, and Previous / Next glass cards plus All projects in `order` sequence (wrapping at the ends). Project pages share the homepage's 1240px measure and tokens.

## Design system

`src/styles/tokens.css` holds the shared tokens for both themes and two materials. `.glass` (tinted fill, light rim and top highlight) is used on panels that scroll with content and deliberately has no `backdrop-filter`: the static color fields behind it are already soft, and blurring over moving content costs frames (see `docs/redesign-research.md` §8b). `.glass-float` adds real blur and is reserved for floating layers: the fixed nav capsule and the search suggestions. Color fields are radial gradients in normal flow, never fixed, animated or filtered. `prefers-reduced-transparency` switches both materials to solid fills. Instrument Sans is the only web font on the redesigned pages. The header is intentionally unpositioned because `scroll-control.css` places the logo against the droplet rail, where the drop entrance begins.

## Verification

`npm test` checks generated local links, project rendering, legacy dependency isolation and the deterministic sample agent after a build. Browser runs are resource-sensitive on this homelab: prefer build/unit checks for routine follow-ups, never launch browser jobs in parallel, and keep any necessary rendered check narrowly scoped. The owner reported repeated homelab crashes during browser automation on October 16; subsequent refinements in that task used no further browser launches. With the shared preview available at http://petro.ink:4444/:

```sh
npx playwright install chromium
npm run test:browser
node tests/home-interactions.mjs
node tests/mobile-controls.mjs
```

Set `CHROMIUM_PATH` to reuse an installed Chromium executable and `PREVIEW_URL` to test another host. `node tests/transitions.mjs` verifies three round trips with a delayed transition script and stalled external assets, and samples frame intervals. These headless samples are diagnostics, not a real-device performance guarantee. Browser checks cover filtering, theme persistence, project navigation, round-trip era switching, mobile overflow, reduced motion, and no-JavaScript rendering. Search uses 16px text on mobile to avoid input-focus zoom. They save screenshots in `/tmp`. External requests on the original site are blocked during this test, so map availability is not assessed. Cross-browser testing on Safari and Firefox remains a manual release check. `collection-return.mjs` checks both text-only "All projects" links by their top/back and closing-nav selectors, including filter and scroll restoration. `browser.mjs`, `home-interactions.mjs` and `mobile-controls.mjs` were rewritten for the redesign on October 15, 2026 (featured disclosures, filters/pills/divider, timeline keys, theme persistence, 390/320px touch layouts). `transitions.mjs` waits briefly before each era click: Chromium can skip a cross-document transition started immediately after load, which was also true before the redesign. Sandboxed agents cannot reach petro.ink:4444, so serve `dist/` on localhost and set `PREVIEW_URL` (the suites default to `http://127.0.0.1:4620`).

## GitHub Pages

`.github/workflows/deploy.yml` builds and validates on pushes to `main`, then deploys `dist` to GitHub Pages. Set the repository's Pages publishing source to **GitHub Actions**. The custom domain is retained in `public/CNAME`; existing DNS must point to GitHub Pages. No server runtime or API keys are needed. The public site deploys from this repository’s `main` branch; rebuilding the homelab preview alone does not publish it.

## Personal logo (local assets)

`docs/F.png` and `docs/f-background.png` are intentionally ignored. Compact WebP assets in `public/brand/` are versioned so clean builds retain the approved logo. When the originals are present, the prebuild script refreshes those assets without recoloring them. The transparent F appears in the header.

## Homelab screenshots

The homelab project page uses a visual walkthrough with an in-page image viewer.
`homelab-adguard.webp` contains only aggregate charts and statistics; client and
domain tables are excluded. `homelab-grafana.webp` is the monitoring overview.
Both are real September 2026 captures. The architecture crop and full overview
remain `homelab.webp` and `homelab-full.webp`. Keep screenshot captions explicit
about capture dates and inspect new captures for private details before use.
The architecture map separates two image-and-text sections, which stack on mobile. Clicking an image expands it slightly over the page with no backdrop or toolbar. Clicking outside or pressing Escape closes it and restores focus. A close button is available to keyboard users.

## NüMe screenshots (October 16, 2026)

The featured NüMe card starts with the Agents capture and also offers Health and Sleep. Its preview contains screenshot controls and supports Left/Right keys, so visitors can switch without closing it. Featured image height follows its actual aspect ratio. NüMe’s project page uses the embedded interactive demo instead of a screenshot gallery; retained captures remain available to the featured card. Images in `public/assets/shots/nume-*.webp` are real browser captures of the checked-out NüMe frontend with its bundled synthetic fixtures, not live health records or evidence of a newly executed agent run. Captions say "Demo data / October 2026". The agent view shows a fixture trace with coordination, parallel analysis, a remote specialist and validation.

Capture source and original PNGs are retained in `/mnt/ssd/homelab/artifacts/portfolio-nume-capture-20261016/`. Its isolated app copy replaces Clerk session setup with bundled member/admin fixtures and enables the existing mock API; NüMe's working checkout, authentication and live backend were not changed. Capture screenshots again when the app UI changes, inspecting for private data before publishing.

## Disconnected interactive samples

`src/components/NumeDemo.astro` is shared by the NüMe project page and `/projects/nume/demo/`. It imitates selected dashboard, health, recipe and agent-trace interactions using synthetic data, with no iframe, React runtime, credentials, API calls or persistence. Ask NüMe routes a short question through deterministic local keyword/rule selection, catalog choice and supported-topic validation (`src/data/nume-agent.ts`). Replies are deliberately short, and unknown topics take a fallback path. The trace shows the actual question, current sleep/stress inputs, selected rule, catalog output and the same returned answer, rather than pretending to call remote specialists. Local playback reveals those computed stages and stops on navigation/reset. This is an illustrative agent flow, not NüMe’s original Google ADK or scoring implementation. The portfolio describes NüMe’s development in the past tense.

The sample interaction code loads on the NüMe project and standalone sample pages, not the homepage. Static assets use the existing portfolio host; no new backend service is needed. Ongoing cost is the work to design and maintain each project’s representative interactions. This PoC does not authorize creating demos for every project. Source: `src/components/NumeDemo.astro`, `src/pages/projects/nume/demo.astro`, `src/scripts/nume-sample.ts` and `src/data/nume-agent.ts`. `tests/nume-sample.mjs` covers the interactions at 1440, 390 and 320px while rejecting external/API requests.
