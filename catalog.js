const CATALOG = [
  {
    id: "cybertruck",
    name: "CYBERT RUCKER",
    tag: "THE FRIDGE",
    meme: "Angular dumpster that learned car-soccer on a dare. Dump Ludicrous Juice into the ball and pancake it like a bad earnings call.",
    stats: "MASS 10 \u00b7 SPEED 4 \u00b7 TURN 3 \u00b7 SPECIAL: PANCAKE",
    accent: "#c5ccd1",
    spec: { w: 2.2, l: 4.85, mass: 3.1, accel: 24, max: 19.5, turn: 1.55, grip: 6.2, boostMax: 1 }
  },
  {
    id: "model3",
    name: "MODEST 3",
    tag: "THE DART",
    meme: "Quiet until it isn't. Instant torque, zero personality, still posting about range anxiety fanfic. Do not give it a clean run.",
    stats: "MASS 3 \u00b7 SPEED 9 \u00b7 TURN 9 \u00b7 SPECIAL: SNAP TURN",
    accent: "#3b82ff",
    spec: { w: 1.8, l: 4.2, mass: 1.3, accel: 38, max: 28, turn: 2.7, grip: 10, boostMax: 0.75 }
  },
  {
    id: "cybercab",
    name: "ROB TACKSY",
    tag: "NO STEERING WHEEL",
    meme: "Self-driving cab energy. You are the liability. It already filed a vibes-based incident report on your last touch.",
    stats: "MASS 2 \u00b7 SPEED 8 \u00b7 TURN 10 \u00b7 SPECIAL: SOAP SHOES",
    accent: "#e8edf2",
    spec: { w: 1.65, l: 3.5, mass: 1.05, accel: 34, max: 26, turn: 3.15, grip: 12, boostMax: 0.7 }
  },
  {
    id: "semi",
    name: "SEEMEE",
    tag: "THE GOALIE THAT IS THE GOAL",
    meme: "If the pitch is a hallway, you are the hallway. Scoring is a war crime. Parking across the net is the whole product roadmap.",
    stats: "MASS 12 \u00b7 SPEED 2 \u00b7 TURN 2 \u00b7 SPECIAL: WALL",
    accent: "#ef4444",
    spec: { w: 2.6, l: 7.2, mass: 4.6, accel: 16, max: 15, turn: 1.15, grip: 5.2, boostMax: 1.15 }
  }
];
function byId(id) {
  return CATALOG.find((v) => v.id === id);
}
const FW = 44;
const FL = 68;
const GOAL_W = 11;
const GOAL_H = 4.2;
export {
  CATALOG,
  FL,
  FW,
  GOAL_H,
  GOAL_W,
  byId
};
