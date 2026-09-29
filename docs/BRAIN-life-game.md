# Solo Leveling: the life game (2026-09-29, branch ifti/dev)

Direction agreed with Ifti on 2026-09-29: the character is the app. Real life
feeds a world you watch; the checklist is the controller, not the product.
Everything below is a prototype on placeholder art (Kenney CC0, `public/game`).

## Systems

- **House (Today)** – Phaser 4 top-down room. Five needs (Energy, Body,
  Focus, Mind, Discipline) drain 2/hour from 60 and rise +25 per quest logged
  today, +8 carry-over from yesterday, +1 per XP of loot you tap. Mood is the
  average. Tap furniture to log the quest that lives there; he walks over and
  does it. Spots with something left carry a marker. `src/lib/needs.ts`,
  `src/game/HouseScene.ts`, `src/components/Room.tsx`.
- **Doing it now** – Start a quest instead of logging it: he does it on
  screen while you do it, the banner counts minutes, Done logs it and drops
  loot. One session at a time, localStorage, dropped after 12h.
  `src/lib/session.ts`.
- **Loot** – Every payout is a bubble over the house you tap to bank: quests
  you logged, WHOOP / Google Health / Tasks paid while away, penalties in
  red. XP and gold stay hidden from the meters until tapped, so rank-ups
  happen on the tap. `src/lib/collect.ts`.
- **Gold** – Second currency for the shop. 2 per XP from quests only; loot
  from connected apps pays XP only so a watch cannot farm the shop. Never
  touches rank. `migrations/2026-09-29-gold.sql`.
- **Penalties** – A short night (<6h, or WHOOP sleep <50%) or a red recovery
  costs XP; the ledger row is negative and shows on Today.
  `migrations/2026-09-29-xp-penalties.sql`.
- **Town (replaces Board)** – Walkable map, one fenced yard per person in
  your circle. House by rank (starter / red roof / castle), garden by streak
  and rank (flowers, mushrooms, beehive, target, tree, sign). Each friend
  stands at their gate with one sentence (last logged quest as an action, or
  Asleep / At home) and today's XP. Tap ground to walk, house to visit.
  `src/lib/town.ts` (layout + BFS pathfinding), `src/game/TownScene.ts`,
  `migrations/2026-09-29-town.sql` (`get_town()`; falls back to
  `get_leaderboard` until applied).
- **Real clock** – The world runs on Asia/Jerusalem time: night tint from
  dusk, he is asleep in bed 23:00–06:00 unless you are doing something.

## Migrations waiting for Nevo (all additive)

1. `2026-09-29-xp-penalties.sql` – `award_external_xp` accepts negatives.
2. `2026-09-29-gold.sql` – `profiles.gold`, quests pay gold.
3. `2026-09-29-town.sql` – `get_town()`.

## Next steps, in order

1. Shop, garden edition: spend gold to place things in your own yard
   (`yard_items` table); friends see them.
2. House upgrades bought with gold; rank gates what you can buy.
3. Zoom-out map view of the whole town.
4. Evening sweep (swipe cards for anything the house missed) + 9pm push.
5. Juice: sound, haptics, celebrations.
6. Skill tree: stats become perks.

## Art

The engine is not the problem; the art is. Everything needs sprites in our
style: each of the five characters with a 4-direction walk, sit, lie, lift;
house interiors per upgrade tier; yard items; town exteriors. The prototype
shows exactly which poses and objects must exist. Ifti raised Unity on
2026-09-29 as a way to feel "more real"; assessment on the branch: the engine
does not change the pixels, and a Unity WebGL build is too heavy for the PWA.
Revisit only if a native app is decided.

## Dev notes

- `npm run dev` on 3010; `/dev-room` and `/dev-town` are unauthenticated
  demo pages (uncommitted, delete before merging).
- Pure logic has self-checks in the session scratchpad; run with node 26 and
  the ts loader (extensionless `@/` imports).
- Lint has 6 pre-existing `set-state-in-effect` errors on `main`; keep the
  count at 6.
