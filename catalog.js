import { deepFreeze, simulationConfig } from "./simulation-config.js";
import CHARACTERS from "./characters.js";

const CATALOG = deepFreeze(CHARACTERS.characters.map((c) => ({
  id: c.id,
  name: c.name,
  tag: c.tag,
  meme: c.meme,
  stats: c.stats,
  accent: c.accent,
  spec: {
    hx: c.w * simulationConfig.drive.hitbox.w_factor,
    hz: c.l * simulationConfig.drive.hitbox.l_factor,
    w: c.w,
    l: c.l,
    mass: c.mass,
    accel: c.accel,
    max: c.max,
    turn: c.turn,
    grip: c.grip,
    boostMax: c.boostMax,
    w_bu: c.w_bu,
    l_bu: c.l_bu,
    draw_length_px: c.draw_length_px,
    draw_width_px: c.draw_width_px
  }
})));

function byId(id) {
  return CATALOG.find((v) => v.id === id);
}

const FW = simulationConfig.modes['3d'].width;
const FL = simulationConfig.modes['3d'].length;
const GOAL_W = simulationConfig.modes['3d'].goalWidth;
const GOAL_H = simulationConfig.modes['3d'].goalHeight;

/** PIXEL playable aspect from clamp; used when setPixelTight(true). */
function pixelFieldSize() {
  const [x0, y0, x1, y1] = CHARACTERS.modes.pixel.physics_clamp_xyxy;
  const playW = x1 - x0 + 1;
  const playH = y1 - y0 + 1;
  const fieldL = FL;
  // Coordinates describe boundary lines; use their spans for both axes.
  const pixelsPerUnit = (y1 - y0) / fieldL;
  const fieldW = (x1 - x0) / pixelsPerUnit;
  return { fieldW, fieldL, playW, playH, pixelsPerUnit, clamp: { x0, y0, x1, y1 } };
}

function ballRadius(pixel = false) {
  return pixel ? simulationConfig.ball.radiusPixel : simulationConfig.ball.radius3d;
}

export {
  CATALOG,
  CHARACTERS,
  FL,
  FW,
  GOAL_H,
  GOAL_W,
  byId,
  ballRadius,
  pixelFieldSize
};
