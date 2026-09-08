> Integration update: the approved design now lives at `/` in `src/pages/index.astro`, `src/styles/home.css`, and `src/scripts/home.ts`. The separate `/preview/` route is retired. References below describe historical review builds. Browser interaction checks now live in `tests/home-interactions.mjs`.

# petrozzi.dev — redesign research

**Status:** research only. No implementation has been done from this document.
**Date:** 2026-09-08
**Audience:** whichever model or person implements the next pass. Read this before touching `src/`.
**Preview:** http://petro.ink:4444/ (serves `dist/`, so `npm run build` first)
**Working proof of this document:** http://petro.ink:4444/preview/ — source at
`src/pages/preview/index.astro`, standalone, does not touch the live site. Every claim in §8, §8b and
§9 was implemented and measured there before being written down here. Read that file alongside this
document; it is the reference implementation, not a mockup.

---

## Start here — implementation contract

Read §14 first (the ordered plan), then §8/§8b (motion + measured perf rules) and §9 (typography).
Then open `src/pages/preview/index.astro` — it is a **working reference implementation** of this
document, not a mockup. Where the prose and that file disagree, the file is right; it was measured.

**Non-negotiable:**
- `public/classic/` and the era transition (`public/era.js`, `public/era.css`, `data-era-link`,
  `rel="expect"` + `#era-ready`) ship byte-for-byte unchanged. The 2023→2026 switch is the best asset
  on the property.
- Do not exceed the performance budget in §14. Any long frame while idling at the top of the page is
  a regression, and the measurement recipe is in §8c — run it before and after.
- Copy in the preview is a **placeholder written from the repos**, not approved text. Keep its
  *shape* (specific, concrete, first-person, no slogans); expect Fabrizio to replace the words.
- Never `filter: blur()` over animated children. Never `backdrop-filter` over moving content.

**What is already proven and can be lifted directly from the preview file:** the OKLCH palette, the
two-family type system with `wdth`/`tnum`/`opsz`, capability-chip filtering derived from existing
`tools` frontmatter, the three-tier card system, magnetic controls, pointer-tracked spotlight glass,
the SplitText masked line reveal, GSAP Flip filter reflow, and the offscreen-pause pattern.

**What is deliberately NOT in the preview and still needs doing:** real interior screenshots for Nest
and NüMe (both currently show sign-in screens), per-project case-study pages rewritten to
context → problem → decision → outcome (§4.3), `astro-icon` instead of the hand-built sprite (§7),
Astro's image pipeline instead of `public/` (§13), and Handshake AI's real title and dates (§15).

**Unresolved, flagged honestly:** Apple-accurate liquid-glass *refraction* (SVG displacement through
`backdrop-filter`) is Chromium-only in 2026 and was not solved here — §8.4 Tier 3 explains the
fallback that works everywhere. Do not ship a Chromium-only hero effect.

---

## 0. The one-paragraph brief

Fabrizio Petrozzi, St. Petersburg FL. MS in AI & Business Analytics (USF, 4.0), BS Business
Management (USF, 3.98). Worked at Raymond James Bank, was a graduate TA for CGS 2100. Builds
real software he actually runs: a household app (Nest), a research publication pipeline
(Proterra), a multi-agent wellness product (NüMe), a homelab, a Windows usage overlay. The site
exists to make a hiring manager or collaborator believe he ships and maintains real systems,
and to be a place he is personally happy to send people. The audience is technical enough to
know what FastAPI is and impatient enough to leave in 10 seconds.

**Hard constraint:** `/classic/` and the era-switch transition ship as-is. The original site and
the circular View Transitions reveal between eras are the best thing on the property. Everything
else is open.

---

## 1. Audit of the current build (measured, not guessed)

Screenshots taken 2026-09-08 from the live preview at 1440×900, 390×844, and on `/projects/nest/`.

| Fact | Value | Why it matters |
|---|---|---|
| Body typeface | `Arial, Helvetica, sans-serif` | The single loudest "nobody chose this" signal on the page. |
| Color tokens | 6 (`--paper --ink --muted --line --accent --surface`) | No scale, no depth, no state colors. Everything is one grey-blue. |
| Projects | 21 | |
| Tagged `Earlier work` | 13 of 21 | 62% of the grid is coursework, presented at identical weight to Nest and NüMe. |
| Projects rendering the fallback visual | 18 of 21 | `ProjectVisual.astro` only implements `nume`, `proterra`, `nest`. Everything else renders `<strong>{title}</strong>` in a tinted box. |
| Unique values in the Technology `<select>` | 52 | |
| …that appear on exactly one project | 33 | Two thirds of the dropdown filters to a single card. |
| Projects with no repo and no demo link | 3 (incl. Nest) | No proof-of-work path on the flagship personal project. |
| Homepage height at 390px wide | 8,572 px | ~22 phone screens, nearly all of it identical cards. |
| Icons on the page | 0 | The theme toggle is the text glyph `◐`. |
| Distinct card treatments | 1 | Same radius, same 1px border, same padding for a shipped product and a class assignment. |

### What is actually wrong, in the user's words

**"Projects look boring."** Correct, and the cause is specific: the site shows *diagrams of nouns
instead of software*. NüMe's "visual" is a flowchart of the words Sleep / Activity / Check-ins →
Coordinator agent. Nest's is a 2×3 grid containing the words Weekly plans, Recipes, Pantry,
Groceries, Cat care, Calendar. These are wireframes of a bulleted list. For the other 18 projects
there is no visual at all — just the title, again, in a box, under the title. A visitor scrolling
the grid sees 21 rectangles that differ only in their text.

**"Filters are a huuuuge dropdown and list too many tools."** Correct and quantified above: 52
options, 33 of them dead ends. It also mixes levels — `Python` and `pynput` and `UX / UI` and
`Cloud Computing` are offered as peers.

**"About me is boring."** It is three grey paragraphs and a 180px headshot. It contains no
specific claim, no number, no opinion, and nothing you couldn't infer from the project list.

**"Top is boring."** The hero says "Hi, I'm Fabrizio" and then a paragraph starting "I studied
business at USF." It never states what he does in a sentence you could repeat. Note the old site
*did*: "MS AI & Business Analytics professional with over one year of experience in SQL, Python,
and applied AI." That line was dropped in the rewrite.

