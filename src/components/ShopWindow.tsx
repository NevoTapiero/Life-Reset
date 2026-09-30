"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import LegoIcon, { type BrickColor } from "@/components/LegoIcon";

// The shop window on World: what the town shop sells, what you own, what your
// gold can buy now and how much more you need for the next thing. Buying
// happens in the 3D world (the shop and your garden are there).

type Item = { id: string; name: string; price: number; sort: number };
const COLORS: BrickColor[] = ["orange", "azure", "green", "red", "purple", "blue", "yellow"];

export default function ShopWindow({ gold }: { gold: number }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [owned, setOwned] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const [{ data: shop, error }, { data: mine }] = await Promise.all([
        supabase.from("shop_items").select("id, name, price, sort").order("sort"),
        uid ? supabase.from("owned_items").select("item_id").eq("user_id", uid) : Promise.resolve({ data: [] }),
      ]);
      if (error) return; // the shop isn't set up on this database
      setItems((shop as Item[]) ?? []);
      setOwned(new Set(((mine ?? []) as { item_id: string }[]).map((o) => o.item_id)));
    })();
  }, []);

  if (!items || items.length === 0) return null;
  const forSale = items.filter((i) => !owned.has(i.id));
  const next = forSale.filter((i) => i.price > gold).sort((a, b) => a.price - b.price)[0];
  const canBuy = forSale.filter((i) => i.price <= gold).length;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <span className="display text-[18px]">Town shop</span>
        <span className="stud-counter !text-[14px]" aria-label={`${gold} gold`}>
          <span className="stud-spin" aria-hidden />
          {gold.toLocaleString()}
        </span>
      </div>
      <p className="text-[13px] font-bold text-muted mt-1">
        {canBuy > 0
          ? `You can buy ${canBuy} ${canBuy === 1 ? "thing" : "things"} right now.`
          : next
            ? `${(next.price - gold).toLocaleString()} more gold for the ${next.name.toLowerCase()}.`
            : "You own everything in the shop."}
      </p>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 mt-3 pb-1">
        {items.map((it, i) => {
          const have = owned.has(it.id);
          const afford = !have && it.price <= gold;
          return (
            <Link
              key={it.id}
              href="/app/town"
              className={`flex-none w-[104px] rounded-[14px] p-2.5 flex flex-col items-center gap-1.5 text-center ${afford ? "shop-tile afford" : "shop-tile"}`}
            >
              <LegoIcon name="sparkle" color={have ? "grey" : COLORS[i % COLORS.length]} size={40} />
              <span className="text-[12.5px] font-extrabold leading-tight line-clamp-2 min-h-[32px]">{it.name}</span>
              {have ? (
                <span className="chip chip-green !text-[11px] !py-0">
                  <Icon name="check" size={11} strokeWidth={3} />
                  Yours
                </span>
              ) : (
                <span className={`chip !text-[11px] !py-0 ${afford ? "chip-yellow" : ""}`}>{it.price} gold</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
