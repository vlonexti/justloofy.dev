import { isLive, getSession, getMods, getRatings } from "../db.js";
import { modCardHtml, toast } from "../ui.js";
import { animateCount } from "../effects.js";

const fmt = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+` : String(n);

export async function homeView(app) {
  document.title = "JustLoofy Mods — Premium Game Mods";

  const signedIn = Boolean(isLive ? await getSession() : null);

  app.innerHTML = `
    <section class="hero">
      <div class="embers" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
        <span></span><span></span><span></span><span></span>
      </div>
      <img class="hero-moon" src="assets/favicon.svg" alt="" aria-hidden="true">
      <div class="container">
        <div class="hero-badge">🌒 New drops every month</div>
        <h1>Game mods,<br>done <span class="grad">properly</span>.</h1>
        <p class="sub">Handcrafted mods by Steven. Buy once, keep forever — every mod lives in your library with instant downloads and free updates.</p>
        <div class="hero-cta">
          <a class="btn btn-primary btn-lg" href="#/mods">Browse mods</a>
          ${signedIn
            ? `<a class="btn btn-ghost btn-lg" href="#/account">My library</a>`
            : `<a class="btn btn-ghost btn-lg" href="#/auth?tab=signup">Create free account</a>`}
        </div>
        <div class="hero-stats" id="hero-stats">
          <div class="stat"><b id="stat-mods">—</b><span>Mods released</span></div>
          <div class="stat"><b id="stat-downloads">—</b><span>Total downloads</span></div>
          <div class="stat"><b id="stat-games">—</b><span>Games supported</span></div>
        </div>
        <div class="trust-bar">
          <div><span>🔒</span> Secure Stripe checkout</div>
          <div><span>⚡</span> Instant downloads</div>
          <div><span>🔄</span> Free updates forever</div>
          <div><span>🛡️</span> Every file built &amp; tested by me</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <h2>Featured mods</h2>
            <p>The current lineup — hand-picked and battle-tested.</p>
          </div>
          <a class="btn btn-outline btn-sm" href="#/mods">View all →</a>
        </div>
        <div class="mod-grid" id="featured-grid">
          <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <h2>Why buy here?</h2>
            <p>Direct from the creator — no middlemen, no lockers, no ads.</p>
          </div>
        </div>
        <div class="feature-grid">
          <div class="feature reveal">
            <div class="icon">⚡</div>
            <h3>Instant delivery</h3>
            <p>Pay with card via Stripe and the mod lands in your library immediately. Download it as many times as you want.</p>
          </div>
          <div class="feature reveal">
            <div class="icon">🔄</div>
            <h3>Free updates forever</h3>
            <p>Buy once and every future version of that mod is yours. Updates appear right in your library.</p>
          </div>
          <div class="feature reveal">
            <div class="icon">🛡️</div>
            <h3>Clean &amp; safe files</h3>
            <p>Every release is built and tested by me personally. No repacks, no bundled junk, no sketchy installers.</p>
          </div>
          <div class="feature reveal">
            <div class="icon">💬</div>
            <h3>Direct support</h3>
            <p>Something broken? Reach me on the channel or GitHub and I'll get you sorted — I actually answer.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="section-head">
          <div>
            <h2>Questions, answered</h2>
            <p>Everything buyers usually ask before hitting the button.</p>
          </div>
        </div>
        <div class="faq">
          <details class="reveal">
            <summary>How do I get my mod after buying?<span class="faq-icon">+</span></summary>
            <p>Instantly. The moment your payment goes through, the mod appears in your library on your account page. Download it as many times as you want, on any device — your purchases never expire.</p>
          </details>
          <details class="reveal">
            <summary>Do I have to pay again for updates?<span class="faq-icon">+</span></summary>
            <p>Never. Buy a mod once and every future version is yours free. When an update drops, just re-download from your library and you'll get the latest version.</p>
          </details>
          <details class="reveal">
            <summary>What payment methods do you accept?<span class="faq-icon">+</span></summary>
            <p>Checkout is handled by Stripe, so all major credit and debit cards work (plus Apple Pay and Google Pay where available). Your card details go straight to Stripe — this site never sees or stores them.</p>
          </details>
          <details class="reveal">
            <summary>Can I use a mod on more than one PC?<span class="faq-icon">+</span></summary>
            <p>Yes — a purchase is for you, not for one machine. Install it on every PC you play on. Just don't share the files around; every sale keeps new mods coming.</p>
          </details>
          <details class="reveal">
            <summary>Something's broken — what do I do?<span class="faq-icon">+</span></summary>
            <p>Reach out on the YouTube channel or GitHub (links in the footer) and I'll get you sorted. If a mod genuinely doesn't work as described, I'll make it right.</p>
          </details>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="cta-band reveal">
          ${signedIn
            ? `<h2>Your library is waiting.</h2>
               <p>Downloads never expire and every update is free — grab something new for the collection.</p>
               <a class="btn btn-primary btn-lg" href="#/account">Open my library</a>`
            : `<h2>Ready to mod like you mean it?</h2>
               <p>Create a free account and start building your library today. Buy once, keep forever.</p>
               <a class="btn btn-primary btn-lg" href="#/auth?tab=signup">Get started — it's free</a>`}
        </div>
      </div>
    </section>`;

  const grid = app.querySelector("#featured-grid");
  try {
    const [all, ratings] = await Promise.all([getMods(), getRatings().catch(() => ({}))]);
    all.forEach((m) => (m._rating = ratings[m.id]));
    const featured = all.filter((m) => m.featured);
    const toShow = (featured.length ? featured : all).slice(0, 3);

    grid.innerHTML = toShow.length
      ? toShow.map(modCardHtml).join("")
      : `<div class="empty" style="grid-column:1/-1"><div class="big">🌒</div>First drops are in the works — check back soon!</div>`;

    if (!all.length) {
      app.querySelector("#hero-stats").style.display = "none";
      return;
    }

    animateCount(app.querySelector("#stat-mods"), all.length, { format: String });
    animateCount(
      app.querySelector("#stat-downloads"),
      all.reduce((sum, m) => sum + (m.downloads ?? 0), 0),
      { format: fmt, duration: 1800 }
    );
    animateCount(app.querySelector("#stat-games"), new Set(all.map((m) => m.game)).size, {
      format: String,
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">⚠️</div>Couldn't load mods. Try refreshing.</div>`;
    toast(err.message, "error");
  }
}