**"Not enough icons."** Zero.

**"No experience section."** Confirmed — see §6, which answers whether that is better.

### The project pages are thinner than the homepage suggests

Every one of the 21 generated pages uses the same three headings — *The idea* / *How it works* /
*A closer look* — with one to three sentences under each. `/projects/nest/` is 4 sentences of body
copy total, one text-box "visual", no screenshot, no architecture, no metric, no link. Twenty-one
pages with identical structure and no evidence is the strongest "generated" tell on the site,
stronger than any styling issue. Fixing the homepage without fixing these just moves the
disappointment one click later.

---

## 2. What the old site did better (harvest, don't discard)

The original at `/classic/` is objectively worse-looking and yet solves four things the new one
dropped. Take these back:

1. **A stated value proposition above the fold.** One sentence naming the degree, the years, and
   the three tools. The new hero has nothing equivalent.
2. **Icon-labelled tech chips as the filter** — `Python`, `SQL`, `Node.js`, `C#`, `Machine
   Learning`… each with a Boxicons glyph, under the heading "Click any skill to filter projects
   below." A visible, scannable, ~16-item chip row. This is closer to correct than the dropdown
   that replaced it (see §5).
3. **Experience / Education as a tabbed timeline** with real institution logos (USF crest,
   Raymond James mark), dates, roles, and GPA. That content does not exist anywhere on the new
   site — not even in prose. The 4.0 and the bank job simply vanished.
4. **Personality**: the map, the profile card, the dark ground. The new site is lighter and
   cleaner and says less about who he is.

The lesson to carry into the redesign: *the rewrite optimized for tidiness and paid for it in
substance.* Clean is necessary and not sufficient. Every element removed in the name of restraint
needs to be replaced with something more specific, not with whitespace.

---

## 3. Brand — the logo is the design system, and the site ignores it

The mark is a liquid-glass **F** in blue/cyan/violet with an orange-warm specular hit, and a
droplet escaping the top-right of the letterform. It is genuinely good, and right now it is the
only saturated object on a page of `#f2f5fa` grey-blue. The site looks generic partly because it
refuses to take any cue from its own logo.

**Direction: build the whole system out of the mark.**

- **Palette from the glass, not from a Tailwind ramp.** Sample the logo: deep ink navy ground,
  cyan → violet as the gradient axis, and the droplet's warm orange as the single scarce accent
  (used for one thing site-wide — the current/active state, or the "live" indicator — never as
  decoration). Define in **OKLCH**, not hex: it is supported in every modern browser and its
  perceptual uniformity means fixing lightness and rotating hue gives a palette that holds even
  contrast, and light/dark pairs that stay in step without hand-correction.
- **The droplet is the site's one recurring device.** It is already a metaphor for "something
  escaping the container" — good for a person whose work escaped coursework into things he
  actually runs. Candidate uses, pick exactly one: scroll-progress indicator that travels the
  page; the reveal element for the era transition; the bullet/marker in the timeline; the
  active-filter indicator. One. Not four.
- **Glass is the material, used on one or two surfaces only.** See §8 for the accessibility and
  performance constraints on this — they are strict and non-optional.
- Consider a dark-first design. The mark is lit like a neon object; it reads far better on a deep
  ground than on pale grey, and the old site was dark. The light theme then becomes the alternate
  rather than the origin.

---

## 4. Making projects not boring

### 4.1 The structural fix comes before the visual fix

13 of 21 entries are coursework. As long as *MongoDB (class assignment)* occupies the same card
shape and grid slot as *Nest (running in production on his own hardware)*, no amount of styling
will make the good work look good — the grid averages everything down to its median item.

Research is consistent on this. Hiring-manager surveys land on **3–5 polished projects beating
10+ basic ones**; the most-cited developer portfolio (Brittany Chiang's) features **four**
projects with screenshots and stack chips and lets the rest live in a compact list.

**Recommendation — two tiers, structurally different, not just visually:**

- **Work** (~6–8): Nest, NüMe, Proterra, Homelab, Agent Usage, Slice, CareMesh, Autoclicker.
  Full pages. Real evidence. Large, varied cards.
- **Coursework & earlier work** (13): one compact section — a dense table or list with title,
  year, one line, repo link. No cards, no images, no filter facets of their own. Framed honestly
  ("where I started"), which is a strength, not an apology. They stay indexed and linkable; they
  stop competing for attention.

This one change fixes the boring grid *and* most of the filter problem at the same time, because
the filter then only has to span ~8 items instead of 21.

### 4.2 Show the software

84% of employers want to see a working application, not just a repository. The current site shows
neither. In order of value:

1. **Real screenshots.** Nest, NüMe, Proterra, Agent Usage, Slice and Grafana all have actual UI
   that can be captured. A cropped, well-lit screenshot of Nest's Kitchen tab on a phone frame
   beats any CSS abstraction. Run them through Astro's image pipeline (`<Image>` from
   `astro:assets`, WebP/AVIF, responsive `srcset`) — move them out of `public/` to get it.
2. **Short silent screen recordings** (2–5s, muted, `preload="none"`, poster frame, plays on
   hover/focus/tap) for the two or three projects where the *interaction* is the point. This is
   the single highest-impact upgrade for a grid of software projects. Gate on
   `prefers-reduced-motion`.
3. **A real diagram** where there's genuinely a system worth drawing — the homelab network, the
   Proterra gather→score→cluster→publish pipeline. A diagram is only worth it if it shows a
   *mechanism* the reader couldn't guess. The current "visuals" fail this: they list features.
4. Only then, generated/abstract art — and if used, it should differ per project.

### 4.3 Give the case studies something to say

The three-identical-headings problem. The structure that research converges on for engineering
case studies is: **context → problem → approach → implementation → outcome → what I'd change.**
Keep it to something readable in 1–2 minutes.

Concretely, per project, aim for:

- **A one-line spec strip** the eye can grab: role, timeframe, status, stack, and links. It is the
  first thing a technical reader looks for and currently it is scattered or absent.
