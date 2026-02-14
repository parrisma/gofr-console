import { describe, expect, it } from 'vitest';
import { LogTransport } from './transport';
import type { LogEvent } from './types';

function createEvent(): LogEvent {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    event: 'test_event',
    service: 'gofr-console-ui',
    env: 'dev',
    session_id: 'session-1',
    route: '/test',
    message: 'test message',
  };
}

describe('LogTransport', () => {
  it('does not throw when endpoint is unreachable', async () => {
    const transport = new LogTransport({
      enabled: true,
      endpoint: 'http://127.0.0.1:9/unreachable',
      batchSize: 10,
      flushIntervalMs: 1,
      maxQueueSize: 100,
      timeoutMs: 50,
    });

    transport.enqueue(createEvent());
    await expect(transport.flush()).resolves.toBeUndefined();
    expect(transport.isDegraded()).toBe(true);
  });
});
