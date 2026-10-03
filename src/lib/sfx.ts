// LEGO-game sounds, made in the browser (no files to load): plastic clicks and
// snaps, footsteps, a stud chime for rewards, a brick clatter. Browsers only
// start audio after a tap or key press, so the context is made on the first
// one. Muting is remembered on this device.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem("lego-sound") === "off";
} catch {}

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
if (typeof window !== "undefined") {
  const wake = () => audio();
  window.addEventListener("pointerdown", wake, { once: true, capture: true });
  window.addEventListener("keydown", wake, { once: true, capture: true });
}

export const soundOn = () => !muted;
export function setSound(on: boolean) {
  muted = !on;
  try {
    localStorage.setItem("lego-sound", on ? "on" : "off");
  } catch {}
  if (muted) void ctx?.suspend();
  else audio();
}

// a short burst of filtered noise: the body of every plastic click
function tick(a: AudioContext, at: number, freq: number, q: number, gain: number, len = 0.03) {
  const src = a.createBufferSource();
  src.buffer = noise;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(at, Math.random() * 0.1, len + 0.01);
}
// a pitched blip (sine), for chimes and voices
function tone(a: AudioContext, at: number, from: number, to: number, gain: number, len: number, type: OscillatorType = "sine") {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + len);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + len + 0.02);
}

// filtered noise swept from one pitch to another: air (a whoosh) or plastic dragging (a skid)
function sweep(a: AudioContext, at: number, from: number, to: number, q: number, gain: number, len: number) {
  const src = a.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(from, at);
  bp.frequency.exponentialRampToValueAtTime(to, at + len);
  bp.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + len * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(at);
  src.stop(at + len + 0.02);
}

// no more than a few of the same sound at once (a whole town building up)
const last = new Map<string, number>();
function throttle(name: string, gapMs: number) {
  const now = performance.now();
  if (now - (last.get(name) ?? 0) < gapMs) return true;
  last.set(name, now);
  return false;
}

export const sfx = {
  /** a button: a crisp plastic click */
  click() {
    const a = audio();
    if (!a) return;
    tick(a, a.currentTime, 3200, 3, 0.35, 0.025);
    tick(a, a.currentTime + 0.018, 2200, 4, 0.2, 0.02);
  },
  /** a footstep: a soft plastic tick, a little different each time */
  step() {
    const a = audio();
    if (!a || throttle("step", 120)) return;
    tick(a, a.currentTime, 1500 + Math.random() * 500, 5, 0.09, 0.035);
  },
  /** a jump: a soft plastic tap off the ground and a little pop (the rising "boing" grated, Iftach 3 Oct) */
  jump() {
    const a = audio();
    if (!a || throttle("jump", 120)) return;
    const t = a.currentTime;
    tick(a, t, 1100, 2, 0.12, 0.04);
    tone(a, t, 330, 440, 0.045, 0.09);
  },
  /** a brick snapping on (a house going up a row) */
  snap() {
    const a = audio();
    if (!a || throttle("snap", 70)) return;
    tick(a, a.currentTime, 2600 + Math.random() * 800, 2.5, 0.16, 0.04);
    tick(a, a.currentTime + 0.012, 900, 3, 0.08, 0.05);
  },
  /** a reward: the bright chime of studs (mission done, chest, something bought) */
  ting() {
    const a = audio();
    if (!a || throttle("ting", 150)) return;
    const t = a.currentTime;
    [0, 0.07, 0.14].forEach((d, i) => tone(a, t + d, 1500 + i * 400, 1900 + i * 500, 0.13, 0.25));
  },
  /** a clatter of bricks tumbling (the brick wipe) */
  clatter() {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    for (let i = 0; i < 14; i++) tick(a, t + i * 0.028 + Math.random() * 0.02, 1800 + Math.random() * 2400, 2.5, 0.14, 0.04);
  },
  /** landing from a jump: a hollow plastic thud and a click */
  land() {
    const a = audio();
    if (!a || throttle("land", 150)) return;
    const t = a.currentTime;
    tick(a, t, 650, 1.6, 0.28, 0.07);
    tick(a, t + 0.012, 2600, 3, 0.12, 0.03);
  },
  /** the double jump's spin: a quick rush of air */
  whoosh() {
    const a = audio();
    if (!a) return;
    sweep(a, a.currentTime, 500, 2800, 1.2, 0.16, 0.32);
  },
  /** turning sharply at a run: plastic feet scraping */
  skid() {
    const a = audio();
    if (!a || throttle("skid", 250)) return;
    sweep(a, a.currentTime, 2600, 900, 2.5, 0.1, 0.18);
  },
  /** someone talking: a quiet, soft "hm-hm" (the square-wave gibberish grated, Iftach 3 Oct) */
  mumble() {
    const a = audio();
    if (!a || throttle("mumble", 300)) return;
    const t = a.currentTime;
    const f = 380 + Math.random() * 80;
    tone(a, t, f, f * 1.05, 0.03, 0.09);
    tone(a, t + 0.11, f * 1.12, f * 1.02, 0.026, 0.1);
  },
  /** a friend talking: a little blip-blip */
  blip() {
    const a = audio();
    if (!a || throttle("blip", 400)) return;
    const t = a.currentTime;
    tone(a, t, 520, 560, 0.03, 0.08);
    tone(a, t + 0.1, 600, 570, 0.026, 0.08);
  },
};
