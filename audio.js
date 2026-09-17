let actx = null;
function ensureAudio() {
  if (!actx) actx = new AudioContext();
  if (actx.state === "suspended") void actx.resume();
}
function beep(freq, dur, type = "square", gain = 0.06, slide = 0) {
  if (!actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur, gain = 0.08) {
  if (!actx) return;
  const n = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, n, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = actx.createBufferSource();
  src.buffer = buf;
  const g = actx.createGain();
  g.gain.value = gain;
  const f = actx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  src.connect(f).connect(g).connect(actx.destination);
  src.start();
}
const SFX = {
  boost: () => {
    beep(140, 0.18, "sawtooth", 0.05, 220);
    noise(0.16, 0.05);
  },
  hit: () => {
    noise(0.12, 0.1);
    beep(90, 0.1, "square", 0.05, -40);
  },
  goal: () => {
    beep(330, 0.15, "square", 0.07);
    setTimeout(() => beep(440, 0.15, "square", 0.07), 90);
    setTimeout(() => beep(554, 0.28, "square", 0.08), 180);
  },
  whistle: () => beep(1400, 0.35, "sine", 0.05),
  crowd: (up) => {
    if (!actx) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "sawtooth";
    o.frequency.value = up ? 180 : 90;
    g.gain.setValueAtTime(1e-4, t);
    g.gain.exponentialRampToValueAtTime(0.04, t + 0.15);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 0.9);
    const f = actx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = up ? 700 : 300;
    o.connect(f).connect(g).connect(actx.destination);
    o.start();
    o.stop(t + 1);
  },
  thunk: () => {
    beep(55, 0.12, "triangle", 0.08, -20);
    noise(0.08, 0.06);
  },
  tick: () => beep(880, 0.05, "square", 0.03)
};
export {
  SFX,
  ensureAudio
};
