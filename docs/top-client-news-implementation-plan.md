# Top Client News (Alpha Engine) -- Implementation Plan

## What / Why

Add a Defense/Offense bias slider to the existing Client News panel so a sales
trader can dial between risk-first and opportunity-first briefs for the same
client without losing context (client, time window, filters). The slider
exposes the full `opportunity_bias` range [0.0, 1.0] with labeled endpoints
(Defense / Offense) and a center detent at 0.5.

Backend tool: `get_top_client_news` -- already called by the UI.
Key new parameter: `opportunity_bias` (0.0 = Defense, 1.0 = Offense).

Reference: `gofr-iq/docs/mcp-tool-interface.md`, sections "get_top_client_news
(Alpha Engine)" and "Pattern 8".

---

## Current State

| Layer | File | Notes |
|-------|------|-------|
| Types | `src/types/gofrIQ.ts` | `NewsArticle` already has `relevance_score`, `reasons`, `why_it_matters_base`, `affected_instruments`, `impact_score`, `impact_tier`. `ClientFeedResponse` wraps `articles[]`. |
| API | `src/services/api/index.ts` (`getClientFeed`) | Calls `get_top_client_news` with hardcoded `time_window_hours: 24`, `limit: 3`, `include_*: true`. No `opportunity_bias` param. |
| Component | `src/components/common/ClientNewsPanel.tsx` | Renders articles with tier chip, instruments, headline, base-why, reason badges, "Why?" LLM enrichment. Has a "show all" filter toggle. |
| Page | `src/pages/Client360View.tsx` | Mounts `ClientNewsPanel` with `clientGuid`, `clientName`, `authToken`, `impactThreshold`, `restrictions`. |

The UI can already render all the article fields that `get_top_client_news`
returns. The only missing piece is exposing the `opportunity_bias` parameter
and letting the trader control `limit` and `time_window_hours`.

---

## Steps

### Step 1 -- Extend `api.getClientFeed` signature [DONE]

File: `src/services/api/index.ts`

Add optional parameters so callers can pass them through:

```
getClientFeed(
  authToken: string,
  clientGuid: string,
  limit?: number,           // default 3, max 10
  minImpactScore?: number,  // default 0
  opportunityBias?: number, // default 0.0 (defense)
  timeWindowHours?: number, // default 24, max 168
): Promise<ClientFeedResponse>
```

Inside the function, forward `opportunity_bias` and `time_window_hours` to the
MCP tool call. Remove the `Math.min(limit, 3)` cap (the tool itself caps at 10;
the old cap was an LLM-cost guard that `get_top_client_news` no longer needs
because `why_it_matters_base` is deterministic).

### Step 2 -- Add controls to `ClientNewsPanel` [DONE]

File: `src/components/common/ClientNewsPanel.tsx`

#### 2a. New props (optional, with defaults)

No new required props. All new state is local to the panel:

- `opportunityBias`: number in [0.0, 1.0] -- local state, default 0.0.
- `limit`: number -- local state, default 3.
- `timeWindowHours`: number -- local state, default 24.

#### 2b. Defense / Offense slider

Add a labeled MUI `Slider` immediately below the panel heading.

Layout (single row):

```
  Defense  |========O================|  Offense
  (0.0)              (0.5)              (1.0)
```

Behaviour:
- Range: 0.0 -- 1.0, step 0.05 (20 discrete positions).
- Default value: 0.0 (Defense).
- Endpoint labels: "Defense" (left) and "Offense" (right) rendered as
  `Typography variant="caption"` flanking the slider.
- Marks at 0.0, 0.5, 1.0 for visual anchoring.
- Current numeric value displayed as a tooltip on the thumb
  (MUI `valueLabelDisplay="auto"`).
- Debounced fetch: slider changes update local state immediately but the
  API call is debounced by 400 ms so dragging does not spam requests.
  Use a `useRef` + `setTimeout` pattern (no new deps).
- The slider is compact (max-width 260px) and sits inline with the limit
  and time-window selects.

Note on vector candidates: the engine only activates vector/embedding-based
candidates when `opportunity_bias > 0.5` AND the client has
`mandate_embedding`. The UI does not need to enforce this; the engine
handles it silently. However, the 0.5 mark on the slider serves as a
visual hint of this threshold.

#### 2c. Limit + Time Window controls

Add a small inline controls row beneath the toggle:

- **Limit**: MUI `Select` with options 3, 5, 10.
- **Time window**: MUI `Select` with options 1h, 4h, 12h, 24h, 48h, 168h (1 week).

These are secondary controls (caption-sized, muted) so they do not dominate the
panel. They also become `useEffect` deps so changing them triggers a re-fetch.

#### 2d. Bias indicator

Show a one-line contextual label above the article list that adapts to the
current slider value:

