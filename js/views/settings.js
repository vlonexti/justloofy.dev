import { isLive, getSession, getMyProfile, updateUsername, updatePassword, signOut } from "../db.js";
import { THEMES, getTheme, setTheme } from "../theme.js";
import { esc, toast, pageTitle } from "../ui.js";

function themeCardHtml(theme, current) {
  const { bg, card, accent } = theme.swatch;
  return `
    <button class="theme-card ${theme.id === current ? "active" : ""}" data-theme="${theme.id}" type="button">
      <div class="theme-swatch" style="background:${bg}">
        <span class="bar" style="background:${card}"></span>
        <span class="bar short" style="background:${card}"></span>
        <span class="dot" style="background:${accent}"></span>
      </div>
      <div class="name">${esc(theme.name)} ${theme.id === current ? `<span class="check">✓</span>` : ""}</div>
      <small>${esc(theme.blurb)}</small>
    </button>`;
}

export async function settingsView(app) {
  document.title = pageTitle("Settings");

  const session = isLive ? await getSession() : null;
  let profile = null;
  if (session) {
    try { profile = await getMyProfile(); } catch { /* row may not exist yet */ }
  }

  const sections = [
    { id: "appearance", label: "🎨 Appearance" },
    ...(session
      ? [
          { id: "profile", label: "👤 Profile" },
          { id: "security", label: "🔐 Security" },
        ]
      : []),
  ];

  const appearancePanel = `
    <div class="panel reveal" data-section="appearance">
      <h2>Theme</h2>
      <p class="panel-sub">Pick a skin for the whole site. It applies instantly and is remembered on this device — signed in or not.</p>
      <div class="theme-grid" id="theme-grid"></div>
      <p class="field-hint" style="margin-top:18px">Prefers-reduced-motion is respected automatically: if your system asks for less animation, the site turns its effects off.</p>
    </div>`;

  const profilePanel = session
    ? `<div class="panel reveal" data-section="profile" hidden>
        <h2>Profile</h2>
        <p class="panel-sub">Signed in as ${esc(session.user.email)}.</p>
        <div class="field">
          <label for="username-input">Username</label>
          <input id="username-input" value="${esc(profile?.username ?? "")}" maxlength="24" placeholder="Pick a username">
          <p class="field-hint">Shown on your account chip in the header. 3–24 characters.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="save-username">Save username</button>
      </div>`
    : "";

  const securityPanel = session
    ? `<div class="panel reveal" data-section="security" hidden>
        <h2>Security</h2>
        <p class="panel-sub">Change your password, or sign out of this browser.</p>
        <div class="field">
          <label for="new-password">New password</label>
          <input type="password" id="new-password" minlength="8" placeholder="Min. 8 characters" autocomplete="new-password">
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="save-password">Change password</button>
          <button class="btn btn-danger btn-sm" id="signout-btn">Sign out</button>
        </div>
      </div>`
    : `<div class="panel reveal" data-section="signedout" hidden></div>`;

  app.innerHTML = `<div class="container">
    <div class="page-head">
      <h1>Settings</h1>
      <p>Make the store look the way you want, and manage your account.</p>
    </div>
    <div class="settings-grid">
      <nav class="settings-nav" id="settings-nav">
        ${sections
          .map((s, i) => `<button class="${i === 0 ? "active" : ""}" data-goto="${s.id}">${s.label}</button>`)
          .join("")}
      </nav>
      <div>
        ${appearancePanel}
        ${profilePanel}
        ${securityPanel}
        ${session
          ? ""
          : `<div class="empty" style="margin-top:18px">
               <p style="margin:0 0 16px">Sign in to change your username, password and billing.</p>
               <a class="btn btn-primary btn-sm" href="#/auth">Sign in</a>
             </div>`}
      </div>
    </div>
  </div>`;

  // ---- theme picker ----
  const grid = app.querySelector("#theme-grid");
  const paintThemes = () => {
    const current = getTheme();
    grid.innerHTML = THEMES.map((t) => themeCardHtml(t, current)).join("");
    grid.querySelectorAll(".theme-card").forEach((card) =>
      card.addEventListener("click", () => {
        const theme = THEMES.find((t) => t.id === card.dataset.theme);
        setTheme(card.dataset.theme);
        paintThemes();
        toast(`Theme set to ${theme?.name ?? card.dataset.theme}.`, "success");
      })
    );
  };
  paintThemes();

  // ---- section switching ----
  const panels = [...app.querySelectorAll("[data-section]")];
  app.querySelectorAll("#settings-nav button").forEach((btn) =>
    btn.addEventListener("click", () => {
      app.querySelectorAll("#settings-nav button").forEach((b) => b.classList.toggle("active", b === btn));
      panels.forEach((p) => (p.hidden = p.dataset.section !== btn.dataset.goto));
    })
  );

  if (!session) return;

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
}
