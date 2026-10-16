# Demo polish notes

## Fixed in the polish pass (2026-10-16, not yet visually re-checked)
- EduInsight: benchmark markers on separate lanes; all rows shown.
- Hospital Data Warehouse: chart labels fixed at 13px HTML text; diagram bounds fit every box.
- Tixly: 44px seat targets in a horizontally scrolling grid.
- Slice: analysis totals wrap, ticks spaced on narrow screens, labels outside the point area.
- USF Concierge: Ask button no longer wraps on phones.

## Open
- Text Cleaning: the Oz excerpt was written from memory; replace it with the exact Project Gutenberg text (public domain) before publishing.
- USF Concierge: citation chips are 44px boxes inline in the answer text, which breaks the reading line on phones.
- Claude-built demos carry their own small header styles on their `/demo/` pages.
- Titanic: decision-tree diagram clips its right branch and node text is ~9px; synthetic data gives
  implausible held-out accuracy (NB 62.5%, tree 50%).
- Optuna: loads mid-replay (6/30 trials) so the chart starts nearly empty; chart text is tiny.
- Business Statistics: regression R² 0.996 is implausibly perfect.
  (A fix job for these three is written at ../portfolio-demos/prompts/polish2.md with worktree
  ../portfolio-demos/polish2; submission was blocked while the worker launcher awaited a reviewed release.)
