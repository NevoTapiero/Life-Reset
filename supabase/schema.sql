-- Life Reset — schema v1
-- Applied via Supabase Management API. Idempotent where practical.

create extension if not exists pgcrypto;

-- ============ helpers ============
create or replace function public.app_today()
returns date
language sql stable
as $$ select (now() at time zone 'Asia/Jerusalem')::date $$;

-- ============ tables ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  archetype text,
  friend_code text unique,
  xp int not null default 0,
  streak_current int not null default 0,
  streak_best int not null default 0,
  last_completed_on date,
  stats jsonb not null default '{"CON":0,"FOC":0,"DIS":0,"STR":0,"WIS":0}'::jsonb,
  created_at timestamptz not null default now()
);
-- v3 migration: pure challenges, no campaign or contract
alter table public.profiles add column if not exists friend_code text unique;
-- v4: privacy — when off, friends do not see you on their boards
alter table public.profiles add column if not exists share_activity boolean not null default true;
alter table public.profiles drop column if exists focus_areas;
alter table public.profiles drop column if exists intensity;
alter table public.profiles drop column if exists onboarding;
alter table public.profiles drop column if exists onboarding_completed_at;
alter table public.profiles drop column if exists plan_started_on;
alter table public.profiles drop column if exists streak_commitment;
alter table public.profiles alter column stats set default '{"CON":0,"FOC":0,"DIS":0,"STR":0,"WIS":0}'::jsonb;

create table if not exists public.friendships (
  a uuid not null references public.profiles(id) on delete cascade,
  b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

create table if not exists public.quests (
  id text primary key,
  title text not null,
  description text not null default '',
  pillar text not null,
  xp int not null default 10,
  stats text[] not null default '{}',
  icon text not null default 'sparkle',
  benefits jsonb not null default '[]'::jsonb,
  sort int not null default 0
);
-- custom quests: user_id null = global catalog, otherwise owned by that user
alter table public.quests add column if not exists user_id uuid references public.profiles(id) on delete cascade;
-- v5: a quest you already logged is archived, never deleted, so history holds
alter table public.quests add column if not exists archived boolean not null default false;

create table if not exists public.user_quests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null references public.quests(id) on delete cascade,
  active boolean not null default true,
  added_at timestamptz not null default now(),
  added_on date not null default public.app_today(),
  primary key (user_id, quest_id)
);
-- v5: the app-day the quest joined the loadout, so yesterday never shifts
alter table public.user_quests add column if not exists added_on date;
update public.user_quests set added_on = (added_at at time zone 'Asia/Jerusalem')::date where added_on is null;
alter table public.user_quests alter column added_on set default public.app_today();
alter table public.user_quests alter column added_on set not null;

create table if not exists public.quest_completions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null references public.quests(id) on delete cascade,
  completed_on date not null default public.app_today(),
  xp_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, quest_id, completed_on)
);
create index if not exists quest_completions_user_day on public.quest_completions (user_id, completed_on);
create index if not exists quest_completions_day on public.quest_completions (completed_on);

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.quests enable row level security;
alter table public.user_quests enable row level security;
alter table public.quest_completions enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "quests_read_all" on public.quests;
create policy "quests_read_all" on public.quests for select using (user_id is null or user_id = auth.uid());

drop policy if exists "user_quests_select_own" on public.user_quests;
create policy "user_quests_select_own" on public.user_quests for select using (auth.uid() = user_id);

drop policy if exists "completions_select_own" on public.quest_completions;
create policy "completions_select_own" on public.quest_completions for select using (auth.uid() = user_id);

-- table privileges: reads only; every write goes through security definer RPCs
revoke all on public.profiles, public.quests, public.user_quests, public.quest_completions from anon, authenticated;
grant select on public.quests to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.user_quests to authenticated;
grant select on public.quest_completions to authenticated;

