import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { useTokens } from './useTokens';
import { GofrAgentClient } from '../services/gofrAgent/client';
import {
  agentAskWithClient,
  agentHealthCheckWithClient,
  agentHttpHealth,
  agentHttpPing,
  agentListServicesWithClient,
  agentMcpEndpointDiagnostic,
  agentPingWithClient,
  agentResetSessionWithClient,
  isAgentHttpHealthRouteMissing,
  mapAgentErrorToConnectionState,
} from '../services/gofrAgent';
import {
  agentChatReducer,
  createAgentId,
  createAgentTurn,
  createInitialAgentChatState,
} from '../stores/gofrAgentChatReducer';
import {
  AGENT_CONTEXT_MAX_LENGTH,
  AGENT_HARD_MAX_STEPS,
  AGENT_QUESTION_MAX_LENGTH,
  type AgentConnectionState,
  type AgentHealthCheckResponse,
  type AgentHttpHealthResponse,
  type AgentPingResponse,
  type AgentRuntimeUiLimits,
  type AgentServiceStatus,
} from '../types/gofrAgent';
import type { JwtToken } from '../types/uiConfig';

type ClientRef = {
  token: string;
  client: GofrAgentClient;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';
}

function devAgentToken(): JwtToken | null {
  if (!import.meta.env.DEV) return null;
  return {
    name: 'GOFR-Agent dev admin',
    groups: 'gofr-agent-dev',
    token: ['dev', 'admin', 'token'].join('-'),
  };
}

function messageForHealth(health: AgentHttpHealthResponse | AgentHealthCheckResponse): string {
  return health.message || `GOFR-Agent readiness is ${health.status}.`;
}

function connectedState(
  health: AgentHttpHealthResponse | AgentHealthCheckResponse,
  ping?: AgentPingResponse,
): AgentConnectionState {
  if (health.status === 'unhealthy') {
    return { status: 'unhealthy', version: health.version, message: messageForHealth(health) };
  }
  if (health.status === 'degraded') {
    return { status: 'degraded', version: health.version, message: messageForHealth(health) };
  }
  return {
    status: 'connected',
    version: typeof ping?.version === 'string' ? ping.version : health.version,
    message: typeof ping?.status === 'string' ? ping.status : messageForHealth(health),
  };
}

function connectedStateFromPing(ping: AgentPingResponse): AgentConnectionState {
  return {
    status: 'connected',
    version: typeof ping.version === 'string' ? ping.version : undefined,
    message: typeof ping.status === 'string' ? ping.status : 'ok',
  };
}

