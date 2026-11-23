import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ChaseGame,pursuitTarget,playerCausedCrash} from '../src/game.js';

function simulation(){
  const g=Object.create(ChaseGame.prototype);
  Object.assign(g,{keys:new Set(),w:1280,h:800,audio:{update(){},tone(){}},onAnnouncement(){},onHud(){},onFinish(){},onPause(){}});
  g.start('#bcff4a');g.inputMode='keyboard';g.pickups=[];g.nextPickup=999;return g;
}

test('building takedowns need recent player pursuit, proximity and a visible crash',()=>{
  const g=simulation(),c={x:1700,y:1600,pursuitCredit:1};
  assert.equal(playerCausedCrash(c,g.player,g.camera,g.w,g.h),true);
  assert.equal(playerCausedCrash({...c,pursuitCredit:0},g.player,g.camera,g.w,g.h),false);
  assert.equal(playerCausedCrash({...c,x:2200},g.player,g.camera,g.w,g.h),false);
  assert.equal(playerCausedCrash({...c,y:2000},g.player,g.camera,667,320),false);
});

test('unrelated wall collisions cannot wear down or explode a patrol, even at high speed',()=>{
  const g=simulation(),c=g.police[0];g.police=[c];g.spawnTimer=999;
  g.hitWalls=car=>car===c?{x:-1,y:0,depth:1}:null;
  for(let i=0;i<5;i++){
    Object.assign(c,{x:2600,y:1600,angle:0,speed:340,vx:340,vy:0,cooldown:0,pathTimer:100,path:[],pursuitCredit:0});
    g.update(1/120);assert.equal(c.hp,5);assert.equal(g.destroyed,0);assert.equal(g.explosions.length,0);
  }
});

test('wanted level five restores all twelve patrols after repeated full takedown waves',()=>{
  assert.deepEqual([1,2,3,4,5].map(pursuitTarget),[3,5,7,9,12]);
  const g=simulation();g.time=101;g.level=5;g.police=[];g.spawnTimer=0;g.hitWalls=()=>null;
  const recover=()=>{for(let i=0;i<420;i++){g.health=100;g.capture=0;g.update(1/120);assert.ok(g.police.length<=12);}assert.equal(g.police.length,12);};
  recover();
  for(let wave=0;wave<3;wave++){
    const before=g.destroyed;for(const c of g.police)c.hp=0;
    g.update(1/120);assert.equal(g.destroyed-before,12);recover();
  }
});

test('reinforcements arrive on roads outside the camera and already moving',()=>{
  const g=simulation();g.police=[];
  for(let i=0;i<12;i++)g.addPolice(300,true);
  assert.equal(g.police.length,12);
  for(const c of g.police){
    assert.ok(Math.abs((c.x-g.camera.x)*g.camera.zoom)>g.w/2+65||Math.abs((c.y-g.camera.y)*g.camera.zoom)>g.h/2+65);
    assert.equal(c.speed,220);assert.ok(c.path.length>0);assert.equal(c.hp,5);
  }
});
