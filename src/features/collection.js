import { closeModal, initModalForm, startTextEdit } from '../utils/dom.js';

function isAchieved(item) {
  return item.achieved === true || String(item.achieved).toLowerCase() === 'true';
}

export function normalizePriorities(items) {
  let changed = false;
  items.forEach((item, index) => {
    const priority = index + 1;
    if (item.priority !== priority) {
      item.priority = priority;
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

export function createCollectionFeature(config) {
  const {
    getItems,
    saveItems,
    itemClass,
    ids,
    maxLength,
    achievedLabel,
    createdFallback = '',
    deleteTitle = '',
    ranked = false,
    subItems = false
  } = config;

  function getSubItems(item) {
    if (!Array.isArray(item.subItems)) item.subItems = [];
    return item.subItems;
  }

  function syncAchievedFromSubItems(item) {
    const details = getSubItems(item);
    if (details.length > 0) item.achieved = details.every((detail) => detail.achieved);
  }

  function makeDetailAddButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'priority-detail-add-btn';
    button.textContent = '+ 세부 목표';
    return button;
  }

  function startSubItemAdd(list, items, item, idx) {
    const details = getSubItems(item);
    const editRow = document.createElement('div');
    editRow.className = 'priority-detail-edit-row';

    const number = document.createElement('span');
    number.className = 'priority-detail-number';
    number.textContent = String(details.length + 1);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input priority-detail-input';
    input.maxLength = maxLength;
    input.placeholder = '세부 목표 입력';

    let finished = false;
    let composing = false;
    const finish = (save) => {
      if (finished || composing) return;
      const value = input.value.trim();
      finished = true;
      if (save && value) {
        details.push({ text: value, achieved: false });
        saveItems(items);
        render();
      } else {
        editRow.remove();
      }
    };

    input.addEventListener('compositionstart', () => {
      composing = true;
    });
    input.addEventListener('compositionend', () => {
      composing = false;
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (event.isComposing || composing || event.keyCode === 229) return;
        finish(true);
      }
      if (event.key === 'Escape') finish(false);
    });

    editRow.append(number, input);
    list.appendChild(editRow);
    input.focus();
  }

  function appendSubItems(container, items, item, idx) {
    const details = getSubItems(item);
    const list = document.createElement('ul');
    list.className = 'priority-detail-list';

    details.forEach((detail, detailIdx) => {
      const row = document.createElement('li');
      row.className = 'priority-detail-item' + (detail.achieved ? ' done' : '');

      const number = document.createElement('button');
      number.type = 'button';
      number.className = 'priority-detail-number';
      number.textContent = String(detailIdx + 1);
      number.title = detail.achieved ? '세부 목표 미달성 처리' : '세부 목표 달성';
      number.addEventListener('click', () => {
        details[detailIdx].achieved = !details[detailIdx].achieved;
        syncAchievedFromSubItems(items[idx]);
        saveItems(items);
        render();
      });

      const text = document.createElement('span');
      text.className = 'priority-detail-text';
      text.textContent = detail.text;
      text.title = '클릭해서 수정';
      text.addEventListener('click', () => startTextEdit(text, detail.text, (nextText) => {
        details[detailIdx].text = nextText;
        saveItems(items);
        render();
      }, maxLength));

      const del = document.createElement('button');
      del.className = 'delete-btn priority-detail-delete';
      del.textContent = '×';
      del.addEventListener('click', () => {
        details.splice(detailIdx, 1);
        syncAchievedFromSubItems(items[idx]);
        saveItems(items);
        render();
      });

      row.append(number, text, del);
      list.appendChild(row);
    });

    container.appendChild(list);
    return list;
  }

  function renderItem(list, items, item, idx, group) {
    const achieved = isAchieved(item);
    const li = document.createElement('li');
    li.className = `${itemClass}-item`
      + (achieved ? ' achieved' : '')
      + (ranked ? ' priority-item' : '')
      + (ranked && achieved ? ' done' : '');

    const complete = (nextAchieved) => {
      items[idx].achieved = nextAchieved;
      items[idx].achievedAt = nextAchieved ? new Date().toLocaleDateString('ko-KR') : null;
      if (subItems) {
        getSubItems(items[idx]).forEach((detail) => {
          detail.achieved = nextAchieved;
        });
      }
      saveItems(items);
      render();
    };

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'delete-btn';
    del.textContent = '×';
    if (deleteTitle) del.title = deleteTitle;
    del.addEventListener('click', () => {
      items.splice(idx, 1);
      saveItems(items);
      render();
    });

    if (!ranked) {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = achieved;
      checkbox.addEventListener('change', () => complete(checkbox.checked));

      const body = document.createElement('div');
      body.className = `${itemClass}-body`;

      const text = document.createElement('div');
      text.className = `${itemClass}-text`;
      text.textContent = item.text;
      text.title = '클릭해서 수정';
      text.addEventListener('click', () => startTextEdit(text, item.text, (nextText) => {
        items[idx].text = nextText;
        saveItems(items);
        render();
      }, maxLength, { block: true }));

      const meta = document.createElement('div');
      meta.className = `${itemClass}-meta`;
      meta.textContent = achieved && item.achievedAt
        ? `${achievedLabel} ${item.achievedAt}`
        : `추가 ${item.createdAt || createdFallback}`;

      body.append(text, meta);
      li.append(checkbox, body, del);
      list.appendChild(li);
      return;
    }

    const row = document.createElement('div');
    row.className = 'priority-main-row';
    const rank = document.createElement('button');
    rank.type = 'button';
    rank.className = 'priority-rank';
    rank.textContent = String(item.priority);
    rank.title = achieved ? `${achievedLabel} 취소` : achievedLabel;
    rank.addEventListener('click', () => complete(!isAchieved(items[idx])));

    const controls = document.createElement('div');
    controls.className = 'priority-controls';
    const groupIndex = group.findIndex((entry) => entry.idx === idx);
    [['↑', '순서 올리기', groupIndex - 1], ['↓', '순서 내리기', groupIndex + 1]].forEach(([label, title, targetIndex]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'priority-move-btn';
      button.textContent = label;
      button.title = title;
      button.disabled = targetIndex < 0 || targetIndex >= group.length;
      button.addEventListener('click', () => {
        const to = group[targetIndex]?.idx;
        if (moveItem(items, idx, to)) {
          saveItems(items);
          render();
        }
      });
      controls.appendChild(button);
    });

    const text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = item.text;
    text.title = '클릭해서 수정';
    text.addEventListener('click', () => startTextEdit(text, item.text, (nextText) => {
      items[idx].text = nextText;
      saveItems(items);
      render();
    }, maxLength));

    if (subItems) {
      const details = document.createElement('div');
      details.className = 'priority-detail-wrap';
      const detailList = appendSubItems(details, items, item, idx);
      const addDetail = makeDetailAddButton();
      addDetail.addEventListener('click', () => startSubItemAdd(detailList, items, item, idx));
      row.append(rank, text, addDetail, controls, del);
      li.append(row, details);
    } else {
      row.append(rank, text, controls, del);
      li.appendChild(row);
    }
    list.appendChild(li);
  }

  function render() {
    const items = getItems();
    if (ranked && normalizePriorities(items)) saveItems(items);
    const activeList = document.getElementById(ids.activeList);
    const achievedList = document.getElementById(ids.achievedList);
    activeList.innerHTML = '';
    achievedList.innerHTML = '';

    const activeItems = [];
    const achievedItems = [];
    items.forEach((item, idx) => {
      (isAchieved(item) ? achievedItems : activeItems).push({ item, idx });
    });

    document.getElementById(ids.activeEmpty).style.display = activeItems.length === 0 ? 'block' : 'none';
    document.getElementById(ids.achievedEmpty).style.display = achievedItems.length === 0 ? 'block' : 'none';
    activeItems.forEach(({ item, idx }) => renderItem(activeList, items, item, idx, activeItems));
    achievedItems.forEach(({ item, idx }) => renderItem(achievedList, items, item, idx, achievedItems));
  }

  function confirmItem() {
    const input = document.getElementById(ids.input);
    const value = input.value.trim();
    if (!value) return;

    const items = getItems();
    items.push({
      text: value,
      achieved: false,
      createdAt: new Date().toLocaleDateString('ko-KR'),
      achievedAt: null
    });
    input.value = '';
    saveItems(items);
    closeModal(ids.modal);
    render();
  }

  function init() {
    initModalForm({
      modalId: ids.modal,
      inputId: ids.input,
      openButtonId: ids.openButton,
      cancelButtonId: ids.cancelButton,
      confirmButtonId: ids.confirmButton,
      onConfirm: confirmItem,
      allowShiftEnter: true
    });
  }

  return { init, render };
}
