import { closeModal, openModal } from '../utils/dom.js';
import { getCustomTabs, getTabPrefs, saveCustomTabs, saveTabPrefs } from '../storage/storage.js';

function makeId() {
  return `custom-${Date.now()}`;
}

function getState(defaultTabs) {
  const customTabs = getCustomTabs();
  const prefs = getTabPrefs() || {};
  const defaultIds = defaultTabs.map((tab) => tab.id);
  const customIds = customTabs.map((tab) => tab.id);
  const knownIds = [...defaultIds, ...customIds];
  const hidden = Array.isArray(prefs.hidden) ? prefs.hidden.filter((id) => knownIds.includes(id)) : [];
  const order = (Array.isArray(prefs.order) ? prefs.order : defaultIds)
    .filter((id) => knownIds.includes(id));
  const labels = prefs.labels && typeof prefs.labels === 'object' ? prefs.labels : {};

  knownIds.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });

  return { customTabs, hidden, order, labels };
}

function saveState({ customTabs, hidden, order, labels }) {
  saveCustomTabs(customTabs);
  saveTabPrefs({ hidden, order, labels });
}

function createTabNameEditor(label, onSave) {
  const name = document.createElement('div');
  name.className = 'tab-settings-name';
  name.title = '클릭해서 이름 수정';

  const text = document.createElement('span');
  text.className = 'tab-settings-name-label';
  text.textContent = label;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tab-settings-name-input';
  input.value = label;
  input.maxLength = 24;

  let editing = false;

  const finish = (save) => {
    if (!editing) return;
    editing = false;
    name.classList.remove('is-editing');
    if (!save) {
      input.value = label;
      return;
    }
    const nextText = input.value.trim();
    if (!nextText || nextText === label) {
      input.value = label;
      return;
    }
    onSave(nextText);
  };

  name.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  name.addEventListener('click', (event) => {
    event.stopPropagation();
    if (editing) return;
    editing = true;
    name.classList.add('is-editing');
    input.value = label;
    input.focus();
    input.select();
  });

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') finish(false);
  });

  name.append(text, input);
  return name;
}

export function initTabSettings(defaultTabs, onTabsChanged) {
  const list = document.getElementById('tabSettingsList');
  const addInput = document.getElementById('newTabInput');
  const addButton = document.getElementById('newTabConfirmBtn');
  const doneButton = document.getElementById('tabSettingsDoneBtn');
  const cancelButton = document.getElementById('tabSettingsCancelBtn');
  const defaultById = new Map(defaultTabs.map((tab) => [tab.id, tab]));
  let composingNewTab = false;
  let lastAddedAt = 0;
  let pressTimer = null;
  let pressStart = null;
  let draggingRow = null;
  let isReordering = false;

  function saveAndRefresh(state) {
    saveState(state);
    onTabsChanged();
  }

  function renderList() {
    const state = getState(defaultTabs);
    const customById = new Map(state.customTabs.map((tab) => [tab.id, tab]));
    list.innerHTML = '';

    function clearPressTimer() {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    function startReorder(row) {
      isReordering = true;
      draggingRow = row;
      list.classList.add('reordering');
      row.classList.add('dragging');
    }

    function moveDraggedRow(pointerY) {
      if (!draggingRow) return;
      const target = [...list.querySelectorAll('.tab-settings-row:not(.dragging)')]
        .find((row) => pointerY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2);

      if (target) {
        list.insertBefore(draggingRow, target);
      } else {
        list.appendChild(draggingRow);
      }
    }

    function finishReorder(stateToSave) {
      clearPressTimer();
      if (!isReordering) {
        pressStart = null;
        return;
      }

      stateToSave.order = [...list.querySelectorAll('.tab-settings-row')].map((row) => row.dataset.tabId);
      draggingRow?.classList.remove('dragging');
      list.classList.remove('reordering');
      draggingRow = null;
      isReordering = false;
      pressStart = null;
      saveAndRefresh(stateToSave);
      renderList();
    }

    function cancelReorder() {
      clearPressTimer();
      draggingRow?.classList.remove('dragging');
      list.classList.remove('reordering');
      draggingRow = null;
      isReordering = false;
      pressStart = null;
    }

    state.order.forEach((id) => {
      const customTab = customById.get(id);
      const defaultTab = defaultById.get(id);
      const label = customTab?.label || state.labels[id] || defaultTab?.label;
      if (!label) return;

      const hidden = state.hidden.includes(id);
      const row = document.createElement('div');
      row.className = 'tab-settings-row' + (hidden ? ' hidden' : '');
      row.dataset.tabId = id;

      const name = createTabNameEditor(label, (nextText) => {
        if (customTab) {
          customTab.label = nextText;
        } else {
          state.labels = {
            ...state.labels,
            [id]: nextText
          };
        }
        saveAndRefresh(state);
        renderList();
      });

      const actions = document.createElement('div');
      actions.className = 'tab-settings-actions';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = hidden ? '복구' : '삭제';
      remove.addEventListener('click', () => {
        if (customTab) {
          state.customTabs = state.customTabs.filter((tab) => tab.id !== id);
          state.order = state.order.filter((tabId) => tabId !== id);
          state.hidden = state.hidden.filter((tabId) => tabId !== id);
        } else if (hidden) {
          state.hidden = state.hidden.filter((tabId) => tabId !== id);
        } else {
          state.hidden = [...state.hidden, id];
        }
        saveAndRefresh(state);
        renderList();
      });

      row.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('button') || e.target.closest('.tab-settings-name') || e.target.closest('.task-edit-input')) return;
        pressStart = { x: e.clientX, y: e.clientY };
        clearPressTimer();
        pressTimer = setTimeout(() => startReorder(row), 350);
        row.setPointerCapture?.(e.pointerId);
      });

      row.addEventListener('pointermove', (e) => {
        if (!pressStart) return;
        const distance = Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y);
        if (!isReordering && distance > 8) {
          clearPressTimer();
          pressStart = null;
          return;
        }
        if (isReordering) {
          e.preventDefault();
          moveDraggedRow(e.clientY);
        }
      });

      row.addEventListener('pointerup', () => finishReorder(state));
      row.addEventListener('pointercancel', cancelReorder);

      actions.append(remove);
      row.append(name, actions);
      list.appendChild(row);
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.id !== 'tabManageBtn') return;
    addInput.value = '';
    renderList();
    openModal('tabSettingsModal', 'newTabInput');
  });

  function addNewTab() {
    const now = Date.now();
    if (now - lastAddedAt < 500) return;

    const label = addInput.value.trim();
    if (!label) return;

    const state = getState(defaultTabs);
    const id = makeId();
    state.customTabs.push({ id, label, components: [] });
    state.order.push(id);
    saveAndRefresh(state);
    addInput.value = '';
    lastAddedAt = now;
    setTimeout(() => {
      addInput.value = '';
    }, 0);
    renderList();
  }

  addButton.addEventListener('click', addNewTab);

  addInput.addEventListener('compositionstart', () => {
    composingNewTab = true;
  });

  addInput.addEventListener('compositionend', () => {
    composingNewTab = false;
  });

  addInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.isComposing || composingNewTab || e.keyCode === 229) return;
    e.preventDefault();
    addNewTab();
  });

  cancelButton.addEventListener('click', () => {
    closeModal('tabSettingsModal');
  });

  doneButton.addEventListener('click', () => closeModal('tabSettingsModal'));
}
