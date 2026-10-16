export const featured = [
  {
    id: "orbit",
    summary: "A personal workspace for tasks, AI, research and finances.",
    image: {
      src: "/assets/shots/orbit-featured.webp",
      width: 1120,
      height: 650,
      alt: "Orbit task planner with a week strip, day cards and navigation for Chat, Library and Finances, using invented data.",
    },
    contribution:
      "I built Orbit with Python, SQLite and native web interfaces.",
    hook: "It runs on my homelab, so I can pick up the same work from my phone, laptop or PC.",
    how: [
      "Task capture keeps planned dates, deadlines and reminders separate.",
      "Chat connects to native Codex and Claude Code sessions, with app previews beside the conversation.",
      "Library keeps versioned sources and cited notes; Finances brings accounts, spending and savings into focused views.",
    ],
  },
  {
    id: "homelab",
    summary: "A personal cloud for projects, AI tools and everyday services.",
    image: {
      src: "/assets/shots/homelab-featured.webp",
      width: 1120,
      height: 630,
      alt: "Homelab monitoring dashboard with service checks, resource usage and network charts.",
    },
    contribution: "I started my homelab and added services.",
    hook: "It also hosts Nest, the Agent Usage collector, and NüMe’s API and database on their own Docker network.",
    how: [
      "Development tools and repositories run alongside containerized applications.",
      "AdGuard Home handles DNS filtering; trusted and IoT devices have separate access rules.",
      "Prometheus collects host and container metrics; Grafana brings them together in dashboards and alerts.",
    ],
  },
  {
    id: "nume",
    summary: "Wellness recommendations from wearable data and check-ins.",
    image: {
      src: "/assets/shots/nume-featured.webp",
      width: 1120,
      height: 630,
      alt: "NüMe dashboard showing a daily support plan, recovery signals and risk drivers with sample data.",
    },
    contribution: "I developed the frontend and backend.",
    hook: "Each recommendation is stored with its reasons, alternatives, and the profile used.",
    how: [
      "Garmin data and manual check-ins form a profile for each run.",
      "Scoring rules rank recipe, activity, and wellness options from that profile.",
      "The original app records accept/skip responses but does not use them to learn from outcomes.",
    ],
  },
  {
    id: "proterra",
    summary: "Weekly agricultural briefs, from research to publication.",
    image: {
      src: "/assets/shots/proterra-featured.webp",
      width: 1120,
      height: 630,
      alt: "Proterra Intelligence archive showing published weekly briefs and sector filters.",
    },
    contribution: "I built Proterra and run Codex to draft the briefs.",
    hook: "Approval applies to the exact version reviewers read.",
    how: [
      "A scheduled job collects material from approved publications.",
      "Claims link back to source material, and each draft gets a preview for review.",
      "After validation and approval, the website updates and the brief goes out by email.",
    ],
  },
  {
    id: "nest",
    summary: "Shared plans, groceries and recipes in one household app.",
    image: {
      src: "/assets/shots/nest-featured.webp",
      width: 1120,
      height: 630,
      alt: "Nest home dashboard with tasks, dinner plans and a synced household phone, using sample data.",
    },
    contribution: "I built Nest with FastAPI and SQLite.",
    hook: "AI reads receipt photos into individual items for review before saving a grocery purchase.",
    how: [
      "A task with a date appears on the calendar.",
      "Groceries connect to the pantry, and logging a cooked meal prompts an update to the ingredients on hand.",
      "The server renders the pages and sends updates to connected devices when data changes.",
    ],
  },
] as const;
