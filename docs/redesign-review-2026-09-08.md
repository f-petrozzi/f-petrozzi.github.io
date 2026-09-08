> Integration update: the approved design now lives at `/` in `src/pages/index.astro`, `src/styles/home.css`, and `src/scripts/home.ts`. The separate `/preview/` route is retired. References below describe historical review builds. Browser interaction checks now live in `tests/home-interactions.mjs`.

# Portfolio direction review — 2026-09-08

## Revision 4 follow-up

The latest preview addresses the user's review of revision 3:

- Removed the project dialog's fullscreen backdrop blur. A 1.2-second headless Chromium
  opening probe at 1440×1000 recorded 7 frames over 25ms (worst 83ms) with the old blur,
  versus 0 (worst 17ms) with it disabled. The completed revision 4 also recorded 0 / 17ms
  under the same probe. These are local comparisons, not real-device guarantees.
- Replaced the rigid expanding pill with a blue/cyan/violet droplet and a warm highlight
  referencing the actual F logo. A damped spring responds to scroll velocity, direction
  changes, sideways drag and release. It deforms the small decorative layer only; native
  scroll position remains direct. The spring stops at rest and respects reduced motion.
- Removed diagonal arrows; restored local SVG icons on navigation, filters and actions.
- Replaced the complete index's rows with compact thumbnail cards. Fourteen optimized
  thumbnails reuse existing project artwork; seven icon tiles await project imagery.
- Added a chronological Experience/Education toggle with a moving selection indicator,
  animated panel height and entry transition, keyboard tab controls and a no-JS view of both.
- Added Slice of the Burg, Handshake AI and USF Audio Visual Technician using the newer
  `shared/IT-BA-Enterprise/Resume.md` (September 2), checked against
  `shared/RJ-AI-Enablement/AI_FA_Resume.md` (August 26). The five experience entries and
  both education entries use those sources. The downloadable PDF was not regenerated.
- Shifted the overall palette toward navy, blue, cyan and violet while keeping reading
  surfaces solid. The light sweep remains removed.

Validation: build/link tests and the expanded preview browser test pass. Tested opening,
return navigation, scroll/focus restoration, drag bounds, keyboard, spring settling,
filtering, rapid timeline toggles, responsive widths, reduced motion and no JavaScript.
Safari and real-device validation are still outstanding.

## Revision 3 implementation (previous iteration)

Revision 3 was served at `http://petro.ink:4444/preview/`. The user requested this
implementation after the review. It introduces Instrument Sans throughout, factual opening
copy, a prominent real Homelab dashboard capture, one complete Homelab detail dialog with a
shared-image transition and history/focus/scroll restoration, and a compact searchable index
of every project. Other project links still open their existing pages. Newer experience entries
whose title/dates need confirmation have not been carried into this trial.

The user's requested droplet now expands into a draggable glass scrollbar on hover, keyboard
focus or drag. It supports touch and scrollbar keyboard controls. The native page scrollbar
is hidden only after this control initializes; normal wheel, touch and keyboard scrolling remain.
Without JavaScript, the native scrollbar and ordinary project links remain available. Reduced
motion disables transitions, and forced-colors mode restores the native scrollbar.

The light sweep, magnetic controls, ambient blobs, hero statistics and text-splitting entrance
are removed. The classic era and main homepage source are untouched. Glass here is a CSS
material approximation, not optical refraction.

Implementation: `src/pages/preview/index.astro`, `src/styles/preview.css`, `src/scripts/preview.ts`.
Checks: `npm run build`, `npm test`, and `node tests/preview-interactions.mjs`.
Browser validation covers Chromium desktop/mobile layouts, drag limits, wheel and keyboard,
dialog navigation/restoration, filtering, reduced motion, and the no-JavaScript fallback.
Real-device Safari validation remains outside this pass.

---

Research and recommendations, not an implemented redesign. Reviewed the existing research,
Astro source, project content, and rendered HTTP preview at desktop 1440×1000 and mobile 390×844.
The mobile page measured 8,349px tall. No new cross-browser or hardware performance benchmark
was performed. Earlier benchmark figures remain historical observations, not independently
reproduced guarantees.

## Recommendation

