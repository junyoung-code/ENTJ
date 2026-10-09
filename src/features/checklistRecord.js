function appendRecordItem(container, item, index) {
  const row = document.createElement('div');
  row.className = 'record-item' + (item.done ? ' done-item' : '');
  const status = document.createElement('span');
  status.className = 'record-checklist-status' + (item.done ? ' done' : ' undone');
  status.textContent = String(index + 1);
  status.title = item.done ? '완료' : '미완료';
  const text = document.createElement('span');
  text.className = 'record-text-inline';
  text.textContent = item.text;
  row.append(status, text);
  container.appendChild(row);
}

export function renderChecklistRecord(container, items) {
  items.forEach((item, index) => {
    const group = document.createElement('div');
    group.className = 'record-checklist-group';
    appendRecordItem(group, item, index);

    if (item.subPriorities?.length) {
      const details = document.createElement('div');
      details.className = 'record-checklist-details';
      item.subPriorities.forEach((detail, detailIndex) => {
        appendRecordItem(details, detail, detailIndex);
      });
      group.appendChild(details);
    }
    container.appendChild(group);
  });
}
