// ============================================================
// Shared UI — header, footer, toasts, product cards, helpers
// ============================================================

import "./theme.js";
import "./effects.js";
import { CONFIG } from "./config.js";
import { isLive, getSession, getMyProfile, onAuthChange, KINDS, kindOf } from "./db.js";

/** Inline so it inherits the theme colour and never hits the network. */
const DISCORD_ICON = `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M20.3 4.9A19 19 0 0 0 15.6 3.4l-.2.5a17.5 17.5 0 0 1 4.1 1.4 15.5 15.5 0 0 0-15 0 17.6 17.6 0 0 1 4.1-1.4l-.2-.5A19 19 0 0 0 3.7 4.9C.8 9.2 0 13.4.4 17.5a19.2 19.2 0 0 0 5.8 2.9l1.2-1.9a12.4 12.4 0 0 1-2-1l.5-.3a13.7 13.7 0 0 0 11.7 0l.5.3a12.4 12.4 0 0 1-2 1l1.2 1.9a19.1 19.1 0 0 0 5.8-2.9c.5-4.8-.8-8.9-2.8-12.6ZM8.3 15c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2.1 1 2 2.3S9.4 15 8.3 15Zm7.4 0c-1.1 0-2-1-2-2.3s.9-2.3 2-2.3 2.1 1 2 2.3-.9 2.3-2 2.3Z"/></svg>`;

// ---------- Helpers ----------

export const money = (cents) =>
  cents === 0
    ? "Free"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/** The brand wordmark, drawn from CONFIG.BRAND so renaming is one edit. */
export const brandHtml = () =>
  `<img src="assets/favicon.svg" alt=""><span class="wordmark">${esc(CONFIG.BRAND.lead)}<span>${esc(CONFIG.BRAND.accent)}</span></span>`;

/** "Store — 0o777" */
export const pageTitle = (section) =>
  section ? `${section} — ${CONFIG.SITE_NAME}` : `${CONFIG.SITE_NAME} — ${CONFIG.SITE_TAGLINE}`;

export const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "";

/** "month" ×1 → "/mo", "month" ×3 → "/3 mo" */
export function intervalLabel(product, long = false) {
  const n = product.sub_interval_count ?? 1;
  const unit = product.sub_interval ?? "month";
  const short = { day: "day", week: "wk", month: "mo", year: "yr" }[unit] ?? unit;
  if (long) return n === 1 ? `every ${unit}` : `every ${n} ${unit}s`;
  return n === 1 ? `/${short}` : `/${n} ${short}`;
}

/** The small grey line above the price on a card. */
export function priceCaption(product) {
  const kind = kindOf(product);
  if (product.price_cents === 0) return "No charge";
  if (kind === "account") return "Per account";
  if (kind === "request") return "Per commission";
  if (kind === "subscription") return "Billed " + intervalLabel(product, true);
  return "One-time";
}

export function priceHtml(product) {
  const free = product.price_cents === 0;
  const per =
    kindOf(product) === "subscription" && !free
      ? `<span class="per">${esc(intervalLabel(product))}</span>`
      : "";
  return `<span class="price ${free ? "free" : ""}">${money(product.price_cents)}${per}</span>`;
}

/** Stock badge for account products — null for everything else. */
export function stockPillHtml(product) {
  if (kindOf(product) !== "account" || !product._stock) return "";
  const { available } = product._stock;
  if (available <= 0) return `<span class="stock-pill out">Sold out</span>`;
  const tone = available <= 5 ? "low" : "";
  return `<span class="stock-pill ${tone}">${available} left</span>`;
}

const GRADIENTS = [
  "linear-gradient(135deg, #2b2d33 0%, #101115 100%)",
  "linear-gradient(135deg, #3b1d2e 0%, #a0153e 100%)",
  "linear-gradient(135deg, #1d1e3b 0%, #4e31aa 100%)",
  "linear-gradient(135deg, #123c3a 0%, #1f8a70 100%)",
  "linear-gradient(135deg, #3b2a1d 0%, #b45309 100%)",
  "linear-gradient(135deg, #10202f 0%, #1e6091 100%)",
];

