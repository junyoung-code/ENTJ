import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionFeature, moveItem, normalizePriorities } from './collection.js';

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.listeners = new Map();
    this.style = {};
    this.value = '';
    this.className = '';
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  focus() {
    const previous = this.ownerDocument.activeElement;
    this.ownerDocument.activeElement = this;
    previous?.listeners.get('blur')?.();
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  querySelector(selector) {
    const className = selector.startsWith('.') ? selector.slice(1) : null;
    for (const child of this.children) {
      if (className && child.className.split(' ').includes(className)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  set innerHTML(value) {
    this.children = [];
    this._innerHTML = value;
  }
}

function setupCollectionDom() {
  const document = {
    activeElement: null,
    elements: new Map(),
    createElement(tagName) {
      return new FakeElement(tagName, this);
    },
    getElementById(id) {
      return this.elements.get(id);
    }
  };
  ['active', 'achieved', 'activeEmpty', 'achievedEmpty'].forEach((id) => {
    document.elements.set(id, document.createElement('div'));
  });
  return document;
}

function findByClass(root, className) {
  if (root.className.split(' ').includes(className)) return root;
  for (const child of root.children) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

function renderRankedGoal(document) {
  const items = [{ text: '목표', achieved: false, priority: 1 }];
  const feature = createCollectionFeature({
    getItems: () => items,
    saveItems: () => {},
    itemClass: 'goal',
    maxLength: 200,
    achievedLabel: '달성',
    ranked: true,
    subItems: true,
    ids: {
      activeList: 'active',
      achievedList: 'achieved',
      activeEmpty: 'activeEmpty',
      achievedEmpty: 'achievedEmpty'
    }
  });
  globalThis.document = document;
  feature.render();
  return document.getElementById('active').children[0];
}

test('normalizes missing priorities to displayed order', () => {
  const items = [{ text: 'A' }, { text: 'B', priority: 8 }];

  assert.equal(normalizePriorities(items), true);
  assert.deepEqual(items.map((item) => item.priority), [1, 2]);
});

test('moves an item and normalizes its ranks', () => {
  const items = [{ text: 'A' }, { text: 'B' }, { text: 'C' }];

  moveItem(items, 2, 0);

  assert.deepEqual(items.map((item) => item.text), ['C', 'A', 'B']);
  assert.deepEqual(items.map((item) => item.priority), [1, 2, 3]);
});

test('ranked goals use the same row structure as Priority', () => {
  const goal = renderRankedGoal(setupCollectionDom());
  const rowClasses = goal.children[0].children.map((child) => child.className);

  assert.deepEqual(rowClasses, [
    'priority-rank',
    'task-text',
    'priority-detail-add-btn',
    'priority-controls',
    'delete-btn'
  ]);
  assert.deepEqual(goal.children[1].children.map((child) => child.className), [
    'priority-detail-list'
  ]);
});

test('opening another sub-goal editor removes an empty editor', () => {
  const goal = renderRankedGoal(setupCollectionDom());
  const addButton = findByClass(goal, 'priority-detail-add-btn');
  const detailList = findByClass(goal, 'priority-detail-list');

  addButton.listeners.get('click')();
  addButton.listeners.get('click')();

  assert.equal(detailList.children.length, 1);
  assert.equal(detailList.children[0].className, 'priority-detail-edit-row');
});
