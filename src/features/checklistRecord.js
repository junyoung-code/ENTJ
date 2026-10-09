import { startTextEdit } from '../utils/dom.js';
import { normalizeChecklist, setItemDone, syncItemDone } from '../storage/checklists.js';

function makeButton(text, className, title, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

function appendMoveButtons(row, items, index, onSave) {
  const controls = document.createElement('div');
  controls.className = 'priority-controls';
  [-1, 1].forEach((offset) => {
    const destination = index + offset;
    const button = makeButton(offset < 0 ? '↑' : '↓', 'priority-move-btn', offset < 0 ? '순서 올리기' : '순서 내리기', () => {
      const [item] = items.splice(index, 1);
      items.splice(destination, 0, item);
      onSave();
    });
    button.disabled = destination < 0 || destination >= items.length;
    controls.appendChild(button);
  });
  row.appendChild(controls);
}

export function renderChecklistRecord(container, items, ranked, onSave) {
  const save = () => {
    normalizeChecklist(items, 'record', ranked);
    onSave();
  };
  items.forEach((item, index) => {
    const group = document.createElement('div');
    group.className = 'record-checklist-group';
    const row = document.createElement('div');
    row.className = 'record-item' + (item.done ? ' done-item' : '');
    const toggle = makeButton(ranked ? String(index + 1) : (item.done ? '✓' : '○'), 'record-toggle-btn' + (item.done ? ' done' : ' undone'), item.done ? '완료 해제' : '완료', () => {
      setItemDone(item, !item.done);
      save();
    });
    const text = makeButton(item.text, 'record-text-btn', '클릭해서 수정', () => {
      startTextEdit(text, item.text, (nextText) => { item.text = nextText; save(); });
    });
    row.append(toggle, text);
    appendMoveButtons(row, items, index, save);
    row.appendChild(makeButton('×', 'delete-btn', '항목 삭제', () => {
      items.splice(index, 1);
      save();
    }));
    group.appendChild(row);

    if (ranked || item.subPriorities?.length) {
      const details = document.createElement('div');
      details.className = 'record-checklist-details';
      (item.subPriorities || []).forEach((detail, detailIndex) => {
        const detailRow = document.createElement('div');
        detailRow.className = 'record-item' + (detail.done ? ' done-item' : '');
        const detailToggle = makeButton(String(detailIndex + 1), 'record-toggle-btn' + (detail.done ? ' done' : ' undone'), detail.done ? '세부 완료 해제' : '세부 완료', () => {
          detail.done = !detail.done;
          syncItemDone(item);
          save();
        });
        const detailText = makeButton(detail.text, 'record-text-btn', '클릭해서 세부사항 수정', () => {
          startTextEdit(detailText, detail.text, (nextText) => { detail.text = nextText; save(); }, 100);
        });
        detailRow.append(detailToggle, detailText);
        appendMoveButtons(detailRow, item.subPriorities, detailIndex, save);
        detailRow.appendChild(makeButton('×', 'delete-btn', '세부사항 삭제', () => {
          item.subPriorities.splice(detailIndex, 1);
          syncItemDone(item);
          save();
        }));
        details.appendChild(detailRow);
      });
      const add = makeButton('+ 세부 우선순위', 'priority-detail-add-btn', '세부사항 추가', () => {
        const editor = document.createElement('span');
        details.appendChild(editor);
        startTextEdit(editor, '', (text) => {
          item.subPriorities ||= [];
          item.subPriorities.push({ id: crypto.randomUUID(), text, done: false });
          syncItemDone(item);
          save();
        }, 100);
      });
      details.appendChild(add);
      group.appendChild(details);
    }
    container.appendChild(group);
  });
}
