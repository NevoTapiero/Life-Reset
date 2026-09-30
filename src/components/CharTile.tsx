"use client";

import Minifig from "@/components/Minifig";
import { CARD_COLORS } from "@/components/MinifigCard";
import { CHARACTERS, type CharacterKey } from "@/lib/game";
import { brickSound } from "@/lib/brickSound";

// A character-select tile, like the LEGO games' character grid: a square in
// the character's colour with their minifig from the waist up, a thick
// yellow frame and a hop when it's the one picked, the name underneath.
export default function CharTile({ character, level, on, onPick }: { character: CharacterKey; level: number; on: boolean; onPick: () => void }) {
  const [top, bottom] = CARD_COLORS[character] ?? CARD_COLORS.warrior;
  const name = CHARACTERS[character].name.replace("The ", "");
  return (
    <button type="button" className={`char-tile ${on ? "on" : ""}`} onClick={() => {
        brickSound.tap();
        onPick();
      }} aria-pressed={on} aria-label={CHARACTERS[character].name} data-own-sound>
      <span className="char-tile-face" style={{ "--card": top, "--card-2": bottom } as React.CSSProperties}>
        <span className="char-tile-fig">
          <Minifig character={character} level={level} size={112} alive={on} />
        </span>
      </span>
      <span className="char-tile-name">{name}</span>
    </button>
  );
}
