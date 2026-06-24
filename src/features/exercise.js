import { closeModal, openModal, startTextEdit } from '../utils/dom.js';
import { getTodayExercise, saveTodayExercise } from '../storage/storage.js';

function normalizeUnit(value, unit) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}${unit}` : trimmed;
}

function getSets(record) {
  if (Array.isArray(record.sets)) return record.sets;

  const reps = record.reps || record.count || '';
  const hasLegacySet = record.weight || reps || record.repeat;
  record.sets = hasLegacySet
    ? [{ weight: record.weight || '', reps, repeat: record.repeat || '' }]
    : [];
  delete record.weight;
  delete record.reps;
  delete record.count;
  delete record.repeat;
  return record.sets;
}

function syncExerciseDoneFromSets(record) {
  const sets = getSets(record);
  if (sets.length === 0) return;
  record.done = sets.every((set) => set.done);
}

function getExerciseProgress(records) {
  return records.reduce((progress, record) => {
    const sets = getSets(record);
    if (sets.length === 0) {
      progress.total += 1;
      if (record.done) progress.done += 1;
      return progress;
    }

    progress.total += sets.length;
    progress.done += sets.filter((set) => set.done).length;
    return progress;
  }, { done: 0, total: 0 });
}

function renderExerciseProgress(records) {
  const progressWrap = document.getElementById('exerciseProgress');
  const progress = getExerciseProgress(records);

  if (progress.total === 0) {
    progressWrap.style.display = 'none';
    return;
  }

  progressWrap.style.display = 'block';
  document.getElementById('exerciseProgressText').textContent = `${progress.done} / ${progress.total}`;
  document.getElementById('exerciseProgressFill').style.width =
    `${Math.round((progress.done / progress.total) * 100)}%`;
}

function confirmExercise() {
  const nameInput = document.getElementById('exerciseNameInput');
  const name = nameInput.value.trim();
  if (!name) return;

  const records = getTodayExercise();
  records.push({ name, sets: [], done: false });
  saveTodayExercise(records);
  nameInput.value = '';
  closeModal('exerciseModal');
  renderExercise();
}

function makeSetText(set) {
  const parts = [];
  if (set.weight) parts.push(`무게: ${set.weight}`);
  if (set.reps) parts.push(`횟수: ${set.reps}`);
  if (set.repeat) parts.push(`반복수: ${set.repeat}`);
  return parts.join(' · ');
}

function makeSetInput(placeholder) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input exercise-set-input';
  input.placeholder = placeholder;
  input.maxLength = 30;
  return input;
}

function startSetAdd(list, record, onSave) {
  const row = document.createElement('div');
  row.className = 'exercise-set-edit-row';

  const weightInput = makeSetInput('무게');
  const repsInput = makeSetInput('횟수');
  const repeatInput = makeSetInput('반복수');

  const save = () => {
    const weight = normalizeUnit(weightInput.value, 'kg');
    const reps = normalizeUnit(repsInput.value, '회');
    const repeat = normalizeUnit(repeatInput.value, '회');
    if (!weight && !reps && !repeat) {
      row.remove();
      return;
    }
    getSets(record).push({ weight, reps, repeat });
    onSave();
  };

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'exercise-set-save-btn';
  add.textContent = '추가';
  add.addEventListener('click', save);

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'delete-btn exercise-set-delete';
  del.textContent = '×';
  del.addEventListener('click', () => row.remove());

  [weightInput, repsInput, repeatInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') row.remove();
    });
  });

  row.append(weightInput, repsInput, repeatInput, add, del);
  list.appendChild(row);
  weightInput.focus();
}

function startSetEdit(item, set, onSave) {
  const row = document.createElement('li');
  row.className = 'exercise-set-edit-row';

  const weightInput = makeSetInput('무게');
  weightInput.value = set.weight || '';
  const repsInput = makeSetInput('횟수');
  repsInput.value = set.reps || '';
  const repeatInput = makeSetInput('반복수');
  repeatInput.value = set.repeat || '';

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    if (!save) {
      row.replaceWith(item);
      return;
    }

    set.weight = normalizeUnit(weightInput.value, 'kg');
    set.reps = normalizeUnit(repsInput.value, '회');
    set.repeat = normalizeUnit(repeatInput.value, '회');
    onSave();
  };

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'exercise-set-save-btn';
  saveButton.textContent = '저장';
  saveButton.addEventListener('click', () => finish(true));

  [weightInput, repsInput, repeatInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
  });

  row.append(weightInput, repsInput, repeatInput, saveButton);
  item.replaceWith(row);
  weightInput.focus();
  weightInput.select();
}

function appendExerciseSets(container, record, onSave) {
  const sets = getSets(record);
  const list = document.createElement('ul');
  list.className = 'exercise-set-list';

  sets.forEach((set, setIdx) => {
    const item = document.createElement('li');
    item.className = 'exercise-set-item' + (set.done ? ' done' : '');

    const number = document.createElement('button');
    number.type = 'button';
    number.className = 'exercise-set-number';
    number.textContent = String(setIdx + 1);
    number.title = set.done ? 'reps 완료 해제' : 'reps 완료';
    number.addEventListener('click', () => {
      sets[setIdx].done = !sets[setIdx].done;
      syncExerciseDoneFromSets(record);
      onSave();
    });

    const text = document.createElement('span');
    text.className = 'exercise-set-text';
    text.textContent = makeSetText(set);
    text.title = '클릭해서 수정';
    text.addEventListener('click', () => startSetEdit(item, set, onSave));

    const del = document.createElement('button');
    del.className = 'delete-btn exercise-set-delete';
    del.textContent = '×';
    del.addEventListener('click', () => {
      sets.splice(setIdx, 1);
      onSave();
    });

    item.append(number, text, del);
    list.appendChild(item);
  });

  container.appendChild(list);
}

export function renderExercise() {
  const records = getTodayExercise();
  const list = document.getElementById('exerciseList');
  const empty = document.getElementById('exerciseEmpty');
  list.innerHTML = '';
  renderExerciseProgress(records);

  if (records.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  let migrated = false;
  records.forEach((record, idx) => {
    if (!Array.isArray(record.sets)) migrated = true;
    getSets(record);

    const item = document.createElement('li');
    item.className = 'exercise-item' + (record.done ? ' done' : '');

    const row = document.createElement('div');
    row.className = 'exercise-main-row';

    const rank = document.createElement('button');
    rank.type = 'button';
    rank.className = 'exercise-rank';
    rank.textContent = String(idx + 1);
    rank.title = record.done ? '완료 해제' : '완료';
    rank.addEventListener('click', () => {
      const nextDone = !records[idx].done;
      records[idx].done = nextDone;
      getSets(records[idx]).forEach((set) => {
        set.done = nextDone;
      });
      saveTodayExercise(records);
      renderExercise();
    });

    const name = document.createElement('span');
    name.className = 'exercise-name';
    name.textContent = record.name;
    name.title = '운동 종류 수정';
    name.addEventListener('click', () => {
      startTextEdit(name, record.name, (nextText) => {
        records[idx].name = nextText;
        saveTodayExercise(records);
        renderExercise();
      });
    });

    const details = document.createElement('div');
    details.className = 'exercise-detail-wrap';
    appendExerciseSets(details, record, () => {
      saveTodayExercise(records);
      renderExercise();
    });

    const detailList = details.querySelector('.exercise-set-list');
    const addSet = document.createElement('button');
    addSet.type = 'button';
    addSet.className = 'exercise-set-add-btn';
    addSet.textContent = '+ reps 추가하기';
    addSet.addEventListener('click', () => startSetAdd(detailList, record, () => {
      saveTodayExercise(records);
      renderExercise();
    }));

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.addEventListener('click', () => {
      records.splice(idx, 1);
      saveTodayExercise(records);
      renderExercise();
    });

    row.append(rank, name, addSet, del);
    item.append(row, details);
    list.appendChild(item);
  });

  if (migrated) saveTodayExercise(records);
}

export function initExercise() {
  const modal = document.getElementById('exerciseModal');
  const nameInput = document.getElementById('exerciseNameInput');

  document.getElementById('addExerciseBtn').addEventListener('click', () => {
    nameInput.value = '';
    openModal('exerciseModal', 'exerciseNameInput');
  });
  document.getElementById('exerciseCancelBtn').addEventListener('click', () => closeModal('exerciseModal'));
  document.getElementById('exerciseConfirmBtn').addEventListener('click', confirmExercise);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal('exerciseModal');
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirmExercise();
    }
  });
}
