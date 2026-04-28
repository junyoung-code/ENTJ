// ── 날짜 표시 ─────────────────────────────────────────

function setDateDisplay() {
  const d   = new Date();
  const day = DAY_KR[d.getDay()];
  document.getElementById('dateDisplay').innerHTML =
    `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 <span>${day}요일</span>`;
}

// ── 모달 헬퍼 ─────────────────────────────────────────

function openModal(id, inputId) {
  document.getElementById(id).classList.add('open');
  setTimeout(() => document.getElementById(inputId).focus(), 50);
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ── 전체 렌더링 ───────────────────────────────────────

function renderAll() {
  renderTodo();
  renderDaily();
}

// ── 탭 전환 ───────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'records') renderCalendar();
  });
});

// ── 날짜 변경 감지 ────────────────────────────────────
// 앱을 열어둔 채로 자정이 지나면 체크 상태를 새 날짜 기준으로 리셋한다.

let _currentDay = todayKey();

setInterval(() => {
  const newDay = todayKey();
  if (newDay !== _currentDay) {
    _currentDay = newDay;
    setDateDisplay();
    renderAll();
    renderStudyLog();
  }
}, 30000); // 30초마다 날짜 변경 확인

// ── 초기화 ────────────────────────────────────────────
// data.json 먼저 불러온 뒤 렌더링 (file:// 방식이면 스킵)

loadFromFile().finally(() => {
  setDateDisplay();
  renderMotto();
  renderAll();
  renderGoals();
  renderStudyLog();
});
