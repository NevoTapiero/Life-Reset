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
- **Town** (`src/lib/legoWorld.ts` + `src/components/LegoWorld.tsx`): 3×3 blocks of 48-stud plots round a plaza with LEGO Market Street (the shop), up to 8 houses (official sets by level), tree-lined streets, hedges, a forest belt, roads out north/south, a river with a bridge, hills and mountains, real clock (day/golden/dusk/night) and real seasons.
- **Play**: third-person follow camera, LEGO joystick + WASD/Shift, Jump (Space), energy bar (sleep + steps; running drains it), context action button (Go inside / Visit / Knock / Shop), Map ↔ Play, LEGO HUD (player card top-left, Sound/Map top-right, Back to World when embedded).
- **People**: your minifig and friends wear their character's loadout (5 characters × 5 levels), walk like LEGO minifigs, avoid each other, visit each other, wave, talk in speech bubbles; joggers, strollers, cars, seagulls, a dragon that flies. Rides parked by each house.
- **Houses**: build themselves brick by brick when the town opens; walk into a friend's house (roof off). Your room inside: a station per mission, the chest, furniture you bought. ⚑ **The house from inside does not look good — see NEXT.**
- **Shop**: Home tab (furniture) and Garden tab (pot, flower bed, pine, bench, planter, apple tree, lamp post, pond, ice cream cart, burger stand), catalogue photos on studded plates. Buy a garden thing → place it on your plot (green/red footprint, Turn/Place/Cancel) → it rises brick by brick.
- **Look**: real plastic (clear-coated physical materials), ambient occlusion in close views, a sky environment, real studs near the player, LEGO brick buttons and panels, brick bursts, brick wipes, synthesised LEGO sounds (mute button). Demo: `http://localhost:3010/lego-sets` (start via preview_start "solo-leveling"), full screen with a "Demo settings" drawer.
- **Data**: one paste for Nevo, `supabase/apply-ifti-2026-09-30.sql` (house visits, chest + gold, shop, unfriend revokes access, garden items). Tests: `node supabase/tests/*.test.mjs` (PGlite). Checks: `node scripts/walk.check.mjs`, `node scripts/garden.check.mjs`, `node scripts/energy.check.mjs`.
- Lint baseline: 1 old error (`src/app/app/missions/page.tsx`); don't add new ones. Build must pass.

## ⚑ NEXT, IN THIS ORDER, ONE STEP AT A TIME (Iftach, 1 Oct)
1. ⚑ **Make the village bigger and less compact.** The village is too small; everything is compact and too close to each other. Give it air: more space between houses, wider streets, bigger or more spread-out plots, fewer things crammed together. Do this first.
2. ⚑ **Fix the house from inside.** The room does not look good at all. Bring it to the same LEGO-game quality as outside (walls, floor, light, furniture layout, camera, HUD). Second.
3. ⚑ **No new building types.** Cafés, bus stops, kiosks etc. make things too complicated. Do not download the LDraw library for that. Keep the existing sets.
4. ⚑ **Step by step.** One thing at a time, show it in the browser, commit, then the next. Don't pile up features.
5. Then places that unlock (5) — only when I say go.

## WAITING ON NEVO (remind me; never do these yourself)
- Run `supabase/apply-ifti-2026-09-30.sql` once in the Supabase SQL Editor (reviewed by claude-nevo and Codex). Until then the chest, gold, shop, knocking and garden stay hidden in the real app.
- Send me a Vercel share link for the `ifti/dev` preview (I'm not on the Vercel team). We have never seen the game on a real phone.

## RULES
- Never merge into `main` until we have the LEGO licence (main auto-deploys).
- Never touch the live database without my explicit yes in this chat.
- Keep answers short, show me things in the browser preview, commit and push to `ifti/dev` when a step works, post to the channel after each commit.
