/** Kitchen-sink presentation. Every region samples the same surface as the simulation. */
import { SINK, sinkSurface, faucetPhase } from './sink.js';

const TAU=Math.PI*2, AMBER='#ffc268', CYAN='#62dbe8';
function line(ctx,points,color,width=.15) {
  ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(x,z):ctx.moveTo(x,z));
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function circle(ctx,x,z,r,fill,stroke,width=.15) {
  ctx.beginPath();ctx.arc(x,z,r,0,TAU);
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function box(ctx,x,z,w,h,r,fill,stroke,width=.15) {
  ctx.beginPath();ctx.roundRect(x,z,w,h,r);
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
function world(ctx,layout) {
  ctx.translate(layout.cx,layout.cy);
  if(layout.landscape)ctx.transform(0,layout.scale,-layout.scale,0,0,0);
  else ctx.scale(layout.scale,layout.scale);
}
function label(ctx,text,x,z,layout,color='#cceaf0',size=1.15) {
  ctx.save();ctx.translate(x,z);if(layout.landscape)ctx.rotate(-Math.PI/2);
  ctx.font=`700 ${size}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineWidth=.3;ctx.strokeStyle='#153747';ctx.strokeText(text,0,0);ctx.fillStyle=color;ctx.fillText(text,0,0);ctx.restore();
}
function arrow(ctx,x,z,angle,color,scale=1) {
  ctx.save();ctx.translate(x,z);ctx.rotate(angle);ctx.scale(scale,scale);
  line(ctx,[[-.6,-.6],[0,0],[-.6,.6]],color,.16);ctx.restore();
}

export function paintSinkBackground(ctx,width,height,layout) {
  const outer=ctx.createRadialGradient(width*.5,height*.45,0,width*.5,height*.5,Math.max(width,height)*.7);
  outer.addColorStop(0,'#243c43');outer.addColorStop(1,'#0a1720');ctx.fillStyle=outer;ctx.fillRect(0,0,width,height);
  ctx.save();world(ctx,layout);ctx.lineJoin='round';ctx.lineCap='round';
  box(ctx,-26.5,-38.5,54,78,6,'#06101b80');
  box(ctx,-27,-39,54,78,6,'#c8b295','#ead5b5',.25);
  // Quiet terrazzo counter, a tactile contrast to the cool bowl.
  for(let i=0;i<270;i++) {
    const x=(i*137%997)/997*52-26,z=(i*311%991)/991*76-38;
    if(Math.abs(x)<23&&Math.abs(z)<35)continue;
    line(ctx,[[x,z],[x+.3+(i%3)*.12,z+.1]],i%2?'#8c817366':'#fff2d97a',.13);
  }
  box(ctx,-23.2,-35.2,46.4,70.4,6,'#465d68','#f4f8ed',.35);
  const metal=ctx.createLinearGradient(-22,0,22,0);
  for(const [at,c] of [[0,'#c4d9db'],[.07,'#547581'],[.15,'#8db0ba'],[.25,'#3d6273'],[.53,'#456b7d'],[.76,'#527b8b'],[.88,'#99bfc8'],[.97,'#537787'],[1,'#c9e1de']])metal.addColorStop(at,c);
  box(ctx,-22,-34,44,68,5,metal,'#a5c7d0',.22);
  ctx.save();ctx.beginPath();ctx.roundRect(-22,-34,44,68,5);ctx.clip();
  // Contour bands follow the quadratic shoulder rather than a flat inset rectangle.
  for(let i=0;i<5;i++) {
    const dx=i*1.35;
    box(ctx,-15-dx,-27-dx,30+2*dx,54+2*dx,2+dx*.6,null,i%2?'#d4edf226':'#061f302c',.11+i*.025);
  }
  for(let z=-33;z<34;z+=.37)line(ctx,[[-22,z],[22,z+.08]],'#dbf7fb08',.035);
  // A sampled wetness mask means the colored lane has exactly the same soft edge as grip.
  for(let x=SINK.wetStartX;x<SINK.wetEndX;x+=.5)for(let z=-SINK.wetHalfZ;z<SINK.wetHalfZ;z+=.5) {
    const wet=sinkSurface(x+.25,z+.25).wet;if(wet<.01)continue;
    ctx.fillStyle=`rgba(42,183,208,${wet*.32})`;ctx.fillRect(x,z,.51,.51);
  }
  for(const sign of [-1,1]) {
    for(const z of [-18,-10,10,18]) {
      arrow(ctx,sign*19,z,sign>0?Math.PI:0,'#d3ece575',1.1);
      arrow(ctx,sign*20.5,z,sign>0?Math.PI:0,'#d3ece530',1.1);
    }
    for(const x of [-10,10])arrow(ctx,x,sign*31,sign>0?-Math.PI/2:Math.PI/2,'#d3ece580',1.2);
  }
  ctx.restore();
  for(const sign of [-1,1]) {
    const z=sign*SINK.drainZ,color=sign>0?AMBER:CYAN;
    const halo=ctx.createRadialGradient(0,z,3,0,z,SINK.drainPullRadius);
    halo.addColorStop(0,sign>0?'#ffc26825':'#62dbe82b');halo.addColorStop(1,'#62dbe800');
    circle(ctx,0,z,SINK.drainPullRadius,halo);
    circle(ctx,0,z,4.8,'#1b3748',color,.22);circle(ctx,0,z,4.4,'#b8d2d4','#e4eddf',.1);
    circle(ctx,0,z,4,'#06131f','#4e6f7b',.15);
    for(const r of [1,2.1,3.1])circle(ctx,0,z,r,null,'#537785',.12);
    for(let i=0;i<8;i++){const a=i*TAU/8;line(ctx,[[Math.sin(a)*3.8,z+Math.cos(a)*3.8],[Math.sin(a)*.55,z+Math.cos(a)*.55]],'#8da7ad',.1);}
    circle(ctx,0,z,.6,'#020911');
    for(let i=0;i<12;i++){const a=i*TAU/12;circle(ctx,Math.sin(a)*4.6,z+Math.cos(a)*4.6,.075,'#143141');}
    label(ctx,sign>0?'AMBER DRAIN':'CYAN DRAIN',0,z+sign*6.1,layout,color,1.05);
  }
  // Nozzle points at the start of the wet lane, not across the whole playing field.
  circle(ctx,-24,-5,2,'#3b5664','#e1efea',.3);
  line(ctx,[[-24,-5],[-24,-.3],[-21,.2],[-9,.2]],'#193544',1.85);
  line(ctx,[[-24,-5],[-24,-.3],[-21,.2],[-9,.2]],'#b5d1d5',1.35);
  line(ctx,[[-24.3,-4],[-24.3,-.5],[-21,-.15],[-9,-.15]],'#f3f7e9',.27);
  circle(ctx,-9,0,.9,'#102b3c','#b1d6dc',.18);
  line(ctx,[[-26,-6],[-22,-6]],'#e3e9dc',.55);
  // Kitchen personality stays outside the collision surface.
  box(ctx,-26,-30,3.1,6.5,.5,'#608365','#37585a',.15);
  box(ctx,-26.1,-30.4,3.1,5.8,.5,'#ebc858','#fff1a1',.14);
  for(let i=0;i<12;i++)circle(ctx,-25.6+(i%3)*.8,-29.6+Math.floor(i/3)*1.15,.13,'#be9b38');
  box(ctx,23.4,19,2.5,6,.7,'#92ccd4','#d3f4ea',.18);box(ctx,24,17.5,1.2,1.6,.2,'#dcece5');
  line(ctx,[[24.6,17.7],[24.6,16.6],[26.4,16.6]],'#e0ece7',.4);
  label(ctx,'SUDS',24.7,21.8,layout,'#173b50',.75);

  ctx.restore();
}

export function paintSinkEffects(ctx,state,layout,reducedMotion,cars=[],ball) {
  if(!state)return;
  const t=state.time||0, motion=reducedMotion?0:t, faucet=state.faucet||faucetPhase(t), strength=faucet.strength;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  // Thin streaming ribbons follow the actual +x force, with no motion outside the wet mask.
  for(let j=0;j<5;j++)for(let i=0;i<5;i++) {
    const z=-2.8+j*1.4, x=-10+((i*6+j*1.7+motion*(.25+strength*5))%28),wet=sinkSurface(x,z,state).wet;
    ctx.globalAlpha=wet*(.2+strength*.5);
    line(ctx,[[x,z],[x+1,z+.1],[x+2.3,z]],'#bdf9f5',.1+strength*.08);
  }
  ctx.globalAlpha=1;
  if(strength>.01) {
    circle(ctx,-9,0,.8+strength*.4,'#b7fbff88','#e0fffb',.12);
    for(let i=0;i<3;i++) {
      const p=(motion*1.1+i/3)%1;ctx.globalAlpha=(1-p)*strength*.7;
      circle(ctx,-9+p*.8,0,.8+p*2,null,'#b7ffff',.14);
    }
    ctx.globalAlpha=1;
    for(const x of [-4,3,10])arrow(ctx,x,0,0,'#e0fffa',1.6);
    label(ctx,faucet.phase==='ebb'?'FLOW EASING':'CURRENT',4,5.5,layout,'#b6fbff',1.05);
  } else if(faucet.phase==='warning') {
    circle(ctx,-9,0,2.2,null,'#ffeaa0',.25);
    label(ctx,'TAP OPENING',3,5.5,layout,'#ffeaa0',1.05);
  } else if(!state.hazard)label(ctx,'WET STEEL',4,5.5,layout,'#b6e6e9',1);
  // Subtle inward paths reveal the ball-only pull before a near-miss becomes a goal.
  for(const sign of [-1,1])for(let j=0;j<3;j++) {
    const points=[];
    for(let k=0;k<24;k++){const p=k/23,a=j*TAU/3+p*1.3+motion*.6,r=SINK.drainPullRadius-.4-p*3.1;points.push([Math.cos(a)*r,sign*SINK.drainZ+Math.sin(a)*r]);}
    line(ctx,points,sign>0?'#ffc26865':'#8af0ff65',.1);
    const last=points.at(-1),prev=points.at(-2);arrow(ctx,...last,Math.atan2(last[1]-prev[1],last[0]-prev[0]),sign>0?AMBER:CYAN,.7);
  }
  // Contact wakes locate slippery tyres and the ball; they cannot imply a wider current.
  for(const body of [...cars,ball].filter(Boolean)) {
    const s=sinkSurface(body.x,body.z,state),speed=Math.hypot(body.vx,body.vz);
    if(s.wet>.1&&speed>1&&(body!==ball||(body.y||0)<=SINK.surfaceBallMaxHeight)) {
      const length=Math.min(2,speed*.1),nx=body.vx/speed,nz=body.vz/speed;
      for(const side of [-1,1])line(ctx,[[body.x-nx*length+nz*side*.7,body.z-nz*length-nx*side*.7],[body.x+nz*side*.4,body.z-nx*side*.4]],'#dcffff99',.13);
    }
    if(body.shock>0) {
      circle(ctx,body.x,body.z,(body.w||2)*.7,null,'#a9f7ff',.18);
      if(!state.hazard)label(ctx,'STUNNED',body.x,body.z-(body.l||4)*.65,layout,'#d4feff',1);
    }
  }
  const h=state.hazard;
  if(h) {
    const hit=h.age>=SINK.warning,color=h.kind==='meteor'?'#ff9b5a':'#a8f5ff',age=Math.max(0,h.age-SINK.warning);
    if(!hit) {
      circle(ctx,h.x,h.z,SINK.radius,h.kind==='meteor'?'#fe824326':'#70eaff24',color,.22);
      const countdown=Math.max(.01,1-h.age/SINK.warning);
      ctx.beginPath();ctx.arc(h.x,h.z,SINK.radius+.55,-Math.PI/2,-Math.PI/2+TAU*countdown);ctx.strokeStyle=color;ctx.lineWidth=.38;ctx.stroke();
      for(let i=0;i<8;i++){const a=i*TAU/8;line(ctx,[[h.x+Math.cos(a)*(SINK.radius-.7),h.z+Math.sin(a)*(SINK.radius-.7)],[h.x+Math.cos(a)*SINK.radius,h.z+Math.sin(a)*SINK.radius]],color,.19);}
      label(ctx,h.kind==='meteor'?'BLAST ZONE':'SHOCK ZONE',h.x,h.z-SINK.radius-1.6,layout,color,1.25);
      label(ctx,`${Math.max(1,Math.ceil(SINK.warning-h.age))}`,h.x,h.z,layout,color,2);
      if(h.kind==='meteor'&&!reducedMotion) {
        const fall=(SINK.warning-h.age)*9;
        line(ctx,[[h.x+fall*.35+2,h.z-fall-4],[h.x+fall*.35,h.z-fall]],'#ffb95788',1.2);
        circle(ctx,h.x+fall*.35,h.z-fall,.9,'#713c38','#ffbd71',.35);
      }
    } else {
      const fade=Math.max(0,1-age/.9);
      ctx.globalAlpha=fade;
      if(h.kind==='meteor') {
        circle(ctx,h.x,h.z,SINK.radius*.55,'#233c4699');
        circle(ctx,h.x,h.z,SINK.radius*(reducedMotion?1:1+age*.65),null,color,.3*fade+.1);
        for(let i=0;i<12;i++) {
          const a=i*TAU/12, r=(reducedMotion?3:1+age*11);
          circle(ctx,h.x+Math.cos(a)*r,h.z+Math.sin(a)*r,.2+(i%3)*.12,i%2?'#ffa459':'#6f6460');
        }
      } else {
        circle(ctx,h.x,h.z,SINK.radius,null,color,.25);
        for(let i=0;i<7;i++){const a=i*TAU/7;line(ctx,[[h.x,h.z],[h.x+Math.cos(a+.3)*2.8,h.z+Math.sin(a+.3)*2.8],[h.x+Math.cos(a)*5.4,h.z+Math.sin(a)*5.4]],'#92eaff',.2);}
        if(age<.3)line(ctx,[[h.x+2,h.z-8],[h.x-1,h.z-3],[h.x+1,h.z-3],[h.x,h.z]],'#e4ffff',reducedMotion?.2:.55);
      }
      ctx.globalAlpha=1;label(ctx,h.kind==='meteor'?'KNOCKBACK':'SHORT CIRCUIT',h.x,h.z-SINK.radius-1.6,layout,color,1.2);
    }
  }
  ctx.restore();
}
