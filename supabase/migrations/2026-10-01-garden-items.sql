-- ============ the garden shop: buy, place on your plot, it builds ============
-- shop_items gains a `spot`: 'room' furniture (one of each, its own place in
-- the room) or 'garden' things (as many as you like, put where you like on
-- your plot). owned_items rows get their own id and a place (x, z in studs,
-- 0..47 from the plot's back-left; quarter turns); null x = bought, not placed
-- yet. Needs 2026-09-30-shop.sql first. Safe to run more than once.

alter table public.shop_items add column if not exists spot text not null default 'room';
alter table public.shop_items drop constraint if exists shop_items_spot_check;
alter table public.shop_items add constraint shop_items_spot_check check (spot in ('room', 'garden'));

insert into public.shop_items (id, name, price, sort, spot) values
  ('g-pot',     'Flower pot',      30, 20, 'garden'),
  ('g-flowers', 'Flower bed',      40, 21, 'garden'),
  ('g-pine',    'Pine tree',       60, 22, 'garden'),
  ('g-bench',   'Bench',           60, 23, 'garden'),
  ('g-planter', 'Planter',         70, 24, 'garden'),
  ('g-tree',    'Apple tree',      80, 25, 'garden'),
  ('g-lamp',    'Lamp post',      120, 26, 'garden'),
  ('g-pond',    'Pond',           250, 27, 'garden'),
  ('g-cart',    'Ice cream cart', 300, 28, 'garden'),
  ('g-burger',  'Burger stand',   400, 29, 'garden')
on conflict (id) do nothing;

alter table public.owned_items add column if not exists id bigint generated always as identity;
alter table public.owned_items add column if not exists x int;
alter table public.owned_items add column if not exists z int;
alter table public.owned_items add column if not exists turn int not null default 0;
alter table public.owned_items drop constraint if exists owned_items_pkey;
alter table public.owned_items add constraint owned_items_pkey primary key (id);
alter table public.owned_items drop constraint if exists owned_items_place_check;
alter table public.owned_items add constraint owned_items_place_check
  check ((x is null and z is null) or (x between 0 and 47 and z between 0 and 47 and turn between 0 and 3));

-- buying: room furniture once; garden things as often as you like
create or replace function public.buy_item(p_item text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cost int;
  where_ text;
  left_ int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price, spot into cost, where_ from public.shop_items where id = p_item;
  if cost is null then raise exception 'no such item'; end if;
  if where_ = 'room' and exists (select 1 from public.owned_items where user_id = uid and item_id = p_item) then
    raise exception 'you already have that';
  end if;
  update public.profiles set gold = gold - cost where id = uid and gold >= cost returning gold into left_;
  if left_ is null then raise exception 'not enough gold'; end if;
  insert into public.owned_items (user_id, item_id) values (uid, p_item);
  return left_;
end $$;
grant execute on function public.buy_item(text) to authenticated;

-- placing: the oldest of your unplaced copies of the item goes here (or the
-- one at p_from_x/z moves, when given); returns the row's id
create or replace function public.place_item(p_item text, p_x int, p_z int, p_turn int, p_from_x int default null, p_from_z int default null)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row_ bigint;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_x not between 0 and 47 or p_z not between 0 and 47 or p_turn not between 0 and 3 then raise exception 'not on the plot'; end if;
  if not exists (select 1 from public.shop_items where id = p_item and spot = 'garden') then raise exception 'not a garden thing'; end if;
  if p_from_x is null then
    select id into row_ from public.owned_items where user_id = uid and item_id = p_item and x is null order by bought_at, id limit 1;
    if row_ is null then raise exception 'nothing to place'; end if;
  else
    select id into row_ from public.owned_items where user_id = uid and item_id = p_item and x = p_from_x and z = p_from_z limit 1;
    if row_ is null then raise exception 'nothing there'; end if;
  end if;
  update public.owned_items set x = p_x, z = p_z, turn = p_turn where id = row_;
  return row_;
end $$;
grant execute on function public.place_item(text, int, int, int, int, int) to authenticated;
