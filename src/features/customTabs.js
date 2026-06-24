import { closeModal, openModal, startTextEdit } from '../utils/dom.js';
import { getCustomTabs, saveCustomTabs } from '../storage/storage.js';

const BLOCK_TEMPLATES = [
  { type: 'checklist', label: '기본 체크리스트 블록', title: '제목 없는 체크리스트' },
  { type: 'priority', label: '우선순위 체크리스트 블록', title: '제목없는 우선순위 체크리스트' },
  { type: 'recordable', label: '기록가능 체크리스트 블록', title: '제목없는 기록가능 체크리스트' },
  { type: 'timer', label: '기본 스탑워치 블록', title: '스톱워치' }
];

let activeTabId = null;
let activeBlockItem = null;
const timerIntervals = new Map();

function makeId(prefix) {
  return `${prefix}-${Date.now()}`;
}

function fmtHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stopTimerInterval(componentId) {
  clearInterval(timerIntervals.get(componentId));
  timerIntervals.delete(componentId);
}

function stopAllTimerIntervals() {
  timerIntervals.forEach((interval) => clearInterval(interval));
  timerIntervals.clear();
}

function getTab(tabId) {
  return getCustomTabs().find((tab) => tab.id === tabId);
}

function updateTab(tabId, updater, options = {}) {
  const tabs = getCustomTabs();
  const tab = tabs.find((item) => item.id === tabId);
  if (!tab) return;
  if (!Array.isArray(tab.components)) tab.components = [];
  updater(tab);
  saveCustomTabs(tabs);
  if (options.render !== false) renderCustomTabs();
}

function moveComponent(tabId, from, to) {
  updateTab(tabId, (tab) => {
    if (to < 0 || to >= tab.components.length) return;
    const [component] = tab.components.splice(from, 1);
    tab.components.splice(to, 0, component);
  });
}

function removeComponent(tabId, componentId) {
  stopTimerInterval(componentId);
  updateTab(tabId, (tab) => {
    tab.components = tab.components.filter((component) => component.id !== componentId);
  });
}

function makeHeader(tabId, component, idx, total) {
  const header = document.createElement('div');
  header.className = 'custom-component-header';

  const title = document.createElement('div');
  title.className = 'custom-component-title';
  title.textContent = component.title;

  const actions = document.createElement('div');
  actions.className = 'custom-component-actions';

  const up = document.createElement('button');
  up.type = 'button';
  up.textContent = '↑';
  up.title = '위로 이동';
  up.disabled = idx === 0;
  up.addEventListener('click', () => moveComponent(tabId, idx, idx - 1));

  const down = document.createElement('button');
  down.type = 'button';
  down.textContent = '↓';
  down.title = '아래로 이동';
  down.disabled = idx === total - 1;
  down.addEventListener('click', () => moveComponent(tabId, idx, idx + 1));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = '×';
  remove.title = '블록 삭제';
  remove.addEventListener('click', () => removeComponent(tabId, component.id));

  actions.append(up, down, remove);
  header.append(title, actions);
  return header;
}

function renderMemo(card, tabId, component) {
  const textarea = document.createElement('textarea');
  textarea.className = 'custom-memo-input';
  textarea.placeholder = '내용을 적어두세요';
  textarea.value = component.text || '';
  textarea.addEventListener('input', () => {
    const tabs = getCustomTabs();
    const tab = tabs.find((item) => item.id === tabId);
    const target = tab?.components.find((item) => item.id === component.id);
    if (!target) return;
    target.text = textarea.value;
    saveCustomTabs(tabs);
  });
  card.appendChild(textarea);
}

function syncChecklistProgress(card, component) {
  if (!Array.isArray(component.items)) component.items = [];

  const total = component.items.length;
  const done = component.items.filter((item) => item.done).length;
  const existing = card.querySelector('.progress-wrap');

  if (total === 0) {
    if (existing) existing.remove();
    return;
  }

  let progress = existing;
  if (!progress) {
    progress = document.createElement('div');
    progress.className = 'progress-wrap';
    progress.innerHTML = `
      <div class="progress-label">
        <span>진행률</span>
        <span class="custom-progress-text">0 / 0</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:0%"></div>
      </div>`;
    card.prepend(progress);
  }

  progress.querySelector('.custom-progress-text').textContent = `${done} / ${total}`;
  progress.querySelector('.progress-fill').style.width = `${Math.round((done / total) * 100)}%`;
}

