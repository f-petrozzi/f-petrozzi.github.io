---
title: "NüMe"
summary: "A wellness app with meal and activity suggestions based on wearable data and check-ins."
category: "AI & applications"
tools:
  [
    "React",
    "TypeScript",
    "FastAPI",
    "PostgreSQL",
    "Google ADK",
    "Clerk",
    "Docker",
    "Cloudflare",
  ]
order: 0
featured: true
status: "Product demo"
visual: "nume"
demo: "https://nume-demo.com"
repo: "https://github.com/f-petrozzi/NuMe"
---

I developed NüMe’s frontend and backend to bring sleep, activity, and check-in data into a wellness plan. The dashboard shows suggested meals, activities, and wellness actions alongside the information used to choose them.

## Choosing recommendations

The backend combines Garmin data and manual check-ins into a profile for each run. Scoring rules use that profile to rank options from recipe, activity, and wellness catalogs.

Users can accept or skip a recommendation. The original app records those responses but does not use them to learn from outcomes.

## Following the reasoning

Google ADK coordinates the agents and specialist services. Each recommendation is stored with its selection reasons, alternatives, and the profile used for that run. A trace view lets me follow the steps that produced the plan.

The frontend uses React and TypeScript, with FastAPI and PostgreSQL behind it.

## Where it started

NüMe grew out of CareMesh, our HackUSF 2026 team prototype for wellness support using wearable data and AI agents. I built its FastAPI backend, database models and migrations, Garmin integration, and recipe parsing. Other team members built the frontend, agent orchestration, and specialist services.

The [CareMesh repository](https://github.com/f-petrozzi/HackUSF26) preserves the hackathon prototype.
