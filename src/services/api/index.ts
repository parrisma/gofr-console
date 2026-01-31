// API service layer
// MCP Streamable HTTP client for GOFR services

const GOFR_IQ_BASE_URL = '/api/gofr-iq';

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
  private sessionId: string | null = null;
  private requestId = 0;

  private nextId(): number {
    return ++this.requestId;
  }

  // Initialize MCP session
  async initialize(): Promise<void> {
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

    const response = await fetch(`${GOFR_IQ_BASE_URL}/mcp`, {
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
    await fetch(`${GOFR_IQ_BASE_URL}/mcp`, {
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

  // Call an MCP tool
  async callTool<T>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
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

    const response = await fetch(`${GOFR_IQ_BASE_URL}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        ...(this.sessionId && { 'Mcp-Session-Id': this.sessionId }),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      // Session may have expired, try re-initializing
      if (response.status === 400 || response.status === 404) {
        this.sessionId = null;
        await this.initialize();
        return this.callTool(toolName, args);
      }
      throw new Error(`MCP call failed: HTTP ${response.status}`);
    }

    const result = await parseSseResponse<T>(response);
    if (result.error) {
      throw new Error(`MCP error: ${result.error.message}`);
    }

    return result.result as T;
  }
}

// Singleton MCP client for GOFR-IQ
const mcpClient = new McpClient();

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
    const result = await mcpClient.callTool<HealthCheckResult>('health_check');
    
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

  // Stub functions (to be replaced with real MCP calls)
  listClients: async () => ({
    clients: [
      { guid: 'c1', name: 'Acme Fund', client_type: 'INSTITUTIONAL' },
      { guid: 'c2', name: 'Jane Doe', client_type: 'RETAIL' },
      { guid: 'c3', name: 'Global Ventures', client_type: 'INSTITUTIONAL' },
    ],
  }),

  getClientFeed: async (guid: string) => ({
    client_guid: guid,
    articles: [
      { title: 'Fed Raises Rates', impact_score: 85, ticker: 'SPY', published: '2026-01-30' },
      { title: 'Tech Sector Rally', impact_score: 72, ticker: 'QQQ', published: '2026-01-29' },
    ],
  }),
};
