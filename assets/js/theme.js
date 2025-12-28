    const root = document.documentElement;
const key = "unipass-theme";

function apply(theme) {
  root.setAttribute("data-theme", theme);
  localStorage.setItem(key, theme);
}

export function initTheme() {
  const saved = localStorage.getItem(key);
  if (saved) {
    apply(saved);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    apply(prefersDark ? "dark" : "light");
  }
}

export function toggleTheme() {
  const current = localStorage.getItem(key) || "light";
  apply(current === "dark" ? "light" : "dark");
}
