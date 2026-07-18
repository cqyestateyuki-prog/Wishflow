-- SVG generation daily quota / AI 生成额度（防滥用）
-- Logged-in users: 3 AI drawings/day (keyed by account).
-- Anonymous users: 1/day (keyed by a hashed IP).
-- Enforced atomically by a SECURITY DEFINER function so the anon key can call it
-- without any direct table access. Run this once in the Supabase SQL editor.

create table if not exists public.svg_quota (
  identity text not null,
  day date not null,
  count int not null default 0,
  primary key (identity, day)
);

-- Lock the table: only the function below (SECURITY DEFINER) may touch it.
-- No RLS policies → anon/authenticated cannot read or write it directly.
alter table public.svg_quota enable row level security;

-- Atomically reserve one generation slot for `p_identity` today.
-- Returns allowed=false WITHOUT incrementing once the daily limit is reached,
-- so it doubles as the check and the counter in a single round trip.
create or replace function public.increment_svg_quota(p_identity text, p_limit int)
returns table(allowed boolean, used int, quota int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_count int;
begin
  insert into public.svg_quota (identity, day, count)
  values (p_identity, v_day, 0)
  on conflict (identity, day) do nothing;

  -- Lock this identity's row for the day so concurrent requests can't overshoot.
  select count into v_count from public.svg_quota
  where identity = p_identity and day = v_day
  for update;

  if v_count >= p_limit then
    return query select false, v_count, p_limit;
    return;
  end if;

  update public.svg_quota set count = count + 1
  where identity = p_identity and day = v_day;

  return query select true, v_count + 1, p_limit;
end;
$$;

grant execute on function public.increment_svg_quota(text, int) to anon, authenticated;

-- Optional housekeeping — keep the table tiny. Run manually, or wire to pg_cron:
-- delete from public.svg_quota where day < (now() at time zone 'utc')::date - 7;
