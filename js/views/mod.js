import {
  isLive, getMod, getSession, getMyProfile, ownsMod, claimFreeMod, createCheckout, getDownloadUrl,
  getRatings, getMyRating, rateMod,
} from "../db.js";
import { mediaHtml, money, esc, toast } from "../ui.js";

function notFound(app) {
  app.innerHTML = `<div class="container"><div class="empty" style="padding:120px 20px">
    <div class="big">🌑</div>
    <h2 style="margin-bottom:10px">Mod not found</h2>
    <p style="margin-bottom:24px">It may have been unpublished or the link is wrong.</p>
    <a class="btn btn-primary" href="#/mods">Browse all mods</a>
  </div></div>`;
}

function galleryImages(mod) {
  return [mod.image_url, ...(Array.isArray(mod.gallery) ? mod.gallery : [])].filter(Boolean);
}

function galleryHtml(mod) {
  const images = galleryImages(mod);
  if (!images.length) return mediaHtml(mod, "detail-media");
  const controls =
    images.length > 1
      ? `
        <button class="gallery-btn prev" id="g-prev" aria-label="Previous image">‹</button>
        <button class="gallery-btn next" id="g-next" aria-label="Next image">›</button>
        <span class="gallery-count" id="g-count">1 / ${images.length}</span>
        <div class="gallery-dots">${images
          .map((_, i) => `<button data-i="${i}" class="${i === 0 ? "active" : ""}" aria-label="Image ${i + 1}"></button>`)
          .join("")}</div>`
      : "";
  return `
    <div class="detail-media gallery" id="gallery">
      <img src="${esc(images[0])}" alt="${esc(mod.title)}" id="gallery-img">
      ${controls}
    </div>`;
}

function wireGallery(app, mod) {
  const images = galleryImages(mod);
  if (images.length < 2) return;

  let gi = 0;
  const img = app.querySelector("#gallery-img");
  const count = app.querySelector("#g-count");
  const dots = [...app.querySelectorAll(".gallery-dots button")];

  const show = (i) => {
    gi = (i + images.length) % images.length;
    img.classList.add("fading");
    setTimeout(() => {
      img.src = images[gi];
      img.classList.remove("fading");
    }, 150);
    count.textContent = `${gi + 1} / ${images.length}`;
    dots.forEach((d, di) => d.classList.toggle("active", di === gi));
  };

  app.querySelector("#g-prev").addEventListener("click", () => show(gi - 1));
  app.querySelector("#g-next").addEventListener("click", () => show(gi + 1));
  dots.forEach((d) => d.addEventListener("click", () => show(Number(d.dataset.i))));

  // Arrow keys flip images too; listener retires when the route changes
  const onKey = (e) => {
    if (!document.getElementById("gallery")) return;
    if (e.key === "ArrowLeft") show(gi - 1);
    if (e.key === "ArrowRight") show(gi + 1);
  };
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", () => document.removeEventListener("keydown", onKey), { once: true });
}

function buyButtonHtml(mod, owned, signedIn, isAdmin) {
  if (owned || isAdmin) {
    return `
      <p class="owned-note">${owned ? "✓ In your library" : "👑 Admin — every mod is free for you"}</p>
      <button class="btn btn-primary btn-block" id="download-btn">⬇ Download latest version</button>
      ${!owned && isAdmin ? `<button class="btn btn-ghost btn-sm btn-block" id="claim-btn" style="margin-top:10px">＋ Add to my library</button>` : ""}`;
  }
  if (mod.price_cents === 0) {
    return `<button class="btn btn-primary btn-block" id="claim-btn">${signedIn ? "Add to library — Free" : "Sign in to get it free"}</button>`;
  }
  return `<button class="btn btn-primary btn-block" id="buy-btn">${signedIn ? `Buy now — ${money(mod.price_cents)}` : "Sign in to buy"}</button>
    <p class="secure-note">🔒 Secure checkout powered by Stripe</p>`;
}

