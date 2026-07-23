import {
  isLive, getSession, getMyProfile, getMyPurchases, updateUsername,
  updatePassword, signOut, getDownloadUrl,
} from "../db.js";
import { mediaHtml, money, esc, toast } from "../ui.js";

export async function accountView(app) {
  document.title = "My Account — JustLoofy Mods";

  const head = `
    <div class="page-head">
      <h1>My account</h1>
      <p>Your library, profile, and settings.</p>
    </div>`;

  const session = isLive ? await getSession() : null;
  if (!session) {
    app.innerHTML = `<div class="container">${head}
      <div class="empty" style="padding:90px 20px">
        <div class="big">🔒</div>
        <h2 style="margin-bottom:10px">${isLive ? "Sign in to view your account" : "Demo mode"}</h2>
        <p style="margin-bottom:24px">${
          isLive
            ? "Your mod library lives here once you're signed in."
            : "Accounts unlock once Supabase is connected — see README.md."
        }</p>
        ${isLive ? `<a class="btn btn-primary" href="#/auth">Sign in</a>` : `<a class="btn btn-primary" href="#/mods">Browse mods</a>`}
      </div></div>`;
    return;
  }

  let profile = null;
  try { profile = await getMyProfile(); } catch { /* row may not exist yet */ }
  const name = profile?.username || session.user.email;

  let purchases = [];
  try { purchases = await getMyPurchases(); } catch (err) { toast(err.message, "error"); }

  const libraryHtml = purchases.length
    ? purchases.map((p) => {
        const mod = p.mods;
        if (!mod) return "";
        return `
          <div class="library-item">
            ${mediaHtml(mod, "thumb")}
            <div class="info">
              <b>${esc(mod.title)}</b>
              <span>${esc(mod.game)} · v${esc(mod.version ?? "1.0.0")} · ${p.amount_cents === 0 ? "Free" : money(p.amount_cents)}</span>
            </div>
            <button class="btn btn-primary btn-sm dl-btn" data-id="${esc(mod.id)}">Download</button>
          </div>`;
      }).join("")
    : `<div class="empty" style="padding:40px 20px">
         <div class="big">📦</div>
         <p style="margin-bottom:18px">Your library is empty — go grab something!</p>
         <a class="btn btn-outline btn-sm" href="#/mods">Browse mods</a>
       </div>`;

  app.innerHTML = `<div class="container">${head}
    <div class="account-grid">
      <div class="panel reveal">
        <div class="profile-avatar">${esc(name[0]?.toUpperCase() ?? "?")}</div>
        <div class="profile-name">${esc(name)}</div>
        <div class="profile-email">${esc(session.user.email)}</div>

        <div class="field">
          <label for="username-input">Username</label>
          <input id="username-input" value="${esc(profile?.username ?? "")}" maxlength="24" placeholder="Pick a username">
        </div>
        <button class="btn btn-ghost btn-sm btn-block" id="save-username" style="margin-bottom:20px">Save username</button>

        <div class="field">
          <label for="new-password">New password</label>
          <input type="password" id="new-password" minlength="8" placeholder="Min. 8 characters" autocomplete="new-password">
        </div>
        <button class="btn btn-ghost btn-sm btn-block" id="save-password" style="margin-bottom:20px">Change password</button>

        <button class="btn btn-danger btn-sm btn-block" id="signout-btn">Sign out</button>
      </div>

      <div class="panel reveal">
        <h2>My library (${purchases.length})</h2>
        <div id="library">${libraryHtml}</div>
      </div>
    </div></div>`;

  app.querySelector("#save-username").addEventListener("click", async () => {
    const username = app.querySelector("#username-input").value.trim();
    if (username.length < 3) return toast("Username must be at least 3 characters.", "error");
    try {
      await updateUsername(username);
      toast("Username saved!", "success");
    } catch (err) { toast(err.message, "error"); }
  });

  app.querySelector("#save-password").addEventListener("click", async () => {
    const pw = app.querySelector("#new-password").value;
    if (pw.length < 8) return toast("Password must be at least 8 characters.", "error");
    try {
      await updatePassword(pw);
      app.querySelector("#new-password").value = "";
      toast("Password updated!", "success");
    } catch (err) { toast(err.message, "error"); }
  });

  app.querySelector("#signout-btn").addEventListener("click", async () => {
    await signOut();
    location.hash = "#/";
  });

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
        btn.textContent = "Download";
      }
    })
  );
}
