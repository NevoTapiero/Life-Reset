"use client";

import { NEED_KEYS, NEED_LABEL, moodOf, type Needs as NeedsT } from "@/lib/needs";

// Mood and the five needs, for the Me tab. Kept off the world screen on purpose.
export default function Needs({ needs }: { needs: NeedsT }) {
  const mood = moodOf(needs);
  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <span className="hud-label">Mood</span>
        <span className="display text-[15px]" style={{ color: mood.low ? "var(--danger)" : "var(--accent)" }}>
          {mood.label} · {mood.score}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2 mt-4">
        {NEED_KEYS.map((k) => {
          const v = needs[k];
          const low = v < 30;
          return (
            <div key={k}>
              <div className="hud-label !text-[8px] !tracking-normal" style={{ color: low ? "var(--danger)" : undefined }}>{NEED_LABEL[k]}</div>
              <div className="mt-1 h-[7px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <i
                  className="block h-full rounded-full"
                  style={{
                    width: `${v}%`,
                    background: low ? "var(--danger)" : "linear-gradient(90deg, var(--accent-2), var(--accent))",
                    transition: "width 700ms var(--ease-strong), background 300ms",
                  }}
                />
              </div>
              <div className="display text-[12px] mt-1" style={{ color: low ? "var(--danger)" : undefined }}>{v}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