function renderChecklist(card, tabId, component) {
  if (!Array.isArray(component.items)) component.items = [];

  syncChecklistProgress(card, component);

  const header = document.createElement('div');
  header.className = 'card-header';
  header.style.marginBottom = '8px';

  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = component.title || '제목 없는 체크리스트';
  title.title = '클릭해서 제목 수정';
  title.addEventListener('click', () => {
    startTextEdit(title, title.textContent, (nextText) => {
      updateTab(tabId, (tab) => {
        const target = tab.components.find((item) => item.id === component.id);
        if (!target) return;
        target.title = nextText || '제목 없는 체크리스트';
      });
    }, 80, { className: 'block-edit-input' });
  });

  const actions = document.createElement('div');
  actions.className = 'custom-component-actions';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'add-btn';
  addButton.title = '항목 추가';
  addButton.textContent = '+';
  addButton.addEventListener('click', () => {
    activeBlockItem = { type: 'checklist', tabId, blockId: component.id };
    document.getElementById('blockItemInput').value = '';
    document.querySelector('#blockItemModal h3').textContent = '할 일 추가';
    document.getElementById('blockItemInput').placeholder = '오늘 할 일을 입력하세요';
    document.getElementById('blockItemInput').maxLength = 80;
    openModal('blockItemModal', 'blockItemInput');
  });

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'custom-component-remove-btn';
  removeButton.title = '블록 삭제';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => removeComponent(tabId, component.id));

  actions.append(addButton, removeButton);
  header.append(title, actions);
  card.appendChild(header);

  const list = document.createElement('ul');
  list.className = 'task-list';

  component.items.forEach((item, itemIdx) => {
    const row = document.createElement('li');
    row.className = 'task-item' + (item.done ? ' done' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.done;
    checkbox.addEventListener('change', () => {
      component.items[itemIdx].done = checkbox.checked;
      row.className = 'task-item' + (checkbox.checked ? ' done' : '');
      syncChecklistProgress(card, component);
      updateTab(tabId, (tab) => {
        tab.components.find((target) => target.id === component.id).items[itemIdx].done = checkbox.checked;
      }, { render: false });
    });

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = item.text;
    text.title = '클릭해서 수정';
    text.addEventListener('click', () => {
      startTextEdit(text, item.text, (nextText) => {
        updateTab(tabId, (tab) => {
          tab.components.find((target) => target.id === component.id).items[itemIdx].text = nextText;
        });
      });
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-btn';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      updateTab(tabId, (tab) => {
        tab.components.find((target) => target.id === component.id).items.splice(itemIdx, 1);
      });
    });

    row.append(checkbox, text, remove);
    list.appendChild(row);
  });

  card.appendChild(list);

  if (component.items.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '+ 버튼으로 체크리스트 항목을 추가하세요';
    card.appendChild(empty);
  }
}

function getBlockPriorities(component) {
  if (!Array.isArray(component.priorities)) component.priorities = [];
  return component.priorities;
}

function getPriorityDetails(item) {
  if (!Array.isArray(item.subPriorities)) item.subPriorities = [];
  return item.subPriorities;
}

function normalizeBlockPriorities(component) {
  getBlockPriorities(component).forEach((item, idx) => {
    item.priority = idx + 1;
  });
}

function syncPriorityDoneFromDetails(item) {
  const details = getPriorityDetails(item);
  if (details.length === 0) return;
  item.done = details.every((detail) => detail.done);
}

function syncPriorityProgress(card, component) {
  const priorities = getBlockPriorities(component);
  const total = priorities.length;
  const existing = card.querySelector('.progress-wrap');

  if (total === 0) {
    if (existing) existing.remove();
    return;
  }

  let progress = existing;
  if (!progress) {
    progress = document.createElement('div');
    progress.className = 'progress-wrap';
    progress.innerHTML = `
      <div class="progress-label">
        <span>오늘의 우선순위 진행률</span>
        <span class="custom-priority-progress-text">0 / 0</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:0%"></div>
      </div>`;
    card.prepend(progress);
  }

  const done = priorities.filter((item) => item.done).length;
  progress.querySelector('.custom-priority-progress-text').textContent = `${done} / ${total}`;
  progress.querySelector('.progress-fill').style.width = `${Math.round((done / total) * 100)}%`;
}

