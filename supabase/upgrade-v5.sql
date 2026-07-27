-- ============================================================
-- 0o777 — upgrade v4 → v5  (hardening)
--
-- Buyer-supplied text on a request is the only free-text in the
-- store that YOU end up reading in the admin panel, so it gets
-- checked at the database level too — not just in the browser,
-- which anyone can bypass by calling the API directly.
--
-- Run this ONCE:
--   Dashboard → SQL Editor → New query → paste everything → Run
--
-- Safe to re-run.
-- ============================================================

do $$
begin
  -- Length caps: stops someone pasting a novel (or a few megabytes of
  -- junk) into a brief and bloating your free-tier database.
  if not exists (select 1 from pg_constraint where conname = 'requests_title_len') then
    alter table public.requests add constraint requests_title_len
      check (char_length(title) between 1 and 120);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'requests_details_len') then
    alter table public.requests add constraint requests_details_len
      check (char_length(details) between 1 and 4000);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'requests_game_len') then
    alter table public.requests add constraint requests_game_len
      check (game is null or char_length(game) <= 60);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'requests_note_len') then
    alter table public.requests add constraint requests_note_len
      check (admin_note is null or char_length(admin_note) <= 2000);
  end if;

  -- Reference links must be ordinary web addresses. Without this a buyer
  -- could store a "javascript:" URL that runs in YOUR session the moment
  -- you click it in the admin panel. The site refuses to render those
  -- anyway; this stops them ever being stored.
  if not exists (select 1 from pg_constraint where conname = 'requests_ref_scheme') then
    alter table public.requests add constraint requests_ref_scheme
      check (
        reference_url is null
        or (reference_url ~* '^https?://' and char_length(reference_url) <= 500)
      );
  end if;

  -- One account credential per line; nothing here should be huge either.
  if not exists (select 1 from pg_constraint where conname = 'stock_items_content_len') then
    alter table public.stock_items add constraint stock_items_content_len
      check (char_length(content) between 1 and 500);
  end if;
end $$;

-- ============================================================
-- If any of these fail, you have existing rows that break the rule.
-- Find them first, e.g.:
--   select id, char_length(details) from public.requests
--    where char_length(details) > 4000;
-- ============================================================
