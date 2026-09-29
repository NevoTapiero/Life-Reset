# Solo Leveling: the core (2026-09-29)

> You live your life. The app sees it, or you tell it. You get XP.
> Your character gets stronger and cooler, and everyone can see it.

Everything in the app serves that sentence. Anything that does not is cut or
shelved (the world prototype lives on branch `ifti/world-prototype`).

## The look (decided 2026-09-29)

A brick-toy world, built entirely in code (three.js): your character as a
brick figure, standing on a studded baseplate in front of his brick house,
with a garden. Everything is bricks on a stud grid (`src/lib/brickWorld.ts`),
so every upgrade is literally more bricks: the house grows with level, the
garden with the streak, and the figure swaps parts for gear. Friends' plots
form a small town. The goal is an official brick-toy licence; until then the
art stays generic (no brand name, logo, or 1:1 copy of the trademarked
minifigure).

## The screen

**You** is the home screen: your character, big, with the look your rank has
earned. Underneath, the five stats as bars that climb over weeks, the XP meter,
the streak. Nothing else. Then **Missions** (the quest list), **Record**
(history), **Profile** (settings).

## How XP comes in, by trust

| tier | what | source | pays |
|---|---|---|---|
| **Seen** | sleep, steps, workouts, recovery | WHOOP, Google Health, Apple Health (needs the native shell) | most |
| **Timed** | reading, deep work, meditation | press *start*, do it, press *done* | medium |
| **Claimed** | eating clean, planning tomorrow | a checkbox | least |

Cheating is possible but slow: what actually happened levels you fastest. A
bad night still costs XP (`migrations/2026-09-29-xp-penalties.sql`).

## Cooler over time

Rank tiers unlock skins per character (`CHARACTER_SKIN_TIERS`, art at
`/chars/{key}-t{tier}.webp`). The You screen always shows the current skin and
names the rank that unlocks the next one. **This is the art we need from Nevo:
tiers 1–5 for all five characters.** Nothing else in this version needs art.

## Order of work

1. You screen (done first, this branch).
2. Trust tiers: timed quests, and pay by tier.
3. Apple Health via Capacitor, so iPhone users are *seen*.
4. Then, and only then, the social act two: friends, the town, a house to
   build from seen data only.

## Shelved, not deleted

Phaser house and town, needs/mood, loot tray, gold, sessions, garden. All on
`ifti/world-prototype`. The gold and town migrations went with it; only the
penalties migration remains queued for Nevo.
