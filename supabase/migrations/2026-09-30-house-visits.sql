-- ============ house visits ============
-- In the town you can knock on a friend's door; they let you in (or not).
-- Once let in you can go inside their house whenever you like, until they
-- take it back (answer_knock with false). Friends only.
-- ponytail: permission is permanent once given; add expiry if hosts want one-off visits

create table if not exists public.house_visits (
  visitor uuid not null references public.profiles(id) on delete cascade,
  host uuid not null references public.profiles(id) on delete cascade,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (visitor, host),
  check (visitor <> host)
);
alter table public.house_visits enable row level security;
-- no policies: read and written only through the functions below

-- knock on a friend's door (does nothing if you're already let in)
create or replace function public.knock(p_host text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where username = p_host;
  if target is null then raise exception 'unknown challenger'; end if;
  if target = uid then raise exception 'that is your own house'; end if;
  if not exists (select 1 from public.friendships where a = least(uid, target) and b = greatest(uid, target)) then
    raise exception 'not on your friends list';
  end if;
  insert into public.house_visits (visitor, host) values (uid, target) on conflict do nothing;
end $$;

-- the host answers: let them in, or turn them away (also takes back a past yes)
create or replace function public.answer_knock(p_visitor text, p_allow boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into target from public.profiles where username = p_visitor;
  if target is null then raise exception 'unknown challenger'; end if;
  if p_allow then
    update public.house_visits set allowed = true where visitor = target and host = uid;
  else
    delete from public.house_visits where visitor = target and host = uid;
  end if;
end $$;

-- every knock that involves you: doors you knocked on, and people at your door
create or replace function public.my_visits()
returns table (username text, knocked_by_me boolean, allowed boolean)
language sql stable security definer set search_path = public
as $$
  select p.username, v.visitor = auth.uid(), v.allowed
  from public.house_visits v
  join public.profiles p on p.id = case when v.visitor = auth.uid() then v.host else v.visitor end
  where v.visitor = auth.uid() or v.host = auth.uid()
$$;

grant execute on function public.knock(text) to authenticated;
grant execute on function public.answer_knock(text, boolean) to authenticated;
grant execute on function public.my_visits() to authenticated;
