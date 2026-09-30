"use client";

// Hand-drawn 24x24 line icon set. White precise strokes, per the Solo Leveling
// visual language: vector line icons inside dark rounded tiles, never emoji.

const PATHS: Record<string, React.ReactNode> = {
  droplet: <path d="M12 3.5c3.3 4 5.7 6.9 5.7 9.6a5.7 5.7 0 0 1-11.4 0c0-2.7 2.4-5.6 5.7-9.6Z" />,
  moon: <path d="M19.7 14.3A7.8 7.8 0 0 1 9.7 4.3a8 8 0 1 0 10 10Z" />,
  book: (
    <>
      <path d="M12 6.2c-2-1.7-4.6-2.1-7.7-1.9v13.5c3.1-.2 5.7.2 7.7 1.9 2-1.7 4.6-2.1 7.7-1.9V4.3c-3.1-.2-5.7.2-7.7 1.9Z" />
      <path d="M12 6.2v13.5" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M7 7.5v9M3.9 9.2v5.6M17 7.5v9M20.1 9.2v5.6M7 12h10" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
  lotus: (
    <>
      <path d="M12 4.5c1.3 2.1 1.3 4.4 0 6.8-1.3-2.4-1.3-4.7 0-6.8Z" />
      <path d="M5.2 7.8c2.4.7 4 2.2 5 4.6-2.6-.2-4.3-1.7-5-4.6ZM18.8 7.8c-2.4.7-4 2.2-5 4.6 2.6-.2 4.3-1.7 5-4.6Z" />
      <path d="M4 13.7c1.9 3.4 4.6 5.1 8 5.1s6.1-1.7 8-5.1" />
    </>
  ),
  pen: (
    <>
      <path d="M4.5 19.5l.9-3.6L16.6 4.7a2 2 0 0 1 2.8 2.8L8.2 18.7l-3.7.8Z" />
      <path d="M14.7 6.6l2.8 2.8" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 3.5v17M4.6 7.8l14.8 8.4M19.4 7.8 4.6 16.2" />
      <path d="M12 3.5 10 5.5M12 3.5l2 2M12 20.5l-2-2M12 20.5l2-2" />
    </>
  ),
  "phone-off": (
    <>
      <rect x="7.2" y="3.5" width="9.6" height="17" rx="2.2" />
      <path d="M4 4.5l16 15" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2.2" />
      <path d="M4 9.8h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.6" r="3" />
      <path d="M3.6 19c.7-3.1 2.7-4.9 5.4-4.9s4.7 1.8 5.4 4.9" />
      <circle cx="16.6" cy="9.2" r="2.3" />
      <path d="M16.4 14.3c2.2.3 3.6 1.8 4.1 4.3" />
    </>
  ),
  bulb: (
    <>
      <path d="M12 3.5a5.8 5.8 0 0 1 3.2 10.6c-.6.5-.9 1.1-.9 1.9H9.7c0-.8-.3-1.4-.9-1.9A5.8 5.8 0 0 1 12 3.5Z" />
      <path d="M9.7 18.7h4.6M10.6 21h2.8" />
    </>
  ),
  sparkle: (
    <>
      <path d="M11 4l1.5 4.3L16.8 10l-4.3 1.7L11 16l-1.5-4.3L5.2 10l4.3-1.7L11 4Z" />
      <path d="M17.8 14.7l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </>
  ),
  apple: (
    <>
      <path d="M12 7.6c-3.2-1.9-6.6.4-6.6 4.5 0 3.7 2.3 7.4 4.6 7.4.9 0 1.4-.5 2-.5s1.1.5 2 .5c2.3 0 4.6-3.7 4.6-7.4 0-4.1-3.4-6.4-6.6-4.5Z" />
      <path d="M12 7.6c0-1.9.9-3.2 2.7-3.9" />
    </>
  ),
  "screen-off": (
    <>
      <rect x="3.5" y="5" width="17" height="12" rx="2" />
      <path d="M12 17v3.5M8.8 20.5h6.4M5.5 7.5 18.5 15" />
    </>
  ),
  leaf: (
    <>
      <path d="M6 20.5C6 12.8 10 6.3 19.6 4.4c-.9 9.7-4.9 14.6-11.6 15.5" />
      <path d="M6 20.5c1.9-5.7 5.6-9.6 10.4-11.9" />
    </>
  ),
  custom: (
    <>
      <path d="M12 3.8l2.1 4.5 4.9.6-3.6 3.4.9 4.9L12 14.8l-4.3 2.4.9-4.9L5 8.9l4.9-.6L12 3.8Z" />
    </>
  ),
  flame: (
    <>
      <path d="M12 3.2c.9 2.8-.4 4.5-1.7 5.9C8.9 10.6 8 12.2 8 14.1a4 4 0 0 0 8 0c0-1.5-.5-2.8-1.3-4-1.5-2.1-2-4.1-2.7-6.9Z" />
      <path d="M12 21a2.9 2.9 0 0 1-1.9-5.1c.7-.7 1.4-1.6 1.9-2.7.5 1.1 1.2 2 1.9 2.7A2.9 2.9 0 0 1 12 21Z" />
    </>
  ),
  trophy: (
    <>
      <path d="M7.5 4h9v5.2a4.5 4.5 0 0 1-9 0V4Z" />
      <path d="M7.5 5.5H4.7a3.1 3.1 0 0 0 3 4.1M16.5 5.5h2.8a3.1 3.1 0 0 1-3 4.1" />
      <path d="M12 13.7v2.6M12 16.3c-1.9 0-2.9 1.1-3.1 3.2h6.2c-.2-2.1-1.2-3.2-3.1-3.2Z" />
    </>
  ),
  chart: (
    <>
      <path d="M4.5 4.5v15h15" />
      <path d="M8.5 16v-4M12.5 16V8M16.5 16v-6.5" />
    </>
  ),
  swords: (
    <>
      <path d="M5 4.5 15.2 14.7M5 4.5h2.8M5 4.5v2.8M13.4 16.5l2.7 2.7M12.6 14.2l-2 2 3.2 3.2 2-2" />
      <path d="M19 4.5 8.8 14.7M19 4.5h-2.8M19 4.5v2.8M10.6 16.5l-2.7 2.7M11.4 14.2l2 2-3.2 3.2-2-2" />
    </>
  ),
  tasks: (
    <>
      <path d="M3.8 6l1.5 1.5L8 4.8M11 6.4h9.2" />
      <path d="M3.8 12l1.5 1.5L8 10.8M11 12.4h9.2" />
      <path d="M3.8 18l1.5 1.5L8 16.8M11 18.4h9.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.2" r="3.4" />
      <path d="M5 20c.8-3.7 3.4-5.8 7-5.8s6.2 2.1 7 5.8" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7.5h16M4 12h16M4 16.5h16" />
      <circle cx="9" cy="7.5" r="1.9" fill="var(--panel)" />
      <circle cx="15.5" cy="12" r="1.9" fill="var(--panel)" />
      <circle cx="7" cy="16.5" r="1.9" fill="var(--panel)" />
    </>
  ),
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  dots: (
    <>
      <circle cx="12" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 7V4.8h4V7M6.7 7l.8 12.5h9L17.3 7" />
      <path d="M10.4 10.7v5.6M13.6 10.7v5.6" />
    </>
  ),
  check: <path d="M5 12.5l4.3 4.3L19 7.3" />,
  "chevron-down": <path d="M5.5 9l6.5 6.5L18.5 9" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  "arrow-right": <path d="M5 12h13M13.5 6.5 19 12l-5.5 5.5" />,
  crown: (
    <>
      <path d="M4.5 17.5h15M4.5 17.5 3.4 8.6l4.9 3.2L12 5.6l3.7 6.2 4.9-3.2-1.1 8.9" />
    </>
  ),
  // the five stat sigils: STR sword, FOC eye, CON heart, DIS shield, WIS tome
  "stat-str": (
    <>
      <path d="M12 3.2 14.2 5.6v8L12 15.5 9.8 13.6v-8L12 3.2Z" />
      <path d="M7.8 16.3h8.4M12 16.3v4.2M10.2 20.5h3.6" />
    </>
  ),
  "stat-foc": (
    <>
      <path d="M2.8 12c2.3-4.2 5.4-6.3 9.2-6.3s6.9 2.1 9.2 6.3c-2.3 4.2-5.4 6.3-9.2 6.3S5.1 16.2 2.8 12Z" />
      <circle cx="12" cy="12" r="2.9" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  "stat-con": (
    <>
      <path d="M12 20c-4.7-3.2-7.8-6.2-7.8-9.8C4.2 7.4 6 5.5 8.5 5.5c1.4 0 2.6.7 3.5 2 .9-1.3 2.1-2 3.5-2 2.5 0 4.3 1.9 4.3 4.7 0 3.6-3.1 6.6-7.8 9.8Z" />
      <path d="M7.6 12.1h2.1l1.2-2.1 1.8 3.9 1.3-1.8h2.4" />
    </>
  ),
  "stat-dis": (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.2 2.7 7.3 7 9 4.3-1.7 7-4.8 7-9V6l-7-2.5Z" />
      <path d="M9 12.1l2.1 2.1 4.2-4.3" />
    </>
  ),
  "stat-wis": (
    <>
      <path d="M12 9c-1.9-1.5-4.3-1.9-7.2-1.7v11.2c2.9-.2 5.3.2 7.2 1.7 1.9-1.5 4.3-1.9 7.2-1.7V7.3c-2.9-.2-5.3.2-7.2 1.7Z" />
      <path d="M12 9v11.2" />
      <path d="M12 1.8l.75 1.65 1.65.75-1.65.75L12 6.6l-.75-1.65L9.6 4.2l1.65-.75L12 1.8Z" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h7" />
      <path d="M10.5 12h9M16 7.5l3.5 4.5L16 16.5" />
    </>
  ),
  home: (
    <>
      <path d="M4 11.2 12 4.5l8 6.7" />
      <path d="M6.2 9.6v9.9h11.6V9.6" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4M12 3.8c2.3 2.4 3.4 5.1 3.4 8.2s-1.1 5.8-3.4 8.2c-2.3-2.4-3.4-5.1-3.4-8.2s1.1-5.8 3.4-8.2Z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <circle cx="12" cy="12.8" r="3.3" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" />,
  mail: (
    <>
      <rect x="3.8" y="6" width="16.4" height="12" rx="2" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.2" />
    </>
  ),
  "chevron-right": <path d="M9.5 5.5 16 12l-6.5 6.5" />,
  "chevron-left": <path d="M14.5 5.5 8 12l6.5 6.5" />,
  plug: (
    <>
      <path d="M9 3.5v4M15 3.5v4M6.5 7.5h11v3a5.5 5.5 0 0 1-11 0Z" />
      <path d="M12 16v4.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4.2h-4.2" />
    </>
  ),
};

export default function Icon({
  name,
  size = 20,
  strokeWidth = 1.6,
  className,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const content = PATHS[name] ?? PATHS.custom;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {content}
    </svg>
  );
}

// WHOOP's mark: the black tile with the white band that loops back on itself.
export function WhoopMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="48" height="48" rx="11" fill="#0B0B0C" />
      <path
        d="M11 16.5c0 7.5 4.3 13 9.6 13 3.4 0 5.6-2.2 6.4-5.6M37 31.5c0-7.5-4.3-13-9.6-13-3.4 0-5.6 2.2-6.4 5.6"
        fill="none"
        stroke="#FF0026"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Google Health: a heart in Google's four colours.
export function GoogleHealthMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="gh-heart" x1="6" y1="8" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4285F4" />
          <stop offset="0.38" stopColor="#34A853" />
          <stop offset="0.66" stopColor="#FBBC05" />
          <stop offset="1" stopColor="#EA4335" />
        </linearGradient>
      </defs>
      <path
        d="M24 41.5 8.7 26.4C4.4 22.2 4.4 15.4 8.7 11.3c4.1-4 10.7-3.9 14.6.3l.7.7.7-.7c3.9-4.2 10.5-4.3 14.6-.3 4.3 4.1 4.3 10.9 0 15.1L24 41.5Z"
        fill="url(#gh-heart)"
      />
    </svg>
  );
}

export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