Keep Astro and GSAP. Rework the composition, writing and interaction sequence before adding
effects. The current implementation animates a long introduction and a project catalogue;
the stronger experience would introduce Fabrizio clearly and let visitors explore actual work.

Preserve recorded preferences: the user dislikes the light sweep; remove it in the next design.
Every project remains visible, the F artwork is not a hero
image, and the classic site and era transition remain intact. All projects can be visible
without all projects occupying a card: selected work followed by a complete compact index.

## Keep from the earlier research

- Actual interface captures and short demonstrations.
- Clear distinction between substantial projects and earlier work.
- Experience and education, with verified titles and dates.
- Case studies explaining a real decision and its consequences.
- Local fonts, consistent icons, normal navigation and reduced-motion support.
- The classic-site transition as an existing distinctive interaction.

## Composition and writing

The hero's large paragraph, statistics and repeated classic links postpone the work. On the
tested mobile viewport, no project is visible in the initial screen. Fabrizio's name is
visually relegated to the footer; the header mark has an accessible name, but that does not
introduce him to a sighted visitor.

Suggested composition: prominent name, two short factual sentences, Work/Resume links, then
a substantial project image starting near the first fold. Use three or four individually
composed project features, compact background information, and a complete project index.
Nest, NüMe and Proterra offer different forms of evidence; Homelab is a supporting system
story unless infrastructure becomes the primary professional focus. This ordering is a
recommendation, not an inferred career preference.

Candidate introduction, pending factual and voice review:

> Fabrizio Petrozzi
>
> I studied business and AI at USF. My projects include a household app, a wellness app,
> and a research publication.

This is a factual baseline, not a final tagline. A target role can sharpen it later.
Do not invent motives to make it sound personal. The preview's grocery origin story,
11pm anecdote and explanation of returning to university need the user's confirmation;
repository features do not establish personal history.

Suggested straightforward project descriptions:

- Nest: A household app for meals, groceries, calendars and pet care.
- NüMe: A wellness app that brings sleep, activity and check-ins into one place.
- Proterra Intelligence: A research publication covering dairy, meat and bovine genetics.

Explain AI routing or publication review in the project detail, where there is room to show
how it works. Remove the homepage's instructions about which library a project imports.
Use “Selected work”, “All projects”, “Experience” and “Contact” without explanatory slogans.

Remove the hero statistics strip. Hardcoded “current uptime” and “Running right now” indicators
are not live telemetry, and project count is not persuasive evidence by itself. Keep GPA
with education. Replace sign-in screenshots with interior captures using safe demo data;
do not weaken application access controls to obtain them. Move the Safari bug explanation
into Nest's case study, beside the interaction it explains.

## Typography and surfaces

My first choice is to try Instrument Sans throughout, using the existing asset. Bricolage's
compact, expressive forms dominate this particular headline and push the page toward the
friendly startup aesthetic the user dislikes. Instrument Sans at natural width, with more
deliberate sizes and spacing, is a useful first comparison before introducing another font.

