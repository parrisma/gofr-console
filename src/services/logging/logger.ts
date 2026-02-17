import { createRequestId, getEnvironment, getRoutePath, getSessionId } from './context';
import { sanitizeEvent } from './sanitize';
import { LogTransport } from './transport';
import type { LogEvent, LogEventInput, LoggingConfig } from './types';
import { validateLogEvent } from './validation';

const DEFAULT_CONFIG: LoggingConfig = {
  enabled: import.meta.env.VITE_GOFR_SEQ_LOGGING_ENABLED
    ? import.meta.env.VITE_GOFR_SEQ_LOGGING_ENABLED === 'true'
    : import.meta.env.PROD,
  endpoint: import.meta.env.VITE_GOFR_SEQ_LOG_ENDPOINT || '/api/gofr-seq/events',
  batchSize: Number(import.meta.env.VITE_GOFR_SEQ_BATCH_SIZE || 20),
  flushIntervalMs: Number(import.meta.env.VITE_GOFR_SEQ_FLUSH_INTERVAL_MS || 3000),
  maxQueueSize: Number(import.meta.env.VITE_GOFR_SEQ_MAX_QUEUE || 500),
  timeoutMs: Number(import.meta.env.VITE_GOFR_SEQ_TIMEOUT_MS || 5000),
};

const transport = new LogTransport(DEFAULT_CONFIG);

declare const __BUILD_NUMBER__: string;
declare const __BUILD_HASH__: string;

/** e.g. "142.a3f9bc1" — commit count + short hash */
const BUILD_TAG =
  typeof __BUILD_NUMBER__ !== 'undefined' && typeof __BUILD_HASH__ !== 'undefined'
    ? `${__BUILD_NUMBER__}.${__BUILD_HASH__}`
    : undefined;

function buildEvent(input: LogEventInput): LogEvent {
  return {
    timestamp: new Date().toISOString(),
    service: 'gofr-console-ui',
    env: getEnvironment(),
    build_number: BUILD_TAG,
    session_id: getSessionId(),
    route: getRoutePath(),
    ...input,
  };
}

function emit(input: LogEventInput): void {
  const event = sanitizeEvent(buildEvent(input));
  if (!validateLogEvent(event)) return;

  if (!DEFAULT_CONFIG.enabled) {
    if (import.meta.env.DEV) {
      if (event.level === 'error') {
        console.error('[log]', event.event, event.message, event);
      } else if (event.level === 'warn') {
        console.warn('[log]', event.event, event.message, event);
      } else {
        console.log('[log]', event.event, event.message, event);
      }
    }
    return;
  }

  transport.enqueue(event);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    transport.flushWithBeacon();
  });
}

export const logger = {
  createRequestId,
  debug: (input: Omit<LogEventInput, 'level'>) => emit({ ...input, level: 'debug' }),
  info: (input: Omit<LogEventInput, 'level'>) => emit({ ...input, level: 'info' }),
  warn: (input: Omit<LogEventInput, 'level'>) => emit({ ...input, level: 'warn' }),
  error: (input: Omit<LogEventInput, 'level'>) => emit({ ...input, level: 'error' }),
  flush: () => transport.flush(),
  isDegraded: () => transport.isDegraded(),
};
