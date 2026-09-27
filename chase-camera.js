/** Keep the chase viewpoint inside the playable rectangle, in front of castle
 * towers. Apply after smoothing and minimum-distance adjustment, so neither can
 * push it back through scenery. The higher near-board view preserves context. */
export function constrainChase(position, halfWidth, halfLength) {
  const nearBoard=Math.abs(position.x)>halfWidth-5 || Math.abs(position.z)>halfLength-5;
  position.x=Math.max(-halfWidth+2,Math.min(halfWidth-2,position.x));
  position.z=Math.max(-halfLength+2,Math.min(halfLength-2,position.z));
  if(nearBoard)position.y=Math.max(12,position.y);
  return position;
}

/** Keep the car footprint and ball inside a HUD-safe part of the viewport.
 * Projection is supplied by the renderer so this remains independent of Three.
 * Start with the normal smoothed chase view; only widen when needed. */
export function framePlay(camera, target, car, ball, radius, project) {
  const points=[];
  const c=Math.cos(car.yaw),s=Math.sin(car.yaw);
  for(const a of [-1,1])for(const b of [-1,1])for(const y of [0,3])
    points.push({x:car.x+c*car.hx*a+s*car.hz*b,y,z:car.z-s*car.hx*a+c*car.hz*b});
  for(const axis of ['x','y','z'])for(const sign of [-1,1])
    points.push({...ball,[axis]:ball[axis]+sign*radius});
  const fits=()=>points.every(p=>{const q=project(p);return Math.abs(q.x)<=.78 && q.y>=-.68 && q.y<=.58 && q.z>-1 && q.z<1;});
  camera.lookAt(target);camera.updateMatrixWorld();
  if(fits())return;
  target.x=(car.x+ball.x)/2;target.y=Math.max(1,ball.y/2);target.z=(car.z+ball.z)/2;
  // Immediate expansion protects fast turns; normal chase interpolation eases in.
  for(let i=0;i<32;i++){
    camera.lookAt(target);camera.updateMatrixWorld();
    if(fits())break;
    camera.position.y=camera.position.y*1.12+1;
  }
}
