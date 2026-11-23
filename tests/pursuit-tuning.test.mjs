import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boostAcceleration, movePatrol, explosionFeedback, ChaseGame } from '../src/game.js';

test('low-speed boost tapers continuously from 1.8x to normal at 200 km/h', () => {
  for (const [speed, multiplier] of [[0,1.8],[50,1.6],[100,1.4],[150,1.2],[200,1],[250,1],[312,1]]) {
    assert.ok(Math.abs(boostAcceleration(speed) / 420 - multiplier) < 1e-10);
  }
  assert.ok(Math.abs(boostAcceleration(199.999) - boostAcceleration(200)) < .01);
});

test('a fast patrol carries on straight after a sudden right-angle turn', () => {
  const car={x:0,y:0,angle:0,speed:320};
  for(let i=0;i<36;i++)movePatrol(car,Math.PI/2,1/120);
  assert.ok(car.x>90);assert.ok(car.y<10);assert.ok(car.angle<.3);
  assert.ok(car.vx>300);assert.ok(car.vy<65);
  for(let i=0;i<240;i++)movePatrol(car,Math.PI/2,1/120);
  assert.ok(car.vy>250);assert.ok(Math.abs(car.angle-Math.PI/2)<.2);
});

test('patrol inertia behaves consistently across frame rates and still tracks straight roads', () => {
  function drive(dt,desired){const c={x:0,y:0,angle:0,speed:320};for(let t=0;t<1-dt/2;t+=dt)movePatrol(c,desired,dt);return c;}
  const a=drive(1/60,Math.PI/2),b=drive(1/120,Math.PI/2);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<4);
  const straight=drive(1/120,0);assert.ok(Math.abs(straight.x-320)<.01);assert.equal(straight.y,0);
});

test('route-following patrols make controlled turns while close pursuits still overshoot', () => {
  const nearby={x:0,y:0,angle:0,speed:200},remote={...nearby};
  for(let i=0;i<60;i++){movePatrol(nearby,Math.PI/2,1/120,true);movePatrol(remote,Math.PI/2,1/120,false);}
  assert.ok(remote.angle>nearby.angle+.3);
  assert.ok(Math.atan2(remote.vy,remote.vx)>Math.atan2(nearby.vy,nearby.vx)+.3);
});

test('explosion feedback stays powerful nearby and disappears off screen without moving the wreck', () => {
  const g=simulation();let sounds=0;g.audio.explosion=()=>sounds++;
  const nearby={x:1620,y:1600,angle:0};g.explode(nearby);
  assert.equal(g.shake,21);assert.equal(g.flash,.72);assert.equal(sounds,1);
  g.shake=0;g.flash=0;
  const remote={x:3100,y:2400,angle:0};g.explode(remote);
  assert.equal(g.shake,0);assert.equal(g.flash,0);assert.equal(sounds,1);
  assert.equal(g.explosions.at(-1).x,remote.x);assert.equal(g.explosions.at(-1).y,remote.y);
  assert.equal(explosionFeedback({x:1600,y:2050},g.player,g.camera,667,320),0);
});

function simulation(){
  const g=Object.create(ChaseGame.prototype);
  Object.assign(g,{keys:new Set(),w:1280,h:800,audio:{update(){},tone(){}},onAnnouncement(){},onHud(){},onFinish(){},onPause(){}});
  g.start('#bcff4a');g.spawnTimer=999;g.pickups=[];g.nextPickup=999;g.inputMode='keyboard';return g;
}

test('high-speed head-on building crash explodes once; glancing and slow hits survive', () => {
  for (const [vx,vy,expectedHp] of [[320,0,0],[180,300,4],[110,0,5],[-320,0,5]]) {
    const g=simulation(),car=g.police[0];g.police=[car];
    Object.assign(car,{x:1300,y:1600,angle:Math.atan2(vy,vx),speed:Math.hypot(vx,vy),vx,vy,pursuitCredit:2,cooldown:0,pathTimer:100,path:[]});
    g.hitWalls=c=>c===car?{x:-1,y:0,depth:1}:null;
    g.update(1/120);assert.equal(car.hp,expectedHp);
    assert.equal(g.destroyed,expectedHp===0?1:0);assert.equal(g.explosions.length,expectedHp===0?1:0);
    if(expectedHp===0){assert.ok(g.shake>=20);g.update(1/120);assert.equal(g.destroyed,1);}
  }
});

test('live boost acceleration uses actual speed and keeps the original top speed', () => {
  for(const speedKmh of [50,200,250]){
    const g=simulation();g.police=[];g.hitWalls=()=>null;g.keys.add('Space');
    const before=speedKmh/.65;
    Object.assign(g.player,{angle:0,speed:before,vx:before,vy:0});g.update(1/120);
    assert.ok(Math.abs(g.player.speed-before-boostAcceleration(speedKmh)/120)<1e-8);
    for(let i=0;i<240;i++)g.update(1/120);
    assert.ok(g.player.speed<=480);assert.ok(Math.hypot(g.player.vx,g.player.vy)*.65<=312.001);
  }
});
