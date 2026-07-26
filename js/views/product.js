import {
  isLive, getProduct, getStockMap, getSession, getMyProfile, ownedCount, getMyPurchaseFor,
  claimFreeProduct, createCheckout, createBillingPortal, getDownloadUrl,
  getRatings, getMyRating, rateProduct, KINDS, kindOf, isSubActive,
} from "../db.js";
import { mediaHtml, money, esc, toast, formatDate, intervalLabel, priceHtml, wasUpdated, pageTitle } from "../ui.js";

function notFound(app) {
  app.innerHTML = `<div class="container"><div class="empty" style="padding:120px 20px">
    <div class="big">🌑</div>
    <h2 style="margin-bottom:10px">Product not found</h2>
    <p style="margin-bottom:24px">It may have been unpublished, or the link is wrong.</p>
    <a class="btn btn-primary" href="#/products">Browse the store</a>
  </div></div>`;
}

function galleryImages(product) {
  return [product.image_url, ...(Array.isArray(product.gallery) ? product.gallery : [])].filter(Boolean);
}

function galleryHtml(product) {
  const images = galleryImages(product);
  if (!images.length) return mediaHtml(product, "detail-media");
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
      <img src="${esc(images[0])}" alt="${esc(product.title)}" id="gallery-img">
      ${controls}
    </div>`;
}

function wireGallery(app, product) {
  const images = galleryImages(product);
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

  // Arrow keys flip images too; the listener retires when the route changes
  const onKey = (e) => {
    if (!document.getElementById("gallery")) return;
    if (e.key === "ArrowLeft") show(gi - 1);
    if (e.key === "ArrowRight") show(gi + 1);
  };
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", () => document.removeEventListener("keydown", onKey), { once: true });
}

/** The whole action area, which is entirely driven by the product's kind. */
function actionsHtml(product, ctx) {
  const { owned, signedIn, isAdmin, purchase } = ctx;
  const kind = kindOf(product);
  const free = product.price_cents === 0;

  if (kind === "account") {
    const available = product._stock?.available ?? 0;
    const total = product._stock?.total ?? 0;
    const pct = total ? Math.round((available / total) * 100) : 0;

    const bar = total
      ? `<div class="stock-line">
           <span><b>${available}</b> of ${total} left</span>
           <span class="stock-bar"><i style="width:${pct}%"></i></span>
         </div>`
      : `<div class="stock-line"><span>No stock loaded yet</span></div>`;

    const ownedNote = owned
      ? `<p class="owned-note">✓ You own ${owned} — the details are on your <a href="#/account" style="text-decoration:underline">account page</a></p>`
      : "";

    if (available <= 0) {
      return `${bar}${ownedNote}
        <button class="btn btn-ghost btn-block" disabled>Sold out — restocking soon</button>`;
    }
    if (free || isAdmin) {
      return `${bar}${ownedNote}
        <button class="btn btn-primary btn-block" id="claim-btn">${signedIn ? (isAdmin && !free ? "👑 Take one free (admin)" : "Claim one — Free") : "Sign in to claim one"}</button>`;
    }
    return `${bar}${ownedNote}
      <button class="btn btn-primary btn-block" id="buy-btn">${signedIn ? `${owned ? "Buy another" : "Buy now"} — ${money(product.price_cents)}` : "Sign in to buy"}</button>
      <p class="secure-note">🔒 One account is reserved for you the moment you pay</p>`;
  }

  if (kind === "subscription") {
    const active = purchase && isSubActive(purchase);
    if (active) {
      const renews = purchase.current_period_end
        ? ` Renews ${formatDate(purchase.current_period_end)}.`
        : "";
      return `
        <p class="owned-note">✓ Your membership is active.${esc(renews)}</p>
        ${product.file_path ? `<button class="btn btn-primary btn-block" id="download-btn">⬇ Download members' file</button>` : ""}
        <button class="btn btn-ghost btn-block" id="portal-btn" style="margin-top:10px">Manage or cancel subscription</button>`;
    }
    if (purchase) {
      return `
        <p class="owned-note" style="color:var(--muted)">Your last subscription ended.</p>
        <button class="btn btn-primary btn-block" id="buy-btn">${signedIn ? `Resubscribe — ${money(product.price_cents)}${intervalLabel(product)}` : "Sign in to subscribe"}</button>`;
    }
    return `
      <button class="btn btn-primary btn-block" id="buy-btn">${signedIn ? `Subscribe — ${money(product.price_cents)}${intervalLabel(product)}` : "Sign in to subscribe"}</button>
      <p class="secure-note">🔒 Cancel any time from your account page</p>`;
  }

  // kind === "mod"
  if (owned || isAdmin) {
    return `
      <p class="owned-note">${owned ? "✓ In your library" : "👑 Admin — everything is free for you"}</p>
      <button class="btn btn-primary btn-block" id="download-btn">⬇ Download latest version</button>
      ${!owned && isAdmin ? `<button class="btn btn-ghost btn-sm btn-block" id="claim-btn" style="margin-top:10px">＋ Add to my library</button>` : ""}`;
  }
  if (free) {
    return `<button class="btn btn-primary btn-block" id="claim-btn">${signedIn ? "Add to library — Free" : "Sign in to get it free"}</button>`;
  }
  return `
    <button class="btn btn-primary btn-block" id="buy-btn">${signedIn ? `Buy now — ${money(product.price_cents)}` : "Sign in to buy"}</button>
    <p class="secure-note">🔒 Secure checkout powered by Stripe</p>`;
}

function metaListHtml(product) {
  const kind = kindOf(product);
  const rows = [["Type", `${KINDS[kind].icon} ${KINDS[kind].label}`]];

  if (kind === "mod") {
    rows.push(["Version", esc(product.version ?? "1.0.0")]);
    rows.push(["Downloads", (product.downloads ?? 0).toLocaleString()]);
  }
  if (kind === "account" && product._stock) {
    rows.push(["In stock", `${product._stock.available}`]);
    rows.push(["Sold", `${product._stock.total - product._stock.available}`]);
  }
  if (kind === "subscription") {
    rows.push(["Billing", `${money(product.price_cents)} ${intervalLabel(product, true)}`]);
  }

  rows.push(["Category", esc(product.game)]);
  rows.push(["Released", formatDate(product.created_at)]);
  if (wasUpdated(product)) {
    rows.push(["Updated", `${formatDate(product.updated_at)} <span class="fresh">NEW</span>`]);
  }

  return `<ul class="meta-list">${rows
    .map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`)
    .join("")}</ul>`;
}

export async function productView(app, { id }) {
  if (!id) return notFound(app);

  app.innerHTML = `<div class="container"><div class="detail-grid">
    <div class="skeleton" style="min-height:340px"></div>
    <div class="skeleton" style="min-height:340px"></div>
  </div></div>`;

  let product;
  try {
    product = await getProduct(id);
  } catch (err) {
    toast(err.message, "error");
    return notFound(app);
  }
  if (!product) return notFound(app);

  document.title = pageTitle(product.title);
  const kind = kindOf(product);

  if (kind === "account") {
    product._stock = (await getStockMap().catch(() => ({})))[product.id] ??
      product._stock ?? { available: 0, total: 0 };
  }

  const session = isLive ? await getSession() : null;
  const [owned, purchase] = session
    ? await Promise.all([
        ownedCount(product.id).catch(() => 0),
        getMyPurchaseFor(product.id).catch(() => null),
      ])
    : [0, null];

  let isAdmin = false;
  if (session) {
    try { isAdmin = Boolean((await getMyProfile())?.is_admin); } catch { /* not fatal */ }
  }

  const [ratingsMap, myRating] = await Promise.all([
    getRatings().catch(() => ({})),
    getMyRating(product.id).catch(() => null),
  ]);
  const rating = ratingsMap[product.id];
  const canRate = Boolean(session) && (owned > 0 || isAdmin);

  const ctx = { owned, signedIn: Boolean(session), isAdmin, purchase };

  app.innerHTML = `
    <div class="container">
      <div class="detail-grid">
        <div class="reveal">
          ${galleryHtml(product)}
          <div class="detail-desc" style="padding-top:36px">
            <h2>About this ${esc(KINDS[kind].noun)}</h2>
            <p>${esc(product.description ?? product.tagline ?? "")}</p>
          </div>
        </div>
        <div class="detail-info reveal">
          <div class="meta">
            <span class="game-tag">${esc(product.game)}</span>
            <span class="game-tag">${KINDS[kind].icon} ${KINDS[kind].label}</span>
            ${product.featured ? `<span class="card-badge" style="position:static">Featured</span>` : ""}
          </div>
          <h1>${esc(product.title)}</h1>
          <p class="tagline">${esc(product.tagline ?? "")}</p>
          <div class="buy-box">
            ${priceHtml(product)}
            <div id="buy-area">${actionsHtml(product, ctx)}</div>
          </div>
          ${metaListHtml(product)}
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
                 <p class="rate-hint">${myRating ? `Your rating: ${myRating}/5 — click a star to change it` : "Click a star to rate this"}</p>`
              : `<p class="rate-hint">${session ? "Buy this to rate it" : "Sign in and buy this to rate it"}</p>`}
          </div>
        </div>
      </div>
    </div>`;

  wireGallery(app, product);

  const rateRow = app.querySelector("#rate-row");
  if (rateRow) {
    const btns = [...rateRow.querySelectorAll(".star-btn")];
    const paint = (n) => btns.forEach((b, i) => b.classList.toggle("on", i < n));
    btns.forEach((b, i) =>
      b.addEventListener("click", async () => {
        try {
          await rateProduct(product.id, i + 1);
          toast(`Rated ${i + 1}/5 — thanks!`, "success");
          productView(app, { id });
        } catch (err) {
          toast(
            /row-level security/i.test(err.message) ? "You need to own this to rate it." : err.message,
            "error"
          );
        }
      })
    );
    btns.forEach((b, i) => b.addEventListener("mouseenter", () => paint(i + 1)));
    rateRow.addEventListener("mouseleave", () => paint(myRating ?? 0));
  }

  const goSignIn = () =>
    (location.hash = `#/auth?next=${encodeURIComponent(`#/product/${product.id}`)}`);

  app.querySelector("#buy-btn")?.addEventListener("click", async (e) => {
    if (!session) return goSignIn();
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Opening checkout…";
    try {
      location.href = await createCheckout(product.id);
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  app.querySelector("#claim-btn")?.addEventListener("click", async (e) => {
    if (!session) return goSignIn();
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await claimFreeProduct(product);
      toast(kind === "account" ? "Account claimed — check your library!" : "Added to your library!", "success");
      productView(app, { id });
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
    }
  });

  app.querySelector("#download-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Preparing download…";
    try {
      location.href = await getDownloadUrl(product);
      toast("Download started!", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  app.querySelector("#portal-btn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Opening billing portal…";
    try {
      location.href = await createBillingPortal();
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
      btn.textContent = "Manage or cancel subscription";
    }
  });
}
