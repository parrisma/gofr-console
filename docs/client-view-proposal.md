# GOFR IQ Client View & Watchlist Management Proposal

**From:** Senior UK Cash Equities Sales Trader & SME  
**Date:** 02 Oct 2024  
**Subject:** Proposal for Unified 'Client 360' Dashboard & Watchlist Workflow

---

## 1. Executive Summary

As a sales trader covering institutional accounts, my screen real estate is prime property. I don't have time to tab-switch between a CRM, a pricing terminal, and a news feed when a client is on the squawk.

This proposal outlines a unified **"Client 360"** view for GOFR-IQ. The objective is simple: **Speed to Alpha**. When I query a client, I need to immediately see what they hold, what they are watching, and what news is impactful to *them* specifically. Furthermore, I need a frictionless way to maintain their interests (Watchlists) so the system can alert me when to pick up the phone.

---

## 2. The "Client 360" Dashboard View

The view should be a single pane of glass, dense with data but strictly organised. No fluff.

### 2.1 Header: The "Vitals"

*Top strip, always visible.*

* **Client Name** & **Tier** (e.g., Platinum/Gold) - *Immediate context on priority.*
* **Mandate Profile**: (Derived from `ClientProfile` node)
  * *Examples:* "Global Macro", "UK High Alpha", "ESG Strict".
  * *Constraint Flags:* Red badges for "No Tobacco", "No Gaming" (via `EXCLUDES` relationship). This prevents me from pitching a block that they compliance-can't touch.
* **Coverage & Turnover**: Who covers them? What is their portfolio turnover rate?

### 2.2 Panel A: Portfolio & Holdings (The "Book")

*Left/Centre Column - The source of truth.*

* **Data Source**: `(:Client)-[:HAS_PORTFOLIO]->(:Portfolio)-[:HOLDS]->(:Instrument)`
* **Visualisation**:
  * Sortable grid: Ticker, Name, Weight, vs Benchmark (if available).
  * **News Heatmap**: Visual indicators (glowing borders or status lights) on tickers that have fresh `(:Document)-[:AFFECTS]->(:Instrument)` signals with high impact scores.
  * *Aggregation*: Toggle to view exposure by Sector (`:BELONGS_TO`) or Region. I need to know instantly if they are overweight Energy before I send them a research note on Shell.

### 2.3 Panel B: Watchlists & Interests (The "Shadow Book")

*Right Column - The actionable conversations.*

* **Data Source**: `(:Client)-[:HAS_WATCHLIST]->(:Watchlist)-[:WATCHES]->(:Instrument)`
* **Functionality**:
  * **Active Watchlists**: List grouped by theme (e.g., "UK Banks", "Rate Sensitive", "Merger Arb").
  * **Alert Levels**: Next to each ticker, show the trigger level (Price/Event) defined in the `WATCHES` relationship properties.
  * **"Suggested"**: Instruments they *should* be watching based on their holdings or peers (a "You might like" section driven by graph adjacency).

### 2.4 Panel C: Interaction & Signal Stream

*Bottom/Ticker Tape - The flow.*

* **Context**: Mix of recent document hits relevant to their book.
* **Filter**: "Show me news aimed at [Client Portfolio] with magnitude > 70".

---

## 3. Workflow: Watchlist Maintenance ("The Blotter")

Maintaining a watchlist is currently a chore. It needs to be as fast as entering an order.

### 3.1 Quick-Add Mechanics

* **Ticker Entry**: A global command bar. Type `VOD LN <Enter>` -> Adds Vodafone to the *currently selected* client's active watchlist.
* **Drag & Drop**: Drag a ticker from the "Portfolio" panel to the "Watchlist" panel to flag it for closer monitoring.

### 3.2 The "Smart Edit" Modal

When I add an instrument or double-click a watchlist item:

1. **Level Setting**: Input basic price levels (Support/Resistance).
2. **Event Triggers**: Checkboxes for event types (from `EventType` node):
    * [x] Earnings
    * [x] M&A Rumours
    * [ ] Analyst Upgrades
