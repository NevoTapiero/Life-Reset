import { CHARACTERS, STAT_INFO, STAT_KEYS, type CharacterKey, type Stats } from "@/lib/game";

// The back of a minifig card: a character file, like the leaflet that comes
// in a minifigure bag. Title, strongest stat, best streak, bricks built, when
// they started, and a line about who they are (class and rank are on the
// nameplate right below).

export const BIO: Record<CharacterKey, string> = {
  warrior: "Trains hard, shows up early, never skips leg day. Gets stronger with every brick.",
  mentalist: "Keeps a calm head and a sharp mind. Notices what everyone else misses.",
  wizard: "Always learning something new. Carries a book everywhere, just in case.",
  guardian: "Sleeps well, eats well, outlasts everyone. The steady wall of the town.",
  shadow: "Quiet, consistent, unstoppable. Does the work when nobody is watching.",
};

export default function CharacterFile({
  name,
  character,
  level,
  title,
  stats,
  bestStreak,
  bricks = null,
  since,
}: {
  name: string;
  character: string | null;
  level: number;
  title: string;
  stats: Stats;
  bestStreak: number;
  /** missions ever checked */
  bricks?: number | null;
  since: string;
}) {
  const key = (character && character in CHARACTERS ? character : "warrior") as CharacterKey;
  const strongest = [...STAT_KEYS].sort((a, b) => (stats[b] ?? 0) - (stats[a] ?? 0))[0];
  return (
    <div className="card-file">
      <div className="card-file-head">Character file · Level {level}</div>
      <div className="display text-[22px] leading-tight mt-1 truncate">{name}</div>
      <dl>
        <dt>Title</dt>
        <dd>{title}</dd>
        <dt>Strongest</dt>
        <dd>{(stats[strongest] ?? 0) > 0 ? `${STAT_INFO[strongest].name} ${stats[strongest]}` : "Still building"}</dd>
        <dt>Best streak</dt>
        <dd>
          {bestStreak} {bestStreak === 1 ? "day" : "days"}
        </dd>
        {bricks !== null && (
          <>
            <dt>Bricks built</dt>
            <dd>{bricks.toLocaleString()}</dd>
          </>
        )}
        <dt>Since</dt>
        <dd>{new Date(since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</dd>
      </dl>
      <p className="card-file-bio">{BIO[key]}</p>
    </div>
  );
}
