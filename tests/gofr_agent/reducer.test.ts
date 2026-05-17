import { describe, expect, it } from 'vitest';

import {
  agentChatReducer,
  createAgentTurn,
  createInitialAgentChatState,
} from '../../src/stores/gofrAgentChatReducer';
import type { AgentAskResponse, AgentReasoningEvent } from '../../src/types/gofrAgent';

function event(sequence: number, requestId?: string): AgentReasoningEvent {
  return {
    event_id: `event-${sequence}`,
    sequence,
    kind: 'tool_call',
    request_id: requestId,
    service: 'analytics',
    tool: 'public_tool',
  };
}

function response(overrides: Partial<AgentAskResponse> = {}): AgentAskResponse {
  return {
    session_id: 'server-session',
    request_id: 'request-1',
    answer: 'done',
    steps: [],
    model: 'model-a',
    tokens_used: 12,
    verification_gap: null,
    clarification_request: null,
    provenance: [],
    ...overrides,
  };
}

describe('GOFR-Agent chat reducer', () => {
  it('appends user and pending assistant turns', () => {
    const initial = createInitialAgentChatState('session-1');
    const userTurn = createAgentTurn({ id: 'user-1', role: 'user', text: 'hello', status: 'completed' });
    const assistantTurn = createAgentTurn({ id: 'assistant-1', role: 'assistant', text: '', status: 'running' });

    const next = agentChatReducer(initial, { type: 'start_run', userTurn, assistantTurn });

    expect(next.turns.map((turn) => turn.id)).toEqual(['user-1', 'assistant-1']);
    expect(next.pendingTurnId).toBe('assistant-1');
  });

  it('attaches events to pending turn before request id is known', () => {
    const started = agentChatReducer(createInitialAgentChatState('session-1'), {
      type: 'start_run',
      userTurn: createAgentTurn({ id: 'user-1', role: 'user', text: 'hello', status: 'completed' }),
      assistantTurn: createAgentTurn({ id: 'assistant-1', role: 'assistant', text: '', status: 'running' }),
    });

    const next = agentChatReducer(started, { type: 'receive_event', event: event(2) });

    expect(next.turns.find((turn) => turn.id === 'assistant-1')?.events).toHaveLength(1);
  });

  it('sorts and reconciles final response events', () => {
    const started = agentChatReducer(createInitialAgentChatState('session-1'), {
      type: 'start_run',
      userTurn: createAgentTurn({ id: 'user-1', role: 'user', text: 'hello', status: 'completed' }),
      assistantTurn: createAgentTurn({ id: 'assistant-1', role: 'assistant', text: '', status: 'running' }),
    });
    const withEvent = agentChatReducer(started, { type: 'receive_event', event: event(2) });

    const completed = agentChatReducer(withEvent, {
      type: 'complete_run',
      assistantTurnId: 'assistant-1',
      response: response({ steps: [event(1, 'request-1')] }),
      durationMs: 25,
    });

    const assistant = completed.turns.find((turn) => turn.id === 'assistant-1');
    expect(assistant?.requestId).toBe('request-1');
    expect(assistant?.events.map((reasoningEvent) => reasoningEvent.sequence)).toEqual([1, 2]);
    expect(assistant?.status).toBe('completed');
  });

  it('maps clarification request to clarification status', () => {
    const started = agentChatReducer(createInitialAgentChatState('session-1'), {
      type: 'start_run',
      userTurn: createAgentTurn({ id: 'user-1', role: 'user', text: 'hello', status: 'completed' }),
      assistantTurn: createAgentTurn({ id: 'assistant-1', role: 'assistant', text: '', status: 'running' }),
    });

    const completed = agentChatReducer(started, {
      type: 'complete_run',
      assistantTurnId: 'assistant-1',
      durationMs: 10,
      response: response({
        answer: '',
        clarification_request: {
          request_id: 'request-1',
          question: 'Which account?',
          missing_fields: ['account'],
          reason: 'missing account',
          prompt: 'Which account should I use?',
        },
      }),
    });

    const assistant = completed.turns.find((turn) => turn.id === 'assistant-1');
    expect(assistant?.status).toBe('clarification_requested');
    expect(assistant?.text).toBe('Which account should I use?');
  });

  it('maps waiting-for-user response to a prompt turn', () => {
    const started = agentChatReducer(createInitialAgentChatState('session-1'), {
      type: 'start_run',
      userTurn: createAgentTurn({ id: 'user-1', role: 'user', text: 'hello', status: 'completed' }),
      assistantTurn: createAgentTurn({ id: 'assistant-1', role: 'assistant', text: '', status: 'running' }),
    });

    const completed = agentChatReducer(started, {
      type: 'complete_run',
      assistantTurnId: 'assistant-1',
      durationMs: 10,
      response: response({
        status: 'waiting_for_user',
        answer: '',
        user_input_request: {
          prompt_id: 'prompt-1',
          run_id: 'run-1',
          session_id: 'server-session',
          prompt: 'Choose a value',
          created_at: '2026-05-17T00:00:00Z',
          expires_at: '2026-05-17T00:05:00Z',
          missing_fields: ['value'],
        },
      }),
    });

    const assistant = completed.turns.find((turn) => turn.id === 'assistant-1');
    expect(assistant?.status).toBe('waiting_for_user');
    expect(assistant?.text).toBe('Choose a value');
    expect(assistant?.userInputRequest?.prompt_id).toBe('prompt-1');
  });

  it('preserves trace and marks turn failed on run_failed', () => {
    const started = agentChatReducer(createInitialAgentChatState('session-1'), {
      type: 'start_run',
      userTurn: createAgentTurn({ id: 'user-1', role: 'user', text: 'hello', status: 'completed' }),
      assistantTurn: createAgentTurn({ id: 'assistant-1', role: 'assistant', text: '', status: 'running' }),
    });

    const failed = agentChatReducer(started, {
      type: 'receive_event',
      event: { event_id: 'failed-1', sequence: 3, kind: 'run_failed', error: 'boom' },
    });

    const assistant = failed.turns.find((turn) => turn.id === 'assistant-1');
    expect(assistant?.status).toBe('failed');
    expect(assistant?.events).toHaveLength(1);
    expect(assistant?.error).toBe('boom');
  });
});