import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { renderChecklistRecord } from './checklistRecord.js';

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.className = '';
    this.value = '';
  }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  appendChild(child) { child.parentElement = this; this.children.push(child); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  focus() { document.activeElement = this; }
  select() {}
  replaceWith(child) {
    const index = this.parentElement.children.indexOf(this);
    this.parentElement.children[index] = child;
    child.parentElement = this.parentElement;
  }
  contains(element) { return element === this || this.children.some((child) => child.contains(element)); }
  click() { if (!this.disabled) this.listeners.get('click')?.(); }
}

function all(root, predicate) {
  return [root, ...root.children.flatMap((child) => all(child, predicate))].filter(predicate);
}

function setup(items, ranked = true) {
  globalThis.document = {
    createElement: (tagName) => new Element(tagName),
    addEventListener() {}, removeEventListener() {}
  };
  const root = new Element('div');
  let saves = 0;
  const render = () => {
    root.children = [];
    renderChecklistRecord(root, items, ranked, () => { saves += 1; render(); });
  };
  render();
  return { root, saves: () => saves };
}

afterEach(() => { delete globalThis.document; });

test('history displays every detail and parent toggles stay consistent with details', () => {
  const items = [{ id: 'task', text: '작업', done: false, subPriorities: [
    { id: 'a', text: '완료한 단계', done: true }, { id: 'b', text: '남은 단계', done: false }
  ] }];
  const { root, saves } = setup(items);
  assert.deepEqual(all(root, (element) => element.className === 'record-text-btn').map((element) => element.textContent), ['작업', '완료한 단계', '남은 단계']);
  root.children[0].children[0].children[0].click();
  assert.equal(items[0].done, true);
  assert.ok(items[0].subPriorities.every((detail) => detail.done));
  root.children[0].children[1].children[1].children[0].click();
  assert.equal(items[0].done, false);
  assert.equal(items[0].subPriorities[0].done, true);
  assert.equal(saves(), 2);
});

test('history reordering preserves identities and keeps boundary controls disabled', () => {
  const items = [{ id: 'first', text: 'A', done: false }, { id: 'second', text: 'B', done: false }];
  const { root } = setup(items);
  let controls = all(root, (element) => element.className === 'priority-move-btn');
  assert.equal(controls[0].disabled, true);
  assert.equal(controls[3].disabled, true);
  controls[1].click();
  assert.deepEqual(items.map((item) => item.id), ['second', 'first']);
  assert.deepEqual(items.map((item) => item.priority), [1, 2]);
  controls = all(root, (element) => element.className === 'priority-move-btn');
  controls[0].click();
  assert.deepEqual(items.map((item) => item.id), ['second', 'first']);
});

test('history can edit detail text and deleting an unfinished detail completes its parent', () => {
  const items = [{ id: 'task', text: '작업', done: false, subPriorities: [
    { id: 'done', text: '완료', done: true }, { id: 'remaining', text: '남음', done: false }
  ] }];
  const { root } = setup(items);
  all(root, (element) => element.className === 'record-text-btn')[1].click();
  document.activeElement.value = '수정한 세부사항';
  document.activeElement.listeners.get('keydown')({ key: 'Enter' });
  assert.equal(items[0].subPriorities[0].text, '수정한 세부사항');
  all(root, (element) => element.title === '세부사항 삭제')[1].click();
  assert.equal(items[0].done, true);
  assert.equal(items[0].subPriorities.length, 1);
});

test('plain custom history supports checking, ordering and deletion without adding priority details', () => {
  const items = [{ id: 'a', text: '체크리스트', done: false }, { id: 'b', text: '다른 항목', done: false }];
  const { root } = setup(items, false);
  assert.equal(all(root, (element) => element.className === 'record-checklist-details').length, 0);
  root.children[0].children[0].children[0].click();
  assert.equal(items[0].done, true);
  all(root, (element) => element.title === '항목 삭제')[0].click();
  assert.deepEqual(items.map((item) => item.id), ['b']);
});
