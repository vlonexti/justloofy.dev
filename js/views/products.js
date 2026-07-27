import { getProducts, decorate, KINDS, kindOf } from "../db.js";
import { productCardHtml, esc, toast, pageTitle } from "../ui.js";

const KIND_TABS = [
  { id: "all", label: "Everything" },
  { id: "mod", label: `${KINDS.mod.icon} Mods` },
  { id: "account", label: `${KINDS.account.icon} Accounts` },
  { id: "subscription", label: `${KINDS.subscription.icon} Subscriptions` },
  { id: "request", label: `${KINDS.request.icon} Requests` },
];

export async function productsView(app, { params }) {
  document.title = pageTitle("Store");

  const urlKind = params.get("kind");
  let activeKind = KIND_TABS.some((t) => t.id === urlKind) ? urlKind : "all";
  let activeCategory = "All";
  let all = [];

  app.innerHTML = `
    <div class="container">
      <div class="page-head">
        <h1>The store</h1>
        <p>Mods, accounts, and memberships in one place. Everything here is delivered the moment you pay.</p>
      </div>

      <div class="chips" id="kind-tabs" style="margin-bottom:18px"></div>

      <div class="toolbar">
        <div class="search-box">
          <input type="search" id="search" placeholder="Search the store..." autocomplete="off">
        </div>
        <select id="sort" style="width:auto">
          <option value="newest">Newest first</option>
          <option value="updated">Recently updated</option>
          <option value="popular">Most popular</option>
          <option value="price-low">Price: low → high</option>
          <option value="price-high">Price: high → low</option>
        </select>
      </div>
      <div class="chips" id="category-chips" style="margin-bottom:30px"></div>

      <div class="product-grid" id="products-grid" style="padding-bottom:80px">
        <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
      </div>
    </div>`;

  const grid = app.querySelector("#products-grid");
  const searchInput = app.querySelector("#search");
  const sortSelect = app.querySelector("#sort");
  const kindTabsEl = app.querySelector("#kind-tabs");
  const categoryEl = app.querySelector("#category-chips");

  const inKind = (p) => activeKind === "all" || kindOf(p) === activeKind;

  function render() {
    const term = searchInput.value.trim().toLowerCase();
    const list = all.filter(
      (p) =>
        inKind(p) &&
        (activeCategory === "All" || p.game === activeCategory) &&
        (!term ||
          p.title.toLowerCase().includes(term) ||
          (p.tagline ?? "").toLowerCase().includes(term) ||
          p.game.toLowerCase().includes(term))
    );

    const stamp = (p) => new Date(p.updated_at ?? p.created_at);
    switch (sortSelect.value) {
      case "updated":    list.sort((a, b) => stamp(b) - stamp(a)); break;
      case "popular":    list.sort((a, b) => (b._rating?.count ?? 0) - (a._rating?.count ?? 0) || (b.downloads ?? 0) - (a.downloads ?? 0)); break;
      case "price-low":  list.sort((a, b) => a.price_cents - b.price_cents); break;
      case "price-high": list.sort((a, b) => b.price_cents - a.price_cents); break;
      default:           list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    grid.innerHTML = list.length
      ? list.map(productCardHtml).join("")
      : `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div>Nothing matches that — try a different search or filter.</div>`;
  }

  function renderKindTabs() {
    kindTabsEl.innerHTML = KIND_TABS.filter(
      (t) => t.id === "all" || all.some((p) => kindOf(p) === t.id)
    )
      .map((t) => {
        const n = t.id === "all" ? all.length : all.filter((p) => kindOf(p) === t.id).length;
        return `<button class="chip ${t.id === activeKind ? "active" : ""}" data-kind="${t.id}">${t.label} <span style="opacity:.6">${n}</span></button>`;
      })
      .join("");

    kindTabsEl.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        activeKind = chip.dataset.kind;
        activeCategory = "All";
        renderKindTabs();
        renderCategories();
        render();
      })
    );
  }

  function renderCategories() {
    const categories = ["All", ...new Set(all.filter(inKind).map((p) => p.game))];
    categoryEl.innerHTML =
      categories.length > 2
        ? categories
            .map(
              (c) =>
                `<button class="chip ${c === activeCategory ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`
            )
            .join("")
        : "";

    categoryEl.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        activeCategory = chip.dataset.cat;
        renderCategories();
        render();
      })
    );
  }

  searchInput.addEventListener("input", render);
  sortSelect.addEventListener("change", render);

  try {
    all = await decorate(await getProducts());
    renderKindTabs();
    renderCategories();
    render();
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">⚠️</div>Couldn't load the store. Try refreshing.</div>`;
    toast(err.message, "error");
  }
}
