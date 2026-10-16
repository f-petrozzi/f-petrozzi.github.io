# NüMe sample review (2026-10-16)

Reviewed `NumeDemo.astro`, `nume-sample.ts`, `nume-agent.ts`, `/projects/nume/` and `/projects/nume/demo/`
at 1440px and 390px. Nothing below has been changed yet. Pick the IDs you want.

## Ranked findings

| ID | Issue | Why it matters | Suggested change |
| -- | ----- | -------------- | ---------------- |
| N1 | The agent trace explains the demo's own mechanics ("Matched the meal route using a fixed keyword table", "Applied the local rule") instead of NüMe's. | The trace is NüMe's most distinctive feature (ADK coordinator, parallel agents, A2A specialist, validation loop, all visible in the real Traces screenshot). The sample makes it read as a keyword lookup. | Replay a recorded sample run shaped like the real trace: Coordinator → parallel Signal / Risk / Intervention agents → remote specialist (A2A) → validation loop (2 iterations) → plan. Keep one note that it is a replay. |
| N2 | Two sliders feed one binary rule (`sleep < 6 OR stress > 60`), so most slider movement changes nothing and there are only two possible plans. | The real app *ranks* catalog options from a profile. A switch that flips at one threshold looks fake. | Score 4–6 candidates per category from the profile and show the ranking with each option's reasons; the top option becomes the plan. Changes stay continuous. |
| N3 | Alternatives and the third category are missing. | The card copy says each recommendation is stored "with its reasons, alternatives, and the profile used", across recipe, activity **and wellness** options. The sample shows one meal and one activity, with no alternatives and no wellness option. | Add a wellness card; give each card a "2 alternatives" disclosure and a small "profile used" line. |
| N4 | Accept only, no Skip; accepting is wiped whenever a slider moves (`update()` resets every `aria-pressed`). | The real app records accept/skip. Losing a choice on a slider nudge feels broken. | Accept / Skip pair; keep responses per recommendation ID; show a short response log ("recorded, not used for learning", which matches the copy). |
| N5 | Four separate disclaimers: page header, toolbar ("Interactive sample / no data saved"), "Simple local rules" tag, footer note. Plus helper lines ("Adjust the sample inputs to see an illustrative response.", "A small plan for the day, with its context in view."). | You strip helper copy elsewhere; this reads defensive. | Keep the page-header line and one footer note. Drop the toolbar text, the tag and the helper sentences. |
| N6 | The plan, which is the product's output, starts ~1,200px down at 1440px. Inputs, a message banner, three metric cards and the chat all come first. The metric cards repeat the slider values. | Visitors scroll past controls before seeing what NüMe produces. | Order: greeting → plan cards → compact "Day inputs" strip (sliders + presets inline) → Ask NüMe. Remove the duplicate Sleep/Stress cards or make Steps/HR the only metrics. |
| N7 | Health tab legend "Deep sleep / Light sleep / REM" has no stage data behind it. Each night is one bar. Heart rate is static. | Looks like a rendering bug. | Stacked stage bars per night (synthetic), or drop the legend. |
| N8 | "Calming Chamomile Oat Bowl" is the pick for the *rested / low-stress* case. | Semantically backwards (calming is for high stress). | Swap: the calming option belongs to high stress; the rested pick should be the more involved meal (e.g. salmon). |
| N9 | Duplicate surfaces: the full sample is embedded on `/projects/nume/` **and** lives at `/projects/nume/demo/`, which nothing links to. The project page's "Visit demo" goes to nume-demo.com, a different thing with the same word. | Confusing routes and labels. | Decide one: embed on the project page *or* a "Try the sample" link to `/demo/`. Rename the external link to "Live app" if nume-demo.com is still up (I could not check it from the sandbox). |
| N10 | In dark mode the sample is a bright white app panel inside the dark site. | Faithful to NüMe's real light UI, but it is the brightest thing on the page. | Judgment call: keep for fidelity, or add a dark variant using NüMe's palette. |
| N11 | Mobile: the sidebar becomes a 2×2 button grid (~110px tall) above the toolbar, and the toolbar text wraps to two lines. | Uses a lot of first-screen space at 390px. | One horizontal scroll row of tabs, toolbar text removed (see N5). |
| N12 | View switcher buttons use `aria-current="page"`. | It's an in-page view switch, not navigation. | `role="tablist"`/`tab` with `aria-selected`, or `aria-pressed`. |

## Smaller notes

- The chat holds only the last question. Fine for a sample.
- The play-trace timer stops on view change and `pagehide`, which is good. No idle loops.
- `nume-agent.test.mjs` covers determinism; keep it in step if N1/N2 change the logic.

## Lessons applied to the other demos

These went into `docs/demo-conventions.md` for later workers: one disclaimer only; simulated
internals replay the real system's stages rather than describing the demo's own mechanics; continuous
inputs produce continuous changes; show reasons and alternatives where the real system stores them.
