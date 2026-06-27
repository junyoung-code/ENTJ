import { formatDateLabel, todayKey } from '../utils/date.js';
import {
  getDailyTasks,
  getExerciseByDate,
  getExerciseRecords,
  getRecordByDate,
  getRecords,
  getStudyByDate,
  getStudySessions,
  saveExerciseByDate,
  saveRecordByDate,
  saveStudyByDate
} from '../storage/storage.js';
import { startTextEdit } from '../utils/dom.js';
import { makeTimePickerTrigger, normalizeDuration } from './exerciseTimePicker.js';
import { fmtDuration } from './study.js';

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedKey = null;

const DEFAULTS = {
  midThreshold: 50,
  colors: {
    rate0: { bg: '#fee2e2', text: '#dc2626' },
    rateLow: { bg: '#eef2ff', text: '#4f46e5' },
    rateMid: { bg: '#d1fae5', text: '#065f46' },
    rate100: { bg: '#10b981', text: '#ffffff' }
  }
};

const PALETTE = [
  { bg: '#fee2e2', text: '#dc2626' }, { bg: '#ffedd5', text: '#c2410c' },
  { bg: '#fef3c7', text: '#b45309' }, { bg: '#fef9c3', text: '#a16207' },
  { bg: '#ecfccb', text: '#4d7c0f' }, { bg: '#d1fae5', text: '#065f46' },
  { bg: '#ccfbf1', text: '#0f766e' }, { bg: '#cffafe', text: '#0e7490' },
  { bg: '#dbeafe', text: '#1d4ed8' }, { bg: '#e0e7ff', text: '#4338ca' },
  { bg: '#f3e8ff', text: '#7e22ce' }, { bg: '#fce7f3', text: '#be185d' },
  { bg: '#f3f4f6', text: '#374151' }, { bg: '#e5e7eb', text: '#1f2937' },
  { bg: '#ef4444', text: '#ffffff' }, { bg: '#f59e0b', text: '#ffffff' },
  { bg: '#10b981', text: '#ffffff' }, { bg: '#0ea5e9', text: '#ffffff' },
  { bg: '#6366f1', text: '#ffffff' }, { bg: '#1a1a2e', text: '#ffffff' }
];

const TIER_KEYS = ['rate0', 'rateLow', 'rateMid', 'rate100'];

function normalizeColor(c, fallback) {
  if (typeof c === 'string') return { bg: c, text: fallback.text };
  if (c && c.bg) return { bg: c.bg, text: c.text || fallback.text };
  return { ...fallback };
}

function getCalSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('calColorSettings') || 'null');
    if (!s) return structuredClone(DEFAULTS);
    const colors = {};
    TIER_KEYS.forEach((k) => {
      colors[k] = normalizeColor(s.colors?.[k], DEFAULTS.colors[k]);
    });
    return { midThreshold: s.midThreshold ?? DEFAULTS.midThreshold, colors };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

function saveCalSettings(s) {
  localStorage.setItem('calColorSettings', JSON.stringify(s));
}

function applyCalSettings(s) {
  const root = document.documentElement;
  const { rate0, rateLow, rateMid, rate100 } = s.colors;
  root.style.setProperty('--cal-bg-0', rate0.bg);
  root.style.setProperty('--cal-bg-low', rateLow.bg);
  root.style.setProperty('--cal-bg-mid', rateMid.bg);
  root.style.setProperty('--cal-bg-100', rate100.bg);
  root.style.setProperty('--cal-text-0', rate0.text);
  root.style.setProperty('--cal-text-low', rateLow.text);
  root.style.setProperty('--cal-text-mid', rateMid.text);
  root.style.setProperty('--cal-text-100', rate100.text);

  const t = s.midThreshold;
  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  setText('legend-low-label', `1-${t - 1}%`);
  setText('legend-mid-label', `${t}-99%`);
  setText('rangeLowTag', `낮음 1-${t - 1}%`);
  setText('rangeMidTag', `중간 ${t}-99%`);

  const dotMap = { 'legend-0': rate0, 'legend-low': rateLow, 'legend-mid': rateMid, 'legend-100': rate100 };
  Object.entries(dotMap).forEach(([id, c]) => {
    const dot = document.querySelector(`#${id} .legend-dot`);
    if (dot) dot.style.background = c.bg;
  });

  TIER_KEYS.forEach((k) => {
    const chip = document.querySelector(`[data-tier="${k}"] .cal-color-chip`);
    if (chip) {
      chip.style.background = s.colors[k].bg;
      chip.style.color = s.colors[k].text;
    }
  });
}

