// React hook for config store
import { useSyncExternalStore, useCallback } from 'react';
import { configStore } from '../stores/configStore';
import type { Environment, ServicePorts, JwtToken } from '../stores/configStore';

export function useConfig() {
  const environment = useSyncExternalStore(
    (callback) => configStore.subscribe(callback),
    () => configStore.environment
  );

  const mcpServices = useSyncExternalStore(
    (callback) => configStore.subscribe(callback),
    () => configStore.mcpServices
  );

  const infraServices = useSyncExternalStore(
    (callback) => configStore.subscribe(callback),
    () => configStore.infraServices
  );

  const tokens = useSyncExternalStore(
    (callback) => configStore.subscribe(callback),
    () => configStore.tokens
  );

  const setEnvironment = useCallback((env: Environment) => {
    configStore.setEnvironment(env);
  }, []);

  const updateMcpServicePorts = useCallback(
    (serviceName: string, env: Environment, ports: ServicePorts) => {
      configStore.updateMcpServicePorts(serviceName, env, ports);
    },
    []
  );

  const resetToDefaults = useCallback(() => {
    configStore.resetToDefaults();
  }, []);

  const getMcpPort = useCallback((serviceName: string) => {
    return configStore.getMcpPort(serviceName);
  }, []);

  const addToken = useCallback((token: JwtToken) => {
    configStore.addToken(token);
  }, []);

  const updateToken = useCallback((index: number, token: JwtToken) => {
    configStore.updateToken(index, token);
  }, []);

  const deleteToken = useCallback((index: number) => {
    configStore.deleteToken(index);
  }, []);

  return {
    environment,
    mcpServices,
    infraServices,
    tokens,
    setEnvironment,
    updateMcpServicePorts,
    resetToDefaults,
    getMcpPort,
    addToken,
    updateToken,
    deleteToken,
  };
}
