// ============================================================
// Data layer — talks to Supabase when configured, otherwise
// serves built-in sample data ("demo mode").
// ============================================================

import { CONFIG } from "./config.js";

export const isLive = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

export let supabase = null;
if (isLive) {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
}

// ---------- Demo data (shown until Supabase is connected) ----------

const DEMO_MODS = [
  {
    id: "demo-1",
    title: "Nightfall Overhaul",
    game: "Skyrim",
    tagline: "A complete lighting and weather overhaul that turns every night into a blood-moon horror show.",
    description:
      "Nightfall Overhaul rebuilds the entire day/night cycle from scratch.\n\n• 40+ handcrafted weather types\n• Dynamic blood-moon events with unique loot\n• Fully compatible with ENB presets\n• Zero scripts — pure performance",
    version: "2.4.1",
    price_cents: 799,
    image_url: "",
    featured: true,
    downloads: 12480,
    created_at: "2026-05-02T12:00:00Z",
  },
  {
    id: "demo-2",
    title: "Velocity Drift Pack",
    game: "Assetto Corsa",
    tagline: "12 tuned drift builds with custom physics, sounds, and liveries.",
    description:
      "Every car in the Velocity pack has hand-tuned suspension geometry and real dyno-matched power curves.\n\n• 12 cars, 60+ liveries\n• Custom engine audio recorded from real builds\n• Setup sheets included for every track",
    version: "1.8.0",
    price_cents: 1299,
    image_url: "",
    featured: true,
    downloads: 8931,
    created_at: "2026-04-11T12:00:00Z",
  },
  {
    id: "demo-3",
    title: "Crimson HUD",
    game: "Minecraft",
    tagline: "A sleek, animated HUD and inventory reskin with a dark crimson aesthetic.",
    description:
      "Crimson HUD replaces every interface element in the game with a clean, animated dark theme.\n\n• Works with Fabric & Forge\n• Animated hotbar and health effects\n• Config screen with 30+ toggles",
    version: "3.1.0",
    price_cents: 0,
    image_url: "",
    featured: true,
    downloads: 45102,
    created_at: "2026-03-20T12:00:00Z",
  },
  {
    id: "demo-4",
    title: "Tactical AI Rework",
    game: "Ready or Not",
    tagline: "Suspects flank, retreat, and set ambushes. You will not clear rooms the same way again.",
    description:
      "A ground-up rework of suspect and civilian AI behaviour trees.\n\n• Suspects coordinate and use cover intelligently\n• Difficulty presets from Realistic to Nightmare\n• Compatible with all official maps",
    version: "1.2.3",
    price_cents: 599,
    image_url: "",
    featured: false,
    downloads: 3308,
    created_at: "2026-06-01T12:00:00Z",
  },
  {
    id: "demo-5",
    title: "MegaCity Traffic",
    game: "Cities: Skylines II",
    tagline: "Smarter lane logic and true rush-hour simulation for massive cities.",
    description:
      "MegaCity Traffic replaces the vanilla pathfinder with a smarter, multi-threaded one.\n\n• True rush-hour cycles\n• Lane-discipline logic\n• Handles 1M+ population cities smoothly",
    version: "0.9.7",
    price_cents: 449,
    image_url: "",
    featured: false,
    downloads: 6720,
    created_at: "2026-02-14T12:00:00Z",
  },
  {
    id: "demo-6",
    title: "Loofy's Texture Pack",
    game: "Minecraft",
    tagline: "The official JustLoofy 128x texture pack — as seen on the channel.",
    description:
      "The exact pack used in every JustLoofy video.\n\n• 128x resolution, hand-drawn\n• Custom sky and particles\n• Free forever for subscribers",
    version: "5.0.0",
    price_cents: 0,
    image_url: "",
    featured: false,
    downloads: 88413,
    created_at: "2026-01-05T12:00:00Z",
  },
];

const demoError = () => {
  const err = new Error(
    "Demo mode — connect Supabase to enable accounts and purchases (see README.md)."
  );
  err.demo = true;
  return err;
};

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

