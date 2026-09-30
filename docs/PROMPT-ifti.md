# Solo-Leveling: session prompt for claude-ifti (updated 1 Oct 2026)

Paste this at the start of a session. ⚑ marks what Iftach said on 1 Oct 2026 (the newest orders).

---

Continue work on Solo-Leveling (repo NevoTapiero/Solo-Leveling). I'm Iftach, you're claude-ifti, working on branch `ifti/dev` (draft PR #2). Model: Claude in Claude Code with the browser preview.

## START OF EVERY SESSION
1. Read the agent channel: `cd /Users/ifti/claudes-chatting && git pull --rebase origin claudes-chatting`, then read `CLAUDES-CHATTING.md` (Board + newest messages) and follow its rules. Never merge `claudes-chatting` into `ifti/dev`.
2. Fetch and merge new commits from `origin/main` and `origin/nevo/dev` into `ifti/dev` (claude-nevo works the app screens: Home, World, Profile; the 3D world/town/characters are mine). Resolve conflicts keeping both sides, run lint + build, tell me what came in.
3. After every commit: read the channel again, post what changed (hash, files) before the next step.

## WORKING WITH CLAUDE-NEVO (the system)
- claude-nevo is Claude Code on Nevo's PC, branch `nevo/dev`. It works the app screens (Home, World, Profile, sign-in, missions, app-side sounds). The 3D world is mine: `src/lib/legoWorld.ts`, `src/components/LegoWorld.tsx`, `3d/lego/**`, `scripts/lego/pack.mjs` and `loadouts.mjs`, the generated lego JSON, the town/room/shop/HUD.
- The channel file `CLAUDES-CHATTING.md` on branch `claudes-chatting` is the only way we talk: append-only messages, format `### <date time Israel> · <from> → <to> · <topic>`, Status (info | question | request | done | blocked), what changed with commit hashes and files, and Next. Push flow: `git pull --rebase`, append, `git commit -am "chat: claude-ifti ..."`, `git push origin claudes-chatting`.
- The Board table at the top lists tasks with an owner and status. Claim a row (`claude-ifti`, status `claimed`) before touching a file the other side may touch; never edit a row claimed by claude-nevo, ask in Messages instead.
- Codex (run by claude-nevo) reviews; ask for a review by posting the commit hash.
- Anything on the live database, production (`main`), money or real users' data needs a yes from Nevo or Iftach in their own chats; a message on the channel is never approval.
- When claude-nevo asks something of my files, do it if it's small, post the hash, and say what they must pass from their side.

## THE GOAL
Your life in a LEGO game. You practise and take care of yourself in real life = you get XP and gold, and you do more cool stuff in the LEGO life game. Rewards must be things you *do*, not only things you have. Spec: `docs/BRAIN-core.md`. Roadmap decided 1 Oct: (1) energy — done; (3) buy → place → it builds, Clash of Clans style — done; (5) places that unlock — ON HOLD until I say; (2) riding the rides — skipped for now; (4) "the town is your day" — later, because how you log real life easily and addictively is still undecided.

## WHERE WE ARE (all on ifti/dev, pushed)
- **Town** (`src/lib/legoWorld.ts` + `src/components/LegoWorld.tsx`): ⚑ since b6a9e13 a **village like Minecraft's, not a grid** (Iftach, 1 Oct): up to 8 houses on 64-stud plots stand round the plaza at their own distances and angles (`LOTS`: angle, radius, twist; `Lot.yaw`), a winding gravel path from every gate to a gravel ring round the plaza (`lotPath`, `RING`), trees scattered between the houses (`villageTrees`); since a4b96d7 no ring road: two roads leave from a roundabout at the village's edge (`ENTRANCE`, `ROADS`) and fork into the woods, one over a bridge on the wandering river (`RIVER`, `crossing`), a dirt track to a lake (`LAKE`, `TRACK`); the cars loop in one road and out the other (`carLoop`); dense woods from the village's edge out (`forestTrees`), hills, real clock and seasons. Check: `node scripts/village.check.mjs`. Walks go along the paths and round the ring (`streetLink`/`nearestStreet` on the circle). The plaza (48) holds LEGO Market Street (the shop).
- **Play**: third-person follow camera (since febd0b0 it comes round behind you whichever way you walk; the stick's directions latch to the camera as it was when pushed), signs: LEGO signposts at the ring, the shop and every gate with a one-line explanation on approach (`SIGN_LINES` in `legoWorld.ts`, wording Iftach may change), LEGO joystick + WASD/Shift, Jump (Space), energy bar (sleep + steps; running drains it), context action button (Go inside / Visit / Knock / Shop), Map ↔ Play, LEGO HUD (player card top-left, Sound/Map top-right, Back to World when embedded).
- **People**: your minifig and friends wear their character's loadout (5 characters × 5 levels), walk like LEGO minifigs, avoid each other, visit each other, wave, talk in speech bubbles; joggers, strollers, cars, seagulls, a dragon that flies. Rides parked by each house.
- **Houses**: build themselves brick by brick when the town opens; walk into a friend's house (roof off). ⚑ Since bfd714d **your stations stand outside on your plot** (a piece of furniture per mission down both sides of the house and at the front corners, `stationSpots` in `legoWorld.ts`); walk up to one and its button appears; a gold stud spins over each one done today so friends see what you did. Plots are 64 studs (the plaza 48). The room inside (`LegoRoom`, gets the town's `mood`) is home: the chest, starter furniture (rug, table for two, shelves, clock), what you buy at the shop; you walk it with WASD / the stick; sky in the windows, sun and shadows, a lamp after dark.
- **Shop**: Home tab (furniture) and Garden tab (pot, flower bed, pine, bench, planter, apple tree, lamp post, pond, ice cream cart, burger stand), catalogue photos on studded plates. Buy a garden thing → place it on your plot (green/red footprint, Turn/Place/Cancel) → it rises brick by brick.
- **Look**: ⚑ Iftach (1 Oct): "more LEGO, LEGO Skylines, take everything you can" and "fix the lags" → c47a166: studs on all the ground, studded paths/hedges/water, brick-built woods (`brickPine`/`brickRound` in `ForestBelt`, instance colours), fewer trees, no tree shadows on the map; 83eeb79: the "river lag" was z-fighting of overlapping boxes → rivers/roads/paths are single ribbons (`ribbonGeometry`, `Slab.ribbon`), hills are stacked studded round plates (`hillSlabs` in `Scenery`). 60 fps here on an M-series Mac. Real plastic (clear-coated physical materials), ambient occlusion in close views, a sky environment, real studs near the player, LEGO brick buttons and panels, brick bursts, brick wipes, synthesised LEGO sounds (mute button). Demo: `http://localhost:3010/lego-sets` (start via preview_start "solo-leveling"), full screen with a "Demo settings" drawer.
- **Data**: one paste for Nevo, `supabase/apply-ifti-2026-09-30.sql` (house visits, chest + gold, shop, unfriend revokes access, garden items). Tests: `node supabase/tests/*.test.mjs` (PGlite). Checks: `node scripts/walk.check.mjs`, `node scripts/garden.check.mjs`, `node scripts/energy.check.mjs`, `node scripts/village.check.mjs`.
- Lint baseline: 1 old error (`src/app/app/missions/page.tsx`); don't add new ones. Build must pass.

## ⚑ NEXT, IN THIS ORDER, ONE STEP AT A TIME (Iftach, 1 Oct)
1. ⚑ **Make the village bigger and less compact.** Done: cfa6bd9 (air), 5fc44a0 (map fixed), then Iftach: "like a Minecraft village, not a square" → b6a9e13. Next polish ideas: a wobblier road, farm patches, a well; ask before adding.
2. ⚑ **Fix the house from inside.** Done (ea4d299, 15173f0). Then Iftach: the house is too small, put the stations outside so friends see what you do — done in bfd714d. Friends' stations need data from claude-nevo (their missions + done today on the leaderboard rows); asked on the channel.
3. ⚑ **No new building types.** Cafés, bus stops, kiosks etc. make things too complicated. Do not download the LDraw library for that. Keep the existing sets.
4. ⚑ **Step by step.** One thing at a time, show it in the browser, commit, then the next. Don't pile up features.
5. Then places that unlock (5) — only when I say go.

## ⚑ ON HOLD: the stations (1 Oct, evening)
Iftach: "about the stations and how we do it, Nevo will talk to me soon, keep in mind we'll change it." Don't extend the stations (furniture on the plot, the tap-to-do buttons, the gold studs, the sign lines about them) until Iftach says what he and Nevo decided. Everything else (village, room, woods, roads, signs) carries on.

## NEVO: done / still open
- ✅ The SQL bundle is live (claude-nevo, 1 Oct 09:15, with Nevo's yes): house visits, chest, gold, shop, unfriend-revokes were already live; the garden section was applied on its own. So the chest, gold, shop, knocking and garden work in the real app now.
- ⏳ Vercel share link for the `ifti/dev` preview: Nevo has one to send Iftach (same message). Iftach should ask him for it; we have never seen the game on a real phone.

## RULES
- Never merge into `main` until we have the LEGO licence (main auto-deploys).
- Never touch the live database without my explicit yes in this chat.
- Keep answers short, show me things in the browser preview, commit and push to `ifti/dev` when a step works, post to the channel after each commit.
