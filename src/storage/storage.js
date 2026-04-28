import { todayKey } from '../utils/date.js';

const FILE_KEYS = ['dailyTasks', 'records', 'goals', 'motto', 'studySessions'];

function load(key, def) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? def;
  } catch {
    return def;
  }
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
  syncToFile();
}

function getSnapshot() {
  const snapshot = {};
  FILE_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) snapshot[key] = JSON.parse(value);
  });
  return snapshot;
}

function applySnapshot(snapshot) {
  FILE_KEYS.forEach((key) => {
    if (snapshot[key] !== undefined) {
      localStorage.setItem(key, JSON.stringify(snapshot[key]));
    }
  });
}

export function syncToFile() {
  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getSnapshot())
  }).catch(() => {});
}

export async function loadFromFile() {
  try {
    const res = await fetch('/api/load');
    if (!res.ok) {
      console.info('[storage] /api/load unavailable; using browser localStorage only.');
      return;
    }
    applySnapshot(await res.json());
  } catch (err) {
    // Vite/static deployments do not have /api/load; localStorage remains the source.
    console.info('[storage] data.json was not loaded. Run `npm run local` or `python3 server.py` to load local data.json.', err);
  }
}

export function getDailyTasks() { return load('dailyTasks', []); }
export function saveDailyTasks(v) { save('dailyTasks', v); }

export function getRecords() { return load('records', {}); }
export function saveRecords(v) { save('records', v); }

export function getGoals() { return load('goals', []); }
export function saveGoals(v) { save('goals', v); }

export function getMotto() { return load('motto', ''); }
export function saveMotto(v) { save('motto', v); }

export function getStudySessions() { return load('studySessions', {}); }
export function saveStudySessions(v) { save('studySessions', v); }

export function getTodayRecord() {
  const records = getRecords();
  const key = todayKey();
  if (!records[key]) records[key] = { todos: [], daily: {} };
  return records[key];
}

export function saveTodayRecord(rec) {
  const records = getRecords();
  records[todayKey()] = rec;
  saveRecords(records);
}

export function getTodayStudy() {
  const all = getStudySessions();
  const key = todayKey();
  if (!all[key]) all[key] = [];
  return all[key];
}

export function saveTodayStudy(list) {
  const all = getStudySessions();
  all[todayKey()] = list;
  saveStudySessions(all);
}
