---
title: "CareMesh"
summary: "A hackathon prototype that uses wearable data and AI agents to create wellness support plans."
category: "AI & applications"
tools:
  [
    "Python",
    "FastAPI",
    "PostgreSQL",
    "Google ADK",
    "React",
    "Pydantic",
    "Docker",
  ]
order: 7
featured: false
status: "HackUSF 2026 team project"
visual: "code"
repo: "https://github.com/f-petrozzi/HackUSF26"
---

At HackUSF 2026, I worked on the backend for CareMesh. Our team combined sleep, activity, and mood information with specialist AI agents to suggest support for students and caregivers.

## My contribution

I built the FastAPI backend, database models and migrations, Garmin integration, and recipe parsing. Other team members worked on the frontend, agent orchestration, and specialist services.

The recipe parser uses Gemini to extract a recipe from a URL or pasted text. Shared Pydantic models define the data the backend and agents exchange.

## How the agents connect

Google ADK coordinates the agents and routes requests to the relevant specialist. The system checks the resulting plan and records the steps of each run so they can be reviewed.
