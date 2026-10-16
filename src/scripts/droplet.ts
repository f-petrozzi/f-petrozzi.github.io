import { gsap } from "gsap";
import {
  POINT_COUNT,
  scrollForce,
  dropletVelocity,
  conserveArea,
  limit,
  surfacePath,
  targetRadii,
} from "./droplet-shape";

type Center = { x: number; y: number };
export function createDroplet(
  fluid: HTMLElement,
  thumb: HTMLElement,
  reduced: MediaQueryList,
) {
  const path = fluid.querySelector<SVGPathElement>("#liquid-contour")!;
  const forcedColors = matchMedia("(forced-colors: active)");
  let center: Center = { x: 0, y: 0 };
  let pointer: Center | null = null;
  let hover = false,
    visible = true,
    interrupted = false;
  let frame = 0,
    lastFrame = 0,
    phase = 0;
  let radius = 10.5,
    radiusSpeed = 0,
    inertia = 0,
    inertiaSpeed = 0,
    velocity = 0;
  let scrollEnergy = 0;
  let stretchForce = 0;
  let previousScroll = scrollY,
    scrollTime = performance.now(),
    lastScrollEvent = 0;
  let grabOrigin: Center | null = null;
  let pullX = 0,
    pullY = 0,
    pullVX = 0,
    pullVY = 0;
  let pointerInside = false;
  let angle = -0.7,
    contact = 0,
    contactSpeed = 0,
    ripple = 0;
  let offsetX = 0,
    offsetY = 0,
    offsetVX = 0,
    offsetVY = 0;
  let radii = Array(POINT_COUNT).fill(radius) as number[];
  const speeds = Array(POINT_COUNT).fill(0) as number[];
  let entrance: gsap.core.Timeline | null = null;
  const canAnimate = () =>
    !reduced.matches && !forcedColors.matches && !document.hidden && visible;
  const held = () => thumb.classList.contains("is-dragging");

  function renderStatic() {
    radius = 10.5;
    radii = targetRadii({
      radius,
      time: 0,
      idle: false,
      inertia: 0,
      pointerX: 0,
      pointerY: 0,
      contact: 0,
      angle: 0,
      ripple: 0,
    });
    path.setAttribute("d", surfacePath(radii));
  }
  function step(time: number) {
    frame = 0;
    if (!canAnimate()) return;
    const sinceScroll = time - lastScrollEvent;
    const near =
      pointer && Math.hypot(pointer.x - center.x, pointer.y - center.y) < 90;
    const active =
      near ||
      held() ||
      entrance ||
      sinceScroll < 1600 ||
      Math.abs(inertiaSpeed) > 0.03 ||
      Math.hypot(pullX, pullY, pullVX, pullVY) > 0.01 ||
      Math.abs(radius - 10.5) > 0.05;
    // At rest the surface moves less than a pixel: 30 updates/sec is sufficient.
    if (!active && time - lastFrame < 32) {
      frame = requestAnimationFrame(step);
      return;
    }
    const dt = Math.min(0.034, Math.max(0.001, (time - lastFrame) / 1000));
    lastFrame = time;
    phase += dt;
    let dx = pointer ? pointer.x - center.x : 1000;
    let dy = pointer ? pointer.y - center.y : 1000;
    const distance = Math.hypot(dx, dy);
    const proximity = Math.max(0, 1 - distance / 85);
    const radiusTarget = 10.5;
    radiusSpeed += (150 * (radiusTarget - radius) - 21 * radiusSpeed) * dt;
    radius = limit(radius + radiusSpeed * dt, 9, 22);
    const inertiaTarget = sinceScroll < 100 ? scrollForce(velocity) : 0;
    // Extension tracks current motion quickly; the slower spring below only
    // controls displaced mass and its settling rebound.
    stretchForce +=
      (inertiaTarget - stretchForce) * (1 - Math.exp(-dt / 0.025));
    // Preserve the existing gentle response, then retain extra energy from fast travel.
    scrollEnergy = Math.max(
      Math.max(0, Math.abs(inertiaTarget) - 1) / 0.8,
      scrollEnergy * Math.exp(-dt * 1.5),
    );
    const damping = 4.8 - 1.2 * scrollEnergy;
    inertiaSpeed +=
      (72 * (inertiaTarget - inertia) - damping * inertiaSpeed) * dt;
    inertia = limit(inertia + inertiaSpeed * dt, -2.1, 2.1);
    if (distance > 2 && proximity > 0) angle = Math.atan2(dy, dx);
    // Test the visible, deformed edge so the cursor can stay inside its own bulge.
    const localX = dx - offsetX;
    const localY = dy - offsetY;
    const localDistance = Math.hypot(localX, localY);
    const localAngle = Math.atan2(localY, localX);
    const surfaceIndex = ((localAngle / (Math.PI * 2) + 1) % 1) * POINT_COUNT;
    const index = Math.floor(surfaceIndex);
    const edge =
      radii[index] +
      (radii[(index + 1) % POINT_COUNT] - radii[index]) *
        (surfaceIndex - index);
    if (!pointer) pointerInside = false;
    else if (pointerInside) pointerInside = localDistance < edge + 2;
    else pointerInside = localDistance < edge - 0.5;
    const contactTarget = !pointer
      ? 0
      : pointerInside
        ? limit(localDistance / (radius * 0.65), 0, 1)
        : 0;
    contactSpeed += (165 * (contactTarget - contact) - 18 * contactSpeed) * dt;
    contact = limit(contact + contactSpeed * dt, 0, 1);
    const xTarget = limit(dx * proximity * 0.16, -5, 5);
    const yTarget = limit(dy * proximity * 0.13, -4, 4) - inertia * 1.1;
    offsetVX += (120 * (xTarget - offsetX) - 17 * offsetVX) * dt;
    offsetVY += (120 * (yTarget - offsetY) - 17 * offsetVY) * dt;
    offsetX += offsetVX * dt;
    offsetY += offsetVY * dt;
    ripple *= Math.exp(-dt * 5);
    const grabX =
      held() && pointer && grabOrigin ? pointer.x - grabOrigin.x : 0;
    const grabY =
      held() && pointer && grabOrigin ? pointer.y - grabOrigin.y : 0;
    const grabDistance = Math.hypot(grabX, grabY);
    const resistance = grabDistance
      ? Math.tanh(grabDistance / 45) / grabDistance
      : 0;
    pullVX += (95 * (grabX * resistance - pullX) - 11 * pullVX) * dt;
    pullVY += (95 * (grabY * resistance - pullY) - 11 * pullVY) * dt;
    pullX += pullVX * dt;
    pullY += pullVY * dt;
    // Blend the grab with the moving liquid instead of flattening its speed response
    // at a hard clamp. As momentum rises, the local pull yields to the surface waves.
    const motion = Math.min(1, Math.abs(inertia) / 1.8);
    const surfaceInertia = held() ? 1.1 * Math.tanh(inertia / 1.1) : inertia;
    const surfaceSlosh = held()
      ? 1.2 * Math.tanh(inertiaSpeed / 9.6)
      : inertiaSpeed / 8;
    const pullWeight = 1 - motion * 0.45;
    const targets = targetRadii({
      radius,
      time: phase,
      idle: true,
      inertia: surfaceInertia,
      slosh: surfaceSlosh,
      stretchForce: held() ? 1.1 * Math.tanh(stretchForce / 1.1) : stretchForce,
      pointerX: dx,
      pointerY: dy,
      contact,
      angle,
      ripple,
    });
    // Coupled radial springs let a local disturbance travel around the surface.
    const old = radii.slice();
    const responding = sinceScroll < 100;
    const surfaceStiffness = responding ? 750 : 210;
    const surfaceDamping = responding
      ? 38
      : 12 + Math.min(10, Math.max(0, Math.abs(stretchForce) - 0.85) * 12);
    for (let i = 0; i < POINT_COUNT; i++) {
      const neighbor =
        (old[(i + POINT_COUNT - 1) % POINT_COUNT] +
          old[(i + 1) % POINT_COUNT]) /
        2;
      speeds[i] +=
        (surfaceStiffness * (targets[i] - old[i]) +
          22 * (neighbor - old[i]) -
          surfaceDamping * speeds[i]) *
        dt;
      radii[i] = limit(old[i] + speeds[i] * dt, radius * 0.25, radius * 3.5);
    }
    radii = conserveArea(radii, radius);
    // Keep the small visual on-screen without changing the touch hit target.
    const safeX = limit(offsetX, -Math.max(0, center.x - radius - 2), 6);
    path.setAttribute(
      "d",
      surfacePath(
        radii,
        safeX,
        offsetY,
        pullX * pullWeight,
        pullY * pullWeight,
      ),
    );
    frame = requestAnimationFrame(step);
  }
  function wake() {
    if (!canAnimate()) {
      if (reduced.matches) renderStatic();
      return;
    }
    if (!frame) {
      lastFrame = performance.now();
      frame = requestAnimationFrame(step);
    }
  }
  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  const fallingDrops: HTMLElement[] = [];
  function clearFallingDrops() {
    fallingDrops.splice(0).forEach((drop) => drop.remove());
  }
  function cancelEntrance() {
    interrupted = true;
    entrance?.kill();
    clearFallingDrops();
    entrance = null;
    gsap.set(fluid, { clearProps: "transform,opacity" });
    document.documentElement.classList.remove("droplet-departure");
    if (fluid.dataset.arrival === "running")
      fluid.dataset.arrival = "interrupted";
  }
  function aim(x: number, y: number) {
    if (entrance || reduced.matches) return;
    if (pointer && Math.hypot(x - center.x, y - center.y) < radius * 1.6) {
      ripple = Math.min(
        1.4,
        ripple + Math.hypot(x - pointer.x, y - pointer.y) * 0.045,
      );
    }
    pointer = { x, y };
    wake();
  }
  function grab(x: number, y: number) {
    grabOrigin = { x, y };
    aim(x, y);
  }
  function release() {
    grabOrigin = null;
    pointer = null;
    pointerInside = false;
    hover = false;
    wake();
  }
  function reset() {
    cancelEntrance();
    pointer = null;
    grabOrigin = null;
    pullX = pullY = pullVX = pullVY = 0;
    pointerInside = false;
    contact = contactSpeed = ripple = 0;
    inertia = inertiaSpeed = velocity = scrollEnergy = stretchForce = 0;
    offsetX = offsetY = offsetVX = offsetVY = 0;
    speeds.fill(0);
    pause();
    renderStatic();
    wake();
  }
  function position(
    nextCenter: Center,
    nextScroll: number,
    scrollRange: number,
    railTravel: number,
  ) {
    // Keep the grab offset attached to the moving thumb, not the viewport.
    if (grabOrigin) {
      grabOrigin.x += nextCenter.x - center.x;
      grabOrigin.y += nextCenter.y - center.y;
    }
    center = nextCenter;
    const now = performance.now(),
      delta = nextScroll - previousScroll;
    if (Math.abs(delta) > 0.2) {
      if (entrance) cancelEntrance();
      const sample = dropletVelocity(
        delta,
        (now - scrollTime) / 1000,
        scrollRange,
        railTravel,
      );
      velocity =
        now - lastScrollEvent > 160 ? sample : velocity * 0.4 + sample * 0.6;
      lastScrollEvent = now;
      scrollTime = now;
      previousScroll = nextScroll;
    }
    wake();
  }
  async function startEntrance() {
    fluid.dataset.arrival = "skipped";
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (
      reduced.matches ||
      forcedColors.matches ||
      location.hash ||
      scrollY > 1 ||
      navigation?.type === "back_forward"
    )
      return;
    const ready = (window as Window & { portfolioEraReady?: Promise<void> })
      .portfolioEraReady;
    await ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    if (interrupted || !canAnimate() || scrollY > 1 || location.hash) return;
    const logo = document.querySelector<HTMLImageElement>(
      ".brand img, .wordmark img",
    );
    if (!logo) return;
    const rect = logo.getBoundingClientRect();
    if (rect.bottom < 0 || rect.width === 0) return;
    if (thumb.closest<HTMLElement>(".scroll-rail")?.hidden) return;
    const startY = rect.bottom - 4 - center.y;
    document.documentElement.classList.add("droplet-departure");
    fluid.dataset.arrival = "running";
    gsap.set(fluid, { scale: 0.1, opacity: 0 });
    entrance = gsap.timeline({
      onComplete: () => {
        entrance = null;
        clearFallingDrops();
        gsap.set(fluid, { clearProps: "transform,opacity" });
        document.documentElement.classList.remove("droplet-departure");
        fluid.dataset.arrival = "done";
        ripple = 0.5;
        wake();
      },
    });
    // Unequal beads gather under the mark, detach under gravity, and add
    // their area to the waiting liquid. Small timing variations avoid a loop.
    const beads = [
      { at: 0, size: 0.5, gather: 0.25 },
      { at: 0.48, size: 0.34, gather: 0.17 },
      { at: 0.92, size: 0.62, gather: 0.34 },
      { at: 1.57, size: 0.5, gather: 0.22 },
    ];
    const totalArea = beads.reduce((sum, bead) => sum + bead.size ** 2, 0);
    let area = 0;
    for (const bead of beads) {
      const drop = fluid.cloneNode(true) as HTMLElement;
      drop.removeAttribute("data-arrival");
      // Reuse the original SVG definitions without duplicating document IDs.
      drop.querySelector("defs")?.remove();
      drop.classList.add("arrival-drop");
      Object.assign(drop.style, {
        position: "fixed",
        left: `${center.x - 22}px`,
        top: `${center.y - 32}px`,
        zIndex: "46",
      });
      document.body.append(drop);
      fallingDrops.push(drop);
      const at = bead.at + Math.random() * 0.06;
      const gather = bead.gather + Math.random() * 0.04;
      const fall = Math.sqrt(Math.max(1, -startY) / 650);
      const impact = at + gather + fall;
      area += bead.size ** 2;
      const size = Math.sqrt(area / totalArea);
      gsap.set(drop, { y: startY, scale: 0.08, opacity: 0 });
      entrance
        .to(
          drop,
          {
            opacity: 1,
            scaleX: bead.size * 0.85,
            scaleY: bead.size * 1.15,
            y: startY + 4,
            duration: gather,
            ease: "sine.inOut",
          },
          at,
        )
        .to(
          drop,
          {
            y: 0,
            scaleX: bead.size * 0.72,
            scaleY: bead.size * 1.38,
            duration: fall,
            ease: "power2.in",
          },
          at + gather,
        )
        .set(drop, { opacity: 0 }, impact)
        .to(
          fluid,
          {
            opacity: 1,
            scaleX: size * 1.13,
            scaleY: size * 0.88,
            duration: 0.1,
            ease: "power2.out",
          },
          impact,
        )
        .to(
          fluid,
          {
            scaleX: size,
            scaleY: size,
            duration: 0.32,
            ease: "elastic.out(1, 0.5)",
          },
          impact + 0.1,
        );
    }
  }
  thumb.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "touch") {
      hover = true;
      aim(event.clientX, event.clientY);
    }
  });
  thumb.addEventListener("pointerleave", () => {
    hover = false;
    wake();
  });
  // Cancel the entrance synchronously before an input can use the scrollbar.
  for (const type of ["pointerdown", "touchstart", "wheel", "keydown"]) {
    document.addEventListener(
      type,
      () => {
        if (!interrupted || entrance) cancelEntrance();
      },
      { passive: true, capture: true },
    );
  }
  // Mobile browser chrome changes viewport height without moving the logo or
  // the top of the rail. Only a width change invalidates the drop's geometry.
  let entranceViewportWidth = innerWidth;
  window.addEventListener("resize", () => {
    if (innerWidth !== entranceViewportWidth) {
      entranceViewportWidth = innerWidth;
      cancelEntrance();
    }
  });
  window.addEventListener("pagehide", () => {
    cancelEntrance();
    pause();
  });
  window.addEventListener("pageshow", wake);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelEntrance();
      pause();
    } else wake();
  });
  reduced.addEventListener("change", () => {
    cancelEntrance();
    pause();
    renderStatic();
    wake();
  });
  forcedColors.addEventListener("change", () => {
    cancelEntrance();
    pause();
    wake();
  });
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake();
    else pause();
  }).observe(thumb);
  renderStatic();
  return { aim, grab, release, reset, position, startEntrance, cancelEntrance };
}
