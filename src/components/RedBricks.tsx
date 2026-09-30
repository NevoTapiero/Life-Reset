"use client";

import { useState } from "react";
import { EXTRAS, extrasOn, setExtra, type ExtraId } from "@/lib/extras";
import { brickSound } from "@/lib/brickSound";

// A red brick, drawn like the gold ones
export function RedBrick({ got, size = 40 }: { got: boolean; size?: number }) {
  const [body, edge, shine] = got ? ["#c91a09", "#8a1206", "#ff8a7a"] : ["#dde4eb", "#c3ced9", "#eef2f6"];
  return (
    <svg viewBox="0 0 32 26" width={size} height={(size * 26) / 32} aria-hidden style={{ display: "block", flex: "none" }}>
      {[9.5, 22.5].map((x) => (
        <g key={x}>
          <rect x={x - 4.6} y="1.6" width="9.2" height="4.6" rx="1.6" fill={edge} />
          <rect x={x - 4.6} y="0.8" width="9.2" height="4.2" rx="1.6" fill={body} />
          <rect x={x - 3.4} y="1.4" width="3" height="1.4" rx="0.7" fill={shine} opacity="0.8" />
        </g>
      ))}
      <rect x="1.5" y="5" width="29" height="20" rx="3.5" fill={edge} />
      <rect x="1.5" y="5" width="29" height="17.5" rx="3.5" fill={body} />
      <rect x="4" y="6.6" width="15" height="2" rx="1" fill={shine} opacity={got ? 0.9 : 0.6} />
    </svg>
  );
}

// Extras: red bricks that unlock with gold bricks, each a switch.
export default function RedBricks({ gold }: { gold: number | null }) {
  const [on, setOn] = useState<Set<ExtraId>>(() => extrasOn());

  function flip(id: ExtraId) {
    const next = !on.has(id);
    setExtra(id, next);
    setOn(extrasOn());
    if (next) brickSound.stud(5);
  }

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between">
        <span className="display text-[18px]">Extras</span>
        <span className="chip chip-red">Red bricks</span>
      </div>
      <p className="text-[13px] font-bold text-muted mt-1">Gold bricks unlock these. They only change your own screen.</p>
      <ul className="mt-2 flex flex-col divide-y-2 divide-[var(--line)]">
        {EXTRAS.map((x) => {
          const open = gold !== null && gold >= x.need;
          return (
            <li key={x.id} className="flex items-center gap-3 py-2.5">
              <RedBrick got={open} size={36} />
              <span className="flex-1 min-w-0">
                <span className={`block font-extrabold text-[15px] ${open ? "" : "text-muted"}`}>{x.name}</span>
                <span className="block text-[12.5px] font-bold text-muted">{open ? x.what : `Unlocks at ${x.need} gold bricks`}</span>
              </span>
              {/* an extra that's on keeps its switch even if it locks again */}
              {open || on.has(x.id) ? (
                <button className={`switch ${on.has(x.id) ? "on" : ""}`} role="switch" aria-checked={on.has(x.id)} aria-label={x.name} onClick={() => flip(x.id)} />
              ) : (
                <span className="chip !text-[11px]">
                  {gold ?? 0}/{x.need}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
