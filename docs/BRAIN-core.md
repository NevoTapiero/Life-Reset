# Solo Leveling: the core (2026-09-29)

> You live your life. The app sees it, or you tell it. You get XP.
> Your character gets stronger and cooler, and everyone can see it.

Everything in the app serves that sentence. Anything that does not is cut or
shelved (the world prototype lives on branch `ifti/world-prototype`).

## The look (decided 2026-09-29)

A LEGO world built from real parts: the LDraw library (community models of
every LEGO element, CC BY 2.0), rendered in the browser with three's
LDrawLoader. `src/lib/legoWorld.ts` writes each plot as LDraw text -- a 48x48
baseplate, a garden that grows with your streak (tile path, flowers, hedge,
trees) and your minifigure -- and `components/LegoWorld.tsx` renders it.
The house is an official LEGO set, one per level (Small Cottage, Holiday
Home, Mountain Hut, Lakeside Lodge, Olivia's House), from the LDraw Official
Model Repository. `scripts/lego/pack.mjs` packs the parts the plot uses into
`public/lego/parts.mpd` and bakes each house to a small glb in
`public/lego/houses/` (turned to face the garden, outlines dropped, meshopt).
The Town tab is a square: the shop -- LEGO's Market Street (10190), four
storeys -- on a plaza in the middle, up to eight houses around it on 48x48
plots all facing the plaza (yours right behind the shop), smooth grey streets
between the blocks and a ring road, then forest and hills. The ground is drawn
as flat stud-textured plates (a real 48x48 baseplate is 110k triangles).
Later: a fountain on the plaza, and more.

**Inside your house** is a room with a station for each of your missions (up
to 10): a barbell for Strength, a laptop for Focus, an apple for
Constitution, a clock for Discipline, a bookcase for Wisdom -- in a
real-sized room (walls ten bricks high, windows, a plank floor) seen from
about head height. Tapping a
station is doing the mission -- it pays out (+XP floats up) and stays lit for
the day, Clash of Clans collector style, and pays the same in gold.
What your watch earns while you're away (steps, sleep, recovery, workouts)
waits in a treasure chest in the room; tap it to collect the XP and gold.
Penalties still land at once. (migrations/2026-09-30-unclaimed-rewards.sql:
ledger pending_xp, profiles.gold, collect(), gold follows mission XP.)
**The shop** (the Market Street building in the middle of town: walk up to
it and go in) sells furniture for gold: floor lamp,
coffee table, cat, indoor trees, sofa, TV, aquarium, trophy -- each built
from LEGO parts with its own spot in the room (DECOR in legoWorld.ts).
Prices live in shop_items; buy_item() checks and takes the gold on the
server (migrations/2026-09-30-shop.sql).
In the town you knock on a friend's door, and once they let you in you can
walk into their house (the roof comes off, dollhouse style).

**Licensing:** the geometry is free, but LEGO and the minifigure are LEGO
Group trademarks, and the houses are LEGO's own set designs. This must not ship publicly (merge to `main` auto-deploys)
until the licence is in place.

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
