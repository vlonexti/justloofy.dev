import {
  isLive, getMod, getSession, ownsMod, claimFreeMod, createCheckout, getDownloadUrl,
} from "../db.js";
import { mediaHtml, money, esc, toast } from "../ui.js";

const root = document.getElementById("detail-root");
const modId = new URLSearchParams(location.search).get("id");

function notFound() {
  root.innerHTML = `<div class="empty" style="padding:120px 20px">
    <div class="big">🌑</div>
    <h2 style="margin-bottom:10px">Mod not found</h2>
    <p style="margin-bottom:24px">It may have been unpublished or the link is wrong.</p>
    <a class="btn btn-primary" href="mods.html">Browse all mods</a>
  </div>`;
}

function buyButtonHtml(mod, owned, signedIn) {
  if (owned) {
    return `
      <p class="owned-note">✓ In your library</p>
      <button class="btn btn-primary btn-block" id="download-btn">Download latest version</button>`;
  }
  if (mod.price_cents === 0) {
    return `<button class="btn btn-primary btn-block" id="claim-btn">${signedIn ? "Add to library — Free" : "Sign in to get it free"}</button>`;
  }
  return `<button class="btn btn-primary btn-block" id="buy-btn">${signedIn ? `Buy now — ${money(mod.price_cents)}` : "Sign in to buy"}</button>`;
}

async function render() {
  if (!modId) return notFound();

  let mod;
  try {
    mod = await getMod(modId);
  } catch (err) {
    toast(err.message, "error");
    return notFound();
  }
  if (!mod) return notFound();

  document.title = `${mod.title} — JustLoofy Mods`;

  const session = isLive ? await getSession() : null;
  const owned = session ? await ownsMod(mod.id).catch(() => false) : false;
  const released = new Date(mod.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  root.innerHTML = `
    <div class="detail-grid">
      <div class="reveal">
        ${mediaHtml(mod, "detail-media")}
        <div class="detail-desc" style="padding-top:36px">
          <h2>About this mod</h2>
          <p>${esc(mod.description ?? mod.tagline ?? "")}</p>
        </div>
      </div>
      <div class="detail-info reveal">
        <div class="meta">
          <span class="game-tag">${esc(mod.game)}</span>
          ${mod.featured ? `<span class="card-badge" style="position:static">Featured</span>` : ""}
        </div>
        <h1>${esc(mod.title)}</h1>
        <p class="tagline">${esc(mod.tagline ?? "")}</p>
        <div class="buy-box">
          <span class="price ${mod.price_cents === 0 ? "free" : ""}">${money(mod.price_cents)}</span>
          <div id="buy-area">${buyButtonHtml(mod, owned, Boolean(session))}</div>
        </div>
        <ul class="meta-list">
          <li><span>Version</span><span>${esc(mod.version ?? "1.0.0")}</span></li>
          <li><span>Game</span><span>${esc(mod.game)}</span></li>
          <li><span>Downloads</span><span>${(mod.downloads ?? 0).toLocaleString()}</span></li>
          <li><span>Released</span><span>${released}</span></li>
        </ul>
      </div>
    </div>`;

  wireButtons(mod, Boolean(session));
}

function wireButtons(mod, signedIn) {
  const goSignIn = () => (location.href = `auth.html?next=${encodeURIComponent(location.pathname + location.search)}`);

  document.getElementById("buy-btn")?.addEventListener("click", async (e) => {
    if (!signedIn) return goSignIn();
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Opening checkout…";
    try {
      location.href = await createCheckout(mod.id);
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
      btn.textContent = `Buy now — ${money(mod.price_cents)}`;
    }
  });

  document.getElementById("claim-btn")?.addEventListener("click", async (e) => {
    if (!signedIn) return goSignIn();
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await claimFreeMod(mod);
      toast("Added to your library!", "success");
      render();
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
    }
  });

  document.getElementById("download-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Preparing download…";
    try {
      const url = await getDownloadUrl(mod);
      location.href = url;
      toast("Download started!", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Download latest version";
    }
  });
}

render();
