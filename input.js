const keys = Object.create(null);
const stick = { boost: false };
let qaKeys = null;
let tactic = 'auto', specialUntil = 0;
export function chooseTactic(value) { tactic = ['attack','defend'].includes(value) ? value : 'auto'; }
export function triggerSpecial() { specialUntil = performance.now()+180; }
function setQaKeys(codes) {
  qaKeys = codes;
}
export function clearInput() {
  for (const k of Object.keys(keys)) keys[k] = false;
  stick.boost = false; specialUntil = 0;
  document.getElementById('boostBtn')?.classList.remove('hot');
}
function bindInput(onN) {
  const down = (e) => {
    if (e.repeat) return;
    if (e.target.closest("input, textarea, [contenteditable]")) return;
    keys[e.code] = true;
    if(e.code==='KeyA') chooseTactic('attack');
    if(e.code==='KeyD') chooseTactic('defend');
    if(e.code==='KeyS') chooseTactic('auto');
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "KeyN" && !e.repeat) onN();
  };
  const up = (e) => { keys[e.code] = false; };
  const clear = clearInput;
  const hidden = () => { if (document.hidden) clear(); };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", hidden);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
    document.removeEventListener("visibilitychange", hidden);
  };
}
/** Boost-only touch control - no stick. Steering is always FSD. */
function bindBoost(boostBtn) {
  if (!boostBtn) return () => {};
  let pointer = null;
  const bd = (e) => { if (pointer !== null) return; pointer = e.pointerId; boostBtn.setPointerCapture?.(pointer); e.preventDefault(); stick.boost = true; boostBtn.classList.add("hot"); };
  const bu = (e) => { if (e?.pointerId !== undefined && pointer !== null && e.pointerId !== pointer) return; pointer = null; stick.boost = false; boostBtn.classList.remove("hot"); };
  const hide = () => { if (document.hidden) bu(); };
  window.addEventListener("blur", bu);
  document.addEventListener("visibilitychange", hide);
  boostBtn.addEventListener("pointerdown", bd);
  boostBtn.addEventListener("pointerup", bu);
  boostBtn.addEventListener("pointercancel", bu);
  boostBtn.addEventListener("lostpointercapture", bu);
  return () => {
    window.removeEventListener("blur", bu);
    document.removeEventListener("visibilitychange", hide);
    boostBtn.removeEventListener("pointerdown", bd);
    boostBtn.removeEventListener("pointerup", bu);
    boostBtn.removeEventListener("pointercancel", bu);
    boostBtn.removeEventListener("lostpointercapture", bu);
  };
}
/** @deprecated stick removed - kept as alias so old calls don't explode */
function bindTouch(_pad, _knob, boostBtn) {
  return bindBoost(boostBtn);
}
function held(code) {
  if (qaKeys) return qaKeys.includes(code);
  return !!keys[code];
}
/** Player calls tactics and skills; steering stays autonomous. */
function readControls() {
  return {
    tactic, special: held('KeyE') || performance.now()<specialUntil,
    throttle: 0,
    steer: 0,
    boost: !!(held("ShiftLeft") || held("ShiftRight") || held("Space") || stick.boost)
  };
}
export { bindInput, bindTouch, bindBoost, keys, readControls, setQaKeys, stick };
