import { ApiError, defaultRecoveryHint } from '../api/errors';
import {
  AGENT_REASONING_LOGGER,
  AGENT_SERVICE_NAME,
  isReservedAgentToolName,
  type AgentListServicesResponse,
  type AgentReasoningEvent,
  type AgentServiceStatus,
  type AgentServiceTool,
} from '../../types/gofrAgent';

type TextContent = { type?: string; text?: string };
type ToolResultLike = { content?: unknown[]; isError?: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asToolResult(value: unknown): ToolResultLike {
  return isRecord(value) ? value : {};
}

function firstText(value: unknown): string | null {
  const result = asToolResult(value);
  const content = Array.isArray(result.content) ? result.content : [];
  const item = content.find((entry): entry is TextContent => {
    return isRecord(entry) && entry.type === 'text' && typeof entry.text === 'string';
  });
  return item?.text ?? null;
}

function parseJsonText(text: string): unknown {
  let parsed = JSON.parse(text) as unknown;
  if (typeof parsed === 'string') {
    parsed = JSON.parse(parsed) as unknown;
  }
  return parsed;
}

function unwrapData(value: unknown): unknown {
  if (isRecord(value) && 'data' in value) return value.data;
  return value;
}

function throwToolError(tool: string, parsed: unknown): void {
  if (!isRecord(parsed)) return;
  const success = parsed.success;
  const status = parsed.status;
  if (success !== false && status !== 'error') return;

  const message = typeof parsed.error === 'string'
    ? parsed.error
    : typeof parsed.message === 'string'
      ? parsed.message
      : 'Tool returned an error';
  throw new ApiError({
    service: AGENT_SERVICE_NAME,
    tool,
    code: typeof parsed.error_code === 'string' || typeof parsed.error_code === 'number'
      ? parsed.error_code
      : undefined,
    message,
    recovery: typeof parsed.recovery === 'string'
      ? parsed.recovery
      : typeof parsed.recovery_strategy === 'string'
        ? parsed.recovery_strategy
        : defaultRecoveryHint(),
  });
}

export function parseTextJson<T>(result: unknown, tool: string): T {
  const text = firstText(result);
  if (!text) {
    throw new ApiError({
      service: AGENT_SERVICE_NAME,
      tool,
      message: 'Expected JSON text content in MCP tool response',
      recovery: 'Check GOFR-Agent MCP logs for a malformed tool response.',
    });
  }

  try {
    const parsed = parseJsonText(text);
    throwToolError(tool, parsed);
    return unwrapData(parsed) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const snippet = text.length > 160 ? `${text.slice(0, 160)}...` : text;
    throw new ApiError({
      service: AGENT_SERVICE_NAME,
      tool,
      message: `Response is not valid JSON. Server returned: ${snippet}`,
      recovery: 'Check GOFR-Agent logs for malformed MCP text output.',
      cause: err,
    });
  }
}

function normalizeTool(value: unknown): AgentServiceTool | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  if (isReservedAgentToolName(value.name)) return null;
  return {
    name: value.name,
    description: typeof value.description === 'string' ? value.description : undefined,
  };
}

function normalizeService(value: unknown): AgentServiceStatus | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  const rawTools = Array.isArray(value.tools) ? value.tools : [];
  const resultTypes = Array.isArray(value.result_types)
    ? value.result_types.filter((item): item is string => typeof item === 'string')
    : undefined;
  return {
    name: value.name,
    url: typeof value.url === 'string' ? value.url : undefined,
    description: typeof value.description === 'string' ? value.description : undefined,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : undefined,
    status: typeof value.status === 'string' ? value.status : 'unknown',
    tools: rawTools.map(normalizeTool).filter((tool): tool is AgentServiceTool => Boolean(tool)),
    supports_results_hub: typeof value.supports_results_hub === 'boolean' ? value.supports_results_hub : undefined,
    can_publish_results: typeof value.can_publish_results === 'boolean' ? value.can_publish_results : undefined,
    can_consume_results: typeof value.can_consume_results === 'boolean' ? value.can_consume_results : undefined,
    result_types: resultTypes,
    error: typeof value.error === 'string' ? value.error : undefined,
    registration_error: typeof value.registration_error === 'string' ? value.registration_error : undefined,
  };
}

export function normalizeAgentServiceList(raw: unknown): AgentListServicesResponse {
  const unwrapped = unwrapData(raw);
  const rawServices = Array.isArray(unwrapped)
    ? unwrapped
    : isRecord(unwrapped) && Array.isArray(unwrapped.services)
      ? unwrapped.services
      : [];
  return {
    services: rawServices
      .map(normalizeService)
      .filter((service): service is AgentServiceStatus => Boolean(service)),
  };
}

export function normalizeReasoningEvent(value: unknown): AgentReasoningEvent | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null;
  const sequence = typeof value.sequence === 'number' && Number.isFinite(value.sequence)
    ? value.sequence
    : 0;
  const eventId = typeof value.event_id === 'string' && value.event_id.trim()
    ? value.event_id
    : `${value.kind}-${sequence}`;
  return {
    ...value,
    event_id: eventId,
    sequence,
    kind: value.kind,
    request_id: typeof value.request_id === 'string' ? value.request_id : undefined,
    session_id: typeof value.session_id === 'string' ? value.session_id : undefined,
    run_id: typeof value.run_id === 'string' || value.run_id === null ? value.run_id : undefined,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : undefined,
    truncated: typeof value.truncated === 'boolean' ? value.truncated : undefined,
  };
}

export function isAgentReasoningNotification(params: {
  logger?: string;
  data: unknown;
}): boolean {
  return params.logger === AGENT_REASONING_LOGGER && normalizeReasoningEvent(params.data) != null;
}

export function filterVisibleAgentTools(tools: AgentServiceTool[]): AgentServiceTool[] {
  return tools.filter((tool) => !isReservedAgentToolName(tool.name));
}