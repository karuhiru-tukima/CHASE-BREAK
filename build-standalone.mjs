import { readFile, writeFile } from 'node:fs/promises';
const read = name => readFile(new URL(`./src/${name}`, import.meta.url), 'utf8');
const strip = text => text.replace(/^import .*?;\r?\n/gm, '').replace(/^export \{.*?\} from .*?;\r?\n/gm, '').replace(/\bexport (?=(?:class|function|const|let|async)\b)/g, '');
const city = strip(await read('city.js'));
const renderer = strip(await read('city-renderer.js'));
const engine = strip(await read('game.js'));
const offline = strip(await read('offline-auth.mjs'));
const app = strip(await read('app.js'));
const mobile = strip(await read('mobile-controls.mjs'));
const ranking = strip(await read('online-ranking.mjs'));
const javascript = `"use strict";\nconst City=(()=>{${city}\nreturn {roads,roadNodes,roadEdges,CITY_SIZE,plazas,parks,buildings,trees,parkedCars,obstacles,sampleRoad,roadRoute,nearestRoadNode,distanceToRoad,wrapCity};})();\nconst Renderer=(()=>{const {roads,roadNodes,plazas,parks,buildings,trees,sampleRoad,CITY_SIZE}=City;\n${renderer}\nreturn {drawCity};})();\nconst Mobile=(()=>{${mobile}\nreturn {TouchInput,touchDrive,setupMobile};})();\nconst Engine=(()=>{const {TouchInput,touchDrive}=Mobile;const {roads,roadNodes,CITY_SIZE:SIZE,buildings,obstacles,parkedCars,roadRoute,nearestRoadNode,sampleRoad,wrapCity}=City; const {drawCity}=Renderer;\n${engine}\nreturn {ChaseGame,AudioEngine};})();\nconst Offline=(()=>{${offline}\nreturn {createLocalApi};})();\nconst Ranking=(()=>{${ranking}\nreturn {createOnlineRanking};})();\n(async()=>{const {createOnlineRanking}=Ranking;const {setupMobile}=Mobile;const {ChaseGame,AudioEngine}=Engine;const {createLocalApi}=Offline;\n${app}\n})().catch(error=>{document.getElementById('loading').textContent='起動できませんでした：'+error.message;console.error(error);});`;
const css = await read('style.css');
const favicon = `data:image/png;base64,${(await readFile(new URL('./icon-192.png', import.meta.url))).toString('base64')}`;
let html = await read('index.html');
html = html.replace('<link rel="icon" type="image/png" sizes="192x192" href="./icon-192.png">', `<link rel="icon" type="image/png" sizes="192x192" href="${favicon}">`)
  .replace('<link rel="stylesheet" href="/style.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="/app.js"></script>', '')
  .replace('href="/" aria-label="CHASE BREAK ホーム"', 'href="./index.html" aria-label="CHASE BREAK ホーム"')


  .replace('<main id="garage" hidden>', '<main id="garage" hidden><div id="offline-notice" class="offline-notice" role="status"></div>')
  .replace('</form><p class="auth-footnote">', '</form><button id="guest-play" class="secondary" type="button">登録せずに遊ぶ →</button><p class="auth-footnote">')
  .replace('ChatGPT・Claudeのアカウントは不要。<br>初めての方は「新規登録」から作成できます。', 'アカウントと記録は、このブラウザ内だけに保存されます。<br>初めての方は「新規登録」から作成できます。')
  .replace('ドライバーランキングを見る →', 'このブラウザのランキングを見る →')
  .replace('すべてのドライバーの自己ベスト。', 'このブラウザに保存されたドライバーの自己ベスト。')
  .replace('</style>', '\n.offline-notice{font-size:10px;color:#b6c49e;border:1px solid #bcff4a30;border-radius:4px;background:#182311d9;padding:10px 13px;margin:0 0 23px;line-height:1.6} </style>')
  .replace('</body>', `<script>${javascript.replace(/<\/script/gi, '<\\/script')}</script></body>`);
await writeFile(new URL('./index.html', import.meta.url), html);
console.log(`Created index.html (${Buffer.byteLength(html).toLocaleString()} bytes), with all game code, visuals, and local accounts embedded.`);
