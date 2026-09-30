-- ============================================================================
-- Iftach's migrations, one paste. Supabase -> SQL Editor -> paste all -> Run.
--
-- What it adds: house visits (knocking), the chest + gold, the furniture shop.
-- Safe to run twice (every statement is "if not exists" / "or replace").
-- All or nothing: it runs in one transaction, and it stops before changing
-- anything if Nevo's migrations it builds on aren't there yet
-- (2026-09-30-streak-cards, -periods-and-tracked, -watch-parity).
-- 2026-09-29-xp-penalties.sql is NOT needed: the chest's award_external_xp
-- below already includes the penalties.
-- ============================================================================

begin;

-- ---------- check Nevo's pieces are in place ----------
do $check$
begin
  if to_regprocedure('public.card_xp(integer, integer)') is null then
    raise exception 'Apply Nevo''s 2026-09-30-streak-cards.sql first (card_xp is missing)';
  end if;
  if to_regprocedure('public.period_index(text, date)') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quests' and column_name = 'period') then
    raise exception 'Apply Nevo''s 2026-09-30-periods-and-tracked.sql first (period_index / quests.period is missing)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'xp_ledger' and column_name = 'meta') then
    raise exception 'xp_ledger.meta is missing (2026-09-29-connected-at-and-ledger-meta.sql)';
  end if;
  if position('rated' in coalesce((select prosrc from pg_proc where oid = to_regprocedure('public.recalc_player(uuid)')), '')) = 0 then
    raise exception 'Apply Nevo''s 2026-09-30-watch-parity.sql first (recalc_player has no watch pricing)';
  end if;
end
$check$;


-- ############################################################################
-- 2026-09-30-house-visits.sql: knock on a friend's door, let them in
-- ############################################################################
-- ============ house visits ============
-- In the town you can knock on a friend's door; they let you in (or not).
-- Once let in you can go inside their house whenever you like, until they
-- take it back (answer_knock with false). Friends only.
-- ponytail: permission is permanent once given; add expiry if hosts want one-off visits

create table if not exists public.house_visits (
  visitor uuid not null references public.profiles(id) on delete cascade,
  host uuid not null references public.profiles(id) on delete cascade,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (visitor, host),
  check (visitor <> host)
);
alter table public.house_visits enable row level security;
-- no policies: read and written only through the functions below

