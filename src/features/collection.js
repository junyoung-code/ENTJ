import { closeModal, initModalForm, startTextEdit } from '../utils/dom.js';

function isAchieved(item) {
  return item.achieved === true || String(item.achieved).toLowerCase() === 'true';
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
    deleteTitle = ''
  } = config;

  function renderItem(list, items, item, idx) {
    const achieved = isAchieved(item);
    const li = document.createElement('li');
    li.className = `${itemClass}-item` + (achieved ? ' achieved' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = achieved;
    checkbox.addEventListener('change', () => {
      items[idx].achieved = checkbox.checked;
      items[idx].achievedAt = checkbox.checked ? new Date().toLocaleDateString('ko-KR') : null;
      saveItems(items);
      render();
    });

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

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    if (deleteTitle) del.title = deleteTitle;
    del.addEventListener('click', () => {
      items.splice(idx, 1);
      saveItems(items);
      render();
    });

    body.append(text, meta);
    li.append(checkbox, body, del);
    list.appendChild(li);
  }

  function render() {
    const items = getItems();
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
    activeItems.forEach(({ item, idx }) => renderItem(activeList, items, item, idx));
    achievedItems.forEach(({ item, idx }) => renderItem(achievedList, items, item, idx));
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
