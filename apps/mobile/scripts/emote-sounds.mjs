// Synthesises the placeholder emote sounds into assets/sounds/ (16-bit mono WAV).
// Run from apps/mobile: `node scripts/emote-sounds.mjs`. Replace any file with a real
// recording of the same name whenever one exists; nothing else needs to change.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

/** Seeded noise, so every run writes the same files. */
function noise(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff * 2 - 1;
  };
}

function render(seconds, sample) {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = sample(i / RATE, i);
  // Normalise to a little under full scale.
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return out.map(v => (v / peak) * 0.85);
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** One-pole low-pass: `k` near 0 is darker, near 1 brighter. */
function lowpass() {
  let y = 0;
  return (x, k) => (y += k * (x - y));
}

const sounds = {
  // A sharp palm slap: bright noise crack over a short low thump.
  'high-five': () => {
    const rnd = noise(1);
    let prev = 0;
    return render(0.18, t => {
      const n = rnd();
      const bright = n - prev; // differencing tilts the noise towards the highs
      prev = n;
      const crack = bright * Math.exp(-t / 0.018);
      const thump = Math.sin(2 * Math.PI * 170 * t) * Math.exp(-t / 0.035) * 0.6;
      return crack + thump;
    });
  },
  // A wet splat: a dark burst with a falling squelch, then a few drips.
  splat: () => {
    const rnd = noise(2);
    const lp = lowpass();
    let phase = 0;
    return render(0.45, t => {
      const body = lp(rnd(), 0.25) * Math.exp(-t / 0.08) * 1.6;
      phase += 2 * Math.PI * (260 * Math.exp(-t / 0.06) + 70) / RATE;
      const squelch = Math.sin(phase) * Math.exp(-t / 0.07) * 0.7;
      const drip = [0.2, 0.29, 0.37].reduce((sum, at, i) => {
        const d = t - at;
        return d < 0 ? sum : sum + Math.sin(2 * Math.PI * (900 + i * 250) * d * (1 - d * 6)) * Math.exp(-d / 0.012) * 0.25;
      }, 0);
      return body + squelch + drip;
    });
  },
  // A snowball bursting: a soft, crumbly crunch.
  poof: () => {
    const rnd = noise(3);
    const lp = lowpass();
    return render(0.3, t => {
      const crumble = lp(rnd(), 0.5) * Math.exp(-t / 0.07);
      const crackle = rnd() > 0.93 ? rnd() * Math.exp(-t / 0.09) * 0.8 : 0;
      return crumble + crackle;
    });
  },
  // Something flying past: noise swelling and fading as its brightness sweeps up and down.
  whoosh: () => {
    const rnd = noise(4);
    const lp = lowpass();
    const D = 0.32;
    return render(D, t => {
      const p = t / D;
      const env = Math.sin(Math.PI * p) ** 2;
      return lp(rnd(), 0.04 + 0.25 * env) * env;
    });
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(make()));
  console.log('wrote', file);
}
