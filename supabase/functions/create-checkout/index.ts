// ============================================================
// create-checkout — Supabase Edge Function
//
// Called by the site when a signed-in user clicks "Buy now".
// Creates a Stripe Checkout session for the mod and returns its URL.
//
// Required secrets (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY   — from Stripe dashboard → Developers → API keys
//   SITE_URL            — https://justloofy.dev
// ============================================================

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://justloofy.dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { mod_id } = await req.json();
    if (!mod_id) return json({ error: "mod_id is required" }, 400);

    // Identify the signed-in user from their JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "You must be signed in to buy." }, 401);

    // Look up the mod server-side (never trust prices from the client)
    const { data: mod } = await supabase
      .from("mods")
      .select("*")
      .eq("id", mod_id)
      .eq("published", true)
      .single();
    if (!mod) return json({ error: "Mod not found." }, 404);
    if (mod.price_cents === 0) return json({ error: "This mod is free — no checkout needed." }, 400);

    // Already own it?
    const { data: existing } = await supabase
      .from("purchases")
      .select("id")
      .eq("user_id", user.id)
      .eq("mod_id", mod.id)
      .maybeSingle();
    if (existing) return json({ error: "You already own this mod!" }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: mod.price_cents,
            product_data: {
              name: mod.title,
              description: mod.tagline ?? `${mod.game} mod`,
              ...(mod.image_url ? { images: [mod.image_url] } : {}),
            },
          },
        },
      ],
      metadata: { user_id: user.id, mod_id: mod.id },
      success_url: `${SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/mod.html?id=${mod.id}`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Checkout failed — try again in a moment." }, 500);
  }
});
