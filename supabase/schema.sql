-- ============================================================
-- JustLoofy — Supabase schema (v2)
--
-- FRESH projects: run this ONCE.
--   Dashboard → SQL Editor → New query → paste everything → Run
--
-- EXISTING projects that already ran the v1 schema: do NOT run
-- this. Run upgrade-v2.sql instead — it adds the same things
-- without touching your data.
-- ============================================================

-- ---------- Profiles (one row per user, auto-created on signup) ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  is_admin boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row when someone signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  )
  on conflict (username) do nothing;
  -- if the username was taken, still create the profile without one
  if not exists (select 1 from public.profiles where id = new.id) then
    insert into public.profiles (id) values (new.id);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used by policies below
create function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------- Products ----------
-- Still called "mods" (that is what the store started as), but a row
-- is any sellable thing. `kind` decides how it is delivered:
--   mod          → a downloadable file, same for every buyer
--   account      → one line is handed out from stock_items per sale
--   subscription → recurring Stripe payment, access while active

create table public.mods (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'mod'
    check (kind in ('mod', 'account', 'subscription', 'request')),
  title text not null,
  game text not null,               -- category label (game, platform, service…)
  tagline text,
  description text,
  version text not null default '1.0.0',
  price_cents integer not null default 0 check (price_cents >= 0),
  image_url text,
  gallery jsonb not null default '[]'::jsonb,  -- extra showcase image URLs
  file_path text,                   -- path inside the private "mod-files" bucket
  sub_interval text not null default 'month'
    check (sub_interval in ('day', 'week', 'month', 'year')),
  sub_interval_count integer not null default 1,
  featured boolean not null default false,
  published boolean not null default true,
  downloads integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz            -- set by the trigger below on real edits
);

alter table public.mods enable row level security;

create policy "Published mods are viewable by everyone"
  on public.mods for select using (published = true or public.is_admin());

create policy "Admins can insert mods"
  on public.mods for insert with check (public.is_admin());

create policy "Admins can update mods"
  on public.mods for update using (public.is_admin());

create policy "Admins can delete mods"
  on public.mods for delete using (public.is_admin());

-- Stamp updated_at only when the product itself really changed.
-- (Download counters and featured/published toggles must NOT count
--  as an update, or every page view would look like a new release.)
create function public.touch_mod_updated()
returns trigger
language plpgsql
as $$
begin
  if new.version           is distinct from old.version
  or new.file_path         is distinct from old.file_path
  or new.title             is distinct from old.title
  or new.description       is distinct from old.description
  or new.tagline           is distinct from old.tagline
  or new.image_url         is distinct from old.image_url
  or new.gallery           is distinct from old.gallery
  or new.price_cents       is distinct from old.price_cents then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

create trigger mods_touch_updated
  before update on public.mods
  for each row execute function public.touch_mod_updated();

