export const MAX_BLOCK_IMAGE_SIZE = 10 * 1024 * 1024;
export const BLOCK_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const BLOCK_TEMPLATES = [
  { type: 'checklist', label: '기본 체크리스트 블록', title: '제목 없는 체크리스트' },
  { type: 'priority', label: '우선순위 체크리스트 블록', title: '제목없는 우선순위 체크리스트' },
  { type: 'recordable', label: '기록가능 체크리스트 블록', title: '제목없는 기록가능 체크리스트' },
  { type: 'timer', label: '기본 스탑워치 블록', title: '스톱워치' },
  { type: 'image', label: '사진 블록', title: '사진' },
  { type: 'journal', label: '날짜별 일기 블록', title: '오늘의 기록' }
];

export function createCustomComponent(template, id) {
  const component = {
    id,
    type: template.type,
    title: template.title,
    text: '',
    items: []
  };

  if (template.type === 'timer') {
    component.timer = { subject: '', elapsed: 0, running: false, startedAt: null };
  } else if (template.type === 'priority') {
    component.priorities = [];
  } else if (template.type === 'recordable') {
    component.records = [];
  } else if (template.type === 'image') {
    component.caption = '';
    component.image = null;
  }

  return component;
}

export function validateBlockImage(file) {
  if (!file || !BLOCK_IMAGE_TYPES.includes(file.type)) {
    return 'JPG, PNG, WebP 형식의 사진만 올릴 수 있어요.';
  }
  if (file.size > MAX_BLOCK_IMAGE_SIZE) {
    return '사진은 10MB 이하만 올릴 수 있어요.';
  }
  return '';
}
