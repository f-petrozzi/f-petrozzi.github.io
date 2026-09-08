(async () => {
  await window.portfolioEraReady;
  for (const template of document.querySelectorAll(
    "template[data-legacy-style]",
  )) {
    document.head.append(template.content.cloneNode(true));
  }
  const scripts = [
    ...document.querySelectorAll("template[data-legacy-script]"),
  ];
  await Promise.all(
    scripts.map(async (template) => {
      const original = template.content.querySelector("script");
      if (original.noModule && "noModule" in HTMLScriptElement.prototype)
        return;
      const script = document.createElement("script");
      for (const attr of original.attributes)
        script.setAttribute(attr.name, attr.value);
      const ready = new Promise((resolve) => {
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
      });
      document.body.append(script);
      const loaded = await ready;
      if (original.src.includes("maplibre-gl") && loaded) {
        try {
          await import("./map.js");
        } catch (error) {
          console.warn("The original map could not be initialized.", error);
        }
      }
    }),
  );
})();
