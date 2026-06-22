import { getGoals, saveGoals } from '../storage/storage.js';
import { createCollectionFeature } from './collection.js';

const goals = createCollectionFeature({
  getItems: getGoals,
  saveItems: saveGoals,
  itemClass: 'goal',
  maxLength: 200,
  achievedLabel: '달성',
  ids: {
    activeList: 'goalList',
    achievedList: 'achievedGoalList',
    activeEmpty: 'goalEmpty',
    achievedEmpty: 'achievedGoalEmpty',
    modal: 'goalModal',
    input: 'goalInput',
    openButton: 'addGoalBtn',
    cancelButton: 'goalCancelBtn',
    confirmButton: 'goalConfirmBtn'
  }
});

export const initGoals = goals.init;
export const renderGoals = goals.render;
