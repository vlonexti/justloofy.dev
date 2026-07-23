import { isLive, getSession, signIn, signUp, sendPasswordReset } from "../db.js";
import { toast } from "../ui.js";

export async function authView(app, { params }) {
  document.title = "Sign in — JustLoofy Mods";

  const nextUrl = params.get("next") || "#/account";

  // Already signed in? Straight through.
  if (isLive) {
    const session = await getSession();
    if (session) {
      location.hash = nextUrl;
      return;
    }
  }

  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1 id="auth-title">Welcome back</h1>
        <p class="sub" id="auth-sub">Sign in to access your mod library.</p>

        <div class="tabs">
          <button id="tab-login" class="active" type="button">Sign in</button>
          <button id="tab-signup" type="button">Create account</button>
        </div>

        <form id="login-form">
          <div class="field">
            <label for="login-email">Email</label>
            <input type="email" id="login-email" required autocomplete="email" placeholder="you@example.com">
          </div>
          <div class="field">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••">
          </div>
          <button class="btn btn-primary btn-block" type="submit">Sign in</button>
          <p class="auth-alt"><a href="#" id="forgot-link">Forgot your password?</a></p>
        </form>

        <form id="signup-form" hidden>
          <div class="field">
            <label for="signup-username">Username</label>
            <input type="text" id="signup-username" required minlength="3" maxlength="24" autocomplete="username" placeholder="LoofyFan99">
          </div>
          <div class="field">
            <label for="signup-email">Email</label>
            <input type="email" id="signup-email" required autocomplete="email" placeholder="you@example.com">
          </div>
          <div class="field">
            <label for="signup-password">Password</label>
            <input type="password" id="signup-password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters">
          </div>
          <button class="btn btn-primary btn-block" type="submit">Create account</button>
          <p class="auth-alt">Free forever. No spam — ever.</p>
        </form>
      </div>
    </div>`;

  const tabLogin = app.querySelector("#tab-login");
  const tabSignup = app.querySelector("#tab-signup");
  const loginForm = app.querySelector("#login-form");
  const signupForm = app.querySelector("#signup-form");
  const title = app.querySelector("#auth-title");
  const sub = app.querySelector("#auth-sub");

  function showTab(which) {
    const login = which === "login";
    tabLogin.classList.toggle("active", login);
    tabSignup.classList.toggle("active", !login);
    loginForm.hidden = !login;
    signupForm.hidden = login;
    title.textContent = login ? "Welcome back" : "Join JustLoofy";
    sub.textContent = login
      ? "Sign in to access your mod library."
      : "Free account — buy mods, keep them forever.";
  }

  tabLogin.addEventListener("click", () => showTab("login"));
  tabSignup.addEventListener("click", () => showTab("signup"));
  if (params.get("tab") === "signup") showTab("signup");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      await signIn(
        app.querySelector("#login-email").value.trim(),
        app.querySelector("#login-password").value
      );
      location.hash = nextUrl;
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
    }
  });

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = signupForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const { session } = await signUp(
        app.querySelector("#signup-email").value.trim(),
        app.querySelector("#signup-password").value,
        app.querySelector("#signup-username").value.trim()
      );
      if (session) {
        location.hash = nextUrl;
      } else {
        toast("Check your email to confirm your account, then sign in.", "success");
        showTab("login");
        btn.disabled = false;
      }
    } catch (err) {
      toast(err.message, "error");
      btn.disabled = false;
    }
  });

  app.querySelector("#forgot-link").addEventListener("click", async (e) => {
    e.preventDefault();
    const email = app.querySelector("#login-email").value.trim();
    if (!email) return toast("Type your email above first, then click this again.");
    try {
      await sendPasswordReset(email);
      toast("Password reset email sent — check your inbox.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  });
}
