let actx = null;
let crowdNode = null;
function ensureAudio() {
  if (!actx) actx = new AudioContext();
  if (actx.state === "suspended") void actx.resume();
}
function beep(freq, dur, type = "square", gain = 0.08, slide = 0) {
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
function noise(dur, gain = 0.1, cutoff = 900) {
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
  f.frequency.value = cutoff;
  src.connect(f).connect(g).connect(actx.destination);
  src.start();
}
function startCrowd() {
  ensureAudio();
  if (!actx || crowdNode) return;
  const n = actx.sampleRate * 2;
  const buf = actx.createBuffer(1, n, actx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.35;
  const src = actx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = actx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 420;
  f.Q.value = 0.7;
  const g = actx.createGain();
  g.gain.value = 0.045;
  src.connect(f).connect(g).connect(actx.destination);
  src.start();
  crowdNode = { src, g };
}
function stopCrowd() {
  if (!crowdNode) return;
  try { crowdNode.src.stop(); } catch {}
  crowdNode = null;
}
const SFX = {
  boost: () => {
    beep(140, 0.22, "sawtooth", 0.09, 260);
    noise(0.2, 0.09, 1200);
  },
  hit: () => {
    noise(0.16, 0.16, 1400);
    beep(110, 0.12, "square", 0.08, -50);
  },
  goal: () => {
    beep(330, 0.18, "square", 0.12);
    setTimeout(() => beep(440, 0.18, "square", 0.12), 90);
    setTimeout(() => beep(554, 0.32, "square", 0.13), 180);
    noise(0.4, 0.12, 800);
  },
  whistle: () => {
    beep(1600, 0.22, "sine", 0.1);
    setTimeout(() => beep(1500, 0.28, "sine", 0.09), 160);
  },
  crowd: (up) => {
    if (!actx) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "sawtooth";
    o.frequency.value = up ? 220 : 90;
    g.gain.setValueAtTime(1e-4, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.12);
    g.gain.exponentialRampToValueAtTime(1e-4, t + 1.1);
    const f = actx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = up ? 900 : 280;
    o.connect(f).connect(g).connect(actx.destination);
    o.start();
    o.stop(t + 1.15);
    noise(0.5, up ? 0.12 : 0.08, 700);
  },
  thunk: () => {
    beep(55, 0.16, "triangle", 0.12, -20);
    noise(0.12, 0.1, 400);
  },
  tick: () => beep(880, 0.05, "square", 0.045),
  pause: () => beep(420, 0.08, "square", 0.05)
};
export { SFX, ensureAudio, startCrowd, stopCrowd };
