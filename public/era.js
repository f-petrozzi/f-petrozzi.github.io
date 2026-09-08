(() => {
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const native =
    CSS.supports("view-transition-name", "none") && "onpagereveal" in window;
  const key = "portfolio-era-navigation";
  let busy = false;
  let release;
  window.portfolioEraReady = new Promise((resolve) => {
    release = resolve;
  });
  const setOrigin = ({ x, y }) => {
    x = Math.max(0, Math.min(innerWidth, x));
    y = Math.max(0, Math.min(innerHeight, y));
    const radius = Math.ceil(
      Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)),
    );
    const style = document.documentElement.style;
    style.setProperty("--era-x", `${x}px`);
    style.setProperty("--era-y", `${y}px`);
    style.setProperty("--era-radius", `${radius}px`);
    style.setProperty("--era-diameter", `${radius * 2}px`);
  };
  function takeNavigation() {
    try {
      const data = JSON.parse(sessionStorage.getItem(key) || "null");
      sessionStorage.removeItem(key);
      return data &&
        Date.now() - data.time < 60000 &&
        data.path === location.pathname
        ? data
        : null;
    } catch {
      return null;
    }
  }
  function reveal(event) {
    event?.viewTransition?.ready.catch(() => {});
    document.documentElement.classList.remove(
      "era-arrival",
      "era-fallback-arrival",
    );
    const data = takeNavigation();
    if (!data || reduced()) {
      event?.viewTransition?.skipTransition();
      release();
      return;
    }
    setOrigin(data);
    if (event?.viewTransition) {
      document.documentElement.classList.add("era-arrival");
      // The original map and external libraries start only after snapshots finish.
      event.viewTransition.finished.then(release, release);
    } else {
      document.documentElement.classList.add("era-fallback-arrival");
      setTimeout(release, 180);
    }
  }
  // This file is a synchronous head script: pagereveal can precede defer scripts.
  if (native) window.addEventListener("pagereveal", reveal);
  else {
    reveal();
  }
  window.addEventListener("pageshow", (event) => {
    document.querySelector(".era-fallback-cover")?.remove();
    busy = false;
    if (event.persisted && !native) reveal();
    // Release optional assets even in engines that never dispatch pagereveal.
    if (!native) release();
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[data-era-link]");
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      reduced()
    )
      return;
    if (busy) {
      event.preventDefault();
      return;
    }
    busy = true;
    const rect = link.getBoundingClientRect();
    const origin = {
      x: event.detail ? event.clientX : rect.x + rect.width / 2,
      y: event.detail ? event.clientY : rect.y + rect.height / 2,
    };
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          ...origin,
          time: Date.now(),
          path: new URL(link.href).pathname,
        }),
      );
    } catch {}
    if (native) return;
    event.preventDefault();
    setOrigin(origin);
    const cover = document.createElement("div");
    cover.className = "era-fallback-cover";
    cover.setAttribute("aria-hidden", "true");
    document.body.append(cover);
    setTimeout(() => location.assign(link.href), 220);
  });
})();
