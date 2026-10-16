---
title: "USF Campus Concierge"
summary: "An AI assistant for admissions questions, email drafts, and meeting scheduling."
category: "Earlier work"
tools: ["Python", "Streamlit", "Supabase", "pgvector", "MCP", "Splunk"]
order: 20
featured: false
status: "Group project"
visual: "code"
repo: "https://github.com/f-petrozzi/USFConcierge"
---

Our text analytics group built USF Campus Concierge for admissions and orientation questions. The assistant retrieves relevant university information and cites the passages used in its answers.

## My contribution

I worked on the retrieval pipeline, Azure model integration, email and meeting assistants, Google API integrations, and data ingestion. I also added structured logging and Splunk dashboards to measure where requests spent time.

## From questions to actions

The interface uses Streamlit, with documents stored in Supabase and searched through pgvector. MCP tools connect the assistant to Gmail and Google Calendar for email drafts and meetings.

We presented the system to USF faculty and revised it based on their feedback.
