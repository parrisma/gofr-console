// API service layer
// MCP Streamable HTTP client for GOFR services

import { configStore } from '../../stores/configStore';
import { tokenStore } from '../../stores/tokenStore';
import type { ClientRestrictions } from '../../types/restrictions';
import { ApiError, defaultRecoveryHint } from './errors';
import { logger } from '../logging';
import type { 
  ClientSummary, 
  Source, 
  Instrument, 
  IngestResult,
  ClientProfileResponse,
  ProfileScoreResponse,
  MarketContextResponse,
  UpdateProfileResponse,
  CreateClientResponse,
  DocumentResponse,
  ClientFeedResponse,
  WhyItMattersToClientResponse,
  PortfolioHoldingsResponse,
  PortfolioUpdateResponse,
  WatchlistResponse,
  WatchlistUpdateResponse,
  InstrumentNewsResponse,
  QueryDocumentsResponse,
} from '../../types/gofrIQ';
import type {
  AntiDetectionConfig,
  AntiDetectionResponse,
  ContentOptions,
  ContentResponse,
  DigPingResponse,
  GetSessionResponse,
  ListSessionsResponse,
  PageStructureResponse,
  SessionChunkResponse,
  SessionInfoResponse,
  SessionUrlsJsonResponse,
  SessionUrlsResponse,
  StructureOptions,
} from '../../types/gofrDig';
import type {
  NpCurveFitResponse,
  NpErrorResponse,
  NpFinancialBondPriceResponse,
  NpFinancialConvertRateResponse,
  NpFinancialOptionPriceResponse,
  NpFinancialPvResponse,
  NpFinancialTechnicalIndicatorsResponse,
  NpMathListOperationsResponse,
  NpMathResult,
  NpPingResponse,
} from '../../types/gofrNp';
import type {
  DocAddFragmentResponse,
  DocAddImageFragmentResponse,
  DocAbortSessionResponse,
  DocCreateSessionResponse,
  DocFragmentDetailsResponse,
  DocGetDocumentResponse,
  DocListActiveSessionsResponse,
  DocListSessionFragmentsResponse,
  DocListStylesResponse,
  DocListTemplateFragmentsResponse,
  DocListTemplatesResponse,
  DocParameterType,
  DocPingResponse,
  DocRemoveFragmentResponse,
  DocSessionStatusResponse,
  DocSetGlobalParametersResponse,
  DocTemplateDetailsResponse,
  DocValidateParametersResponse,
  PlotAddPlotFragmentResponse,
  PlotGetImageResponse,
  PlotListHandlersResponse,
  PlotListImagesResponse,
  PlotListThemesResponse,
  PlotRenderGraphInlineMeta,
  PlotRenderGraphProxyData,
  PlotRenderGraphResponse,
} from '../../types/gofrDoc';

// Dynamic base URL based on config
function getBaseUrl(serviceName: string): string {
  return `/api/${serviceName}`;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface HealthCheckResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [];
  let urlHost: string | null = null;

  for (const [key, value] of Object.entries(args)) {
    if (/token|authorization|secret|password|api[_-]?key|cookie/i.test(key)) continue;

    if (key === 'url' && typeof value === 'string') {
      try {
        urlHost = new URL(value).host;
      } catch {
        urlHost = value.split('?')[0];
      }
      continue;
    }

    if (typeof value === 'string') {
      entries.push([key, value.length > 120 ? `${value.slice(0, 120)}...[TRUNCATED]` : value]);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
      entries.push([key, value]);
      continue;
    }
    if (Array.isArray(value)) {
      entries.push([key, `[array:${value.length}]`]);
      continue;
    }
    entries.push([key, '[object]']);
  }

  const summary = Object.fromEntries(entries) as Record<string, unknown>;
  if (urlHost != null) summary.url_host = urlHost;
  return summary;
}

function getTextContent(result: HealthCheckResult, service: string, tool: string): string {
  const textContent = result.content?.find(c => c.type === 'text')?.text;
  if (!textContent) {
    throw new ApiError({
      service,
      tool,
      message: 'No response content returned',
      recovery: defaultRecoveryHint(),
    });
  }
  return textContent;
}

function getImageContent(
  result: HealthCheckResult,
  service: string,
  tool: string,
): { data: string; mimeType: string } {
  const image = result.content?.find(c => c.type === 'image');
  if (!image?.data || !image?.mimeType) {
    throw new ApiError({
      service,
      tool,
      message: 'No image content returned',
      recovery: 'If proxy mode was enabled, call get_image with the returned GUID. Otherwise check the tool output for errors.',
    });
  }
  return { data: image.data, mimeType: image.mimeType };
}

/**
 * Detect common server-side error strings leaked into MCP tool text output.
 * Returns a user-friendly message if detected, or null.
 */
function detectServerError(text: string): string | null {
  const trimmed = text.trimStart();
  // Python tracebacks / NameError / TypeError etc.
  if (/^(Traceback|.*Error:|.*Exception:)/i.test(trimmed)) {
    return `Server returned an error instead of JSON: ${trimmed.slice(0, 300)}`;
  }
  // Generic "name 'x' is not defined" pattern (Python NameError without prefix)
  if (/^name\s+'/.test(trimmed)) {
    return `Server returned a Python NameError: ${trimmed.slice(0, 300)}`;
  }
  return null;
}

function parseToolText<T>(
  service: string,
  tool: string,
  textContent: string
): T {
  try {
    let parsed = JSON.parse(textContent);
    // Handle double-encoded JSON (some MCP tools return a JSON string inside the text field).
    // The server often embeds literal newlines/tabs inside JSON string values which breaks
    // JSON.parse, so we escape them before retrying.
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch {
        try {
          const sanitised = (parsed as string).replace(/[\n\r\t]/g, m =>
            m === '\n' ? '\\n' : m === '\r' ? '\\r' : '\\t');
          parsed = JSON.parse(sanitised);
        } catch { /* keep as-is */ }
      }
    }
    // Tool-level error shapes vary by service/version.
    // Supported:
    // - { status: 'error', error_code, message }
    // - { success: false, error_code, error, recovery_strategy }
    type ToolErrorShape = {
      status?: unknown;
      success?: unknown;
      error_code?: unknown;
      message?: unknown;
      error?: unknown;
      recovery_strategy?: unknown;
      recovery?: unknown;
      data?: unknown;
    };

    const obj: ToolErrorShape | null = parsed && typeof parsed === 'object' ? (parsed as ToolErrorShape) : null;

    if (obj && obj.success === false) {
      throw new ApiError({
        service,
        tool,
        code: typeof obj.error_code === 'string' || typeof obj.error_code === 'number' ? obj.error_code : undefined,
        message:
          typeof obj.error === 'string'
            ? obj.error
            : typeof obj.message === 'string'
              ? obj.message
              : 'Tool returned error',
        recovery:
          typeof obj.recovery_strategy === 'string'
            ? obj.recovery_strategy
            : typeof obj.recovery === 'string'
              ? obj.recovery
              : defaultRecoveryHint(),
      });
    }
    if (obj && obj.status === 'error') {
      throw new ApiError({
        service,
        tool,
        code: typeof obj.error_code === 'string' || typeof obj.error_code === 'number' ? obj.error_code : undefined,
        message:
          typeof obj.message === 'string'
            ? obj.message
            : typeof obj.error === 'string'
              ? obj.error
              : 'Tool returned error',
        recovery:
          typeof obj.recovery_strategy === 'string'
            ? obj.recovery_strategy
            : typeof obj.recovery === 'string'
              ? obj.recovery
              : defaultRecoveryHint(),
      });
    }
    return (parsed.data || parsed) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;

    // Check whether the raw text is a server-side error leaked as tool output
    const serverErr = detectServerError(textContent);
    if (serverErr) {
      logger.error({
        event: 'api_parse_error',
        message: `Server-side error in tool output: ${service}/${tool}`,
        component: 'api',
        service_name: service,
        tool_name: tool,
        result: 'failure',
        error_code: 'SERVER_ERROR_IN_OUTPUT',
        data: { raw_snippet: textContent.slice(0, 500) },
      });
      throw new ApiError({
        service,
        tool,
        message: serverErr,
        recovery: 'This is a server-side bug — the MCP tool returned an error string instead of JSON. Check server logs.',
      });
    }

    // Generic JSON parse failure — include a snippet of what was received
    const snippet = textContent.length > 200
      ? textContent.slice(0, 200) + '…'
      : textContent;
    logger.error({
      event: 'api_parse_error',
      message: `Failed to parse tool output as JSON: ${service}/${tool}`,
      component: 'api',
      service_name: service,
      tool_name: tool,
      result: 'failure',
      error_code: 'JSON_PARSE_ERROR',
      data: { raw_snippet: textContent.slice(0, 500) },
    });
    throw new ApiError({
      service,
      tool,
      message: `Response is not valid JSON. Server returned: ${snippet}`,
      recovery: 'The MCP tool returned non-JSON text. Check server logs for errors.',
      cause: err,
    });
  }
}

