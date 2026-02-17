import { describe, expect, it } from 'vitest';
import { sanitizeEvent } from './sanitize';
import type { LogEvent } from './types';

function baseEvent(overrides?: Partial<LogEvent>): LogEvent {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'test_event',
    service: 'gofr-console-ui',
    env: 'dev',
    session_id: 'session-1',
    route: '/test',
    message: 'test message',
    ...overrides,
  };
}

describe('sanitizeEvent', () => {
  it('redacts key-based secrets', () => {
    const event = baseEvent({
      data: {
        auth_token: 'abc123',
        authorization: 'Bearer token',
        nested: {
          api_key: 'secret',
        },
      },
    });

    const sanitized = sanitizeEvent(event);
    expect(sanitized.data?.auth_token).toBe('[REDACTED]');
    expect(sanitized.data?.authorization).toBe('[REDACTED]');
    expect((sanitized.data?.nested as Record<string, unknown>)?.api_key).toBe('[REDACTED]');
  });

  it('redacts JWT-like values', () => {
    const event = baseEvent({
      data: {
        // Use a JWT-shaped dotted token that is not a real/typical JWT prefix to avoid secret scanners,
        // while still matching our JWT_PATTERN.
        value: 'aaa.bbb.ccc',
      },
    });

    const sanitized = sanitizeEvent(event);
    expect(sanitized.data?.value).toBe('[REDACTED]');
  });

  it('sanitizes url_host to host only', () => {
    const event = baseEvent({ url_host: 'https://example.com/path?token=abc' });
    const sanitized = sanitizeEvent(event);
    expect(sanitized.url_host).toBe('example.com');
  });
});
