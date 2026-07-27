// ============================================================
// Data layer — talks to Supabase when configured, otherwise
// serves built-in sample data ("demo mode").
//
// A "product" is one row of the `mods` table. Its `kind` decides
// how it is delivered:
//   mod          — a downloadable file, same for every buyer
//   account      — one line from the stock pile per sale
//   subscription — recurring Stripe payment
// ============================================================

import { CONFIG } from "./config.js";

export const isLive = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

export let supabase = null;
if (isLive) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

// ---------- Product kinds ----------

export const KINDS = {
  mod: { label: "Mod", icon: "🧩", noun: "mod" },
  account: { label: "Account", icon: "🔑", noun: "account" },
  subscription: { label: "Subscription", icon: "🔁", noun: "subscription" },
  request: { label: "Request", icon: "✍️", noun: "commission" },
};

/** Where a paid commission is up to. */
export const REQUEST_STATUS = {
  new: { label: "Awaiting brief", tone: "neutral" },
  in_progress: { label: "Being built", tone: "warn" },
  delivered: { label: "Delivered", tone: "ok" },
  declined: { label: "Declined", tone: "bad" },
};

export const kindOf = (p) => (p?.kind in KINDS ? p.kind : "mod");

/** Is this subscription purchase still giving access? */
export const isSubActive = (purchase) =>
  purchase?.kind !== "subscription" ||
  ["active", "trialing"].includes(purchase?.sub_status ?? "") ||
  (purchase?.current_period_end && new Date(purchase.current_period_end) > new Date());

// ---------- Demo data (shown until Supabase is connected) ----------

const DEMO_PRODUCTS = [
  {
    id: "demo-1",
    kind: "mod",
    title: "Nightfall Overhaul",
    game: "Skyrim",
    tagline: "A complete lighting and weather overhaul that turns every night into a blood-moon horror show.",
    description:
      "Nightfall Overhaul rebuilds the entire day/night cycle from scratch.\n\n• 40+ handcrafted weather types\n• Dynamic blood-moon events with unique loot\n• Fully compatible with ENB presets\n• Zero scripts — pure performance",
    version: "2.4.1",
    price_cents: 799,
    featured: true,
    downloads: 12480,
    created_at: "2026-05-02T12:00:00Z",
    updated_at: "2026-07-14T12:00:00Z",
  },
  {
    id: "demo-2",
    kind: "account",
    title: "Spotify Premium — 2 Months",
    game: "Streaming",
    tagline: "A fresh private account with 2 months of Premium already loaded. Delivered the second you pay.",
    description:
      "Full Premium: ad-free, offline downloads, and 320kbps audio.\n\n• Private account, credentials handed to you instantly\n• Warranty for the full 2 months\n• Change the password as soon as you log in",
    version: "1.0.0",
    price_cents: 150,
    featured: true,
    downloads: 0,
    created_at: "2026-06-18T12:00:00Z",
    _stock: { available: 45, total: 60 },
  },
  {
    id: "demo-3",
    kind: "subscription",
    title: "Loofy Vault — All Access",
    game: "Membership",
    tagline: "Every mod I have ever released, plus everything new, for one monthly price.",
    description:
      "One membership, the whole catalogue.\n\n• Instant access to every paid mod\n• New drops unlocked the day they land\n• Members-only builds and early betas\n• Cancel any time from your account page",
    version: "1.0.0",
    price_cents: 599,
    sub_interval: "month",
    sub_interval_count: 1,
    featured: true,
    downloads: 0,
    created_at: "2026-06-01T12:00:00Z",
  },
  {
    id: "demo-4",
    kind: "mod",
    title: "Crimson HUD",
    game: "Minecraft",
    tagline: "A sleek, animated HUD and inventory reskin with a dark crimson aesthetic.",
    description:
      "Crimson HUD replaces every interface element in the game with a clean, animated dark theme.\n\n• Works with Fabric & Forge\n• Animated hotbar and health effects\n• Config screen with 30+ toggles",
    version: "3.1.0",
    price_cents: 0,
    featured: false,
    downloads: 45102,
    created_at: "2026-03-20T12:00:00Z",
  },
  {
    id: "demo-5",
    kind: "account",
    title: "Netflix Premium — 1 Month",
    game: "Streaming",
    tagline: "4K on four screens, private profile, delivered instantly from stock.",
    description: "A private Netflix Premium slot for one month. 4K UHD, four simultaneous screens.",
    version: "1.0.0",
    price_cents: 299,
    featured: false,
    downloads: 0,
    created_at: "2026-06-30T12:00:00Z",
    _stock: { available: 0, total: 24 },
  },
  {
    id: "demo-6",
    kind: "mod",
    title: "Tactical AI Rework",
    game: "Ready or Not",
    tagline: "Suspects flank, retreat, and set ambushes. You will not clear rooms the same way again.",
    description:
      "A ground-up rework of suspect and civilian AI behaviour trees.\n\n• Suspects coordinate and use cover intelligently\n• Difficulty presets from Realistic to Nightmare\n• Compatible with all official maps",
    version: "1.2.3",
    price_cents: 599,
    featured: false,
    downloads: 3308,
    created_at: "2026-02-14T12:00:00Z",
    updated_at: "2026-07-02T12:00:00Z",
  },
];

