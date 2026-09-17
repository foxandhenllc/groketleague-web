const keys = Object.create(null);
const stick = { x: 0, y: 0, boost: false };
let qaKeys = null;
function setQaKeys(codes) {
  qaKeys = codes;
}
function bindInput(onN) {
  const down = (e) => {
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "KeyN") onN();
  };
  const up = (e) => {
    keys[e.code] = false;
  };
  const clear = () => {
    for (const k of Object.keys(keys)) keys[k] = false;
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clear();
  });
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
  };
}
function bindTouch(pad, knob, boostBtn) {
  function setStick(cx, cy) {
    const r = pad.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height / 2);
    const m = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, m / (r.width * 0.38));
    stick.x = dx / m * k;
    stick.y = dy / m * k;
    knob.style.left = 41 + stick.x * 36 + "px";
    knob.style.top = 41 + stick.y * 36 + "px";
  }
  function resetStick() {
    stick.x = 0;
    stick.y = 0;
    knob.style.left = "41px";
    knob.style.top = "41px";
  }
  const pd = (e) => {
    pad.setPointerCapture(e.pointerId);
    setStick(e.clientX, e.clientY);
  };
  const pm = (e) => {
    if (e.buttons) setStick(e.clientX, e.clientY);
  };
  pad.addEventListener("pointerdown", pd);
  pad.addEventListener("pointermove", pm);
  pad.addEventListener("pointerup", resetStick);
  pad.addEventListener("pointercancel", resetStick);
  const bd = (e) => {
    e.preventDefault();
    stick.boost = true;
  };
  const bu = () => {
    stick.boost = false;
  };
  boostBtn.addEventListener("pointerdown", bd);
  boostBtn.addEventListener("pointerup", bu);
  boostBtn.addEventListener("pointercancel", bu);
  return () => {
    pad.removeEventListener("pointerdown", pd);
    pad.removeEventListener("pointermove", pm);
    pad.removeEventListener("pointerup", resetStick);
    pad.removeEventListener("pointercancel", resetStick);
    boostBtn.removeEventListener("pointerdown", bd);
    boostBtn.removeEventListener("pointerup", bu);
    boostBtn.removeEventListener("pointercancel", bu);
  };
}
function held(code) {
  if (qaKeys) return qaKeys.includes(code);
  return !!keys[code];
}
function readControls() {
  let th = 0;
  let st = 0;
  if (held("KeyW") || held("ArrowUp")) th += 1;
  if (held("KeyS") || held("ArrowDown")) th -= 1;
  if (held("KeyA") || held("ArrowLeft")) st += 1;
  if (held("KeyD") || held("ArrowRight")) st -= 1;
  th += -stick.y;
  st += -stick.x;
  return {
    throttle: Math.max(-1, Math.min(1, th)),
    steer: Math.max(-1, Math.min(1, st)),
    boost: !!(held("ShiftLeft") || held("ShiftRight") || held("Space") || stick.boost)
  };
}
export {
  bindInput,
  bindTouch,
  keys,
  readControls,
  setQaKeys,
  stick
};
