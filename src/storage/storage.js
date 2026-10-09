import { todayKey } from '../utils/date.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { importUnfinishedItems, migrateChecklistHistory, normalizeChecklist } from './checklists.js';

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
const recordDates = new WeakMap();

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
    migrateStoredChecklists();
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
  return getRecordByDate(todayKey());
}

export function saveTodayRecord(rec) {
  saveRecordByDate(recordDates.get(rec) || todayKey(), rec);
}

export function getRecordByDate(key) {
  const records = getRecords();
  const rec = records[key] || { todos: [], daily: {}, customChecklists: [] };
  rec.todos ||= [];
  rec.daily ||= {};
  rec.customChecklists ||= [];
  normalizeChecklist(rec.todos, `todo:${key}`);
  recordDates.set(rec, key);
  return rec;
}

export function saveRecordByDate(key, rec) {
  const records = getRecords();
  normalizeChecklist(rec.todos, `todo:${key}`);
  (rec.customChecklists || []).forEach((checklist) => {
    normalizeChecklist(checklist.items, `${key}:${checklist.tabId}:${checklist.blockId}`, checklist.type === 'priority');
  });
  records[key] = rec;
  saveRecords(records);
}

export function migrateStoredChecklists(date = todayKey()) {
  const records = getRecords();
  const tabs = getCustomTabs();
  const result = migrateChecklistHistory(records, tabs, date);
  // Persist history first so a retry can recover an interrupted config cleanup.
  if (result.recordsChanged) saveRecords(records);
  if (result.tabsChanged) saveCustomTabs(tabs);
}

function findChecklistComponent(source) {
  const tab = getCustomTabs().find((item) => item.id === source.tabId);
  const component = tab?.components?.find((item) => item.id === source.blockId);
  if (!component || !['checklist', 'priority'].includes(component.type)) return null;
  return { tab, component };
}

export function getChecklistByDate(date, source = null) {
  const rec = getRecordByDate(date);
  if (!source) return rec.todos;
  const checklist = rec.customChecklists.find((item) => item.tabId === source.tabId && item.blockId === source.blockId);
  return checklist?.items || [];
}

export function saveChecklistByDate(date, source, items) {
  const rec = getRecordByDate(date);
  if (!source) {
    rec.todos = items;
  } else {
    const target = findChecklistComponent(source);
    if (!target) return false;
    let checklist = rec.customChecklists.find((item) => item.tabId === source.tabId && item.blockId === source.blockId);
    if (!checklist) {
      checklist = { ...source, type: target.component.type, items: [] };
      rec.customChecklists.push(checklist);
    }
    checklist.tabTitle = target.tab.label;
    checklist.title = target.component.title;
    checklist.items = items;
  }
  saveRecordByDate(date, rec);
  return true;
}

export function getUnfinishedByDate(date, source = null, targetDate = todayKey()) {
  const existing = new Set(getChecklistByDate(targetDate, source).map((item) => item.id));
  return getChecklistByDate(date, source)
    .filter((item) => !item.done)
    .map((item) => ({ item, alreadyImported: existing.has(item.id) }));
}

export function importChecklistByDate(date, targetDate, source = null, selectedIds = null) {
  if (date >= targetDate || (source && !findChecklistComponent(source))) return 0;
  const items = getChecklistByDate(targetDate, source);
  const type = source ? findChecklistComponent(source).component.type : 'priority';
  const count = importUnfinishedItems(getChecklistByDate(date, source), items, selectedIds, type === 'priority');
  if (count) saveChecklistByDate(targetDate, source, items);
  return count;
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

export function getStudyByDate(key) {
  const all = getStudySessions();
  if (!all[key]) all[key] = [];
  return all[key];
}

export function saveStudyByDate(key, list) {
  const all = getStudySessions();
  all[key] = list;
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

export function getExerciseByDate(key) {
  const all = getExerciseRecords();
  if (!all[key]) all[key] = [];
  return all[key];
}

export function saveExerciseByDate(key, list) {
  const all = getExerciseRecords();
  all[key] = list;
  saveExerciseRecords(all);
}