3. **Expiry**: "Watch until [Date]" or "Good till Cancelled". Dead watchlists clog up the view.

### 3.3 Bulk Maintenance

* **Import/Export**: Ability to paste a list of ISINs/Tickers from Excel or Bloomberg directly into a watchlist.
* **Rebalance**: "Update weights from latest regulatory filing" button.

---

## 4. Peer Review: UX & Sales Trading Analysis

**Reviewer**: Head of Product / Ex-Equities Trader

### 4.1 Strengths (Sales Trading Perspective)

* **Compliance Safety**: Promoting the "Mandate Profile" and `EXCLUDES` constraints to the top level is a massive win. It saves embarrassing trade fails where we pitch restricted names.
* **Signal to Noise**: Filtering the news feed by the specific portfolio (via the Graph relationships) is the killer feature. Most tools just show a generic "GLEN LN" news feed. Showing "GLEN LN news *relative to* Client A's overweight position" is actionable alpha.
* **Watchlist Agility**: The command bar entry (`VOD LN <Enter>`) is exactly how traders operate. Mouse clicks are too slow during the open.

### 4.2 Critiques & Improvements (UX Perspective)

* **Information Density Risk**: Panel A (Holdings) and Panel B (Watchlists) side-by-side might be too crowded on a laptop screen.
  * *Recommendation*: Use a "Tabbed" approach for Portfolio vs. Watchlist, OR a "Master-Detail" interaction where clicking a ticker opens a drawer with both Holdings data and Watchlist status.
* **Alert Fatigue**: If a client has 500 names in their portfolio and we alert on every `AFFECTS` signal > 50, the trader will mute the application.
  * *Recommendation*: Implement a "Decay Lambda" visualizer. Show the signal fading over time. Also, standardise the "Impact Tier" colour coding (Platinum = Flashing Red, Bronze = Grey) to allow rapid scanning.
* **Missing "Reverse Inquiry"**: The proposal looks at *one* client.
  * *Recommendation*: We need a "Reverse Look-up". If I see news on *Barclays*, I need to click *Barclays* and see a list of ALL clients who hold it or watch it. That is the most common workflow for a sales trader (News -> Who cares? -> Call).

### 4.3 Technical Feasibility (Graph Check)

* All proposed data points exist in `neo4j-schema.md`.
* `ClientProfile` (`esg_constrained`, `turnover_rate`) is correctly leveraged.
* `WATCHES` relationship supports `alert_threshold`, which maps to the proposed workflow.
* *Gap Identified*: The schema implies `add_company_mention()` creates company nodes, but we need to ensure the `Instrument` -> `Company` link (`ISSUED_BY`) is robust so that news on "Shell PLC" flows to "SHEL LN" in the portfolio view.

### 4.5 Revised "Reverse Inquiry" View

*Based on peer review, we must add a secondary view:*
**"The Axe Sheet"**

* Input: Ticker (e.g., TSLA)
* Output: List of Clients sorted by:
    1. % Holdings (Who is long?)
    2. Watchlist Presence (Who is looking?)
    3. Recent Interaction (Who did we last speak to about this?)

---

**Approval Status**: APPROVED with addition of Section 4.5 (Reverse Inquiry).

---

## 5. Implementation Plan (Step-by-Step)

This section breaks the "Client 360" dashboard into incremental deliverables with MCP verification at each stage.

### 5.0 Pre-Flight: MCP Communication Test
**Objective:** Verify MCP connectivity and authentication.

**Tasks:**
1. Implement basic MCP session management (if not already done).
2. Test `health_check()` tool.
3. Verify auth tokens are valid.

**MCP Verification:**
```bash
# Initialize session
SESSION=$(curl -s -D /tmp/headers.txt -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"gofr-console","version":"0.0.1"}}}' \
  > /dev/null 2>&1; grep -i "mcp-session-id:" /tmp/headers.txt | cut -d: -f2 | tr -d ' \r')

# Test health_check
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"health_check","arguments":{}}}'
```

