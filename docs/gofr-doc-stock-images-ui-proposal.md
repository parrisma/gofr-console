# Proposal: GOFR-DOC Stock Images picker (use as Image fragments)

## Background
The gofr-doc service now exposes a public stock-images web endpoint:
- GET /images returns a recursive list of available image paths (no auth)
- GET /images/{path} serves the image by relative path (no auth)

The existing authoring tool `add_image_fragment` requires an `image_url` and performs immediate server-side URL validation via HTTP HEAD. It defaults to `require_https=true`.

## Goal
Make stock images easy to use as image fragments from the GOFR Console UI, without forcing users to manually type URLs.

## Non-goals
- No new image upload feature in the console
- No image thumbnails (table-only picker)
- No changes to gofr-doc tool contracts

## Key constraints
- The URL validation happens inside gofr-doc (server-side), so the chosen `image_url` must be reachable from the gofr-doc container/environment.
- Browsers often cannot resolve Docker container hostnames; the console UI must avoid requiring direct browser access to internal hostnames.

## Proposed UX (Doc Builder only)
Location: GOFR-DOC Builder → Fragments → Add Fragment → Image

1) Add a “Browse stock images” button next to the existing `image_url` input.
2) When pressed:
   - Call `GET /api/gofr-doc/images` (this should proxy to gofr-doc `/images`).
   - Show a table of results with one row per image.

Suggested table columns:
- path (the relative path returned by gofr-doc, e.g. `logos/acme.png`)
- url (computed, see “URL modes” below)

Row click behavior:
- Sets `image_url` to the selected row’s computed URL
- Auto-sets `require_https=false` (because the default internal URL mode is http)
- Clears any previous `add_image_fragment` error state

3) Keep manual entry: users can still paste any external public image URL.

## URL modes (choose per environment)
Because gofr-doc validates via server-side HEAD, the UI should support two URL forms and let the user switch which one the picker produces.

A) Internal (recommended for docker/dev)
- Example: `http://gofr-doc-mcp:8040/images/<path>`
- Pros: reliably reachable from gofr-doc within the Docker network
- Cons: not directly usable by the browser; usually requires `require_https=false`

B) Console-proxied (optional)
- Example: `http(s)://<console-host>/api/gofr-doc/images/<path>`
- Pros: browser-friendly; also works if gofr-doc can reach the console host
- Cons: may fail gofr-doc HEAD validation depending on container DNS/routing; depends on environment

UI control:
- A small “URL source” dropdown with values: Internal / Console-proxied
- Default: Internal

## Error handling
- If `GET /api/gofr-doc/images` fails: show a ToolErrorAlert-style message and keep manual URL entry as fallback.
- If `add_image_fragment` fails with image errors (INVALID_IMAGE_URL / IMAGE_URL_NOT_ACCESSIBLE / INVALID_IMAGE_CONTENT_TYPE): show the returned error and keep the selected URL in the field so users can adjust.

## Security notes
- The server already blocks path traversal and restricts file types on `/images/{path}`.
- The console should treat image paths as untrusted strings; when building URLs, URL-encode the path component.
- Never log tokens or embed them in image URLs.

## Implementation outline (console)
- Add a small stock-images fetch helper (plain `fetch`) targeting `/api/gofr-doc/images`.
- Add UI state in `GofrDocBuilder` image fragment form:
  - stockImagesLoading / stockImagesErr / stockImages (string[])
  - urlSource = 'internal' | 'proxy'
- Build computed URL per row based on the selected urlSource and the known gofr-doc host/port:
  - Internal: use the configured gofr-doc container hostname + MCP/web port
  - Proxy: use `/api/gofr-doc/images/<path>` for browser display, and optionally also show the absolute origin URL for copying

## Open questions (to confirm)
- Confirm the gofr-doc `/images` endpoint is served on the same host:port as the MCP server (`gofr-doc-mcp:8040`) in all environments.
- Confirm whether the gofr-doc container can reach the console host URL in the target production deployment; if not, default must remain Internal.
