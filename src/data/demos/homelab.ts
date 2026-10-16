export type Flow = "private" | "public" | "monitoring" | "development";
export type NodeId = (typeof nodes)[number]["id"];

export const nodes = [
  {
    id: "devices",
    label: "My devices",
    tag: "Remote work",
    x: 28,
    y: 20,
    w: 180,
    h: 64,
    copy: "Personal devices reach development sessions through private access.",
  },
  {
    id: "ssh",
    label: "Tailscale + SSH",
    tag: "Private access",
    x: 270,
    y: 20,
    w: 200,
    h: 64,
    copy: "Tailscale provides private connectivity; SSH opens a session on the host.",
  },
  {
    id: "web",
    label: "Public web",
    tag: "Selected applications",
    x: 736,
    y: 20,
    w: 216,
    h: 64,
    copy: "Visitors reach selected applications through Cloudflare Tunnel.",
  },
  {
    id: "host",
    label: "One physical host",
    tag: "Linux / Docker Compose",
    x: 28,
    y: 124,
    w: 360,
    h: 48,
    copy: "One machine runs development tools, hosted applications, home services and monitoring. The groups describe purpose, not shared networks.",
  },
  {
    id: "terminal",
    label: "VS Code / terminal",
    tag: "Sessions on the host",
    x: 28,
    y: 224,
    w: 200,
    h: 60,
    copy: "Remote sessions give access to development tools and working files on the host.",
  },
  {
    id: "agents",
    label: "Codex & Claude",
    tag: "Coding agents",
    x: 28,
    y: 306,
    w: 200,
    h: 60,
    copy: "Coding agents run on the host alongside development sessions and repositories.",
  },
  {
    id: "repositories",
    label: "Project repositories",
    tag: "Source & working files",
    x: 28,
    y: 388,
    w: 200,
    h: 60,
    copy: "Project source and working files live on the host. Development connections represent work on files, not automatic deployment.",
  },
  {
    id: "nest",
    label: "Nest",
    tag: "Household planning",
    x: 250,
    y: 224,
    w: 202,
    h: 60,
    copy: "Nest is a hosted household planning project on the same physical machine.",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    tag: "Local site preview",
    x: 250,
    y: 306,
    w: 202,
    h: 60,
    copy: "A local preview of the portfolio runs alongside the other projects.",
  },
  {
    id: "usage",
    label: "Agent Usage",
    tag: "Host usage collector",
    x: 250,
    y: 388,
    w: 202,
    h: 60,
    copy: "The Agent Usage collector runs on the host to support the usage dashboard.",
  },
  {
    id: "tunnel",
    label: "Cloudflare Tunnel",
    tag: "Public ingress",
    x: 484,
    y: 224,
    w: 230,
    h: 60,
    copy: "The tunnel routes selected public web traffic to NüMe. It can reach NüMe's network while the application stays off the core network.",
  },
  {
    id: "nume",
    label: "NüMe",
    tag: "API + database",
    x: 484,
    y: 352,
    w: 230,
    h: 76,
    copy: "NüMe's API and database share an isolated Docker network on this host. Public application traffic enters through the tunnel.",
  },
  {
    id: "home",
    label: "Home Assistant",
    tag: "Home automation",
    x: 736,
    y: 224,
    w: 216,
    h: 50,
    copy: "Home Assistant handles home automation as one of the home services.",
  },
  {
    id: "dns",
    label: "AdGuard Home",
    tag: "DNS filtering",
    x: 736,
    y: 284,
    w: 216,
    h: 50,
    copy: "AdGuard Home filters DNS queries, with separate access rules for trusted and IoT devices.",
  },
  {
    id: "storage",
    label: "Samba",
    tag: "Shared storage",
    x: 736,
    y: 344,
    w: 216,
    h: 50,
    copy: "Samba provides shared storage as a home service.",
  },
  {
    id: "game",
    label: "Minecraft",
    tag: "Game server",
    x: 736,
    y: 404,
    w: 216,
    h: 50,
    copy: "A game server runs alongside the other home services.",
  },
  {
    id: "exporters",
    label: "Exporters",
    tag: "Host / containers / probes",
    x: 250,
    y: 524,
    w: 202,
    h: 60,
    copy: "Exporters expose host and container resource metrics, alongside service probes, for collection.",
  },
  {
    id: "prometheus",
    label: "Prometheus",
    tag: "Metric collection",
    x: 484,
    y: 524,
    w: 230,
    h: 60,
    copy: "Prometheus collects the exported measurements so they can be queried over time.",
  },
  {
    id: "grafana",
    label: "Grafana",
    tag: "Dashboards & alerts",
    x: 736,
    y: 524,
    w: 216,
    h: 60,
    copy: "Grafana brings resource usage and service checks together in dashboards and alerts.",
  },
] as const;

