import { describe, it, beforeAll, afterAll } from 'vitest';
import assert from 'node:assert';
import { createApp } from '../../src/app.js';
import http from 'http';

const PORT = 4000;
let server: http.Server;

beforeAll(() => {
  if (process.env.DATABASE_URL_TEST === process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL for safety');
  }
  const app = createApp();
  server = app.listen(PORT);
});

afterAll(() => {
  server?.close();
});

describe('Auth integration tests', () => {
  it('login with invalid credentials returns generic error', async () => {
    const res = await new Promise<{ statusCode: number; payload: any }>((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, payload: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(JSON.stringify({ document: 'nonexistent', password: 'wrong', accountType: 'aprendiz' }));
      req.end();
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.payload.message, 'Credenciales inválidas');
  });
});
