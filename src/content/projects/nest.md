---
title: "Nest"
summary: "A household app for shared plans, groceries, recipes and daily tracking."
category: "AI & applications"
tools: ["Python", "FastAPI", "SQLite", "Alpine.js", "Jinja2", "Docker"]
order: 2
featured: true
status: "Private application"
visual: "nest"
---

I built Nest for shared calendars and tasks, then added groceries, recipes, budgeting and daily tracking. I use it daily on my homelab.

Dated tasks appear on the calendar. Groceries connect to the pantry. Logging a cooked meal prompts an ingredient update. AI reads receipt photos into items for review before saving a purchase.

FastAPI and SQLite power the app. Jinja2 and Alpine.js provide the interface. The server renders pages and sends changes to connected devices.

Source, deployment configuration and backups stay separate so I can develop features independently of hosting.
