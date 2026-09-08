/* ==========================================================
     8. Map
  ========================================================== */
// Define the two map style URLs (inverted for visual contrast: dark map on light theme, light map on dark theme)
const lightStyle =
  "https://tiles.basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const darkStyle =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

// Check the saved theme; default to 'dark' if not set
const savedTheme = localStorage.getItem("theme") || "dark";
// Use the appropriate map style based on the saved theme
const defaultStyle = savedTheme === "dark" ? darkStyle : lightStyle;

// Initialize the map with the default style
const map = new maplibregl.Map({
  container: "map",
  style: defaultStyle,
  center: [-82.6384, 27.7671],
  zoom: 8,
  attributionControl: false,
});

// Add your custom marker to the map
const markerEl = document.createElement("div");
markerEl.className = "custom-marker";
new maplibregl.Marker({ element: markerEl })
  .setLngLat([-82.6384, 27.7671])
  .addTo(map);

// When the DOM is ready, attach an event listener to the dark mode toggle
(() => {
  const toggle = document.getElementById("darkModeToggle");
  if (toggle) {
    // Set the toggle's checked state based on the saved theme
    toggle.checked = savedTheme === "dark";
    toggle.addEventListener("change", function () {
      // When checked, use darkStyle; when unchecked, use lightStyle
      map.setStyle(this.checked ? darkStyle : lightStyle);
    });
  }
})();
