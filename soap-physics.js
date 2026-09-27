/** Arcade soap movement, used only by 3D Kitchen Sink. Ball remains the AI/contact proxy. */
import { simulationConfig } from './simulation-config.js';
import { sinkHeight, sinkSurface } from './sink.js';
import { cornerContact } from './arena-geometry.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angle=n=>Math.atan2(Math.sin(n),Math.cos(n));
function bankAngles(surface,yaw) {
  const localX=surface.slopeX*Math.cos(yaw)-surface.slopeZ*Math.sin(yaw);
  const localZ=surface.slopeX*Math.sin(yaw)+surface.slopeZ*Math.cos(yaw);
  return {pitch:-Math.atan(localZ),roll:Math.atan2(localX,Math.sqrt(1+localZ*localZ))};
}

/** Call at kickoff with default options to place soap on the floor without a free launch. */
export function initSoap(ball,{drop=false}={},config=simulationConfig) {
  const radius=config.sink.soap.radius,ground=sinkHeight(ball.x,ball.z,config.sink);
  ball.y=drop?Math.max(radius,ball.y||radius):radius;
  ball.vy=drop?(ball.vy||0):0;
  ball.soap={airborne:ball.y>radius+.01 || ball.vy>1.6,worldY:ground+ball.y,
    pitch:0,yaw:Math.atan2(ball.vx||0,ball.vz||1),roll:0,spinX:0,spinY:0,spinZ:0,
    launches:0,landings:0,releases:0,releaseT:0,stallT:0,contactT:0,cooldown:0,
    anchorX:ball.x,anchorZ:ball.z,anchorAge:0,lastVX:ball.vx,lastVZ:ball.vz,goalEntry:null};
  if(!ball.soap.airborne)Object.assign(ball.soap,bankAngles(sinkSurface(ball.x,ball.z,undefined,config.sink),ball.soap.yaw));
  return ball.soap;
}

function launch(ball,up,settings,release=false) {
  const s=ball.soap;s.airborne=true;s.launches++;s.cooldown=settings.launchCooldown;
  ball.vy=clamp(up,0,settings.maxLaunch);
  s.spinX=clamp(ball.vz*.12,-3,3);s.spinZ=clamp(-ball.vx*.12,-3,3);
  s.spinY=clamp(s.spinY+(release?1.2:.35),-3,3);
}

/** Soft, force-based lip return; final projection only resolves an actual board crossing. */
function lipForces(ball,field,settings,dt) {
  const radius=settings.radius,halfX=field.FW/2,halfZ=field.FL/2;
  for(const [key,vel,half] of [['x','vx',halfX],['z','vz',halfZ]]) {
    const n=Math.sign(ball[key]),distance=Math.abs(ball[key])-(half-radius-settings.lipWidth);
    if(distance>0)ball[vel]-=n*(distance*settings.lipSpring+Math.max(0,ball[vel]*n)*settings.lipDamping)*dt;
  }
  const c=cornerContact(ball.x,ball.z,halfX,halfZ,radius+settings.lipWidth,field.corner);
  if(c) {
    const outward=Math.max(0,ball.vx*c.nx+ball.vz*c.nz),push=(c.depth*settings.lipSpring+outward*settings.lipDamping)*dt;
    ball.vx-=c.nx*push;ball.vz-=c.nz*push;
  }
}
function resolveLip(ball,field,settings) {
  for(const [key,vel,half] of [['x','vx',field.FW/2],['z','vz',field.FL/2]]) {
    const limit=half-settings.radius,n=Math.sign(ball[key]);
    if(Math.abs(ball[key])>limit) {
      ball[key]=n*limit;
      if(ball[vel]*n>0)ball[vel]=-ball[vel]*settings.lipRestitution;
    }
  }
  const c=cornerContact(ball.x,ball.z,field.FW/2,field.FL/2,settings.radius,field.corner);
  if(c) {
    ball.x-=c.nx*c.depth;ball.z-=c.nz*c.depth;
    const outward=ball.vx*c.nx+ball.vz*c.nz;
    if(outward>0){ball.vx-=(1+settings.lipRestitution)*outward*c.nx;ball.vz-=(1+settings.lipRestitution)*outward*c.nz;}
  }
}

/** First swept entry into an open drain, including rim grazes; height rules still apply. */
export function sweptSoapDrain(from,to,config=simulationConfig) {
  const sink=config.sink,settings=sink.soap,dx=to.x-from.x,dz=to.z-from.z,a=dx*dx+dz*dz;
  let first=null;
  for(const sign of [-1,1]) {
    const x=from.x,z=from.z-sign*sink.drainZ,c=x*x+z*z-settings.drainCaptureRadius**2;
    let t;
    if(c<=0)t=0;
    else if(a>1e-12) {
      const b=2*(x*dx+z*dz),disc=b*b-4*a*c;
      if(disc<0)continue;
      t=(-b-Math.sqrt(disc))/(2*a);if(t<0||t>1)continue;
    } else continue;
    const worldY=from.worldY+(to.worldY-from.worldY)*t;
    if(worldY>settings.drainCaptureHeight)continue;
    if(!first||t<first.t)first={t,sign,x:from.x+dx*t,z:from.z+dz*t,worldY};
  }
  return first;
}

