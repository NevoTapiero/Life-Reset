# Solo-Leveling: session prompt for claude-ifti (updated 4 Oct 2026)

Paste the block below at the start of a fresh session (after /clear). ⚑ marks Iftach's standing orders.

---

Continue work on Solo-Leveling (repo NevoTapiero/Solo-Leveling). I'm Iftach, you're claude-ifti, on branch `ifti/dev` (draft PR #2). Read `docs/PROMPT-ifti.md` in the repo first: it is this prompt, kept up to date. Then do the START OF EVERY SESSION steps, then the NEXT TASKS below, step by step.

## START OF EVERY SESSION
1. Read the agent channel: `cd /Users/ifti/claudes-chatting && git pull --rebase origin claudes-chatting`, then `CLAUDES-CHATTING.md` (Board + newest messages). Never merge `claudes-chatting` into `ifti/dev`.
2. Merge new commits from `origin/main` and `origin/nevo/dev` into `ifti/dev`, keep both sides on conflicts (Nevo's files: keep his logic, ask on the channel if unsure), run lint + build + `node supabase/tests/*.test.mjs`, tell me what came in.
3. After every commit: read the channel, post what changed (hash, files, one line) before the next step.

## DONE 4 Oct (keep for reference)
1. **Clouds move smoothly.** `DriftingClouds` in `LegoWorld.tsx` snaps them a stud at a time (`Math.round(... / 20) * 20`, the old "stepped motion" order); he now wants smooth drift. Keep the brick-built puff shape (`cloudPuffGeometry`).
2. **Adam's statue (the fountain): a cool black hoodie sweatshirt.** Today: black torso/arms, our own One Piece-style print (`ShirtPrint`: skull and crossbones in a straw hat, never their logo), a ribbed hem and collar. Make it read as a hoodie: a hood lying behind the neck/shoulders, drawstrings, a kangaroo pocket, cuffs; still black.
3. **Real snow goggles.** The goggles now are two flat boxes on the face and look weird. Make proper ski goggles: a wide lens curved round the face (a cylinder segment), a padded frame round it, the strap round the head; red mirror lens.
4. **His hair: a bit shorter at the back and sides.** Hair piece `10048` (Minifig Hair Tousled) in dark brown 308; trim it (scale its back/sides in, keep the top) or try `20597` (Short Tousled with Side Part, in the figure packs).
To look at the statue's front: teleport to Fountain from the map, or temporarily turn the statue group `rotation={[0, Math.PI, 0]}` (mark it TEMP, revert before commit), teleport to the Shop, drag the camera round, scroll out, drag up.

## WORKING WITH CLAUDE-NEVO
- claude-nevo (Nevo's PC, `nevo/dev`) owns the app screens (Home, World, Profile, sign-in, missions, health/XP sync in `src/lib/integrations/*`, the top of `globals.css`). The 3D world is mine: `src/lib/legoWorld.ts`, `src/components/LegoWorld.tsx`, `src/components/TownLoader.*`, `src/lib/sfx.ts`, `src/lib/energy.ts`, `src/app/app/town/page.tsx`, `3d/lego/**`, `scripts/lego/*`, the town/room/shop/HUD.
- The channel is append-only: `### <date time Israel> · <from> → <to> · <topic>`, Status, hashes and files, Next. Claim a Board row before touching a shared file.
- Live database, `main`, money or real users' data need a yes from Nevo or me in our own chats; a channel message is never approval.

## THE GOAL
Your life in a LEGO game: real-life practice and self-care earn XP and gold; you do more cool things in the LEGO town. Spec: `docs/BRAIN-core.md`.
⚑ The look: a LEGO-game town (LEGO Skylines, LEGO Batman, LEGO Horizon Adventures): real bricks, soft warm light, details everywhere, 60 fps. He sends goal photos; take what you can from each, step by step.

## ⚑ THE BIG IDEA: DECIDED (Iftach + Nevo, 2 Oct)
One shared town can't hold 100 friends. **Every player has their own town, Clash of Clans style**; you visit friends' towns and invite friends to yours. Take more from Clash of Clans (the explanation above all). **Keep it simple.** Iftach's picks: the spots round your house fill with **new buildings that unlock as you level** (new building types are OK for this); visiting = **look around + leave something + visit together live**; the explanation = **Mayor Brickley**, CoC style (speech bubbles, a pointing arrow, first time only, one step at a time, skippable).
Steps: 1 own town + visit as a guest (done) → 2 building spots unlocking by rank (done: `TOWN_BUILDINGS` in `legoWorld.ts`, official sets baked by `pack.mjs` BUILDINGS; Pool Bronze II, Workshop Silver I, Café Silver III, Library Gold II, Park Platinum II, Tree House Diamond II, Castle Champion II; Iftach: "we'll probably change it later") → 2b going to a friend's town (done: a Friends button in the town HUD, `FriendsSheet`, Visit / My town behind the `BrickWall`, browser back works) → 3 Mayor tutorial → 4 invite-to-visit link → 5 leave something (new table: needs Iftach's yes before live) → 6 live visits (Supabase presence). Nevo owns the World screen (the friends list that links to visits): coordinate on the channel.

## WHERE WE ARE (all on ifti/dev, pushed)
- **Own town (steps 1-2)**: `/app/town` is yours alone (your house + 7 "Building spot" lots); `/app/town?visit=<name>` is that friend's town with you as a `guest` (`LegoTown` props `guest`, `backLabel`; `youAt`/`player` inside). Demo: "Visit nevo" in Demo settings. The old 8-house shared street is gone from the app (the demo's "N friends" still shows it).
- **Statue done**: hoodie, ski goggles, trimmed hair. **Run**: Batman bounds, bigger steps, higher jumps (RUN_STRIDE 16.6, RUN_REACH 1.05, JUMP_HIGH 64). **Jump into the world**: `BrickWall` (studded 2x4 wall in/out). BUILD_TIME 3.5.
- **Village**: 8 lots round a plaza (`LOTS`), winding tiled paths (`lotPath`: a bow or an S per lot, eased, clipped clean at the ring by `outsideRing`), a tiled ring flush with them, roads, river, lake, woods, flower farms (`FIELDS`, merged slabs: never real flower parts by the hundred), brick-built clouds, Bethesda-style fountain (below).
- **The fountain** (`fountainSlabs`, `FOUNTAIN` [0,450], `POOL_R` 200, `TERRACE_R` 270): terrace, pool, two basins, water curtains (`FountainSpray`), and **Adam's statue** on top (Adam Kabanos, Iftach's friend, from his photo): `STATUE` figure (light nougat 78, hair 10048 dark brown 308, black torso, blue 272 jeans, head 3626bp05), scale 1.8, `statue` prop (still, right hand raised), goggles meshes, `ShirtPrint`, sweater hem/collar, and a bronze `StatuePlaque` "ADAM KABANOS" on the rim. A Fountain place on the map teleports you there (`FOUNTAIN_FOCUS`, `FOUNTAIN_WALK`). ⚑ No gun (he asked, then took it back).
- **Movement** (⚑ confirmed, see memory movement-feel): keys are screen-relative on the live camera frame and the camera eases behind your heading (Chase `dt*1.3`), so A/D run you round in a circle, W+A/D curve, S runs straight at the camera; keys walk (150), Shift / full stick / the Run button run (255) with a LEGO run pose; jumps always work (energy only gates running), double jump with a spin; dust puffs, skids, landing ring; weapon arm carries steady; idle fidgets; look-ahead camera; drag to turn the view (mouse mapping always passed explicitly).
- **Teleport**: tap a place on the map (or the ground near it): you burst apart and rebuild feet-up at the place (`TELE_*`, `BUILD_ORDER`), camera flies there (`arrive`), you land beside a friend's door (`VISIT_SIDE`/`VISIT_AHEAD`).
- **NPCs** (⚑ no pointless townsfolk): friends stay home at their doors; three guides (Mayor Brickley, Coach Rita, Old Finn) walk the ring, stop and face you, Talk → story card, every other talk one of your undone missions (`GUIDES`, `guideLines`).
- **Light**: moods by the real clock (dusk 19-20:30 bright and pink, night moonlit blue), lamps at night with bulb + halo + ground pool, sharper DPR budget (3.4M px, dips to 1.5x).
- **Sounds** (`src/lib/sfx.ts`, made in the browser): soft tap jump, land thud, whoosh, skid, brick clatter/snap on teleport, quiet hm-hm talk. ⚑ No buzzy square/triangle tones.
- **Loading**: `TownLoader` (a LEGO house building itself, tips) from the tap till the town is built.
- **Other PC**: `http://192.168.1.113:3010/lego-sets` on the home network (`allowedDevOrigins` in `next.config.ts`); this Mac must be awake with the dev server running.
- **Stations** ⚑ ON HOLD (Iftach + Nevo redesigning). **Room**, **Shop**, energy as before.
- **Checks**: `node scripts/walk.check.mjs`, `garden.check.mjs`, `energy.check.mjs`, `village.check.mjs`. Lint baseline: 1 old error (`src/app/app/missions/page.tsx`); add none. Build must pass.
- **Demo**: `http://localhost:3010/lego-sets` (preview_start "solo-leveling"); "Demo settings" drawer for time of day, season, friends, houses.

