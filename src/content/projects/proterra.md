---
title: "Proterra Intelligence"
summary: "A system for researching, reviewing, and publishing weekly agricultural briefs."
category: "Data & systems"
tools:
  [
    "Astro",
    "TypeScript",
    "GitHub Actions",
    "Cloudflare Workers",
    "D1",
    "React Email",
    "Observable Plot",
  ]
order: 1
featured: true
status: "Internal project"
visual: "proterra"
repo: "https://github.com/f-petrozzi/proterra-intelligence"
---

I built Proterra to produce a weekly brief on dairy, meat, and bovine genetics. It brings source collection, drafting, review, and publication into one workflow.

## Preparing a brief

A scheduled job collects material from approved publications. I then run Codex to draft the brief from those sources. Claims link back to the source material, and each draft gets a preview for review.

## Reviewing and publishing

Reviewers can comment on individual parts of the draft and request changes. Approval applies to the exact version they read. Once it passes validation and is approved, the website updates and the brief goes out by email.

I keep review comments and approvals in a separate service, so draft previews cannot change their own approval state.

## Tracking market data

A separate dashboard charts historical data from FAO and USDA releases. Scheduled updates create a pull request so the new data can be checked before it appears on the site.
