import { formatDateLabel, previousDateKey, todayKey } from '../utils/date.js';
import { getUnfinishedByDate, importChecklistByDate } from '../storage/storage.js';

export function makeChecklistImportButton(source, onImport) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'checklist-import-btn';
  button.textContent = '미완료 가져오기';
  button.addEventListener('click', () => openChecklistImport(source, onImport));
  return button;
}

function openChecklistImport(source, onImport) {
  const targetDate = todayKey();
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  const modal = document.createElement('div');
  modal.className = 'modal checklist-import-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', '미완료 가져오기');
  const title = document.createElement('h3');
  title.textContent = '미완료 가져오기';
  const destination = document.createElement('p');
  destination.className = 'checklist-import-destination';
  destination.textContent = `${formatDateLabel(targetDate)} 목록에 추가합니다.`;
  const label = document.createElement('label');
  label.textContent = '불러올 날짜';
  const date = document.createElement('input');
  date.type = 'date';
  date.value = previousDateKey(targetDate);
  date.max = date.value;
  label.appendChild(date);
  const list = document.createElement('div');
  list.className = 'checklist-import-list';
  const status = document.createElement('p');
  status.className = 'checklist-import-status';
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'modal-actions checklist-import-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'btn-cancel';
  cancel.textContent = '닫기';
  const selected = document.createElement('button');
  selected.type = 'button';
  selected.className = 'btn-confirm';
  selected.textContent = '선택 항목 가져오기';
  const all = document.createElement('button');
  all.type = 'button';
  all.className = 'btn-confirm';
  all.textContent = '모두 가져오기';
  let checkboxes = [];

  function updateSelection() {
    selected.disabled = !checkboxes.some((checkbox) => checkbox.checked);
  }

  function renderCandidates() {
    list.innerHTML = '';
    checkboxes = [];
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(date.value) && date.value < targetDate;
    const candidates = valid ? getUnfinishedByDate(date.value, source, targetDate) : [];
    all.disabled = !candidates.some((candidate) => !candidate.alreadyImported);
    updateSelection();
    if (!candidates.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = valid ? '이 날짜에 미완료 항목이 없어요.' : '오늘보다 이전 날짜를 선택해주세요.';
      list.appendChild(empty);
      return;
    }
    candidates.forEach(({ item, alreadyImported }) => {
      const row = document.createElement('label');
      row.className = 'checklist-import-item' + (alreadyImported ? ' already-imported' : '');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = item.id;
      checkbox.disabled = alreadyImported;
      checkbox.addEventListener('change', updateSelection);
      checkboxes.push(checkbox);
      const body = document.createElement('span');
      const text = document.createElement('strong');
      text.textContent = `${item.priority ? `${item.priority}. ` : ''}${item.text}${alreadyImported ? ' · 이미 가져온 항목' : ''}`;
      body.appendChild(text);
      (item.subPriorities || []).forEach((detail) => {
        const line = document.createElement('span');
        line.className = 'checklist-import-detail' + (detail.done ? ' done' : '');
        line.textContent = `${detail.done ? '✓' : '○'} ${detail.text}`;
        body.appendChild(line);
      });
      row.append(checkbox, body);
      list.appendChild(row);
    });
  }

  function importItems(ids) {
    const count = importChecklistByDate(date.value, targetDate, source, ids);
    if (count) onImport();
    status.textContent = count ? `${count}개 항목을 가져왔어요.` : '추가로 가져올 항목이 없어요.';
    renderCandidates();
  }

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const focusable = [...modal.querySelectorAll('input, button')].filter((element) => !element.disabled);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  date.addEventListener('change', () => { status.textContent = ''; renderCandidates(); });
  cancel.addEventListener('click', close);
  selected.addEventListener('click', () => importItems(checkboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.value)));
  all.addEventListener('click', () => importItems(null));
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', onKeydown);
  actions.append(cancel, selected, all);
  modal.append(title, destination, label, list, status, actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  renderCandidates();
  date.focus();
}
