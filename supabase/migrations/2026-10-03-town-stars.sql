-- ============ town stars ============
-- Own towns (Clash of Clans style, 2 Oct): visiting a friend's town you can leave them a star, once a day.
-- They see who left one the next time they're home (collect_stars), and their town shows its total.
-- Friends only.

create table if not exists public.town_stars (
  giver uuid not null references public.profiles(id) on delete cascade,
  host uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (giver, host, day),
  check (giver <> host)
);
create index if not exists town_stars_host on public.town_stars (host);
alter table public.town_stars enable row level security;
-- no policies: read and written only through the functions below

-- leave a star in a friend's town (once a day; again the same day does nothing); returns their total
create or replace function public.leave_star(p_host text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where username = p_host;
  if target is null then raise exception 'unknown player'; end if;
  if target = uid then raise exception 'that is your own town'; end if;
  if not exists (select 1 from public.friendships where a = least(uid, target) and b = greatest(uid, target)) then
    raise exception 'not on your friends list';
  end if;
  insert into public.town_stars (giver, host) values (uid, target) on conflict do nothing;
  return (select count(*)::int from public.town_stars where host = target);
end $$;

-- a town's stars: its total, and whether you've left one there today (yours, or a friend's)
create or replace function public.town_stars(p_host text)
returns table (total int, mine_today boolean)
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where username = p_host;
  if target is null then raise exception 'unknown player'; end if;
  if target <> uid and not exists (select 1 from public.friendships where a = least(uid, target) and b = greatest(uid, target)) then
    raise exception 'not on your friends list';
  end if;
  return query
    select (select count(*)::int from public.town_stars s where s.host = target),
           exists (select 1 from public.town_stars s where s.host = target and s.giver = uid and s.day = current_date);
end $$;

-- the stars left in your town since you last looked, by who left them (and now they're seen)
create or replace function public.collect_stars()
returns table (username text, stars int)
language sql volatile security definer set search_path = public
as $$
  with fresh as (
    update public.town_stars set seen = true
    where host = auth.uid() and not seen
    returning giver
  )
  select p.username, count(*)::int
  from fresh f join public.profiles p on p.id = f.giver
  group by p.username
  order by count(*) desc, p.username
$$;

grant execute on function public.leave_star(text) to authenticated;
grant execute on function public.town_stars(text) to authenticated;
grant execute on function public.collect_stars() to authenticated;
