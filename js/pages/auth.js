import { isLive, getSession, signIn, signUp, sendPasswordReset } from "../db.js";
import { toast } from "../ui.js";

const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const title = document.getElementById("auth-title");
const sub = document.getElementById("auth-sub");

const nextUrl = new URLSearchParams(location.search).get("next") || "account.html";

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
if (location.hash === "#signup") showTab("signup");

// Already signed in? Straight to the account page.
if (isLive) {
  getSession().then((s) => { if (s) location.replace(nextUrl); });
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = loginForm.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    await signIn(
      document.getElementById("login-email").value.trim(),
      document.getElementById("login-password").value
    );
    location.href = nextUrl;
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
      document.getElementById("signup-email").value.trim(),
      document.getElementById("signup-password").value,
      document.getElementById("signup-username").value.trim()
    );
    if (session) {
      location.href = nextUrl;
    } else {
      // Email confirmation is enabled on the Supabase project
      toast("Check your email to confirm your account, then sign in.", "success");
      showTab("login");
      btn.disabled = false;
    }
  } catch (err) {
    toast(err.message, "error");
    btn.disabled = false;
  }
});

document.getElementById("forgot-link").addEventListener("click", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  if (!email) return toast("Type your email above first, then click this again.");
  try {
    await sendPasswordReset(email);
    toast("Password reset email sent — check your inbox.", "success");
  } catch (err) {
    toast(err.message, "error");
  }
});
