"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { sourceInfo, type Pending } from "@/lib/collect";

// What dropped while you were away, and what you just logged. Each one is a
// tap: it pops, and the amount lands on your character.
export default function LootTray({ pending, onCollect, onCollectAll }: { pending: Pending[]; onCollect: (p: Pending) => void; onCollectAll: () => void }) {
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const pop = (p: Pending) => {
    if (popping.has(p.id)) return;
    setPopping((prev) => new Set(prev).add(p.id));
    setTimeout(() => {
      onCollect(p);
      setPopping((prev) => {
        const n = new Set(prev);
        n.delete(p.id);
        return n;
      });
    }, 240);
  };

  if (!pending.length) {
    return <p className="hud-label text-center py-10">Nothing to collect. Do something, or come back later.</p>;
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {pending.map((p, i) => {
          const info = sourceInfo(p);
          const bad = p.xp < 0;
          return (
            <button
              key={p.id}
              onClick={() => pop(p)}
              className={`collect-bubble !static !justify-center py-4 ${popping.has(p.id) ? "collect-pop" : ""}`}
              style={{
                animationDelay: `${(i % 5) * 0.3}s`,
                color: bad ? "var(--danger)" : "var(--accent)",
                borderColor: bad ? "rgb(255 93 115 / 0.7)" : "rgb(var(--accent-rgb) / 0.7)",
                boxShadow: bad ? "0 0 18px rgb(255 93 115 / 0.35)" : "0 0 18px rgb(var(--accent-rgb) / 0.4)",
              }}
            >
              <Icon name={info.icon} size={16} strokeWidth={2.2} />
              <span className="display text-[16px]">
                {bad ? "" : "+"}
                {p.xp}
              </span>
              <span className="hud-label !text-[9px] !tracking-normal ml-1 truncate" style={{ color: "var(--muted)" }}>
                {p.reason ?? info.label}
              </span>
            </button>
          );
        })}
      </div>
      {pending.length > 1 && (
        <button onClick={onCollectAll} className="btn-primary w-full py-3.5 mt-4">
          Collect all · {pending.length}
        </button>
      )}
    </div>
  );
}
