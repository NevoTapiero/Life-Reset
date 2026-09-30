-- ============ unfriending closes the door ============
-- House visits are for friends only, but a yes from answer_knock used to
-- outlive the friendship. Now remove_friend also drops every knock and
-- permission between the two, my_visits only lists current friends, and
-- rows left from past unfriendings are cleaned up once.
-- Needs 2026-09-30-house-visits.sql first. Safe to run more than once.

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
  delete from public.house_visits
  where (visitor = uid and host = target) or (visitor = target and host = uid);
end $$;

-- every knock that involves you and a current friend
create or replace function public.my_visits()
returns table (username text, knocked_by_me boolean, allowed boolean)
language sql stable security definer set search_path = public
as $$
  select p.username, v.visitor = auth.uid(), v.allowed
  from public.house_visits v
  join public.profiles p on p.id = case when v.visitor = auth.uid() then v.host else v.visitor end
  where (v.visitor = auth.uid() or v.host = auth.uid())
    and exists (select 1 from public.friendships f
                where f.a = least(v.visitor, v.host) and f.b = greatest(v.visitor, v.host))
$$;

-- one time: drop visits between people who are no longer friends
delete from public.house_visits v
where not exists (select 1 from public.friendships f
                  where f.a = least(v.visitor, v.host) and f.b = greatest(v.visitor, v.host));

grant execute on function public.remove_friend(text) to authenticated;
grant execute on function public.my_visits() to authenticated;
