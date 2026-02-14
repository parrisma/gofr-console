# Copilot Instructions (GOFR Console)

## IMMUTABLE INSTRUCTIONS
1. Always ask questions if the request requires you to make assumptions
2. Avoid head/tail on commands as it makes it hard for user to see what is happening
3. when ask to write something always do it in a doc if it is more than a few sentences
4. for technical answers always reply in plain text and avoid markdown formatting
5. avoid using localhost use docker names or known IP and ports for services

## CHANGE PROCESS
1. For any change > than a few simple lines the process is
1.1 Write a specification doc with the proposed changes and assumptions to be reviewed by user (avoid code in specs)
1.1.1 never make assumptions always ask questions to user.
1.2 Once spec is agreed write a doc that is a step by **SMALL** step implementation plan witch checks to track progress (avoid code in implementation plan)
1.2.1 plan to include updating all code, docs, tests etc
1.2.2 full tests should be run before and at end as acceptance test
1.2.3 tests should be modified / added as needed ..
1.3 execute the impl plan when it has been agreed by user.

## ISSUE RESOLUTION
1. For any issue that is not a simple fix write a systematic strategy document to define and resolve the root cause
1.1 document assumptions and how they can be validated, assume nothing
1.2 work systematically and update document as needed
1.3 ask user questions to validate assumptions and findings
2. execute the strategy and stay fixed in the cause
2.1 document any side issues but do not deviate from the strategy to fix them until the root cause is resolved

## PROJECT DETAILS
- 
- Uses UV only: `uv run`, `uv add`. No `pip install`, no `python -m venv`.
- Prefer `gofr_common` helpers (auth, config, storage, logging).
- VSsCode is run in a Dev container so need to use docker hostnames and ports, not localhost.
- host docker is available from the dev container at `host.docker.internal`.

## TESTING
- run targeted tests via run_tests.sh before running full suite
- Always use scripts/run_tests.sh to run tests (sets PYTHONPATH, env vars, etc)
- Modify this script if it does not do what is needed or needs enhancing to manage en set up/teardown.
- When tests break always fix them even if not apparently related to current code changes. 
- full tests mean running tests that depend on test services being up including vault, SEQ etc all of which run_tests.sh can start 

## MCP Tools (current)
`ping`, `set_antidetection`, `get_content`, `get_structure`, `get_session_info`, `get_session_chunk`, `list_sessions`, `get_session_urls`, `get_session`

### MCP Tool Pattern (required)
1. Add `Tool(...)` schema in `handle_list_tools`.
2. Route in `handle_call_tool`.
3. Implement `_handle_*` returning `List[TextContent]` via `_json_text`.
4. Use `_error_response(...)` or `_exception_response(...)` for errors.

## Useful Scripts
1. TBC

## LOGGING
- Use the **project logger** (e.g., `StructuredLogger`), **not** `print()` or default logging.
- Logs must be **clear and actionable**, not cryptic.

# ERRORS
- define new exceptions if needed
- errors must focus on root cause and not the side effect.
- All errors must include **cause, references/context**, and **recovery options** where possible.

## Hardening Guidance
- Run and enhance /home/gofr/devroot/gofr-dig/test/code_quality/test_code_quality.py to ensure code stays clean and simple
- review code after writing is as a senior engineer and security SME and harden against common security issues and code quality issues.

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