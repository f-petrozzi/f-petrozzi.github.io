---
title: "Homelab"
summary: "My own cloud for projects and AI agents, and a place to learn how to build and manage systems."
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
      <img src="/assets/shots/homelab-adguard.webp" width="576" height="528" alt="AdGuard Home query and filtering statistics." loading="lazy" />
    </button>
  </figure>
  <div class="story-copy">
    <h2>Starting with the network</h2>
    <p>I started my homelab to secure my network. AdGuard Home handles DNS filtering, and trusted devices and IoT devices have separate access rules.</p>
    <p>As I added services, I had to learn how to manage the containers and the connections between them.</p>
  </div>
</section>

<section class="story-row story-architecture">
  <figure>
    <button class="screenshot-open" type="button" aria-label="Enlarge the architecture map" disabled>
      <img src="/assets/shots/homelab.webp" width="1808" height="721" alt="Remote access, development tools, hosted applications, and monitoring on one host." loading="lazy" />
    </button>
  </figure>
  <div class="story-copy">
    <h2>Putting the pieces together</h2>
    <p>My development tools and repositories run on the host alongside containerized applications. NüMe’s API and database have their own Docker network on the same machine.</p>
    <p>My homelab also hosts <a href="/projects/nest/">Nest</a> and the collector for <a href="/projects/agent-usage/">Agent Usage</a>.</p>
  </div>
</section>

<section class="story-row story-monitoring">
  <figure>
    <button class="screenshot-open" type="button" aria-label="Enlarge Grafana" disabled>
      <img src="/assets/shots/homelab-grafana.webp" width="1600" height="1000" alt="Grafana service checks, resource history, storage, and maintenance status." loading="lazy" />
    </button>
  </figure>
  <div class="story-copy">
    <h2>Keeping things running</h2>
    <p>Prometheus collects host and container metrics, and Grafana brings them together in dashboards and alerts.</p>
    <p>I use these to check resource usage and see which services need attention. I also maintain backups and rollback options, pin container images, and delay updates before applying them.</p>
  </div>
</section>

<p class="story-date">Screenshots from September 2026.</p>