function extractNpErrorInfo(data: unknown): { error: string; detail?: string; recovery?: string } | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.error !== 'string') return null;
  return {
    error: obj.error,
    detail: typeof obj.detail === 'string' ? obj.detail : undefined,
    recovery: typeof obj.recovery === 'string' ? obj.recovery : undefined,
  };
}

function getNpAuthTokenFromConfig(): string | undefined {
  const tokens = tokenStore.tokens;
  if (!tokens || tokens.length === 0) return undefined;

  const preferred =
    tokens.find((t) => t.name === 'all' && t.token) ??
    tokens.find((t) => t.name === 'admin' && t.token) ??
    tokens.find((t) => t.token);
  return preferred?.token;
}

async function callNpToolWithAuthFallback<T>(
  toolName: string,
  args: Record<string, unknown> = {},
  explicitAuthToken?: string,
): Promise<T> {
  const client = getMcpClient('gofr-np');

  const applyAuthToArgs = (baseArgs: Record<string, unknown>, token: string): Record<string, unknown> => {
    const next: Record<string, unknown> = { ...baseArgs };
    if (!('auth_token' in next)) next.auth_token = token;
    if (!('token' in next)) next.token = token;
    return next;
  };

  // First attempt: use explicit token if provided, otherwise no auth (historically public)
  const firstArgs = explicitAuthToken ? applyAuthToArgs(args, explicitAuthToken) : args;
  const first = await client.callTool<HealthCheckResult>(toolName, firstArgs, explicitAuthToken);
  const firstText = getTextContent(first, 'gofr-np', toolName);
  const firstData = parseToolText<T | NpErrorResponse>('gofr-np', toolName, firstText);
  const firstErr = extractNpErrorInfo(firstData);
  if (!firstErr) return firstData as T;

  // If the caller provided a token but it still failed, do not attempt further fallbacks.
  if (explicitAuthToken) {
    throw new ApiError({
      service: 'gofr-np',
      tool: toolName,
      message: firstErr.detail ? `${firstErr.error}: ${firstErr.detail}` : firstErr.error,
      recovery: firstErr.recovery ?? defaultRecoveryHint(),
    });
  }

  // Retry once with auth token if the service now requires it.
  if (/^AUTH_REQUIRED\b/i.test(firstErr.error)) {
    const token = getNpAuthTokenFromConfig();
    if (token) {
      const secondArgs = applyAuthToArgs(args, token);
      const second = await client.callTool<HealthCheckResult>(toolName, secondArgs, token);
      const secondText = getTextContent(second, 'gofr-np', toolName);
      const secondData = parseToolText<T | NpErrorResponse>('gofr-np', toolName, secondText);
      const secondErr = extractNpErrorInfo(secondData);
      if (!secondErr) return secondData as T;
      throw new ApiError({
        service: 'gofr-np',
        tool: toolName,
        message: secondErr.detail ? `${secondErr.error}: ${secondErr.detail}` : secondErr.error,
        recovery: secondErr.recovery ?? defaultRecoveryHint(),
      });
    }
  }

  throw new ApiError({
    service: 'gofr-np',
    tool: toolName,
    message: firstErr.detail ? `${firstErr.error}: ${firstErr.detail}` : firstErr.error,
    recovery: firstErr.recovery ?? defaultRecoveryHint(),
  });
}

// Test hook (intentionally not documented as public API)
// Allows unit tests to validate MCP parsing behavior.
export const __test__parseToolText = parseToolText;

// Parse SSE response to get JSON-RPC message
async function parseSseResponse<T>(response: Response): Promise<JsonRpcResponse<T>> {
  const text = await response.text();
  // SSE format: "event: message\ndata: {...}\n\n"
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonStr = line.substring(6);
      return JSON.parse(jsonStr) as JsonRpcResponse<T>;
    }
  }
  throw new Error('No data in SSE response');
}

// MCP Streamable HTTP Client
class McpClient {
  private serviceName: string;
  private sessionId: string | null = null;
  private requestId = 0;
  /** Mutex: if an initialize() is in-flight, all callers share this single promise */
  private initPromise: Promise<void> | null = null;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private get baseUrl(): string {
    return getBaseUrl(this.serviceName);
  }

  private nextId(): number {
    return ++this.requestId;
  }

  // Get current port from config
  getPort(): number {
    return configStore.getMcpPort(this.serviceName);
  }

  private getMcpEndpointUrl(): string {
    // Most MCP services are reachable at /mcp/ via our proxies.
    // GOFR-IQ redirects /mcp/ -> /mcp (307), so we must call it without the trailing slash.
    return `${this.baseUrl}${this.serviceName === 'gofr-iq' ? '/mcp' : '/mcp/'}`;
  }

  // Initialize MCP session (with mutex to prevent concurrent races)
  async initialize(): Promise<void> {
    // If another caller is already initializing, piggy-back on that promise
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.doInitialize();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /** Internal initialization — callers must go through initialize() for mutex */
  private async doInitialize(): Promise<void> {
    const INIT_TIMEOUT_MS = 10_000;
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(`${this.serviceName} initialize timed out after ${INIT_TIMEOUT_MS / 1000}s`),
      INIT_TIMEOUT_MS,
    );

    try {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: this.nextId(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'gofr-console',
            version: '0.0.1',
          },
        },
      };

