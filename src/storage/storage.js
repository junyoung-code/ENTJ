import { todayKey } from '../utils/date.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

const DATA_KEYS = [
  'dailyTasks',
  'records',
  'goals',
  'ideas',
  'motto',
  'studySessions',
  'tabPrefs',
  'customTabs',
  'exerciseRecords'
];
const EMPTY_DATA = {
  dailyTasks: [],
  records: {},
  goals: [],
  ideas: [],
  motto: '',
  studySessions: {},
  tabPrefs: null,
  customTabs: [],
  exerciseRecords: {}
};

let activeUserId = null;
let syncTimer = null;
let syncQueue = Promise.resolve();

function load(key, def) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? def;
  } catch {
    return def;
  }
}

function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
  scheduleCloudSync();
}

function getSnapshot() {
  const snapshot = {};
  DATA_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    snapshot[key] = value === null ? EMPTY_DATA[key] : JSON.parse(value);
  });
  return snapshot;
}

function applySnapshot(snapshot) {
  DATA_KEYS.forEach((key) => {
    const value = snapshot[key] === undefined ? EMPTY_DATA[key] : snapshot[key];
    localStorage.setItem(key, JSON.stringify(value));
  });
}

function scheduleCloudSync() {
  if (!activeUserId) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(flushCloudSync, 300);
}

export async function connectCloudStorage(userId) {
  clearTimeout(syncTimer);
  activeUserId = userId;

  try {
    const userDoc = doc(db, 'users', userId);
    const result = await getDoc(userDoc);

    if (result.exists()) {
      applySnapshot(result.data());
    } else {
      applySnapshot(EMPTY_DATA);
      await setDoc(userDoc, getSnapshot());
    }
  } catch (err) {
    activeUserId = null;
    throw err;
  }
}

export function disconnectCloudStorage() {
  clearTimeout(syncTimer);
  activeUserId = null;
}

export function flushCloudSync() {
  clearTimeout(syncTimer);
  if (!activeUserId) return Promise.resolve();

  const userId = activeUserId;
  const snapshot = getSnapshot();
  syncQueue = syncQueue
    .catch(() => {})
    .then(() => setDoc(doc(db, 'users', userId), snapshot))
    .catch((err) => {
      console.error('[storage] Firestore save failed.', err);
    });
  return syncQueue;
}

export function getDailyTasks() { return load('dailyTasks', []); }
export function saveDailyTasks(v) { save('dailyTasks', v); }

export function getRecords() { return load('records', {}); }
export function saveRecords(v) { save('records', v); }

export function getGoals() { return load('goals', []); }
export function saveGoals(v) { save('goals', v); }

export function getIdeas() { return load('ideas', []); }
export function saveIdeas(v) { save('ideas', v); }

export function getMotto() { return load('motto', ''); }
export function saveMotto(v) { save('motto', v); }

export function getStudySessions() { return load('studySessions', {}); }
export function saveStudySessions(v) { save('studySessions', v); }

export function getTabPrefs() { return load('tabPrefs', null); }
export function saveTabPrefs(v) { save('tabPrefs', v); }

export function getCustomTabs() { return load('customTabs', []); }
export function saveCustomTabs(v) { save('customTabs', v); }

export function getExerciseRecords() { return load('exerciseRecords', {}); }
export function saveExerciseRecords(v) { save('exerciseRecords', v); }

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

export function getTodayExercise() {
  const all = getExerciseRecords();
  const key = todayKey();
  if (!all[key]) all[key] = [];
  return all[key];
}

export function saveTodayExercise(list) {
  const all = getExerciseRecords();
  all[todayKey()] = list;
  saveExerciseRecords(all);
}
