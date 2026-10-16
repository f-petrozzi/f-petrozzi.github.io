import {
  connections,
  defaultRules,
  edges,
  filterQuery,
  flowNodes,
  monitoring,
  nodes,
  queries,
  type DnsRules,
  type Flow,
  type NodeId,
} from "../../data/demos/homelab";

function init(root: HTMLElement) {
  const get = <T extends Element = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const all = <T extends Element = HTMLElement>(selector: string) => [
    ...root.querySelectorAll<T>(selector),
  ];
  let selected: NodeId = "host";
  let flows: Flow[] = ["private"];
  let rules: DnsRules = { ...defaultRules };

  function view(name: string) {
    all("[data-view]").forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.view === name)),
    );
    all("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
  }

  function architecture() {
    const highlighted = flowNodes(flows);
    all<HTMLButtonElement>("[data-node]").forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.node === selected),
      );
      button.classList.toggle(
        "on-path",
        highlighted.has(button.dataset.node as NodeId),
      );
    });
    all("[data-flow]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(flows.includes(button.dataset.flow as Flow)),
      ),
    );
    all<SVGPathElement>("[data-edge]").forEach((path) => {
      path.classList.toggle(
        "active",
        flows.includes(edges[Number(path.dataset.edge)].flow),
      );
    });
    const node = nodes.find((node) => node.id === selected)!;
    get("[data-node-title]").textContent = node.label;
    get("[data-node-copy]").textContent = node.copy;
    get("[data-connections]").textContent = connections(selected).join(" / ");
    get("[data-flow-status]").textContent = flows.length
      ? `${flows.map((flow) => ({ private: "Private access: My devices → Tailscale + SSH → VS Code / terminal", public: "Public access: Public web → Cloudflare Tunnel → NüMe", monitoring: "Monitoring: Host → Exporters → Prometheus → Grafana", development: "Development" })[flow]).join(". ")}.`
      : "All paths muted.";
  }

  function metrics() {
    const sample = monitoring(
      Number(get<HTMLInputElement>("[data-load]").value),
    );
    get("[data-load-value]").textContent = `${sample.load}%`;
    get("[data-cpu]").textContent = `${sample.cpu}%`;
    get("[data-memory]").textContent = `${sample.memory.toFixed(1)} / 16 GB`;
    get<HTMLMeterElement>("[data-cpu-meter]").value = sample.cpu;
    get<HTMLMeterElement>("[data-memory-meter]").value = sample.memory;
    const alert = get("[data-alert]");
    alert.dataset.firing = String(sample.firing);
    alert.textContent = sample.firing
      ? `Firing / Host CPU is ${sample.cpu}% (threshold ≥ 80%).`
      : `Normal / Host CPU is ${sample.cpu}% (threshold ≥ 80%).`;
    get("[data-health-summary]").textContent =
      `${sample.containers.filter((container) => container.health === "Healthy").length} of ${sample.containers.length} healthy`;
    all("[data-container]").forEach((row, index) => {
      const container = sample.containers[index];
      row.querySelector("[data-container-cpu]")!.textContent =
        `${container.cpu}%`;
      row.querySelector("[data-container-memory]")!.textContent =
        `${container.memory} MB`;
      const health = row.querySelector<HTMLElement>("[data-container-health]")!;
      health.textContent = container.health;
      health.dataset.degraded = String(container.health === "Degraded");
    });
  }

  function dns() {
    all("[data-rule]").forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(rules[button.dataset.rule as keyof DnsRules]),
      ),
    );
    let blocked = 0;
    all("[data-query]").forEach((row, index) => {
      const result = filterQuery(queries[index], rules);
      if (!result.allowed) blocked++;
      const state = row.querySelector<HTMLElement>("[data-query-state]")!;
      state.textContent = result.allowed ? "Allowed" : "Blocked";
      state.dataset.blocked = String(!result.allowed);
      row.querySelector("[data-query-reason]")!.textContent = result.reason;
    });
    get("[data-dns-summary]").textContent =
      `${blocked} blocked / ${queries.length - blocked} allowed`;
  }

  all<HTMLButtonElement>("[data-view]").forEach((button) =>
    button.addEventListener("click", () => view(button.dataset.view!)),
  );
  all<HTMLButtonElement>("[data-node]").forEach((button) =>
    button.addEventListener("click", () => {
      selected = button.dataset.node as NodeId;
      architecture();
    }),
  );
  all<HTMLButtonElement>("[data-flow]").forEach((button) =>
    button.addEventListener("click", () => {
      const flow = button.dataset.flow as Flow;
      flows = flows.includes(flow)
        ? flows.filter((item) => item !== flow)
        : [...flows, flow];
      architecture();
    }),
  );
  get("[data-load]").addEventListener("input", metrics);
  all<HTMLButtonElement>("[data-rule]").forEach((button) =>
    button.addEventListener("click", () => {
      const rule = button.dataset.rule as keyof DnsRules;
      rules[rule] = !rules[rule];
      dns();
    }),
  );
  get("[data-reset]").addEventListener("click", () => {
    selected = "host";
    flows = ["private"];
    rules = { ...defaultRules };
    get<HTMLInputElement>("[data-load]").value = "0";
    get("[data-map-scroll]").scrollLeft = 0;
    architecture();
    metrics();
    dns();
    view("architecture");
    get("[data-reset-status]").textContent = "Sample reset.";
  });
  architecture();
  metrics();
  dns();
}

document.querySelectorAll<HTMLElement>('[data-demo="homelab"]').forEach(init);