export function stepSoap(ball,dt,field,config=simulationConfig) {
  const settings=config.sink.soap,radius=settings.radius;
  const s=ball.soap||initSoap(ball,{drop:true},config);
  if(s.goalEntry)return s.goalEntry.sign<0?'A':'B';
  const start={x:ball.x,z:ball.z,worldY:s.worldY};
  s.releaseT=Math.max(0,s.releaseT-dt);s.contactT=Math.max(0,s.contactT-dt);s.cooldown=Math.max(0,s.cooldown-dt);
  let surface=sinkSurface(ball.x,ball.z,undefined,config.sink);
  if(!s.airborne) {
    s.worldY=surface.height+radius;
    if(ball.vy>1.6)launch(ball,ball.vy,settings);
  }
  lipForces(ball,field,settings,dt);
  if(!s.airborne) {
    const gravity=settings.gravity/(1+surface.slopeX**2+surface.slopeZ**2);
    ball.vx-=surface.slopeX*gravity*dt;ball.vz-=surface.slopeZ*gravity*dt;
    const drag=settings.groundDrag+(settings.wetDrag-settings.groundDrag)*surface.wet,decay=Math.exp(-drag*dt);
    const travel=drag>1e-8?(1-decay)/drag:dt;
    ball.x+=ball.vx*travel;ball.z+=ball.vz*travel;ball.vx*=decay;ball.vz*=decay;
    const uphill=surface.slopeX*ball.vx+surface.slopeZ*ball.vz;
    const slope=Math.hypot(surface.slopeX,surface.slopeZ);
    if(s.cooldown===0 && slope>settings.bankSlope && uphill>settings.bankLaunchSpeed) {
      launch(ball,uphill*settings.launchScale+settings.launchLift,settings);
      s.worldY=sinkHeight(ball.x,ball.z,config.sink)+radius;
      // The rounded upper lip redirects the uphill component up and back into the bowl.
      // Preserve motion along the bank, so angled approaches remain angled aerials.
      const nx=surface.slopeX/slope,nz=surface.slopeZ/slope,outward=ball.vx*nx+ball.vz*nz;
      ball.vx-=nx*outward*(1+settings.bankReturn);ball.vz-=nz*outward*(1+settings.bankReturn);
    } else ball.vy=0;
  } else {
    const decay=Math.exp(-settings.airDrag*dt);ball.vx*=decay;ball.vz*=decay;
    ball.x+=ball.vx*dt;ball.z+=ball.vz*dt;
    s.worldY+=ball.vy*dt-.5*settings.gravity*dt*dt;ball.vy-=settings.gravity*dt;
  }
  resolveLip(ball,field,settings);
  surface=sinkSurface(ball.x,ball.z,undefined,config.sink);
  if(s.airborne && s.worldY<=surface.height+radius && ball.vy<=surface.slopeX*ball.vx+surface.slopeZ*ball.vz) {
    const landingSpeed=Math.abs(ball.vy),scale=settings.landingSlide/(1+Math.hypot(surface.slopeX,surface.slopeZ));
    ball.vx-=surface.slopeX*landingSpeed*scale;ball.vz-=surface.slopeZ*landingSpeed*scale;
    s.airborne=false;s.landings++;ball.vy=0;s.cooldown=settings.launchCooldown;
  }
  if(!s.airborne)s.worldY=surface.height+radius;
  ball.y=Math.max(radius,s.worldY-surface.height);
  // A stalled bank/contact gets a visible slip-and-hop release, never a position teleport.
  s.anchorAge+=dt;
  if(s.anchorAge>=settings.stallWindow) {
    const moved=Math.hypot(ball.x-s.anchorX,ball.z-s.anchorZ);
    const trapped=s.contactT>0 || surface.height>.2;
    s.stallT=!s.airborne&&trapped&&moved<settings.stallDistance?s.stallT+s.anchorAge:0;
    s.anchorAge=0;s.anchorX=ball.x;s.anchorZ=ball.z;
  }
  if(s.stallT>=settings.stallSeconds && s.releaseT===0) {
    const length=Math.hypot(ball.x,ball.z),side=s.releases%2?1:-1;
    const nx=length>.1?-ball.x/length:side,nz=length>.1?-ball.z/length:0;
    ball.vx+=nx*settings.releaseSpeed+nz*side;ball.vz+=nz*settings.releaseSpeed-nx*side;
    s.releases++;s.releaseT=settings.releaseSeconds;s.stallT=0;launch(ball,settings.releaseLift,settings,true);
  }
  const speed=Math.hypot(ball.vx,ball.vz),turnImpulse=(ball.vx*s.lastVZ-ball.vz*s.lastVX)*.006;
  s.spinY=clamp((s.spinY+turnImpulse)*Math.exp(-dt*(s.airborne?.1:1.2)),-4,4);
  s.yaw+=s.spinY*dt;
  if(s.airborne){s.pitch+=s.spinX*dt;s.roll+=s.spinZ*dt;}
  else {
    if(speed>1)s.yaw+=angle(Math.atan2(ball.vx,ball.vz)-s.yaw)*(1-Math.exp(-dt*.65));
    const bank=bankAngles(surface,s.yaw);
    s.pitch+=angle(bank.pitch-s.pitch)*(1-Math.exp(-dt*8));s.roll+=angle(bank.roll-s.roll)*(1-Math.exp(-dt*8));
  }
  s.pitch=angle(s.pitch);s.roll=angle(s.roll);s.yaw=angle(s.yaw);s.lastVX=ball.vx;s.lastVZ=ball.vz;
  const entry=sweptSoapDrain(start,{x:ball.x,z:ball.z,worldY:s.worldY},config);
  if(entry) {
    s.goalEntry={x:entry.x,z:entry.z,worldY:entry.worldY,vx:ball.vx,vy:ball.vy,vz:ball.vz,speed,sign:entry.sign};
    ball.x=entry.x;ball.z=entry.z;s.worldY=entry.worldY;ball.y=entry.worldY-sinkHeight(entry.x,entry.z,config.sink);
    return entry.sign<0?'A':'B';
  }
  return null;
}
