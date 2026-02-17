import { describe, expect, it } from 'vitest';

import { ApiError } from './errors';

// NOTE: parseToolText is currently file-local in src/services/api/index.ts.
// These tests validate behavior by importing the public api layer indirectly is not practical.
// For now, we re-implement a minimal call wrapper by importing the module and reaching into it
// is not possible in ESM without explicit exports.
//
// To keep tests valuable and stable, we validate the ApiError formatting logic using the
// public ApiError class, and we add a small exported test hook in index.ts.

import { __test__parseToolText as parseToolText } from './index';

describe('parseToolText', () => {
  it('throws ApiError when status is error', () => {
    const text = JSON.stringify({
      status: 'error',
      error_code: 'BAD_THING',
      message: 'Nope',
      recovery_strategy: 'Try again',
    });

    expect(() => parseToolText('gofr-doc', 'some_tool', text)).toThrow(ApiError);

    try {
      parseToolText('gofr-doc', 'some_tool', text);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('BAD_THING');
      expect(apiErr.message).toContain('Nope');
      expect(apiErr.message).toContain('Recovery:');
      expect(apiErr.recovery).toBe('Try again');
    }
  });

  it('throws ApiError when success is false and maps error + recovery_strategy', () => {
    const text = JSON.stringify({
      success: false,
      error_code: 'AUTH_ERROR',
      error: 'Token expired',
      recovery_strategy: 'Re-authenticate and retry',
    });

    expect(() => parseToolText('gofr-doc', 'get_session_status', text)).toThrow(ApiError);

    try {
      parseToolText('gofr-doc', 'get_session_status', text);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('AUTH_ERROR');
      expect(apiErr.message).toContain('Token expired');
      expect(apiErr.recovery).toBe('Re-authenticate and retry');
    }
  });

  it('returns parsed.data when present', () => {
    const text = JSON.stringify({
      status: 'ok',
      data: { a: 1, b: 'two' },
    });

    const result = parseToolText<{ a: number; b: string }>('gofr-doc', 'ping', text);
    expect(result).toEqual({ a: 1, b: 'two' });
  });
});