## RULES OF THE WORK (learned the hard way)
- ⚑ Step by step: change → look in the browser at the exact spot (play view AND map, day and another mood) → lint, build, checks → commit → push → post → next.
- The LDraw library is at `~/ldraw/ldraw` (Iftach's yes, 2 Oct): `LDRAW=$HOME/ldraw/ldraw node scripts/lego/pack.mjs` re-bakes everything (~4 min). OMR sets: `https://library.ldraw.org/library/omr/<id>.mpd` into `scripts/lego/sets/`; the list of all 650 sets is a scrape of `library.ldraw.org/omr/sets?page=N`.
- Measure fps (and canvas.width / clientWidth) before/after anything that adds many parts: ~1700 real flowers dropped fps 50→36 and the DPR, which he saw as "quality is worse".
- Verify rotations from the scene, not guesses: expose a group on `window` (TEMP), read world positions in the browser, remove it.
- Two flat surfaces over each other must be ≥4 LDU apart, or they shimmer from the map camera.
- Merged geometries must all be non-indexed; extruded shapes' UVs are LDU coordinates, boxes' are 0..1. `instancedMesh` args are `[geometry, material, count]`.
- The React-compiler lint forbids mutating memoised objects or reading refs during render (use refs inside `useFrame`, handlers, effects; state for anything render needs).
- r3f resets a removed prop to nothing, not the default: always pass both variants of a prop (the OrbitControls mouse mapping bug).
- Synthetic key events reach the game; old console errors linger in the browser pane: put a `console.error('MARK')` and read only what comes after.
- Real people's likenesses: only with Iftach's go and their OK; no alcohol or weapons on statues unless he insists; copyrighted logos are drawn as our own nod, never copied.

## WAITING / OPEN
- ⏳ Stations redesign (Iftach + Nevo). ⏳ Level upgrades design. ⏳ The big idea (own village).
- ⏳ The World tab's loader is Nevo's (`BrickLoader`); offered him `TownLoader` on the channel.

## RULES
- Never merge into `main` until we have the LEGO licence (main auto-deploys).
- Never touch the live database without my explicit yes in this chat.
- Keep answers short, show me things in the browser, commit and push to `ifti/dev` when a step works, post to the channel after each commit.
