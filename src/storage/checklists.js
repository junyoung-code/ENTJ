export function syncItemDone(item) {
  if (item.subPriorities?.length) {
    item.done = item.subPriorities.every((detail) => detail.done);
  }
}

export function setItemDone(item, done) {
  item.done = done;
  (item.subPriorities || []).forEach((detail) => { detail.done = done; });
}

export function normalizeChecklist(items, idPrefix, ranked = true) {
  items.forEach((item, index) => {
    if (!item.id) item.id = `${idPrefix}:${index}`;
    if (ranked) item.priority = index + 1;
    (item.subPriorities || []).forEach((detail, detailIndex) => {
      if (!detail.id) detail.id = `${item.id}:detail:${detailIndex}`;
    });
    syncItemDone(item);
  });
}

export function importUnfinishedItems(source, target, selectedIds = null, ranked = true) {
  const existing = new Set(target.map((item) => item.id));
  const selected = selectedIds === null ? null : new Set(selectedIds);
  let count = 0;
  source.forEach((item) => {
    if (item.done || existing.has(item.id) || (selected && !selected.has(item.id))) return;
    target.push(structuredClone(item));
    existing.add(item.id);
    count += 1;
  });
  normalizeChecklist(target, 'imported', ranked);
  return count;
}

export function checklistRate(rec) {
  const items = rec?.todos || [];
  const total = items.length;
  if (!total) return null;
  const done = items.filter((item) => item.done).length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

export function migrateChecklistHistory(records, tabs, date) {
  const beforeRecords = JSON.stringify(records);
  const beforeTabs = JSON.stringify(tabs);
  Object.entries(records).forEach(([key, rec]) => {
    rec.todos ||= [];
    rec.daily ||= {};
    rec.customChecklists ||= [];
    normalizeChecklist(rec.todos, `todo:${key}`);
    rec.customChecklists.forEach((checklist) => {
      normalizeChecklist(checklist.items, `${key}:${checklist.tabId}:${checklist.blockId}`, checklist.type === 'priority');
    });
  });

  tabs.forEach((tab) => {
    (tab.components || []).forEach((component) => {
      if (component.type !== 'checklist' && component.type !== 'priority') return;
      const legacy = component.type === 'priority' ? component.priorities : component.items;
      const alreadyMigrated = Object.values(records).some((rec) => rec.customChecklists.some((checklist) => (
        checklist.tabId === tab.id && checklist.blockId === component.id && checklist.importedLegacy
      )));
      if (legacy?.length && !alreadyMigrated) {
        const rec = records[date] ||= { todos: [], daily: {}, customChecklists: [] };
        let checklist = rec.customChecklists.find((item) => item.tabId === tab.id && item.blockId === component.id);
        if (!checklist) {
          checklist = { tabId: tab.id, blockId: component.id, tabTitle: tab.label, title: component.title, type: component.type, items: [] };
          rec.customChecklists.push(checklist);
        }
        const copied = structuredClone(legacy);
        normalizeChecklist(copied, `legacy:${tab.id}:${component.id}`, component.type === 'priority');
        const existing = new Set(checklist.items.map((item) => item.id));
        copied.forEach((item) => {
          if (!existing.has(item.id)) checklist.items.push(item);
        });
        normalizeChecklist(checklist.items, `${date}:${tab.id}:${component.id}`, component.type === 'priority');
        checklist.importedLegacy = true;
      }
      delete component.items;
      delete component.priorities;
    });
  });
  return {
    recordsChanged: beforeRecords !== JSON.stringify(records),
    tabsChanged: beforeTabs !== JSON.stringify(tabs)
  };
}
