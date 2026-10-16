---
title: "Orbit"
summary: "My personal workspace for tasks, AI conversations, project work, research, and connected finances."
category: "AI & applications"
tools:
  [
    "Python",
    "SQLite",
    "JavaScript",
    "HTML",
    "CSS",
    "Codex",
    "Claude Code",
    "Plaid",
    "Firecrawl",
    "Docker",
    "Tailscale",
  ]
order: 0
featured: false
status: "Private application"
visual: "code"
---

Orbit is where I manage tasks, work with AI agents, keep research, and follow my finances. It runs on my homelab, so I can pick up the same work from my phone, laptop, or PC.

It also records how my design thinking has changed. I kept refining the interface around what I actually do: capture something quickly, keep the relevant context nearby, and open more detail when I need it. The sections share pale glass surfaces and quiet controls, but each has its own layout.

## From a task to a working app

Tasks centers on a week strip and day cards with compact task pills. Capture saves the thought first; AI can then interpret explicit dates and suggest details. Planned dates, deadlines, and reminders stay separate.

Chat connects to native Codex and Claude Code sessions on the homelab. Project conversations share selected sources, instructions, and editable memory. I can paste an image, inspect a file, or put a running app preview beside the conversation. Split panes let me keep several conversations open while the work continues independently of the screen I am using.

## Keeping the evidence nearby

Library takes a source-first approach similar to NotebookLM: a notebook holds versioned documents, a chat grounded in selected sources, and Studio notes. Citations lead back to the source, and saved notes retain their references. Projects reuse those notebooks without replacing the Library workflow.

## Following my finances

Finances brings connected bank accounts, imported transactions, spending, bills, and savings goals into focused views. A protected connector keeps bank access separate from the web application. Imported activity and planning remain separate, and missing readings stay visible.

The wishlist captures product links, including Amazon items, with prices, observations over time, and optional savings-goal links. Product extraction uses Firecrawl with a direct-reading fallback. A wishlist item never changes a balance or records a purchase as a transaction.

## Building a workspace I can keep changing

I built the application with Python's standard library, SQLite, and native HTML, CSS, and JavaScript. Docker runs the web service, Tailscale provides private access, and separate native runtimes handle agent conversations. Keeping the interface close to the browser lets me refine the details without adding a frontend framework.
