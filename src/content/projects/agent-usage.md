---
title: "Agent Usage"
summary: "A Windows overlay for checking Codex and Claude usage limits and reset times."
category: "Tools & experiments"
tools: ["C#", "PowerShell", "Python", "SSH", "WSL"]
order: 3
featured: false
status: "Desktop utility"
visual: "agent"
repo: "https://github.com/f-petrozzi/Agent-Usage"
---

I run AI agents on my Linux server and work from Windows. I built Agent Usage so I could check the remaining allowance and reset times from my desktop.

## Reading the limits

The overlay switches between five-hour and weekly limits. Each bar has a marker for the time remaining in that period, so I can compare how much allowance is left with how long it needs to last.

## Getting the readings

A collector runs on the machine where the agents are signed in. The Windows app reads from it through SSH, or through WSL when both run on the same computer. The app does not need its own copy of the agents’ credentials.

Claude requests are cached, and a rate-limit response pauses further requests until the cooldown ends.
