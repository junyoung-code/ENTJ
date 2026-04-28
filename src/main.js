import { loadFromFile } from './storage/storage.js';
import { setDateDisplay, todayKey } from './utils/date.js';
import { initTodo, renderTodo } from './features/todo.js';
import { initDaily, renderDaily } from './features/daily.js';
import { initGoals, renderGoals } from './features/goals.js';
import { initStudy, renderStudyLog } from './features/study.js';
import { initCalendar, renderCalendar } from './features/calendar.js';
import { initMotto, renderMotto } from './features/motto.js';

function renderAll() {
  renderTodo();
  renderDaily();
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'records') renderCalendar();
    });
  });
}

function watchDateChange() {
  let currentDay = todayKey();
  setInterval(() => {
    const newDay = todayKey();
    if (newDay !== currentDay) {
      currentDay = newDay;
      setDateDisplay();
      renderAll();
      renderStudyLog();
    }
  }, 30000);
}

loadFromFile().finally(() => {
  initTabs();
  initTodo(renderAll);
  initDaily(renderAll);
  initGoals();
  initStudy();
  initCalendar();
  initMotto();
  watchDateChange();

  setDateDisplay();
  renderMotto();
  renderAll();
  renderGoals();
  renderStudyLog();
});

