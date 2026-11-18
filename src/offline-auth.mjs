const DATA_KEY = 'chase-break-offline-v1';
const SESSION_KEY = 'chase-break-local-session';
const PALETTE = ['#bcff4a', '#20d9ff', '#ff557d', '#a78bfa', '#ffb347'];
const ITERATIONS = 600000;
const fail = (status, message) => Object.assign(new Error(message), { status });
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = value => Uint8Array.from(value.match(/.{2}/g), pair => parseInt(pair, 16));

export function createLocalApi(options = {}) {
  const crypt = options.crypto || globalThis.crypto;
  const now = options.now || (() => Date.now());
  let storage, sessionStorage, persistent = true, notice = '', memory, sessionId;
  try {
    storage = options.storage || globalThis.localStorage;
    const probe = `${DATA_KEY}-probe`; storage.setItem(probe, '1'); storage.removeItem(probe);
  } catch { persistent = false; notice = '保存を利用できないため、記録はこの画面を閉じるまで保持します。'; }
  try { sessionStorage = options.session || globalThis.sessionStorage; sessionId = sessionStorage.getItem(SESSION_KEY); } catch { /* Guest play also works without sessionStorage. */ }
  const id = () => hex(crypt.getRandomValues(new Uint8Array(16)));
  const newUser = (displayName, username, isGuest = false) => ({ id: id(), displayName, username, isGuest, color: PALETTE[0], bestScore: 0, longestTime: 0, games: 0, history: [], activeRun: null });
  const empty = () => ({ version: 1, users: [], guest: newUser('ゲスト', 'guest', true) });
  const read = () => {
    if (!persistent) return structuredClone(memory);
    const raw = storage.getItem(DATA_KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.users) || !data.guest) throw fail(500, '保存データを読み込めません。元の保存データは変更しません。');
    return data;
  };
  const write = data => {
    if (persistent) {
      try { storage.setItem(DATA_KEY, JSON.stringify(data)); }
      catch { throw fail(507, '保存領域がいっぱい、または保存が許可されていません。ブラウザの設定を確認して再試行してください。'); }
    } else memory = structuredClone(data);
  };
  memory = empty();
  // A missing or broken browser store must never stop the game from launching.
  let data;
  try { data = read(); write(data); }
  catch (error) { persistent = false; notice = `${error.message} 今回は一時的なゲストデータで遊べます。`; data = memory; }
  const setSession = value => { sessionId = value; try { if (value) sessionStorage?.setItem(SESSION_KEY, value); else sessionStorage?.removeItem(SESSION_KEY); } catch { /* Session remains valid in memory. */ } };
  const current = db => db.users.find(u => u.id === sessionId) || db.guest;
  const safeUser = u => ({ id: u.id, username: u.username, displayName: u.displayName, color: u.color, isGuest: u.isGuest, bestScore: u.bestScore, longestTime: u.longestTime, games: u.games, history: structuredClone(u.history.slice(0, 12)) });
  async function hash(password, salt) {
    if (!crypt?.subtle) throw fail(503, 'このブラウザではパスワード登録を利用できません。ChromeまたはEdgeで開くか、ゲストで遊んでください。');
    const key = await crypt.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return hex(new Uint8Array(await crypt.subtle.deriveBits({ name: 'PBKDF2', salt: unhex(salt), iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)));
  }
  let queue = Promise.resolve();
  async function operation(route, method = 'GET', body = {}) {
    let db = read();
    if (route === 'register' || route === 'login') {
      if (method !== 'POST') throw fail(405, 'この操作は利用できません。');
      const { username, password } = body;
      if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,24}$/.test(username) || typeof password !== 'string' || password.length < 8 || password.length > 128) throw fail(400, 'ユーザー名は半角英数字・_の3〜24文字、パスワードは8〜128文字で入力してください。');
      if (!persistent && route === 'register') throw fail(503, 'このブラウザではアカウントを保存できません。「登録せずに遊ぶ」を選んでください。');
      const existing = db.users.find(u => u.username === username);
      if (route === 'register') {
        const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : username;
        if (!displayName || displayName.length > 24) throw fail(400, '表示名は1〜24文字で入力してください。');
        if (existing) throw fail(409, 'このユーザー名は使われています。');
        const passwordSalt = id(), passwordHash = await hash(password, passwordSalt);
        // Refresh after the asynchronous password derivation, then commit without an await.
        db = read(); if (db.users.some(u => u.username === username)) throw fail(409, 'このユーザー名は使われています。');
        const u = { ...newUser(displayName, username), passwordSalt, passwordHash, algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS };
        db.users.push(u); write(db); setSession(u.id); return { user: safeUser(u) };
      }
      const candidate = await hash(password, existing?.passwordSalt || '6d55b9ac9a4849868ad61d0bd8ebfe13');
      let difference = 0; const reference = existing?.passwordHash || '0'.repeat(64);
      for (let i = 0; i < candidate.length; i++) difference |= candidate.charCodeAt(i) ^ reference.charCodeAt(i);
      if (!existing || difference) throw fail(401, 'ユーザー名またはパスワードが違います。');
      setSession(existing.id); return { user: safeUser(existing) };
    }
    if (route === 'logout' && method === 'POST') { setSession(null); return { ok: true }; }
    if (route === 'guest' && method === 'POST') { setSession(null); return { user: safeUser(db.guest) }; }
    const user = current(db);
    if (route === 'me' && method === 'GET') return { user: safeUser(user) };
    if (route === 'profile' && method === 'PATCH') {
      if (!PALETTE.includes(body.color)) throw fail(400, 'カラーを選択してください。');
      user.color = body.color; write(db); return { user: safeUser(user) };
    }
    if (route === 'leaderboard' && method === 'GET') {
      const rows = [...db.users, db.guest].filter(u => u.games > 0).sort((a, b) => b.bestScore - a.bestScore || b.longestTime - a.longestTime).slice(0, 30).map(u => ({ id: u.id, displayName: u.displayName, color: u.color, score: u.bestScore, longestTime: u.longestTime }));
      return { rows };
    }
    if (route === 'runs/start' && method === 'POST') { const run = { id: id(), started: now() }; user.activeRun = run; write(db); return { id: run.id }; }
    if (route === 'runs/finish' && method === 'POST') {
      const old = user.history.find(r => r.id === body.id);
      if (old) return { score: old.score, user: safeUser(user) };
      if (!user.activeRun || user.activeRun.id !== body.id) throw fail(404, 'このユーザーのプレイ記録が見つかりません。');
      const { seconds, nearMisses, destroyed, bonusPoints, maxCombo, reason } = body;
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > (now() - user.activeRun.started) / 1000 + 2 || seconds > 86400) throw fail(400, '逃走時間が不正です。');
      for (const n of [nearMisses, destroyed, bonusPoints, maxCombo]) if (!Number.isSafeInteger(n) || n < 0) throw fail(400, 'スコアが不正です。');
      const base = nearMisses * 100 + destroyed * 300;
      if (bonusPoints < base || bonusPoints > base * 5 || maxCombo > 5 || !['busted', 'wrecked'].includes(reason)) throw fail(400, 'プレイ内容が不正です。');
      const score = Math.floor(seconds * 10) + bonusPoints;
      user.history.unshift({ id: body.id, seconds, nearMisses, destroyed, maxCombo, reason, score, finished: now() }); user.history = user.history.slice(0, 12);
      user.games++; user.bestScore = Math.max(user.bestScore, score); user.longestTime = Math.max(user.longestTime, seconds); user.activeRun = null;
      write(db); return { score, user: safeUser(user) };
    }
    throw fail(404, '操作が見つかりません。');
  }
  return {
    persistent, notice,
    request(route, method, body) {
      const work = () => operation(route, method, body);
      // File URLs can be opaque origins: avoid APIs that reject those origins.
      const next = queue.then(() => globalThis.location?.protocol !== 'file:' && globalThis.navigator?.locks?.request ? globalThis.navigator.locks.request('chase-break-offline-store', work) : work());
      queue = next.catch(() => {}); return next;
    }
  };
}
