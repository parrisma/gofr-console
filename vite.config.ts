import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { uiConfigPlugin } from "./vite/ui-config-plugin";
import { execSync } from "node:child_process";

const disableHmr = process.env.GOFR_DISABLE_HMR === "1" || process.env.VITE_DISABLE_HMR === "1";

// Auto-incrementing build number from git
function gitBuildInfo() {
  try {
    const count = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim();
    const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    return { count, hash };
  } catch {
    return { count: '0', hash: 'unknown' };
  }
}
const build = gitBuildInfo();

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

// gofr-doc stock images are served by the web port/container, not the MCP port
proxyConfig['/api/gofr-doc/images'] = {
  target: `http://gofr-doc-web:8042`,
  changeOrigin: true,
  followRedirects: true,
  rewrite: (path: string) => path.replace(/^\/api\/gofr-doc/, ''),
};

for (const { name, host, port } of mcpServices) {
  proxyConfig[`/api/${name}`] = {
    target: `http://${host}:${port}`,
    changeOrigin: true,
    followRedirects: true,
    rewrite: (path: string) => path.slice(`/api/${name}`.length),
  };
}

proxyConfig['/api/gofr-seq'] = {
  target: `http://${process.env.GOFR_SEQ_HOST || 'gofr-seq'}:${process.env.GOFR_SEQ_PORT || '5341'}`,
  changeOrigin: true,
  followRedirects: true,
  rewrite: (path: string) => path.replace(/^\/api\/gofr-seq/, ''),
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), uiConfigPlugin()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(build.count),
    __BUILD_HASH__: JSON.stringify(build.hash),
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    hmr: disableHmr ? false : undefined,
    proxy: proxyConfig,
  },
});
