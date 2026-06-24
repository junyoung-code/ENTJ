import { openModal, startTextEdit } from '../utils/dom.js';
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

function getSubPriorities(todo) {
  if (!Array.isArray(todo.subPriorities)) todo.subPriorities = [];
  return todo.subPriorities;
}

function syncTodoDoneFromSubPriorities(todo) {
  const details = getSubPriorities(todo);
  if (details.length === 0) return;
  todo.done = details.every((detail) => detail.done);
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

function makeDetailAddButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'priority-detail-add-btn';
  btn.textContent = '+ 세부 우선순위';
  return btn;
}

function startSubPriorityAdd(list, todo, onSave) {
  const details = getSubPriorities(todo);
  const row = document.createElement('div');
  row.className = 'priority-detail-edit-row';

  const label = document.createElement('span');
  label.className = 'priority-detail-number';
  label.textContent = String(list.children.length + 1);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input priority-detail-input';
  input.maxLength = 100;
  input.placeholder = '세부 우선순위 입력';

  let finished = false;
  let composing = false;
  const finish = (save) => {
    if (finished || composing) return;
    const text = input.value.trim();
    if (save && !text) return;
    finished = true;
    if (save && text) {
      details.push({ text, done: false });
      onSave();
    } else {
      row.remove();
    }
  };

  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.isComposing || composing || e.keyCode === 229) return;
      finish(true);
    }
    if (e.key === 'Escape') finish(false);
  });

  row.append(label, input);
  list.appendChild(row);
  input.focus();
}

function appendSubPriorities(container, todo, onSave) {
  const details = getSubPriorities(todo);
  const list = document.createElement('ul');
  list.className = 'priority-detail-list';

  details.forEach((detail, detailIdx) => {
    const item = document.createElement('li');
    item.className = 'priority-detail-item' + (detail.done ? ' done' : '');

    const number = document.createElement('button');
    number.type = 'button';
    number.className = 'priority-detail-number';
    number.textContent = String(detailIdx + 1);
    number.title = '세부 우선순위 완수';
    number.addEventListener('click', () => {
      details[detailIdx].done = !details[detailIdx].done;
      syncTodoDoneFromSubPriorities(todo);
      onSave();
    });

    const text = document.createElement('span');
    text.className = 'priority-detail-text';
    text.textContent = detail.text;
    text.title = '클릭해서 수정';
    text.addEventListener('click', () => startTextEdit(text, detail.text, (nextText) => {
      details[detailIdx].text = nextText;
      onSave();
    }, 100));

    const del = document.createElement('button');
    del.className = 'delete-btn priority-detail-delete';
    del.textContent = '×';
    del.addEventListener('click', () => {
      details.splice(detailIdx, 1);
      onSave();
    });

    item.append(number, text, del);
    list.appendChild(item);
  });

  container.append(list);
}

function renderPriorityProgress(rec) {
  const progressWrap = document.getElementById('priorityProgress');
  const total = rec.todos.length;

  if (total === 0) {
    progressWrap.style.display = 'none';
    return;
  }

  const done = rec.todos.filter((todo) => todo.done).length;
  progressWrap.style.display = 'block';
  document.getElementById('priorityProgressText').textContent = `${done} / ${total}`;
  document.getElementById('priorityProgressFill').style.width = `${Math.round((done / total) * 100)}%`;
}

export function renderPriority() {
  const rec = getTodayRecord();
  if (normalizePriorities(rec)) saveTodayRecord(rec);

  const list = document.getElementById('priorityList');
  const empty = document.getElementById('priorityEmpty');
  list.innerHTML = '';
  renderPriorityProgress(rec);

  if (rec.todos.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  rec.todos.forEach((todo, idx) => {
    const li = document.createElement('li');
    li.className = 'priority-item' + (todo.done ? ' done' : '');

    const row = document.createElement('div');
    row.className = 'priority-main-row';

    const rank = document.createElement('button');
    rank.type = 'button';
    rank.className = 'priority-rank';
    rank.textContent = String(idx + 1);
    rank.title = todo.done ? '완료 해제' : '완료';
    rank.addEventListener('click', () => {
      const nextDone = !rec.todos[idx].done;
      rec.todos[idx].done = nextDone;
      getSubPriorities(rec.todos[idx]).forEach((detail) => {
        detail.done = nextDone;
      });
      saveTodayRecord(rec);
      renderAll();
    });

    const controls = document.createElement('div');
    controls.className = 'priority-controls';
    controls.append(
      makeMoveButton('↑', '우선순위 올리기', idx === 0, () => moveTodo(idx, idx - 1)),
      makeMoveButton('↓', '우선순위 내리기', idx === rec.todos.length - 1, () => moveTodo(idx, idx + 1))
    );

    const details = document.createElement('div');
    details.className = 'priority-detail-wrap';
    appendSubPriorities(details, todo, () => {
      saveTodayRecord(rec);
      renderAll();
    });

    const detailList = details.querySelector('.priority-detail-list');
    const addDetail = makeDetailAddButton();
    addDetail.addEventListener('click', () => startSubPriorityAdd(detailList, todo, () => {
      saveTodayRecord(rec);
      renderAll();
    }));

    const span = document.createElement('span');
    span.className = 'task-text';
    span.textContent = todo.text;
    span.title = '클릭해서 수정';
    span.addEventListener('click', () => startTextEdit(span, todo.text, (nextText) => {
      rec.todos[idx].text = nextText;
      saveTodayRecord(rec);
      renderAll();
    }));

    row.append(rank, span, addDetail, controls);

    li.append(row, details);
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
