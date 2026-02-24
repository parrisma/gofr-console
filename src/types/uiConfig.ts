// Canonical Zod schemas for UI configuration.
// All TypeScript types are derived from these schemas -- never define them elsewhere.

import { z } from 'zod';

// --- MCP service schemas ---

export const ServicePortsSchema = z.object({
  mcp: z.number(),
  mcpo: z.number(),
  web: z.number(),
});

export const McpServiceSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  containerHostname: z.string(),
  ports: z.object({
    prod: ServicePortsSchema,
    dev: ServicePortsSchema,
  }),
});

// --- Infra service schemas ---
// Infra services have heterogeneous port keys (bolt, http, rest, perf, https, etc.)

export const InfraServiceSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  containerHostname: z.string(),
  ports: z.record(z.string(), z.number()),
});

// --- Top-level config schema ---
// Note: tokens are deliberately absent -- they live in tokenStore.

export const UiConfigSchema = z.object({
  version: z.string(),
  environment: z.enum(['prod', 'dev']),
  mcpServices: z.array(McpServiceSchema),
  infraServices: z.array(InfraServiceSchema),
});

// --- Derived types ---

export type ServicePorts = z.infer<typeof ServicePortsSchema>;
export type McpServiceConfig = z.infer<typeof McpServiceSchema>;
export type InfraServiceConfig = z.infer<typeof InfraServiceSchema>;
export type UiConfig = z.infer<typeof UiConfigSchema>;
export type Environment = UiConfig['environment'];

// --- JWT token type (shared, but stored in tokenStore, not in UiConfig) ---

export interface JwtToken {
  name: string;
  groups: string;
  token: string;
}

// --- Validation helper ---

export function parseUiConfig(raw: unknown): UiConfig {
  return UiConfigSchema.parse(raw);
}
