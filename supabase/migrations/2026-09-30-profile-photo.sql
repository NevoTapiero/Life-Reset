-- Profile pictures (nevo/dev, brick theme). Additive only: the live app on
-- main ignores the new column and the extra leaderboard field.
--   * profiles.avatar_url: the player's photo, null = the LEGO minifig head
--   * storage bucket "avatars": public read, each player writes only inside
--     their own folder (<uid>/...), images up to 2 MB
--   * set_avatar(url): the only way to set it, and only to your own folder
--   * get_leaderboard() also returns avatar_url
-- Safe to run twice.

begin;

alter table public.profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_read_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_read_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Set (or clear, with null) your picture. Only a public URL inside your own
-- folder of this project's avatars bucket is accepted.
create or replace function public.set_avatar(p_url text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  result public.profiles;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  if p_url is not null and p_url not like
     'https://etlumfjimkjjdmhimzwr.supabase.co/storage/v1/object/public/avatars/' || me::text || '/%' then
    raise exception 'that picture is not in your folder';
  end if;
  update public.profiles set avatar_url = p_url where id = me returning * into result;
  return result;
end;
$$;

revoke all on function public.set_avatar(text) from public, anon;
grant execute on function public.set_avatar(text) to authenticated;

-- same board as before, plus each player's picture
drop function if exists public.get_leaderboard();
create function public.get_leaderboard()
returns table(username text, archetype text, xp integer, streak_current integer, weekly_xp bigint, is_me boolean, avatar_url text)
language sql
stable security definer
set search_path to 'public'
as $function$
  with circle as (
    select auth.uid() as pid
    union
    select case when f.a = auth.uid() then f.b else f.a end
    from public.friendships f
    where f.a = auth.uid() or f.b = auth.uid()
  )
  select p.username, p.archetype, p.xp, p.streak_current,
         coalesce(sum(c.xp_awarded) filter (where c.completed_on >= public.app_today() - 6), 0) as weekly_xp,
         p.id = auth.uid() as is_me,
         p.avatar_url
  from public.profiles p
  join circle on circle.pid = p.id
  left join public.quest_completions c on c.user_id = p.id
  where p.id = auth.uid() or p.share_activity
  group by p.id
  order by p.xp desc, weekly_xp desc
  limit 100
$function$;

revoke all on function public.get_leaderboard() from public, anon;
grant execute on function public.get_leaderboard() to authenticated;

-- the friend page shows their picture too
create or replace function public.get_friend_profile(p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  target record;
  quest_list jsonb;
  weekly bigint;
  today date := public.app_today();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into target from public.profiles where username = p_username;
  if not found then raise exception 'unknown challenger'; end if;
  if target.id <> uid then
    if not exists (
      select 1 from public.friendships
      where a = least(uid, target.id) and b = greatest(uid, target.id)
    ) then
      raise exception 'not on your friends list';
    end if;
    if not target.share_activity then
      raise exception 'this challenger keeps their activity private';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'pillar', q.pillar,
    'xp', q.xp,
    'icon', q.icon,
    'period', q.period,
    'done_today', exists (
      select 1 from public.quest_completions c
      where c.user_id = target.id and c.quest_id = q.id
        and public.period_start(q.period, c.completed_on) = public.period_start(q.period, today)
    )
  ) order by case q.period when 'daily' then 0 when 'weekly' then 1 else 2 end, q.sort, q.title), '[]'::jsonb)
  into quest_list
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = target.id and uq.active;

  select coalesce(sum(c.xp_awarded), 0) into weekly
  from public.quest_completions c
  where c.user_id = target.id
    and c.completed_on >= today - 6;

  return jsonb_build_object(
    'username', target.username,
    'archetype', target.archetype,
    'xp', target.xp,
    'streak_current', target.streak_current,
    'streak_best', target.streak_best,
    'stats', target.stats,
    'member_since', target.created_at,
    'weekly_xp', weekly,
    'quests', quest_list,
    'avatar_url', target.avatar_url
  );
end $function$;

commit;
