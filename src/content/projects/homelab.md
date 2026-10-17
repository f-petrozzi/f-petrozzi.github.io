---
title: "Homelab"
summary: "My cloud for projects, AI agents and learning systems administration."
category: "Data & systems"
tools:
  [
    "Linux",
    "Docker Compose",
    "Tailscale",
    "Cloudflare Tunnel",
    "Prometheus",
    "Grafana",
    "Home Assistant",
  ]
order: 5
featured: false
status: "Infrastructure"
visual: "lab"
---

<section class="story-row story-network">
  <figure>
    <button class="screenshot-open" type="button" aria-label="Enlarge AdGuard Home" disabled>
      <img src="/assets/shots/homelab-adguard.webp" width="576" height="528" alt="AdGuard Home filtering statistics." loading="lazy" />
    </button>
  </figure>
  <div class="story-copy">
    <h2>Network</h2>
    <p>I started my homelab to secure my network. AdGuard Home filters DNS. Trusted and IoT devices have separate access rules.</p>
    <p>Adding services taught me to manage containers and their connections.</p>
  </div>
</section>

<section class="story-row story-architecture">
  <figure>
    <button class="screenshot-open" type="button" aria-label="Enlarge the architecture map" disabled>
      <img src="/assets/shots/homelab.webp" width="1808" height="721" alt="Remote access, development, apps and monitoring on one host." loading="lazy" />
    </button>
  </figure>
  <div class="story-copy">
    <h2>Services</h2>
    <p>My development tools, repositories and containerized apps share one host. NüMe’s API and database use their own Docker network.</p>
    <p>It also hosts <a href="/projects/nest/">Nest</a> and the collector for <a href="/projects/agent-usage/">Agent Usage</a>.</p>
  </div>
</section>

<section class="story-row story-monitoring">
  <figure>
    <button class="screenshot-open" type="button" aria-label="Enlarge Grafana" disabled>
      <img src="/assets/shots/homelab-grafana.webp" width="1600" height="1000" alt="Grafana service health, resources, storage and maintenance." loading="lazy" />
    </button>
  </figure>
  <div class="story-copy">
    <h2>Monitoring</h2>
    <p>Prometheus collects host and container metrics. Grafana provides dashboards and alerts.</p>
    <p>I check resource usage and service health. I maintain backups and rollback options, pin container images and delay updates.</p>
  </div>
</section>

<p class="story-date">Screenshots from September 2026.</p>