function makePriorityMoveButton(label, title, disabled, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'priority-move-btn';
  button.textContent = label;
  button.title = title;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function makePriorityDetailAddButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'priority-detail-add-btn';
  button.textContent = '+ 세부 우선순위';
  return button;
}

function startPriorityDetailAdd(list, item, onSave) {
  const details = getPriorityDetails(item);
  const row = document.createElement('div');
  row.className = 'priority-detail-edit-row';

  const label = document.createElement('span');
  label.className = 'priority-detail-number';
  label.textContent = String(list.children.length + 1);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input priority-detail-input';
  input.maxLength = 100;
  input.placeholder = '세부 우선순위 입력';

  let finished = false;
  let composing = false;
  const finish = (save) => {
    if (finished || composing) return;
    const text = input.value.trim();
    if (save && !text) return;
    finished = true;
    if (save && text) {
      details.push({ text, done: false });
      onSave();
      return;
    }
    row.remove();
  };

  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.isComposing || composing || e.keyCode === 229) return;
      finish(true);
    }
    if (e.key === 'Escape') finish(false);
  });

  row.append(label, input);
  list.appendChild(row);
  input.focus();
}

function appendPriorityDetails(container, item, onSave) {
  const details = getPriorityDetails(item);
  const list = document.createElement('ul');
  list.className = 'priority-detail-list';

  details.forEach((detail, detailIdx) => {
    const detailItem = document.createElement('li');
    detailItem.className = 'priority-detail-item' + (detail.done ? ' done' : '');

    const number = document.createElement('button');
    number.type = 'button';
    number.className = 'priority-detail-number';
    number.textContent = String(detailIdx + 1);
    number.title = '세부 우선순위 완수';
    number.addEventListener('click', () => {
      details[detailIdx].done = !details[detailIdx].done;
      syncPriorityDoneFromDetails(item);
      onSave();
    });

    const text = document.createElement('span');
    text.className = 'priority-detail-text';
    text.textContent = detail.text;
    text.title = '클릭해서 수정';
    text.addEventListener('click', () => {
      startTextEdit(text, detail.text, (nextText) => {
        details[detailIdx].text = nextText;
        onSave();
      }, 100);
    });

    const remove = document.createElement('button');
    remove.className = 'delete-btn priority-detail-delete';
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      details.splice(detailIdx, 1);
      onSave();
    });

    detailItem.append(number, text, remove);
    list.appendChild(detailItem);
  });

  container.appendChild(list);
}

