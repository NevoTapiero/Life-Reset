-- 7-day cards: XP rewards consistency, not single actions.
--
-- 1. Every quest runs its own 7-day card. Its payout is the quest's rated value
--    x 0.4 on day 1, rising each consecutive day (x1, 1.2, 1.4, 1.6, 1.8, 2, 3),
--    then the card starts again at day 1. A missed day also restarts it.
-- 2. Every 7th consecutive day with at least one quest done pays a 20 XP bonus.
-- 3. XP from Google / Google Health / WHOOP drops to the same 0.4 rate.
-- 4. Rank costs double (client side, src/lib/game.ts TIERS).
-- 5. Every player's XP is rebuilt from their real history under these rules.
--
-- Run once. Safe to re-run: the rescale is guarded and everything else is
-- recomputed, not incremented. Undo: see the restore block at the bottom.

-- ---------- bookkeeping + backup (before anything changes) ----------
create table if not exists public.xp_migrations (name text primary key, ran_at timestamptz not null default now());
alter table public.xp_migrations enable row level security;
revoke all on public.xp_migrations from anon, authenticated;

create table if not exists public.backup_0930_profiles as
  select id, username, xp, streak_current, streak_best from public.profiles;
create table if not exists public.backup_0930_completions as
  select id, user_id, quest_id, completed_on, xp_awarded from public.quest_completions;
create table if not exists public.backup_0930_ledger as
  select id, user_id, source, ref, xp, meta from public.xp_ledger;
alter table public.backup_0930_profiles enable row level security;
alter table public.backup_0930_completions enable row level security;
alter table public.backup_0930_ledger enable row level security;
revoke all on public.backup_0930_profiles, public.backup_0930_completions, public.backup_0930_ledger from anon, authenticated;

-- ---------- the card payout ----------
create or replace function public.card_xp(p_rated int, p_day int)
returns int language sql immutable set search_path = public as $$
  select greatest(1, round(
           greatest(1, round(p_rated * 0.4))
           * (array[1, 1.2, 1.4, 1.6, 1.8, 2, 3]::numeric[])[least(7, greatest(1, p_day))]
         ))::int
$$;

