/** Stable perspective framing inside the sink HUD's reserved content rectangle. */
export function sinkCameraFrame(width,height,fov=52) {
  const short=height<=500&&width>500,phone=width<=600,inset=width<=700?116:156;
  const rect=short?{left:inset,top:24,right:width-inset,bottom:height-24}
    :{left:12,top:phone?122:116,right:width-12,bottom:height-(phone?182:152)};
  const usableW=Math.max(80,rect.right-rect.left),usableH=Math.max(100,rect.bottom-rect.top);
  const wide=usableW>usableH*1.15;
  const direction=wide?[.58,.79,.22]:[0,.94,.34];
  const n=Math.hypot(...direction),[dx,dy,dz]=direction.map(v=>v/n),horizontal=Math.hypot(dx,dz);
  const right=[dz/horizontal,0,-dx/horizontal],up=[-dy*dx/horizontal,horizontal,-dy*dz/horizontal];
  const tan=Math.tan(fov*Math.PI/360),aspect=width/height;
  let distance=1;
  // Include the chrome rim and raised shoulders; props outside the rim are decorative.
  for(const x of [-24,24])for(const y of [0,6])for(const z of [-36,36]) {
    const depth=x*dx+y*dy+z*dz,screenX=x*right[0]+z*right[2],screenY=x*up[0]+y*up[1]+z*up[2];
    distance=Math.max(distance,depth+Math.abs(screenX)/(tan*aspect*usableW/width),depth+Math.abs(screenY)/(tan*usableH/height));
  }
  distance*=1.035;
  return {position:[dx*distance,dy*distance,dz*distance],rect,
    offsetX:width/2-(rect.left+rect.right)/2,offsetY:height/2-(rect.top+rect.bottom)/2};
}

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const smooth=v=>{const t=clamp(v,0,1);return t*t*t*(t*(t*6-15)+10);};

/** Continuous broadcast composition: small live tracking, one gentle goal push, then home. */
export function sinkCameraPose(frame,soap,goal,reducedMotion=false) {
  const base=frame.position;
  if(reducedMotion)return {position:[...base],target:[0,0,0]};
  const x=clamp(soap?.x||0,-22,22),z=clamp(soap?.z||0,-34,34);
  const height=clamp(soap?.y||0,0,14),speed=clamp(Math.hypot(soap?.vx||0,soap?.vz||0)/40,0,1);
  const weight=goal?smooth(goal.age/.42)*(1-smooth((goal.age-1.75)/(goal.duration-1.75))):0;
  const target=[x*.055*(1-weight),Math.min(.9,height*.08)*(1-weight),z*.055*(1-weight)+(goal?.z||0)*.38*weight];
  const turn=x*.0009*(1-weight)+(goal?Math.sign(goal.z)*.055*Math.sin(Math.PI*clamp(goal.age/goal.duration,0,1))*weight:0);
  const zoom=1+.02*speed*(1-weight)+.025*clamp(height/12,0,1)*(1-weight)-.18*weight;
  const c=Math.cos(turn),s=Math.sin(turn);
  return {position:[(base[0]*c+base[2]*s)*zoom+target[0],base[1]*zoom+target[1],(base[2]*c-base[0]*s)*zoom+target[2]],target};
}

/** No spring overshoot, cuts or FOV changes. A new viewport gets a fresh safe composition. */
export function createSinkDirector() {
  let position=null,target=null,frameKey='';
  return {
    reset(){position=null;target=null;frameKey='';},
    update(frame,soap,goal,dt,reducedMotion=false) {
      const desired=sinkCameraPose(frame,soap,goal,reducedMotion),key=frame.position.join(':');
      if(!position||key!==frameKey||reducedMotion){position=[...desired.position];target=[...desired.target];frameKey=key;}
      else {
        const alpha=1-Math.exp(-Math.max(0,Math.min(.1,dt))*(goal?6:2.4));
        for(let i=0;i<3;i++){position[i]+=(desired.position[i]-position[i])*alpha;target[i]+=(desired.target[i]-target[i])*alpha;}
      }
      return {position,target};
    }
  };
}