function renderPriorityBlock(card, tabId, component) {
  normalizeBlockPriorities(component);
  syncPriorityProgress(card, component);

  const header = document.createElement('div');
  header.className = 'card-header';
  header.style.marginBottom = '8px';

  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = component.title || '제목없는 우선순위 체크리스트';
  title.title = '클릭해서 제목 수정';
  title.addEventListener('click', () => {
    startTextEdit(title, title.textContent, (nextText) => {
      updateTab(tabId, (tab) => {
        const target = tab.components.find((item) => item.id === component.id);
        if (!target) return;
        target.title = nextText || '제목없는 우선순위 체크리스트';
      });
    }, 80, { className: 'block-edit-input' });
  });

  const actions = document.createElement('div');
  actions.className = 'custom-component-actions';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'add-btn';
  addButton.title = '우선순위 추가';
  addButton.textContent = '+';
  addButton.addEventListener('click', () => {
    activeBlockItem = { type: 'priority', tabId, blockId: component.id };
    document.getElementById('blockItemInput').value = '';
    document.querySelector('#blockItemModal h3').textContent = '우선순위 추가';
    document.getElementById('blockItemInput').placeholder = '우선순위 항목을 입력하세요';
    document.getElementById('blockItemInput').maxLength = 80;
    openModal('blockItemModal', 'blockItemInput');
  });

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'custom-component-remove-btn';
  removeButton.title = '블록 삭제';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => removeComponent(tabId, component.id));

  actions.append(addButton, removeButton);
  header.append(title, actions);
  card.appendChild(header);

  const list = document.createElement('ul');
  list.className = 'task-list priority-list';
  const priorities = getBlockPriorities(component);

  priorities.forEach((item, idx) => {
    const rowItem = document.createElement('li');
    rowItem.className = 'priority-item' + (item.done ? ' done' : '');

    const row = document.createElement('div');
    row.className = 'priority-main-row';

    const rank = document.createElement('button');
    rank.type = 'button';
    rank.className = 'priority-rank';
    rank.textContent = String(idx + 1);
    rank.title = item.done ? '완료 해제' : '완료';
    rank.addEventListener('click', () => {
      const nextDone = !priorities[idx].done;
      priorities[idx].done = nextDone;
      getPriorityDetails(priorities[idx]).forEach((detail) => {
        detail.done = nextDone;
      });
      updateTab(tabId, (tab) => {
        const target = tab.components.find((componentItem) => componentItem.id === component.id);
        target.priorities = priorities;
      });
    });

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = item.text;
    text.title = '클릭해서 수정';
    text.addEventListener('click', () => {
      startTextEdit(text, item.text, (nextText) => {
        priorities[idx].text = nextText;
        updateTab(tabId, (tab) => {
          const target = tab.components.find((componentItem) => componentItem.id === component.id);
          target.priorities = priorities;
        });
      });
    });

    const addDetail = makePriorityDetailAddButton();
    const details = document.createElement('div');
    details.className = 'priority-detail-wrap';
    appendPriorityDetails(details, item, () => {
      updateTab(tabId, (tab) => {
        const target = tab.components.find((componentItem) => componentItem.id === component.id);
        target.priorities = priorities;
      });
    });

    const detailList = details.querySelector('.priority-detail-list');
    addDetail.addEventListener('click', () => {
      startPriorityDetailAdd(detailList, item, () => {
        updateTab(tabId, (tab) => {
          const target = tab.components.find((componentItem) => componentItem.id === component.id);
          target.priorities = priorities;
        });
      });
    });

    const controls = document.createElement('div');
    controls.className = 'priority-controls';
    controls.append(
      makePriorityMoveButton('↑', '우선순위 올리기', idx === 0, () => {
        const [moved] = priorities.splice(idx, 1);
        priorities.splice(idx - 1, 0, moved);
        normalizeBlockPriorities(component);
        updateTab(tabId, (tab) => {
          const target = tab.components.find((componentItem) => componentItem.id === component.id);
          target.priorities = priorities;
        });
      }),
      makePriorityMoveButton('↓', '우선순위 내리기', idx === priorities.length - 1, () => {
        const [moved] = priorities.splice(idx, 1);
        priorities.splice(idx + 1, 0, moved);
        normalizeBlockPriorities(component);
        updateTab(tabId, (tab) => {
          const target = tab.components.find((componentItem) => componentItem.id === component.id);
          target.priorities = priorities;
        });
      })
    );

    row.append(rank, text, addDetail, controls);
    rowItem.append(row, details);
    list.appendChild(rowItem);
  });

  card.appendChild(list);

  if (priorities.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '+ 버튼으로 우선순위를 추가하세요';
    card.appendChild(empty);
  }
}

function isAchieved(item) {
  return item.achieved === true || String(item.achieved).toLowerCase() === 'true';
}

function getRecordableItems(component) {
  if (!Array.isArray(component.records)) component.records = [];
  return component.records;
}

