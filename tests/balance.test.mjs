import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChaseGame,boostStep,BOOST_RESTART,route,circleRect } from '../src/game.js';
import { roads,roadNodes,buildings,obstacles,CITY_SIZE,wrapCity,sampleRoad,nearestRoadNode,distanceToRoad } from '../src/city.js';
function simulation(){const g=Object.create(ChaseGame.prototype);Object.assign(g,{keys:new Set(),w:1280,h:800,audio:{update(){},tone(){}},onAnnouncement(){},onHud(){},onFinish(r){this.result=r;},onPause(){}});g.start('#bcff4a');return g;}
function isolated(){const g=simulation();g.police=[];g.spawnTimer=999;g.pickups=[];g.nextPickup=999;return g;}
test('an exhausted boost cannot pulse while its button is held, or be reset by releasing it',()=>{
  let state=boostStep(.1,false,true,false,1/60);assert.equal(state.energy,0);assert.equal(state.locked,true);assert.equal(state.active,false);
  for(let i=0;i<120;i++){state=boostStep(state.energy,state.locked,i%7!==0,false,1/60);assert.equal(state.active,false);assert.equal(state.locked,true);}
  assert.ok(Math.abs(state.energy-30)<.001);
  while(state.energy<BOOST_RESTART){state=boostStep(state.energy,state.locked,true,false,1/60);assert.equal(state.active,false);}
  assert.equal(state.locked,false);state=boostStep(state.energy,state.locked,true,false,1/60);assert.equal(state.active,true);assert.ok(state.energy<BOOST_RESTART);
});
test('reverse moves backwards, and a usable boost cancels reverse even while Shift stays down',()=>{
  const g=isolated();g.reverseMode=true;g.keys.add('ShiftLeft');
  for(let i=0;i<60;i++)g.update(1/120);
  const dot=()=>g.player.vx*Math.cos(g.player.angle)+g.player.vy*Math.sin(g.player.angle);
  assert.ok(dot()<-50);assert.ok(g.player.speed<0);
  g.mouse.boosting=true;g.update(1/120);assert.equal(g.reverseMode,false);assert.equal(g.boosting,true);assert.ok(dot()>=0);
  for(let i=0;i<20;i++)g.update(1/120);assert.equal(g.reverseMode,false);assert.ok(dot()>40);assert.equal(g.keys.has('ShiftLeft'),true);
});
test('a locked boost cannot cancel reverse, and right brake still overrides both inputs',()=>{
  const g=isolated();g.reverseMode=true;g.mouse.boosting=true;g.boost=8;g.boostLocked=true;g.update(1/120);
  assert.equal(g.boosting,false);assert.equal(g.reverseMode,true);
  g.boost=100;g.boostLocked=false;g.mouse.braking=true;g.update(1/120);assert.equal(g.boosting,false);assert.equal(g.reverseMode,true);
});
test('every side has a developed outer neighbourhood and three usable road crossings',()=>{
  for(const count of[buildings.filter(b=>b.x<250).length,buildings.filter(b=>b.x+b.w>CITY_SIZE-250).length,buildings.filter(b=>b.y<250).length,buildings.filter(b=>b.y+b.h>CITY_SIZE-250).length])assert.ok(count>=15);
  for(const y of[850,1920,2650])for(const sign of[1,-1]){
    const from=sign>0?{x:CITY_SIZE-35,y}:{x:35,y},to=sign>0?{x:CITY_SIZE+35,y}:{x:-35,y};const path=route(from,to);assert.ok(path.length>1);
    for(const p of path){assert.ok(distanceToRoad(p)<0);assert.equal(obstacles.some(b=>circleRect(wrapCity(p.x),wrapCity(p.y),17,b)),false);}
  }
  for(const x of[700,1920,2700])assert.ok(route({x,y:CITY_SIZE-35},{x,y:CITY_SIZE+35}).length>1);
});
test('pursuit starts with three tougher patrols and can close on normal-speed driving',()=>{
  const g=simulation();assert.equal(g.police.length,3);assert.equal(new Set(g.police.map(c=>c.role)).size,3);assert.ok(g.police.every(c=>c.hp>=5));
  const road=roads[0],start=sampleRoad(road,1500),behind=sampleRoad(road,1150),c=g.police[0];
  Object.assign(c,{x:behind.x,y:behind.y,angle:behind.angle,speed:300,role:'chaser',pathTimer:0});g.police=[c];g.pickups=[];g.spawnTimer=999;g.nextPickup=999;g.inputMode='keyboard';g.keys.add('KeyW');
  const initial=Math.hypot(start.x-c.x,start.y-c.y);
  for(let i=0;i<180;i++){const p=sampleRoad(road,1500+i/60*290);Object.assign(g.player,{x:p.x,y:p.y,angle:p.angle,speed:290,vx:Math.cos(p.angle)*290,vy:Math.sin(p.angle)*290});g.update(1/60);}
  const final=Math.hypot(g.player.x-c.x,g.player.y-c.y);assert.ok(final<initial-35,`patrol gap: ${initial.toFixed(1)} -> ${final.toFixed(1)}`);
});
test('interceptors plan ahead of a moving driver instead of following the current position',()=>{
  const g=isolated(),road=roads[0],p=sampleRoad(road,1800),behind=sampleRoad(road,1450);g.addPolice();const c=g.police[0];
  Object.assign(c,{x:behind.x,y:behind.y,angle:behind.angle,role:'blocker',pathTimer:0});Object.assign(g.player,{x:p.x,y:p.y,angle:p.angle,speed:290,vx:Math.cos(p.angle)*290,vy:Math.sin(p.angle)*290});g.inputMode='keyboard';g.keys.add('KeyW');g.update(1/120);
  assert.notEqual(c.goalKey,nearestRoadNode(g.player).key);assert.ok(c.path.length>0);
});
