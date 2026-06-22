import { closeModal, initModalForm, startTextEdit } from '../utils/dom.js';
import { getDailyTasks, getTodayRecord, saveDailyTasks, saveTodayRecord } from '../storage/storage.js';

let renderAll = () => {};

function confirmDaily() {
  const input = document.getElementById('dailyInput');
  const val = input.value.trim();
  if (!val) return;
  const tasks = getDailyTasks();
  if (tasks.includes(val)) {
    alert('이미 있는 항목이에요!');
    return;
  }
  input.value = '';
  tasks.push(val);
  saveDailyTasks(tasks);
  closeModal('dailyModal');
  renderAll();
}

export function renderDaily() {
  const tasks = getDailyTasks();
  const rec = getTodayRecord();
  const list = document.getElementById('dailyList');
  const empty = document.getElementById('dailyEmpty');
  const progressWrap = document.getElementById('dailyProgress');
  list.innerHTML = '';

  if (tasks.length === 0) {
    empty.style.display = 'block';
    progressWrap.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  progressWrap.style.display = 'block';

  const done = tasks.filter((t) => rec.daily[t]).length;
  document.getElementById('dailyProgressText').textContent = `${done} / ${tasks.length}`;
  document.getElementById('dailyProgressFill').style.width = `${Math.round((done / tasks.length) * 100)}%`;

  tasks.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = 'task-item' + (rec.daily[task] ? ' done' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!rec.daily[task];
    cb.addEventListener('change', () => {
      rec.daily[task] = cb.checked;
      saveTodayRecord(rec);
      renderAll();
    });

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = task;
    span.title = '클릭해서 수정';
    span.addEventListener('click', () => startTextEdit(span, task, (nextText) => {
      const updated = getDailyTasks();
      if (updated.includes(nextText) && updated[idx] !== nextText) {
        alert('이미 있는 항목이에요!');
        return;
      }
      const wasDone = rec.daily[task];
      delete rec.daily[task];
      rec.daily[nextText] = wasDone;
      updated[idx] = nextText;
      saveDailyTasks(updated);
      saveTodayRecord(rec);
      renderAll();
    }));

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.title = '목록에서 제거';
    del.textContent = '×';
    del.addEventListener('click', () => {
      if (!confirm(`"${task}" 항목을 매일 할 목록에서 삭제할까요?`)) return;
      const updated = getDailyTasks();
      updated.splice(idx, 1);
      saveDailyTasks(updated);
      renderAll();
    });

    li.append(cb, span, del);
    list.appendChild(li);
  });
}

export function initDaily(onRenderAll) {
  renderAll = onRenderAll;

  initModalForm({
    modalId: 'dailyModal',
    inputId: 'dailyInput',
    openButtonId: 'addDailyBtn',
    cancelButtonId: 'dailyCancelBtn',
    confirmButtonId: 'dailyConfirmBtn',
    onConfirm: confirmDaily
  });
}
