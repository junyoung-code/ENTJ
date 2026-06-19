// ── 날짜 유틸 ──────────────────────────────────────────
const DAY_KR = ['일','월','화','수','목','금','토'];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m-1, d);
  return `${y}년 ${m}월 ${d}일 (${DAY_KR[date.getDay()]})`;
}

// ── 로컬 서버 여부 감지 ────────────────────────────────
const IS_LOCAL_SERVER = location.protocol === 'http:';

const FILE_KEYS = ['dailyTasks', 'records', 'goals', 'ideas', 'motto', 'studySessions'];

// 모든 데이터를 data.json에 저장 (서버 실행 중일 때만)
function syncToFile() {
  if (!IS_LOCAL_SERVER) return;
  const snapshot = {};
  FILE_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) snapshot[k] = JSON.parse(v);
  });
  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot)
  }).catch(() => {});
}

// 앱 시작 시 data.json → localStorage 복원 (서버 실행 중일 때만)
async function loadFromFile() {
  if (!IS_LOCAL_SERVER) return;
  try {
    const res = await fetch('/api/load');
    if (!res.ok) return;
    const snapshot = await res.json();
    FILE_KEYS.forEach(k => {
      if (snapshot[k] !== undefined) localStorage.setItem(k, JSON.stringify(snapshot[k]));
    });
  } catch (e) {}
}

// ── localStorage 헬퍼 ──────────────────────────────────
function load(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
// save() 할 때마다 파일에도 동시 반영
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
  syncToFile();
}

// ── 데이터 접근자 ──────────────────────────────────────
function getDailyTasks()      { return load('dailyTasks', []); }
function saveDailyTasks(v)    { save('dailyTasks', v); }

function getRecords()         { return load('records', {}); }
function saveRecords(v)       { save('records', v); }

function getGoals()           { return load('goals', []); }
function saveGoals(v)         { save('goals', v); }

function getIdeas()           { return load('ideas', []); }
function saveIdeas(v)         { save('ideas', v); }

function getMotto()           { return load('motto', ''); }
function saveMotto(v)         { save('motto', v); }

function getStudySessions()   { return load('studySessions', {}); }
function saveStudySessions(v) { save('studySessions', v); }

// ── 오늘 레코드 ────────────────────────────────────────
function getTodayRecord() {
  const records = getRecords();
  const key = todayKey();
  if (!records[key]) records[key] = { todos: [], daily: {} };
  return records[key];
}

function saveTodayRecord(rec) {
  const records = getRecords();
  records[todayKey()] = rec;
  saveRecords(records);
}

// ── 오늘 공부 세션 ─────────────────────────────────────
function getTodayStudy() {
  const all = getStudySessions();
  const k = todayKey();
  if (!all[k]) all[k] = [];
  return all[k];
}

function saveTodayStudy(list) {
  const all = getStudySessions();
  all[todayKey()] = list;
  saveStudySessions(all);
}
