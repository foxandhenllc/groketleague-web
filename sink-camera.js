/** Stable perspective framing inside the sink HUD's reserved content rectangle. */
export function sinkCameraFrame(width,height,fov=52) {
  const short=height<=500&&width>500,phone=width<=600;
  const rect=short?{left:156,top:24,right:width-156,bottom:height-24}
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