-- ---------- rebuild one player's XP from history ----------
-- Quest payouts come from each quest's card; the streak bonus rows are synced to
-- exactly the days that earn one; the total is completions + ledger. Called on
-- every check / uncheck, so logging yesterday late re-prices today correctly.
create or replace function public.recalc_player(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  with c as (
    select qc.id, qc.quest_id, qc.completed_on, q.xp as rated,
           qc.completed_on - (row_number() over (partition by qc.quest_id order by qc.completed_on))::int as grp
    from public.quest_completions qc
    join public.quests q on q.id = qc.quest_id
    where qc.user_id = p_uid
  ), r as (
    select id, rated, row_number() over (partition by quest_id, grp order by completed_on) as run from c
  )
  update public.quest_completions qc
     set xp_awarded = public.card_xp(r.rated, (((r.run - 1) % 7) + 1)::int)
    from r
   where qc.id = r.id
     and qc.xp_awarded is distinct from public.card_xp(r.rated, (((r.run - 1) % 7) + 1)::int);

  create temp table if not exists _streak_due (ref text primary key) on commit drop;
  delete from _streak_due;
  insert into _streak_due (ref)
  select 'streak7:' || completed_on::text
  from (
    select completed_on, row_number() over (partition by grp order by completed_on) as n
    from (
      select completed_on, completed_on - (row_number() over (order by completed_on))::int as grp
      from (select distinct completed_on from public.quest_completions where user_id = p_uid) d
    ) g
  ) runs
  where n % 7 = 0;

  delete from public.xp_ledger l
   where l.user_id = p_uid and l.source = 'streak_bonus'
     and not exists (select 1 from _streak_due s where s.ref = l.ref);
  insert into public.xp_ledger (user_id, source, ref, xp, reason)
  select p_uid, 'streak_bonus', s.ref, 20, '7-day streak bonus' from _streak_due s
  on conflict (user_id, source, ref) do nothing;

  update public.profiles
     set xp = coalesce((select sum(xp_awarded) from public.quest_completions where user_id = p_uid), 0)
            + coalesce((select sum(xp) from public.xp_ledger where user_id = p_uid), 0)
   where id = p_uid;
end $$;
revoke all on function public.recalc_player(uuid) from public, anon, authenticated;
grant execute on function public.recalc_player(uuid) to service_role;

-- ---------- check / uncheck now go through the card ----------
create or replace function public.complete_quest_for(p_quest_id text, p_on date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.app_today();
  q record;
  pr record;
  inserted boolean := false;
  st text;
  new_stats jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_on not in (today, today - 1) then
    raise exception 'you can only log today or yesterday';
  end if;
  select * into q from public.quests where id = p_quest_id;
  if not found then raise exception 'unknown quest'; end if;
  if not exists (select 1 from public.user_quests where user_id = uid and quest_id = p_quest_id and active) then
    raise exception 'quest not active for user';
  end if;

  begin
    insert into public.quest_completions (user_id, quest_id, completed_on, xp_awarded)
    values (uid, p_quest_id, p_on, 0);   -- priced by recalc_player below
    inserted := true;
  exception when unique_violation then
    inserted := false;
  end;

  if inserted then
    select * into pr from public.profiles where id = uid for update;
    new_stats := pr.stats;
    foreach st in array q.stats loop
      new_stats := jsonb_set(new_stats, array[st], to_jsonb(coalesce((new_stats->>st)::int, 0) + 2));
    end loop;
    update public.profiles set stats = new_stats where id = uid;
    perform public.recount_streak(uid);
    perform public.recalc_player(uid);
  end if;

  return (select to_jsonb(pr2) from public.profiles pr2 where pr2.id = uid);
end $$;

create or replace function public.uncomplete_quest_for(p_quest_id text, p_on date)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := public.app_today();
  q record;
  pr record;
  removed record;
  new_stats jsonb;
  st text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_on not in (today, today - 1) then
    raise exception 'you can only change today or yesterday';
  end if;
  select * into q from public.quests where id = p_quest_id;
  if not found then raise exception 'unknown quest'; end if;

  delete from public.quest_completions
  where user_id = uid and quest_id = p_quest_id and completed_on = p_on
  returning * into removed;

  if removed.id is not null then
    select * into pr from public.profiles where id = uid for update;
    new_stats := pr.stats;
    foreach st in array q.stats loop
      new_stats := jsonb_set(new_stats, array[st], to_jsonb(greatest(0, coalesce((new_stats->>st)::int, 0) - 2)));
    end loop;
    update public.profiles set stats = new_stats where id = uid;
    perform public.recount_streak(uid);
    perform public.recalc_player(uid);
  end if;

  return (select to_jsonb(pr2) from public.profiles pr2 where pr2.id = uid);
end $$;

-- ---------- re-price an already paid outside item (server only) ----------
-- Used when a workout is re-scored by intensity (heart rate zones / calories).
create or replace function public.rescore_external_xp(p_user uuid, p_source text, p_ref text, p_xp int, p_reason text, p_meta jsonb)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  old_xp int;
  amt int := greatest(0, least(coalesce(p_xp, 0), 200));
begin
  select xp into old_xp from public.xp_ledger where user_id = p_user and source = p_source and ref = p_ref for update;
  if not found then return 0; end if;
  update public.xp_ledger
     set xp = amt, reason = coalesce(p_reason, reason), meta = meta || coalesce(p_meta, '{}'::jsonb)
   where user_id = p_user and source = p_source and ref = p_ref;
  update public.profiles set xp = greatest(0, xp + amt - old_xp) where id = p_user;
  return amt - old_xp;
end
$fn$;
revoke all on function public.rescore_external_xp(uuid, text, text, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.rescore_external_xp(uuid, text, text, int, text, jsonb) to service_role;

-- ---------- one-time: outside XP to the new rate ----------
-- Workouts are re-scored by intensity on the next Health sync; this is their
-- interim value until then.
do $$
begin
  if not exists (select 1 from public.xp_migrations where name = '2026-09-30-external-scale') then
    update public.xp_ledger
       set xp = greatest(1, round(xp * 0.4))::int,
           meta = meta || '{"scaled": 0.4}'::jsonb
     where source <> 'streak_bonus' and xp > 0;
    insert into public.xp_migrations (name) values ('2026-09-30-external-scale');
  end if;
end $$;

-- ---------- rebuild everyone ----------
select public.recount_streak(id) from public.profiles;
select public.recalc_player(id) from public.profiles;

-- Report: before -> after for every player.
select b.username, b.xp as xp_before, p.xp as xp_after
from public.backup_0930_profiles b join public.profiles p on p.id = b.id
order by b.xp desc;

-- ---------- UNDO (do not run unless rolling back) ----------
-- update public.quest_completions c set xp_awarded = b.xp_awarded from public.backup_0930_completions b where b.id = c.id;
-- delete from public.xp_ledger where source = 'streak_bonus';
-- update public.xp_ledger l set xp = b.xp, meta = b.meta from public.backup_0930_ledger b where b.id = l.id;
-- update public.profiles p set xp = b.xp from public.backup_0930_profiles b where b.id = p.id;
-- delete from public.xp_migrations where name = '2026-09-30-external-scale';
-- (and restore the old complete_quest_for / uncomplete_quest_for from git history)
