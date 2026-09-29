-- The town: you and your friends as houses on one map. Per person it exposes
-- only what the street can see -- who they are, how their day is going in
-- XP, and the last thing their character was seen doing (one quest, so the
-- client can turn it into "Reading" or "Training"; never the full list).
create or replace function public.get_town()
returns table (
  username text,
  archetype text,
  xp int,
  gold int,
  streak_current int,
  today_xp bigint,
  last_quest_id text,
  last_quest_title text,
  last_quest_pillar text,
  last_done_at timestamptz,
  is_me boolean
)
language sql stable security definer set search_path = public
as $$
  with circle as (
    select auth.uid() as pid
    union
    select case when f.a = auth.uid() then f.b else f.a end
    from public.friendships f
    where f.a = auth.uid() or f.b = auth.uid()
  ),
  last_done as (
    select distinct on (c.user_id) c.user_id, c.quest_id, c.created_at
    from public.quest_completions c
    where c.completed_on = public.app_today()
    order by c.user_id, c.created_at desc
  )
  select p.username, p.archetype, p.xp, p.gold, p.streak_current,
         coalesce((select sum(c.xp_awarded) from public.quest_completions c
                   where c.user_id = p.id and c.completed_on = public.app_today()), 0) as today_xp,
         q.id, q.title, q.pillar, ld.created_at,
         p.id = auth.uid() as is_me
  from public.profiles p
  join circle on circle.pid = p.id
  left join last_done ld on ld.user_id = p.id
  left join public.quests q on q.id = ld.quest_id
  where p.id = auth.uid() or p.share_activity
  order by p.id = auth.uid() desc, p.xp desc
  limit 100
$$;
