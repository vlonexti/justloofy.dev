// ============================================================
// billing-portal — Supabase Edge Function
//
// Opens Stripe's own customer portal so buyers can update their
// card, see receipts, or cancel a subscription themselves. The
// site never handles any of that directly.
//
// Required secrets (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY   — Stripe dashboard → Developers → API keys
//   SITE_URL            — https://justloofy.dev
//
// One-time setup in Stripe: Settings → Billing → Customer portal
// → activate it (and tick "Cancel subscriptions").
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "You must be signed in." }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return json({ error: "You haven't paid for anything yet — nothing to manage." }, 400);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${SITE_URL}/#/account`,
    });

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not open the billing portal — try again in a moment." }, 500);
  }
});
