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

  knownIds.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });

  return { customTabs, hidden, order };
}

function saveState({ customTabs, hidden, order }) {
  saveCustomTabs(customTabs);
  saveTabPrefs({ hidden, order });
}

function moveItem(items, from, to) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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

  function saveAndRefresh(state) {
    saveState(state);
    onTabsChanged();
  }

  function renderList() {
    const state = getState(defaultTabs);
    const customById = new Map(state.customTabs.map((tab) => [tab.id, tab]));
    list.innerHTML = '';

    state.order.forEach((id, idx) => {
      const customTab = customById.get(id);
      const defaultTab = defaultById.get(id);
      const label = customTab?.label || defaultTab?.label;
      if (!label) return;

      const hidden = state.hidden.includes(id);
      const row = document.createElement('div');
      row.className = 'tab-settings-row' + (hidden ? ' hidden' : '');

      const name = document.createElement('div');
      name.className = 'tab-settings-name';
      name.textContent = label;

      const actions = document.createElement('div');
      actions.className = 'tab-settings-actions';

      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '↑';
      up.title = '앞으로 이동';
      up.disabled = idx === 0;
      up.addEventListener('click', () => {
        state.order = moveItem(state.order, idx, idx - 1);
        saveAndRefresh(state);
        renderList();
      });

      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '↓';
      down.title = '뒤로 이동';
      down.disabled = idx === state.order.length - 1;
      down.addEventListener('click', () => {
        state.order = moveItem(state.order, idx, idx + 1);
        saveAndRefresh(state);
        renderList();
      });

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

      actions.append(up, down, remove);
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
