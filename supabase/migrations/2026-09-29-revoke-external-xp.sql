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
