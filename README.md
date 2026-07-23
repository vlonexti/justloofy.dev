# 🌒 JustLoofy Mods — justloofy.dev

A game-mod store that runs **100% on free tiers**:

| Piece | Service | Cost |
|---|---|---|
| Website hosting | GitHub Pages | Free |
| Accounts, database, file storage | Supabase (free tier) | Free |
| Payments | Stripe (per-transaction fee only) | Free to set up |
| Domain | justloofy.dev | Only thing you pay for |

The site works in **demo mode** (sample mods, no accounts) out of the box, so you can deploy it right now and wire up Supabase/Stripe afterwards.

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

1. Buy `justloofy.dev` at any registrar (Namecheap, Porkbun, Cloudflare — usually ~$12/yr) if you haven't already.
2. At your registrar's DNS settings, add these records:

   | Type | Host/Name | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `vlonexti.github.io` |

3. On GitHub: **Settings → Pages → Custom domain** → type `justloofy.dev` → Save.
   (The `CNAME` file in this repo keeps that setting from being wiped on future pushes.)
4. Once the DNS check passes (can take up to an hour), tick **Enforce HTTPS**.

> **Note:** `.dev` domains *require* HTTPS in browsers — that's fine, GitHub Pages provides the certificate automatically.

---

## Part 2 — Supabase (accounts + database + file storage)

