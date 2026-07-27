-- ============================================================
-- 0o777 — upgrade v2 → v3
--
-- 1. Clears Supabase's "Security Definer view" warning by moving
--    the two public-aggregate views to security-definer FUNCTIONS,
--    which is the sanctioned pattern for this.
-- 2. Adds the "request" product kind: someone pays for a custom
--    mod, writes a brief, and you deliver the finished file.
--
-- Run this ONCE:
--   Dashboard → SQL Editor → New query → paste everything → Run
--
-- Safe to re-run. Requires upgrade-v2.sql to have been run first.
--
-- ⚠️ Do NOT press "Autofix" on the view warning in the dashboard.
--    That sets security_invoker = true, which makes the row policy
--    on stock_items apply to the counts — every shopper would then
--    see "0 left" on everything. This migration removes the views
--    entirely instead, so the warning goes away for good.
-- ============================================================

-- ---------- 1. Aggregates: definer views → definer functions ----------

drop view if exists public.mod_stock;
drop view if exists public.store_stats;

-- Public stock COUNTS (never the credentials themselves).
create or replace function public.get_stock_counts()
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

-- Store-wide totals for the home page's trust badge.
create or replace function public.get_store_stats()
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

-- ---------- 2. The "request" product kind ----------

alter table public.mods drop constraint if exists mods_kind_check;
alter table public.mods add constraint mods_kind_check
  check (kind in ('mod', 'account', 'subscription', 'request'));

-- Requests and accounts can both be bought repeatedly — two commissions
-- are two separate jobs, so they each need their own purchase row.
drop index if exists public.purchases_single_owned_idx;
create unique index purchases_single_owned_idx
  on public.purchases (user_id, mod_id)
  where kind not in ('account', 'request');

create table if not exists public.requests (
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

create index if not exists requests_user_idx on public.requests (user_id);
create index if not exists requests_status_idx on public.requests (status);

alter table public.requests enable row level security;

drop policy if exists "Requests are visible to their owner" on public.requests;
create policy "Requests are visible to their owner"
  on public.requests for select
  using (user_id = auth.uid() or public.is_admin());

-- The paywall: a brief can only be opened against a purchase that
-- belongs to you AND was for a request-kind product. No payment,
-- no purchase row, no request.
drop policy if exists "Buyers open their own request" on public.requests;
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

-- Buyers may keep editing the brief until you start work, and can
-- never set the status or attach the delivery file themselves.
drop policy if exists "Buyers edit a request until work starts" on public.requests;
create policy "Buyers edit a request until work starts"
  on public.requests for update
  using (auth.uid() = user_id and status = 'new')
  with check (auth.uid() = user_id and status = 'new' and file_path is null);

drop policy if exists "Admins manage requests" on public.requests;
create policy "Admins manage requests"
  on public.requests for update
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_request_updated()
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

drop trigger if exists requests_touch_updated on public.requests;
create trigger requests_touch_updated
  before update on public.requests
  for each row execute function public.touch_request_updated();

-- ---------- 3. grant_product understands repeat-buy kinds ----------

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

revoke all on function public.grant_product(uuid, uuid, integer, text, text) from public;
grant execute on function public.grant_product(uuid, uuid, integer, text, text) to service_role;

-- ---------- 4. Delivered commission files are downloadable ----------

drop policy if exists "Buyers can read mod files" on storage.objects;
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
      or exists (
        select 1 from public.requests r
        where r.file_path = storage.objects.name
          and (r.user_id = auth.uid() or public.is_admin())
      )
    )
  );

-- ---------- 5. Live updates ----------

do $$
begin
  alter publication supabase_realtime add table public.requests;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Done. The two "Unrestricted / Security Definer view" warnings
-- in the Table Editor disappear once this runs, because the views
-- they referred to no longer exist.
-- ============================================================
