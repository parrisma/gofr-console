// API service layer
// MCP Streamable HTTP client for GOFR services

import { configStore } from '../../stores/configStore';

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

    const response = await fetch(`${this.baseUrl}/mcp`, {
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
    await fetch(`${this.baseUrl}/mcp`, {
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
  }

  // Call an MCP tool
  async callTool<T>(toolName: string, args: Record<string, unknown> = {}, authToken?: string): Promise<T> {
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

    const response = await fetch(`${this.baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      // Session may have expired, try re-initializing
      if (response.status === 400 || response.status === 404) {
        this.sessionId = null;
        await this.initialize();
        return this.callTool(toolName, args, authToken);
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
  const client = mcpClients[serviceName];
  if (!client) {
    throw new Error(`Unknown MCP service: ${serviceName}`);
  }
  return client;
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

  // Stub functions (to be replaced with real MCP calls)
  getClientFeed: async (guid: string) => ({
    client_guid: guid,
    articles: [
      { title: 'Fed Raises Rates', impact_score: 85, ticker: 'SPY', published: '2026-01-30' },
      { title: 'Tech Sector Rally', impact_score: 72, ticker: 'QQQ', published: '2026-01-29' },
    ],
  }),

  // List sources from GOFR-IQ
  listSources: async (authToken: string) => {
    const client = getMcpClient('gofr-iq');
    const result = await client.callTool<HealthCheckResult>('list_sources', {
      auth_tokens: [authToken],
    });

    // Parse the text content from MCP response
    const textContent = result.content?.find(c => c.type === 'text')?.text;
    if (!textContent) {
      return { sources: [] };
    }

    try {
      const parsed = JSON.parse(textContent);
      return parsed.data || parsed;
    } catch {
      return { sources: [] };
    }
  },

  // Ingest document into GOFR-IQ
  ingestDocument: async (
    authToken: string,
    title: string,
    content: string,
    sourceGuid: string,
    language = 'en',
    metadata: Record<string, unknown> = {}
  ) => {
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

    // Parse the text content from MCP response
    const textContent = result.content?.find(c => c.type === 'text')?.text;
    if (!textContent) {
      throw new Error('No response from ingest');
    }

    const parsed = JSON.parse(textContent);
    if (parsed.status === 'error') {
      throw new Error(parsed.message || 'Ingest failed');
    }
    return parsed.data || parsed;
  },

  // List instruments by querying documents and extracting mentioned companies
  // Uses query_documents to discover instruments from document content
  listInstruments: async (authToken: string) => {
    const client = getMcpClient('gofr-iq');
    
    // Query documents with a broad search to find mentioned companies
    const result = await client.callTool<HealthCheckResult>('query_documents', {
      query: 'company stock ticker sector',
      n_results: 100,
      auth_tokens: [authToken],
    });

    const textContent = result.content?.find(c => c.type === 'text')?.text;
    if (!textContent) {
      return { instruments: [] };
    }

    try {
      const parsed = JSON.parse(textContent);
      if (parsed.status === 'error') {
        console.warn('query_documents error:', parsed.message);
        return { instruments: [] };
      }
      
      const data = parsed.data || parsed;
      const documents = data.results || [];
      
      // Extract unique company tickers from document titles
      // Pattern: "Update regarding [Company]" or mentions in content
      const instrumentMap = new Map<string, { ticker: string; name: string; sector?: string; instrument_type?: string }>();
      
      // Known ticker mapping from titles to tickers
      const titleToTicker: Record<string, string> = {
        'LuxeBrands': 'LUXE',
        'Quantum Compute': 'QNTM',
        'OmniCorp Global': 'OMNI',
        'HeavyTrucks Inc.': 'TRUCK',
        'HeavyTrucks': 'TRUCK',
        'PROP': 'PROP',
        'GeneSys': 'GENE',
        'EcoPower Systems': 'ECO',
        'Vitality Pharma': 'VP',
        'STR': 'STR',
        'GigaTech': 'GTX',
        'GigaTech Inc.': 'GTX',
        'Nexus Software': 'NXS',
        'BankOne': 'BANKO',
        'BlockChain Verify': 'BLK',
        'FinCorp': 'FIN',
      };
      
      for (const doc of documents) {
        // Extract company from title pattern "Update regarding [Company]"
        const titleMatch = doc.title?.match(/Update regarding (.+?)[\n\s]*$/i);
        if (titleMatch) {
          const companyName = titleMatch[1].trim();
          const ticker = titleToTicker[companyName] || companyName;
          
          if (!instrumentMap.has(ticker)) {
            instrumentMap.set(ticker, {
              ticker,
              name: companyName,
              instrument_type: 'STOCK',
            });
          }
        }
      }
      
      return { instruments: Array.from(instrumentMap.values()) };
    } catch {
      return { instruments: [] };
    }
  },

  // Get market context for a specific ticker
  getMarketContext: async (authToken: string, ticker: string) => {
    const client = getMcpClient('gofr-iq');
    const result = await client.callTool<HealthCheckResult>('get_market_context', {
      ticker,
      include_peers: true,
      include_events: false,
      include_indices: true,
      auth_tokens: [authToken],
    });

    const textContent = result.content?.find(c => c.type === 'text')?.text;
    if (!textContent) {
      return null;
    }

    try {
      const parsed = JSON.parse(textContent);
      return parsed.data || parsed;
    } catch {
      return null;
    }
  },

  // List clients for a given token group
  listClients: async (authToken: string, clientType?: string, limit?: number) => {
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

    const textContent = result.content?.find(c => c.type === 'text')?.text;
    if (!textContent) {
      return { clients: [] };
    }

    try {
      const parsed = JSON.parse(textContent);
      if (parsed.status === 'error') {
        throw new Error(parsed.message || 'Failed to list clients');
      }
      return parsed.data || parsed;
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      return { clients: [] };
    }
  },

  // Get client profile details
  getClientProfile: async (authToken: string, clientGuid: string) => {
    const client = getMcpClient('gofr-iq');
    
    const result = await client.callTool<HealthCheckResult>('get_client_profile', {
      client_guid: clientGuid,
      auth_tokens: [authToken],
    });

    const textContent = result.content?.find(c => c.type === 'text')?.text;
    if (!textContent) {
      throw new Error('No response from get_client_profile');
    }

    try {
      const parsed = JSON.parse(textContent);
      if (parsed.status === 'error') {
        throw new Error(parsed.message || 'Failed to get client profile');
      }
      return parsed.data || parsed;
    } catch (err) {
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Failed to parse client profile response');
    }
  },
};

