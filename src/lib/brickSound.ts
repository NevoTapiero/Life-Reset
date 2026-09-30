// Sounds for the screens outside the 3D world, made in the browser (no files):
// a brick snapping on is three layers (a scrape as the studs meet, a double
// click as they seat, a short plastic body tone), studs chime like a LEGO game
// pickup and climb in pitch along a streak, levels get a little fanfare.
// Everything goes through a gentle compressor and a tiny plastic "room".
// Muting follows the 3D world's switch (sfx.ts: one setting per device).

import { soundOn } from "@/lib/sfx";

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;
let noise: AudioBuffer | null = null;

function audio(): { a: AudioContext; out: AudioNode } | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // master: compressor -> out, plus a short bright "toy box" reverb send
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      const master = ctx.createGain();
      master.gain.value = 0.9;
      const verb = ctx.createConvolver();
      verb.buffer = impulse(ctx, 0.22);
      const wet = ctx.createGain();
      wet.gain.value = 0.16;
      master.connect(comp);
      master.connect(verb).connect(wet).connect(comp);
      comp.connect(ctx.destination);
      out = master;
    } catch {
      return null;
    }
  }
  // iOS parks audio as "interrupted" after a call or backgrounding
  if (ctx.state !== "running") void ctx.resume();
  return { a: ctx, out: out! };
}

// a decaying burst of noise, as a tiny room's echo
function impulse(a: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function burst(a: AudioContext, dest: AudioNode, at: number, type: BiquadFilterType, freq: number, q: number, gain: number, len: number) {
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(f).connect(g).connect(dest);
  src.start(at, Math.random() * 0.2, len + 0.02);
}

function tone(a: AudioContext, dest: AudioNode, at: number, from: number, to: number, gain: number, len: number, type: OscillatorType = "sine", attack = 0.004) {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(to, at + len * 0.6);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + len + 0.03);
}

// a bell: a few inharmonic partials, like a small metal chime
function bell(a: AudioContext, dest: AudioNode, at: number, freq: number, gain: number, len = 0.45) {
  [
    [1, 1],
    [2.01, 0.45],
    [3.02, 0.22],
    [4.17, 0.12],
  ].forEach(([m, g]) => tone(a, dest, at, freq * m, freq * m, gain * g, len / m + 0.08));
}

// a tiny buzz with the sound, on phones that can (Android; iOS has no web vibration)
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

const last = new Map<string, number>();
function throttled(name: string, gapMs: number) {
  const now = performance.now();
  if (now - (last.get(name) ?? 0) < gapMs) return true;
  last.set(name, now);
  return false;
}

// C major pentatonic, two octaves: studs climb it along a streak
const STUD_NOTES = [1047, 1175, 1319, 1568, 1760, 2093, 2349];

