/**
 * Build a JSON-serialisable parameter object from a template/fragment
 * parameter-schema array.
 *
 * Input shape (from gofr-doc get_template_details / get_fragment_details):
 *   [ { name: string, type?: string, required?: boolean, default?: unknown }, ... ]
 *
 * Returns an object like { title: "", author: "Analyst", as_of: "" }
 * with sensible defaults per declared type.
 */
export function buildParamsFromSchema(params: unknown): Record<string, unknown> {
  if (!Array.isArray(params) || params.length === 0) return {};

  const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  const entries = new Map<string, unknown>();

  for (const entry of params) {
    if (entry == null || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    const name = rec.name;
    if (typeof name !== 'string' || !name) continue;
    if (BLOCKED_KEYS.has(name)) continue;

    // Use explicit default if provided
    if ('default' in rec && rec.default !== undefined) {
      entries.set(name, rec.default);
      continue;
    }

    // Derive a sensible empty value from the declared type
    const paramType = typeof rec.type === 'string' ? rec.type.toLowerCase() : 'string';
    entries.set(name, defaultForType(paramType));
  }

  return Object.fromEntries(entries);
}

/** Return a sensible empty value for a parameter type string. */
function defaultForType(paramType: string): unknown {
  switch (paramType) {
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return '';
  }
}
