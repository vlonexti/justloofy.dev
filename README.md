# 🌒 JustLoofy — justloofy.dev

A store that runs **100% on free tiers** and sells three different kinds of thing:

| Kind | What the buyer gets | How it's delivered |
|---|---|---|
| 🧩 **Mod** | A file (usually a `.zip`) | Download link, re-downloadable forever, free updates |
| 🔑 **Account** | One line out of a pile you upload | One account is reserved per sale, with a live "45 left" counter |
| 🔁 **Subscription** | Recurring access | Stripe subscription, cancellable by the buyer |

| Piece | Service | Cost |
|---|---|---|
| Website hosting | GitHub Pages | Free |
| Accounts, database, file storage | Supabase (free tier) | Free |
| Payments | Stripe (per-transaction fee only) | Free to set up |
| Domain | justloofy.dev | Only thing you pay for |

The site works in **demo mode** (sample products, no accounts) out of the box.

---

## ⚠️ Upgrading an existing store — do this FIRST

If your Supabase project already ran the old `schema.sql`, **run
[`supabase/upgrade-v2.sql`](supabase/upgrade-v2.sql) before you push this code**.
It adds product kinds, account stock, subscriptions and the "Updated" stamp.

> Order matters: the new site reads tables (`stock_items`, `mod_stock`,
> `store_stats`) that don't exist until the migration runs. Run the SQL, *then*
> push. It is additive — your existing mods, purchases and ratings are untouched,
> and every current mod simply becomes `kind = 'mod'`.

Then redeploy the two edge functions (they changed) and deploy the new third one:

- `create-checkout` — now handles subscriptions and refuses sold-out accounts
- `stripe-webhook` — now grants through the database, refunds sold-out orders, tracks subscriptions
- `billing-portal` — **new**, lets buyers cancel their own subscriptions

In the Stripe dashboard, add two events to your webhook endpoint alongside
`checkout.session.completed`:

- `customer.subscription.updated`
- `customer.subscription.deleted`

…and turn on **Settings → Billing → Customer portal** (tick "Cancel
subscriptions") so the billing portal works.

Fresh projects: just run [`supabase/schema.sql`](supabase/schema.sql) — it already
contains everything.

---

## Part 1 — Put the site on GitHub Pages

1. Create a new **public** repo on GitHub (e.g. `justloofy.dev`).
2. Push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/vlonexti/justloofy.dev.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
4. Wait ~1 minute. Your site is live at `https://vlonexti.github.io/justloofy.dev/`.

### Connect the justloofy.dev domain

1. Buy `justloofy.dev` at any registrar if you haven't already.
2. At your registrar's DNS settings, add these records:

   | Type | Host/Name | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `vlonexti.github.io` |

3. On GitHub: **Settings → Pages → Custom domain** → type `justloofy.dev` → Save.
   (The `CNAME` file keeps that setting from being wiped on future pushes.)
4. Once the DNS check passes, tick **Enforce HTTPS**.

---

## Part 2 — Supabase (accounts + database + file storage)

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier).
2. **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), **Run**. This creates:
   - `profiles` — one per user, auto-created on signup
   - `mods` — your products (any kind)
   - `stock_items` — the pile of accounts, one row per sellable account
   - `purchases` — each user's library
   - Views: `mod_stock` (public counts), `mod_ratings`, `store_stats` (home page numbers)
   - `grant_product()` — the only way a purchase is ever created
   - Storage buckets: `mod-images` (public covers) and `mod-files` (private downloads)
   - All the Row Level Security rules
3. **Project Settings → API** → copy two values into [`js/config.js`](js/config.js):
   ```js
   SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",   // the "anon / public" key
   ```
4. **Authentication → URL Configuration**:
   - Site URL: `https://justloofy.dev`
   - Redirect URLs: add `https://justloofy.dev/**`
5. Push the config change. Accounts now work on the live site. 🎉
6. **Make yourself admin**: sign up on your site, then in the SQL Editor run:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'frenzersteven1@gmail.com');
   ```
   Refresh — an **Admin** link appears in the header.

---

## Part 3 — Stripe (paid products)

Free products already work after Part 2. For paid ones, deploy the three edge
functions in `supabase/functions/` and give them your Stripe keys.

> **You do NOT need to create products in Stripe's catalog.** Every checkout —
> one-off *and* subscription — is built from the prices in your own database.

### Option A — everything in the browser (recommended)

1. **Deploy the functions** — Dashboard → **Edge Functions → Deploy a new function → Via Editor**:
   - `create-checkout` → paste [`create-checkout/index.ts`](supabase/functions/create-checkout/index.ts)
   - `billing-portal` → paste [`billing-portal/index.ts`](supabase/functions/billing-portal/index.ts)
   - `stripe-webhook` → paste [`stripe-webhook/index.ts`](supabase/functions/stripe-webhook/index.ts),
     then open it → **Details** → turn **OFF "Enforce JWT verification"**
     (Stripe can't send Supabase login tokens).
2. **Add the secrets** — **Edge Functions → Secrets**:
   | Name | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_test_...` first) |
   | `SITE_URL` | `https://justloofy.dev` |
