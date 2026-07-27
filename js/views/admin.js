import {
  isLive, getSession, getMyProfile, getProducts, getStockMap, saveProduct, deleteProduct,
  uploadImage, uploadProductFile, addStock, clearUnsoldStock,
  getAllRequests, updateRequest, KINDS, kindOf, REQUEST_STATUS, isRequestOpen,
} from "../db.js";
import { money, esc, toast, formatDate, intervalLabel, pageTitle } from "../ui.js";

const KIND_HELP = {
  mod: "A file everyone who buys it downloads. Bump the version and upload a new .zip to push an update.",
  account: "Sells one line at a time from a pile you upload. Each buyer gets their own line, and the store shows how many are left.",
  subscription: "A recurring Stripe payment. Buyers keep access while it's active and can cancel themselves.",
  request: "Someone pays you to build something custom. After paying they write a brief, and you deliver the finished file from the Requests tab.",
};

export async function adminView(app) {
  document.title = pageTitle("Admin");

  let products = [];
  let stock = {};
  let requests = [];
  let editing = null;      // product being edited, or null for "new"
  let draftKind = "mod";   // which kind the form is currently set to
  let tab = "catalogue";   // catalogue | requests

  const head = `
    <div class="page-head">
      <h1>Admin panel</h1>
      <p>Add, edit, restock, and manage everything in the store.</p>
    </div>`;

  const openRequests = () => requests.filter(isRequestOpen).length;

  function tabsHtml() {
    const pending = openRequests();
    return `
      <div class="chips" style="margin-bottom:26px">
        <button class="chip ${tab === "catalogue" ? "active" : ""}" data-tab="catalogue">📦 Catalogue <span style="opacity:.6">${products.length}</span></button>
        <button class="chip ${tab === "requests" ? "active" : ""}" data-tab="requests">✍️ Requests <span style="opacity:.6">${requests.length}</span>${pending ? ` <span class="pill warn" style="margin-left:6px">${pending} open</span>` : ""}</button>
      </div>`;
  }

  function denied(message) {
    app.innerHTML = `<div class="container">${head}
      <div class="empty" style="padding:90px 20px">
        <div class="big">🚫</div>
        <h2 style="margin-bottom:10px">Admins only</h2>
        <p style="margin-bottom:24px">${esc(message)}</p>
        <a class="btn btn-primary" href="#/">Back to home</a>
      </div></div>`;
  }

  // ---------- form ----------

  function kindPickerHtml() {
    return `
      <div class="kind-picker">
        ${Object.entries(KINDS)
          .map(
            ([id, k]) => `
          <button type="button" class="kind-option ${id === draftKind ? "active" : ""}" data-kind="${id}">
            <div class="k-ico">${k.icon}</div>
            <b>${k.label}</b>
            <small>${esc(KIND_HELP[id])}</small>
          </button>`
          )
          .join("")}
      </div>`;
  }

  function stockPanelHtml(product) {
    const s = stock[product.id] ?? { available: 0, total: 0 };
    return `
      <div class="panel" style="background:var(--surface-2);padding:18px;margin-bottom:18px">
        <b style="font-size:0.95rem">Current stock</b>
        <p class="field-hint" style="margin:6px 0 0">
          <span class="pill ${s.available > 0 ? "on" : "off"}">${s.available} available</span>
          <span class="pill neutral">${s.total - s.available} sold</span>
        </p>
        ${s.total - s.available > 0
          ? `<p class="field-hint">Sold accounts are kept forever so buyers never lose their details.</p>`
          : ""}
        ${s.available > 0
          ? `<button type="button" class="btn btn-danger btn-sm" id="clear-stock" style="margin-top:12px">Delete the ${s.available} unsold</button>`
          : ""}
      </div>`;
  }

  function formHtml(product = {}) {
    const isNew = !product.id;
    const kind = draftKind;

    return `
      <div class="panel reveal" style="margin-bottom:34px">
        <h2>${isNew ? "Add something new" : `Editing: ${esc(product.title)}`}</h2>
        ${!isNew
          ? `<p class="panel-sub">Saving a change to the title, description, price, images, version or file stamps this with today's date as an <b>Updated</b> — the original release date stays put.</p>`
          : `<p class="panel-sub">Pick what you're selling. The rest of the form changes to match.</p>`}

        ${kindPickerHtml()}

        <form id="product-form">
          <div class="field-row">
            <div class="field">
              <label for="f-title">Title</label>
              <input id="f-title" required value="${esc(product.title ?? "")}" placeholder="${kind === "account" ? "Spotify Premium — 2 Months" : "Nightfall Overhaul"}">
            </div>
            <div class="field">
              <label for="f-game">Category</label>
              <input id="f-game" required value="${esc(product.game ?? "")}" placeholder="${kind === "mod" ? "Skyrim" : kind === "account" ? "Streaming" : "Membership"}">
              <p class="field-hint">Game, platform or service — used for the filter chips.</p>
            </div>
          </div>

          <div class="field">
            <label for="f-tagline">Tagline (short, shows on cards)</label>
            <input id="f-tagline" maxlength="140" value="${esc(product.tagline ?? "")}" placeholder="One sentence that sells it">
          </div>
          <div class="field">
            <label for="f-description">Full description</label>
            <textarea id="f-description" placeholder="What it is, what's included, any notes...">${esc(product.description ?? "")}</textarea>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="f-price">Price (USD — 0 for free)</label>
              <input id="f-price" type="number" min="0" step="0.01" required value="${((product.price_cents ?? 0) / 100).toFixed(2)}">
              ${kind === "account" ? `<p class="field-hint">Charged once per account sold.</p>` : ""}
            </div>
            ${kind === "subscription"
              ? `<div class="field">
                   <label>Bills every</label>
                   <div style="display:flex;gap:10px">
                     <input id="f-interval-count" type="number" min="1" max="12" style="width:90px" value="${product.sub_interval_count ?? 1}">
                     <select id="f-interval">
                       ${["day", "week", "month", "year"]
                         .map((u) => `<option value="${u}" ${(product.sub_interval ?? "month") === u ? "selected" : ""}>${u}${(product.sub_interval_count ?? 1) > 1 ? "s" : ""}</option>`)
                         .join("")}
                     </select>
                   </div>
                 </div>`
              : `<div class="field">
                   <label for="f-version">Version</label>
                   <input id="f-version" value="${esc(product.version ?? "1.0.0")}">
                   ${kind === "mod" ? `<p class="field-hint">Bump this when you upload a new file.</p>` : ""}
                 </div>`}
          </div>

          <div class="field-row">
            <div class="field">
              <label>Cover image</label>
              <div class="file-input">
                <label class="btn btn-ghost btn-sm" for="f-image">🖼️ Choose image</label>
                <span class="file-name ${product.image_url ? "chosen" : ""}" id="f-image-name">${product.image_url ? "✓ Uploaded — pick a file to replace it" : "No file selected"}</span>
                <input id="f-image" type="file" accept="image/*">
              </div>
            </div>
            <div class="field">
              <label>${kind === "subscription" ? "Members' file (optional)" : "Product file (.zip)"}</label>
              <div class="file-input">
                <label class="btn btn-ghost btn-sm" for="f-file">📦 Choose file</label>
                <span class="file-name ${product.file_path ? "chosen" : ""}" id="f-file-name">${product.file_path ? "✓ Uploaded — pick a file to replace it" : "No file selected"}</span>
                <input id="f-file" type="file">
              </div>
              ${kind === "account" ? `<p class="field-hint">Optional for accounts — most account listings don't need one.</p>` : ""}
              ${kind === "request" ? `<p class="field-hint">Leave empty — you deliver each commission's file from the Requests tab.</p>` : ""}
            </div>
          </div>

          <div class="field">
            <label>Showcase images (extra gallery pictures — pick several at once)</label>
            <div class="file-input">
              <label class="btn btn-ghost btn-sm" for="f-gallery">🖼️ Choose images</label>
              <span class="file-name ${Array.isArray(product.gallery) && product.gallery.length ? "chosen" : ""}" id="f-gallery-name">${
                Array.isArray(product.gallery) && product.gallery.length
                  ? `✓ ${product.gallery.length} uploaded — pick files to replace them all`
                  : "No files selected"
              }</span>
              <input id="f-gallery" type="file" accept="image/*" multiple>
            </div>
          </div>

          ${kind === "account"
            ? `
            ${product.id ? stockPanelHtml(product) : ""}
            <div class="field">
              <label>Add accounts to stock</label>
              <div class="file-input" style="margin-bottom:10px">
                <label class="btn btn-ghost btn-sm" for="f-stock-file">📄 Upload a .txt / .csv</label>
                <span class="file-name" id="f-stock-file-name">No file selected</span>
                <input id="f-stock-file" type="file" accept=".txt,.csv,text/plain,text/csv">
              </div>
              <textarea id="f-stock-text" placeholder="…or paste them here — one account per line:&#10;user1@mail.com:password1&#10;user2@mail.com:password2"></textarea>
              <p class="field-hint">One line = one account = one sale. Blank lines and anything already in stock are skipped automatically.</p>
            </div>`
            : ""}

          <div class="field-row" style="align-items:center;margin-bottom:18px">
            <label class="switch">
              <input type="checkbox" id="f-featured" ${product.featured ? "checked" : ""}>
              <span class="track"></span>
              <span>Featured on home page</span>
            </label>
            <label class="switch">
              <input type="checkbox" id="f-published" ${product.published !== false ? "checked" : ""}>
              <span class="track"></span>
              <span>Published (visible in store)</span>
            </label>
          </div>

          <div style="display:flex;gap:12px;margin-top:10px">
            <button class="btn btn-primary" type="submit">${isNew ? "Create" : "Save changes"}</button>
            ${product.id ? `<button class="btn btn-ghost" type="button" id="cancel-edit">Cancel</button>` : ""}
          </div>
        </form>
      </div>`;
  }

  // ---------- table ----------

  function tableHtml() {
    if (!products.length) {
      return `<div class="empty"><div class="big">📦</div>Nothing in the store yet — create your first product above.</div>`;
    }

    const rows = products
      .map((p) => {
        const kind = kindOf(p);
        const s = stock[p.id];
        const stockCell =
          kind === "account"
            ? `<span class="pill ${s?.available ? "on" : "off"}">${s?.available ?? 0} left</span>`
            : kind === "subscription"
              ? `<span class="pill neutral">${intervalLabel(p, true)}</span>`
              : kind === "request"
                ? `<span class="pill neutral">${requests.filter((r) => r.mod_id === p.id).length} requests</span>`
                : `${(p.downloads ?? 0).toLocaleString()} ⬇`;

        return `
        <tr>
          <td>
            <b>${esc(p.title)}</b><br>
            <span style="color:var(--muted);font-size:0.82rem">${esc(p.game)}${kind === "mod" ? ` · v${esc(p.version ?? "1.0.0")}` : ""}</span>
          </td>
          <td><span class="pill neutral">${KINDS[kind].icon} ${KINDS[kind].label}</span></td>
          <td>${money(p.price_cents)}</td>
          <td>${stockCell}</td>
          <td><span class="pill ${p.published !== false ? "on" : "off"}">${p.published !== false ? "Live" : "Hidden"}</span></td>
          <td style="font-size:0.8rem;color:var(--muted)">
            ${formatDate(p.created_at)}
            ${p.updated_at ? `<br><span style="color:var(--ok)">upd ${formatDate(p.updated_at)}</span>` : ""}
          </td>
          <td>${p.featured ? "⭐" : ""}</td>
          <td style="white-space:nowrap">
            <button class="btn btn-ghost btn-sm edit-btn" data-id="${esc(p.id)}">Edit</button>
            <button class="btn btn-danger btn-sm del-btn" data-id="${esc(p.id)}">Delete</button>
          </td>
        </tr>`;
      })
      .join("");

    return `
      <div class="panel reveal">
        <h2>Everything in the store (${products.length})</h2>
        <div class="table-wrap">
          <table class="admin-table">
            <thead><tr>
              <th>Product</th><th>Type</th><th>Price</th><th>Stock / use</th>
              <th>Status</th><th>Dates</th><th>★</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  // ---------- requests ----------

  function requestCardHtml(request, index) {
    const status = REQUEST_STATUS[request.status] ?? REQUEST_STATUS.new;
    const who = request._username ?? request.user_id.slice(0, 8);

    return `
      <div class="request-card ${isRequestOpen(request) ? "" : "is-closed"}">
        <div class="request-head">
          <div>
            <b>${esc(request.title)}</b>
            <div class="field-hint" style="margin:4px 0 0">
              ${esc(who)} · ${esc(request.mods?.title ?? "commission")}
              ${request.game ? ` · ${esc(request.game)}` : ""}
              · ${esc(formatDate(request.created_at))}
            </div>
          </div>
          <span class="pill ${status.tone}">${esc(status.label)}</span>
        </div>

        <p class="request-details">${esc(request.details)}</p>
        ${request.reference_url
          ? `<p class="field-hint"><a href="${esc(request.reference_url)}" target="_blank" rel="noopener" style="text-decoration:underline">${esc(request.reference_url)}</a></p>`
          : ""}

        <div class="field-row" style="margin-top:16px">
          <div class="field">
            <label for="rq-status-${index}">Status</label>
            <select id="rq-status-${index}">
              ${Object.entries(REQUEST_STATUS)
                .map(([id, s]) => `<option value="${id}" ${request.status === id ? "selected" : ""}>${esc(s.label)}</option>`)
                .join("")}
            </select>
          </div>
          <div class="field">
            <label>Finished build ${request.file_path ? "(replace)" : ""}</label>
            <div class="file-input">
              <label class="btn btn-ghost btn-sm" for="rq-file-${index}">📦 Choose file</label>
              <span class="file-name ${request.file_path ? "chosen" : ""}" id="rq-file-name-${index}">${
                request.file_path ? "✓ Delivered — pick a file to replace it" : "No file selected"
              }</span>
              <input id="rq-file-${index}" type="file">
            </div>
          </div>
        </div>

        <div class="field">
          <label for="rq-note-${index}">Note back to the buyer (they see this)</label>
          <textarea id="rq-note-${index}" style="min-height:80px" placeholder="Started on it — should be with you Friday.">${esc(request.admin_note ?? "")}</textarea>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm rq-save" data-id="${esc(request.id)}" data-i="${index}">Save</button>
          ${request.status !== "closed"
            ? `<button class="btn btn-ghost btn-sm rq-close" data-id="${esc(request.id)}">✓ Close this job</button>`
            : `<button class="btn btn-ghost btn-sm rq-reopen" data-id="${esc(request.id)}">↩ Reopen</button>`}
        </div>
        <p class="field-hint" style="margin-top:10px">
          Attaching a file delivers it — the download appears in their library straight away.
          Closing only archives it for you; they keep the request and the file for good.
        </p>
      </div>`;
  }

  function requestsHtml() {
    if (!requests.length) {
      return `<div class="empty">
        <div class="big">✍️</div>
        <p style="margin:0 0 6px">No requests yet.</p>
        <p class="field-hint" style="margin:0">
          Create a product with the <b>Request</b> type and people can commission custom work.
          Their brief lands here the moment they've paid.
        </p>
      </div>`;
    }
    // Jobs still needing you float to the top; closed ones sink but stay.
    const sorted = [...requests].sort(
      (a, b) =>
        Number(isRequestOpen(b)) - Number(isRequestOpen(a)) ||
        new Date(b.created_at) - new Date(a.created_at)
    );

    return `
      <div class="panel reveal">
        <h2>Requests (${requests.length})</h2>
        <p class="panel-sub">
          Nobody can open a request without paying first — every card below is already paid for.
          ${openRequests() ? `<b style="color:var(--warn)">${openRequests()} still open.</b>` : "All caught up."}
        </p>
        <div class="request-list">${sorted.map(requestCardHtml).join("")}</div>
      </div>`;
  }

  function wireRequests() {
    app.querySelectorAll('[id^="rq-file-"]').forEach((input) => {
      if (input.type !== "file") return;
      const i = input.id.replace("rq-file-", "");
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        const nameEl = app.querySelector(`#rq-file-name-${i}`);
        nameEl.textContent = `✓ ${file.name}`;
        nameEl.classList.add("chosen");

        // Attaching a build IS the delivery. Move the status along so it
        // can't be saved as "Awaiting brief" with a finished file on it —
        // still a plain select, so it can be overridden before saving.
        const status = app.querySelector(`#rq-status-${i}`);
        if (status && ["new", "in_progress"].includes(status.value)) {
          status.value = "delivered";
          toast("Marked as Delivered — hit Save to send it.", "success");
        }
      });
    });

    app.querySelectorAll(".rq-save").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const i = btn.dataset.i;
        btn.disabled = true;
        btn.textContent = "Saving…";
        try {
          const patch = {
            status: app.querySelector(`#rq-status-${i}`).value,
            admin_note: app.querySelector(`#rq-note-${i}`).value.trim() || null,
          };
          const file = app.querySelector(`#rq-file-${i}`).files[0];
          if (file) {
            btn.textContent = "Uploading build…";
            patch.file_path = await uploadProductFile(file);
          }
          await updateRequest(btn.dataset.id, patch);
          toast("Request updated.", "success");
          await reload();
        } catch (err) {
          toast(err.message, "error");
          btn.disabled = false;
          btn.textContent = "Save";
        }
      })
    );

    const setStatus = (btn, status, message) =>
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await updateRequest(btn.dataset.id, { status });
          toast(message, "success");
          await reload();
        } catch (err) {
          toast(err.message, "error");
          btn.disabled = false;
        }
      });

    app.querySelectorAll(".rq-close").forEach((btn) =>
      setStatus(btn, "closed", "Closed — the buyer keeps their copy.")
    );
    app.querySelectorAll(".rq-reopen").forEach((btn) =>
      setStatus(btn, "in_progress", "Reopened.")
    );
  }

  // ---------- wiring ----------

  function render() {
    const body =
      tab === "requests"
        ? requestsHtml()
        : `${formHtml(editing ?? {})}${tableHtml()}`;

    app.innerHTML = `<div class="container">${head}
      <div style="padding:10px 0 80px">${tabsHtml()}${body}</div>
    </div>`;

    app.querySelectorAll("[data-tab]").forEach((btn) =>
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab;
        render();
      })
    );

    if (tab === "requests") return wireRequests();

    app.querySelector("#product-form").addEventListener("submit", onSave);

    app.querySelectorAll(".kind-option").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (btn.dataset.kind === draftKind) return;
        draftKind = btn.dataset.kind;
        // Keep whatever has already been typed when the form redraws
        const carry = {
          ...(editing ?? {}),
          title: app.querySelector("#f-title").value,
          game: app.querySelector("#f-game").value,
          tagline: app.querySelector("#f-tagline").value,
          description: app.querySelector("#f-description").value,
          price_cents: Math.round(parseFloat(app.querySelector("#f-price").value || "0") * 100),
        };
        editing = editing ? { ...editing, ...carry } : null;
        const scroll = window.scrollY;
        render();
        if (!editing) {
          app.querySelector("#f-title").value = carry.title;
          app.querySelector("#f-game").value = carry.game;
          app.querySelector("#f-tagline").value = carry.tagline;
          app.querySelector("#f-description").value = carry.description;
          app.querySelector("#f-price").value = (carry.price_cents / 100).toFixed(2);
        }
        window.scrollTo(0, scroll);
      })
    );

    // Show the picked filename (with a ✓) inside the custom file inputs
    const wireFile = (inputId, nameId) => {
      const input = app.querySelector(inputId);
      const nameEl = app.querySelector(nameId);
      input?.addEventListener("change", () => {
        const files = [...input.files];
        if (!files.length) return;
        nameEl.textContent = files.length === 1 ? `✓ ${files[0].name}` : `✓ ${files.length} files selected`;
        nameEl.classList.add("chosen");
      });
    };
    wireFile("#f-image", "#f-image-name");
    wireFile("#f-file", "#f-file-name");
    wireFile("#f-gallery", "#f-gallery-name");
    wireFile("#f-stock-file", "#f-stock-file-name");

    app.querySelector("#cancel-edit")?.addEventListener("click", () => {
      editing = null;
      draftKind = "mod";
      render();
    });

    app.querySelector("#clear-stock")?.addEventListener("click", async () => {
      if (!editing) return;
      const s = stock[editing.id] ?? { available: 0 };
      if (!confirm(`Delete the ${s.available} unsold accounts for "${editing.title}"? Sold ones stay put.`)) return;
      try {
        await clearUnsoldStock(editing.id);
        toast("Unsold stock cleared.", "success");
        await reload({ keepEditing: true });
      } catch (err) { toast(err.message, "error"); }
    });

    app.querySelectorAll(".edit-btn").forEach((b) =>
      b.addEventListener("click", () => {
        editing = products.find((p) => p.id === b.dataset.id) ?? null;
        draftKind = kindOf(editing ?? {});
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
    );

    app.querySelectorAll(".del-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        const product = products.find((p) => p.id === b.dataset.id);
        if (!product) return;
        if (!confirm(`Delete "${product.title}"? Buyers keep what they already bought, but it disappears from the store.`)) return;
        try {
          await deleteProduct(product.id);
          toast("Deleted.", "success");
          if (editing?.id === product.id) editing = null;
          await reload();
        } catch (err) { toast(err.message, "error"); }
      })
    );
  }

  async function readStockLines() {
    const lines = [];
    const file = app.querySelector("#f-stock-file")?.files?.[0];
    if (file) lines.push(...(await file.text()).split(/\r?\n/));
    const pasted = app.querySelector("#f-stock-text")?.value ?? "";
    if (pasted.trim()) lines.push(...pasted.split(/\r?\n/));
    return lines;
  }

  async function onSave(e) {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    const wasEditing = Boolean(editing?.id);
    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
      const record = {
        ...(editing?.id ? { id: editing.id } : {}),
        kind: draftKind,
        title: app.querySelector("#f-title").value.trim(),
        game: app.querySelector("#f-game").value.trim(),
        tagline: app.querySelector("#f-tagline").value.trim(),
        description: app.querySelector("#f-description").value.trim(),
        price_cents: Math.round(parseFloat(app.querySelector("#f-price").value || "0") * 100),
        featured: app.querySelector("#f-featured").checked,
        published: app.querySelector("#f-published").checked,
      };

      if (draftKind === "subscription") {
        record.sub_interval = app.querySelector("#f-interval").value;
        record.sub_interval_count = Math.max(1, parseInt(app.querySelector("#f-interval-count").value || "1", 10));
      } else {
        record.version = app.querySelector("#f-version").value.trim() || "1.0.0";
      }

      const imageFile = app.querySelector("#f-image").files[0];
      if (imageFile) {
        btn.textContent = "Uploading image…";
        record.image_url = await uploadImage(imageFile);
      }

      const galleryFiles = [...app.querySelector("#f-gallery").files];
      if (galleryFiles.length) {
        const urls = [];
        for (let i = 0; i < galleryFiles.length; i++) {
          btn.textContent = `Uploading gallery ${i + 1}/${galleryFiles.length}…`;
          urls.push(await uploadImage(galleryFiles[i]));
        }
        record.gallery = urls;
      }

      const productFile = app.querySelector("#f-file").files[0];
      if (productFile) {
        btn.textContent = "Uploading file…";
        record.file_path = await uploadProductFile(productFile);
      }

      const saved = await saveProduct(record);

      if (draftKind === "account") {
        const lines = await readStockLines();
        if (lines.some((l) => l.trim())) {
          btn.textContent = "Adding stock…";
          const { added, skipped } = await addStock(saved.id, lines);
          toast(`${added} account${added === 1 ? "" : "s"} added${skipped ? ` (${skipped} skipped as duplicates)` : ""}.`, "success");
        }
      }

      toast(wasEditing ? "Saved." : "Created.", "success");
      editing = null;
      draftKind = "mod";
      await reload();
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
      btn.textContent = wasEditing ? "Save changes" : "Create";
    }
  }

  async function reload({ keepEditing = false } = {}) {
    [products, stock, requests] = await Promise.all([
      getProducts({ includeUnpublished: true }),
      getStockMap().catch(() => ({})),
      getAllRequests().catch(() => []),
    ]);
    if (keepEditing && editing) {
      editing = products.find((p) => p.id === editing.id) ?? editing;
    }
    render();
  }

  // ---- gate ----
  if (!isLive) return denied("The admin panel needs Supabase connected first — see README.md.");
  const session = await getSession();
  if (!session) return denied("Sign in with your admin account to manage the store.");
  const profile = await getMyProfile().catch(() => null);
  if (!profile?.is_admin) return denied("Your account doesn't have admin access.");

  await reload();
}
