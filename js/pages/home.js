import { getMods } from "../db.js";
import { modCardHtml, toast } from "../ui.js";
import { animateCount } from "../effects.js";

const fmt = (n) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+` : String(n);

async function init() {
  const grid = document.getElementById("featured-grid");
  try {
    const all = await getMods();
    const featured = all.filter((m) => m.featured);
    const toShow = (featured.length ? featured : all).slice(0, 3);

    grid.innerHTML = toShow.length
      ? toShow.map(modCardHtml).join("")
      : `<div class="empty" style="grid-column:1/-1"><div class="big">🌒</div>First drops are in the works — check back soon!</div>`;

    // An empty store shouldn't brag about zero downloads
    if (!all.length) {
      document.getElementById("hero-stats").style.display = "none";
      return;
    }

    animateCount(document.getElementById("stat-mods"), all.length, { format: String });
    animateCount(
      document.getElementById("stat-downloads"),
      all.reduce((sum, m) => sum + (m.downloads ?? 0), 0),
      { format: fmt, duration: 1800 }
    );
    animateCount(document.getElementById("stat-games"), new Set(all.map((m) => m.game)).size, {
      format: String,
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty"><div class="big">⚠️</div>Couldn't load mods. Try refreshing.</div>`;
    toast(err.message, "error");
  }
}

init();
