import { del, issueSignedToken, presignUrl } from '@vercel/blob';
import { handleUpload } from '@vercel/blob/client';
import { BLOCK_IMAGE_TYPES, MAX_BLOCK_IMAGE_SIZE } from '../src/features/customBlockTypes.js';
import { isOwnedBlockImagePath } from '../src/storage/blobImages.js';

const FIREBASE_WEB_API_KEY = 'AIzaSyBOYD9TE__fk2_4RlCXMj5HlTdqhDv5VR0';
const SIGNED_URL_LIFETIME = 5 * 60 * 1000;

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function requestHeader(request, name) {
  return request.headers?.get?.(name) || request.headers?.[name.toLowerCase()] || '';
}

function corsHeaders(request) {
  const origin = requestHeader(request, 'origin');
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    ...(isLocalOrigin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Vary': 'Origin'
  };
}

function json(request, data, status = 200) {
  return Response.json(data, { status, headers: corsHeaders(request) });
}

async function verifyFirebaseUser(request) {
  const authorization = requestHeader(request, 'authorization');
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!idToken) throw new RequestError('로그인이 필요해요.', 401);

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    }
  );
  const data = await response.json();
  const userId = data.users?.[0]?.localId;
  if (!response.ok || !userId) throw new RequestError('로그인이 만료됐어요. 다시 로그인해주세요.', 401);
  return userId;
}

function requireOwnedPath(pathname, userId) {
  if (!isOwnedBlockImagePath(pathname, userId)) {
    throw new RequestError('이 사진에 접근할 권한이 없어요.', 403);
  }
}

async function handleRead(request) {
  const userId = await verifyFirebaseUser(request);
  const pathname = new URL(request.url).searchParams.get('pathname') || '';
  requireOwnedPath(pathname, userId);

  const validUntil = Date.now() + SIGNED_URL_LIFETIME;
  const signedToken = await issueSignedToken({
    pathname,
    operations: ['get'],
    validUntil
  });
  const { presignedUrl } = await presignUrl(signedToken, {
    access: 'private',
    operation: 'get',
    pathname,
    validUntil
  });
  return json(request, { url: presignedUrl });
}

async function handleDelete(request) {
  const userId = await verifyFirebaseUser(request);
  const body = await request.json();
  const pathname = body.pathname || '';
  requireOwnedPath(pathname, userId);
  await del(pathname);
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

async function handleClientUpload(request) {
  const body = await request.json();
  const response = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      const userId = await verifyFirebaseUser(request);
      requireOwnedPath(pathname, userId);
      return {
        allowedContentTypes: BLOCK_IMAGE_TYPES,
        maximumSizeInBytes: MAX_BLOCK_IMAGE_SIZE,
        addRandomSuffix: true,
        validUntil: Date.now() + 15 * 60 * 1000,
        tokenPayload: JSON.stringify({ userId, pathname })
      };
    },
    onUploadCompleted: async () => {}
  });
  return json(request, response);
}

function publicError(error) {
  if (/BLOB_READ_WRITE_TOKEN|No token/i.test(error?.message || '')) {
    return new RequestError('Vercel Blob 저장소가 아직 연결되지 않았어요.', 503);
  }
  return error instanceof RequestError
    ? error
    : new RequestError(error?.message || '사진 저장 요청에 실패했어요.');
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  try {
    if (request.method === 'GET') return await handleRead(request);
    if (request.method === 'DELETE') return await handleDelete(request);
    if (request.method === 'POST') return await handleClientUpload(request);
    return json(request, { error: '지원하지 않는 요청이에요.' }, 405);
  } catch (error) {
    console.error('[blob-api] Request failed.', error);
    const responseError = publicError(error);
    return json(request, { error: responseError.message }, responseError.status);
  }
}
