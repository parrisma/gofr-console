import type { LogEvent } from './types';

const REDACTED = '[REDACTED]';
const SECRET_KEY_PATTERN = /(token|authorization|secret|password|api[_-]?key|cookie)/i;
const JWT_PATTERN = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
const LONG_SECRET_PATTERN = /^[A-Za-z0-9+/=_-]{24,}$/;

function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;

  if (typeof value === 'string') {
    if (JWT_PATTERN.test(value) || LONG_SECRET_PATTERN.test(value)) {
      return REDACTED;
    }
    return value.length > 2000 ? `${value.slice(0, 2000)}...[TRUNCATED]` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map(sanitizeValue);
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (SECRET_KEY_PATTERN.test(key)) {
        return [key, REDACTED] as const;
      }
      return [key, sanitizeValue(nested)] as const;
    });
    return Object.fromEntries(entries);
  }

  return value;
}

function sanitizeUrlHost(urlOrHost?: string): string | undefined {
  if (!urlOrHost) return undefined;
  try {
    const parsed = new URL(urlOrHost);
    return parsed.host;
  } catch {
    return urlOrHost.split('?')[0];
  }
}

export function sanitizeEvent(event: LogEvent): LogEvent {
  return {
    ...event,
    message: typeof event.message === 'string' ? event.message.slice(0, 500) : 'log-event',
    url_host: sanitizeUrlHost(event.url_host),
    data: event.data ? (sanitizeValue(event.data) as Record<string, unknown>) : undefined,
  };
}
