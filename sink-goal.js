import {SINK,sinkHeight} from './sink.js';

/** The host owns the goal timeline. Renderers consume this serializable state. */
export function makeSinkGoal(ball,team,id,winning=false) {
  const entry=ball.soap?.goalEntry||ball;
  return {id,age:0,duration:SINK.soap?.goalSeconds||2.65,x:0,z:team==='A'?-SINK.drainZ:SINK.drainZ,team,winning,
    entry:{x:entry.x,z:entry.z,y:ball.y,worldY:entry.worldY??ball.soap?.worldY??ball.y+sinkHeight(ball.x,ball.z),
      vx:entry.vx,vy:entry.vy,vz:entry.vz,soap:{pitch:ball.soap?.pitch||0,yaw:ball.soap?.yaw||0,roll:ball.soap?.roll||0}}};
}

export function advanceSinkGoal(goal,dt) {
  goal.age=Math.min(goal.duration,goal.age+Math.max(0,dt));
  return goal.age>=goal.duration-1e-8;
}
