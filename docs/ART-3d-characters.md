# 3D characters: brief

The You screen renders `public/chars/3d/{key}.glb` live (`src/components/Character3D.tsx`).
Drop a new file at that path and it replaces the placeholder with no code change.
Keys: `warrior`, `shadow`, `mentalist`, `wizard`, `guardian`.

## Pipeline

1. **Concept image** (text-to-image), portrait orientation, the prompt below.
2. **Image to 3D** from that image, with **auto-rig** and an **idle** animation.
3. Export **GLB**. Keep it under ~5 MB (1024px textures are plenty).
4. Save as `public/chars/3d/warrior.glb`, commit to `ifti/dev`.

The app plays an animation named `Idle` if present, otherwise the first clip.
A `Cheer` clip plays on tap if present; without one, tapping does nothing.

## Style (all five)

Stylized like Supercell's Clash of Clans / Clash Royale: chunky proportions,
big hands, oversized armor pieces, hand-painted textures, warm rim light.
Full body, front view, standing idle pose, arms slightly away from the body
(clean for rigging), plain neutral grey background, whole character visible
head to feet, nothing held that crosses the body.

## Warrior (first)

> Full-body 3D game character concept, front view, standing idle pose,
> centered on plain grey background. Stylized like Supercell's Clash of Clans /
> Clash Royale: chunky proportions, big hands, oversized armor pieces,
> hand-painted textures, warm rim light. A young warrior with spiky
> dark-orange hair, fierce orange eyes, a scar over the right brow, black
> jacket with glowing orange trim, dark fantasy armor accents on the shoulders
> and forearms. Arms slightly away from the body. Clean silhouette, whole
> character visible head to feet.

## The other four (same prompt, swap the character line)

- **Shadow**: a lean hooded rogue in dark cyan and black, glowing cyan eyes under the hood.
- **Mentalist**: a calm young monk-like figure in flowing violet robes, glowing violet runes on the sleeves.
- **Wizard**: a young wizard in deep blue robes with a tall hat and a glowing blue crystal staff held upright at his side.
- **Guardian**: a broad, heavy guardian in green and bronze armor with a large round shield on his back.

## Later, cheap

Gear is separate small objects pinned to bones in code (sword, shield,
helmet, crown). One generation each, reused across characters. Full new
bodies only for the top tier.
