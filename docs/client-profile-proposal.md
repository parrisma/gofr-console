# Client Profile Enhancements for Dual‑Perspective Coverage

Author: Sales Trading SME (UK Cash Equities)  
Date: 2026‑02‑02

## Purpose

Capture both holdings/watchlist‑driven coverage and mandate‑driven opportunity coverage in a consistent client profile.

---

## 1) Make Better Use of What Is There (No Schema Change)

### A. Existing ClientProfile fields to activate

- `mandate_type`: Use to drive relevance scoring and UI emphasis.
- `benchmark`: Use to identify benchmark‑linked relevance.
- `horizon`: Use to shape recency weighting (shorter horizon = higher recency weight).
- `turnover_rate`: Use to shape urgency (higher turnover = more time‑sensitive).
- `esg_constrained`: Use to filter news and drive exclusions.
- `impact_threshold` + `alert_frequency`: Use to tune prioritization and feed filtering.

### B. Existing relationships that are defined but not populated

- `EXCLUDES` (ClientProfile → Company/Sector): enables ESG/ethical/sector exclusions.
- `SUBSCRIBED_TO` (Client → Sector/Region/EventType): enables mandate topics and proactive coverage.
- `BENCHMARKED_TO` (ClientProfile → Index): already defined; should influence relevance scoring.

### Immediate (no schema change) actions

- Apply `mandate_type`, `benchmark`, `horizon`, and `turnover_rate` in `get_top_client_news` scoring.
- Populate `EXCLUDES` and `SUBSCRIBED_TO` during client onboarding and profile updates.
- Surface these fields in the Client 360 header and show their effect on news relevance.

---

## 2) Extend Client Profile (Schema + API Extension)

### A. Mandate & theme structure

- `investment_themes`: list of themes (e.g., AI, Clean Energy, Emerging Tech, Healthcare Innovation).
- `sector_focus`: `{ overweight[], underweight[], excluded[] }`.
- `geography_focus`: `{ home_bias, regions_allowed[], regions_excluded[] }`.

### B. Constraints

- `esg_policy`: `NONE | EXCLUSION_ONLY | INTEGRATION | IMPACT | ENGAGEMENT`.
- `esg_exclusions`: categories (Coal, Tobacco, Weapons, Gambling).
- `liquidity_min`: `MEGA | LARGE | MID | SMALL | MICRO`.
- `max_position_size`, `single_stock_limit`.

### C. Trading preferences

- `trading_style`: `PATIENT | OPPORTUNISTIC | AGGRESSIVE`.
- `preferred_execution`: `ALGO | WORKED | BLOCK | RISK`.
- `typical_order_size`: `SMALL | MEDIUM | LARGE | BLOCK`.
- `time_zone`: coverage hours.

### D. Relationship context (coverage)

- `coverage_priority`: `TIER_1 | TIER_2 | TIER_3`.
- `primary_contact`, `last_meeting`, `meeting_frequency`.
- `communication_preference`, `notes`.

---

## Benefits

- Enables true dual‑perspective coverage:
  - **Reactive**: Holdings/Watchlist
  - **Proactive**: Mandate/Themes/Constraints
- Allows opportunity alerts aligned with mandate even when not owned.
- Improves relevance scoring beyond generic semantic matching.

---

## Next Steps

- **Phase 1**: Populate and surface existing fields/relationships.
- **Phase 2**: Extend schema + MCP API; update scoring and UI.
