import { ChaseGame, AudioEngine } from './game.js';
import { createLocalApi } from './offline-auth.mjs';
import { setupMobile } from './mobile-controls.mjs';
import { createOnlineRanking } from './online-ranking.mjs';

const $ = id => document.getElementById(id);
const format = n => Math.floor(n).toLocaleString('ja-JP');
const time = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const palette = ['#bcff4a', '#20d9ff', '#ff557d', '#a78bfa', '#ffb347'];
const colorNames = ['ライム', 'シアン', 'ピンク', 'パープル', 'オレンジ'];
let user = null, registering = false, runId = null, pending = null, saving = false, toastTimer, announcementTimer;
const audio = new AudioEngine();
const localService = createLocalApi();
const onlineRanking = createOnlineRanking();
let onlineRun = null;
let rankingRequest = 0, resultState = 'sending', resultOwner = null;
const onlineStandings = new Map();
async function api(route, method = 'GET', body) {
  return localService.request(route, method, body);
}
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4500); }
function announcement(message) { $('announcement').textContent = message; clearTimeout(announcementTimer); announcementTimer = setTimeout(() => $('announcement').textContent = '', 1800); }
const game = new ChaseGame($('city'), {
  audio, onAnnouncement: announcement,
  onHud: h => {
    $('score').textContent = String(h.score).padStart(6, '0'); $('time').textContent = time(h.seconds);
    $('health').value = h.health; $('health-value').textContent = `${Math.ceil(h.health)}%`; $('boost').value = h.boost; $('speed').textContent = Math.round(h.speed);
    $('boost-status').textContent=h.boostLocked?`回復待ち ${Math.floor(h.boost)}/35%`:game.touchLayout?'長押し':'左クリック';$('boost').classList.toggle('cooling',h.boostLocked);
    $('reverse-button').setAttribute('aria-pressed', String(h.reverseMode));
    $('drive-mode').textContent=h.reverseMode?'REVERSE':'KM/H';$('drive-mode').classList.toggle('reverse-label',h.reverseMode);
    $('combo').textContent = h.comboTimer > 0 ? `COMBO ×${h.combo}` : '';
    $('wanted-stars').textContent = Array.from({ length: 5 }, (_, i) => i < h.level ? '★' : '☆').join(' '); $('wanted-text').textContent = `手配 ${h.level} / 追跡 ${h.policeCount}台`;
    $('capture-warning').hidden = h.capture < 3; $('capture').value = h.capture;
  },
  onPause: () => { if (!$('pause-dialog').open) $('pause-dialog').showModal(); },
  onFinish: result => {
    pending = { ...result, id: runId, userId: user.id, onlineRun };
    try { sessionStorage.setItem('chase-unsaved', JSON.stringify(pending)); } catch { /* Saving still works without browser storage. */ }
    showResult(pending); saveResult();
  }
});
const requestMobileDisplay = setupMobile(game);
function renderUser() {
  $('identity').textContent = user.displayName; $('identity').hidden = false; $('logout').hidden = false;
  $('logout').textContent = user.isGuest ? 'ログイン / 登録 ↗' : 'ログアウト ↗';
  $('best-score').textContent = format(user.bestScore); $('best-time').textContent = time(user.longestTime); $('games').textContent = user.games;
  game.color = user.color;
  for (const button of $('colors').children) button.setAttribute('aria-pressed', String(button.dataset.color === user.color));
}
function garage() {
  $('ranking-screen').hidden = true; document.body.classList.remove('ranking-open');
  document.body.classList.remove('playing'); $('garage').hidden = false; $('auth').hidden = true; $('hud').hidden = true; game.garage(); renderUser(); window.scrollTo(0, 0);
  refreshHomeStanding();
}
function showAuth() {
  $('ranking-screen').hidden = true; document.body.classList.remove('ranking-open'); rankingRequest++;
  user = null; game.garage(); document.body.classList.remove('playing'); $('auth').hidden = false; $('garage').hidden = true; $('hud').hidden = true; $('identity').hidden = true; $('logout').hidden = true; window.scrollTo(0, 0);
}
function authMode(value) {
  registering = value; $('login-tab').classList.toggle('active', !value); $('register-tab').classList.toggle('active', value);
  $('display-label').hidden = !value; $('password').autocomplete = value ? 'new-password' : 'current-password';
  $('auth-title').textContent = value ? 'あなたの逃走は、ここから。' : 'おかえり、ドライバー。';
  $('auth-description').textContent = value ? '自分だけのアカウントを作ろう。' : 'ガレージにログインして、夜の街へ。';
  $('auth-submit').textContent = value ? '登録してガレージへ ↗' : 'ログインして始める ↗'; $('auth-error').textContent = '';
}
$('login-tab').addEventListener('click', () => authMode(false)); $('register-tab').addEventListener('click', () => authMode(true));
$('auth-form').addEventListener('submit', async e => {
  e.preventDefault(); const button = $('auth-submit'); button.disabled = true; $('auth-error').textContent = '';
  try {
    const result = await api(registering ? 'register' : 'login', 'POST', { username: $('username').value.trim(), password: $('password').value, displayName: $('displayName').value.trim() || $('username').value.trim() });
    user = result.user; $('password').value = ''; garage(); restorePending();
  } catch (error) { $('auth-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('logout').addEventListener('click', async () => {
  $('logout').disabled = true;
  const wasGuest = user?.isGuest;
  try { await api('logout', 'POST', {}); showAuth(); $('username').value = ''; $('displayName').value = ''; toast(wasGuest ? 'ログインまたは新規登録を選べます。' : 'ログアウトしました。'); }
  catch (e) { toast(e.message); } finally { $('logout').disabled = false; }
});
$('guest-play').addEventListener('click', async () => {
  try { const result = await api('guest', 'POST', {}); user = result.user; garage(); restorePending(); }
  catch (error) { $('auth-error').textContent = error.message; }
});
palette.forEach((color, i) => {
  const button = document.createElement('button'); button.className = 'swatch'; button.dataset.color = color; button.style.setProperty('--swatch', color); button.setAttribute('aria-label', colorNames[i]); button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', async () => {
    for (const b of $('colors').children) b.disabled = true;
    try { const result = await api('profile', 'PATCH', { color }); user = result.user; renderUser(); $('color-note').textContent = `${colorNames[i]}を保存しました。`; }
    catch (e) { toast(e.message); }
    finally { for (const b of $('colors').children) b.disabled = false; }
  });
  $('colors').append(button);
});
async function start() {
  requestMobileDisplay();
  $('start').disabled = true; $('retry').disabled = true;
  try {
    // Recheck identity before starting: another browser tab may have switched accounts.
    const current = await api('me');
    if (current.user.id !== user.id) { user = current.user; garage(); toast('ログイン中のユーザーが変わりました。確認して、もう一度開始してください。'); return; }
    const run = await api('runs/start', 'POST', {}); runId = run.id; pending = null;
    onlineRun = null;
    try { onlineRun = await onlineRanking.start(user); } catch { toast('オンラインに接続できません。この走行は端末内に保存します。'); }
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    $('garage').hidden = true; $('hud').hidden = false; document.body.classList.add('playing'); window.scrollTo(0, 0); game.start(user.color);
  } catch (e) { toast(e.message); if (e.status === 401) showAuth(); }
  finally { $('start').disabled = false; $('retry').disabled = false; }
}
$('start').addEventListener('click', start); $('retry').addEventListener('click', start);
$('help').addEventListener('click', () => $('help-dialog').showModal());
for (const button of document.querySelectorAll('.close-dialog')) button.addEventListener('click', () => button.closest('dialog').close());
$('pause-button').addEventListener('click', () => game.pause());
function resume() { $('pause-dialog').close(); game.resume(); }
$('resume').addEventListener('click', resume);
$('pause-dialog').addEventListener('cancel', e => { e.preventDefault(); resume(); });
$('abandon').addEventListener('click', () => { $('pause-dialog').close(); garage(); });
$('result-dialog').addEventListener('cancel', e => e.preventDefault());
$('sound').addEventListener('click', async () => {
  try { const enabled = await audio.toggle(); $('sound').textContent = enabled ? '音 ON' : '音 OFF'; $('sound').setAttribute('aria-label', enabled ? 'サウンドをオフにする' : 'サウンドをオンにする'); }
  catch { toast('このブラウザではサウンドを利用できません。'); }
});
function showResult(result) {
  $('result-title').textContent = result.reason === 'busted' ? '包囲を突破できず。' : '限界まで、走り切った。';
  $('result-type').textContent = result.reason === 'busted' ? 'BUSTED / END OF THE CHASE' : 'WRECKED / END OF THE CHASE';
  $('result-score').textContent = format(result.score); $('result-time').textContent = time(result.seconds); $('result-near').textContent = result.nearMisses; $('result-destroyed').textContent = result.destroyed; $('result-combo').textContent = `×${result.maxCombo}`;
  $('new-best').hidden = result.score <= user.bestScore; $('retry-save').hidden = true; $('retry').disabled = true; $('back-garage').disabled = true;
  resultOwner = result.userId; $('result-ranking-button').disabled = true;
  showOnlineState('sending', '端末への保存を準備しています。');
  if (!$('result-dialog').open) $('result-dialog').showModal();
}
async function saveResult() {
  if (!pending || saving) return;
  saving = true; $('retry-save').disabled = true;
  try {
    const result = await api('runs/finish', 'POST', pending); user = result.user; renderUser(); $('result-score').textContent = format(result.score);
    const localMessage = localService.persistent ? '✓ このブラウザに記録を保存しました。' : '✓ この画面を閉じるまで記録を保持します。';
    showOnlineState('sending', `${localMessage} オンラインに送信しています。`);
    if (pending.onlineRun) {
      try {
        await onlineRanking.finish(pending.onlineRun, pending);
        showOnlineState('saved', 'ランキングに反映済み。端末にも保存しました。');
        try { const me = await onlineRanking.standing(user); rememberStanding(me); $('result-online-rank').textContent = rankText(me); } catch { $('result-online-rank').textContent = 'ランキングで確認'; }
      } catch (error) { showOnlineState([400,401,404].includes(error.status) ? 'rejected' : 'waiting', [400,401,404].includes(error.status) ? `${localMessage} ${error.message}` : '端末の記録は保存済みです。通信が戻るか、ランキングを開くと再送します。'); }
    } else showOnlineState('local', `${localMessage} オフラインで始めた走行はランキングには送信されません。`);
    pending = null;
    try { sessionStorage.removeItem('chase-unsaved'); } catch { /* Optional recovery cache. */ }
    $('retry-save').hidden = true; $('retry').disabled = false; $('back-garage').disabled = false;
  } catch (e) { showOnlineState('local-error', `未保存：${e.message} この画面を残して再試行してください。`); $('retry-save').hidden = false; }
  finally { saving = false; $('retry-save').disabled = false; $('result-ranking-button').disabled = false; }
}
function rankText(me) { return Number.isSafeInteger(me?.rank) && me.rank > 0 ? `${format(me.rank)}位` : 'まだ順位なし'; }
function rememberStanding(me) {
  onlineStandings.set(user.id, me);
  $('home-online-summary').textContent = me.rank ? `あなた ${rankText(me)} · 自己ベスト ${format(me.score)}点` : '走行結果を送信すると順位がつきます';
}
async function refreshHomeStanding() {
  const owner = user; if (!owner) return;
  const previous = onlineStandings.get(owner.id); if (previous) rememberStanding(previous);
  else $('home-online-summary').textContent = 'オンラインの順位を確認中…';
  try { const me = await onlineRanking.standing(owner); if (user?.id === owner.id) rememberStanding(me); }
  catch { if (user?.id === owner.id) $('home-online-summary').textContent = '接続を確認して順位を見る'; }
}
function showOnlineState(state, detail) {
  resultState = state; $('online-result').dataset.state = state;
  $('online-save-title').textContent = { sending:'オンラインに送信中…', saved:'✓ オンライン送信完了', waiting:'オンライン送信待ち', local:'この端末に保存', rejected:'オンライン送信を確認できません', 'local-error':'端末への保存に失敗' }[state];
  $('save-state').textContent = detail;
  $('result-online-rank').textContent = { sending:'送信後に確定', saved:'順位を確認中…', waiting:'送信後に確定', local:'オンライン対象外', rejected:'未送信', 'local-error':'未保存' }[state];
}
function restorePending() {
  try { const item = JSON.parse(sessionStorage.getItem('chase-unsaved')); if (item && item.userId === user.id) { pending = item; showResult(item); saveResult(); } } catch { /* Ignore an unavailable or damaged recovery cache. */ }
}
$('retry-save').addEventListener('click', saveResult);
$('back-garage').addEventListener('click', () => { $('result-dialog').close(); garage(); });
function listRow(rank, title, subtitle, score, mine = false) {
  const row = document.createElement('div'); row.className = `list-row${mine ? ' mine' : ''}${rank === null ? ' history-row' : ''}`;
  if (rank !== null) { const number = document.createElement('span'); number.className = 'rank'; number.textContent = String(rank).padStart(2, '0'); row.append(number); }
  const copy = document.createElement('div'); copy.textContent = title; const sub = document.createElement('small'); sub.textContent = subtitle; copy.append(sub);
  const total = document.createElement('strong'); total.textContent = format(score); row.append(copy, total); return row;
}
function empty(list, text) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = text; list.append(p); }
async function openRanking() {
  if (!user) return;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  game.garage(); $('garage').hidden = true; $('hud').hidden = true; document.body.classList.remove('playing'); document.body.classList.add('ranking-open'); $('ranking-screen').hidden = false;
  $('ranking-name-status').textContent = ''; window.scrollTo(0, 0); $('ranking-title').focus();
  await loadRanking();
}
async function loadRanking() {
  const owner = user, request = ++rankingRequest; if (!owner) return;
  const current = () => user?.id === owner.id && request === rankingRequest;
  $('ranking-refresh').disabled = true; $('leaderboard-list').replaceChildren(); $('ranking-empty').hidden = true;
  $('ranking-state').textContent = 'オンラインの最新記録を読み込んでいます…'; $('ranking-state').dataset.state = 'loading';
  $('ranking-my-rank').textContent = '確認中…'; $('ranking-my-score').textContent = '—'; $('ranking-my-name').textContent = '—';
  try {
    let resendFailed = false;
    try { await onlineRanking.flush(owner); } catch { resendFailed = true; }
    const { rows, me } = await onlineRanking.leaderboard(owner); if (!current()) return;
    rememberStanding(me);
    $('ranking-my-rank').textContent = rankText(me); $('ranking-my-score').textContent = `${format(me.score)}点`; $('ranking-my-name').textContent = me.displayName; $('ranking-name').value = me.displayName;
    for (const [i, row] of rows.entries()) {
      const tr = document.createElement('tr'); if (row.mine) tr.className = 'ranking-mine';
      for (const [index, value] of [String(i + 1), row.displayName, `${format(row.score)}点`, time(row.longestTime)].entries()) {
        const td = document.createElement('td'); td.textContent = value;
        if (index === 1 && row.mine) { const badge = document.createElement('span'); badge.className = 'ranking-you'; badge.textContent = 'あなた'; td.append(badge); }
        if (index === 3) td.className = 'ranking-time'; tr.append(td);
      }
      $('leaderboard-list').append(tr);
    }
    if (!rows.length) { $('ranking-empty').hidden = false; $('ranking-empty').textContent = 'まだオンライン記録がありません。最初の逃走を決めよう。'; }
    const waiting = onlineRanking.pendingCount(owner);
    $('ranking-state').textContent = waiting ? `最新の成績を表示 · ${waiting}件の記録はオンライン送信待ちです` : `✓ オンラインの最新記録を表示 · ${new Date().toLocaleTimeString('ja-JP', {hour:'2-digit',minute:'2-digit'})} 更新`;
    $('ranking-state').dataset.state = waiting ? 'waiting' : 'ready';
    if (!resendFailed && !waiting && resultState === 'waiting' && resultOwner === owner.id) { showOnlineState('saved', '送信待ちの記録をランキングに反映しました。'); $('result-online-rank').textContent = rankText(me); }
  } catch (error) {
    if (!current()) return;
    $('ranking-my-rank').textContent = '取得できません'; $('ranking-my-score').textContent = '—';
    $('ranking-my-name').textContent = onlineRanking.playerFor(owner)?.displayName || owner.displayName;
    $('ranking-name').value = onlineRanking.playerFor(owner)?.displayName || (owner.isGuest ? `ドライバー-${owner.id.slice(0,6).toUpperCase()}` : owner.displayName);
    $('ranking-state').textContent = 'オンラインに接続できません。「最新に更新」で再試行してください。'; $('ranking-state').dataset.state = 'error';
    $('ranking-empty').hidden = false; $('ranking-empty').textContent = error.message;
  } finally { if (current()) $('ranking-refresh').disabled = false; }
}
$('leaderboard-button').addEventListener('click', openRanking);
$('result-ranking-button').addEventListener('click', openRanking);
$('ranking-back').addEventListener('click', () => { rankingRequest++; garage(); });
$('ranking-refresh').addEventListener('click', loadRanking);
window.addEventListener('keydown', e => { if (e.code === 'Escape' && !$('ranking-screen').hidden) { e.preventDefault(); rankingRequest++; garage(); } });
window.addEventListener('online', async () => {
  if (!user) return;
  if (!$('ranking-screen').hidden) { loadRanking(); return; }
  const owner = user;
  try { await onlineRanking.flush(owner); const me = await onlineRanking.standing(owner); if (user?.id !== owner.id) return; rememberStanding(me); if (resultState === 'waiting' && resultOwner === owner.id && !onlineRanking.pendingCount(owner)) { showOnlineState('saved', '通信が戻り、ランキングに反映しました。'); $('result-online-rank').textContent = rankText(me); } } catch { /* Pending results stay stored for another attempt. */ }
});
$('ranking-name-form').addEventListener('submit', async e => {
  e.preventDefault(); $('ranking-name-save').disabled = true; $('ranking-name-status').textContent = '保存しています…';
  try { await onlineRanking.rename(user, $('ranking-name').value.trim()); $('ranking-name-status').textContent = '表示名を保存しました。'; await loadRanking(); }
  catch (error) { $('ranking-name-status').textContent = error.message; }
  finally { $('ranking-name-save').disabled = false; }
});
$('history-button').addEventListener('click', async () => {
  $('history-list').replaceChildren(); empty($('history-list'), '読み込んでいます…'); $('history-dialog').showModal();
  try {
    const current = await api('me');
    if (current.user.id !== user.id) { $('history-dialog').close(); user = current.user; garage(); toast('ログイン中のユーザーが変わりました。'); return; }
    user = current.user; renderUser(); $('history-list').replaceChildren();
    if (!user.history.length) empty($('history-list'), 'まだ記録がありません。夜の街へ走り出そう。');
    for (const r of user.history) $('history-list').append(listRow(null, new Date(r.finished).toLocaleString('ja-JP'), `${time(r.seconds)} / ニアミス ${r.nearMisses} / 追跡不能 ${r.destroyed} / ×${r.maxCombo}`, r.score));
  } catch (e) { $('history-list').replaceChildren(); empty($('history-list'), e.message); }
});
$('offline-notice').textContent = localService.notice || 'オンラインランキング対応 · 表示名と自己ベストを公開。アカウントと履歴はこの端末内に保存。';
try { const result = await api('me'); user = result.user; garage(); restorePending(); }
catch (e) { showAuth(); if (e.status !== 401) $('auth-error').textContent = e.message; }
finally { $('loading').hidden = true; }
