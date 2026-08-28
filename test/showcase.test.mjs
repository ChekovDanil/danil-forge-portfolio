import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('public/index.html', root), 'utf8');
const port = 3909;
let server;

before(async () => {
  server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', root),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Portfolio server did not start');
});

after(() => server?.kill());

test('главная подборка содержит шесть сильных работ', () => {
  for (const name of ['Верста', 'FieldDesk', 'Booking Desk', 'Leadline', 'Groundlog', 'Batch Studio']) {
    assert.match(html, new RegExp(`>${name}<`));
  }
  assert.match(html, /01\s*\/\s*06/);
});

test('главные изображения существуют и описаны', async () => {
  const images = [...html.matchAll(/<img src="([^"]+)" alt="([^"]+)"/g)];
  assert.equal(images.length, 9);
  for (const [, source, alt] of images) {
    assert.ok(alt.trim().length > 12);
    await access(new URL(`public/${source.replace(/^\.\//, '')}`, root));
  }
});

test('кейсы и рабочие демо упакованы рядом с витриной', async () => {
  const paths = [
    'cases/versta/index.html',
    'cases/fielddesk/index.html',
    'cases/booking-desk/index.html',
    'demos/leadline/index.html',
    'cases/groundlog/index.html',
    'cases/batch-studio/index.html',
  ];
  for (const path of paths) await access(new URL(`public/${path}`, root));
});

test('в публикации нет локальных URL и закрытого проекта', async () => {
  const manifest = await readFile(new URL('public/publication-manifest.json', root), 'utf8');
  assert.doesNotMatch(html, /https?:\/\/(?:localhost|127\.0\.0\.1)/i);
  assert.doesNotMatch(`${html}\n${manifest}`, /locus|nrav|нрав|нраф/i);
  assert.match(html, /демонстрационные проекты не выданы за клиентские/i);
});

test('сервер отдаёт главную, стили и вложенные страницы', async () => {
  for (const path of ['/', '/style.css', '/cases/versta/index.html', '/demos/leadline/index.html']) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(response.status, 200, path);
  }
  const post = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' });
  assert.equal(post.status, 405);
});

test('подготовлены метаданные и social preview', async () => {
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:image" content="\.\/assets\/social-preview\.png"/);
  await access(new URL('public/assets/social-preview.png', root));
});
