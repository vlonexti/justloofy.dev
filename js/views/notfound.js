export async function notFoundView(app) {
  document.title = "Page not found — JustLoofy Mods";
  app.innerHTML = `
    <div class="success-wrap">
      <div class="icon-big" style="background:var(--accent-soft);border-color:rgba(255,59,78,0.4)">🌑</div>
      <h1>404 — lost in the void</h1>
      <p>That page doesn't exist (or a mod ate it). Let's get you back somewhere useful.</p>
      <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary btn-lg" href="#/">Back to home</a>
        <a class="btn btn-ghost btn-lg" href="#/mods">Browse mods</a>
      </div>
    </div>`;
}