// ---------- Mods ----------

export async function getMods({ featured = null, includeUnpublished = false } = {}) {
  if (!isLive) {
    let mods = [...DEMO_MODS];
    if (featured !== null) mods = mods.filter((m) => m.featured === featured);
    return mods.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  let query = supabase.from("mods").select("*").order("created_at", { ascending: false });
  if (!includeUnpublished) query = query.eq("published", true);
  if (featured !== null) query = query.eq("featured", featured);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getMod(id) {
  if (!isLive) return DEMO_MODS.find((m) => m.id === id) ?? null;
  const { data, error } = await supabase.from("mods").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- Purchases / library ----------

export async function getMyPurchases() {
  if (!isLive) return [];
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("purchases")
    .select("*, mods(*)")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function ownsMod(modId) {
  if (!isLive) return false;
  const session = await getSession();
  if (!session) return false;
  const { data, error } = await supabase
    .from("purchases")
    .select("id")
    .eq("user_id", session.user.id)
    .eq("mod_id", modId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Add a free mod to the signed-in user's library. */
export async function claimFreeMod(mod) {
  if (!isLive) throw demoError();
  const session = await getSession();
  if (!session) throw new Error("Sign in to add mods to your library.");
  const { error } = await supabase.from("purchases").insert({
    user_id: session.user.id,
    mod_id: mod.id,
    amount_cents: 0,
  });
  // 23505 = already owned; treat as success
  if (error && error.code !== "23505") throw error;
}

/** Start a Stripe Checkout for a paid mod. Returns the checkout URL. */
export async function createCheckout(modId) {
  if (!isLive) throw demoError();
  const { data, error } = await supabase.functions.invoke("create-checkout", {
    body: { mod_id: modId },
  });
  if (error) throw error;
  if (!data?.url) throw new Error(data?.error ?? "Could not start checkout.");
  return data.url;
}

/** Signed download URL for a mod the user owns (valid 60s). */
export async function getDownloadUrl(mod) {
  if (!isLive) throw demoError();
  if (!mod.file_path) throw new Error("No file has been uploaded for this mod yet.");
  const { data, error } = await supabase.storage
    .from("mod-files")
    .createSignedUrl(mod.file_path, 60);
  if (error) throw error;
  supabase.rpc("increment_downloads", { mod: mod.id }).then(() => {});
  return data.signedUrl;
}

// ---------- Ratings ----------

/** Map of mod_id -> { avg, count } for every rated mod. */
export async function getRatings() {
  if (!isLive) return {};
  const { data, error } = await supabase.from("mod_ratings").select("*");
  if (error) throw error;
  const map = {};
  for (const r of data) map[r.mod_id] = { avg: Number(r.avg_rating), count: r.rating_count };
  return map;
}

/** The signed-in user's own rating for a mod (1–5), or null. */
export async function getMyRating(modId) {
  if (!isLive) return null;
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("ratings")
    .select("stars")
    .eq("user_id", session.user.id)
    .eq("mod_id", modId)
    .maybeSingle();
  if (error) throw error;
  return data?.stars ?? null;
}

/** Rate a mod 1–5 stars (owners only; re-rating overwrites). */
export async function rateMod(modId, stars) {
  if (!isLive) throw demoError();
  const session = await getSession();
  if (!session) throw new Error("Sign in to rate mods.");
  const { error } = await supabase.from("ratings").upsert(
    { user_id: session.user.id, mod_id: modId, stars },
    { onConflict: "user_id,mod_id" }
  );
  if (error) throw error;
}

// ---------- Admin ----------

export async function saveMod(mod) {
  if (!isLive) throw demoError();
  const { data, error } = await supabase.from("mods").upsert(mod).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMod(id) {
  if (!isLive) throw demoError();
  const { error } = await supabase.from("mods").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadModImage(file) {
  if (!isLive) throw demoError();
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("mod-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("mod-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadModFile(file) {
  if (!isLive) throw demoError();
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("mod-files").upload(path, file);
  if (error) throw error;
  return path;
}
