import { getIdeas, saveIdeas } from '../storage/storage.js';
import { createCollectionFeature } from './collection.js';

const ideas = createCollectionFeature({
  getItems: getIdeas,
  saveItems: saveIdeas,
  itemClass: 'idea',
  maxLength: 300,
  achievedLabel: '완수',
  createdFallback: '날짜 없음',
  deleteTitle: '아이디어 삭제',
  ids: {
    activeList: 'ideaList',
    achievedList: 'achievedIdeaList',
    activeEmpty: 'ideaEmpty',
    achievedEmpty: 'achievedIdeaEmpty',
    modal: 'ideaModal',
    input: 'ideaInput',
    openButton: 'addIdeaBtn',
    cancelButton: 'ideaCancelBtn',
    confirmButton: 'ideaConfirmBtn'
  }
});

export const initIdeas = ideas.init;
export const renderIdeas = ideas.render;
