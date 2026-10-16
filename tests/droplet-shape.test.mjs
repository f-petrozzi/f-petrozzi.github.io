import test from "node:test";
import assert from "node:assert/strict";
import {
  targetRadii,
  surfacePath,
  POINT_COUNT,
  scrollForce,
  dropletVelocity,
} from "../src/scripts/droplet-shape.ts";

const base = {
  radius: 20,
  time: 0,
  idle: false,
  inertia: 0,
  pointerX: 0,
  pointerY: 0,
  contact: 0,
  angle: 0,
  ripple: 0,
};
const area = (r) =>
  r.reduce((sum, value, i) => sum + value * r[(i + 1) % r.length], 0);

test("scroll inertia gathers volume opposite the direction of travel", () => {
  const down = targetRadii({ ...base, inertia: 1 });
  const up = targetRadii({ ...base, inertia: -1 });
  assert.ok(down[36] > down[12]);
  assert.ok(up[12] > up[36]);
});

test("approaching cursor makes a shallow inward dent", () => {
  const resting = targetRadii(base);
  const approaching = targetRadii({ ...base, contact: -0.58 });
  assert.ok(approaching[0] < resting[0] - 2);
  assert.ok(approaching[0] > base.radius * 0.75);
});

test("cursor pushes the surface outward where it occupies volume", () => {
  const radii = targetRadii({ ...base, contact: 1 });
  assert.ok(radii[0] > radii[6] + 4);
  assert.ok(radii[0] > radii[42] + 4);
  assert.ok(
    Math.abs(area(radii) / (POINT_COUNT * base.radius ** 2) - 1) < 0.001,
  );
});

test("combined liquid forces retain a finite, closed and bounded contour", () => {
  for (const inertia of [-2.1, -1, 0, 1, 2.1]) {
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const radii = targetRadii({
        ...base,
        idle: true,
        time: 17,
        inertia,
        angle,
        contact: 1,
        ripple: 1,
        slosh: inertia,
      });
      assert.ok(radii.every((r) => Number.isFinite(r) && r >= 5 && r <= 70));
      const path = surfacePath(radii);
      assert.ok(path.startsWith("M") && path.endsWith("Z"));
      assert.equal((path.match(/C/g) || []).length, POINT_COUNT);
      assert.ok(!/NaN|Infinity/.test(path));
    }
  }
});

test("fast scrolling adds force without changing the gentle baseline", () => {
  assert.equal(scrollForce(850), 0.5);
  assert.equal(scrollForce(1700), 1);
  assert.ok(scrollForce(5000) > 1.5);
  assert.ok(scrollForce(10000) > scrollForce(5000));
  assert.ok(scrollForce(100000) <= 1.8);
  assert.equal(scrollForce(-5000), -scrollForce(5000));
});

test("fast travel draws into a slender column while preserving volume", () => {
  const radii = targetRadii({ ...base, inertia: 1.8 });
  const height = radii[12] + radii[36];
  const width = radii[0] + radii[24];
  assert.ok(height / width > 3);
  assert.ok(
    Math.abs(area(radii) / (POINT_COUNT * base.radius ** 2) - 1) < 0.001,
  );
});

test("held pull has a fixed extension limit in every direction", () => {
  const radii = targetRadii(base);
  assert.equal(
    surfacePath(radii, 0, 0, 1, 0),
    surfacePath(radii, 0, 0, 100, 0),
  );
  assert.equal(
    surfacePath(radii, 0, 0, 0, -1),
    surfacePath(radii, 0, 0, 0, -100),
  );
  assert.notEqual(surfacePath(radii), surfacePath(radii, 0, 0, 1, 0));
});

test("pull anchors the rear edge and extends only toward the pull", () => {
  const radii = Array(POINT_COUNT).fill(10);
  const endpoints = (path) => {
    const n = path.match(/-?\d+(?:\.\d+)?/g).map(Number);
    const points = [[n[0], n[1]]];
    for (let i = 2; i < n.length; i += 6) points.push([n[i + 4], n[i + 5]]);
    return points;
  };
  const right = endpoints(surfacePath(radii, 0, 0, 1, 0));
  assert.equal(Math.min(...right.map(([x]) => x)), 30);
  assert.equal(Math.max(...right.map(([x]) => x)), 56.4);
  const up = endpoints(surfacePath(radii, 0, 0, 0, -1));
  assert.equal(Math.max(...up.map(([, y]) => y)), 55);
  assert.equal(Math.min(...up.map(([, y]) => y)), 28.6);
});

test("equal track travel has equal energy across short and medium pages", () => {
  const rail = 600;
  const samples = [40, 400, 1600].map((range) =>
    dropletVelocity(range * 0.01, 0.02, range, rail),
  );
  samples.forEach((sample) => assert.ok(Math.abs(sample - samples[0]) < 0.001));
  assert.equal(dropletVelocity(17, 0.02, 5000, rail), 850);
  assert.equal(dropletVelocity(17, 0.02, 20000, rail), 850);
});

test("short-page motion distinguishes gentle movement from a full-track jump", () => {
  const gentle = dropletVelocity(0.4, 0.04, 40, 600);
  const jump = dropletVelocity(40, 0.04, 40, 600);
  assert.ok(scrollForce(gentle) < 0.5);
  assert.ok(scrollForce(jump) > 1.7);
  assert.equal(dropletVelocity(-40, 0.04, 40, 600), -jump);
  assert.equal(dropletVelocity(40, 0, 0, 600), 0);
  assert.equal(dropletVelocity(40, 0, 40, 0), 0);
  assert.ok(Number.isFinite(dropletVelocity(40, 0, 0.01, 600)));
});