function renderRecordableItem(list, items, item, idx, tabId, component) {
  const achieved = isAchieved(item);
  const row = document.createElement('li');
  row.className = 'goal-item' + (achieved ? ' achieved' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = achieved;
  checkbox.addEventListener('change', () => {
    items[idx].achieved = checkbox.checked;
    items[idx].achievedAt = checkbox.checked ? new Date().toLocaleDateString('ko-KR') : null;
    updateTab(tabId, (tab) => {
      const target = tab.components.find((componentItem) => componentItem.id === component.id);
      target.records = items;
    });
  });

  const body = document.createElement('div');
  body.className = 'goal-body';

  const text = document.createElement('div');
  text.className = 'goal-text';
  text.textContent = item.text;
  text.title = '클릭해서 수정';
  text.addEventListener('click', () => {
    startTextEdit(text, item.text, (nextText) => {
      items[idx].text = nextText;
      updateTab(tabId, (tab) => {
        const target = tab.components.find((componentItem) => componentItem.id === component.id);
        target.records = items;
      });
    }, 200, { block: true });
  });

  const meta = document.createElement('div');
  meta.className = 'goal-meta';
  meta.textContent = achieved && item.achievedAt
    ? `달성 ${item.achievedAt}`
    : `추가 ${item.createdAt || ''}`;

  const remove = document.createElement('button');
  remove.className = 'delete-btn';
  remove.textContent = '×';
  remove.addEventListener('click', () => {
    items.splice(idx, 1);
    updateTab(tabId, (tab) => {
      const target = tab.components.find((componentItem) => componentItem.id === component.id);
      target.records = items;
    });
  });

  body.append(text, meta);
  row.append(checkbox, body, remove);
  list.appendChild(row);
}

function renderRecordableBlock(card, tabId, component) {
  const items = getRecordableItems(component);

  const header = document.createElement('div');
  header.className = 'card-header';

  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = component.title || '제목없는 기록가능 체크리스트';
  title.title = '클릭해서 제목 수정';
  title.addEventListener('click', () => {
    startTextEdit(title, title.textContent, (nextText) => {
      updateTab(tabId, (tab) => {
        const target = tab.components.find((item) => item.id === component.id);
        if (!target) return;
        target.title = nextText || '제목없는 기록가능 체크리스트';
      });
    }, 80, { className: 'block-edit-input' });
  });

  const actions = document.createElement('div');
  actions.className = 'custom-component-actions';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'add-btn';
  addButton.title = '목표 추가';
  addButton.textContent = '+';
  addButton.addEventListener('click', () => {
    activeBlockItem = { type: 'recordable', tabId, blockId: component.id };
    document.getElementById('blockItemInput').value = '';
    document.querySelector('#blockItemModal h3').textContent = '목표 추가';
    document.getElementById('blockItemInput').placeholder = '이루고 싶은 목표를 적어보세요';
    document.getElementById('blockItemInput').maxLength = 200;
    openModal('blockItemModal', 'blockItemInput');
  });

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'custom-component-remove-btn';
  removeButton.title = '블록 삭제';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => removeComponent(tabId, component.id));

  actions.append(addButton, removeButton);
  header.append(title, actions);
  card.appendChild(header);

  const description = document.createElement('p');
  description.className = 'custom-recordable-description';
  description.textContent = '이루고 싶은 목표를 적어보세요';
  card.appendChild(description);

  const activeList = document.createElement('ul');
  activeList.className = 'task-list';
  const achievedList = document.createElement('ul');
  achievedList.className = 'task-list';

  const activeItems = [];
  const achievedItems = [];
  items.forEach((item, idx) => {
    (isAchieved(item) ? achievedItems : activeItems).push({ item, idx });
  });

  activeItems.forEach(({ item, idx }) => renderRecordableItem(activeList, items, item, idx, tabId, component));
  card.appendChild(activeList);

  if (activeItems.length === 0) {
    const activeEmpty = document.createElement('p');
    activeEmpty.className = 'empty-state';
    activeEmpty.textContent = '+ 버튼으로 목표를 추가하세요';
    card.appendChild(activeEmpty);
  }

  const divider = document.createElement('div');
  divider.className = 'section-divider custom-recordable-divider';
  divider.textContent = '완수한 목표';
  card.appendChild(divider);

  achievedItems.forEach(({ item, idx }) => renderRecordableItem(achievedList, items, item, idx, tabId, component));
  card.appendChild(achievedList);

  if (achievedItems.length === 0) {
    const achievedEmpty = document.createElement('p');
    achievedEmpty.className = 'empty-state';
    achievedEmpty.textContent = '아직 완수한 목표가 없어요';
    card.appendChild(achievedEmpty);
  }
}

function getTimerElapsed(timer) {
  if (timer.running && timer.startedAt) {
    return (timer.elapsed || 0) + Math.floor((Date.now() - timer.startedAt) / 1000);
  }
  return timer.elapsed || 0;
}

function saveTimerState(tabId, componentId, updater) {
  updateTab(tabId, (tab) => {
    const target = tab.components.find((component) => component.id === componentId);
    if (!target) return;
    if (!target.timer) target.timer = {};
    updater(target.timer);
  }, { render: false });
}

