# Goals and Ideas Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ranked ordering to goals and ideas, with sub-goals for goals only.

**Architecture:** Extend `createCollectionFeature` with an optional ranked mode so goals and ideas keep their shared CRUD implementation. Extract pure ordering helpers to make rank initialization and movement testable without a browser.

**Tech Stack:** Vanilla JavaScript ES modules, Node built-in test runner, Vite.

## Global Constraints

- Preserve existing stored goals and ideas when `priority` is absent.
- Goals have sub-items; ideas do not.
- Keep unrelated tabs and existing modal flows unchanged.

---

### Task 1: Test and add collection ordering helpers

**Files:**
- Create: `src/features/collection.test.js`
- Modify: `src/features/collection.js`

**Interfaces:**
- Produces `normalizePriorities(items)` and `moveItem(items, from, to)` from `collection.js`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/features/collection.test.js`
Expected: FAIL because the exported helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

```js
export function normalizePriorities(items) {
  let changed = false;
  items.forEach((item, index) => {
    if (item.priority !== index + 1) {
      item.priority = index + 1;
      changed = true;
    }
  });
  return changed;
}

export function moveItem(items, from, to) {
  if (to < 0 || to >= items.length) return false;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  normalizePriorities(items);
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/features/collection.test.js`
Expected: PASS.

### Task 2: Render ranked collection controls and goal sub-items

**Files:**
- Modify: `src/features/collection.js`
- Modify: `src/features/goals.js`
- Modify: `src/features/ideas.js`
- Modify: `src/tabs.js`
- Modify: `src/styles/style.css`

**Interfaces:**
- Consumes `normalizePriorities` and `moveItem` from Task 1.
- Uses `ranked: true` for goals and ideas and `subItems: true` for goals.

- [ ] **Step 1: Extend the configuration**

```js
const goals = createCollectionFeature({ ranked: true, subItems: true, /* existing options */ });
const ideas = createCollectionFeature({ ranked: true, /* existing options */ });
```

- [ ] **Step 2: Render the rank and move controls in ranked mode**

```js
if (ranked) {
  row.append(rank, body, controls, del);
} else {
  li.append(checkbox, body, del);
}
```

- [ ] **Step 3: Add sub-item add, edit, complete, and delete controls for goals**

Use the same inline edit and completion semantics as the existing Priority sub-priorities; changing sub-items recalculates its parent item's achieved state.

- [ ] **Step 4: Update goal and idea list class names and styles**

Use `priority-list` with the new collection-specific row styles so controls remain compact on mobile.

### Task 3: Verify the completed feature

**Files:**
- Test: `src/features/collection.test.js`

- [ ] **Step 1: Run helper tests**

Run: `node --test src/features/collection.test.js`
Expected: PASS.

- [ ] **Step 2: Build the app**

Run: `npm run build`
Expected: Vite completes successfully.