**Expected Output:**
```json
{"status": "success", "data": {"neo4j": "ok", "chromadb": "ok", "llm": "ok"}}
```

**Deliverable:** `McpClient` class with session management and error handling.

---

### 5.1 Client List & Basic Details
**Objective:** Display list of clients with basic profile information.

**Tasks:**
1. Create `ClientList` component (reusable).
2. Implement `listClients()` API wrapper in `services/api/index.ts`.
3. Implement `getClientProfile()` API wrapper.
4. Display Client Name, Type, and GUID.

**MCP Verification:**
```bash
# List clients
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_clients","arguments":{"auth_tokens":["'$TOKEN'"]}}}'

# Get client profile
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_client_profile","arguments":{"client_guid":"<VALID_GUID>","auth_tokens":["'$TOKEN'"]}}}'
```

**Expected Data Shape:**
```json
// list_clients
{"clients": [{"guid": "uuid", "name": "Client A", "client_type": "HEDGE_FUND", "portfolio_guid": "uuid", "watchlist_guid": "uuid"}]}

// get_client_profile
{"name": "Client A", "client_type": "HEDGE_FUND", "mandate_type": "GLOBAL_MACRO", "alert_frequency": "REAL_TIME", "impact_threshold": 50, "esg_constrained": true}
```

**Deliverable:** Basic Client List view with clickable rows.

---

### 5.2 Header: "The Vitals"
**Objective:** Display client profile header with mandate and constraints.

**Tasks:**
1. Create `ClientHeader` component.
2. Display: Name, Type, Mandate, Alert Frequency, ESG Flag.
3. Add visual "badges" for constraints (e.g., red badge for ESG).

**MCP Data Source:**
- `get_client_profile(client_guid)` → returns `mandate_type`, `esg_constrained`, `impact_threshold`, etc.

**Design Notes:**
- Use Material UI `Chip` components for badges.
- Mandate type should be prominent (h5 typography).
- ESG flag: Red chip with "ESG Constrained" text.

**Deliverable:** `ClientHeader.tsx` with styled profile summary.

---

### 5.3 Panel A: Portfolio & Holdings (The "Book")
**Objective:** Display client's portfolio holdings in a sortable table.

**Tasks:**
1. Create `PortfolioPanel` component.
2. Implement `getPortfolioHoldings()` API wrapper.
3. Display: Ticker, Name, Weight, Shares, Avg Cost.
4. Add sorting by Weight (descending by default).
5. Add basic filtering (e.g., "Show only > 5% weight").

**MCP Verification:**
```bash
# Get portfolio holdings
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"get_portfolio_holdings","arguments":{"client_guid":"<VALID_GUID>","auth_tokens":["'$TOKEN'"]}}}'
```

**Expected Data Shape:**
```json
{"holdings": [{"ticker": "AAPL", "name": "Apple Inc.", "weight": 0.15, "shares": 1000, "avg_cost": 150.00}]}
```

**Design Notes:**
- Use Material UI `DataGrid` or custom table.
- Weight should be displayed as percentage (15.0%).
- Add "Total" row at bottom (100%).

**Deliverable:** `PortfolioPanel.tsx` with sortable holdings table.

---

### 5.4 Panel B: Watchlists & Interests (The "Shadow Book")
**Objective:** Display client's watchlist items with alert thresholds.

**Tasks:**
1. Create `WatchlistPanel` component.
2. Implement `getWatchlistItems()` API wrapper.
3. Display: Ticker, Alert Threshold.
4. Add "grouped by theme" logic (future enhancement - use metadata if available).

**MCP Verification:**
```bash
# Get watchlist items
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"get_watchlist_items","arguments":{"client_guid":"<VALID_GUID>","auth_tokens":["'$TOKEN'"]}}}'
```

**Expected Data Shape:**
```json
{"watchlist": [{"ticker": "TSLA", "alert_threshold": 70}]}
```

