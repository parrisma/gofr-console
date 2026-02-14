import type { LogEvent } from './types';

export function validateLogEvent(event: LogEvent): boolean {
  if (!event.event || !event.message || !event.level) return false;
  if (!event.timestamp || !event.service || !event.env || !event.session_id || !event.route) return false;
  if (event.message.length > 500) return false;
  return true;
}
