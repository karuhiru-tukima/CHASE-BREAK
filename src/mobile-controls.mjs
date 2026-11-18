export function touchLayout(width, height, coarse = false) {
  return coarse || (Math.min(width, height) <= 600 && Math.max(width, height) <= 1024);
}

export function touchDrive(player, stick) {
  const magnitude = Math.min(1, Math.hypot(stick.x, stick.y));
  const difference = Math.atan2(Math.sin(Math.atan2(stick.y, stick.x) - player.angle), Math.cos(Math.atan2(stick.y, stick.x) - player.angle));
  return { steer: magnitude > .15 ? Math.max(-1, Math.min(1, difference * 1.8)) : 0, accelerating: magnitude > .15, braking: false, targetSpeed: 290 * magnitude };
}

export class TouchInput {
  constructor() { this.reset(); }
  reset() { this.stick = { x: 0, y: 0 }; this.pointers = new Map(); }
  get boosting() { return [...this.pointers.values()].includes('boost'); }
  get braking() { return [...this.pointers.values()].includes('brake'); }
  release(id) { if (this.pointers.get(id) === 'stick') this.stick = { x: 0, y: 0 }; this.pointers.delete(id); }
}

export function setupMobile(game) {
  const controls = document.getElementById('touch-controls');
  const pad = document.getElementById('steering-pad');
  const knob = document.getElementById('steering-knob');
  const resetKnob = () => { knob.style.transform = ''; };
  const refresh = () => {
    game.touchLayout = touchLayout(innerWidth, innerHeight, matchMedia('(pointer: coarse)').matches);
    document.body.classList.toggle('touch-layout', game.touchLayout);
    const portrait = game.touchLayout && innerHeight > innerWidth;
    document.body.classList.toggle('portrait-device', portrait);
    if (portrait && game.mode === 'playing') game.pause();
    resetKnob();
    game.touchInput?.reset();
    for (const button of controls.querySelectorAll('.held')) button.classList.remove('held');
  };
  refresh(); window.addEventListener('resize', refresh);
  const move = e => {
    if (game.touchInput.pointers.get(e.pointerId) !== 'stick') return;
    const rect = pad.getBoundingClientRect(), radius = rect.width * .34;
    let x = (e.clientX - rect.left - rect.width / 2) / radius, y = (e.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    game.touchInput.stick = { x, y }; knob.style.transform = `translate(${x * radius}px,${y * radius}px)`;
  };
  for (const element of controls.querySelectorAll('[data-touch]')) {
    element.addEventListener('pointerdown', e => {
      if (game.mode !== 'playing') return;
      e.preventDefault(); game.inputMode = 'touch';
      const action = element.dataset.touch;
      if (action === 'stick' && [...game.touchInput.pointers.values()].includes('stick')) return;
      game.touchInput.pointers.set(e.pointerId, action); element.setPointerCapture(e.pointerId); element.classList.add('held'); move(e);
    });
    element.addEventListener('pointermove', move);
    const release = e => {
      if (game.touchInput.pointers.get(e.pointerId) === 'stick') resetKnob();
      game.touchInput.release(e.pointerId);
      if (![...game.touchInput.pointers.values()].includes(element.dataset.touch)) element.classList.remove('held');
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, release);
  }
  document.getElementById('reverse-button').addEventListener('click', () => {
    if (game.mode === 'playing') { game.inputMode = 'touch'; game.reverseMode = !game.reverseMode; game.hud(); }
  });
  // Suppress browser gestures without preventing ordinary form scrolling.
  for (const name of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(name, e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  window.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  return () => {
    if (!game.touchLayout) return;
    const lock = () => { try { screen.orientation?.lock?.('landscape')?.catch(() => {}); } catch {} };
    try {
      const result = document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
      if (result) result.then(lock).catch(() => {}); else lock();
    } catch {}
  };
}
