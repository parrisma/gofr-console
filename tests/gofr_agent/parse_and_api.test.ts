import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../src/services/api/errors';
import { normalizeAgentServiceList, parseTextJson } from '../../src/services/gofrAgent/parse';
import {
  agentHttpBaseUrl,
  agentHttpHealth,
  agentMcpEndpointDiagnostic,
  isAgentHttpHealthRouteMissing,
  mapAgentErrorToConnectionState,
  prepareAgentAskRequest,
} from '../../src/services/gofrAgent/api';

afterEach(() => {
  vi.unstubAllGlobals();
});

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