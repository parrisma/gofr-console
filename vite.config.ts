import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { uiConfigPlugin } from "./vite/ui-config-plugin";

// MCP Service proxy configuration
// Note: These use production ports by default. The console's Operations page
// allows switching between dev/prod environments, but since Vite proxy is static,
// we proxy to the prod containers. For dev environment, ensure the dev containers
// are running on the expected hostnames.
const mcpServices = [
  { name: "gofr-iq", host: "gofr-iq-mcp", port: 8080 },
  { name: "gofr-doc", host: "gofr-doc-mcp", port: 8040 },
  { name: "gofr-plot", host: "gofr-plot-mcp", port: 8050 },
  { name: "gofr-np", host: "gofr-np-mcp", port: 8060 },
  { name: "gofr-dig", host: "gofr-dig-mcp", port: 8070 },
];

// Build proxy config for all MCP services
const proxyConfig: Record<string, { target: string; changeOrigin: boolean; rewrite: (path: string) => string; followRedirects: boolean }> = {};
for (const { name, host, port } of mcpServices) {
  proxyConfig[`/api/${name}`] = {
    target: `http://${host}:${port}`,
    changeOrigin: true,
    followRedirects: true,
    rewrite: (path: string) => path.slice(`/api/${name}`.length),
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), uiConfigPlugin()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: proxyConfig,
  },
});