-- ============ new user trigger ============
create or replace function public.gen_friend_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = code);
  end loop;
  return code;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := coalesce(nullif(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'), ''), 'player');
  base := lower(left(base, 16));
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || (floor(random()*10000))::int::text;
    if n > 20 then
      candidate := 'player' || substr(new.id::text, 1, 8);
      exit;
    end if;
  end loop;
  insert into public.profiles (id, username, friend_code)
  values (new.id, candidate, public.gen_friend_code())
  on conflict (id) do nothing;

  -- default quest loadout for every new challenger
  insert into public.user_quests (user_id, quest_id)
  select new.id, q from unnest(array[
    'drink-water','sleep-7-9','read-books','workout','morning-sunlight',
    'cold-shower','social-media-limit','deep-work','plan-tomorrow','healthy-meal'
  ]) as q
  where exists (select 1 from public.quests where id = q)
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ quest management ============
drop function if exists public.complete_onboarding(jsonb);

create or replace function public.quest_stats_for_pillar(p_pillar text)
returns text[]
language sql immutable
as $$
  select case p_pillar
    when 'Strength' then array['STR']
    when 'Focus' then array['FOC']
    when 'Constitution' then array['CON']
    when 'Discipline' then array['DIS']
    when 'Wisdom' then array['WIS']
    -- legacy pillar names, mapped to their closest stat
    when 'Body' then array['STR']
    when 'Mind' then array['FOC']
    when 'Rest' then array['CON']
    when 'Fuel' then array['CON']
    when 'Connection' then array['WIS']
    when 'Purpose' then array['DIS']
    else array['DIS']
  end
$$;

create or replace function public.quest_icon_ok(p_icon text)
returns boolean
language sql immutable
as $$
  select p_icon in ('droplet','moon','book','dumbbell','sun','lotus','pen','snowflake','phone-off',
                    'target','calendar','users','bulb','sparkle','apple','screen-off','leaf',
                    'flame','trophy','chart','tasks','custom')
$$;

drop function if exists public.create_custom_quest(text, text, int);
create or replace function public.create_custom_quest(p_title text, p_pillar text, p_xp int, p_icon text default 'custom')
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_title text;
  new_id text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  clean_title := trim(coalesce(p_title, ''));
  if length(clean_title) < 2 or length(clean_title) > 60 then
    raise exception 'title must be 2 to 60 characters';
  end if;
  if p_pillar not in ('Strength','Focus','Constitution','Discipline','Wisdom') then
    raise exception 'unknown category';
  end if;
  if p_xp < 1 or p_xp > 60 then
    raise exception 'xp must be between 1 and 60';
  end if;
  if (select count(*) from public.quests where user_id = uid) >= 30 then
    raise exception 'custom quest limit reached';
  end if;

  new_id := 'c-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into public.quests (id, title, description, pillar, xp, stats, icon, benefits, sort, user_id)
  values (new_id, clean_title, '', p_pillar, p_xp, public.quest_stats_for_pillar(p_pillar),
          case when public.quest_icon_ok(p_icon) then p_icon else 'custom' end,
          '[]'::jsonb, 1000, uid);

  insert into public.user_quests (user_id, quest_id) values (uid, new_id)
  on conflict do nothing;

  return (select to_jsonb(q) from public.quests q where q.id = new_id);
end $$;

drop function if exists public.update_custom_quest(text, text, text, int);
create or replace function public.update_custom_quest(p_id text, p_title text, p_pillar text, p_xp int, p_icon text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_title text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  clean_title := trim(coalesce(p_title, ''));
  if length(clean_title) < 2 or length(clean_title) > 60 then
    raise exception 'title must be 2 to 60 characters';
  end if;
  if p_pillar not in ('Strength','Focus','Constitution','Discipline','Wisdom') then
    raise exception 'unknown category';
  end if;
  if p_xp < 1 or p_xp > 60 then
    raise exception 'xp must be between 1 and 60';
  end if;

  update public.quests set
    title = clean_title,
    pillar = p_pillar,
    xp = p_xp,
    stats = public.quest_stats_for_pillar(p_pillar),
    icon = case when p_icon is not null and public.quest_icon_ok(p_icon) then p_icon else icon end
  where id = p_id and user_id = uid;
  if not found then raise exception 'quest not found or not yours'; end if;

  return (select to_jsonb(q) from public.quests q where q.id = p_id);
end $$;

create or replace function public.delete_custom_quest(p_id text)
returns void
language plpgsql security definer set search_path = public
as $
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
end $;

create or replace function public.set_quest_active(p_quest_id text, p_active boolean)
returns void
language plpgsql security definer set search_path = public
as $
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
end $;

drop function if exists public.set_commitment(int);

create or replace function public.set_privacy(p_share boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update public.profiles set share_activity = p_share where id = uid;
  return (select to_jsonb(pr) from public.profiles pr where pr.id = uid);
end $$;

create or replace function public.set_archetype(p_key text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_key not in ('warrior','mentalist','wizard','guardian','shadow') then
    raise exception 'unknown character';
  end if;
  update public.profiles set archetype = p_key where id = uid;
  return (select to_jsonb(pr) from public.profiles pr where pr.id = uid);
end $$;

-- ============ friends ============
create or replace function public.add_friend(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target uuid;
  clean text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  clean := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  select id into target from public.profiles where friend_code = clean;
  if target is null then raise exception 'no challenger with that code'; end if;
  if target = uid then raise exception 'that is your own code'; end if;
  insert into public.friendships (a, b)
  values (least(uid, target), greatest(uid, target))
  on conflict do nothing;
  return (select jsonb_build_object('username', username, 'archetype', archetype) from public.profiles where id = target);
end $$;

-- a friend's public file: profile, stats and their current challenges
create or replace function public.get_friend_profile(p_username text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target record;
  quest_list jsonb;
  weekly bigint;
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
    'done_today', exists (
      select 1 from public.quest_completions c
      where c.user_id = target.id and c.quest_id = q.id and c.completed_on = public.app_today()
    )
  ) order by q.sort, q.title), '[]'::jsonb)
  into quest_list
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = target.id and uq.active;

  select coalesce(sum(c.xp_awarded), 0) into weekly
  from public.quest_completions c
  where c.user_id = target.id
    and c.completed_on >= public.app_today() - 6;

  return jsonb_build_object(
    'username', target.username,
    'archetype', target.archetype,
    'xp', target.xp,
    'streak_current', target.streak_current,
    'streak_best', target.streak_best,
    'stats', target.stats,
    'member_since', target.created_at,
    'weekly_xp', weekly,
    'quests', quest_list
  );
end $$;

create or replace function public.remove_friend(p_username text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where username = p_username;
  if target is null then raise exception 'unknown challenger'; end if;
  delete from public.friendships where a = least(uid, target) and b = greatest(uid, target);
end $$;

-- ============ quest completion ============
-- streak is always recounted from history so retro fills (yesterday) bridge gaps correctly
create or replace function public.recount_streak(p_uid uuid)
returns void
language plpgsql
as $$
declare
  last_day date;
  streak int := 0;
  d date;
begin
  select max(completed_on) into last_day from public.quest_completions where user_id = p_uid;
  if last_day is not null then
    d := last_day;
    loop
      exit when not exists (select 1 from public.quest_completions where user_id = p_uid and completed_on = d);
      streak := streak + 1; d := d - 1;
      exit when streak > 100000;
    end loop;
  end if;
  update public.profiles set
    streak_current = streak,
    last_completed_on = last_day,
    -- best streak is the true longest run of consecutive completion days in
    -- history, recomputed every time so checking then unchecking a task can no
    -- longer inflate it permanently
    streak_best = coalesce((
      select max(run_len) from (
        select count(*) as run_len
        from (
          select completed_on
                 - (row_number() over (order by completed_on))::int as grp
          from (select distinct completed_on from public.quest_completions where user_id = p_uid) dd
        ) g
        group by grp
      ) runs
    ), 0)
  where id = p_uid;
end $$;

-- ============ v7: 7-day cards (see migrations/2026-09-30-streak-cards.sql) ============
-- ---------- the card payout ----------
create or replace function public.card_xp(p_rated int, p_day int)
returns int language sql immutable set search_path = public as $$
  select greatest(1, round(
           greatest(1, round(p_rated * 0.6))
           * (array[1, 1.15, 1.3, 1.5, 1.75, 2, 2.5]::numeric[])[least(7, greatest(1, p_day))]
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
  delete from _streak_due where true; -- the API role rejects a DELETE with no WHERE
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
  select p_uid, 'streak_bonus', s.ref, 50, '7-day streak bonus' from _streak_due s
  on conflict (user_id, source, ref) do nothing;

  update public.profiles
     set xp = coalesce((select sum(xp_awarded) from public.quest_completions where user_id = p_uid), 0)
            + coalesce((select sum(xp) from public.xp_ledger where user_id = p_uid), 0)
   where id = p_uid;
end $$;
revoke all on function public.recalc_player(uuid) from public, anon, authenticated;
grant execute on function public.recalc_player(uuid) to service_role;

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

-- back-compat wrappers
create or replace function public.complete_quest(p_quest_id text)
returns jsonb
language sql security definer set search_path = public
as $$ select public.complete_quest_for(p_quest_id, public.app_today()) $$;

create or replace function public.uncomplete_quest(p_quest_id text)
returns jsonb
language sql security definer set search_path = public
as $$ select public.uncomplete_quest_for(p_quest_id, public.app_today()) $$;

-- ============ social ============
-- friends-only board: you and the challengers you added, nobody else
create or replace function public.get_leaderboard()
returns table (username text, archetype text, xp int, streak_current int, weekly_xp bigint, is_me boolean)
language sql stable security definer set search_path = public
as $$
  with circle as (
    select auth.uid() as pid
    union
    select case when f.a = auth.uid() then f.b else f.a end
    from public.friendships f
    where f.a = auth.uid() or f.b = auth.uid()
  )
  select p.username, p.archetype, p.xp, p.streak_current,
         coalesce(sum(c.xp_awarded) filter (where c.completed_on >= public.app_today() - 6), 0) as weekly_xp,
         p.id = auth.uid() as is_me
  from public.profiles p
  join circle on circle.pid = p.id
  left join public.quest_completions c on c.user_id = p.id
  where p.id = auth.uid() or p.share_activity
  group by p.id
  order by p.xp desc, weekly_xp desc
  limit 100
$$;

create or replace function public.get_member_count()
returns bigint
language sql stable security definer set search_path = public
as $$ select count(*) from public.profiles $$;

create or replace function public.set_username(p_name text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  clean := lower(regexp_replace(p_name, '[^a-zA-Z0-9_.]', '', 'g'));
  if length(clean) < 3 or length(clean) > 20 then raise exception 'username must be 3 to 20 characters'; end if;
  update public.profiles set username = clean where id = uid;
  return (select to_jsonb(pr) from public.profiles pr where pr.id = uid);
exception when unique_violation then
  raise exception 'username taken';
end $$;

grant execute on function public.app_today() to anon, authenticated;
grant execute on function public.get_member_count() to anon, authenticated;
grant execute on function public.complete_quest(text) to authenticated;
grant execute on function public.uncomplete_quest(text) to authenticated;
grant execute on function public.complete_quest_for(text, date) to authenticated;
grant execute on function public.uncomplete_quest_for(text, date) to authenticated;
grant execute on function public.get_leaderboard() to authenticated;
grant execute on function public.set_username(text) to authenticated;
grant execute on function public.create_custom_quest(text, text, int, text) to authenticated;
grant execute on function public.update_custom_quest(text, text, text, int, text) to authenticated;
grant execute on function public.delete_custom_quest(text) to authenticated;
grant execute on function public.set_quest_active(text, boolean) to authenticated;
grant execute on function public.set_archetype(text) to authenticated;
grant execute on function public.set_privacy(boolean) to authenticated;
grant execute on function public.add_friend(text) to authenticated;
grant execute on function public.remove_friend(text) to authenticated;
grant execute on function public.get_friend_profile(text) to authenticated;

-- ============ v3 backfill (idempotent) ============
update public.profiles set friend_code = public.gen_friend_code() where friend_code is null;

update public.profiles set archetype = 'warrior' where archetype in ('The Warrior');
update public.profiles set archetype = 'mentalist' where archetype in ('The Seeker');
update public.profiles set archetype = null
where archetype is not null and archetype not in ('warrior','mentalist','wizard','guardian','shadow');

-- stats are purely earned: recompute from completion history (+2 per linked stat per clear)
with earned as (
  select c.user_id, s.stat, count(*) * 2 as pts
  from public.quest_completions c
  join public.quests q on q.id = c.quest_id
  cross join lateral unnest(q.stats) as s(stat)
  group by c.user_id, s.stat
)
update public.profiles p set stats = coalesce(
  (select jsonb_object_agg(t.k, coalesce(e.pts, 0))
   from unnest(array['CON','FOC','DIS','STR','WIS']) as t(k)
   left join earned e on e.user_id = p.id and e.stat = t.k),
  '{"CON":0,"FOC":0,"DIS":0,"STR":0,"WIS":0}'::jsonb
);

-- ============ quest catalog seed ============
insert into public.quests (id, title, description, pillar, xp, stats, icon, benefits, sort) values
('drink-water',       'Drink water',            'Hit your daily water target.',                        'Constitution',  3, '{CON}', 'droplet',   '["+14% cognitive performance","+10% energy levels","+8% mental clarity"]', 1),
('sleep-7-9',         'Sleep 7 to 9 hours',     'Protect a full night of sleep.',                      'Constitution', 12, '{CON}', 'moon',      '["+20% cognitive function","+15% immune function","+18% energy levels"]', 2),
('read-books',        'Read 10 pages',          'Read from a real book, paper or ebook.',              'Wisdom',       12, '{WIS}', 'book',      '["Stronger memory","Lower cognitive decline risk","Calmer evenings"]', 3),
('workout',           'Train your body',        'Strength or cardio, at least 20 minutes.',            'Strength',     25, '{STR}', 'dumbbell',  '["More strength and stamina","Better mood","Higher daily energy"]', 4),
('morning-sunlight',  'Morning sunlight',       '10 minutes of daylight before noon.',                 'Constitution',  6, '{CON}', 'sun',       '["Better sleep at night","Steadier mood","Natural wake signal"]', 5),
('meditate',          'Meditate',               '10 minutes of stillness and breath.',                 'Focus',        14, '{FOC}', 'lotus',     '["-21% cortisol","-10% anxiety levels","+12% emotional resilience"]', 6),
('journal',           'Journal',                'Write what happened and how it felt.',                'Wisdom',        8, '{WIS}', 'pen',       '["+18% emotional clarity","+12% working memory","-15% stress levels"]', 7),
('cold-shower',       'Cold shower',            'End your shower cold for 60 seconds.',                'Discipline',   18, '{DIS}', 'snowflake', '["+250% dopamine","+8% circulation","+12% mental alertness"]', 8),
('social-media-limit','Social media limit',     'Stay under 30 minutes of scrolling today.',           'Discipline',   30, '{DIS}', 'phone-off', '["-25% depression","-16% anxiety","+10% attention span"]', 9),
('deep-work',         'Deep work block',        '50 minutes of focused work, no distractions.',        'Focus',        25, '{FOC}', 'target',    '["Real progress on what matters","Sharper focus","Momentum at work"]', 10),
('plan-tomorrow',     'Plan tomorrow',          'Write tomorrow''s top 3 before bed.',                 'Discipline',    5, '{DIS}', 'calendar',  '["Calmer mornings","Clear priorities","Less decision fatigue"]', 11),
('reach-out',         'Reach out',              'Message or call someone who matters to you.',         'Wisdom',        6, '{WIS}', 'users',     '["Stronger relationships","Feeling connected","Support when it counts"]', 12),
('learn-skill',       'Learn something',        '20 minutes on a skill or course.',                    'Wisdom',       12, '{WIS}', 'bulb',      '["Compounding knowledge","Career leverage","Confidence in your craft"]', 13),
('gratitude',         'Gratitude',              'Write 3 things you are grateful for.',                'Wisdom',        4, '{WIS}', 'sparkle',   '["Better baseline mood","Perspective under stress","Deeper sleep"]', 14),
('healthy-meal',      'Eat one clean meal',     'One meal with real food, protein and greens.',        'Constitution',  8, '{CON}', 'apple',     '["Steadier energy","Better body composition","Fewer crashes"]', 15),
('screens-off',       'Screens off before bed', 'No screens for the last 30 minutes of your day.',     'Discipline',   10, '{DIS}', 'screen-off','["Falling asleep faster","Deeper sleep","Calmer mind at night"]', 16)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  pillar = excluded.pillar,
  xp = excluded.xp,
  stats = excluded.stats,
  icon = excluded.icon,
  benefits = excluded.benefits,
  sort = excluded.sort;

-- ============ integrations (Google Tasks + Calendar) ============
create table if not exists public.integrations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  access_token text,
  refresh_token text,
  expiry timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  last_sync timestamptz,
  primary key (user_id, provider)
);
alter table public.integrations enable row level security;
-- no policies: only the service role (server) may read/write tokens

create table if not exists public.xp_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  ref text not null,
  xp int not null default 0,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, source, ref)
);
alter table public.xp_ledger enable row level security;
drop policy if exists xp_ledger_own on public.xp_ledger;
create policy xp_ledger_own on public.xp_ledger for select using (auth.uid() = user_id);

-- v6: ledger rows carry meta (e.g. the Google task list id)
alter table public.xp_ledger add column if not exists meta jsonb not null default '{}'::jsonb;
drop function if exists public.award_external_xp(uuid, text, text, int, text);
create or replace function public.award_external_xp(p_user uuid, p_source text, p_ref text, p_xp int, p_reason text, p_meta jsonb default null)
returns boolean language plpgsql security definer set search_path=public as $fn$
declare
  inserted boolean := false;
  amt int := greatest(0, least(coalesce(p_xp,0), 200));
begin
  begin
    insert into public.xp_ledger(user_id,source,ref,xp,reason,meta)
    values (p_user,p_source,p_ref,amt,p_reason,coalesce(p_meta,'{}'::jsonb));
    inserted := true;
  exception when unique_violation then inserted := false;
  end;
  if inserted and amt > 0 then
    update public.profiles set xp = xp + amt where id = p_user;
  end if;
  return inserted;
end
$fn$;
revoke all on function public.award_external_xp(uuid,text,text,int,text,jsonb) from public, anon, authenticated;
grant execute on function public.award_external_xp(uuid,text,text,int,text,jsonb) to service_role;

-- ============ v5: judge context ============
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

-- Unchecking a task or meeting takes its XP back. Removes the ledger row (so
-- checking it again can pay again) and returns how much was taken.
create or replace function public.revoke_external_xp(p_user uuid, p_source text, p_ref text)
returns int language plpgsql security definer set search_path=public as $fn$
declare
  amt int := 0;
begin
  delete from public.xp_ledger
   where user_id = p_user and source = p_source and ref = p_ref
  returning xp into amt;
  if coalesce(amt, 0) > 0 then
    update public.profiles set xp = greatest(0, xp - amt) where id = p_user;
  end if;
  return coalesce(amt, 0);
end
$fn$;
revoke all on function public.revoke_external_xp(uuid,text,text) from public, anon, authenticated;
grant execute on function public.revoke_external_xp(uuid,text,text) to service_role;

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

-- ============ v8: weekly / monthly quests, tracked-by-a-watch (see migrations/2026-09-30-periods-and-tracked.sql) ============
-- Weekly / monthly quests, and no double pay for what a watch already measures.
--
-- 1. quests.period: 'daily' (default, every existing quest) | 'weekly' | 'monthly'.
--    A weekly quest is checked once per week (Sunday to Saturday, the Israeli
--    week), a monthly one once per calendar month. The 7-step card counts
--    consecutive periods: 7 weeks in a row pays x2.5 like 7 days in a row.
--    The daily streak and its +50 bonus count daily quests only.
-- 2. quests.tracks: 'steps' | 'sleep' | 'workout' | null. When the player has a
--    connection that measures it (steps: Google Health; sleep and workouts:
--    Google Health or WHOOP), the quest cannot be created or checked by hand:
--    the watch pays for it. Disconnect and it is a normal quest again.
-- 3. recalc_player floors the total at 0 (connected apps may take XP away).

alter table public.quests add column if not exists period text not null default 'daily';
alter table public.quests add column if not exists tracks text;
alter table public.quests drop constraint if exists quests_period_check;
alter table public.quests add constraint quests_period_check check (period in ('daily', 'weekly', 'monthly'));
alter table public.quests drop constraint if exists quests_tracks_check;
alter table public.quests add constraint quests_tracks_check check (tracks is null or tracks in ('steps', 'sleep', 'workout'));

-- ---------- periods ----------
-- First day of the period containing d. Weeks start on Sunday.
create or replace function public.period_start(p_period text, d date)
returns date language sql immutable set search_path = public as $$
  select case p_period
    when 'weekly' then d - extract(dow from d)::int
    when 'monthly' then date_trunc('month', d)::date
    else d
  end
$$;

-- A running number per period, so consecutive periods differ by exactly 1.
create or replace function public.period_index(p_period text, d date)
returns int language sql immutable set search_path = public as $$
  select case p_period
    when 'weekly' then (public.period_start('weekly', d) - date '2000-01-02') / 7   -- 2000-01-02 was a Sunday
    when 'monthly' then extract(year from d)::int * 12 + extract(month from d)::int
    else d - date '2000-01-01'
  end
$$;

-- ---------- which connection measures what ----------
-- The provider (for the message) that already pays for this kind, or null.
create or replace function public.tracked_by(p_uid uuid, p_kind text)
returns text language sql stable security definer set search_path = public as $$
  select i.provider
  from public.integrations i
  where i.user_id = p_uid
    and p_kind is not null
    and i.provider = any (case p_kind
                            when 'steps' then array['ghealth']
                            when 'sleep' then array['ghealth', 'whoop']
                            when 'workout' then array['ghealth', 'whoop']
                            else array[]::text[] end)
  order by case i.provider when 'ghealth' then 0 else 1 end
  limit 1
$$;
revoke all on function public.tracked_by(uuid, text) from public, anon, authenticated;

-- The signed-in player's connected providers, so screens can mark tracked quests.
create or replace function public.my_trackers()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(provider order by provider), array[]::text[])
  from public.integrations where user_id = auth.uid()
$$;
revoke all on function public.my_trackers() from public, anon;
grant execute on function public.my_trackers() to authenticated;

create or replace function public.tracker_name(p_provider text)
returns text language sql immutable as $$
  select case p_provider when 'ghealth' then 'Google Health' when 'whoop' then 'WHOOP' else p_provider end
$$;

-- ---------- rebuild one player's XP from history ----------
-- The card runs over consecutive periods of each quest (days, weeks or months).
-- The streak bonus follows the daily streak. Total never drops below 0.
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

-- ---------- the daily streak counts daily quests only ----------
create or replace function public.recount_streak(p_uid uuid)
returns void language plpgsql set search_path = public as $$
declare last_day date; streak int := 0; d date;
begin
  create temp table if not exists _daily_days (day date primary key) on commit drop;
  delete from _daily_days where true;
  insert into _daily_days (day)
  select distinct qc.completed_on
  from public.quest_completions qc
  join public.quests q on q.id = qc.quest_id and q.period = 'daily'
  where qc.user_id = p_uid;

  select max(day) into last_day from _daily_days;
  if last_day is not null then
    d := last_day;
    loop
      exit when not exists (select 1 from _daily_days where day = d);
      streak := streak + 1; d := d - 1; exit when streak > 100000;
    end loop;
  end if;
  update public.profiles set
    streak_current = streak,
    last_completed_on = last_day,
    streak_best = coalesce((
      select max(run_len) from (
        select count(*) as run_len from (
          select day - (row_number() over (order by day))::int as grp from _daily_days
        ) g group by grp
      ) runs), 0)
  where id = p_uid;
end $$;

-- ---------- check ----------
create or replace function public.complete_quest_for(p_quest_id text, p_on date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := public.app_today();
  q record;
  pr record;
  inserted boolean := false;
  st text;
  new_stats jsonb;
  watch text;
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
  -- a connected watch already pays for this: no second payout by hand
  watch := public.tracked_by(uid, q.tracks);
  if watch is not null then
    raise exception 'tracked by %: it pays for this automatically', public.tracker_name(watch);
  end if;
  -- weekly and monthly quests count once per period
  if q.period <> 'daily' and exists (
    select 1 from public.quest_completions c
    where c.user_id = uid and c.quest_id = p_quest_id
      and public.period_start(q.period, c.completed_on) = public.period_start(q.period, p_on)
  ) then
    return (select to_jsonb(pr2) from public.profiles pr2 where pr2.id = uid);
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

-- ---------- uncheck ----------
-- For weekly / monthly quests p_on names the period: the check made anywhere in
-- that week or month is removed.
create or replace function public.uncomplete_quest_for(p_quest_id text, p_on date)
returns jsonb language plpgsql security definer set search_path = public as $$
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
  where user_id = uid and quest_id = p_quest_id
    and public.period_start(q.period, completed_on) = public.period_start(q.period, p_on)
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

-- ---------- create / edit custom quests ----------
-- Rated value caps grow with the period: a week's effort is judged as a week.
create or replace function public.period_xp_cap(p_period text)
returns int language sql immutable as $$
  select case p_period when 'weekly' then 100 when 'monthly' then 200 else 60 end
$$;

drop function if exists public.create_custom_quest(text, text, int, text);
create or replace function public.create_custom_quest(
  p_title text, p_pillar text, p_xp int, p_icon text default 'custom',
  p_period text default 'daily', p_tracks text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean_title text;
  new_id text;
  v_period text := coalesce(p_period, 'daily');
  watch text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  clean_title := trim(coalesce(p_title, ''));
  if length(clean_title) < 2 or length(clean_title) > 60 then
    raise exception 'title must be 2 to 60 characters';
  end if;
  if p_pillar not in ('Strength','Focus','Constitution','Discipline','Wisdom',
                      'Body','Mind','Rest','Fuel','Connection','Purpose') then
    raise exception 'unknown category';
  end if;
  if v_period not in ('daily', 'weekly', 'monthly') then raise exception 'unknown period'; end if;
  if p_xp < 1 or p_xp > public.period_xp_cap(v_period) then
    raise exception 'xp must be between 1 and %', public.period_xp_cap(v_period);
  end if;
  if p_tracks is not null and p_tracks not in ('steps', 'sleep', 'workout') then
    raise exception 'unknown tracked kind';
  end if;
  watch := public.tracked_by(uid, p_tracks);
  if watch is not null then
    raise exception 'tracked by %: it already pays for this automatically', public.tracker_name(watch);
  end if;
  if (select count(*) from public.quests where user_id = uid and not archived) >= 30 then
    raise exception 'custom quest limit reached';
  end if;

  new_id := 'c-' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
  insert into public.quests (id, title, description, pillar, xp, stats, icon, benefits, sort, user_id, period, tracks)
  values (new_id, clean_title, '', p_pillar, p_xp, public.quest_stats_for_pillar(p_pillar),
          case when public.quest_icon_ok(p_icon) then p_icon else 'custom' end,
          '[]'::jsonb, 1000, uid, v_period, p_tracks);

  insert into public.user_quests (user_id, quest_id) values (uid, new_id)
  on conflict do nothing;

  return (select to_jsonb(q) from public.quests q where q.id = new_id);
end $$;
revoke all on function public.create_custom_quest(text, text, int, text, text, text) from public, anon;
grant execute on function public.create_custom_quest(text, text, int, text, text, text) to authenticated;

-- Editing keeps the period (changing it would re-price history); the Judge's
-- tracked verdict is refreshed with the new title.
drop function if exists public.update_custom_quest(text, text, text, int, text);
create or replace function public.update_custom_quest(
  p_id text, p_title text, p_pillar text, p_xp int, p_icon text default null, p_tracks text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  clean_title text;
  q record;
  watch text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into q from public.quests where id = p_id and user_id = uid;
  if not found then raise exception 'quest not found or not yours'; end if;
  clean_title := trim(coalesce(p_title, ''));
  if length(clean_title) < 2 or length(clean_title) > 60 then
    raise exception 'title must be 2 to 60 characters';
  end if;
  if p_pillar not in ('Strength','Focus','Constitution','Discipline','Wisdom',
                      'Body','Mind','Rest','Fuel','Connection','Purpose') then
    raise exception 'unknown category';
  end if;
  if p_xp < 1 or p_xp > public.period_xp_cap(q.period) then
    raise exception 'xp must be between 1 and %', public.period_xp_cap(q.period);
  end if;
  if p_tracks is not null and p_tracks not in ('steps', 'sleep', 'workout') then
    raise exception 'unknown tracked kind';
  end if;
  watch := public.tracked_by(uid, p_tracks);
  if watch is not null then
    raise exception 'tracked by %: it already pays for this automatically', public.tracker_name(watch);
  end if;

  update public.quests set
    title = clean_title,
    pillar = p_pillar,
    xp = p_xp,
    tracks = p_tracks,
    stats = public.quest_stats_for_pillar(p_pillar),
    icon = case when p_icon is not null and public.quest_icon_ok(p_icon) then p_icon else icon end
  where id = p_id and user_id = uid;

  return (select to_jsonb(q2) from public.quests q2 where q2.id = p_id);
end $$;
revoke all on function public.update_custom_quest(text, text, text, int, text, text) from public, anon;
grant execute on function public.update_custom_quest(text, text, text, int, text, text) to authenticated;

-- ---------- the Judge compares like with like ----------
create or replace function public.peer_quests()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select distinct q.title, q.xp, q.pillar, q.period
    from public.friendships f
    join public.user_quests uq
      on uq.user_id = case when f.a = auth.uid() then f.b else f.a end
     and uq.active
    join public.quests q on q.id = uq.quest_id and not q.archived
    where (f.a = auth.uid() or f.b = auth.uid())
    limit 80
  ) t
$$;

-- ---------- friend profile: done this period ----------
create or replace function public.get_friend_profile(p_username text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
    'quests', quest_list
  );
end $$;

-- ---------- tag what a watch already measures ----------
update public.quests set tracks = 'sleep'   where id = 'sleep-7-9' and tracks is null;
update public.quests set tracks = 'workout' where id = 'workout' and tracks is null;
update public.quests set tracks = 'steps'   where id in ('c-899895481a', 'c-55eb4ab95e') and tracks is null;  -- "10k steps", "30 minutes walk"
update public.quests set tracks = 'workout' where id = 'c-3f40ec5138' and tracks is null;                  -- "Daily workout"
