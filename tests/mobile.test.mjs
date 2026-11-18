import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TouchInput, touchDrive, touchLayout } from '../src/mobile-controls.mjs';
import { ChaseGame } from '../src/game.js';

test('phones show touch controls in landscape and portrait; desktop stays unchanged', () => {
  assert.equal(touchLayout(844,390),true);
  assert.equal(touchLayout(390,844),true);
  assert.equal(touchLayout(1280,720),false);
  assert.equal(touchLayout(1366,1024,true),true);
});
test('steering, boost, and brake track separate fingers and release independently', () => {
  const input = new TouchInput();
  input.pointers.set(1,'stick'); input.stick={x:1,y:0};
  input.pointers.set(2,'boost'); input.pointers.set(3,'brake');
  input.release(2); assert.equal(input.boosting,false);assert.equal(input.braking,true);assert.equal(input.stick.x,1);
  input.release(1);assert.deepEqual(input.stick,{x:0,y:0});assert.equal(input.braking,true);
  input.reset();assert.equal(input.braking,false);assert.equal(input.pointers.size,0);
});
test('touch steering aims toward the stick and releasing it stops acceleration', () => {
  const player={angle:0};
  assert.equal(touchDrive(player,{x:0,y:0}).accelerating,false);
  assert.equal(touchDrive(player,{x:1,y:0}).steer,0);
  assert.equal(touchDrive(player,{x:0,y:1}).steer,1);
  assert.equal(touchDrive(player,{x:0,y:-1}).steer,-1);
  assert.equal(touchDrive(player,{x:.5,y:0}).targetSpeed,145);
});
function simulation(){const game=Object.create(ChaseGame.prototype);Object.assign(game,{keys:new Set(),w:844,h:390,touchLayout:true,audio:{update(){},tone(){}},onAnnouncement(){},onHud(){},onPause(){},onFinish(){}});game.start('#bcff4a');game.police=[];game.pickups=[];game.spawnTimer=999;game.nextPickup=999;return game;}
test('mobile reverse is cancelled by usable boost, brake has inertia, pause releases fingers', () => {
  const g=simulation(); assert.equal(g.inputMode,'touch');g.reverseMode=true;
  for(let i=0;i<30;i++)g.update(1/120);
  assert.ok(g.player.speed<0);
  g.touchInput.pointers.set(2,'boost');g.update(1/120);
  assert.equal(g.reverseMode,false);assert.ok(g.player.speed>0);
  g.touchInput.release(2);g.player.speed=250;g.player.vx=0;g.player.vy=-250;g.touchInput.pointers.set(3,'brake');
  g.update(1/120);assert.ok(g.player.speed>240);assert.equal(g.boosting,false);
  g.pause();assert.equal(g.touchInput.pointers.size,0);assert.equal(g.reverseMode,false);
});