function getRate(key) {
  const records = getRecords();
  const rec = records[key];
  if (!rec) return null;

  const todos = rec.todos || [];
  const dailyTasks = getDailyTasks();
  const total = todos.length + dailyTasks.length;
  if (total === 0) return null;

  const done = todos.filter((t) => t.done).length
    + dailyTasks.filter((t) => rec.daily && rec.daily[t]).length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

function formatDuration(duration) {
  const { hours, minutes, seconds } = normalizeDuration(duration);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatStudySeconds(totalSec) {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return formatDuration({ hours, minutes, seconds });
}

function parseDurationText(value) {
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) return null;
  return { hours, minutes, seconds };
}

function normalizeNumberUnit(value, unit) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}${unit}` : trimmed;
}

function sanitizeText(value) {
  return value.trim();
}

function getExerciseRecordsList(exercise) {
  if (Array.isArray(exercise.records)) return exercise.records;
  if (Array.isArray(exercise.sets)) {
    exercise.records = exercise.sets.map((set) => ({
      id: set.id || `legacy-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      weight: set.weight || '',
      count: set.count || set.reps || '',
      reps: set.repeat || '',
      done: !!set.done
    }));
    delete exercise.sets;
    return exercise.records;
  }

  const count = exercise.count || exercise.reps || '';
  exercise.records = exercise.weight || count || exercise.repeat
    ? [{
        id: `legacy-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        weight: exercise.weight || '',
        count,
        reps: exercise.repeat || '',
        done: !!exercise.done
      }]
    : [];
  delete exercise.weight;
  delete exercise.count;
  delete exercise.reps;
  delete exercise.repeat;
  return exercise.records;
}

function syncExerciseDoneFromRecords(exercise) {
  const entries = getExerciseRecordsList(exercise);
  exercise.done = entries.length > 0 && entries.every((entry) => entry.done);
}

function getExerciseRecordText(exercise, entry) {
  if (exercise.type === 'running' || exercise.type === 'cycling') {
    const parts = [];
    if (entry.distanceKm) parts.push(`거리: ${entry.distanceKm}`);
    parts.push(`시간: ${formatDuration(entry.duration)}`);
    if (entry.paceKmh) parts.push(`페이스: ${entry.paceKmh}`);
    return parts.join(' · ');
  }

  if (exercise.type === 'custom') {
    if (entry.mode === 'three_blank') return (entry.values || []).filter(Boolean).join(' · ');
    return entry.text || '';
  }

  const parts = [];
  if (entry.weight) parts.push(`무게: ${entry.weight}`);
  if (entry.count) parts.push(`횟수: ${entry.count}`);
  if (entry.reps) parts.push(`반복수: ${entry.reps}`);
  return parts.join(' · ');
}

function hasDetailRecord(key) {
  return getRate(key) !== null
    || (getStudySessions()[key] || []).length > 0
    || (getExerciseRecords()[key] || []).length > 0;
}

function makeActionButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function makeRecordRow(done = false) {
  const row = document.createElement('div');
  row.className = 'record-item' + (done ? ' done-item' : '');
  return row;
}

function makeToggleDot(done, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `record-toggle-btn ${done ? 'done' : 'undone'}`;
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

function makeEditableText(text, title, onSave, maxLength = 80) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'record-text-btn';
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', () => {
    const label = document.createElement('span');
    label.className = 'record-text-inline';
    label.textContent = text;
    button.replaceWith(label);
    startTextEdit(label, text, onSave, maxLength);
  });
  return button;
}

function createInlineTextInput(value, placeholder = '', maxLength = 30) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input record-inline-input';
  input.value = value;
  input.placeholder = placeholder;
  input.maxLength = maxLength;
  return input;
}

function bindInlineForm(root, inputs, onSubmit, onCancel) {
  let finished = false;
  let outsideListenerAttached = false;
  const removeOutsideListener = () => {
    if (!outsideListenerAttached) return;
    document.removeEventListener('pointerdown', handlePointerDownOutside, true);
    outsideListenerAttached = false;
  };
  const finalize = (handler) => {
    if (finished) return;
    finished = true;
    removeOutsideListener();
    handler();
  };
  const handlePointerDownOutside = (event) => {
    if (root.contains(event.target)) return;
    if (event.target.closest('#exerciseTimeModal.open')) return;
    finalize(onCancel);
  };

  inputs.forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finalize(onSubmit);
      }
      if (event.key === 'Escape') finalize(onCancel);
    });
  });

  root.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  setTimeout(() => {
    if (finished) return;
    outsideListenerAttached = true;
    document.addEventListener('pointerdown', handlePointerDownOutside, true);
  }, 0);

  return {
    submit() {
      finalize(onSubmit);
    },
    cancel() {
      finalize(onCancel);
    }
  };
}

function refreshSelectedDay() {
  if (!selectedKey) return;
  renderCalendar();
  showDayDetail(selectedKey);
}

function showDayDetail(key) {
  const rec = getRecordByDate(key);
  const rate = getRate(key);
  const panel = document.getElementById('dayDetail');
  panel.style.display = 'block';
  panel.innerHTML = '';

  const hdr = document.createElement('div');
  hdr.className = 'detail-header';

  const dateEl = document.createElement('div');
  dateEl.className = 'detail-date';
  dateEl.textContent = formatDateLabel(key) + (key === todayKey() ? ' · 오늘' : '');

  const badge = document.createElement('div');
  badge.className = 'detail-rate-badge';
  if (rate) {
    badge.textContent = `${rate.pct}%  (${rate.done}/${rate.total})`;
    if (rate.pct === 100) badge.classList.add('perfect');
    if (rate.pct === 0) badge.classList.add('zero');
  }

  hdr.append(dateEl, badge);
  panel.appendChild(hdr);

  if (rate) {
    const bar = document.createElement('div');
    bar.className = 'progress-wrap';
    bar.innerHTML = `<div class="progress-bar"><div class="progress-fill" style="width:${rate.pct}%"></div></div>`;
    panel.appendChild(bar);
  }

  const todos = rec.todos || [];
  const dailyTasks = getDailyTasks();
  const studyList = getStudyByDate(key);
  const exerciseList = getExerciseByDate(key);

  if (todos.length === 0 && dailyTasks.length === 0 && studyList.length === 0 && exerciseList.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'no-records';
    empty.style.padding = '20px 0';
    empty.textContent = '이 날의 기록이 없어요';
    panel.appendChild(empty);
    return;
  }

  function appendSectionTitle(title) {
    const el = document.createElement('div');
    el.className = 'record-section-title';
    el.textContent = title;
    panel.appendChild(el);
  }

  function saveRecord() {
    saveRecordByDate(key, rec);
    refreshSelectedDay();
  }

  function saveStudy() {
    saveStudyByDate(key, studyList);
    refreshSelectedDay();
  }

  function saveExercise() {
    saveExerciseByDate(key, exerciseList);
    refreshSelectedDay();
  }

  if (todos.length > 0) {
    appendSectionTitle('To Do');
    todos.forEach((todo, idx) => {
      const row = makeRecordRow(todo.done);
      const toggle = makeToggleDot(todo.done, todo.done ? '완료 해제' : '완료', () => {
        todos[idx].done = !todos[idx].done;
        saveRecord();
      });
      const text = makeEditableText(todo.text, '클릭해서 수정', (nextText) => {
        todos[idx].text = nextText;
        saveRecord();
      });
      const deleteButton = makeActionButton('×', 'delete-btn', () => {
        todos.splice(idx, 1);
        saveRecord();
      });
      row.append(toggle, text, deleteButton);
      panel.appendChild(row);
    });
  }

  if (dailyTasks.length > 0) {
    appendSectionTitle('매일 할 목록');
    dailyTasks.forEach((task) => {
      const done = !!rec.daily?.[task];
      const row = makeRecordRow(done);
      const toggle = makeToggleDot(done, done ? '완료 해제' : '완료', () => {
        rec.daily[task] = !done;
        saveRecord();
      });
      const text = document.createElement('span');
      text.className = 'record-text-inline';
      text.textContent = task;
      const resetButton = makeActionButton('초기화', 'record-action-btn', () => {
        delete rec.daily[task];
        saveRecord();
      });
      row.append(toggle, text, resetButton);
      panel.appendChild(row);
    });
  }

  if (exerciseList.length > 0) {
    appendSectionTitle('운동 기록');

    exerciseList.forEach((exercise, exerciseIdx) => {
      const row = makeRecordRow(exercise.done);
      const toggle = makeToggleDot(exercise.done, exercise.done ? '완료 해제' : '완료', () => {
        const nextDone = !exercise.done;
        exercise.done = nextDone;
        getExerciseRecordsList(exercise).forEach((entry) => {
          entry.done = nextDone;
        });
        saveExercise();
      });
      const name = makeEditableText(exercise.name, '운동 이름 수정', (nextText) => {
        exercise.name = nextText;
        saveExercise();
      }, 50);
      const deleteButton = makeActionButton('×', 'delete-btn', () => {
        exerciseList.splice(exerciseIdx, 1);
        saveExercise();
      });
      row.append(toggle, name, deleteButton);
      panel.appendChild(row);

      const records = getExerciseRecordsList(exercise);
      if (records.length === 0) return;

      const detailWrap = document.createElement('div');
      detailWrap.className = 'record-exercise-set-list';

      records.forEach((entry, entryIdx) => {
        const setRow = document.createElement('div');
        setRow.className = 'record-exercise-set' + (entry.done ? ' done-item' : '');

        const number = makeActionButton(String(entryIdx + 1), 'record-exercise-set-number record-index-btn', () => {
          records[entryIdx].done = !records[entryIdx].done;
          syncExerciseDoneFromRecords(exercise);
          saveExercise();
        });

        const text = document.createElement('button');
        text.type = 'button';
        text.className = 'record-text-btn';
        text.textContent = getExerciseRecordText(exercise, entry);
        text.title = '클릭해서 수정';
        text.addEventListener('click', () => {
          const editRow = document.createElement('div');
          editRow.className = 'exercise-set-edit-row';

          const cancel = () => {
            editRow.replaceWith(setRow);
          };

          let inputs;
          let submit;

          if (exercise.type === 'running' || exercise.type === 'cycling') {
            const distanceInput = createInlineTextInput(entry.distanceKm || '', '거리', 20);
            const durationInput = createInlineTextInput(formatDuration(entry.duration), 'HH:MM:SS', 8);
            const paceInput = createInlineTextInput(entry.paceKmh || '', '페이스', 20);
            inputs = [distanceInput, durationInput, paceInput];
            submit = () => {
              const nextDuration = parseDurationText(durationInput.value);
              if (!nextDuration) {
                durationInput.focus();
                return;
              }
              entry.distanceKm = normalizeNumberUnit(distanceInput.value, 'km');
              entry.duration = nextDuration;
              entry.paceKmh = normalizeNumberUnit(paceInput.value, 'km/h');
              saveExercise();
            };
            editRow.append(
              distanceInput,
              durationInput,
              paceInput
            );
          } else if (exercise.type === 'custom') {
            if (entry.mode === 'three_blank') {
              const values = Array.isArray(entry.values) ? entry.values : ['', '', ''];
              inputs = values.map((value) => createInlineTextInput(value || '', '', 40));
              submit = () => {
                entry.values = inputs.map((input) => sanitizeText(input.value));
                saveExercise();
              };
              editRow.append(...inputs);
            } else {
              const textInput = createInlineTextInput(entry.text || '', '세부 기록 입력', 80);
              inputs = [textInput];
              submit = () => {
                const nextText = sanitizeText(textInput.value);
                if (!nextText) {
                  textInput.focus();
                  return;
                }
                entry.text = nextText;
                saveExercise();
              };
              editRow.append(textInput);
            }
          } else {
            const weightInput = createInlineTextInput(entry.weight || '', '무게', 20);
            const countInput = createInlineTextInput(entry.count || '', '횟수', 20);
            const repsInput = createInlineTextInput(entry.reps || '', '반복수', 20);
            inputs = [weightInput, countInput, repsInput];
            submit = () => {
              entry.weight = normalizeNumberUnit(weightInput.value, 'kg');
              entry.count = normalizeNumberUnit(countInput.value, '회');
              entry.reps = normalizeNumberUnit(repsInput.value, '회');
              saveExercise();
            };
            editRow.append(weightInput, countInput, repsInput);
          }

          const saveButton = makeActionButton('저장', 'record-action-btn', submit);
          const cancelButton = makeActionButton('취소', 'record-action-btn', cancel);
          editRow.append(saveButton, cancelButton);
          bindInlineForm(editRow, inputs, submit, cancel);
          setRow.replaceWith(editRow);
          inputs[0].focus();
          inputs[0].select?.();
        });

        const deleteEntryButton = makeActionButton('×', 'delete-btn exercise-set-delete', () => {
          records.splice(entryIdx, 1);
          syncExerciseDoneFromRecords(exercise);
          saveExercise();
        });

        setRow.append(number, text, deleteEntryButton);
        detailWrap.appendChild(setRow);
      });

      panel.appendChild(detailWrap);
    });
  }

  if (studyList.length > 0) {
    appendSectionTitle('공부 기록');

    const totalSec = studyList.reduce((sum, item) => sum + item.seconds, 0);
    const totalEl = document.createElement('div');
    totalEl.className = 'record-study-total';
    totalEl.textContent = `총 ${fmtDuration(totalSec)}`;
    panel.appendChild(totalEl);

    studyList.forEach((study, idx) => {
      const row = document.createElement('div');
      row.className = 'study-record-item';

      const dot = document.createElement('span');
      dot.className = 'study-record-dot';

      const subject = makeEditableText(study.subject || '(과목 없음)', '과목 수정', (nextText) => {
        studyList[idx].subject = nextText;
        saveStudy();
      });

      const duration = makeActionButton(formatStudySeconds(study.seconds), 'study-record-dur study-record-dur-btn', () => {
        const editWrap = document.createElement('div');
        editWrap.className = 'exercise-set-edit-row study-record-time-edit';

        const currentDuration = normalizeDuration({
          hours: Math.floor(study.seconds / 3600),
          minutes: Math.floor((study.seconds % 3600) / 60),
          seconds: study.seconds % 60
        });
        const timePicker = makeTimePickerTrigger(currentDuration);
        let controller;
        const saveButton = makeActionButton('저장', 'exercise-set-save-btn', () => controller.submit());
        const cancelButton = makeActionButton('×', 'delete-btn exercise-set-delete', () => controller.cancel());

        editWrap.append(timePicker.element, saveButton, cancelButton);
        controller = bindInlineForm(editWrap, [], () => {
          const nextDuration = timePicker.getValue();
          studyList[idx].seconds = (nextDuration.hours * 3600) + (nextDuration.minutes * 60);
          saveStudy();
        }, () => {
          editWrap.replaceWith(duration);
        });
        duration.replaceWith(editWrap);
        timePicker.focus();
      });

      const deleteButton = makeActionButton('×', 'delete-btn', () => {
        studyList.splice(idx, 1);
        saveStudy();
      });

      row.append(dot, subject, duration, deleteButton);
      panel.appendChild(row);
    });
  }
}

export function renderCalendar() {
  document.getElementById('calMonthLabel').textContent = `${calYear}년 ${calMonth + 1}월`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => {
    const el = document.createElement('div');
    el.className = 'cal-weekday';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const tk = todayKey();
  const midThreshold = getCalSettings().midThreshold;

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const rate = getRate(key);
    const hasDetail = hasDetailRecord(key);
    const isToday = key === tk;
    const isSelected = key === selectedKey;

    const cell = document.createElement('div');
    cell.className = 'cal-day';

    if (rate === null && !hasDetail) {
      cell.classList.add('no-record');
    } else {
      cell.classList.add('has-record');
      if (rate === null) cell.classList.add('no-record');
      else if (rate.pct === 0) cell.classList.add('rate-0');
      else if (rate.pct < midThreshold) cell.classList.add('rate-low');
      else if (rate.pct < 100) cell.classList.add('rate-mid');
      else cell.classList.add('rate-100');
    }
    if (isToday) cell.classList.add('today-cell');
    if (isSelected) cell.classList.add('selected-cell');

    const numEl = document.createElement('span');
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (rate !== null) {
      const pctEl = document.createElement('span');
      pctEl.className = 'cal-day-pct';
      pctEl.textContent = rate.pct + '%';
      cell.appendChild(pctEl);
    }

    if (hasDetail) {
      cell.addEventListener('click', () => {
        selectedKey = key;
        renderCalendar();
        showDayDetail(key);
      });
    }

    grid.appendChild(cell);
  }

  if (!selectedKey) document.getElementById('dayDetail').style.display = 'none';
}

export function initCalendar() {
  document.getElementById('calPrevBtn').addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) {
      calMonth = 11;
      calYear--;
    }
    selectedKey = null;
    renderCalendar();
  });

  document.getElementById('calNextBtn').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) {
      calMonth = 0;
      calYear++;
    }
    selectedKey = null;
    renderCalendar();
  });

  let settings = getCalSettings();
  applyCalSettings(settings);
  document.getElementById('thresholdSlider').value = settings.midThreshold;

  document.getElementById('calSettingsBtn').addEventListener('click', () => {
    document.getElementById('calSettingsPanel').classList.toggle('open');
    closePalette();
  });

  const popover = document.getElementById('calPalettePopover');
  let activeTier = null;

  function closePalette() {
    popover.classList.remove('open');
    activeTier = null;
  }

  function openPalette(tierBtn, tierKey) {
    activeTier = tierKey;
    popover.innerHTML = '';
    PALETTE.forEach((c) => {
      const sw = document.createElement('button');
      sw.className = 'cal-palette-swatch';
      sw.style.background = c.bg;
      sw.style.color = c.text;
      sw.textContent = 'A';
      if (settings.colors[tierKey].bg.toLowerCase() === c.bg.toLowerCase()) sw.classList.add('selected');
      sw.addEventListener('click', () => {
        settings.colors[tierKey] = { ...c };
        saveCalSettings(settings);
        applyCalSettings(settings);
        renderCalendar();
        closePalette();
      });
      popover.appendChild(sw);
    });

    const panel = document.getElementById('calSettingsPanel');
    const btnRect = tierBtn.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const rawLeft = btnRect.left - panelRect.left;
    const maxLeft = panel.clientWidth - 200 - 4;
    popover.style.left = `${Math.max(4, Math.min(rawLeft, maxLeft))}px`;
    popover.style.top = `${btnRect.bottom - panelRect.top + 6}px`;
    popover.classList.add('open');
  }

  document.querySelectorAll('.cal-color-tier').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tierKey = btn.dataset.tier;
      if (activeTier === tierKey) {
        closePalette();
        return;
      }
      openPalette(btn, tierKey);
    });
  });

  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && !e.target.closest('.cal-color-tier')) closePalette();
  });

  const slider = document.getElementById('thresholdSlider');
  slider.addEventListener('input', () => {
    settings.midThreshold = parseInt(slider.value, 10);
    saveCalSettings(settings);
    applyCalSettings(settings);
    renderCalendar();
  });

  document.getElementById('calSettingsReset').addEventListener('click', () => {
    settings = structuredClone(DEFAULTS);
    saveCalSettings(settings);
    slider.value = settings.midThreshold;
    applyCalSettings(settings);
    renderCalendar();
    closePalette();
  });
}
