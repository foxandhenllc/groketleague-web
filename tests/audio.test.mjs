import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../audio.js',import.meta.url),'utf8');
function harness(){
  let now=0,id=0;const frames=new Map(),timers=new Map(),players=[],nodes=[],storage=new Map(),pending=[];
  const controls={defer:false,reject:false};let resolveFetch;
  const fetchPromise=new Promise(resolve=>{resolveFetch=resolve;});
  class Audio {
    constructor(){this.paused=true;this.volume=1;this.readyState=0;this.error=null;players.push(this);}
    set src(value){this._src=value;this.paused=true;this.readyState=0;}
    get src(){return this._src;}
    play(){if(controls.reject){this.paused=true;return Promise.reject(new Error('not ready'));}this.paused=false;this.readyState=4;return controls.defer?new Promise(resolve=>pending.push(resolve)):Promise.resolve();}
    pause(){this.paused=true;}
  }
  const param=()=>({value:1,setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
  function node(kind){const n={kind,gain:param(),frequency:param(),Q:param(),edges:[],startTime:Infinity,stopTime:Infinity,
    connect(other){this.edges.push(other);return other;},start(t=now/1000){this.startTime=t;},stop(t=now/1000){this.stopTime=t;}};nodes.push(n);return n;}
  class AudioContext {
    constructor(){this.state='running';this.sampleRate=8000;this.destination=node('destination');}
    get currentTime(){return now/1000;}
    resume(){this.state='running';return Promise.resolve();}
    createGain(){return node('gain');}createOscillator(){return node('oscillator');}createBufferSource(){return node('buffer');}createBiquadFilter(){return node('filter');}
    createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
  }
  const sandbox={Audio,AudioContext,console,performance:{now:()=>now},Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},
    localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},fetch:()=>fetchPromise,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:key=>frames.delete(key),
    setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;}};
  vm.runInNewContext(source.replace(/export \{[^}]+\};/,'')+'\nglobalThis.api={playBed,stopBed,ensureAudio,setMusicMuted,setSfxMuted,isMusicMuted,isSfxMuted,SFX};',sandbox);
  async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
  async function tick(ms){await flush();for(let end=now+ms;now<end;){now=Math.min(end,now+10);const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(now);for(const [key,timer] of timers)if(timer.at<=now){timers.delete(key);timer.fn();}await flush();}}
  function gain(n){return n.kind==='destination'?1:(n.kind==='gain'?n.gain.value:1)*n.edges.reduce((sum,next)=>sum+gain(next),0);}
  return {api:sandbox.api,players,controls,pending,tick,flush,storage,nodes,gain,
    load:()=>resolveFetch({ok:true,arrayBuffer:async()=>new ArrayBuffer(5000)})};
}
const playing=a=>{assert.equal(a.paused,false);assert.ok(Math.abs(a.volume-.38)<1e-8);};
const silent=a=>{assert.equal(a.paused,true);assert.equal(a.volume,0);};

test('rapid off/on keeps the latest ON intent playing',async()=>{
  const h=harness(),a=h.api;a.playBed('night');await h.tick(800);playing(h.players[0]);
  a.setMusicMuted(true);await h.tick(40);a.setMusicMuted(false);await h.tick(800);playing(h.players[0]);assert.equal(a.isMusicMuted(),false);
});
test('muting during fade-in remains silent after the old fade would finish',async()=>{
  const h=harness();h.api.playBed('night');await h.tick(60);h.api.setMusicMuted(true);await h.tick(900);silent(h.players[0]);
});
test('a pending play completion cannot undo mute or stop',async()=>{
  for(const action of ['mute','stop']){const h=harness();h.controls.defer=true;h.api.playBed('night');if(action==='mute')h.api.setMusicMuted(true);else h.api.stopBed();await h.tick(500);for(const resolve of h.pending)resolve();await h.tick(900);silent(h.players[0]);}
});
test('a delayed audio load cannot retry playback after music was muted',async()=>{
  const h=harness();h.controls.reject=true;h.api.playBed('night');await h.flush();h.api.setMusicMuted(true);await h.tick(200);h.controls.reject=false;h.load();await h.tick(900);silent(h.players[0]);
});
test('audio unlock does not restart a muted track',async()=>{
  const h=harness();h.api.playBed('day');await h.tick(800);h.api.setMusicMuted(true);await h.tick(200);h.api.ensureAudio();await h.tick(800);silent(h.players[0]);
});
test('stopping and immediately restarting a track cancels the old fade-out',async()=>{
  const h=harness();h.api.playBed('night');await h.tick(800);h.api.stopBed();await h.tick(40);h.api.playBed('night');await h.tick(900);playing(h.players[0]);
});
test('muting through a track change silences both players and unmutes only the selected bed',async()=>{
  const h=harness();h.api.playBed('garage');await h.tick(800);h.api.playBed('night');await h.tick(40);h.api.setMusicMuted(true);await h.tick(900);h.players.forEach(silent);
  h.api.playBed('day');h.api.setMusicMuted(false);await h.tick(900);silent(h.players[0]);silent(h.players[1]);playing(h.players[2]);
});
test('effects mute silences active voices immediately without stopping music',async()=>{
  const h=harness();h.api.playBed('night');await h.tick(800);h.api.SFX.goal();
  const voices=h.nodes.filter(n=>n.kind==='oscillator'||n.kind==='buffer');assert.ok(voices.some(n=>h.gain(n)>0));
  h.api.setSfxMuted(true);assert.ok(voices.every(n=>h.gain(n)===0));playing(h.players[0]);
  const count=h.nodes.length;h.api.SFX.hit();assert.equal(h.nodes.length,count);
  h.api.setSfxMuted(false);h.api.SFX.tick();assert.ok(h.gain(h.nodes.filter(n=>n.kind==='oscillator').at(-1))>0);assert.equal(h.api.isMusicMuted(),false);
});
