document.querySelectorAll<HTMLElement>("[data-activity]").forEach((root) => {
  const band = root.querySelector<HTMLElement>(".activity-band");
  const tooltip = root.querySelector<HTMLElement>("[data-activity-tooltip]");
  const tooltipText = tooltip?.querySelector("span");
  const hover = matchMedia("(hover: hover) and (pointer: fine)");
  const hideTooltip = () => tooltip?.removeAttribute("data-open");

  if (band && tooltip && tooltipText) {
    band.addEventListener("pointerover", (event) => {
      if (!hover.matches || !(event.target instanceof Element)) return;
      const cell = event.target.closest<HTMLElement>("[data-tooltip]");
      if (!cell) return;
      // Read both rectangles before writes. Position once per cell, never per frame.
      const bounds = band.getBoundingClientRect();
      const anchor = cell.getBoundingClientRect();
      const width = Math.min(180, bounds.width);
      const left = Math.max(
        0,
        Math.min(
          anchor.left - bounds.left + anchor.width / 2 - width / 2,
          bounds.width - width,
        ),
      );
      tooltipText.textContent = cell.dataset.tooltip ?? "";
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${anchor.top - bounds.top + 1}px`;
      tooltip.setAttribute("data-open", "");
    });
    band.addEventListener("pointerout", (event) => {
      const next = event.relatedTarget;
      if (
        next instanceof Element &&
        band.contains(next) &&
        next.closest("[data-tooltip], [data-activity-tooltip]")
      )
        return;
      hideTooltip();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideTooltip();
    });
    window.addEventListener("resize", hideTooltip, { passive: true });
    hover.addEventListener("change", hideTooltip);
  }

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches || !("IntersectionObserver" in window)) return;
  let animations: Animation[] = [];
  let entered = false;
  const stop = () => {
    animations.forEach((animation) => animation.cancel());
    observer.disconnect();
    motion.removeEventListener("change", onMotionChange);
  };
  const onMotionChange = () => {
    if (motion.matches) stop();
  };
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (!visible) {
        hideTooltip();
        if (entered) stop();
        return;
      }
      if (entered) return;
      if (motion.matches) {
        stop();
        return;
      }
      entered = true;
      // CSS hides older weeks on phones. Animate only the columns that remain.
      const columns = Array.from(
        root.querySelectorAll<HTMLElement>("[data-activity-column]"),
      ).filter((column) => column.getClientRects().length > 0);
      animations = columns.map((column, index) =>
        column.animate(
          [
            { opacity: 0, transform: "translateY(3px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 180,
            delay: index * 3,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
            fill: "backwards",
          },
        ),
      );
      void Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(stop);
    },
    { threshold: 0.15 },
  );
  motion.addEventListener("change", onMotionChange);
  observer.observe(root);
});
