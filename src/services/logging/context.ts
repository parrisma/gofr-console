const SESSION_KEY = 'gofr_console_session_id';

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server-render';
  const existing = sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = createSessionId();
  sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

export function getRoutePath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname || '/';
}

export function getEnvironment(): 'dev' | 'prod' {
  return import.meta.env.DEV ? 'dev' : 'prod';
}

export function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
