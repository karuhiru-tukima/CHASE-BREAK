export const RANKING_API = 'https://chase-break-night-78249.tottori-u-1286.chatgpt.site/api';
const STORE = 'chase-break-online-v1';
export function createOnlineRanking(options = {}) {
  const base = options.baseUrl || RANKING_API, fetcher = options.fetch || globalThis.fetch;
  let storage; try { storage = options.storage || globalThis.localStorage; } catch {}
  let memory = { players: {}, pending: [] };
  const read = () => { try { const value = JSON.parse(storage?.getItem(STORE)); if (value?.players && Array.isArray(value.pending)) return value; } catch {} return structuredClone(memory); };
  const write = value => { memory = structuredClone(value); try { storage?.setItem(STORE, JSON.stringify(value)); } catch { storage = undefined; } };
  const request = async (path, method = 'GET', body, token) => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), options.timeout || 4500);
    try {
      const response = await fetcher(`${base}${path}`, { method, credentials: 'omit', redirect: 'error', signal: controller.signal, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.message || 'オンラインランキングに接続できません。'), { status: response.status });
      return data;
    } finally { clearTimeout(timer); }
  };
  const creating = new Map();
  const ensure = async user => {
    const existing = read().players[user.id]; if (existing) return existing;
    if (creating.has(user.id)) return creating.get(user.id);
    const create = async () => {
      const previous = read().players[user.id]; if (previous) return previous;
      const displayName = user.isGuest ? `ドライバー-${user.id.slice(0, 6).toUpperCase()}` : user.displayName;
      const player = await request('/players', 'POST', { displayName });
      const db = read(); db.players[user.id] = player; write(db); return player;
    };
    const promise = globalThis.navigator?.locks?.request ? globalThis.navigator.locks.request(`chase-ranking-${user.id}`, create) : create();
    creating.set(user.id, promise);
    try { return await promise; } finally { creating.delete(user.id); }
  };
  const send = async item => {
    const player = read().players[item.run.owner];
    if (!player || player.id !== item.run.playerId) throw new Error('この記録の参加情報が見つかりません。');
    try {
      const result = await request(`/runs/${item.run.id}`, 'POST', item.result, player.token);
      const db = read(); db.pending = db.pending.filter(p => p.run.id !== item.run.id); write(db); return result;
    } catch (error) {
      if ([400, 401, 404].includes(error.status)) { const db = read(); db.pending = db.pending.filter(p => p.run.id !== item.run.id); write(db); }
      throw error;
    }
  };
  const standing = async user => {
    const player = read().players[user.id];
    if (!player) return { id: null, displayName: user.isGuest ? `ドライバー-${user.id.slice(0,6).toUpperCase()}` : user.displayName, rank: null, score: 0, longestTime: 0, games: 0 };
    return (await request('/me', 'GET', undefined, player.token)).me;
  };
  return {
    playerFor: user => read().players[user.id],
    standing,
    pendingCount: user => read().pending.filter(p => p.run.owner === user.id).length,
    async start(user) {
      const player = await ensure(user);
      const run = await request('/runs', 'POST', {}, player.token);
      return { id: run.id, playerId: player.id, owner: user.id };
    },
    async finish(run, result) {
      const clean = Object.fromEntries(['seconds', 'nearMisses', 'destroyed', 'bonusPoints', 'maxCombo', 'reason'].map(key => [key, result[key]]));
      const item = { run, result: clean }, db = read();
      if (!db.pending.some(p => p.run.id === run.id)) db.pending.push(item);
      write(db); return send(item);
    },
    async flush(user) { for (const item of read().pending.filter(p => p.run.owner === user.id)) await send(item); },
    async leaderboard(user) { const [data, me] = await Promise.all([request('/leaderboard'), standing(user)]), mine = read().players[user.id]?.id; return { rows: data.rows.map(row => ({ ...row, mine: row.id === mine })), me }; },
    async rename(user, displayName) {
      const player = await ensure(user), result = await request('/player', 'PATCH', { displayName }, player.token);
      const db = read(); db.players[user.id] = { ...player, displayName: result.displayName }; write(db); return result;
    }
  };
}
