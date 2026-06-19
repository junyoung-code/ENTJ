// ── 아이디어 렌더링 ───────────────────────────────────

function isIdeaAchieved(idea) {
  return idea.achieved === true || String(idea.achieved).toLowerCase() === 'true';
}

function appendIdeaItem(list, ideas, idea, idx) {
  const li = document.createElement('li');
  li.className = 'idea-item' + (isIdeaAchieved(idea) ? ' achieved' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = isIdeaAchieved(idea);
  cb.addEventListener('change', () => {
    ideas[idx].achieved = cb.checked;
    ideas[idx].achievedAt = cb.checked ? new Date().toLocaleDateString('ko-KR') : null;
    saveIdeas(ideas);
    renderIdeas();
  });

  const body = document.createElement('div');
  body.className = 'idea-body';

  const text = document.createElement('div');
  text.className = 'idea-text';
  text.textContent = idea.text;

  const meta = document.createElement('div');
  meta.className = 'idea-meta';
  meta.textContent = isIdeaAchieved(idea) && idea.achievedAt
    ? `완수 ${idea.achievedAt}`
    : `추가 ${idea.createdAt || '날짜 없음'}`;

  body.append(text, meta);

  const del = document.createElement('button');
  del.className = 'delete-btn';
  del.title = '아이디어 삭제';
  del.textContent = '×';
  del.addEventListener('click', () => {
    ideas.splice(idx, 1);
    saveIdeas(ideas);
    renderIdeas();
  });

  li.append(cb, body, del);
  list.appendChild(li);
}

function renderIdeas() {
  const ideas = getIdeas();
  const list = document.getElementById('ideaList');
  const achievedList = document.getElementById('achievedIdeaList');
  const empty = document.getElementById('ideaEmpty');
  const achievedEmpty = document.getElementById('achievedIdeaEmpty');

  list.innerHTML = '';
  achievedList.innerHTML = '';

  const activeIdeas = [];
  const achievedIdeas = [];
  ideas.forEach((idea, idx) => {
    if (isIdeaAchieved(idea)) achievedIdeas.push({ idea, idx });
    else activeIdeas.push({ idea, idx });
  });

  empty.style.display = activeIdeas.length === 0 ? 'block' : 'none';
  achievedEmpty.style.display = achievedIdeas.length === 0 ? 'block' : 'none';

  activeIdeas.forEach(({ idea, idx }) => {
    appendIdeaItem(list, ideas, idea, idx);
  });
  achievedIdeas.forEach(({ idea, idx }) => {
    appendIdeaItem(achievedList, ideas, idea, idx);
  });
}

// ── 아이디어 모달 ─────────────────────────────────────

function confirmIdea() {
  const input = document.getElementById('ideaInput');
  const val = input.value.trim();
  if (!val) return;

  const ideas = getIdeas();
  ideas.push({
    text: val,
    achieved: false,
    createdAt: new Date().toLocaleDateString('ko-KR'),
    achievedAt: null
  });
  input.value = '';
  saveIdeas(ideas);
  closeModal('ideaModal');
  renderIdeas();
}

document.getElementById('addIdeaBtn').addEventListener('click', () => {
  document.getElementById('ideaInput').value = '';
  openModal('ideaModal', 'ideaInput');
});

document.getElementById('ideaCancelBtn').addEventListener('click', () => closeModal('ideaModal'));
document.getElementById('ideaModal').addEventListener('click', e => {
  if (e.target === document.getElementById('ideaModal')) closeModal('ideaModal');
});
document.getElementById('ideaConfirmBtn').addEventListener('click', confirmIdea);
document.getElementById('ideaInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmIdea(); }
});
