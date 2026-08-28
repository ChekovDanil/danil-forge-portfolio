const data = [
  ["Открытие смены", "Студия · 09:00", ["Проверить входящие", "Сверить приоритеты", "Подготовить рабочую среду", "Зафиксировать первый результат"]],
  ["Выпуск обновления", "Продукт · по готовности", ["Проверить сборку", "Просмотреть изменения", "Сделать резервную копию", "Опубликовать и проверить"]],
  ["Закрытие дня", "Студия · 18:30", ["Записать результат", "Перенести незавершённое", "Очистить входящие", "Выключить рабочие сервисы"]]
];

let selected = 0;
const done = [new Set(), new Set(), new Set()];
const $ = (id) => document.getElementById(id);

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function render() {
  const procedure = data[selected];
  const completed = done[selected].size;
  const percent = completed * 25;
  $("date").textContent = `СЕГОДНЯ · ${selected + 1} ИЗ ${data.length}`;
  $("title").textContent = procedure[0];
  $("context").textContent = procedure[1];
  $("count").textContent = `${completed} из 4 · ${percent}%`;
  $("progress").style.width = `${percent}%`;
  $("procedureNav").innerHTML = data.map((item, index) => `<button type="button" data-procedure="${index}" aria-label="${item[0]}" aria-pressed="${index === selected}"></button>`).join("");
  $("steps").innerHTML = procedure[2].map((step, index) => {
    const complete = done[selected].has(index);
    return `<button class="step ${complete ? "done" : ""}" type="button" data-i="${index}" aria-pressed="${complete}"><small>${String(index + 1).padStart(2, "0")}</small><i aria-hidden="true">${complete ? "✓" : ""}</i><span>${step}</span></button>`;
  }).join("");
  $("action").firstElementChild.textContent = completed === 4 ? "Завершено · начать заново" : "Напомнить завтра";
  $("action").lastElementChild.textContent = completed === 4 ? "↺" : "→";
}

function chooseProcedure(index) {
  selected = (index + data.length) % data.length;
  render();
}

document.addEventListener("click", (event) => {
  const step = event.target.closest(".step");
  if (step) {
    const index = Number(step.dataset.i);
    done[selected].has(index) ? done[selected].delete(index) : done[selected].add(index);
    render();
    return;
  }
  const procedure = event.target.closest("[data-procedure]");
  if (procedure) chooseProcedure(Number(procedure.dataset.procedure));
});

$("next").addEventListener("click", () => chooseProcedure(selected + 1));
$("action").addEventListener("click", () => {
  if (done[selected].size === 4) {
    done[selected].clear();
    render();
    showToast("Процедура сброшена. Можно пройти цикл заново.");
  } else {
    showToast("В установленном APK здесь создаётся системное напоминание Android на завтра.");
  }
});

window.addEventListener("keydown", (event) => {
  if (event.target.closest("a, button, input, textarea, select")) return;
  if (/^[1-4]$/.test(event.key)) {
    const index = Number(event.key) - 1;
    done[selected].has(index) ? done[selected].delete(index) : done[selected].add(index);
    render();
  }
  if (event.key === "]") chooseProcedure(selected + 1);
  if (event.key === "[") chooseProcedure(selected - 1);
});

render();