3. **Connect the webhook** — Stripe → **Developers → Webhooks → Add endpoint**:
   - URL: `https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy the **Signing secret** (`whsec_...`) → add it as a third secret named `STRIPE_WEBHOOK_SECRET`.
4. **Turn on the customer portal** — Stripe → **Settings → Billing → Customer portal** → activate, tick "Cancel subscriptions".
5. **Test** with `sk_test_` keys and card `4242 4242 4242 4242`. Then swap in your
   `sk_live_` key and a live-mode webhook endpoint.

### Option B — via the Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set SITE_URL=https://justloofy.dev
supabase functions deploy create-checkout
supabase functions deploy billing-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```
Then do steps 3–5 from Option A.

---

## Day-to-day: adding things

Sign in → **Admin** in the header → pick what you're selling at the top of the form.
The rest of the form changes to match.

### 🧩 A mod
Title, category, tagline, description, price, version, cover image, the `.zip`.
Tick **Featured** to put it on the home page.

**Pushing an update later?** Hit **Edit**, bump the version, upload the new
`.zip`, save. Everyone who bought it gets the new file free — and the product
page now shows **both** dates: the original **Released** date *and* an
**Updated** date with a green `NEW` tag. Toggling Featured/Published or a
download landing does *not* count as an update, so the badge stays honest.

### 🔑 An account listing
Same fields, plus **Add accounts to stock**: upload a `.txt`/`.csv` or paste
straight in — **one account per line** (e.g. `user@mail.com:password`).

- One line = one account = one sale.
- Blank lines and lines already in stock are skipped automatically.
- Cards and the product page show a live **"45 left"** counter and a stock bar.
- When it hits zero the listing shows **Sold out** and checkout is refused.
- Restock any time by editing and uploading more lines — sold accounts are never
  touched, so buyers keep their details forever.
- Buyers see their credentials on their library page, blurred until they hit
  **Reveal**, with a one-click **Copy**.

Accounts are the one kind a customer can buy **more than once** — each purchase
hands out one more from the pile.

### 🔁 A subscription
Set the price and how often it bills (every 1 month, every 3 months, every year…).
Buyers get a Stripe subscription and a **Manage or cancel** button that opens
Stripe's own billing portal. Access ends when the subscription does. If you
attach a file, only active subscribers can download it.

---

## Themes

Every colour on the site comes from CSS variables under `[data-theme]` on
`<html>`, so the whole thing re-skins from one attribute. Visitors pick a theme
under **Settings → Appearance** (reachable from the ⚙ in the header, signed in or
not); the choice is saved in their browser and applied before first paint, so
there's no flash on reload.

Shipped themes: **Void** (default, monochrome), **Ember** (the classic red),
**Aurora**, **Nebula**, **Sakura**, and **Daylight** (light mode).

To add one: append a block to the theme list at the top of
[`css/style.css`](css/style.css) and an entry to `THEMES` in
[`js/theme.js`](js/theme.js). Nothing else needs to change.

---

## How the money flow works

```
Buyer clicks "Buy now" / "Subscribe"
  → create-checkout builds a Stripe Checkout page
    (price comes from YOUR database, never the browser;
     account listings are refused up front if stock is empty)
  → buyer pays on stripe.com
  → Stripe calls stripe-webhook with a signed receipt
  → webhook calls grant_product(), which in ONE transaction writes the
    purchase and reserves an account from the pile
  → it appears in the buyer's library; downloads come from a private bucket
    that ONLY buyers can read (enforced by database rules, not hidden links)
```

If the last account sells out between checkout opening and the payment landing,
the webhook **refunds the payment automatically** rather than leaving the buyer
with nothing.

## Live updates (realtime)

The site subscribes to database changes, so new products, edits, restocks and
fresh purchases appear on screen **without anyone refreshing**. `schema.sql` and
`upgrade-v2.sql` both switch this on.

## File map

```
index.html                          the app shell (everything else redirects into it)
mods/mod/products/settings/….html   tiny redirects so old links keep working
css/style.css                       the whole design + every theme
js/config.js                        ← the only file you edit to go live
js/theme.js                         theme list, saving, applying
js/db.js                            all Supabase calls + demo data
js/ui.js                            shared header/footer/cards/toasts
js/app.js                           router + realtime
js/views/                           one file per page
supabase/schema.sql                 database setup for a FRESH project
supabase/upgrade-v2.sql             migration for a project that ran the old schema
supabase/functions/                 the three Stripe edge functions
CNAME                               tells GitHub Pages about justloofy.dev
```

## "My keys are visible on GitHub — is that safe?"

**Yes.** The two values in `js/config.js` (project URL + `anon` key) are *designed*
to be public — every visitor's browser needs them. Security comes from the Row
Level Security rules, which the database enforces no matter who holds the anon key.
Account credentials in `stock_items` are readable **only** by the buyer they were
handed to; the public `mod_stock` view exposes counts and nothing else.

What must **NEVER** be committed to this repo:
- the Supabase **service_role** key
- your Stripe **secret key** (`sk_live_...` / `sk_test_...`)
- the Stripe **webhook secret** (`whsec_...`)

Those live only in Supabase's secret store.

## Heads-up on what you sell

Some games' EULAs prohibit selling mods (Bethesda and Mojang are famously strict).
Reselling accounts for streaming services generally breaks those services' terms
of use, and the accounts can be reclaimed by them at any time — worth knowing
before you list them, since chargebacks land on you either way.
