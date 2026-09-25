import { cornerContact } from './arena-geometry.js';

/** A setup point has room to rotate; a contact point fits the intended heading.
 * Project every footprint corner, including the rounded boards in both modes. */
export function reachableTarget(x, z, car, field, yaw = null) {
  const hx = car.hx ?? car.w*.55, hz = car.hz ?? car.l*.5;
  const radius = Math.hypot(hx,hz);
  const c = yaw === null ? 1 : Math.cos(yaw), s = yaw === null ? 0 : Math.sin(yaw);
  const ex = yaw === null ? radius : Math.abs(c)*hx+Math.abs(s)*hz;
  const ez = yaw === null ? radius : Math.abs(s)*hx+Math.abs(c)*hz;
  const depth = field.pixelTight && Math.abs(x)+ex<field.GOAL_W/2 ? field.goalDepth : 0;
  x=Math.max(-field.FW/2+ex,Math.min(field.FW/2-ex,x));
  z=Math.max(-field.FL/2-depth+ez,Math.min(field.FL/2+depth-ez,z));
  if(field.corner>0)for(let iteration=0;iteration<4;iteration++) {
    if(yaw===null){const hit=cornerContact(x,z,field.FW/2,field.FL/2,radius,field.corner);if(hit){x-=hit.nx*hit.depth;z-=hit.nz*hit.depth;}}
    else for(const a of [-1,1])for(const b of [-1,1]){
      const hit=cornerContact(x+c*hx*a+s*hz*b,z-s*hx*a+c*hz*b,field.FW/2,field.FL/2,0,field.corner);
      if(hit){x-=hit.nx*hit.depth;z-=hit.nz*hit.depth;}
    }
  }
  return {x,z};
}
