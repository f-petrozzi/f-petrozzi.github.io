---
title: "NüMe"
summary: "A wellness app suggesting meals and activities from wearable data and check-ins."
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
featured: false
status: "Product demo"
visual: "nume"
demo: "https://nume-demo.com"
repo: "https://github.com/f-petrozzi/NuMe"
---

I built NüMe’s frontend and backend to turn sleep, activity and check-ins into a wellness plan. The dashboard pairs suggested meals, activities and wellness actions with their selection context.

Garmin data and manual check-ins form a profile. Scoring rules rank recipe, activity and wellness options. Users can accept or skip suggestions. The app records responses without learning from outcomes.

Google ADK coordinates agents and specialist services. Each recommendation stores its reasons, alternatives and profile. A trace shows how the plan was produced.

Built with React, TypeScript, FastAPI and PostgreSQL.

## Where it started

NüMe grew from CareMesh, our HackUSF 2026 team prototype for wellness support with wearable data and AI agents. I built its FastAPI backend, database models and migrations, Garmin integration and recipe parsing. Other team members built the frontend, agent orchestration and specialist services.

The [CareMesh repository](https://github.com/f-petrozzi/HackUSF26) preserves the prototype.
