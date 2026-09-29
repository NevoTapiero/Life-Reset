-- Gold: the spendable currency, separate from XP so buying things never
-- touches rank. Quests pay 2 gold per XP; connected-app loot pays XP only, so a
-- watch cannot farm the shop. Chests for full-day clears and streaks come later.
alter table public.profiles add column if not exists gold int not null default 0;

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
    values (uid, p_quest_id, p_on, q.xp);
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
    update public.profiles set xp = pr.xp + q.xp, gold = pr.gold + q.xp * 2, stats = new_stats where id = uid;
    perform public.recount_streak(uid);
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
    update public.profiles set xp = greatest(0, pr.xp - removed.xp_awarded), gold = greatest(0, pr.gold - removed.xp_awarded * 2), stats = new_stats where id = uid;
    perform public.recount_streak(uid);
  end if;

  return (select to_jsonb(pr2) from public.profiles pr2 where pr2.id = uid);
end $$;
