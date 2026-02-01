# Bug Report: get_client_feed Returns Identical Results for Different Clients

## Summary
The `get_client_feed` MCP tool is returning identical article lists for different clients, ignoring client-specific characteristics like portfolio holdings, watchlist items, and client type.

## Console Implementation
The GOFR Console Client 360 View calls `get_client_feed` to display personalized news for each client.

### API Call
```typescript
// File: src/services/api/index.ts
const result = await client.callTool('get_client_feed', {
  client_guid: clientGuid,
  limit: 10,
  min_trust: 0,
  auth_tokens: [authToken],
});
```

### Parameters Passed
- `client_guid`: Valid UUID of selected client (e.g., `"751c34ea-a37a-40af-ada5-ea37d7541b0f"`)
- `limit`: `10` (number of articles requested)
- `min_trust`: `0` (minimum trust level filter)
- `auth_tokens`: Array with valid JWT token for admin group

## Expected Behavior
According to the MCP tool interface documentation:
> `get_client_feed(client_guid, limit?, min_trust?) -> {articles:[...], total_count}`
> 
> Returns **ranked, most relevant + recent items for that client** based on:
> - Client's portfolio holdings
> - Client's watchlist items  
> - Client type (HEDGE_FUND, PENSION_FUND, etc.)
> - Client mandate/preferences

Different clients with different holdings, watchlists, and types should receive **different, personalized** article lists.

## Actual Behavior
The server returns **identical** article lists regardless of `client_guid`.

### Evidence from Console Logs

**Request 1: Apex Capital (HEDGE_FUND)**
- Client GUID: `dbb8590a-38d8-4f27-882b-a7cdda925fe9`
- Holdings: 4 stocks (QNTM, BANKO, VIT, GTX)
- Watchlist: 2 stocks (FIN, NXS)

**Request 2: Teachers Retirement System (PENSION_FUND)**  
- Client GUID: `dbb8590a-38d8-4f27-882b-a7cdda925fe9`
- Holdings: Different portfolio
- Watchlist: Different stocks

**Both Requests Returned Identical Response:**
```json
{
  "articles": [
    {
      "document_guid": "06ca1a8d-54c4-44d3-807b-af818600930a",
      "title": "Update regarding Vitality Pharma\n",
      "impact_score": 95,
      "impact_tier": "PLATINUM",
      "relevance_score": 95
    },
    {
      "document_guid": "12ed147f-7a77-4072-a66a-516a8dee1efc",
      "title": "Update regarding Quantum Compute\n",
      "impact_score": 90,
      "impact_tier": "PLATINUM",
      "relevance_score": 90
    },
    {
      "document_guid": "6cc41839-c285-4afc-9da7-714a588c9d93",
      "title": "Update regarding the drugmaker\n",
      "impact_score": 90,
      "impact_tier": "PLATINUM",
      "relevance_score": 90
    }
    // ... (7 more identical articles)
  ],
  "total_count": 10,
  "filters_applied": {
    "min_impact_score": null,
    "impact_tiers": null,
    "include_portfolio": true,
    "include_watchlist": true
  }
}
```

## Analysis
1. The `filters_applied` object shows `"include_portfolio": true` and `"include_watchlist": true`, suggesting the server **intends** to filter by these
2. However, the returned articles are identical across different clients
3. The `relevance_score` equals `impact_score` for all articles, suggesting no client-specific relevance calculation is happening
4. Articles appear to be sorted purely by global `impact_score`, not personalized relevance

## Hypothesis
The `get_client_feed` implementation may be:
- Ignoring the `client_guid` parameter
- Not traversing `HAS_PORTFOLIO` → `HOLDS` relationships to get client holdings
- Not traversing `HAS_WATCHLIST` → `WATCHES` relationships to get watchlist items
- Not considering client type from `Client` → `IS_TYPE_OF` → `ClientType`
- Falling back to generic "top N by impact_score" query

## Expected Fix
The Neo4j query should:
1. Start from the `Client` node with given `client_guid`
2. Traverse to get portfolio holdings: `(c:Client)-[:HAS_PORTFOLIO]->()-[:HOLDS]->(i:Instrument)`
3. Traverse to get watchlist: `(c:Client)-[:HAS_WATCHLIST]->()-[:WATCHES]->(i2:Instrument)`
4. Find documents affecting these instruments: `(i)-[:AFFECTS]-(d:Document)`
5. Boost relevance scores for documents about client's holdings/watchlist
6. Consider client type sector preferences
7. Return documents ranked by **personalized relevance**, not just global impact

## Reproduction Steps
1. Navigate to Client 360 View in console
2. Select "Apex Capital" (HEDGE_FUND with tech holdings)
3. Note the news articles displayed
4. Select "Teachers Retirement System" (PENSION_FUND with different holdings)
5. Observe: Same exact articles appear in same order

## Impact
**High** - This breaks the core value proposition of personalized client news feeds. Sales traders cannot use this view to understand client-specific market impacts.

## Test Clients Available
- `751c34ea-a37a-40af-ada5-ea37d7541b0f` - Apex Capital (HEDGE_FUND)
  - Holdings: QNTM, BANKO, VIT, GTX
  - Watchlist: FIN, NXS
  
- `dbb8590a-38d8-4f27-882b-a7cdda925fe9` - Teachers Retirement System (PENSION_FUND)
  - Different portfolio/watchlist

Expected: Different articles prioritized based on their specific holdings.
