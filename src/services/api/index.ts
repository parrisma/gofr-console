// API service layer
// MCP Streamable HTTP client for GOFR services

import { configStore } from '../../stores/configStore';
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
  PortfolioHoldingsResponse,
  PortfolioUpdateResponse,
  WatchlistResponse,
  WatchlistUpdateResponse,
  InstrumentNewsResponse,
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
    text: string;
  }>;
}

function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (/token|authorization|secret|password|api[_-]?key|cookie/i.test(key)) continue;
    if (key === 'url' && typeof value === 'string') {
      try {
        summary.url_host = new URL(value).host;
      } catch {
        summary.url_host = value.split('?')[0];
      }
      continue;
    }
    if (typeof value === 'string') {
      summary[key] = value.length > 120 ? `${value.slice(0, 120)}...[TRUNCATED]` : value;
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value == null) {
      summary[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      summary[key] = `[array:${value.length}]`;
      continue;
    }
    summary[key] = '[object]';
  }
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
    if (parsed.status === 'error') {
      throw new ApiError({
        service,
        tool,
        code: parsed.error_code,
        message: parsed.message || 'Tool returned error',
        recovery: defaultRecoveryHint(),
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

    const response = await fetch(`${this.baseUrl}/mcp/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId }),
      },
      body: JSON.stringify(request),
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
  }

  // Send notification (no response expected)
  private async notify(method: string, params: Record<string, unknown>): Promise<void> {
    await fetch(`${this.baseUrl}/mcp/`, {
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
    });
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
      response = await fetch(`${this.baseUrl}/mcp/`, {
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
    const client = getMcpClient('gofr-iq');
    const result = await client.callTool<HealthCheckResult>('health_check');
    
    // Parse the text content from MCP response
    const textContent = result.content?.find(c => c.type === 'text')?.text;
    
    // Default response
    const defaultResponse = {
      status: 'unknown',
      message: 'Unable to parse response',
      services: {
        neo4j: { status: 'unknown', message: 'Unknown' },
        chromadb: { status: 'unknown', message: 'Unknown' },
        llm: { status: 'unknown', message: 'Unknown' },
      },
      timestamp: new Date().toISOString(),
    };
    
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

  // Get client news feed using get_top_client_news
  getClientFeed: async (
    authToken: string,
    clientGuid: string,
    limit: number = 3,
    minImpactScore: number = 0
  ): Promise<ClientFeedResponse> => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('get_top_client_news', {
      client_guid: clientGuid,
      limit: Math.min(limit, 3), // Cap at 3 — each article requires an LLM call server-side
      time_window_hours: 24,
      min_impact_score: minImpactScore,
      include_portfolio: true,
      include_watchlist: true,
      include_lateral_graph: true,
      auth_tokens: [authToken],
    });

    const textContent = getTextContent(result, 'gofr-iq', 'get_top_client_news');
    return parseToolText<ClientFeedResponse>('gofr-iq', 'get_top_client_news', textContent);
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
};

