import { closeModal, openModal } from '../utils/dom.js';

const DURATION_OPTIONS = {
  hours: Array.from({ length: 24 }, (_, value) => value),
  minutes: Array.from({ length: 60 }, (_, value) => value)
};

let activeTimePicker = null;
let initialized = false;

export function normalizeDuration(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    hours: Number.isInteger(source.hours) ? source.hours : 0,
    minutes: Number.isInteger(source.minutes) ? source.minutes : 0,
    seconds: Number.isInteger(source.seconds) ? source.seconds : 0
  };
}

function formatTwoDigits(value) {
  return String(value).padStart(2, '0');
}

export function formatExerciseDuration(duration) {
  const { hours, minutes } = normalizeDuration(duration);
  return `${formatTwoDigits(hours)}:${formatTwoDigits(minutes)}`;
}

function renderTimeWheel(container, values, selectedValue) {
  container.innerHTML = '';
  values.forEach((value) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'exercise-time-wheel-option';
    button.textContent = formatTwoDigits(value);
    button.dataset.value = String(value);
    if (value === selectedValue) button.classList.add('active');
    button.addEventListener('click', () => {
      container.querySelectorAll('.exercise-time-wheel-option').forEach((option) => {
        option.classList.toggle('active', option === button);
      });
      button.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    container.appendChild(button);
  });
}

function getSelectedWheelValue(container) {
  const activeButton = container.querySelector('.exercise-time-wheel-option.active');
  return activeButton ? Number(activeButton.dataset.value) : 0;
}

function scrollWheelToValue(container, value) {
  const target = container.querySelector(`[data-value="${value}"]`);
  if (!target) return;
  requestAnimationFrame(() => {
    target.scrollIntoView({ block: 'center' });
  });
}

export function openExerciseTimePicker(duration, onApply) {
  const nextDuration = normalizeDuration(duration);
  activeTimePicker = { onApply };

  const hourWheel = document.getElementById('exerciseHourWheel');
  const minuteWheel = document.getElementById('exerciseMinuteWheel');
  renderTimeWheel(hourWheel, DURATION_OPTIONS.hours, nextDuration.hours);
  renderTimeWheel(minuteWheel, DURATION_OPTIONS.minutes, nextDuration.minutes);
  scrollWheelToValue(hourWheel, nextDuration.hours);
  scrollWheelToValue(minuteWheel, nextDuration.minutes);
  openModal('exerciseTimeModal');
}

function closeExerciseTimePicker() {
  activeTimePicker = null;
  closeModal('exerciseTimeModal');
}

export function makeTimePickerTrigger(duration = { hours: 0, minutes: 0, seconds: 0 }) {
  const value = normalizeDuration(duration);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'exercise-time-trigger';

  const valueText = document.createElement('span');
  valueText.className = 'exercise-time-trigger-value';
  valueText.textContent = formatExerciseDuration(value);

  const syncLabel = () => {
    valueText.textContent = formatExerciseDuration(value);
  };

  button.addEventListener('click', () => {
    openExerciseTimePicker(value, (nextDuration) => {
      value.hours = nextDuration.hours;
      value.minutes = nextDuration.minutes;
      value.seconds = nextDuration.seconds || 0;
      syncLabel();
    });
  });

  button.append(valueText);

  const field = document.createElement('div');
  field.className = 'exercise-set-field exercise-time-field';
  field.appendChild(button);

  return {
    element: field,
    getValue() {
      return { ...value };
    },
    focus() {
      button.focus();
    }
  };
}

export function initExerciseTimePicker() {
  if (initialized) return;
  initialized = true;

  const timeModal = document.getElementById('exerciseTimeModal');
  document.getElementById('exerciseTimeCancelBtn').addEventListener('click', closeExerciseTimePicker);
  document.getElementById('exerciseTimeConfirmBtn').addEventListener('click', () => {
    if (!activeTimePicker) {
      closeExerciseTimePicker();
      return;
    }
    const duration = {
      hours: getSelectedWheelValue(document.getElementById('exerciseHourWheel')),
      minutes: getSelectedWheelValue(document.getElementById('exerciseMinuteWheel')),
      seconds: 0
    };
    activeTimePicker.onApply(duration);
    closeExerciseTimePicker();
  });
  timeModal.addEventListener('click', (event) => {
    if (event.target === timeModal) closeExerciseTimePicker();
  });
}