**Design Notes:**
- Display alert threshold as badge next to ticker.
- Color code by threshold level (e.g., >80 = Red, 50-80 = Amber, <50 = Green).

**Deliverable:** `WatchlistPanel.tsx` with ticker list and alert levels.

---

### 5.5 News Heatmap & Impact Signals
**Objective:** Visualize news impact on portfolio holdings.

**Tasks:**
1. Implement `getInstrumentNews()` API wrapper.
2. For each holding in Portfolio, fetch recent news (last 7 days).
3. Add visual indicator (border glow, icon) if news impact > threshold.
4. Cache news data to avoid excessive MCP calls.

**MCP Verification:**
```bash
# Get instrument news for a ticker
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"get_instrument_news","arguments":{"ticker":"AAPL","days_back":7,"min_impact_score":50,"auth_tokens":["'$TOKEN'"]}}}'
```

**Expected Data Shape:**
```json
{"ticker": "AAPL", "articles": [{"guid": "uuid", "title": "Apple announces...", "impact_score": 85, "impact_tier": "GOLD"}], "total_found": 5}
```

**Design Notes:**
- Use `impact_tier` to color code (PLATINUM = Red pulse, GOLD = Amber, SILVER = Blue).
- Show count badge (e.g., "3 alerts").

**Deliverable:** Enhanced `PortfolioPanel.tsx` with news indicators.

---

### 5.6 Watchlist Maintenance: Quick-Add Command Bar
**Objective:** Enable fast ticker entry to add to watchlist.

**Tasks:**
1. Create `CommandBar` component (global or in ClientView).
2. Implement text input with autocomplete for tickers.
3. On `Enter`, call `addToWatchlist()` API.
4. Display confirmation toast.

**MCP Verification:**
```bash
# Add to watchlist
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":8,"method":"tools/call","params":{"name":"add_to_watchlist","arguments":{"client_guid":"<VALID_GUID>","ticker":"VOD","alert_threshold":60,"auth_tokens":["'$TOKEN'"]}}}'
```

**Expected Response:**
```json
{"ticker": "VOD", "alert_threshold": 60, "message": "Added to watchlist"}
```

**Design Notes:**
- Command bar should be always accessible (sticky header or keyboard shortcut Ctrl+K).
- Ticker validation: Check if ticker exists via `get_market_context()` before adding.

**Deliverable:** `CommandBar.tsx` with ticker autocomplete and MCP integration.

---

### 5.7 Watchlist Maintenance: Edit Modal
**Objective:** Allow detailed configuration of watchlist items.

**Tasks:**
1. Create `WatchlistEditModal` component.
2. Triggered by double-click on watchlist item.
3. Display form: Ticker (read-only), Alert Threshold (slider), Expiry Date (optional).
4. On save, call `add_to_watchlist()` to update (same API, updates if exists).

**MCP Verification:**
- Same as 5.6 (update uses same endpoint).

**Design Notes:**
- Use Material UI `Slider` for threshold (0-100).
- Add "Remove" button → calls `removeFromWatchlist()`.

**Deliverable:** `WatchlistEditModal.tsx` with update/delete functionality.

---

### 5.8 Panel C: Client-Specific News Feed
**Objective:** Display news filtered by client's portfolio and watchlist.

**Tasks:**
1. Create `ClientNewsFeed` component.
2. Implement `getClientFeed()` API wrapper.
3. Display: Title, Impact Score, Impact Tier, Source, Date.
4. Add filters: Min Impact Score, Tiers (checkboxes).

**MCP Verification:**
```bash
# Get client feed
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"get_client_feed","arguments":{"client_guid":"<VALID_GUID>","limit":20,"min_impact_score":50,"impact_tiers":["GOLD","PLATINUM"],"include_portfolio":true,"include_watchlist":true,"auth_tokens":["'$TOKEN'"]}}}'
```

**Expected Data Shape:**
```json
{"articles": [{"guid": "uuid", "title": "...", "impact_score": 85, "impact_tier": "GOLD", "created_at": "2024-10-02T10:00:00Z", "source_name": "Bloomberg"}]}
```

