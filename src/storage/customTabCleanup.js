import { deleteBlockImageData } from './media.js';
import { deleteJournalBlock } from './journal.js';

export async function deleteCustomComponentData(component, tabId) {
  if (component.type === 'image') {
    await deleteBlockImageData(component);
  } else if (component.type === 'journal') {
    await deleteJournalBlock(component.id);
  }
}

export async function deleteCustomTabData(tab) {
  const components = Array.isArray(tab?.components) ? tab.components : [];
  await Promise.all(components.map((component) => deleteCustomComponentData(component, tab.id)));
}
