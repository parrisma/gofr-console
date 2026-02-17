# UI Usability Program — Final acceptance (Phases 1–10)

Date: 2026-02-17
Branch: feature/ui-usability

## Automated checks run

- Code quality: ./scripts/code-quality.sh
  - Result: PASS
- Unit tests: pnpm test --run
  - Result: PASS
- Production build: pnpm build
  - Result: PASS
  - Note: Vite warns about large bundle chunks (>500 kB). This is a performance warning, not a functional failure.
- Security scan: ./scripts/security-scan.sh
  - Result: PASS
  - Note: Trivy reported vulnerabilities in the dev container image / base OS packages. The script reports this as non-blocking locally.

## Manual walkthrough checklist (UI)

These steps require the UI to be running and the backing services available.

GOFR-IQ:
- Open Client 360
- Select a token
- Select a client
- Confirm panels load (news/portfolio) and profile can be edited/saved

GOFR-DIG:
- Select a token
- Paste a URL
- Apply anti-detection (if needed)
- Preview structure
- Extract content
- View sessions

GOFR-DOC:
- Discovery: browse templates/styles, click rows to select template/style
- Sessions: create a document session (template dropdown), check status
- Builder: set global parameters, add/remove fragments (examples popups help), list fragments
- Render: choose styling, generate HTML/PDF, download proxy output

## Expected UX consistency signals

- Tokens are always selected via the consistent TokenSelect control.
- Help is always available via (?) and raw JSON is always available via (i), but neither dominates the primary task.
- Clickable table rows show hover affordance and preserve a selected-row highlight.
- Errors describe likely causes and provide a next action.
