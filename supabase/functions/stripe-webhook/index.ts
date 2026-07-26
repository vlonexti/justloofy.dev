// ============================================================
// stripe-webhook — Supabase Edge Function
//
// Stripe calls this after a payment or a subscription change. It
// verifies the signature, then hands the product over by calling
// grant_product() — the one database function that creates a
// purchase and reserves an account from stock atomically.
//
// Deploy with JWT verification DISABLED (Stripe can't send JWTs):
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Events to subscribe to in the Stripe dashboard:
//   checkout.session.completed
//   customer.subscription.updated
//   customer.subscription.deleted
//
// Required secrets (supabase secrets set KEY=value):
//   STRIPE_SECRET_KEY      — from Stripe dashboard
//   STRIPE_WEBHOOK_SECRET  — Stripe → Webhooks → your endpoint
// ============================================================

import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const db = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

const ok = () =>
  new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });

/** Sold out after the money was taken — give it straight back. */
async function refund(session: Stripe.Checkout.Session) {
  try {
    if (typeof session.payment_intent === "string") {
      await stripe.refunds.create({ payment_intent: session.payment_intent });
      console.log("Refunded sold-out order", session.id);
    }
  } catch (err) {
    console.error("Refund failed for", session.id, err);
  }
}

async function handleCheckout(session: Stripe.Checkout.Session) {
  const { user_id, mod_id } = session.metadata ?? {};
  if (!user_id || !mod_id) return;

  const supabase = db();
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  const { error } = await supabase.rpc("grant_product", {
    p_user: user_id,
    p_mod: mod_id,
    p_amount: session.amount_total ?? 0,
    p_session: session.id,
    p_subscription: subscriptionId,
  });

  if (error) {
    // Stock ran out between checkout starting and the payment landing.
    // Refund rather than leaving the buyer with nothing, and do NOT ask
    // Stripe to retry — a retry would fail exactly the same way.
    if (/SOLD_OUT/.test(error.message)) {
      await refund(session);
      return;
    }
    console.error("Failed to record purchase:", error);
    throw error; // non-200 makes Stripe retry, so the purchase is never lost
  }

  // Stamp the first period end so the account page can show "renews on…"
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      await supabase
        .from("purchases")
        .update({
          sub_status: sub.status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionId);
    } catch (err) {
      console.error("Could not read subscription period:", err);
    }
  }
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const supabase = db();
  const { error } = await supabase
    .from("purchases")
    .update({
      sub_status: sub.status,
      current_period_end: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
    })
    .eq("stripe_subscription_id", sub.id);

  if (error) {
    console.error("Failed to sync subscription:", error);
    throw error;
  }
}

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

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckout(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
    }
  } catch {
    return new Response("Database error", { status: 500 });
  }

  return ok();
});
