export async function successView(app) {
  document.title = "Purchase complete — JustLoofy Mods";
  app.innerHTML = `
    <div class="success-wrap">
      <div class="icon-big">🎉</div>
      <h1>You got it!</h1>
      <p>Payment confirmed — your new mod is being added to your library right now. It usually shows up within a few seconds.</p>
      <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary btn-lg" href="#/account">Go to my library</a>
        <a class="btn btn-ghost btn-lg" href="#/mods">Keep browsing</a>
      </div>
    </div>`;
}