function renderTimer(card, tabId, component) {
  if (!component.timer) component.timer = { subject: '', elapsed: 0, running: false, startedAt: null };

  const header = document.createElement('div');
  header.className = 'custom-timer-header';

  const title = document.createElement('span');
  title.className = 'card-title';
  title.textContent = component.title || '스톱워치';
  title.title = '클릭해서 제목 수정';
  title.addEventListener('click', () => {
    startTextEdit(title, title.textContent, (nextText) => {
      updateTab(tabId, (tab) => {
        const target = tab.components.find((item) => item.id === component.id);
        if (!target) return;
        target.title = nextText || '스톱워치';
      });
    }, 80, { className: 'block-edit-input' });
  });

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'custom-component-remove-btn';
  removeButton.title = '블록 삭제';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => removeComponent(tabId, component.id));

  header.append(title, removeButton);
  card.appendChild(header);

  const subjectRow = document.createElement('div');
  subjectRow.className = 'study-subject-row';

  const subjectInput = document.createElement('input');
  subjectInput.type = 'text';
  subjectInput.className = 'study-subject-input';
  subjectInput.placeholder = '과목 / 주제 입력 (선택)';
  subjectInput.maxLength = 40;
  subjectInput.value = component.timer.subject || '';
  subjectInput.disabled = !!component.timer.running;
  subjectInput.addEventListener('input', () => {
    component.timer.subject = subjectInput.value;
    saveTimerState(tabId, component.id, (timer) => {
      timer.subject = subjectInput.value;
    });
  });

  subjectRow.appendChild(subjectInput);
  card.appendChild(subjectRow);

  const display = document.createElement('div');
  display.className = 'stopwatch-display';

  const time = document.createElement('div');
  time.className = 'sw-time';
  if (component.timer.running) time.classList.add('running');
  time.textContent = fmtHMS(getTimerElapsed(component.timer));

  const label = document.createElement('div');
  label.className = 'sw-subject-label';
  label.textContent = component.timer.running ? component.timer.subject || '' : '';

  display.append(time, label);
  card.appendChild(display);

  const controls = document.createElement('div');
  controls.className = 'sw-controls';

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.className = 'sw-btn sw-btn-start';
  startButton.textContent = component.timer.running ? '일시정지' : (getTimerElapsed(component.timer) > 0 ? '재개' : '시작');
  if (component.timer.running) startButton.classList.replace('sw-btn-start', 'sw-btn-pause');

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'sw-btn sw-btn-reset';
  resetButton.textContent = '리셋';
  resetButton.style.display = getTimerElapsed(component.timer) > 0 ? '' : 'none';

  function updateDisplay() {
    time.textContent = fmtHMS(getTimerElapsed(component.timer));
  }

  function startTicking() {
    stopTimerInterval(component.id);
    timerIntervals.set(component.id, setInterval(updateDisplay, 500));
  }

  if (component.timer.running) startTicking();

  startButton.addEventListener('click', () => {
    if (!component.timer.running) {
      component.timer.running = true;
      component.timer.startedAt = Date.now();
      label.textContent = subjectInput.value.trim() || '';
      subjectInput.disabled = true;
      startButton.textContent = '일시정지';
      startButton.classList.replace('sw-btn-start', 'sw-btn-pause');
      time.classList.add('running');
      time.classList.remove('paused');
      resetButton.style.display = '';
      saveTimerState(tabId, component.id, (timer) => {
        timer.subject = subjectInput.value.trim();
        timer.elapsed = component.timer.elapsed || 0;
        timer.running = true;
        timer.startedAt = component.timer.startedAt;
      });
      startTicking();
      return;
    }

    component.timer.elapsed = getTimerElapsed(component.timer);
    component.timer.running = false;
    component.timer.startedAt = null;
    stopTimerInterval(component.id);
    updateDisplay();
    startButton.textContent = '재개';
    startButton.classList.replace('sw-btn-pause', 'sw-btn-start');
    time.classList.remove('running');
    time.classList.add('paused');
    saveTimerState(tabId, component.id, (timer) => {
      timer.elapsed = component.timer.elapsed;
      timer.running = false;
      timer.startedAt = null;
    });
  });

  resetButton.addEventListener('click', () => {
    component.timer.elapsed = 0;
    component.timer.running = false;
    component.timer.startedAt = null;
    component.timer.subject = '';
    stopTimerInterval(component.id);
    subjectInput.value = '';
    subjectInput.disabled = false;
    label.textContent = '';
    time.textContent = '00:00:00';
    time.classList.remove('running', 'paused');
    startButton.textContent = '시작';
    startButton.classList.remove('sw-btn-pause');
    startButton.classList.add('sw-btn-start');
    resetButton.style.display = 'none';
    saveTimerState(tabId, component.id, (timer) => {
      timer.subject = '';
      timer.elapsed = 0;
      timer.running = false;
      timer.startedAt = null;
    });
  });

  controls.append(startButton, resetButton);
  card.appendChild(controls);
}

