import { pageTitle } from "../ui.js";

export async function successView(app) {
  document.title = pageTitle("Order complete");
  app.innerHTML = `
    <div class="success-wrap">
      <div class="icon-big">🎉</div>
      <h1>You got it!</h1>
      <p>
        Payment confirmed. Your order is landing in your library right now — the mod file,
        your account details, or your membership unlock, depending on what you bought.
        It usually shows up within a few seconds.
      </p>
      <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary btn-lg" href="#/account">Go to my library</a>
        <a class="btn btn-ghost btn-lg" href="#/products">Keep browsing</a>
      </div>
    </div>`;
}
