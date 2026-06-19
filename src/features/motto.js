import { getMotto, saveMotto } from '../storage/storage.js';

export function renderMotto() {
  const el = document.getElementById('mottoDisplay');
  const val = getMotto();
  if (val) {
    el.textContent = val;
    el.classList.remove('placeholder');
  } else {
    el.textContent = '좌우명을 입력하세요';
    el.classList.add('placeholder');
  }
}

export function initMotto() {
  document.getElementById('mottoDisplay').addEventListener('click', function () {
    const wrap = this.parentElement;
    const originalEl = this;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'motto-input';
    input.value = getMotto();
    input.maxLength = 60;
    input.placeholder = '나만의 좌우명을 입력하세요';

    wrap.replaceChild(input, originalEl);
    input.focus();
    input.setSelectionRange(0, 0);

    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      saveMotto(input.value.trim());
      wrap.replaceChild(originalEl, input);
      renderMotto();
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      }
      if (e.key === 'Escape') {
        committed = true;
        wrap.replaceChild(originalEl, input);
        renderMotto();
      }
    });
  });
}
