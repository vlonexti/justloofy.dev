import {
  isLive, getSession, getMyProfile, getMyPurchases, getMyRequests, signOut,
  getDownloadUrl, getRequestDownloadUrl, createRequest, updateRequestBrief,
  createBillingPortal, KINDS, kindOf, isSubActive, REQUEST_STATUS,
} from "../db.js";
import { mediaHtml, money, esc, toast, formatDate, intervalLabel, pageTitle } from "../ui.js";

/** The brief form, or the state of the commission once it's been sent. */
function requestBlockHtml(purchase, request, index) {
  if (!request) {
    return `
      <form class="request-block brief-form" data-i="${index}"
            data-purchase="${esc(purchase.id)}" data-mod="${esc(purchase.mod_id)}">
        <b class="request-head">✍️ Tell me what to build</b>
        <p class="field-hint" style="margin:0 0 14px">
          You've paid for this commission — the more detail here, the closer the result.
        </p>
        <div class="field-row">
          <div class="field">
            <label for="r-title-${index}">What do you want made?</label>
            <input id="r-title-${index}" name="title" required maxlength="120" placeholder="Bunnyhop script with a toggle key">
          </div>
          <div class="field">
            <label for="r-game-${index}">Game / platform</label>
            <input id="r-game-${index}" name="game" maxlength="60" placeholder="CS2">
          </div>
        </div>
        <div class="field">
          <label for="r-details-${index}">The details</label>
          <textarea id="r-details-${index}" name="details" required
                    placeholder="Features, how it should behave, anything it must not do, deadlines..."></textarea>
        </div>
        <div class="field">
          <label for="r-ref-${index}">Reference link (optional)</label>
          <input id="r-ref-${index}" name="reference" type="url" placeholder="https://youtu.be/... a clip of what you mean">
        </div>
        <button class="btn btn-primary btn-sm" type="submit">Send the brief</button>
      </form>`;
  }

  const status = REQUEST_STATUS[request.status] ?? REQUEST_STATUS.new;
  const editable = request.status === "new";
  // The build is what matters, not the label on it — if a file has been
  // attached, the buyer can download it whatever the status says.
  const delivered = Boolean(request.file_path);

  return `
    <div class="request-block" data-i="${index}">
      <div class="request-head">
        <b>${esc(request.title)}</b>
        <span class="pill ${status.tone}">${esc(status.label)}</span>
      </div>
      <p class="request-details">${esc(request.details)}</p>
      ${request.reference_url
        ? `<p class="field-hint"><a href="${esc(request.reference_url)}" target="_blank" rel="noopener" style="text-decoration:underline">Reference link</a></p>`
        : ""}
      ${request.admin_note
        ? `<p class="request-note"><b>Note from me:</b> ${esc(request.admin_note)}</p>`
        : ""}

      ${delivered
        ? `<div class="delivery-box">
             <div>
               <b>📦 Your build is ready</b>
               <div class="field-hint" style="margin:2px 0 0">
                 Delivered ${esc(formatDate(request.delivered_at ?? request.updated_at))} · yours to re-download any time
               </div>
             </div>
             <button class="btn btn-primary btn-sm req-dl-btn" data-id="${esc(request.id)}">⬇ Download</button>
           </div>`
        : ""}

      ${editable
        ? `<div class="credential-actions" style="margin-top:12px">
             <button class="btn btn-ghost btn-sm edit-brief-btn" data-i="${index}">Edit the brief</button>
           </div>
           <form class="brief-form" data-i="${index}" data-id="${esc(request.id)}" hidden style="margin-top:14px">
             <div class="field-row">
               <div class="field">
                 <label for="e-title-${index}">What do you want made?</label>
                 <input id="e-title-${index}" name="title" required maxlength="120" value="${esc(request.title)}">
               </div>
               <div class="field">
                 <label for="e-game-${index}">Game / platform</label>
                 <input id="e-game-${index}" name="game" maxlength="60" value="${esc(request.game ?? "")}">
               </div>
             </div>
             <div class="field">
               <label for="e-details-${index}">The details</label>
               <textarea id="e-details-${index}" name="details" required>${esc(request.details)}</textarea>
             </div>
             <div class="field">
               <label for="e-ref-${index}">Reference link (optional)</label>
               <input id="e-ref-${index}" name="reference" type="url" value="${esc(request.reference_url ?? "")}">
             </div>
             <button class="btn btn-primary btn-sm" type="submit">Save the brief</button>
           </form>`
        : ""}
    </div>`;
}

