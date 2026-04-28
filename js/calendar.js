// ── 캘린더 상태 ──────────────────────────────────────
let calYear    = new Date().getFullYear();
let calMonth   = new Date().getMonth();
let selectedKey = null;

// 날짜 키의 완성률 계산 (항목이 0개면 null)
function getRate(key) {
  const records = getRecords();
  const rec = records[key];
  if (!rec) return null;

  const todos      = rec.todos || [];
  const dailyTasks = getDailyTasks();
  const total      = todos.length + dailyTasks.length;
  if (total === 0) return null;

  const done = todos.filter(t => t.done).length
             + dailyTasks.filter(t => rec.daily && rec.daily[t]).length;
  return { done, total, pct: Math.round(done / total * 100) };
}

// ── 캘린더 렌더링 ─────────────────────────────────────
function renderCalendar() {
  document.getElementById('calMonthLabel').textContent = `${calYear}년 ${calMonth + 1}월`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  ['일','월','화','수','목','금','토'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-weekday';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const tk          = todayKey();

  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key        = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const rate       = getRate(key);
    const isToday    = key === tk;
    const isSelected = key === selectedKey;

    const cell = document.createElement('div');
    cell.className = 'cal-day';

    if (rate === null) {
      cell.classList.add('no-record');
    } else {
      cell.classList.add('has-record');
      if (rate.pct === 0)      cell.classList.add('rate-0');
      else if (rate.pct < 50)  cell.classList.add('rate-low');
      else if (rate.pct < 100) cell.classList.add('rate-mid');
      else                     cell.classList.add('rate-100');
    }
    if (isToday)    cell.classList.add('today-cell');
    if (isSelected) cell.classList.add('selected-cell');

    const numEl = document.createElement('span');
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (rate !== null) {
      const pctEl = document.createElement('span');
      pctEl.className = 'cal-day-pct';
      pctEl.textContent = rate.pct + '%';
      cell.appendChild(pctEl);

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

// ── 날짜 상세 패널 ────────────────────────────────────
function showDayDetail(key) {
  const records = getRecords();
  const rec     = records[key];
  const rate    = getRate(key);
  const panel   = document.getElementById('dayDetail');
  panel.style.display = 'block';
  panel.innerHTML = '';

  // 헤더
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
    if (rate.pct === 0)   badge.classList.add('zero');
  }

  hdr.append(dateEl, badge);
  panel.appendChild(hdr);

  if (rate) {
    const bar = document.createElement('div');
    bar.className = 'progress-wrap';
    bar.innerHTML = `<div class="progress-bar"><div class="progress-fill" style="width:${rate.pct}%"></div></div>`;
    panel.appendChild(bar);
  }

  const todos      = rec?.todos || [];
  const dailyTasks = getDailyTasks();

  if (todos.length === 0 && dailyTasks.length === 0) {
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

  makeSection('To Do', todos.map(t => ({ text: t.text, done: t.done })));
  makeSection('매일 할 목록', dailyTasks.map(t => ({ text: t, done: !!(rec?.daily?.[t]) })));

  // 공부 기록
  const studyList = (getStudySessions())[key] || [];
  if (studyList.length > 0) {
    const st = document.createElement('div');
    st.className = 'record-section-title';
    st.textContent = '공부 기록';
    panel.appendChild(st);

    const totalSec = studyList.reduce((a, s) => a + s.seconds, 0);
    const totalEl  = document.createElement('div');
    totalEl.style.cssText = 'font-size:12px;color:#f59e0b;font-weight:700;margin-bottom:6px;';
    totalEl.textContent = `총 ${fmtDuration(totalSec)}`;
    panel.appendChild(totalEl);

    studyList.forEach(s => {
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

// ── 월 이동 버튼 ──────────────────────────────────────
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
