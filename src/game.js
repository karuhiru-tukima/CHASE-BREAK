import { roads, roadNodes, CITY_SIZE as SIZE, buildings, obstacles, parkedCars, roadRoute, nearestRoadNode, sampleRoad, wrapCity } from './city.js';
import { drawCity } from './city-renderer.js';
import { TouchInput, touchDrive } from './mobile-controls.mjs';
export { buildings } from './city.js';
const TAU = Math.PI * 2;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const angleDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (a, b) => a + Math.random() * (b - a);

export const RAM_MIN_KMH = 250;
export function boostAcceleration(speedKmh) {
  return 420 * (1 + .4 * clamp((200 - Math.max(0, speedKmh)) / 200, 0, 1));
}

export function movePatrol(car, desired, dt) {
  // Steering takes time to build; fast patrols carry momentum through a turn.
  const turnLimit = lerp(3.4, 1.7, clamp(car.speed / 320, 0, 1));
  const requestedTurn = clamp(angleDiff(car.angle, desired) * 2.8, -turnLimit, turnLimit);
  car.turnRate = lerp(car.turnRate || 0, requestedTurn, 1 - Math.exp(-4 * dt));
  const vx = car.vx ?? Math.cos(car.angle) * car.speed;
  const vy = car.vy ?? Math.sin(car.angle) * car.speed;
  car.angle += car.turnRate * dt;
  const grip = 1 - Math.exp(-lerp(5, 2.1, clamp(car.speed / 320, 0, 1)) * dt);
  car.vx = lerp(vx, Math.cos(car.angle) * car.speed, grip);
  car.vy = lerp(vy, Math.sin(car.angle) * car.speed, grip);
  car.x += car.vx * dt; car.y += car.vy * dt;
}
export function canBoostRam(player, car, boosting) {
  if (!boosting) return false;
  const fx = Math.cos(player.angle), fy = Math.sin(player.angle);
  if ((player.vx * fx + player.vy * fy) * .65 < RAM_MIN_KMH) return false;
  const dx = car.x - player.x, dy = car.y - player.y, distance = Math.hypot(dx, dy);
  if (distance <= .01 || distance >= 39 || dx * fx + dy * fy < distance * .5) return false;
  const cvx = car.vx ?? Math.cos(car.angle || 0) * (car.speed || 0), cvy = car.vy ?? Math.sin(car.angle || 0) * (car.speed || 0);
  return (player.vx - cvx) * dx + (player.vy - cvy) * dy > 0;
}

export function circleRect(x, y, radius, rect) {
  const reach=(rect.w+rect.h)*.5+radius;
  if(Math.abs(x-rect.x-rect.w/2)>reach||Math.abs(y-rect.y-rect.h/2)>reach)return null;
  if (rect.angle) {
    const cx=rect.x+rect.w/2,cy=rect.y+rect.h/2,c=Math.cos(rect.angle),s=Math.sin(rect.angle);
    const hit=circleRect(cx+(x-cx)*c+(y-cy)*s,cy-(x-cx)*s+(y-cy)*c,radius,{...rect,angle:0});
    return hit ? {x:hit.x*c-hit.y*s,y:hit.x*s+hit.y*c,depth:hit.depth} : null;
  }
  const cx = clamp(x, rect.x, rect.x + rect.w), cy = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
  if (d >= radius) return null;
  if (d > 0) return { x: dx / d, y: dy / d, depth: radius - d };
  const sides = [{ x: -1, y: 0, depth: x - rect.x + radius }, { x: 1, y: 0, depth: rect.x + rect.w - x + radius }, { x: 0, y: -1, depth: y - rect.y + radius }, { x: 0, y: 1, depth: rect.y + rect.h - y + radius }];
  return sides.sort((a, b) => a.depth - b.depth)[0];
}
export function route(from, to) {
  return roadRoute(from,to);
}
export function mouseDrive(player, pointer, camera, width, height) {
  const dx=camera.x+(pointer.x-width/2)/camera.zoom-player.x,dy=camera.y+(pointer.y-height/2)/camera.zoom-player.y,distance=Math.hypot(dx,dy);
  return { steer: distance<12?0:clamp(angleDiff(player.angle,Math.atan2(dy,dx))*1.8,-1,1), accelerating:distance>55&&!pointer.braking, braking:pointer.braking||distance<=55, targetSpeed:clamp((distance-35)*2.2,0,290), distance };
}
export function inertialBrake(vx,vy,dt){
  const speed=Math.hypot(vx,vy),next=Math.max(0,speed-(105+speed*.12)*dt),ratio=speed>.001?next/speed:0;
  return{vx:vx*ratio,vy:vy*ratio,speed:next};
}
export const BOOST_RESTART = 35;
export function boostStep(energy,locked,requested,braking,dt){
  if(locked&&energy>=BOOST_RESTART)locked=false;
  let active=requested&&!braking&&!locked&&energy>0;
  if(active){energy=Math.max(0,energy-34*dt);if(energy<=0){locked=true;active=false;}}
  else energy=Math.min(100,energy+15*dt);
  if(locked&&energy>=BOOST_RESTART)locked=false;
  return{energy,locked,active};
}
const clearLine = (a, b) => {
  const count = Math.ceil(dist(a, b) / 28);
  for (let i = 1; i <= count; i++) { const x = wrapCity(lerp(a.x, b.x, i / count)), y = wrapCity(lerp(a.y, b.y, i / count)); if (obstacles.some(r => circleRect(x, y, 22, r))) return false; }
  return true;
};

