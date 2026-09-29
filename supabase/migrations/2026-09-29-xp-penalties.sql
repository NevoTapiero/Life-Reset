-- Real feedback: connected apps can now take XP away, not only give it. A short
-- night or a red recovery lands in the ledger as a negative row and shows up on
-- Today next to the gains, with its reason. Total XP never drops below zero.
create or replace function public.award_external_xp(p_user uuid, p_source text, p_ref text, p_xp int, p_reason text)
returns boolean language plpgsql security definer set search_path=public as $fn$
declare
  inserted boolean := false;
  amt int := greatest(-200, least(coalesce(p_xp,0), 200));
begin
  begin
    insert into public.xp_ledger(user_id,source,ref,xp,reason) values (p_user,p_source,p_ref,amt,p_reason);
    inserted := true;
  exception when unique_violation then inserted := false;
  end;
  if inserted and amt <> 0 then
    update public.profiles set xp = greatest(0, xp + amt) where id = p_user;
  end if;
  return inserted;
end
$fn$;
revoke all on function public.award_external_xp(uuid,text,text,int,text) from public, anon, authenticated;
grant execute on function public.award_external_xp(uuid,text,text,int,text) to service_role;