function positiveLimit(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function runtimeLimitsFromHealth(health: AgentHealthCheckResponse | null): AgentRuntimeUiLimits {
  const limits = health?.config.limits;
  return {
    maxSteps: Math.min(
      AGENT_HARD_MAX_STEPS,
      positiveLimit(limits?.max_steps_hard_cap, AGENT_HARD_MAX_STEPS),
    ),
    questionMaxLength: positiveLimit(limits?.max_question_chars, AGENT_QUESTION_MAX_LENGTH),
    contextMaxLength: positiveLimit(limits?.max_context_chars, AGENT_CONTEXT_MAX_LENGTH),
  };
}

export function useGofrAgentChat() {
  const { tokens } = useTokens();
  const selectableTokens = useMemo(() => {
    const token = devAgentToken();
    return token ? [token, ...tokens] : tokens;
  }, [tokens]);
  const [state, dispatch] = useReducer(agentChatReducer, undefined, () => createInitialAgentChatState());
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(() => (import.meta.env.DEV ? 0 : -1));
  const [customAuthToken, setCustomAuthToken] = useState('');
  const [connection, setConnection] = useState<AgentConnectionState>({ status: 'idle' });
  const [httpPing, setHttpPing] = useState<AgentPingResponse | null>(null);
  const [httpHealth, setHttpHealth] = useState<AgentHttpHealthResponse | null>(null);
  const [mcpHealth, setMcpHealth] = useState<AgentHealthCheckResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [services, setServices] = useState<AgentServiceStatus[]>([]);
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);
  const clientRef = useRef<ClientRef | null>(null);

  const selectedToken = selectableTokens.find((_, index) => index === selectedTokenIndex);
  const authToken = customAuthToken.trim() || selectedToken?.token || '';
  const hasActiveRun = state.pendingTurnId != null;
  const runtimeLimits = useMemo(() => runtimeLimitsFromHealth(mcpHealth), [mcpHealth]);
  const endpointDiagnostic = useMemo(() => agentMcpEndpointDiagnostic(), []);

  const closeClient = useCallback(async () => {
    const current = clientRef.current;
    clientRef.current = null;
    if (current) await current.client.close().catch(() => undefined);
  }, []);

  const ensureClient = useCallback(async (): Promise<GofrAgentClient> => {
    if (!authToken) throw new Error('Select a token before connecting to GOFR-Agent.');
    const current = clientRef.current;
    if (current?.token === authToken) return current.client;
    await closeClient();
    const client = new GofrAgentClient({
      authToken,
      onReasoningEvent: (event) => dispatch({ type: 'receive_event', event }),
    });
    clientRef.current = { token: authToken, client };
    return client;
  }, [authToken, closeClient]);

  const refreshConnection = useCallback(async () => {
    setCapabilitiesError(null);
    setHealthError(null);
    setMcpHealth(null);
    setConnection({ status: 'checking' });
    let readiness: AgentHttpHealthResponse | null = null;

    try {
      const ping = await agentHttpPing();
      setHttpPing(ping);
    } catch (err) {
      setHttpPing(null);
      if (isAgentHttpHealthRouteMissing(err)) {
        setHealthError('GOFR-Agent HTTP health routes are not available; using MCP checks when a token is selected.');
      } else {
        await closeClient();
        setServices([]);
        setConnection(mapAgentErrorToConnectionState(err));
        return;
      }
    }

    try {
      readiness = await agentHttpHealth();
      setHttpHealth(readiness);
    } catch (err) {
      setHttpHealth(null);
      if (isAgentHttpHealthRouteMissing(err)) {
        setHealthError('GOFR-Agent HTTP health routes are not available; using MCP checks when a token is selected.');
      } else {
        await closeClient();
        setServices([]);
        setConnection(mapAgentErrorToConnectionState(err));
        return;
      }
    }

    if (readiness?.status === 'unhealthy') {
      await closeClient();
      setServices([]);
      setConnection(connectedState(readiness));
      return;
    }

    if (!authToken) {
      await closeClient();
      setServices([]);
      setConnection({ status: 'needs-token', message: 'Select a token to connect to MCP tools.' });
      return;
    }

    try {
      const client = await ensureClient();
      const ping = await agentPingWithClient(client);
      let tokenedHealth: AgentHealthCheckResponse | AgentHttpHealthResponse | null = readiness;
      try {
        tokenedHealth = await agentHealthCheckWithClient(client);
        setMcpHealth(tokenedHealth);
      } catch (err) {
        setHealthError(errorMessage(err));
      }
      setConnection(tokenedHealth ? connectedState(tokenedHealth, ping) : connectedStateFromPing(ping));
      if (tokenedHealth?.status === 'unhealthy') {
        setServices([]);
        return;
      }
      try {
        const serviceList = await agentListServicesWithClient(client);
        setServices(serviceList.services);
      } catch (err) {
        setServices([]);
        setCapabilitiesError(errorMessage(err));
      }
    } catch (err) {
      setServices([]);
      setConnection(mapAgentErrorToConnectionState(err));
    }
  }, [authToken, closeClient, ensureClient]);

  useEffect(() => {
    void Promise.resolve().then(refreshConnection);
    return () => {
      void closeClient();
    };
  }, [authToken, closeClient, refreshConnection]);

  useEffect(() => {
    if (state.settings.maxSteps <= runtimeLimits.maxSteps) return;
    void Promise.resolve().then(() => dispatch({ type: 'update_settings', settings: { maxSteps: runtimeLimits.maxSteps } }));
  }, [runtimeLimits.maxSteps, state.settings.maxSteps]);

  const sendQuestion = useCallback(async (question: string) => {
    if (hasActiveRun) return;
    const trimmedQuestion = question.trim();
    if (trimmedQuestion.length > runtimeLimits.questionMaxLength) {
      dispatch({
        type: 'set_error',
        message: `Question is too long (${trimmedQuestion.length}/${runtimeLimits.questionMaxLength} characters)`,
      });
      return;
    }
    const assistantTurn = createAgentTurn({ role: 'assistant', text: '', status: 'running' });
    const userTurn = createAgentTurn({ role: 'user', text: trimmedQuestion, status: 'completed' });
    dispatch({ type: 'start_run', userTurn, assistantTurn });
    const startedAt = performance.now();
    try {
      const client = await ensureClient();
      const response = await agentAskWithClient(client, {
        question,
        session_id: state.sessionId,
        max_steps: Math.min(state.settings.maxSteps, runtimeLimits.maxSteps),
        output_format: state.settings.outputFormat,
        tools_only: state.settings.toolsOnly,
        no_commentary: state.settings.noCommentary,
      });
      dispatch({
        type: 'complete_run',
        assistantTurnId: assistantTurn.id,
        response,
        durationMs: Math.round(performance.now() - startedAt),
      });
    } catch (err) {
      dispatch({ type: 'fail_run', assistantTurnId: assistantTurn.id, message: errorMessage(err) });
    }
  }, [ensureClient, hasActiveRun, runtimeLimits.maxSteps, runtimeLimits.questionMaxLength, state.sessionId, state.settings]);

  const resetSession = useCallback(async () => {
    const nextSessionId = createAgentId('session');
    if (!authToken) {
      dispatch({ type: 'reset', sessionId: nextSessionId });
      return;
    }
    try {
      const client = await ensureClient();
      await agentResetSessionWithClient(client, state.sessionId);
      dispatch({ type: 'reset', sessionId: nextSessionId });
    } catch (err) {
      dispatch({ type: 'set_error', message: errorMessage(err) });
    }
  }, [authToken, ensureClient, state.sessionId]);

  const selectedTurn = useMemo(() => {
    return state.turns.find((turn) => turn.id === state.pendingTurnId) ?? state.turns.at(-1) ?? null;
  }, [state.pendingTurnId, state.turns]);

  return {
    tokens: selectableTokens,
    selectedTokenIndex,
    setSelectedTokenIndex,
    customAuthToken,
    setCustomAuthToken,
    state,
    dispatch,
    connection,
    httpPing,
    httpHealth,
    mcpHealth,
    healthError,
    endpointDiagnostic,
    runtimeLimits,
    services,
    capabilitiesError,
    selectedTurn,
    hasActiveRun,
    refreshConnection,
    sendQuestion,
    resetSession,
  };
}