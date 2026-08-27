import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import { after, before, test } from 'node:test';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('public/index.html', root), 'utf8');
const port = 3907;
let server;

before(async () => {
  server = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('.', root),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Showcase server did not start');
});

after(() => server?.kill());

test('показывает семь разрешённых проектов', () => {
  const names = ['Верста', 'FieldDesk', 'ReportKit', 'Stockroom', 'Relay', 'Booking Desk', 'Release Dock'];
  for (const name of names) assert.match(html, new RegExp(`>${name.replace(' ', '\\s')}<`));
});

test('все локальные изображения существуют и имеют alt', async () => {
  const images = [...html.matchAll(/<img src="([^\"]+)" alt="([^\"]+)"/g)];
  assert.equal(images.length, 7);
  for (const [, source, alt] of images) {
    assert.ok(alt.trim().length > 12);
    await access(new URL(`public${source.replace('/public', '')}`, root));
  }
});

test('в пакете нет неиспользуемых изображений', async () => {
  const referenced = new Set([...html.matchAll(/src="\/public\/assets\/([^\"]+)"/g)].map((match) => match[1]));
  for (const match of html.matchAll(/content="\/public\/assets\/([^\"]+)"/g)) referenced.add(match[1]);
  const available = new Set(await readdir(new URL('public/assets/', root)));
  assert.deepEqual(available, referenced);
});

test('у каждого проекта есть доступная текстовая ссылка', () => {
  const caseLinks = [...html.matchAll(/<a class="(?:project-link|card-link)"[^>]*>Открыть кейс/g)];
  assert.equal(caseLinks.length, 7);
});

test('главная страница и стили доступны, запись запрещена', async () => {
  const page = await fetch(`http://127.0.0.1:${port}/`);
  const css = await fetch(`http://127.0.0.1:${port}/public/style.css`);
  const post = await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Цифровые продукты/);
  assert.equal(css.status, 200);
  assert.equal(post.status, 405);
});

test('страница полностью исключает закрытый проект и не выдаёт демо за клиента', () => {
  assert.doesNotMatch(html, /закрытый проект|конфиденциальный продукт|3121/i);
  assert.match(html, /демонстрационные проекты не выданы за клиентские/i);
  assert.match(html, /симулятор Telegram-заявки/i);
  assert.match(html, /локальная проверка контейнера/i);
});

test('подготовлены social preview и базовые метаданные', async () => {
  assert.match(html, /property="og:title"/);
  assert.match(html, /property="og:image" content="\/public\/assets\/social-preview\.png"/);
  await access(new URL('public/assets/social-preview.png', root));
});
