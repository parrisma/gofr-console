// Configuration store for GOFR Console UI
// Loads from and saves to config/ui-config.json via Vite plugin API

export type Environment = 'prod' | 'dev';

export interface ServicePorts {
  mcp: number;
  mcpo: number;
  web: number;
}

export interface McpServiceConfig {
  name: string;
  displayName: string;
  containerHostname: string;
  ports: {
    prod: ServicePorts;
    dev: ServicePorts;
  };
}

export interface InfraServiceConfig {
  name: string;
  displayName: string;
  containerHostname: string;
  ports: {
    prod: number;
    dev: number;
  };
}

export interface JwtToken {
  name: string;
  groups: string;
  token: string;
}

export interface UiConfig {
  version: string;
  environment: Environment;
  mcpServices: McpServiceConfig[];
  infraServices: InfraServiceConfig[];
  tokens: JwtToken[];
}

// Default configuration (fallback if config file unavailable)
const DEFAULT_CONFIG: UiConfig = {
  version: '1.0.0',
  environment: 'prod',
  mcpServices: [
    {
      name: 'gofr-iq',
      displayName: 'GOFR-IQ',
      containerHostname: 'gofr-iq-mcp',
      ports: {
        prod: { mcp: 8080, mcpo: 8081, web: 8082 },
        dev: { mcp: 8180, mcpo: 8181, web: 8182 },
      },
    },
    {
      name: 'gofr-doc',
      displayName: 'GOFR-DOC',
      containerHostname: 'gofr-doc-mcp',
      ports: {
        prod: { mcp: 8040, mcpo: 8041, web: 8042 },
        dev: { mcp: 8140, mcpo: 8141, web: 8142 },
      },
    },
    {
      name: 'gofr-plot',
      displayName: 'GOFR-PLOT',
      containerHostname: 'gofr-plot-mcp',
      ports: {
        prod: { mcp: 8050, mcpo: 8051, web: 8052 },
        dev: { mcp: 8150, mcpo: 8151, web: 8152 },
      },
    },
    {
      name: 'gofr-np',
      displayName: 'GOFR-NP',
      containerHostname: 'gofr-np-mcp',
      ports: {
        prod: { mcp: 8060, mcpo: 8061, web: 8062 },
        dev: { mcp: 8160, mcpo: 8161, web: 8162 },
      },
    },
    {
      name: 'gofr-dig',
      displayName: 'GOFR-DIG',
      containerHostname: 'gofr-dig-mcp',
      ports: {
        prod: { mcp: 8070, mcpo: 8071, web: 8072 },
        dev: { mcp: 8170, mcpo: 8171, web: 8172 },
      },
    },
  ],
  infraServices: [
    {
      name: 'neo4j',
      displayName: 'Neo4j',
      containerHostname: 'gofr-neo4j',
      ports: { prod: 7474, dev: 7574 },
    },
    {
      name: 'chromadb',
      displayName: 'ChromaDB',
      containerHostname: 'gofr-chromadb',
      ports: { prod: 8000, dev: 8100 },
    },
    {
      name: 'vault',
      displayName: 'Vault',
      containerHostname: 'gofr-vault',
      ports: { prod: 8201, dev: 8301 },
    },
  ],
  tokens: [],
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

  // Load config from server
  async load(): Promise<void> {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config: UiConfig = await response.json();
        this._config = config;
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

  get tokens(): JwtToken[] {
    return this._config.tokens ?? [];
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

  // Add a new JWT token
  addToken(token: JwtToken): void {
    if (!this._config.tokens) {
      this._config.tokens = [];
    }
    this._config.tokens.push(token);
    this.save();
    this.notify();
  }

  // Update an existing JWT token
  updateToken(index: number, token: JwtToken): void {
    const safeIndex = Math.floor(index);
    if (
      this._config.tokens &&
      safeIndex >= 0 &&
      safeIndex < this._config.tokens.length
    ) {
      this._config.tokens.splice(safeIndex, 1, token);
      this.save();
      this.notify();
    }
  }

  // Delete a JWT token
  deleteToken(index: number): void {
    const safeIndex = Math.floor(index);
    if (
      this._config.tokens &&
      safeIndex >= 0 &&
      safeIndex < this._config.tokens.length
    ) {
      this._config.tokens.splice(safeIndex, 1);
      this.save();
      this.notify();
    }
  }
}

// Singleton instance
export const configStore = new ConfigStore();
