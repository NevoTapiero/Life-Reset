"use client";

import { useId } from "react";

const HEART = "M12 20.6s-7.4-4.5-9.6-9.2C.7 7.7 2.8 3.4 6.9 3.4c2.3 0 3.9 1.3 5.1 3 1.2-1.7 2.8-3 5.1-3 4.1 0 6.2 4.3 4.5 8C19.4 16.1 12 20.6 12 20.6Z";

// A row of LEGO-game hearts: red and glossy while full, grey when spent,
// half hearts in between. value 0..max.
export default function Hearts({ value, max = 100, count = 5, size = 22 }: { value: number; max?: number; count?: number; size?: number }) {
  const id = useId().replace(/:/g, "");
  const per = max / count;
  return (
    <span className="hearts" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const fill = Math.max(0, Math.min(1, (value - i * per) / per));
        // round to halves, like the games
        const shown = Math.round(fill * 2) / 2;
        return (
          <svg key={i} viewBox="0 0 24 23" width={size} height={(size * 23) / 24} className={shown === 1 ? "full" : undefined}>
            <defs>
              <clipPath id={`${id}-${i}`}>
                <rect x="0" y="0" width={24 * shown} height="23" />
              </clipPath>
            </defs>
            <path d={HEART} fill="var(--lego-black)" transform="translate(0 1.6)" />
            <path d={HEART} fill="#dde4eb" stroke="var(--lego-black)" strokeWidth="1.8" strokeLinejoin="round" />
            {shown > 0 && (
              <g clipPath={`url(#${id}-${i})`}>
                <path d={HEART} fill="var(--lego-red)" stroke="var(--lego-black)" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M6.2 6.3c-1.7.3-2.6 1.9-2.4 3.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
              </g>
            )}
          </svg>
        );
      })}
    </span>
  );
}
