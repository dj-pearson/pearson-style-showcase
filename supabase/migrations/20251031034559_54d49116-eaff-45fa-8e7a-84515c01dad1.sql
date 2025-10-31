-- Global 1 TPS throttle for Amazon PA-API
-- 1) Throttle table
create table if not exists public.amazon_api_throttle (
  id integer primary key,
  last_call_at timestamp with time zone,
  used_today integer not null default 0,
  day_key date not null default current_date
);

-- Seed singleton row
insert into public.amazon_api_throttle (id, last_call_at)
values (1, null)
on conflict (id) do nothing;

-- 2) Claim function: returns required wait before next call, and counters
create or replace function public.claim_amazon_throttle(min_interval_ms integer default 1000)
returns table (wait_ms integer, used_today integer, day_key date)
language plpgsql
as $$
declare
  now_ts timestamptz := now();
  lc timestamptz;
  u integer;
  d date;
  elapsed_ms integer := 0;
  intended_last timestamptz;
begin
  -- Ensure row exists
  insert into public.amazon_api_throttle (id) values (1)
  on conflict (id) do nothing;

  -- Lock row
  select last_call_at, used_today, day_key
    into lc, u, d
  from public.amazon_api_throttle
  where id = 1
  for update;

  -- Reset daily counters at day boundary
  if d is null or d <> current_date then
    u := 0;
    d := current_date;
  end if;

  if lc is not null then
    elapsed_ms := floor(extract(epoch from (now_ts - lc)) * 1000);
  end if;

  if elapsed_ms < min_interval_ms then
    wait_ms := min_interval_ms - elapsed_ms;
  else
    wait_ms := 0;
  end if;

  intended_last := now_ts + ((wait_ms::text || ' milliseconds')::interval);

  update public.amazon_api_throttle
    set last_call_at = intended_last,
        used_today = coalesce(u,0) + 1,
        day_key = d
    where id = 1;

  used_today := coalesce(u,0) + 1;
  day_key := d;

  return next;
end;
$$;