import { afterEach, describe, expect, it, vi } from 'vitest';

const logging = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../src/services/logging', () => ({
  logger: {
    createRequestId: () => 'test-request-id',
    error: logging.error,
    info: logging.info,
    warn: logging.warn,
  },
}));

import { ApiError } from '../../src/services/api/errors';
import {
  GOFR_AGENT_DEFAULT_ASK_TIMEOUT_MS,
  resolveGofrAgentAskTimeoutMs,
  resolveGofrAgentAskTimeoutSeconds,
  type AgentMcpToolResult,
  type AgentToolCaller,
} from '../../src/services/gofrAgent/client';
import { normalizeAgentServiceList, parseTextJson } from '../../src/services/gofrAgent/parse';
import {
  agentAskWithClient,
  agentHttpBaseUrl,
  agentHttpHealth,
  agentMcpEndpointDiagnostic,
  isAgentHttpHealthRouteMissing,
  mapAgentErrorToConnectionState,
  prepareAgentAskRequest,
} from '../../src/services/gofrAgent/api';

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function askToolResult(): AgentMcpToolResult {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        session_id: 'session-1',
        request_id: 'request-1',
        answer: 'done',
        steps: [],
        provenance: [],
      }),
    }],
  } as AgentMcpToolResult;
}

describe('GOFR-Agent parsing and request preparation', () => {
  it('parses valid MCP text JSON', () => {
    const result = parseTextJson<{ status: string }>({
      content: [{ type: 'text', text: '{"status":"ok"}' }],
    }, 'ping');

    expect(result.status).toBe('ok');
  });

  it('parses double-encoded MCP text JSON', () => {
    const result = parseTextJson<{ status: string }>({
      content: [{ type: 'text', text: '"{\\"status\\":\\"ok\\"}"' }],
    }, 'ping');

    expect(result.status).toBe('ok');
  });

  it('rejects missing text content', () => {
    expect(() => parseTextJson({ content: [] }, 'ping')).toThrow(ApiError);
  });

  it('rejects invalid JSON safely', () => {
    expect(() => parseTextJson({ content: [{ type: 'text', text: 'not-json' }] }, 'ping')).toThrow(ApiError);
  });

  it('filters reserved tools from normalized service list', () => {
    const normalized = normalizeAgentServiceList({
      services: [
        {
          name: 'analytics',
          status: 'ok',
          tools: [
            { name: 'public_tool', description: 'Visible' },
            { name: 'register_service', description: 'Admin' },
            { name: '_get_result', description: 'Hub' },
          ],
        },
      ],
    });

    expect(normalized.services[0]?.tools.map((tool) => tool.name)).toEqual(['public_tool']);
  });

  it('trims question and clamps max steps', () => {
    const prepared = prepareAgentAskRequest({ question: '  hello  ', max_steps: 999 });

    expect(prepared.question).toBe('hello');
    expect(prepared.max_steps).toBe(50);
  });

  it('preserves explicit interactive ask requests', () => {
    const prepared = prepareAgentAskRequest({ question: 'hello', interactive: true });

    expect(prepared.interactive).toBe(true);
  });

  it('rejects empty questions', () => {
    expect(() => prepareAgentAskRequest({ question: '   ' })).toThrow(ApiError);
  });

  it('resolves ask timeout from UI env seconds with a default above the SDK 60s timeout', () => {
    expect(resolveGofrAgentAskTimeoutMs()).toBe(GOFR_AGENT_DEFAULT_ASK_TIMEOUT_MS);

    vi.stubEnv('VITE_GOFR_AGENT_ASK_TIMEOUT_SECONDS', '700');

    expect(resolveGofrAgentAskTimeoutSeconds()).toBe(700);
    expect(resolveGofrAgentAskTimeoutMs()).toBe(700000);
    expect(resolveGofrAgentAskTimeoutSeconds('60')).toBe(GOFR_AGENT_DEFAULT_ASK_TIMEOUT_MS / 1000);
    expect(resolveGofrAgentAskTimeoutSeconds('300')).toBe(601);
    expect(GOFR_AGENT_DEFAULT_ASK_TIMEOUT_MS).toBeGreaterThan(60_000);
  });

  it('passes the configured ask timeout as an MCP SDK per-call option', async () => {
    let observedOptions: Parameters<AgentToolCaller['callTool']>[2] | undefined;
    const client: AgentToolCaller = {
      async callTool(toolName, _args, options) {
        expect(toolName).toBe('ask');
        observedOptions = options;
        return askToolResult();
      },
    };

    await expect(agentAskWithClient(client, { question: 'hello' }, { askTimeoutSeconds: 700 })).resolves.toMatchObject({ answer: 'done' });

    expect(observedOptions?.timeout).toBe(700000);
    expect(observedOptions?.timeout).toBeGreaterThan(60_000);
    expect(logging.info).toHaveBeenCalledWith(expect.objectContaining({
      event: 'agent_ask_started',
      data: expect.objectContaining({ timeout_ms: 700000 }),
    }));
  });

  it('maps MCP SDK ask timeouts as client-side timeouts, not fake HTTP statuses', async () => {
    const timeoutError = Object.assign(new Error('Request timed out'), { code: -32001 });
    const client: AgentToolCaller = {
      async callTool() {
        throw timeoutError;
      },
    };

    try {
      await agentAskWithClient(client, { question: 'hello' });
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.statusCode).toBeUndefined();
      expect(apiErr.code).toBe(-32001);
      expect(apiErr.message).toContain('Client-side MCP request timeout after 650 seconds');
      expect(apiErr.message).not.toContain('HTTP -32001');
      expect(apiErr.recovery).toContain('UI ask timeout');
    }

    expect(logging.error).toHaveBeenCalledWith(expect.objectContaining({
      event: 'agent_ask_client_timeout',
      result: 'timeout',
      error_code: '-32001',
      data: expect.objectContaining({ timeout_ms: GOFR_AGENT_DEFAULT_ASK_TIMEOUT_MS, timeout_seconds: 650 }),
    }));
  });

  it('derives HTTP health base URLs from MCP URLs', () => {
    expect(agentHttpBaseUrl('/api/gofr-agent/mcp')).toBe('/api/gofr-agent');
    expect(agentHttpBaseUrl('/api/gofr-agent/mcp/')).toBe('/api/gofr-agent');
    expect(agentHttpBaseUrl('http://gofr-agent:8090/mcp')).toBe('http://gofr-agent:8090');
  });

  it('describes MCP endpoints without secrets for diagnostics', () => {
    expect(agentMcpEndpointDiagnostic('/api/gofr-agent/mcp')).toMatchObject({
      host: 'same-origin proxy',
      path: '/api/gofr-agent/mcp',
      sameOrigin: true,
    });
    expect(agentMcpEndpointDiagnostic('http://gofr-agent:8090/mcp')).toMatchObject({
      host: 'gofr-agent:8090',
      path: '/mcp',
      sameOrigin: false,
    });
  });

  it('accepts unhealthy HTTP health payloads returned with 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      status: 'unhealthy',
      service: 'gofr-agent',
      timestamp: '2026-05-17T00:00:00Z',
      version: '1.0.0',
      message: 'not ready',
      downstream: { total: 1, healthy: 0, degraded: 0, failed: 1 },
    }), { status: 503, headers: { 'Content-Type': 'application/json' } })));

    await expect(agentHttpHealth()).resolves.toMatchObject({ status: 'unhealthy', message: 'not ready' });
  });

  it('recognizes missing HTTP health routes for fallback checks', () => {
    const err = new ApiError({ service: 'gofr-agent', tool: 'http_ping', statusCode: 404, message: 'Not Found' });

    expect(isAgentHttpHealthRouteMissing(err)).toBe(true);
  });

  it('maps invalid Host header failures to backend allowlist diagnostics', () => {
    const err = new ApiError({
      service: 'gofr-agent',
      tool: 'ping',
      statusCode: 421,
      message: 'Invalid Host header',
    });

    expect(mapAgentErrorToConnectionState(err)).toMatchObject({
      status: 'misconfigured',
      message: expect.stringContaining('FastMCP allowed_hosts'),
    });
  });
});