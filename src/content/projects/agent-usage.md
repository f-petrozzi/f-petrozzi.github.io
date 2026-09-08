---
title: "Agent Usage"
summary: "A Windows overlay for tracking Codex and Claude usage and reset times."
category: "Tools & experiments"
tools: ["C#", "PowerShell", "Python", "SSH", "WSL"]
order: 3
featured: false
status: "Desktop utility"
visual: "agent"
repo: "https://github.com/f-petrozzi/Agent-Usage"
---

## The idea

A small Windows overlay showing Codex and Claude usage, reset times, and banked resets.

## How it works

The overlay switches between five-hour and weekly readings, with an animated gauge and hover details. Time-left markers help compare usage against an even pace.

## A closer look

A collector runs on the agent machine and connects over SSH or local WSL. Cached Claude reads and a shared cooldown handle rate limiting; the Windows app does not open agent credentials.
