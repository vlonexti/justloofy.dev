// ============================================================
// Theme engine — every colour on the site comes from CSS
// variables scoped to [data-theme] on <html>, so switching is
// one attribute change. The choice is saved per browser.
//
// index.html applies the saved theme before first paint (see
// the tiny inline script in <head>) so there is never a flash.
// ============================================================

export const THEME_KEY = "justloofy-theme";
export const DEFAULT_THEME = "void";

export const THEMES = [
  {
    id: "void",
    name: "Void",
    blurb: "Monochrome, deep space black",
    swatch: { bg: "#050506", card: "#16181b", accent: "#ffffff" },
  },
  {
    id: "ember",
    name: "Ember",
    blurb: "Warm red and orange",
    swatch: { bg: "#08060a", card: "#1e151d", accent: "#ff3b4e" },
  },
  {
    id: "aurora",
    name: "Aurora",
    blurb: "Cold mint and cyan",
    swatch: { bg: "#04080a", card: "#0f2023", accent: "#2ee6b0" },
  },
  {
    id: "nebula",
    name: "Nebula",
    blurb: "Violet with a pink edge",
    swatch: { bg: "#06050c", card: "#191625", accent: "#8b5cf6" },
  },
  {
    id: "sakura",
    name: "Sakura",
    blurb: "Warm pink and amber",
    swatch: { bg: "#0b0509", card: "#22141d", accent: "#f472b6" },
  },
  {
    id: "daylight",
    name: "Daylight",
    blurb: "Clean light mode",
    swatch: { bg: "#f6f7f9", card: "#eaecf1", accent: "#111318" },
  },
  {
    id: "terminal",
    name: "Terminal",
    blurb: "Green phosphor, monospace, hard corners",
    swatch: { bg: "#000603", card: "#0a2618", accent: "#22c55e" },
  },
  {
    id: "parchment",
    name: "Parchment",
    blurb: "Warm paper stock with serif headings",
    swatch: { bg: "#f3eee2", card: "#ebe3d1", accent: "#8a4b2a" },
  },
];

export const isTheme = (id) => THEMES.some((t) => t.id === id);

export function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (isTheme(saved)) return saved;
  } catch { /* storage blocked — fall through */ }
  return DEFAULT_THEME;
}

export function applyTheme(id) {
  const theme = isTheme(id) ? id : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", theme);
  return theme;
}

export function setTheme(id) {
  const theme = applyTheme(id);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* not fatal */ }
  window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  return theme;
}

// Keep other open tabs in sync
window.addEventListener("storage", (e) => {
  if (e.key === THEME_KEY && isTheme(e.newValue)) applyTheme(e.newValue);
});

applyTheme(getTheme());
