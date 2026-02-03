# UI LLM Note: Client Profile Attributes (Display + Edit)

## Purpose
Enable the UI to **display and edit client profile attributes** that influence relevance and alerts. These attributes are stored on the `Client` or `ClientProfile` and should be surfaced in the Client 360 and edit flows.

## What to show (read)
Use `get_client_profile` to fetch current values and display:
- **Mandate Type** (`mandate_type`) – investment style.
- **Benchmark** (`benchmark`) – ticker symbol (e.g., SPY).
- **Horizon** (`horizon`) – short | medium | long.
- **ESG Constrained** (`esg_constrained`) – boolean.
- **Alert Frequency** (`alert_frequency`) – realtime | hourly | daily | weekly.
- **Impact Threshold** (`impact_threshold`) – 0–100.

## How to edit (write)
Use MCP tool `update_client_profile` for partial updates. Only send the fields the user changed.

Required input:
- `client_guid`

Optional fields:
- `mandate_type`
- `benchmark`
- `horizon`
- `esg_constrained`
- `alert_frequency`
- `impact_threshold`

## UX guidance
1. **Client 360 → Profile panel**
   - Show all fields with current values.
   - Add an “Edit” action that opens a modal or inline edit state.

2. **Edit form**
   - **Mandate Type**: dropdown with allowed values.
   - **Benchmark**: text input (uppercase ticker).
   - **Horizon**: segmented control (short/medium/long).
   - **ESG**: toggle.
   - **Alert Frequency**: dropdown.
   - **Impact Threshold**: slider (0–100) with numeric input.

3. **Save behavior**
   - Only send changed fields to `update_client_profile`.
   - On success, refresh using `get_client_profile`.

## Validation rules (UI + backend expectations)
- `alert_frequency`: realtime | hourly | daily | weekly.
- `impact_threshold`: 0–100.
- `horizon`: short | medium | long.
- `mandate_type`: equity_long_short | global_macro | event_driven | relative_value | fixed_income | multi_strategy.

## Error handling
- If `update_client_profile` returns `INVALID_ALERT_FREQUENCY` or `INVALID_HORIZON`, show field-level validation.
- If `CLIENT_NOT_FOUND`, prompt user to reselect client.

## API hostnames
When referencing services, use container hostnames (e.g., `gofr-iq-mcp`) rather than `localhost`.