      const response = await fetch(this.getMcpEndpointUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId }),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Extract session ID from response header
      const newSessionId = response.headers.get('mcp-session-id');
      if (newSessionId) {
        this.sessionId = newSessionId;
      }

      if (!response.ok) {
        throw new Error(`MCP init failed: HTTP ${response.status}`);
      }

      const result = await parseSseResponse(response);
      if (result.error) {
        throw new Error(`MCP init error: ${result.error.message}`);
      }

      // Send initialized notification
      await this.notify('notifications/initialized', {});
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const message = isTimeout
        ? `Service ${this.serviceName} is unreachable (initialize timed out after ${INIT_TIMEOUT_MS / 1000}s)`
        : err instanceof Error ? err.message : 'MCP initialize failed';
      logger.error({
        event: isTimeout ? 'mcp_init_timeout' : 'mcp_init_failed',
        message,
        component: 'api',
        service_name: this.serviceName,
        dependency: `${this.serviceName}-mcp`,
        result: isTimeout ? 'timeout' : 'failure',
      });
      throw new ApiError({
        service: this.serviceName,
        tool: 'initialize',
        message,
        recovery: `Verify the ${this.serviceName} service container is running and reachable.`,
        cause: err,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // Send notification (no response expected)
  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    const NOTIFY_TIMEOUT_MS = 5_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NOTIFY_TIMEOUT_MS);
    try {
      await fetch(this.getMcpEndpointUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId }),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method,
          params,
        }),
        signal: controller.signal,
      });
    } catch {
      // Notifications are fire-and-forget; log but do not throw
      logger.warn({
        event: 'mcp_notify_failed',
        message: `MCP notification ${method} failed for ${this.serviceName}`,
        component: 'api',
        service_name: this.serviceName,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // Reset session (call when environment changes)
  resetSession(): void {
    this.sessionId = null;
    this.requestId = 0;
    this.initPromise = null;
  }

  // Call an MCP tool
  async callTool<T>(toolName: string, args: Record<string, unknown> = {}, authToken?: string, _retried = false): Promise<T> {
    const requestId = logger.createRequestId();
    const startedAt = performance.now();
    logger.info({
      event: 'api_call_started',
      message: `MCP tool call started: ${this.serviceName}/${toolName}`,
      request_id: requestId,
      operation: toolName,
      component: 'api',
      service_name: this.serviceName,
      tool_name: toolName,
      dependency: `${this.serviceName}-mcp`,
      data: {
        retried: _retried,
        args: summarizeArgs(args),
      },
    });

    // Ensure session is initialized
    if (!this.sessionId) {
      await this.initialize();
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(`${this.serviceName}/${toolName} timed out after 40 s`),
      40000,
    );
    let response: Response;
    try {
      response = await fetch(this.getMcpEndpointUrl(), {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      logger.error({
        event: isTimeout ? 'api_call_timed_out' : 'api_call_failed',
        message: isTimeout
          ? `MCP tool call timed out: ${this.serviceName}/${toolName}`
          : `MCP tool call failed: ${this.serviceName}/${toolName}`,
        request_id: requestId,
        operation: toolName,
        component: 'api',
        service_name: this.serviceName,
        tool_name: toolName,
        dependency: `${this.serviceName}-mcp`,
        result: isTimeout ? 'timeout' : 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        error_code: isTimeout ? 'TIMEOUT' : undefined,
        data: {
          cause: err instanceof Error ? err.message : 'Network request failed',
        },
      });
      throw new ApiError({
        service: this.serviceName,
        tool: toolName,
        message: err instanceof Error ? err.message : 'Network request failed',
        recovery: 'Check MCP connectivity and retry.',
        cause: err,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Session may have expired — re-initialize once, then retry
      if ((response.status === 400 || response.status === 404) && !_retried) {
        logger.warn({
          event: 'api_call_failed',
          message: `MCP session expired, retrying: ${this.serviceName}/${toolName}`,
          request_id: requestId,
          operation: toolName,
          component: 'api',
          service_name: this.serviceName,
          tool_name: toolName,
          dependency: `${this.serviceName}-mcp`,
          result: 'failure',
          http_status: response.status,
          duration_ms: Math.round(performance.now() - startedAt),
          error_code: String(response.status),
        });
        this.sessionId = null;
        await this.initialize();
        return this.callTool(toolName, args, authToken, true);
      }
      if (response.status === 401 || response.status === 403) {
        logger.error({
          event: 'api_call_failed',
          message: `MCP unauthorized: ${this.serviceName}/${toolName}`,
          request_id: requestId,
          operation: toolName,
          component: 'api',
          service_name: this.serviceName,
          tool_name: toolName,
          dependency: `${this.serviceName}-mcp`,
          result: 'failure',
          http_status: response.status,
          duration_ms: Math.round(performance.now() - startedAt),
          error_code: 'AUTH',
        });
        throw new ApiError({
          service: this.serviceName,
          tool: toolName,
          statusCode: response.status,
          message: 'Unauthorized or forbidden',
          recovery: defaultRecoveryHint(response.status),
        });
      }
      logger.error({
        event: 'api_call_failed',
        message: `MCP call failed: ${this.serviceName}/${toolName}`,
        request_id: requestId,
        operation: toolName,
        component: 'api',
        service_name: this.serviceName,
        tool_name: toolName,
        dependency: `${this.serviceName}-mcp`,
        result: 'failure',
        http_status: response.status,
        duration_ms: Math.round(performance.now() - startedAt),
        error_code: String(response.status),
      });
      throw new ApiError({
        service: this.serviceName,
        tool: toolName,
        statusCode: response.status,
        message: 'MCP call failed',
        recovery: defaultRecoveryHint(response.status),
      });
    }

    let result: JsonRpcResponse<T>;
    try {
      result = await parseSseResponse<T>(response);
    } catch (err) {
      logger.error({
        event: 'api_call_failed',
        message: `Failed to parse MCP SSE response: ${this.serviceName}/${toolName}`,
        request_id: requestId,
        operation: toolName,
        component: 'api',
        service_name: this.serviceName,
        tool_name: toolName,
        dependency: `${this.serviceName}-mcp`,
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        error_code: 'SSE_PARSE_ERROR',
      });
      throw new ApiError({
        service: this.serviceName,
        tool: toolName,
        message: err instanceof Error ? err.message : 'Failed to parse MCP response',
        recovery: 'Check MCP logs for malformed SSE output.',
        cause: err,
      });
    }
    if (result.error) {
      logger.error({
        event: 'api_call_failed',
        message: `MCP tool error: ${this.serviceName}/${toolName}`,
        request_id: requestId,
        operation: toolName,
        component: 'api',
        service_name: this.serviceName,
        tool_name: toolName,
        dependency: `${this.serviceName}-mcp`,
        result: 'failure',
        duration_ms: Math.round(performance.now() - startedAt),
        error_code: String(result.error.code),
        data: {
          mcp_error: result.error.message,
        },
      });
      throw new ApiError({
        service: this.serviceName,
        tool: toolName,
        code: result.error.code,
        message: result.error.message,
        recovery: defaultRecoveryHint(),
      });
    }

    logger.info({
      event: 'api_call_succeeded',
      message: `MCP tool call succeeded: ${this.serviceName}/${toolName}`,
      request_id: requestId,
      operation: toolName,
      component: 'api',
      service_name: this.serviceName,
      tool_name: toolName,
      dependency: `${this.serviceName}-mcp`,
      result: 'success',
      duration_ms: Math.round(performance.now() - startedAt),
    });

    return result.result as T;
  }
}

// MCP clients for each service
const mcpClients: Record<string, McpClient> = {
  'gofr-iq': new McpClient('gofr-iq'),
  'gofr-doc': new McpClient('gofr-doc'),
  'gofr-plot': new McpClient('gofr-plot'),
  'gofr-np': new McpClient('gofr-np'),
  'gofr-dig': new McpClient('gofr-dig'),
};

// Reset all sessions when environment changes
configStore.subscribe(() => {
  Object.values(mcpClients).forEach(client => client.resetSession());
});

// Get MCP client for a service
export function getMcpClient(serviceName: string): McpClient {
  switch (serviceName) {
    case 'gofr-iq':
      return mcpClients['gofr-iq'];
    case 'gofr-doc':
      return mcpClients['gofr-doc'];
    case 'gofr-plot':
      return mcpClients['gofr-plot'];
    case 'gofr-np':
      return mcpClients['gofr-np'];
    case 'gofr-dig':
      return mcpClients['gofr-dig'];
    default:
      throw new Error(`Unknown MCP service: ${serviceName}`);
  }
}

interface HealthData {
  status: string;
  message: string;
  services: {
    neo4j: { status: string; message: string; node_count?: number };
    chromadb: { status: string; message: string; document_count?: number };
    llm: { status: string; message: string; chat_model?: string };
  };
  timestamp: string;
}

export const api = {
  // GOFR-IQ Health Check
  healthCheck: async () => {
    // Default response returned when GOFR-IQ is unreachable
    const defaultResponse = {
      status: 'unknown',
      message: 'GOFR-IQ service is unavailable',
      services: {
        neo4j: { status: 'unknown', message: 'Service unreachable' },
        chromadb: { status: 'unknown', message: 'Service unreachable' },
        llm: { status: 'unknown', message: 'Service unreachable' },
      },
      timestamp: new Date().toISOString(),
    };

    let result: HealthCheckResult;
    try {
      const client = getMcpClient('gofr-iq');
      result = await client.callTool<HealthCheckResult>('health_check');
    } catch (err) {
      logger.warn({
        event: 'health_check_unavailable',
        message: `GOFR-IQ health check failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        component: 'api',
        service_name: 'gofr-iq',
      });
      return defaultResponse;
    }
    
    // Parse the text content from MCP response
    const textContent = result.content?.find(c => c.type === 'text')?.text;
    
    if (!textContent) return defaultResponse;

    try {
      // The text content is a JSON string containing status and data
      const parsed = JSON.parse(textContent);
      const data: HealthData = parsed.data || parsed;

      return {
        status: data.status,
        message: data.message,
        services: {
          neo4j: data.services.neo4j,
          chromadb: data.services.chromadb,
          llm: data.services.llm,
        },
        timestamp: data.timestamp,
      };
    } catch {
      return defaultResponse;
    }
  },

  // ---------------------------------------------------------------------------
  // Generic MCP helpers
  // ---------------------------------------------------------------------------

  mcpPing: async (serviceName: string): Promise<boolean> => {
    try {
      const client = getMcpClient(serviceName);
      const result = await client.callTool<HealthCheckResult>('ping', {});
      // Consider it reachable if we got any text payload back.
      getTextContent(result, serviceName, 'ping');
      return true;
    } catch {
      return false;
    }
  },

  // ---------------------------------------------------------------------------
  // GOFR-NP (MCP, public)
  // ---------------------------------------------------------------------------

  npPing: async (): Promise<NpPingResponse> => {
    const client = getMcpClient('gofr-np');
    const result = await client.callTool<HealthCheckResult>('ping', {});
    const textContent = getTextContent(result, 'gofr-np', 'ping');
    return parseToolText<NpPingResponse>('gofr-np', 'ping', textContent);
  },

  npMathListOperations: async (): Promise<NpMathListOperationsResponse> => {
    return callNpToolWithAuthFallback<NpMathListOperationsResponse>('math_list_operations', {});
  },

  npMathCompute: async (args: Record<string, unknown>, authToken?: string): Promise<NpMathResult> => {
    return callNpToolWithAuthFallback<NpMathResult>('math_compute', args, authToken);
  },

  npCurveFit: async (args: Record<string, unknown>, authToken?: string): Promise<NpCurveFitResponse> => {
    return callNpToolWithAuthFallback<NpCurveFitResponse>('curve_fit', args, authToken);
  },

  npCurvePredict: async (args: Record<string, unknown>, authToken?: string): Promise<NpMathResult> => {
    return callNpToolWithAuthFallback<NpMathResult>('curve_predict', args, authToken);
  },

  npFinancialPv: async (args: Record<string, unknown>, authToken?: string): Promise<NpFinancialPvResponse> => {
    return callNpToolWithAuthFallback<NpFinancialPvResponse>('financial_pv', args, authToken);
  },

  npFinancialConvertRate: async (args: Record<string, unknown>, authToken?: string): Promise<NpFinancialConvertRateResponse> => {
    return callNpToolWithAuthFallback<NpFinancialConvertRateResponse>('financial_convert_rate', args, authToken);
  },

  npFinancialOptionPrice: async (args: Record<string, unknown>, authToken?: string): Promise<NpFinancialOptionPriceResponse> => {
    return callNpToolWithAuthFallback<NpFinancialOptionPriceResponse>('financial_option_price', args, authToken);
  },

  npFinancialBondPrice: async (args: Record<string, unknown>, authToken?: string): Promise<NpFinancialBondPriceResponse> => {
    return callNpToolWithAuthFallback<NpFinancialBondPriceResponse>('financial_bond_price', args, authToken);
  },

  npFinancialTechnicalIndicators: async (args: Record<string, unknown>, authToken?: string): Promise<NpFinancialTechnicalIndicatorsResponse> => {
    return callNpToolWithAuthFallback<NpFinancialTechnicalIndicatorsResponse>('financial_technical_indicators', args, authToken);
  },

  // ---------------------------------------------------------------------------
  // GOFR-DOC (MCP)
  // ---------------------------------------------------------------------------

  docPing: async (): Promise<DocPingResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('ping', {});
    const textContent = getTextContent(result, 'gofr-doc', 'ping');
    return parseToolText<DocPingResponse>('gofr-doc', 'ping', textContent);
  },

  // Help is expected to be readable text; do not force JSON parsing.
  docHelpText: async (): Promise<string> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('help', {});
    return getTextContent(result, 'gofr-doc', 'help');
  },

  docListTemplates: async (): Promise<DocListTemplatesResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('list_templates', {});
    const textContent = getTextContent(result, 'gofr-doc', 'list_templates');
    return parseToolText<DocListTemplatesResponse>('gofr-doc', 'list_templates', textContent);
  },

  docGetTemplateDetails: async (
    templateId: string,
    authToken?: string
  ): Promise<DocTemplateDetailsResponse> => {
    const client = getMcpClient('gofr-doc');
    const params: Record<string, unknown> = { template_id: templateId };
    if (authToken) {
      params.auth_token = authToken;
      params.token = authToken;
    }
    const result = await client.callTool<HealthCheckResult>('get_template_details', params);
    const textContent = getTextContent(result, 'gofr-doc', 'get_template_details');
    return parseToolText<DocTemplateDetailsResponse>('gofr-doc', 'get_template_details', textContent);
  },

  docListTemplateFragments: async (
    templateId: string,
    authToken?: string
  ): Promise<DocListTemplateFragmentsResponse> => {
    const client = getMcpClient('gofr-doc');
    const params: Record<string, unknown> = { template_id: templateId };
    if (authToken) {
      params.auth_token = authToken;
      params.token = authToken;
    }
    const result = await client.callTool<HealthCheckResult>('list_template_fragments', params);
    const textContent = getTextContent(result, 'gofr-doc', 'list_template_fragments');
    return parseToolText<DocListTemplateFragmentsResponse>('gofr-doc', 'list_template_fragments', textContent);
  },

  docGetFragmentDetails: async (
    templateId: string,
    fragmentId: string,
    authToken?: string
  ): Promise<DocFragmentDetailsResponse> => {
    const client = getMcpClient('gofr-doc');
    const params: Record<string, unknown> = { template_id: templateId, fragment_id: fragmentId };
    if (authToken) {
      params.auth_token = authToken;
      params.token = authToken;
    }
    const result = await client.callTool<HealthCheckResult>('get_fragment_details', params);
    const textContent = getTextContent(result, 'gofr-doc', 'get_fragment_details');
    return parseToolText<DocFragmentDetailsResponse>('gofr-doc', 'get_fragment_details', textContent);
  },

  docListStyles: async (): Promise<DocListStylesResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('list_styles', {});
    const textContent = getTextContent(result, 'gofr-doc', 'list_styles');
    return parseToolText<DocListStylesResponse>('gofr-doc', 'list_styles', textContent);
  },

  docCreateDocumentSession: async (
    authToken: string,
    templateId: string,
    alias: string
  ): Promise<DocCreateSessionResponse> => {
    const client = getMcpClient('gofr-doc');
    const params: Record<string, unknown> = {
      template_id: templateId,
      alias,
      auth_token: authToken,
      token: authToken,
    };
    const result = await client.callTool<HealthCheckResult>('create_document_session', params);
    const textContent = getTextContent(result, 'gofr-doc', 'create_document_session');
    return parseToolText<DocCreateSessionResponse>('gofr-doc', 'create_document_session', textContent);
  },

  docListActiveSessions: async (authToken: string): Promise<DocListActiveSessionsResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('list_active_sessions', {
      auth_token: authToken,
      token: authToken,
    });
    const textContent = getTextContent(result, 'gofr-doc', 'list_active_sessions');
    return parseToolText<DocListActiveSessionsResponse>('gofr-doc', 'list_active_sessions', textContent);
  },

  docGetSessionStatus: async (authToken: string, sessionId: string): Promise<DocSessionStatusResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('get_session_status', {
      auth_token: authToken,
      token: authToken,
      session_id: sessionId,
    });
    const textContent = getTextContent(result, 'gofr-doc', 'get_session_status');
    return parseToolText<DocSessionStatusResponse>('gofr-doc', 'get_session_status', textContent);
  },

  docAbortDocumentSession: async (
    authToken: string,
    sessionId: string
  ): Promise<DocAbortSessionResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('abort_document_session', {
      auth_token: authToken,
      token: authToken,
      session_id: sessionId,
    });
    const textContent = getTextContent(result, 'gofr-doc', 'abort_document_session');
    return parseToolText<DocAbortSessionResponse>('gofr-doc', 'abort_document_session', textContent);
  },

  docValidateParameters: async (args: {
    templateId: string;
    parameterType: DocParameterType;
    parameters: unknown;
    fragmentId?: string;
    authToken?: string;
  }): Promise<DocValidateParametersResponse> => {
    const client = getMcpClient('gofr-doc');
    const params: Record<string, unknown> = {
      template_id: args.templateId,
      parameter_type: args.parameterType,
      parameters: args.parameters,
    };
    if (args.fragmentId) params.fragment_id = args.fragmentId;
    if (args.authToken) {
      params.auth_token = args.authToken;
      params.token = args.authToken;
    }
    const result = await client.callTool<HealthCheckResult>('validate_parameters', params);
    const textContent = getTextContent(result, 'gofr-doc', 'validate_parameters');
    return parseToolText<DocValidateParametersResponse>('gofr-doc', 'validate_parameters', textContent);
  },

  docSetGlobalParameters: async (
    authToken: string,
    sessionId: string,
    parameters: unknown
  ): Promise<DocSetGlobalParametersResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('set_global_parameters', {
      auth_token: authToken,
      token: authToken,
      session_id: sessionId,
      parameters,
    });
    const textContent = getTextContent(result, 'gofr-doc', 'set_global_parameters');
    return parseToolText<DocSetGlobalParametersResponse>('gofr-doc', 'set_global_parameters', textContent);
  },

  docAddFragment: async (authToken: string, args: {
    sessionId: string;
    fragmentId: string;
    parameters: unknown;
    position?: string;
  }): Promise<DocAddFragmentResponse> => {
    const client = getMcpClient('gofr-doc');
    const params: Record<string, unknown> = {
      auth_token: authToken,
      token: authToken,
      session_id: args.sessionId,
      fragment_id: args.fragmentId,
      parameters: args.parameters,
    };
    if (args.position) params.position = args.position;
    const result = await client.callTool<HealthCheckResult>('add_fragment', params);
    const textContent = getTextContent(result, 'gofr-doc', 'add_fragment');
    return parseToolText<DocAddFragmentResponse>('gofr-doc', 'add_fragment', textContent);
  },

  docAddImageFragment: async (authToken: string, args: {
    sessionId: string;
    imageUrl: string;
    title?: string;
    altText?: string;
    alignment?: string;
    requireHttps?: boolean;
    width?: number;
    height?: number;
    position?: string;
  }): Promise<DocAddImageFragmentResponse> => {
    const client = getMcpClient('gofr-doc');
    const params: Record<string, unknown> = {
      auth_token: authToken,
      token: authToken,
      session_id: args.sessionId,
      image_url: args.imageUrl,
    };
    if (args.title) params.title = args.title;
    if (args.altText) params.alt_text = args.altText;
    if (args.alignment) params.alignment = args.alignment;
    if (args.requireHttps != null) params.require_https = args.requireHttps;
    if (args.width != null) params.width = args.width;
    if (args.height != null) params.height = args.height;
    if (args.position) params.position = args.position;
    const result = await client.callTool<HealthCheckResult>('add_image_fragment', params);
    const textContent = getTextContent(result, 'gofr-doc', 'add_image_fragment');
    return parseToolText<DocAddImageFragmentResponse>('gofr-doc', 'add_image_fragment', textContent);
  },

  docListSessionFragments: async (
    authToken: string,
    sessionId: string
  ): Promise<DocListSessionFragmentsResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('list_session_fragments', {
      auth_token: authToken,
      token: authToken,
      session_id: sessionId,
    });
    const textContent = getTextContent(result, 'gofr-doc', 'list_session_fragments');
    return parseToolText<DocListSessionFragmentsResponse>('gofr-doc', 'list_session_fragments', textContent);
  },

  docRemoveFragment: async (
    authToken: string,
    sessionId: string,
    fragmentInstanceGuid: string
  ): Promise<DocRemoveFragmentResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('remove_fragment', {
      auth_token: authToken,
      token: authToken,
      session_id: sessionId,
      fragment_instance_guid: fragmentInstanceGuid,
    });
    const textContent = getTextContent(result, 'gofr-doc', 'remove_fragment');
    return parseToolText<DocRemoveFragmentResponse>('gofr-doc', 'remove_fragment', textContent);
  },

  docGetDocument: async (authToken: string, args: {
    sessionId: string;
    format: 'html' | 'md' | 'pdf';
    styleId?: string;
    proxy?: boolean;
  }): Promise<DocGetDocumentResponse> => {
    const client = getMcpClient('gofr-doc');
    const params: Record<string, unknown> = {
      auth_token: authToken,
      token: authToken,
      session_id: args.sessionId,
      format: args.format,
    };
    if (args.styleId) params.style_id = args.styleId;
    if (args.proxy != null) params.proxy = args.proxy;
    const result = await client.callTool<HealthCheckResult>('get_document', params);
    const textContent = getTextContent(result, 'gofr-doc', 'get_document');
    return parseToolText<DocGetDocumentResponse>('gofr-doc', 'get_document', textContent);
  },

  // ---------------------------------------------------------------------------
  // GOFR-PLOT (via GOFR-DOC plot tools)
  // ---------------------------------------------------------------------------

  docPlotListThemes: async (): Promise<PlotListThemesResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('list_themes', {});
    const textContent = getTextContent(result, 'gofr-doc', 'list_themes');
    return parseToolText<PlotListThemesResponse>('gofr-doc', 'list_themes', textContent);
  },

  docPlotListHandlers: async (): Promise<PlotListHandlersResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('list_handlers', {});
    const textContent = getTextContent(result, 'gofr-doc', 'list_handlers');
    return parseToolText<PlotListHandlersResponse>('gofr-doc', 'list_handlers', textContent);
  },

  docPlotListImages: async (authToken: string): Promise<PlotListImagesResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('list_images', {
      auth_token: authToken,
      token: authToken,
    });
    const textContent = getTextContent(result, 'gofr-doc', 'list_images');
    return parseToolText<PlotListImagesResponse>('gofr-doc', 'list_images', textContent);
  },

  docPlotGetImage: async (authToken: string, identifier: string): Promise<PlotGetImageResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('get_image', {
      auth_token: authToken,
      token: authToken,
      identifier,
    });

    const image = getImageContent(result, 'gofr-doc', 'get_image');
    const textContent = getTextContent(result, 'gofr-doc', 'get_image');
    const meta = parseToolText<PlotGetImageResponse['meta']>('gofr-doc', 'get_image', textContent);

    return { image, meta };
  },

  docPlotRenderGraph: async (
    authToken: string,
    params: Record<string, unknown>,
  ): Promise<PlotRenderGraphResponse> => {
    const client = getMcpClient('gofr-doc');

    const result = await client.callTool<HealthCheckResult>('render_graph', {
      auth_token: authToken,
      token: authToken,
      ...params,
    });

    // Proxy mode returns JSON text only; inline mode returns image + JSON meta.
    const hasImage = Boolean(result.content?.some((c) => c.type === 'image'));
    const textContent = getTextContent(result, 'gofr-doc', 'render_graph');

    if (!hasImage) {
      const data = parseToolText<PlotRenderGraphProxyData>('gofr-doc', 'render_graph', textContent);
      return { mode: 'proxy', data };
    }

    const image = getImageContent(result, 'gofr-doc', 'render_graph');
    const meta = parseToolText<PlotRenderGraphInlineMeta>('gofr-doc', 'render_graph', textContent);

    return { mode: 'inline', image, meta };
  },

  docPlotAddPlotFragment: async (
    authToken: string,
    args: Record<string, unknown>,
  ): Promise<PlotAddPlotFragmentResponse> => {
    const client = getMcpClient('gofr-doc');
    const result = await client.callTool<HealthCheckResult>('add_plot_fragment', {
      auth_token: authToken,
      token: authToken,
      ...args,
    });
    const textContent = getTextContent(result, 'gofr-doc', 'add_plot_fragment');
    return parseToolText<PlotAddPlotFragmentResponse>('gofr-doc', 'add_plot_fragment', textContent);
  },

  // Get current environment info
  getEnvironment: () => ({
    environment: configStore.environment,
    port: configStore.getMcpPort('gofr-iq'),
  }),

  // GOFR-DIG Health Check (ping) — unauthenticated, no auth_token
  digPing: async (): Promise<DigPingResponse> => {
    const client = getMcpClient('gofr-dig');
    const result = await client.callTool<HealthCheckResult>('ping', {});
    const textContent = getTextContent(result, 'gofr-dig', 'ping');
    return parseToolText<DigPingResponse>('gofr-dig', 'ping', textContent);
  },

  // Configure anti-detection for GOFR-DIG
  digSetAntiDetection: async (
    authToken: string | undefined,
    settings: AntiDetectionConfig
  ): Promise<AntiDetectionResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = { ...settings };
    if (authToken) params.auth_token = authToken;
    const result = await client.callTool<HealthCheckResult>('set_antidetection', params);
    const textContent = getTextContent(result, 'gofr-dig', 'set_antidetection');
    return parseToolText<AntiDetectionResponse>('gofr-dig', 'set_antidetection', textContent);
  },

  // Analyze page structure
  digGetStructure: async (
    authToken: string | undefined,
    url: string,
    options: StructureOptions = {}
  ): Promise<PageStructureResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = { url, ...options };
    if (authToken) params.auth_token = authToken;
    const result = await client.callTool<HealthCheckResult>('get_structure', params);
    const textContent = getTextContent(result, 'gofr-dig', 'get_structure');
    return parseToolText<PageStructureResponse>('gofr-dig', 'get_structure', textContent);
  },

  // Fetch and extract content
  digGetContent: async (
    authToken: string | undefined,
    url: string,
    options: ContentOptions = {}
  ): Promise<ContentResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = { url, ...options };
    if (authToken) params.auth_token = authToken;
    const result = await client.callTool<HealthCheckResult>('get_content', params);
    const textContent = getTextContent(result, 'gofr-dig', 'get_content');
    return parseToolText<ContentResponse>('gofr-dig', 'get_content', textContent);
  },

  // Get session metadata
  digGetSessionInfo: async (
    authToken: string | undefined,
    sessionId: string
  ): Promise<SessionInfoResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = { session_id: sessionId };
    if (authToken) params.auth_token = authToken;
    const result = await client.callTool<HealthCheckResult>('get_session_info', params);
    const textContent = getTextContent(result, 'gofr-dig', 'get_session_info');
    return parseToolText<SessionInfoResponse>('gofr-dig', 'get_session_info', textContent);
  },

  // Get a session chunk
  digGetSessionChunk: async (
    authToken: string | undefined,
    sessionId: string,
    chunkIndex: number
  ): Promise<SessionChunkResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = { session_id: sessionId, chunk_index: chunkIndex };
    if (authToken) params.auth_token = authToken;
    const result = await client.callTool<HealthCheckResult>('get_session_chunk', params);
    const textContent = getTextContent(result, 'gofr-dig', 'get_session_chunk');
    const parsed = parseToolText<SessionChunkResponse>('gofr-dig', 'get_session_chunk', textContent);
    // DEBUG: log actual runtime type so we can diagnose empty-chunk issues
    if (typeof parsed !== 'object' || parsed === null) {
      logger.warn({
        event: 'api_call_failed',
        message: 'digGetSessionChunk parseToolText returned non-object',
        operation: 'get_session_chunk',
        component: 'api',
        service_name: 'gofr-dig',
        tool_name: 'get_session_chunk',
        dependency: 'gofr-dig-mcp',
        result: 'failure',
        error_code: 'INVALID_PARSE_RESULT',
        data: { parsed_type: typeof parsed },
      });
    }
    return parsed;
  },

  // Get chunk URLs for a session (for automation / direct HTTP access)
  digGetSessionUrls: async (
    authToken: string | undefined,
    sessionId: string,
    options?: { asJson?: boolean; baseUrl?: string }
  ): Promise<SessionUrlsResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = { session_id: sessionId };
    if (authToken) params.auth_token = authToken;
    // as_json defaults to true in the new API; pass false explicitly for URL mode
    if (options?.asJson != null) params.as_json = options.asJson;
    if (options?.baseUrl) params.base_url = options.baseUrl;
    const result = await client.callTool<HealthCheckResult>('get_session_urls', params);
    const textContent = getTextContent(result, 'gofr-dig', 'get_session_urls');
    return parseToolText<SessionUrlsResponse>('gofr-dig', 'get_session_urls', textContent);
  },

  // Get chunk references as JSON (for MCP-based automation: N8N, agents)
  digGetSessionUrlsAsJson: async (
    authToken: string | undefined,
    sessionId: string
  ): Promise<SessionUrlsJsonResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = { session_id: sessionId, as_json: true };
    if (authToken) params.auth_token = authToken;
    const result = await client.callTool<HealthCheckResult>('get_session_urls', params);
    const textContent = getTextContent(result, 'gofr-dig', 'get_session_urls');
    return parseToolText<SessionUrlsJsonResponse>('gofr-dig', 'get_session_urls', textContent);
  },

  // Get full session content (server-side join of all chunks)
  digGetSession: async (
    authToken: string | undefined,
    sessionId: string,
    options?: { maxBytes?: number; timeoutSeconds?: number }
  ): Promise<GetSessionResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = { session_id: sessionId };
    if (authToken) params.auth_token = authToken;
    if (options?.maxBytes != null) params.max_bytes = options.maxBytes;
    if (options?.timeoutSeconds != null) params.timeout_seconds = options.timeoutSeconds;
    const result = await client.callTool<HealthCheckResult>('get_session', params);
    const textContent = getTextContent(result, 'gofr-dig', 'get_session');
    return parseToolText<GetSessionResponse>('gofr-dig', 'get_session', textContent);
  },

  // List all stored sessions
  digListSessions: async (authToken?: string): Promise<ListSessionsResponse> => {
    const client = getMcpClient('gofr-dig');
    const params: Record<string, unknown> = {};
    if (authToken) params.auth_token = authToken;
    const result = await client.callTool<HealthCheckResult>('list_sessions', params);
    const textContent = getTextContent(result, 'gofr-dig', 'list_sessions');
    return parseToolText<ListSessionsResponse>('gofr-dig', 'list_sessions', textContent);
  },

  // List sources from GOFR-IQ
  listSources: async (authToken: string): Promise<{ sources: Source[] }> => {
    const client = getMcpClient('gofr-iq');
    const result = await client.callTool<HealthCheckResult>('list_sources', {
      auth_tokens: [authToken],
    });
    const textContent = getTextContent(result, 'gofr-iq', 'list_sources');
    return parseToolText('gofr-iq', 'list_sources', textContent) as { sources: Source[] };
  },

  // Ingest document into GOFR-IQ
  ingestDocument: async (
    authToken: string,
    title: string,
    content: string,
    sourceGuid: string,
    language = 'en',
    metadata: Record<string, unknown> = {}
  ): Promise<IngestResult> => {
    const client = getMcpClient('gofr-iq');
    const result = await client.callTool<HealthCheckResult>(
      'ingest_document',
      {
        title,
        content,
        source_guid: sourceGuid,
        language,
        metadata,
        auth_tokens: [authToken],
      }
    );
    const textContent = getTextContent(result, 'gofr-iq', 'ingest_document');
    return parseToolText('gofr-iq', 'ingest_document', textContent) as IngestResult;
  },

  // List instruments by querying documents and extracting mentioned companies
  // Uses query_documents to discover instruments from document content
  listInstruments: async (authToken: string): Promise<{ instruments: Instrument[] }> => {
    const client = getMcpClient('gofr-iq');
    
    // Query documents with a broad search to find mentioned companies
    const result = await client.callTool<HealthCheckResult>('query_documents', {
      query: 'company stock ticker sector',
      n_results: 100,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'query_documents');

    try {
      const data = parseToolText<{ results?: Array<{ title?: string }> }>(
        'gofr-iq',
        'query_documents',
        textContent
      );
      const documents = data.results || [];
      
      // Extract unique company tickers from document titles
      // Pattern: "Update regarding [Company]" or mentions in content
      const instrumentMap = new Map<string, { ticker: string; name: string; sector?: string; instrument_type?: string }>();
      
      // Known ticker mapping from titles to tickers
      const titleToTicker = new Map<string, string>([
        ['LuxeBrands', 'LUXE'],
        ['Quantum Compute', 'QNTM'],
        ['OmniCorp Global', 'OMNI'],
        ['HeavyTrucks Inc.', 'TRUCK'],
        ['HeavyTrucks', 'TRUCK'],
        ['PROP', 'PROP'],
        ['GeneSys', 'GENE'],
        ['EcoPower Systems', 'ECO'],
        ['Vitality Pharma', 'VP'],
        ['STR', 'STR'],
        ['GigaTech', 'GTX'],
        ['GigaTech Inc.', 'GTX'],
        ['Nexus Software', 'NXS'],
        ['BankOne', 'BANKO'],
        ['BlockChain Verify', 'BLK'],
        ['FinCorp', 'FIN'],
      ]);
      
      for (const doc of documents) {
        // Extract company from title pattern "Update regarding [Company]"
        const titleMatch = doc.title?.match(/Update regarding (.+?)[\n\s]*$/i);
        if (titleMatch) {
          const companyName = titleMatch[1].trim();
          const ticker = titleToTicker.get(companyName) || companyName;
          
          if (!instrumentMap.has(ticker)) {
            instrumentMap.set(ticker, {
              ticker,
              name: companyName,
              instrument_type: 'STOCK',
            });
          }
        }
      }
      
      return { instruments: Array.from(instrumentMap.values()) as Instrument[] };
    } catch (err) {
        logger.warn({
          event: 'api_call_failed',
          message: 'query_documents parse error',
          operation: 'query_documents',
          component: 'api',
          service_name: 'gofr-iq',
          tool_name: 'query_documents',
          dependency: 'gofr-iq-mcp',
          result: 'failure',
          error_code: 'PARSE_ERROR',
          data: { cause: err instanceof Error ? err.message : 'unknown' },
        });
      return { instruments: [] };
    }
  },

  // Get market context for a specific ticker
  getMarketContext: async (authToken: string, ticker: string): Promise<MarketContextResponse> => {
    const client = getMcpClient('gofr-iq');
    const result = await client.callTool<HealthCheckResult>('get_market_context', {
      ticker,
      include_peers: true,
      include_events: false,
      include_indices: true,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'get_market_context');
    return parseToolText<MarketContextResponse>('gofr-iq', 'get_market_context', textContent);
  },

  // List clients for a given token group
  listClients: async (
    authToken: string,
    clientType?: string,
    limit?: number
  ): Promise<{ clients: ClientSummary[] }> => {
    const client = getMcpClient('gofr-iq');
    
    const args: Record<string, unknown> = {
      auth_tokens: [authToken],
    };
    
    if (clientType) {
      args.client_type = clientType;
    }
    if (limit) {
      args.limit = limit;
    }

    const result = await client.callTool<HealthCheckResult>('list_clients', args);
    const textContent = getTextContent(result, 'gofr-iq', 'list_clients');
    const data = parseToolText<{ clients?: Array<Record<string, unknown>> }>(
      'gofr-iq',
      'list_clients',
      textContent
    );

    const clients = (data.clients ?? []).map((c) => {
      const guid = typeof c.client_guid === 'string'
        ? c.client_guid
        : typeof c.guid === 'string'
          ? c.guid
          : '';
      return {
        guid,
        client_guid: guid,
        name: typeof c.name === 'string' ? c.name : 'Unknown',
        client_type: typeof c.client_type === 'string' ? c.client_type : null,
        group_guid: typeof c.group_guid === 'string' ? c.group_guid : undefined,
        created_at: typeof c.created_at === 'string' ? c.created_at : undefined,
        portfolio_guid: typeof c.portfolio_guid === 'string' ? c.portfolio_guid : undefined,
        watchlist_guid: typeof c.watchlist_guid === 'string' ? c.watchlist_guid : undefined,
      } as ClientSummary;
    });

    return { clients };
  },

  // Get client profile details
  getClientProfile: async (authToken: string, clientGuid: string): Promise<ClientProfileResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('get_client_profile', {
      client_guid: clientGuid,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'get_client_profile');
    return parseToolText<ClientProfileResponse>('gofr-iq', 'get_client_profile', textContent);
  },

  // Get client profile completeness score
  getClientProfileScore: async (authToken: string, clientGuid: string): Promise<ProfileScoreResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('get_client_profile_score', {
      client_guid: clientGuid,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'get_client_profile_score');
    return parseToolText<ProfileScoreResponse>('gofr-iq', 'get_client_profile_score', textContent);
  },

  // Update client profile (partial update - only send changed fields)
  updateClientProfile: async (
    authToken: string,
    clientGuid: string,
    updates: {
      mandate_type?: string;
      benchmark?: string;
      horizon?: string;
      esg_constrained?: boolean;
      alert_frequency?: string;
      impact_threshold?: number;
      mandate_text?: string;
      restrictions?: ClientRestrictions;
    }
  ): Promise<UpdateProfileResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('update_client_profile', {
      client_guid: clientGuid,
      ...updates,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'update_client_profile');
    return parseToolText<UpdateProfileResponse>('gofr-iq', 'update_client_profile', textContent);
  },

  // Create a new client
  createClient: async (
    authToken: string,
    clientData: {
      name: string;
      client_type: string;
      alert_frequency?: string;
      impact_threshold?: number;
      mandate_type?: string;
      benchmark?: string;
      horizon?: string;
      esg_constrained?: boolean;
      mandate_text?: string;
      restrictions?: ClientRestrictions;
    }
  ): Promise<CreateClientResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('create_client', {
      ...clientData,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'create_client');
    return parseToolText<CreateClientResponse>('gofr-iq', 'create_client', textContent);
  },

  // Get full document by GUID
  getDocument: async (authToken: string, documentGuid: string): Promise<DocumentResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('get_document', {
      guid: documentGuid,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'get_document');
    return parseToolText<DocumentResponse>('gofr-iq', 'get_document', textContent);
  },

  // Get client news feed using get_top_client_news (Alpha Engine)
  getClientFeed: async (
    authToken: string,
    clientGuid: string,
    limit: number = 3,
    minImpactScore: number = 0,
    opportunityBias: number = 0.0,
    timeWindowHours: number = 24,
  ): Promise<ClientFeedResponse> => {
    const client = getMcpClient('gofr-iq');

    const result = await client.callTool<HealthCheckResult>('get_top_client_news', {
      client_guid: clientGuid,
      limit: Math.min(Math.max(limit, 1), 10),
      time_window_hours: Math.min(Math.max(timeWindowHours, 1), 168),
      min_impact_score: minImpactScore,
      opportunity_bias: Math.min(Math.max(opportunityBias, 0), 1),
      include_portfolio: true,
      include_watchlist: true,
      include_lateral_graph: true,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'get_top_client_news');
    return parseToolText<ClientFeedResponse>('gofr-iq', 'get_top_client_news', textContent);
  },

  // LLM augmentation for a single (client, document) pair. Must be user-triggered.
  whyItMattersToClient: async (
    authToken: string,
    clientGuid: string,
    documentGuid: string,
  ): Promise<WhyItMattersToClientResponse> => {
    const client = getMcpClient('gofr-iq');

    const result = await client.callTool<HealthCheckResult>('why_it_matters_to_client', {
      client_guid: clientGuid,
      document_guid: documentGuid,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'why_it_matters_to_client');
    return parseToolText<WhyItMattersToClientResponse>('gofr-iq', 'why_it_matters_to_client', textContent);
  },

  // Add to portfolio
  addToPortfolio: async (
    authToken: string,
    clientGuid: string,
    ticker: string,
    weight: number,
    shares?: number,
    avgCost?: number
  ): Promise<PortfolioUpdateResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const params: Record<string, unknown> = {
      client_guid: clientGuid,
      ticker,
      weight,
      auth_tokens: [authToken],
    };
    
    if (shares !== undefined) params.shares = shares;
    if (avgCost !== undefined) params.avg_cost = avgCost;
    
    const result = await client.callTool<HealthCheckResult>('add_to_portfolio', params);
    
    const textContent = getTextContent(result, 'gofr-iq', 'add_to_portfolio');
    return parseToolText<PortfolioUpdateResponse>('gofr-iq', 'add_to_portfolio', textContent);
  },

  // Remove from portfolio
  removeFromPortfolio: async (
    authToken: string,
    clientGuid: string,
    ticker: string
  ): Promise<PortfolioUpdateResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('remove_from_portfolio', {
      client_guid: clientGuid,
      ticker,
      auth_tokens: [authToken],
    });
    
    const textContent = getTextContent(result, 'gofr-iq', 'remove_from_portfolio');
    return parseToolText<PortfolioUpdateResponse>('gofr-iq', 'remove_from_portfolio', textContent);
  },

  // Get portfolio holdings for a client
  getPortfolioHoldings: async (authToken: string, clientGuid: string): Promise<PortfolioHoldingsResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('get_portfolio_holdings', {
      client_guid: clientGuid,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'get_portfolio_holdings');
    return parseToolText<PortfolioHoldingsResponse>('gofr-iq', 'get_portfolio_holdings', textContent);
  },

  // Add to watchlist
  addToWatchlist: async (
    authToken: string,
    clientGuid: string,
    ticker: string,
    alertThreshold?: number
  ): Promise<WatchlistUpdateResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const params: Record<string, unknown> = {
      client_guid: clientGuid,
      ticker,
      auth_tokens: [authToken],
    };
    
    if (alertThreshold !== undefined) params.alert_threshold = alertThreshold;
    
    const result = await client.callTool<HealthCheckResult>('add_to_watchlist', params);
    
    const textContent = getTextContent(result, 'gofr-iq', 'add_to_watchlist');
    return parseToolText<WatchlistUpdateResponse>('gofr-iq', 'add_to_watchlist', textContent);
  },

  // Remove from watchlist
  removeFromWatchlist: async (
    authToken: string,
    clientGuid: string,
    ticker: string
  ): Promise<WatchlistUpdateResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('remove_from_watchlist', {
      client_guid: clientGuid,
      ticker,
      auth_tokens: [authToken],
    });
    
    const textContent = getTextContent(result, 'gofr-iq', 'remove_from_watchlist');
    return parseToolText<WatchlistUpdateResponse>('gofr-iq', 'remove_from_watchlist', textContent);
  },

  // Get client watchlist
  getClientWatchlist: async (authToken: string, clientGuid: string): Promise<WatchlistResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('get_watchlist_items', {
      client_guid: clientGuid,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'get_watchlist_items');
    return parseToolText<WatchlistResponse>('gofr-iq', 'get_watchlist_items', textContent);
  },

  // Get instrument news
  getInstrumentNews: async (
    authToken: string,
    ticker: string,
    daysBack: number = 7,
    minImpactScore: number = 50
  ): Promise<InstrumentNewsResponse> => {
    const client = getMcpClient('gofr-iq');
    const defaultResponse: InstrumentNewsResponse = { ticker, articles: [], total_found: 0 };
    
    try {
      const result = await client.callTool<HealthCheckResult>('get_instrument_news', {
        ticker,
        days_back: daysBack,
        min_impact_score: minImpactScore,
        auth_tokens: [authToken],
      });

      const textContent = getTextContent(result, 'gofr-iq', 'get_instrument_news');
      return parseToolText<InstrumentNewsResponse>('gofr-iq', 'get_instrument_news', textContent);
    } catch (err) {
      // Graceful degradation: return empty result on error
      logger.warn({
        event: 'api_call_failed',
        message: `get_instrument_news failed for ${ticker}`,
        operation: 'get_instrument_news',
        component: 'api',
        service_name: 'gofr-iq',
        tool_name: 'get_instrument_news',
        dependency: 'gofr-iq-mcp',
        result: 'failure',
        error_code: 'NEWS_FALLBACK',
        data: { cause: err instanceof Error ? err.message : 'unknown' },
      });
      return defaultResponse;
    }
  },

  /**
   * Search the GOFR-IQ knowledge graph for documents.
   */
  queryDocuments: async (
    authToken: string,
    query: string,
    nResults: number = 10,
    languages?: string[],
  ): Promise<QueryDocumentsResponse> => {
    const client = getMcpClient('gofr-iq');
    const args: Record<string, unknown> = {
      query,
      n_results: nResults,
      auth_tokens: [authToken],
    };
    if (languages && languages.length > 0 && !languages.includes('all')) {
      args['languages'] = languages;
    }
    const result = await client.callTool<HealthCheckResult>('query_documents', args);
    const textContent = getTextContent(result, 'gofr-iq', 'query_documents');
    return parseToolText('gofr-iq', 'query_documents', textContent) as QueryDocumentsResponse;
  },
};

