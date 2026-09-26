# Life Reset: product state (2026-09-26)

Life Reset is Nevo Tapiero's gamified habit transformation app, inspired by a competitor teardown (the 52 onboarding screenshots in this notebook). It is a **free platform**: no subscription, no paywall. Repo: github.com/NevoTapiero/Life-Reset. Live Supabase project "Life Reset" (ref etlumfjimkjjdmhimzwr).

## Concept

Real life habits become RPG quests. Completing a quest pays XP, raises five character attributes (Constitution, Focus, Discipline, Strength, Wisdom), extends a daily streak, and climbs a weekly leaderboard. The program is a 66 day "Campaign 1", grounded in the UCL habit automation study (Lally et al. 2009, median 66 days to automaticity). Six life pillars frame the quest catalog: Body, Mind, Rest, Fuel, Connection, Purpose.

## User flow (implemented and verified end to end)

1. **Landing**: "Reset your life. For real this time." Live member count from the database (no fabricated social proof anywhere; sample testimonials are labeled Sample).
2. **Diagnostic quiz**: about 21 questions with dynamic branching. Choosing Health & fitness adds goal, obstacle and injury questions (plus an injury status follow up); choosing Career & productivity adds stage and challenge questions. Answers persist in localStorage so refreshes do not lose progress.
3. **Interstitials**: personal projection curve, The System intro (six pillars, primary focus callout), quest mechanics with the rank ladder, the 66 day science screen, live quest cards fetched from the database, community wall, reminders permission, leaderboard preview, plan generation loading screen with the concrete Day 66 date, Reset Type reveal, Day 1 vs Day 66 character sheet (radar), streak contract (7/14/30/50 days, 14 recommended).
4. **Auth**: Continue with Google (flow coded; Supabase provider still needs Google OAuth client id and secret) or email and password with signup auto confirm on, so no confirmation email is required. On first sign in the pending assessment is written through the complete_onboarding RPC, which stores the profile, baseline stats and archetype and assigns quests from the chosen focus areas.
5. **The app**: Today (quest checklist, XP, rank progress, streak vs commitment), Stats (radar of baseline vs current attributes, pillar activity, totals), Board (weekly leaderboard, resets Monday), Profile (username change, campaign dates, sign out).

## Reset Types (archetypes)

Assigned from answers: The Phoenix (rebuilding or at the lowest), The Disciplined (already disciplined), The Strategist (career first), The Warrior (health first plus push or all in intensity), The Seeker (mental or spiritual first), The Challenger (default).

## Game math

- Rank ladder: Bronze, Silver, Gold, Platinum, Diamond, divisions V to I, 150 XP per division (3,750 XP to Diamond I).
- Quests pay 10 to 20 XP and add +2 to each linked attribute per completion.
- Baseline attributes (32 to 72) are scored from quiz answers; the Day 66 projection multiplies by chosen intensity (gentle 2.5x to all in 4.0x).
- Streak: any completion today extends yesterday's streak, gaps reset to 1; unchecking recomputes honestly.
- Day boundaries use Asia/Jerusalem.

## Open items

- Google OAuth credentials (Google Cloud Console) to activate the Google button.
- Push notification delivery (only the permission prompt exists).
- PWA manifest and install experience.
- Production hosting and domain (Vercel planned later).
- Real testimonial pipeline to replace the Sample cards.
