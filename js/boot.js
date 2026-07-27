// ============================================================
// Runs before first paint, from <head>, deliberately NOT a module
// (modules are deferred, which would let the page flash first).
//
// Kept in its own file rather than inline so index.html can carry a
// strict script-src CSP without needing an inline-script hash that
// silently breaks the theme the moment anyone edits it.
// ============================================================

(function () {
  // Don't let the store be framed and click-jacked. GitHub Pages can't send
  // an X-Frame-Options header and <meta> CSP ignores frame-ancestors, so
  // this is the only lever available.
  try {
    if (window.top !== window.self) {
      document.documentElement.style.display = "none";
      window.top.location = window.self.location.href;
    }
  } catch (e) {
    // Cross-origin parent blocked the read or the navigation. The page stays
    // hidden, which is the safe outcome.
  }

  // Apply the saved theme up front so there is never a flash of the default.
  try {
    var t = localStorage.getItem("justloofy-theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  } catch (e) {
    // Storage blocked (private mode / cookies off) — the default theme is fine.
  }
})();
