import { describe, expect, it } from 'vitest';

import { traceTextLines } from '../../src/components/agent/agentTraceText';
import type { AgentReasoningEvent } from '../../src/types/gofrAgent';

function event(overrides: Partial<AgentReasoningEvent>): AgentReasoningEvent {
  return {
    event_id: 'event-1',
    sequence: 1,
    kind: 'tool_result',
    ...overrides,
  };
}

describe('GOFR-Agent run trace text view', () => {
  it('extracts text from object summaries for tool results', () => {
    const lines = traceTextLines(event({
      service: 'clients',
      tool: 'list_clients',
      ok: false,
      summary: {
        message: 'Not authorized for activity',
        recovery_strategy: 'Use a broader token',
      },
    }));

    expect(lines).toContain('clients/list_clients result: failed.');
    expect(lines).toContain('message: Not authorized for activity; recovery_strategy: Use a broader token');
  });

  it('uses delta text for streaming text events', () => {
    const lines = traceTextLines(event({ kind: 'text_delta', delta: 'Working on the answer' }));

    expect(lines).toEqual(['Text: Working on the answer']);
  });
});