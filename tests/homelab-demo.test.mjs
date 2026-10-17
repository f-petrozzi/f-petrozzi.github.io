import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alertThreshold,
  connections,
  defaultRules,
  edges,
  filterQuery,
  flowNodes,
  monitoring,
  nodes,
  queries,
} from "../src/data/demos/homelab.ts";

test("architecture paths preserve private access, isolated ingress and metric flow", () => {
  const ids = new Set(nodes.map((node) => node.id));
  assert.equal(ids.size, nodes.length);
  for (const edge of edges) {
    assert.ok(ids.has(edge.from));
    assert.ok(ids.has(edge.to));
    assert.notEqual(edge.from, edge.to);
  }
  assert.deepEqual([...flowNodes(["private"])], ["devices", "ssh", "terminal"]);
  assert.deepEqual([...flowNodes(["public"])], ["web", "tunnel", "nume"]);
  assert.deepEqual(
    [...flowNodes(["monitoring"])],
    ["host", "exporters", "prometheus", "grafana"],
  );
  assert.deepEqual([...flowNodes([])], []);
  const combined = flowNodes(["private", "public"]);
  assert.equal(combined.size, 6);
  assert.ok(!combined.has("dns"));
  assert.ok(!combined.has("repositories"));
  assert.deepEqual(connections("nume"), [
    "Cloudflare Tunnel",
    "One physical host",
  ]);
  assert.ok(!connections("nume").includes("Home Assistant"));
  assert.ok(connections("host").includes("NüMe"));
  assert.ok(!connections("host").includes("Public web"));
  assert.ok(
    !edges.some(
      (edge) => edge.from === "repositories" && edge.flow === "public",
    ),
  );
});

test("load changes resource measurements throughout the range and clears the alert", () => {
  const baseline = monitoring(0);
  const loaded = monitoring(100);
  assert.equal(baseline.cpu, 18);
  assert.equal(baseline.memory, 4.8);
  assert.equal(baseline.firing, false);
  assert.equal(loaded.cpu, 94);
  assert.equal(loaded.memory, 8.4);
  assert.equal(loaded.firing, true);
  assert.equal(loaded.containers[0].health, "Degraded");
  assert.ok(
    loaded.containers
      .slice(1)
      .every((container) => container.health === "Healthy"),
  );
  let previous = baseline;
  for (let load = 10; load <= 100; load += 10) {
    const current = monitoring(load);
    assert.ok(current.cpu > previous.cpu);
    assert.ok(current.memory > previous.memory);
    assert.ok(current.containers[0].cpu > previous.containers[0].cpu);
    assert.ok(current.containers[0].memory > previous.containers[0].memory);
    previous = current;
  }
  assert.equal(monitoring(80).cpu, alertThreshold - 1);
  assert.equal(monitoring(80).firing, false);
  assert.equal(monitoring(81).cpu, alertThreshold);
  assert.equal(monitoring(81).firing, true);
  assert.deepEqual(monitoring(0), baseline);
});

test("out of range or non-finite load stays bounded", () => {
  assert.deepEqual(monitoring(-10), monitoring(0));
  assert.deepEqual(monitoring(120), monitoring(100));
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.deepEqual(monitoring(value), monitoring(0));
  }
});

test("DNS rules distinguish trusted browsing, IoT updates and trackers", () => {
  const allowed = (rules) =>
    queries.map((query) => filterQuery(query, rules).allowed);
  assert.deepEqual(allowed(defaultRules), [
    true,
    false,
    false,
    false,
    true,
    true,
  ]);
  assert.deepEqual(allowed({ blockTrackers: true, restrictIot: false }), [
    true,
    true,
    false,
    false,
    true,
    true,
  ]);
  assert.deepEqual(allowed({ blockTrackers: false, restrictIot: true }), [
    true,
    false,
    true,
    false,
    true,
    true,
  ]);
  assert.deepEqual(allowed({ blockTrackers: false, restrictIot: false }), [
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  assert.equal(filterQuery(queries[3], defaultRules).reason, "Tracker rule");
  assert.equal(
    filterQuery(queries[3], { blockTrackers: false, restrictIot: true }).reason,
    "IoT updates only",
  );
  assert.equal(
    filterQuery(queries[4], defaultRules).reason,
    "Update exception",
  );
  assert.deepEqual(defaultRules, { blockTrackers: true, restrictIot: true });
});
