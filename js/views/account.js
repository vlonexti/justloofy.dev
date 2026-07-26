import {
  isLive, getSession, getMyProfile, getMyPurchases, signOut,
  getDownloadUrl, createBillingPortal, KINDS, kindOf, isSubActive,
} from "../db.js";
import { mediaHtml, money, esc, toast, formatDate, intervalLabel, pageTitle } from "../ui.js";

/** One row in the library — what it offers depends on what was bought. */
function itemHtml(purchase, index) {
  const product = purchase.mods;
  if (!product) return "";
  const kind = kindOf(purchase.kind ? purchase : product);

  let action = "";
  let extra = "";

  if (kind === "account") {
    const credential = purchase.stock_items?.[0]?.content;
    extra = credential
      ? `<div class="credential-box masked" data-box="${index}">
           <code>${esc(credential)}</code>
           <div class="credential-actions">
             <button class="btn btn-ghost btn-sm reveal-btn" data-box="${index}">👁 Reveal</button>
             <button class="btn btn-primary btn-sm copy-btn" data-copy="${esc(credential)}">Copy</button>
           </div>
         </div>`
      : `<div class="credential-box"><code>Your account details are being assigned — refresh in a moment.</code></div>`;
  } else if (kind === "subscription") {
    const active = isSubActive(purchase);
    action = `<button class="btn btn-ghost btn-sm portal-btn">Manage</button>`;
    extra = `<div style="flex-basis:100%;font-size:0.82rem;color:var(--muted)">
        <span class="sub-status ${active ? "" : "ended"}">${active ? "Active" : (purchase.sub_status ?? "ended")}</span>
        ${purchase.current_period_end
          ? ` · ${active ? "renews" : "ended"} ${esc(formatDate(purchase.current_period_end))}`
          : ""}
        · ${esc(money(purchase.amount_cents))} ${esc(intervalLabel(product, true))}
      </div>`;
    if (active && product.file_path) {
      action = `<button class="btn btn-primary btn-sm dl-btn" data-id="${esc(product.id)}">⬇ Download</button>` + action;
    }
  } else {
    action = `<button class="btn btn-primary btn-sm dl-btn" data-id="${esc(product.id)}">⬇ Download</button>`;
  }

  const sub =
    kind === "mod"
      ? `${esc(product.game)} · v${esc(product.version ?? "1.0.0")}`
      : `${esc(product.game)} · ${KINDS[kind].label}`;

  return `
    <div class="library-item">
      ${mediaHtml(product, "thumb")}
      <div class="info">
        <b>${esc(product.title)}</b>
        <span>${sub} · ${purchase.amount_cents === 0 ? "Free" : esc(money(purchase.amount_cents))} · ${esc(formatDate(purchase.created_at))}</span>
      </div>
      ${action}
      ${extra}
    </div>`;
}

export async function accountView(app) {
  document.title = pageTitle("My library");

  const head = `
    <div class="page-head">
      <h1>My library</h1>
      <p>Everything you own, in one place. Downloads never expire and mod updates are always free.</p>
    </div>`;

  const session = isLive ? await getSession() : null;
  if (!session) {
    app.innerHTML = `<div class="container">${head}
      <div class="empty" style="padding:90px 20px">
        <div class="big">🔒</div>
        <h2 style="margin-bottom:10px">${isLive ? "Sign in to view your library" : "Demo mode"}</h2>
        <p style="margin-bottom:24px">${
          isLive
            ? "Your mods, accounts and memberships all live here once you're signed in."
            : "Accounts unlock once Supabase is connected — see README.md."
        }</p>
        ${isLive
          ? `<a class="btn btn-primary" href="#/auth">Sign in</a>`
          : `<a class="btn btn-primary" href="#/products">Browse the store</a>`}
      </div></div>`;
    return;
  }

  let profile = null;
  try { profile = await getMyProfile(); } catch { /* row may not exist yet */ }
  const name = profile?.username || session.user.email;

  let purchases = [];
  try { purchases = await getMyPurchases(); } catch (err) { toast(err.message, "error"); }

  const hasSubscription = purchases.some((p) => kindOf(p) === "subscription");

  const libraryHtml = purchases.length
    ? purchases.map(itemHtml).join("")
    : `<div class="empty" style="padding:40px 20px">
         <div class="big">📦</div>
         <p style="margin-bottom:18px">Your library is empty — go grab something!</p>
         <a class="btn btn-outline btn-sm" href="#/products">Browse the store</a>
       </div>`;

  app.innerHTML = `<div class="container">${head}
    <div class="account-grid">
      <div class="panel reveal">
        <div class="profile-avatar">${esc(name[0]?.toUpperCase() ?? "?")}</div>
        <div class="profile-name">${esc(name)}</div>
        <div class="profile-email">${esc(session.user.email)}</div>

        <a class="btn btn-ghost btn-sm btn-block" href="#/settings" style="margin-bottom:10px">⚙ Settings &amp; theme</a>
        ${hasSubscription
          ? `<button class="btn btn-ghost btn-sm btn-block portal-btn" style="margin-bottom:10px">💳 Billing portal</button>`
          : ""}
        <button class="btn btn-danger btn-sm btn-block" id="signout-btn">Sign out</button>
      </div>

      <div class="panel reveal">
        <h2>Owned (${purchases.length})</h2>
        <p class="panel-sub">Account credentials are hidden until you reveal them, so nobody reads them over your shoulder.</p>
        <div id="library">${libraryHtml}</div>
      </div>
    </div></div>`;

  app.querySelector("#signout-btn").addEventListener("click", async () => {
    await signOut();
    location.hash = "#/";
  });

  app.querySelectorAll(".reveal-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const box = app.querySelector(`.credential-box[data-box="${btn.dataset.box}"]`);
      const masked = box.classList.toggle("masked");
      btn.textContent = masked ? "👁 Reveal" : "🙈 Hide";
    })
  );

  app.querySelectorAll(".copy-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        toast("Copied to your clipboard.", "success");
      } catch {
        toast("Your browser blocked the clipboard — select the text and copy it manually.", "error");
      }
    })
  );

  app.querySelectorAll(".dl-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const purchase = purchases.find((p) => p.mods?.id === btn.dataset.id);
      if (!purchase) return;
      btn.disabled = true;
      btn.textContent = "Preparing…";
      try {
        location.href = await getDownloadUrl(purchase.mods);
        toast("Download started!", "success");
      } catch (err) {
        toast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "⬇ Download";
      }
    })
  );

  app.querySelectorAll(".portal-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Opening…";
      try {
        location.href = await createBillingPortal();
      } catch (err) {
        toast(err.message, "error");
        btn.disabled = false;
        btn.textContent = original;
      }
    })
  );
}
