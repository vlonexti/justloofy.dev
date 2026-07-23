-- ============================================================
-- JustLoofy Mods — Supabase schema
--
-- Run this ONCE in your Supabase project:
--   Dashboard → SQL Editor → New query → paste everything → Run
-- ============================================================

-- ---------- Profiles (one row per user, auto-created on signup) ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  is_admin boolean not null default false,
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

-- ---------- Mods (the products) ----------

create table public.mods (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  game text not null,
  tagline text,
  description text,
  version text not null default '1.0.0',
  price_cents integer not null default 0 check (price_cents >= 0),
  image_url text,
  file_path text,          -- path inside the private "mod-files" storage bucket
  featured boolean not null default false,
  published boolean not null default true,
  downloads integer not null default 0,
  created_at timestamptz not null default now()
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
  amount_cents integer not null default 0,
  stripe_session_id text,
  created_at timestamptz not null default now(),
  unique (user_id, mod_id)
);

alter table public.purchases enable row level security;

create policy "Users can view their own purchases"
  on public.purchases for select using (auth.uid() = user_id or public.is_admin());

-- Users may add FREE mods to their library themselves.
-- Paid purchases are inserted only by the Stripe webhook (service role bypasses RLS).
create policy "Users can claim free mods"
  on public.purchases for insert with check (
    auth.uid() = user_id
    and amount_cents = 0
    and exists (
      select 1 from public.mods
      where id = mod_id and price_cents = 0 and published = true
    )
  );

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

-- Buyers (and anyone, for free mods) can download mod files via signed URLs
create policy "Buyers can read mod files"
  on storage.objects for select
  using (
    bucket_id = 'mod-files'
    and exists (
      select 1 from public.mods m
      where m.file_path = storage.objects.name
        and m.published = true
        and (
          m.price_cents = 0
          or exists (
            select 1 from public.purchases p
            where p.mod_id = m.id and p.user_id = auth.uid()
          )
        )
    )
  );

-- ============================================================
-- AFTER RUNNING THIS: make yourself the admin.
-- 1. Sign up on your site with your email.
-- 2. Run (replace with YOUR email):
--
--    update public.profiles set is_admin = true
--    where id = (select id from auth.users where email = 'frenzersteven1@gmail.com');
-- ============================================================
