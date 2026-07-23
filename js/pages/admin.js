import {
  isLive, getSession, getMyProfile, getMods, saveMod, deleteMod,
  uploadModImage, uploadModFile,
} from "../db.js";
import { money, esc, toast } from "../ui.js";

const root = document.getElementById("admin-root");
let mods = [];
let editing = null; // mod being edited, or null for "new"

function denied(message) {
  root.innerHTML = `<div class="empty" style="padding:90px 20px">
    <div class="big">🚫</div>
    <h2 style="margin-bottom:10px">Admins only</h2>
    <p style="margin-bottom:24px">${esc(message)}</p>
    <a class="btn btn-primary" href="index.html">Back to home</a>
  </div>`;
}

function formHtml(mod = {}) {
  return `
    <div class="panel reveal" style="margin-bottom:34px">
      <h2>${mod.id ? `Editing: ${esc(mod.title)}` : "Add a new mod"}</h2>
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
            <label for="f-image">Cover image ${mod.image_url ? "(uploaded ✓ — choose a file to replace)" : ""}</label>
            <input id="f-image" type="file" accept="image/*">
          </div>
          <div class="field">
            <label for="f-file">Mod file (.zip) ${mod.file_path ? "(uploaded ✓ — choose a file to replace)" : ""}</label>
            <input id="f-file" type="file">
          </div>
        </div>
        <div class="field-row" style="align-items:center">
          <div class="checkbox-row">
            <input type="checkbox" id="f-featured" ${mod.featured ? "checked" : ""}>
            <label for="f-featured">Featured on home page</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="f-published" ${mod.published !== false ? "checked" : ""}>
            <label for="f-published">Published (visible in store)</label>
          </div>
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
      <td><b>${esc(m.title)}</b><br><span style="color:var(--muted);font-size:0.82rem">${esc(m.game)}</span></td>
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
  root.innerHTML = formHtml(editing ?? {}) + tableHtml();

  document.getElementById("mod-form").addEventListener("submit", onSave);
  document.getElementById("cancel-edit")?.addEventListener("click", () => {
    editing = null;
    render();
  });
  document.querySelectorAll(".edit-btn").forEach((b) =>
    b.addEventListener("click", () => {
      editing = mods.find((m) => m.id === b.dataset.id) ?? null;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    })
  );
  document.querySelectorAll(".del-btn").forEach((b) =>
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
      title: document.getElementById("f-title").value.trim(),
      game: document.getElementById("f-game").value.trim(),
      tagline: document.getElementById("f-tagline").value.trim(),
      description: document.getElementById("f-description").value.trim(),
      version: document.getElementById("f-version").value.trim() || "1.0.0",
      price_cents: Math.round(parseFloat(document.getElementById("f-price").value || "0") * 100),
      featured: document.getElementById("f-featured").checked,
      published: document.getElementById("f-published").checked,
    };

    const imageFile = document.getElementById("f-image").files[0];
    if (imageFile) {
      btn.textContent = "Uploading image…";
      record.image_url = await uploadModImage(imageFile);
    }

    const modFile = document.getElementById("f-file").files[0];
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

async function init() {
  if (!isLive) return denied("The admin panel needs Supabase connected first — see README.md.");
  const session = await getSession();
  if (!session) return denied("Sign in with your admin account to manage mods.");
  const profile = await getMyProfile().catch(() => null);
  if (!profile?.is_admin) {
    return denied("This account isn't an admin. Run the make-yourself-admin SQL from the README.");
  }
  await reload();
}

init();
