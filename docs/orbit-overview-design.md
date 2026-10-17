# Orbit overview

A selective start screen in Orbit's existing pale glass language. All replica
records are invented. Overview is the first navigation item and default view.

## Layout and components

The title and date sit beside Open Chat. Today and Agent activity share two
columns. Latest notebook and Money sit beneath without extra cards. Content stops
at 1040px and becomes one column below 1000px. One internal scroll region bounds
its height on phones.

- Today shows three unfinished tasks, earlier plans first. Completion updates
  Tasks. Add task opens shared capture aimed at today. All tasks opens the plan.
- Agent activity shows named workers and their statuses. Each opens the Orbit
  orchestrator conversation, where dispatches and returned results remain visible.
- Latest notebook opens the retained Library reader.
- Money repeats Finance's monthly Spent, Income and Net income. One unpurchased
  wishlist item follows. Both open their corresponding Finance views.

## Tokens

Use Orbit's ink `#29313a`, muted `#5f6a74`, sage `#4e766e`, blue `#577994`,
background `#e9edf0`, white glass at 48% opacity and fine white rims. The replica
fixes these on `.demo-orbit-app`, independent of the portfolio theme.

Spacing follows 4, 8, 16, 24 and 32px. Panels use 20px corners and 24px horizontal
padding, with 24px column and 32px row gaps. Instrument Sans preserves the
portfolio typography. Titles are 34px, 30px on phones. Section headings are 17px,
task rows 14px, 15px on phones, and metadata 12px. Touch targets start at 44px.
Use thin slate scrollbars and existing transform/opacity navigation motion.

## States

Completed tasks leave the summary and reveal the next task. Empty reads Nothing
needs attention. Workers progress through Queued, Working and Completed. Run
delegation shows the plan, dispatches and results in the orchestrator thread.
Leaving Chat or hiding the replica pauses replay. Reduced motion completes it
immediately. Purchasing a wish reveals the next item without changing money.

For a live port, retain regions while loading. Failed reads show Unavailable and
Retry. Missing money stays missing. Empty agents show No active work. Empty
Library offers its existing create action. Omit an empty wishlist row. Only
keyboard-focused buttons and links get a subtle ring. Text fields have no frame.

## Mapping to the real app

Replace `home()` in `preview/app.js`. Reuse the shared shell and existing actions.

| Region   | Existing source and mapping                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today    | `/api/tasks` and `preview/tasks.js`. Filter by `completed_at` and `data.plan_on` in the local day. Keep deadlines and reminders separate.                                    |
| Agents   | Working snapshots and `OrbitChatWorkspace` orchestrator updates in `preview/codex.js`. Key by native session ID/account and retain the parent relationship.                  |
| Notebook | `OrbitLibrary.snapshot()` in `preview/library.js`. Choose the latest updated notebook and open its ID.                                                                       |
| Money    | Existing `OrbitFinance` snapshot and posted-activity calculation for the selected month. Preserve freshness/errors. Wishlist uses observed prices; goal links never fund it. |

Chat replaces usage tiles with one small ring in the account picker trigger.
The picker contains each account's 5 hour and weekly usage. Account browsing
preserves mounted conversations, their providers and drafts.
