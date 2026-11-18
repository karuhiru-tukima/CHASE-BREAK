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
  document.body.classList.remove('playing'); $('garage').hidden = false; $('auth').hidden = true; $('hud').hidden = true; game.garage(); renderUser(); window.scrollTo(0, 0);
}
function showAuth() {
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
  $('save-state').textContent = '記録を保存しています…';
  if (!$('result-dialog').open) $('result-dialog').showModal();
}
async function saveResult() {
  if (!pending || saving) return;
  saving = true; $('retry-save').disabled = true;
  try {
    const result = await api('runs/finish', 'POST', pending); user = result.user; renderUser(); $('result-score').textContent = format(result.score);
    const localMessage = localService.persistent ? '✓ このブラウザに記録を保存しました。' : '✓ この画面を閉じるまで記録を保持します。';
    $('save-state').textContent = localMessage;
    if (pending.onlineRun) {
      try { await onlineRanking.finish(pending.onlineRun, pending); $('save-state').textContent = '✓ 端末への保存・オンラインランキングへの送信が完了しました。'; }
      catch (error) { $('save-state').textContent = [400,401,404].includes(error.status) ? `${localMessage} オンライン記録は受け付けられませんでした。` : `${localMessage} オンライン送信待ちです。ランキングを開くと再送します。`; }
    } else $('save-state').textContent = `${localMessage} この走行はオンライン対象外です。`;
    pending = null;
    try { sessionStorage.removeItem('chase-unsaved'); } catch { /* Optional recovery cache. */ }
    $('retry-save').hidden = true; $('retry').disabled = false; $('back-garage').disabled = false;
  } catch (e) { $('save-state').textContent = `未保存：${e.message} この画面を残して再試行してください。`; $('retry-save').hidden = false; }
  finally { saving = false; $('retry-save').disabled = false; }
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
$('leaderboard-button').addEventListener('click', async () => {
  $('leaderboard-list').replaceChildren(); empty($('leaderboard-list'), '読み込んでいます…'); $('leaderboard-dialog').showModal();
  $('ranking-name').value = onlineRanking.playerFor(user)?.displayName || (user.isGuest ? `ドライバー-${user.id.slice(0,6).toUpperCase()}` : user.displayName);
  $('ranking-name-status').textContent = '';
  try { await onlineRanking.flush(user); const { rows } = await onlineRanking.leaderboard(user); $('leaderboard-list').replaceChildren(); if (!rows.length) empty($('leaderboard-list'), 'まだオンライン記録がありません。最初の逃走を決めよう。'); rows.forEach((r, i) => $('leaderboard-list').append(listRow(i + 1, r.displayName + (r.mine ? ' 〈あなた〉' : ''), `最長逃走 ${time(r.longestTime)}`, r.score, r.mine))); }
  catch (e) { $('leaderboard-list').replaceChildren(); empty($('leaderboard-list'), e.message); }
});
$('ranking-name-form').addEventListener('submit', async e => {
  e.preventDefault(); $('ranking-name-save').disabled = true; $('ranking-name-status').textContent = '保存しています…';
  try { await onlineRanking.rename(user, $('ranking-name').value.trim()); $('ranking-name-status').textContent = '表示名を保存しました。'; $('leaderboard-button').click(); }
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
