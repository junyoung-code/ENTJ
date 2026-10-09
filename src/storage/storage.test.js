import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Run the real storage module with only the Firestore transport replaced.
const storageSource = await readFile(new URL('./storage.js', import.meta.url), 'utf8');
const RealDate = globalThis.Date;
let storage;
let moduleVersion = 0;

async function setup(snapshot = {}) {
  let clock = '2026-10-09T12:00:00+09:00';
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return new RealDate(clock).getTime(); }
  };
  const cache = new Map();
  globalThis.localStorage = {
    getItem: (key) => cache.get(key) ?? null,
    setItem: (key, value) => cache.set(key, value),
    removeItem: (key) => cache.delete(key)
  };
  let cloud = structuredClone(snapshot);
  let writes = 0;
  globalThis.__checklistFirestore = {
    doc: (_db, _collection, userId) => userId,
    getDoc: async () => ({ exists: () => true, data: () => structuredClone(cloud) }),
    setDoc: async (_doc, value) => { cloud = structuredClone(value); writes += 1; }
  };
  const source = storageSource
    .replace("import { doc, getDoc, setDoc } from 'firebase/firestore';", 'const { doc, getDoc, setDoc } = globalThis.__checklistFirestore;')
    .replace("import { db } from '../firebase.js';", 'const db = {};')
    .replace("'../utils/date.js'", JSON.stringify(new URL('../utils/date.js', import.meta.url).href))
    .replace("'./checklists.js'", JSON.stringify(new URL('./checklists.js', import.meta.url).href));
  storage = await import(`data:text/javascript;base64,${Buffer.from(`${source}\n// fixture ${moduleVersion++}`).toString('base64')}`);
  await storage.connectCloudStorage('test-user');
  return {
    storage,
    cache,
    cloud: () => cloud,
    writes: () => writes,
    setDate: (value) => { clock = `${value}T12:00:00+09:00`; }
  };
}

afterEach(() => {
  storage?.disconnectCloudStorage();
  globalThis.Date = RealDate;
  delete globalThis.localStorage;
  delete globalThis.__checklistFirestore;
});

test('edits begun before midnight save to their captured date', async () => {
  const fixture = await setup({ records: { '2026-10-09': { todos: [{ id: 'a', text: '자정 전', done: false }], daily: {} } } });
  const rec = storage.getTodayRecord();
  fixture.setDate('2026-10-10');
  rec.todos[0].text = '자정 후 저장';
  storage.saveTodayRecord(rec);
  assert.equal(storage.getRecordByDate('2026-10-09').todos[0].text, '자정 후 저장');
  assert.deepEqual(storage.getTodayRecord().todos, []);
  assert.equal(storage.getRecords()['2026-10-10'], undefined);
});

test('basic carryover preserves original details, supports selection and prevents duplicates across dates', async () => {
  await setup({ records: { '2026-10-08': { todos: [
    { text: '부분 완료', done: false, subPriorities: [{ text: '끝남', done: true }, { text: '남음', done: false }] },
    { text: '부분 완료', done: false }, { text: '완료', done: true }
  ], daily: { 반복: false } } } });
  const source = storage.getChecklistByDate('2026-10-08');
  assert.equal(storage.getUnfinishedByDate('2026-10-08').length, 2);
  assert.equal(storage.importChecklistByDate('2026-10-08', '2026-10-09', null, [source[0].id]), 1);
  assert.equal(storage.getUnfinishedByDate('2026-10-08')[0].alreadyImported, true);
  assert.equal(storage.importChecklistByDate('2026-10-08', '2026-10-09'), 1);
  assert.equal(storage.importChecklistByDate('2026-10-08', '2026-10-09'), 0);
  assert.equal(storage.importChecklistByDate('2026-10-09', '2026-10-10'), 2);
  assert.equal(storage.importChecklistByDate('2026-10-08', '2026-10-10'), 0);
  const today = storage.getRecordByDate('2026-10-09');
  today.todos[0].subPriorities[0].text = '오늘 수정';
  storage.saveRecordByDate('2026-10-09', today);
  assert.equal(storage.getChecklistByDate('2026-10-08')[0].subPriorities[0].text, '끝남');
  assert.equal(storage.getRecordByDate('2026-10-09').daily.반복, undefined);
  assert.equal(storage.importChecklistByDate('2026-10-09', '2026-10-09'), 0);
  assert.equal(storage.importChecklistByDate('2026-10-10', '2026-10-09'), 0);
});

