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
      <div class="credential-actions" style="margin-top:12px">
        ${request.status === "delivered" && request.file_path
          ? `<button class="btn btn-primary btn-sm req-dl-btn" data-id="${esc(request.id)}">⬇ Download the finished build</button>`
          : ""}
        ${editable
          ? `<button class="btn btn-ghost btn-sm edit-brief-btn" data-id="${esc(request.id)}" data-i="${index}">Edit the brief</button>`
          : ""}
      </div>
      ${editable
        ? `<form class="brief-form" data-i="${index}" data-id="${esc(request.id)}" hidden style="margin-top:14px">
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

  const libraryHtml = purchases.length
    ? purchases.map((p, i) => itemHtml(p, i, requestsByPurchase)).join("")
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
        <p class="panel-sub">
          Account credentials are hidden until you reveal them, so nobody reads them over your shoulder.
          ${awaitingBrief
            ? `<br><b style="color:var(--warn)">${awaitingBrief} commission${awaitingBrief === 1 ? "" : "s"} still need${awaitingBrief === 1 ? "s" : ""} a brief — fill it in below so I can start.</b>`
            : ""}
        </p>
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

  app.querySelectorAll(".edit-brief-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const form = app.querySelector(`form.brief-form[data-i="${btn.dataset.i}"]`);
      if (form) form.hidden = !form.hidden;
    })
  );

  app.querySelectorAll("form.brief-form").forEach((form) =>
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

  app.querySelectorAll(".req-dl-btn").forEach((btn) =>
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
        btn.textContent = "⬇ Download the finished build";
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
