// ============================================================
// create-checkout — Supabase Edge Function
//
// Called by the site when a signed-in user clicks Buy / Subscribe.
// Builds the right kind of Stripe Checkout session for the product:
//   mod          → one-off payment
//   account      → one-off payment, refused if stock is empty
//   subscription → recurring payment
//
// Required secrets (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY   — Stripe dashboard → Developers → API keys
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Identify the signed-in user from their JWT
    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "You must be signed in to buy." }, 401);

    // Look up the product server-side (never trust prices from the browser)
    const { data: product } = await supabase
      .from("mods")
      .select("*")
      .eq("id", mod_id)
      .eq("published", true)
      .single();
    if (!product) return json({ error: "Product not found." }, 404);
    if (product.price_cents === 0) {
      return json({ error: "This one is free — no checkout needed." }, 400);
    }

    const kind = product.kind ?? "mod";
    const isSubscription = kind === "subscription";

    // Accounts: refuse the sale before taking money if the pile is empty
    if (kind === "account") {
      const { count } = await supabase
        .from("stock_items")
        .select("id", { count: "exact", head: true })
        .eq("mod_id", product.id)
        .is("claimed_by", null);
      if (!count) return json({ error: "Sold out — nothing left in stock." }, 409);
    }

    // Mods and subscriptions are one-per-customer. Accounts and requests can
    // be bought again and again — each buy is another account / another job.
    if (kind !== "account" && kind !== "request") {
      const { data: existing } = await supabase
        .from("purchases")
        .select("id, kind, sub_status")
        .eq("user_id", user.id)
        .eq("mod_id", product.id)
        .maybeSingle();

      if (existing) {
        if (!isSubscription) return json({ error: "You already own this!" }, 400);
        if (["active", "trialing"].includes(existing.sub_status ?? "")) {
          return json({ error: "Your subscription is already active." }, 400);
        }
      }
    }

    // Reuse (or create) the Stripe customer so the billing portal has history
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const productData = {
      name: product.title,
      description: product.tagline ?? `${product.game} ${kind}`,
      ...(product.image_url ? { images: [product.image_url] } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: product.price_cents,
            product_data: productData,
            ...(isSubscription
              ? {
                  recurring: {
                    interval: product.sub_interval ?? "month",
                    interval_count: product.sub_interval_count ?? 1,
                  },
                }
              : {}),
          },
        },
      ],
      metadata: { user_id: user.id, mod_id: product.id, kind },
      // Subscription events arrive without the session, so stamp them too
      ...(isSubscription
        ? { subscription_data: { metadata: { user_id: user.id, mod_id: product.id } } }
        : {}),
      success_url: `${SITE_URL}/#/success`,
      cancel_url: `${SITE_URL}/#/product/${product.id}`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Checkout failed — try again in a moment." }, 500);
  }
});
