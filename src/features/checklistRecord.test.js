import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderChecklistRecord } from './checklistRecord.js';

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.className = '';
  }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  appendChild(child) { this.children.push(child); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
}

function all(root, predicate) {
  return [root, ...root.children.flatMap((child) => all(child, predicate))].filter(predicate);
}

function setup(items) {
  globalThis.document = { createElement: (tagName) => new Element(tagName) };
  const root = new Element('div');
  renderChecklistRecord(root, items);
  return root;
}

afterEach(() => { delete globalThis.document; });

test('history displays parent and detail order and completion without changing stored data', () => {
  const items = [{ id: 'task', text: '작업', done: false, subPriorities: [
    { id: 'a', text: '완료한 단계', done: true }, { id: 'b', text: '남은 단계', done: false }
  ] }, { id: 'finished', text: '완료한 작업', done: true }];
  const before = structuredClone(items);
  const root = setup(items);
  assert.deepEqual(all(root, (element) => element.className === 'record-text-inline').map((element) => element.textContent), ['작업', '완료한 단계', '남은 단계', '완료한 작업']);
  const statuses = all(root, (element) => element.className.startsWith('record-checklist-status'));
  assert.deepEqual(statuses.map((element) => element.textContent), ['1', '1', '2', '2']);
  assert.deepEqual(statuses.map((element) => element.title), ['미완료', '완료', '미완료', '완료']);
  assert.equal(all(root, (element) => element.className === 'record-item done-item').length, 2);
  assert.deepEqual(items, before);
});

test('history contains no editing controls or interaction handlers', () => {
  const root = setup([{ text: '작업', done: false, subPriorities: [{ text: '세부사항', done: false }] }]);
  assert.equal(all(root, (element) => ['button', 'input', 'textarea'].includes(element.tagName)).length, 0);
  assert.equal(all(root, (element) => element.listeners.size > 0).length, 0);
  assert.equal(all(root, (element) => /priority-detail-add-btn|priority-move-btn|delete-btn/.test(element.className)).length, 0);
});

test('history omits empty detail sections and handles empty records', () => {
  const root = setup([{ text: 'A', done: false }, { text: 'B', done: true, subPriorities: [] }]);
  assert.equal(all(root, (element) => element.className === 'record-checklist-details').length, 0);
  assert.equal(setup([]).children.length, 0);
});
