export interface NpGuardLimits {
  maxNumericElements: number;
  maxDepth: number;
}

export const DEFAULT_NP_GUARD_LIMITS: NpGuardLimits = {
  maxNumericElements: 100_000,
  maxDepth: 8,
};

export interface NpGuardStats {
  numericElements: number;
  maxObservedDepth: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function walkValue(
  value: unknown,
  depth: number,
  limits: NpGuardLimits,
  stats: NpGuardStats,
): void {
  if (depth > stats.maxObservedDepth) stats.maxObservedDepth = depth;

  if (depth > limits.maxDepth) {
    throw new Error(`Payload nesting depth exceeded maxDepth=${limits.maxDepth}`);
  }

  if (value == null) return;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Payload contains NaN or Infinity; use finite numbers only');
    }
    stats.numericElements += 1;
    if (stats.numericElements > limits.maxNumericElements) {
      throw new Error(`Payload numeric element count exceeded maxNumericElements=${limits.maxNumericElements}`);
    }
    return;
  }

  if (typeof value === 'string' || typeof value === 'boolean') return;

  if (Array.isArray(value)) {
    for (const item of value) {
      walkValue(item, depth + 1, limits, stats);
    }
    return;
  }

  if (isPlainObject(value)) {
    for (const v of Object.values(value)) {
      walkValue(v, depth + 1, limits, stats);
    }
    return;
  }

  // Unknown types are not expected in JSON, but if present treat as error.
  throw new Error('Payload contains unsupported value types');
}

export function guardNpToolArgs(
  args: unknown,
  limits: NpGuardLimits = DEFAULT_NP_GUARD_LIMITS,
): NpGuardStats {
  if (!isPlainObject(args)) {
    throw new Error('Tool arguments must be a JSON object');
  }

  const stats: NpGuardStats = { numericElements: 0, maxObservedDepth: 0 };
  walkValue(args, 0, limits, stats);
  return stats;
}
