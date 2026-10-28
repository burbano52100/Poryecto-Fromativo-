import { describe, it } from 'vitest';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

describe('Auth Middleware & Security Unit Tests', () => {
  const mockSecret = 'test_jwt_secret_key_12345678901234567890';
  process.env.JWT_SECRET = mockSecret;

  it('debe rechazar peticiones sin header Authorization con 401', () => {
    let statusCode = 0;
    let responseBody: any = null;

    const req = { headers: {} } as AuthenticatedRequest;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as any;

    let nextCalled = false;
    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(statusCode, 401);
    assert.strictEqual(nextCalled, false);
    assert.ok(responseBody.message.includes('Token de autorización ausente'));
  });

  it('debe rechazar tokens JWT malformados o inválidos con 401', () => {
    let statusCode = 0;
    const req = {
      headers: { authorization: 'Bearer token_invalido_falso' },
    } as AuthenticatedRequest;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return { json: () => {} };
      },
    } as any;

    let nextCalled = false;
    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(statusCode, 401);
    assert.strictEqual(nextCalled, false);
  });

  it('debe aceptar tokens JWT válidos y adjuntar req.user', () => {
    const payload = {
      id: 'usr_test_123',
      document: '1005678901',
      name: 'Carlos Ruiz',
      role: 'aprendiz' as const,
    };

    const token = jwt.sign(payload, mockSecret, { expiresIn: '1h' });

    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as AuthenticatedRequest;
    const res = {
      status: () => ({ json: () => {} }),
    } as any;

    let nextCalled = false;
    authenticateToken(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.user?.id, 'usr_test_123');
    assert.strictEqual(req.user?.role, 'aprendiz');
  });

  it('requireRole debe permitir acceso cuando el rol coincide', () => {
    const req = {
      user: {
        id: 'usr_encargado',
        document: '1012345678',
        name: 'Carlos Encargado',
        role: 'encargado' as const,
      },
    } as AuthenticatedRequest;

    const res = {
      status: () => ({ json: () => {} }),
    } as any;

    let nextCalled = false;
    const middleware = requireRole('encargado');
    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
  });

  it('requireRole debe bloquear con 403 cuando el rol no tiene permisos', () => {
    let statusCode = 0;
    let responseBody: any = null;

    const req = {
      user: {
        id: 'usr_aprendiz',
        document: '1005678901',
        name: 'Carlos Aprendiz',
        role: 'aprendiz' as const,
      },
    } as AuthenticatedRequest;

    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (body: any) => {
            responseBody = body;
          },
        };
      },
    } as any;

    let nextCalled = false;
    const middleware = requireRole('encargado');
    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(statusCode, 403);
    assert.strictEqual(nextCalled, false);
    assert.ok(responseBody.message.includes('Acceso denegado'));
  });
});