const demoError = () => {
  const err = new Error(
    "Demo mode — connect Supabase to enable accounts and purchases (see README.md)."
  );
  err.demo = true;
  return err;
};

/** Turn a raw Postgres error from our RPCs into something a human can read. */
function friendlyError(err) {
  const raw = err?.message ?? "";
  if (/SOLD_OUT/.test(raw)) return new Error("Sold out — every account from this batch is gone.");
  if (/NOT_FREE/.test(raw)) return new Error("This one isn't free — use the buy button.");
  if (/NEEDS_CHECKOUT/.test(raw)) return new Error("Subscriptions have to be started through checkout.");
  if (/NOT_SIGNED_IN/.test(raw)) return new Error("Sign in first.");
  if (/PRODUCT_NOT_FOUND/.test(raw)) return new Error("That product no longer exists.");
  return err;
}

// ---------- Auth ----------

export async function getSession() {
  if (!isLive) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  if (!isLive) return;
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function signUp(email, password, username) {
  if (!isLive) throw demoError();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  if (!isLive) throw demoError();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!isLive) return;
  await supabase.auth.signOut();
}

export async function sendPasswordReset(email) {
  if (!isLive) throw demoError();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/account.html`,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  if (!isLive) throw demoError();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ---------- Profiles ----------

export async function getMyProfile() {
  if (!isLive) return null;
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function updateUsername(username) {
  if (!isLive) throw demoError();
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", session.user.id);
  if (error) throw error;
}

// ---------- Products ----------

export async function getProducts({ featured = null, includeUnpublished = false } = {}) {
  if (!isLive) {
    let list = DEMO_PRODUCTS.map((p) => ({ ...p }));
    if (featured !== null) list = list.filter((p) => p.featured === featured);
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  let query = supabase.from("mods").select("*").order("created_at", { ascending: false });
  if (!includeUnpublished) query = query.eq("published", true);
  if (featured !== null) query = query.eq("featured", featured);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getProduct(id) {
  if (!isLive) {
    const found = DEMO_PRODUCTS.find((p) => p.id === id);
    return found ? { ...found } : null;
  }
  const { data, error } = await supabase.from("mods").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Map of product id → { available, total } for every product with stock. */
export async function getStockMap() {
  if (!isLive) {
    const map = {};
    for (const p of DEMO_PRODUCTS) if (p._stock) map[p.id] = { ...p._stock };
    return map;
  }
  const { data, error } = await supabase.rpc("get_stock_counts");
  if (error) throw error;
  const map = {};
  for (const row of data ?? []) map[row.mod_id] = { available: row.available, total: row.total };
  return map;
}

/** Attach _stock and _rating so cards can render everything in one pass. */
export async function decorate(products) {
  const [stock, ratings] = await Promise.all([
    getStockMap().catch(() => ({})),
    getRatings().catch(() => ({})),
  ]);
  for (const p of products) {
    p._stock = stock[p.id] ?? p._stock ?? null;
    p._rating = ratings[p.id] ?? null;
  }
  return products;
}

/** Real store-wide numbers for the home page ("Facts, not claims"). */
export async function getStoreStats() {
  if (!isLive) {
    return {
      customers: 155,
      sales: 324,
      products: DEMO_PRODUCTS.length,
      downloads: DEMO_PRODUCTS.reduce((n, p) => n + (p.downloads ?? 0), 0),
      avg_rating: 5,
    };
  }
  const { data: rows, error } = await supabase.rpc("get_store_stats");
  if (error) throw error;
  const data = rows?.[0];
  return {
    customers: data?.customers ?? 0,
    sales: data?.sales ?? 0,
    products: data?.products ?? 0,
    downloads: data?.downloads ?? 0,
    avg_rating: data?.avg_rating == null ? null : Number(data.avg_rating),
  };
}

// ---------- Purchases / library ----------

export async function getMyPurchases() {
  if (!isLive) return [];
  const session = await getSession();
  if (!session) return [];

  const query = (select) =>
    supabase
      .from("purchases")
      .select(select)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

  const { data, error } = await query("*, mods(*), stock_items(id, content, claimed_at)");
  if (!error) return data;

  // A database that hasn't had upgrade-v2.sql run yet has no stock_items
  // table, so the join can't resolve. Load the library without account
  // credentials rather than showing the user an error they can't act on.
  if (/stock_items|schema cache|relationship/i.test(error.message)) {
    const retry = await query("*, mods(*)");
    if (retry.error) throw retry.error;
    return retry.data;
  }
  throw error;
}

/** How many copies of a product the signed-in user owns (0 = none). */
export async function ownedCount(productId) {
  if (!isLive) return 0;
  const session = await getSession();
  if (!session) return 0;
  const { count, error } = await supabase
    .from("purchases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .eq("mod_id", productId);
  if (error) throw error;
  return count ?? 0;
}

/** The signed-in user's purchase row for a product, if any. */
export async function getMyPurchaseFor(productId) {
  if (!isLive) return null;
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("user_id", session.user.id)
    .eq("mod_id", productId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

/** Add a free product to the signed-in user's library (admins: anything). */
export async function claimFreeProduct(product) {
  if (!isLive) throw demoError();
  const session = await getSession();
  if (!session) throw new Error("Sign in to add products to your library.");
  const { error } = await supabase.rpc("claim_free_product", { p_mod: product.id });
  if (error) throw friendlyError(error);
}

/** Start a Stripe Checkout (one-off or subscription). Returns the URL. */
export async function createCheckout(productId) {
  if (!isLive) throw demoError();
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { mod_id: productId },
  });
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error ?? "Could not start checkout.");
  return data.url;
}

/** Open Stripe's billing portal so the user can cancel/update a subscription. */
export async function createBillingPortal() {
  if (!isLive) throw demoError();
  const { data, error } = await supabase.functions.invoke("billing-portal", { body: {} });
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error ?? "Could not open the billing portal.");
  return data.url;
}

/** Signed download URL for a product the user owns (valid 60s). */
export async function getDownloadUrl(product) {
  if (!isLive) throw demoError();
  if (!product.file_path) throw new Error("No file has been uploaded for this product yet.");
  const { data, error } = await supabase.storage
    .from("mod-files")
    .createSignedUrl(product.file_path, 60);
  if (error) throw error;
  supabase.rpc("increment_downloads", { mod: product.id }).then(() => {});
  return data.signedUrl;
}

// ---------- Requests (paid custom-mod commissions) ----------

/**
 * Purchases of request-kind products that don't have a brief written yet.
 * These are what the library turns into "tell me what you want" forms.
 */
export async function getMyRequests() {
  if (!isLive) return [];
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("requests")
    .select("*, mods(title, game, image_url)")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/** Write the brief for a commission that has already been paid for. */
export async function createRequest({ purchaseId, modId, title, game, details, referenceUrl }) {
  if (!isLive) throw demoError();
  const session = await getSession();
  if (!session) throw new Error("Sign in first.");
  const { data, error } = await supabase
    .from("requests")
    .insert({
      purchase_id: purchaseId,
      user_id: session.user.id,
      mod_id: modId,
      title,
      game: game || null,
      details,
      reference_url: referenceUrl || null,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("You've already sent the brief for this one.");
    if (/row-level security/i.test(error.message)) {
      throw new Error("That commission hasn't been paid for yet.");
    }
    throw error;
  }
  return data;
}

/** Buyers can still tweak the brief while the status is "new". */
export async function updateRequestBrief(id, { title, game, details, referenceUrl }) {
  if (!isLive) throw demoError();
  const { error } = await supabase
    .from("requests")
    .update({ title, game: game || null, details, reference_url: referenceUrl || null })
    .eq("id", id);
  if (error) {
    if (/row-level security/i.test(error.message)) {
      throw new Error("This one is already being worked on — message me instead of editing it.");
    }
    throw error;
  }
}

/**
 * Every request in the store — admins only (RLS enforces it).
 * Usernames come from a second query: requests.user_id points at
 * auth.users, so PostgREST can't join it to profiles on its own.
 */
export async function getAllRequests() {
  if (!isLive) return [];
  const { data, error } = await supabase
    .from("requests")
    .select("*, mods(title, game)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = [...new Set(data.map((r) => r.user_id))];
  if (ids.length) {
    const { data: people } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", ids);
    const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.username]));
    for (const r of data) r._username = names[r.user_id] ?? null;
  }
  return data;
}

/** Admin side: move a request along, leave a note, attach the finished file. */
export async function updateRequest(id, patch) {
  if (!isLive) throw demoError();
  const { error } = await supabase.from("requests").update(patch).eq("id", id);
  if (error) throw error;
}

/** Signed URL for a delivered commission file (valid 60s). */
export async function getRequestDownloadUrl(request) {
  if (!isLive) throw demoError();
  if (!request.file_path) throw new Error("Nothing has been delivered for this one yet.");
  const { data, error } = await supabase.storage
    .from("mod-files")
    .createSignedUrl(request.file_path, 60);
  if (error) throw error;
  return data.signedUrl;
}

// ---------- Ratings ----------

/** Map of product id → { avg, count } for every rated product. */
export async function getRatings() {
  if (!isLive) return {};
  const { data, error } = await supabase.from("mod_ratings").select("*");
  if (error) throw error;
  const map = {};
  for (const r of data) map[r.mod_id] = { avg: Number(r.avg_rating), count: r.rating_count };
  return map;
}

/** The signed-in user's own rating for a product (1–5), or null. */
export async function getMyRating(productId) {
  if (!isLive) return null;
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("ratings")
    .select("stars")
    .eq("user_id", session.user.id)
    .eq("mod_id", productId)
    .maybeSingle();
  if (error) throw error;
  return data?.stars ?? null;
}

/** Rate a product 1–5 stars (owners only; re-rating overwrites). */
export async function rateProduct(productId, stars) {
  if (!isLive) throw demoError();
  const session = await getSession();
  if (!session) throw new Error("Sign in to rate products.");
  const { error } = await supabase.from("ratings").upsert(
    { user_id: session.user.id, mod_id: productId, stars },
    { onConflict: "user_id,mod_id" }
  );
  if (error) throw error;
}

// ---------- Admin ----------

export async function saveProduct(product) {
  if (!isLive) throw demoError();
  const { data, error } = await supabase.from("mods").upsert(product).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id) {
  if (!isLive) throw demoError();
  const { error } = await supabase.from("mods").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadImage(file) {
  if (!isLive) throw demoError();
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("mod-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("mod-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadProductFile(file) {
  if (!isLive) throw demoError();
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("mod-files").upload(path, file);
  if (error) throw error;
  return path;
}

/**
 * Add accounts to a product's stock pile.
 * `lines` is one credential per entry — blank lines and duplicates
 * already in stock are dropped before inserting.
 */
export async function addStock(productId, lines) {
  if (!isLive) throw demoError();
  const cleaned = [...new Set(lines.map((l) => l.trim()).filter(Boolean))];
  if (!cleaned.length) throw new Error("That file had no usable lines in it.");

  const { data: existing, error: readErr } = await supabase
    .from("stock_items")
    .select("content")
    .eq("mod_id", productId);
  if (readErr) throw readErr;

  const already = new Set((existing ?? []).map((r) => r.content));
  const fresh = cleaned.filter((c) => !already.has(c));
  if (!fresh.length) throw new Error("Every line in that file is already in stock.");

  const { error } = await supabase
    .from("stock_items")
    .insert(fresh.map((content) => ({ mod_id: productId, content })));
  if (error) throw error;
  return { added: fresh.length, skipped: cleaned.length - fresh.length };
}

/** Full stock list for one product — admins only (RLS enforces it). */
export async function getStock(productId) {
  if (!isLive) return [];
  const { data, error } = await supabase
    .from("stock_items")
    .select("id, content, claimed_by, claimed_at")
    .eq("mod_id", productId)
    .order("created_at");
  if (error) throw error;
  return data;
}

/** Throw away the accounts nobody has bought yet (sold ones are kept). */
export async function clearUnsoldStock(productId) {
  if (!isLive) throw demoError();
  const { error } = await supabase
    .from("stock_items")
    .delete()
    .eq("mod_id", productId)
    .is("claimed_by", null);
  if (error) throw error;
}
