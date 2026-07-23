// ============================================================
// Shared UI — header, footer, toasts, mod cards, helpers
// ============================================================

import "./effects.js";
import { CONFIG } from "./config.js";
import { isLive, getSession, getMyProfile, onAuthChange } from "./db.js";

// ---------- Helpers ----------

export const money = (cents) =>
  cents === 0
    ? "Free"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const GRADIENTS = [
  "linear-gradient(135deg, #3b1d2e 0%, #a0153e 100%)",
  "linear-gradient(135deg, #1d1e3b 0%, #4e31aa 100%)",
  "linear-gradient(135deg, #123c3a 0%, #1f8a70 100%)",
  "linear-gradient(135deg, #3b2a1d 0%, #b45309 100%)",
  "linear-gradient(135deg, #10202f 0%, #1e6091 100%)",
  "linear-gradient(135deg, #2f1d3b 0%, #8e3a9e 100%)",
];

function gradientFor(text) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/** Card/thumbnail media: image if set, otherwise a game-coloured gradient with initials. */
export function mediaHtml(mod, cssClass = "card-media") {
  if (mod.image_url) {
    return `<div class="${cssClass}"><img src="${esc(mod.image_url)}" alt="${esc(mod.title)}" loading="lazy"></div>`;
  }
  const initials = esc(
    String(mod.game || mod.title || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase()
  );
  return `<div class="${cssClass}" style="background:${gradientFor(mod.game)}">${initials}</div>`;
}

export function modCardHtml(mod) {
  const badge = mod.featured ? `<span class="card-badge">Featured</span>` : "";
  const cta = `<span class="card-cta">View mod →</span>`;
  const media = mediaHtml(mod).replace('">', `">${badge}${cta}`);
  return `
    <a class="mod-card reveal" href="#/mod/${encodeURIComponent(mod.id)}">
      ${media}
      <div class="card-body">
        <h3>${esc(mod.title)}</h3>
        <p class="tagline">${esc(mod.tagline ?? "")}</p>
        <div class="card-meta">
          <span>⬇ ${(mod.downloads ?? 0).toLocaleString()} downloads</span>
          <span>v${esc(mod.version ?? "1.0.0")}</span>
        </div>
        <div class="card-foot">
          <span class="price ${mod.price_cents === 0 ? "free" : ""}">${money(mod.price_cents)}</span>
          <span class="game-tag">${esc(mod.game)}</span>
        </div>
      </div>
    </a>`;
}

// ---------- Toasts ----------

export function toast(message, type = "") {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    document.body.appendChild(root);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ---------- Header / footer ----------

const NAV_LINKS = [
  { href: "#/", label: "Home", path: "/" },
  { href: "#/mods", label: "Mods", path: "/mods" },
];

/** Highlight the nav link matching the current route (called by the router). */
export function setActiveNav(path) {
  document.querySelectorAll(".main-nav a").forEach((a) => {
    const linkPath = (a.getAttribute("href") ?? "").replace(/^#/, "").split("?")[0];
    a.classList.toggle("active", linkPath === path);
  });
}

export function closeMobileNav() {
  document.getElementById("main-nav")?.classList.remove("open");
}

export async function renderChrome() {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");

  if (header) {
    const links = NAV_LINKS.map((l) => `<a href="${l.href}">${l.label}</a>`).join("");

    header.innerHTML = `
      ${isLive ? "" : `<div class="demo-banner"><b>Demo mode</b> — sample data shown. Connect Supabase &amp; Stripe (see README) to go live.</div>`}
      <div class="site-header">
        <div class="container header-inner">
          <a class="logo" href="#/">
            <img src="assets/favicon.svg" alt="">
            Just<span>Loofy</span>
          </a>
          <nav class="main-nav" id="main-nav">${links}</nav>
          <div class="header-actions" id="auth-area">
            <a class="btn btn-ghost btn-sm" href="#/auth">Sign in</a>
            <a class="btn btn-primary btn-sm" href="#/auth?tab=signup">Sign up</a>
          </div>
          <button class="nav-toggle" id="nav-toggle" aria-label="Menu">☰</button>
        </div>
      </div>`;

    document.getElementById("nav-toggle")?.addEventListener("click", () => {
      document.getElementById("main-nav")?.classList.toggle("open");
    });

    refreshAuthArea();
    onAuthChange(() => refreshAuthArea());
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-inner">
          <div>
            <a class="logo" href="#/" style="margin-bottom:14px">
              <img src="assets/favicon.svg" alt=""> Just<span>Loofy</span>
            </a>
            <p>Handcrafted game mods, built with love and tested to death. New drops announced on the channel.</p>
          </div>
          <div>
            <h4>Store</h4>
            <ul>
              <li><a href="#/mods">All mods</a></li>
              <li><a href="#/account">My library</a></li>
              <li><a href="#/auth">Sign in</a></li>
            </ul>
          </div>
          <div>
            <h4>Community</h4>
            <ul>
              <li><a href="${CONFIG.YOUTUBE_URL}" target="_blank" rel="noopener">YouTube</a></li>
              <li><a href="${CONFIG.GITHUB_URL}" target="_blank" rel="noopener">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">© ${new Date().getFullYear()} ${esc(CONFIG.SITE_NAME)} · justloofy.dev · 🔒 Payments secured by Stripe</div>
      </footer>`;
  }
}

async function refreshAuthArea() {
  const area = document.getElementById("auth-area");
  if (!area || !isLive) return;
  const session = await getSession();
  if (!session) {
    area.innerHTML = `
      <a class="btn btn-ghost btn-sm" href="#/auth">Sign in</a>
      <a class="btn btn-primary btn-sm" href="#/auth?tab=signup">Sign up</a>`;
    return;
  }
  let name = session.user.email;
  let isAdmin = false;
  try {
    const profile = await getMyProfile();
    if (profile?.username) name = profile.username;
    isAdmin = Boolean(profile?.is_admin);
  } catch { /* profile row may not exist yet */ }

  const initial = esc(name[0]?.toUpperCase() ?? "?");
  area.innerHTML = `
    ${isAdmin ? `<a class="btn btn-ghost btn-sm" href="#/admin">Admin</a>` : ""}
    <a class="avatar-chip" href="#/account" title="My account">
      <span class="avatar">${initial}</span> ${esc(name)}
    </a>`;

  const nav = document.getElementById("main-nav");
  if (isAdmin && nav && !nav.querySelector('[href="#/admin"]')) {
    const a = document.createElement("a");
    a.href = "#/admin";
    a.textContent = "Admin";
    nav.appendChild(a);
  }
}

// Auto-render on import
renderChrome();
