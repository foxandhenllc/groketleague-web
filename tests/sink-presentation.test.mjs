import test from 'node:test';
import assert from 'node:assert/strict';
import {sinkCameraFrame} from '../sink-camera.js';
import {sinkFeedback} from '../sink-feedback.js';
import {SINK,makeArenaState,stepSink} from '../sink.js';

test('sink camera holds the entire raised rim inside the playable space on phones and desktops',()=>{
  for(const [width,height] of [[320,568],[390,844],[568,320],[667,375],[740,360],[844,390],[1024,768],[1440,900],[2560,1080]]) {
    const {position,rect,offsetX,offsetY}=sinkCameraFrame(width,height),distance=Math.hypot(...position),[dx,dy,dz]=position.map(v=>v/distance),h=Math.hypot(dx,dz),tan=Math.tan(52*Math.PI/360);
    const right=[dz/h,0,-dx/h],up=[-dy*dx/h,h,-dy*dz/h];
    for(const x of [-24,24])for(const y of [0,6])for(const z of [-36,36]) {
      const depth=distance-x*dx-y*dy-z*dz;
      const px=width/2-offsetX+(x*right[0]+z*right[2])/depth/tan*height/2;
      const py=height/2-offsetY-(x*up[0]+y*up[1]+z*up[2])/depth/tan*height/2;
      assert.ok(px>=rect.left&&px<=rect.right&&py>=rect.top&&py<=rect.bottom,`${width}x${height}: ${px},${py}`);
      assert.ok(depth>0&&depth<220, 'visible within camera clipping range');
    }
  }
});

test('sink feedback explains the active physical cause and prioritizes imminent danger',()=>{
  const state=makeArenaState(),car={x:0,z:0},ball={x:0,z:12,vx:0,vz:0};
  assert.match(sinkFeedback(state,car,ball).text,/less grip/);
  car.z=12;ball.x=20;assert.match(sinkFeedback(state,car,ball).text,/gravity/);
  ball.x=2;ball.z=-SINK.drainZ+4.5;assert.match(sinkFeedback(state,car,ball).text,/DRAIN PULL/);
  state.time=SINK.faucetWarningAt+.2;state.next=100;stepSink(state,[],ball,0);
  assert.equal(state.surge,0);assert.match(sinkFeedback(state,car,ball).text,/TAP OPENS/);
  state.time=SINK.faucetFlowAt+1;stepSink(state,[],ball,0);assert.match(sinkFeedback(state,car,ball).text,/FAUCET FLOW/);
  state.hazard={kind:'meteor',age:1,fired:false};assert.match(sinkFeedback(state,car,ball).text,/METEOR IN 1s/);
  state.hazard={kind:'lightning',age:SINK.warning,fired:true};assert.match(sinkFeedback(state,car,ball).text,/briefly stunned/);
  state.hazard=null;state.time=SINK.faucetEbbAt+.2;stepSink(state,[],ball,0);assert.match(sinkFeedback(state,car,ball).text,/wet steel stays slippery/);
});
