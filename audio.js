let actx = null;
let sfxBus = null;
let crowdNode = null;
const GH = "https://cdn.jsdelivr.net/gh/foxandhenllc/groketleague-web@main/music/";
const beds = {
  garage: ["/music/garage.mp3", GH + "garage.mp3"],
  day: ["/music/day.mp3", GH + "day.mp3"],
  night: ["/music/night.mp3", GH + "night.mp3"]
};
const players = {};
const loading = {};
let currentBed = null;
let bedVolume = 0.38;
let musicRevision = 0;
const fades = new WeakMap();
const playRequests = new WeakMap();
let musicMuted = localStorage.getItem("gl_mute_music") === "1";
let sfxMuted = localStorage.getItem("gl_mute_sfx") === "1";

function isMusicMuted() { return musicMuted; }
function isSfxMuted() { return sfxMuted; }
function setMusicMuted(value) {
  musicMuted = !!value;
  musicRevision++;
  localStorage.setItem("gl_mute_music", musicMuted ? "1" : "0");
  if (musicMuted) {
    // Also silence an outgoing bed that is still crossfading.
    Object.values(players).forEach(el => fadeTo(el, 0, 120));
  } else if (currentBed) {
    startBed(currentBed, bedVolume, 240);
  }
}
function setSfxMuted(value) {
  sfxMuted = !!value;
  localStorage.setItem("gl_mute_sfx", sfxMuted ? "1" : "0");
  if (sfxBus) sfxBus.gain.setValueAtTime(sfxMuted ? 0 : 1, actx.currentTime);
  if (sfxMuted) stopCrowd();
}

async function resolveBedUrl(name) {
  const urls = beds[name] || [];
  for (const mp3 of urls) {
    try {
      const res = await fetch(mp3, { cache: "force-cache" });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 4000) {
          return URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
        }
      }
    } catch {}
  }
  return urls[urls.length - 1] || "";
}

function ensureAudio(restartMusic = true) {
  if (!actx) {
    actx = new AudioContext();
    sfxBus = actx.createGain();
    sfxBus.gain.value = sfxMuted ? 0 : 1;
    sfxBus.connect(actx.destination);
  }
  if (actx.state === "suspended") void actx.resume();
  if (restartMusic && !musicMuted && currentBed && players[currentBed]?.paused) startBed(currentBed, bedVolume, 240);
}

function getBed(name) {
  if (players[name]) return players[name];
  const el = new Audio();
  el.loop = true;
  el.preload = "auto";
  el.volume = 0;
  el.crossOrigin = "anonymous";
  el.src = (beds[name] && beds[name][0]) || "";
  players[name] = el;
  if (!loading[name]) {
    loading[name] = resolveBedUrl(name).then((url) => {
      // A healthy local stream should not restart when the fallback fetch finishes.
      if (url && url !== el.src && (el.readyState < 2 || el.error)) {
        el.src = url;
        if (currentBed === name && !musicMuted) startBed(name, bedVolume, 240);
      } else if (url && url !== el.src && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      return el;
    }).catch(() => el);
  }
  return el;
}

function cancelFade(el) {
  const fade = fades.get(el);
  if (fade) cancelAnimationFrame(fade.frame);
  fades.delete(el);
}
function fadeTo(el, vol, ms = 600) {
  cancelFade(el);
  const fade = { frame: 0 };
  fades.set(el, fade);
  const start = el.volume;
  const t0 = performance.now();
  function step(now) {
    if (fades.get(el) !== fade) return;
    const k = Math.min(1, (now - t0) / ms);
    el.volume = Math.max(0, Math.min(1, start + (vol - start) * k));
    if (k < 1) fade.frame = requestAnimationFrame(step);
    else {
      fades.delete(el);
      if (vol <= 0.001) { el.pause(); el.volume = 0; }
    }
  }
  fade.frame = requestAnimationFrame(step);
}

function startBed(name, vol, fadeMs) {
  const el = getBed(name), revision = musicRevision;
  const request = (playRequests.get(el) || 0) + 1;
  playRequests.set(el, request);
  // Cancel synchronously, before play() settles, so an old fade cannot pause it.
  cancelFade(el);
  const wanted = () => !musicMuted && currentBed === name && musicRevision === revision && playRequests.get(el) === request;
  function play(retry) {
    if (!wanted()) return;
    void el.play().then(() => {
      if (wanted()) fadeTo(el, vol, fadeMs);
    }).catch(() => {
      if (retry && wanted() && loading[name]) void loading[name].then(() => play(false));
    });
  }
  play(true);
}

function playBed(name, vol = 0.38) {
  ensureAudio(false);
  if (!musicMuted && currentBed === name && bedVolume === vol && players[name] && !players[name].paused) return;
  musicRevision++;
  if (currentBed && players[currentBed] && currentBed !== name) {
    fadeTo(players[currentBed], 0, 500);
  }
  currentBed = name;
  bedVolume = vol;
  if (!musicMuted) startBed(name, vol, 700);
}

function stopBed() {
  musicRevision++;
  if (currentBed && players[currentBed]) fadeTo(players[currentBed], 0, 400);
  currentBed = null;
}

function beep(freq, dur, type = "square", gain = 0.08, slide = 0) {
  if (sfxMuted || !actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur, gain = 0.1, cutoff = 900) {
  if (sfxMuted || !actx) return;
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
  src.connect(f).connect(g).connect(sfxBus);
  src.start();
}
function startCrowd() {
  ensureAudio();
  if (sfxMuted || !actx || crowdNode) return;
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
  src.connect(f).connect(g).connect(sfxBus);
  src.start();
  crowdNode = { src, g };
}
function stopCrowd() {
  if (!crowdNode) return;
  try { crowdNode.src.stop(); } catch {}
  crowdNode = null;
}
const _SFX_RAW = {
  soapCatch: () => { beep(470,.2,'sine',.07,-240); noise(.2,.04,1900); },
  soapAir: () => { noise(.23,.045,2100); beep(250,.2,'sine',.045,190); },
  soapLand: () => { noise(.16,.075,900); beep(130,.12,'triangle',.05,-60); },
  soapSlip: () => { beep(580,.12,'sine',.04,220); },
  bubbles: () => { for(let i=0;i<4;i++)setTimeout(()=>beep(440+i*130,.11,'sine',.055,150),i*80); },
  hazardWarning: () => { beep(520,.13,'triangle',.05,160); },
  tapWarning: () => { beep(380,.14,'sine',.05,190); },
  water: () => { noise(.65,.06,2200); },
  drain: () => { noise(.45,.07,520); beep(210,.4,'sine',.07,-145); },
  meteor: () => { noise(.35,.14,350); beep(70,.25,'triangle',.12,-45); },
  zap: () => { noise(.16,.1,4200); beep(800,.15,'sawtooth',.07,-600); },
  perfect: () => { beep(660,.1,'sine',.09); setTimeout(()=>beep(990,.12,'sine',.09),65); },
  save: () => { beep(440,.18,'triangle',.12,220); },
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
    if (sfxMuted || !actx) return;
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
    o.connect(f).connect(g).connect(sfxBus);
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

function armSfx(obj) {
  const out = {};
  for (const [k, fn] of Object.entries(obj)) {
    out[k] = (...args) => {
      try { return fn(...args); } catch (err) { console.warn("[sfx]", k, err); }
    };
  }
  return out;
}
const SFX = armSfx(_SFX_RAW);
export { SFX, ensureAudio, startCrowd, stopCrowd, playBed, stopBed, isMusicMuted, isSfxMuted, setMusicMuted, setSfxMuted };