1. Go to [supabase.com](https://supabase.com) → **New project** (free tier). Pick any name/region, set a strong database password.
2. When it's ready, open **SQL Editor → New query**, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates:
   - `profiles` — one per user, auto-created on signup
   - `mods` — your products
   - `purchases` — each user's library
   - Storage buckets: `mod-images` (public covers) and `mod-files` (private downloads, buyers only)
   - All the security rules (Row Level Security) so nobody can cheat the store
3. Go to **Project Settings → API** and copy two values into [`js/config.js`](js/config.js):
   ```js
   SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",   // the "anon / public" key
   ```
   (The anon key is designed to be public — security comes from the RLS rules.)
4. **Auth settings** — in Supabase: **Authentication → URL Configuration**:
   - Site URL: `https://justloofy.dev`
   - Redirect URLs: add `https://justloofy.dev/**`

   Optional: under **Authentication → Sign In / Providers → Email**, turn OFF
   "Confirm email" if you want sign-ups to work instantly without a confirmation
   email (fine for a small store; leave it on for more protection).
5. Push the config change to GitHub. Accounts now work on the live site. 🎉
6. **Make yourself admin** (60 seconds):
   1. On your live site: **Sign up** → username `steve`, your email, and a password
      (use one you've never shared anywhere).
   2. In Supabase **SQL Editor**, run:
      ```sql
      update public.profiles set is_admin = true
      where id = (select id from auth.users where email = 'frenzersteven1@gmail.com');
      ```
   3. Refresh the site — an **Admin** link appears in the header next to your name.

   The Admin panel (`admin.html`) is where you **add, edit, hide, and delete mods**,
   upload cover images and the mod `.zip` files, set prices, and feature mods on
   the home page. Only accounts with `is_admin = true` can see it or use it —
   the database enforces this even if someone finds the URL.

---

## Part 3 — Stripe (paid mods)

Free mods already work after Part 2. For paid mods you need to deploy the two
edge functions in `supabase/functions/` and give them your Stripe keys.

> **You do NOT need to create products in Stripe's Product catalog.** The site
> builds each checkout dynamically from the prices in your `mods` table — the
> mods you add in the Admin panel ARE the products.

### Option A — everything in the browser (recommended, no installs)

1. **Deploy the functions** — Supabase Dashboard → **Edge Functions → Deploy a new
   function → Via Editor**:
   - Name it exactly `create-checkout`, paste the contents of
     [`supabase/functions/create-checkout/index.ts`](supabase/functions/create-checkout/index.ts), deploy.
   - Repeat with the name `stripe-webhook` and
     [`supabase/functions/stripe-webhook/index.ts`](supabase/functions/stripe-webhook/index.ts).
   - Open the **stripe-webhook** function → **Details** → turn **OFF “Enforce JWT
     verification”** (Stripe can't send Supabase login tokens).
2. **Add the secrets** — Dashboard → **Edge Functions → Secrets** (or Project
   Settings → Edge Functions). Add:
   | Name | Value |
   |---|---|
   | `STRIPE_SECRET_KEY` | from Stripe → Developers → API keys (`sk_test_...` first) |
   | `SITE_URL` | `https://justloofy.dev` |
3. **Connect the webhook** — Stripe Dashboard → **Developers → Webhooks → Add
   endpoint**:
   - URL: `https://YOUR-PROJECT.supabase.co/functions/v1/stripe-webhook`
   - Events: just **`checkout.session.completed`**
   - Copy the endpoint's **Signing secret** (`whsec_...`) and add it as a third
     Supabase secret named `STRIPE_WEBHOOK_SECRET`.
4. **Test** — with `sk_test_` keys, buy one of your own mods with card
   `4242 4242 4242 4242` (any future date/CVC). It should land in your library
   within seconds. Then swap the secrets to your `sk_live_` key and a live-mode
   webhook endpoint, and you're selling for real.

### Option B — via the Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set SITE_URL=https://justloofy.dev
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook --no-verify-jwt
```
Then do steps 3–4 from Option A.

## Live updates (realtime)

The site subscribes to database changes, so new mods, edits, and fresh purchases
appear on screen **without anyone refreshing**. If you ran `schema.sql` before
this feature existed, enable it with one query in the SQL Editor:

```sql
alter publication supabase_realtime add table public.mods;
alter publication supabase_realtime add table public.purchases;
```

(If it says the table is already in the publication, you're done.)

---

## Day-to-day: adding a mod

1. Sign in → **Admin** in the header.
2. Fill the form: title, game, tagline, description, price (0 = free), version.
3. Upload a cover image (16:9 looks best, e.g. 1280×720) and the mod `.zip`.
4. Tick **Featured** to show it on the home page. **Create mod** — done, it's live.

Updating a mod later? Hit **Edit**, bump the version, upload the new zip. Everyone who bought it downloads the new version free from their library.

## How the money flow works

```
Buyer clicks "Buy now"
  → create-checkout function builds a Stripe Checkout page (price comes from YOUR database, never the browser)
  → buyer pays on stripe.com
  → Stripe calls the stripe-webhook function with a signed receipt
  → webhook writes the purchase into Supabase
  → mod appears in the buyer's library; downloads come from a private bucket
    that ONLY buyers can access (enforced by database rules, not by hiding links)
```

## File map

```
index.html / mods.html / mod.html   store pages
auth.html / account.html            accounts & library
admin.html                          your mod manager (admins only)
success.html / 404.html             checkout thank-you & not-found
css/style.css                       the whole design
js/config.js                        ← the only file you edit to go live
js/db.js                            all Supabase calls + demo data
js/ui.js                            shared header/footer/cards/toasts
supabase/schema.sql                 database setup (run once)
supabase/functions/                 the two Stripe edge functions
CNAME                               tells GitHub Pages about justloofy.dev
```

## "My keys are visible on GitHub — is that safe?"

**Yes.** The two values in `js/config.js` (project URL + `anon` key) are *designed* to be
public — every visitor's browser needs them to talk to Supabase, so they'd be visible on
the live site even if the repo were private. Security comes from the Row Level Security
rules in `schema.sql`, which the database enforces no matter who holds the anon key.

What must **NEVER** be committed to this repo:
- the Supabase **service_role** key
- your Stripe **secret key** (`sk_live_...` / `sk_test_...`)
- the Stripe **webhook secret** (`whsec_...`)

Those three live only in Supabase's secret store (`supabase secrets set ...`) — they are
never in any file in this folder. Also note: GitHub Pages on a free account requires the
repo to be public anyway, and that's perfectly fine for a site like this.

## Heads-up on selling mods

Some games' EULAs prohibit selling mods (Bethesda and Mojang are famously strict). Worth a quick check per game before you list paid mods — free mods with a "pay what you want" or Patreon link are usually the safe alternative where selling isn't allowed.
