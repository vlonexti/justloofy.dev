// ============================================================
// SPA router — swaps views inside #app with no page reloads,
// and subscribes to Supabase realtime so the site live-updates.
// Routes look like:  #/  #/mods  #/mod/<id>  #/auth  #/account
// ============================================================

import "./effects.js";
import { setActiveNav, closeMobileNav, toast } from "./ui.js";
import { isLive, supabase } from "./db.js";
import { homeView } from "./views/home.js";
import { modsView } from "./views/mods.js";
import { modView } from "./views/mod.js";
import { authView } from "./views/auth.js";
import { accountView } from "./views/account.js";
import { adminView } from "./views/admin.js";
import { successView } from "./views/success.js";
import { notFoundView } from "./views/notfound.js";

const app = document.getElementById("app");

const routes = [
  { pattern: /^\/$/, view: homeView },
  { pattern: /^\/mods$/, view: modsView },
  { pattern: /^\/mod\/(.+)$/, view: modView },
  { pattern: /^\/auth$/, view: authView },
  { pattern: /^\/account$/, view: accountView },
  { pattern: /^\/admin$/, view: adminView },
  { pattern: /^\/success$/, view: successView },
];

export function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, query = ""] = raw.split("?");
  return { path, params: new URLSearchParams(query) };
}

let rendering = false;

export async function route({ scroll = true, animate = true } = {}) {
  if (rendering) return;
  rendering = true;
  try {
    const { path, params } = parseHash();
    const match = routes.find((r) => r.pattern.test(path));
    const view = match ? match.view : notFoundView;
    const groups = match ? path.match(match.pattern) : null;

    if (animate) {
      app.classList.remove("route-in");
      void app.offsetWidth; // restart the CSS animation
      app.classList.add("route-in");
    }
    if (scroll) window.scrollTo(0, 0);

    closeMobileNav();
    await view(app, { params, id: groups?.[1] ? decodeURIComponent(groups[1]) : null });
    setActiveNav(path);
  } finally {
    rendering = false;
  }
}

window.addEventListener("hashchange", () => route());
route();

// ---------- Live updates (Supabase realtime) ----------
// Re-renders the current view in place when the catalog changes,
// and pops a toast when a purchase lands in the user's library.
// Requires realtime to be enabled on the tables — see README.

if (isLive && supabase) {
  let refreshTimer = null;
  const quietRefresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => route({ scroll: false, animate: false }), 400);
  };

  supabase
    .channel("live-updates")
    .on("postgres_changes", { event: "*", schema: "public", table: "mods" }, quietRefresh)
    .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, quietRefresh)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "purchases" }, () => {
      toast("Your library just updated!", "success");
      quietRefresh();
    })
    .subscribe();
}
