-- Five categories replace the six pillars: every quest now feeds exactly one stat.
-- Safe to run while the old app version is still live: the functions here accept
-- BOTH old and new category names, so nothing breaks during the deploy window.
-- Run this in the Supabase SQL Editor (project etlumfjimkjjdmhimzwr), then deploy the app.

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
  if p_pillar not in ('Strength','Focus','Constitution','Discipline','Wisdom',
                      'Body','Mind','Rest','Fuel','Connection','Purpose') then
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
  if p_pillar not in ('Strength','Focus','Constitution','Discipline','Wisdom',
                      'Body','Mind','Rest','Fuel','Connection','Purpose') then
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

-- reseed the 16 catalog quests with their new category and single stat
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

-- move everyone's custom quests onto the new categories
update public.quests set pillar = case pillar
    when 'Body' then 'Strength'
    when 'Mind' then 'Focus'
    when 'Rest' then 'Constitution'
    when 'Fuel' then 'Constitution'
    when 'Connection' then 'Wisdom'
    when 'Purpose' then 'Discipline'
    else pillar end
  where user_id is not null and pillar in ('Body','Mind','Rest','Fuel','Connection','Purpose');
update public.quests set stats = public.quest_stats_for_pillar(pillar) where user_id is not null;

-- sanity check: should list only the 5 new categories
select pillar, count(*) as quests from public.quests group by pillar order by pillar;
