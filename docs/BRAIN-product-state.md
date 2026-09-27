# Solo Leveling: product state (2026-09-26, revision 2)

Solo Leveling is Nevo Tapiero's gamified habit transformation app, inspired by a competitor teardown (the 52 onboarding screenshots in this notebook). It is a **free platform**: no subscription, no paywall. Repo: github.com/NevoTapiero/Life-Reset. Live Supabase project "Solo Leveling" (ref etlumfjimkjjdmhimzwr).

**Revision 2 changes**: the diagnostic quiz was removed entirely (landing goes straight to auth; every new account is born with the 10 default quests, The Challenger archetype and a 66 day campaign starting that day). Google sign in is live. A quest manager lets users forge, edit, delete and toggle their own quests alongside the 16 quest armory. The whole UI was rebuilt to match the original app's visual language: near black background with an ambient amber glow, neon orange (#FF6B00 to #FF8800) pill buttons, Syne extended display font, Geist body, mono HUD labels in eyebrow pills, hand drawn white line icons in dark rounded tiles (no emoji anywhere), an inline SVG anime challenger avatar in a glowing circular frame, and double bezel cards.

## Concept

Real life habits become RPG quests. Completing a quest pays XP, raises five character attributes (Constitution, Focus, Discipline, Strength, Wisdom), extends a daily streak, and climbs a weekly leaderboard. The program is a 66 day "Campaign 1", grounded in the UCL habit automation study (Lally et al. 2009, median 66 days to automaticity). Six life pillars frame the quest catalog: Body, Mind, Rest, Fuel, Connection, Purpose.

## User flow (implemented and verified end to end)

1. **Landing**: avatar hero, "Reset your life. For real this time.", live member count, straight to auth. No quiz.
2. **Auth**: Continue with Google (provider enabled and verified) or email and password with signup auto confirm, so accounts work immediately. The signup trigger creates the profile with The Challenger archetype, starts the 66 day campaign that day, and equips the 10 default quests: drink water, sleep 7 to 9 hours, read 10 pages, train your body, morning sunlight, cold shower, social media limit, deep work block, plan tomorrow, eat one clean meal.
3. **Today**: quest checklist paying XP with rank progress, streak vs contract, avatar hero card.
4. **Quests** (manager): forge custom quests (name, pillar, difficulty +10/15/20/25 XP, 30 max), edit and delete them, and toggle any quest from the 16 quest armory in and out of the daily loadout.
5. **Stats**: radar of attributes, quest totals, pillar activity. **Board**: weekly leaderboard, resets Monday. **Profile**: avatar, username change, streak commitment selector (7/14/30/50), campaign dates, sign out.

## Game math

- Rank ladder: Bronze, Silver, Gold, Platinum, Diamond, divisions V to I, 150 XP per division (3,750 XP to Diamond I).
- Quests pay 10 to 20 XP and add +2 to each linked attribute per completion.
- Baseline attributes (32 to 72) are scored from quiz answers; the Day 66 projection multiplies by chosen intensity (gentle 2.5x to all in 4.0x).
- Streak: any completion today extends yesterday's streak, gaps reset to 1; unchecking recomputes honestly.
- Day boundaries use Asia/Jerusalem.

## Open items

- Push notification delivery and streak reminders.
- PWA manifest and install experience.
- Production hosting and domain (Vercel planned later); update Supabase site_url and Google OAuth redirect when it exists.
- More avatar variants (per archetype or user selectable).
