const keys = Object.create(null);
const stick = { boost: false };
let qaKeys = null;
function setQaKeys(codes) {
  qaKeys = codes;
}
function bindInput(onN) {
  const down = (e) => {
    if (e.target.closest("input, textarea, [contenteditable]")) return;
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "KeyN") onN();
  };
  const up = (e) => { keys[e.code] = false; };
  const clear = () => { for (const k of Object.keys(keys)) keys[k] = false; stick.boost = false; };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clear(); });
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
  };
}
/** Boost-only touch control — no stick. Steering is always FSD. */
function bindBoost(boostBtn) {
  if (!boostBtn) return () => {};
  const bd = (e) => { e.preventDefault(); stick.boost = true; boostBtn.classList.add("hot"); };
  const bu = () => { stick.boost = false; boostBtn.classList.remove("hot"); };
  boostBtn.addEventListener("pointerdown", bd);
  boostBtn.addEventListener("pointerup", bu);
  boostBtn.addEventListener("pointercancel", bu);
  boostBtn.addEventListener("pointerleave", bu);
  return () => {
    boostBtn.removeEventListener("pointerdown", bd);
    boostBtn.removeEventListener("pointerup", bu);
    boostBtn.removeEventListener("pointercancel", bu);
    boostBtn.removeEventListener("pointerleave", bu);
  };
}
/** @deprecated stick removed — kept as alias so old calls don't explode */
function bindTouch(_pad, _knob, boostBtn) {
  return bindBoost(boostBtn);
}
function held(code) {
  if (qaKeys) return qaKeys.includes(code);
  return !!keys[code];
}
/** Player never steers. Only Ludicrous/boost is human. */
function readControls() {
  return {
    throttle: 0,
    steer: 0,
    boost: !!(held("ShiftLeft") || held("ShiftRight") || held("Space") || stick.boost)
  };
}
export { bindInput, bindTouch, bindBoost, keys, readControls, setQaKeys, stick };
