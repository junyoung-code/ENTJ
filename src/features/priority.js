import { openModal } from '../utils/dom.js';
import { getTodayRecord, saveTodayRecord } from '../storage/storage.js';

let renderAll = () => {};

function normalizePriorities(rec) {
  let changed = false;
  rec.todos.forEach((todo, idx) => {
    const priority = idx + 1;
    if (todo.priority !== priority) {
      todo.priority = priority;
      changed = true;
    }
  });
  return changed;
}

function moveTodo(from, to) {
  const rec = getTodayRecord();
  if (to < 0 || to >= rec.todos.length) return;

  const [todo] = rec.todos.splice(from, 1);
  rec.todos.splice(to, 0, todo);
  normalizePriorities(rec);
  saveTodayRecord(rec);
  renderAll();
}

function makeMoveButton(label, title, disabled, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'priority-move-btn';
  btn.textContent = label;
  btn.title = title;
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

export function renderPriority() {
  const rec = getTodayRecord();
  if (normalizePriorities(rec)) saveTodayRecord(rec);

  const list = document.getElementById('priorityList');
  const empty = document.getElementById('priorityEmpty');
  list.innerHTML = '';

  if (rec.todos.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  rec.todos.forEach((todo, idx) => {
    const li = document.createElement('li');
    li.className = 'task-item priority-item' + (todo.done ? ' done' : '');

    const rank = document.createElement('span');
    rank.className = 'priority-rank';
    rank.textContent = String(idx + 1);

    const controls = document.createElement('div');
    controls.className = 'priority-controls';
    controls.append(
      makeMoveButton('↑', '우선순위 올리기', idx === 0, () => moveTodo(idx, idx - 1)),
      makeMoveButton('↓', '우선순위 내리기', idx === rec.todos.length - 1, () => moveTodo(idx, idx + 1))
    );

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!todo.done;
    cb.addEventListener('change', () => {
      rec.todos[idx].done = cb.checked;
      saveTodayRecord(rec);
      renderAll();
    });

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = todo.text;

    li.append(rank, cb, span, controls);
    list.appendChild(li);
  });
}

export function initPriority(onRenderAll) {
  renderAll = onRenderAll;

  document.getElementById('addPriorityTodoBtn').addEventListener('click', () => {
    document.getElementById('todoInput').value = '';
    openModal('todoModal', 'todoInput');
  });
}
