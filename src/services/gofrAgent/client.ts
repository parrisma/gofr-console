import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js';

import { logger } from '../logging';
import {
  AGENT_DEFAULT_ASK_TIMEOUT_SECONDS,
  AGENT_MCP_ENDPOINT,
  AGENT_REASONING_LOGGER,
  clampAgentAskTimeoutSeconds,
} from '../../types/gofrAgent';
import type { AgentReasoningEvent } from '../../types/gofrAgent';
import { normalizeReasoningEvent } from './parse';

export type AgentMcpToolResult = Awaited<ReturnType<Client['callTool']>>;
export type AgentCallToolOptions = Parameters<Client['callTool']>[2];

export const GOFR_AGENT_DEFAULT_ASK_TIMEOUT_MS = AGENT_DEFAULT_ASK_TIMEOUT_SECONDS * 1000;
const MCP_SDK_DEFAULT_REQUEST_TIMEOUT_SECONDS = 60;

export interface AgentToolCaller {
  callTool(toolName: string, args?: object, options?: AgentCallToolOptions): Promise<AgentMcpToolResult>;
}

export interface GofrAgentClientOptions {
  authToken: string;
  endpoint?: string;
  onReasoningEvent?: (event: AgentReasoningEvent) => void;
}

function resolveEndpoint(endpoint: string): URL {
  if (/^https?:\/\//i.test(endpoint)) return new URL(endpoint);
  const base = typeof window !== 'undefined' ? window.location.origin : 'http://gofr-console.invalid';
  return new URL(endpoint, base);
}

function normalizeBearerToken(value: string): string {
  let token = value.trim().replace(/^Bearer\s+/i, '').trim();
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  return token;
}

export function resolveGofrAgentAskTimeoutSeconds(
  rawValue: unknown = defaultGofrAgentAskTimeoutSeconds(),
): number {
  const numeric = typeof rawValue === 'string' && rawValue.trim()
    ? Number(rawValue)
    : typeof rawValue === 'number'
      ? rawValue
      : AGENT_DEFAULT_ASK_TIMEOUT_SECONDS;
  if (!Number.isFinite(numeric) || numeric <= MCP_SDK_DEFAULT_REQUEST_TIMEOUT_SECONDS) {
    return AGENT_DEFAULT_ASK_TIMEOUT_SECONDS;
  }
  return clampAgentAskTimeoutSeconds(numeric);
}

export function resolveGofrAgentAskTimeoutMs(rawValue?: unknown): number {
  return resolveGofrAgentAskTimeoutSeconds(rawValue) * 1000;
}

function defaultGofrAgentAskTimeoutSeconds(): unknown {
  const seconds = import.meta.env.VITE_GOFR_AGENT_ASK_TIMEOUT_SECONDS;
  if (typeof seconds === 'string' && seconds.trim()) return seconds;
  const legacyMs = import.meta.env.VITE_GOFR_AGENT_ASK_TIMEOUT_MS;
  if (typeof legacyMs === 'string' && legacyMs.trim()) return Number(legacyMs) / 1000;
  return undefined;
}

export class GofrAgentClient implements AgentToolCaller {
  private readonly authToken: string;
  private readonly endpoint: string;
  private readonly onReasoningEvent?: (event: AgentReasoningEvent) => void;
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private connectPromise: Promise<Client> | null = null;

  constructor(options: GofrAgentClientOptions) {
    this.authToken = options.authToken;
    this.endpoint = options.endpoint ?? AGENT_MCP_ENDPOINT;
    this.onReasoningEvent = options.onReasoningEvent;
  }

  async connect(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.doConnect();
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async doConnect(): Promise<Client> {
    const client = new Client(
      { name: 'gofr-console', version: '0.0.1' },
      { capabilities: {} },
    );

    client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
      if (notification.params.logger !== AGENT_REASONING_LOGGER) return;
      const event = normalizeReasoningEvent(notification.params.data);
      if (event) this.onReasoningEvent?.(event);
    });

    const transport = new StreamableHTTPClientTransport(resolveEndpoint(this.endpoint), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${normalizeBearerToken(this.authToken)}`,
        },
      },
      reconnectionOptions: {
        initialReconnectionDelay: 1000,
        maxReconnectionDelay: 5000,
        reconnectionDelayGrowFactor: 1.5,
        maxRetries: 0,
      },
    });

    await client.connect(transport);
    try {
      await client.setLoggingLevel('info');
    } catch (err) {
      logger.warn({
        event: 'agent_logging_level_failed',
        message: 'GOFR-Agent logging level could not be set',
        component: 'gofrAgentClient',
        service_name: 'gofr-agent',
        result: 'failure',
        data: { cause: err instanceof Error ? err.message : 'unknown' },
      });
    }

    this.client = client;
    this.transport = transport;
    return client;
  }

  async callTool(
    toolName: string,
    args: object = {},
    options?: AgentCallToolOptions,
  ): Promise<AgentMcpToolResult> {
    const client = await this.connect();
    return client.callTool({ name: toolName, arguments: args as Record<string, unknown> }, undefined, options);
  }

  async close(): Promise<void> {
    const client = this.client;
    const transport = this.transport;
    this.client = null;
    this.transport = null;
    this.connectPromise = null;
    if (client) {
      await client.close();
      return;
    }
    if (transport) await transport.close();
  }
}