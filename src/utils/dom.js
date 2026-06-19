export function openModal(id, inputId) {
  document.getElementById(id).classList.add('open');
  setTimeout(() => document.getElementById(inputId).focus(), 50);
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

export function startTextEdit(el, initialText, onSave, maxLength = 80, options = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input' + (options.block ? ' block-edit-input' : '');
  input.value = initialText;
  input.maxLength = maxLength;

  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    const nextText = input.value.trim();
    if (save && nextText) onSave(nextText);
    else input.replaceWith(el);
  };

  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });

  el.replaceWith(input);
  input.focus();
  input.select();
}
