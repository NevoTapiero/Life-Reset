-- ============ the chest: collect what your watch earned ============
-- Apply AFTER 2026-09-30-watch-parity.sql (and so after streak-cards and
-- periods-and-tracked): it carries Nevo's recalc_player from watch-parity with
-- one change, so a watch item still in the chest is priced but not paid.
--
-- What your watch / band earns while you're away (steps, sleep, recovery,
-- workouts) now waits in a chest in your house instead of landing straight
-- on your XP. It sits in the ledger as pending_xp with xp = 0, so every
-- existing sum (recalc_player, the profile total) ignores it until you tap
-- the chest: collect() moves it into xp and pays the same in gold.
-- Penalties (a short night, a red recovery) still land at once.
-- Missions pay gold too: gold follows each completion's xp_awarded.
-- ponytail: 1 gold per XP everywhere; tune when the shop exists

alter table public.profiles add column if not exists gold int not null default 0;
alter table public.xp_ledger add column if not exists pending_xp int not null default 0;

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
    insert into public.xp_ledger(user_id,source,ref,xp,pending_xp,reason,meta)
    values (p_user,p_source,p_ref,
            case when chest then 0 else amt end, case when chest then amt else 0 end,
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

-- (same signature) a re-scored item still in the chest just changes what's waiting
create or replace function public.rescore_external_xp(p_user uuid, p_source text, p_ref text, p_xp int, p_reason text, p_meta jsonb)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  row_ record;
  amt int := greatest(0, least(coalesce(p_xp, 0), 200));
begin
  select xp, pending_xp into row_ from public.xp_ledger where user_id = p_user and source = p_source and ref = p_ref for update;
  if not found then return 0; end if;
  if row_.pending_xp > 0 then
    update public.xp_ledger
       set pending_xp = amt, reason = coalesce(p_reason, reason), meta = meta || coalesce(p_meta, '{}'::jsonb)
     where user_id = p_user and source = p_source and ref = p_ref;
    return 0;
  end if;
  update public.xp_ledger
     set xp = amt, reason = coalesce(p_reason, reason), meta = meta || coalesce(p_meta, '{}'::jsonb)
   where user_id = p_user and source = p_source and ref = p_ref;
  update public.profiles set xp = greatest(0, xp + amt - row_.xp) where id = p_user;
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
    update public.xp_ledger set xp = pending_xp, pending_xp = 0
     where user_id = uid and pending_xp > 0
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

-- (Nevo's recalc_player from 2026-09-30-watch-parity.sql; the only change is
-- marked "(chest)": watch items waiting in the chest are priced into
-- pending_xp instead of xp. Keep that clause in any later recalc_player.)
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
  with w as (
    select l.id, l.meta->>'kind' as kind, (l.meta->>'rated')::int as rated, (l.meta->>'day')::date as day
    from public.xp_ledger l
    where l.user_id = p_uid and l.meta ? 'rated' and l.meta ? 'day' and l.meta ? 'kind'
      and (l.meta->>'rated')::int > 0   -- below the habit's bar: stays at 0
  ), d as (
    select distinct kind, day from w
  ), g as (
    select kind, day, day - (row_number() over (partition by kind order by day))::int as grp from d
  ), s as (
    select kind, day, row_number() over (partition by kind, grp order by day) as run from g
  )
  -- (chest) a watch item still waiting to be collected is priced into
  -- pending_xp, not paid: it only counts once collect() moves it into xp
  update public.xp_ledger l
     set xp = case when l.pending_xp > 0 then 0 else p.price end,
         pending_xp = case when l.pending_xp > 0 then p.price else 0 end
    from (
      select w.id, public.card_xp(w.rated, (((s.run - 1) % 7) + 1)::int) as price
      from w join s on s.kind = w.kind and s.day = w.day
    ) p
   where l.id = p.id
     and (case when l.pending_xp > 0 then l.pending_xp else l.xp end) is distinct from p.price;

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

-- missions pay gold: it follows what each completion is worth, including re-pricing
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
    update public.profiles set gold = greatest(0, gold + delta) where id = who;
  end if;
  return null;
end $$;
drop trigger if exists quest_gold on public.quest_completions;
create trigger quest_gold after insert or update of xp_awarded or delete on public.quest_completions
  for each row execute function public.gold_follows_quest_xp();
