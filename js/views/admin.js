import {
  isLive, getSession, getMyProfile, getMods, saveMod, deleteMod,
  uploadModImage, uploadModFile,
} from "../db.js";
import { money, esc, toast } from "../ui.js";

export async function adminView(app) {
  document.title = "Admin — JustLoofy Mods";

  let mods = [];
  let editing = null; // mod being edited, or null for "new"

  const head = `
    <div class="page-head">
      <h1>Admin panel</h1>
      <p>Add, edit, and manage the mods in your store.</p>
    </div>`;

  function denied(message) {
    app.innerHTML = `<div class="container">${head}
      <div class="empty" style="padding:90px 20px">
        <div class="big">🚫</div>
        <h2 style="margin-bottom:10px">Admins only</h2>
        <p style="margin-bottom:24px">${esc(message)}</p>
        <a class="btn btn-primary" href="#/">Back to home</a>
      </div></div>`;
  }

  function formHtml(mod = {}) {
    return `
      <div class="panel reveal" style="margin-bottom:34px">
        <h2>${mod.id ? `Editing: ${esc(mod.title)}` : "Add a new mod"}</h2>
        ${mod.id ? `<p style="color:var(--muted);font-size:0.88rem;margin:-10px 0 16px">Pushing an update? Bump the version and upload the new .zip — everyone who owns it gets the new file instantly, free.</p>` : ""}
        <form id="mod-form">
          <div class="field-row">
            <div class="field">
              <label for="f-title">Title</label>
              <input id="f-title" required value="${esc(mod.title ?? "")}" placeholder="Nightfall Overhaul">
            </div>
            <div class="field">
              <label for="f-game">Game</label>
              <input id="f-game" required value="${esc(mod.game ?? "")}" placeholder="Skyrim">
            </div>
          </div>
          <div class="field">
            <label for="f-tagline">Tagline (short, shows on cards)</label>
            <input id="f-tagline" maxlength="140" value="${esc(mod.tagline ?? "")}" placeholder="One sentence that sells it">
          </div>
          <div class="field">
            <label for="f-description">Full description</label>
            <textarea id="f-description" placeholder="What it does, features, install notes...">${esc(mod.description ?? "")}</textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-price">Price (USD — 0 for free)</label>
              <input id="f-price" type="number" min="0" step="0.01" required value="${((mod.price_cents ?? 0) / 100).toFixed(2)}">
            </div>
            <div class="field">
              <label for="f-version">Version</label>
              <input id="f-version" value="${esc(mod.version ?? "1.0.0")}">
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label>Cover image</label>
              <div class="file-input">
                <label class="btn btn-ghost btn-sm" for="f-image">🖼️ Choose image</label>
                <span class="file-name ${mod.image_url ? "chosen" : ""}" id="f-image-name">${mod.image_url ? "✓ Uploaded — pick a file to replace it" : "No file selected"}</span>
                <input id="f-image" type="file" accept="image/*">
              </div>
            </div>
            <div class="field">
              <label>Mod file (.zip)</label>
              <div class="file-input">
                <label class="btn btn-ghost btn-sm" for="f-file">📦 Choose .zip</label>
                <span class="file-name ${mod.file_path ? "chosen" : ""}" id="f-file-name">${mod.file_path ? "✓ Uploaded — pick a file to replace it" : "No file selected"}</span>
                <input id="f-file" type="file">
              </div>
            </div>
          </div>
          <div class="field">
            <label>Showcase images (extra gallery pictures on the mod page — pick several at once)</label>
            <div class="file-input">
              <label class="btn btn-ghost btn-sm" for="f-gallery">🖼️ Choose images</label>
              <span class="file-name ${Array.isArray(mod.gallery) && mod.gallery.length ? "chosen" : ""}" id="f-gallery-name">${
                Array.isArray(mod.gallery) && mod.gallery.length
                  ? `✓ ${mod.gallery.length} uploaded — pick files to replace them all`
                  : "No files selected"
              }</span>
              <input id="f-gallery" type="file" accept="image/*" multiple>
            </div>
          </div>
          <div class="field-row" style="align-items:center;margin-bottom:18px">
            <label class="switch">
              <input type="checkbox" id="f-featured" ${mod.featured ? "checked" : ""}>
              <span class="track"></span>
              <span>Featured on home page</span>
            </label>
            <label class="switch">
              <input type="checkbox" id="f-published" ${mod.published !== false ? "checked" : ""}>
              <span class="track"></span>
              <span>Published (visible in store)</span>
            </label>
          </div>
          <div style="display:flex;gap:12px;margin-top:10px">
            <button class="btn btn-primary" type="submit">${mod.id ? "Save changes" : "Create mod"}</button>
            ${mod.id ? `<button class="btn btn-ghost" type="button" id="cancel-edit">Cancel</button>` : ""}
          </div>
        </form>
      </div>`;
  }

  function tableHtml() {
    if (!mods.length) {
      return `<div class="empty"><div class="big">📦</div>No mods yet — create your first one above.</div>`;
    }
    const rows = mods.map((m) => `
      <tr>
        <td><b>${esc(m.title)}</b><br><span style="color:var(--muted);font-size:0.82rem">${esc(m.game)} · v${esc(m.version ?? "1.0.0")}</span></td>
        <td>${money(m.price_cents)}</td>
        <td>${(m.downloads ?? 0).toLocaleString()}</td>
        <td><span class="pill ${m.published !== false ? "on" : "off"}">${m.published !== false ? "Live" : "Hidden"}</span></td>
        <td>${m.featured ? "⭐" : ""}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm edit-btn" data-id="${esc(m.id)}">Edit</button>
          <button class="btn btn-danger btn-sm del-btn" data-id="${esc(m.id)}">Delete</button>
        </td>
      </tr>`).join("");

    return `
      <div class="panel reveal">
        <h2>All mods (${mods.length})</h2>
        <div class="table-wrap">
          <table class="admin-table">
            <thead><tr><th>Mod</th><th>Price</th><th>Downloads</th><th>Status</th><th>Featured</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function render() {
    app.innerHTML = `<div class="container">${head}
      <div style="padding:10px 0 80px">${formHtml(editing ?? {})}${tableHtml()}</div>
    </div>`;

    app.querySelector("#mod-form").addEventListener("submit", onSave);

    // Show the picked filename (with a ✓) inside the custom file inputs
    const wireFile = (inputId, nameId) => {
      const input = app.querySelector(inputId);
      const nameEl = app.querySelector(nameId);
      input?.addEventListener("change", () => {
        const files = [...input.files];
        if (!files.length) return;
        nameEl.textContent =
          files.length === 1 ? `✓ ${files[0].name}` : `✓ ${files.length} images selected`;
        nameEl.classList.add("chosen");
      });
    };
    wireFile("#f-image", "#f-image-name");
    wireFile("#f-file", "#f-file-name");
    wireFile("#f-gallery", "#f-gallery-name");

    app.querySelector("#cancel-edit")?.addEventListener("click", () => {
      editing = null;
      render();
    });
    app.querySelectorAll(".edit-btn").forEach((b) =>
      b.addEventListener("click", () => {
        editing = mods.find((m) => m.id === b.dataset.id) ?? null;
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
    );
    app.querySelectorAll(".del-btn").forEach((b) =>
      b.addEventListener("click", async () => {
        const mod = mods.find((m) => m.id === b.dataset.id);
        if (!mod) return;
        if (!confirm(`Delete "${mod.title}"? Buyers keep their copies, but it disappears from the store.`)) return;
        try {
          await deleteMod(mod.id);
          toast("Mod deleted.", "success");
          await reload();
        } catch (err) { toast(err.message, "error"); }
      })
    );
  }

  async function onSave(e) {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
      const record = {
        ...(editing?.id ? { id: editing.id } : {}),
        title: app.querySelector("#f-title").value.trim(),
        game: app.querySelector("#f-game").value.trim(),
        tagline: app.querySelector("#f-tagline").value.trim(),
        description: app.querySelector("#f-description").value.trim(),
        version: app.querySelector("#f-version").value.trim() || "1.0.0",
        price_cents: Math.round(parseFloat(app.querySelector("#f-price").value || "0") * 100),
        featured: app.querySelector("#f-featured").checked,
        published: app.querySelector("#f-published").checked,
      };

      const imageFile = app.querySelector("#f-image").files[0];
      if (imageFile) {
        btn.textContent = "Uploading image…";
        record.image_url = await uploadModImage(imageFile);
      }

      const galleryFiles = [...app.querySelector("#f-gallery").files];
      if (galleryFiles.length) {
        const urls = [];
        for (let i = 0; i < galleryFiles.length; i++) {
          btn.textContent = `Uploading gallery ${i + 1}/${galleryFiles.length}…`;
          urls.push(await uploadModImage(galleryFiles[i]));
        }
        record.gallery = urls;
      }

      const modFile = app.querySelector("#f-file").files[0];
      if (modFile) {
        btn.textContent = "Uploading mod file…";
        record.file_path = await uploadModFile(modFile);
      }

      await saveMod(record);
      toast(editing ? "Mod updated!" : "Mod created!", "success");
      editing = null;
      await reload();
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
      btn.textContent = editing ? "Save changes" : "Create mod";
    }
  }

  async function reload() {
    mods = await getMods({ includeUnpublished: true });
    render();
  }

  // ---- gate ----
  if (!isLive) return denied("The admin panel needs Supabase connected first — see README.md.");
  const session = await getSession();
  if (!session) return denied("Sign in with your admin account to manage mods.");
  const profile = await getMyProfile().catch(() => null);
  if (!profile?.is_admin) {
    return denied("Your account doesn't have admin access.");
  }
  await reload();
}
