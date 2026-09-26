# Life Reset: technical architecture (2026-09-26)

## Stack

- **Frontend**: Next.js 16 (App Router, TypeScript), Tailwind v4, mobile first single column (max-w-md). Dark RPG theme via CSS custom properties in globals.css: background #07090f, panel #0e1320, accent #3ce8c8 (teal), accent2 #7d6bff (violet), gold #f5c752. Geist Sans and Geist Mono fonts. All dynamic pages are client components using the browser Supabase client; no SSR of user data, no middleware.
- **Backend**: Supabase project "Life Reset", ref etlumfjimkjjdmhimzwr, region ap-southeast-1, Postgres 17. Dev server runs on port 3010.

## Repository layout (github.com/NevoTapiero/Life-Reset)

- `src/lib/supabase.ts`: browser client (anon key from .env.local, never committed)
- `src/lib/game.ts`: types, rank ladder math, stat and pillar metadata, plan day and projection helpers
- `src/lib/onboarding.ts`: the whole quiz as a data structure (QUIZ_STEPS with `when` predicates for branching), baseline stat scoring, archetype rules, payload builder, localStorage keys
- `src/app/page.tsx` landing; `onboarding/page.tsx` wizard plus all interstitial screens; `auth/page.tsx` Google plus email auth and the post auth routing; `app/*` the four in-app tabs behind a client auth guard layout
- `src/components/Radar.tsx`: dependency free SVG radar chart (two series, dashed baseline vs filled current)
- `supabase/schema.sql`: the entire database, idempotent, applied through the Management API `/database/query` endpoint

## Database schema

- `profiles` (pk = auth.users id): username (unique), archetype, focus_areas[], intensity, onboarding jsonb (full quiz payload), plan_started_on, streak_commitment, xp, streak_current, streak_best, last_completed_on, stats jsonb {CON,FOC,DIS,STR,WIS}
- `quests`: catalog of 16 (id slug, title, pillar, xp 10-20, stats[], icon, benefits jsonb, sort)
- `user_quests`: which quests are active per user
- `quest_completions`: one row per user, quest and date; unique constraint prevents double completion

## Security model

RLS is enabled on every table. Clients can only **read** (profiles: own row only; quests: public catalog; user_quests and completions: own rows). Every write goes through **security definer functions** that enforce `auth.uid()`, so XP cannot be forged from the browser:

- `complete_onboarding(p jsonb)`: stores the assessment, clamps baseline stats to 30-90 server side, sets plan start (Asia/Jerusalem today), assigns quests by focus area mapping (core: water, sleep, read; health adds workout, sunlight, clean meal; mental adds meditate, journal; career adds deep work, plan tomorrow; discipline adds cold shower, social media limit; relationships, education, spiritual and rebuild each add their own)
- `complete_quest(id)`: inserts completion for today, adds quest XP, +2 to each linked stat, extends or resets the streak, updates best streak; idempotent per day
- `uncomplete_quest(id)`: reverses today's completion, subtracts XP and stats, recomputes the streak by walking consecutive days backward
- `get_leaderboard()`: top 50 by weekly XP (week starts Monday), exposes only username, archetype, xp, streak and an is_me flag
- `get_member_count()` (anon allowed, powers landing page counts), `set_username(name)` (3-20 chars, sanitized, unique), `app_today()` (Asia/Jerusalem date)
- `handle_new_user` trigger on auth.users creates the profile with a username derived from the email local part

## Auth configuration

- Email and password with `mailer_autoconfirm: true` (no confirmation email; changed 2026-09-26 at Nevo's request)
- Google provider: `signInWithOAuth` flow implemented with redirect back to /auth; Supabase still needs external_google client id and secret from Google Cloud Console (authorized redirect URI: https://etlumfjimkjjdmhimzwr.supabase.co/auth/v1/callback)
- site_url and allow list point at http://localhost:3010 for development; must be updated when a production domain exists

## Operational notes

- Applying SQL through the Management API from PowerShell 5.1 corrupts UTF-8 and long JSON strings; use a small Node script (fs.readFileSync + fetch) instead
- The project folder `Desktop\Life Reset` contains a space; the dev launch config uses the DOS short path (LIFERE~1) because npm --prefix breaks on spaces
- package.json must stay BOM free (PowerShell Set-Content once broke the build with a UTF-8 BOM)
- Test account: tester@lifereset.dev (admin created; credentials in the gitignored .env.local)
