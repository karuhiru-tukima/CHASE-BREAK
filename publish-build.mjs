import { mkdir, readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const input = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const html = input
  .replace('CHASE BREAK — オフライン版', 'CHASE BREAK — 夜を振り切れ。')
  .replaceAll('NIGHT CITY / OFFLINE', 'NIGHT CITY / WEB')
  .replaceAll('オフライン版 · 記録とランキングはこのブラウザ内だけに保存', 'ブラウザ保存版 · 記録とランキングはこのブラウザ内だけに保存');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script || /<script[^>]+src=|<link[^>]+rel="stylesheet"|type="module"/.test(html)) throw new Error('Standalone game is incomplete.');
new vm.Script(script);
await mkdir(new URL('./dist/', import.meta.url), { recursive: true });
await writeFile(new URL('./dist/index.html', import.meta.url), html);
console.log('Prepared complete browser game for public hosting.');
