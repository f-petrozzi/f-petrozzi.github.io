export const featured = [
  {
    id: "orbit",
    summary: "Tasks, AI, research and finances.",
    image: {
      src: "/assets/shots/orbit-featured.webp",
      width: 1120,
      height: 630,
      alt: "Orbit Overview with today's tasks, agent activity, a research notebook and monthly finances, using invented data.",
    },
    contribution: "Built with Python and SQLite.",
    hook: "Hosted on my homelab. Available across devices.",
    how: [
      "Separate plans, deadlines and reminders.",
      "Codex and Claude Code with live app previews.",
      "Cited research notes and personal finances.",
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
