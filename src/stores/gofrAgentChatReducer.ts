import {
  AGENT_DEFAULT_ASK_TIMEOUT_SECONDS,
  AGENT_DEFAULT_MAX_STEPS,
  clampAgentAskTimeoutSeconds,
  clampAgentMaxSteps,
  type AgentAskResponse,
  type AgentChatSettings,
  type AgentChatState,
  type AgentReasoningEvent,
  type AgentTurn,
} from '../types/gofrAgent';

export type AgentChatAction =
  | { type: 'update_settings'; settings: Partial<AgentChatSettings> }
  | { type: 'start_run'; userTurn: AgentTurn; assistantTurn: AgentTurn }
  | { type: 'receive_event'; event: AgentReasoningEvent }
  | { type: 'complete_run'; assistantTurnId: string; response: AgentAskResponse; durationMs: number }
  | { type: 'fail_run'; assistantTurnId: string; message: string }
  | { type: 'set_error'; message: string | null }
  | { type: 'reset'; sessionId: string };

export const defaultAgentChatSettings: AgentChatSettings = {
  maxSteps: AGENT_DEFAULT_MAX_STEPS,
  askTimeoutSeconds: AGENT_DEFAULT_ASK_TIMEOUT_SECONDS,
  outputFormat: 'text',
  toolsOnly: false,
  noCommentary: false,
};

export function createAgentId(prefix = 'agent'): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return randomId;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createInitialAgentChatState(sessionId = createAgentId('session')): AgentChatState {
  return {
    sessionId,
    turns: [],
    pendingTurnId: null,
    settings: defaultAgentChatSettings,
    error: null,
  };
}

export function createAgentTurn(args: {
  id?: string;
  role: AgentTurn['role'];
  text: string;
  status?: AgentTurn['status'];
}): AgentTurn {
  return {
    id: args.id ?? createAgentId('turn'),
    role: args.role,
    text: args.text,
    status: args.status,
    createdAt: new Date().toISOString(),
    events: [],
  };
}

function sortEvents(events: AgentReasoningEvent[]): AgentReasoningEvent[] {
  return [...events].sort((a, b) => a.sequence - b.sequence);
}

function mergeEvents(existing: AgentReasoningEvent[], incoming: AgentReasoningEvent[]): AgentReasoningEvent[] {
  const byId = new Map<string, AgentReasoningEvent>();
  for (const event of [...existing, ...incoming]) {
    const key = event.event_id || `${event.kind}-${event.sequence}`;
    byId.set(key, event);
  }
  return sortEvents([...byId.values()]);
}

function updateTurn(state: AgentChatState, turnId: string, updater: (turn: AgentTurn) => AgentTurn): AgentChatState {
  return {
    ...state,
    turns: state.turns.map((turn) => (turn.id === turnId ? updater(turn) : turn)),
  };
}

function statusForResponse(response: AgentAskResponse): AgentTurn['status'] {
  if (response.status === 'waiting_for_user' || response.user_input_request) return 'waiting_for_user';
  if (response.status === 'cancelled') return 'cancelled';
  if (response.verification_gap) return 'verification_gap';
  if (response.clarification_request) return 'clarification_requested';
  return 'completed';
}

function textForResponse(response: AgentAskResponse): string {
  if (response.user_input_request?.prompt) return response.user_input_request.prompt;
  if (response.clarification_request?.prompt) return response.clarification_request.prompt;
  return response.answer;
}

function applyEvent(state: AgentChatState, event: AgentReasoningEvent): AgentChatState {
  const turn = state.turns.find((candidate) => {
    if (event.request_id && candidate.requestId === event.request_id) return true;
    return !candidate.requestId && candidate.id === state.pendingTurnId;
  });
  if (!turn) return state;

  return updateTurn(state, turn.id, (current) => ({
    ...current,
    status: event.kind === 'run_failed' ? 'failed' : current.status,
    error: event.kind === 'run_failed' && typeof event.error === 'string' ? event.error : current.error,
    events: mergeEvents(current.events, [event]),
  }));
}

function sanitizeSettings(settings: AgentChatSettings, patch: Partial<AgentChatSettings>): AgentChatSettings {
  return {
    ...settings,
    ...patch,
    maxSteps: clampAgentMaxSteps(patch.maxSteps ?? settings.maxSteps),
    askTimeoutSeconds: clampAgentAskTimeoutSeconds(patch.askTimeoutSeconds ?? settings.askTimeoutSeconds),
    outputFormat: patch.outputFormat ?? settings.outputFormat,
    toolsOnly: patch.toolsOnly ?? settings.toolsOnly,
    noCommentary: patch.noCommentary ?? settings.noCommentary,
  };
}

export function agentChatReducer(state: AgentChatState, action: AgentChatAction): AgentChatState {
  switch (action.type) {
    case 'update_settings':
      return { ...state, settings: sanitizeSettings(state.settings, action.settings) };
    case 'start_run':
      return {
        ...state,
        turns: [...state.turns, action.userTurn, action.assistantTurn],
        pendingTurnId: action.assistantTurn.id,
        error: null,
      };
    case 'receive_event':
      return applyEvent(state, action.event);
    case 'complete_run':
      return updateTurn(
        {
          ...state,
          sessionId: action.response.session_id,
          pendingTurnId: state.pendingTurnId === action.assistantTurnId ? null : state.pendingTurnId,
        },
        action.assistantTurnId,
        (turn) => ({
          ...turn,
          text: textForResponse(action.response),
          status: statusForResponse(action.response),
          requestId: action.response.request_id,
          sessionId: action.response.session_id,
          model: action.response.model,
          tokensUsed: action.response.tokens_used,
          durationMs: action.durationMs,
          events: mergeEvents(turn.events, action.response.steps),
          verificationGap: action.response.verification_gap,
          clarificationRequest: action.response.clarification_request,
          provenance: action.response.provenance,
          userInputRequest: action.response.user_input_request ?? null,
        }),
      );
    case 'fail_run':
      return updateTurn(
        {
          ...state,
          pendingTurnId: state.pendingTurnId === action.assistantTurnId ? null : state.pendingTurnId,
          error: action.message,
        },
        action.assistantTurnId,
        (turn) => ({ ...turn, status: 'failed', text: action.message, error: action.message }),
      );
    case 'set_error':
      return { ...state, error: action.message };
    case 'reset':
      return { ...createInitialAgentChatState(action.sessionId), settings: state.settings };
    default:
      return state;
  }
}