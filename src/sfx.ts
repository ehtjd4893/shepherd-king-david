// Synthesized placeholder sound effects (no asset files). Swap for recorded sounds in milestone 2.
let ac: AudioContext | null = null;
const ctx = () => {
  ac ??= new AudioContext();
  if (ac.state === 'suspended') void ac.resume();
  return ac;
};
// Browsers only allow audio after a user gesture.
for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, () => ctx(), { once: true });

function noise(dur: number, from: number, to: number, gain: number, type: BiquadFilterType = 'bandpass') {
  const a = ctx(), t = a.currentTime, n = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = buf; f.type = type;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.destination); src.start(t);
}
function tone(dur: number, from: number, to: number, gain: number, type: OscillatorType = 'sine', delay = 0) {
  const a = ctx(), t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
}

export const sfx = {
  swing: () => noise(0.09, 2400, 700, 0.25),
  hit: () => { noise(0.08, 1800, 400, 0.6); tone(0.12, 180, 60, 0.7); },
  heavy: () => { noise(0.14, 1400, 200, 0.8); tone(0.22, 140, 40, 0.9, 'triangle'); },
  sling: () => noise(0.16, 900, 4200, 0.35, 'highpass'),
  jump: () => tone(0.1, 300, 520, 0.15, 'square'),
  hurt: () => { noise(0.1, 900, 300, 0.5); tone(0.15, 260, 120, 0.4, 'sawtooth'); },
  clank: () => { tone(0.12, 1500, 1100, 0.18, 'square'); noise(0.06, 5000, 3000, 0.3, 'highpass'); },
  harp: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(0.8, f, f, 0.14, 'triangle', i * 0.12)),
  bark: () => { tone(0.07, 700, 420, 0.25, 'square'); tone(0.07, 650, 380, 0.2, 'square', 0.1); },
  roar: () => { noise(0.9, 500, 120, 0.9, 'lowpass'); tone(0.9, 110, 55, 0.6, 'sawtooth'); },
  baa: () => { tone(0.35, 520, 470, 0.12, 'sawtooth'); tone(0.35, 528, 476, 0.1, 'sawtooth'); },
  special: () => { [392, 494, 587, 784].forEach((f, i) => tone(0.7, f, f, 0.18, 'triangle', i * 0.06)); noise(0.5, 300, 3000, 0.4); },
};
