import { isLive, getSession, getProducts, getStoreStats, decorate } from "../db.js";
import { productCardHtml, toast, pageTitle } from "../ui.js";
import { CONFIG } from "../config.js";
import { animateCount } from "../effects.js";

export async function homeView(app) {
  document.title = pageTitle();

  const signedIn = Boolean(isLive ? await getSession() : null);

  app.innerHTML = `
    <section class="hero">
      <div class="hero-orb" aria-hidden="true"></div>
      <div class="stars" aria-hidden="true"></div>
      <div class="container">
        <div class="pill-badge reveal" id="trust-badge">
          <span class="dot-live"></span> Trusted by <b id="trust-count">—</b> customers
        </div>
        <h1 class="reveal">Everything you play,<br>delivered instantly.</h1>
        <p class="sub reveal">
          Handcrafted game mods, ready-to-use accounts, and all-access memberships.
          Pay once, it lands in your library seconds later — no lockers, no ads, no waiting.
        </p>
        <div class="hero-cta reveal">
          <a class="btn btn-primary btn-lg" href="#/products">Browse the store</a>
          <a class="btn btn-ghost btn-lg" href="${CONFIG.DISCORD_URL}" target="_blank" rel="noopener">Join the Discord</a>
        </div>
        ${signedIn ? "" : `<p class="hero-note reveal"><a href="#/auth?tab=signup">Create a free account</a> — it takes ten seconds and keeps everything you buy.</p>`}
      </div>
      <div class="hero-fade" aria-hidden="true"></div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <h2>Featured right now</h2>
            <p>The current lineup — hand-picked and in stock.</p>
          </div>
          <a class="btn btn-outline btn-sm" href="#/products">View all →</a>
        </div>
        <div class="product-grid" id="featured-grid">
          <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head center">
          <div>
            <h2>Why buy here?</h2>
            <p>Direct from the creator — no middlemen, no lockers, no ads.</p>
          </div>
        </div>
        <div class="feature-grid">
          <div class="feature reveal">
            <div class="icon">⚡</div>
            <h3>Instant delivery</h3>
            <p>Pay by card through Stripe and it is in your library immediately — the file, the account credentials, or the membership unlock.</p>
          </div>
          <div class="feature reveal">
            <div class="icon">🔄</div>
            <h3>Free updates forever</h3>
            <p>Buy a mod once and every future version is yours. Updated releases are stamped with the date so you always know what's new.</p>
          </div>
          <div class="feature reveal">
            <div class="icon">📊</div>
            <h3>Real stock counts</h3>
            <p>Account listings show exactly how many are left, live. When it says 12 left, there are 12 — and yours is reserved the moment you pay.</p>
          </div>
          <div class="feature reveal">
            <div class="icon">💬</div>
            <h3>Direct support</h3>
            <p>Something broken? Reach me on the channel or GitHub and I'll sort it — I actually answer.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head center">
          <div>
            <h2>Questions, answered</h2>
            <p>Everything buyers usually ask before hitting the button.</p>
          </div>
        </div>
        <div class="faq">
          <details class="reveal">
            <summary>How fast do I get my order?<span class="faq-icon">+</span></summary>
            <p>Instantly. The moment your payment goes through it appears on your account page — mods as a download, accounts as credentials you can copy, memberships as an unlock. Nothing is sent by hand.</p>
          </details>
          <details class="reveal">
            <summary>What does "45 left" mean on an account listing?<span class="faq-icon">+</span></summary>
            <p>Exactly what it says. Every account is a separate item in stock, and one is reserved for you the second you pay. When the counter hits zero the listing shows Sold out until it is restocked.</p>
          </details>
          <details class="reveal">
            <summary>Do I have to pay again for mod updates?<span class="faq-icon">+</span></summary>
            <p>Never. Buy a mod once and every future version is yours free. Re-download from your library any time — the product page shows both the original release date and the date of the latest update.</p>
          </details>
          <details class="reveal">
            <summary>How do I cancel a subscription?<span class="faq-icon">+</span></summary>
            <p>From your account page — there's a Manage subscription button that opens Stripe's own billing portal. Cancel there and you keep access until the period you already paid for runs out.</p>
          </details>
          <details class="reveal">
            <summary>What payment methods do you accept?<span class="faq-icon">+</span></summary>
            <p>Checkout is handled by Stripe, so all major credit and debit cards work, plus Apple Pay and Google Pay where available. Your card details go straight to Stripe — this site never sees or stores them.</p>
          </details>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="cta-band reveal">
          ${signedIn
            ? `<h2>Your library is waiting.</h2>
               <p>Downloads never expire and every mod update is free — grab something new for the collection.</p>
               <a class="btn btn-primary btn-lg" href="#/account">Open my library</a>`
            : `<h2>Ready when you are.</h2>
               <p>Create a free account and start building your library today. Buy once, keep forever.</p>
               <a class="btn btn-primary btn-lg" href="#/auth?tab=signup">Get started — it's free</a>`}
        </div>
      </div>
    </section>`;

  // ---- trust badge (real customer count, quietly hidden if unavailable) ----
  const fallbackBadge = () => {
    const badge = app.querySelector("#trust-badge");
    if (badge) badge.innerHTML = `<span class="dot-live"></span> New drops every month`;
  };

  getStoreStats()
    .then((s) => {
      if (s.customers > 0) {
        animateCount(app.querySelector("#trust-count"), s.customers, { format: String });
      } else {
        fallbackBadge();
      }
    })
    .catch(fallbackBadge);

  // ---- featured products ----
  const grid = app.querySelector("#featured-grid");
  try {
    const all = await decorate(await getProducts());
    const featured = all.filter((p) => p.featured);
    const toShow = (featured.length ? featured : all).slice(0, 3);

    grid.innerHTML = toShow.length
      ? toShow.map(productCardHtml).join("")
      : `<div class="empty" style="grid-column:1/-1"><div class="big">🌒</div>First drops are in the works — check back soon!</div>`;
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">⚠️</div>Couldn't load the store. Try refreshing.</div>`;
    toast(err.message, "error");
  }
}
