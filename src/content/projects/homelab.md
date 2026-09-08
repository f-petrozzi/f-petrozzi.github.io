---
title: "Homelab"
summary: "My self-hosted applications, home automation, and monitoring setup."
category: "Data & systems"
tools:
  [
    "Linux",
    "Docker Compose",
    "Tailscale",
    "Cloudflare Tunnel",
    "Prometheus",
    "Grafana",
    "Home Assistant",
  ]
order: 5
featured: false
status: "Infrastructure"
visual: "lab"
---

## The idea

A self-hosted environment supporting applications, household services, monitoring, and a Minecraft server.

## How it works

Docker Compose organizes services. Prometheus and Grafana provide monitoring, while Tailscale and selected Cloudflare Tunnel routes support access.

## A closer look

Application repositories remain separate from deployment configuration. The operational priorities are stable services, maintainable configuration, backups, and practical rollback.
