-- ============================================================
-- 0o777 — upgrade v3 → v4
--
-- Requests can now be CLOSED once a job is finished and paid for.
-- Closing only archives it for you: the buyer keeps the request and
-- the finished download in their library permanently.
--
-- Run this ONCE:
--   Dashboard → SQL Editor → New query → paste everything → Run
--
-- Safe to re-run. Requires upgrade-v3.sql to have been run first.
-- ============================================================

alter table public.requests drop constraint if exists requests_status_check;
alter table public.requests add constraint requests_status_check
  check (status in ('new', 'in_progress', 'delivered', 'closed', 'declined'));

-- Stamp delivered_at the first time a build is actually attached, not just
-- when the status happens to be flipped. Uploading the file IS the delivery;
-- going straight to "closed" afterwards must not lose the date.
create or replace function public.touch_request_updated()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if new.delivered_at is null
     and (
       (new.file_path is not null and old.file_path is distinct from new.file_path)
       or (new.status = 'delivered' and old.status is distinct from 'delivered')
     ) then
    new.delivered_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists requests_touch_updated on public.requests;
create trigger requests_touch_updated
  before update on public.requests
  for each row execute function public.touch_request_updated();

-- Note: no change is needed to the storage policy. Access to a delivered
-- build is granted on `requests.file_path` + `requests.user_id` and never
-- looked at the status, so closing a request cannot take the buyer's
-- download away.

-- ============================================================
-- Done.
-- ============================================================
