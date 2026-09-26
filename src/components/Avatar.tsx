"use client";

// 2D anime-style challenger portrait, drawn as inline SVG so it ships with the
// app: amber spiky hair, headband, dark jacket with orange trim, circular
// frame with a neon orange glow ring — matching the original app's avatar style.

export default function Avatar({ size = 96, ring = true }: { size?: number; ring?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-label="challenger avatar" role="img">
      <defs>
        <clipPath id="av-clip">
          <circle cx="60" cy="60" r="52" />
        </clipPath>
        <radialGradient id="av-bg" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#3a2413" />
          <stop offset="55%" stopColor="#1c1410" />
          <stop offset="100%" stopColor="#0e0c0a" />
        </radialGradient>
        <linearGradient id="av-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffb14d" />
          <stop offset="55%" stopColor="#ff8b1f" />
          <stop offset="100%" stopColor="#e85f00" />
        </linearGradient>
        <linearGradient id="av-jacket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2e2e33" />
          <stop offset="100%" stopColor="#141417" />
        </linearGradient>
        <linearGradient id="av-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff8800" />
          <stop offset="100%" stopColor="#c94f00" />
        </linearGradient>
      </defs>

      <g clipPath="url(#av-clip)">
        {/* backdrop */}
        <rect width="120" height="120" fill="url(#av-bg)" />
        <circle cx="60" cy="26" r="30" fill="#ff6b00" opacity="0.14" />

        {/* jacket / shoulders */}
        <path d="M14 122c3-25 17-36 46-36s43 11 46 36Z" fill="url(#av-jacket)" />
        <path d="M42 92c4 6 12 9 18 9s14-3 18-9" fill="none" stroke="#0c0c0e" strokeWidth="2.5" />
        {/* collar, orange trim */}
        <path d="M45 90l15 14 15-14" fill="none" stroke="#ff7a00" strokeWidth="3" strokeLinecap="round" />
        <path d="M23 112c8-9 21-13 37-13s29 4 37 13" fill="none" stroke="#3c3c42" strokeWidth="2" />

        {/* neck */}
        <path d="M52 78h16v16c-2.6 2.8-5.3 4.2-8 4.2s-5.4-1.4-8-4.2Z" fill="#e8b088" />
        <path d="M52 78h16v7c-2.7 2.2-5.4 3.3-8 3.3s-5.3-1.1-8-3.3Z" fill="#c98d63" />

        {/* face */}
        <path d="M35 47c0-16 11-25 25-25s25 9 25 25c0 7-1.6 13.8-5 19-3.9 6-11 12.5-20 12.5S43.9 72 40 66c-3.4-5.2-5-12-5-19Z" fill="#f4c9a2" />
        {/* ears */}
        <path d="M34.5 52c-3.4-.6-5 1.8-4.2 5 .7 2.8 3 4.6 5.8 4.1Z" fill="#f4c9a2" />
        <path d="M85.5 52c3.4-.6 5 1.8 4.2 5-.7 2.8-3 4.6-5.8 4.1Z" fill="#f4c9a2" />

        {/* eyes: determined anime look */}
        <path d="M40 54.5c3.4-2.6 8.2-2.9 12-1" fill="none" stroke="#20140c" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M68 53.5c3.8-1.9 8.6-1.6 12 1" fill="none" stroke="#20140c" strokeWidth="2.8" strokeLinecap="round" />
        <g>
          <ellipse cx="46.5" cy="60.5" rx="4.6" ry="5.6" fill="#ffffff" />
          <ellipse cx="47.2" cy="61" rx="3.1" ry="4.2" fill="#b35309" />
          <ellipse cx="47.2" cy="61" rx="1.7" ry="2.6" fill="#1c0f06" />
          <circle cx="45.9" cy="59" r="1.1" fill="#ffffff" />
        </g>
        <g>
          <ellipse cx="73.5" cy="60.5" rx="4.6" ry="5.6" fill="#ffffff" />
          <ellipse cx="72.8" cy="61" rx="3.1" ry="4.2" fill="#b35309" />
          <ellipse cx="72.8" cy="61" rx="1.7" ry="2.6" fill="#1c0f06" />
          <circle cx="71.5" cy="59" r="1.1" fill="#ffffff" />
        </g>
        {/* nose + mouth */}
        <path d="M60 64.5v4.5" stroke="#d19a6e" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M55.5 74.5c2.8 1.8 6.2 1.8 9 0" fill="none" stroke="#8a4a2c" strokeWidth="2" strokeLinecap="round" />
        {/* cheek shading */}
        <path d="M41 66c1.8 1 3.4 1.2 5 .8M74 66.8c1.6.4 3.2.2 5-.8" stroke="#e5a877" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />

        {/* headband */}
        <path d="M33.5 45c8-4.5 45-4.5 53 0l-.8 6c-9-4-42.4-4-51.4 0Z" fill="#232326" />
        <path d="M34.2 47.8c8.5-3.6 43.1-3.6 51.6 0" fill="none" stroke="#ff7a00" strokeWidth="2.2" strokeLinecap="round" />

        {/* hair: spiky anime mass */}
        <path
          d="M28 52c-2-14 3-24 11-29-1 3-1 5.5 0 7.5 2-6 6-10 12-12-1.5 2.8-2 5.2-1.5 7.2 3.5-4.5 8-7 14-7.5-2 2.5-3 5-3 7.5 4-3 8.5-4.2 13.5-3.5-2.4 1.8-4 3.8-4.8 6 5-1.5 9.6-.7 14 2.5-2.8.6-5 1.6-6.5 3 6 1 9.8 4.3 11.5 10-2.6-1.3-5-1.9-7.4-1.7 3.4 3.4 4.6 8 3.7 13.5l-5.5-7c.3 2.8-.2 5.3-1.5 7.5-1.6-6.3-4.4-10.6-8.5-13-8.6-5-25.4-5-33.4 1-3 2.3-5 6.2-6.1 11.5-1.4-2.7-2-5.3-1.7-8l-5.3 6c-.6-5.2.8-9.4 4-12.7-2.3-.1-4.5.5-6.7 1.7 1.8-5.4 4.5-8.6 8.2-9.5Z"
          fill="url(#av-hair)"
        />
        {/* hair shadow layer */}
        <path
          d="M36 49c2.5-5.5 7-8.7 13.5-9.7-1.5 1.9-2.3 3.8-2.5 5.7 3.4-3.4 7.6-5.2 12.6-5.5-1.3 1.8-2 3.6-2.1 5.5 3.8-2.6 8-3.4 12.5-2.4-1.9 1.3-3.2 2.8-4 4.4 4.4-.6 8.2.6 11.5 3.6-9-3.6-32.6-3.6-41.5 0Z"
          fill="#c95400"
          opacity="0.55"
        />
      </g>

      {/* frame ring */}
      {ring && (
        <>
          <circle cx="60" cy="60" r="52" fill="none" stroke="url(#av-ring)" strokeWidth="3.5" />
          <circle cx="60" cy="60" r="56.5" fill="none" stroke="#ff6b00" strokeWidth="1" opacity="0.35" />
        </>
      )}
    </svg>
  );
}
