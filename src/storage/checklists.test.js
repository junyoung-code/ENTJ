import test from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateChecklistHistory,
  normalizeChecklist,
  setItemDone,
  syncItemDone,
  importUnfinishedItems,
  checklistRate
} from './checklists.js';
import { previousDateKey } from '../utils/date.js';

test('normalizes legacy IDs, order and parent completion without losing details', () => {
  const items = [{ text: '작업', done: true, priority: 8, subPriorities: [
    { text: '완료한 단계', done: true }, { text: '남은 단계', done: false }
  ] }];
  normalizeChecklist(items, 'legacy');
  const before = structuredClone(items);
  normalizeChecklist(items, 'legacy');
  assert.deepEqual(items, before);
  assert.equal(items[0].id, 'legacy:0');
  assert.equal(items[0].priority, 1);
  assert.equal(items[0].done, false);
  assert.equal(items[0].subPriorities[0].done, true);
  assert.ok(items[0].subPriorities[1].id);
});

test('parent toggles propagate and detail additions/deletions recalculate completion', () => {
  const item = { done: false, subPriorities: [{ done: false }, { done: true }] };
  setItemDone(item, true);
  assert.ok(item.subPriorities.every((detail) => detail.done));
  item.subPriorities.push({ done: false });
  syncItemDone(item);
  assert.equal(item.done, false);
  item.subPriorities.pop();
  syncItemDone(item);
  assert.equal(item.done, true);
  item.subPriorities = [];
  syncItemDone(item);
  assert.equal(item.done, true);
});

test('imports selected unfinished items with all details independently and only once', () => {
  const source = [
    { id: 'a', text: '동일 제목', done: false, subPriorities: [{ id: 's', text: '단계', done: true }] },
    { id: 'b', text: '동일 제목', done: false },
    { id: 'c', text: '완료', done: true }
  ];
  // A partially completed parent needs at least one remaining detail.
  source[0].subPriorities.push({ id: 's2', text: '남은 단계', done: false });
  const original = structuredClone(source);
  const target = [{ id: 'today', text: '동일 제목', done: false, priority: 1 }];
  assert.equal(importUnfinishedItems(source, target, ['a']), 1);
  assert.equal(target[1].subPriorities[0].done, true);
  target[1].subPriorities[0].text = '오늘 수정';
  assert.deepEqual(source, original);
  assert.equal(importUnfinishedItems(source, target), 1);
  assert.equal(importUnfinishedItems(source, target), 0);
  assert.deepEqual(target.map((item) => item.id), ['today', 'a', 'b']);
  assert.deepEqual(target.map((item) => item.priority), [1, 2, 3]);
  assert.equal(importUnfinishedItems([], target), 0);
});

test('migrates both custom checklist types into today while retaining other data', () => {
  const records = { '2026-10-08': { todos: [{ text: '어제', done: false, subPriorities: [{ text: '세부', done: true }] }], daily: { 운동: true } } };
  const tabs = [{ id: 'tab', label: '작업', components: [
    { id: 'plain', title: '기본', type: 'checklist', items: [{ text: '할 일', done: false }] },
    { id: 'ranked', title: '우선', type: 'priority', priorities: [{ text: '순위', done: false, subPriorities: [{ text: '단계', done: false }] }], items: [] },
    { id: 'goal', type: 'recordable', records: [{ text: '목표', achieved: true }] }
  ] }];
  const goal = structuredClone(tabs[0].components[2]);
  const result = migrateChecklistHistory(records, tabs, '2026-10-09');
  assert.equal(result.recordsChanged, true);
  assert.equal(result.tabsChanged, true);
  assert.equal(records['2026-10-09'].customChecklists.length, 2);
  assert.equal(records['2026-10-09'].customChecklists[1].items[0].subPriorities[0].text, '단계');
  assert.equal(records['2026-10-08'].customChecklists.length, 0);
  assert.equal(records['2026-10-08'].daily.운동, true);
  assert.deepEqual(tabs[0].components[2], goal);
  assert.equal('items' in tabs[0].components[0], false);
  assert.equal('priorities' in tabs[0].components[1], false);
  const before = structuredClone({ records, tabs });
  assert.deepEqual(migrateChecklistHistory(records, tabs, '2026-10-10'), { recordsChanged: false, tabsChanged: false });
  assert.deepEqual({ records, tabs }, before);
  assert.equal(records['2026-10-10'], undefined);
});

test('migration merges into existing today and recovers an interrupted configuration cleanup', () => {
  const legacy = { id: 'block', type: 'checklist', title: '목록', items: [{ text: '기존', done: false }] };
  const tabs = [{ id: 'tab', label: '탭', components: [structuredClone(legacy)] }];
  const records = { '2026-10-09': { todos: [], daily: {}, customChecklists: [
    { tabId: 'tab', blockId: 'block', title: '목록', tabTitle: '탭', type: 'checklist', items: [{ id: 'new', text: '오늘 추가', done: false }] }
  ] } };
  migrateChecklistHistory(records, tabs, '2026-10-09');
  assert.equal(records['2026-10-09'].customChecklists[0].items.length, 2);
  tabs[0].components[0] = structuredClone(legacy);
  migrateChecklistHistory(records, tabs, '2026-10-10');
  assert.equal(records['2026-10-09'].customChecklists[0].items.length, 2);
  assert.equal(records['2026-10-10'], undefined);
});

test('calendar counts custom parents once and keeps archived block records', () => {
  const rec = { todos: [{ done: true, subPriorities: [{ done: true }] }], daily: {}, customChecklists: [
    { items: [{ done: false, subPriorities: [{ done: true }, { done: false }] }, { done: true }] }
  ] };
  assert.deepEqual(checklistRate(rec, []), { done: 2, total: 3, pct: 67 });
  assert.deepEqual(checklistRate({ todos: [], customChecklists: [{ items: [{ done: false }] }] }, []), { done: 0, total: 1, pct: 0 });
  assert.equal(checklistRate({ todos: [], customChecklists: [] }, []), null);
});

test('previous dates use local calendar arithmetic across month, year and leap day boundaries', () => {
  assert.equal(previousDateKey('2027-01-01'), '2026-12-31');
  assert.equal(previousDateKey('2026-10-01'), '2026-09-30');
  assert.equal(previousDateKey('2024-03-01'), '2024-02-29');
});