export class AudioEngine {
  enabled = false; context = null; motor = null;
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      await this.context.resume();
      if (!this.motor) { this.motor = this.context.createOscillator(); this.gain = this.context.createGain(); this.motor.type = 'sawtooth'; this.gain.gain.value = 0; this.motor.connect(this.gain).connect(this.context.destination); this.motor.start(); }
    } else if (this.gain) this.gain.gain.value = 0;
    return this.enabled;
  }
  update(speed, active, time) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    this.motor.frequency.setTargetAtTime(35 + Math.abs(speed) * .24, now, .09);
    this.gain.gain.setTargetAtTime(active ? .015 + Math.abs(speed) * .000035 : 0, now, .08);
    if (active && Math.floor(time * 2) !== this.lastSiren) { this.lastSiren = Math.floor(time * 2); this.tone(this.lastSiren % 2 ? 610 : 810, .16, .009, 'sine'); }
  }
  tone(freq = 500, duration = .12, volume = .06, type = 'triangle') {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime, o = this.context.createOscillator(), g = this.context.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, now); o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * .45), now + duration);
    g.gain.setValueAtTime(volume, now); g.gain.exponentialRampToValueAtTime(.0001, now + duration); o.connect(g).connect(this.context.destination); o.start(); o.stop(now + duration);
  }
  explosion() {
    if(!this.enabled||!this.context)return;
    const c=this.context,now=c.currentTime,buffer=c.createBuffer(1,Math.floor(c.sampleRate*.85),c.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(1800,now);filter.frequency.exponentialRampToValueAtTime(110,now+.8);gain.gain.setValueAtTime(.22,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.85);source.connect(filter).connect(gain).connect(c.destination);source.start();source.stop(now+.85);this.tone(85,.65,.16,'sine');
  }
}

