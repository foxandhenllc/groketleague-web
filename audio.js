let actx = null;
let crowdNode = null;
const beds = {
  garage: "/music/garage.mp3",
  day: "/music/day.mp3",
  night: "/music/night.mp3"
};
const MAX_PARTS = 16;
const players = {};
const loading = {};
let currentBed = null;

async function resolveBedUrl(name) {
  const mp3 = beds[name];
  try {
    const res = await fetch(mp3, { method: "GET", cache: "force-cache" });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      if (buf.byteLength > 4000) {
        return URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      }
    }
  } catch {}
  const texts = await Promise.all(
    Array.from({ length: MAX_PARTS }, (_, i) =>
      fetch(`/music/${name}.${i + 1}.b64`).then((r) => (r.ok ? r.text() : "")).catch(() => "")
    )
  );
  const b64 = texts.join("").replace(/\s+/g, "");
  if (!b64) return mp3;
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bin], { type: "audio/mpeg" }));
}

function ensureAudio() {
  if (!actx) actx = new AudioContext();
  if (actx.state === "suspended") void actx.resume();
  Object.values(players).forEach((p) => {
    if (p.paused && currentBed && players[currentBed] === p) void p.play().catch(() => {});
  });
}

function getBed(name) {
  if (players[name]) return players[name];
  const el = new Audio();
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  el.src = beds[name];
  players[name] = el;
  if (!loading[name]) {
    loading[name] = resolveBedUrl(name).then((url) => {
      if (url && url !== el.src) {
        const playing = currentBed === name && !el.paused;
        el.src = url;
        if (playing) void el.play().catch(() => {});
      }
      return el;
    }).catch(() => el);
  }
  return el;
}

function fadeTo(el, vol, ms = 600) {
  const start = el.volume;
  const t0 = performance.now();
  function step(now) {
    const k = Math.min(1, (now - t0) / ms);
    el.volume = Math.max(0, Math.min(1, start + (vol - start) * k));
    if (k < 1) requestAnimationFrame(step);
    else if (vol <= 0.001) { el.pause(); el.volume = 0; }
  }
  requestAnimationFrame(step);
}

function playBed(name, vol = 0.38) {
  ensureAudio();
  if (currentBed === name && players[name] && !players[name].paused) return;
  if (currentBed && players[currentBed] && currentBed !== name) {
    fadeTo(players[currentBed], 0, 500);
  }
  const el = getBed(name);
  currentBed = name;
  if (el.volume < 0.02) el.volume = 0;
  void el.play().then(() => fadeTo(el, vol, 700)).catch(() => {
    if (loading[name]) {
      loading[name].then(() => {
        if (currentBed === name) void el.play().then(() => fadeTo(el, vol, 700)).catch(() => {});
      });
    }
  });
}

function stopBed() {
  if (currentBed && players[currentBed]) fadeTo(players[currentBed], 0, 400);
  currentBed = null;
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
  g.gain.value = 0.03;
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
export { SFX, ensureAudio, startCrowd, stopCrowd, playBed, stopBed };
