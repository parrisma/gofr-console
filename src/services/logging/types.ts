export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogResult = 'success' | 'failure' | 'timeout' | 'cancelled';

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  event: string;
  service: 'gofr-console-ui';
  env: 'dev' | 'prod';
  build_number?: string;
  session_id: string;
  request_id?: string;
  route: string;
  component?: string;
  operation?: string;
  result?: LogResult;
  duration_ms?: number;
  error_code?: string;
  message: string;
  dependency?: string;
  http_status?: number;
  retry_count?: number;
  group?: string;
  url_host?: string;
  tool_name?: string;
  service_name?: string;
  data?: Record<string, unknown>;
}

export type LogEventInput = Omit<LogEvent, 'timestamp' | 'service' | 'env' | 'session_id' | 'route'>;

export interface LoggingConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  flushIntervalMs: number;
  maxQueueSize: number;
  timeoutMs: number;
}
