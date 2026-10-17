---
title: "Agent Usage"
summary: "A Windows overlay for Codex and Claude limits and reset times."
category: "Tools & experiments"
tools: ["C#", "PowerShell", "Python", "SSH", "WSL"]
order: 3
featured: false
status: "Desktop utility"
visual: "agent"
repo: "https://github.com/f-petrozzi/Agent-Usage"
---

I run AI agents on Linux and work from Windows. I built Agent Usage to check their remaining allowance and reset times from my desktop.

The overlay shows five-hour and weekly limits. Time markers show how long the remaining allowance must last.

A collector runs where the agents are signed in. The app reads it through SSH or WSL without copying their credentials. Claude requests are cached. Rate limits pause requests until the cooldown ends.
