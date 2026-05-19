import type { AgentReasoningEvent } from '../../types/gofrAgent';

const TEXT_FIELD_ENTRIES = (record: Record<string, unknown>): Array<[string, unknown]> => [
  ['message', record.message],
  ['error', record.error],
  ['answer', record.answer],
  ['text', record.text],
  ['content', record.content],
  ['delta', record.delta],
  ['prompt', record.prompt],
  ['status', record.status],
  ['outcome', record.outcome],
  ['reason', record.reason],
  ['recovery', record.recovery],
  ['recovery_strategy', record.recovery_strategy],
];

const MAX_TEXT_DEPTH = 4;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compactJson(value: unknown): string {
  try {
    const text = JSON.stringify(value) ?? String(value);
    return text.length > 600 ? `${text.slice(0, 600)}...` : text;
  } catch {
    return String(value);
  }
}

function valueToText(value: unknown, depth = 0): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (depth >= MAX_TEXT_DEPTH) return compactJson(value);
  if (Array.isArray(value)) {
    const parts = value.map((item) => valueToText(item, depth + 1)).filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (isRecord(value)) return recordToText(value, depth + 1);
  return null;
}

function recordToText(record: Record<string, unknown>, depth: number): string | null {
  const parts = TEXT_FIELD_ENTRIES(record)
    .map(([key, value]) => {
      const text = valueToText(value, depth + 1);
      return text ? `${key}: ${text}` : null;
    })
    .filter((item): item is string => Boolean(item));
  if (parts.length > 0) return parts.join('; ');
  return compactJson(record);
}

function addLine(lines: string[], line: string | null | undefined): void {
  if (!line) return;
  const cleaned = line.trim();
  if (!cleaned || lines.includes(cleaned)) return;
  lines.push(cleaned);
}

function toolLabel(event: AgentReasoningEvent): string | null {
  const service = typeof event.service === 'string' ? event.service : '';
  const tool = typeof event.tool === 'string' ? event.tool : '';
  if (service && tool) return `${service}/${tool}`;
  if (tool) return tool;
  if (service) return service;
  return null;
}

function eventSummaryText(event: AgentReasoningEvent): string | null {
  return valueToText(event.summary ?? event.message ?? event.error ?? event.answer ?? event.text ?? event.content ?? event.delta ?? event.prompt);
}

export function traceTextLines(event: AgentReasoningEvent): string[] {
  const lines: string[] = [];
  const target = toolLabel(event);
  const summary = eventSummaryText(event);

  switch (event.kind) {
    case 'run_started':
      addLine(lines, 'Run started.');
      break;
    case 'step_started':
      addLine(lines, 'Step started.');
      break;
    case 'text_delta':
      addLine(lines, summary ? `Text: ${summary}` : 'Text generated.');
      break;
    case 'tool_call': {
      const inputText = valueToText(event.args_summary ?? event.args);
      addLine(lines, `Calling ${target ?? 'tool'}.`);
      addLine(lines, inputText ? `Input: ${inputText}` : null);
      break;
    }
    case 'tool_retry':
      addLine(lines, `Retrying ${target ?? 'tool'}.`);
      addLine(lines, summary);
      break;
    case 'tool_result':
      addLine(lines, `${target ?? 'Tool'} result${typeof event.ok === 'boolean' ? `: ${event.ok ? 'ok' : 'failed'}` : ''}.`);
      addLine(lines, summary);
      break;
    case 'summary_update':
      addLine(lines, summary ? `Summary: ${summary}` : 'Summary updated.');
      break;
    case 'step_completed':
      addLine(lines, summary ? `Step completed: ${summary}` : 'Step completed.');
      break;
    case 'run_completed':
      addLine(lines, summary ? `Run completed: ${summary}` : 'Run completed.');
      break;
    case 'run_failed':
      addLine(lines, summary ? `Run failed: ${summary}` : 'Run failed.');
      break;
    case 'user_input_requested':
      addLine(lines, summary ? `User input requested: ${summary}` : 'User input requested.');
      break;
    case 'run_paused':
      addLine(lines, summary ? `Run paused: ${summary}` : 'Run paused.');
      break;
    case 'user_input_received':
      addLine(lines, summary ? `User input received: ${summary}` : 'User input received.');
      break;
    case 'run_resumed':
      addLine(lines, summary ? `Run resumed: ${summary}` : 'Run resumed.');
      break;
    case 'user_input_cancelled':
      addLine(lines, summary ? `User input cancelled: ${summary}` : 'User input cancelled.');
      break;
    default:
      addLine(lines, summary ?? `${event.kind}.`);
      break;
  }

  addLine(lines, typeof event.error === 'string' ? `Error: ${event.error}` : null);
  addLine(lines, typeof event.latency_ms === 'number' ? `Latency: ${event.latency_ms} ms` : null);
  addLine(lines, typeof event.artifact_id === 'string' ? `Artifact: ${event.artifact_id}` : null);
  addLine(lines, event.truncated ? 'Payload was truncated.' : null);

  return lines.length > 0 ? lines : [compactJson(event)];
}