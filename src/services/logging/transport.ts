import type { LogEvent, LoggingConfig } from './types';

export class LogTransport {
  private readonly config: LoggingConfig;
  private queue: LogEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private degraded = false;

  constructor(config: LoggingConfig) {
    this.config = config;
  }

  enqueue(event: LogEvent): void {
    if (!this.config.enabled) return;

    if (this.queue.length >= this.config.maxQueueSize) {
      this.queue.shift();
    }
    this.queue.push(event);

    if (!this.timer) {
      this.timer = setTimeout(() => {
        void this.flush();
      }, this.config.flushIntervalMs);
    }

    if (this.queue.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.config.enabled || this.queue.length === 0) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.queue.splice(0, this.config.batchSize);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: batch }),
        signal: controller.signal,
        keepalive: true,
      });
      this.degraded = false;
    } catch {
      this.queue = [...batch, ...this.queue].slice(0, this.config.maxQueueSize);
      this.degraded = true;
    } finally {
      clearTimeout(timeout);
    }
  }

  isDegraded(): boolean {
    return this.degraded;
  }

  flushWithBeacon(): void {
    if (!this.config.enabled || this.queue.length === 0 || typeof navigator.sendBeacon !== 'function') return;
    const batch = this.queue.splice(0, this.config.batchSize);
    const blob = new Blob([JSON.stringify({ events: batch })], { type: 'application/json' });
    navigator.sendBeacon(this.config.endpoint, blob);
  }
}
