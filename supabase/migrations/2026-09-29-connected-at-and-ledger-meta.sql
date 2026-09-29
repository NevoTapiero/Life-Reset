-- Integrations only count activity from the moment they were connected.
-- Existing connections start counting from now; everything already paid stays.
alter table public.integrations add column if not exists connected_at timestamptz;
update public.integrations set connected_at = now() where connected_at is null;
alter table public.integrations alter column connected_at set default now();
alter table public.integrations alter column connected_at set not null;

-- A paid item keeps what the app needs to act on it later (e.g. the Google task
-- list id for unchecking), so it survives the task being deleted in Google.
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
