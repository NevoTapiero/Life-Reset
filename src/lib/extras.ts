// Extras, like the red bricks in the LEGO games: silly switches you unlock
// with gold bricks and turn on or off. They only change how things look and
// sound on this device (a class on <html>, read by CSS and the sounds).

export type ExtraId = "bigheads" | "silly" | "disco" | "studrain" | "golden";

export const EXTRAS: { id: ExtraId; name: string; what: string; need: number }[] = [
  { id: "bigheads", name: "Big heads", what: "Every minifig gets a huge head", need: 2 },
  { id: "silly", name: "Silly sounds", what: "Squeaky snaps and chimes", need: 4 },
  { id: "disco", name: "Disco baseplate", what: "The baseplate cycles through colours", need: 6 },
  { id: "studrain", name: "Stud rain", what: "Three times the studs fly when you check", need: 8 },
  { id: "golden", name: "Golden you", what: "Your own minifig turns solid gold", need: 11 },
];

const KEY = "sl-extras";

export function extrasOn(): Set<ExtraId> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as ExtraId[]) : []);
  } catch {
    return new Set();
  }
}

export function extraOn(id: ExtraId): boolean {
  return extrasOn().has(id);
}

export function applyExtras() {
  if (typeof document === "undefined") return;
  const on = extrasOn();
  for (const x of EXTRAS) document.documentElement.classList.toggle(`x-${x.id}`, on.has(x.id));
}

export function setExtra(id: ExtraId, on: boolean) {
  const all = extrasOn();
  if (on) all.add(id);
  else all.delete(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...all]));
  } catch {}
  applyExtras();
}
