export function openModal(id, inputId) {
  document.getElementById(id).classList.add('open');
  if (inputId) setTimeout(() => document.getElementById(inputId).focus(), 50);
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

export function initModalForm({
  modalId,
  inputId,
  openButtonId,
  cancelButtonId,
  confirmButtonId,
  onConfirm,
  allowShiftEnter = false
}) {
  const modal = document.getElementById(modalId);
  const input = document.getElementById(inputId);

  document.getElementById(openButtonId).addEventListener('click', () => {
    input.value = '';
    openModal(modalId, inputId);
  });
  document.getElementById(cancelButtonId).addEventListener('click', () => closeModal(modalId));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modalId);
  });
  document.getElementById(confirmButtonId).addEventListener('click', onConfirm);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (!allowShiftEnter || !e.shiftKey)) {
      e.preventDefault();
      onConfirm();
    }
  });
}

export function startTextEdit(el, initialText, onSave, maxLength = 80, options = {}) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-edit-input';
  if (options.block) input.classList.add('block-edit-input');
  if (options.className) input.classList.add(options.className);
  input.value = initialText;
  input.maxLength = maxLength;

  let finished = false;
  let composing = false;
  let outsideListenerAttached = false;
  const removeOutsideListener = () => {
    if (!outsideListenerAttached) return;
    document.removeEventListener('pointerdown', handlePointerDownOutside, true);
    outsideListenerAttached = false;
  };
  const handlePointerDownOutside = (event) => {
    if (event.target === input) return;
    if (input.contains(event.target)) return;
    finish(true);
  };
  const finish = (save) => {
    if (finished || composing) return;
    finished = true;
    removeOutsideListener();
    const nextText = input.value.trim();
    if (save && nextText) onSave(nextText);
    else input.replaceWith(el);
  };

  input.addEventListener('compositionstart', () => {
    composing = true;
  });
  input.addEventListener('compositionend', () => {
    composing = false;
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.isComposing || composing || e.keyCode === 229) return;
      finish(true);
    }
    if (e.key === 'Escape') finish(false);
  });

  el.replaceWith(input);
  input.focus();
  input.select();
  setTimeout(() => {
    if (finished) return;
    outsideListenerAttached = true;
    document.addEventListener('pointerdown', handlePointerDownOutside, true);
  }, 0);
}
