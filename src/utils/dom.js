export function openModal(id, inputId) {
  document.getElementById(id).classList.add('open');
  setTimeout(() => document.getElementById(inputId).focus(), 50);
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