**Design Notes:**
- Display as timeline/list with most recent first.
- Use tier color coding (see 5.5).
- Add "decay lambda" visualization (optional) to show signal fading.

**Deliverable:** `ClientNewsFeed.tsx` with filtered news stream.

---

### 5.9 Reverse Inquiry: "The Axe Sheet"
**Objective:** Show which clients hold or watch a given ticker.

**Tasks:**
1. Create `TickerLookup` component (new page or modal).
2. Input: Ticker symbol.
3. Query: Loop through all clients (via `list_clients()`) and check their portfolios/watchlists.
4. Display: Client Name, Holding %, Watchlist Presence, Last Contact Date (if available).

**MCP Verification:**
```bash
# Get all clients
curl -s -X POST "http://gofr-iq-mcp:8080/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: ${SESSION}" \
  -d '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"list_clients","arguments":{"auth_tokens":["'$TOKEN'"]}}}'

# For each client, get portfolio holdings
# (Repeat call from 5.3 for each client_guid)
```

**Design Notes:**
- This is computationally expensive (N clients × 2 API calls).
- **Optimization:** Backend should expose a dedicated `get_ticker_exposure()` tool that does this in Neo4j directly.
- **Fallback:** Client-side aggregation with caching.

**Deliverable:** `TickerLookup.tsx` with reverse client search.

---

### 5.10 Integration & Polish
**Objective:** Assemble all components into the "Client 360" view.

**Tasks:**
1. Create `Client360View.tsx` as master layout.
2. Arrange: Header (top), Portfolio (left), Watchlist (right), News Feed (bottom).
3. Add responsive breakpoints (collapse to tabs on mobile).
4. Implement loading states and error boundaries.
5. Add keyboard shortcuts (e.g., `?` for help, `Ctrl+K` for command bar).

**Design Notes:**
- Use Material UI `Grid` for layout.
- Portfolio and Watchlist should be equal width (50/50 split).
- News Feed should be collapsible.

**Deliverable:** Fully integrated `Client360View.tsx`.

---

### 5.11 Testing & Validation
**Objective:** Verify all MCP interactions and UI flows.

**Test Cases:**
1. **Client Selection:** Click client in list → loads profile, portfolio, watchlist, news.
2. **Quick-Add:** Type `VOD <Enter>` in command bar → ticker added to watchlist.
3. **Edit Watchlist:** Double-click ticker → modal opens → update threshold → saves.
4. **News Filtering:** Set min impact to 80 → only GOLD/PLATINUM articles shown.
5. **Reverse Lookup:** Search for `AAPL` → shows all clients holding it.

**MCP Error Scenarios:**
- Invalid client_guid → Show "Client not found" message.
- Invalid ticker → Show "Ticker not recognized" warning.
- Network timeout → Show retry button.

**Deliverable:** Test plan document and passing test suite.

---

### 5.12 Performance Optimization
**Objective:** Reduce MCP call overhead and improve UX.

**Tasks:**
1. Implement client-side caching (React Query or similar).
2. Batch portfolio/watchlist/news fetches into single API call (backend enhancement).
3. Add pagination to news feed (avoid loading 1000+ articles).
4. Lazy load ticker autocomplete data.

**Deliverable:** Performance report showing sub-500ms load times for Client 360 view.

---

## 6. MCP API Improvements (Backend Enhancements)

Based on the implementation plan, the following MCP tools should be added or enhanced:

1. **`get_client_360(client_guid)`** - Single call to fetch profile + portfolio + watchlist + recent news.
2. **`get_ticker_exposure(ticker)`** - Returns all clients with positions/watchlist items for a ticker.
3. **`batch_get_instrument_news(tickers[], days_back)`** - Fetch news for multiple tickers in one call.
4. **`search_tickers(prefix)`** - Autocomplete support for ticker entry.

These enhancements will reduce client-side API call count by ~70% and improve responsiveness.

---

**Implementation Status:** READY FOR DEVELOPMENT
