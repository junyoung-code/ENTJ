import { formatDateLabel, todayKey } from '../utils/date.js';
import { getDailyTasks, getExerciseRecords, getRecords, getStudySessions } from '../storage/storage.js';
import { fmtDuration } from './study.js';

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let selectedKey = null;

// 각 색상은 배경(bg)과 글자색(text) 한 쌍으로 관리한다.
const DEFAULTS = {
  midThreshold: 50, // 중간 구간이 시작되는 퍼센트 (낮음: 1~t-1, 중간: t~99)
  colors: {
    rate0:   { bg: '#fee2e2', text: '#dc2626' },
    rateLow: { bg: '#eef2ff', text: '#4f46e5' },
    rateMid: { bg: '#d1fae5', text: '#065f46' },
    rate100: { bg: '#10b981', text: '#ffffff' },
  },
};

// 색상 선택 팔레트 — 배경과 잘 어울리는 글자색을 함께 정의한다.
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
  { bg: '#6366f1', text: '#ffffff' }, { bg: '#1a1a2e', text: '#ffffff' },
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
  } catch { return structuredClone(DEFAULTS); }
}

function saveCalSettings(s) {
  localStorage.setItem('calColorSettings', JSON.stringify(s));
}

function applyCalSettings(s) {
  const root = document.documentElement;
  const { rate0, rateLow, rateMid, rate100 } = s.colors;
  root.style.setProperty('--cal-bg-0',   rate0.bg);
  root.style.setProperty('--cal-bg-low', rateLow.bg);
  root.style.setProperty('--cal-bg-mid', rateMid.bg);
  root.style.setProperty('--cal-bg-100', rate100.bg);
  root.style.setProperty('--cal-text-0',   rate0.text);
  root.style.setProperty('--cal-text-low', rateLow.text);
  root.style.setProperty('--cal-text-mid', rateMid.text);
  root.style.setProperty('--cal-text-100', rate100.text);

  const t = s.midThreshold;
  const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
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
    if (chip) { chip.style.background = s.colors[k].bg; chip.style.color = s.colors[k].text; }
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

function getExerciseSets(exercise) {
  if (Array.isArray(exercise.sets)) return exercise.sets;

  const reps = exercise.reps || exercise.count || '';
  return exercise.weight || reps || exercise.repeat
    ? [{ weight: exercise.weight || '', reps, repeat: exercise.repeat || '', done: exercise.done }]
    : [];
}

function getExerciseSetText(set) {
  const parts = [];
  if (set.weight) parts.push(`무게: ${set.weight}`);
  if (set.reps) parts.push(`횟수: ${set.reps}`);
  if (set.repeat) parts.push(`반복수: ${set.repeat}`);
  return parts.join(' · ');
}

function hasDetailRecord(key) {
  return getRate(key) !== null
    || (getStudySessions()[key] || []).length > 0
    || (getExerciseRecords()[key] || []).length > 0;
}

function showDayDetail(key) {
  const records = getRecords();
  const rec = records[key];
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

  const todos = rec?.todos || [];
  const dailyTasks = getDailyTasks();
  const studyList = getStudySessions()[key] || [];
  const exerciseList = getExerciseRecords()[key] || [];

  if (todos.length === 0 && dailyTasks.length === 0 && studyList.length === 0 && exerciseList.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'no-records';
    empty.style.padding = '20px 0';
    empty.textContent = '이 날의 기록이 없어요';
    panel.appendChild(empty);
    return;
  }

  function makeSection(title, items) {
    if (items.length === 0) return;
    const t = document.createElement('div');
    t.className = 'record-section-title';
    t.textContent = title;
    panel.appendChild(t);
    items.forEach(({ text, done }) => {
      const row = document.createElement('div');
      row.className = 'record-item' + (done ? ' done-item' : '');
      row.innerHTML = `<span class="dot ${done ? 'done' : 'undone'}"></span><span>${text}</span>`;
      panel.appendChild(row);
    });
  }

  function makeExerciseSection(items) {
    if (items.length === 0) return;
    const title = document.createElement('div');
    title.className = 'record-section-title';
    title.textContent = '운동 기록';
    panel.appendChild(title);

    items.forEach((exercise) => {
      const row = document.createElement('div');
      row.className = 'record-item' + (exercise.done ? ' done-item' : '');
      row.innerHTML = `<span class="dot ${exercise.done ? 'done' : 'undone'}"></span><span>${exercise.name}</span>`;
      panel.appendChild(row);

      const sets = getExerciseSets(exercise);
      if (sets.length === 0) return;

      const setList = document.createElement('div');
      setList.className = 'record-exercise-set-list';
      sets.forEach((set, idx) => {
        const setRow = document.createElement('div');
        setRow.className = 'record-exercise-set' + (set.done ? ' done-item' : '');
        setRow.innerHTML = `
          <span class="record-exercise-set-number">${idx + 1}</span>
          <span>${getExerciseSetText(set)}</span>`;
        setList.appendChild(setRow);
      });
      panel.appendChild(setList);
    });
  }

  makeSection('To Do', todos.map((t) => ({ text: t.text, done: t.done })));
  makeSection('매일 할 목록', dailyTasks.map((t) => ({ text: t, done: !!(rec?.daily?.[t]) })));
  makeExerciseSection(exerciseList);

  if (studyList.length > 0) {
    const st = document.createElement('div');
    st.className = 'record-section-title';
    st.textContent = '공부 기록';
    panel.appendChild(st);

    const totalSec = studyList.reduce((a, s) => a + s.seconds, 0);
    const totalEl = document.createElement('div');
    totalEl.style.cssText = 'font-size:12px;color:#4f46e5;font-weight:700;margin-bottom:6px;';
    totalEl.textContent = `총 ${fmtDuration(totalSec)}`;
    panel.appendChild(totalEl);

    studyList.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'study-record-item';
      row.innerHTML = `
        <span class="study-record-dot"></span>
        <span>${s.subject || '(과목 없음)'}</span>
        <span class="study-record-dur">${fmtDuration(s.seconds)}</span>`;
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
    if (calMonth < 0) { calMonth = 11; calYear--; }
    selectedKey = null;
    renderCalendar();
  });

  document.getElementById('calNextBtn').addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
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

  // ── 색상 팔레트 팝오버 ──
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
    // 클릭한 색상 버튼 바로 아래에 팝오버 배치
    const panel = document.getElementById('calSettingsPanel');
    const btnRect = tierBtn.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const rawLeft = btnRect.left - panelRect.left;
    const maxLeft = panel.clientWidth - 200 - 4; // 팝오버 너비 200px(CSS) 기준
    popover.style.left = `${Math.max(4, Math.min(rawLeft, maxLeft))}px`;
    popover.style.top = `${btnRect.bottom - panelRect.top + 6}px`;
    popover.classList.add('open');
  }

  document.querySelectorAll('.cal-color-tier').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tierKey = btn.dataset.tier;
      if (activeTier === tierKey) { closePalette(); return; }
      openPalette(btn, tierKey);
    });
  });

  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && !e.target.closest('.cal-color-tier')) closePalette();
  });

  // ── 구간 경계 슬라이더 ──
  const slider = document.getElementById('thresholdSlider');
  slider.addEventListener('input', () => {
    settings.midThreshold = parseInt(slider.value, 10);
    saveCalSettings(settings);
    applyCalSettings(settings);
    renderCalendar();
  });

  // ── 기본값 복원 ──
  document.getElementById('calSettingsReset').addEventListener('click', () => {
    settings = structuredClone(DEFAULTS);
    saveCalSettings(settings);
    slider.value = settings.midThreshold;
    applyCalSettings(settings);
    renderCalendar();
    closePalette();
  });
}