- **A specific problem statement.** "A household application connecting planning, pantry, recipes,
  groceries, calendars, and everyday care workflows" is a feature list. "My partner and I kept
  buying groceries we already had" is a problem.
- **One real decision with its tradeoff.** He has excellent material here already, sitting in the
  homelab notes: server-rendered fragments + Alpine instead of a SPA, and why; SQLite WAL and a
  connection pool; the Safari `focusout` bug that killed tap-to-pick on iPhone but worked on
  desktop Chrome. That last one is a *great* portfolio anecdote — it is exactly the kind of thing
  that proves someone actually shipped and debugged a thing on real devices.
- **An honest outcome.** Not invented metrics. "Runs on my own hardware; my partner and I use it
  daily; ~40 recipes and 6 months of grocery runs in it" is more credible than a fake percentage.
- **Links or an explicit reason there aren't any.** Nest is private — say "private, screenshots
  only" rather than showing nothing.
- **AI disclosure.** Multiple 2026 sources note employers now read transparency about AI-assisted
  development as a positive rather than a negative, in a market flooded with polished AI output.
  A one-line honest note ("built with heavy use of coding agents; here's what that workflow looks
  like") turns a liability into a differentiator — and the Agent Usage project makes it credible.

### 4.4 Card design

- **Break the uniform grid.** Vary card size by significance. A bento-style asymmetric layout is
  the current idiom for exactly this job, but it has been used enough that it is now a default —
  if used, the variation must map to real hierarchy (biggest = most important) rather than being
  a decorative mosaic.
- **Differentiate by content, not by hue.** Screenshot-led cards for products, diagram cards for
  systems, a text-led card for writing. The mix is what makes the grid stop reading as a template.
- **Status deserves a real signal.** "Private application" / "Product demo" / "Internal project"
  are currently identical grey microtype. A live/deployed project is materially different from an
  archived one; show that.
- Structural devices must encode information. Do not add `01 / 02 / 03` markers to the project
  grid — the projects are not a sequence. Numbering *is* appropriate for the era timeline.

---

## 5. Filters — replace the dropdown

### The research

Baymard's large-scale testing on filtering layout is directly applicable: **horizontal filter
toolbars are unsuitable above 6–8 filter types**, and their core failure is that options aren't
visible by default, so users can't see the scope of what's filterable. Their other finding is that
"See more filters" / "All filters" affordances get **overlooked** outright. A `<select>` is the
degenerate case of both problems: 52 options, zero visible by default.

The chip pattern that works, per the faceted-search literature:

- Options **visible without interaction**, in a horizontally scrollable row near the top.
- **Multi-select**, combinable across facet types, each individually removable.
- **Applied filters shown as removable chips** with a persistent "Clear all".
- **A result count that updates live** (this site already has `role="status" aria-live="polite"` —
  keep it, it's correct).
- Chip text is short — one or two words.
- Keyboard path and focus management ship with it, not after.

### Recommendation

1. **Delete the technology `<select>` entirely.**
2. **One row of 6–8 capability chips, each with an icon and a label.** Filter by *what the thing
   is*, which is what a visitor actually wants, not by string-matching a dependency:
   `AI & agents` · `Web apps` · `Data & SQL` · `Infrastructure` · `Design` · `Desktop tools` ·
   `Coursework`. Attach a count to each. This also collapses the current confused taxonomy where
   `Earlier work` is simultaneously a category and a status.
3. **Tools stop being a facet and become evidence.** Keep them on the card as small labelled
   logos (§7) and keep them reachable through the free-text search box, which already searches
   `title + summary + tools`. Someone hunting for "Tailscale" will type it; nobody browses to it
   in a 52-item list.
4. **Show the applied state**: chips for what's on, live count, one Clear.
5. Progressive-enhancement note: the panel is currently `hidden` until JS unhides it, which is the
   right instinct — keep that so the no-JS path still renders all projects.

Skill/tool display anti-pattern to avoid while you're in here: **no percentage bars or
proficiency meters.** They are widely and correctly read as noise — an invented number with no
scale under it. Name the tool, prove the level in the project.

---

## 6. The experience section — answering "is it better without it?"

**No. Put it back, but not as a resume dump.**

The reasoning:

- The standard portfolio section set is homepage / projects / about / experience / proof /
  contact, with the caveat that extra sections only earn their place if they answer a question a
  visitor actually has. For a **2026 MS graduate** — the exact case here — "where has this person
  worked, and what did they study" is a live question that projects alone don't answer. For a
  senior engineer with a well-known employer history it would be closer to optional.
- He has genuinely strong credential content that is currently **nowhere on the new site**: MS AI
  & Business Analytics 4.0, BS Business Management 3.98, Raymond James Bank, USF graduate TA. The
  old site displayed all of it. Deleting it wasn't a design decision, it was an omission.
- The career arc is itself the most interesting thing about him and the site never tells it:
  *business degree → bank → came back for AI → now builds and operates his own systems.* That's a
  story with a shape. "I studied business at USF" buried mid-paragraph throws it away.

**Form:** compact, factual, and *not* a big vertical timeline with animated dots — that's the
generic treatment and it costs a full screen. Options worth considering: a tight two-column
Experience/Education block; or a single horizontal spine that doubles as the site's era device
(the old-site → new-site switch is chronological too, which is a real connection, not a
decorative one). Institution logos are legitimate here and add credibility cheaply — the assets
already exist in `public/classic/images/`.

Keep the resume PDF link, but note the README already flags that resume/bio details need
verifying before publishing.

---

## 7. Icons

### Library recommendation

**Two libraries, two jobs. Do not mix a third.**

| Job | Library | Why |
|---|---|---|
| UI icons (nav, filters, links, status, controls) | **Lucide** | ~1,778 icons, MIT, one consistent family: 24×24 grid, stroke-only, stroke-width 2, rounded joins. Everything looks drawn by one hand, which is the whole point. |
| Technology / brand marks (stack chips, GitHub, LinkedIn) | **Simple Icons** (monochrome, 3,200+ brands, official brand hex in metadata) or **Devicon** (~450 dev tools, colored/plain/outline variants, built for exactly this) | These serve a different purpose than UI icons and don't visually conflict. Simple Icons if you want them tokenized to one color; Devicon if you want the real brand colors. |

Alternatives considered: **Tabler** (~6,143 icons — take it only if Lucide's coverage actually
fails you, and it probably won't); **Phosphor** (six weights per icon — the right pick only if
weight variation is doing design work).

There is already precedent on the property: the old site used Boxicons for exactly this. Lucide is
the same idea, executed better, and it is also the icon set already used by the Nest app, so the
two properties would share a vocabulary.

### Delivery in Astro

`astro-icon` (v1.2.0, updated 2026-08) is the fit: pulls from local `src/icons/*.svg` *and* any
Iconify set, inlines or sprites at build time, runs svgo automatically, **ships zero runtime
JavaScript**. Sprite mode emits one deduplicated `<symbol>` sheet per page with `<use>` references
— relevant because the tool chips will repeat the same marks many times across the grid.

Do **not** ship an icon font, and do not load a CDN icon script — the current build's whole
virtue is that the modern page loads no third-party anything (the README calls this out as a
deliberate isolation from the classic page's Boxicons/map dependencies). Preserve that.

### Usage rules (from NN/g icon research)

- **Label everything.** In testing, users correctly predicted an icon's behavior **88%** of the
  time with a visible label, **60%** without. Icons carry recognition, labels carry meaning.
- Labels stay **visible at all times** — hover-only labels raise interaction cost and simply fail
  on touch. This applies directly to the filter chips and the header controls.
- Icons in the tool chips are decorative-adjacent: `aria-hidden="true"` on the SVG, real text
  beside it.
- Consistency of family is more important than expressiveness of any single icon. One stroke
  width, one grid, one corner style.
- Replace the `◐` theme toggle glyph with a real icon. Same for the `←` in "Back to the
  collection" — though note the design guidance that appending `→` to link text is itself a
  generated-page tell, so if arrows are used they should be a deliberate icon, not a character
  glued to a string.

---

## 8. Effects and motion

**The diagnosis that matters most.** The first preview had glass, drifting gradients, a scroll-driven
rail and a specular sheen, and it still read as flat. The reason is not that it lacked a library:
**every motion on it was ambient, and none of it was causal.** Nothing responded to the pointer,
nothing was triggered by arrival, and the one hover effect was a 900ms sweep at 13% white that most
people never consciously see. Ambient motion is wallpaper. Motion that answers what the visitor just
did is what reads as expensive. Fix the causality before buying any library.

### 8.1 Library verdicts (versions, sizes and licences verified against the npm registry, not blogs)

| Library | Version | Licence | gzip | Verdict |
|---|---|---|---|---|
| **GSAP** core | 3.15.0 | "Standard 'no charge'" — **free, but NOT OSI open source** | 27.6 KB | **Use** |
| ↳ SplitText | 3.15.0 | same | **3.6 KB** | **Use** — masked line reveals |
| ↳ Flip | 3.15.0 | same | 9.5 KB | **Use** — filter reflow |
| ↳ DrawSVG | 3.15.0 | same | **2.1 KB** | Optional — logo self-draw |
| ↳ ScrollTrigger | 3.15.0 | same | 17.6 KB | Only if pinning; CSS covers reveals |
| Motion (motion.dev) | 13.2.0 | MIT | ~2.3 KB mini / 45 KB full | Better *engine* (real `ScrollTimeline` + WAAPI), but no Flip/SplitText equivalent |
| Anime.js | 4.5.0 | MIT | 39.6 KB | **Skip** — its ScrollObserver is a plain scroll listener, no `ScrollTimeline`, no IntersectionObserver |
| Theatre.js | 0.7.2 | Apache-2.0 | — | **Skip — dormant.** Last code commit Jan 2024, 141 open issues |
| **Lenis** | 1.3.26 | MIT | 5.3 KB | **Do not use — see 8.2** |

Verified directly in this repo: every formerly-premium plugin (`SplitText.js`, `Flip.js`,
`DrawSVGPlugin.js`, `MorphSVGPlugin.js`, `ScrollTrigger.js`) ships inside the free `gsap` npm package.
The licence string in `package.json` literally reads `Standard 'no charge' license` — free for this
use, but the common claim that "GSAP is now open source" is wrong. Webflow retains the IP and the
licence forbids building competing no-code animation builders.

Also verified: GSAP core has **zero** references to `Element.prototype.animate`/`KeyframeEffect`, and
ScrollTrigger has **zero** references to `ScrollTimeline` — both are rAF tickers writing inline
styles. That is fine (they write `transform`/`opacity`, which the GPU still composites) but it means
GSAP scroll work stalls if the main thread stalls, whereas native CSS scroll timelines do not.

### 8.2 Lenis: recommended against, and not for the usual reason

The common objection ("it breaks scroll-driven CSS animations", "it tanks INP") is **false**, and
saying so will cost you credibility. Lenis sets the real `scrollTop`, so `position: sticky`, anchors,
scrollbars and `animation-timeline: scroll()` all keep working; and INP does not measure scrolling at
all — web.dev is explicit that scroll is not an observed interaction.

The real argument is narrower and stronger: **Lenis advances scroll position from a main-thread rAF
loop.** Native scroll plus threaded scroll-driven animation keeps moving even when the main thread is
blocked. Adding Lenis converts a jank-immune system into a jank-fragile one, on a page that also has
`backdrop-filter` on a sticky header. It also adds 0.1–0.3s of input latency, has no CSS scroll-snap
support, caps at 60fps on Safari, and breaks over nested scrollers without `data-lenis-prevent`.
On a site whose stated requirement is "smooth frames", it is a straight downgrade.

### 8.3 Why the first preview lagged — the actual pipeline

`filter`, `opacity`, `mask`, `mix-blend-mode` and `backdrop-filter` are **effect nodes** in Chromium's
property trees, and a non-trivial effect node **forces a render surface** — its own intermediate GPU
texture. The compositor must draw every descendant into that texture, run the filter shader, then
draw the result into the parent.

The blobs themselves were never the problem: `transform` is compositor-mutable, so their tiles were
rastered once and cached. The problem is that **the surface's damage rect was non-empty every frame**,
so the entire blur pass re-executed 60 times a second. Had the blobs been static, the blurred surface
would have been drawn once and cached — *the animation is what destroys the cache.*

Two multipliers made it worse:
- A Gaussian needs ~3σ of support, so `blur(58px)` outsets the surface ~174px per side. At 1440×900,
  DPR 2, that is roughly a 35 MB texture allocated, written, read and written again, at 60Hz.
- Mobile GPUs are tile-based; every extra render pass means binding a new target and resolving tile
  memory to main memory. This is why a hero that is fine on an M-series Mac is far worse on a Pixel.

**The tell:** the main thread looks *idle* in the Performance panel, and Lighthouse's "Avoid
non-composited animations" audit stays green — the animations *are* composited. Composited ≠ cheap.
Read the **Frames** and **GPU** tracks, not the Main track.

### 8.4 The ladder, in order

**Tier 0 — free and native. Do these first.**
- `radial-gradient(closest-side circle, <color>, transparent)` for every glow and blob. **A blurred
  solid circle is a radial gradient with a soft falloff** — you were paying a per-frame convolution to
  compute something expressible as one static paint. Make the box ~2× the old blob so the falloff
  lives inside it.
- `linear()` easing. Sample a real spring into a point list and the compositor evaluates it for the
  same cost as `ease`. Most of what people call "Apple-like movement" is the curve, not the effect.
  This is the highest leverage-to-cost item available. Baseline Widely Available June 2026.
- CSS scroll-driven animations for anything ambient — compositor-threaded in Chrome 115+ and, since
  **Safari 26.4**, in WebKit too. Firefox stable still does **not** ship it (MDN BCD says `preview`),
  so the `@supports (animation-timeline: view())` guards are load-bearing, not decoration.
- View Transitions for page changes. The era switch already does this correctly; extend the same
  mechanism to project cards with matching `view-transition-name`, and do **not** add
  `<ClientRouter />` — it converts the site to an SPA to get something you already have.

**Tier 1 — causal motion, no library needed.** This is what was missing.
- **Magnetic controls.** On `pointermove`, translate the element a fraction of the cursor offset;
  elastic return on leave. Cache the rect on `pointerenter` — never call `getBoundingClientRect()`
  inside the move handler — and coalesce writes into one rAF.
- **Pointer-tracked spotlight on glass.** Write cursor position into `--mx`/`--my` and let a
  `radial-gradient` in `::after` do the rest. Register them with `@property` **and
  `inherits: false`** — an inheriting custom property invalidates the whole subtree's styles, measured
  at up to 8ms/frame.

**Tier 2 — GSAP, for what CSS genuinely cannot do.** Masked line reveal (`SplitText` with
`mask: "lines"`, animating `yPercent` only so the LCP heading never fades from `opacity: 0`), `Flip`
for filter reflow so cards travel to their new cell instead of teleporting, `DrawSVG` for a one-time
logo self-draw.

**Tier 3 — Apple Liquid Glass refraction. Read this before attempting it.** The real technique is an
SVG filter chain (`feImage` → `feDisplacementMap`, with the displacement map encoding refraction
offsets in the R/G channels) applied through `backdrop-filter: url(#id)`. **SVG filters in
`backdrop-filter` are Chromium-only in 2026** — they do not work in Safari or Firefox, which is a
bitter result given the goal is to imitate Apple. Changing the element's size or shape forces a full
displacement-map rebuild, so it cannot drive hover states. **Recommendation: don't.** A `backdrop-filter`
blur plus a masked gradient border, an inset specular highlight and a pointer-tracked light gets ~95%
of the perceived effect everywhere, for ~1% of the cost. Spend the effort on movement instead.

### 8.5 Anti-patterns that specifically read as generated

- `filter: blur()` on a parent whose children animate. **Never.** This was the bug.
- `backdrop-filter` over content that is moving. **Never** — a guaranteed per-frame cache miss.
- Animating `background-position`, `mask-position`, `width`, `top` or `background-color`. A measured
  case study went 40fps → 120fps and 7,941 paints → 2 by swapping `background-position` for
  `transform` on an oversized element. This bit the preview too: the droplet rail animated `top`
  against a scroll timeline — a layout property, so it could not be threaded on any browser.
- `@property` animation on a full-viewport infinite loop. It is **not** composited; it forces style
  recalc and repaint every frame. Use it for one-shot transitions on small subtrees only.
- `will-change` on everything. Chromium already auto-promotes elements with a running composited
  animation, so it buys nothing there; each promoted full-viewport layer costs ~12 MB at DPR 3, and
  layer explosion is a real failure mode. Apply on `pointerenter`, remove after — or omit.
- Fade-and-slide-up on every section plus a hover-lift on every card. Still the loudest AI-design tell.
  One orchestrated arrival beats twenty scattered reveals.

## 8b. Measured performance findings (proven on this site, not quoted)

These numbers come from the `/preview/` build on this repo, sampling `requestAnimationFrame`
intervals during a scripted scroll in headless Chromium (software rasterisation, so a real
GPU-accelerated browser will be better — the *relative* costs are what matter). Method is in §8c. **Do not repeat the mistakes in the first column.**

| Build | fps | frames > 20ms | worst frame |
|---|---|---|---|
| `filter: blur(58px)` on a parent of 3 animated blobs | **14.7** | 100% | 150 ms |
| …blur removed, blobs redrawn as radial-gradients | 55.7 | 6.8% | 50 ms |
| …plus the field paused while offscreen | **60.0** | **0%** | 17 ms |

Two rules came out of this, and they are the difference between "premium" and "laggy":

**1. Never put `filter: blur()` on an element whose children animate.** The blurred parent is one
rasterised layer; any child transform invalidates it, so the browser re-blurs the entire surface
every frame. A 130vh × 120vw layer at 58px blur cost ~68ms per frame on its own — a 4× frame-time
penalty for an effect that was not needed at all. A `radial-gradient(closest-side circle, <color>,
transparent)` is *already* soft, needs no filter, and composites for free. Use gradients for glow
and blobs; reserve real blur for backdrops.

**2. `backdrop-filter` over *moving* content re-rasterises every frame.** Isolated with runtime CSS
overrides:

| Variant | fps | frames > 20ms |
|---|---|---|
| Everything on | 53.3 | 12% |
| `backdrop-filter: none` everywhere | **60.0** | **0%** |
| Blob drift paused | 56.7 | 4.1% |
| Sheen + scroll rail removed | 59.7 | 0.6% |

The glass itself is not the problem — the *combination* of a glass surface and animation behind it
is. The scroll-driven rail and the specular sheens are effectively free (0.6% long frames), which
confirms the §8 ladder: transform/opacity and scroll-driven CSS are cheap; compositing a live
backdrop over motion is not.

Fixes, in order of preference:
- Pause motion behind glass when it is offscreen. One `IntersectionObserver` toggling
  `animation-play-state: paused` on the field recovered the entire remaining cost (53.3 → 60fps).
  Add `document.hidden` to the same toggle so background tabs cost nothing.
- Keep glass surfaces over *static* content wherever possible.
- Where a glass surface must sit over motion permanently, fake it: a pre-blurred/gradient fill plus
  an inset highlight reads almost identically and costs nothing per frame.
- `contain: strict` on the decorative field keeps its layout and paint out of the rest of the page.

**Budget for this site:** at most 2–3 live `backdrop-filter` surfaces on screen, blur radius ≤ 12px,
no `filter: blur()` on animated subtrees at all, and every decorative loop pauses when offscreen.
Anything proposed beyond that has to be measured before it ships.

## 8c. How to measure this

`tests/` already has a frame-sampling pattern. The probe used above:

```js
// playwright: sample rAF intervals during a scripted scroll
const r = await page.evaluate(async () => {
  const f = []; let last = performance.now(); const stop = performance.now() + 4000;
  await new Promise((res) => {
    (function tick(t) {
      f.push(t - last); last = t;
      if (t < stop) { window.scrollBy(0, 7); requestAnimationFrame(tick); } else res();
    })(performance.now());
  });
  const g = f.slice(3), avg = g.reduce((a, b) => a + b, 0) / g.length;
  return { fps: 1000 / avg, pctLong: 100 * g.filter((x) => x > 20).length / g.length };
});
```

To attribute a cost, re-run with `page.addStyleTag()` disabling one suspect at a time
(`*{backdrop-filter:none!important}`, `.blob{animation:none!important}`) — the deltas above were
found that way in one pass. Treat < 60fps or any long frames on this page as a regression.

---

## 9. Typography

The first preview used Bricolage Grotesque (display) + Instrument Sans (body) + **IBM Plex Mono**
for every small accent — stats, tech tags, dates, captions. The mono read as wrong, and measuring the
actual font binaries showed why. Five compounding causes, only one of which is the typeface's fault:

1. **It was the only static font in a variable stack.** Google Fonts ships IBM Plex Mono as seven
   separate static files; there is no variable build. The preview carried two of them (~29.6 KB) where
   every other family was one variable file.
2. **Negative letter-spacing was applied to a monospace.** `-0.035em`, `-0.03em`, `-0.04em` on the
   stat, tag and era rules. Monospace exists to hold a fixed grid; tightening it destroys the grid,
   collides the caps and leaves the narrow letters gapped. This was probably most of the "weird" —
   and it happened because a value that is right for a display face got copied onto a mono.
3. **Width mismatch inside words.** Plex Mono's `n` advance (600) nearly matches Instrument Sans's
   (599), so they look compatible on paper — but mono forces `i`/`l`/`t` out to 600 and squeezes
   `M`/`W` down to 600. On strings like `TypeScript`, `FastAPI`, `Tailscale` the caps look crushed
   and the thin letters float.
4. **x-height collapse.** Tags were set at ~0.68rem ≈ 10.5px. At Plex Mono's 0.516 x-height that is a
   ~5.4px lowercase, in the faintest grey on the palette.
5. **One font doing seven unrelated jobs** — dates, tags, captions *and* display-size numbers — stops
   being an accent and becomes a second voice competing with the display face.

### The fix: delete the third family

Everything needed was already in the files the site shipped, unused:

- **The `wdth` axis had been lost in subsetting.** Instrument Sans has `wdth 75–100` upstream; the
  preview's subset was instanced at `wdth=100` because the Google Fonts request never asked for the
  axis. Re-requesting it restores a condensed grotesque **for free** — verified: the new `fonts.css`
  now declares `font-stretch: 75% 100%`.
- **`tnum` was already present** in both subsets, so tabular figures for stats needed no new font.
- **Bricolage's `opsz` axis ships but defaults to 96**, meaning small headings were being rendered
  with the *96pt display* optical size — tightest spacing, thinnest hairlines. Setting
  `font-variation-settings: "opsz" 20–32` on card and section headings is free and visibly better.

So the recommendation is two families, not three:

```css
/* labels, tags, dates, captions — condensed + uppercase.
   Uppercase is what fixes the 10px legibility problem: caps are ~41% taller than the x-height. */
.u-label, .stack li, .tl time { font-stretch: 82%; font-weight: 500;
  text-transform: uppercase; letter-spacing: .075em; font-size: .69rem; }

/* stat readouts — tabular figures, and NO negative tracking */
.stats b, .hero__strip b { font-variant-numeric: tabular-nums; font-weight: 600; letter-spacing: -.01em; }
```

Net effect: **−29.6 KB**, one fewer family, and three axes switched on that were already being paid
for. If tags later feel too quiet, the escalation is **Archivo** (`wdth 62–125`, `tnum`, slashed
`zero`), not another mono. If the terminal/infra connotation is worth defending deliberately, use
**Reddit Mono** (variable, narrowest measured at 562, real `tnum`/`zero`) for *one* role only.

**Not an option:** real small caps. None of Instrument Sans, Bricolage, Archivo, Inter or any
candidate mono ships `smcp`. `font-variant-caps: small-caps` will synthesise them by scaling caps,
which looks weak at 10px. Use uppercase + tracking + a lighter weight instead.

**Still avoid** (generated-page tells): accenting one word of a headline in a different colour;
tracked-out ALL-CAPS eyebrow labels above every heading; `A · B · C` middle-dot meta strings;
`WORD — fragment` with a spaced em dash; `→` glued onto link text. Note the distinction — uppercase
*labels on data* are a typographic fix for legibility at 10px; uppercase *eyebrows above headings*
are decoration. The first is fine, the second is the tell.

## 10. The hero

Above-the-fold content takes roughly **57%** of viewing time and first impressions form in about
**50ms**. The standard, research-backed contents are: a plain headline, a short subhead, one CTA,
a supporting visual, and a piece of proof. The current hero has the headline and the visual, a
subhead that buries the point, a weak text-link CTA, and no proof at all.

But note the design guidance in tension with that list: the default hero treatment — big number,
small label, supporting stats, gradient accent — is itself a cliché. The instruction that matters
more is **open with the most characteristic thing in the subject's world**.

For this subject, the most characteristic thing is *software he actually runs, and a brand mark
that behaves like a liquid*. So the strongest hero candidates are:

- The **mark itself as a live object** — the droplet actually escaping on load, once, as the
  page's single orchestrated motion moment. It's his brand, it's already beautiful, and nobody
  else has it.
- A **real interface**, not a diagram: Nest's Kitchen tab on a phone, or the Grafana board, sized
  large enough to read.
- The **era switch promoted into the hero** rather than buried near the footer. "Here's the site I
  built while learning HTML in 2023, and here's the one I built after" is a *transformation*, and
  transformations are inherently interesting. It's already the most distinctive thing on the
  property and it currently sits below 21 project cards where almost nobody scrolls to it.

Whatever the visual, add the missing sentence: what he does, in words he'd say out loud. The old
site's line is the starting point; it can be sharper and less resume-ish.

---

## 11. About

Guidance converges on: **specific, human, short.** Three to five sentences in first person, with a
"more about me" available below for anyone who wants it. Lead with focus, include one concrete
thing, let personality through. The example format the sources land on is roughly: *what I build →
a specific proof point → a genuine preference.*

What the current version is missing is anything only he could have written. Available material
that is specific and true, from the repo and homelab notes: he runs his own hardware; his partner
uses the app he built daily; he keeps a tool that tracks his own AI usage; there are two cats
(Goose and Maple) with weight tracking wired through Home Assistant; he kept his first website
online on purpose. That last one is already a stated value on the site — it just isn't connected
to anything he says about himself.

Copy rules for the whole site: active voice; name things the way a visitor would; a CTA states
what happens ("See the projects", not "Learn more"); the same action keeps the same name
everywhere; sentence case; no filler. Empty and error states are direction, not mood — the filter
already has an empty state, and its copy is fine.

---

## 12. Non-negotiable quality floor

- **LCP < 2.5s, INP < 200ms, CLS < 0.1**; budget alerts at 80% (INP 160ms, LCP 2.0s, CLS 0.08).
  INP is the most-failed vital in 2026 — 43% of sites miss it — and it is a JavaScript-architecture
  problem. This site's near-zero-JS baseline is a large head start; protect it. Any library added
  should be justified against a measurement, not a vibe.
- A portfolio that takes more than ~2s to load gets closed. Mobile is a first-class case, not a
  fallback: people check portfolios on phones, and a frontend-adjacent candidate is judged on it.
- Visible keyboard focus everywhere (the current `:focus-visible` outline is good — keep it).
  `prefers-reduced-motion` honored. Contrast verified against the *rendered* background, glass
  included. `aria-live` on the result count (already present).
- The no-JS path must still render every project. The era link must still work without JS — it
  currently does, and the README documents the fallback chain. Don't regress that.
- Keep the classic page's third-party dependencies isolated from the modern page. `npm test`
  already asserts this; keep the test.

---

## 13. Astro implementation notes

- **Images:** move project imagery out of `public/` into the `astro:assets` pipeline for
  build-time WebP/AVIF, dimensions, and responsive `srcset`. Responsive images went stable in
  5.10. Images referenced from Markdown frontmatter need the `image()` helper in the collection
  schema — worth doing when the schema gets a `cover` field.
- **Content schema** (`src/content.config.ts`) will need to grow for any of this: `cover`,
  `video`, `role`, `period`, `outcome`, `links[]`, `tier` (work vs coursework), `capability` (the
  new filter facet). Schema validation is the cheap guardrail that stops 21 pages drifting apart
  — use it, and update `templates/project.md` and the README's "Add a project" section in the same
  pass.
- **View Transitions:** already used cross-document for the era switch. If `ClientRouter` is
  added for in-site navigation, note that `transition:name` should go on a few key elements only,
  not everything, and that bundled module scripts run once — per-page setup belongs on
  `astro:page-load`.
- **Icons:** `astro-icon`, sprite mode, no runtime JS, no CDN.
- The build already has a `prebuild` brand step (`scripts/prepare-brand.mjs`) that generates WebP
  from the gitignored `docs/F.png` / `docs/f-background.png`, with a text-mark fallback when
  they're absent. **GitHub Actions currently falls back**, so the deployed site would lose the
  logo. If the brand becomes the design system, this needs solving before deploy — commit
  optimized derivatives, or supply the source to CI.

---

## 14. Proposed direction — summary for the implementer

Ordered. Each item was built and measured in `/preview/` first.

1. **Restructure content.** All 21 projects visible (diversity is the point), in three tiers:
   4 flagship with real screenshots, ~4 core text cards, 13 coursework as compact quiet cards.
   Cap tools at 3 per card with a `+N`. Every project with a repo gets a GitHub link; the ones
   without show their status instead of an empty slot.
2. **Palette and type from the logo.** OKLCH, dark-first, cyan→violet axis, the droplet's amber as
   one scarce accent (use it for a single meaning — "running right now"). Two families only:
   Bricolage Grotesque display + Instrument Sans for body *and* accents, with `wdth`, `tnum` and
   `opsz` switched on. No third mono family. (§9)
3. **Kill the 52-option dropdown.** 5–6 icon-labelled capability chips derived from each project's
   existing `tools` frontmatter, so new projects file themselves. Multi-select, live count, clear.
   Animate the reflow with GSAP `Flip`. (§5)
4. **Fix the motion problem, which is causality not quantity.** Magnetic controls and pointer-tracked
   spotlight glass first (no library, biggest gain), then one orchestrated arrival via SplitText
   masked line reveal. Ambient drift stays CSS. (§8.4)
5. **Obey the measured performance rules.** No `filter: blur()` over animated children, no
   `backdrop-filter` over moving content, pause every decorative loop offscreen and on
   `document.hidden`, `contain: strict` on decorative layers, compositor-only properties throughout.
   These took the preview from 14.7fps to a locked 60. (§8b)
6. **Bring back experience and education**, compactly, with the institution logos already sitting in
   `public/classic/images/`, and tell the business → bank → AI → builds-and-runs-things arc. Animate
   the timeline with scroll-driven `scale`, not JS. (§6)
7. **Icons via astro-icon:** Lucide for UI, Simple Icons or Devicon for stack marks. Always labelled,
   always visible. (§7)
8. **Promote the era switch** and keep `/classic/` byte-for-byte. Extend the same View Transition
   mechanism to project cards with matching `view-transition-name`. Do not add `<ClientRouter />`.
9. **Copy stays Fabrizio's.** The preview's hero and about text are written from his repos to prove
   the *shape* — specific and concrete rather than sloganeering — but they are placeholders for his
   own words, not finished copy.

### Verified budget (do not exceed without re-measuring)

| Item | Limit |
|---|---|
| Live `backdrop-filter` surfaces on screen | 2–3 desktop, prefer 0 on mobile |
| `backdrop-filter` blur radius | ≤ 12px |
| `backdrop-filter` over animating content | never |
| `filter: blur()` on an animated subtree | never |
| Simultaneously animating composited layers | ≤ 6 |
| `will-change` in static CSS | ≤ 4 declarations |
| JS shipped for the hero | 0 bytes before paint |
| Regression threshold | any long frame, or < 60fps, while idle at the top |

Current preview measures **59.7fps / 0.4% long frames** with GSAP core + SplitText + Flip
(38.5 KB gz), magnetic controls, pointer spotlight, drifting field, glass header and scroll-driven
rail all active simultaneously.

## 15. Open questions for Fabrizio

Answered: Nest and NüMe can both be screenshotted (interior captures still needed — Nest's client-IP
allowlist in `app/security.py` blocks automated capture and was deliberately not modified); the NüMe
demo is live; all projects should be shown, not just the strong ones; the F artwork is **not** to be
used as a hero image.

Still open:
1. **Handshake AI** — real job title and dates. Currently a visible placeholder in the timeline.
2. **Slice of the Burg** — is "website and ordering consulting, 2026" the right framing for the
   experience entry?
3. **Hero and About copy** — the preview's text is a proposal written from the repos. Needs his voice.
4. Dark-first as shipped, or keep a light theme as an option?
5. Resume PDF: current, or refresh before the site points at it? (README flags it.)
6. Logo source files committed or supplied to CI, so the deployed build doesn't fall back to the
   text mark?

---

## Sources

Portfolio strategy and content
- https://www.nngroup.com/articles/ux-researcher-portfolio/
- https://www.nngroup.com/videos/ux-design-portfolio-case-study/
- https://codeboards.io/blog/developer-portfolio-guide-2026
- https://dev.to/__be2942592/how-to-build-a-developer-portfolio-that-actually-gets-you-hired-2026-6kn
- https://portfoliostudio.dev/blog/best-developer-portfolio-examples/
- https://portfoliostudio.dev/blog/portfolio-website-sections
- https://fonzi.ai/blog/engineering-case-study
- https://www.toptal.com/designers/ui/case-study-portfolio
- https://elementor.com/blog/best-web-developer-portfolio-examples/
- https://dev.to/kethmars/what-i-learned-after-reviewing-over-40-developer-portfolios-9-tips-for-a-better-portfolio-4me7
- https://www.hiration.com/blog/skill-bars-resume/
- https://thetailorcv.com/blog/portfolio-about-me-section

Filtering and homepage UX
- https://baymard.com/blog/horizontal-filtering-sorting-design
- https://www.uxmatters.com/mt/archives/2009/09/best-practices-for-designing-faceted-search-filters.php
- https://www.uxpin.com/studio/blog/filter-ui-and-ux/
- https://bricxlabs.com/blogs/universal-search-and-filters-ui
- https://www.nngroup.com/articles/homepage-design-principles/
- https://www.theedigital.com/blog/fold-still-matters

Icons
- https://www.nngroup.com/articles/icon-usability/
- https://www.nngroup.com/articles/icon-testing/
- https://dev.to/svgicons/lucide-vs-tabler-vs-phosphor-which-free-icon-set-fits-your-ui-4ocl
- https://allsvgicons.com/compare/simple-icons-vs-devicon/
- https://github.com/devicons/devicon
- https://github.com/natemoo-re/astro-icon

Motion, effects, and glass
- https://magicui.design/docs/components
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- https://www.joshwcomeau.com/animation/scroll-driven-animations/
- https://webflow.com/blog/gsap-becomes-free
- https://tympanus.net/codrops/2025/05/14/from-splittext-to-morphsvg-5-creative-demos-using-free-gsap-plugins/
- https://ics.media/en/entry/14973/
- https://www.nngroup.com/articles/glassmorphism/
- https://css-tricks.com/getting-clarity-on-apples-liquid-glass/
- https://blog.logrocket.com/ux-design/adopting-liquid-glass-examples-best-practices/
- https://axesslab.com/glassmorphism-meets-accessibility-can-frosted-glass-be-inclusive/
- https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/

Type, color, CSS, performance, Astro
- https://muz.li/blog/best-free-variable-fonts-for-ui-and-web-design-2026/
- https://www.untitledui.com/blog/best-free-fonts
- https://colorarchive.org/guides/oklch-color-space-guide/
- https://polgubau.com/blog/modern-css-2026
- https://calmops.com/web/modern-css-features/
- https://www.digitalapplied.com/blog/core-web-vitals-2026-inp-lcp-cls-optimization-guide
- https://docs.astro.build/en/guides/view-transitions/
- https://dteather.com/blogs/astro-optimized-images/
- https://www.launchfa.st/blog/gsap-astro-view-transitions
