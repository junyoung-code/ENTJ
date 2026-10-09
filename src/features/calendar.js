import { formatDateLabel, todayKey } from '../utils/date.js';
import { getRecordByDate, getRecords } from '../storage/storage.js';
import { checklistRate } from '../storage/checklists.js';
import { renderChecklistRecord } from './checklistRecord.js';

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
  return checklistRate(getRecords()[key]);
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
  if (todos.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'no-records';
    empty.style.padding = '20px 0';
    empty.textContent = '이 날의 To Do / Priority 기록이 없어요';
    panel.appendChild(empty);
    return;
  }

  const title = document.createElement('div');
  title.className = 'record-section-title';
  title.textContent = 'To Do / Priority';
  panel.appendChild(title);
  renderChecklistRecord(panel, todos);
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
    const isToday = key === tk;
    const isSelected = key === selectedKey;

    const cell = document.createElement('div');
    cell.className = 'cal-day';

    if (rate === null) {
      cell.classList.add('no-record');
    } else {
      cell.classList.add('has-record');
      if (rate.pct === 0) cell.classList.add('rate-0');
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

    if (rate !== null) {
      cell.addEventListener('click', () => {
        selectedKey = key;
        renderCalendar();
      });
    }

    grid.appendChild(cell);
  }

  if (!selectedKey) document.getElementById('dayDetail').style.display = 'none';
  else showDayDetail(selectedKey);
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
