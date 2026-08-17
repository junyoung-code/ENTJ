const BLOB_IMAGE_ROOT = 'users';
const BLOB_IMAGE_FOLDER = 'custom-tab-images';

function safeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function buildBlockImagePath(userId, tabId, blockId, fileId) {
  return [
    BLOB_IMAGE_ROOT,
    safeSegment(userId),
    BLOB_IMAGE_FOLDER,
    safeSegment(tabId),
    safeSegment(blockId),
    safeSegment(fileId)
  ].join('/');
}

export function isOwnedBlockImagePath(pathname, userId) {
  return typeof pathname === 'string'
    && pathname.startsWith(`${BLOB_IMAGE_ROOT}/${safeSegment(userId)}/${BLOB_IMAGE_FOLDER}/`);
}

export function getBlobImagePath(image) {
  return image?.provider === 'vercel-blob' && typeof image.pathname === 'string'
    ? image.pathname
    : '';
}

export function hasBlockImage(image) {
  return Boolean(getBlobImagePath(image));
}
