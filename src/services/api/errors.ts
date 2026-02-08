export interface ApiErrorDetails {
  service: string;
  tool: string;
  message: string;
  statusCode?: number;
  code?: number | string;
  recovery?: string;
  cause?: unknown;
}

export class ApiError extends Error {
  service: string;
  tool: string;
  statusCode?: number;
  code?: number | string;
  recovery?: string;
  cause?: unknown;

  constructor(details: ApiErrorDetails) {
    const prefix = `${details.service} / ${details.tool}`;
    const status = details.statusCode ? ` (HTTP ${details.statusCode})` : '';
    const recovery = details.recovery ? ` Recovery: ${details.recovery}` : '';
    super(`${prefix}${status} failed: ${details.message}.${recovery}`);
    this.name = 'ApiError';
    this.service = details.service;
    this.tool = details.tool;
    this.statusCode = details.statusCode;
    this.code = details.code;
    this.recovery = details.recovery;
    this.cause = details.cause;
  }
}

export function toApiError(details: ApiErrorDetails): ApiError {
  return new ApiError(details);
}

export function defaultRecoveryHint(statusCode?: number): string {
  if (!statusCode) return 'Check MCP service logs and network connectivity.';
  if (statusCode === 401 || statusCode === 403) return 'Re-authenticate and verify token permissions.';
  if (statusCode >= 500) return 'Check MCP container health and retry.';
  if (statusCode === 400) return 'Verify request parameters and session state.';
  return 'Retry or check MCP logs for details.';
}
