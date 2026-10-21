document.querySelectorAll<HTMLElement>("[data-activity]").forEach((root) => {
  const band = root.querySelector<HTMLElement>(".activity-band");
  const tooltip = root.querySelector<HTMLElement>("[data-activity-tooltip]");
  const tooltipText = tooltip?.querySelector("span");
  const selection = root.querySelector<HTMLElement>(
    "[data-activity-selection]",
  );
  const hover = matchMedia("(hover: hover) and (pointer: fine)");
  let selected: HTMLElement | null = null;
  let pointer: number | null = null;
  let pinned = false;
  let targets: { cell: HTMLElement; x: number; y: number }[] = [];
  const hideTooltip = () => {
    tooltip?.removeAttribute("data-open");
    selected?.removeAttribute("data-selected");
    selected = null;
    pointer = null;
    pinned = false;
    targets = [];
    if (selection) selection.textContent = "";
  };

  if (band && tooltip && tooltipText) {
    const visibleCells = () =>
      Array.from(band.querySelectorAll<HTMLElement>("[data-tooltip]")).filter(
        (cell) => cell.getClientRects().length > 0,
      );
    const showTooltip = (cell: HTMLElement, touch = false) => {
      // Size the readout to its label, then measure and position once per day.
      tooltipText.textContent = cell.dataset.tooltip ?? "";
      const bounds = band.getBoundingClientRect();
      const anchor = cell.getBoundingClientRect();
      const width = Math.min(tooltip.getBoundingClientRect().width, bounds.width);
      const left = Math.max(
        0,
        Math.min(
          anchor.left - bounds.left + anchor.width / 2 - width / 2,
          bounds.width - width,
        ),
      );
      tooltip.style.left = `${left}px`;
      // Keep the touch readout above the chart, clear of the user's finger.
      tooltip.style.top = touch ? "0px" : `${anchor.top - bounds.top - 6}px`;
      selected?.removeAttribute("data-selected");
      selected = cell;
      cell.setAttribute("data-selected", "");
      tooltip.setAttribute("data-open", "");
    };
    band.addEventListener("pointerover", (event) => {
      if (
        event.pointerType === "touch" ||
        event.pointerType === "pen" ||
        !hover.matches ||
        !(event.target instanceof Element)
      )
        return;
      const cell = event.target.closest<HTMLElement>("[data-tooltip]");
      if (!cell) return;
      pinned = false;
      showTooltip(cell);
    });
    band.addEventListener("pointerout", (event) => {
      if (pinned || pointer !== null) return;
      const next = event.relatedTarget;
      if (
        next instanceof Element &&
        band.contains(next) &&
        next.closest("[data-tooltip], [data-activity-tooltip]")
      )
        return;
      hideTooltip();
    });
    const selectNearest = (x: number, y: number) => {
      let nearest: HTMLElement | null = null;
      let distance = Infinity;
      for (const target of targets) {
        const next = (target.x - x) ** 2 + (target.y - y) ** 2;
        if (next < distance) {
          nearest = target.cell;
          distance = next;
        }
      }
      if (nearest && nearest !== selected) showTooltip(nearest, true);
    };
    band.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" || !event.isPrimary) return;
      selected?.removeAttribute("data-selected");
      selected = null;
      pointer = event.pointerId;
      pinned = true;
      // Measure once per gesture. Gaps select the nearest real, visible day;
      // responsive-hidden weeks and future dates are never selectable.
      targets = visibleCells().map((cell) => {
        const rect = cell.getBoundingClientRect();
        return {
          cell,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      });
      band.setPointerCapture(event.pointerId);
      selectNearest(event.clientX, event.clientY);
    });
    band.addEventListener("pointermove", (event) => {
      if (event.pointerId !== pointer) return;
      selectNearest(event.clientX, event.clientY);
    });
    band.addEventListener("pointerup", (event) => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      targets = [];
      if (selection) selection.textContent = selected?.dataset.tooltip ?? "";
    });
    band.addEventListener("pointercancel", (event) => {
      if (event.pointerId === pointer) hideTooltip();
    });
    const selectWithKeyboard = (cell: HTMLElement | undefined) => {
      if (!cell) return;
      pinned = true;
      showTooltip(cell, true);
      if (selection) selection.textContent = cell.dataset.tooltip ?? "";
    };
    band.addEventListener("focus", () => {
      if (!selected) selectWithKeyboard(visibleCells().at(-1));
    });
    band.addEventListener("blur", hideTooltip);
    band.addEventListener("keydown", (event) => {
      const offsets: Record<string, number> = {
        ArrowLeft: -7,
        ArrowRight: 7,
        ArrowUp: -1,
        ArrowDown: 1,
      };
      if (
        !(event.key in offsets) &&
        event.key !== "Home" &&
        event.key !== "End"
      )
        return;
      event.preventDefault();
      const cells = visibleCells();
      const current = selected ? cells.indexOf(selected) : cells.length - 1;
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? cells.length - 1
            : Math.max(
                0,
                Math.min(cells.length - 1, current + offsets[event.key]),
              );
      selectWithKeyboard(cells[next]);
    });
    document.addEventListener("pointerdown", (event) => {
      if (!(event.target instanceof Element) || !band.contains(event.target))
        hideTooltip();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hideTooltip();
    });
    window.addEventListener("resize", hideTooltip, { passive: true });
    window.addEventListener("scroll", hideTooltip, { passive: true });
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