Two alternatives worth a same-content comparison: [Switzer](https://www.fontshare.com/fonts/switzer)
for a neutral sans direction, or [PP Neue Montreal](https://pangrampangram.com/products/neue-montreal)
for a commercial alternative. These are aesthetic recommendations, not research findings
that either font converts better. Review licensing before adopting a new asset.

Start around 16–18px body text and 13–14px metadata. The current approximately 11px condensed,
tracked uppercase labels are difficult to read; uppercase is not a substitute for sufficient
size. Retain dark mode but compare a more neutral charcoal, warmer text and fewer blue borders.
Let the screenshots supply most of the color. No additional ornamental font is necessary.

## Motion: change its job

GSAP is capable of the required choreography. [Flip](https://gsap.com/docs/v3/Plugins/Flip/)
supports substantial state/layout transitions, and [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
can coordinate scroll sequences when needed. Neither forces magnetic buttons or staggered text.
The preview already imports GSAP, SplitText and Flip. A replacement engine would not change
its art direction.

Proposed motion sequence; durations are starting values to test:

| Moment | Proposed behavior | Purpose |
| --- | --- | --- |
| Arrival | Name and introduction immediately readable; project image settles once, 350–500ms | Establish focus without delaying reading |
| Explore | A project offers a short recorded interaction, with explicit play on touch/keyboard | Show what the software does |
| Open project | Carry the same screenshot into its larger detail presentation, 300–450ms | Preserve visual continuity |
| Return | Restore scroll position, filters and focus to the original project | Make exploration comfortable |
| Filter complete index | Quick 180–250ms movement/fade; interrupt cleanly on repeated input | Explain the changed results |
| Switch eras | Preserve the existing circular transition | Retain a distinctive existing moment |

For ordinary page navigation, evaluate native cross-document View Transitions with a normal
navigation fallback. Use Flip for changes within a document; it does not alone carry state
across full page loads. A richer same-page expansion is possible but requires URL/history,
focus and return-state design, not just a tween.

If more theatrical browsing is desired, prototype ONE project feature with a sticky image
and two or three short explanatory steps: each step changes the depicted app state. Keep
native scrolling and make mobile a normal vertical sequence. Do not turn every project into
a pinned scene or require scrolling through a presentation to reach contact information.

Remove magnetic movement from navigation, filters and ordinary buttons. Avoid card-wide
spotlights, repeated sheen sweeps and continuous background drift as default treatments.
Motion can be expressive, but a real app interaction is more characteristic than a generic
hover flourish. Reduced motion should retain the same information and navigation.

## Liquid glass

[Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)
places Liquid Glass in a functional layer for navigation and controls, above content, and
advises against using it throughout the content layer. For this portfolio, try a small
navigation/era control with restrained translucency, edge light and press feedback. Keep
project reading surfaces solid. A flat dark backdrop gives glass little visible depth;
increasing blur alone does not solve that.

Ordinary CSS blur and highlights approximate frosted glass, not physical refraction.
SVG displacement through backdrop-filter has documented Safari/Firefox compatibility
limitations ([MDN compatibility issue](https://github.com/mdn/browser-compat-data/issues/24110)).
Treat true refraction as an optional experiment requiring current browser tests. Do not
assume ordinary backdrop-filter support establishes SVG-filter support. A custom WebGL
scene is a different rendering architecture, not a drop-in refractor for arbitrary DOM.

## Corrections and implementation findings

- The earlier document's claim that Motion has no SplitText/Flip equivalent is too broad.
  Motion+ provides [splitText](https://motion.dev/docs/split-text) and an early-access,
  alpha [vanilla layout animation API](https://motion.dev/docs/layout-animations).
  These are not identical replacements, and do not justify a migration here.
- “95% of the perceived effect for 1% of the cost” is not an established measurement.
  Likewise, software-rendered rAF timing does not guarantee real-device frame presentation.
  Profile representative devices and interactions; avoid universal zero-long-frame promises.
- The spotlight registers `<length>` properties with `initial-value: 50%`, an incompatible
  value. In the tested browser, a value set on the card reaches its pseudo-element through
  inheritance, contrary to the claimed non-inheriting optimization. Simply changing the
  initial value would require revisiting how coordinates reach the pseudo-element.
  See [@property validity rules](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@property).
- Hero font variation settings are declared twice; the computed result is only `"wdth" 94`.
- The scroll-rail keyframes contain a stray `to { top: 92vh }` fragment.
- Search indexes only the first three tools although the document promises all tools remain
  searchable. Cap the displayed tools, not the search source.
- Automatically deriving capabilities mislabels projects: the category rule assigns Nest
  to AI, while Pydantic/JSON alone are not evidence of AI/data work. Author capabilities explicitly.
- The two visibility callbacks can override one another; calculate animation state from both
  viewport visibility and document visibility together.
- The doc's ban on all moving content beneath glass is too absolute and conflicts with a
  sticky glass header during scroll. Minimize affected area and test the actual composition.

## Next implementation slice

Build one revised opening and one complete project exploration flow in a separate preview.
Use real interior imagery, the same factual copy and two type treatments for comparison.
Evaluate the result on desktop and phone, including opening, returning, keyboard access,
reduced motion and interrupted transitions. Once that works, extend the design to the remaining
projects and complete index. Do not spend another pass decorating all 21 cards first.
