---
title: "USF Campus Concierge"
summary: "An AI assistant for admissions, email drafts and meetings."
category: "Earlier work"
tools: ["Python", "Streamlit", "Supabase", "pgvector", "MCP", "Splunk"]
order: 20
featured: false
status: "Group project"
visual: "code"
repo: "https://github.com/f-petrozzi/USFConcierge"
---

Our text analytics group built USF Campus Concierge for admissions and orientation questions. It retrieves university information and cites supporting passages.

I worked on retrieval, Azure model integration, email and meeting assistants, Google APIs and data ingestion. I added structured logging and Splunk dashboards to measure request timing.

Streamlit provides the interface. Supabase stores documents. pgvector searches them. MCP tools connect Gmail drafts and Google Calendar meetings.

We presented it to USF faculty and revised it from their feedback.
