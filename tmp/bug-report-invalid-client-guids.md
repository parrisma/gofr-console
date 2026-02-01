# Bug Report: Inconsistent Client GUID Format Between list_clients and get_client_profile

## Summary
The `list_clients` MCP tool returns clients with invalid GUID formats (e.g., `client-hedge-fund`), but `get_client_profile` requires a valid 36-character UUID, causing API calls to fail with validation errors.

## Severity
**High** - Breaks client detail view functionality entirely

## Environment
- MCP Server: `gofr-iq-mcp:8080`
- Protocol: MCP HTTP Streamable
- Auth Token: Admin group token

## Steps to Reproduce

### 1. Call `list_clients`:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_clients",
    "arguments": {
      "auth_tokens": ["<valid_admin_token>"]
    }
  }
}
```

### 2. Observe response contains invalid GUIDs:
```json
{
  "status": "success",
  "data": {
    "clients": [
      {
        "client_guid": "client-hedge-fund",  // ❌ NOT a valid UUID
        "name": "Apex Capital",
        "client_type": null,
        "group_guid": "group-simulation",
        "created_at": null
      },
      {
        "client_guid": "client-retail",  // ❌ NOT a valid UUID
        "name": "DiamondHands420",
        ...
      },
      {
        "client_guid": "client-pension-fund",  // ❌ NOT a valid UUID
        "name": "Teachers Retirement System",
        ...
      }
    ]
  }
}
```

### 3. Attempt to call `get_client_profile` with returned GUID:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_client_profile",
    "arguments": {
      "client_guid": "client-hedge-fund",
      "auth_tokens": ["<valid_admin_token>"]
    }
  }
}
```

### 4. Get validation error:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{
      "type": "text",
      "text": "Error executing tool get_client_profile: 1 validation error for get_client_profileArguments\nclient_guid\n  String should have at least 36 characters [type=string_too_short, input_value='client-hedge-fund', input_type=str]"
    }],
    "isError": true
  }
}
```

## Expected Behavior
`list_clients` should return clients with valid UUID format GUIDs:
```json
{
  "client_guid": "550e8400-e29b-41d4-a716-446655440000",  // ✅ Valid UUID
  "name": "Apex Capital",
  ...
}
```

This would allow the GUID to be used directly with `get_client_profile`.

## Actual Behavior
- `list_clients` returns short string IDs like `client-hedge-fund`
- `get_client_profile` validates that `client_guid` must be exactly 36 characters (UUID format)
- The two APIs are incompatible

## Root Cause (Hypothesis)
The test/simulation data in Neo4j appears to use human-readable string IDs instead of proper UUIDs. The validation on `get_client_profile` is correct, but the data seeded by `list_clients` is inconsistent.

## Suggested Fix Options

### Option A: Fix the test data
Update the Neo4j seed data to use proper UUIDs for client nodes:
```cypher
// Instead of:
CREATE (c:Client {guid: 'client-hedge-fund', name: 'Apex Capital'})

// Use:
CREATE (c:Client {guid: '550e8400-e29b-41d4-a716-446655440000', name: 'Apex Capital'})
```

### Option B: Relax validation on get_client_profile
If short string IDs are intentional, update the Pydantic model to accept any string:
```python
# Instead of:
client_guid: str = Field(..., min_length=36, max_length=36)

# Use:
client_guid: str = Field(..., min_length=1)
```

### Option C: Map short IDs to UUIDs
If both formats must coexist, create a lookup mechanism.

## Impact
- Client management UI cannot display client details
- Any workflow requiring `get_client_profile` after `list_clients` is broken
- Affects all consumers of the MCP API

## Workaround (Current)
The GOFR Console UI now validates GUIDs client-side and shows an error message instead of crashing:
```
Invalid client GUID format: "client-hedge-fund". Expected a valid UUID.
```

## Related Files
- MCP Tool Interface: `/home/gofr/devroot/gofr-console/tmp/mcp-tool-interface.md`
- Neo4j Schema: `/home/gofr/devroot/gofr-console/tmp/neo4j-schema.md` (shows Client node should have UUID format)

## Reporter
GOFR Console UI Development

## Date
2026-02-01