-- knock on a friend's door (does nothing if you're already let in)
create or replace function public.knock(p_host text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where username = p_host;
  if target is null then raise exception 'unknown challenger'; end if;
  if target = uid then raise exception 'that is your own house'; end if;
  if not exists (select 1 from public.friendships where a = least(uid, target) and b = greatest(uid, target)) then
    raise exception 'not on your friends list';
  end if;
  insert into public.house_visits (visitor, host) values (uid, target) on conflict do nothing;
end $$;

-- the host answers: let them in, or turn them away (also takes back a past yes)
create or replace function public.answer_knock(p_visitor text, p_allow boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where username = p_visitor;
  if target is null then raise exception 'unknown challenger'; end if;
  if p_allow then
    update public.house_visits set allowed = true where visitor = target and host = uid;
  else
    delete from public.house_visits where visitor = target and host = uid;
  end if;
end $$;

-- every knock that involves you: doors you knocked on, and people at your door
create or replace function public.my_visits()
returns table (username text, knocked_by_me boolean, allowed boolean)
language sql stable security definer set search_path = public
as $$
  select p.username, v.visitor = auth.uid(), v.allowed
  from public.house_visits v
  join public.profiles p on p.id = case when v.visitor = auth.uid() then v.host else v.visitor end
  where v.visitor = auth.uid() or v.host = auth.uid()
$$;

grant execute on function public.knock(text) to authenticated;
grant execute on function public.answer_knock(text, boolean) to authenticated;
grant execute on function public.my_visits() to authenticated;

-- ############################################################################
-- 2026-09-30-xp-chest.sql: watch XP waits in a chest; gold; collect()
-- ############################################################################
-- ============ the chest: collect what your watch earned ============
-- Apply AFTER 2026-09-30-watch-parity.sql (and so after streak-cards and
-- periods-and-tracked): it carries Nevo's recalc_player from watch-parity with
-- the parts marked (chest) changed.
--
-- What your watch / band earns while you're away (steps, sleep, workouts) now
-- waits in a chest in your house instead of landing straight on your XP. A
-- ledger row is in the chest while collected_at is null: its price sits in
-- pending_xp and xp is 0, so every XP sum ignores it. collect() moves it into
-- xp, stamps collected_at and pays the same in gold. If a collected reward is
-- re-priced later, the gold it paid moves by the same difference.
-- Penalties (a short night, a red recovery) still land at once.
-- Missions pay gold too: gold follows each completion's xp_awarded.
-- Gold may go below zero (a debt that just blocks buying).
-- ponytail: 1 gold per XP everywhere; tune when the shop exists

alter table public.profiles add column if not exists gold int not null default 0;
alter table public.xp_ledger add column if not exists pending_xp int not null default 0;
-- everything already in the ledger counts as collected (the default fills it in)
alter table public.xp_ledger add column if not exists collected_at timestamptz default now();

-- rewards from these sources wait for you to collect them
create or replace function public.waits_in_chest(p_source text)
returns boolean language sql immutable set search_path = public as $$
  select split_part(p_source, '_', 1) in ('health', 'whoop')
$$;

-- (same signature as the penalties version) band rewards go in the chest
create or replace function public.award_external_xp(p_user uuid, p_source text, p_ref text, p_xp int, p_reason text, p_meta jsonb default null)
returns boolean language plpgsql security definer set search_path=public as $fn$
declare
  inserted boolean := false;
  -- negative amounts are penalties (short night, red recovery); total never goes below zero
  amt int := greatest(-200, least(coalesce(p_xp,0), 200));
  chest boolean := amt > 0 and public.waits_in_chest(p_source);
begin
  begin
    insert into public.xp_ledger(user_id,source,ref,xp,pending_xp,collected_at,reason,meta)
    values (p_user,p_source,p_ref,
            case when chest then 0 else amt end, case when chest then amt else 0 end,
            case when chest then null else now() end,
            p_reason,coalesce(p_meta,'{}'::jsonb));
    inserted := true;
  exception when unique_violation then inserted := false;
  end;
  if inserted and amt <> 0 and not chest then
    update public.profiles set xp = greatest(0, xp + amt) where id = p_user;
  end if;
  return inserted;
end
$fn$;
revoke all on function public.award_external_xp(uuid,text,text,int,text,jsonb) from public, anon, authenticated;
grant execute on function public.award_external_xp(uuid,text,text,int,text,jsonb) to service_role;

-- (same signature) re-pricing: in the chest it changes what's waiting (even to
-- 0, and back); collected, it moves the XP and, for a chest reward, the gold
create or replace function public.rescore_external_xp(p_user uuid, p_source text, p_ref text, p_xp int, p_reason text, p_meta jsonb)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  row_ record;
  amt int := greatest(0, least(coalesce(p_xp, 0), 200));
begin
  select xp, collected_at into row_ from public.xp_ledger where user_id = p_user and source = p_source and ref = p_ref for update;
  if not found then return 0; end if;
  if row_.collected_at is null then
    update public.xp_ledger
       set pending_xp = amt, reason = coalesce(p_reason, reason), meta = meta || coalesce(p_meta, '{}'::jsonb)
     where user_id = p_user and source = p_source and ref = p_ref;
    return 0;
  end if;
  update public.xp_ledger
     set xp = amt, reason = coalesce(p_reason, reason), meta = meta || coalesce(p_meta, '{}'::jsonb)
   where user_id = p_user and source = p_source and ref = p_ref;
  update public.profiles
     set xp = greatest(0, xp + amt - row_.xp),
         gold = gold + case when public.waits_in_chest(p_source) then amt - row_.xp else 0 end
   where id = p_user;
  return amt - row_.xp;
end
$fn$;
revoke all on function public.rescore_external_xp(uuid, text, text, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.rescore_external_xp(uuid, text, text, int, text, jsonb) to service_role;

-- tap the chest: everything waiting becomes XP, and the same in gold
create or replace function public.collect()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  got int;
  prof jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  with paid as (
    update public.xp_ledger set xp = pending_xp, pending_xp = 0, collected_at = now()
     where user_id = uid and collected_at is null
    returning xp
  )
  select coalesce(sum(xp), 0) into got from paid;
  -- recalc_player is the one source of truth for the XP total (it sums the
  -- ledger, now including what was just collected, floored at zero)
  update public.profiles set gold = gold + got where id = uid;
  perform public.recalc_player(uid);
  select to_jsonb(p.*) into prof from public.profiles p where p.id = uid;
  return jsonb_build_object('xp', got, 'gold', got, 'profile', prof);
end $$;
grant execute on function public.collect() to authenticated;

-- (Nevo's recalc_player from 2026-09-30-watch-parity.sql; the parts marked
-- "(chest)" are the changes. Keep them in any later recalc_player.)
create or replace function public.recalc_player(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with c as (
    select qc.id, qc.quest_id, q.xp as rated,
           public.period_index(q.period, qc.completed_on)
             - (row_number() over (partition by qc.quest_id
                                   order by public.period_index(q.period, qc.completed_on)))::int as grp,
           public.period_index(q.period, qc.completed_on) as idx
    from public.quest_completions qc
    join public.quests q on q.id = qc.quest_id
    where qc.user_id = p_uid
  ), r as (
    select id, rated, row_number() over (partition by quest_id, grp order by idx) as run from c
  )
  update public.quest_completions qc
     set xp_awarded = public.card_xp(r.rated, (((r.run - 1) % 7) + 1)::int)
    from r
   where qc.id = r.id
     and qc.xp_awarded is distinct from public.card_xp(r.rated, (((r.run - 1) % 7) + 1)::int);

  -- Watch items (steps, sleep, workouts from Google Health / WHOOP) carry
  -- { kind, rated, day } and pay through the same card as a quest: consecutive
  -- days of that kind, x0.6 on day 1 up to x2.5 on day 7, then back to day 1.
  create temp table if not exists _watch_price (id bigint primary key, price int) on commit drop;
  delete from _watch_price where true; -- the API role rejects a DELETE with no WHERE
  -- (chest) stage the new prices, then: rows still in the chest (collected_at
  -- is null) get the price as pending_xp and pay nothing yet; collected rows
  -- get it as xp, and the gold they paid moves by the same difference
  with w as (
    select l.id, l.meta->>'kind' as kind, (l.meta->>'rated')::int as rated, (l.meta->>'day')::date as day
    from public.xp_ledger l
    where l.user_id = p_uid and l.meta ? 'rated' and l.meta ? 'day' and l.meta ? 'kind'
      and (l.meta->>'rated')::int > 0   -- below the habit's bar: stays at 0
      -- (chest) only the card-priced watch sources, so a penalty row can never be re-priced
      and l.source in ('health_workout', 'health_sleep', 'health_steps', 'whoop_sleep', 'whoop_workout')
  ), d as (
    select distinct kind, day from w
  ), g as (
    select kind, day, day - (row_number() over (partition by kind order by day))::int as grp from d
  ), s as (
    select kind, day, row_number() over (partition by kind, grp order by day) as run from g
  )
  insert into _watch_price (id, price)
  select w.id, public.card_xp(w.rated, (((s.run - 1) % 7) + 1)::int)
    from w join s on s.kind = w.kind and s.day = w.day;
  update public.profiles
     set gold = gold + coalesce((
       select sum(p.price - l.xp) from _watch_price p join public.xp_ledger l on l.id = p.id
        where l.collected_at is not null and public.waits_in_chest(l.source) and l.xp <> p.price), 0)
   where id = p_uid;
  update public.xp_ledger l
     set xp = case when l.collected_at is null then 0 else p.price end,
         pending_xp = case when l.collected_at is null then p.price else 0 end
    from _watch_price p
   where l.id = p.id
     and (case when l.collected_at is null then l.pending_xp else l.xp end) is distinct from p.price;

  create temp table if not exists _streak_due (ref text primary key) on commit drop;
  delete from _streak_due where true; -- the API role rejects a DELETE with no WHERE
  insert into _streak_due (ref)
  select 'streak7:' || completed_on::text
  from (
    select completed_on, row_number() over (partition by grp order by completed_on) as n
    from (
      select completed_on, completed_on - (row_number() over (order by completed_on))::int as grp
      from (
        select distinct qc.completed_on
        from public.quest_completions qc
        join public.quests q on q.id = qc.quest_id and q.period = 'daily'
        where qc.user_id = p_uid
      ) d
    ) g
  ) runs
  where n % 7 = 0;

  delete from public.xp_ledger l
   where l.user_id = p_uid and l.source = 'streak_bonus'
     and not exists (select 1 from _streak_due s where s.ref = l.ref);
  insert into public.xp_ledger (user_id, source, ref, xp, reason)
  select p_uid, 'streak_bonus', s.ref, 50, '7-day streak bonus' from _streak_due s
  on conflict (user_id, source, ref) do nothing;

  update public.profiles
     set xp = greatest(0,
                coalesce((select sum(xp_awarded) from public.quest_completions where user_id = p_uid), 0)
              + coalesce((select sum(xp) from public.xp_ledger where user_id = p_uid), 0))
   where id = p_uid;
end $$;
revoke all on function public.recalc_player(uuid) from public, anon, authenticated;
grant execute on function public.recalc_player(uuid) to service_role;

-- missions pay gold: it follows what each completion is worth, including
-- re-pricing and unchecking. No floor: taking a mission back can put gold into
-- debt (buy_item needs gold >= price), or check-buy-uncheck would print gold.
create or replace function public.gold_follows_quest_xp()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  delta int := 0;
  who uuid;
begin
  if tg_op = 'INSERT' then
    delta := coalesce(new.xp_awarded, 0); who := new.user_id;
  elsif tg_op = 'UPDATE' then
    delta := coalesce(new.xp_awarded, 0) - coalesce(old.xp_awarded, 0); who := new.user_id;
  else
    delta := -coalesce(old.xp_awarded, 0); who := old.user_id;
  end if;
  if delta <> 0 then
    update public.profiles set gold = gold + delta where id = who;
  end if;
  return null;
end $$;
drop trigger if exists quest_gold on public.quest_completions;
create trigger quest_gold after insert or update of xp_awarded or delete on public.quest_completions
  for each row execute function public.gold_follows_quest_xp();

-- ############################################################################
-- 2026-09-30-shop.sql: spend gold on furniture
-- ############################################################################
-- ============ the shop: spend gold on furniture ============
-- Gold comes from 2026-09-30-xp-chest.sql; the column is created here
-- too, so the two can be applied in either order.
--
-- shop_items is the catalogue and its prices (the app draws each item; the
-- id matches DECOR in src/lib/legoWorld.ts). owned_items is what you've
-- bought. buy_item() is the only way in: it checks the price against your
-- gold on the server, takes the gold and hands you the item, all at once.

alter table public.profiles add column if not exists gold int not null default 0;

create table if not exists public.shop_items (
  id text primary key,
  name text not null,
  price int not null check (price >= 0),
  sort int not null default 0
);
alter table public.shop_items enable row level security;
drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select to authenticated using (true);

insert into public.shop_items (id, name, price, sort) values
  ('floor-lamp',   'Floor lamp',    50, 1),
  ('coffee-table', 'Coffee table',  60, 2),
  ('cat',          'Cat',           80, 3),
  ('indoor-trees', 'Indoor trees', 100, 4),
  ('sofa',         'Sofa',         150, 5),
  ('tv',           'TV',           200, 6),
  ('aquarium',     'Aquarium',     250, 7),
  ('trophy',       'Trophy',       300, 8)
on conflict (id) do nothing; -- re-running never resets prices that were tuned since

create table if not exists public.owned_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  bought_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.owned_items enable row level security;
drop policy if exists owned_items_own on public.owned_items;
create policy owned_items_own on public.owned_items for select using (auth.uid() = user_id);

-- buy one item: returns your gold after paying
create or replace function public.buy_item(p_item text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cost int;
  left_ int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price into cost from public.shop_items where id = p_item;
  if cost is null then raise exception 'no such item'; end if;
  if exists (select 1 from public.owned_items where user_id = uid and item_id = p_item) then
    raise exception 'you already have that';
  end if;
  update public.profiles set gold = gold - cost where id = uid and gold >= cost returning gold into left_;
  if left_ is null then raise exception 'not enough gold'; end if;
  insert into public.owned_items (user_id, item_id) values (uid, p_item);
  return left_;
end $$;
grant execute on function public.buy_item(text) to authenticated;

commit;

-- Check: these should all return a row.
--   select 'house_visits' where to_regclass('public.house_visits') is not null;
--   select 'collect'      where to_regprocedure('public.collect()') is not null;
--   select 'buy_item'     where to_regprocedure('public.buy_item(text)') is not null;
--   select count(*) as shop_items from public.shop_items;   -- 8