export const brickSound = {
  /** a brick button pressed down */
  press() {
    const s = audio();
    if (!s || throttled("press", 60)) return;
    const { a, out } = s;
    const t = a.currentTime;
    burst(a, out, t, "bandpass", 2400, 5, 0.22, 0.018);
    tone(a, out, t, 190, 120, 0.12, 0.06, "sine", 0.002);
  },
  /** switching tabs: a light plastic tap */
  tap() {
    const s = audio();
    if (!s || throttled("tap", 60)) return;
    const { a, out } = s;
    const t = a.currentTime;
    burst(a, out, t, "bandpass", 3600, 6, 0.16, 0.015);
    tone(a, out, t + 0.005, 880, 990, 0.05, 0.05, "triangle");
  },
  /** a brick snapping on: studs scrape, click, click, a plastic body */
  snap() {
    const s = audio();
    if (!s || throttled("snap", 80)) return;
    const { a, out } = s;
    const t = a.currentTime;
    burst(a, out, t, "highpass", 4200, 0.8, 0.07, 0.02);
    burst(a, out, t + 0.018, "bandpass", 3400, 9, 0.5, 0.012);
    burst(a, out, t + 0.03, "bandpass", 2300, 8, 0.36, 0.014);
    tone(a, out, t + 0.02, 470, 400, 0.14, 0.07, "triangle", 0.002);
    tone(a, out, t + 0.02, 150, 110, 0.12, 0.08, "sine", 0.002);
    buzz(12);
  },
  /** pulling a brick off: a pop */
  unsnap() {
    const s = audio();
    if (!s || throttled("unsnap", 80)) return;
    const { a, out } = s;
    const t = a.currentTime;
    tone(a, out, t, 420, 780, 0.12, 0.07, "sine", 0.002);
    burst(a, out, t + 0.012, "bandpass", 2800, 6, 0.22, 0.014);
  },
  /** studs collected: a chime, higher each step of a 7-day card (1..7) */
  stud(step = 1) {
    const s = audio();
    if (!s || throttled("stud", 90)) return;
    const { a, out } = s;
    const t = a.currentTime + 0.06;
    const f = STUD_NOTES[Math.min(Math.max(step, 1), STUD_NOTES.length) - 1];
    bell(a, out, t, f, 0.16);
    bell(a, out, t + 0.07, f * 1.5, 0.09, 0.35);
    if (step >= 7) bell(a, out, t + 0.14, f * 2, 0.1, 0.6);
  },
  /** a rank up (small) or a new LEGO level (big): a fanfare and a shower of studs */
  levelUp(big = false) {
    const s = audio();
    if (!s) return;
    const { a, out } = s;
    const t = a.currentTime;
    const notes = big ? [523, 659, 784, 1047, 1319] : [659, 784, 1047];
    buzz(big ? [30, 70, 30, 70, 60] : [25, 60, 40]);
    notes.forEach((n, i) => {
      tone(a, out, t + i * 0.09, n, n, 0.1, 0.22, "square", 0.004);
      tone(a, out, t + i * 0.09, n, n, 0.12, 0.3, "triangle");
    });
    const end = t + notes.length * 0.09;
    [1047, 1319, 1568].forEach((n) => tone(a, out, end, n, n, big ? 0.09 : 0.06, big ? 1.1 : 0.6, "triangle", 0.01));
    for (let i = 0; i < (big ? 9 : 5); i++) bell(a, out, end + 0.05 + i * 0.07, STUD_NOTES[(i * 3) % STUD_NOTES.length] * 1.0, 0.06, 0.3);
    for (let i = 0; i < 10; i++) burst(a, out, end + i * 0.03 + Math.random() * 0.02, "bandpass", 1800 + Math.random() * 2600, 3, 0.1, 0.04);
  },
  /** a minifig knocked apart: pieces pop off and clatter on the table,
   *  each bounce quicker and quieter, like the LEGO games */
  scatter() {
    const s = audio();
    if (!s || throttled("scatter", 400)) return;
    const { a, out } = s;
    const t = a.currentTime;
    buzz([18, 60, 10, 40, 8]);
    // the pop as the parts come off
    tone(a, out, t, 300, 720, 0.16, 0.09, "sine", 0.002);
    burst(a, out, t, "bandpass", 2600, 4, 0.3, 0.03);
    // five pieces, each bouncing three times
    for (let p = 0; p < 5; p++) {
      let at = t + 0.16 + p * 0.045 + Math.random() * 0.03;
      let gap = 0.12 + Math.random() * 0.05;
      let g = 0.26 - p * 0.02;
      const f = 1900 + Math.random() * 2400;
      for (let b = 0; b < 3; b++) {
        burst(a, out, at, "bandpass", f, 7, g, 0.014);
        tone(a, out, at, f / 5, f / 6, g * 0.35, 0.04, "triangle", 0.001);
        at += gap;
        gap *= 0.55;
        g *= 0.5;
      }
    }
  },
  /** ...and it builds itself back: quick snaps climbing, a bright finish */
  rebuild() {
    const s = audio();
    if (!s || throttled("rebuild", 400)) return;
    const { a, out } = s;
    const t = a.currentTime;
    [0, 0.075, 0.14, 0.195].forEach((d, i) => {
      burst(a, out, t + d, "bandpass", 3000 + i * 350, 9, 0.34, 0.012);
      tone(a, out, t + d, 380 + i * 70, 330 + i * 70, 0.11, 0.06, "triangle", 0.002);
    });
    buzz([8, 60, 8, 50, 8, 40, 14]);
    bell(a, out, t + 0.27, 1568, 0.11, 0.5);
    bell(a, out, t + 0.33, 2093, 0.07, 0.45);
  },
  /** a friend at your door: knock, knock (a wooden thud and its knuckle) */
  knock() {
    const s = audio();
    if (!s || throttled("knock", 1500)) return;
    const { a, out } = s;
    const t = a.currentTime + 0.05;
    [0, 0.17, 0.52, 0.69].forEach((d, i) => {
      const g = i % 2 ? 0.8 : 1;
      burst(a, out, t + d, "lowpass", 900, 1.2, 0.5 * g, 0.05);
      burst(a, out, t + d, "bandpass", 1900, 5, 0.12 * g, 0.02);
      tone(a, out, t + d, 170, 120, 0.3 * g, 0.09, "sine", 0.002);
    });
    buzz([20, 150, 20, 330, 20, 150, 20]);
  },
  /** something went wrong: two low plonks */
  error() {
    const s = audio();
    if (!s || throttled("error", 300)) return;
    const { a, out } = s;
    const t = a.currentTime;
    tone(a, out, t, 330, 300, 0.12, 0.12, "triangle");
    tone(a, out, t + 0.13, 247, 220, 0.12, 0.18, "triangle");
  },
};
