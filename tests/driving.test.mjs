import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mouseDrive, circleRect, ChaseGame, route, inertialBrake } from '../src/game.js';
import { roads, roadNodes, roadEdges, obstacles, distanceToRoad, CITY_SIZE, wrapCity } from '../src/city.js';
import { drawCity } from '../src/city-renderer.js';

test('mouse steering uses world coordinates, accounting for camera lead and zoom',()=>{
  const p={x:1600,y:1600,angle:0};
  const right=mouseDrive(p,{x:900,y:400,braking:false},{x:1640,y:1600,zoom:1.1},1280,800);
  assert.equal(right.steer,0);assert.equal(right.accelerating,true);
  const down=mouseDrive(p,{x:640,y:650,braking:false},{x:1600,y:1600,zoom:1},1280,800);
  assert.ok(down.steer>.9);
  const braking=mouseDrive(p,{x:900,y:400,braking:true},{x:1600,y:1600,zoom:1},1280,800);
  assert.equal(braking.braking,true);assert.equal(braking.accelerating,false);
  assert.equal(mouseDrive(p,{x:640,y:400,braking:false},{x:1600,y:1600,zoom:1},1280,800).braking,true);
});
function simulation(){const g=Object.create(ChaseGame.prototype);Object.assign(g,{keys:new Set(),w:1280,h:800,audio:{update(){},tone(){}},onAnnouncement(){},onHud(){},onFinish(r){this.result=r;},onPause(){}});g.start('#bcff4a');return g;}
test('holding right brake preserves momentum before stopping, then releases cleanly',()=>{
  const g=simulation();g.police=[];g.spawnTimer=999;g.pickups=[];g.nextPickup=999;
  g.player.speed=250;g.player.vx=0;g.player.vy=-250;g.mouse.braking=true;
  const before=g.player.y;
  for(let i=0;i<120;i++){g.update(1/120);assert.ok(g.player.speed>=0);}
  assert.ok(g.player.speed>50);assert.ok(before-g.player.y>140);
  for(let i=0;i<360;i++)g.update(1/120);
  assert.equal(g.player.speed,0);
  g.mouse.braking=false;g.mouse.x=640;g.mouse.y=100;
  for(let i=0;i<30;i++)g.update(1/120);
  assert.ok(g.player.speed>20);assert.equal(g.boost,100);
  g.mouse.braking=true;g.pause();assert.equal(g.mouse.braking,false);
});
test('rotated building collision returns the correct world-space escape normal',()=>{
  const r={x:100,y:100,w:100,h:60,angle:Math.PI/4},cx=150,cy=130;
  const c=Math.cos(r.angle),s=Math.sin(r.angle),x=cx+56*c,y=cy+56*s;
  const hit=circleRect(x,y,10,r);assert.ok(hit);assert.ok(hit.x>.7&&hit.y>.7);assert.ok(Math.abs(hit.depth-4)<.01);
});
test('left boost consumes its gauge, releases cleanly, and yields to right brake',()=>{
  const g=simulation();g.police=[];g.spawnTimer=999;g.pickups=[];g.nextPickup=999;g.mouse.boosting=true;
  for(let i=0;i<60;i++)g.update(1/120);
  assert.ok(g.boost<85);assert.ok(g.player.speed>190);
  const previous=g.boost;g.mouse.braking=true;
  for(let i=0;i<60;i++)g.update(1/120);
  assert.equal(g.boosting,false);assert.ok(g.boost>previous);assert.ok(g.player.speed>0);
  g.pause();assert.equal(g.mouse.boosting,false);assert.equal(g.mouse.braking,false);
});
test('curved and oblique street graph is connected and includes real branches',()=>{
  const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const link of roadNodes[queue[i]].links)if(!seen.has(link.to)){seen.add(link.to);queue.push(link.to);}
  assert.equal(seen.size,roadNodes.length);
  assert.ok(roadNodes.some(n=>n.links.length===3));assert.ok(roadNodes.some(n=>n.links.length>=4));
  const oblique=roadEdges.filter(e=>{const a=roadNodes[e.a],b=roadNodes[e.b];return Math.abs(a.x-b.x)>2&&Math.abs(a.y-b.y)>2;});
  assert.ok(oblique.length>roadEdges.length*.7);assert.ok(roads.some(r=>r.points.length>50));
});
test('pursuit path follows passable streets across the city',()=>{
  const path=route({x:90,y:1920},{x:3160,y:2620});assert.ok(path.length>15);
  for(let i=1;i<path.length;i++)for(let j=0;j<=5;j++){
    const p={x:path[i-1].x+(path[i].x-path[i-1].x)*j/5,y:path[i-1].y+(path[i].y-path[i-1].y)*j/5};
    assert.ok(distanceToRoad(p)<0);assert.equal(obstacles.some(b=>circleRect(p.x,p.y,22,b)),false);
  }
});
test('new road network still allows police to catch a stopped player',()=>{
  const g=simulation();g.mouse.braking=true;
  for(let i=0;i<12000&&g.mode==='playing';i++)g.update(1/120);
  assert.equal(g.mode,'finished');assert.ok(['busted','wrecked'].includes(g.result.reason));
});
test('a destroyed patrol explodes once, emits debris and sparks, and triggers camera shake',()=>{
  const g=simulation(),car={x:1600,y:1700,angle:1};g.explode(car);
  assert.equal(g.explosions.length,1);assert.ok(g.shake>=20);assert.ok(g.flash>0);
  assert.ok(g.particles.filter(p=>p.kind==='spark').length>=80);assert.ok(g.particles.some(p=>p.kind==='debris'));
  const count=g.particles.length;g.explode(car);assert.equal(g.explosions.length,1);assert.equal(g.particles.length,count);
});
test('braking retains direction and stopping distance is consistent across frame rates',()=>{
  function stop(dt){let vx=150,vy=200,d=0,time=0;while(Math.hypot(vx,vy)>.01&&time<5){const next=inertialBrake(vx,vy,dt);d+=next.speed*dt;vx=next.vx;vy=next.vy;time+=dt;if(vy>1)assert.ok(Math.abs(vx/vy-.75)<.0001);}return{d,time};}
  const a=stop(1/60),b=stop(1/120);assert.ok(a.time>1.5&&a.time<3);assert.ok(a.d>180);assert.ok(Math.abs(a.d-b.d)<3);
});
test('road routes connect repeated districts in both positive and negative directions',()=>{
  for(const [from,to]of[[{x:3250,y:1920},{x:3380,y:1920}],[{x:40,y:1920},{x:-110,y:1920}],[{x:1920,y:3260},{x:1920,y:3400}],[{x:1920,y:50},{x:1920,y:-90}]]){
    const path=route(from,to);assert.ok(path.length>=2);
    for(let i=1;i<path.length;i++)for(let j=0;j<=4;j++){const p={x:path[i-1].x+(path[i].x-path[i-1].x)*j/4,y:path[i-1].y+(path[i].y-path[i-1].y)*j/4};assert.ok(distanceToRoad(p)<0);assert.equal(obstacles.some(b=>circleRect(wrapCity(p.x),wrapCity(p.y),17,b)),false);}
  }
});
test('cars cross the former map edge, and police and pickups spawn in distant districts',()=>{
  const g=simulation();g.police=[];g.pickups=[];g.spawnTimer=999;g.nextPickup=999;g.player={x:3290,y:1920,angle:0,vx:250,vy:0,speed:250,cooldown:0};g.camera={x:3290,y:1920,zoom:1};g.mouse.x=1100;g.mouse.y=400;
  for(let i=0;i<60;i++)g.update(1/120);assert.ok(g.player.x>CITY_SIZE+70);
  g.player.x=10*CITY_SIZE+1600;g.player.y=-3*CITY_SIZE+1600;g.police=[];g.pickups=[];g.addPolice();g.addPickup('boost');
  assert.ok(g.police.length>0);assert.ok(g.pickups.length>0);
  for(const item of [...g.police,...g.pickups])assert.ok(Math.hypot(item.x-g.player.x,item.y-g.player.y)<1500);
});
test('city renderer covers all four districts at a negative/positive coordinate seam',()=>{
  let clips=0;const moves=[],gradient={addColorStop(){}};
  const ctx=new Proxy({}, {get(target,key){if(key==='createRadialGradient')return()=>gradient;if(key==='clip')return()=>clips++;if(key==='translate')return(x,y)=>moves.push([x,y]);return target[key]||(()=>{});},set(target,key,value){target[key]=value;return true;}});
  drawCity(ctx,{x:0,y:0},350,0);assert.equal(clips,4);assert.ok(moves.some(([x,y])=>x===-CITY_SIZE&&y===-CITY_SIZE));assert.ok(moves.some(([x,y])=>x===0&&y===0));
});
test('boost builds visual speed effects, while reduced motion suppresses camera zoom and ghosts',()=>{
  const a=simulation(),b=simulation();b.reduced=true;
  for(const g of[a,b]){g.police=[];g.pickups=[];g.spawnTimer=999;g.nextPickup=999;g.mouse.boosting=true;for(let i=0;i<96;i++)g.update(1/120);}
  assert.ok(a.boostFx>.3);assert.ok(a.afterimages.length>0);assert.equal(b.afterimages.length,0);assert.ok(a.camera.zoom<b.camera.zoom-.1);
});
