# Solo Leveling — product and design brain (rev 5, 2026-09-27)

This is the current source of truth for the app formerly called Life Reset. It supersedes the older BRAIN docs where they conflict.

## Identity

- **Name**: Solo Leveling (renamed from Life Reset everywhere on 2026-09-27: GitHub repo `NevoTapiero/Solo-Leveling`, Vercel project `solo-leveling`, Supabase project "Solo Leveling", package.json, PWA manifest, app icon, all UI copy).
- **Live**: https://solo-leveling-hunters.vercel.app (official). The old https://life-reset-five.vercel.app still serves the same app so existing links and installed PWAs keep working.
- **Positioning**: free habit RPG. Real daily habits are quests; an AI judge prices them 1 to 50 XP by real effort; clearing quests levels a five stat character sheet, builds a streak, and climbs a rank ladder; friends race on a private weekly board. No paywall, ever.
- Users are called **hunters**. The word "System" is banned from all UI (the AI judge persona is "the Judge").

## Design system (rev 5)

- **Type**: two voices, like the reference app. In-app voice is Archivo (variable, width axis): `.display` is font-stretch 125 percent, weight 850, uppercase — a wide heavy geometric look. HUD labels are Archivo 700, 10.5px, wide tracking, uppercase. Marketing voice (landing hero "SOLO LEVELING", auth "JOIN THE HUNT") is Anton: tall, ultra condensed block lettering. Geist Mono survives only for friend codes and tabular numbers.
- **Palette**: unchanged tokens. bg #0c0c0e, panel #1c1c1e, accent #FF6B00 to #FF8800, bronze #d47a1e, gold #f5c752, silver #c3cede, danger #ff5d73.
- **XP meter**: arcade style. Orange LEVEL block (level = 3 x tierIndex + stageIndex + 1, range 1 to 18), segmented tick bar (fill overlaid with dark repeating gaps), rank label plus xpIntoStage/xpForStage above, centered "N XP to <next rank>" below, big total XP at right. Component: `src/components/XpMeter.tsx`. Streak uses the same segmented bar in amber with a flame pill.
- **Nav**: floating pill, five icon-only tabs, sliding solid orange pill with white icon on the active tab.
- **Board**: friends only. Rows 1 to 3 get metal frames — gold (with an animated shine sweep), silver, bronze — metal medal chips with the rank number, avatar rings tinted to the metal, XP in big display numerals. The signed-in user's row glows orange.
- **Profile and friend hero**: `.scene` wallpaper card — dark gradient, radar web SVG grid, accent glow, floating particles — with the avatar large, name in display type, class and rank pills, rank badge, member-since.
- **Quest cards**: full-bleed art cards (Today and the Yesterday drawer) with a left readability gradient, frosted icon tile and check square.
- **Copy rule**: no long helper sentences anywhere. Labels are short HUD captions.

## Character art pipeline (new)

- The five avatars are now **real anime bust portraits generated with FLUX.1 Krea** via the Hugging Face MCP tool (`mcp-tools/FLUX.1-Krea-dev` space, free through Nevo's HF account NevoTapiero; ZeroGPU free quota is limited per day).
- Files: `public/chars/{warrior,mentalist,wizard,guardian,shadow}.webp`, 768x768. `Avatar.tsx` renders them in a circular crop with an accent colored ring (ring color overridable, used by the board's metal rings).
- Style recipe that produced them (keep for consistency): "Original anime character bust portrait, ... cel shaded, clean bold line art, dramatic rim lighting, dark <color> gradient background with floating particles, game avatar style, centered", seed 697641534, 768x768. Always say "original" — a generic "spiky orange hair plus headband" prompt produced literal Naruto, which cannot ship.
- Characters: Warrior (copper hair, ember scar, orange trim, STR), Mentalist (violet hood, lavender hair, FOC), Wizard (platinum hair, navy star hat, WIS), Guardian (green bandana, armored collar, CON), Shadow (black spikes, glowing cyan eyes, aura, DIS).
- Quest scene art: one Krea scene done (Body — night runner under amber lanterns, subject right, left dark for text; `public/art/pillar-body.webp`, 1024x576, not yet wired). Remaining to generate when GPU quota resets: Mind, Rest, Fuel, Connection, Purpose, then swap all six cards from the hand-drawn SVGs in one commit. Also planned: per-character profile wallpapers and a rendered app icon.

## Game rules (unchanged since rev 4)

- Ranks: Bronze, Silver, Gold, Platinum, Diamond, Champion; stages I, II, III; stage costs 100/150/225/325/450/600 XP.
- Stats CON/FOC/DIS/STR/WIS start at 0 and are earned only: +2 per linked stat per quest clear, always recomputable from completion history.
- Streak: pure count-up with milestones 7/14/30/50/100/365, recomputed server side from history (yesterday backfills bridge it).
- Yesterday stays checkable for one extra day via a drawer under Today.
- Custom quests: the Gemini judge (free text models, model chain starting gemini-3.8-flash) scores 1 to 50 (water = 1, 5 km run = 50, under 1h Instagram all day = 50) and also picks the icon from the app's icon set. Screen time quests: tighter limit, bigger XP (30m=60 down to 2h=30).
- Friends by 6-character code; get_leaderboard returns weekly XP (resets Monday, Asia/Jerusalem) and respects the share_activity privacy toggle.

## Infrastructure

- Supabase ref `etlumfjimkjjdmhimzwr` (unchanged by the rename). All writes via security definer RPCs; RLS everywhere; timezone Asia/Jerusalem via `app_today()`.
- Vercel team beautify3, auto-deploys from main. Auth redirect allow-list includes localhost:3010 and both prod domains.
- Google OAuth consent screen still shows the old name; only Nevo can change that in Google Cloud console.
- Note: "Solo Leveling" is the trademarked manhwa/anime name — fine for a free friends app, would block an app store listing.
