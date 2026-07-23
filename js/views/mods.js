import { getMods } from "../db.js";
import { modCardHtml, esc, toast } from "../ui.js";

export async function modsView(app) {
  document.title = "All Mods — JustLoofy Mods";

  app.innerHTML = `
    <div class="container">
      <div class="page-head">
        <h1>All mods</h1>
        <p>Every release, in one place. Filter by game or search for something specific.</p>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <input type="search" id="search" placeholder="Search mods..." autocomplete="off">
        </div>
        <select id="sort" style="width:auto">
          <option value="newest">Newest first</option>
          <option value="popular">Most downloaded</option>
          <option value="price-low">Price: low → high</option>
          <option value="price-high">Price: high → low</option>
        </select>
      </div>
      <div class="chips" id="game-chips" style="margin-bottom:30px"></div>

      <div class="mod-grid" id="mods-grid" style="padding-bottom:70px">
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
      </div>
    </div>`;

  const grid = app.querySelector("#mods-grid");
  const searchInput = app.querySelector("#search");
  const sortSelect = app.querySelector("#sort");
  const chipsEl = app.querySelector("#game-chips");

  let allMods = [];
  let activeGame = "All";

  function render() {
    const term = searchInput.value.trim().toLowerCase();
    let mods = allMods.filter(
      (m) =>
        (activeGame === "All" || m.game === activeGame) &&
        (!term ||
          m.title.toLowerCase().includes(term) ||
          (m.tagline ?? "").toLowerCase().includes(term) ||
          m.game.toLowerCase().includes(term))
    );

    switch (sortSelect.value) {
      case "popular":    mods.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0)); break;
      case "price-low":  mods.sort((a, b) => a.price_cents - b.price_cents); break;
      case "price-high": mods.sort((a, b) => b.price_cents - a.price_cents); break;
      default:           mods.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    grid.innerHTML = mods.length
      ? mods.map(modCardHtml).join("")
      : `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div>No mods match that — try a different search.</div>`;
  }

  function renderChips() {
    const games = ["All", ...new Set(allMods.map((m) => m.game))];
    chipsEl.innerHTML = games
      .map((g) => `<button class="chip ${g === activeGame ? "active" : ""}" data-game="${esc(g)}">${esc(g)}</button>`)
      .join("");
    chipsEl.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        activeGame = chip.dataset.game;
        renderChips();
        render();
      })
    );
  }

  searchInput.addEventListener("input", render);
  sortSelect.addEventListener("change", render);

  try {
    allMods = await getMods();
    renderChips();
    render();
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">⚠️</div>Couldn't load mods. Try refreshing.</div>`;
    toast(err.message, "error");
  }
}
