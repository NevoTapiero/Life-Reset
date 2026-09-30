-- ============ the shop: spend gold on furniture ============
-- Gold comes from 2026-09-30-unclaimed-rewards.sql; the column is created here
-- too, so the two can be applied in either order.
--
-- shop_items is the catalogue and its prices (the app draws each item; the
-- id matches DECOR in src/lib/legoWorld.ts). owned_items is what you've
-- bought. buy_item() is the only way in: it checks the price against your
-- gold on the server, takes the gold and hands you the item, all at once.

alter table public.profiles add column if not exists gold int not null default 0;

create table if not exists public.shop_items (
  id text primary key,
  name text not null,
  price int not null check (price >= 0),
  sort int not null default 0
);
alter table public.shop_items enable row level security;
drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select to authenticated using (true);

insert into public.shop_items (id, name, price, sort) values
  ('floor-lamp',   'Floor lamp',    50, 1),
  ('coffee-table', 'Coffee table',  60, 2),
  ('cat',          'Cat',           80, 3),
  ('indoor-trees', 'Indoor trees', 100, 4),
  ('sofa',         'Sofa',         150, 5),
  ('tv',           'TV',           200, 6),
  ('aquarium',     'Aquarium',     250, 7),
  ('trophy',       'Trophy',       300, 8)
on conflict (id) do update set name = excluded.name, price = excluded.price, sort = excluded.sort;

create table if not exists public.owned_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  bought_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.owned_items enable row level security;
drop policy if exists owned_items_own on public.owned_items;
create policy owned_items_own on public.owned_items for select using (auth.uid() = user_id);

-- buy one item: returns your gold after paying
create or replace function public.buy_item(p_item text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cost int;
  left_ int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select price into cost from public.shop_items where id = p_item;
  if cost is null then raise exception 'no such item'; end if;
  if exists (select 1 from public.owned_items where user_id = uid and item_id = p_item) then
    raise exception 'you already have that';
  end if;
  update public.profiles set gold = gold - cost where id = uid and gold >= cost returning gold into left_;
  if left_ is null then raise exception 'not enough gold'; end if;
  insert into public.owned_items (user_id, item_id) values (uid, p_item);
  return left_;
end $$;
grant execute on function public.buy_item(text) to authenticated;
