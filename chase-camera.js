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

/** One persistent, damped rig owns the play camera. Its field-relative heading
 * does not orbit with the driver's steering. Zoom is solved on a scratch camera,
 * never applied directly to the rendered camera. */
export function createPlayCamera(camera) {
  const probe=camera.clone(), aim=camera.position.clone(), wanted=camera.position.clone();
  const point=camera.position.clone();
  const velocity={y:0,tx:0,ty:0,tz:0,offset:0,lateral:0};
  const pose={offset:17,lateral:0};
  let initialized=false;
  function damp(object,key,goal,vkey,dt,smooth,maxSpeed) {
    // Critically damped spring with a bounded travel speed and no overshoot.
    const omega=2/smooth,x=omega*dt,decay=1/(1+x+.48*x*x+.235*x*x*x);
    const original=goal;
    let change=Math.max(-maxSpeed*smooth,Math.min(maxSpeed*smooth,object[key]-goal));
    goal=object[key]-change;
    const temp=(velocity[vkey]+omega*change)*dt;
    velocity[vkey]=(velocity[vkey]-omega*temp)*decay;
    let next=goal+(change+temp)*decay;
    if((original-object[key]>0)===(next>original)){next=original;velocity[vkey]=0;}
    object[key]=next;
  }
  return {
    reset(){initialized=false;},
    update(target,car,ball,field,dt,side=1) {
      dt=Math.max(0,Math.min(.05,dt));
      if(!initialized){for(const k in velocity)velocity[k]=0;pose.offset=(camera.position.z-target.z)*side;pose.lateral=camera.position.x-target.x;initialized=true;}
      const dx=ball.x-car.x,dz=ball.z-car.z,d=Math.hypot(dx,dz);
      const weight=Math.min(.4,12/Math.max(1,d));
      aim.set(car.x+dx*weight,1.2+Math.min(3,Math.max(0,ball.y-1)*.25),car.z+dz*weight);
      aim.x=Math.max(-field.FW/2+6,Math.min(field.FW/2-6,aim.x));
      aim.z=Math.max(-field.FL/2+9,Math.min(field.FL/2-9,aim.z));
      wanted.set(aim.x,22,aim.z+side*17);
      wanted.x=Math.max(-field.FW/2+3,Math.min(field.FW/2-3,wanted.x));
      wanted.z=Math.max(-field.FL/2+3,Math.min(field.FL/2-3,wanted.z));
      probe.aspect=camera.aspect;probe.fov=camera.fov;probe.updateProjectionMatrix();
      const fits=height=>{
        probe.position.set(wanted.x,height,wanted.z);probe.lookAt(aim);probe.updateMatrixWorld();
        return [car,ball].every(p=>{
          point.set(p.x,p===car?1.5:p.y,p.z).project(probe);
          return Math.abs(point.x)<.7&&point.y>-.58&&point.y<.52&&point.z>-1&&point.z<1;
        });
      };
      // Continuous bisection avoids the old 12% zoom steps. Limit wide views;
      // a screen-space ball cue handles distance/occlusion beyond this framing.
      let low=22,high=camera.aspect<1?48:36;
      if(!fits(low)){for(let i=0;i<10;i++){const mid=(low+high)/2;if(fits(mid))high=mid;else low=mid;}wanted.y=high;}

      damp(camera.position,'y',wanted.y,'y',dt,.8,22);
      damp(target,'x',aim.x,'tx',dt,.55,22);
      damp(target,'y',aim.y,'ty',dt,.6,8);
      damp(target,'z',aim.z,'tz',dt,.55,22);
      const offset=Math.max(6,Math.min(17,field.FL/2-3-side*target.z));
      damp(pose,'offset',offset,'offset',dt,.7,12);
      damp(pose,'lateral',0,'lateral',dt,.7,12);
      camera.position.x=target.x+pose.lateral;camera.position.z=target.z+side*pose.offset;
      probe.position.copy(camera.position);probe.lookAt(target);
      camera.quaternion.rotateTowards(probe.quaternion,dt*1.4);camera.updateMatrixWorld();
    }
  };
}
