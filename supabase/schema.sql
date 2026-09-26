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
  focus_areas text[] not null default '{}',
  intensity text,
  onboarding jsonb not null default '{}'::jsonb,
  onboarding_completed_at timestamptz,
  plan_started_on date,
  streak_commitment int not null default 14,
  xp int not null default 0,
  streak_current int not null default 0,
  streak_best int not null default 0,
  last_completed_on date,
  stats jsonb not null default '{"CON":50,"FOC":50,"DIS":50,"STR":50,"WIS":50}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quests (
  id text primary key,
  title text not null,
  description text not null default '',
  pillar text not null,
  xp int not null default 10,
  stats text[] not null default '{}',
  icon text not null default '*',
  benefits jsonb not null default '[]'::jsonb,
  sort int not null default 0
);

create table if not exists public.user_quests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null references public.quests(id) on delete cascade,
  active boolean not null default true,
  added_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);

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

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);

drop policy if exists "quests_read_all" on public.quests;
create policy "quests_read_all" on public.quests for select using (true);

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
  insert into public.profiles (id, username) values (new.id, candidate)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ onboarding ============
create or replace function public.complete_onboarding(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s jsonb;
  fa text[];
  qids text[];
begin
  if uid is null then raise exception 'not authenticated'; end if;

  s := coalesce(p->'baseline_stats', '{}'::jsonb);
  s := jsonb_build_object(
    'CON', least(90, greatest(30, coalesce((s->>'CON')::int, 50))),
    'FOC', least(90, greatest(30, coalesce((s->>'FOC')::int, 50))),
    'DIS', least(90, greatest(30, coalesce((s->>'DIS')::int, 50))),
    'STR', least(90, greatest(30, coalesce((s->>'STR')::int, 50))),
    'WIS', least(90, greatest(30, coalesce((s->>'WIS')::int, 50)))
  );

  fa := coalesce((select array_agg(x) from jsonb_array_elements_text(p->'focus_areas') as t(x)), '{}');

  update public.profiles set
    onboarding = p,
    archetype = coalesce(p->>'archetype', archetype),
    focus_areas = fa,
    intensity = coalesce(p->>'intensity', intensity),
    streak_commitment = coalesce((p->>'streak_commitment')::int, streak_commitment),
    stats = case when onboarding_completed_at is null then s else stats end,
    plan_started_on = coalesce(plan_started_on, public.app_today()),
    onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = uid;

  qids := array['drink-water','sleep-7-9','read-books'];
  if 'health' = any(fa) then qids := qids || array['workout','morning-sunlight','healthy-meal']; end if;
  if 'mental' = any(fa) then qids := qids || array['meditate','journal']; end if;
  if 'career' = any(fa) then qids := qids || array['deep-work','plan-tomorrow']; end if;
  if 'discipline' = any(fa) then qids := qids || array['cold-shower','social-media-limit']; end if;
  if 'relationships' = any(fa) then qids := qids || array['reach-out']; end if;
  if 'education' = any(fa) then qids := qids || array['learn-skill']; end if;
  if 'spiritual' = any(fa) then qids := qids || array['gratitude']; end if;
  if 'rebuild' = any(fa) then qids := qids || array['journal','plan-tomorrow','gratitude']; end if;
  if array_length(qids, 1) < 6 then qids := qids || array['screens-off','social-media-limit']; end if;

  insert into public.user_quests (user_id, quest_id)
  select distinct uid, q from unnest(qids) as q
  where exists (select 1 from public.quests where id = q)
  on conflict do nothing;

  return (select to_jsonb(pr) from public.profiles pr where pr.id = uid);
end $$;

-- ============ quest completion ============
create or replace function public.complete_quest(p_quest_id text)
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
  new_streak int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into q from public.quests where id = p_quest_id;
  if not found then raise exception 'unknown quest'; end if;
  if not exists (select 1 from public.user_quests where user_id = uid and quest_id = p_quest_id and active) then
    raise exception 'quest not active for user';
  end if;

  begin
    insert into public.quest_completions (user_id, quest_id, completed_on, xp_awarded)
    values (uid, p_quest_id, today, q.xp);
    inserted := true;
  exception when unique_violation then
    inserted := false;
  end;

  if inserted then
    select * into pr from public.profiles where id = uid for update;
    new_stats := pr.stats;
    foreach st in array q.stats loop
      new_stats := jsonb_set(new_stats, array[st], to_jsonb(coalesce((new_stats->>st)::int, 50) + 2));
    end loop;
    new_streak := case
      when pr.last_completed_on = today then pr.streak_current
      when pr.last_completed_on = today - 1 then pr.streak_current + 1
      else 1 end;
    update public.profiles set
      xp = pr.xp + q.xp,
      stats = new_stats,
      streak_current = new_streak,
      streak_best = greatest(pr.streak_best, new_streak),
      last_completed_on = today
    where id = uid;
  end if;

  return (select to_jsonb(pr2) from public.profiles pr2 where pr2.id = uid);
end $$;

create or replace function public.uncomplete_quest(p_quest_id text)
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
  last_day date;
  streak int := 0;
  d date;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into q from public.quests where id = p_quest_id;
  if not found then raise exception 'unknown quest'; end if;

  delete from public.quest_completions
  where user_id = uid and quest_id = p_quest_id and completed_on = today
  returning * into removed;

  if removed.id is not null then
    select * into pr from public.profiles where id = uid for update;
    new_stats := pr.stats;
    foreach st in array q.stats loop
      new_stats := jsonb_set(new_stats, array[st], to_jsonb(greatest(0, coalesce((new_stats->>st)::int, 50) - 2)));
    end loop;
    select max(completed_on) into last_day from public.quest_completions where user_id = uid;
    if last_day is not null then
      streak := 0; d := last_day;
      loop
        exit when not exists (select 1 from public.quest_completions where user_id = uid and completed_on = d);
        streak := streak + 1; d := d - 1;
        exit when streak > 400;
      end loop;
    end if;
    update public.profiles set
      xp = greatest(0, pr.xp - removed.xp_awarded),
      stats = new_stats,
      last_completed_on = last_day,
      streak_current = streak
    where id = uid;
  end if;

  return (select to_jsonb(pr2) from public.profiles pr2 where pr2.id = uid);
end $$;

-- ============ social ============
create or replace function public.get_leaderboard()
returns table (username text, archetype text, xp int, streak_current int, weekly_xp bigint, is_me boolean)
language sql stable security definer set search_path = public
as $$
  select p.username, p.archetype, p.xp, p.streak_current,
         coalesce(sum(c.xp_awarded) filter (where c.completed_on >= date_trunc('week', public.app_today()::timestamp)::date), 0) as weekly_xp,
         p.id = auth.uid() as is_me
  from public.profiles p
  left join public.quest_completions c on c.user_id = p.id
  group by p.id
  order by weekly_xp desc, p.xp desc
  limit 50
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
grant execute on function public.complete_onboarding(jsonb) to authenticated;
grant execute on function public.complete_quest(text) to authenticated;
grant execute on function public.uncomplete_quest(text) to authenticated;
grant execute on function public.get_leaderboard() to authenticated;
grant execute on function public.set_username(text) to authenticated;

-- ============ quest catalog seed ============
insert into public.quests (id, title, description, pillar, xp, stats, icon, benefits, sort) values
('drink-water',       'Drink water',            'Hit your daily water target.',                        'Fuel',       10, '{CON,STR}', '💧', '["+14% cognitive performance","+10% energy levels","+8% mental clarity"]', 1),
('sleep-7-9',         'Sleep 7 to 9 hours',     'Protect a full night of sleep.',                      'Rest',       15, '{FOC,DIS}', '😴', '["+20% cognitive function","+15% immune function","+18% energy levels"]', 2),
('read-books',        'Read 10 pages',          'Read from a real book, paper or ebook.',              'Mind',       15, '{WIS,FOC}', '📖', '["Stronger memory","Lower cognitive decline risk","Calmer evenings"]', 3),
('workout',           'Train your body',        'Strength or cardio, at least 20 minutes.',            'Body',       20, '{STR,CON}', '🏋️', '["More strength and stamina","Better mood","Higher daily energy"]', 4),
('morning-sunlight',  'Morning sunlight',       '10 minutes of daylight before noon.',                 'Body',       10, '{CON}',     '☀️', '["Better sleep at night","Steadier mood","Natural wake signal"]', 5),
('meditate',          'Meditate',               '10 minutes of stillness and breath.',                 'Mind',       15, '{FOC,WIS}', '🧘', '["-21% cortisol","-10% anxiety levels","+12% emotional resilience"]', 6),
('journal',           'Journal',                'Write what happened and how it felt.',                'Mind',       10, '{WIS}',     '✍️', '["+18% emotional clarity","+12% working memory","-15% stress levels"]', 7),
('cold-shower',       'Cold shower',            'End your shower cold for 60 seconds.',                'Body',       15, '{DIS,CON}', '🥶', '["+250% dopamine","+8% circulation","+12% mental alertness"]', 8),
('social-media-limit','Social media limit',     'Stay under 30 minutes of scrolling today.',           'Mind',       15, '{DIS,FOC}', '📵', '["-25% depression","-16% anxiety","+10% attention span"]', 9),
('deep-work',         'Deep work block',        '50 minutes of focused work, no distractions.',        'Purpose',    20, '{FOC,DIS}', '🎯', '["Real progress on what matters","Sharper focus","Momentum at work"]', 10),
('plan-tomorrow',     'Plan tomorrow',          'Write tomorrow''s top 3 before bed.',                 'Purpose',    10, '{DIS,WIS}', '🗓️', '["Calmer mornings","Clear priorities","Less decision fatigue"]', 11),
('reach-out',         'Reach out',              'Message or call someone who matters to you.',         'Connection', 10, '{WIS}',     '🤝', '["Stronger relationships","Feeling connected","Support when it counts"]', 12),
('learn-skill',       'Learn something',        '20 minutes on a skill or course.',                    'Mind',       15, '{WIS,FOC}', '🧠', '["Compounding knowledge","Career leverage","Confidence in your craft"]', 13),
('gratitude',         'Gratitude',              'Write 3 things you are grateful for.',                'Purpose',    10, '{WIS}',     '🙏', '["Better baseline mood","Perspective under stress","Deeper sleep"]', 14),
('healthy-meal',      'Eat one clean meal',     'One meal with real food, protein and greens.',        'Fuel',       10, '{CON,STR}', '🥗', '["Steadier energy","Better body composition","Fewer crashes"]', 15),
('screens-off',       'Screens off before bed', 'No screens for the last 30 minutes of your day.',     'Rest',       10, '{DIS}',     '🌙', '["Falling asleep faster","Deeper sleep","Calmer mind at night"]', 16)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  pillar = excluded.pillar,
  xp = excluded.xp,
  stats = excluded.stats,
  icon = excluded.icon,
  benefits = excluded.benefits,
  sort = excluded.sort;
