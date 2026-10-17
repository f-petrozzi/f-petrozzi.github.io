---
title: "Proterra Intelligence"
summary: "Research, review and publication for weekly agricultural briefs."
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

I built Proterra for weekly dairy, meat and bovine genetics briefs. It connects source collection, drafting, review and publication.

A scheduled job collects approved publications. I run Codex to draft from those sources. Claims link to source material. Each draft has a review preview.

Reviewers comment on passages and request changes. Approval covers the exact version reviewed. After validation and approval, the brief publishes to the website and email.

A separate service stores comments and approvals so previews cannot change their own approval state.

A dashboard charts historical FAO and USDA data. Scheduled updates open pull requests for review before publication.
