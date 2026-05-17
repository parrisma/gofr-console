import { ApiError, defaultRecoveryHint } from '../api/errors';
import {
  AGENT_CONTEXT_MAX_LENGTH,
  AGENT_DEFAULT_MAX_STEPS,
  AGENT_MCP_ENDPOINT,
  AGENT_QUESTION_MAX_LENGTH,
  AGENT_SERVICE_NAME,
  clampAgentMaxSteps,
  type AgentAskRequest,
  type AgentAskResponse,
  type AgentConnectionState,
  type AgentHealthCheckResponse,
  type AgentHttpHealthResponse,
  type AgentListServicesResponse,
  type AgentMcpEndpointDiagnostic,
  type AgentPingResponse,
  type AgentReasoningEvent,
  type AgentResetSessionResponse,
} from '../../types/gofrAgent';
import { GofrAgentClient, type AgentToolCaller } from './client';
import { normalizeAgentServiceList, parseTextJson } from './parse';

type OneShotCall<T> = (client: GofrAgentClient) => Promise<T>;
const RELATIVE_URL_BASE = 'http://gofr-console.invalid';

function safeErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
}

function errorStatusCode(err: unknown): number | undefined {
  if (err instanceof ApiError) return err.statusCode;
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'number') return err.code;
  const message = safeErrorMessage(err);
  const match = message.match(/(?:HTTP|status|code)\s*(\d{3})/i);
  return match ? Number(match[1]) : undefined;
}

function toAgentApiError(tool: string, err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const statusCode = errorStatusCode(err);
  const message = safeErrorMessage(err);
  const isHostProblem = statusCode === 421 || /invalid host|misdirected/i.test(message);
  return new ApiError({
    service: AGENT_SERVICE_NAME,
    tool,
    statusCode,
    message,
    recovery: isHostProblem
      ? 'Allow the Vite proxy target host in GOFR-Agent transport security configuration.'
      : defaultRecoveryHint(statusCode),
    cause: err,
  });
}

function apiErrorForHttp(tool: string, statusCode: number, message: string): ApiError {
  const isHostProblem = statusCode === 421 || /invalid host|misdirected/i.test(message);
  return new ApiError({
    service: AGENT_SERVICE_NAME,
    tool,
    statusCode,
    message,
    recovery: isHostProblem
      ? 'Allow the Vite proxy target host in GOFR-Agent transport security configuration.'
      : defaultRecoveryHint(statusCode),
  });
}

export function agentHttpBaseUrl(mcpUrl = AGENT_MCP_ENDPOINT): string {
  const url = new URL(mcpUrl, RELATIVE_URL_BASE);
  url.pathname = url.pathname.replace(/\/mcp\/?$/, '');
  url.search = '';
  url.hash = '';
  const text = url.toString().replace(/\/$/, '');
  return text.startsWith(RELATIVE_URL_BASE) ? text.slice(RELATIVE_URL_BASE.length) || '/' : text;
}

export function agentMcpEndpointDiagnostic(mcpUrl = AGENT_MCP_ENDPOINT): AgentMcpEndpointDiagnostic {
  const isRelative = !/^https?:\/\//i.test(mcpUrl);
  const url = new URL(mcpUrl, isRelative ? RELATIVE_URL_BASE : undefined);
  return {
    mcpUrl,
    host: isRelative ? 'same-origin proxy' : url.host,
    path: url.pathname,
    sameOrigin: isRelative,
  };
}

async function fetchAgentJson<T>(tool: string, url: string, allowedStatuses = [200]): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    throw new ApiError({
      service: AGENT_SERVICE_NAME,
      tool,
      message: safeErrorMessage(err),
      recovery: 'Check GOFR-Agent network reachability and Vite proxy configuration.',
      cause: err,
    });
  }

  const text = await response.text();
  if (!allowedStatuses.includes(response.status)) {
    throw apiErrorForHttp(tool, response.status, text || response.statusText);
  }
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new ApiError({
      service: AGENT_SERVICE_NAME,
      tool,
      statusCode: response.status,
      message: 'HTTP health response is not valid JSON',
      recovery: 'Check GOFR-Agent HTTP health route output.',
      cause: err,
    });
  }
}

