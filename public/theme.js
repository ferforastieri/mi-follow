// Runs before the first paint: the kit reads the theme from <html data-theme>.
// A stored choice wins; otherwise the system's.
(() => {
  try {
    const stored = localStorage.getItem("mifollow:theme");
    const dark = stored ? stored === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
