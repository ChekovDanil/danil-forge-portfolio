const servicesRoot = document.querySelector('#services');
const incidentsRoot = document.querySelector('#incidents');
const messagesRoot = document.querySelector('#messages');
const summary = document.querySelector('#summary');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/gu, (symbol) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[symbol]));
}

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'content-type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие');
  return data;
}

function renderServices(services) {
  servicesRoot.innerHTML = services.map((service) => {
    const muted = service.mutedUntil && new Date(service.mutedUntil) > new Date();
    const label = service.status === 'healthy' ? 'Отвечает' : service.status === 'degraded' ? 'Проверить' : 'Нет ответа';
    return `<article class="service ${escapeHtml(service.status)}">
      <div class="service-top"><div><h3>${escapeHtml(service.name)}</h3><span class="service-target">${escapeHtml(service.target)}</span></div><small>${Number(service.latencyMs).toLocaleString('ru-RU')} мс</small></div>
      <span class="service-status"><i aria-hidden="true"></i>${label}</span>
      <button type="button" data-mute="${escapeHtml(service.id)}" ${muted ? 'disabled' : ''}>${muted ? 'Приглушено на 30 минут' : 'Не беспокоить 30 минут'}</button>
    </article>`;
  }).join('');
}

function renderIncidents(incidents) {
  const active = incidents.filter((incident) => incident.state !== 'resolved');
  incidentsRoot.innerHTML = active.length ? active.map((incident) => {
    const acknowledged = incident.state === 'acknowledged';
    return `<article class="incident-card ${incident.severity === 'critical' ? 'is-critical' : ''}">
      <div class="incident-top"><span class="incident-id">${escapeHtml(incident.id)} / ${escapeHtml(incident.state)}</span><span class="severity ${escapeHtml(incident.severity)}">${incident.severity === 'critical' ? 'Критический' : 'Проверить'}</span></div>
      <h3>${escapeHtml(incident.serviceName)}</h3>
      <p>${escapeHtml(incident.summary)}</p>
      <div class="incident-meta">
        <span>Сгруппировано <b>${Number(incident.checks)} проверк.</b></span>
        <span>Последний ответ <b>${Number(incident.lastLatencyMs).toLocaleString('ru-RU')} мс</b></span>
        <span>Ответственный <b>${acknowledged ? escapeHtml(incident.acknowledgedBy) : 'Не назначен'}</b></span>
      </div>
      <div class="incident-actions">
        <button type="button" data-ack="${escapeHtml(incident.id)}" ${acknowledged ? 'disabled' : ''}>${acknowledged ? 'Принято в работу' : 'Взять в работу'}</button>
        <button type="button" class="secondary" data-resolve="${escapeHtml(incident.serviceId)}">Проверить восстановление</button>
      </div>
    </article>`;
  }).join('') : '<div class="empty"><p><b>Система спокойна</b>Все три сервиса отвечают.<br>Новых решений не требуется.</p></div>';
}

function renderMessages(messages) {
  const visible = messages.filter((message) => message.delivery !== 'grouped').slice(0, 5);
  messagesRoot.innerHTML = visible.length ? visible.map((message) => {
    const deliveryClass = message.delivery === 'digest' || message.delivery === 'muted' ? 'muted' : message.delivery === 'send' && message.kind === 'incident' ? 'urgent' : '';
    const deliveryLabel = message.delivery === 'digest' ? 'Утренняя сводка' : message.delivery === 'muted' ? 'Заглушено' : 'Отправить сразу';
    return `<div class="bubble ${deliveryClass}">${escapeHtml(message.text)}<small><span>${deliveryLabel}</span><span>${escapeHtml(message.id)}</span></small></div>`;
  }).join('') : '<div class="bubble">Все 3 сервиса отвечают. Активных инцидентов нет.<small><span>/status</span><span>LOCAL</span></small></div>';
}

function render(state) {
  renderServices(state.services);
  renderIncidents(state.incidents);
  renderMessages(state.messages);
  summary.textContent = state.summary;
}

async function setScenario(name) {
  const state = await api('/api/scenario', { method: 'POST', body: JSON.stringify({ name }) });
  document.querySelectorAll('[data-scenario]').forEach((button) => {
    const active = button.dataset.scenario === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  render(state);
}

document.addEventListener('click', async (event) => {
  const scenario = event.target.closest('[data-scenario]');
  const ack = event.target.closest('[data-ack]');
  const mute = event.target.closest('[data-mute]');
  const resolve = event.target.closest('[data-resolve]');
  try {
    if (scenario) return setScenario(scenario.dataset.scenario);
    if (ack) return render(await api(`/api/incidents/${encodeURIComponent(ack.dataset.ack)}/ack`, { method: 'POST', body: JSON.stringify({ by: 'Вы' }) }));
    if (mute) return render(await api(`/api/services/${encodeURIComponent(mute.dataset.mute)}/mute`, { method: 'POST', body: JSON.stringify({ minutes: 30 }) }));
    if (resolve) return render(await api(`/api/services/${encodeURIComponent(resolve.dataset.resolve)}/recover`, { method: 'POST', body: '{}' }));
  } catch (error) {
    summary.textContent = error.message;
  }
});

setScenario('critical').catch((error) => { summary.textContent = error.message; });
