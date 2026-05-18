export const AGENT_SERVICE_NAME = 'gofr-agent' as const;
export const AGENT_MCP_ENDPOINT = '/api/gofr-agent/mcp';
export const AGENT_REASONING_LOGGER = 'gofr-agent.reasoning';
export const AGENT_DEFAULT_MAX_STEPS = 10;
export const AGENT_HARD_MAX_STEPS = 50;
export const AGENT_DEFAULT_ASK_TIMEOUT_SECONDS = 650;
export const AGENT_MIN_ASK_TIMEOUT_SECONDS = 601;
export const AGENT_QUESTION_MAX_LENGTH = 8000;
export const AGENT_CONTEXT_MAX_LENGTH = 16000;

export type AgentOutputFormat = 'text' | 'json';
export type AgentReadinessStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface AgentPingResponse {
  status: string;
  service?: string;
  timestamp?: string;
  version?: string;
  [key: string]: unknown;
}

export interface AgentHttpHealthResponse {
  status: AgentReadinessStatus;
  service: string;
  timestamp: string;
  version: string;
  message: string;
  downstream: {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
  };
}

export interface AgentHealthCheckServiceItem {
  name: string;
  status: AgentReadinessStatus | 'failed';
  tool_count: number;
  supports_results_hub: boolean;
  can_publish_results: boolean;
  can_consume_results: boolean;
  result_types: string[];
  error?: string;
  registration_error?: string;
}

export interface AgentRuntimeLimits {
  max_steps_hard_cap?: number;
  max_question_chars?: number;
  max_context_chars?: number;
  [key: string]: number | undefined;
}

export interface AgentRuntimeSessions {
  [key: string]: number | undefined;
}

export interface AgentRuntimeFeatures {
  [key: string]: boolean | undefined;
}

export interface AgentRuntimeHub {
  [key: string]: boolean | number | undefined;
}

export interface AgentRuntimeUiLimits {
  maxSteps: number;
  questionMaxLength: number;
  contextMaxLength: number;
}

export interface AgentMcpEndpointDiagnostic {
  mcpUrl: string;
  host: string;
  path: string;
  sameOrigin: boolean;
}

export interface AgentHealthCheckResponse {
  status: AgentReadinessStatus;
  service: string;
  timestamp: string;
  version: string;
  message: string;
  config: {
    models: {
      selected: string;
      allowed_overrides: string[];
      openrouter_api_key_configured: boolean;
    };
    limits: AgentRuntimeLimits;
    sessions: AgentRuntimeSessions;
    features: AgentRuntimeFeatures;
    hub: AgentRuntimeHub;
  };
  downstream_services: {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
    items: AgentHealthCheckServiceItem[];
  };
}

export interface AgentServiceTool {
  name: string;
  description?: string;
}

export interface AgentServiceStatus {
  name: string;
  url?: string;
  description?: string;
  enabled?: boolean;
  status: string;
  tools: AgentServiceTool[];
  supports_results_hub?: boolean;
  can_publish_results?: boolean;
  can_consume_results?: boolean;
  result_types?: string[];
  error?: string;
  registration_error?: string;
}

export interface AgentListServicesResponse {
  services: AgentServiceStatus[];
}

export interface AgentAskRequest {
  question: string;
  session_id?: string;
  interactive?: boolean;
  context?: string;
  instructions?: string;
  asserted_facts?: string[];
  pasted_content?: string[];
  forbidden_services?: string[];
  forbidden_tools?: string[];
  allowed_services?: string[];
  tools_only?: boolean;
  output_format?: AgentOutputFormat;
  no_commentary?: boolean;
  max_steps?: number;
  model_override?: string;
}

export type AgentAskStatus = 'completed' | 'waiting_for_user' | 'cancelled' | string;

export interface AgentUserInputRequest {
  prompt_id: string;
  run_id: string;
  session_id: string;
  prompt: string;
  input_schema?: Record<string, unknown> | null;
  choices?: string[] | null;
  created_at: string;
  expires_at: string;
  missing_fields: string[];
}

export type AgentVerificationGapReason =
  | 'no_service_registered'
  | 'tool_error'
  | 'empty_result'
  | 'schema_mismatch'
  | 'contradiction'
  | 'policy_denied'
  | 'constraint_blocked'
  | 'max_steps_reached'
  | string;

export interface AgentVerificationAttempt {
  service?: string | null;
  tool?: string | null;
  args_summary?: Record<string, unknown> | string | null;
  outcome: string;
}

export interface AgentVerificationGap {
  request_id: string;
  requested_fact: string;
  attempted: AgentVerificationAttempt[];
  reason: AgentVerificationGapReason;
  options: string[];
}

