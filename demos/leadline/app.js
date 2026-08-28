import { conversion, pipelineStats, removeDeal, stages, upcoming, upsertDeal } from "/src/pipeline.js";

const $ = (id) => document.getElementById(id);
const money = (value) => `${new Intl.NumberFormat("ru-RU").format(Math.round(value))} ₽`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const labels = { new: "Новые", qualified: "Потребность", proposal: "Предложение", decision: "Решение" };
const stageDescriptions = { new: "Первичный интерес", qualified: "Контекст подтверждён", proposal: "Смета у клиента", decision: "Финальное согласование" };
const storageKey = "leadline.demo.v2";
const monthNames = ["ЯНВАРЬ", "ФЕВРАЛЬ", "МАРТ", "АПРЕЛЬ", "МАЙ", "ИЮНЬ", "ИЮЛЬ", "АВГУСТ", "СЕНТЯБРЬ", "ОКТЯБРЬ", "НОЯБРЬ", "ДЕКАБРЬ"];
const today = new Date();
today.setHours(0, 0, 0, 0);

function dateOffset(days) {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const seedDeals = [
  { id: "d1", company: "Маяк", title: "Редизайн личного кабинета", amount: 180000, probability: 65, stage: "proposal", nextAt: dateOffset(0), next: "Отправить оценку этапов", note: "Клиенту важен запуск первой версии за пять недель." },
  { id: "d2", company: "Runa", title: "CRM сервисного отдела", amount: 260000, probability: 40, stage: "qualified", nextAt: dateOffset(1), next: "Уточнить роли сотрудников", note: "Нужна интеграция с действующей телефонией." },
  { id: "d3", company: "Forma", title: "Промосайт коллекции", amount: 95000, probability: 80, stage: "decision", nextAt: dateOffset(-1), next: "Получить решение", note: "Смета согласована, обсуждается дата старта." },
  { id: "d4", company: "Север", title: "Telegram-бот заявок", amount: 72000, probability: 30, stage: "new", nextAt: dateOffset(3), next: "Провести короткий созвон", note: "Есть базовое описание, требуется карта сценариев." },
  { id: "d5", company: "Noma", title: "Автоматизация отчётов", amount: 120000, probability: 55, stage: "qualified", nextAt: dateOffset(0), next: "Проверить пример таблицы", note: "Еженедельный отчёт сейчас собирается вручную." },
];

function loadDeals() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(stored) ? stored : seedDeals;
  } catch {
    return seedDeals;
  }
}

let deals = loadDeals();
let selectedId = null;

function persist() {
  localStorage.setItem(storageKey, JSON.stringify(deals));
}

function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  window.setTimeout(() => $("toast").classList.remove("show"), 2200);
}

function relativeDate(value) {
  if (!value) return "Дата не задана";
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return "Дата не задана";
  const difference = Math.round((target - today) / 86400000);
  if (difference === -1) return "Вчера";
  if (difference === 0) return "Сегодня";
  if (difference === 1) return "Завтра";
  return target.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
}

function isOverdue(deal) {
  return deal.nextAt && new Date(`${deal.nextAt}T00:00:00`) < today;
}

function countLabel(count, words) {
  const value = Math.abs(count) % 100;
  const tail = value % 10;
  if (value > 10 && value < 20) return words[2];
  if (tail === 1) return words[0];
  if (tail > 1 && tail < 5) return words[1];
  return words[2];
}

