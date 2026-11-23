import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canBoostRam, RAM_MIN_KMH, ChaseGame } from '../src/game.js';

test('boost ram requires actual forward speed of 250 km/h and frontal contact', () => {
  assert.equal(RAM_MIN_KMH, 250);
  const player={x:0,y:0,angle:0,vx:250/.65,vy:0,speed:480};
  const front={x:30,y:0,speed:0,angle:0};
  assert.equal(canBoostRam(player,front,true),true);
  assert.equal(canBoostRam({...player,vx:249.99/.65},front,true),false);
  assert.equal(canBoostRam(player,front,false),false);
  for (const target of [{x:-30,y:0},{x:0,y:30},{x:40,y:0}]) assert.equal(canBoostRam(player,target,true),false);
  assert.equal(canBoostRam({...player,vx:-480},front,true),false);
  assert.equal(canBoostRam({...player,vx:0,vy:480},front,true),false);
  assert.equal(canBoostRam(player,{...front,speed:500},true),false);
  assert.equal(canBoostRam({...player,angle:Math.PI/2,vx:0,vy:480},{x:0,y:30},true),true);
});

function collision({front=true,boost=true,speed=480,cooldown=0,hp=5}={}) {
  const game=Object.create(ChaseGame.prototype);
  Object.assign(game,{keys:new Set(),w:1280,h:800,audio:{update(){},tone(){}},onAnnouncement(){},onHud(){},onFinish(){},onPause(){}});
  game.start('#bcff4a'); game.inputMode='keyboard';
  game.hitWalls=()=>null;game.pickups=[];game.nextPickup=999;game.spawnTimer=999;
  Object.assign(game.player,{x:1600,y:1600,angle:0,speed,vx:speed,vy:0});
  if(boost)game.keys.add('Space');
  const car={x:1600+(front?34:-34),y:1600,angle:0,speed:0,hp,cooldown,recovery:0,pathTimer:100,path:[],goalKey:'',near:false,nearCooldown:0,age:0,role:'pursuer'};
  game.police=[car];game.update(1/120);return{game,car};
}
test('a high-speed frontal ram destroys a full-health patrol even during its damage cooldown', () => {
  const {game,car}=collision({cooldown:1});
  assert.equal(car.hp,0);assert.equal(game.police.length,0);
  assert.equal(game.destroyed,1);assert.equal(game.explosions.length,1);assert.ok(game.shake>=20);
});
test('frontal contact removes one HP normally or three while boosting below the instant-kill speed', () => {
  for (const [options,hp] of [[{front:false},3],[{front:false,boost:false},4],[{speed:300},2],[{boost:false},4],[{speed:300,cooldown:1},5]]) {
    const {game,car}=collision(options);assert.equal(car.hp,hp);assert.equal(game.destroyed,0);assert.equal(game.explosions.length,0);
  }
});

test('contact damage can finish a weakened patrol from either direction', () => {
  for (const options of [{boost:false,hp:1},{speed:300,hp:3},{front:false,hp:2},{front:false,boost:false,hp:1}]) {
    const {game,car}=collision(options);assert.equal(car.hp,0);assert.equal(game.destroyed,1);assert.equal(game.explosions.length,1);
  }
  const {game,car}=collision({front:false,hp:5});assert.equal(car.hp,3);assert.equal(game.destroyed,0);
});