async function withAgentClient<T>(authToken: string, fn: OneShotCall<T>): Promise<T> {
  const client = new GofrAgentClient({ authToken });
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

function nonEmptyArray(value: string[] | undefined): string[] | undefined {
  const cleaned = value?.map((item) => item.trim()).filter(Boolean);
  return cleaned && cleaned.length > 0 ? cleaned : undefined;
}

function nonEmptyString(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

export function prepareAgentAskRequest(request: AgentAskRequest): AgentAskRequest {
  const question = request.question.trim();
  if (!question) {
    throw new ApiError({
      service: AGENT_SERVICE_NAME,
      tool: 'ask',
      message: 'Question is required',
      recovery: 'Enter a question before sending.',
    });
  }
  if (question.length > AGENT_QUESTION_MAX_LENGTH) {
    throw new ApiError({
      service: AGENT_SERVICE_NAME,
      tool: 'ask',
      message: `Question is too long (${question.length}/${AGENT_QUESTION_MAX_LENGTH} characters)`,
      recovery: 'Shorten the question or move supporting detail into backend-supported context fields later.',
    });
  }

  const contextLength = [request.context, request.instructions, ...(request.asserted_facts ?? []), ...(request.pasted_content ?? [])]
    .filter((item): item is string => typeof item === 'string')
    .reduce((total, item) => total + item.length, 0);
  if (contextLength > AGENT_CONTEXT_MAX_LENGTH) {
    throw new ApiError({
      service: AGENT_SERVICE_NAME,
      tool: 'ask',
      message: `Context is too long (${contextLength}/${AGENT_CONTEXT_MAX_LENGTH} characters)`,
      recovery: 'Reduce context, instructions, asserted facts, or pasted content.',
    });
  }

  const prepared: AgentAskRequest = {
    question,
    max_steps: clampAgentMaxSteps(request.max_steps ?? AGENT_DEFAULT_MAX_STEPS),
    tools_only: Boolean(request.tools_only),
    no_commentary: Boolean(request.no_commentary),
    output_format: request.output_format ?? 'text',
  };

  const sessionId = nonEmptyString(request.session_id);
  if (sessionId) prepared.session_id = sessionId;
  const context = nonEmptyString(request.context);
  if (context) prepared.context = context;
  const instructions = nonEmptyString(request.instructions);
  if (instructions) prepared.instructions = instructions;
  const assertedFacts = nonEmptyArray(request.asserted_facts);
  if (assertedFacts) prepared.asserted_facts = assertedFacts;
  const pastedContent = nonEmptyArray(request.pasted_content);
  if (pastedContent) prepared.pasted_content = pastedContent;
  const forbiddenServices = nonEmptyArray(request.forbidden_services);
  if (forbiddenServices) prepared.forbidden_services = forbiddenServices;
  const forbiddenTools = nonEmptyArray(request.forbidden_tools);
  if (forbiddenTools) prepared.forbidden_tools = forbiddenTools;
  const allowedServices = nonEmptyArray(request.allowed_services);
  if (allowedServices) prepared.allowed_services = allowedServices;
  const modelOverride = nonEmptyString(request.model_override);
  if (modelOverride) prepared.model_override = modelOverride;
  if (typeof request.interactive === 'boolean') prepared.interactive = request.interactive;

  return prepared;
}

export async function agentPingWithClient(client: AgentToolCaller): Promise<AgentPingResponse> {
  try {
    const result = await client.callTool('ping', {});
    return parseTextJson<AgentPingResponse>(result, 'ping');
  } catch (err) {
    throw toAgentApiError('ping', err);
  }
}

export function agentPing(authToken: string): Promise<AgentPingResponse> {
  return withAgentClient(authToken, agentPingWithClient);
}

export function agentHttpPing(mcpUrl = AGENT_MCP_ENDPOINT): Promise<AgentPingResponse> {
  return fetchAgentJson<AgentPingResponse>('http_ping', `${agentHttpBaseUrl(mcpUrl)}/ping`);
}

export function agentHttpHealth(mcpUrl = AGENT_MCP_ENDPOINT): Promise<AgentHttpHealthResponse> {
  return fetchAgentJson<AgentHttpHealthResponse>('http_health', `${agentHttpBaseUrl(mcpUrl)}/health`, [200, 503]);
}

export async function agentHealthCheckWithClient(client: AgentToolCaller): Promise<AgentHealthCheckResponse> {
  try {
    const result = await client.callTool('health_check', {});
    return parseTextJson<AgentHealthCheckResponse>(result, 'health_check');
  } catch (err) {
    throw toAgentApiError('health_check', err);
  }
}

export function agentHealthCheck(authToken: string): Promise<AgentHealthCheckResponse> {
  return withAgentClient(authToken, agentHealthCheckWithClient);
}

export async function agentListServicesWithClient(client: AgentToolCaller): Promise<AgentListServicesResponse> {
  try {
    const result = await client.callTool('list_services', {});
    return normalizeAgentServiceList(parseTextJson<unknown>(result, 'list_services'));
  } catch (err) {
    throw toAgentApiError('list_services', err);
  }
}

export function agentListServices(authToken: string): Promise<AgentListServicesResponse> {
  return withAgentClient(authToken, agentListServicesWithClient);
}

export async function agentAskWithClient(
  client: AgentToolCaller,
  request: AgentAskRequest,
): Promise<AgentAskResponse> {
  try {
    const prepared = prepareAgentAskRequest(request);
    const result = await client.callTool('ask', prepared);
    const response = parseTextJson<AgentAskResponse>(result, 'ask');
    return {
      ...response,
      steps: Array.isArray(response.steps) ? response.steps : [],
      provenance: Array.isArray(response.provenance) ? response.provenance : [],
      verification_gap: response.verification_gap ?? null,
      clarification_request: response.clarification_request ?? null,
    };
  } catch (err) {
    throw toAgentApiError('ask', err);
  }
}

export function agentAsk(
  authToken: string,
  request: AgentAskRequest,
  onReasoningEvent?: (event: AgentReasoningEvent) => void,
): Promise<AgentAskResponse> {
  const client = new GofrAgentClient({ authToken, onReasoningEvent });
  return agentAskWithClient(client, request).finally(() => {
    void client.close();
  });
}

export async function agentResetSessionWithClient(
  client: AgentToolCaller,
  sessionId: string,
): Promise<AgentResetSessionResponse> {
  const trimmed = sessionId.trim();
  if (!trimmed) {
    throw new ApiError({
      service: AGENT_SERVICE_NAME,
      tool: 'reset_session',
      message: 'Session id is required',
      recovery: 'Start or select a chat session before resetting.',
    });
  }
  try {
    const result = await client.callTool('reset_session', { session_id: trimmed });
    return parseTextJson<AgentResetSessionResponse>(result, 'reset_session');
  } catch (err) {
    throw toAgentApiError('reset_session', err);
  }
}

export function agentResetSession(authToken: string, sessionId: string): Promise<AgentResetSessionResponse> {
  return withAgentClient(authToken, (client) => agentResetSessionWithClient(client, sessionId));
}

export function mapAgentErrorToConnectionState(err: unknown): AgentConnectionState {
  if (err instanceof ApiError) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return { status: 'unauthorized', message: 'Token was rejected by GOFR-Agent.' };
    }
    if (err.statusCode === 421 || /invalid host|misdirected/i.test(err.message)) {
      return {
        status: 'misconfigured',
        message: 'Server is reachable, but GOFR-Agent rejected the MCP Host header. Update backend FastMCP allowed_hosts for the proxy or public MCP host.',
      };
    }
    return { status: 'unavailable', message: err.message };
  }
  const message = safeErrorMessage(err);
  if (/invalid host|misdirected/i.test(message)) {
    return {
      status: 'misconfigured',
      message: 'Server is reachable, but GOFR-Agent rejected the MCP Host header. Update backend FastMCP allowed_hosts for the proxy or public MCP host.',
    };
  }
  return { status: 'unavailable', message };
}

export function isAgentHttpHealthRouteMissing(err: unknown): boolean {
  return err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 405);
}