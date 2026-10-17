export const featured = [
  {
    id: "orbit",
    summary: "Tasks, AI, research and finances.",
    image: {
      src: "/assets/shots/orbit-featured.webp",
      width: 1120,
      height: 630,
      alt: "Orbit tasks, agents, research and finances with invented data.",
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
    summary: "My cloud for projects, AI tools and daily services.",
    image: {
      src: "/assets/shots/homelab-featured.webp",
      width: 1120,
      height: 630,
      alt: "Homelab service health, resources and network charts.",
    },
    contribution: "I built and expanded my homelab.",
    hook: "Hosts Nest, the Agent Usage collector and NüMe. NüMe’s API and database share a Docker network.",
    how: [
      "Development tools, repositories and containerized apps share one host.",
      "AdGuard Home filters DNS. Trusted and IoT devices have separate access rules.",
      "Prometheus collects host and container metrics. Grafana provides dashboards and alerts.",
    ],
  },
  {
    id: "proterra",
    summary: "Weekly agricultural briefs from research to publication.",
    image: {
      src: "/assets/shots/proterra-featured.webp",
      width: 1120,
      height: 630,
      alt: "Proterra weekly brief archive and sector filters.",
    },
    contribution: "I built Proterra and draft with Codex.",
    hook: "Approval covers the version reviewed.",
    how: [
      "Scheduled collection from approved publications.",
      "Cited claims and draft previews for review.",
      "Validation and approval publish to the website and email.",
    ],
  },
  {
    id: "nest",
    summary: "Shared household plans, groceries and recipes.",
    image: {
      src: "/assets/shots/nest-featured.webp",
      width: 1120,
      height: 630,
      alt: "Nest tasks, meals and a synced phone with sample data.",
    },
    contribution: "I built Nest with FastAPI and SQLite.",
    hook: "AI reads receipt items for review before saving a purchase.",
    how: [
      "Dated tasks appear on the calendar.",
      "Groceries connect to the pantry. Logging a meal prompts an ingredient update.",
      "The server renders pages and sends changes to connected devices.",
    ],
  },
] as const;