export class ChaseGame {
  constructor(canvas, { onHud, onFinish, onPause, onAnnouncement, audio }) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); Object.assign(this, { onHud, onFinish, onPause, onAnnouncement, audio });
    this.keys = new Set(); this.mode = 'demo'; this.color = '#bcff4a'; this.camera = { x: 1600, y: 1600, zoom: 1 }; this.particles = []; this.trails = []; this.police = []; this.pickups = []; this.explosions=[];this.flash=0; this.demoTime = 0; this.frameTime = 0; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize = () => { this.w = innerWidth; this.h = innerHeight; this.dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = this.w * this.dpr; canvas.height = this.h * this.dpr; };
    window.addEventListener('resize', this.resize); this.resize();
    this.mouse={x:this.w/2,y:this.h/2-180,braking:false,boosting:false};this.inputMode='mouse';
    this.boostFx=0;this.afterimages=[];this.afterimageClock=0;
    this.touchInput = new TouchInput();
    window.addEventListener('pointermove',e=>{if(this.mode==='playing'&&e.pointerType!=='touch'&&!e.target.closest('#touch-controls')){this.mouse.x=e.clientX;this.mouse.y=e.clientY;this.inputMode='mouse';}});
    window.addEventListener('pointerdown',e=>{
      if(this.mode!=='playing'||e.pointerType==='touch'||e.target.closest('button,dialog'))return;
      if(e.button===2){e.preventDefault();this.mouse.braking=true;}
      if(e.button===0){e.preventDefault();this.mouse.boosting=true;}
    });
    window.addEventListener('pointerup',e=>{if(e.button===2)this.mouse.braking=false;if(e.button===0)this.mouse.boosting=false;});
    window.addEventListener('pointercancel',()=>{this.mouse.braking=false;this.mouse.boosting=false;});
    window.addEventListener('contextmenu',e=>{if(this.mode==='playing'||this.mode==='paused')e.preventDefault();});
    window.addEventListener('keydown', e => {
      if (this.mode !== 'playing') return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape','ShiftLeft','ShiftRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape' && !e.repeat) { this.pause(); return; }
      if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat)this.reverseMode=true;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))this.inputMode='keyboard';
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => {this.keys.delete(e.code);if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!this.keys.has('ShiftLeft')&&!this.keys.has('ShiftRight'))this.reverseMode=false;});
    window.addEventListener('blur', () => { this.keys.clear(); if (this.mode === 'playing') this.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'playing') this.pause(); });
    requestAnimationFrame(t => this.frame(t));
  }
  start(color) {
    this.color = color; this.mode = 'playing'; this.keys.clear(); this.time = 0; this.health = 100; this.boost = 100; this.capture = 0; this.nearMisses = 0; this.destroyed = 0; this.bonusPoints = 0; this.combo = 1; this.maxCombo = 1; this.chain = 0; this.comboTimer = 0; this.spawnTimer = 0; this.level = 1; this.shake = 0; this.particles = []; this.trails = []; this.police = []; this.pickups = []; this.nextPickup = 12; this.lastHud = -1;
    this.player = { x: 1600, y: 1600, angle: -Math.PI / 2, speed: 0, vx: 0, vy: 0, cooldown: 0 };
    this.mouse={x:this.w/2,y:this.h/2-180,braking:false,boosting:false};this.inputMode=this.touchLayout?'touch':'mouse';
    this.touchInput = new TouchInput();
    this.explosions=[];this.flash=0;
    this.boostFx=0;this.afterimages=[];this.afterimageClock=0;
    this.boostLocked=false;this.reverseMode=false;this.policeSerial=0;
    this.camera = { x: 1600, y: 1600, zoom: .95 }; this.addPolice(420);this.addPolice(580);this.addPolice(720);
    for (let i = 0; i < 18; i++) this.addPickup(i % 3 === 0 ? 'repair' : 'boost');
    this.onAnnouncement('RUN THE NIGHT'); this.hud();
  }
  pause() { if (this.mode !== 'playing') return; this.mode = 'paused'; this.keys.clear(); this.mouse.braking=false; this.mouse.boosting=false; this.reverseMode=false;this.touchInput?.reset();this.audio.update(0, false, 0); this.onPause(); }
  resume() { if (this.mode === 'paused') { this.keys.clear(); this.mode = 'playing'; } }
  garage() { this.mode = 'demo'; this.keys.clear(); this.audio.update(0, false, 0); }
  addPolice(minDistance = 580) {
    const options = [];
    const tx=Math.floor(this.player.x/SIZE),ty=Math.floor(this.player.y/SIZE);
    for(let y=ty-1;y<=ty+1;y++)for(let x=tx-1;x<=tx+1;x++)for (const n of roadNodes) { const p={x:n.x+x*SIZE,y:n.y+y*SIZE};const d = dist(p, this.player); if (d > minDistance && d < minDistance + 650 && !this.police.some(c => dist(c, p) < 100)) options.push(p); }
    const p = options[Math.floor(Math.random() * options.length)]; if (!p) return;
    const role=['chaser','interceptor','blocker'][this.policeSerial++%3];
    this.police.push({ ...p, role, angle: Math.atan2(this.player.y - p.y, this.player.x - p.x), speed: 110, hp: 5, cooldown: 0, pathTimer: 0, path: [], near: false, nearHit: false, nearCooldown: 0, age: 0,recovery:0 });
  }
  addPickup(type) {
    for (let i = 0; i < 30; i++) {
      const n=nearestRoadNode({x:this.player.x+rand(-850,850),y:this.player.y+rand(-850,850)}),p={x:n.x+rand(-10,10),y:n.y+rand(-10,10)};
      if (this.pickups.some(a => dist(a, p) < 130)) continue;
      this.pickups.push({ ...p, type, phase: rand(0, TAU) }); return;
    }
  }
  burst(x, y, color, count = 16, force = 180) {
    for (let i = 0; i < count; i++) { const a = rand(0, TAU), speed = rand(30, force); this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: rand(.25, .7), max: .7, color, size: rand(2, 5) }); }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }
  explode(car) {
    if(car.exploded)return;car.exploded=true;
    this.explosions.push({x:car.x,y:car.y,angle:car.angle,age:0});if(this.explosions.length>16)this.explosions.shift();
    this.shake=Math.max(this.shake||0,21);this.flash=Math.max(this.flash||0,.72);
    for(let i=0;i<85;i++){const a=rand(0,TAU),speed=rand(90,520),life=rand(.4,1.1);this.particles.push({x:car.x,y:car.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,max:life,color:i%3?'#ffd668':'#ff713a',size:rand(2,5),kind:'spark'});}
    for(let i=0;i<9;i++){const a=rand(0,TAU),speed=rand(80,240);this.particles.push({x:car.x,y:car.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:2,max:2,color:i%2?'#62727a':'#18232c',size:rand(5,12),kind:'debris',angle:a,spin:rand(-8,8)});}
    if(this.particles.length>550)this.particles.splice(0,this.particles.length-550);
    this.audio.explosion?.();
  }
  drawExplosion(ctx,e) {
    const age=e.age;
    ctx.save();ctx.translate(e.x,e.y);
    // Charred chassis remains briefly under the fire and drifting smoke.
    ctx.save();ctx.rotate(e.angle);ctx.globalAlpha=clamp(1-(age-2)/2,0,1);ctx.fillStyle='#080d12';ctx.fillRect(-27,-15,54,30);ctx.strokeStyle='#b1522355';ctx.strokeRect(-25,-13,50,26);ctx.restore();
    if(age<.7){const t=age/.7;ctx.globalAlpha=(1-t)*.75;ctx.strokeStyle='#ffdd9b';ctx.lineWidth=9*(1-t)+1;ctx.beginPath();ctx.arc(0,0,20+t*175,0,TAU);ctx.stroke();}
    if(age<1.1){const growth=Math.min(1,age/.12),fade=clamp((1.1-age)/.65,0,1);ctx.globalCompositeOperation='screen';
      for(let i=0;i<12;i++){const a=i*2.399,spread=(18+(i%4)*16)*growth,r=(22+(i%3)*12)*growth;ctx.globalAlpha=fade*(i<5?.85:.6);ctx.fillStyle=i%3===0?'#ff4e24':i%3===1?'#ff9b32':'#ffe59c';ctx.beginPath();ctx.arc(Math.cos(a)*spread,Math.sin(a)*spread,r,0,TAU);ctx.fill();}
      ctx.globalAlpha=clamp(1-age/.35,0,1);ctx.fillStyle='#fffbe3';ctx.beginPath();ctx.arc(0,0,58*growth,0,TAU);ctx.fill();ctx.globalCompositeOperation='source-over';
    }
    if(age>.18){const smoke=Math.min(1,(age-.18)*2),fade=clamp((4-age)/2.5,0,1);for(let i=0;i<7;i++){const a=i*2.4;ctx.globalAlpha=smoke*fade*.25;ctx.fillStyle=i%2?'#24252a':'#10151c';ctx.beginPath();ctx.arc(Math.cos(a)*(20+age*17),Math.sin(a)*(20+age*13)-age*24,19+age*10+(i%3)*5,0,TAU);ctx.fill();}}
    ctx.restore();
  }
  hitWalls(car, radius) {
    let impact = null;
    for (const r of obstacles) { const n = circleRect(wrapCity(car.x), wrapCity(car.y), radius, r); if (n) { car.x += n.x * n.depth; car.y += n.y * n.depth; impact = n; } }
    return impact;
  }
  event(type) {
    this.chain = this.comboTimer > 0 ? this.chain + 1 : 1;
    this.combo = Math.min(5, 1 + Math.floor((this.chain - 1) / 2)); this.maxCombo = Math.max(this.combo, this.maxCombo); this.comboTimer = 5;
    const points = (type === 'near' ? 100 : 300) * this.combo; this.bonusPoints += points;
    if (type === 'near') this.nearMisses++; else this.destroyed++;
    this.onAnnouncement(`${type === 'near' ? 'NEAR MISS' : 'TAKEDOWN'} +${points}${this.combo > 1 ? ` ×${this.combo}` : ''}`); this.audio.tone(type === 'near' ? 1000 : 180, .2, .045);
  }
  finish(reason) {
    if (this.mode !== 'playing') return;
    this.mode = 'finished'; this.keys.clear(); this.audio.update(0, false, 0); this.audio.tone(120, .7, .06, 'sawtooth');
    this.onFinish({ seconds: Number(this.time.toFixed(3)), nearMisses: this.nearMisses, destroyed: this.destroyed, bonusPoints: this.bonusPoints, maxCombo: this.maxCombo, reason, score: Math.floor(Number(this.time.toFixed(3)) * 10) + this.bonusPoints });
  }
  update(dt) {
    const p = this.player, key = (...codes) => codes.some(c => this.keys.has(c));
    this.time += dt; p.cooldown = Math.max(0, p.cooldown - dt); this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (!this.comboTimer) { this.combo = 1; this.chain = 0; }
    const touch=this.inputMode==='touch';
    const mouse=this.inputMode==='mouse'?mouseDrive(p,this.mouse,this.camera,this.w,this.h):touch?touchDrive(p,this.touchInput.stick):null;
    const accelerating = mouse?mouse.accelerating:key('KeyW', 'ArrowUp'), braking = this.mouse.braking||this.touchInput.braking||(!this.reverseMode&&(mouse?mouse.braking:key('KeyS', 'ArrowDown')));
    const boostState=boostStep(this.boost,this.boostLocked,key('Space')||this.mouse.boosting||this.touchInput.boosting,braking,dt),boosting=boostState.active;
    this.boost=boostState.energy;this.boostLocked=boostState.locked;this.boosting=boosting;
    if(boosting&&this.reverseMode){this.reverseMode=false;p.speed=Math.max(65,p.speed);const forward=p.vx*Math.cos(p.angle)+p.vy*Math.sin(p.angle);if(forward<0){p.vx-=forward*Math.cos(p.angle);p.vy-=forward*Math.sin(p.angle);}}
    if (boosting) p.speed += boostAcceleration(Math.hypot(p.vx, p.vy) * .65) * dt;
    else if(this.reverseMode&&!braking)p.speed=Math.max(-145,p.speed-240*dt);
    else if (accelerating) {const target=mouse?mouse.targetSpeed:290;p.speed=p.speed<target?Math.min(target,p.speed+200*dt):Math.max(target,p.speed-85*dt);}
    else if (!braking) p.speed *= Math.exp(-.18 * dt);
    const brakeOnly=braking&&(this.mouse.braking||this.touchInput.braking||mouse);
    if(braking&&!brakeOnly)p.speed-= (p.speed>0?230:130)*dt;
    // Let boost speed coast down, rather than clipping instantly to normal speed.
    p.speed = clamp(p.speed,-145,480);
    const steer = mouse?mouse.steer:Number(key('KeyD', 'ArrowRight')) - Number(key('KeyA', 'ArrowLeft'));
    p.angle += steer * (!mouse&&p.speed < -5 ? -1 : 1) * lerp(.65, 2.7, clamp(Math.abs(p.speed) / 140, 0, 1)) * dt * (boosting ? .82 : 1);
    const tx = Math.cos(p.angle) * p.speed, ty = Math.sin(p.angle) * p.speed, grip = 1 - Math.exp(-(boosting?4.6:5.8) * dt);
    if(brakeOnly){const motion=inertialBrake(p.vx,p.vy,dt);p.vx=motion.vx;p.vy=motion.vy;p.speed=(p.vx*Math.cos(p.angle)+p.vy*Math.sin(p.angle)<0?-1:1)*motion.speed;}
    else{p.vx = lerp(p.vx, tx, grip); p.vy = lerp(p.vy, ty, grip);}
    p.x += p.vx * dt; p.y += p.vy * dt;
    const wall = this.hitWalls(p, 17);
    if (wall) {
      const impact = Math.abs(p.vx * wall.x + p.vy * wall.y);
      const dot = p.vx * wall.x + p.vy * wall.y;
      if (dot < 0) { p.vx -= dot * wall.x * 1.15; p.vy -= dot * wall.y * 1.15; }
      p.speed *= .65;
      if (p.cooldown <= 0 && impact > 55) { this.health -= clamp(impact * .055, 3, 19); p.cooldown = .65; this.shake = Math.max(this.shake,6); this.burst(p.x, p.y, '#ffce85', 15); this.audio.tone(90, .12, .055, 'sawtooth'); }
    }
    if (Math.abs(p.speed) > 90 && (steer || braking)) {
      this.trails.push({ x: p.x, y: p.y, angle: p.angle, life: 6 }); if (this.trails.length > 650) this.trails.shift();
    }
    if (boosting && Math.random() < .65) {
      this.particles.push({ x: p.x - Math.cos(p.angle) * 25, y: p.y - Math.sin(p.angle) * 25, vx: -Math.cos(p.angle) * 100 + rand(-20, 20), vy: -Math.sin(p.angle) * 100 + rand(-20, 20), life: .3, max: .3, size: rand(4, 9), color: '#46dfff' });
    }
    const motionSpeed=Math.hypot(p.vx,p.vy);
    this.boostFx=lerp(this.boostFx,boosting?clamp(motionSpeed/420,0,1):0,1-Math.exp(-(boosting?9:5)*dt));
    this.afterimageClock+=dt;
    if(boosting&&motionSpeed>90&&!this.reduced&&this.afterimageClock>=.03){this.afterimageClock=0;this.afterimages.push({x:p.x,y:p.y,angle:p.angle,life:.28});if(this.afterimages.length>14)this.afterimages.shift();}
    const level = Math.min(5, 1 + Math.floor(this.time / 25));
    if (level !== this.level) { this.level = level; this.onAnnouncement(`WANTED LEVEL ${level}`); this.audio.tone(700, .4); }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 1.8; if (this.police.length < Math.min(12, 3 + Math.floor(this.time / 12))) this.addPolice(500); }
    let nearby = 0;
    for (const c of this.police) {
      c.age += dt; c.cooldown = Math.max(0, c.cooldown - dt); c.nearCooldown = Math.max(0, c.nearCooldown - dt); c.pathTimer -= dt;c.recovery=Math.max(0,(c.recovery||0)-dt);
      const lead=c.role==='blocker'?1.35:c.role==='interceptor'?.85:.3,predicted={x:p.x+p.vx*lead,y:p.y+p.vy*lead},goal=c.role==='chaser'?p:nearestRoadNode(predicted);
      if (c.pathTimer <= 0) {
        c.pathTimer = .28 + Math.random() * .12;
        const goalKey = nearestRoadNode(goal).key;
        if (c.goalKey !== goalKey || !c.path.length) {
          c.goalKey = goalKey; c.path = route(c, goal);
          if (c.path[0] && dist(c, c.path[0]) < 65) c.path.shift();
          if (c.path.length > 1 && clearLine(c, c.path[1])) c.path.shift();
        }
      }
      while (c.path.length>1&&(dist(c,c.path[0])<50||(dist(c,c.path[1])<170&&clearLine(c,c.path[1])))) c.path.shift();
      if(c.path.length&&dist(c,c.path[0])<30)c.path.shift();
      const target = c.recovery>0?nearestRoadNode(c):dist(c,p)<470&&clearLine(c,p)?(clearLine(c,predicted)?predicted:p):(c.path[0]||goal);
      const desired = Math.atan2(target.y - c.y, target.x - c.x), diff = angleDiff(c.angle, desired);
      const arresting = dist(c, p) < 130 && Math.abs(p.speed) < 65 && clearLine(c, p);
      const pursuitSpeed=300+this.level*17+clamp((dist(c,p)-350)*.08,0,48),turnFactor=clamp(1-Math.abs(diff)/Math.PI,.32,1);
      const maxSpeed = c.recovery>0?125:arresting ? clamp((dist(c,p)-52)*3,0,200) : Math.min(pursuitSpeed*turnFactor,Math.max(90,dist(c,target)*3));
      c.speed = lerp(c.speed,maxSpeed,1-Math.exp(-3.8*dt));
      movePatrol(c, desired, dt);
      const cw = this.hitWalls(c, 17);
      if (cw) {
        const velocity = Math.hypot(c.vx, c.vy), intoWall = -(c.vx * cw.x + c.vy * cw.y);
        // A hard head-on crash is fatal; glancing blows retain the durability rule.
        if (intoWall > 250 && intoWall >= velocity * .78) c.hp = 0;
        else if (c.cooldown <= 0 && intoWall > 150) { c.hp--; c.cooldown = 1.2; this.burst(c.x, c.y, '#ffc484', 10); }
        if (intoWall > 0) { c.vx += intoWall * cw.x * 1.1; c.vy += intoWall * cw.y * 1.1; }
        c.vx *= .55; c.vy *= .55; c.turnRate = 0;
        c.speed*=.55;c.recovery=.7;c.pathTimer=0;c.angle+=clamp(angleDiff(c.angle,Math.atan2(cw.y,cw.x)),-4*dt,4*dt);
      }
      const d = dist(c, p);
      if (d < 135) nearby++;
      if (d < 105 && !c.near && c.nearCooldown <= 0) { c.near = true; c.nearHit = false; c.nearSpeed = Math.abs(p.speed); }
      if (d > 140 && c.near) { if (!c.nearHit && c.nearSpeed > 145) this.event('near'); c.near = false; c.nearCooldown = 3; }
      if (d < 39) {
        c.nearHit = true;
        const ram = canBoostRam(p, c, boosting);
        const nx = (p.x - c.x) / Math.max(d, .01), ny = (p.y - c.y) / Math.max(d, .01);
        p.x += nx * (39 - d) * .55; p.y += ny * (39 - d) * .55; c.x -= nx * (39 - d) * .45; c.y -= ny * (39 - d) * .45;
        if (ram) {
          c.hp = 0;
        } else if (c.cooldown <= 0) {
          c.cooldown = .8; c.speed *= .4; c.vx *= .4; c.vy *= .4; this.burst(c.x, c.y, '#ffd39a', 12); this.shake = Math.max(this.shake, 4); this.audio.tone(95, .15, .05, 'sawtooth');
          if (p.cooldown <= 0) { this.health -= boosting ? 2 : 12; p.cooldown = .65; if (!boosting) p.speed *= .6; }
        }
      }
      if (c.hp <= 0) { this.event('destroy'); this.explode(c); }
    }
    for (let i = 0; i < this.police.length; i++) for (let j = i + 1; j < this.police.length; j++) {
      const a = this.police[i], b = this.police[j], d = dist(a, b);
      if (d > 0 && d < 36) { const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d; a.x -= nx * (36 - d) / 2; a.y -= ny * (36 - d) / 2; b.x += nx * (36 - d) / 2; b.y += ny * (36 - d) / 2; }
    }
    this.police = this.police.filter(c => c.hp > 0 && dist(c,p)<2200);
    // Car-to-car separation can push a vehicle against a wall or the map edge.
    this.hitWalls(p, 17);
    for (const c of this.police) this.hitWalls(c, 17);
    this.capture = clamp(this.capture + ((nearby > 0 && Math.hypot(p.vx,p.vy) < 65) ? (20 + nearby * 8) : -33) * dt, 0, 100);
    for (const item of this.pickups) if (dist(item, p) < 42) { item.taken = true; if (item.type === 'repair') { this.health = Math.min(100, this.health + 30); this.onAnnouncement('REPAIRED +30'); } else { this.boost = Math.min(100, this.boost + 45); this.onAnnouncement('BOOST +45'); } this.burst(item.x, item.y, item.type === 'repair' ? '#bcff4a' : '#20d9ff', 12, 90); this.audio.tone(1300, .12, .04); }
    this.pickups = this.pickups.filter(item => !item.taken&&dist(item,p)<1500); this.nextPickup -= dt;
    if (this.nextPickup <= 0) { this.nextPickup = this.pickups.length<12?.5:8; if (this.pickups.length < 22) this.addPickup(Math.random() > .5 ? 'repair' : 'boost'); }
    this.health = Math.max(0, this.health);
    const desiredZoom = this.touchLayout ? Math.min(.8,this.h/480) : this.w < 720 ? .8 : 1.05;
    this.camera.zoom = lerp(this.camera.zoom, desiredZoom - (this.reduced?0:this.boostFx*(this.w<720?.25:.32)), 1 - Math.exp(-(boosting?6:3) * dt));
    const lead=.3+this.boostFx*.12;
    this.camera.x = lerp(this.camera.x, p.x + p.vx*lead, 1 - Math.exp(-5 * dt)); this.camera.y = lerp(this.camera.y, p.y + p.vy*lead, 1 - Math.exp(-5 * dt));
    if (this.time - this.lastHud > .07) { this.lastHud = this.time; this.hud(); }
    this.audio.update(p.speed, true, this.time);
    if (this.health <= 0) this.finish('wrecked'); else if (this.capture >= 100) this.finish('busted');
  }
  hud() { this.onHud({ score: Math.floor(this.time * 10) + this.bonusPoints, seconds: this.time, health: this.health, boost: this.boost,boostLocked:this.boostLocked,reverseMode:this.reverseMode,policeCount:this.police.length,capture: this.capture, speed: Math.hypot(this.player.vx,this.player.vy) * .65, level: this.level, combo: this.combo, comboTimer: this.comboTimer }); }
  frame(t) {
    const dt = Math.min((t - (this.frameTime || t)) / 1000, .05); this.frameTime = t;
    if (this.mode === 'playing') { const steps = Math.max(1, Math.ceil(dt / .012)); for (let i = 0; i < steps && this.mode === 'playing'; i++) this.update(dt / steps); }
    if (this.mode === 'demo') this.demoTime += dt;
    if (this.mode !== 'paused') {
      for(const ghost of this.afterimages)ghost.life-=dt;this.afterimages=this.afterimages.filter(g=>g.life>0);
      for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-3 * dt); p.vy *= Math.exp(-3 * dt); if(p.kind==='debris')p.angle+=p.spin*dt; }
      for(const e of this.explosions)e.age+=dt;this.explosions=this.explosions.filter(e=>e.age<4);this.flash=Math.max(0,(this.flash||0)-dt*3.5);
      this.particles = this.particles.filter(p => p.life > 0); for (const p of this.trails) p.life -= dt; this.trails = this.trails.filter(p => p.life > 0); this.shake = Math.max(0, (this.shake || 0) - dt * 30);
    }
    this.draw(t / 1000); requestAnimationFrame(time => this.frame(time));
  }
  draw(t) {
    const ctx = this.ctx, demo = this.mode === 'demo';
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.fillStyle = '#0c1713'; ctx.fillRect(0, 0, this.w, this.h);
    const cam = demo ? { x: 1640, y: 1635, zoom: this.w > 900 ? 1.15 : .8 } : this.camera;
    const offsetX = demo ? this.w * .68 : this.w / 2, offsetY = demo ? this.h * .43 : this.h / 2;
    const vibration=!demo&&this.mode==='playing'?this.boostFx*.65:0;
    ctx.save(); ctx.translate(offsetX + (this.reduced ? 0 : rand(-1, 1) * (this.shake || 0)+Math.sin(t*71)*vibration), offsetY + (this.reduced ? 0 : rand(-1, 1) * (this.shake || 0)+Math.cos(t*83)*vibration)); ctx.scale(cam.zoom, cam.zoom);
    if (demo) ctx.rotate(-.38);
    ctx.translate(-cam.x, -cam.y);
    const view = Math.max(this.w, this.h) / (2*cam.zoom) + 220;
    drawCity(ctx, cam, view, t);
    for (const car of parkedCars) this.car(car, car.color, false, t, false, true);
    if (!demo) {
      for (const trail of this.trails) { ctx.save(); ctx.translate(trail.x, trail.y); ctx.rotate(trail.angle); ctx.fillStyle = `rgba(0,0,0,${trail.life / 6 * .35})`; ctx.fillRect(-8, -12, 12, 3); ctx.fillRect(-8, 9, 12, 3); ctx.restore(); }
      for (const item of this.pickups) { const color = item.type === 'repair' ? '#bcff4a' : '#20d9ff'; ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#0d211a'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 12; ctx.fillRect(-13, -13, 26, 26); ctx.strokeRect(-13, -13, 26, 26); ctx.shadowBlur = 0; ctx.rotate(-Math.PI / 4); ctx.fillStyle = color; ctx.font = 'bold 21px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(item.type === 'repair' ? '+' : 'ϟ', 0, 1); ctx.restore(); }
      for (const c of this.police) this.car(c, '#dee9e5', true, t);
      for(const ghost of this.afterimages){ctx.save();ctx.translate(ghost.x,ghost.y);ctx.rotate(ghost.angle);ctx.globalAlpha=ghost.life/.28*.2;ctx.fillStyle='#45e4ff';ctx.shadowColor='#20d9ff';ctx.shadowBlur=14;ctx.fillRect(-25,-12,50,24);ctx.restore();}
      if (this.player) this.car(this.player, this.color, false, t, this.boosting && this.mode === 'playing');
      for(const e of this.explosions)this.drawExplosion(ctx,e);
      for (const p of this.particles) {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.color;
        if(p.kind==='spark'){ctx.strokeStyle=p.color;ctx.lineWidth=p.size*.5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.045,p.y-p.vy*.045);ctx.stroke();}
        else if(p.kind==='debris'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillRect(-p.size/2,-p.size/4,p.size,p.size/2);ctx.restore();}
        else ctx.fillRect(p.x, p.y, p.size, p.size);
      } ctx.globalAlpha = 1;
    } else {
      const d = this.reduced ? 0 : Math.sin(this.demoTime * .2) * 25;
      this.car({ x: 1600 + d, y: 1560, angle: -1.3 }, this.color, false, t, true);
      this.car({ x: 1572, y: 1735 + d, angle: -1.64 }, '#dee9e5', true, t);
      this.car({ x: 1660, y: 1835 + d, angle: -1.46 }, '#dee9e5', true, t);
      ctx.save(); ctx.strokeStyle = '#bcff4a30'; ctx.lineWidth = 2; ctx.setLineDash([6, 9]); ctx.beginPath(); ctx.arc(1600 + d, 1560, 72, 0, TAU); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
    if(!demo&&this.mode==='playing')this.drawBoostScreen(ctx,t);
    if(!demo&&!this.reduced&&this.flash>0){ctx.fillStyle=`rgba(255,193,115,${this.flash*.21})`;ctx.fillRect(0,0,this.w,this.h);}
    if (!demo && this.player) {
      this.minimap();
      if(this.mode==='playing'&&this.inputMode==='mouse'){
        ctx.save();ctx.strokeStyle=this.mouse.braking?'#ff7790':this.boosting?'#38dfff':'#bcff4a';ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(this.mouse.x,this.mouse.y,10,0,TAU);ctx.moveTo(this.mouse.x-16,this.mouse.y);ctx.lineTo(this.mouse.x-6,this.mouse.y);ctx.moveTo(this.mouse.x+6,this.mouse.y);ctx.lineTo(this.mouse.x+16,this.mouse.y);ctx.moveTo(this.mouse.x,this.mouse.y-16);ctx.lineTo(this.mouse.x,this.mouse.y-6);ctx.moveTo(this.mouse.x,this.mouse.y+6);ctx.lineTo(this.mouse.x,this.mouse.y+16);ctx.stroke();ctx.restore();
      }
    }
  }
  drawBoostScreen(ctx,t){
    const amount=this.boostFx;if(this.reduced||amount<.03)return;
    const p=this.player,focusX=this.w/2+(p.x-this.camera.x)*this.camera.zoom+Math.cos(p.angle)*100,focusY=this.h/2+(p.y-this.camera.y)*this.camera.zoom+Math.sin(p.angle)*100;
    ctx.save();const edge=ctx.createRadialGradient(this.w/2,this.h/2,Math.min(this.w,this.h)*.28,this.w/2,this.h/2,Math.max(this.w,this.h)*.65);edge.addColorStop(0,'#22cfff00');edge.addColorStop(1,`rgba(10,162,225,${amount*.16})`);ctx.fillStyle=edge;ctx.fillRect(0,0,this.w,this.h);
    for(let i=0;i<42;i++){const a=i*2.399963,phase=(t*(1.3+amount)+i*.618034)%1,r=.5+phase*.95,x=focusX+Math.cos(a)*this.w*.51*r,y=focusY+Math.sin(a)*this.h*.58*r,dx=x-focusX,dy=y-focusY,d=Math.hypot(dx,dy)||1,length=(22+amount*88)*(0.4+phase);
      ctx.globalAlpha=amount*(.12+phase*.4);ctx.strokeStyle=i%4?'#96edff':'#efffff';ctx.lineWidth=i%6?1:2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx/d*length,y+dy/d*length);ctx.stroke();}
    ctx.restore();
  }
  car(c, color, police, t, boost = false, parked = false) {
    const ctx = this.ctx; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    if (!parked) { const light = ctx.createLinearGradient(20, 0, 150, 0); light.addColorStop(0, '#d8f5bf27'); light.addColorStop(1, '#d8f5bf00'); ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(22, -11); ctx.lineTo(155, -44); ctx.lineTo(155, 44); ctx.lineTo(22, 11); ctx.fill(); }
    ctx.fillStyle = '#0008'; ctx.fillRect(-24, -12, 50, 30);
    ctx.fillStyle = '#030805'; ctx.fillRect(-17, -17, 12, 7); ctx.fillRect(11, -17, 11, 7); ctx.fillRect(-17, 10, 12, 7); ctx.fillRect(11, 10, 11, 7);
    if (boost) {const flame=68+(this.boostFx||.4)*55+Math.sin(t*55)*13;ctx.shadowColor='#39dbff';ctx.shadowBlur=28;ctx.fillStyle='#22cfff';for(const offset of[-6,6]){ctx.beginPath();ctx.moveTo(-23,offset-5);ctx.lineTo(-flame,offset+Math.sin(t*45+offset)*4);ctx.lineTo(-23,offset+5);ctx.fill();}ctx.shadowBlur=0;ctx.fillStyle='#f0ffff';ctx.beginPath();ctx.moveTo(-25,-7);ctx.lineTo(-flame*.65,0);ctx.lineTo(-25,7);ctx.fill();}
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(-26, -13, 52, 26, 6); ctx.fill();
    ctx.fillStyle = police ? '#1a2c2b' : '#00000029'; ctx.fillRect(-5, -13, 20, 26);
    ctx.fillStyle = '#132e31'; ctx.fillRect(7, -10, 8, 20); ctx.fillStyle = '#527a7a'; ctx.fillRect(8, -9, 2, 18); ctx.fillStyle = '#172e2c'; ctx.fillRect(-17, -10, 6, 20);
    ctx.fillStyle = '#ffffff35'; ctx.fillRect(17, -9, 5, 18); ctx.fillStyle = '#f4ffd4'; ctx.fillRect(24, -10, 3, 6); ctx.fillRect(24, 4, 3, 6); ctx.fillStyle = '#ff514f'; ctx.fillRect(-27, -10, 3, 5); ctx.fillRect(-27, 5, 3, 5);
    if (police) { const a = Math.floor(t * 8) % 2 === 0; ctx.shadowBlur = 20; ctx.shadowColor = a ? '#3b8fff' : '#ff4568'; ctx.fillStyle = a ? '#3b8fff' : '#672b3f'; ctx.fillRect(-3, -10, 5, 9); ctx.fillStyle = a ? '#382c47' : '#ff4568'; ctx.fillRect(-3, 1, 5, 9); ctx.shadowBlur = 0; ctx.fillStyle = '#d8ebe1'; ctx.font = 'bold 5px monospace'; ctx.fillText('POLICE', -11, 2); }
    else { ctx.fillStyle = '#162617'; ctx.fillRect(-7, -2, 25, 4); }
    ctx.restore();
  }
  minimap() {
    const ctx = this.ctx, size = this.touchLayout ? 66 : this.w < 720 ? 85 : 122, left = this.w - size - (this.touchLayout ? 24 : this.w < 720 ? 18 : 40), top = this.touchLayout ? 90 : this.w < 720 ? 140 : this.h - size - 30, scale = (size - 12) / (SIZE + 150);
    ctx.save(); ctx.translate(left, top); ctx.fillStyle = '#09130de6'; ctx.fillRect(0, 0, size, size); ctx.strokeStyle = '#ffffff20'; ctx.strokeRect(0, 0, size, size); ctx.translate(6 + 75 * scale, 6 + 75 * scale); ctx.scale(scale, scale); ctx.strokeStyle = '#5c786666'; ctx.lineWidth = 20;
    ctx.lineCap='round';for(const road of roads){ctx.beginPath();road.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
    const p = this.player,px=wrapCity(p.x),py=wrapCity(p.y);
    for (const c of this.police) {const cx=px+c.x-p.x,cy=py+c.y-p.y;if(cx<0||cx>SIZE||cy<0||cy>SIZE)continue;ctx.fillStyle = '#ff6483'; ctx.beginPath(); ctx.arc(cx,cy,45,0,TAU);ctx.fill(); }
    ctx.translate(px,py); ctx.rotate(p.angle); ctx.fillStyle = this.color; ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(-60, -55); ctx.lineTo(-35, 0); ctx.lineTo(-60, 55); ctx.fill(); ctx.restore();
  }
}