/** One row in the library — what it offers depends on what was bought. */
function itemHtml(purchase, index, requestsByPurchase) {
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
  } else if (kind === "request") {
    extra = requestBlockHtml(purchase, requestsByPurchase[purchase.id], index);
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
            ? "Your mods, accounts, commissions and memberships all live here once you're signed in."
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
  let requests = [];
  try {
    [purchases, requests] = await Promise.all([
      getMyPurchases(),
      getMyRequests().catch(() => []),
    ]);
  } catch (err) { toast(err.message, "error"); }

  const requestsByPurchase = Object.fromEntries(requests.map((r) => [r.purchase_id, r]));
  const hasSubscription = purchases.some((p) => kindOf(p) === "subscription");
  const awaitingBrief = purchases.filter(
    (p) => kindOf(p) === "request" && !requestsByPurchase[p.id]
  ).length;

  let filter = "all";

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
        <p class="panel-sub">
          Account credentials are hidden until you reveal them, so nobody reads them over your shoulder.
          ${awaitingBrief
            ? `<br><b style="color:var(--warn)">${awaitingBrief} commission${awaitingBrief === 1 ? "" : "s"} still need${awaitingBrief === 1 ? "s" : ""} a brief — fill it in below so I can start.</b>`
            : ""}
        </p>
        <div class="chips" id="library-filter" style="margin-bottom:18px"></div>
        <div id="library"></div>
      </div>
    </div></div>`;

  // ---- filter + list ----

  function paint() {
    // Only offer filters for things this person actually owns, so the row
    // stays short. Requests are always worth their own tab once one exists.
    const owned = [...new Set(purchases.map((p) => kindOf(p)))];
    const chips = app.querySelector("#library-filter");
    chips.innerHTML =
      owned.length > 1
        ? [["all", "Everything"], ...owned.map((k) => [k, `${KINDS[k].icon} ${KINDS[k].label}s`])]
            .map(([id, label]) => {
              const n = id === "all" ? purchases.length : purchases.filter((p) => kindOf(p) === id).length;
              return `<button class="chip ${id === filter ? "active" : ""}" data-filter="${id}">${label} <span style="opacity:.6">${n}</span></button>`;
            })
            .join("")
        : "";

    chips.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        filter = chip.dataset.filter;
        paint();
      })
    );

    const shown = purchases.filter((p) => filter === "all" || kindOf(p) === filter);
    const list = app.querySelector("#library");

    list.innerHTML = shown.length
      ? shown.map((p) => itemHtml(p, purchases.indexOf(p), requestsByPurchase)).join("")
      : `<div class="empty" style="padding:40px 20px">
           <div class="big">📦</div>
           <p style="margin-bottom:18px">${
             purchases.length ? "Nothing of that kind yet." : "Your library is empty — go grab something!"
           }</p>
           <a class="btn btn-outline btn-sm" href="#/products">Browse the store</a>
         </div>`;

    wireLibrary();
  }

  // Scoped to #library on purpose: this re-runs on every repaint, and
  // querying the whole page would stack a fresh listener on the sidebar
  // buttons each time.
  function wireLibrary() {
    const scope = app.querySelector("#library");

    scope.querySelectorAll(".reveal-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        const box = scope.querySelector(`.credential-box[data-box="${btn.dataset.box}"]`);
        const masked = box.classList.toggle("masked");
        btn.textContent = masked ? "👁 Reveal" : "🙈 Hide";
      })
    );

    scope.querySelectorAll(".copy-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          toast("Copied to your clipboard.", "success");
        } catch {
          toast("Your browser blocked the clipboard — select the text and copy it manually.", "error");
        }
      })
    );

    scope.querySelectorAll(".edit-brief-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        const form = scope.querySelector(`form.brief-form[data-i="${btn.dataset.i}"]`);
        if (form) form.hidden = !form.hidden;
      })
    );

    scope.querySelectorAll("form.brief-form").forEach((form) =>
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = form.querySelector("button[type=submit]");
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Sending…";

        const brief = {
          title: form.title.value.trim(),
          game: form.game.value.trim(),
          details: form.details.value.trim(),
          referenceUrl: form.reference.value.trim(),
        };

        try {
          if (form.dataset.id) {
            await updateRequestBrief(form.dataset.id, brief);
            toast("Brief updated.", "success");
          } else {
            await createRequest({
              purchaseId: form.dataset.purchase,
              modId: form.dataset.mod,
              ...brief,
            });
            toast("Brief sent — I'll get started on it.", "success");
          }
          accountView(app);
        } catch (err) {
          toast(err.message, "error");
          btn.disabled = false;
          btn.textContent = original;
        }
      })
    );

    scope.querySelectorAll(".req-dl-btn").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const request = requests.find((r) => r.id === btn.dataset.id);
        if (!request) return;
        btn.disabled = true;
        btn.textContent = "Preparing…";
        try {
          location.href = await getRequestDownloadUrl(request);
          toast("Download started!", "success");
        } catch (err) {
          toast(err.message, "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "⬇ Download";
        }
      })
    );

    scope.querySelectorAll(".dl-btn").forEach((btn) =>
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

    scope.querySelectorAll(".portal-btn").forEach(wirePortalButton);
  }

  function wirePortalButton(btn) {
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
    });
  }

  paint();

  // Sidebar controls live outside #library, so they're wired exactly once.
  app.querySelectorAll(".account-grid > .panel:first-child .portal-btn").forEach(wirePortalButton);

  app.querySelector("#signout-btn").addEventListener("click", async () => {
    await signOut();
    location.hash = "#/";
  });
}
