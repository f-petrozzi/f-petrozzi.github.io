export const featured = [
  {
    id: "homelab",
    image: {
      src: "/assets/shots/homelab-featured.webp",
      width: 1440,
      height: 574,
      alt: "Homelab architecture showing private access, hosted projects and monitoring.",
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
    image: undefined,
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
    image: {
      src: "/assets/shots/proterra-featured.webp",
      width: 1440,
      height: 900,
      alt: "Proterra Intelligence weekly issues and a cattle technology brief on the real site.",
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
    image: {
      src: "/assets/shots/nest-featured.webp",
      width: 1120,
      height: 636,
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