export async function modView(app, { id }) {
  if (!id) return notFound(app);

  app.innerHTML = `<div class="container"><div class="detail-grid">
    <div class="skeleton" style="min-height:340px"></div>
    <div class="skeleton" style="min-height:340px"></div>
  </div></div>`;

  let mod;
  try {
    mod = await getMod(id);
  } catch (err) {
    toast(err.message, "error");
    return notFound(app);
  }
  if (!mod) return notFound(app);

  document.title = `${mod.title} — JustLoofy Mods`;

  const session = isLive ? await getSession() : null;
  const owned = session ? await ownsMod(mod.id).catch(() => false) : false;
  let isAdmin = false;
  if (session) {
    try { isAdmin = Boolean((await getMyProfile())?.is_admin); } catch { /* not fatal */ }
  }

  const [ratingsMap, myRating] = await Promise.all([
    getRatings().catch(() => ({})),
    getMyRating(mod.id).catch(() => null),
  ]);
  const rating = ratingsMap[mod.id];
  const canRate = Boolean(session) && (owned || isAdmin);
  const released = new Date(mod.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  app.innerHTML = `
    <div class="container">
      <div class="detail-grid">
        <div class="reveal">
          ${galleryHtml(mod)}
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
            <div id="buy-area">${buyButtonHtml(mod, owned, Boolean(session), isAdmin)}</div>
          </div>
          <ul class="meta-list">
            <li><span>Version</span><span>${esc(mod.version ?? "1.0.0")}</span></li>
            <li><span>Game</span><span>${esc(mod.game)}</span></li>
            <li><span>Downloads</span><span>${(mod.downloads ?? 0).toLocaleString()}</span></li>
            <li><span>Released</span><span>${released}</span></li>
          </ul>
          <div class="rating-box">
            <div class="rating-summary">
              <span class="stars-avg">${[1, 2, 3, 4, 5]
                .map((i) => `<span class="star ${rating && i <= Math.round(rating.avg) ? "on" : ""}">★</span>`)
                .join("")}</span>
              <span>${rating ? `${rating.avg.toFixed(1)} · ${rating.count} rating${rating.count === 1 ? "" : "s"}` : "No ratings yet"}</span>
            </div>
            ${canRate
              ? `<div class="rate-row" id="rate-row">
                   ${[1, 2, 3, 4, 5]
                     .map((i) => `<button class="star-btn ${myRating && i <= myRating ? "on" : ""}" data-stars="${i}" aria-label="Rate ${i} star${i === 1 ? "" : "s"}">★</button>`)
                     .join("")}
                 </div>
                 <p class="rate-hint">${myRating ? `Your rating: ${myRating}/5 — click a star to change it` : "Click a star to rate this mod"}</p>`
              : `<p class="rate-hint">${session ? "Get this mod to rate it" : "Sign in and get this mod to rate it"}</p>`}
          </div>
        </div>
      </div>
    </div>`;

  wireGallery(app, mod);

  const rateRow = app.querySelector("#rate-row");
  if (rateRow) {
    const btns = [...rateRow.querySelectorAll(".star-btn")];
    const paint = (n) => btns.forEach((b, i) => b.classList.toggle("on", i < n));
    btns.forEach((b, i) =>
      b.addEventListener("click", async () => {
        try {
          await rateMod(mod.id, i + 1);
          toast(`Rated ${i + 1}/5 — thanks!`, "success");
          modView(app, { id });
        } catch (err) {
          toast(
            /row-level security/i.test(err.message) ? "You need to own this mod to rate it." : err.message,
            "error"
          );
        }
      })
    );
    btns.forEach((b, i) => b.addEventListener("mouseenter", () => paint(i + 1)));
    rateRow.addEventListener("mouseleave", () => paint(myRating ?? 0));
  }

  const goSignIn = () =>
    (location.hash = `#/auth?next=${encodeURIComponent(`#/mod/${mod.id}`)}`);

  app.querySelector("#buy-btn")?.addEventListener("click", async (e) => {
    if (!session) return goSignIn();
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

  app.querySelector("#claim-btn")?.addEventListener("click", async (e) => {
    if (!session) return goSignIn();
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await claimFreeMod(mod);
      toast("Added to your library!", "success");
      modView(app, { id });
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
    }
  });

  app.querySelector("#download-btn")?.addEventListener("click", async (e) => {
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
      btn.textContent = "⬇ Download latest version";
    }
  });
}
