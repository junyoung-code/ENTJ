// ── 공부 기록 유틸 ────────────────────────────────────

function fmtDuration(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}시간 ${m}분 ${s}초`;
  if (m > 0) return `${m}분 ${s}초`;
  return `${s}초`;
}

function fmtHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── 오늘 공부 기록 렌더링 ─────────────────────────────

function renderStudyLog() {
  const list     = getTodayStudy();
  const logList  = document.getElementById('studyLogList');
  const empty    = document.getElementById('studyLogEmpty');
  const totalBar = document.getElementById('studyTotalBar');
  logList.innerHTML = '';

  if (list.length === 0) {
    empty.style.display = 'block';
    totalBar.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  totalBar.style.display = 'flex';

  const totalSec = list.reduce((a, s) => a + s.seconds, 0);
  document.getElementById('studyTotalTime').textContent = fmtDuration(totalSec);

  [...list].reverse().forEach((s, revIdx) => {
    const idx = list.length - 1 - revIdx;
    const li  = document.createElement('li');
    li.className = 'study-log-item';
    li.innerHTML = `
      <div class="study-log-icon">📖</div>
      <div class="study-log-body">
        <div class="study-log-subject">${s.subject || '(과목 없음)'}</div>
        <div class="study-log-meta">${s.startTime}</div>
      </div>
      <div class="study-log-duration">${fmtDuration(s.seconds)}</div>`;

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.addEventListener('click', () => {
      const cur = getTodayStudy();
      cur.splice(idx, 1);
      saveTodayStudy(cur);
      renderStudyLog();
    });
    li.appendChild(del);
    logList.appendChild(li);
  });
}

// ── 스톱워치 ──────────────────────────────────────────
// 시작 타임스탬프 기반으로 경과 시간을 계산 →
// 백그라운드/화면 꺼짐 시 브라우저 throttle의 영향을 받지 않음.

let swBaseElapsed = 0;      // 일시정지까지 누적된 초
let swStartStamp  = null;   // 현재 구간 시작 timestamp (ms)
let swInterval    = null;
let swRunning     = false;

const swTimeEl    = document.getElementById('swTime');
const swLabelEl   = document.getElementById('swSubjectLabel');
const swStartBtn  = document.getElementById('swStartBtn');
const swStopBtn   = document.getElementById('swStopBtn');
const swResetBtn  = document.getElementById('swResetBtn');
const swSubjectIn = document.getElementById('swSubjectInput');

function swGetElapsed() {
  if (swRunning && swStartStamp !== null) {
    return swBaseElapsed + Math.floor((Date.now() - swStartStamp) / 1000);
  }
  return swBaseElapsed;
}

function swUpdateDisplay() {
  swTimeEl.textContent = fmtHMS(swGetElapsed());
}

function swStartTicking() {
  clearInterval(swInterval);
  swInterval = setInterval(swUpdateDisplay, 500);
}

// 탭이 다시 보일 때 즉시 갱신
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && swRunning) swUpdateDisplay();
});

function swReset() {
  clearInterval(swInterval);
  swRunning     = false;
  swBaseElapsed = 0;
  swStartStamp  = null;
  swUpdateDisplay();
  swSubjectIn.value    = '';
  swSubjectIn.disabled = false;
  swLabelEl.textContent = '';
  swStartBtn.textContent = '시작';
  swStartBtn.classList.remove('sw-btn-pause');
  swStartBtn.classList.add('sw-btn-start');
  swTimeEl.classList.remove('running', 'paused');
  swStopBtn.style.display  = 'none';
  swResetBtn.style.display = 'none';
}

swStartBtn.addEventListener('click', () => {
  if (!swRunning) {
    swRunning    = true;
    swStartStamp = Date.now();
    swLabelEl.textContent    = swSubjectIn.value.trim() || '';
    swSubjectIn.disabled     = true;
    swStartBtn.textContent   = '일시정지';
    swStartBtn.classList.replace('sw-btn-start', 'sw-btn-pause');
    swStopBtn.style.display  = '';
    swResetBtn.style.display = '';
    swTimeEl.classList.add('running');
    swTimeEl.classList.remove('paused');
    swStartTicking();
  } else {
    swBaseElapsed = swGetElapsed();
    swStartStamp  = null;
    clearInterval(swInterval);
    swRunning = false;
    swUpdateDisplay();
    swStartBtn.textContent = '재개';
    swStartBtn.classList.replace('sw-btn-pause', 'sw-btn-start');
    swTimeEl.classList.remove('running');
    swTimeEl.classList.add('paused');
  }
});

swStopBtn.addEventListener('click', () => {
  const elapsed = swGetElapsed();
  if (elapsed === 0) return;
  clearInterval(swInterval);
  swRunning = false;

  const subject  = swSubjectIn.value.trim();
  const now      = new Date();
  const startTime = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')} 종료`;

  const cur = getTodayStudy();
  cur.push({ subject, seconds: elapsed, startTime });
  saveTodayStudy(cur);
  renderStudyLog();
  swReset();
});

swResetBtn.addEventListener('click', swReset);
