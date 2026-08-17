import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBlockImagePath,
  getBlobImagePath,
  hasBlockImage,
  isOwnedBlockImagePath
} from './blobImages.js';

test('builds an owner-scoped Vercel Blob image path', () => {
  const pathname = buildBlockImagePath('user/1', 'tab 1', 'block:1', 'photo.jpg');

  assert.equal(pathname, 'users/user-1/custom-tab-images/tab-1/block-1/photo-jpg');
  assert.equal(isOwnedBlockImagePath(pathname, 'user/1'), true);
  assert.equal(isOwnedBlockImagePath(pathname, 'user/2'), false);
});

test('recognizes Vercel Blob image metadata', () => {
  const blobImage = { provider: 'vercel-blob', pathname: 'users/u/custom-tab-images/t/b/p.jpg' };

  assert.equal(getBlobImagePath(blobImage), blobImage.pathname);
  assert.equal(hasBlockImage(blobImage), true);
  assert.equal(hasBlockImage({}), false);
});