function gradientFor(text) {
  let hash = 0;
  for (const ch of String(text)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/** Card/thumbnail media: image if set, otherwise a coloured gradient with initials. */
export function mediaHtml(product, cssClass = "card-media") {
  if (product.image_url) {
    return `<div class="${cssClass}"><img src="${esc(product.image_url)}" alt="${esc(product.title)}" loading="lazy"></div>`;
  }
  const initials = esc(
    String(product.game || product.title || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase()
  );
  return `<div class="${cssClass}" style="background:${gradientFor(product.game)}">${initials}</div>`;
}

/** Was this updated after release? */
export const wasUpdated = (p) =>
  Boolean(p.updated_at && new Date(p.updated_at) - new Date(p.created_at) > 60000);

export function productCardHtml(product) {
  const kind = kindOf(product);
  const soldOut = kind === "account" && product._stock && product._stock.available <= 0;

  const badges = [
    product.featured ? `<span class="card-badge">Featured</span>` : "",
    `<span class="card-badge kind">${KINDS[kind].icon} ${KINDS[kind].label}</span>`,
  ].join("");

  const media = mediaHtml(product).replace('">', `">${badges}`);

  const meta = [
    product._rating?.count ? `<span class="star-gold">★ ${product._rating.avg.toFixed(1)}</span>` : "",
    kind === "mod" ? `<span>⬇ ${(product.downloads ?? 0).toLocaleString()}</span>` : "",
    kind === "mod" ? `<span>v${esc(product.version ?? "1.0.0")}</span>` : "",
    kind === "account" && product._stock ? `<span>${product._stock.total - product._stock.available} sold</span>` : "",
    kind === "subscription" ? `<span>Cancel any time</span>` : "",
    kind === "request" ? `<span>Built to order</span>` : "",
    wasUpdated(product) ? `<span>Updated ${formatDate(product.updated_at)}</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <a class="product-card reveal" href="#/product/${encodeURIComponent(product.id)}">
      ${media}
      <div class="card-body">
        <div class="card-title-row">
          <h3>${esc(product.title)}</h3>
          ${stockPillHtml(product)}
        </div>
        <p class="tagline">${esc(product.tagline ?? "")}</p>
        <div class="card-meta">${meta}<span class="game-tag">${esc(product.game)}</span></div>
        <div class="card-foot">
          <span class="btn ${soldOut ? "btn-ghost" : "btn-outline"} btn-sm">${soldOut ? "Sold out" : "🛒 Buy now"}</span>
          <div class="price-block">
            <small>${esc(priceCaption(product))}</small>
            ${priceHtml(product)}
          </div>
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
  { href: "#/", label: "Home" },
  { href: "#/products", label: "Store" },
  { href: "#/account", label: "Library" },
];

/** Highlight the nav link matching the current route (called by the router). */
export function setActiveNav(path) {
  document.querySelectorAll(".main-nav a").forEach((a) => {
    const linkPath = (a.getAttribute("href") ?? "").replace(/^#/, "").split("?")[0];
    const active = linkPath === path || (linkPath === "/products" && path.startsWith("/product"));
    a.classList.toggle("active", active);
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
          <a class="logo" href="#/">${brandHtml()}</a>
          <nav class="main-nav" id="main-nav">${links}</nav>
          <div class="header-actions" id="auth-area">
            <a class="icon-btn" href="${CONFIG.DISCORD_URL}" target="_blank" rel="noopener" title="Join the Discord" aria-label="Join the Discord">${DISCORD_ICON}</a>
            <a class="icon-btn" href="#/settings" title="Settings" aria-label="Settings">⚙</a>
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
            <a class="logo" href="#/" style="margin-bottom:14px">${brandHtml()}</a>
            <p>Mods, accounts and memberships — delivered the second you pay. Built and supported by one person, not a reseller farm.</p>
            <a class="btn btn-ghost btn-sm" href="${CONFIG.DISCORD_URL}" target="_blank" rel="noopener" style="margin-top:18px">${DISCORD_ICON} Join the Discord</a>
          </div>
          <div>
            <h4>Store</h4>
            <ul>
              <li><a href="#/products">All products</a></li>
              <li><a href="#/products?kind=mod">Mods</a></li>
              <li><a href="#/products?kind=account">Accounts</a></li>
              <li><a href="#/products?kind=subscription">Subscriptions</a></li>
            </ul>
          </div>
          <div>
            <h4>Account</h4>
            <ul>
              <li><a href="#/account">My library</a></li>
              <li><a href="#/settings">Settings &amp; theme</a></li>
              <li><a href="#/auth">Sign in</a></li>
            </ul>
          </div>
          <div>
            <h4>Community</h4>
            <ul>
              <li><a href="${CONFIG.DISCORD_URL}" target="_blank" rel="noopener">Discord</a></li>
              <li><a href="${CONFIG.YOUTUBE_URL}" target="_blank" rel="noopener">YouTube</a></li>
              <li><a href="${CONFIG.GITHUB_URL}" target="_blank" rel="noopener">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">© ${new Date().getFullYear()} ${esc(CONFIG.SITE_NAME)} · ${esc(CONFIG.SITE_URL.replace(/^https?:\/\//, ""))} · 🔒 Payments secured by Stripe</div>
      </footer>`;
  }
}

async function refreshAuthArea() {
  const area = document.getElementById("auth-area");
  if (!area || !isLive) return;
  const quick =
    `<a class="icon-btn" href="${CONFIG.DISCORD_URL}" target="_blank" rel="noopener" title="Join the Discord" aria-label="Join the Discord">${DISCORD_ICON}</a>` +
    `<a class="icon-btn" href="#/settings" title="Settings" aria-label="Settings">⚙</a>`;

  const session = await getSession();
  if (!session) {
    document.querySelector('#main-nav a[href="#/admin"]')?.remove();
    area.innerHTML = `
      ${quick}
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
    ${quick}
    <a class="avatar-chip" href="#/account" title="My account">
      <span class="avatar">${initial}</span> ${esc(name)}
    </a>`;

  const nav = document.getElementById("main-nav");
  const adminLink = nav?.querySelector('[href="#/admin"]');
  if (isAdmin && nav && !adminLink) {
    const a = document.createElement("a");
    a.href = "#/admin";
    a.textContent = "Admin";
    nav.appendChild(a);
  } else if (!isAdmin && adminLink) {
    adminLink.remove();
  }
}

// Auto-render on import
renderChrome();
