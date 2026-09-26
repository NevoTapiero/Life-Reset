# Life Reset

Reset your life. For real this time.

A gamified 66 day habit transformation app. Real habits become quests that pay XP, level a five attribute character sheet (Constitution, Focus, Discipline, Strength, Wisdom), build streaks, and climb a weekly leaderboard. The program is generated from a personal diagnostic assessment, not a template.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind v4), mobile first single column UI
- **Supabase**: auth, Postgres, row level security; all game logic runs in security definer SQL functions (`supabase/schema.sql`)

## Product flow

1. **Landing**: value proposition, live member count, entry to the assessment
2. **Onboarding** (`/onboarding`): 20+ question diagnostic with dynamic branching (health and career tracks, injury follow ups), then interstitials: personal projection, The System intro (six pillars), quest mechanics, the UCL 66 day habit science, live quest cards, community wall, reminders, board preview, plan generation, reset type reveal, Day 1 vs Day 66 character sheet, streak contract
3. **Auth** (`/auth`): email and password; the pending assessment is saved to the account through the `complete_onboarding` RPC, which also assigns quests from the chosen focus areas
4. **Paywall** (`/paywall`): plans plus the win your money back challenge. Payments are stubbed for now, access is free in the founder preview
5. **The app** (`/app`): daily quest checklist with XP, rank ladder (Bronze to Diamond, five divisions each), streak vs commitment, character sheet with baseline vs current radar, weekly leaderboard, profile

## Database

Tables: `profiles`, `quests` (catalog of 16), `user_quests`, `quest_completions`.

Clients only read; every write goes through RPCs enforced with `auth.uid()`:
`complete_onboarding`, `complete_quest`, `uncomplete_quest`, `set_username`, `get_leaderboard`, `get_member_count`, `app_today`.

Day boundaries use Asia/Jerusalem. Weekly XP resets Monday.

## Development

```bash
npm install
npm run dev   # port 3010
```

`.env.local` (not committed):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Apply `supabase/schema.sql` to the Supabase project (idempotent). Signup requires email confirmation unless auto confirm is enabled in Supabase auth settings.

## Not wired yet

- Payments (paywall is a stub)
- Google sign in
- Push notification delivery (permission prompt only)
- PWA install manifest
