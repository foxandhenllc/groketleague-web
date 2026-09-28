// One shared curve drives the road mesh, checkpoints, racing lines and scenery.
export const TRACK_WIDTH=14;
export const TRACK_POINTS=[
  [0,2,80],[62,2,80],[106,4,52],[102,12,8],[76,7,-18],[68,1,-55],
  [34,1,-80],[-12,2,-76],[-55,3,-75],[-103,1,-59],[-111,1,-9],
  [-83,8,18],[-75,3,53],[-43,2,80]
];
const wrap=(n,len)=>(n%len+len)%len;
function point(t){
  const i=Math.floor(t),u=t-i,n=TRACK_POINTS.length;
  const [a,b,c,d]=[-1,0,1,2].map(k=>TRACK_POINTS[wrap(i+k,n)]);
  return b.map((v,k)=>.5*(2*v+(-a[k]+c[k])*u+(2*a[k]-5*v+4*c[k]-d[k])*u*u+(-a[k]+3*v-3*c[k]+d[k])*u*u*u));
}
export const TRACK_SAMPLES=[];
let distance=0,previous=null;
for(let i=0;i<=TRACK_POINTS.length*48;i++){
  const p=point(i/48);
  if(previous)distance+=Math.hypot(p[0]-previous[0],p[2]-previous[2]);
  TRACK_SAMPLES.push({s:distance,x:p[0],y:p[1],z:p[2]});previous=p;
}
export const TRACK_LENGTH=distance;
function center(s){
  s=wrap(s,TRACK_LENGTH);let lo=0,hi=TRACK_SAMPLES.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(TRACK_SAMPLES[mid].s>s)hi=mid;else lo=mid;}
  const a=TRACK_SAMPLES[lo],b=TRACK_SAMPLES[hi],t=(s-a.s)/(b.s-a.s);
  return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};
}
export function trackFrame(s,lane=0){
  const p=center(s),a=center(s-2),b=center(s+2),dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
  const tx=dx/len,tz=dz/len,nx=-tz,nz=tx;
  const ax=p.x-a.x,az=p.z-a.z,bx=b.x-p.x,bz=b.z-p.z;
  const curvature=Math.atan2(ax*bz-az*bx,ax*bx+az*bz)/2;
  return {x:p.x+nx*lane,y:p.y,z:p.z+nz*lane,tx,tz,nx,nz,curvature,slope:(b.y-a.y)/len,yaw:Math.atan2(-tx,-tz)};
}
export const SECTORS=[
  {at:0,name:'SPACE-ISH LAUNCH YARD',hint:'Prototype engines ahead. Orange marks the exhaust lane.',color:'#ffb969'},
  {at:.22,name:'LOW-G SKYWAY',hint:'Carry speed over the crest. Less steering while airborne.',color:'#7ae4fa'},
  {at:.43,name:'CRATER CUT',hint:'Inside line is shorter. Loose dust makes it harder to hold.',color:'#deb9f6'},
  {at:.68,name:'N.A.P.S. CAMPUS',hint:'National Agency for Procrastinated Spaceflight. Cargo crossing ahead.',color:'#b3e581'},
  {at:.9,name:'HOME STRAIGHT',hint:'Draft, save your reserve, then time the final burst.',color:'#ffedba'}
];
export function sectorAt(s){const u=wrap(s,TRACK_LENGTH)/TRACK_LENGTH;return [...SECTORS].reverse().find(v=>u>=v.at);}
export function localProgress(s){return wrap(s,TRACK_LENGTH);}
export function trackGap(a,b){return wrap(a-b+TRACK_LENGTH/2,TRACK_LENGTH)-TRACK_LENGTH/2;}
export const JUMP_AT=.27*TRACK_LENGTH;
export const JET_AT=.145*TRACK_LENGTH;
export const CARGO_AT=.79*TRACK_LENGTH;
export function moonHazards(time,offset=0){
  const phase=wrap(time+offset,14);
  return {jetPhase:phase,jetWarning:phase<2.3,jetActive:phase>=2.3&&phase<5.4,cargoLane:Math.sin(time*.72+offset)*4.5};
}
