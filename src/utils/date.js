export const DAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDateLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${y}년 ${m}월 ${d}일 (${DAY_KR[date.getDay()]})`;
}

export function setDateDisplay() {
  const d = new Date();
  const day = DAY_KR[d.getDay()];
  document.getElementById('dateDisplay').innerHTML =
    `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 <span>${day}요일</span>`;
}