-- Download counter (called from the site after each download)
create function public.increment_downloads(mod uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.mods set downloads = downloads + 1 where id = mod;
$$;

-- ---------- Purchases (the user's library) ----------

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mod_id uuid not null references public.mods (id) on delete cascade,
  kind text not null default 'mod',
  amount_cents integer not null default 0,
  stripe_session_id text,
  stripe_subscription_id text,
  sub_status text,                  -- active / trialing / canceled / past_due…
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

create policy "Users can view their own purchases"
  on public.purchases for select using (auth.uid() = user_id or public.is_admin());

-- Accounts and requests can both be bought over and over (each buy = one
-- more account / one more commission), so "one row per user per product"
-- applies to everything else only.
create unique index purchases_single_owned_idx
  on public.purchases (user_id, mod_id)
  where kind not in ('account', 'request');

create index purchases_subscription_idx
  on public.purchases (stripe_subscription_id);

create unique index purchases_session_idx
  on public.purchases (stripe_session_id) where stripe_session_id is not null;

-- Note: there is deliberately NO insert policy. Every purchase is
-- created by grant_product() below, so account stock is always
-- consumed atomically alongside the purchase row.

-- ---------- Account stock (one row = one sellable account) ----------

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  mod_id uuid not null references public.mods (id) on delete cascade,
  content text not null,            -- e.g. "user:pass" — one line of your upload
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  purchase_id uuid references public.purchases (id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_items_pool_idx on public.stock_items (mod_id) where claimed_by is null;
create index stock_items_owner_idx on public.stock_items (claimed_by);

alter table public.stock_items enable row level security;

-- Credentials are readable ONLY by the buyer they were handed to.
create policy "Buyers read their own accounts"
  on public.stock_items for select
  using (claimed_by = auth.uid() or public.is_admin());

create policy "Admins add stock"
  on public.stock_items for insert with check (public.is_admin());

create policy "Admins edit stock"
  on public.stock_items for update using (public.is_admin());

create policy "Admins remove stock"
  on public.stock_items for delete using (public.is_admin());

-- Public stock COUNTS (never the credentials themselves).
-- A security-definer FUNCTION rather than a view: it has to see past the
-- row policy above so shoppers can read "45 left" while the contents stay
-- private, and Postgres/Supabase treat a definer function as the proper
-- way to do that (a definer *view* gets flagged by the linter).
create function public.get_stock_counts()
returns table (mod_id uuid, available integer, total integer)
language sql
stable
security definer
set search_path = public
as $$
  select mod_id,
         count(*) filter (where claimed_by is null)::int,
         count(*)::int
    from stock_items
   group by mod_id;
$$;

revoke all on function public.get_stock_counts() from public;
grant execute on function public.get_stock_counts() to anon, authenticated;

-- ---------- Granting a product (the one place a purchase is created) ----------

create function public.grant_product(
  p_user uuid,
  p_mod uuid,
  p_amount integer default 0,
  p_session text default null,
  p_subscription text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_kind     text;
  v_purchase uuid;
  v_item     uuid;
begin
  -- Stripe retries webhooks; never hand out a second account for one payment.
  if p_session is not null then
    select id into v_purchase from purchases where stripe_session_id = p_session limit 1;
    if v_purchase is not null then return v_purchase; end if;
  end if;

  select kind into v_kind from mods where id = p_mod;
  if v_kind is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_kind = 'account' then
    -- Reserve one unclaimed account before taking the money's word for it.
    select id into v_item
      from stock_items
     where mod_id = p_mod and claimed_by is null
     order by created_at
     for update skip locked
     limit 1;

    if v_item is null then
      raise exception 'SOLD_OUT';
    end if;

    insert into purchases (user_id, mod_id, amount_cents, stripe_session_id, kind)
    values (p_user, p_mod, p_amount, p_session, v_kind)
    returning id into v_purchase;

    update stock_items
       set claimed_by = p_user, claimed_at = now(), purchase_id = v_purchase
     where id = v_item;

  elsif v_kind = 'request' then
    -- Every commission is its own job, so every payment is its own row.
    insert into purchases (user_id, mod_id, amount_cents, stripe_session_id, kind)
    values (p_user, p_mod, p_amount, p_session, v_kind)
    returning id into v_purchase;

  else
    insert into purchases (
      user_id, mod_id, amount_cents, stripe_session_id, kind,
      stripe_subscription_id, sub_status
    )
    values (
      p_user, p_mod, p_amount, p_session, v_kind,
      p_subscription,
      case when v_kind = 'subscription' then 'active' else null end
    )
    on conflict (user_id, mod_id) where kind not in ('account', 'request')
    do update set
      amount_cents           = excluded.amount_cents,
      stripe_session_id      = coalesce(excluded.stripe_session_id, purchases.stripe_session_id),
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, purchases.stripe_subscription_id),
      sub_status             = coalesce(excluded.sub_status, purchases.sub_status)
    returning id into v_purchase;
  end if;

  return v_purchase;
end;
$$;

-- Only the Stripe webhook (service role) may grant arbitrarily.
revoke all on function public.grant_product(uuid, uuid, integer, text, text) from public;
grant execute on function public.grant_product(uuid, uuid, integer, text, text) to service_role;

-- What the browser is allowed to call: claim a FREE product for yourself.
create function public.claim_free_product(p_mod uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_price integer;
  v_pub   boolean;
  v_kind  text;
  v_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  select price_cents, published, kind into v_price, v_pub, v_kind
    from mods where id = p_mod;
  if v_kind is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  v_admin := public.is_admin();

  -- Admins get everything free; everyone else only genuinely-free listings.
  if not v_admin and (v_price <> 0 or not v_pub) then
    raise exception 'NOT_FREE';
  end if;
  if v_kind = 'subscription' and not v_admin then
    raise exception 'NEEDS_CHECKOUT';
  end if;

  return public.grant_product(auth.uid(), p_mod, 0, null, null);
end;
$$;

revoke all on function public.claim_free_product(uuid) from public;
grant execute on function public.claim_free_product(uuid) to authenticated;

-- ---------- Requests (paid custom-mod commissions) ----------
-- Someone buys a request-kind product, writes a brief, and you deliver
-- the finished file against it.

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null unique references public.purchases (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  mod_id uuid not null references public.mods (id) on delete cascade,
  title text not null,
  game text,
  details text not null,
  reference_url text,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'delivered', 'declined')),
  admin_note text,
  file_path text,                     -- the finished mod, in the private bucket
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_user_idx on public.requests (user_id);
create index requests_status_idx on public.requests (status);

alter table public.requests enable row level security;

create policy "Requests are visible to their owner"
  on public.requests for select
  using (user_id = auth.uid() or public.is_admin());

-- The paywall: a brief can only be opened against a purchase that belongs
-- to you AND was for a request-kind product. No payment, no purchase row,
-- no request.
create policy "Buyers open their own request"
  on public.requests for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
        from public.purchases p
        join public.mods m on m.id = p.mod_id
       where p.id = requests.purchase_id
         and p.user_id = auth.uid()
         and m.kind = 'request'
    )
  );

-- Buyers may keep editing the brief until work starts, and can never set
-- the status or attach the delivery file themselves.
create policy "Buyers edit a request until work starts"
  on public.requests for update
  using (auth.uid() = user_id and status = 'new')
  with check (auth.uid() = user_id and status = 'new' and file_path is null);

create policy "Admins manage requests"
  on public.requests for update
  using (public.is_admin()) with check (public.is_admin());

create function public.touch_request_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    new.delivered_at = now();
  end if;
  return new;
end;
$$;

create trigger requests_touch_updated
  before update on public.requests
  for each row execute function public.touch_request_updated();

-- ---------- Ratings (1–5 stars, owners only, one per user per product) ----------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mod_id uuid not null references public.mods (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, mod_id)
);

