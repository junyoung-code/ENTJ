import { upload } from '@vercel/blob/client';
import { auth, isLocalDevelopment } from '../firebase.js';
import { validateBlockImage } from '../features/customBlockTypes.js';
import {
  buildBlockImagePath,
  getBlobImagePath
} from './blobImages.js';

const PRODUCTION_BLOB_API_URL = 'https://entj-murex.vercel.app/api/blob';

const deletingBlocks = new Set();
const activeUploads = new Map();

function trackUpload(blockId, operation) {
  if (!activeUploads.has(blockId)) activeUploads.set(blockId, new Set());
  const uploads = activeUploads.get(blockId);
  uploads.add(operation);
  const cleanup = () => {
    uploads.delete(operation);
    if (uploads.size === 0) activeUploads.delete(blockId);
  };
  operation.then(cleanup, cleanup);
  return operation;
}

function requireUserId() {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('사진을 저장하려면 로그인이 필요해요.');
  return userId;
}

function extensionForType(type) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  }[type];
}

function makeFileId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blobApiUrl() {
  return isLocalDevelopment ? PRODUCTION_BLOB_API_URL : '/api/blob';
}

async function requireIdToken() {
  if (!auth.currentUser) throw new Error('사진을 저장하려면 로그인이 필요해요.');
  return auth.currentUser.getIdToken();
}

async function readApiError(response, fallback) {
  try {
    const data = await response.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

async function deleteBlobImage(pathname) {
  const idToken = await requireIdToken();
  const response = await fetch(blobApiUrl(), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pathname })
  });
  if (!response.ok) {
    throw new Error(await readApiError(response, '사진을 삭제하지 못했어요.'));
  }
}

function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 읽을 수 없어요. 다른 파일을 선택해주세요.'));
    };
    image.src = url;
  });
}

export async function uploadBlockImage({ tabId, blockId, file, onProgress }) {
  if (deletingBlocks.has(blockId)) throw new Error('삭제 중인 사진 블록이에요.');
  const validationMessage = validateBlockImage(file);
  if (validationMessage) throw new Error(validationMessage);

  const userId = requireUserId();
  return trackUpload(blockId, (async () => {
    const dimensions = await readImageDimensions(file);
    const fileId = `${makeFileId()}.${extensionForType(file.type)}`;
    const pathname = buildBlockImagePath(userId, tabId, blockId, fileId);
    const idToken = await requireIdToken();
    const blob = await upload(pathname, file, {
      access: 'private',
      handleUploadUrl: blobApiUrl(),
      headers: { Authorization: `Bearer ${idToken}` },
      contentType: file.type,
      onUploadProgress: ({ percentage }) => onProgress?.(Math.round(percentage))
    });

    if (deletingBlocks.has(blockId)) {
      await deleteBlobImage(blob.pathname);
      throw new Error('삭제된 사진 블록의 업로드를 취소했어요.');
    }

    return {
      provider: 'vercel-blob',
      pathname: blob.pathname,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      uploadedAt: new Date().toISOString()
    };
  })());
}

export async function resolveBlockImageUrl(image) {
  const pathname = getBlobImagePath(image);
  if (pathname) {
    const idToken = await requireIdToken();
    const response = await fetch(`${blobApiUrl()}?pathname=${encodeURIComponent(pathname)}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!response.ok) {
      throw new Error(await readApiError(response, '사진을 불러오지 못했어요.'));
    }
    const data = await response.json();
    return data.url;
  }

  throw new Error('저장된 사진 경로가 없어요.');
}

export async function deleteBlockImage(image) {
  const pathname = getBlobImagePath(image);
  if (pathname) {
    await deleteBlobImage(pathname);
    return;
  }

}

export async function replaceBlockImage({ previousImage, ...uploadOptions }) {
  const image = await uploadBlockImage(uploadOptions);
  if (previousImage) {
    try {
      await deleteBlockImage(previousImage);
    } catch (error) {
      console.warn('[media] Previous image cleanup failed.', error);
    }
  }
  return image;
}

export async function deleteBlockImageData(component) {
  const blockId = component.id;
  deletingBlocks.add(blockId);
  try {
    await Promise.allSettled([...(activeUploads.get(blockId) || [])]);
    await deleteBlockImage(component.image);
  } finally {
    deletingBlocks.delete(blockId);
  }
}
