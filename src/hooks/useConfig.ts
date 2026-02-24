// React hook for config store
import { useSyncExternalStore, useCallback } from 'react';
import { configStore } from '../stores/configStore';
import type { Environment, ServicePorts } from '../stores/configStore';

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

  return {
    environment,
    mcpServices,
    infraServices,
    setEnvironment,
    updateMcpServicePorts,
    resetToDefaults,
    getMcpPort,
  };
}
