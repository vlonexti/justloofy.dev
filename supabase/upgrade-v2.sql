-- ============================================================
-- JustLoofy — upgrade v1 → v2
--
-- Adds: product kinds (mod / account / subscription), account
-- stock, subscription tracking, and "Updated" timestamps.
--
-- Run this ONCE on an existing project:
--   Dashboard → SQL Editor → New query → paste everything → Run
--
-- Safe to re-run: every statement is guarded.
-- (Fresh projects should run schema.sql instead — it already
--  contains everything in here.)
-- ============================================================

-- ---------- Products: kinds, update stamp, subscription terms ----------

alter table public.mods
  add column if not exists kind text not null default 'mod',
  add column if not exists updated_at timestamptz,
  add column if not exists sub_interval text not null default 'month',
  add column if not exists sub_interval_count integer not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'mods_kind_check') then
    alter table public.mods add constraint mods_kind_check
      check (kind in ('mod', 'account', 'subscription'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mods_sub_interval_check') then
    alter table public.mods add constraint mods_sub_interval_check
      check (sub_interval in ('day', 'week', 'month', 'year'));
  end if;
end $$;

-- Stamp updated_at only when the product itself really changed.
-- (Download counters and featured/published toggles must NOT count
--  as an update, or every page view would look like a new release.)
create or replace function public.touch_mod_updated()
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

drop trigger if exists mods_touch_updated on public.mods;
create trigger mods_touch_updated
  before update on public.mods
  for each row execute function public.touch_mod_updated();

-- ---------- Profiles: remember the Stripe customer (billing portal) ----------

alter table public.profiles
  add column if not exists stripe_customer_id text;

-- ---------- Purchases: kind, repeat buys for accounts, subscriptions ----------

alter table public.purchases
  add column if not exists kind text not null default 'mod',
  add column if not exists stripe_subscription_id text,
  add column if not exists sub_status text,
  add column if not exists current_period_end timestamptz;

update public.purchases p
   set kind = m.kind
  from public.mods m
 where m.id = p.mod_id and p.kind is distinct from m.kind;

-- Accounts can be bought over and over (each buy = one more account),
-- so the "one row per user per product" rule now applies to everything else.
alter table public.purchases drop constraint if exists purchases_user_id_mod_id_key;

create unique index if not exists purchases_single_owned_idx
  on public.purchases (user_id, mod_id) where kind <> 'account';

create index if not exists purchases_subscription_idx
  on public.purchases (stripe_subscription_id);

create unique index if not exists purchases_session_idx
  on public.purchases (stripe_session_id) where stripe_session_id is not null;

-- Claiming now goes through claim_free_product() so that account stock
-- is actually consumed — the old direct-insert policy would hand out a
-- free account product without reserving one from the pile.
drop policy if exists "Users can claim free mods" on public.purchases;

-- ---------- Account stock (one row = one sellable account) ----------

create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  mod_id uuid not null references public.mods (id) on delete cascade,
  content text not null,                -- e.g. "user:pass" — one line of your upload
  claimed_by uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  purchase_id uuid references public.purchases (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_items_pool_idx
  on public.stock_items (mod_id) where claimed_by is null;
create index if not exists stock_items_owner_idx
  on public.stock_items (claimed_by);

alter table public.stock_items enable row level security;

-- Credentials are readable ONLY by the buyer they were handed to.
drop policy if exists "Buyers read their own accounts" on public.stock_items;
create policy "Buyers read their own accounts"
  on public.stock_items for select
  using (claimed_by = auth.uid() or public.is_admin());

drop policy if exists "Admins add stock" on public.stock_items;
create policy "Admins add stock"
  on public.stock_items for insert with check (public.is_admin());

drop policy if exists "Admins edit stock" on public.stock_items;
create policy "Admins edit stock"
  on public.stock_items for update using (public.is_admin());

drop policy if exists "Admins remove stock" on public.stock_items;
create policy "Admins remove stock"
  on public.stock_items for delete using (public.is_admin());

-- Public stock COUNTS (never the credentials themselves).
-- Deliberately not security_invoker: it must bypass the row policy above
-- so shoppers can see "45 left" while the contents stay private.
create or replace view public.mod_stock as
  select mod_id,
         count(*) filter (where claimed_by is null)::int as available,
         count(*)::int as total
    from public.stock_items
   group by mod_id;

grant select on public.mod_stock to anon, authenticated;

-- ---------- Granting a product (the one place a purchase is created) ----------

create or replace function public.grant_product(
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
    on conflict (user_id, mod_id) where kind <> 'account'
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
create or replace function public.claim_free_product(p_mod uuid)
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

-- ---------- Store-wide counters (the home page "Facts" band) ----------
-- Not security_invoker on purpose: it must see past the per-user
-- policy on purchases to publish a plain total. Only aggregates leave.

create or replace view public.store_stats as
  select
    (select count(*) from public.profiles)::int                          as customers,
    (select count(*) from public.purchases)::int                         as sales,
    (select count(*) from public.mods where published)::int              as products,
    (select coalesce(sum(downloads), 0) from public.mods)::int           as downloads,
    (select round(avg(stars)::numeric, 1) from public.ratings)           as avg_rating;

grant select on public.store_stats to anon, authenticated;

-- ---------- Downloads: subscribers only keep access while active ----------

drop policy if exists "Buyers can read mod files" on storage.objects;
create policy "Buyers can read mod files"
  on storage.objects for select
  using (
    bucket_id = 'mod-files'
    and exists (
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
  );

-- ---------- Live updates ----------

do $$
begin
  alter publication supabase_realtime add table public.stock_items;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Done. Nothing above touches your existing mods, purchases or
-- ratings — every current mod simply becomes kind = 'mod'.
-- ============================================================