const customTabs = [{ id: 'tab', label: '내 작업', components: [
  { id: 'block', type: 'priority', title: '업무', priorities: [
    { text: '이전 목록', done: false, subPriorities: [{ text: '진행함', done: true }, { text: '남음', done: false }] }
  ] },
  { id: 'plain', type: 'checklist', title: '준비', items: [{ text: '준비하기', done: false }] }
] }];

test('custom checklists start empty on the next day and import into their original blocks', async () => {
  await setup({ customTabs });
  const source = { tabId: 'tab', blockId: 'block' };
  const plain = { tabId: 'tab', blockId: 'plain' };
  assert.equal(storage.getChecklistByDate('2026-10-09', source).length, 1);
  assert.deepEqual(storage.getChecklistByDate('2026-10-10', source), []);
  assert.equal(storage.importChecklistByDate('2026-10-09', '2026-10-10', source), 1);
  assert.equal(storage.importChecklistByDate('2026-10-09', '2026-10-10', plain), 1);
  assert.equal(storage.getChecklistByDate('2026-10-10', source)[0].subPriorities[0].done, true);
  assert.equal(storage.getRecordByDate('2026-10-10').todos.length, 0);
});

test('daily history survives cloud roundtrip, refresh and reconnect with config lists removed', async () => {
  const fixture = await setup({ customTabs });
  const source = { tabId: 'tab', blockId: 'block' };
  storage.importChecklistByDate('2026-10-09', '2026-10-10', source);
  const saved = structuredClone(storage.getRecords());
  await storage.flushCloudSync();
  assert.deepEqual(fixture.cloud().records, saved);
  assert.equal('priorities' in fixture.cloud().customTabs[0].components[0], false);
  assert.ok(fixture.writes() > 0);
  storage.disconnectCloudStorage();
  fixture.cache.clear();
  await storage.connectCloudStorage('test-user');
  assert.deepEqual(storage.getRecords(), saved);
  assert.equal(storage.importChecklistByDate('2026-10-09', '2026-10-10', source), 0);
});

test('deleting custom tabs retains editable history but blocks importing into deleted destinations', async () => {
  await setup({ customTabs });
  storage.saveCustomTabs([]);
  const source = { tabId: 'tab', blockId: 'block' };
  assert.equal(storage.getChecklistByDate('2026-10-09', source).length, 1);
  assert.equal(storage.importChecklistByDate('2026-10-09', '2026-10-10', source), 0);
  assert.equal(storage.saveChecklistByDate('2026-10-10', source, []), false);
  const history = storage.getRecordByDate('2026-10-09');
  history.customChecklists[0].items[0].text = '과거 기록 수정';
  storage.saveRecordByDate('2026-10-09', history);
  assert.equal(storage.getChecklistByDate('2026-10-09', source)[0].text, '과거 기록 수정');
  assert.deepEqual(storage.getCustomTabs(), []);
});

test('renaming current blocks does not replace historical titles', async () => {
  await setup({ customTabs });
  const tabs = storage.getCustomTabs();
  tabs[0].label = '새 탭 제목';
  tabs[0].components[0].title = '새 블록 제목';
  storage.saveCustomTabs(tabs);
  const source = { tabId: 'tab', blockId: 'block' };
  storage.importChecklistByDate('2026-10-09', '2026-10-10', source);
  assert.equal(storage.getRecordByDate('2026-10-09').customChecklists[0].tabTitle, '내 작업');
  const snapshot = storage.getRecordByDate('2026-10-10').customChecklists[0];
  assert.equal(snapshot.tabTitle, '새 탭 제목');
  assert.equal(snapshot.title, '새 블록 제목');
});
