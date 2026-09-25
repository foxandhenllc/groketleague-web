import CHARACTERS from './characters.js';
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze); Object.freeze(value);
  }
  return value;
}
export function validateConfig(config) {
  const walk = value => {
    if(typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Non-finite configuration');
    if(value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(config);
  if(config.cars.length !== 4 || new Set(config.cars.map(c=>c.id)).size !== 4 || config.cars.some(c=>!['cybertruck','model3','cybercab','semi'].includes(c.id))) throw new TypeError('Invalid roster');
  for(const c of config.cars) for(const k of ['mass','w','l','accel','max','turn','grip','boostMax'])
    if(!(c[k]>0))throw new TypeError(`Invalid ${c.id}.${k}`);
  if(!(config.ball.mass>0) || !(config.ball.ground_friction>0 && config.ball.ground_friction<1))throw new TypeError('Invalid ball');
  return config;
}
// Only simulation inputs enter the network hash. Palette, prose and legacy atlas metadata do not.
export const simulationConfig = deepFreeze(validateConfig({
  schemaVersion:2, fixedHz:120,
  cars:CHARACTERS.characters.map(c=>({...Object.fromEntries(['id','w','l','mass','accel','max','turn','grip','boostMax'].map(k=>[k,c[k]])), brake:({cybertruck:30,model3:44,cybercab:42,semi:26})[c.id]})),
  ball:{...CHARACTERS.ball, radiusPixel:.9, radius3d:.5502,
    carHeight:1.25, settleSpeed:1.1, maxSpeed:55, maxUp:28, maxDown:-40, maxHeight:18,
    lift:.2, liftOrdinary:5.5, liftHeavy:1.2},
  drive:{...CHARACTERS.drive, carRestitution:.25, boardRestitution:.18, startThreshold:.18,
    rearmSeconds:.12, rechargeDelay:.25, safetyHeading:.9, controlSeconds:.25, reverseMax:5,
    reverseEntry:.5, invalidSpeed:80, accelerationTaper:.15},
  planner:{rollingK:.846, revision:'baseline-goal-directed-1'},
  contacts:{velocityIterations:4, positionIterations:2, slop:.005, correction:.8, maxCorrection:.20,
    bounceThreshold:1, opposingDot:-.8, launchRestitutionSpeed:48},
  modes:{pixel:{geometryId:'legacy-circuit-1',width:44,length:68,goalWidth:11,goalHeight:4.2,corner:7,depth:5.2,sideOffset:0},
    '3d':{geometryId:'legacy-castle-1',width:44,length:68,goalWidth:11,goalHeight:4.2,corner:0,depth:0,sideOffset:.9}}
}));
