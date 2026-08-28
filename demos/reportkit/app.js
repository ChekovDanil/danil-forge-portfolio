import { inspectCsv, issuesToCsv, processCsv, requiredColumns, suggestMapping, toCsv } from '/src/reportkit.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]);
const labels = { date:'Дата', client:'Клиент', phone:'Телефон', amount:'Сумма', status:'Статус' };
const plural = (number, forms) => {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
};
const sample = `Дата;Клиент;Телефон;Сумма;Этап\n27.08.2026;Кофейня Шум;8 (913) 000-18-42;5 000;Новый\n27/08/2026;Студия Мера;+7 913 200-44-10;12500,50;Оплачен\n31.02.2026;Пекарня Тесто;123;ошибка;Новый\n28-08-2026;Офис Nordline;89134770219;8 900 ₽;В работе\n29.08.2026;Магазин Линия;89132224455;7200;Оплачен`;

let sourceText = '';
let fileLabel = '';
let headers = [];
let mapping = {};
let latest = null;
let activeView = 'all';
let toastTimer;

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2600);
}

function setStep(step, text) {
  document.querySelectorAll('[data-step]').forEach((item) => {
    const number = Number(item.dataset.step);
    item.classList.toggle('active', number === step);
    item.classList.toggle('done', number < step);
  });
  if (text) $(`step${['','File','Mapping','Review','Export'][step]}`).textContent = text;
  document.querySelectorAll('[data-signal]').forEach((item) => {
    const number = Number(item.dataset.signal);
    item.classList.toggle('is-current', number === step);
    item.classList.toggle('is-done', number < step);
  });
  const states = ['', 'ожидает файл', 'сопоставление', 'проверка', 'готово'];
  $('signalState').textContent = states[step];
  $('signalPercent').textContent = `${[0, 0, 38, 72, 100][step]}%`;
}

function mappingComplete() { return requiredColumns.every((column) => mapping[column] && headers.includes(mapping[column])); }

function renderMapping() {
  const options = (selected) => ['<option value="">Не выбрано</option>', ...headers.map((header) => `<option value="${escapeHtml(header)}" ${header === selected ? 'selected' : ''}>${escapeHtml(header)}</option>`)].join('');
  $('mappingGrid').innerHTML = requiredColumns.map((column) => `<label><span>${labels[column]}</span><div class="select-wrap"><select data-column="${column}" aria-label="Колонка: ${labels[column]}">${options(mapping[column])}</select></div></label>`).join('');
  document.querySelectorAll('[data-column]').forEach((select) => select.onchange = () => { mapping[select.dataset.column] = select.value; updateMappingState(); });
  updateMappingState();
}

function updateMappingState() {
  const count = requiredColumns.filter((column) => mapping[column] && headers.includes(mapping[column])).length;
  $('mappingScore').textContent = `${count} / 5`;
  $('mappingScore').classList.toggle('complete', count === 5);
  $('run').disabled = count !== 5;
  $('mappingHint').textContent = count === 5 ? 'Все обязательные поля сопоставлены' : `Осталось сопоставить: ${5 - count}`;
  $('stepMapping').textContent = count === 5 ? '5 из 5 готовы' : `${count} из 5`;
  $('signalFields').textContent = `${count} из 5`;
  $('signalPercent').textContent = `${Math.round(20 + count * 8)}%`;
}

function loadText(text, name, sizeLabel = '') {
  const inspected = inspectCsv(text);
  if (!inspected.headers.length) { toast('Не удалось прочитать заголовки файла'); return; }
  sourceText = text;
  fileLabel = name;
  headers = inspected.headers;
  mapping = suggestMapping(headers);
  latest = null;
  $('fileName').textContent = name;
  $('fileMeta').textContent = `${sizeLabel ? `${sizeLabel} · ` : ''}${inspected.rowCount} строк · ${headers.length} колонок · разделитель ${inspected.delimiter === '\t' ? 'TAB' : inspected.delimiter}`;
  $('fileCard').hidden = false;
  $('dropzone').hidden = true;
  $('results').hidden = true;
  $('stepFile').textContent = `${inspected.rowCount} строк`;
  $('signalRows').textContent = `${inspected.rowCount} строк`;
  $('signalIssues').textContent = 'ожидает';
  $('signalReady').textContent = 'не готов';
  $('stepReview').textContent = 'не запущена';
  $('stepExport').textContent = 'не готов';
  renderMapping();
  setStep(2);
}

function clearFile() {
  sourceText = ''; fileLabel = ''; headers = []; mapping = {}; latest = null;
  $('fileInput').value = '';
  $('fileCard').hidden = true;
  $('dropzone').hidden = false;
  $('results').hidden = true;
  $('mappingGrid').innerHTML = '<div class="mapping-empty">Сначала выберите файл</div>';
  $('mappingScore').textContent = '0 / 5';
  $('mappingHint').textContent = 'Нужно сопоставить пять обязательных полей';
  $('run').disabled = true;
  $('stepFile').textContent = 'не выбран'; $('stepMapping').textContent = 'ожидают файла'; $('stepReview').textContent = 'не запущена'; $('stepExport').textContent = 'не готов';
  $('signalRows').textContent = '— строк'; $('signalFields').textContent = '0 из 5'; $('signalIssues').textContent = 'не запущен'; $('signalReady').textContent = 'не готов';
  setStep(1);
}

function readFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Файл больше 2 МБ'); return; }
  const reader = new FileReader();
  reader.onload = () => loadText(String(reader.result), file.name, `${Math.max(1, Math.round(file.size / 1024))} КБ`);
  reader.onerror = () => toast('Не удалось прочитать файл');
  reader.readAsText(file, 'utf-8');
}

function renderRows() {
  if (!latest) return;
  const rows = latest.rows.filter((row) => activeView === 'all' || (activeView === 'valid' ? row.valid : !row.valid));
  $('visibleRows').textContent = `${rows.length} ${plural(rows.length, ['строка', 'строки', 'строк'])}`;
  $('rows').innerHTML = rows.map((row) => {
    const messages = latest.issues.filter((issue) => issue.row === row.sourceRow);
    return `<tr class="${row.valid ? 'valid-row' : 'invalid-row'}"><td data-label="Строка"><b>${row.sourceRow}</b><span class="row-state">${row.valid ? 'Готово' : `${messages.length} ошибки`}</span></td><td data-label="Дата">${escapeHtml(row.date || '—')}${messages.filter(i=>i.field==='date').map(i=>`<small>${escapeHtml(i.message)}: ${escapeHtml(i.value)}</small>`).join('')}</td><td data-label="Клиент">${escapeHtml(row.client || '—')}${messages.filter(i=>i.field==='client').map(i=>`<small>${escapeHtml(i.message)}</small>`).join('')}</td><td data-label="Телефон">${escapeHtml(row.phone || '—')}${messages.filter(i=>i.field==='phone').map(i=>`<small>${escapeHtml(i.message)}: ${escapeHtml(i.value)}</small>`).join('')}</td><td data-label="Сумма">${row.amount === null ? '—' : `${new Intl.NumberFormat('ru-RU').format(row.amount)} ₽`}${messages.filter(i=>i.field==='amount').map(i=>`<small>${escapeHtml(i.message)}: ${escapeHtml(i.value)}</small>`).join('')}</td><td data-label="Статус">${escapeHtml(row.status || '—')}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="empty">В этом фильтре нет строк</td></tr>';
}

function renderResult(result) {
  latest = result;
  $('total').textContent = result.summary.total;
  $('valid').textContent = result.summary.valid;
  $('invalid').textContent = result.summary.invalid;
  $('amount').textContent = new Intl.NumberFormat('ru-RU').format(result.summary.amount) + ' ₽';
  $('resultTitle').textContent = result.summary.invalid ? `Готово ${result.summary.valid} из ${result.summary.total}` : 'Все строки готовы';
  const readiness = result.summary.total ? Math.round(result.summary.valid / result.summary.total * 100) : 0;
  $('qualityPercent').textContent = `${readiness}%`;
  $('qualityFill').style.width = `${readiness}%`;
  $('qualityCaption').textContent = result.summary.invalid ? `${result.summary.invalid} ${plural(result.summary.invalid, ['строка требует', 'строки требуют', 'строк требуют'])} исправления` : 'Ошибок не найдено';
  $('signalIssues').textContent = result.summary.invalid ? `${result.summary.invalid} ${plural(result.summary.invalid, ['ошибка', 'ошибки', 'ошибок'])}` : 'без ошибок';
  $('signalReady').textContent = `${result.summary.valid} строк`;
  $('download').disabled = result.summary.valid === 0;
  $('issuesDownload').disabled = result.issues.length === 0;
  $('results').hidden = false;
  $('stepReview').textContent = `${result.summary.total} строк проверено`;
  $('stepExport').textContent = `${result.summary.valid} готовы`;
  activeView = 'all';
  document.querySelectorAll('[data-view]').forEach((button) => { const active = button.dataset.view === 'all'; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  renderRows();
  setStep(4);
  $('results').scrollIntoView({ behavior:'smooth', block:'start' });
}

function downloadText(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type:'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

$('fileInput').onchange = () => readFile($('fileInput').files[0]);
$('sample').onclick = () => loadText(sample, 'orders_august.csv', '1 КБ');
$('removeFile').onclick = clearFile;
$('run').onclick = () => renderResult(processCsv(sourceText, mapping));
$('download').onclick = () => { if (latest) downloadText(toCsv(latest.rows), `${fileLabel.replace(/\.csv$/i,'') || 'reportkit'}-clean.csv`); };
$('issuesDownload').onclick = () => { if (latest) downloadText(issuesToCsv(latest.issues), `${fileLabel.replace(/\.csv$/i,'') || 'reportkit'}-issues.csv`); };
document.querySelectorAll('[data-view]').forEach((button) => button.onclick = () => { activeView = button.dataset.view; document.querySelectorAll('[data-view]').forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); }); renderRows(); });

for (const event of ['dragenter','dragover']) $('dropzone').addEventListener(event, (e) => { e.preventDefault(); $('dropzone').classList.add('dragging'); });
for (const event of ['dragleave','drop']) $('dropzone').addEventListener(event, (e) => { e.preventDefault(); $('dropzone').classList.remove('dragging'); });
$('dropzone').addEventListener('drop', (event) => readFile(event.dataTransfer.files[0]));
