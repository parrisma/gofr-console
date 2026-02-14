import { describe, expect, it } from 'vitest';
import { validateLogEvent } from './validation';
import type { LogEvent } from './types';

function createValidEvent(overrides?: Partial<LogEvent>): LogEvent {
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

describe('validateLogEvent', () => {
  it('accepts valid event', () => {
    expect(validateLogEvent(createValidEvent())).toBe(true);
  });

  it('rejects missing required fields', () => {
    const invalid = createValidEvent({ event: '' });
    expect(validateLogEvent(invalid)).toBe(false);
  });

  it('rejects oversized message', () => {
    const invalid = createValidEvent({ message: 'x'.repeat(501) });
    expect(validateLogEvent(invalid)).toBe(false);
  });
});
