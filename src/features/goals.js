import { closeModal, openModal } from '../utils/dom.js';
import { getGoals, saveGoals } from '../storage/storage.js';

function confirmGoal() {
  const input = document.getElementById('goalInput');
  const val = input.value.trim();
  if (!val) return;
  const goals = getGoals();
  goals.push({
    text: val,
    achieved: false,
    createdAt: new Date().toLocaleDateString('ko-KR'),
    achievedAt: null
  });
  input.value = '';
  saveGoals(goals);
  closeModal('goalModal');
  renderGoals();
}

export function renderGoals() {
  const goals = getGoals();
  const list = document.getElementById('goalList');
  const empty = document.getElementById('goalEmpty');
  list.innerHTML = '';

  if (goals.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  goals.forEach((goal, idx) => {
    const li = document.createElement('li');
    li.className = 'goal-item' + (goal.achieved ? ' achieved' : '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!goal.achieved;
    cb.addEventListener('change', () => {
      goals[idx].achieved = cb.checked;
      goals[idx].achievedAt = cb.checked ? new Date().toLocaleDateString('ko-KR') : null;
      saveGoals(goals);
      renderGoals();
    });

    const body = document.createElement('div');
    body.className = 'goal-body';

    const text = document.createElement('div');
    text.className = 'goal-text';
    text.textContent = goal.text;

    const meta = document.createElement('div');
    meta.className = 'goal-meta';
    meta.textContent = goal.achieved && goal.achievedAt ? `달성 ${goal.achievedAt}` : `추가 ${goal.createdAt}`;

    body.append(text, meta);

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.addEventListener('click', () => {
      goals.splice(idx, 1);
      saveGoals(goals);
      renderGoals();
    });

    li.append(cb, body, del);
    list.appendChild(li);
  });
}

export function initGoals() {
  document.getElementById('addGoalBtn').addEventListener('click', () => {
    document.getElementById('goalInput').value = '';
    openModal('goalModal', 'goalInput');
  });
  document.getElementById('goalCancelBtn').addEventListener('click', () => closeModal('goalModal'));
  document.getElementById('goalModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('goalModal')) closeModal('goalModal');
  });
  document.getElementById('goalConfirmBtn').addEventListener('click', confirmGoal);
  document.getElementById('goalInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      confirmGoal();
    }
  });
}

