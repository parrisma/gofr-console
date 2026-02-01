# Copilot Instructions (GOFR Console)

## Core
- Dev container + Docker access.
- Never use `localhost`; use service hostnames (e.g., `gofr-neo4j`).
- Prefer repo control scripts for services/auth/ingestion/tests.
- Keep code simple; debug basics first (env, health, logs, auth, connectivity).
- If user reminds a preferred pattern, add it here.

## Documentation
- **MCP Tool Interface**: `/home/gofr/devroot/gofr-console/tmp/mcp-tool-interface.md` - Complete GOFR-IQ MCP API specification, tools, parameters, and response formats
- **Neo4j Schema**: `/home/gofr/devroot/gofr-console/tmp/neo4j-schema.md` - Knowledge graph schema, node types, relationships, and data model

## MCP (Model Context Protocol) Integration
GOFR MCP servers use **HTTP Streamable** protocol (not simple REST).

### Key Points
- **Session-based**: Must call `initialize` first to get `mcp-session-id` header.
- **SSE responses**: Responses are Server-Sent Events format (`event: message\ndata: {...}`).
- **Container hostnames**: Use actual container names (e.g., `gofr-iq-mcp`, not `gofr-iq`).
- **Vite proxy**: Browser can't resolve Docker hostnames; proxy via Vite config.

### MCP Call Flow
1. POST to `/mcp` with `initialize` method → get `mcp-session-id` from response header
2. Include `Mcp-Session-Id` header in all subsequent calls
3. Call tools via `tools/call` method with `name` and `arguments`
4. Parse SSE response: extract JSON from `data:` line

### Required Headers
```
Content-Type: application/json
Accept: application/json, text/event-stream
Mcp-Session-Id: <session-id>  (after initialize)
```

### JSON-RPC Format
```json
// Initialize
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"gofr-console","version":"0.0.1"}}}

// Tool call
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"health_check","arguments":{}}}
```

### Vite Proxy Config (vite.config.ts)
```ts
proxy: {
  "/api/gofr-iq": {
    target: "http://gofr-iq-mcp:8080",  // Use container hostname
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/gofr-iq/, ""),
  },
}
```

### Reference Implementation
See `src/services/api/index.ts` for `McpClient` class with session management.

## Security
- Treat inputs as hostile; validate/sanitize.
- Avoid `eval`/`Function`/dynamic `require`/unsafe deserialization.
- Prefer safe APIs (`fs/promises`, `path`, `URL`); avoid shelling out.
- Never log secrets/PII.

## Dependencies & CVEs
- Minimize deps; prefer maintained packages.
- Check for CVEs; flag high/critical issues.
- Pin versions where feasible.
- Run `pnpm run security` or `./scripts/security-scan.sh` before commits.
- Tools: pnpm audit, ESLint security plugin, Semgrep (SAST), Trivy (image scan).

## Node Hardening
- Avoid risky `postinstall` scripts.
- Prevent path traversal; normalize/resolve paths.
- Enforce least privilege for files/env.
- Target Node 20 LTS features.

## Testing
- Add/update tests; include negative/boundary cases.
- Keep tests fast and deterministic.

## Build/Run Safety
- Don’t run destructive commands without confirmation.

## Logging
- Use the **project logger** (e.g., `StructuredLogger`), **not** `print()` or default logging.
- Logs must be **clear and actionable**, not cryptic.
- All errors must include **cause, references/context**, and **recovery options** where possible.