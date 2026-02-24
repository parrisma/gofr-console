import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseUiConfig, UiConfigSchema } from '../../src/types/uiConfig';

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

describe('ui-config schema validation', () => {
  it('validates data/config/ui-config.json against the Zod schema', () => {
    const configPath = path.join(repoRoot(), 'data/config/ui-config.json');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const result = UiConfigSchema.safeParse(raw);

    if (!result.success) {
      throw new Error(
        `SSOT config file failed validation:\n${JSON.stringify(result.error.issues, null, 2)}`
      );
    }

    expect(result.data.version).toBeTruthy();
    expect(result.data.mcpServices.length).toBeGreaterThan(0);
    expect(result.data.infraServices.length).toBeGreaterThan(0);
  });

  it('rejects config with missing required fields', () => {
    expect(() => parseUiConfig({})).toThrow();
    expect(() => parseUiConfig({ version: '1.0.0' })).toThrow();
    expect(() => parseUiConfig({ version: '1.0.0', environment: 'prod' })).toThrow();
  });

  it('rejects config with wrong environment value', () => {
    expect(() =>
      parseUiConfig({
        version: '1.0.0',
        environment: 'staging',
        mcpServices: [],
        infraServices: [],
      })
    ).toThrow();
  });

  it('rejects config with invalid mcpService ports', () => {
    expect(() =>
      parseUiConfig({
        version: '1.0.0',
        environment: 'prod',
        mcpServices: [
          {
            name: 'test',
            displayName: 'Test',
            containerHostname: 'test-host',
            ports: { prod: { mcp: 'not-a-number' }, dev: { mcp: 8080 } },
          },
        ],
        infraServices: [],
      })
    ).toThrow();
  });

  it('accepts valid minimal config', () => {
    const result = parseUiConfig({
      version: '1.0.0',
      environment: 'dev',
      mcpServices: [],
      infraServices: [],
    });
    expect(result.environment).toBe('dev');
    expect(result.mcpServices).toEqual([]);
    expect(result.infraServices).toEqual([]);
  });

  it('accepts infra services with freeform port keys', () => {
    const result = parseUiConfig({
      version: '1.0.0',
      environment: 'prod',
      mcpServices: [],
      infraServices: [
        {
          name: 'neo4j',
          displayName: 'Neo4j',
          containerHostname: 'neo4j-host',
          ports: { bolt: 7687, http: 7474 },
        },
      ],
    });
    expect(result.infraServices[0].ports).toEqual({ bolt: 7687, http: 7474 });
  });
});
