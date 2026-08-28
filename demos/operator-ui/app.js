const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const densityButton = $('#densityButton');
const toast = $('#toast');
const search = $('#queueSearch');
const rows = $$('.queue-row');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let toastTimer;
let currentFilter = 'all';

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function updateQueue() {
  const query = search.value.trim().toLocaleLowerCase('ru-RU');
  let visible = 0;

  rows.forEach((row) => {
    const kinds = row.dataset.kind.split(' ');
    const matchesFilter = currentFilter === 'all' || kinds.includes(currentFilter);
    const matchesSearch = !query || `${row.dataset.search} ${row.textContent}`.toLocaleLowerCase('ru-RU').includes(query);
    row.hidden = !(matchesFilter && matchesSearch);
    if (!row.hidden) visible += 1;
  });

  $('#noResults').hidden = visible !== 0;
  $('.chip[data-filter="mine"] b').textContent = rows.filter((row) => row.dataset.kind.split(' ').includes('mine')).length;
  $('.chip[data-filter="risk"] b').textContent = rows.filter((row) => row.dataset.kind.split(' ').includes('risk')).length;
  const filterCopy = {
    all: 'всей активной очереди',
    mine: 'записей с вашим участием',
    risk: 'проблем и решений владельца',
  };
  $('#filterNote').textContent = query
    ? `${visible} из 3 · поиск среди ${filterCopy[currentFilter]}`
    : `${visible} из 3 · ${filterCopy[currentFilter]}`;
}

function scrollToDecision() {
  $('#decisionNote').scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
  window.setTimeout(() => $('#approveButton').focus(), reduceMotion.matches ? 0 : 420);
}

function setDecision(state) {
  const note = $('#decisionNote');
  const row = $('#accessRow');
  const status = row.querySelector('.row-status');
  const action = row.querySelector('.open-decision');
  note.classList.remove('resolved', 'rejected');
  status.className = 'status row-status';

  if (state === 'approved') {
    note.classList.add('resolved');
    $('#decisionTitle').textContent = 'Тестовый доступ разрешён';
    $('#decisionCopy').textContent = 'Решение принято локально. В реальном продукте после этого запускается проверка API.';
    status.classList.add('accent-status');
    status.textContent = 'В работе';
    action.textContent = 'Открыть';
    row.classList.remove('priority', 'rejected');
    row.dataset.kind = 'mine';
    showToast('Решение сохранено. Проверка API запущена.');
  } else {
    note.classList.add('rejected');
    $('#decisionTitle').textContent = 'Тестовый доступ отклонён';
    $('#decisionCopy').textContent = 'Проверка не запущена. Задача остаётся в очереди как заблокированная.';
    status.classList.add('danger-status');
    status.textContent = 'Заблокировано';
    action.textContent = 'Пересмотреть';
    row.classList.remove('priority');
    row.classList.add('rejected');
    row.dataset.kind = 'risk mine';
    showToast('Доступ не выдан. Задача отмечена как заблокированная.');
  }
  updateQueue();
}

densityButton.addEventListener('click', () => {
  const compact = document.body.classList.toggle('compact-density');
  densityButton.setAttribute('aria-pressed', String(compact));
  densityButton.textContent = compact ? 'Свободнее' : 'Плотнее';
  showToast(compact ? 'Включена плотная очередь.' : 'Включена свободная очередь.');
});

$$('.chip').forEach((chip) => chip.addEventListener('click', () => {
  currentFilter = chip.dataset.filter;
  $$('.chip').forEach((item) => {
    const selected = item === chip;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  updateQueue();
}));

search.addEventListener('input', updateQueue);
$$('[data-scroll-decision]').forEach((button) => button.addEventListener('click', scrollToDecision));
$('#approveButton').addEventListener('click', () => setDecision('approved'));
$('#rejectButton').addEventListener('click', () => setDecision('rejected'));
$('#noticeButton').addEventListener('click', () => showToast('3 обновления в автоматических задачах.'));
$$('[data-toast]').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.toast)));

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
  if (!isTyping && event.key === '/') {
    event.preventDefault();
    search.focus();
  }
  if (event.key === 'Escape' && target === search && search.value) {
    search.value = '';
    updateQueue();
  }
});

updateQueue();