function render() {
  const stats = pipelineStats(deals, today);
  $("period").textContent = `ПРОДАЖИ / ${monthNames[today.getMonth()]}`;
  $("total").textContent = money(stats.total);
  $("weighted").textContent = money(stats.weighted);
  $("conversion").textContent = `${conversion(deals)}%`;
  $("overdue").textContent = stats.overdue;
  $("overdueCaption").textContent = stats.overdue ? "требуют нового контакта" : "на сегодня всё закрыто";
  $("activeCount").textContent = `${deals.length} ${countLabel(deals.length, ["активная сделка", "активные сделки", "активных сделок"])}`;

  $("board").innerHTML = stages.map((stage, index) => {
    const stageDeals = deals.filter((deal) => deal.stage === stage);
    const amount = stageDeals.reduce((sum, deal) => sum + deal.amount, 0);
    return `<section class="lane"><header><div class="lane-title"><i class="lane-step">0${index + 1}</i><div><small>${labels[stage]}</small><b>${stageDescriptions[stage]} · ${stageDeals.length}</b></div></div><span>${money(amount)}</span></header><div class="lane-stack">${stageDeals.map((deal) => `
      <button class="card${isOverdue(deal) ? " overdue" : ""}" data-id="${deal.id}">
        <span class="card-top"><small>${escapeHtml(deal.company)}</small><i class="card-health">${isOverdue(deal) ? "Нужен контакт" : "В ритме"}</i></span><h3>${escapeHtml(deal.title)}</h3>
        <p><span>${relativeDate(deal.nextAt)}</span>${escapeHtml(deal.next)}</p>
        <footer><b>${money(deal.amount)}</b><span><progress max="100" value="${deal.probability}" aria-label="Вероятность ${deal.probability}%"></progress>${deal.probability}%</span></footer>
      </button>`).join("") || '<div class="empty"><b>Этап свободен</b><span>Перенесите сюда сделку через карточку.</span></div>'}</div></section>`;
  }).join("");

  const ordered = upcoming(deals);
  $("agendaRows").innerHTML = ordered.map((deal) => `<button data-id="${deal.id}" class="${isOverdue(deal) ? "overdue-row" : ""}"><time>${relativeDate(deal.nextAt)}</time><span><b>${escapeHtml(deal.next)}</b><small>${escapeHtml(deal.company)} · ${escapeHtml(deal.title)}</small></span><em>${money(deal.amount)}</em></button>`).join("") || '<div class="agenda-empty"><b>Контакты не запланированы</b><span>Откройте сделку и назначьте следующий шаг.</span></div>';

  const focus = ordered.slice(0, 3);
  const overdueDeals = ordered.filter(isOverdue);
  $("focusPanel").classList.toggle("attention", overdueDeals.length > 0);
  $("focusEyebrow").textContent = overdueDeals.length ? "ТРЕБУЕТ ВНИМАНИЯ" : "БЛИЖАЙШИЙ ФОКУС";
  $("focusTitle").textContent = focus.length ? `${focus.length} ${countLabel(focus.length, ["контакт", "контакта", "контактов"])}` : "План чист";
  $("focusCopy").textContent = overdueDeals.length ? `${overdueDeals.length} ${countLabel(overdueDeals.length, ["действие просрочено", "действия просрочены", "действий просрочено"])}.` : "Контакты, которые двигают сделки дальше.";
  $("focusList").innerHTML = focus.map((deal) => `<article class="${isOverdue(deal) ? "overdue-contact" : ""}"><time>${relativeDate(deal.nextAt)}</time><div><b>${escapeHtml(deal.next)}</b><span>${escapeHtml(deal.company)} · ${money(deal.amount)}</span></div></article>`).join("") || '<div class="agenda-empty"><b>Нет ближайших действий</b><span>Добавьте дату контакта в карточке сделки.</span></div>';

  const target = 2000000;
  const progress = Math.min(100, Math.round((stats.weighted / target) * 100));
  $("goalPercent").textContent = `${progress}%`;
  $("goalAmount").textContent = `${money(stats.weighted)} из ${money(target)}`;
  $("goalBar").value = progress;
  $("goalCopy").textContent = progress >= 100 ? "Цель достигнута." : `До цели по прогнозу осталось ${money(target - stats.weighted)}.`;

  document.querySelectorAll("[data-id]").forEach((button) => button.addEventListener("click", () => openDeal(button.dataset.id)));
}

function fillForm(deal) {
  $("dealCompany").value = deal.company;
  $("dealName").value = deal.title;
  $("dealAmount").value = deal.amount;
  $("dealProbability").value = deal.probability;
  $("dealNext").value = deal.next;
  $("dealDate").value = deal.nextAt;
  $("move").value = deal.stage;
  $("dealNote").value = deal.note;
}

function openDeal(id = null) {
  selectedId = id;
  const deal = id ? deals.find((item) => item.id === id) : {
    id: crypto.randomUUID(), company: "", title: "", amount: 0, probability: 20,
    stage: "new", nextAt: dateOffset(1), next: "", note: "",
  };
  $("dealStage").textContent = id ? labels[deal.stage].toUpperCase() : "НОВАЯ ВОЗМОЖНОСТЬ";
  $("dialogTitle").textContent = id ? "Редактировать сделку" : "Новая сделка";
  $("deleteDeal").hidden = !id;
  $("deleteConfirm").hidden = true;
  $("formError").textContent = "";
  fillForm(deal);
  $("deal").dataset.draftId = deal.id;
  $("deal").showModal();
  window.setTimeout(() => $("dealCompany").focus(), 0);
}

function closeDeal() {
  $("deal").close();
  selectedId = null;
  $("deleteConfirm").hidden = true;
}

$("dealForm").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const wasEditing = Boolean(selectedId);
    const candidate = {
      id: $("deal").dataset.draftId,
      company: $("dealCompany").value,
      title: $("dealName").value,
      amount: $("dealAmount").value,
      probability: $("dealProbability").value,
      next: $("dealNext").value,
      nextAt: $("dealDate").value,
      stage: $("move").value,
      note: $("dealNote").value,
    };
    deals = upsertDeal(deals, candidate);
    persist();
    render();
    closeDeal();
    toast(wasEditing ? "Сделка обновлена" : "Сделка добавлена");
  } catch (error) {
    $("formError").textContent = error.message;
  }
});

$("add").addEventListener("click", () => openDeal());
$("closeDialog").addEventListener("click", closeDeal);
$("cancelDialog").addEventListener("click", closeDeal);
$("deleteDeal").addEventListener("click", () => {
  if (!selectedId) return;
  $("deleteConfirm").hidden = false;
  $("confirmDelete").focus();
});
$("keepDeal").addEventListener("click", () => {
  $("deleteConfirm").hidden = true;
  $("deleteDeal").focus();
});
$("confirmDelete").addEventListener("click", () => {
  if (!selectedId) return;
  deals = removeDeal(deals, selectedId);
  persist();
  render();
  closeDeal();
  toast("Сделка удалена");
});
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-view]").forEach((item) => {
    item.classList.toggle("active", item === button);
    item.setAttribute("aria-pressed", String(item === button));
  });
  $("board").classList.toggle("hidden", button.dataset.view !== "board");
  $("agenda").classList.toggle("hidden", button.dataset.view !== "agenda");
}));

$("deal").addEventListener("close", () => {
  selectedId = null;
  $("deleteConfirm").hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && $("deal").open) {
    event.preventDefault();
    closeDeal();
    return;
  }
  const target = event.target;
  const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  if (!isTyping && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "n" && !$("deal").open) {
    event.preventDefault();
    openDeal();
  }
});

render();
