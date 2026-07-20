import test from 'node:test';
import assert from 'node:assert/strict';
import { moveItem, normalizePriorities } from './collection.js';

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
