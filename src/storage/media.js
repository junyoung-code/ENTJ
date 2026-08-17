import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytesResumable
} from 'firebase/storage';
import { auth, storage } from '../firebase.js';
import { validateBlockImage } from '../features/customBlockTypes.js';

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
    const storagePath = `users/${userId}/custom-tab-images/${tabId}/${blockId}/${fileId}`;
    const imageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(imageRef, file, { contentType: file.type });

    await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
          onProgress?.(progress);
        },
        reject,
        resolve
      );
    });

    if (deletingBlocks.has(blockId)) {
      await deleteObject(imageRef);
      throw new Error('삭제된 사진 블록의 업로드를 취소했어요.');
    }

    return {
      storagePath,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      width: dimensions.width,
      height: dimensions.height,
      uploadedAt: new Date().toISOString()
    };
  })());
}

export function resolveBlockImageUrl(storagePath) {
  return getDownloadURL(ref(storage, storagePath));
}

export async function deleteBlockImage(storagePath) {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if (error?.code !== 'storage/object-not-found') throw error;
  }
}

export async function replaceBlockImage({ previousStoragePath, ...uploadOptions }) {
  const image = await uploadBlockImage(uploadOptions);
  if (previousStoragePath) {
    try {
      await deleteBlockImage(previousStoragePath);
    } catch (error) {
      console.warn('[media] Previous image cleanup failed.', error);
    }
  }
  return image;
}

export async function deleteBlockImageData(tabId, blockId) {
  deletingBlocks.add(blockId);
  try {
    await Promise.allSettled([...(activeUploads.get(blockId) || [])]);
    const userId = requireUserId();
    const folder = ref(storage, `users/${userId}/custom-tab-images/${tabId}/${blockId}`);
    const contents = await listAll(folder);
    await Promise.all(contents.items.map((item) => deleteObject(item)));
  } catch (error) {
    deletingBlocks.delete(blockId);
    throw error;
  }
}
