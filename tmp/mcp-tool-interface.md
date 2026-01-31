# GOFR-IQ MCP Tool Interface (Concise)

## How to Call
- Base URL: http://gofr-iq:8080
- Endpoint pattern: POST /tools/{tool_name} with JSON body
- Auth: Authorization: Bearer <token> (preferred) or body field auth_tokens: ["<token>"]
- Response envelope (success): {status: "success", data: {...}, message: "..."}
- Response envelope (error): {status: "error", error_code, message, recovery_strategy?, details?}
- Streaming: Standard HTTP responses; safe to use fetch() with ReadableStream if you want progressive rendering.

## Shared Types
- UUID: 36-char lowercase with hyphens (e.g., 550e8400-e29b-41d4-a716-446655440000)
- Ticker: AAPL, 9988.HK, 700.HK
- Impact score: 0–100; tiers: PLATINUM, GOLD, SILVER, BRONZE, STANDARD
- Admin-only tools: create_source, update_source, delete_source, delete_document

## Tools (24)

### Client Management
- create_client(name, client_type, alert_frequency, impact_threshold, mandate_type?, benchmark?, horizon?, esg_constrained?) -> {guid, portfolio_guid, watchlist_guid}
- list_clients(client_type?, limit?) -> {clients:[{guid,name,client_type,portfolio_guid,watchlist_guid}]}
- get_client_profile(client_guid) -> {name, client_type, alert_frequency, impact_threshold, mandate_type, benchmark, ...}
- update_client_profile(client_guid, alert_frequency?, impact_threshold?, mandate_type?, benchmark?) -> {updated_fields,...}
- get_client_feed(client_guid, limit?, min_impact_score?, impact_tiers?, include_portfolio?, include_watchlist?) -> {articles:[...]}

### Portfolio
- add_to_portfolio(client_guid, ticker, weight, shares?, avg_cost?) -> {ticker, weight, shares}
- get_portfolio_holdings(client_guid) -> {holdings:[{ticker, weight, shares, avg_cost}]}
- remove_from_portfolio(client_guid, ticker) -> {ticker, message}

### Watchlist
- add_to_watchlist(client_guid, ticker, alert_threshold?) -> {ticker, alert_threshold}
- get_watchlist_items(client_guid) -> {watchlist:[{ticker, alert_threshold}]}
- remove_from_watchlist(client_guid, ticker) -> {ticker, message}

### Documents
- ingest_document(title, content, source_guid, language?, metadata?) -> {guid, group_guid, language, embedding_generated}
- validate_document(title, content, source_guid, language?) -> {is_duplicate, duplicate_guid?, similarity?}
- get_document(guid, date_hint?) -> {guid, title, content, source_guid, language, created_at, metadata, ...}
- delete_document(document_guid, group_guid, confirm, date_hint?) -> {message}
- query_documents(query, n_results?, regions?, sectors?, companies?, languages?, date_from?, date_to?) -> {documents:[...]}

### Sources
- list_sources(region?, source_type?, active_only?) -> {sources:[{guid, name, source_type, region, languages, trust_level}]}
- get_source(source_guid) -> {guid, name, source_type, region, languages, trust_level, active, ...}
- create_source(name, source_type, region?, languages?, trust_level) -> {guid, name, trust_level}
- update_source(source_guid, name?, source_type?, region?, languages?, trust_level?) -> {message}
- delete_source(source_guid) -> {message}

### Knowledge Graph
- explore_graph(node_type, node_id, relationship_types?, max_depth?, limit?) -> {nodes, relationships, node_count}
- get_market_context(ticker, include_peers?, include_events?, include_indices?, days_back?) -> {ticker, company, sector, peers, events, indices}
- get_instrument_news(ticker, days_back?, min_impact_score?, limit?) -> {ticker, articles:[...]}

### Health
- health_check() -> {status, neo4j, chromadb, llm}
