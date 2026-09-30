"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Your last five weeks as a LEGO Art mosaic: one round 1x1 tile a day on a
// dark baseplate, blank when nothing was done, then light to full green by how
// many missions you checked. Today has a yellow ring.

const DAYS = 35;
const SHADES = ["#4b5d6b", "#9fd39e", "#6fbf6e", "#4b9f4a", "#2f7d34"];

export default function MonthMosaic({ uid }: { uid: string }) {
  const [perDay, setPerDay] = useState<Map<string, number> | null>(null);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: t } = await supabase.rpc("app_today");
      const day = String(t);
      const since = new Date(new Date(day + "T00:00:00Z").getTime() - (DAYS - 1) * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase.from("quest_completions").select("completed_on").eq("user_id", uid).gte("completed_on", since);
      const m = new Map<string, number>();
      for (const r of (data ?? []) as { completed_on: string }[]) m.set(r.completed_on, (m.get(r.completed_on) ?? 0) + 1);
      setToday(day);
      setPerDay(m);
    })();
  }, [uid]);

  if (!perDay || !today) return null;
  const start = new Date(today + "T00:00:00Z").getTime() - (DAYS - 1) * 86400000;
  const days = Array.from({ length: DAYS }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
  const active = days.filter((d) => (perDay.get(d) ?? 0) > 0).length;
  const shade = (n: number) => SHADES[n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 2 : n <= 6 ? 3 : 4];

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <span className="display text-[18px]">Your five weeks</span>
        <span className="chip chip-green">{active} active {active === 1 ? "day" : "days"}</span>
      </div>
      <div className="mosaic mt-3" role="img" aria-label={`${active} active days in the last ${DAYS}`}>
        {days.map((d) => {
          const n = perDay.get(d) ?? 0;
          return (
            <span
              key={d}
              className={`mosaic-tile ${d === today ? "today" : ""}`}
              style={{ "--t": shade(n) } as React.CSSProperties}
              title={`${d}: ${n} mission${n === 1 ? "" : "s"}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-2 text-[11px] font-extrabold text-muted">
        Less
        {SHADES.map((c) => (
          <span key={c} className="mosaic-tile !w-3 !h-3" style={{ "--t": c } as React.CSSProperties} />
        ))}
        More
      </div>
    </section>
  );
}
