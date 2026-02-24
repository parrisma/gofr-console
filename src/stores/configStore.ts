// Configuration store for GOFR Console UI
// Loads from and saves to data/config/ui-config.json via Vite plugin API
// Types are re-exported from src/types/uiConfig.ts (the canonical source).

import { parseUiConfig } from '../types/uiConfig';
import type { UiConfig, McpServiceConfig, InfraServiceConfig, Environment, ServicePorts } from '../types/uiConfig';

// Re-export types so existing consumers can keep importing from configStore
export type { UiConfig, McpServiceConfig, InfraServiceConfig, Environment, ServicePorts };
export type { JwtToken } from '../types/uiConfig';

// Minimal fallback -- the real data comes from data/config/ui-config.json.
// This only prevents a crash if the file is completely unreachable.
const DEFAULT_CONFIG: UiConfig = {
  version: '1.0.0',
  environment: 'prod',
  mcpServices: [],
  infraServices: [],
};

class ConfigStore {
  private _config: UiConfig = structuredClone(DEFAULT_CONFIG);
  private _listeners: Set<() => void> = new Set();
  private _loaded = false;
  private _saveDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Load config on init
    this.load();
  }

  // Load config from server with Zod validation
  async load(): Promise<void> {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const raw: unknown = await response.json();
        try {
          this._config = parseUiConfig(raw);
        } catch (validationError) {
          console.error('Config validation failed, using defaults:', validationError);
          this._config = structuredClone(DEFAULT_CONFIG);
        }
        this._loaded = true;
        this.notify();
      }
    } catch {
      // Use defaults on error
      console.warn('Failed to load config, using defaults');
    }
  }

  // Save config to server (debounced)
  private save(): void {
    if (this._saveDebounce) {
      clearTimeout(this._saveDebounce);
    }
    this._saveDebounce = setTimeout(() => {
      this.saveImmediate();
    }, 500);
  }

  // Save config immediately
  private async saveImmediate(): Promise<void> {
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this._config),
      });
    } catch {
      console.error('Failed to save config');
    }
  }

  // Notify listeners of changes
  private notify(): void {
    this._listeners.forEach(listener => listener());
  }

  // Subscribe to changes
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  // Getters
  get loaded(): boolean {
    return this._loaded;
  }

  get environment(): Environment {
    return this._config.environment;
  }

  get mcpServices(): McpServiceConfig[] {
    return this._config.mcpServices;
  }

  get infraServices(): InfraServiceConfig[] {
    return this._config.infraServices;
  }

  // Set environment
  setEnvironment(env: Environment): void {
    this._config.environment = env;
    this.save();
    this.notify();
  }

  // Update MCP service ports
  updateMcpServicePorts(serviceName: string, env: Environment, ports: ServicePorts): void {
    const service = this._config.mcpServices.find(s => s.name === serviceName);
    if (service) {
      if (env === 'prod') {
        service.ports.prod = ports;
      } else {
        service.ports.dev = ports;
      }
      this.save();
      this.notify();
    }
  }

  // Get current MCP port for a service
  getMcpPort(serviceName: string): number {
    const service = this._config.mcpServices.find(s => s.name === serviceName);
    if (!service) return 8080; // default fallback
    if (this._config.environment === 'prod') {
      return service.ports.prod.mcp;
    }
    return service.ports.dev.mcp;
  }

  // Get service config
  getMcpService(serviceName: string): McpServiceConfig | undefined {
    return this._config.mcpServices.find(s => s.name === serviceName);
  }

  // Reset to defaults
  resetToDefaults(): void {
    this._config = structuredClone(DEFAULT_CONFIG);
    this.save();
    this.notify();
  }
}

// Singleton instance
export const configStore = new ConfigStore();