function renderCustomPanel(root, tab) {
  stopAllTimerIntervals();
  root.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'custom-tab-toolbar';
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'btn-confirm custom-add-component-btn';
  addButton.textContent = '+ 블록';
  addButton.addEventListener('click', () => {
    activeTabId = tab.id;
    openModal('componentTemplateModal');
  });
  toolbar.appendChild(addButton);
  root.appendChild(toolbar);

  if (!tab.components || tab.components.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card custom-empty-card';
    empty.textContent = '블록을 추가해서 이 탭을 구성하세요';
    root.appendChild(empty);
    return;
  }

  tab.components.forEach((component, idx) => {
    const card = document.createElement('div');
    card.className = 'card custom-component-card';

    if (component.type === 'checklist') renderChecklist(card, tab.id, component);
    else if (component.type === 'priority') renderPriorityBlock(card, tab.id, component);
    else if (component.type === 'recordable') renderRecordableBlock(card, tab.id, component);
    else if (component.type === 'timer') renderTimer(card, tab.id, component);
    else {
      card.appendChild(makeHeader(tab.id, component, idx, tab.components.length));
      renderMemo(card, tab.id, component);
    }

    root.appendChild(card);
  });
}

export function renderCustomTabs() {
  const customTabs = getCustomTabs();
  document.querySelectorAll('[data-custom-tab-id]').forEach((root) => {
    const tab = customTabs.find((item) => item.id === root.dataset.customTabId);
    if (tab) renderCustomPanel(root, tab);
  });
}

export function initCustomTabs() {
  const templateList = document.getElementById('componentTemplateList');
  templateList.innerHTML = '';
  let composingBlockItem = false;
  let lastBlockItemAddedAt = 0;

  BLOCK_TEMPLATES.forEach((template) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'component-template-btn';
    button.textContent = template.label;
    button.addEventListener('click', () => {
      if (!activeTabId || !getTab(activeTabId)) return;
      updateTab(activeTabId, (tab) => {
        const component = {
          id: makeId(template.type),
          type: template.type,
          title: template.title,
          text: '',
          items: []
        };
        if (template.type === 'timer') {
          component.timer = { subject: '', elapsed: 0, running: false, startedAt: null };
        }
        if (template.type === 'priority') {
          component.priorities = [];
        }
        if (template.type === 'recordable') {
          component.records = [];
        }
        tab.components.push(component);
      });
      closeModal('componentTemplateModal');
    });
    templateList.appendChild(button);
  });

  document.getElementById('componentTemplateCancelBtn').addEventListener('click', () => {
    closeModal('componentTemplateModal');
  });

  function addBlockItem() {
    const now = Date.now();
    if (now - lastBlockItemAddedAt < 500) return;

    const input = document.getElementById('blockItemInput');
    const text = input.value.trim();
    if (!text || !activeBlockItem) return;

    updateTab(activeBlockItem.tabId, (tab) => {
      const block = tab.components.find((target) => target.id === activeBlockItem.blockId);
      if (!block) return;
      if (activeBlockItem.type === 'priority') {
        if (!Array.isArray(block.priorities)) block.priorities = [];
        block.priorities.push({
          text,
          done: false,
          priority: block.priorities.length + 1,
          subPriorities: []
        });
        return;
      }
      if (activeBlockItem.type === 'recordable') {
        if (!Array.isArray(block.records)) block.records = [];
        block.records.push({
          text,
          achieved: false,
          createdAt: new Date().toLocaleDateString('ko-KR'),
          achievedAt: null
        });
        return;
      }
      if (!Array.isArray(block.items)) block.items = [];
      block.items.push({ text, done: false });
    });

    input.value = '';
    lastBlockItemAddedAt = now;
    closeModal('blockItemModal');
  }

  document.getElementById('blockItemConfirmBtn').addEventListener('click', addBlockItem);
  document.getElementById('blockItemCancelBtn').addEventListener('click', () => closeModal('blockItemModal'));
  document.getElementById('blockItemModal').addEventListener('click', (e) => {
    if (e.target.id === 'blockItemModal') closeModal('blockItemModal');
  });

  const blockInput = document.getElementById('blockItemInput');
  blockInput.addEventListener('compositionstart', () => {
    composingBlockItem = true;
  });
  blockInput.addEventListener('compositionend', () => {
    composingBlockItem = false;
  });
  blockInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.isComposing || composingBlockItem || e.keyCode === 229) return;
    e.preventDefault();
    addBlockItem();
  });
}
