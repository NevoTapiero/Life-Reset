"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import LegoIcon, { PILLAR_BRICK_COLOR } from "@/components/LegoIcon";
import Minifig from "@/components/Minifig";
import { legoLevel } from "@/lib/brick";
import { PILLAR_ICONS, rankForXp } from "@/lib/game";

// Town news: what each friend built today, from their friend page (the same
// privacy rules: only friends who share their activity show up).

type Friend = { username: string; archetype: string | null; xp: number };
type Done = { id: string; title: string; pillar: string; done_today: boolean; period?: string };
type News = { friend: Friend; done: Done[] };

export default function TownNews({ friends }: { friends: Friend[] }) {
  const [news, setNews] = useState<News[] | null>(null);
  const key = friends.map((f) => f.username).join(",");

  useEffect(() => {
    if (!key) return;
    let live = true;
    const list = friends.slice(0, 8);
    Promise.all(
      list.map((f) =>
        supabase.rpc("get_friend_profile", { p_username: f.username }).then(({ data, error }) => {
          if (error || !data) return null;
          const quests = ((data as { quests?: Done[] }).quests ?? []).filter((q) => q.done_today && (q.period ?? "daily") === "daily");
          return { friend: f, done: quests };
        }),
      ),
    ).then((all) => {
      if (live) setNews(all.filter((n): n is News => !!n).sort((a, b) => b.done.length - a.done.length));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when the set of friends changes
  }, [key]);

  if (!key || !news) return null;
  const busy = news.filter((n) => n.done.length > 0);

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="display text-[18px]">Town news</span>
        <span className="chip">{busy.length === 0 ? "Quiet today" : `${busy.length} building today`}</span>
      </div>
      {busy.length === 0 ? (
        <p className="text-[13.5px] font-bold text-muted mt-1">Nobody has built anything yet today. Be the first.</p>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-[var(--line)]">
          {busy.map(({ friend, done }, i) => (
            <li key={friend.username}>
              <Link href={`/app/friend/${encodeURIComponent(friend.username)}`} className="flex items-center gap-3 py-2.5">
                <Minifig character={friend.archetype} level={legoLevel(rankForXp(friend.xp).tierIndex)} size={50} alive phase={(i * 1.9) % 5} />
                <span className="flex-1 min-w-0">
                  <span className="block font-extrabold text-[15px] truncate">
                    {friend.username} <span className="text-muted font-bold">built {done.length} {done.length === 1 ? "brick" : "bricks"}</span>
                  </span>
                  <span className="block text-[12.5px] font-bold text-muted truncate">{done.map((d) => d.title).join(" · ")}</span>
                </span>
                <span className="flex -space-x-2 flex-none">
                  {done.slice(0, 3).map((d) => (
                    <LegoIcon key={d.id} name={PILLAR_ICONS[d.pillar as keyof typeof PILLAR_ICONS] ?? "sparkle"} color={PILLAR_BRICK_COLOR[d.pillar] ?? "blue"} size={26} />
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
