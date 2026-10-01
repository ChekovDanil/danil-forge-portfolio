export const stages = Object.freeze(['new', 'qualified', 'proposal', 'decision']);

export function pipelineStats(deals, today = new Date()) {
  const boundary = new Date(today);
  boundary.setHours(0, 0, 0, 0);
  return deals.reduce((stats, deal) => {
    stats.total += Number(deal.amount) || 0;
    stats.weighted += (Number(deal.amount) || 0) * (Number(deal.probability) || 0) / 100;
    if (deal.nextAt && new Date(`${deal.nextAt}T00:00:00`) < boundary) stats.overdue += 1;
    return stats;
  }, { total: 0, weighted: 0, overdue: 0 });
}

export function conversion(deals) {
  return deals.length ? Math.round(deals.filter(deal => deal.stage === 'decision').length / deals.length * 100) : 0;
}

export function upcoming(deals) {
  return deals.filter(deal => deal.nextAt).slice().sort((a, b) => a.nextAt.localeCompare(b.nextAt));
}

export function upsertDeal(deals, candidate) {
  const deal = { ...candidate };
  for (const field of ['company', 'title', 'next', 'nextAt', 'note']) deal[field] = String(deal[field] ?? '').trim();
  if (!deal.id || !deal.company || !deal.title) throw new Error('Укажите компанию и название сделки.');
  if (!stages.includes(deal.stage)) throw new Error('Выберите этап сделки.');
  deal.amount = Number(deal.amount);
  deal.probability = Number(deal.probability);
  if (!Number.isFinite(deal.amount) || deal.amount < 0) throw new Error('Сумма должна быть не меньше нуля.');
  if (!Number.isFinite(deal.probability) || deal.probability < 0 || deal.probability > 100) throw new Error('Вероятность — от 0 до 100%.');
  if (deal.nextAt && !/^\d{4}-\d{2}-\d{2}$/.test(deal.nextAt)) throw new Error('Проверьте дату следующего контакта.');
  return deals.some(item => item.id === deal.id) ? deals.map(item => item.id === deal.id ? deal : item) : [...deals, deal];
}

export function removeDeal(deals, id) {
  return deals.filter(deal => deal.id !== id);
}