alter table public.ratings enable row level security;

create policy "Ratings are viewable by everyone"
  on public.ratings for select using (true);

-- Only people who own the product (or admins) can rate it
create policy "Owners can rate"
  on public.ratings for insert with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or exists (
        select 1 from public.purchases p
        where p.user_id = auth.uid() and p.mod_id = ratings.mod_id
      )
    )
  );

create policy "Users can update their rating"
  on public.ratings for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their rating"
  on public.ratings for delete using (auth.uid() = user_id);

-- Average + count per product, used by the site
create view public.mod_ratings with (security_invoker = true) as
  select mod_id,
         count(*)::int as rating_count,
         round(avg(stars)::numeric, 1) as avg_rating
  from public.ratings
  group by mod_id;

-- ---------- Store-wide counters (the home page trust badge) ----------
-- Definer function for the same reason as get_stock_counts(): it must see
-- past the per-user policy on purchases to publish a plain total. Only
-- aggregates ever leave.

create function public.get_store_stats()
returns table (
  customers integer,
  sales integer,
  products integer,
  downloads integer,
  avg_rating numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from profiles)::int,
    (select count(*) from purchases)::int,
    (select count(*) from mods where published)::int,
    (select coalesce(sum(downloads), 0) from mods)::int,
    (select round(avg(stars)::numeric, 1) from ratings);
$$;

revoke all on function public.get_store_stats() from public;
grant execute on function public.get_store_stats() to anon, authenticated;

-- ---------- Storage buckets ----------

insert into storage.buckets (id, name, public)
values ('mod-images', 'mod-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('mod-files', 'mod-files', false)
on conflict (id) do nothing;

-- Admins manage all files in both buckets
create policy "Admins manage mod images"
  on storage.objects for all
  using (bucket_id = 'mod-images' and public.is_admin())
  with check (bucket_id = 'mod-images' and public.is_admin());

create policy "Admins manage mod files"
  on storage.objects for all
  using (bucket_id = 'mod-files' and public.is_admin())
  with check (bucket_id = 'mod-files' and public.is_admin());

-- Buyers (and anyone, for free mods) can download via signed URLs.
-- Subscribers keep access only while their subscription is active.
create policy "Buyers can read mod files"
  on storage.objects for select
  using (
    bucket_id = 'mod-files'
    and (
      exists (
        select 1 from public.mods m
        where m.file_path = storage.objects.name
          and m.published = true
          and (
            (m.price_cents = 0 and m.kind = 'mod')
            or exists (
              select 1 from public.purchases p
              where p.mod_id = m.id
                and p.user_id = auth.uid()
                and (
                  p.kind <> 'subscription'
                  or coalesce(p.sub_status, '') in ('active', 'trialing')
                )
            )
          )
      )
      -- …plus the finished file for a commission you paid for
      or exists (
        select 1 from public.requests r
        where r.file_path = storage.objects.name
          and (r.user_id = auth.uid() or public.is_admin())
      )
    )
  );

-- ---------- Live updates (realtime) ----------
-- Lets the site update instantly when the catalog changes or a
-- purchase lands, without anyone refreshing the page.

alter publication supabase_realtime add table public.mods;
alter publication supabase_realtime add table public.purchases;
alter publication supabase_realtime add table public.ratings;
alter publication supabase_realtime add table public.stock_items;
alter publication supabase_realtime add table public.requests;

-- ============================================================
-- AFTER RUNNING THIS: make yourself the admin.
-- 1. Sign up on your site with your email.
-- 2. Run (replace with YOUR email):
--
--    update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'frenzersteven1@gmail.com');
-- ============================================================
