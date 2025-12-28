const root = document.documentElement;
const key = "unipass-access";

function apply(cfg) {
  root.style.setProperty("--font-scale", cfg.fontScale);
  root.style.setProperty("--focus-ring", cfg.focusRing ? "2px solid var(--primary)" : "none");
  root.style.setProperty("--motion", cfg.reduceMotion ? "none" : "auto");
  localStorage.setItem(key, JSON.stringify(cfg));
}

export function initAccessibility() {
  const saved = localStorage.getItem(key);
  if (saved) {
    apply(JSON.parse(saved));
  } else {
    apply({ fontScale: "1", focusRing: true, reduceMotion: false });
  }
}

export function setFontScale(v) {
  const cfg = JSON.parse(localStorage.getItem(key)) || {};
  cfg.fontScale = v;
  apply(cfg);
}

export function toggleFocusRing() {
  const cfg = JSON.parse(localStorage.getItem(key)) || {};
  cfg.focusRing = !cfg.focusRing;
  apply(cfg);
}

export function toggleReduceMotion() {
  const cfg = JSON.parse(localStorage.getItem(key)) || {};
  cfg.reduceMotion = !cfg.reduceMotion;
  apply(cfg);
}
