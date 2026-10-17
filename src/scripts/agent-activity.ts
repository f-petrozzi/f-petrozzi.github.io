document.querySelectorAll<HTMLElement>("[data-activity]").forEach((root) => {
  const scroller = root.querySelector<HTMLElement>(".activity-scroll");
  if (scroller) scroller.scrollLeft = scroller.scrollWidth;

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  if (motion.matches || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      if (motion.matches) return;
      const animations = Array.from(
        root.querySelectorAll<HTMLElement>("[data-activity-column]"),
        (column, index) =>
          column.animate(
            [
              { opacity: 0, transform: "translateY(5px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            {
              duration: 240,
              delay: index * 5,
              easing: "cubic-bezier(0.23, 1, 0.32, 1)",
              fill: "backwards",
            },
          ),
      );
      const stop = () => {
        if (motion.matches)
          animations.forEach((animation) => animation.cancel());
      };
      motion.addEventListener("change", stop);
      void Promise.allSettled(
        animations.map((animation) => animation.finished),
      ).then(() => motion.removeEventListener("change", stop));
    },
    { threshold: 0.15 },
  );
  observer.observe(root);
});
