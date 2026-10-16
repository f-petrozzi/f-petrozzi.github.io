---
title: "Nest"
summary: "A household app for shared plans, groceries, recipes, and daily tracking."
category: "AI & applications"
tools: ["Python", "FastAPI", "SQLite", "Alpine.js", "Jinja2", "Docker"]
order: 2
featured: true
status: "Private application"
visual: "nest"
---

Nest started as a shared calendar and task list. Over time, I added groceries, recipes, budgeting, and daily tracking. I use it every day, and it runs on my homelab.

## Connecting the features

A task with a date appears on the calendar. Groceries connect to the pantry, and logging a cooked meal prompts an update to the ingredients on hand.

I also added receipt scanning. AI reads the photo into individual items, which can be reviewed before saving the grocery purchase.

## Building and running it

I built Nest with FastAPI and SQLite, using Jinja2 and Alpine.js for the interface. The server renders the pages and sends updates to connected devices when data changes.

The application source is separate from the deployment configuration and backups, so I can work on features independently of how they are hosted.
