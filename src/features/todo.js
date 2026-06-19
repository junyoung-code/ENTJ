import { closeModal, openModal, startTextEdit } from '../utils/dom.js';
import { getDailyTasks, getTodayRecord, saveTodayRecord } from '../storage/storage.js';

let renderAll = () => {};

function normalizePriorities(rec) {
  rec.todos.forEach((todo, idx) => {
    todo.priority = idx + 1;
  });
}

function makeTodoItem(text, isDone, onToggle, onEdit, onDelete) {
  const li = document.createElement('li');
  li.className = 'task-item' + (isDone ? ' done' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = isDone;
  cb.addEventListener('change', onToggle);

  const span = document.createElement('span');
  span.className = 'task-text';
  span.textContent = text;
  span.title = '클릭해서 수정';
  span.addEventListener('click', () => startTextEdit(span, text, onEdit));

  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.textContent = '×';
  del.addEventListener('click', onDelete);

  li.append(cb, span, del);
  return li;
}

function renderDailyInTodo() {
  const tasks = getDailyTasks();
  const rec = getTodayRecord();
  const wrap = document.getElementById('dailyInTodoWrap');
  const list = document.getElementById('dailyInTodoList');
  list.innerHTML = '';

  if (tasks.length === 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';

  tasks.forEach((task) => {
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

    const tag = document.createElement('span');
    tag.className = 'tag-repeat';
    tag.textContent = '반복';

    li.append(cb, span, tag);
    list.appendChild(li);
  });
}

function renderTotalProgress() {
  const rec = getTodayRecord();
  const tasks = getDailyTasks();
  const total = rec.todos.length + tasks.length;
  const done = rec.todos.filter((t) => t.done).length + tasks.filter((t) => rec.daily[t]).length;

  const wrap = document.getElementById('todoTotalProgress');
  if (total === 0) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  document.getElementById('todoTotalText').textContent = `${done} / ${total}`;
  document.getElementById('todoTotalFill').style.width = `${Math.round((done / total) * 100)}%`;
}

function confirmTodo() {
  const input = document.getElementById('todoInput');
  const val = input.value.trim();
  if (!val) return;
  input.value = '';
  const rec = getTodayRecord();
  rec.todos.push({ text: val, done: false, priority: rec.todos.length + 1 });
  saveTodayRecord(rec);
  closeModal('todoModal');
  renderAll();
}

export function renderTodo() {
  const rec = getTodayRecord();
  const list = document.getElementById('todoList');
  const empty = document.getElementById('todoEmpty');
  list.innerHTML = '';

  if (rec.todos.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    rec.todos.forEach((todo, idx) => {
      const li = makeTodoItem(
        todo.text,
        todo.done,
        () => {
          rec.todos[idx].done = !rec.todos[idx].done;
          saveTodayRecord(rec);
          renderAll();
        },
        (nextText) => {
          rec.todos[idx].text = nextText;
          saveTodayRecord(rec);
          renderAll();
        },
        () => {
          rec.todos.splice(idx, 1);
          normalizePriorities(rec);
          saveTodayRecord(rec);
          renderAll();
        }
      );
      list.appendChild(li);
    });
  }

  renderDailyInTodo();
  renderTotalProgress();
}

export function initTodo(onRenderAll) {
  renderAll = onRenderAll;

  document.getElementById('addTodoBtn').addEventListener('click', () => {
    document.getElementById('todoInput').value = '';
    openModal('todoModal', 'todoInput');
  });
  document.getElementById('todoCancelBtn').addEventListener('click', () => closeModal('todoModal'));
  document.getElementById('todoModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('todoModal')) closeModal('todoModal');
  });
  document.getElementById('todoConfirmBtn').addEventListener('click', confirmTodo);
  document.getElementById('todoInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmTodo();
    }
  });
}
