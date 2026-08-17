import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './blob.js';

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

test('answers Vercel OPTIONS requests through the response object', async () => {
  const request = {
    method: 'OPTIONS',
    url: '/api/blob',
    headers: { origin: 'http://127.0.0.1:4173' }
  };
  const response = createResponse();

  await handler(request, response);

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers['Access-Control-Allow-Origin'], request.headers.origin);
  assert.equal(response.ended, true);
});

test('answers unauthenticated Vercel requests without waiting', async () => {
  const request = { method: 'GET', url: '/api/blob?pathname=test', headers: {} };
  const response = createResponse();

  await handler(request, response);

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.body, { error: '로그인이 필요해요.' });
  assert.equal(response.ended, true);
});