export interface AgentClarificationRequest {
  request_id: string;
  question: string;
  missing_fields: string[];
  reason: string;
  prompt: string;
}

export interface AgentProvenanceRecord {
  request_id: string;
  service: string;
  tool: string;
  args_hash: string;
  artifact_id?: string | null;
  attempt: number;
  ok: boolean;
  latency_ms?: number | null;
  truncated: boolean;
  as_of?: string | null;
}

export interface AgentToolAttempt {
  service?: string;
  tool?: string;
  ok?: boolean;
  attempt?: number;
  latency_ms?: number | null;
  args_hash?: string | null;
  artifact_id?: string | null;
  as_of?: string | null;
  summary?: unknown;
}

export interface AgentArtifactDescriptor {
  kind?: string;
  artifact_id?: string;
  args_hash?: string;
  as_of?: string;
  [key: string]: unknown;
}

export type AgentReasoningKind =
  | 'run_started'
  | 'step_started'
  | 'text_delta'
  | 'tool_call'
  | 'tool_retry'
  | 'tool_result'
  | 'summary_update'
  | 'step_completed'
  | 'run_completed'
  | 'run_failed'
  | 'user_input_requested'
  | 'run_paused'
  | 'user_input_received'
  | 'run_resumed'
  | 'user_input_cancelled'
  | string;

export interface AgentReasoningEventBase {
  request_id?: string;
  session_id?: string;
  run_id?: string | null;
  event_id: string;
  sequence: number;
  kind: AgentReasoningKind;
  timestamp?: string;
  truncated?: boolean;
}

export type AgentReasoningEvent = AgentReasoningEventBase & Record<string, unknown>;

export interface AgentAskResponse {
  session_id: string;
  request_id: string;
  status?: AgentAskStatus;
  is_complete?: boolean;
  run_id?: string;
  answer: string;
  user_input_request?: AgentUserInputRequest | null;
  steps: AgentReasoningEvent[];
  model: string;
  tokens_used: number;
  verification_gap: AgentVerificationGap | null;
  clarification_request: AgentClarificationRequest | null;
  provenance: AgentProvenanceRecord[];
}

export interface AgentResetSessionResponse {
  status: string;
  session_id: string;
}

export type AgentConnectionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'connected'; version?: string; message?: string }
  | { status: 'degraded'; version?: string; message: string }
  | { status: 'unhealthy'; version?: string; message: string }
  | { status: 'needs-token'; message: string }
  | { status: 'unauthorized'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'misconfigured'; message: string };

export type AgentTurnRole = 'user' | 'assistant';

export type AgentTurnStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'waiting_for_user'
  | 'cancelled'
  | 'verification_gap'
  | 'clarification_requested'
  | 'failed';

export interface AgentTurn {
  id: string;
  role: AgentTurnRole;
  text: string;
  status?: AgentTurnStatus;
  createdAt: string;
  requestId?: string;
  sessionId?: string;
  model?: string;
  tokensUsed?: number;
  durationMs?: number;
  events: AgentReasoningEvent[];
  verificationGap?: AgentVerificationGap | null;
  clarificationRequest?: AgentClarificationRequest | null;
  provenance?: AgentProvenanceRecord[];
  userInputRequest?: AgentUserInputRequest | null;
  error?: string;
}

export interface AgentChatSettings {
  maxSteps: number;
  askTimeoutSeconds: number;
  outputFormat: AgentOutputFormat;
  toolsOnly: boolean;
  noCommentary: boolean;
}

export interface AgentChatState {
  sessionId: string;
  turns: AgentTurn[];
  pendingTurnId: string | null;
  settings: AgentChatSettings;
  error: string | null;
}

export const AGENT_RESERVED_TOOL_NAMES = new Set([
  'register_service',
  'refresh_services',
  '_store_result',
  '_get_result',
  '_describe_result',
  '_register_results_hub',
]);

export function isReservedAgentToolName(name: string): boolean {
  return AGENT_RESERVED_TOOL_NAMES.has(name);
}

export function clampAgentMaxSteps(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value)
    ? Math.floor(value)
    : AGENT_DEFAULT_MAX_STEPS;
  return Math.min(AGENT_HARD_MAX_STEPS, Math.max(1, numeric));
}

export function clampAgentAskTimeoutSeconds(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value)
    ? Math.floor(value)
    : AGENT_DEFAULT_ASK_TIMEOUT_SECONDS;
  return Math.max(AGENT_MIN_ASK_TIMEOUT_SECONDS, numeric);
}
