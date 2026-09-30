-- One price per activity, whatever reports it (watch or quest).
-- recalc_player now also prices watch items through the 7-day card; see
-- src/lib/pricing.ts for how steps, sleep and workouts become a rated value.
-- Same function as 2026-09-30-periods-and-tracked.sql plus the watch block.

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
  update public.xp_ledger l
     set xp = public.card_xp(w.rated, (((s.run - 1) % 7) + 1)::int)
    from w join s on s.kind = w.kind and s.day = w.day
   where l.id = w.id
     and l.xp is distinct from public.card_xp(w.rated, (((s.run - 1) % 7) + 1)::int);

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
