-- 1) Yesterday's list must never move. The old code compared added_at (UTC)
--    with the app day (Asia/Jerusalem), so anything added between midnight and
--    03:00 local looked like it was added "yesterday". Store the app-day date.
alter table public.user_quests add column if not exists added_on date;
update public.user_quests
   set added_on = (added_at at time zone 'Asia/Jerusalem')::date
 where added_on is null;
alter table public.user_quests alter column added_on set default public.app_today();
alter table public.user_quests alter column added_on set not null;

-- 2) Turning a quest back on counts as adding it today, so it never appears in
--    yesterday's list. Turning it off leaves history alone.
create or replace function public.set_quest_active(p_quest_id text, p_active boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.quests where id = p_quest_id and (user_id is null or user_id = uid)) then
    raise exception 'unknown quest';
  end if;
  insert into public.user_quests (user_id, quest_id, active, added_at, added_on)
  values (uid, p_quest_id, p_active, now(), public.app_today())
  on conflict (user_id, quest_id) do update set
    active = excluded.active,
    added_at = case when excluded.active and not user_quests.active then now() else user_quests.added_at end,
    added_on = case when excluded.active and not user_quests.active then public.app_today() else user_quests.added_on end;
end $$;

-- 3) Deleting a quest you already logged used to cascade away the completion,
--    which rewrote yesterday. Archive it instead when there is history.
alter table public.quests add column if not exists archived boolean not null default false;

create or replace function public.delete_custom_quest(p_id text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  has_history boolean;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.quests where id = p_id and user_id = uid) then
    raise exception 'quest not found or not yours';
  end if;
  select exists (select 1 from public.quest_completions where quest_id = p_id and user_id = uid)
    into has_history;
  if has_history then
    update public.quests set archived = true where id = p_id and user_id = uid;
    update public.user_quests set active = false where quest_id = p_id and user_id = uid;
  else
    delete from public.quests where id = p_id and user_id = uid;
  end if;
end $$;

-- 4) The Judge needs to see what the player's friends already run, so the same
--    habit is not worth 12 XP for one of them and 15 for the other.
create or replace function public.peer_quests()
returns jsonb
language sql security definer set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select distinct q.title, q.xp, q.pillar
    from public.friendships f
    join public.user_quests uq
      on uq.user_id = case when f.a = auth.uid() then f.b else f.a end
     and uq.active
    join public.quests q on q.id = uq.quest_id and not q.archived
    where (f.a = auth.uid() or f.b = auth.uid())
    limit 80
  ) t
$$;

grant execute on function public.peer_quests() to authenticated;
