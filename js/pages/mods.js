import { getMods } from "../db.js";
import { modCardHtml, esc, toast } from "../ui.js";

let allMods = [];
let activeGame = "All";

const grid = document.getElementById("mods-grid");
const searchInput = document.getElementById("search");
const sortSelect = document.getElementById("sort");
const chipsEl = document.getElementById("game-chips");

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

async function init() {
  try {
    allMods = await getMods();
    renderChips();
    render();
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">⚠️</div>Couldn't load mods. Try refreshing.</div>`;
    toast(err.message, "error");
  }
}

searchInput.addEventListener("input", render);
sortSelect.addEventListener("change", render);
init();
