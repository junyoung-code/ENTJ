import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK_TEMPLATES,
  createCustomComponent,
  validateBlockImage
} from './customBlockTypes.js';

test('creates image and journal blocks with their expected defaults', () => {
  const imageTemplate = BLOCK_TEMPLATES.find((template) => template.type === 'image');
  const journalTemplate = BLOCK_TEMPLATES.find((template) => template.type === 'journal');

  assert.deepEqual(createCustomComponent(imageTemplate, 'image-1'), {
    id: 'image-1',
    type: 'image',
    title: '사진',
    text: '',
    items: [],
    caption: '',
    image: null
  });
  assert.deepEqual(createCustomComponent(journalTemplate, 'journal-1'), {
    id: 'journal-1',
    type: 'journal',
    title: '오늘의 기록',
    text: '',
    items: []
  });
});

test('accepts supported image types up to 10MB', () => {
  assert.equal(validateBlockImage({ type: 'image/jpeg', size: 1024 }), '');
  assert.equal(validateBlockImage({ type: 'image/png', size: 10 * 1024 * 1024 }), '');
  assert.match(validateBlockImage({ type: 'image/gif', size: 1024 }), /JPG/);
  assert.match(validateBlockImage({ type: 'image/webp', size: 10 * 1024 * 1024 + 1 }), /10MB/);
});
