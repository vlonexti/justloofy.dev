// ============================================================
// stripe-webhook — Supabase Edge Function
//
// Stripe calls this after a successful payment. It verifies the
// event signature and adds the mod to the buyer's library.
//
// Deploy with JWT verification DISABLED (Stripe can't send JWTs):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Required secrets (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY      — from Stripe dashboard
//   STRIPE_WEBHOOK_SECRET  — from Stripe dashboard → Webhooks → your endpoint
// ============================================================

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { user_id, mod_id } = session.metadata ?? {};

    if (user_id && mod_id) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { error } = await supabase.from("purchases").upsert(
        {
          user_id,
          mod_id,
          amount_cents: session.amount_total ?? 0,
          stripe_session_id: session.id,
        },
        { onConflict: "user_id,mod_id" }
      );
      if (error) {
        console.error("Failed to record purchase:", error);
        // Non-200 makes Stripe retry, so the purchase is never lost
        return new Response("Database error", { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
