import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createLocalApi } from '../src/offline-auth.mjs';

class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
test('guest starts immediately; local passwords, account separation, recovery and logout', async () => {
  const storage = new MemoryStorage(), session = new MemoryStorage();
  let clock = 100000;
  const api = createLocalApi({ storage, session, now: () => clock });
  const call = api.request.bind(api);
  const guest = (await call('me')).user; assert.equal(guest.isGuest, true);
  assert.equal((await call('runs/start', 'POST', {})).id.length, 32);
  const password = 'Racer-Private-Test-7839';
  const a = await call('register', 'POST', { username: 'racer_a', displayName: 'ドライバーA', password });
  const b = await call('register', 'POST', { username: 'racer_b', displayName: 'ドライバーB', password });
  assert.notEqual(a.user.id, b.user.id);
  const raw = storage.getItem('chase-break-offline-v1'); assert.equal(raw.includes(password), false);
  const saved = JSON.parse(raw); assert.notEqual(saved.users[0].passwordSalt, saved.users[1].passwordSalt); assert.notEqual(saved.users[0].passwordHash, saved.users[1].passwordHash);
  assert.equal(saved.users[0].iterations, 600000); assert.equal(a.user.passwordHash, undefined);
  await assert.rejects(call('login', 'POST', { username: 'racer_a', password: 'wrong-password' }), /違います/);
  await call('login', 'POST', { username: 'racer_a', password });
  await call('profile', 'PATCH', { color: '#20d9ff', userId: b.user.id });
  const run = await call('runs/start', 'POST', {}); clock += 12000;
  const result = { id: run.id, seconds: 12, nearMisses: 2, destroyed: 1, bonusPoints: 500, maxCombo: 1, reason: 'busted' };
  await call('login', 'POST', { username: 'racer_b', password });
  await assert.rejects(call('runs/finish', 'POST', result), /見つかりません/);
  assert.equal((await call('me')).user.color, '#bcff4a'); assert.equal((await call('me')).user.history.length, 0);
  await call('login', 'POST', { username: 'racer_a', password });
  const finish = await call('runs/finish', 'POST', result); assert.equal(finish.score, 620); assert.equal(finish.user.games, 1);
  assert.equal((await call('runs/finish', 'POST', result)).user.games, 1);
  const reloaded = createLocalApi({ storage, session, now: () => clock });
  assert.equal((await reloaded.request('me')).user.bestScore, 620); assert.equal((await reloaded.request('me')).user.color, '#20d9ff');
  const board = await call('leaderboard'); assert.equal(board.rows[0].displayName, 'ドライバーA'); assert.equal(JSON.stringify(board).includes('password'), false);
  await call('logout', 'POST', {}); assert.equal((await call('me')).user.id, guest.id); assert.equal(session.data.size, 0);
});
test('storage denial still permits guest play and an in-memory score', async () => {
  const denied = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); }, removeItem() {} };
  let clock = 200000;
  const local = createLocalApi({ storage: denied, session: denied, now: () => clock });
  assert.equal(local.persistent, false); assert.equal((await local.request('me')).user.isGuest, true);
  const run = await local.request('runs/start', 'POST', {}); clock += 3000;
  const result = await local.request('runs/finish', 'POST', { id: run.id, seconds: 3, nearMisses: 0, destroyed: 0, bonusPoints: 0, maxCombo: 1, reason: 'wrecked' });
  assert.equal(result.score, 30);
  await assert.rejects(local.request('register', 'POST', { username: 'racer_c', password: 'example-password' }), /保存できません/);
});
test('damaged stored data is preserved; guest can still play', async () => {
  const storage = new MemoryStorage(); storage.setItem('chase-break-offline-v1', '{damaged-data');
  const local = createLocalApi({ storage, session: new MemoryStorage() });
  assert.equal(local.persistent, false); assert.equal((await local.request('me')).user.isGuest, true);
  await local.request('runs/start', 'POST', {});
  assert.equal(storage.getItem('chase-break-offline-v1'), '{damaged-data');
});
test('single HTML embeds everything and its classic script parses without imports', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel="stylesheet"|type="module"|fetch\(/);
  assert.match(html, /data:image\/svg\+xml/); assert.match(html, /登録せずに遊ぶ/);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(script, /^import |^export /m); new vm.Script(script);
});