export const edges: { from: NodeId; to: NodeId; flow: Flow; path?: string }[] =
  [
    { from: "devices", to: "ssh", flow: "private", path: "M208 52H270" },
    {
      from: "ssh",
      to: "terminal",
      flow: "private",
      path: "M370 84V104H460V188H128V224",
    },
    { from: "web", to: "tunnel", flow: "public", path: "M844 84V188H599V224" },
    { from: "tunnel", to: "nume", flow: "public", path: "M599 284V352" },
    {
      from: "terminal",
      to: "agents",
      flow: "development",
      path: "M28 254H18V336H28",
    },
    {
      from: "terminal",
      to: "repositories",
      flow: "development",
      path: "M18 336V418H28",
    },
    {
      from: "host",
      to: "exporters",
      flow: "monitoring",
      path: "M962 174V484H351V524",
    },
    {
      from: "exporters",
      to: "prometheus",
      flow: "monitoring",
      path: "M452 554H484",
    },
    {
      from: "prometheus",
      to: "grafana",
      flow: "monitoring",
      path: "M714 554H736",
    },
  ];

export function connections(id: NodeId) {
  const linked = edges.flatMap((edge) =>
    edge.from === id ? [edge.to] : edge.to === id ? [edge.from] : [],
  );
  if (id === "host")
    return nodes
      .filter((node) => !["devices", "ssh", "web", "host"].includes(node.id))
      .map((node) => node.label);
  if (!["devices", "ssh", "web"].includes(id)) linked.push("host");
  return [...new Set(linked)].map(
    (key) => nodes.find((node) => node.id === key)!.label,
  );
}

export function flowNodes(flows: Flow[]): Set<NodeId> {
  return new Set(
    edges
      .filter((edge) => flows.includes(edge.flow))
      .flatMap((edge) => [edge.from, edge.to]),
  );
}

export const defaultRules = { blockTrackers: true, restrictIot: true };
export type DnsRules = typeof defaultRules;
export const queries = [
  { id: "q1", group: "Trusted", domain: "news.example", category: "web" },
  { id: "q2", group: "IoT", domain: "news.example", category: "web" },
  {
    id: "q3",
    group: "Trusted",
    domain: "telemetry.example",
    category: "tracker",
  },
  { id: "q4", group: "IoT", domain: "telemetry.example", category: "tracker" },
  { id: "q5", group: "IoT", domain: "firmware.example", category: "update" },
  { id: "q6", group: "Trusted", domain: "video.example", category: "web" },
] as const;

export function filterQuery(query: (typeof queries)[number], rules: DnsRules) {
  if (rules.blockTrackers && query.category === "tracker")
    return { allowed: false, reason: "Tracker rule" };
  if (rules.restrictIot && query.group === "IoT" && query.category !== "update")
    return { allowed: false, reason: "IoT: updates only" };
  return {
    allowed: true,
    reason:
      query.group === "IoT" && rules.restrictIot
        ? "Update exception"
        : "Group access",
  };
}

export const alertThreshold = 80;
export function monitoring(load: number) {
  const safeLoad = Number.isFinite(load) ? Math.max(0, Math.min(100, load)) : 0;
  const cpu = Math.round(18 + safeLoad * 0.76);
  return {
    load: safeLoad,
    cpu,
    memory: Number((4.8 + safeLoad * 0.036).toFixed(1)),
    firing: cpu >= alertThreshold,
    containers: [
      {
        name: "NüMe API",
        cpu: Math.round(4 + safeLoad * 0.52),
        memory: Math.round(320 + safeLoad * 6),
        health: cpu >= alertThreshold ? "Degraded" : "Healthy",
      },
      {
        name: "NüMe database",
        cpu: Math.round(2 + safeLoad * 0.12),
        memory: 640,
        health: "Healthy",
      },
      { name: "Home Assistant", cpu: 3, memory: 480, health: "Healthy" },
      { name: "AdGuard Home", cpu: 1, memory: 96, health: "Healthy" },
      { name: "Prometheus", cpu: 2, memory: 384, health: "Healthy" },
      { name: "Grafana", cpu: 1, memory: 220, health: "Healthy" },
    ],
  };
}
