// darkmode.js

// Function to set the theme and save the user’s preference
function setTheme(theme) {
  // Set the data attribute on the <html> element so that CSS can use it
  document.documentElement.setAttribute('data-theme', theme);
  // Save the theme in localStorage so it persists on refresh/pages
  localStorage.setItem('theme', theme);
}

// When the document is ready, read the saved theme and attach event listeners if needed
document.addEventListener('DOMContentLoaded', function () {
  // Read saved theme from localStorage; default to 'light'
  const savedTheme = localStorage.getItem('theme') || 'dark';
  // Apply the theme globally
  setTheme(savedTheme);

  // Find the dark mode toggle element by its id
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) {
    // Set the toggle's checked state based on the saved theme
    toggle.checked = savedTheme === 'light';
    // When the toggle changes, update the theme accordingly
    toggle.addEventListener('change', function () {
      setTheme(this.checked ? 'dark' : 'light');
    });
  }
});
