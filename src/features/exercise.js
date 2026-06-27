import { closeModal, openModal, startTextEdit } from '../utils/dom.js';
import {
  formatExerciseDuration as formatDuration,
  initExerciseTimePicker,
  makeTimePickerTrigger,
  normalizeDuration
} from './exerciseTimePicker.js';
import { getTodayExercise, saveTodayExercise } from '../storage/storage.js';

const exerciseTemplates = {
  strength: {
    label: '헬스',
    addButtonText: '+ reps 추가하기'
  },
  running: {
    label: '러닝',
    addButtonText: '+ 기록 추가'
  },
  cycling: {
    label: '자전거',
    addButtonText: '+ 기록 추가'
  },
  custom: {
    label: '기타',
    addButtonText: '+ 기록 추가하기'
  }
};

let activeExerciseType = 'strength';
let customModePickerRecordId = null;

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNumberUnit(value, unit) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}${unit}` : trimmed;
}

function sanitizeText(value) {
  return value.trim();
}

function getExerciseTemplate(type) {
  return exerciseTemplates[type] || exerciseTemplates.strength;
}

function getDefaultExerciseName(type) {
  if (type === 'running') return '러닝';
  if (type === 'cycling') return '자전거';
  return '';
}

function requiresExerciseName(type) {
  return type === 'strength' || type === 'custom';
}

function createEmptyStrengthRecord() {
  return { id: createId('strength-record'), weight: '', count: '', reps: '', done: false };
}

function createEmptyDistanceRecord() {
  return {
    id: createId('distance-record'),
    distanceKm: '',
    duration: { hours: 0, minutes: 0, seconds: 0 },
    paceKmh: '',
    done: false
  };
}

function createEmptyCustomTextRecord() {
  return { id: createId('custom-text-record'), mode: 'text', text: '', done: false };
}

function createEmptyCustomThreeBlankRecord() {
  return { id: createId('custom-three-blank-record'), mode: 'three_blank', values: ['', '', ''], done: false };
}

function createExerciseByType(type, name) {
  return {
    id: createId('exercise'),
    type,
    name,
    done: false,
    records: []
  };
}

function getExerciseRecordsList(record) {
  if (Array.isArray(record.records)) return record.records;

  const type = record.type || 'strength';

  if (type === 'running' || type === 'cycling' || type === 'custom') {
    record.records = [];
    return record.records;
  }

  if (Array.isArray(record.sets)) {
    record.records = record.sets.map((set) => ({
      id: set.id || createId('strength-record'),
      weight: set.weight || '',
      count: set.count || set.reps || '',
      reps: set.repeat || set.repsLabel || '',
      done: !!set.done
    }));
    delete record.sets;
    return record.records;
  }

  const legacyCount = record.count || record.reps || '';
  const legacyReps = record.repeat || '';
  const hasLegacy = record.weight || legacyCount || legacyReps;
  record.records = hasLegacy
    ? [{
        id: createId('strength-record'),
        weight: record.weight || '',
        count: legacyCount,
        reps: legacyReps,
        done: !!record.done
      }]
    : [];
  delete record.weight;
  delete record.count;
  delete record.reps;
  delete record.repeat;
  return record.records;
}

function migrateExerciseRecord(record) {
  let migrated = false;

  if (!record.id) {
    record.id = createId('exercise');
    migrated = true;
  }

  if (!record.type) {
    record.type = 'strength';
    migrated = true;
  }

  const list = getExerciseRecordsList(record);
  list.forEach((entry) => {
    if (!entry.id) {
      entry.id = createId(`${record.type}-record`);
      migrated = true;
    }

    if (record.type === 'strength') {
      if (entry.count === undefined && entry.reps !== undefined && !entry.reps.includes('반복수')) {
        entry.count = entry.reps;
        migrated = true;
      }
      if (entry.reps === undefined) {
        entry.reps = entry.repeat || '';
        migrated = true;
      }
      delete entry.repeat;
    }

    if (record.type === 'running' || record.type === 'cycling') {
      const nextDuration = normalizeDuration(entry.duration);
      if (JSON.stringify(nextDuration) !== JSON.stringify(entry.duration || {})) {
        entry.duration = nextDuration;
        migrated = true;
      }
      if (typeof entry.done !== 'boolean') {
        entry.done = false;
        migrated = true;
      }
    }

    if (record.type === 'custom') {
      if (!entry.mode) {
        entry.mode = 'text';
        entry.text = entry.text || '';
        migrated = true;
      }
      if (entry.mode === 'three_blank' && !Array.isArray(entry.values)) {
        entry.values = ['', '', ''];
        migrated = true;
      }
      if (entry.mode === 'text' && typeof entry.text !== 'string') {
        entry.text = '';
        migrated = true;
      }
      if (typeof entry.done !== 'boolean') {
        entry.done = false;
        migrated = true;
      }
    }
  });

  return migrated;
}

function syncExerciseDoneFromRecords(record) {
  const entries = getExerciseRecordsList(record);
  if (entries.length === 0) return;
  record.done = entries.every((entry) => entry.done);
}

function getExerciseProgress(records) {
  return records.reduce((progress, record) => {
    const entries = getExerciseRecordsList(record);
    if (entries.length === 0) {
      progress.total += 1;
      if (record.done) progress.done += 1;
      return progress;
    }

    progress.total += entries.length;
    progress.done += entries.filter((entry) => entry.done).length;
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

function formatStrengthRecord(entry) {
  const parts = [];
  if (entry.weight) parts.push(`무게: ${entry.weight}`);
  if (entry.count) parts.push(`횟수: ${entry.count}`);
  if (entry.reps) parts.push(`반복수: ${entry.reps}`);
  return parts.join(' · ');
}

function formatDistanceRecord(entry) {
  const parts = [];
  if (entry.distanceKm) parts.push(`거리: ${entry.distanceKm}`);
  parts.push(`시간: ${formatDuration(entry.duration)}`);
  if (entry.paceKmh) parts.push(`페이스: ${entry.paceKmh}`);
  return parts.join(' · ');
}

function formatCustomRecord(entry) {
  if (entry.mode === 'three_blank') {
    return (entry.values || []).filter(Boolean).join(' · ');
  }
  return entry.text || '';
}

function getRecordTextByType(record, entry) {
  if (record.type === 'running' || record.type === 'cycling') return formatDistanceRecord(entry);
  if (record.type === 'custom') return formatCustomRecord(entry);
  return formatStrengthRecord(entry);
}

function makeTextInput(placeholder = '', maxLength = 30) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input exercise-set-input';
  input.placeholder = placeholder;
  input.maxLength = maxLength;
  return input;
}

function makeFieldWithHelper(input, helperText = '') {
  const wrapper = document.createElement('div');
  wrapper.className = 'exercise-set-field';
  wrapper.appendChild(input);
  if (helperText) {
    const helper = document.createElement('span');
    helper.className = 'exercise-set-helper';
    helper.textContent = helperText;
    wrapper.appendChild(helper);
  }
  return wrapper;
}

function bindRowKeyboard(inputs, onSubmit, onCancel) {
  inputs.forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onSubmit();
      }
      if (event.key === 'Escape') onCancel();
    });
  });
}

function startStrengthRecordAdd(list, record, onSave) {
  const row = document.createElement('div');
  row.className = 'exercise-set-edit-row';

  const weightInput = makeTextInput('무게');
  const countInput = makeTextInput('횟수');
  const repsInput = makeTextInput('반복수');

  const submit = () => {
    const weight = normalizeNumberUnit(weightInput.value, 'kg');
    const count = normalizeNumberUnit(countInput.value, '회');
    const reps = normalizeNumberUnit(repsInput.value, '회');
    if (!weight && !count && !reps) {
      row.remove();
      return;
    }
    getExerciseRecordsList(record).push({
      id: createId('strength-record'),
      weight,
      count,
      reps,
      done: false
    });
    onSave();
  };

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'exercise-set-save-btn';
  addButton.textContent = '추가';
  addButton.addEventListener('click', submit);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-btn exercise-set-delete';
  deleteButton.textContent = '×';
  deleteButton.addEventListener('click', () => row.remove());

  bindRowKeyboard([weightInput, countInput, repsInput], submit, () => row.remove());
  row.append(weightInput, countInput, repsInput, addButton, deleteButton);
  list.appendChild(row);
  weightInput.focus();
}

function startStrengthRecordEdit(item, entry, onSave) {
  const row = document.createElement('li');
  row.className = 'exercise-set-edit-row';

  const weightInput = makeTextInput('무게');
  weightInput.value = entry.weight || '';
  const countInput = makeTextInput('횟수');
  countInput.value = entry.count || '';
  const repsInput = makeTextInput('반복수');
  repsInput.value = entry.reps || '';

  let finished = false;
  const finish = (saveRecord) => {
    if (finished) return;
    finished = true;
    if (!saveRecord) {
      row.replaceWith(item);
      return;
    }

    entry.weight = normalizeNumberUnit(weightInput.value, 'kg');
    entry.count = normalizeNumberUnit(countInput.value, '회');
    entry.reps = normalizeNumberUnit(repsInput.value, '회');
    onSave();
  };

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'exercise-set-save-btn';
  saveButton.textContent = '저장';
  saveButton.addEventListener('click', () => finish(true));

  bindRowKeyboard([weightInput, countInput, repsInput], () => finish(true), () => finish(false));
  row.append(weightInput, countInput, repsInput, saveButton);
  item.replaceWith(row);
  weightInput.focus();
  weightInput.select();
}

function buildDistanceRecordRow(recordType, entry, onSubmit, onCancel, confirmLabel = '추가') {
  const row = document.createElement('div');
  row.className = 'exercise-set-edit-row exercise-distance-row';

  const distanceInput = makeTextInput('거리', 20);
  const paceInput = makeTextInput('페이스', 20);
  distanceInput.value = entry.distanceKm || '';
  paceInput.value = entry.paceKmh || '';

  const timePicker = makeTimePickerTrigger(entry.duration);
  const paceHelperText = recordType === 'running'
    ? 'km/m 기준으로 입력됩니다'
    : 'km/h 기준으로 입력됩니다';

  const submit = () => {
    const nextEntry = {
      id: entry.id || createId('distance-record'),
      distanceKm: normalizeNumberUnit(distanceInput.value, 'km'),
      duration: timePicker.getValue(),
      paceKmh: normalizeNumberUnit(paceInput.value, 'km/h'),
      done: !!entry.done
    };

    const hasContent = nextEntry.distanceKm
      || nextEntry.paceKmh
      || nextEntry.duration.hours
      || nextEntry.duration.minutes;

    if (!hasContent) {
      onCancel();
      return;
    }

    onSubmit(nextEntry);
  };

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'exercise-set-save-btn';
  addButton.textContent = confirmLabel;
  addButton.addEventListener('click', submit);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-btn exercise-set-delete';
  deleteButton.textContent = '×';
  deleteButton.addEventListener('click', onCancel);

  row.append(
    makeFieldWithHelper(distanceInput, 'km 기준으로 입력됩니다'),
    makeFieldWithHelper(paceInput, paceHelperText),
    timePicker.element,
    addButton,
    deleteButton
  );

  bindRowKeyboard([distanceInput, paceInput], submit, onCancel);

  return {
    element: row,
    focus() {
      distanceInput.focus();
    }
  };
}

function startDistanceRecordAdd(list, record, onSave) {
  const rowController = buildDistanceRecordRow(
    record.type,
    createEmptyDistanceRecord(),
    (nextEntry) => {
      getExerciseRecordsList(record).push(nextEntry);
      onSave();
    },
    () => rowController.element.remove()
  );

  list.appendChild(rowController.element);
  rowController.focus();
}

function startDistanceRecordEdit(item, entry, onSave) {
  const rowController = buildDistanceRecordRow(
    entry.type || 'running',
    entry,
    (nextEntry) => {
      entry.distanceKm = nextEntry.distanceKm;
      entry.duration = nextEntry.duration;
      entry.paceKmh = nextEntry.paceKmh;
      onSave();
    },
    () => rowController.element.replaceWith(item),
    '저장'
  );

  item.replaceWith(rowController.element);
  rowController.focus();
}

function buildCustomTextRow(entry, onSubmit, onCancel, confirmLabel = '추가') {
  const row = document.createElement('div');
  row.className = 'exercise-set-edit-row exercise-custom-text-row';

  const input = makeTextInput('세부 기록 입력', 80);
  input.value = entry.text || '';

  const submit = () => {
    const text = sanitizeText(input.value);
    if (!text) {
      onCancel();
      return;
    }
    onSubmit({
      id: entry.id || createId('custom-text-record'),
      mode: 'text',
      text,
      done: !!entry.done
    });
  };

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'exercise-set-save-btn';
  addButton.textContent = confirmLabel;
  addButton.addEventListener('click', submit);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-btn exercise-set-delete';
  deleteButton.textContent = '×';
  deleteButton.addEventListener('click', onCancel);

  bindRowKeyboard([input], submit, onCancel);
  row.append(input, addButton, deleteButton);
  return {
    element: row,
    focus() {
      input.focus();
      input.select();
    }
  };
}

function buildCustomThreeBlankRow(entry, onSubmit, onCancel, confirmLabel = '추가') {
  const row = document.createElement('div');
  row.className = 'exercise-set-edit-row exercise-custom-three-row';

  const values = Array.isArray(entry.values) ? entry.values : ['', '', ''];
  const inputs = values.map((value) => {
    const input = makeTextInput('', 40);
    input.placeholder = '';
    input.value = value || '';
    return input;
  });

  const submit = () => {
    const nextValues = inputs.map((input) => sanitizeText(input.value));
    if (nextValues.every((value) => !value)) {
      onCancel();
      return;
    }
    onSubmit({
      id: entry.id || createId('custom-three-blank-record'),
      mode: 'three_blank',
      values: nextValues,
      done: !!entry.done
    });
  };

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'exercise-set-save-btn';
  addButton.textContent = confirmLabel;
  addButton.addEventListener('click', submit);

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-btn exercise-set-delete';
  deleteButton.textContent = '×';
  deleteButton.addEventListener('click', onCancel);

  bindRowKeyboard(inputs, submit, onCancel);
  row.append(...inputs, addButton, deleteButton);
  return {
    element: row,
    focus() {
      inputs[0].focus();
    }
  };
}

function startCustomRecordAdd(list, record, mode, onSave) {
  customModePickerRecordId = null;

  if (mode === 'text') {
    const controller = buildCustomTextRow(
      createEmptyCustomTextRecord(),
      (nextEntry) => {
        getExerciseRecordsList(record).push(nextEntry);
        onSave();
      },
      () => controller.element.remove()
    );
    list.appendChild(controller.element);
    controller.focus();
    return;
  }

  const controller = buildCustomThreeBlankRow(
    createEmptyCustomThreeBlankRecord(),
    (nextEntry) => {
      getExerciseRecordsList(record).push(nextEntry);
      onSave();
    },
    () => controller.element.remove()
  );
  list.appendChild(controller.element);
  controller.focus();
}

function startCustomRecordEdit(item, entry, onSave) {
  const controller = entry.mode === 'three_blank'
    ? buildCustomThreeBlankRow(
        entry,
        (nextEntry) => {
          entry.values = nextEntry.values;
          onSave();
        },
        () => controller.element.replaceWith(item),
        '저장'
      )
    : buildCustomTextRow(
        entry,
        (nextEntry) => {
          entry.text = nextEntry.text;
          onSave();
        },
        () => controller.element.replaceWith(item),
        '저장'
      );

  item.replaceWith(controller.element);
  controller.focus();
}

function appendRecordEntries(container, record, onSave) {
  const entries = getExerciseRecordsList(record);
  const list = document.createElement('ul');
  list.className = 'exercise-set-list';

  entries.forEach((entry, entryIdx) => {
    const item = document.createElement('li');
    item.className = 'exercise-set-item' + (entry.done ? ' done' : '');

    const number = document.createElement('button');
    number.type = 'button';
    number.className = 'exercise-set-number';
    number.textContent = String(entryIdx + 1);
    number.title = entry.done ? '기록 완료 해제' : '기록 완료';
    number.addEventListener('click', () => {
      entries[entryIdx].done = !entries[entryIdx].done;
      syncExerciseDoneFromRecords(record);
      onSave();
    });

    const text = document.createElement('span');
    text.className = 'exercise-set-text';
    text.textContent = getRecordTextByType(record, entry);
    text.title = '클릭해서 수정';
    text.addEventListener('click', () => {
      if (record.type === 'running' || record.type === 'cycling') {
        startDistanceRecordEdit(item, { ...entry, type: record.type }, onSave);
        return;
      }
      if (record.type === 'custom') {
        startCustomRecordEdit(item, entry, onSave);
        return;
      }
      startStrengthRecordEdit(item, entry, onSave);
    });

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn exercise-set-delete';
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => {
      entries.splice(entryIdx, 1);
      syncExerciseDoneFromRecords(record);
      onSave();
    });

    item.append(number, text, deleteButton);
    list.appendChild(item);
  });

  container.appendChild(list);
  return list;
}

function appendCustomModeChooser(container, record, onSave) {
  if (customModePickerRecordId !== record.id) return;

  const chooser = document.createElement('div');
  chooser.className = 'exercise-custom-mode-picker';

  const basicButton = document.createElement('button');
  basicButton.type = 'button';
  basicButton.className = 'exercise-custom-mode-btn';
  basicButton.textContent = '기본 추가';
  basicButton.addEventListener('click', () => {
    const list = container.querySelector('.exercise-set-list');
    startCustomRecordAdd(list, record, 'text', onSave);
  });

  const threeBlankButton = document.createElement('button');
  threeBlankButton.type = 'button';
  threeBlankButton.className = 'exercise-custom-mode-btn';
  threeBlankButton.textContent = '3블랭크 추가';
  threeBlankButton.addEventListener('click', () => {
    const list = container.querySelector('.exercise-set-list');
    startCustomRecordAdd(list, record, 'three_blank', onSave);
  });

  chooser.append(basicButton, threeBlankButton);
  container.appendChild(chooser);
}

function handleAddRecord(detailList, record, onSave) {
  if (record.type === 'running' || record.type === 'cycling') {
    startDistanceRecordAdd(detailList, record, onSave);
    return;
  }

  if (record.type === 'custom') {
    customModePickerRecordId = customModePickerRecordId === record.id ? null : record.id;
    renderExercise();
    return;
  }

  startStrengthRecordAdd(detailList, record, onSave);
}

function setActiveExerciseType(nextType) {
  activeExerciseType = nextType;
  document.querySelectorAll('[data-exercise-type-option]').forEach((button) => {
    button.classList.toggle('active', button.dataset.exerciseTypeOption === nextType);
  });
  updateExerciseNameVisibility();
}

function updateExerciseNameVisibility() {
  const nameInput = document.getElementById('exerciseNameInput');
  const shouldShow = requiresExerciseName(activeExerciseType);
  nameInput.classList.toggle('hidden', !shouldShow);
  nameInput.disabled = !shouldShow;
  if (!shouldShow) {
    nameInput.value = getDefaultExerciseName(activeExerciseType);
    return;
  }
  if (nameInput.value === '러닝' || nameInput.value === '자전거') {
    nameInput.value = '';
  }
}

function confirmExercise() {
  const nameInput = document.getElementById('exerciseNameInput');
  const name = requiresExerciseName(activeExerciseType)
    ? nameInput.value.trim()
    : getDefaultExerciseName(activeExerciseType);
  if (!name) return;

  const records = getTodayExercise();
  records.push(createExerciseByType(activeExerciseType, name));
  saveTodayExercise(records);
  nameInput.value = '';
  setActiveExerciseType('strength');
  closeModal('exerciseModal');
  renderExercise();
}

export function renderExercise() {
  const records = getTodayExercise();
  const list = document.getElementById('exerciseList');
  const empty = document.getElementById('exerciseEmpty');
  let migrated = false;

  list.innerHTML = '';
  records.forEach((record) => {
    migrated = migrateExerciseRecord(record) || migrated;
  });
  renderExerciseProgress(records);

  if (records.length === 0) {
    empty.style.display = 'block';
    if (migrated) saveTodayExercise(records);
    return;
  }

  empty.style.display = 'none';

  records.forEach((record, idx) => {
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
      const nextDone = !record.done;
      record.done = nextDone;
      getExerciseRecordsList(record).forEach((entry) => {
        entry.done = nextDone;
      });
      saveTodayExercise(records);
      renderExercise();
    });

    const name = document.createElement('span');
    name.className = 'exercise-name';
    name.textContent = record.name;
    name.title = '운동 이름 수정';
    name.addEventListener('click', () => {
      startTextEdit(name, record.name, (nextText) => {
        record.name = nextText;
        saveTodayExercise(records);
        renderExercise();
      }, 50);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'exercise-set-add-btn';
    addButton.textContent = getExerciseTemplate(record.type).addButtonText;

    const details = document.createElement('div');
    details.className = 'exercise-detail-wrap';
    const detailList = appendRecordEntries(details, record, () => {
      saveTodayExercise(records);
      renderExercise();
    });
    appendCustomModeChooser(details, record, () => {
      saveTodayExercise(records);
      renderExercise();
    });

    addButton.addEventListener('click', () => handleAddRecord(detailList, record, () => {
      saveTodayExercise(records);
      renderExercise();
    }));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = '×';
    deleteButton.addEventListener('click', () => {
      const nextRecords = records.filter((entry) => entry.id !== record.id);
      if (customModePickerRecordId === record.id) customModePickerRecordId = null;
      saveTodayExercise(nextRecords);
      renderExercise();
    });

    row.append(rank, name, addButton, deleteButton);
    item.append(row, details);
    list.appendChild(item);
  });

  if (migrated) saveTodayExercise(records);
}

export function initExercise() {
  const modal = document.getElementById('exerciseModal');
  const nameInput = document.getElementById('exerciseNameInput');
  const typeInput = document.getElementById('exerciseTypeInput');

  document.querySelectorAll('[data-exercise-type-option]').forEach((button) => {
    button.addEventListener('click', () => {
      setActiveExerciseType(button.dataset.exerciseTypeOption);
      typeInput.value = button.dataset.exerciseTypeOption;
    });
  });

  document.getElementById('addExerciseBtn').addEventListener('click', () => {
    nameInput.value = '';
    setActiveExerciseType('strength');
    typeInput.value = 'strength';
    openModal('exerciseModal', 'exerciseNameInput');
  });

  document.getElementById('exerciseCancelBtn').addEventListener('click', () => closeModal('exerciseModal'));
  document.getElementById('exerciseConfirmBtn').addEventListener('click', confirmExercise);

  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal('exerciseModal');
  });

  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      confirmExercise();
    }
  });

  setActiveExerciseType('strength');
  typeInput.value = 'strength';
  initExerciseTimePicker();
}