| Range | Label |
|-------|-------|
| 0.0 | Defense -- prioritising holdings risk |
| 0.01 -- 0.49 | Mostly defense (bias {value}) |
| 0.50 | Balanced |
| 0.51 -- 0.99 | Mostly offense (bias {value}) |
| 1.0 | Offense -- prioritising thematic opportunities |

Rendered as `Typography variant="caption" color="text.secondary"` -- no
Alert box, to keep the panel compact.

#### 2e. Wire fetch to new params

Update the `fetchNews` call:

```ts
const response = await api.getClientFeed(
  authToken,
  clientGuid,
  limit,
  effectiveThreshold,
  opportunityBias,   // slider value, 0.0 -- 1.0
  timeWindowHours,
);
```

The `useEffect` dep array includes `debouncedBias` (not the raw slider
value) to avoid re-fetching on every drag step. A ref-based debounce
updates `debouncedBias` 400 ms after the last slider change.

### Step 3 -- Reason badge ordering [DONE -- verified]

Already implemented. Reasons like `DIRECT_HOLDING`, `WATCHLIST`, `COMPETITOR`,
`SUPPLY_CHAIN`, `THEMATIC`, `VECTOR` are rendered as outlined chips via
`humanizeReason()`. No change needed; this step is a verification checkpoint.

Ensure `VECTOR` (which only appears when `opportunity_bias > 0.5` and client
has `mandate_embedding`) renders correctly.

### Step 4 -- Relevance score display [DONE]

The articles are already sorted by `relevance_score` server-side (do not
re-rank). Add a small numeric label next to each article's tier chip showing
`relevance_score` (0-1 float, display as percentage, e.g. "87%"). This helps
the trader gauge how strongly each item matched the lens.

Update the article row to include:

```
[Gold 72] [87%] BANKO, FIN  ........  4h ago
```

Where `87%` is `Math.round(relevance_score * 100)` shown as a muted chip or
text. Only show if `relevance_score` is defined.

### Step 5 -- Skeleton & loading UX [DONE -- verified]

When the toggle switches, the panel should:

1. Immediately show a skeleton or spinner overlay (already handled by
   `loading` state and `<SkeletonNews />`).
2. Clear old articles so stale offense results do not linger while defense
   loads (and vice versa).

Already mostly handled by the existing `setLoading(true)` / `setArticles([])`
pattern. Verify that toggling defense/offense does not flash old results.

### Step 6 -- Update `ClientFeedResponse` type (if needed) [DONE -- no change needed]

The existing `ClientFeedResponse` already matches the response shape
(`articles[]`, `total_found`). No change needed unless the backend adds new
top-level fields. Verify at integration time.

### Step 7 -- Tests [DONE]

File: `tests/code_quality/` (structural checks, if applicable)

- Verify `opportunity_bias` is forwarded in the MCP call args. -- PASS
- Verify slider value passes through as-is (float 0.0 -- 1.0). -- PASS
- Verify `limit` cap is <= 10. -- PASS (clamped via Math.min/max)
- Verify `time_window_hours` cap is <= 168. -- PASS (clamped via Math.min/max)
- Verify debounce: rapid slider changes result in a single API call. -- PASS (400ms ref timer)

Ran `./scripts/code-quality.sh` -- all checks passed (tsc + eslint).

---

## Files Changed (Summary)

| File | Change |
|------|--------|
| `src/services/api/index.ts` | Add `opportunityBias`, `timeWindowHours` params to `getClientFeed`; forward to MCP call; remove `Math.min(limit, 3)` cap. |
| `src/components/common/ClientNewsPanel.tsx` | Add Defense/Offense bias slider (debounced), limit select, time-window select, bias indicator label, relevance-score display. Wire new params into fetch. |
| (no new files) | All changes are additive to existing files. |

---

## Not in Scope

- Persistent bias preference (localStorage / user settings). Can be added
  later if traders want the slider position to stick across sessions.
- Additional "Why?" LLM enrichment changes -- existing on-demand pattern is
  unchanged.
- `mandate_embedding` management -- that is a backend concern; the UI just
  passes `opportunity_bias` and lets the engine decide whether vector
  candidates activate.

---

## Acceptance Criteria

1. Defense/Offense slider (0.0 -- 1.0) is visible in the Client News panel
   with labeled endpoints and marks at 0.0, 0.5, 1.0.
2. Moving the slider re-fetches (debounced) and returns different (or
   partially different) article sets for the same client.
3. Each article shows: title, impact tier + score, affected instruments,
   `why_it_matters_base`, reason badges, relevance score percentage.
4. Reason badges include `THEMATIC` and `VECTOR` when returned by the engine.
5. Sort order matches server response (no client-side re-ranking).
6. Limit and time-window controls work and trigger re-fetch.
7. No regressions in existing news panel functionality (filter toggle, "Why?"
   enrichment, document view dialog).
