# Solo Leveling

Real habits become quests. Earn XP, keep the streak, climb the ranks.

A gamified habit RPG. Daily habits are quests judged by an AI (1 to 50 XP by real effort), clearing them levels a five attribute character sheet (Constitution, Focus, Discipline, Strength, Wisdom), builds a streak, and climbs a rank ladder from Bronze I to Champion III. Friends race on a private weekly board.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4), mobile first single column UI, installable PWA
- **Supabase**: auth (Google or email, no confirmation step), Postgres, row level security; all game logic runs in security definer SQL functions (`supabase/schema.sql`)
- **Gemini**: `/api/rate-quest` judges custom quests (strict 1 to 50 XP scale, picks the icon too)

## Product flow

1. **Landing** (`/`): the pitch, live member count
2. **Auth** (`/auth`): Google or email and password
3. **Today** (`/app`): full bleed art quest cards, arcade XP meter with level block, streak meter; yesterday stays checkable for one extra day
4. **Loadout** (`/app/quests`): forge custom quests (the judge sets the XP), screen time challenges, the armory catalog
5. **Stats** (`/app/stats`): radar sheet, tap a stat for what it means, pillar activity
6. **Board** (`/app/leaderboard`): friends only, invite by code, gold silver bronze podium frames
7. **Profile** (`/app/profile`): wallpaper hero, five anime characters, privacy toggle, friend code

Solo Leveling is a free platform. No paywall, no subscription.

## Run it

```bash
npm install
npm run dev   # port 3010
```

Environment (`.env.local`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`.
